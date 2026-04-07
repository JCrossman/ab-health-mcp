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

export const MEDICAL_DISCLAIMER = 'IMPORTANT: This is your health record data for informational purposes only — it is NOT medical advice. Always consult your doctor or healthcare provider to interpret results and make health decisions. Note: Health records may not reflect your complete medical history. Results may take 24-72 hours to appear after testing. Records from out-of-province providers or some community clinics may not be included.';

const DEFAULT_MAX_RESULTS = 50;

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

/** Build a formatting directive content block that precedes the data. */
export function formattingDirective(hint: string, columns?: string[]): { type: 'text'; text: string } {
  const colStr = columns ? ` Columns: ${columns.join(' | ')}.` : '';
  let instruction: string;
  switch (hint) {
    case 'table':
      instruction = `FORMATTING: Present the following data as a markdown table.${colStr} Lead with a 1-2 sentence summary. Use 🟢 Normal / 🟡 Borderline / 🔴 Outside range for status (always include text label with emoji). Never dump as paragraphs.`;
      break;
    case 'trend_table':
      instruction = `FORMATTING: Present the following data as a markdown table showing trends over time.${colStr} After the table, describe the trend direction using ↑ Increasing / ↓ Decreasing / → Stable. Lead with a 1-2 sentence summary.`;
      break;
    case 'summary_sections':
      instruction = `FORMATTING: Present each section of this data under its own ## heading with a brief table or bullet list. Lead with a 1-2 sentence overall summary. Never dump all data as one block of text.`;
      break;
    case 'grouped_tables':
      instruction = `FORMATTING: Present each group of data as its own labeled markdown table under a ## heading. Lead with a brief summary.`;
      break;
    case 'detail':
      instruction = `FORMATTING: Present this record's details as a clean list of key-value pairs under clear headings. Use bold for field names.`;
      break;
    default:
      instruction = `FORMATTING: Present this data in a clean, scannable format using markdown tables where appropriate. Never dump as paragraphs.`;
  }
  return { type: 'text' as const, text: instruction };
}

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
  displayHint?: { hint: string; columns?: string[] },
) {
  return {
    name,
    description,
    handler: async (): Promise<ToolResult> => {
      try {
        const client = await ensureMyChartSession();
        const data = await method(client);
        const content: Array<{ type: 'text'; text: string }> = [];
        if (displayHint) content.push(formattingDirective(displayHint.hint, displayHint.columns));
        content.push({ type: 'text' as const, text: JSON.stringify({
          ...data as object,
          disclaimer: MEDICAL_DISCLAIMER,
        }) });
        return { content };
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
  displayHint?: { hint: string; columns?: string[] },
) {
  return {
    name,
    description,
    handler: async (args: { max_results?: number; offset?: number }): Promise<ToolResult> => {
      try {
        const client = await ensureSession();
        const data = await method(client);
        const content: Array<{ type: 'text'; text: string }> = [];
        if (displayHint) content.push(formattingDirective(displayHint.hint, displayHint.columns));
        content.push({
          type: 'text' as const,
          text: JSON.stringify({
            ...truncateResults(data, resultKey, args.max_results ?? DEFAULT_MAX_RESULTS, args.offset ?? 0),
            disclaimer: MEDICAL_DISCLAIMER,
          }),
        });
        return { content };
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
  displayHint?: { hint: string; columns?: string[] },
) {
  return {
    name,
    description,
    handler: async (args: { date_range?: string; max_results?: number; offset?: number }): Promise<ToolResult> => {
      try {
        const client = await ensureSession();
        const data = await method(client, { dateRange: args.date_range ?? defaultRange });
        const content: Array<{ type: 'text'; text: string }> = [];
        if (displayHint) content.push(formattingDirective(displayHint.hint, displayHint.columns));
        content.push({
          type: 'text' as const,
          text: JSON.stringify({
            ...truncateResults(data, resultKey, args.max_results ?? DEFAULT_MAX_RESULTS, args.offset ?? 0),
            disclaimer: MEDICAL_DISCLAIMER,
          }),
        });
        return { content };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: formatError(error) }], isError: true };
      }
    },
  };
}
