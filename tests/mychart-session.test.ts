import { afterEach, describe, expect, it, vi } from 'vitest';
import { CookieJar } from 'tough-cookie';
import { extractMyChartToken, fetchMyChartToken, MYCHART_HOME } from '../src/api/mychart-session.js';
import { homePage } from './fixtures.js';

afterEach(() => vi.unstubAllGlobals());

describe('MyChart authenticated Home token', () => {
  it('selects the named hidden input and decodes HTML entities', () => {
    const html = `<input value="wrong">
      <input value='synthetic&amp;token' TYPE='hidden' name='__RequestVerificationToken'>`;
    expect(extractMyChartToken(html)).toBe('synthetic&token');
  });

  it('allows repeated copies of the same token', () => {
    expect(extractMyChartToken(
      '<input type="hidden" name="__RequestVerificationToken" value="same">'.repeat(2),
    )).toBe('same');
  });

  it.each([
    '',
    '<input value="not-a-token">',
    '<input type="text" name="__RequestVerificationToken" value="not-hidden">',
    '<input type="hidden" name="__RequestVerificationToken" value="">',
    '<!-- <input type="hidden" name="__RequestVerificationToken" value="comment"> -->',
    '<script>const html = \'<input type="hidden" name="__RequestVerificationToken" value="script">\';</script>',
    '<input type="hidden" name="__RequestVerificationToken" value="one"><input type="hidden" name="__RequestVerificationToken" value="two">',
  ])('rejects missing, non-form, or ambiguous tokens', html => {
    expect(() => extractMyChartToken(html)).toThrow(expect.objectContaining({ name: 'UpstreamContractError' }));
  });

  it('uses Home, retains its cookie, and supplies existing cookies', async () => {
    const jar = new CookieJar();
    await jar.setCookie('existing=synthetic; Path=/; Secure', MYCHART_HOME);
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
      expect(url).toBe(MYCHART_HOME);
      expect(init?.redirect).toBe('manual');
      expect(new Headers(init?.headers).get('Cookie')).toContain('existing=synthetic');
      const response = homePage();
      response.headers.append('Set-Cookie', 'anti-forgery=synthetic-new; Path=/MyChartPRD/; Secure');
      return response;
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchMyChartToken(jar)).resolves.toBe('synthetic-token');
    expect(await jar.getCookieString(MYCHART_HOME)).toContain('anti-forgery=synthetic-new');
  });

  it.each([
    '/MyChartPRD/Authentication/Login',
    'https://account.alberta.ca/ui/sign-in/signin',
    'https://untrusted.invalid/MyChartPRD/Home',
    'http://myahsconnect.albertahealthservices.ca/MyChartPRD/Home',
  ])('does not follow login or untrusted redirects', location => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, {
      status: 302, headers: { Location: location },
    }));
    vi.stubGlobal('fetch', fetchMock);
    return expect(fetchMyChartToken(new CookieJar())).rejects.toMatchObject({ name: 'SessionExpiredError' });
  });

  it('follows a same-origin Home canonical redirect using rotated cookies', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { Location: '/MyChartPRD/Home/Index', 'Set-Cookie': 'rotation=synthetic; Path=/; Secure' },
      }))
      .mockImplementationOnce(async (_url, init) => {
        expect(new Headers(init?.headers).get('Cookie')).toContain('rotation=synthetic');
        return homePage();
      });
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchMyChartToken(new CookieJar())).resolves.toBe('synthetic-token');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects an empty HTTP 200 instead of returning a blank token', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('')));
    await expect(fetchMyChartToken(new CookieJar())).rejects.toMatchObject({ name: 'UpstreamContractError' });
  });
});
