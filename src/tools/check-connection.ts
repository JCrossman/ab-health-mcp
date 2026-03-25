/**
 * MCP Tool: check_connection
 *
 * Verifies that the auth session is established and still valid.
 * Reports status for both MHR and MyChart (AHS Connect).
 * Also serves as a session keepalive.
 */

import { ensureSession, sessionManager, loadSessionData, formatError } from '../helpers/session-helpers.js';

export const checkConnectionTool = {
  name: 'check_connection',
  description: 'Check if you are currently connected to My Health Records (MHR) and MyChart (AHS Connect), and how much session time remains.',
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
  handler: async () => {
    try {
      // Check if session file exists first
      if (!await sessionManager.exists()) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              connected: false,
              message: 'Not connected. Use connect_account to sign in.',
            }),
          }],
        };
      }

      const client = await ensureSession();
      const status = await client.getSessionStatus();
      const user = await client.getUser();

      // Check MyChart session availability
      const sessionData = await loadSessionData();
      const myChartConnected = !!(sessionData?.myChartJar && sessionData?.myChartCsrfToken);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            connected: true,
            userName: user.name,
            mhrConnected: true,
            myChartConnected,
            sessionTimeRemaining: Math.round(status.numberOfMilliSecondsLeftForSessionExpire / 1000),
            authorizedRecords: user.authorizedRecords.length,
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
