/**
 * Browser-based authentication client for Alberta My Health Records and MyChart.
 *
 * Uses Puppeteer with a persistent browser profile so SSO cookies survive
 * across auth attempts. Includes stealth measures to avoid WAF bot detection.
 *
 * Entry point mirrors the manual login flow: navigate to myhealth.alberta.ca,
 * which redirects through the auth chain and establishes BOTH MyChart and MHR
 * sessions in a single trip (via portal redirect chain).
 *
 * Credentials never touch this code — they're entered in the browser.
 */

import puppeteer, { type Page } from 'puppeteer-core';
import { CookieJar, Cookie } from 'tough-cookie';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { logger } from '../utils/logger.js';

const MHR_BASE = 'https://myhealthrecords.alberta.ca';
const MYCHART_BASE = 'https://myahsconnect.albertahealthservices.ca';
const MYCHART_CSRF_URL = `${MYCHART_BASE}/MyChartPRD/Home/CSRFToken`;
const MYCHART_SAML_URL = `${MYCHART_BASE}/MyChartPRD/Authentication/Saml/Login?idp=MADI&forceAuthn=False`;

// SSO login page — user authenticates here, then we navigate to
// MyChart and MHR to establish their sessions using the shared SSO cookies.
const SSO_LOGIN_URL = 'https://account.alberta.ca/ui/sign-in/signin';

const BROWSER_PROFILE_DIR = join(homedir(), '.mhr-records', 'browser-profile');
const LOGIN_TIMEOUT_MS = 180_000; // 3 min to handle login

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface AuthenticateResult {
  mhrCookieJar: CookieJar;
  myChartCookieJar?: CookieJar;
  myChartCsrfToken?: string;
}

/**
 * Monitor a page for 429 rate limiting on SSO endpoints.
 */
function monitorRateLimit(page: Page): () => boolean {
  let rateLimited = false;
  page.on('response', (response) => {
    const url = response.url();
    if (response.status() === 429 && (url.includes('account-checks') || url.includes('signin'))) {
      rateLimited = true;
    }
  });
  return () => rateLimited;
}

/**
 * Extract cookies from a Puppeteer page and load into a tough-cookie jar.
 */
async function extractCookiesIntoJar(page: Page, urls: string[]): Promise<{ jar: CookieJar; cookies: Awaited<ReturnType<Page['cookies']>> }> {
  const browserCookies = await page.cookies(...urls);
  const jar = new CookieJar();

  for (const bc of browserCookies) {
    const tough = new Cookie({
      key: bc.name,
      value: bc.value,
      domain: bc.domain,
      path: bc.path,
      secure: bc.secure,
      httpOnly: bc.httpOnly,
      expires: bc.expires > 0 ? new Date(bc.expires * 1000) : 'Infinity',
      sameSite: bc.sameSite === 'None' ? 'none' : bc.sameSite?.toLowerCase() as 'lax' | 'strict' | undefined,
    });
    const cookieUrl = `https://${bc.domain.replace(/^\./, '')}${bc.path}`;
    try {
      await jar.setCookie(tough, cookieUrl);
    } catch {
      // Ignore individual cookie errors
    }
  }

  return { jar, cookies: browserCookies };
}

/**
 * Clear the persistent browser profile to recover from stale cookie issues.
 */
async function clearBrowserProfile(): Promise<void> {
  try {
    await rm(BROWSER_PROFILE_DIR, { recursive: true, force: true });
    logger.info('Cleared browser profile');
  } catch {
    // Directory may not exist
  }
}

/**
 * Apply stealth measures to a Puppeteer page to avoid WAF bot detection.
 *
 * The SSO WAF (qd4v5cb38r-* headers) fingerprints the browser using JavaScript.
 * Standard Puppeteer is detectable via navigator.webdriver, automation flags, etc.
 * These measures make the browser look like a normal Chrome instance.
 */
async function applyStealthMeasures(page: Page): Promise<void> {
  await page.evaluateOnNewDocument(() => {
    // Remove navigator.webdriver flag (primary bot detection signal)
    Object.defineProperty(navigator, 'webdriver', { get: () => false });

    // Override navigator.plugins to look like a real browser
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
        { name: 'Native Client', filename: 'internal-nacl-plugin' },
      ],
    });

    // Override navigator.languages
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

    // Remove chrome.runtime detection (present in extensions, absent in automation)
    // @ts-expect-error - modifying window.chrome for stealth
    window.chrome = { runtime: {} };

    // Override permissions query to match real Chrome behavior
    const originalQuery = window.navigator.permissions.query.bind(window.navigator.permissions);
    window.navigator.permissions.query = (parameters: PermissionDescriptor) => {
      if (parameters.name === 'notifications') {
        return Promise.resolve({ state: Notification.permission } as PermissionStatus);
      }
      return originalQuery(parameters);
    };
  });
}

/**
 * Run the browser authentication flow.
 *
 * Navigates to the health portal (myhealth.alberta.ca) which triggers the
 * same auth chain as a manual login:
 * 1. Portal → xiduam.ca (WS-Federation) → account.alberta.ca (SSO)
 * 2. User authenticates (or auto-login via persistent cookies)
 * 3. SSO → portal trust → MyChart (token) → portal trust → MHR (APPAUTHSUCCESS)
 * 4. Browser lands at MHR with both sessions established
 */
async function runBrowserAuth(usePersistentProfile: boolean): Promise<AuthenticateResult> {
  logger.info(`Launching browser${usePersistentProfile ? ' (persistent profile)' : ' (fresh profile)'}...`);

  const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
    headless: false,
    channel: 'chrome',
    defaultViewport: { width: 1280, height: 800 },
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
    ],
  };

  if (usePersistentProfile) {
    launchOptions.userDataDir = BROWSER_PROFILE_DIR;
  }

  const browser = await puppeteer.launch(launchOptions);

  try {
    const page = await browser.newPage();

    // Apply stealth measures before any navigation
    await applyStealthMeasures(page);

    const isRateLimited = monitorRateLimit(page);

    // Track which sessions have been established during navigations
    let myChartSeen = false;
    let mhrSeen = false;

    page.on('response', (response) => {
      const url = response.url();
      const status = response.status();
      if (status >= 200 && status < 400) {
        if (url.includes('myahsconnect.albertahealthservices.ca/MyChartPRD/')) {
          myChartSeen = true;
        }
        if (url.includes('myhealthrecords.alberta.ca')) {
          mhrSeen = true;
        }
      }
    });

    // Step 1: Navigate to SSO login page
    logger.info('Navigating to Alberta SSO login...');
    await page.goto(SSO_LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30_000 });

    // Check for immediate rate limiting
    await sleep(2000);
    if (isRateLimited()) {
      throw new Error(
        'Alberta SSO is rate-limiting your requests. Please wait 5-10 minutes and try again.',
      );
    }

    // Step 2: Wait for login to complete.
    // If persistent profile has valid SSO cookies, the SPA may auto-redirect
    // or show a logged-in state. Otherwise, user enters credentials.
    const afterGotoUrl = page.url();
    const needsLogin = afterGotoUrl.includes('account.alberta.ca');

    if (needsLogin) {
      logger.info('Browser at SSO login — waiting for user to sign in');
      try {
        // Wait for the user to complete authentication.
        // The SPA may redirect away from the sign-in page, or the URL
        // may change to a logged-in view within account.alberta.ca.
        // We detect login by watching for the is-login-token-valid 200 response.
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Login timed out. Please complete the sign-in within the browser window.'));
          }, LOGIN_TIMEOUT_MS);

          page.on('response', (response) => {
            const url = response.url();
            if (url.includes('is-login-token-valid') && response.status() === 200) {
              clearTimeout(timeout);
              resolve();
            }
          });
        });
      } catch (error) {
        if (isRateLimited()) {
          throw new Error(
            'Alberta SSO is rate-limiting your requests. Please wait 5-10 minutes and try again.',
          );
        }
        throw error;
      }
    }

    // Check for rate limiting after auth
    if (isRateLimited()) {
      throw new Error(
        'Alberta SSO is rate-limiting your requests. Please wait 5-10 minutes and try again.',
      );
    }

    logger.info('SSO login successful — establishing sessions...');
    await sleep(2000);

    // Step 3: Navigate to MyChart to establish its session.
    // The SAML URL auto-authenticates using the shared SSO cookies
    // (no additional rate-limited calls — the SSO session is already active).
    logger.info('Establishing MyChart session...');
    try {
      await page.goto(MYCHART_SAML_URL, { waitUntil: 'networkidle2', timeout: 30_000 });
      await page.waitForFunction(
        () => window.location.href.includes('/MyChartPRD/Home') ||
              window.location.href.includes('/MyChartPRD/default.asp'),
        { timeout: 20_000 },
      );
      myChartSeen = true;
      logger.info('MyChart session established');
    } catch {
      logger.warn('MyChart session establishment failed — MyChart tools may not work');
    }

    await sleep(1000);

    // Step 4: Extract MyChart cookies
    const { jar: myChartJar } = await extractCookiesIntoJar(page, [
      `${MYCHART_BASE}/MyChartPRD/`,
    ]);

    // Step 5: Navigate to MHR to establish its session.
    // SSO cookies auto-authenticate here too.
    logger.info('Establishing MHR session...');
    try {
      await page.goto(MHR_BASE, { waitUntil: 'networkidle2', timeout: 30_000 });
      await page.waitForFunction(
        () => window.location.href.includes('/ng/'),
        { timeout: 20_000 },
      );
      mhrSeen = true;
      logger.info('MHR session established');
    } catch {
      logger.warn('MHR session establishment failed — MHR tools may not work');
    }

    // Extract MHR cookies
    const { jar: mhrJar, cookies: mhrCookies } = await extractCookiesIntoJar(page, [
      'https://myhealthrecords.alberta.ca',
      'https://console.myhealthrecords.alberta.ca',
      'https://account.alberta.ca',
    ]);

    logger.info(`Sessions — MyChart: ${myChartSeen}, MHR: ${mhrSeen}. Extracting cookies...`);

    // Fetch CSRF token for MyChart API calls via HTTP fetch (not page.goto).
    // This avoids an unnecessary full page navigation.
    let myChartCsrfToken = '';
    try {
      const csrfCookies = await myChartJar.getCookieString(MYCHART_CSRF_URL);
      const csrfResponse = await fetch(MYCHART_CSRF_URL, {
        headers: {
          'Cookie': csrfCookies,
          'Accept': 'text/html',
          'Referer': `${MYCHART_BASE}/MyChartPRD/Home`,
        },
      });
      if (csrfResponse.ok) {
        const csrfHtml = (await csrfResponse.text()).trim();
        const match = csrfHtml.match(/value="([^"]+)"/);
        if (match) {
          myChartCsrfToken = match[1];
        } else if (!csrfHtml.includes('<')) {
          myChartCsrfToken = csrfHtml;
        }
      }
    } catch {
      logger.warn('Failed to fetch MyChart CSRF token via HTTP — trying browser fallback');
      // Fallback: use page.goto if the HTTP fetch fails (e.g., cookies insufficient)
      try {
        const csrfResponse = await page.goto(MYCHART_CSRF_URL, { waitUntil: 'networkidle2' });
        if (csrfResponse) {
          const csrfHtml = (await csrfResponse.text()).trim();
          const match = csrfHtml.match(/value="([^"]+)"/);
          if (match) {
            myChartCsrfToken = match[1];
          }
        }
      } catch {
        logger.warn('CSRF token fallback also failed — MyChart tools may not work');
      }
    }

    if (myChartCsrfToken) {
      logger.info(`MyChart CSRF token captured (${myChartCsrfToken.length} chars)`);
    }

    logger.info('Session cookies captured');

    return {
      mhrCookieJar: mhrJar,
      myChartCookieJar: myChartJar,
      myChartCsrfToken: myChartCsrfToken || undefined,
    };
  } finally {
    await browser.close();
    logger.info('Browser closed');
  }
}

/**
 * Authenticate with Alberta SSO for MHR and MyChart.
 *
 * Uses a persistent browser profile so SSO cookies survive across attempts.
 * If the persistent profile causes issues (429/stale cookies), clears it
 * and retries with a fresh profile.
 */
export async function authenticate(): Promise<AuthenticateResult> {
  // First attempt: use persistent browser profile
  try {
    return await runBrowserAuth(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    // If rate limited with persistent profile, stale cookies may be the cause.
    // Clear the profile and let the user retry later.
    if (message.includes('rate-limiting')) {
      logger.info('Rate limited — clearing browser profile to prevent stale cookie loops');
      await clearBrowserProfile();
      throw error;
    }

    // For other errors, try once more with a fresh profile
    logger.warn(`Auth failed with persistent profile: ${message}`);
    logger.info('Retrying with fresh browser profile...');
    await clearBrowserProfile();

    return await runBrowserAuth(false);
  }
}
