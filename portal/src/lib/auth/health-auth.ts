/**
 * Helpers for finishing an isolated, caller-owned portal authentication attempt.
 * The former shared-profile launcher is retired and always rejects.
 */

import * as fs from "node:fs";
import type { Page } from "puppeteer-core";
import { CookieJar, Cookie } from "tough-cookie";

const MHR_BASE = "https://myhealthrecords.alberta.ca";
const MYCHART_BASE = "https://myahsconnect.albertahealthservices.ca";
const MYCHART_CSRF_URL = `${MYCHART_BASE}/MyChartPRD/Home/CSRFToken`;
const MYCHART_SAML_URL = `${MYCHART_BASE}/MyChartPRD/Authentication/Saml/Login?idp=MADI&forceAuthn=False`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface HealthAuthResult {
  mhrCookieJar: CookieJar;
  myChartCookieJar?: CookieJar;
  myChartCsrfToken?: string;
  mhrConnected: boolean;
  myChartConnected: boolean;
}

/** Serializable session data for storage. */
export interface HealthSessionData {
  mhrCookies: string;
  myChartCookies?: string;
  myChartCsrfToken?: string;
  mhrConnected: boolean;
  myChartConnected: boolean;
  authenticatedAt: string;
}

async function extractCookiesIntoJar(
  page: Page,
  urls: string[]
): Promise<CookieJar> {
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
      expires: bc.expires > 0 ? new Date(bc.expires * 1000) : "Infinity",
      sameSite:
        bc.sameSite === "None"
          ? "none"
          : (bc.sameSite?.toLowerCase() as "lax" | "strict" | undefined),
    });
    const cookieUrl = `https://${bc.domain.replace(/^\./, "")}${bc.path}`;
    try {
      await jar.setCookie(tough, cookieUrl);
    } catch {
      // Ignore individual cookie errors
    }
  }

  return jar;
}

export function findChrome(): string | undefined {
  const paths = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean) as string[];

  for (const p of paths) {
    try {
      fs.accessSync(p);
      return p;
    } catch { /* try next */ }
  }
  return undefined;
}

/**
 * Complete the auth flow after SSO login is detected.
 *
 * Navigates to MyChart (SAML auto-auth) and MHR to establish both sessions,
 * then extracts cookies. Shared by both the visible-browser and streamed-browser
 * auth paths.
 */
export async function completeAuthFlow(page: Page): Promise<HealthAuthResult> {
  await sleep(2000);

  // Step 1: Establish MyChart session via SAML
  let myChartConnected = false;
  let myChartCsrfToken: string | undefined;
  let myChartJar: CookieJar | undefined;

  try {
    await page.goto(MYCHART_SAML_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForFunction(
      () =>
        window.location.href.includes("/MyChartPRD/Home") ||
        window.location.href.includes("/MyChartPRD/default.asp"),
      { timeout: 20_000 }
    );
    myChartConnected = true;
  } catch {
    // MyChart may not be available — continue with MHR only
  }

  if (myChartConnected) {
    myChartJar = await extractCookiesIntoJar(page, [
      `${MYCHART_BASE}/MyChartPRD/`,
    ]);

    // Fetch CSRF token
    try {
      const csrfCookies =
        await myChartJar.getCookieString(MYCHART_CSRF_URL);
      const csrfResponse = await fetch(MYCHART_CSRF_URL, {
        headers: {
          Cookie: csrfCookies,
          Accept: "text/html",
          Referer: `${MYCHART_BASE}/MyChartPRD/Home`,
        },
      });
      if (csrfResponse.ok) {
        const csrfHtml = (await csrfResponse.text()).trim();
        const match = csrfHtml.match(/value="([^"]+)"/);
        if (match) {
          myChartCsrfToken = match[1];
        } else if (!csrfHtml.includes("<")) {
          myChartCsrfToken = csrfHtml;
        }
      }
    } catch {
      // CSRF fetch failed — MyChart tools may not work
    }
  }

  await sleep(1000);

  // Step 2: Establish MHR session
  let mhrConnected = false;
  try {
    await page.goto(MHR_BASE, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForFunction(
      () => window.location.href.includes("/ng/"),
      { timeout: 20_000 }
    );
    mhrConnected = true;
  } catch {
    // MHR may not be available
  }

  const mhrJar = await extractCookiesIntoJar(page, [
    "https://myhealthrecords.alberta.ca",
    "https://console.myhealthrecords.alberta.ca",
    "https://account.alberta.ca",
  ]);

  return {
    mhrCookieJar: mhrJar,
    myChartCookieJar: myChartJar,
    myChartCsrfToken,
    mhrConnected,
    myChartConnected,
  };
}

/**
 * Keep old callers fail-closed rather than reviving shared browser identity.
 */
export async function authenticateWithBrowser(): Promise<HealthAuthResult> {
  throw new Error("Shared-profile portal sign-in is retired. Use the desktop extension.");
}

// Keep old function name as alias for backward compatibility
export const authenticateHeadless = authenticateWithBrowser;

/** Serialize auth result to storable format (no CookieJar instances). */
export function serializeSession(
  result: HealthAuthResult
): HealthSessionData {
  return {
    mhrCookies: JSON.stringify(result.mhrCookieJar.serializeSync()),
    myChartCookies: result.myChartCookieJar
      ? JSON.stringify(result.myChartCookieJar.serializeSync())
      : undefined,
    myChartCsrfToken: result.myChartCsrfToken,
    mhrConnected: result.mhrConnected,
    myChartConnected: result.myChartConnected,
    authenticatedAt: new Date().toISOString(),
  };
}
