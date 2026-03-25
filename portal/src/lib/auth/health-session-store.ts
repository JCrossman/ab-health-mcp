/**
 * Per-user health session store for the portal.
 *
 * Stores serialized health session data (cookies, CSRF tokens) in memory
 * per authenticated portal user. Sessions expire after 10 minutes of
 * inactivity (matching Alberta's session timeout).
 *
 * No health data is stored — only session tokens needed to make API calls.
 */

import type { HealthSessionData } from "./health-auth";

interface SessionEntry {
  data: HealthSessionData;
  lastAccessed: number;
}

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Use globalThis to persist sessions across Next.js API route module boundaries
const globalForSessions = globalThis as unknown as {
  _ahp_healthSessions?: Map<string, SessionEntry>;
};
if (!globalForSessions._ahp_healthSessions) {
  globalForSessions._ahp_healthSessions = new Map();
}
const sessions = globalForSessions._ahp_healthSessions;

// Cleanup expired sessions every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of sessions) {
    if (now - entry.lastAccessed > SESSION_TTL_MS) {
      sessions.delete(userId);
    }
  }
}, 2 * 60 * 1000);

export function setHealthSession(
  userId: string,
  data: HealthSessionData
): void {
  sessions.set(userId, { data, lastAccessed: Date.now() });
}

export function getHealthSession(
  userId: string
): HealthSessionData | null {
  const entry = sessions.get(userId);
  if (!entry) return null;

  if (Date.now() - entry.lastAccessed > SESSION_TTL_MS) {
    sessions.delete(userId);
    return null;
  }

  entry.lastAccessed = Date.now();
  return entry.data;
}

export function clearHealthSession(userId: string): void {
  sessions.delete(userId);
}

export function hasHealthSession(userId: string): boolean {
  return getHealthSession(userId) !== null;
}
