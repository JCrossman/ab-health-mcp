import { ensureMyChartSession, formatError } from '../helpers/session-helpers.js';
import { MEDICAL_DISCLAIMER_SHORT, formattingDirective } from './tool-factory.js';

export const mcGetReferralsTool = {
  name: 'mc_get_referrals',
  description: 'Specialist referrals from MyChart — specialty, provider, status, notes.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      referral_id: {
        type: 'string',
        description: 'Referral ID to get details for a specific referral.',
      },
    },
  },
  handler: async (params: { referral_id?: string }) => {
    try {
      const client = await ensureMyChartSession();

      if (params.referral_id) {
        const data = await client.getReferralDetails(params.referral_id);
        return {
          content: [
            formattingDirective('detail'),
            { type: 'text' as const, text: JSON.stringify({ ...data as object, disclaimer: MEDICAL_DISCLAIMER_SHORT }) },
          ],
        };
      }

      const data = await client.getReferralsList();
      return {
        content: [
          formattingDirective('table', ['Date', 'Specialty', 'Provider', 'Status']),
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
