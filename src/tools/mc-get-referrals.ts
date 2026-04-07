import { ensureMyChartSession, formatError } from '../helpers/session-helpers.js';
import { MEDICAL_DISCLAIMER } from './tool-factory.js';

export const mcGetReferralsTool = {
  name: 'mc_get_referrals',
  description: 'Referral details from AHS (MyChart).',
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
          content: [{ type: 'text' as const, text: JSON.stringify({ ...data as object, _displayHint: 'detail', disclaimer: MEDICAL_DISCLAIMER }) }],
        };
      }

      const data = await client.getReferralsList();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ...data as object, _displayHint: 'table', _displayColumns: ['Date', 'Specialty', 'Provider', 'Status'], disclaimer: MEDICAL_DISCLAIMER }) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: formatError(error) }],
        isError: true,
      };
    }
  },
};
