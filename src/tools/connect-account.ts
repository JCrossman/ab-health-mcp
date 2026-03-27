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
import { isDemoMode, setDemoMode } from '../helpers/demo-data.js';
import { logger } from '../utils/logger.js';

const CURRENT_VERSION = '1.1.12';
const VERSION_CHECK_URL = 'https://www.myaihealth.ca/version.json';

async function checkForUpdate(): Promise<string | undefined> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(VERSION_CHECK_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return undefined;
    const data = await res.json() as { version?: string };
    if (data.version && data.version !== CURRENT_VERSION) {
      return data.version;
    }
  } catch {
    // Version check is best-effort — never block auth
  }
  return undefined;
}

export const connectAccountTool = {
  name: 'connect_account',
  description: 'Sign in to your MyAlberta account to access My Health Records (MHR) and MyChart (AHS Connect). Opens a browser window for you to enter your credentials. Always call this tool when a session is expired or when the user asks to connect — it handles everything automatically. Reuses an existing session if still valid — set force=true to re-authenticate. IMPORTANT: When the user mentions "demo", "demo mode", "sample data", or "try it out", you MUST set demo=true. Demo mode uses sample data and does NOT open a browser.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      force: {
        type: 'boolean',
        description: 'Force re-authentication even if a valid session exists.',
      },
      demo: {
        type: 'boolean',
        description: 'MUST be set to true when the user wants demo mode, sample data, or to try the extension without an Alberta account. Skips browser login entirely.',
      },
    },
  },
  handler: async (params: { force?: boolean; demo?: boolean }) => {
    try {
      // Demo mode: return success immediately without browser auth
      if (params.demo) setDemoMode(true);
      if (isDemoMode()) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              connected: true,
              message: 'Connected in demo mode (sample data).',
              userName: 'Demo User',
              authorizedRecords: 1,
              mhrConnected: true,
              myChartConnected: true,
              disclaimer: MEDICAL_DISCLAIMER,
            }),
          }],
        };
      }

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
              const latestVersion = await checkForUpdate();
              const response: Record<string, unknown> = {
                connected: true,
                message: 'Already connected (existing session reused).',
                userName: user.name,
                authorizedRecords: user.authorizedRecords.length,
                mhrConnected: true,
                myChartConnected,
                sessionTimeRemaining: Math.round(status.numberOfMilliSecondsLeftForSessionExpire / 1000),
                disclaimer: MEDICAL_DISCLAIMER,
              };
              if (latestVersion) {
                response.updateAvailable = `A new version (v${latestVersion}) is available. Visit https://www.myaihealth.ca to download the latest version.`;
              }
              return {
                content: [{
                  type: 'text' as const,
                  text: JSON.stringify(response),
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

      const latestVersion = await checkForUpdate();
      const response: Record<string, unknown> = {
        connected: true,
        message: 'Successfully connected to My Health Records and MyChart (AHS Connect).',
        userName: user.name,
        authorizedRecords: user.authorizedRecords.length,
        mhrConnected: true,
        myChartConnected: !!myChartCookieJar,
        disclaimer: MEDICAL_DISCLAIMER,
      };
      if (latestVersion) {
        response.updateAvailable = `A new version (v${latestVersion}) is available. Visit https://www.myaihealth.ca to download the latest version.`;
      }
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(response),
        }],
      };
    } catch (error) {
      // Log the actual error to stderr for diagnostics (never log PII)
      const errMsg = error instanceof Error ? error.message : String(error);
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
