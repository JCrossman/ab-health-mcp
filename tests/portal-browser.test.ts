import { existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import puppeteer, { type Browser } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in against a built, disabled server. Never use a real user's browser profile.
const baseUrl = process.env.PORTAL_BROWSER_TEST_URL;
const chrome = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find(existsSync);

describe.skipIf(!baseUrl || !chrome)("disabled portal browser privacy", () => {
  let browser: Browser;
  let profile: string;
  beforeAll(async () => {
    const target = new URL(baseUrl!);
    if (target.protocol !== "http:" || target.hostname !== "127.0.0.1") throw new Error("Only loopback testing is allowed");
    profile = resolve(`portal/.privacy-browser-${randomUUID()}`);
    mkdirSync(profile, { recursive: true });
    browser = await puppeteer.launch({
      executablePath: chrome,
      headless: true,
      userDataDir: profile,
      args: ["--disable-background-networking", "--disable-component-update", "--disable-sync"],
    });
  });
  afterAll(async () => {
    await browser?.close();
    if (profile) rmSync(profile, { recursive: true, force: true });
  });

  it.each([320, 1280])("keeps chat unavailable at width %s without auth/model calls or automatic deletion", async (width) => {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width, height: 900 });
    const externalRequests: string[] = [];
    const apiRequests: string[] = [];
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.protocol.startsWith("http") && url.origin !== new URL(baseUrl!).origin) {
        externalRequests.push(url.origin);
        void request.abort();
      } else {
        if (url.pathname.startsWith("/api/")) apiRequests.push(url.pathname);
        void request.continue();
      }
    });
    await page.evaluateOnNewDocument(() => {
      if (localStorage.getItem("synthetic-seed") !== "yes") {
        localStorage.setItem("synthetic-seed", "yes");
        localStorage.setItem("ab-health-conversations", "invented legacy account A");
        localStorage.setItem("ab-health-msgs-a", "invented message");
        localStorage.setItem("unrelated-setting", "keep");
        localStorage.setItem("claude-history", "keep");
      }
    });
    await page.goto(`${baseUrl}/chat`, { waitUntil: "networkidle0" });
    expect(await page.$eval("h1", (node) => node.textContent)).toBe("Web chat is unavailable");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem("ab-health-conversations"))).toBe("invented legacy account A");
    expect(await page.$('input[type="password"], textarea')).toBeNull();
    expect(externalRequests).toEqual([]);
    expect(apiRequests).toEqual([]);
    await page.focus("button");
    expect(await page.$eval("button", (node) => document.activeElement === node)).toBe(true);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes("was removed"));
    expect(await page.evaluate(() => ({
      legacy: localStorage.getItem("ab-health-conversations"),
      messages: localStorage.getItem("ab-health-msgs-a"),
      unrelated: localStorage.getItem("unrelated-setting"),
      claude: localStorage.getItem("claude-history"),
    }))).toEqual({ legacy: null, messages: null, unrelated: "keep", claude: "keep" });
    await page.reload({ waitUntil: "networkidle0" });
    expect(await page.evaluate(() => localStorage.getItem("ab-health-conversations"))).toBeNull();
    await context.close();
  });
});
