/**
 * Per-request session context using AsyncLocalStorage.
 *
 * In remote mode (HTTP + OAuth), each request carries a Bearer token
 * containing encrypted session cookies. This module provides request-scoped
 * access to the decrypted session, so tool handlers can get the right
 * session without any global state.
 *
 * Desktop fallback is permitted only inside an explicit runOnDesktop scope.
 * Missing context is never interpreted as desktop access.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { SessionData } from '../auth/session-manager.js';
import { AuthRequiredError } from '../utils/errors.js';

export const sessionContext = new AsyncLocalStorage<SessionData>();
const executionMode = new AsyncLocalStorage<'stdio' | 'remote'>();

export function isDesktopExecution(): boolean {
  return executionMode.getStore() === 'stdio';
}

export function requireDesktopExecution(): void {
  if (!isDesktopExecution()) {
    throw new AuthRequiredError('This action is available only in the desktop extension. Use your connector settings to sign in or disconnect.');
  }
}

export function runOnDesktop<T>(fn: () => T): T {
  return executionMode.run('stdio', fn);
}

export function requireRemoteSession(): SessionData {
  const session = sessionContext.getStore();
  if (executionMode.getStore() !== 'remote' || !session) throw new AuthRequiredError();
  return session;
}

/**
 * Run a function with a request-scoped session.
 * Any tool handler called within will see this session via sessionContext.getStore().
 */
export function runWithSession<T>(session: SessionData, fn: () => T): T {
  return executionMode.run('remote', () => sessionContext.run(session, fn));
}
