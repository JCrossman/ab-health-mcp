/**
 * Converts Chrome extension cookie objects to tough-cookie CookieJar format.
 *
 * Chrome's `chrome.cookies.getAll()` returns objects with a different shape
 * than tough-cookie expects. This module bridges the two formats.
 */

import { CookieJar, Cookie } from 'tough-cookie';

/** Shape returned by chrome.cookies.getAll() */
export interface ChromeCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'no_restriction' | 'lax' | 'strict' | 'unspecified';
  expirationDate?: number;
  hostOnly?: boolean;
  session?: boolean;
  storeId?: string;
}

const SAME_SITE_MAP: Record<string, 'none' | 'lax' | 'strict' | undefined> = {
  no_restriction: 'none',
  lax: 'lax',
  strict: 'strict',
  unspecified: undefined,
};

/**
 * Convert a single Chrome cookie to a tough-cookie Cookie.
 */
function chromeCookieToTough(cc: ChromeCookie): Cookie {
  return new Cookie({
    key: cc.name,
    value: cc.value,
    domain: cc.domain,
    path: cc.path,
    secure: cc.secure,
    httpOnly: cc.httpOnly,
    sameSite: SAME_SITE_MAP[cc.sameSite] ?? undefined,
    expires: cc.expirationDate && cc.expirationDate > 0
      ? new Date(cc.expirationDate * 1000)
      : 'Infinity',
    hostOnly: cc.hostOnly,
  });
}

/**
 * Convert an array of Chrome extension cookies into a tough-cookie CookieJar.
 */
export async function chromeCookiesToJar(cookies: ChromeCookie[]): Promise<CookieJar> {
  const jar = new CookieJar();

  for (const cc of cookies) {
    const tough = chromeCookieToTough(cc);
    const domain = cc.domain.replace(/^\./, '');
    const cookieUrl = `https://${domain}${cc.path}`;
    try {
      await jar.setCookie(tough, cookieUrl);
    } catch {
      // Skip cookies that fail validation (e.g. expired, domain mismatch)
    }
  }

  return jar;
}
