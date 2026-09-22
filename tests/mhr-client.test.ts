import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CookieJar } from 'tough-cookie';
import { MHRClient } from '../src/api/mhr-client.js';
import { cmsConfig, cmsPage, labResult, requestUrl } from './fixtures.js';
import { toApiDateFormat } from '../src/utils/formatters.js';

const fetchMock = vi.fn<typeof fetch>();
const cmsPath = '/api/cms/v1/pages/root/browser';

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('MHR backend contracts', () => {
  it('discovers the read-only medication mapping instead of using a fixed ID', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = requestUrl(input);
      if (url.pathname === cmsPath) return Response.json(cmsConfig(901));
      expect(url.pathname).toBe('/api/phr/v1/medication');
      expect(new Headers(init?.headers).get('Control-Mapping-Id')).toBe('901');
      expect(url.searchParams.get('startIndex')).toBe('-1');
      expect(url.searchParams.get('endIndex')).toBe('-1');
      return Response.json([{ name: 'Example medicine' }]);
    });
    await expect(new MHRClient(new CookieJar()).getMedications()).resolves.toEqual([{ name: 'Example medicine' }]);
  });

  it('uses different lab and imaging mappings with all-record paging', async () => {
    const mappingIds: string[] = [];
    fetchMock.mockImplementation(async (input, init) => {
      const url = requestUrl(input);
      if (url.pathname === cmsPath) return Response.json(cmsConfig());
      expect(url.pathname).toBe('/api/phr/v1/labresult/getData');
      expect(url.searchParams.get('startIndex')).toBe('-1');
      expect(url.searchParams.get('endIndex')).toBe('-1');
      mappingIds.push(new Headers(init?.headers).get('Control-Mapping-Id') ?? '');
      return Response.json([labResult()]);
    });
    const client = new MHRClient(new CookieJar());
    await Promise.all([client.getLabResults(), client.getDiagnosticImaging()]);
    expect(mappingIds.sort()).toEqual(['102', '103']);
    expect(fetchMock.mock.calls.filter(([input]) => requestUrl(input).pathname === cmsPath)).toHaveLength(1);
  });

  it('supports object and list settings without selecting another locale', async () => {
    const configuration = { pages: [
      cmsPage('/ResultsAndReadings/LabResults', 'lab', 222, {}, 'en-CA', true),
      cmsPage('/ResultsAndReadings/LabResults', 'lab', 333, {}, 'fr-CA'),
    ] };
    fetchMock.mockImplementation(async (input, init) => {
      if (requestUrl(input).pathname === cmsPath) return Response.json(configuration);
      expect(new Headers(init?.headers).get('Control-Mapping-Id')).toBe('222');
      return Response.json([]);
    });
    await expect(new MHRClient(new CookieJar()).getLabResults()).resolves.toEqual([]);
  });

  it('does not override a preset range with all-time dates', async () => {
    fetchMock.mockImplementation(async input => {
      const url = requestUrl(input);
      if (url.pathname === cmsPath) return Response.json(cmsConfig());
      expect(url.searchParams.get('dateRangeOptions')).toBe('LastYear');
      expect(url.searchParams.has('startDate')).toBe(false);
      expect(url.searchParams.has('endDate')).toBe(false);
      return Response.json([]);
    });
    await new MHRClient(new CookieJar()).getLabResults({ dateRange: 'LastYear' });
  });

  it('lets explicit dates override the preset range using the portal date format', async () => {
    fetchMock.mockImplementation(async input => {
      const url = requestUrl(input);
      if (url.pathname === cmsPath) return Response.json(cmsConfig());
      expect(url.searchParams.get('dateRangeOptions')).toBe('Custom');
      expect(url.searchParams.get('startDate')).toBe(toApiDateFormat('2020-01-01'));
      expect(url.searchParams.get('endDate')).toBe(toApiDateFormat('2020-12-31'));
      return Response.json([]);
    });
    await new MHRClient(new CookieJar()).getLabResults({
      dateRange: 'LastYear', startDate: '2020-01-01', endDate: '2020-12-31',
    });
  });

  it.each([
    { pages: [] },
    { pages: [cmsPage('/HealthSummary/Medicines', 'medication', 4, { filterType: 'FilterByNonConfiguredAppIds' })] },
    { pages: [cmsPage('/HealthSummary/Medicines', 'medication', 4), cmsPage('/HealthSummary/Medicines', 'medication', 5)] },
  ])('rejects missing or ambiguous medication mappings', async configuration => {
    fetchMock.mockResolvedValue(Response.json(configuration));
    await expect(new MHRClient(new CookieJar()).getMedications()).rejects.toMatchObject({ name: 'UpstreamContractError' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not cache mappings across clients or affect unmapped endpoints', async () => {
    let id = 400;
    const observed: string[] = [];
    fetchMock.mockImplementation(async (input, init) => {
      if (requestUrl(input).pathname === cmsPath) return Response.json(cmsConfig(id));
      const header = new Headers(init?.headers).get('Control-Mapping-Id');
      if (requestUrl(input).pathname === '/api/phr/v1/medication') observed.push(header ?? '');
      else expect(header).toBeNull();
      return Response.json([]);
    });
    await new MHRClient(new CookieJar()).getMedications();
    id = 401;
    await new MHRClient(new CookieJar()).getMedications();
    await new MHRClient(new CookieJar()).getBloodPressure();
    expect(observed).toEqual(['400', '401']);
    expect(fetchMock.mock.calls.filter(([input]) => requestUrl(input).pathname === cmsPath)).toHaveLength(2);
  });

  it.each([
    [labResult()],
    { totalCount: 1, data: [labResult()] },
    { totalCount: 0, data: [] },
  ])('normalizes a complete supported lab response', async body => {
    fetchMock.mockImplementation(async input =>
      Response.json(requestUrl(input).pathname === cmsPath ? cmsConfig() : body));
    const result = await new MHRClient(new CookieJar()).getLabResults({ dateRange: 'LastYear' });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(Array.isArray(body) ? body : body.data);
  });

  it.each([
    { totalCount: 2, data: [labResult()] },
    { totalCount: '1', data: [labResult()] },
    { totalCount: -1, data: [] },
    { data: 'not-an-array' },
    { error: 'synthetic-upstream-error' },
    { totalCount: 0, data: [], phrApiError: { code: 1, message: 'synthetic-upstream-error' } },
  ])('does not turn unexpected or incomplete responses into empty records', async body => {
    fetchMock.mockImplementation(async input =>
      Response.json(requestUrl(input).pathname === cmsPath ? cmsConfig() : body));
    await expect(new MHRClient(new CookieJar()).getLabResults()).rejects.toMatchObject({ name: 'UpstreamContractError' });
  });

  it('rejects an anonymous HTTP 200 user profile', async () => {
    fetchMock.mockResolvedValue(Response.json({}));
    await expect(new MHRClient(new CookieJar()).getUser()).rejects.toThrow();
  });

  it('rejects an expired HTTP 200 session', async () => {
    fetchMock.mockResolvedValue(Response.json({ isSessionExpired: true, numberOfMilliSecondsLeftForSessionExpire: 0 }));
    await expect(new MHRClient(new CookieJar()).getSessionStatus()).rejects.toMatchObject({ name: 'SessionExpiredError' });
  });

  it('retains cookies issued while loading configuration', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      if (requestUrl(input).pathname === cmsPath) {
        return Response.json(cmsConfig(), { headers: { 'Set-Cookie': 'synthetic-session=rotated; Path=/; Secure' } });
      }
      expect(new Headers(init?.headers).get('Cookie')).toContain('synthetic-session=rotated');
      return Response.json([]);
    });
    await new MHRClient(new CookieJar()).getMedications();
  });
});
