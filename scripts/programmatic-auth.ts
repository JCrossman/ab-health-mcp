/**
 * Direct HTTP authentication for server-side use.
 *
 * Replicates the exact API calls that Alberta's SSO SPA makes:
 *   1. POST /account-checks → validate username
 *   2. POST /signin → authenticate with password
 *   3. GET /SignInRedirect → follow SSO redirect chain → MHR session
 *   4. GET MyChart SAML → follow redirect chain → MyChart session
 *
 * No Puppeteer, no browser, no CSS selectors, no bot detection issues.
 * Uses Node.js fetch + tough-cookie for cookie management.
 */

import { CookieJar } from 'tough-cookie';
import { logger } from '../utils/logger.js';
import type { AuthenticateResult } from './auth-client.js';

const SSO_BASE = 'https://account.alberta.ca';
const SSO_API = `${SSO_BASE}/app/account/services/api`;
const MYCHART_BASE = 'https://myahsconnect.albertahealthservices.ca';
const MYCHART_CSRF_URL = `${MYCHART_BASE}/MyChartPRD/Home/CSRFToken`;
const MYCHART_SAML_URL = `${MYCHART_BASE}/MyChartPRD/Authentication/Saml/Login?idp=MADI&forceAuthn=False`;

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

/**
 * Make an HTTP request with automatic cookie management via tough-cookie.
 * Follows redirects manually to capture Set-Cookie headers at each hop.
 */
async function cookieFetch(
  jar: CookieJar,
  url: string,
  options: RequestInit & { maxRedirects?: number } = {},
): Promise<Response> {
  const { maxRedirects = 20, ...fetchOptions } = options;
  let currentUrl = url;
  let redirectCount = 0;

  while (true) {
    const cookieString = await jar.getCookieString(currentUrl);
    const headers = new Headers(fetchOptions.headers);
    if (cookieString) headers.set('Cookie', cookieString);
    if (!headers.has('User-Agent')) headers.set('User-Agent', UA);

    const response = await fetch(currentUrl, {
      ...fetchOptions,
      headers,
      redirect: 'manual',
    });

    // Store response cookies in the jar
    const setCookies = response.headers.getSetCookie?.() ?? [];
    for (const sc of setCookies) {
      try {
        await jar.setCookie(sc, currentUrl);
      } catch {
        /* ignore individual cookie errors */
      }
    }

    // Follow redirects manually (to capture cookies at each domain)
    const location = response.headers.get('location');
    if (location && [301, 302, 303, 307, 308].includes(response.status)) {
      if (++redirectCount > maxRedirects) {
        throw new Error(`Too many redirects (max ${maxRedirects})`);
      }
      currentUrl = new URL(location, currentUrl).toString();
      // Switch to GET after 302/303 redirects (standard behavior)
      if ([302, 303].includes(response.status)) {
        fetchOptions.method = 'GET';
        delete fetchOptions.body;
      }
      continue;
    }

    return response;
  }
}

/**
 * Authenticate with Alberta SSO using provided credentials.
 *
 * Makes direct HTTP API calls (same as the SSO SPA), then follows the
 * redirect chain to establish MHR and MyChart sessions.
 *
 * @throws Error if login fails, credentials are wrong, or rate limited.
 */
export async function authenticateWithCredentials(
  username: string,
  password: string,
): Promise<AuthenticateResult> {
  logger.info('Starting direct HTTP authentication...');

  const jar = new CookieJar();

  // ── Step 1: Load the SSO page to get initial cookies ──────────────────────
  logger.info('Loading SSO page for initial cookies...');
  await cookieFetch(jar, `${SSO_BASE}/ui/sign-in/signin-with-password`);

  // ── Step 2: POST /account-checks — validate username ──────────────────────
  logger.info('Validating account...');
  const checkBody = `UserName=${encodeURIComponent(username)}`;
  const checkResponse = await cookieFetch(jar, `${SSO_API}/account-checks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': '*/*',
      'Request-Verification-Token': '',
      'Origin': SSO_BASE,
      'Referer': `${SSO_BASE}/ui/sign-in/signin-with-password`,
    },
    body: checkBody,
  });

  if (checkResponse.status === 429) {
    throw new Error(
      'Alberta SSO is rate-limiting requests. Please wait 5-10 minutes and try again.',
    );
  }

  let checkData: Record<string, unknown>;
  try {
    checkData = (await checkResponse.json()) as Record<string, unknown>;
  } catch {
    throw new Error(`Account validation failed (HTTP ${checkResponse.status})`);
  }

  const checkDataInner = checkData?.data as Record<string, unknown> | undefined;
  if (checkDataInner?.IsSuspended) {
    throw new Error('This account has been suspended by Alberta.');
  }

  // ── Step 3: POST /signin — authenticate with credentials ──────────────────
  logger.info('Signing in...');
  const signinBody = `Username=${encodeURIComponent(username)}&Password=${encodeURIComponent(password)}`;
  const signinResponse = await cookieFetch(jar, `${SSO_API}/signin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': '*/*',
      'Request-Verification-Token': '',
      'Origin': SSO_BASE,
      'Referer': `${SSO_BASE}/ui/sign-in/signin-with-password`,
    },
    body: signinBody,
  });

  if (signinResponse.status === 429) {
    throw new Error(
      'Alberta SSO is rate-limiting requests. Please wait 5-10 minutes and try again.',
    );
  }

  if (signinResponse.status === 401) {
    throw new Error('Invalid username or password. Please check your credentials.');
  }

  let signinData: Record<string, unknown>;
  try {
    signinData = (await signinResponse.json()) as Record<string, unknown>;
  } catch {
    throw new Error(`Sign-in failed (HTTP ${signinResponse.status})`);
  }

  const signinDataInner = signinData?.data as Record<string, unknown> | undefined;
  if (signinData?.status !== 'success' || signinDataInner?.ResultCode !== 0) {
    const msg =
      (signinData?.message as string) ||
      (signinDataInner?.Message as string) ||
      'Sign-in failed. Please check your credentials.';
    throw new Error(msg);
  }

  logger.info('SSO credentials accepted — following redirect chain...');

  // ── Step 4: Follow SignInRedirect chain → MHR session cookies ─────────────
  logger.info('Establishing MHR session...');
  try {
    await cookieFetch(jar, `${SSO_BASE}/app/account/signin/SignInRedirect`, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Referer: `${SSO_BASE}/ui/sign-in/signin-with-password`,
      },
    });
    logger.info('MHR session established via redirect chain');
  } catch (error) {
    logger.warn(
      `MHR redirect chain error: ${error instanceof Error ? error.message : error}`,
    );
  }

  // Build the MHR cookie jar
  const mhrJar = new CookieJar();
  for (const domain of [
    'myhealthrecords.alberta.ca',
    'console.myhealthrecords.alberta.ca',
    'account.alberta.ca',
  ]) {
    const cookies = await jar.getCookies(`https://${domain}/`);
    for (const c of cookies) {
      try {
        await mhrJar.setCookie(c, `https://${domain}/`);
      } catch {
        /* ignore */
      }
    }
  }

  // ── Step 5: Establish MyChart session via SAML ────────────────────────────
  logger.info('Establishing MyChart session...');
  let myChartJar: CookieJar | undefined;
  try {
    await cookieFetch(jar, MYCHART_SAML_URL, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    // Build the MyChart cookie jar
    myChartJar = new CookieJar();
    const myChartCookies = await jar.getCookies(`${MYCHART_BASE}/MyChartPRD/`);
    for (const c of myChartCookies) {
      try {
        await myChartJar.setCookie(c, `${MYCHART_BASE}/MyChartPRD/`);
      } catch {
        /* ignore */
      }
    }
    logger.info('MyChart session established');
  } catch (error) {
    logger.warn(
      `MyChart session failed: ${error instanceof Error ? error.message : error}`,
    );
  }

  // ── Step 6: Fetch MyChart CSRF token ──────────────────────────────────────
  let myChartCsrfToken = '';
  if (myChartJar) {
    try {
      const csrfCookies = await jar.getCookieString(MYCHART_CSRF_URL);
      const csrfResponse = await fetch(MYCHART_CSRF_URL, {
        headers: {
          Cookie: csrfCookies,
          Accept: 'text/html',
          'User-Agent': UA,
          Referer: `${MYCHART_BASE}/MyChartPRD/Home`,
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
      logger.warn('Failed to fetch MyChart CSRF token');
    }
  }

  logger.info('Direct HTTP authentication complete');

  return {
    mhrCookieJar: mhrJar,
    myChartCookieJar: myChartJar,
    myChartCsrfToken: myChartCsrfToken || undefined,
  };
}
