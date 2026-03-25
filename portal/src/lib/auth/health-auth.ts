/**
 * Browser-based auth for Alberta SSO.
 *
 * Launches a VISIBLE Chrome window where the user logs in manually on
 * Alberta's actual login page. This matches the CLI approach exactly
 * (src/api/auth-client.ts) and avoids all bot detection / fingerprinting
 * issues since it's a real browser with real user interaction.
 *
 * Flow: Open Chrome → user logs in → detect is-login-token-valid 200
 *       → establish MyChart session → establish MHR session → extract cookies
 */

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Page, HTTPResponse } from "puppeteer-core";
import { CookieJar, Cookie } from "tough-cookie";
import { join } from "path";
import { homedir } from "os";

puppeteer.use(StealthPlugin());

const MHR_BASE = "https://myhealthrecords.alberta.ca";
const MYCHART_BASE = "https://myahsconnect.albertahealthservices.ca";
const MYCHART_CSRF_URL = `${MYCHART_BASE}/MyChartPRD/Home/CSRFToken`;
const MYCHART_SAML_URL = `${MYCHART_BASE}/MyChartPRD/Authentication/Saml/Login?idp=MADI&forceAuthn=False`;
const SSO_LOGIN_URL = "https://account.alberta.ca/ui/sign-in/signin";

// 3 minutes for manual login (matches CLI)
const LOGIN_TIMEOUT_MS = 180_000;

// Persistent browser profile — SSO cookies survive across logins
const BROWSER_PROFILE_DIR = join(homedir(), ".mhr-records", "browser-profile");

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

function findChrome(): string | undefined {
  const paths = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean) as string[];

  const fs = require("fs");
  for (const p of paths) {
    try {
      fs.accessSync(p);
      return p;
    } catch { /* try next */ }
  }
  return undefined;
}

/**
 * Authenticate by launching a visible Chrome window.
 *
 * The user logs in manually on Alberta's actual SSO page.
 * No credentials are passed programmatically — zero bot detection risk.
 */
export async function authenticateWithBrowser(): Promise<HealthAuthResult> {
  const executablePath = findChrome();

  // Ensure browser profile directory exists
  const fs = require("fs");
  const path = require("path");
  fs.mkdirSync(BROWSER_PROFILE_DIR, { recursive: true });

  // Clean stale Chrome lock files (left behind if browser was force-closed)
  for (const lockFile of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
    try {
      fs.unlinkSync(path.join(BROWSER_PROFILE_DIR, lockFile));
    } catch {
      /* doesn't exist — fine */
    }
  }

  const browser = await puppeteer.launch({
    headless: false, // Real visible browser — user logs in manually
    executablePath,
    defaultViewport: { width: 1280, height: 800 },
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
    userDataDir: BROWSER_PROFILE_DIR, // Persistent profile for SSO cookie reuse
  });

  try {
    const page = await browser.newPage();

    let rateLimited = false;
    page.on("response", (response: HTTPResponse) => {
      const url = response.url();
      if (
        response.status() === 429 &&
        (url.includes("account-checks") || url.includes("signin"))
      ) {
        rateLimited = true;
      }
    });

    // Step 1: Navigate to SSO login page
    await page.goto(SSO_LOGIN_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    await sleep(2000);

    if (rateLimited) {
      throw new Error(
        "Alberta SSO is rate-limiting requests. Please wait 5–10 minutes and try again."
      );
    }

    // Step 2: Check if already authenticated (persistent profile may have valid SSO cookies)
    const currentUrl = page.url();
    const alreadyLoggedIn = !currentUrl.includes("account.alberta.ca");

    if (!alreadyLoggedIn) {
      // Wait for user to manually complete login
      // The is-login-token-valid endpoint returns 200 when SSO login succeeds
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error(
              "Login timed out. Please complete sign-in within 3 minutes."
            )
          );
        }, LOGIN_TIMEOUT_MS);

        page.on("response", (response: HTTPResponse) => {
          const url = response.url();
          if (
            url.includes("is-login-token-valid") &&
            response.status() === 200
          ) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
    }

    if (rateLimited) {
      throw new Error(
        "Alberta SSO is rate-limiting requests. Please wait 5–10 minutes and try again."
      );
    }

    await sleep(2000);

    // Step 3: Establish MyChart session via SAML
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

    // Step 4: Establish MHR session
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
  } finally {
    await browser.close();
  }
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
