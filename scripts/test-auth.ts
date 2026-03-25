#!/usr/bin/env npx tsx
/**
 * Standalone auth test script for Alberta My Health Records.
 *
 * Uses Puppeteer to open the real MHR login page in a visible browser.
 * The user logs in normally — the browser handles all SAML/SSO complexity.
 * After login, cookies are extracted and used for direct API calls.
 *
 * Usage:
 *   npx tsx scripts/test-auth.ts
 *
 * No credentials needed as env vars — you enter them in the browser.
 * Security: Only session cookies are captured. No PII is logged.
 */

import puppeteer from 'puppeteer-core';
import { CookieJar, Cookie } from 'tough-cookie';

const MHR_BASE = 'https://myhealthrecords.alberta.ca';
const LOGIN_TIMEOUT_MS = 120_000; // 2 minutes to complete login

async function main(): Promise<void> {
  console.log('=== Alberta My Health Records Auth Test ===\n');

  // --- Step 1: Launch browser and navigate to MHR ---
  console.log('Step 1: Launching browser...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto(MHR_BASE, { waitUntil: 'networkidle2' });
  console.log('  Browser opened. Please log in with your MyAlberta account.\n');
  console.log('  ⏳ Waiting for login (up to 2 minutes)...\n');

  // --- Step 2: Wait for login to complete ---
  // After successful login, the URL should contain /ng/ (the Angular dashboard)
  try {
    await page.waitForFunction(
      () => window.location.href.includes('/ng/'),
      { timeout: LOGIN_TIMEOUT_MS },
    );
  } catch {
    console.error('  ❌ Login timed out. Did you complete the login in the browser?');
    await browser.close();
    process.exit(1);
  }

  const finalUrl = page.url();
  console.log(`Step 2: Login detected! URL: ${new URL(finalUrl).pathname}`);

  // --- Step 3: Extract cookies from browser ---
  console.log('\nStep 3: Extracting cookies from browser...');

  // Get cookies for all relevant domains
  const browserCookies = await page.cookies(
    'https://myhealthrecords.alberta.ca',
    'https://console.myhealthrecords.alberta.ca',
    'https://account.alberta.ca',
  );
  console.log(`  Captured ${browserCookies.length} cookies`);

  const domains = new Set(browserCookies.map(c => c.domain));
  console.log(`  Domains: ${[...domains].join(', ')}`);

  // Close browser — we have what we need
  await browser.close();
  console.log('  Browser closed.');

  // --- Step 4: Load cookies into tough-cookie jar ---
  console.log('\nStep 4: Loading cookies into cookie jar...');
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
      // Ignore cookie setting errors
    }
  }

  // Helper: fetch with cookie jar
  async function fetchWithCookies(url: string, extraHeaders: Record<string, string> = {}): Promise<Response> {
    const cookies = await jar.getCookieString(url);
    return fetch(url, {
      headers: {
        'Cookie': cookies,
        'Accept': 'application/json',
        'Accept-Language': 'en-CA',
        'Referer': `${MHR_BASE}/ng/`,
        'Cache-Control': 'no-cache',
        ...extraHeaders,
      },
    });
  }

  // --- Step 5: Test session endpoint ---
  console.log('\nStep 5: Testing MHR session...');
  const sessionResp = await fetchWithCookies(
    `${MHR_BASE}/api/phr/v1/session?SessionMode=Patient&IsKeypressed=true`,
  );
  console.log(`  Session endpoint: ${sessionResp.status}`);
  if (sessionResp.ok) {
    const data = await sessionResp.json();
    console.log(`  Session expired: ${data.isSessionExpired}`);
    console.log(`  Time remaining: ${Math.round(data.numberOfMilliSecondsLeftForSessionExpire / 1000)}s`);
  }

  // --- Step 6: Test user profile endpoint ---
  console.log('\nStep 6: Testing user profile...');
  const userResp = await fetchWithCookies(`${MHR_BASE}/api/phr/v1/user`);
  console.log(`  User endpoint: ${userResp.status}`);
  if (userResp.ok) {
    const data = await userResp.json();
    console.log(`  Fields: ${Object.keys(data).length}`);
    console.log(`  Authorized records: ${data.authorizedRecords?.length ?? 0}`);
  } else {
    console.log(`  ❌ User endpoint failed`);
    const text = await userResp.text();
    console.log(`  Response: ${text.substring(0, 200)}`);
  }

  // --- Step 7: Test lab results endpoint ---
  console.log('\nStep 7: Testing lab results...');
  const params = new URLSearchParams({
    startDate: 'Mon Jan 01 1753',
    endDate: 'Fri Dec 31 9999',
    dateRangeOptions: 'All',
    labConfiguration: '00000000-0000-0000-0000-000000000000',
    showOtherSection: 'True',
    ignoreConfig: 'True',
  });
  const labResp = await fetchWithCookies(
    `${MHR_BASE}/api/phr/v1/labresult/getData?${params}`,
    { 'Control-Mapping-Id': '7736' },
  );
  console.log(`  Lab results endpoint: ${labResp.status}`);
  if (labResp.ok) {
    const data = await labResp.json();
    console.log(`  Results: ${Array.isArray(data) ? data.length : 'non-array'} entries`);
  }

  // --- Summary ---
  const allOk = sessionResp.ok && userResp.ok && labResp.ok;
  if (allOk) {
    console.log('\n✅ Auth flow completed successfully! All API endpoints working.');
    console.log('   Cookie-based session capture is proven. Ready for Step 2.');
  } else {
    console.log('\n⚠️  Some endpoints failed. Check output above.');
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
