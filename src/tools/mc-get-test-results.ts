import { ensureMyChartSession, formatError } from '../helpers/session-helpers.js';
import { MEDICAL_DISCLAIMER_SHORT, formattingDirective } from './tool-factory.js';

interface Scan {
  dcsId: string;
  fileExtension: string;
}

export const mcGetTestResultsTool = {
  name: 'mc_get_test_results',
  description: 'Test results from AHS labs (MyChart). With order_id, also fetches the full report + scan list. Use mc_download_document for scan images.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      search_string: {
        type: 'string',
        description: 'Optional search string to filter test results.',
      },
      order_id: {
        type: 'string',
        description: 'Order key to get detailed results for a specific test.',
      },
      report_id: {
        type: 'string',
        description: 'Report ID to fetch full report content (procedure report, narrative). Provided in the test result details response.',
      },
    },
  },
  handler: async (params: { search_string?: string; order_id?: string; report_id?: string }) => {
    try {
      const client = await ensureMyChartSession();

      // Fetch full report content by report ID
      if (params.report_id) {
        const report = await client.getReportContent(params.report_id, params.order_id ? { ordId: params.order_id } : {});
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ ...report as object, disclaimer: MEDICAL_DISCLAIMER_SHORT }) }],
        };
      }

      // Fetch details for a specific test result
      if (params.order_id) {
        const details = await client.getTestResultDetails(params.order_id) as Record<string, unknown>;

        // Auto-fetch report content if available
        let reportContent: unknown = null;
        try {
          const resultsArr = details.results as Array<Record<string, unknown>> | undefined;
          const firstResult = resultsArr?.[0];
          const reportDetails = firstResult?.reportDetails as Record<string, unknown> | undefined;

          if (reportDetails?.reportID) {
            const reportVars = reportDetails.reportVars as Record<string, string> | undefined;
            reportContent = await client.getReportContent(
              reportDetails.reportID as string,
              reportVars ?? { ordId: params.order_id },
            );
          }
        } catch {
          // Report content fetch is optional
        }

        // Extract scan/image information for Claude
        const resultsArr = details.results as Array<Record<string, unknown>> | undefined;
        const firstResult = resultsArr?.[0];
        const scans = (firstResult?.scans as Scan[] | undefined) ?? [];

        const contentBlocks: Array<{ type: 'text'; text: string }> = [];

        const result = reportContent
          ? { details, reportContent }
          : details;

        contentBlocks.push({
          type: 'text' as const,
          text: JSON.stringify({ ...result as object, disclaimer: MEDICAL_DISCLAIMER_SHORT }),
        });

        // Prepend formatting directive
        contentBlocks.unshift(formattingDirective('table', ['Test', 'Value', 'Unit', 'Reference Range', 'Status']));

        // Add scan summary so Claude knows images are available
        if (scans.length > 0) {
          const scanSummary = scans.map((s, i) => `  ${i + 1}. ${s.fileExtension} — dcs_id: ${s.dcsId}`).join('\n');
          contentBlocks.push({
            type: 'text' as const,
            text: `\n📎 This test result has ${scans.length} attached scan(s)/image(s):\n${scanSummary}\n\nTo view these, use the mc_download_document tool with the dcs_id and file_extension above.`,
          });
        }

        return { content: contentBlocks };
      }

      const data = await client.getTestResultsList(params.search_string);
      return {
        content: [
          formattingDirective('table', ['Date', 'Test', 'Status']),
          { type: 'text' as const, text: JSON.stringify({ ...data as object, note: 'Reference ranges may not be available from this source. Ask your healthcare provider about the significance of these results.', disclaimer: MEDICAL_DISCLAIMER_SHORT }) },
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
