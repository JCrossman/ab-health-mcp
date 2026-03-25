/**
 * MCP Tool: disconnect_account
 *
 * Clears stored session cookies. The user will need to reconnect
 * with connect_account to access health records again.
 */

import { sessionManager, invalidateSessionCache } from '../helpers/session-helpers.js';

export const disconnectAccountTool = {
  name: 'disconnect_account',
  description: 'Disconnect from My Health Records and clear stored session data.',
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
  handler: async () => {
    await sessionManager.clear();
    invalidateSessionCache();
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          connected: false,
          message: 'Disconnected from My Health Records. Session data cleared.',
        }),
      }],
    };
  },
};
