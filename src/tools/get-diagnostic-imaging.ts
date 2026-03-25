/**
 * MCP Tool: get_diagnostic_imaging
 *
 * Returns diagnostic imaging results (X-rays, ultrasounds, echocardiograms, etc.)
 * from My Health Records. These are separate from lab results and use a different
 * Control-Mapping-Id (7712 vs 7736).
 *
 * API: GET /api/phr/v1/labresult/getData (same endpoint, different CMID)
 * Control-Mapping-Id: 7712
 */

import { ensureSession, formatError } from '../helpers/session-helpers.js';
import { MEDICAL_DISCLAIMER } from './tool-factory.js';

export const getDiagnosticImagingTool = {
  name: 'get_diagnostic_imaging',
  description: 'Get diagnostic imaging results from your My Health Records — includes X-rays, ultrasounds, echocardiograms, CT scans, and MRIs. May include downloadable PDF reports.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      date_range: {
        type: 'string',
        enum: ['All', 'LastWeek', 'LastMonth', 'Last3Months', 'Last6Months', 'LastYear'],
        description: 'Date range filter. Defaults to All.',
      },
    },
  },
  handler: async (args: { date_range?: string }) => {
    try {
      const client = await ensureSession();
      const data = await client.getDiagnosticImaging({ dateRange: args.date_range ?? 'All' });

      const formatted = formatImagingResults(data);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ ...formatted, disclaimer: MEDICAL_DISCLAIMER }),
        }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: formatError(error) }],
        isError: true,
      };
    }
  },
};

function formatImagingResults(results: unknown[]) {
  if (!Array.isArray(results)) return { totalResults: 0, results: [] };

  const formatted = results.map((entry: any) => ({
    date: entry.labResultDisplayDateText,
    laboratory: entry.laboratoryName,
    orderedBy: entry.orderedByName,
    facility: entry.orderByType,
    source: entry.source,
    thingId: entry.thingId ?? entry.itemKey?.thingId,
    groups: (entry.group ?? []).map((g: any) => ({
      name: g.groupName,
      status: g.labOrderStatus,
      results: (g.results ?? []).map((r: any) => ({
        name: r.name,
        displayValue: r.values?.displayValue ?? '',
        status: r.labOrderStatus,
        date: r.displayDate,
      })),
      attachments: (g.attachment ?? []).map((a: any) => ({
        name: a.name,
        contentType: a.contentType,
        downloadUrl: a.downloadUrl,
      })),
    })),
  }));

  return { totalResults: formatted.length, results: formatted };
}
