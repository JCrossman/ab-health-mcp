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

import { ensureSession, ensureMyChartSession, formatError, errorDetails, type ToolErrorDetails } from '../helpers/session-helpers.js';
import { MEDICAL_DISCLAIMER, formattingDirective } from './tool-factory.js';
import { isRecord } from '../api/response-helpers.js';
import { UpstreamContractError } from '../utils/errors.js';

const RECENT_LABS_MAX = 10;
const RECENT_IMMS_MAX = 10;

interface RawRecord {
  [key: string]: unknown;
}

function pick(obj: RawRecord, keys: readonly string[]): RawRecord {
  const out: RawRecord = {};
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return Object.keys(out).length ? out : obj;
}

function records(input: unknown, source: 'mhr' | 'mychart'): RawRecord[] {
  if (!Array.isArray(input) || !input.every(isRecord)) throw new UpstreamContractError(source);
  return input;
}

function pickNamedRecord(obj: RawRecord, keys: readonly string[]): RawRecord {
  const names = ['Name', 'name', 'displayName', 'brandName', 'genericName'];
  if (!names.some(key => typeof obj[key] === 'string' && obj[key] !== '')) return obj;
  return pick(obj, keys);
}

function shapeLabResults(input: unknown): unknown {
  return records(input, 'mhr').slice(0, RECENT_LABS_MAX).map(entry => ({
    date: entry.labResultDisplayDateText ?? entry.labResultDisplayDate,
    laboratory: entry.laboratoryName,
    orderedBy: entry.orderedByName,
    facility: entry.orderByType,
    groups: records(entry.group ?? [], 'mhr').map(g => ({
      name: g.groupName,
      status: g.labOrderStatus,
      tests: records(g.results ?? [], 'mhr').map(r => {
        if (r.values != null && !isRecord(r.values)) throw new UpstreamContractError('mhr');
        const values = r.values ?? {};
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
  return records(input, 'mhr').map(m => pickNamedRecord(m, [
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
  if (!isRecord(input)) throw new UpstreamContractError('mychart');
  const src = input;
  const list = Array.isArray(src.Allergies) ? src.Allergies : Array.isArray(src.allergies) ? src.allergies : [];
  if (!list.length) return src;
  return {
    allergies: records(list, 'mychart').map(a => pickNamedRecord(a, [
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
  if (!isRecord(input)) throw new UpstreamContractError('mychart');
  const src = input;
  const list = Array.isArray(src.HealthIssues) ? src.HealthIssues : Array.isArray(src.healthIssues) ? src.healthIssues : [];
  if (!list.length) return src;
  return {
    healthIssues: records(list, 'mychart').map(h => pickNamedRecord(h, [
      'Name', 'name',
      'Status', 'status',
      'OnsetDate', 'onsetDate',
      'DiagnosisDate', 'diagnosisDate',
      'NoteToPatient', 'noteToPatient',
    ])),
  };
}

function shapeImmunizations(input: unknown): unknown {
  if (!isRecord(input)) throw new UpstreamContractError('mychart');
  const src = input;
  const list = Array.isArray(src.Immunizations) ? src.Immunizations : Array.isArray(src.immunizations) ? src.immunizations : [];
  if (!list.length) return src;
  const slim = records(list, 'mychart').slice(0, RECENT_IMMS_MAX).map(i => pickNamedRecord(i, [
    'Name', 'name',
    'AdministrationDate', 'administrationDate', 'DateAdministered', 'dateAdministered',
    'Manufacturer', 'manufacturer',
    'DoseNumber', 'doseNumber',
  ]));
  return { immunizations: slim };
}

function shapeProfile(input: unknown): unknown {
  if (!isRecord(input)) throw new UpstreamContractError('mhr');
  return pick(input, ['name', 'displayName', 'selectedRecordId', 'defaultUserLanguage', 'authorizedRecords']);
}

export const getHealthOverviewTool = {
  name: 'get_health_overview',
  description: 'PREFER FOR BROAD HEALTH QUESTIONS. One call returns profile + medications + recent labs + allergies + health issues + immunizations from both MHR and MyChart. Use instead of chaining 4-6 single-tool calls.',
  handler: async () => {
    try {
      const mhr = ensureSession();
      const myChart = ensureMyChartSession();
      const sections = [
        ['profile', mhr.then(client => client.getUser()).then(shapeProfile)],
        ['medications_mhr', mhr.then(client => client.getMedications()).then(shapeMedications)],
        ['recent_lab_results', mhr.then(client => client.getLabResults({ dateRange: 'Last3Months' })).then(shapeLabResults)],
        ['allergies_mychart', myChart.then(client => client.getAllergies()).then(shapeAllergies)],
        ['health_issues_mychart', myChart.then(client => client.getHealthIssues()).then(shapeHealthIssues)],
        ['immunizations_mychart', myChart.then(client => client.getImmunizations()).then(shapeImmunizations)],
      ] as const;
      const outcomes = await Promise.allSettled(sections.map(([, promise]) => promise));
      const data: Record<string, unknown> = {};
      const errors: Record<string, ToolErrorDetails> = {};
      outcomes.forEach((outcome, index) => {
        const [name] = sections[index];
        data[name] = outcome.status === 'fulfilled' ? outcome.value : null;
        if (outcome.status === 'rejected') errors[name] = errorDetails(outcome.reason);
      });
      const failed = Object.keys(errors).length;
      const allFailed = failed === sections.length;
      const overview = {
        ...data,
        partial: failed > 0 && !allFailed,
        errors,
        ...(allFailed && { error: 'all_sources_unavailable', message: 'No overview sections could be loaded. This does not mean your records are empty.' }),
        sources: {
          mhr: ['profile', 'medications_mhr', 'recent_lab_results'].some(name => !Object.hasOwn(errors, name)),
          myChart: ['allergies_mychart', 'health_issues_mychart', 'immunizations_mychart'].some(name => !Object.hasOwn(errors, name)),
        },
        hint: 'For more detail on any section, use the specific tool (e.g., get_lab_results, mc_get_allergies). For attachments/PDFs in lab results, use download_attachment.',
        disclaimer: MEDICAL_DISCLAIMER,
      };

      return {
        ...(allFailed && { isError: true }),
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
