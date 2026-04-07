import { ensureMyChartSession, formatError } from '../helpers/session-helpers.js';
import { MEDICAL_DISCLAIMER, formattingDirective } from './tool-factory.js';

export const mcGetGoalsTool = {
  name: 'mc_get_goals',
  description: 'Patient and care team goals (MyChart).',
  inputSchema: { type: 'object' as const, properties: {} },
  handler: async () => {
    try {
      const client = await ensureMyChartSession();
      const [patientGoals, careTeamGoals] = await Promise.all([
        client.getPatientGoals(),
        client.getCareTeamGoals(),
      ]);
      const data = { patientGoals, careTeamGoals, disclaimer: MEDICAL_DISCLAIMER };
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
