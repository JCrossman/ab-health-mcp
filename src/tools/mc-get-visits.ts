import { ensureMyChartSession, formatError } from '../helpers/session-helpers.js';
import { MEDICAL_DISCLAIMER_SHORT, formattingDirective } from './tool-factory.js';

export const mcGetVisitsTool = {
  name: 'mc_get_visits',
  description: 'Past and upcoming appointments (MyChart).',
  inputSchema: {
    type: 'object' as const,
    properties: {
      time_frame: {
        type: 'string',
        enum: ['upcoming', 'past', 'all'],
        description: 'Filter by upcoming, past, or all visits. Defaults to all.',
      },
      visit_id: {
        type: 'string',
        description: 'CSN identifier for a specific visit to get details.',
      },
    },
  },
  handler: async (params: { time_frame?: string; visit_id?: string }) => {
    try {
      const client = await ensureMyChartSession();
      const timeFrame = params.time_frame ?? 'all';

      if (params.visit_id) {
        const data = await client.getVisitDetails(params.visit_id);
        return {
          content: [
            formattingDirective('detail'),
            { type: 'text' as const, text: JSON.stringify({ ...data as object, disclaimer: MEDICAL_DISCLAIMER_SHORT }) },
          ],
        };
      }

      let data;
      if (timeFrame === 'upcoming') {
        data = await client.getUpcomingVisits();
      } else if (timeFrame === 'past') {
        data = await client.getPastVisits();
      } else {
        const [upcoming, past] = await Promise.all([
          client.getUpcomingVisits(),
          client.getPastVisits(),
        ]);
        data = { upcoming, past };
      }

      return {
        content: [
          formattingDirective('table', ['Date', 'Type', 'Provider', 'Location', 'Status']),
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
