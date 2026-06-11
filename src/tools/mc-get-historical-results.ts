import { ensureMyChartSession, formatError } from '../helpers/session-helpers.js';
import { MEDICAL_DISCLAIMER_SHORT, formattingDirective } from './tool-factory.js';

export const mcGetHistoricalResultsTool = {
  name: 'mc_get_historical_results',
  description: 'Get historical trend data for specific test result components from MyChart. Requires order_id and component_ids from mc_get_test_results details.',
  handler: async (params: { order_id: string; component_ids: string[] }) => {
    try {
      const client = await ensureMyChartSession();
      const data = await client.getHistoricalResults(params.order_id, params.component_ids);
      return {
        content: [
          formattingDirective('trend_table', ['Date', 'Value', 'Unit', 'Reference Range', 'Status']),
          { type: 'text' as const, text: JSON.stringify({ ...data as object, disclaimer: MEDICAL_DISCLAIMER_SHORT }) },
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
