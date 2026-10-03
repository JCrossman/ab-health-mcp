import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CookieJar } from 'tough-cookie';
import { MHRClient } from '../src/api/mhr-client.js';
import { MyChartClient } from '../src/api/mychart-client.js';
import { ApiError, AuthRequiredError } from '../src/utils/errors.js';
import { labResult, profile } from './fixtures.js';

const helpers = vi.hoisted(() => ({
  ensureSession: vi.fn(),
  ensureMyChartSession: vi.fn(),
}));
vi.mock('../src/helpers/session-helpers.js', async importOriginal => ({
  ...await importOriginal<typeof import('../src/helpers/session-helpers.js')>(),
  ...helpers,
}));
import { getHealthOverviewTool } from '../src/tools/get-health-overview.js';

let mhr: MHRClient;
let mc: MyChartClient;

function dataOf(result: Awaited<ReturnType<typeof getHealthOverviewTool.handler>>) {
  const block = result.content.find(item => item.type === 'text' && item.text.startsWith('{'));
  if (!block) throw new Error('Missing structured tool result');
  return JSON.parse(block.text);
}

beforeEach(() => {
  vi.restoreAllMocks();
  mhr = new MHRClient(new CookieJar());
  mc = new MyChartClient(new CookieJar(), 'synthetic-token');
  helpers.ensureSession.mockResolvedValue(mhr);
  helpers.ensureMyChartSession.mockResolvedValue(mc);
  vi.spyOn(mhr, 'getUser').mockResolvedValue(profile);
  vi.spyOn(mhr, 'getMedications').mockResolvedValue([{ name: 'Example medicine' }]);
  vi.spyOn(mhr, 'getLabResults').mockResolvedValue([labResult()]);
  vi.spyOn(mc, 'getAllergies').mockResolvedValue({ allergies: [] });
  vi.spyOn(mc, 'getHealthIssues').mockResolvedValue({ healthIssues: [] });
  vi.spyOn(mc, 'getImmunizations').mockResolvedValue({ immunizations: [] });
});

describe('health overview partial failures', () => {
  it('keeps successful sections and reports a failed medication section', async () => {
    vi.mocked(mhr.getMedications).mockRejectedValue(new ApiError(500));
    const result = await getHealthOverviewTool.handler();
    const data = dataOf(result);
    expect(result.isError).not.toBe(true);
    expect(data.partial).toBe(true);
    expect(data.medications_mhr).toBeNull();
    expect(data.errors.medications_mhr.error).toBe('api_error');
    expect(data.recent_lab_results).toHaveLength(1);
    expect(data.profile.name).toBe(profile.name);
  });

  it('distinguishes a successful empty list from unavailable records', async () => {
    vi.mocked(mhr.getMedications).mockResolvedValue([]);
    const data = dataOf(await getHealthOverviewTool.handler());
    expect(data.partial).toBe(false);
    expect(data.medications_mhr).toEqual([]);
    expect(data.errors).toEqual({});
  });

  it('identifies all unavailable MyChart sections', async () => {
    helpers.ensureMyChartSession.mockRejectedValue(new AuthRequiredError());
    const data = dataOf(await getHealthOverviewTool.handler());
    expect(data.partial).toBe(true);
    expect(data.sources.myChart).toBe(false);
    expect(data.allergies_mychart).toBeNull();
    expect(Object.keys(data.errors)).toEqual(expect.arrayContaining([
      'allergies_mychart', 'health_issues_mychart', 'immunizations_mychart',
    ]));
  });

  it('does not call a fully failed overview a success', async () => {
    helpers.ensureSession.mockRejectedValue(new AuthRequiredError());
    helpers.ensureMyChartSession.mockRejectedValue(new AuthRequiredError());
    const result = await getHealthOverviewTool.handler();
    expect(result.isError).toBe(true);
  });

  it('preserves unfamiliar medication structures instead of dropping their contents', async () => {
    const medication = { status: 'Medication', medication: { displayName: 'Example medicine' }, refills: [] };
    vi.mocked(mhr.getMedications).mockResolvedValue([medication]);
    const data = dataOf(await getHealthOverviewTool.handler());
    expect(data.medications_mhr).toEqual([medication]);
  });

  it('marks a source unavailable when every request to it fails', async () => {
    vi.mocked(mhr.getUser).mockRejectedValue(new ApiError(500));
    vi.mocked(mhr.getMedications).mockRejectedValue(new ApiError(500));
    vi.mocked(mhr.getLabResults).mockRejectedValue(new ApiError(500));
    const data = dataOf(await getHealthOverviewTool.handler());
    expect(data.sources.mhr).toBe(false);
    expect(data.sources.myChart).toBe(true);
    expect(data.partial).toBe(true);
  });
});
