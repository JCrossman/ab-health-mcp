import type { CookieJar } from 'tough-cookie';
import { NetworkError, UpstreamContractError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function readJsonResponse(response: Response, source: 'mhr' | 'mychart'): Promise<unknown> {
  const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
  if (!['application/json', 'text/json', 'text/x-json'].includes(contentType) && !contentType.endsWith('+json')) {
    throw new UpstreamContractError(source);
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) throw new UpstreamContractError(source);
    throw new NetworkError('The connection closed before the health records response was received. Please try again.');
  }
  if (isRecord(value) && (
    isRecord(value.phrApiError) || value.isError === true || value.hasError === true ||
    value.error === true || isRecord(value.error) ||
    (typeof value.error === 'string' && value.error.trim() !== '')
  )) {
    throw new UpstreamContractError(source);
  }
  return value;
}

export function readCompleteList(value: unknown, source: 'mhr' | 'mychart'): unknown[] {
  if (Array.isArray(value)) return value;
  if (
    isRecord(value) &&
    Array.isArray(value.data) &&
    Number.isSafeInteger(value.totalCount) &&
    value.totalCount === value.data.length
  ) {
    return value.data;
  }
  throw new UpstreamContractError(source);
}

export async function storeResponseCookies(jar: CookieJar, response: Response, url: string): Promise<void> {
  for (const cookie of response.headers.getSetCookie()) {
    try {
      await jar.setCookie(cookie, url);
    } catch {
      logger.warn('The health portal sent an invalid session cookie; that cookie was not used.');
    }
  }
}
