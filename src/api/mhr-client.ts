/**
 * My Health Records REST API client.
 *
 * Wraps all confirmed API endpoints with cookie-based authentication.
 * This is a pure passthrough — no health data interpretation or caching.
 */

import { CookieJar } from 'tough-cookie';
import { SessionExpiredError, ApiError, NetworkError, UpstreamContractError } from '../utils/errors.js';
import { toApiDateFormat, DEFAULT_START_DATE, DEFAULT_END_DATE } from '../utils/formatters.js';
import type { UserProfile, SessionStatus, LabResult, LabResultParams, ImmunizationRecord } from '../types.js';
import { resolveMhrMapping, type MhrView } from './mhr-config.js';
import { isRecord, readCompleteList, readJsonResponse, storeResponseCookies } from './response-helpers.js';

const MHR_BASE = 'https://myhealthrecords.alberta.ca';

type DateRangeParams = { dateRange?: string; startDate?: string; endDate?: string };

function isUserProfile(value: unknown): value is UserProfile {
  return isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.personId === 'string' &&
    typeof value.selectedRecordId === 'string' && value.selectedRecordId.length > 0 &&
    typeof value.defaultUserLanguage === 'string' &&
    typeof value.createdDateTimeUtc === 'string' &&
    typeof value.isEmergencyAccessMode === 'boolean' &&
    Array.isArray(value.authorizedRecords) &&
    value.authorizedRecords.every(record => isRecord(record) &&
      typeof record.id === 'string' && typeof record.name === 'string' &&
      typeof record.displayName === 'string' && typeof record.relationshipType === 'string' &&
      typeof record.isCustodian === 'boolean' && typeof record.patientInfo === 'string') &&
    value.authorizedRecords.some(record => record.id === value.selectedRecordId);
}

function isLabResult(value: unknown): value is LabResult {
  const optionalText = (field: unknown) => field == null || typeof field === 'string';
  return isRecord(value) &&
    typeof value.labResultDisplayDateText === 'string' &&
    typeof value.labResultDisplayDate === 'string' &&
    optionalText(value.laboratoryName) &&
    optionalText(value.orderedByName) &&
    optionalText(value.orderByType) &&
    optionalText(value.thingId) &&
    (value.itemKey == null || (isRecord(value.itemKey) && optionalText(value.itemKey.thingId))) &&
    Object.hasOwn(value, 'group') &&
    (value.group === null || (Array.isArray(value.group) &&
      value.group.every(group => isRecord(group) &&
        typeof group.groupName === 'string' &&
        optionalText(group.labOrderStatus) &&
        (group.attachment == null || (Array.isArray(group.attachment) &&
          group.attachment.every(attachment => isRecord(attachment) &&
            typeof attachment.name === 'string' &&
            typeof attachment.contentType === 'string'))) &&
        (group.results == null || (Array.isArray(group.results) &&
          group.results.every(result => isRecord(result) && typeof result.name === 'string' &&
            optionalText(result.labOrderStatus) &&
            optionalText(result.displayDate) &&
            (result.values == null || (isRecord(result.values) &&
              optionalText(result.values.value) &&
              optionalText(result.values.displayValue) &&
              optionalText(result.values.unitText) &&
              optionalText(result.values.rangeDisplayText)))))))));
}

export class MHRClient {
  private configuration?: Promise<unknown>;

  constructor(private cookieJar: CookieJar, private validateSession?: () => Promise<void>) {}

  private async json(response: Response): Promise<unknown> {
    const data = await readJsonResponse(response, 'mhr');
    await this.validateSession?.();
    return data;
  }

  private async fetch(path: string, extraHeaders: Record<string, string> = {}, signal?: AbortSignal): Promise<Response> {
    const response = await this.rawFetch(path, extraHeaders, signal);

    if (response.status === 401 || response.status === 403) {
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        await this.rawFetch(
          `/api/phr/v1/session?SessionMode=Patient&IsKeypressed=true&KeyPressedUnixTimeStamp=${timestamp}`,
          {},
          signal,
        );
      } catch {
        throw new SessionExpiredError();
      }

      const retry = await this.rawFetch(path, extraHeaders, signal);
      if (retry.status === 401 || retry.status === 403) throw new SessionExpiredError();
      if (!retry.ok) throw new ApiError(retry.status);
      return retry;
    }

    if (!response.ok) throw new ApiError(response.status);
    return response;
  }

  private async rawFetch(path: string, extraHeaders: Record<string, string> = {}, signal?: AbortSignal): Promise<Response> {
    await this.validateSession?.();
    const url = `${MHR_BASE}${path}`;
    const cookies = await this.cookieJar.getCookieString(url);

    let response: Response;
    try {
      response = await fetch(url, {
        signal,
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
    await storeResponseCookies(this.cookieJar, response, url);
    await this.validateSession?.();
    return response;
  }

  private async mappingHeaders(view: MhrView): Promise<Record<string, string>> {
    if (!this.configuration) {
      this.configuration = this.fetch('/api/cms/v1/pages/root/browser', {}, AbortSignal.timeout(30_000))
        .then(response => this.json(response))
        .catch(error => {
          this.configuration = undefined;
          throw error;
        });
    }
    const mapping = resolveMhrMapping(await this.configuration, view);
    return { 'Control-Mapping-Id': String(mapping) };
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
    return readCompleteList(await this.json(response), 'mhr');
  }

  async downloadAttachment(thingId: string, filename: string): Promise<{ buffer: Buffer; contentType: string }> {
    const response = await this.fetch(
      `/api/phr/v1/attachment/${encodeURIComponent(thingId)}/download?bName=${encodeURIComponent(filename)}`,
      { 'Accept': '*/*' },
    );
    const arrayBuffer = await response.arrayBuffer();
    await this.validateSession?.();
    const contentType = response.headers.get('Content-Type') ?? 'application/pdf';
    return { buffer: Buffer.from(arrayBuffer), contentType };
  }

  async getSessionStatus(): Promise<SessionStatus> {
    const timestamp = Math.floor(Date.now() / 1000);
    const response = await this.fetch(
      `/api/phr/v1/session?SessionMode=Patient&IsKeypressed=true&KeyPressedUnixTimeStamp=${timestamp}`,
    );
    const status = await this.json(response);
    if (!isRecord(status) || typeof status.isSessionExpired !== 'boolean' ||
      typeof status.numberOfMilliSecondsLeftForSessionExpire !== 'number' ||
      !Number.isFinite(status.numberOfMilliSecondsLeftForSessionExpire)) {
      throw new UpstreamContractError('mhr');
    }
    if (status.isSessionExpired || status.numberOfMilliSecondsLeftForSessionExpire <= 0) throw new SessionExpiredError();
    return {
      isSessionExpired: status.isSessionExpired,
      numberOfMilliSecondsLeftForSessionExpire: status.numberOfMilliSecondsLeftForSessionExpire,
    };
  }

  async getUser(): Promise<UserProfile> {
    const response = await this.fetch('/api/phr/v1/user');
    const user = await this.json(response);
    if (!isUserProfile(user)) throw new UpstreamContractError('mhr');
    return user;
  }

  private static readonly LAB_EXTRA = { labConfiguration: '00000000-0000-0000-0000-000000000000', showOtherSection: 'True', ignoreConfig: 'True' };

  async getLabResults(params: LabResultParams = {}): Promise<LabResult[]> {
    return this.fetchLabs('labs', params);
  }

  async getDiagnosticImaging(params: DateRangeParams = {}): Promise<LabResult[]> {
    return this.fetchLabs('imaging', params);
  }

  private async fetchLabs(view: 'labs' | 'imaging', params: DateRangeParams): Promise<LabResult[]> {
    const headers = await this.mappingHeaders(view);
    const qs = this.dateRangeQuery(params, 'All', { ...MHRClient.LAB_EXTRA, startIndex: '-1', endIndex: '-1' });
    if (params.startDate || params.endDate) {
      qs.set('dateRangeOptions', 'Custom');
    } else if (params.dateRange && !['All', 'AllData'].includes(params.dateRange)) {
      qs.delete('startDate');
      qs.delete('endDate');
    }
    const response = await this.fetch(`/api/phr/v1/labresult/getData?${qs}`, headers);
    const results = readCompleteList(await this.json(response), 'mhr');
    if (!results.every(isLabResult)) throw new UpstreamContractError('mhr');
    return results;
  }

  async getImmunizations(params: DateRangeParams = {}): Promise<ImmunizationRecord[]> {
    return this.fetchDateRange('/api/phr/v1/myhealth/immunization-data-manager', params) as Promise<ImmunizationRecord[]>;
  }

  async getMedications(): Promise<unknown[]> {
    const response = await this.fetch(
      '/api/phr/v1/medication?startIndex=-1&endIndex=-1&type=all&status=Medication&includeOrphanRefills=false',
      await this.mappingHeaders('medications'),
    );
    const medications = readCompleteList(await this.json(response), 'mhr');
    if (!medications.every(isRecord)) throw new UpstreamContractError('mhr');
    return medications;
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
      height: await this.json(heightResp) as unknown[],
      weight: await this.json(weightResp) as unknown[],
      bmi: await this.json(bmiResp) as unknown[],
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
      injections: await this.json(injectionsResp) as unknown[],
      usage: await this.json(usageResp) as unknown[],
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
