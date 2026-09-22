import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CookieJar } from 'tough-cookie';
import type { SessionData } from '../src/auth/session-manager.js';
import { MHRClient } from '../src/api/mhr-client.js';
import { MyChartClient } from '../src/api/mychart-client.js';
import { ensureMyChartSession, invalidateSessionCache, sessionManager } from '../src/helpers/session-helpers.js';
import { runWithSession } from '../src/server/session-context.js';
import { checkConnectionTool } from '../src/tools/check-connection.js';
import { disconnectAccountTool } from '../src/tools/disconnect-account.js';
import { homePage, profile, requestUrl } from './fixtures.js';

const fetchMock = vi.fn<typeof fetch>();
let session: SessionData;

beforeEach(() => {
  vi.restoreAllMocks();
  invalidateSessionCache();
  session = {
    mhrJar: new CookieJar(),
    myChartJar: new CookieJar(),
    myChartCsrfToken: 'old-synthetic-token',
  };
  vi.spyOn(sessionManager, 'load').mockImplementation(async () => session);
  vi.spyOn(sessionManager, 'exists').mockResolvedValue(true);
  vi.spyOn(sessionManager, 'save').mockResolvedValue();
  vi.spyOn(sessionManager, 'clear').mockResolvedValue();
  vi.spyOn(MHRClient.prototype, 'getSessionStatus').mockResolvedValue({
    isSessionExpired: false,
    numberOfMilliSecondsLeftForSessionExpire: 600_000,
  });
  vi.spyOn(MHRClient.prototype, 'getUser').mockResolvedValue(profile);
  vi.spyOn(MyChartClient.prototype, 'keepAlive').mockResolvedValue();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  invalidateSessionCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('desktop session token persistence', () => {
  it('persists a context-switch token for a newly constructed client', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const path = requestUrl(input).pathname;
      if (path.endsWith('/inside.asp')) return new Response('<html></html>');
      if (path.endsWith('/Home')) return homePage('new-synthetic-token');
      expect(new Headers(init?.headers).get('__RequestVerificationToken')).toBe('new-synthetic-token');
      return Response.json({ allergies: [] });
    });
    await (await ensureMyChartSession()).switchToSelf();
    expect(session.myChartCsrfToken).toBe('new-synthetic-token');
    expect(sessionManager.save).toHaveBeenCalledWith(session);
    await (await ensureMyChartSession()).getAllergies();
  });

  it('repairs a legacy session with cookies but no token on first use', async () => {
    session.myChartCsrfToken = undefined;
    fetchMock.mockImplementation(async (input, init) => {
      if (requestUrl(input).pathname.endsWith('/Home')) return homePage('recovered-synthetic-token');
      expect(new Headers(init?.headers).get('__RequestVerificationToken')).toBe('recovered-synthetic-token');
      return Response.json({ allergies: [] });
    });
    await (await ensureMyChartSession()).getAllergies();
    expect(session.myChartCsrfToken).toBe('recovered-synthetic-token');
  });

  it('does not write a remote request session into desktop storage', async () => {
    const remote: SessionData = {
      mhrJar: new CookieJar(),
      myChartJar: new CookieJar(),
      myChartCsrfToken: 'remote-synthetic-token',
    };
    fetchMock.mockImplementation(async () => homePage('refreshed-remote-token'));
    await runWithSession(remote, async () => (await ensureMyChartSession()).refreshSession());
    expect(remote.myChartCsrfToken).toBe('refreshed-remote-token');
    expect(session.myChartCsrfToken).toBe('old-synthetic-token');
    expect(sessionManager.load).not.toHaveBeenCalled();
    expect(sessionManager.save).not.toHaveBeenCalled();
  });

  it('cannot save an old client session after disconnect', async () => {
    const client = await ensureMyChartSession();
    await disconnectAccountTool.handler();
    fetchMock.mockImplementation(async () => homePage());
    await expect(client.refreshSession()).rejects.toMatchObject({ name: 'SessionExpiredError' });
    expect(sessionManager.save).not.toHaveBeenCalled();
  });

  it('reports MyChart unavailable despite stored cookies and a token', async () => {
    fetchMock.mockImplementation(async () => new Response(null, {
      status: 302, headers: { Location: '/MyChartPRD/Authentication/Login' },
    }));
    const result = await checkConnectionTool.handler();
    const data = JSON.parse(result.content[0].text);
    expect(data.connected).toBe(true);
    expect(data.mhrConnected).toBe(true);
    expect(data.myChartConnected).toBe(false);
    expect(data.warnings.myChart.error).toBe('session_expired');
    expect(session.myChartCsrfToken).toBeUndefined();
  });

  it('does not report a successful disconnect when storage deletion fails', async () => {
    vi.mocked(sessionManager.clear).mockRejectedValue(new Error('synthetic-storage-failure'));
    const result = await disconnectAccountTool.handler();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).not.toContain('synthetic-storage-failure');
  });

  it('requires a new sign-in after an uncertain context switch', async () => {
    fetchMock.mockImplementation(async () => new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } }));
    await expect((await ensureMyChartSession()).switchToSelf()).rejects.toMatchObject({ name: 'UpstreamContractError' });
    expect(session.myChartJar).toBeUndefined();
    expect(session.myChartCsrfToken).toBeUndefined();
    await expect(ensureMyChartSession()).rejects.toMatchObject({ name: 'AuthRequiredError' });
  });
});
