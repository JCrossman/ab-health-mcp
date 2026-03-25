/**
 * MCP Tool: get_lab_results
 *
 * Returns lab test results from My Health Records with optional date filtering.
 * This is a passthrough — raw API data is formatted for Claude to interpret.
 */

import { ensureSession, formatError } from '../helpers/session-helpers.js';
import { MEDICAL_DISCLAIMER } from './tool-factory.js';
import type { LabResult } from '../types.js';

export const getLabResultsTool = {
  name: 'get_lab_results',
  description: 'Get lab test results from your My Health Records account. Returns paginated results (default 20 per page). Use offset to get the next page of results.',
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
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ ...formatted, disclaimer: MEDICAL_DISCLAIMER }),
        }],
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

  const formatted = results.map(entry => ({
    date: entry.labResultDisplayDateText,
    laboratory: entry.laboratoryName,
    orderedBy: entry.orderedByName,
    facility: entry.orderByType,
    source: entry.source,
    thingId: entry.thingId,
    groups: (entry.group ?? []).map(g => ({
      name: g.groupName,
      status: g.labOrderStatus,
      tests: (g.results ?? []).map(r => ({
        name: r.name,
        value: r.values?.value ?? r.values?.displayValue ?? '',
        displayValue: r.values?.displayValue ?? '',
        unit: r.values?.unitText ?? '',
        referenceRange: r.values?.rangeDisplayText,
        status: r.labOrderStatus,
        date: r.displayDate,
      })),
      attachments: (g.attachment ?? []).map(a => ({
        name: a.name,
        contentType: a.contentType,
        thing_id: entry.thingId,
        filename: a.name,
      })),
    })),
  }));

  // Client-side test name filter
  let filtered = formatted;
  if (testNameFilter) {
    const filter = testNameFilter.toLowerCase();
    filtered = formatted.filter(entry =>
      entry.groups.some(g =>
        g.name.toLowerCase().includes(filter) ||
        g.tests.some(t => t.name.toLowerCase().includes(filter)),
      ),
    );
  }

  const totalMatching = filtered.length;
  const page = filtered.slice(offset, offset + maxResults);
  const hasMore = offset + maxResults < totalMatching;

  const hasAttachments = page.some(e => e.groups.some(g => g.attachments.length > 0));

  return {
    totalResults: totalMatching,
    showing: `${offset + 1}–${Math.min(offset + maxResults, totalMatching)} of ${totalMatching}`,
    ...(hasMore ? { nextOffset: offset + maxResults, note: `Call again with offset=${offset + maxResults} to see the next page.` } : {}),
    results: page,
    ...(hasAttachments ? { hint: 'Some results have PDF attachments. Use download_attachment with the thing_id and filename from the attachment metadata to view them.' } : {}),
  };
}
