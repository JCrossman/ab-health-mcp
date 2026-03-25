/**
 * Factory functions for creating simple passthrough MCP tools.
 *
 * Most tools follow the same pattern: validate session → call API → return JSON.
 * These factories eliminate the boilerplate for tools that don't need custom logic.
 *
 * All list-returning tools cap results at MAX_RESULTS (default 50) to prevent
 * oversized responses that cause Claude to fail with "response could not be generated".
 */

import { ensureSession, ensureMyChartSession, formatError } from '../helpers/session-helpers.js';
import type { MHRClient } from '../api/mhr-client.js';
import type { MyChartClient } from '../api/mychart-client.js';

export const MEDICAL_DISCLAIMER = 'IMPORTANT: This is your health record data for informational purposes only — it is NOT medical advice. Always consult your doctor or healthcare provider to interpret results and make health decisions.';

const DEFAULT_MAX_RESULTS = 50;

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

function truncateResults(data: unknown, resultKey: string, maxResults: number, offset: number = 0) {
  if (!Array.isArray(data)) {
    return { totalRecords: 0, [resultKey]: data };
  }
  const total = data.length;
  const page = data.slice(offset, offset + maxResults);
  const hasMore = offset + maxResults < total;
  return {
    totalRecords: total,
    showing: `${offset + 1}–${Math.min(offset + maxResults, total)} of ${total}`,
    ...(hasMore ? { nextOffset: offset + maxResults, note: `Call again with offset=${offset + maxResults} to see the next page.` } : {}),
    [resultKey]: page,
  };
}

/** Simple MyChart tool — no params, calls one client method, returns JSON. */
export function simpleMyChartTool(
  name: string,
  description: string,
  method: (client: MyChartClient) => Promise<unknown>,
) {
  return {
    name,
    description,
    handler: async (): Promise<ToolResult> => {
      try {
        const client = await ensureMyChartSession();
        const data = await method(client);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ ...data as object, disclaimer: MEDICAL_DISCLAIMER }) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: formatError(error) }], isError: true };
      }
    },
  };
}

/** Simple MHR tool — no params, calls one client method, returns JSON. */
export function simpleMhrTool(
  name: string,
  description: string,
  method: (client: MHRClient) => Promise<unknown>,
  resultKey: string,
) {
  return {
    name,
    description,
    handler: async (args: { max_results?: number; offset?: number }): Promise<ToolResult> => {
      try {
        const client = await ensureSession();
        const data = await method(client);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ ...truncateResults(data, resultKey, args.max_results ?? DEFAULT_MAX_RESULTS, args.offset ?? 0), disclaimer: MEDICAL_DISCLAIMER }),
          }],
        };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: formatError(error) }], isError: true };
      }
    },
  };
}

/** MHR tool with a date_range parameter. */
export function mhrDateRangeTool(
  name: string,
  description: string,
  method: (client: MHRClient, params: { dateRange: string }) => Promise<unknown>,
  resultKey: string,
  defaultRange: string = 'All',
) {
  return {
    name,
    description,
    handler: async (args: { date_range?: string; max_results?: number; offset?: number }): Promise<ToolResult> => {
      try {
        const client = await ensureSession();
        const data = await method(client, { dateRange: args.date_range ?? defaultRange });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ ...truncateResults(data, resultKey, args.max_results ?? DEFAULT_MAX_RESULTS, args.offset ?? 0), disclaimer: MEDICAL_DISCLAIMER }),
          }],
        };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: formatError(error) }], isError: true };
      }
    },
  };
}
