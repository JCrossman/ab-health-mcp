/**
 * Per-request session context using AsyncLocalStorage.
 *
 * In remote mode (HTTP + OAuth), each request carries a Bearer token
 * containing encrypted session cookies. This module provides request-scoped
 * access to the decrypted session, so tool handlers can get the right
 * session without any global state.
 *
 * In stdio mode, this context is empty — tools fall back to the global
 * SessionManager (disk-based storage).
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { SessionData } from '../auth/session-manager.js';

export const sessionContext = new AsyncLocalStorage<SessionData>();

/**
 * Run a function with a request-scoped session.
 * Any tool handler called within will see this session via sessionContext.getStore().
 */
export function runWithSession<T>(session: SessionData, fn: () => T): T {
  return sessionContext.run(session, fn);
}
