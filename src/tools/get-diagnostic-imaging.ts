/**
 * MCP Tool: get_diagnostic_imaging
 *
 * Returns diagnostic imaging results (X-rays, ultrasounds, echocardiograms, etc.)
 * from My Health Records. These are separate from lab results and use a different
 * control mapping discovered from the portal configuration.
 */

import { ensureSession, formatError } from '../helpers/session-helpers.js';
import { UpstreamContractError } from '../utils/errors.js';
import { MEDICAL_DISCLAIMER_SHORT, formattingDirective } from './tool-factory.js';
import type { LabResult } from '../types.js';
import { isRecord } from '../api/response-helpers.js';

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
      max_results: { type: 'number', description: 'Results per page (default 50).' },
      offset: { type: 'number', description: 'Number of results to skip (default 0).' },
    },
  },
  handler: async (args: { date_range?: string; max_results?: number; offset?: number }) => {
    try {
      const client = await ensureSession();
      const data = await client.getDiagnosticImaging({ dateRange: args.date_range ?? 'All' });

      const formatted = formatImagingResults(data, args.max_results ?? 50, args.offset ?? 0);
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

function formatImagingResults(results: LabResult[], maxResults: number, offset: number) {
  if (!Array.isArray(results)) throw new UpstreamContractError('mhr');

  const formatted = results.slice(offset, offset + maxResults).map(entry => {
    const top: Record<string, unknown> = {
      date: entry.labResultDisplayDateText,
      laboratory: entry.laboratoryName,
      orderedBy: entry.orderedByName,
      facility: entry.orderByType,
    };
    const itemKey = 'itemKey' in entry && isRecord(entry.itemKey) ? entry.itemKey : undefined;
    const tid = entry.thingId ?? itemKey?.thingId;
    if (tid) top.thingId = tid;
    top.groups = (entry.group ?? []).map(g => {
      const groupOut: Record<string, unknown> = {
        name: g.groupName,
        status: g.labOrderStatus,
      };
      groupOut.results = (g.results ?? []).map(r => {
        const ro: Record<string, unknown> = { name: r.name };
        if (r.values?.displayValue) ro.displayValue = r.values.displayValue;
        if (r.labOrderStatus && r.labOrderStatus !== g.labOrderStatus) ro.status = r.labOrderStatus;
        if (r.displayDate && r.displayDate !== entry.labResultDisplayDate) ro.date = r.displayDate;
        return ro;
      });
      const attachments = (g.attachment ?? []).map(a => ({
        name: a.name,
        contentType: a.contentType,
      }));
      if (attachments.length) groupOut.attachments = attachments;
      return groupOut;
    });
    return top;
  });

  return {
    totalResults: results.length,
    ...(offset + maxResults < results.length ? { nextOffset: offset + maxResults } : {}),
    results: formatted,
  };
}
