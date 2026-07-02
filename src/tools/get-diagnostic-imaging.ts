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
import { MEDICAL_DISCLAIMER_SHORT, formattingDirective } from './tool-factory.js';

export const getDiagnosticImagingTool = {
  name: 'get_diagnostic_imaging',
  description: 'Imaging results from MHR — X-rays, ultrasounds, echos, CT, MRI. May include PDF reports as attachments.',
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
        content: [
          formattingDirective('table', ['Date', 'Study', 'Facility', 'Status', 'Attachments']),
          {
            type: 'text' as const,
            text: JSON.stringify({ ...formatted, disclaimer: MEDICAL_DISCLAIMER_SHORT }),
          },
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

function formatImagingResults(results: unknown[]) {
  if (!Array.isArray(results)) return { totalResults: 0, results: [] };

  const formatted = results.map((entry: any) => {
    const top: Record<string, unknown> = {
      date: entry.labResultDisplayDateText,
      laboratory: entry.laboratoryName,
      orderedBy: entry.orderedByName,
      facility: entry.orderByType,
    };
    const tid = entry.thingId ?? entry.itemKey?.thingId;
    if (tid) top.thingId = tid;
    top.groups = (entry.group ?? []).map((g: any) => {
      const groupOut: Record<string, unknown> = {
        name: g.groupName,
        status: g.labOrderStatus,
      };
      groupOut.results = (g.results ?? []).map((r: any) => {
        const ro: Record<string, unknown> = { name: r.name };
        if (r.values?.displayValue) ro.displayValue = r.values.displayValue;
        if (r.labOrderStatus && r.labOrderStatus !== g.labOrderStatus) ro.status = r.labOrderStatus;
        if (r.displayDate && r.displayDate !== entry.labResultDisplayDate) ro.date = r.displayDate;
        return ro;
      });
      const attachments = (g.attachment ?? []).map((a: any) => ({
        name: a.name,
        contentType: a.contentType,
      }));
      if (attachments.length) groupOut.attachments = attachments;
      return groupOut;
    });
    return top;
  });

  return { totalResults: formatted.length, results: formatted };
}
