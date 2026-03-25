/**
 * MCP Tool: connect_account
 *
 * Opens a browser window for the user to sign in to their MyAlberta account.
 * After login, session cookies are captured for both MHR and MyChart (AHS Connect),
 * encrypted, and stored locally.
 *
 * If a valid session already exists, returns immediately without opening a browser.
 * Use force=true to re-authenticate even if a session exists.
 *
 * Credentials never touch this code — they're entered directly in the browser.
 */

import { authenticate } from '../api/auth-client.js';
import { MHRClient } from '../api/mhr-client.js';
import { sessionManager, loadSessionData, invalidateSessionCache, formatError } from '../helpers/session-helpers.js';
import { MEDICAL_DISCLAIMER } from './tool-factory.js';

export const connectAccountTool = {
  name: 'connect_account',
  description: 'Sign in to your MyAlberta account to access My Health Records (MHR) and MyChart (AHS Connect). Opens a browser window for you to enter your credentials. Always call this tool when a session is expired or when the user asks to connect — it handles everything automatically. Reuses an existing session if still valid — set force=true to re-authenticate.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      force: {
        type: 'boolean',
        description: 'Force re-authentication even if a valid session exists.',
      },
    },
  },
  handler: async (params: { force?: boolean }) => {
    try {
      // Check for existing valid session (skip browser if possible)
      if (!params.force && await sessionManager.exists()) {
        const data = await loadSessionData();
        if (data) {
          try {
            const existingClient = new MHRClient(data.mhrJar);
            const status = await existingClient.getSessionStatus();
            if (!status.isSessionExpired) {
              const user = await existingClient.getUser();
              const myChartConnected = !!(data.myChartJar && data.myChartCsrfToken);
              return {
                content: [{
                  type: 'text' as const,
                  text: JSON.stringify({
                    connected: true,
                    message: 'Already connected (existing session reused).',
                    userName: user.name,
                    authorizedRecords: user.authorizedRecords.length,
                    mhrConnected: true,
                    myChartConnected,
                    sessionTimeRemaining: Math.round(status.numberOfMilliSecondsLeftForSessionExpire / 1000),
                    disclaimer: MEDICAL_DISCLAIMER,
                  }),
                }],
              };
            }
          } catch {
            // Session invalid or expired — fall through to fresh auth
          }
        }
      }

      // Authenticate with SSO via browser
      const { mhrCookieJar, myChartCookieJar, myChartCsrfToken } = await authenticate();

      // Verify the MHR session works by fetching user profile
      const client = new MHRClient(mhrCookieJar);
      const user = await client.getUser();

      // Save encrypted session (both MHR and MyChart)
      await sessionManager.save({
        mhrJar: mhrCookieJar,
        myChartJar: myChartCookieJar,
        myChartCsrfToken,
      });
      invalidateSessionCache();

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            connected: true,
            message: 'Successfully connected to My Health Records and MyChart (AHS Connect).',
            userName: user.name,
            authorizedRecords: user.authorizedRecords.length,
            mhrConnected: true,
            myChartConnected: !!myChartCookieJar,
            disclaimer: MEDICAL_DISCLAIMER,
          }),
        }],
      };
    } catch (error) {
      // Log the actual error to stderr for diagnostics (never log PII)
      const errMsg = error instanceof Error ? error.message : String(error);
      const { logger } = await import('../utils/logger.js');
      logger.error(`connect_account failed: ${errMsg}`);

      // Return a generic message — never expose internal error details to the caller
      const isChromeMissing = errMsg.includes('Could not find') || errMsg.includes('chrome') || errMsg.includes('Chrome');
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: 'auth_failed',
            message: isChromeMissing
              ? 'Could not find Chrome browser. Please install Google Chrome and try again.'
              : 'Authentication failed. Please try calling connect_account again.',
            action: 'Try calling connect_account again. If it keeps failing, make sure Chrome is installed.',
            retryable: true,
          }),
        }],
        isError: true,
      };
    }
  },
};
