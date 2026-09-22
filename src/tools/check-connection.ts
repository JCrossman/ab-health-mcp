/**
 * MCP Tool: check_connection
 *
 * Verifies that the auth session is established and still valid.
 * Reports status for both MHR and MyChart (AHS Connect).
 * Also serves as a session keepalive.
 */

import { ensureSession, sessionManager, checkMyChartConnection, formatError } from '../helpers/session-helpers.js';
import { isDemoMode } from '../helpers/demo/index.js';

export const checkConnectionTool = {
  name: 'check_connection',
  description: 'Check MHR + MyChart connection status and session time remaining.',
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
  handler: async () => {
    try {
      // Check if session file exists first
      if (!isDemoMode() && !await sessionManager.exists()) {
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

      const myChart = await checkMyChartConnection();

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            connected: true,
            userName: user.name,
            mhrConnected: true,
            myChartConnected: myChart.connected,
            ...(myChart.connected ? {} : { warnings: { myChart: myChart.error } }),
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
