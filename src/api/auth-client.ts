/**
 * Browser-based authentication client for Alberta My Health Records and MyChart.
 *
 * Uses Puppeteer with a persistent browser profile so SSO cookies survive
 * across auth attempts. Includes stealth measures to avoid WAF bot detection.
 *
 * Signs in at Alberta SSO, then establishes MyChart and MHR sessions separately.
 *
 * Credentials never touch this code — they're entered in the browser.
 */

import puppeteer, { type Page, type HTTPResponse } from 'puppeteer-core';
import { CookieJar, Cookie } from 'tough-cookie';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { logger } from '../utils/logger.js';
import { AuthRequiredError, SessionExpiredError } from '../utils/errors.js';
import { isMyChartHome, MYCHART_BASE, MYCHART_HOME, selectMyChartToken } from './mychart-session.js';

const MHR_BASE = 'https://myhealthrecords.alberta.ca';
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
    if (response.status() === 429 && url.startsWith('https://account.alberta.ca/') && (url.includes('account-checks') || url.includes('signin'))) {
      rateLimited = true;
    }
  });
  return () => rateLimited;
}

export function observeSsoLogin(page: Pick<Page, 'on' | 'off'>): { wait: () => Promise<void>; dispose: () => void } {
  let signedIn = false;
  let closed = false;
  let resolveLogin: (() => void) | undefined;
  let rejectLogin: ((error: Error) => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancelled = () => new AuthRequiredError('The sign-in window was closed. Use connect_account again when you are ready.');
  const onResponse = (response: HTTPResponse) => {
    const url = new URL(response.url());
    if (url.origin === 'https://account.alberta.ca' && url.pathname.endsWith('/is-login-token-valid') && response.status() === 200) {
      signedIn = true;
      resolveLogin?.();
    }
  };
  const onClose = () => {
    closed = true;
    rejectLogin?.(cancelled());
  };
  const dispose = () => {
    clearTimeout(timer);
    page.off('response', onResponse);
    page.off('close', onClose);
  };
  page.on('response', onResponse);
  page.on('close', onClose);
  return {
    dispose,
    wait: async () => {
      try {
        if (closed) throw cancelled();
        if (signedIn) return;
        await new Promise<void>((resolve, reject) => {
          resolveLogin = resolve;
          rejectLogin = reject;
          timer = setTimeout(() => reject(new AuthRequiredError(
            'Sign-in timed out. Use connect_account again when you are ready to sign in.',
          )), LOGIN_TIMEOUT_MS);
        });
      } finally {
        dispose();
      }
    },
  };
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
      logger.warn('A browser cookie could not be used for the health portal session.');
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
    logger.warn('Could not clear the health portal browser profile. Close the sign-in window before reconnecting.');
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
 * Observe SSO before navigating so persistent profiles cannot race the observer.
 * Capture the MyChart token and cookies together before navigating to MHR.
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
    await page.setCacheEnabled(false);

    // Apply stealth measures before any navigation
    await applyStealthMeasures(page);

    const isRateLimited = monitorRateLimit(page);

    let mhrSeen = false;
    const sso = observeSsoLogin(page);
    logger.info('Navigating to Alberta SSO login...');
    try {
      await page.goto(SSO_LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30_000 });
      if (isRateLimited()) {
        throw new Error('Alberta SSO is rate-limiting your requests. Please wait before trying again.');
      }
      logger.info('Waiting for Alberta SSO sign-in');
      await sso.wait();
    } catch (error) {
      if (isRateLimited()) {
        throw new Error('Alberta SSO is rate-limiting your requests. Please wait before trying again.');
      }
      throw error;
    } finally {
      sso.dispose();
    }

    // Check for rate limiting after auth
    if (isRateLimited()) {
      throw new Error(
        'Alberta SSO is rate-limiting your requests. Please wait 5-10 minutes and try again.',
      );
    }

    logger.info('SSO login successful — establishing sessions...');
    await sleep(2000);

    let myChartJar: CookieJar | undefined;
    let myChartCsrfToken: string | undefined;
    logger.info('Establishing MyChart session...');
    try {
      await page.goto(MYCHART_SAML_URL, { waitUntil: 'networkidle2', timeout: 30_000 });
      await page.goto(MYCHART_HOME, { waitUntil: 'networkidle2', timeout: 30_000 });
      if (!isMyChartHome(page.url())) throw new SessionExpiredError();
      await page.waitForSelector('input[type="hidden"][name="__RequestVerificationToken"]', { timeout: 20_000 });
      const tokens = await page.$$eval('input[name="__RequestVerificationToken"]', inputs =>
        inputs.filter((input): input is HTMLInputElement => input instanceof HTMLInputElement && input.type === 'hidden')
          .map(input => input.value));
      myChartCsrfToken = selectMyChartToken(tokens);
      ({ jar: myChartJar } = await extractCookiesIntoJar(page, [`${MYCHART_BASE}/MyChartPRD/`]));
      logger.info('MyChart session established');
    } catch {
      myChartCsrfToken = undefined;
      myChartJar = undefined;
      logger.warn('MyChart did not connect. My Health Records sign-in will continue.');
    }

    await sleep(1000);

    // Step 5: Navigate to MHR to establish its session.
    // SSO cookies auto-authenticate here too.
    logger.info('Establishing MHR session...');
    try {
      await page.goto(MHR_BASE, { waitUntil: 'networkidle2', timeout: 30_000 });
      const mhrUrl = new URL(page.url());

      if (mhrUrl.origin === MHR_BASE && mhrUrl.pathname.startsWith('/ng/')) {
        mhrSeen = true;
        logger.info('MHR session established (already at /ng/)');
      } else {
        // May need to wait for SPA redirect
        await page.waitForFunction(
          () => window.location.origin === 'https://myhealthrecords.alberta.ca' && window.location.pathname.startsWith('/ng/'),
          { timeout: 20_000 },
        );
        mhrSeen = true;
        logger.info('MHR session established (after SPA redirect)');
      }
    } catch {
      logger.warn('MHR session navigation failed; retrying once.');

      // Retry once — MHR sometimes needs a second navigation after SSO
      try {
        logger.info('Retrying MHR navigation...');
        await sleep(2000);
        await page.goto(MHR_BASE, { waitUntil: 'networkidle2', timeout: 30_000 });
        await page.waitForFunction(
          () => window.location.origin === 'https://myhealthrecords.alberta.ca' && window.location.pathname.startsWith('/ng/'),
          { timeout: 20_000 },
        );
        mhrSeen = true;
        logger.info('MHR session established on retry');
      } catch {
        logger.warn('MHR retry also failed — MHR tools will not work this session');
      }
    }

    // Extract MHR cookies
    const { jar: mhrJar } = await extractCookiesIntoJar(page, [
      'https://myhealthrecords.alberta.ca',
      'https://console.myhealthrecords.alberta.ca',
      'https://account.alberta.ca',
    ]);

    logger.info(`Session navigation complete: MHR=${mhrSeen}, MyChart=${Boolean(myChartCsrfToken)}`);

    logger.info('Session cookies captured');

    return {
      mhrCookieJar: mhrJar,
      myChartCookieJar: myChartJar,
      myChartCsrfToken,
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

    if (error instanceof AuthRequiredError) throw error;
    if (error instanceof Error && (error.name === 'TargetCloseError' || message.includes('Target closed'))) {
      throw new AuthRequiredError('The sign-in window was closed. Use connect_account again when you are ready.');
    }

    // For other errors, try once more with a fresh profile
    logger.warn('Sign-in failed with the persistent browser profile.');
    logger.info('Retrying with fresh browser profile...');
    await clearBrowserProfile();

    return await runBrowserAuth(false);
  }
}
