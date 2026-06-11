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
import { sessionManager, loadSessionData, invalidateSessionCache } from '../helpers/session-helpers.js';
import { MEDICAL_DISCLAIMER } from './tool-factory.js';
import { isDemoMode, setDemoMode } from '../helpers/demo/index.js';
import { logger } from '../utils/logger.js';
import { access, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

import { VERSION as CURRENT_VERSION } from '../version.js';

const UPDATE_CHECK_URL = `https://www.myaihealth.ca/api/check-update?v=${CURRENT_VERSION}`;

const CONSENT_FILE = join(homedir(), '.mhr-records', 'privacy-acknowledged');

const PRIVACY_NOTICE = `⚠️ IMPORTANT — Please read before connecting:

When you connect your health account, your health data (lab results, medications, immunizations, etc.) will be sent to Claude for your conversation.

Here's what that means:
• Claude is made by Anthropic. Their servers are in the United States.
• Anthropic may keep your conversations for up to 30 days.
• By default, your conversations may be used to improve Claude's AI.

To protect your privacy:
→ Open Claude Desktop → Settings → Privacy → Turn off "Improve Claude"

This extension does NOT store your health data — it fetches it for your conversation, then discards it. Your login credentials are entered directly on Alberta's website and never touch this extension.

Your rights:
• You can disconnect at any time using the disconnect_account tool.
• Data already sent to Anthropic is subject to their retention policy (up to 30 days).
• For privacy concerns, contact Alberta's Office of the Information and Privacy Commissioner (OIPC) at https://www.oipc.ab.ca

By proceeding, you acknowledge that your health data will be sent to Anthropic's servers in the United States for AI processing. See Anthropic's privacy policy at https://www.anthropic.com/privacy

To proceed, call connect_account with accept_privacy=true.`;

async function hasAcknowledgedPrivacy(): Promise<boolean> {
  try {
    await access(CONSENT_FILE);
    return true;
  } catch {
    return false;
  }
}

async function acknowledgePrivacy(): Promise<void> {
  await mkdir(join(homedir(), '.mhr-records'), { recursive: true, mode: 0o700 });
  await writeFile(CONSENT_FILE, new Date().toISOString(), { mode: 0o600 });
}

interface UpdateInfo {
  latestVersion: string;
  downloadUrl: string;
}

async function checkForUpdate(): Promise<UpdateInfo | undefined> {
  try {
    logger.info(`Checking for updates at ${UPDATE_CHECK_URL}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(UPDATE_CHECK_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      logger.warn(`Update check returned HTTP ${res.status}`);
      return undefined;
    }
    const data = await res.json() as { updateAvailable?: boolean; latestVersion?: string; downloadUrl?: string };
    logger.info(`Update check result: updateAvailable=${data.updateAvailable}, latest=${data.latestVersion}`);
    if (data.updateAvailable && data.latestVersion && data.downloadUrl) {
      return { latestVersion: data.latestVersion, downloadUrl: data.downloadUrl };
    }
  } catch (error) {
    logger.warn(`Update check failed: ${error instanceof Error ? error.message : error}`);
  }
  return undefined;
}

export const connectAccountTool = {
  name: 'connect_account',
  description: 'Sign in to your MyAlberta account to access My Health Records (MHR) and MyChart (AHS Connect). Opens a browser window for you to enter your credentials. Reuses an existing session if still valid — set force=true to re-authenticate. Set demo=true only when the user explicitly asks for demo mode or sample data.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      force: {
        type: 'boolean',
        description: 'Force re-authentication even if a valid session exists.',
      },
      demo: {
        type: 'boolean',
        description: 'Set to true only when the user explicitly asks for demo mode or sample data. Do NOT set for normal health data connections.',
      },
      accept_privacy: {
        type: 'boolean',
        description: 'Set to true to acknowledge the privacy notice and proceed with connecting. Required on first use after the privacy notice is shown.',
      },
    },
  },
  handler: async (params: { force?: boolean; demo?: boolean; accept_privacy?: boolean }) => {
    try {
      // Demo mode: only enter when explicitly requested. Resolved before the
      // network update check so demo sessions don't pay a 2-4s network tax
      // for a download URL that points at a real install.
      if (params.demo) {
        setDemoMode(true);
      } else {
        setDemoMode(false);
      }

      if (isDemoMode()) {
        return {
          content: [
            {
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
            },
          ],
        };
      }

      // Check for updates (live path only)
      const updateInfo = await checkForUpdate();

      // If update available, always return it as a prominent first content block
      const updateBlock: Array<{ type: 'text'; text: string }> = [];
      if (updateInfo) {
        updateBlock.push({
          type: 'text' as const,
          text: `UPDATE AVAILABLE: This extension (Alberta Health Records) has a newer version (v${updateInfo.latestVersion}, currently v${CURRENT_VERSION}). Direct download from myaihealth.ca: ${updateInfo.downloadUrl} — Double-click the downloaded file to install.`,
        });
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
              return {
                content: [
                  ...updateBlock,
                  {
                    type: 'text' as const,
                    text: JSON.stringify(response),
                  },
                ],
              };
            }
          } catch {
            // Session invalid or expired — fall through to fresh auth
          }
        }
      }

      // First-run privacy consent — show notice, require explicit acceptance
      if (!await hasAcknowledgedPrivacy()) {
        if (params.accept_privacy) {
          await acknowledgePrivacy();
          // Fall through to continue with auth
        } else {
          return {
            content: [{
              type: 'text' as const,
              text: PRIVACY_NOTICE,
            }],
          };
        }
      }

      // Block auth if update is available
      if (updateInfo) {
        logger.info(`Update available: ${updateInfo.latestVersion} (installed: ${CURRENT_VERSION})`);
        return {
          content: [{
            type: 'text' as const,
            text: `UPDATE REQUIRED: This extension (Alberta Health Records) needs to be updated from v${CURRENT_VERSION} to v${updateInfo.latestVersion} before connecting. Direct download from myaihealth.ca: ${updateInfo.downloadUrl} — Double-click the downloaded file to install, then try connecting again.`,
          }],
        };
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

      const response: Record<string, unknown> = {
        connected: true,
        message: 'Successfully connected to My Health Records and MyChart (AHS Connect).',
        userName: user.name,
        authorizedRecords: user.authorizedRecords.length,
        mhrConnected: true,
        myChartConnected: !!myChartCookieJar,
        disclaimer: MEDICAL_DISCLAIMER,
      };
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
