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

export class MHRClient {
  constructor(private cookieJar: CookieJar) {}

  private async fetch(path: string, extraHeaders: Record<string, string> = {}): Promise<Response> {
    const response = await this.rawFetch(path, extraHeaders);

    if (response.status === 401 || response.status === 403) {
      // Session may be stale — try a keepalive ping then retry once
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        await this.rawFetch(
          `/api/phr/v1/session?SessionMode=Patient&IsKeypressed=true&KeyPressedUnixTimeStamp=${timestamp}`,
        );
      } catch {
        // Keepalive failed — session is truly expired
        throw new SessionExpiredError();
      }

      const retry = await this.rawFetch(path, extraHeaders);
      if (retry.status === 401 || retry.status === 403) {
        throw new SessionExpiredError();
      }
      if (retry.status >= 500) {
        throw new ApiError(retry.status);
      }
      return retry;
    }

    if (response.status >= 500) {
      throw new ApiError(response.status);
    }

    return response;
  }

  /** Low-level fetch with no error handling — used by fetch() for retry logic. */
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

  /**
   * Download a PDF or file attachment from a lab result or imaging report.
   * Returns the raw binary data as a Buffer.
   */
  async downloadAttachment(thingId: string, filename: string): Promise<{ buffer: Buffer; contentType: string }> {
    const response = await this.fetch(
      `/api/phr/v1/attachment/${encodeURIComponent(thingId)}/download?bName=${encodeURIComponent(filename)}`,
      { 'Accept': '*/*' },
    );
    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('Content-Type') ?? 'application/pdf';
    return { buffer: Buffer.from(arrayBuffer), contentType };
  }

  /**
   * Check session status and keep alive.
   */
  async getSessionStatus(): Promise<SessionStatus> {
    const timestamp = Math.floor(Date.now() / 1000);
    const response = await this.fetch(
      `/api/phr/v1/session?SessionMode=Patient&IsKeypressed=true&KeyPressedUnixTimeStamp=${timestamp}`,
    );
    return response.json() as Promise<SessionStatus>;
  }

  /**
   * Get the authenticated user's profile.
   */
  async getUser(): Promise<UserProfile> {
    const response = await this.fetch('/api/phr/v1/user');
    return response.json() as Promise<UserProfile>;
  }

  /**
   * Get lab test results with optional date filtering.
   */
  async getLabResults(params: LabResultParams = {}): Promise<LabResult[]> {
    const { dateRange = 'All', startDate, endDate } = params;

    const queryParams = new URLSearchParams({
      startDate: startDate ? toApiDateFormat(startDate) : DEFAULT_START_DATE,
      endDate: endDate ? toApiDateFormat(endDate) : DEFAULT_END_DATE,
      dateRangeOptions: dateRange,
      labConfiguration: '00000000-0000-0000-0000-000000000000',
      showOtherSection: 'True',
      ignoreConfig: 'True',
    });

    const response = await this.fetch(
      `/api/phr/v1/labresult/getData?${queryParams}`,
    );
    return response.json() as Promise<LabResult[]>;
  }

  /**
   * Get diagnostic imaging results (X-rays, ultrasounds, echocardiograms, etc.)
   * Same endpoint as lab results (previously distinguished by Control-Mapping-Id).
   */
  async getDiagnosticImaging(params: { dateRange?: string; startDate?: string; endDate?: string } = {}): Promise<unknown[]> {
    const { dateRange = 'All', startDate, endDate } = params;
    const queryParams = new URLSearchParams({
      startDate: startDate ? toApiDateFormat(startDate) : DEFAULT_START_DATE,
      endDate: endDate ? toApiDateFormat(endDate) : DEFAULT_END_DATE,
      dateRangeOptions: dateRange,
      labConfiguration: '00000000-0000-0000-0000-000000000000',
      showOtherSection: 'True',
      ignoreConfig: 'True',
    });
    const response = await this.fetch(
      `/api/phr/v1/labresult/getData?${queryParams}`,
    );
    return response.json() as Promise<unknown[]>;
  }

  /**
   * Get immunization records with optional date filtering.
   */
  async getImmunizations(params: { dateRange?: string; startDate?: string; endDate?: string } = {}): Promise<ImmunizationRecord[]> {
    const { dateRange = 'All', startDate, endDate } = params;

    const queryParams = new URLSearchParams({
      startDate: startDate ? toApiDateFormat(startDate) : DEFAULT_START_DATE,
      endDate: endDate ? toApiDateFormat(endDate) : DEFAULT_END_DATE,
      dateRangeOptions: dateRange,
    });

    const response = await this.fetch(
      `/api/phr/v1/myhealth/immunization-data-manager?${queryParams}`,
    );
    return response.json() as Promise<ImmunizationRecord[]>;
  }

  /**
   * Get medication records.
   */
  async getMedications(): Promise<unknown[]> {
    const response = await this.fetch(
      '/api/phr/v1/medication?startIndex=-1&endIndex=-1&type=all&status=Medication&includeOrphanRefills=false',
      { 'Control-Mapping-Id': '8050' },
    );
    return response.json() as Promise<unknown[]>;
  }

  /**
   * Get referral records with optional date filtering.
   */
  async getReferrals(params: { dateRange?: string; startDate?: string; endDate?: string } = {}): Promise<unknown[]> {
    const { dateRange = 'AllData', startDate, endDate } = params;
    const queryParams = new URLSearchParams({
      startDate: startDate ? toApiDateFormat(startDate) : DEFAULT_START_DATE,
      endDate: endDate ? toApiDateFormat(endDate) : DEFAULT_END_DATE,
      dateRangeOptions: dateRange,
    });
    const response = await this.fetch(`/api/phr/v1/referral?${queryParams}`);
    return response.json() as Promise<unknown[]>;
  }

  /**
   * Get vital signs data (pulse, respiratory rate, temperature)
   */
  async getVitalSigns(params: { dateRange?: string; startDate?: string; endDate?: string }  = {}): Promise<unknown[]> {
    const { dateRange = 'All', startDate, endDate } = params;
    const queryParams = new URLSearchParams({
      startDate: startDate ? toApiDateFormat(startDate) : DEFAULT_START_DATE,
      endDate: endDate ? toApiDateFormat(endDate) : DEFAULT_END_DATE,
      dateRangeOptions: dateRange,
      types: 'Pls,Res,Tmp',
    });
    const response = await this.fetch(`/api/phr/v1/VitalSigns?${queryParams}`);
    return response.json() as Promise<unknown[]>;
  }

  /**
   * Get blood oxygen saturation records.
   */
  async getBloodOxygen(params: { dateRange?: string; startDate?: string; endDate?: string } = {}): Promise<unknown[]> {
    const { dateRange = 'All', startDate, endDate } = params;
    const queryParams = new URLSearchParams({
      startDate: startDate ? toApiDateFormat(startDate) : DEFAULT_START_DATE,
      endDate: endDate ? toApiDateFormat(endDate) : DEFAULT_END_DATE,
      dateRangeOptions: dateRange,
    });
    const response = await this.fetch(`/api/phr/v1/myhealth/blood-oxygensaturation-data-manager?${queryParams}`);
    return response.json() as Promise<unknown[]>;
  }

  /**
   * Get blood pressure records.
   */
  async getBloodPressure(params: { dateRange?: string; startDate?: string; endDate?: string } = {}): Promise<unknown[]> {
    const { dateRange = 'All', startDate, endDate } = params;
    const queryParams = new URLSearchParams({
      startDate: startDate ? toApiDateFormat(startDate) : DEFAULT_START_DATE,
      endDate: endDate ? toApiDateFormat(endDate) : DEFAULT_END_DATE,
      dateRangeOptions: dateRange,
    });
    const response = await this.fetch(`/api/phr/v1/myhealth/blood-pressure-data-manager?${queryParams}`);
    return response.json() as Promise<unknown[]>;
  }

  /**
   * Get height and weight measurements.
   */
  async getHeightWeight(params: { dateRange?: string; startDate?: string; endDate?: string } = {}): Promise<{ height: unknown[]; weight: unknown[]; bmi: unknown[] }> {
    const { dateRange = 'All', startDate, endDate } = params;
    const queryParams = new URLSearchParams({
      startDate: startDate ? toApiDateFormat(startDate) : DEFAULT_START_DATE,
      endDate: endDate ? toApiDateFormat(endDate) : DEFAULT_END_DATE,
      dateRangeOptions: dateRange,
    });
    const [heightResp, weightResp, bmiResp] = await Promise.all([
      this.fetch(`/api/phr/v1/myhealth/height-data-manager?${queryParams}`),
      this.fetch(`/api/phr/v1/myhealth/weight-data-manager?${queryParams}`),
      this.fetch(`/api/phr/v1/bmi?${queryParams}`),
    ]);
    return {
      height: await heightResp.json() as unknown[],
      weight: await weightResp.json() as unknown[],
      bmi: await bmiResp.json() as unknown[],
    };
  }

  /**
   * Get exercise records.
   */
  async getExercise(params: { dateRange?: string; startDate?: string; endDate?: string } = {}): Promise<unknown[]> {
    const { dateRange = 'All', startDate, endDate } = params;
    const queryParams = new URLSearchParams({
      startDate: startDate ? toApiDateFormat(startDate) : DEFAULT_START_DATE,
      endDate: endDate ? toApiDateFormat(endDate) : DEFAULT_END_DATE,
      dateRangeOptions: dateRange,
    });
    const response = await this.fetch(`/api/phr/v1/exercise?${queryParams}`);
    return response.json() as Promise<unknown[]>;
  }

  /**
   * Get medical procedure records.
   */
  async getProcedures(params: { dateRange?: string; startDate?: string; endDate?: string } = {}): Promise<unknown[]> {
    const { dateRange = 'All', startDate, endDate } = params;
    const queryParams = new URLSearchParams({
      startDate: startDate ? toApiDateFormat(startDate) : DEFAULT_START_DATE,
      endDate: endDate ? toApiDateFormat(endDate) : DEFAULT_END_DATE,
      dateRangeOptions: dateRange,
    });
    const response = await this.fetch(`/api/phr/v1/procedure?${queryParams}`);
    return response.json() as Promise<unknown[]>;
  }

  /**
   * Get blood glucose monitoring records.
   */
  async getBloodGlucose(params: { dateRange?: string; startDate?: string; endDate?: string } = {}): Promise<unknown[]> {
    const { dateRange = 'All', startDate, endDate } = params;
    const queryParams = new URLSearchParams({
      startDate: startDate ? toApiDateFormat(startDate) : DEFAULT_START_DATE,
      endDate: endDate ? toApiDateFormat(endDate) : DEFAULT_END_DATE,
      dateRangeOptions: dateRange,
    });
    const response = await this.fetch(`/api/phr/v1/myhealth/blood-glucose-data-manager?${queryParams}`);
    return response.json() as Promise<unknown[]>;
  }

  /**
   * Get sleep session records.
   */
  async getSleep(params: { dateRange?: string; startDate?: string; endDate?: string } = {}): Promise<unknown[]> {
    const { dateRange = 'All', startDate, endDate } = params;
    const queryParams = new URLSearchParams({
      startDate: startDate ? toApiDateFormat(startDate) : DEFAULT_START_DATE,
      endDate: endDate ? toApiDateFormat(endDate) : DEFAULT_END_DATE,
      dateRangeOptions: dateRange,
    });
    const response = await this.fetch(`/api/phr/v1/myhealth/sleep-session-data-manager-v2?${queryParams}`);
    return response.json() as Promise<unknown[]>;
  }

  /**
   * Get dietary intake records.
   */
  async getDietaryIntake(params: { dateRange?: string; startDate?: string; endDate?: string } = {}): Promise<unknown[]> {
    const { dateRange = 'All', startDate, endDate } = params;
    const queryParams = new URLSearchParams({
      startDate: startDate ? toApiDateFormat(startDate) : DEFAULT_START_DATE,
      endDate: endDate ? toApiDateFormat(endDate) : DEFAULT_END_DATE,
      dateRangeOptions: dateRange,
    });
    const response = await this.fetch(`/api/phr/v1/myhealth/dietary-intake-data-manager?${queryParams}`);
    return response.json() as Promise<unknown[]>;
  }

  /**
   * Get insulin injection records.
   */
  async getInsulin(params: { dateRange?: string; startDate?: string; endDate?: string } = {}): Promise<{ injections: unknown[]; usage: unknown[] }> {
    const { dateRange = 'All', startDate, endDate } = params;
    const queryParams = new URLSearchParams({
      startDate: startDate ? toApiDateFormat(startDate) : DEFAULT_START_DATE,
      endDate: endDate ? toApiDateFormat(endDate) : DEFAULT_END_DATE,
      dateRangeOptions: dateRange,
    });
    const [injectionsResp, usageResp] = await Promise.all([
      this.fetch(`/api/phr/v1/myhealth/insulin-injection-data-manager?${queryParams}`),
      this.fetch(`/api/phr/v1/myhealth/insulin-injection-use-data-manager?${queryParams}`),
    ]);
    return {
      injections: await injectionsResp.json() as unknown[],
      usage: await usageResp.json() as unknown[],
    };
  }

  /**
   * Get peak flow (asthma) records.
   */
  async getPeakFlow(params: { dateRange?: string; startDate?: string; endDate?: string } = {}): Promise<unknown[]> {
    const { dateRange = 'All', startDate, endDate } = params;
    const queryParams = new URLSearchParams({
      startDate: startDate ? toApiDateFormat(startDate) : DEFAULT_START_DATE,
      endDate: endDate ? toApiDateFormat(endDate) : DEFAULT_END_DATE,
      dateRangeOptions: dateRange,
    });
    const response = await this.fetch(`/api/phr/v1/myhealth/peak-flow-data-manager?${queryParams}`);
    return response.json() as Promise<unknown[]>;
  }

  /**
   * Get waist circumference measurements.
   */
  async getWaistCircumference(params: { dateRange?: string; startDate?: string; endDate?: string } = {}): Promise<unknown[]> {
    const { dateRange = 'All', startDate, endDate } = params;
    const queryParams = new URLSearchParams({
      startDate: startDate ? toApiDateFormat(startDate) : DEFAULT_START_DATE,
      endDate: endDate ? toApiDateFormat(endDate) : DEFAULT_END_DATE,
      dateRangeOptions: dateRange,
    });
    const response = await this.fetch(`/api/phr/v1/myhealth/extendable-data-manager/waist-circumference?${queryParams}`);
    return response.json() as Promise<unknown[]>;
  }

  /**
   * Get symptom journal entries.
   */
  async getSymptomJournal(params: { dateRange?: string; startDate?: string; endDate?: string } = {}): Promise<unknown[]> {
    const { dateRange = 'AllData', startDate, endDate } = params;
    const queryParams = new URLSearchParams({
      startDate: startDate ? toApiDateFormat(startDate) : DEFAULT_START_DATE,
      endDate: endDate ? toApiDateFormat(endDate) : DEFAULT_END_DATE,
      dateRangeOptions: dateRange,
    });
    const response = await this.fetch(`/api/phr/v1/myhealth/extendable-data-manager/concern?${queryParams}`);
    return response.json() as Promise<unknown[]>;
  }
}
