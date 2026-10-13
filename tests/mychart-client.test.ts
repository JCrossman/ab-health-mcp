import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CookieJar } from 'tough-cookie';
import { MyChartClient } from '../src/api/mychart-client.js';
import { homePage, requestUrl } from './fixtures.js';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('MyChart token lifetime', () => {
  it('refreshes from Home after switching and uses the token on the next call', async () => {
    const updated = vi.fn<(token: string | undefined) => Promise<void>>().mockResolvedValue();
    fetchMock.mockImplementation(async (input, init) => {
      const url = requestUrl(input);
      if (url.pathname.endsWith('/inside.asp')) return new Response('<html></html>');
      if (url.pathname.endsWith('/Home')) return homePage('refreshed-synthetic-token');
      if (url.pathname.endsWith('/LoadAllergies')) {
        expect(new Headers(init?.headers).get('__RequestVerificationToken')).toBe('refreshed-synthetic-token');
        return Response.json({ allergies: [] });
      }
      return new Response(null, { status: 404 });
    });
    const client = new MyChartClient(new CookieJar(), 'old-synthetic-token', updated);
    await client.switchToSelf();
    await client.getAllergies();
    expect(updated).toHaveBeenCalledWith('refreshed-synthetic-token');
    expect(fetchMock.mock.calls.some(([input]) => requestUrl(input).pathname.endsWith('/CSRFToken'))).toBe(false);
  });

  it('fails a switch instead of keeping an old token when Home has no token', async () => {
    fetchMock.mockImplementation(async () => new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } }));
    const updated = vi.fn<(token: string | undefined) => Promise<void>>().mockResolvedValue();
    const client = new MyChartClient(new CookieJar(), 'old-synthetic-token', updated);
    await expect(client.switchToSelf()).rejects.toMatchObject({ name: 'UpstreamContractError' });
    expect(updated).toHaveBeenCalledWith(undefined);
  });

  it('refreshes the token before retrying a rejected request', async () => {
    let posts = 0;
    fetchMock.mockImplementation(async (input, init) => {
      if (requestUrl(input).pathname.endsWith('/Home')) return homePage('retry-synthetic-token');
      if (requestUrl(input).pathname.endsWith('/LoadAllergies')) {
        if (++posts === 1) return new Response(null, { status: 403 });
        expect(new Headers(init?.headers).get('__RequestVerificationToken')).toBe('retry-synthetic-token');
        return Response.json({ allergies: [] });
      }
      return new Response(null, { status: 200 });
    });
    await expect(new MyChartClient(new CookieJar(), 'old-synthetic-token').getAllergies()).resolves.toEqual({ allergies: [] });
    expect(posts).toBe(2);
  });

  it('retains cookies from successful POST responses', async () => {
    const jar = new CookieJar();
    fetchMock.mockResolvedValue(Response.json({}, { headers: { 'Set-Cookie': 'synthetic-session=updated; Path=/MyChartPRD/; Secure' } }));
    await new MyChartClient(jar, 'synthetic-token').getAllergies();
    expect(await jar.getCookieString('https://myahsconnect.albertahealthservices.ca/MyChartPRD/Home')).toContain('synthetic-session=updated');
  });

  it('does not expose an HTML response through a JSON parser error', async () => {
    fetchMock.mockResolvedValue(new Response('<html>synthetic-private-marker</html>', { headers: { 'Content-Type': 'text/html' } }));
    await expect(new MyChartClient(new CookieJar(), 'synthetic-token').getAllergies()).rejects.toMatchObject({
      name: 'UpstreamContractError',
    });
  });

  it('does not report an HTTP 200 application error as health data', async () => {
    fetchMock.mockResolvedValue(Response.json({ hasError: true, error: 'synthetic-private-marker' }));
    await expect(new MyChartClient(new CookieJar(), 'synthetic-token').getAllergies()).rejects.toMatchObject({
      name: 'UpstreamContractError',
    });
  });

  it('shares a missing-token refresh across parallel overview calls', async () => {
    fetchMock.mockImplementation(async input =>
      requestUrl(input).pathname.endsWith('/Home') ? homePage() : Response.json({}));
    const client = new MyChartClient(new CookieJar(), '');
    await Promise.all([client.getAllergies(), client.getHealthIssues(), client.getImmunizations()]);
    expect(fetchMock.mock.calls.filter(([input]) => requestUrl(input).pathname.endsWith('/Home'))).toHaveLength(1);
  });
});
