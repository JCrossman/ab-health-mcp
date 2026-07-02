import { ensureMyChartSession, formatError } from '../helpers/session-helpers.js';
import { MEDICAL_DISCLAIMER_SHORT, formattingDirective } from './tool-factory.js';

export const mcGetGoalsTool = {
  name: 'mc_get_goals',
  description: 'Health goals from MyChart — wellness targets, treatment objectives, progress.',
  inputSchema: { type: 'object' as const, properties: {} },
  handler: async () => {
    try {
      const client = await ensureMyChartSession();
      const [patientGoals, careTeamGoals] = await Promise.all([
        client.getPatientGoals(),
        client.getCareTeamGoals(),
      ]);
      const data = { patientGoals, careTeamGoals, disclaimer: MEDICAL_DISCLAIMER_SHORT };
      return {
        content: [
          formattingDirective('grouped_tables'),
          { type: 'text' as const, text: JSON.stringify(data) },
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
