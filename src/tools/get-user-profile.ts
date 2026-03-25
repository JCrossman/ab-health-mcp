/**
 * MCP Tool: get_user_profile
 *
 * Returns the authenticated user's profile and authorized health records.
 * This is a passthrough — raw API data is formatted for Claude to interpret.
 */

import { ensureSession, formatError } from '../helpers/session-helpers.js';
import { MEDICAL_DISCLAIMER } from './tool-factory.js';

export const getUserProfileTool = {
  name: 'get_user_profile',
  description: 'Get your My Health Records user profile, including authorized health records you can access.',
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
  handler: async () => {
    try {
      const client = await ensureSession();
      const user = await client.getUser();

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            name: user.name,
            personId: user.personId,
            activeRecord: {
              id: user.selectedRecordId,
              name: user.authorizedRecords.find(r => r.id === user.selectedRecordId)?.name,
              relationship: user.authorizedRecords.find(r => r.id === user.selectedRecordId)?.relationshipType,
              isCustodian: user.authorizedRecords.find(r => r.id === user.selectedRecordId)?.isCustodian,
            },
            authorizedRecords: user.authorizedRecords.map(r => ({
              id: r.id,
              name: r.name,
              relationship: r.relationshipType,
              isCustodian: r.isCustodian,
            })),
            language: user.defaultUserLanguage,
            accountCreated: user.createdDateTimeUtc?.split('T')[0],
            disclaimer: MEDICAL_DISCLAIMER,
          }),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: formatError(error),
        }],
        isError: true,
      };
    }
  },
};
