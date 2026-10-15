/**
 * MCP Tool: disconnect_account
 *
 * Clears stored session cookies. The user will need to reconnect
 * with connect_account to access health records again.
 */

import { sessionManager, invalidateSessionCache, formatError } from '../helpers/session-helpers.js';
import { requireDesktopExecution } from '../server/session-context.js';
import { withDesktopOperation } from '../auth/desktop-operation.js';
import { forgetBrowserProfile } from '../api/auth-client.js';
import { setDemoMode } from '../helpers/demo/index.js';

export const disconnectAccountTool = {
  name: 'disconnect_account',
  description: 'Clear the desktop MCP session. Alberta sign-in may still be remembered. Set forget_device=true only when the user explicitly asks to forget this device; it removes the MCP sign-in profile, never Claude conversations or normal Chrome data.',
  inputSchema: {
    type: 'object' as const,
    properties: { forget_device: { type: 'boolean', description: 'Remove the MCP saved sign-in profile. Requires explicit user intent.' } },
  },
  handler: async (params: { forget_device?: boolean } = {}) => {
    try {
      requireDesktopExecution();
      invalidateSessionCache();
      setDemoMode(false);
      await withDesktopOperation(async () => {
        invalidateSessionCache();
        await sessionManager.clear();
        if (params.forget_device) {
          await forgetBrowserProfile();
          await sessionManager.forget();
        }
        invalidateSessionCache();
      });
    } catch (error) {
      return { content: [{ type: 'text' as const, text: formatError(error) }], isError: true };
    }
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          connected: false,
          message: params.forget_device
            ? 'MCP saved sign-in data and its dedicated browser profile removed. Claude conversations and your normal browser are unchanged. Other devices and upstream sessions are not signed out.'
            : 'MCP session cleared. Its browser may still remember your Alberta sign-in. Ask to forget this device to remove that saved sign-in; Claude conversations are unchanged.',
        }),
      }],
    };
  },
};
