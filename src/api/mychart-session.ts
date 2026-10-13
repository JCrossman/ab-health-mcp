import { parse, type DefaultTreeAdapterTypes } from 'parse5';
import type { CookieJar } from 'tough-cookie';
import { ApiError, NetworkError, SessionExpiredError, UpstreamContractError } from '../utils/errors.js';
import { storeResponseCookies } from './response-helpers.js';

export const MYCHART_BASE = 'https://myahsconnect.albertahealthservices.ca';
export const MYCHART_HOME = `${MYCHART_BASE}/MyChartPRD/Home`;

export function isMyChartHome(url: string): boolean {
  const parsed = new URL(url);
  return parsed.origin === MYCHART_BASE && /^\/MyChartPRD\/Home(?:\/|$)/i.test(parsed.pathname);
}

export function extractMyChartToken(html: string): string {
  const tokens = new Set<string>();
  function visit(node: DefaultTreeAdapterTypes.Node): void {
    if ('tagName' in node && node.tagName === 'input') {
      const attributes = new Map(node.attrs.map(attribute => [attribute.name, attribute.value]));
      if (attributes.get('name') === '__RequestVerificationToken' && attributes.get('type')?.toLowerCase() === 'hidden') {
        const value = attributes.get('value')?.trim();
        if (value) tokens.add(value);
      }
    }
    if ('childNodes' in node) for (const child of node.childNodes) visit(child);
  }
  visit(parse(html));
  return selectMyChartToken(tokens);
}

export function selectMyChartToken(values: Iterable<string>): string {
  const tokens = new Set([...values].map(value => value.trim()).filter(Boolean));
  const [token] = tokens;
  if (tokens.size !== 1 || !token) throw new UpstreamContractError('mychart');
  return token;
}

export async function fetchMyChartToken(jar: CookieJar): Promise<string> {
  let url = MYCHART_HOME;
  const signal = AbortSignal.timeout(30_000);
  for (let redirects = 0; redirects <= 5; redirects++) {
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal,
        headers: {
          Cookie: await jar.getCookieString(url),
          Accept: 'text/html',
          Referer: MYCHART_HOME,
          'Cache-Control': 'no-cache',
        },
      });
    } catch {
      throw new NetworkError('Could not reach MyChart (AHS Connect). Check your internet connection.');
    }
    await storeResponseCookies(jar, response, url);
    if (response.status === 401 || response.status === 403) {
      throw new SessionExpiredError('MyChart session expired. Use connect_account to sign in again.');
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new UpstreamContractError('mychart');
      const next = new URL(location, url).href;
      if (!isMyChartHome(next)) {
        throw new SessionExpiredError('MyChart session expired. Use connect_account to sign in again.');
      }
      await response.body?.cancel();
      url = next;
      continue;
    }
    if (!response.ok) throw new ApiError(response.status, 'MyChart (AHS Connect) is currently unavailable. Try again later.');
    if (!response.headers.get('content-type')?.toLowerCase().includes('text/html')) {
      throw new UpstreamContractError('mychart');
    }
    return extractMyChartToken(await response.text());
  }
  throw new UpstreamContractError('mychart');
}
