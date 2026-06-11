/**
 * MCP Tool: get_lab_results
 *
 * Returns lab test results from My Health Records with optional date filtering.
 * This is a passthrough — raw API data is formatted for Claude to interpret.
 */

import { ensureSession, formatError } from '../helpers/session-helpers.js';
import { MEDICAL_DISCLAIMER_SHORT, formattingDirective } from './tool-factory.js';
import type { LabResult } from '../types.js';

export const getLabResultsTool = {
  name: 'get_lab_results',
  description: 'Lab test results from MHR. Paginated (default 20/page); use offset for next page.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      date_range: {
        type: 'string',
        enum: ['All', 'LastWeek', 'LastMonth', 'Last3Months', 'Last6Months', 'LastYear'],
        description: 'Predefined date range filter. Defaults to All.',
      },
      start_date: {
        type: 'string',
        description: 'Custom start date in YYYY-MM-DD format. Overrides date_range.',
      },
      end_date: {
        type: 'string',
        description: 'Custom end date in YYYY-MM-DD format. Overrides date_range.',
      },
      test_name: {
        type: 'string',
        description: 'Filter results by test name (case-insensitive substring match).',
      },
      max_results: {
        type: 'number',
        description: 'Results per page (default 20).',
      },
      offset: {
        type: 'number',
        description: 'Number of results to skip for pagination (default 0). Use this to get the next page.',
      },
    },
  },
  handler: async (args: {
    date_range?: string;
    start_date?: string;
    end_date?: string;
    test_name?: string;
    max_results?: number;
    offset?: number;
  }) => {
    try {
      const client = await ensureSession();
      const results = await client.getLabResults({
        dateRange: args.date_range ?? 'All',
        startDate: args.start_date,
        endDate: args.end_date,
      });

      const formatted = formatLabResults(results, args.test_name, args.max_results ?? 20, args.offset ?? 0);

      return {
        content: [
          formattingDirective('table', ['Date', 'Test', 'Value', 'Unit', 'Reference Range', 'Status']),
          {
            type: 'text' as const,
            text: JSON.stringify({
              ...formatted,
              disclaimer: MEDICAL_DISCLAIMER_SHORT,
            }),
          },
        ],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: formatError(error),
        }],
        isError: true,
      };
    }
  },
};

function formatLabResults(results: LabResult[], testNameFilter?: string, maxResults: number = 20, offset: number = 0) {
  if (!Array.isArray(results)) return { totalResults: 0, results: [] };

  const formatted = results.map(entry => {
    const groups = (entry.group ?? []).map(g => {
      const tests = (g.results ?? []).map(r => {
        const value = r.values?.value ?? r.values?.displayValue ?? '';
        const display = r.values?.displayValue ?? '';
        const unit = r.values?.unitText ?? '';
        const range = r.values?.rangeDisplayText;
        const out: Record<string, unknown> = {
          name: r.name,
          value,
        };
        // Only include displayValue when it actually differs from value
        if (display && display !== String(value)) out.displayValue = display;
        if (unit) out.unit = unit;
        if (range) out.referenceRange = range;
        // Per-test status only when it differs from the parent group's status
        if (r.labOrderStatus && r.labOrderStatus !== g.labOrderStatus) {
          out.status = r.labOrderStatus;
        }
        // Per-test date repeats the panel date; only include when it differs
        if (r.displayDate && r.displayDate !== entry.labResultDisplayDate) {
          out.date = r.displayDate;
        }
        return out;
      });
      const attachments = (g.attachment ?? []).map(a => ({
        name: a.name,
        contentType: a.contentType,
        thing_id: entry.thingId,
        filename: a.name,
      }));
      const group: Record<string, unknown> = {
        name: g.groupName,
        status: g.labOrderStatus,
        tests,
      };
      if (attachments.length) group.attachments = attachments;
      return group;
    });
    return {
      date: entry.labResultDisplayDateText,
      laboratory: entry.laboratoryName,
      orderedBy: entry.orderedByName,
      facility: entry.orderByType,
      groups,
    };
  });

  // Client-side test name filter
  let filtered = formatted;
  if (testNameFilter) {
    const filter = testNameFilter.toLowerCase();
    filtered = formatted.filter(entry =>
      entry.groups.some(g =>
        (g.name as string).toLowerCase().includes(filter) ||
        (g.tests as Array<{ name: string }>).some(t => t.name.toLowerCase().includes(filter)),
      ),
    );
  }

  const totalMatching = filtered.length;
  const page = filtered.slice(offset, offset + maxResults);
  const hasMore = offset + maxResults < totalMatching;

  const hasAttachments = page.some(e => e.groups.some(g => 'attachments' in g));

  return {
    totalResults: totalMatching,
    showing: `${offset + 1}–${Math.min(offset + maxResults, totalMatching)} of ${totalMatching}`,
    ...(hasMore ? { nextOffset: offset + maxResults, note: `Call again with offset=${offset + maxResults} to see the next page.` } : {}),
    results: page,
    ...(hasAttachments ? { hint: 'Some results have PDF attachments. Use download_attachment with the thing_id and filename to view them.' } : {}),
  };
}
