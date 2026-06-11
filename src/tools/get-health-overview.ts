/**
 * MCP Tool: get_health_overview
 *
 * Composite tool that fetches a broad health snapshot from both MHR and MyChart
 * in parallel. Saves 4-6 sequential tool calls for questions like
 * "give me a complete health summary."
 *
 * Uses Promise.allSettled so partial failures don't block the whole response.
 *
 * Per-section shapers strip noise fields from the raw passthrough payloads
 * (versionStamp, clientId, clinicalCode, eduContent, customData, etc.) — these
 * fields are useful for downstream API plumbing but pure overhead for an LLM
 * trying to reason over a health snapshot. Without shaping the overview is
 * 20-27 KB; with shaping it's ~5-8 KB.
 */

import { ensureSession, ensureMyChartSession, formatError } from '../helpers/session-helpers.js';
import { MEDICAL_DISCLAIMER, formattingDirective } from './tool-factory.js';
import type { LabResult } from '../types.js';

const RECENT_LABS_MAX = 10;
const RECENT_IMMS_MAX = 10;

interface RawRecord {
  [key: string]: unknown;
}

function pick<T extends RawRecord>(obj: unknown, keys: ReadonlyArray<keyof T | string>): RawRecord {
  if (!obj || typeof obj !== 'object') return {};
  const src = obj as RawRecord;
  const out: RawRecord = {};
  for (const k of keys) {
    const v = src[k as string];
    if (v !== undefined && v !== null && v !== '') out[k as string] = v;
  }
  return out;
}

function shapeLabResults(input: unknown): unknown {
  if (!Array.isArray(input)) return [];
  return input.slice(0, RECENT_LABS_MAX).map((entry: RawRecord) => ({
    date: entry.labResultDisplayDateText ?? entry.labResultDisplayDate,
    laboratory: entry.laboratoryName,
    orderedBy: entry.orderedByName,
    facility: entry.orderByType,
    groups: (Array.isArray(entry.group) ? entry.group : []).map((g: RawRecord) => ({
      name: g.groupName,
      status: g.labOrderStatus,
      tests: (Array.isArray(g.results) ? g.results : []).map((r: RawRecord) => {
        const values = (r.values as RawRecord) ?? {};
        const value = values.value ?? values.displayValue ?? '';
        const display = values.displayValue ?? '';
        const out: RawRecord = {
          name: r.name,
          value,
          unit: values.unitText ?? '',
          range: values.rangeDisplayText,
          status: r.labOrderStatus,
        };
        // Only include displayValue if it differs from value
        if (display && display !== value) out.displayValue = display;
        // Drop empties
        if (!out.unit) delete out.unit;
        if (!out.range) delete out.range;
        if (!out.status) delete out.status;
        return out;
      }),
    })),
  }));
}

function shapeMedications(input: unknown): unknown {
  if (!Array.isArray(input)) return [];
  return input.map((m: RawRecord) => pick(m, [
    'name',
    'genericName',
    'brandName',
    'displayName',
    'strength',
    'dose',
    'dosage',
    'instructions',
    'directions',
    'status',
    'lastDispensed',
    'lastDispensedDate',
    'prescribedBy',
    'prescriber',
    'startDate',
    'endDate',
  ]));
}

function shapeAllergies(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  const src = input as RawRecord;
  const list = Array.isArray(src.Allergies) ? src.Allergies : Array.isArray(src.allergies) ? src.allergies : [];
  if (!list.length) return src;
  return {
    allergies: list.map((a: RawRecord) => pick(a, [
      'Name', 'name',
      'Severity', 'severity',
      'Reactions', 'reactions',
      'Type', 'type',
      'NoteToPatient', 'noteToPatient',
      'OnsetDate', 'onsetDate',
    ])),
  };
}

function shapeHealthIssues(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  const src = input as RawRecord;
  const list = Array.isArray(src.HealthIssues) ? src.HealthIssues : Array.isArray(src.healthIssues) ? src.healthIssues : [];
  if (!list.length) return src;
  return {
    healthIssues: list.map((h: RawRecord) => pick(h, [
      'Name', 'name',
      'Status', 'status',
      'OnsetDate', 'onsetDate',
      'DiagnosisDate', 'diagnosisDate',
      'NoteToPatient', 'noteToPatient',
    ])),
  };
}

function shapeImmunizations(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  const src = input as RawRecord;
  const list = Array.isArray(src.Immunizations) ? src.Immunizations : Array.isArray(src.immunizations) ? src.immunizations : [];
  if (!list.length) return src;
  const slim = list.slice(0, RECENT_IMMS_MAX).map((i: RawRecord) => pick(i, [
    'Name', 'name',
    'AdministrationDate', 'administrationDate', 'DateAdministered', 'dateAdministered',
    'Manufacturer', 'manufacturer',
    'DoseNumber', 'doseNumber',
  ]));
  return { immunizations: slim };
}

function shapeProfile(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  return pick(input, ['name', 'displayName', 'selectedRecordId', 'defaultUserLanguage', 'authorizedRecords']);
}

export const getHealthOverviewTool = {
  name: 'get_health_overview',
  description: 'PREFER FOR BROAD HEALTH QUESTIONS. One call returns profile + medications + recent labs + allergies + health issues + immunizations from both MHR and MyChart. Use instead of chaining 4-6 single-tool calls.',
  handler: async () => {
    try {
      // Establish both sessions (MyChart failure is non-fatal)
      const mhrClient = await ensureSession();
      let mcClient: Awaited<ReturnType<typeof ensureMyChartSession>> | null = null;
      try {
        mcClient = await ensureMyChartSession();
      } catch {
        // MyChart not available — continue with MHR only
      }

      // Fire all API calls in parallel
      const allergiesPromise = mcClient ? mcClient.getAllergies() : Promise.reject('MyChart not connected');
      const healthIssuesPromise = mcClient ? mcClient.getHealthIssues() : Promise.reject('MyChart not connected');
      const immunizationsPromise = mcClient ? mcClient.getImmunizations() : Promise.reject('MyChart not connected');

      const [profile, mhrMeds, labs, allergies, healthIssues, immunizations] =
        await Promise.allSettled([
          mhrClient.getUser(),
          mhrClient.getMedications(),
          mhrClient.getLabResults({
            dateRange: 'Last3Months',
            startDate: '',
            endDate: '',
          }),
          allergiesPromise,
          healthIssuesPromise,
          immunizationsPromise,
        ]);

      const extract = (result: PromiseSettledResult<unknown>) =>
        result.status === 'fulfilled' ? result.value : null;

      const overview = {
        profile: shapeProfile(extract(profile)),
        medications_mhr: shapeMedications(extract(mhrMeds)),
        recent_lab_results: shapeLabResults(extract(labs) as LabResult[] | null),
        allergies_mychart: shapeAllergies(extract(allergies)),
        health_issues_mychart: shapeHealthIssues(extract(healthIssues)),
        immunizations_mychart: shapeImmunizations(extract(immunizations)),
        sources: {
          mhr: true,
          myChart: mcClient !== null,
        },
        hint: 'For more detail on any section, use the specific tool (e.g., get_lab_results, mc_get_allergies). For attachments/PDFs in lab results, use download_attachment.',
        disclaimer: MEDICAL_DISCLAIMER,
      };

      return {
        content: [
          formattingDirective('summary_sections'),
          { type: 'text' as const, text: JSON.stringify(overview) },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: formatError(error) }],
        isError: true,
      };
    }
  },
};
