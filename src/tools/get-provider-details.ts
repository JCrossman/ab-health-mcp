/**
 * MCP Tool: get_provider_details
 *
 * Look up full details of a single clinic or physician/nurse practitioner
 * by its numeric ID (returned by find_provider, search_provider_by_name, or
 * find_provider_by_language). Public data — no auth.
 */

import { getClinicById, getPhysicianById } from '../api/find-a-provider-client.js';
import { formattingDirective } from './tool-factory.js';

interface GetDetailsArgs {
  id: number;
  type: 'clinic' | 'physician' | 'nurse_practitioner';
}

export const getProviderDetailsTool = {
  name: 'get_provider_details',
  description:
    'Get full details of a specific Alberta clinic, physician, or nurse practitioner by ID. Use the IDs returned by find_provider, search_provider_by_name, or find_provider_by_language. Returns address, contact info, hours, services, PCN, affiliated providers, languages, and accepting-new-patients status. Public data — no Alberta account needed.',
  handler: async (args: GetDetailsArgs) => {
    try {
      if (typeof args.id !== 'number' || !Number.isFinite(args.id) || args.id <= 0) {
        throw new Error('A positive numeric `id` is required.');
      }
      let data: unknown;
      if (args.type === 'clinic') {
        data = await getClinicById(args.id);
      } else if (args.type === 'physician') {
        data = await getPhysicianById(args.id, 0);
      } else if (args.type === 'nurse_practitioner') {
        data = await getPhysicianById(args.id, 1);
      } else {
        throw new Error('`type` must be one of: "clinic", "physician", "nurse_practitioner".');
      }

      return {
        content: [
          formattingDirective('detail'),
          {
            type: 'text' as const,
            text: JSON.stringify({
              source: 'albertafindaprovider.ca (public directory)',
              type: args.type,
              id: args.id,
              record: data,
              note:
                'This is public Alberta provider directory data. Always confirm availability, services, and accepting-new-patients status directly with the provider before visiting.',
            }),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: error instanceof Error ? error.message : 'Unknown error fetching provider details.',
          },
        ],
        isError: true,
      };
    }
  },
};
