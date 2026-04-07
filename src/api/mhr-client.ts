/**
 * My Health Records REST API client.
 *
 * Wraps all confirmed API endpoints with cookie-based authentication.
 * This is a pure passthrough — no health data interpretation or caching.
 */

import { CookieJar } from 'tough-cookie';
import { SessionExpiredError, ApiError, NetworkError } from '../utils/errors.js';
import { toApiDateFormat, DEFAULT_START_DATE, DEFAULT_END_DATE } from '../utils/formatters.js';
import type { UserProfile, SessionStatus, LabResult, LabResultParams, ImmunizationRecord } from '../types.js';

const MHR_BASE = 'https://myhealthrecords.alberta.ca';

type DateRangeParams = { dateRange?: string; startDate?: string; endDate?: string };

export class MHRClient {
  constructor(private cookieJar: CookieJar) {}

  private async fetch(path: string, extraHeaders: Record<string, string> = {}): Promise<Response> {
    const response = await this.rawFetch(path, extraHeaders);

    if (response.status === 401 || response.status === 403) {
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        await this.rawFetch(
          `/api/phr/v1/session?SessionMode=Patient&IsKeypressed=true&KeyPressedUnixTimeStamp=${timestamp}`,
        );
      } catch {
        throw new SessionExpiredError();
      }

      const retry = await this.rawFetch(path, extraHeaders);
      if (retry.status === 401 || retry.status === 403) throw new SessionExpiredError();
      if (retry.status >= 500) throw new ApiError(retry.status);
      return retry;
    }

    if (response.status >= 500) throw new ApiError(response.status);
    return response;
  }

  private async rawFetch(path: string, extraHeaders: Record<string, string> = {}): Promise<Response> {
    const url = `${MHR_BASE}${path}`;
    const cookies = await this.cookieJar.getCookieString(url);

    try {
      return await fetch(url, {
        headers: {
          'Cookie': cookies,
          'Accept': 'application/json',
          'Accept-Language': 'en-CA',
          'Referer': `${MHR_BASE}/ng/`,
          'Cache-Control': 'no-cache',
          ...extraHeaders,
        },
      });
    } catch {
      throw new NetworkError();
    }
  }

  /** Build date range query params used by most endpoints. */
  private dateRangeQuery(params: DateRangeParams = {}, defaultRange = 'All', extra: Record<string, string> = {}): URLSearchParams {
    const { dateRange = defaultRange, startDate, endDate } = params;
    return new URLSearchParams({
      startDate: startDate ? toApiDateFormat(startDate) : DEFAULT_START_DATE,
      endDate: endDate ? toApiDateFormat(endDate) : DEFAULT_END_DATE,
      dateRangeOptions: dateRange,
      ...extra,
    });
  }

  /** Fetch a date-range endpoint and return parsed JSON. */
  private async fetchDateRange(path: string, params: DateRangeParams = {}, defaultRange = 'All', extra: Record<string, string> = {}): Promise<unknown[]> {
    const qs = this.dateRangeQuery(params, defaultRange, extra);
    const response = await this.fetch(`${path}?${qs}`);
    return response.json() as Promise<unknown[]>;
  }

  async downloadAttachment(thingId: string, filename: string): Promise<{ buffer: Buffer; contentType: string }> {
    const response = await this.fetch(
      `/api/phr/v1/attachment/${encodeURIComponent(thingId)}/download?bName=${encodeURIComponent(filename)}`,
      { 'Accept': '*/*' },
    );
    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('Content-Type') ?? 'application/pdf';
    return { buffer: Buffer.from(arrayBuffer), contentType };
  }

  async getSessionStatus(): Promise<SessionStatus> {
    const timestamp = Math.floor(Date.now() / 1000);
    const response = await this.fetch(
      `/api/phr/v1/session?SessionMode=Patient&IsKeypressed=true&KeyPressedUnixTimeStamp=${timestamp}`,
    );
    return response.json() as Promise<SessionStatus>;
  }

  async getUser(): Promise<UserProfile> {
    const response = await this.fetch('/api/phr/v1/user');
    return response.json() as Promise<UserProfile>;
  }

  private static readonly LAB_EXTRA = { labConfiguration: '00000000-0000-0000-0000-000000000000', showOtherSection: 'True', ignoreConfig: 'True' };

  async getLabResults(params: LabResultParams = {}): Promise<LabResult[]> {
    return this.fetchDateRange('/api/phr/v1/labresult/getData', params, 'All', MHRClient.LAB_EXTRA) as Promise<LabResult[]>;
  }

  async getDiagnosticImaging(params: DateRangeParams = {}): Promise<unknown[]> {
    return this.fetchDateRange('/api/phr/v1/labresult/getData', params, 'All', MHRClient.LAB_EXTRA);
  }

  async getImmunizations(params: DateRangeParams = {}): Promise<ImmunizationRecord[]> {
    return this.fetchDateRange('/api/phr/v1/myhealth/immunization-data-manager', params) as Promise<ImmunizationRecord[]>;
  }

  async getMedications(): Promise<unknown[]> {
    const response = await this.fetch(
      '/api/phr/v1/medication?startIndex=-1&endIndex=-1&type=all&status=Medication&includeOrphanRefills=false',
      { 'Control-Mapping-Id': '8050' },
    );
    return response.json() as Promise<unknown[]>;
  }

  async getReferrals(params: DateRangeParams = {}): Promise<unknown[]> {
    return this.fetchDateRange('/api/phr/v1/referral', params, 'AllData');
  }

  async getVitalSigns(params: DateRangeParams = {}): Promise<unknown[]> {
    return this.fetchDateRange('/api/phr/v1/VitalSigns', params, 'All', { types: 'Pls,Res,Tmp' });
  }

  async getBloodOxygen(params: DateRangeParams = {}): Promise<unknown[]> {
    return this.fetchDateRange('/api/phr/v1/myhealth/blood-oxygensaturation-data-manager', params);
  }

  async getBloodPressure(params: DateRangeParams = {}): Promise<unknown[]> {
    return this.fetchDateRange('/api/phr/v1/myhealth/blood-pressure-data-manager', params);
  }

  async getHeightWeight(params: DateRangeParams = {}): Promise<{ height: unknown[]; weight: unknown[]; bmi: unknown[] }> {
    const qs = this.dateRangeQuery(params);
    const [heightResp, weightResp, bmiResp] = await Promise.all([
      this.fetch(`/api/phr/v1/myhealth/height-data-manager?${qs}`),
      this.fetch(`/api/phr/v1/myhealth/weight-data-manager?${qs}`),
      this.fetch(`/api/phr/v1/bmi?${qs}`),
    ]);
    return {
      height: await heightResp.json() as unknown[],
      weight: await weightResp.json() as unknown[],
      bmi: await bmiResp.json() as unknown[],
    };
  }

  async getExercise(params: DateRangeParams = {}): Promise<unknown[]> {
    return this.fetchDateRange('/api/phr/v1/exercise', params);
  }

  async getProcedures(params: DateRangeParams = {}): Promise<unknown[]> {
    return this.fetchDateRange('/api/phr/v1/procedure', params);
  }

  async getBloodGlucose(params: DateRangeParams = {}): Promise<unknown[]> {
    return this.fetchDateRange('/api/phr/v1/myhealth/blood-glucose-data-manager', params);
  }

  async getSleep(params: DateRangeParams = {}): Promise<unknown[]> {
    return this.fetchDateRange('/api/phr/v1/myhealth/sleep-session-data-manager-v2', params);
  }

  async getDietaryIntake(params: DateRangeParams = {}): Promise<unknown[]> {
    return this.fetchDateRange('/api/phr/v1/myhealth/dietary-intake-data-manager', params);
  }

  async getInsulin(params: DateRangeParams = {}): Promise<{ injections: unknown[]; usage: unknown[] }> {
    const qs = this.dateRangeQuery(params);
    const [injectionsResp, usageResp] = await Promise.all([
      this.fetch(`/api/phr/v1/myhealth/insulin-injection-data-manager?${qs}`),
      this.fetch(`/api/phr/v1/myhealth/insulin-injection-use-data-manager?${qs}`),
    ]);
    return {
      injections: await injectionsResp.json() as unknown[],
      usage: await usageResp.json() as unknown[],
    };
  }

  async getPeakFlow(params: DateRangeParams = {}): Promise<unknown[]> {
    return this.fetchDateRange('/api/phr/v1/myhealth/peak-flow-data-manager', params);
  }

  async getWaistCircumference(params: DateRangeParams = {}): Promise<unknown[]> {
    return this.fetchDateRange('/api/phr/v1/myhealth/extendable-data-manager/waist-circumference', params);
  }

  async getSymptomJournal(params: DateRangeParams = {}): Promise<unknown[]> {
    return this.fetchDateRange('/api/phr/v1/myhealth/extendable-data-manager/concern', params, 'AllData');
  }
}
