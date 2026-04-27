/**
 * In-memory store for active auth-stream Puppeteer sessions.
 *
 * Each session holds a headless Chrome instance streaming Alberta's SSO
 * login page to the user's browser. Scoped to one active stream per user.
 *
 * Uses globalThis to persist across Next.js API route module boundaries
 * (same pattern as health-session-store.ts).
 */

import type { Browser, Page } from "puppeteer-core";
import type { CDPSession } from "puppeteer-core";
import crypto from "crypto";

const MAX_STREAM_AGE_MS = 3 * 60 * 1000; // 3 minutes
const CLEANUP_INTERVAL_MS = 30 * 1000; // check every 30s

export interface AuthStreamSession {
  id: string;
  userId: string;
  browser: Browser;
  page: Page;
  cdp: CDPSession;
  createdAt: number;
  /** Set to true once login is detected and post-login flow starts. */
  completing: boolean;
}

interface AuthStreamStore {
  sessions: Map<string, AuthStreamSession>;
  /** Map userId → active session ID (enforces one stream per user). */
  userSessions: Map<string, string>;
}

const globalForAuthStreams = globalThis as unknown as {
  _ahp_authStreams?: AuthStreamStore;
};
if (!globalForAuthStreams._ahp_authStreams) {
  globalForAuthStreams._ahp_authStreams = {
    sessions: new Map(),
    userSessions: new Map(),
  };

  // Periodic cleanup of expired sessions
  setInterval(() => {
    const store = globalForAuthStreams._ahp_authStreams!;
    const now = Date.now();
    for (const [id, session] of store.sessions) {
      if (now - session.createdAt > MAX_STREAM_AGE_MS && !session.completing) {
        destroyAuthStream(id).catch(() => {});
      }
    }
  }, CLEANUP_INTERVAL_MS);
}
const store = globalForAuthStreams._ahp_authStreams;

/** Generate a cryptographically random session ID. */
export function generateStreamId(): string {
  return crypto.randomUUID();
}

/**
 * Register a new auth stream session.
 * Destroys any existing stream for this user first.
 */
export async function registerAuthStream(
  session: AuthStreamSession
): Promise<void> {
  // Destroy existing stream for this user
  const existingId = store.userSessions.get(session.userId);
  if (existingId) {
    await destroyAuthStream(existingId);
  }

  store.sessions.set(session.id, session);
  store.userSessions.set(session.userId, session.id);
}

/**
 * Look up an auth stream by ID, verifying the caller owns it.
 */
export function getAuthStream(
  sessionId: string,
  userId: string
): AuthStreamSession | null {
  const session = store.sessions.get(sessionId);
  if (!session || session.userId !== userId) return null;
  return session;
}

/**
 * Destroy an auth stream: close the browser, remove from store.
 */
export async function destroyAuthStream(sessionId: string): Promise<void> {
  const session = store.sessions.get(sessionId);
  if (!session) return;

  store.sessions.delete(sessionId);
  const currentForUser = store.userSessions.get(session.userId);
  if (currentForUser === sessionId) {
    store.userSessions.delete(session.userId);
  }

  try {
    await session.browser.close();
  } catch {
    // Browser may already be closed
  }
}

/** Check if a user has an active auth stream. */
export function hasActiveStream(userId: string): boolean {
  const id = store.userSessions.get(userId);
  if (!id) return false;
  return store.sessions.has(id);
}
