/**
 * Session validation helpers for MCP tools.
 *
 * Provides a consistent pattern: load session → return client.
 * NO pre-validation HTTP calls — trusts the API clients' own 401/403 handling.
 * If an API call fails with SessionExpiredError, it propagates to Claude
 * with a clear "use connect_account" message.
 *
 * Cross-keepalive pings (fire-and-forget, debounced) extend session life
 * for the OTHER system during active use, without blocking tool calls.
 */

import { SessionManager, type SessionData } from '../auth/session-manager.js';
import { MHRClient } from '../api/mhr-client.js';
import { MyChartClient } from '../api/mychart-client.js';
import { AuthRequiredError, SessionExpiredError, ApiError, NetworkError } from '../utils/errors.js';
import { sessionContext } from '../server/session-context.js';
import { isDemoMode, createDemoMHRClient, createDemoMyChartClient } from './demo-data.js';

const sessionManager = new SessionManager();

export { sessionManager };

// In-memory session cache — avoids repeated disk reads + AES decryptions.
// Invalidated on connect, disconnect.
let cachedSession: SessionData | null = null;

export function invalidateSessionCache(): void {
  cachedSession = null;
}

async function loadSession(): Promise<SessionData | null> {
  // Check for per-request session (HTTP/OAuth mode) first
  const contextSession = sessionContext.getStore();
  if (contextSession) {
    return contextSession;
  }

  // Fall back to global session cache (stdio mode)
  if (!cachedSession) {
    cachedSession = await sessionManager.load();
  }
  return cachedSession;
}

// Debounce keepalives — no point pinging every 2 seconds when sessions have 10-min timeouts
const KEEPALIVE_INTERVAL_MS = 60_000;
let lastMyChartKeepAlive = 0;
let lastMhrKeepAlive = 0;

/**
 * Silently keepalive the MyChart session (non-blocking, never throws).
 * Debounced to at most once per minute.
 */
async function keepAliveMyChart(): Promise<void> {
  if (Date.now() - lastMyChartKeepAlive < KEEPALIVE_INTERVAL_MS) return;
  lastMyChartKeepAlive = Date.now();
  try {
    const data = await loadSession();
    if (data?.myChartJar && data?.myChartCsrfToken) {
      const client = new MyChartClient(data.myChartJar, data.myChartCsrfToken);
      await client.keepAlive();
    }
  } catch {
    // Non-critical — MyChart keepalive failures are silently ignored
  }
}

/**
 * Silently keepalive the MHR session (non-blocking, never throws).
 * Debounced to at most once per minute.
 */
async function keepAliveMHR(): Promise<void> {
  if (Date.now() - lastMhrKeepAlive < KEEPALIVE_INTERVAL_MS) return;
  lastMhrKeepAlive = Date.now();
  try {
    const data = await loadSession();
    if (data?.mhrJar) {
      const client = new MHRClient(data.mhrJar);
      await client.getSessionStatus();
    }
  } catch {
    // Non-critical — MHR keepalive failures are silently ignored
  }
}

/**
 * Load the stored session and return an MHR client ready for API calls.
 * Does NOT pre-validate the session — trusts the API client's own 401/403 handling.
 * If the session is expired, the API call itself will throw SessionExpiredError.
 * Fire-and-forget cross-keepalive ping keeps MyChart alive.
 */
export async function ensureSession(): Promise<MHRClient> {
  if (isDemoMode()) return createDemoMHRClient();

  const data = await loadSession();
  if (!data) {
    throw new AuthRequiredError();
  }

  // Cross-keepalive: ping MyChart in the background
  keepAliveMyChart().catch(() => {});

  return new MHRClient(data.mhrJar);
}

/**
 * Load the stored session and return a MyChart client ready for API calls.
 * Does NOT pre-validate the session — trusts the API client's own 401/403 handling.
 * If the session is expired, the API call itself will throw SessionExpiredError.
 * Fire-and-forget cross-keepalive ping keeps MHR alive.
 */
export async function ensureMyChartSession(): Promise<MyChartClient> {
  if (isDemoMode()) return createDemoMyChartClient();

  const data = await loadSession();
  if (!data) {
    throw new AuthRequiredError();
  }

  if (!data.myChartJar || !data.myChartCsrfToken) {
    throw new AuthRequiredError(
      'MyChart (AHS Connect) is not connected. Use connect_account to sign in — MyChart will be authenticated automatically via shared SSO.',
    );
  }

  // Cross-keepalive: ping MHR in the background
  keepAliveMHR().catch(() => {});

  return new MyChartClient(data.myChartJar, data.myChartCsrfToken);
}

/**
 * Load the raw session data (for check_connection and similar).
 */
export async function loadSessionData(): Promise<SessionData | null> {
  return loadSession();
}

/**
 * Format an error into a structured JSON response for Claude.
 * Includes error type, message, suggested action, and whether retrying may help.
 */
export function formatError(error: unknown): string {
  if (error instanceof AuthRequiredError) {
    return JSON.stringify({
      error: 'auth_required',
      message: error.message,
      action: 'You MUST call the connect_account tool now to sign in. It will open a browser window automatically.',
      retryable: false,
    });
  }
  if (error instanceof SessionExpiredError) {
    return JSON.stringify({
      error: 'session_expired',
      message: error.message,
      action: 'You MUST call the connect_account tool now to re-authenticate. It will open a browser window automatically.',
      retryable: false,
    });
  }
  if (error instanceof ApiError) {
    return JSON.stringify({
      error: 'api_error',
      statusCode: error.statusCode,
      message: error.message,
      retryable: error.statusCode >= 500,
    });
  }
  if (error instanceof NetworkError) {
    return JSON.stringify({
      error: 'network_error',
      message: error.message,
      retryable: true,
    });
  }
  if (error instanceof Error) {
    return JSON.stringify({
      error: 'unexpected_error',
      message: 'An unexpected error occurred. Please try again or reconnect.',
      retryable: false,
    });
  }
  return JSON.stringify({
    error: 'unexpected_error',
    message: 'An unexpected error occurred.',
    retryable: false,
  });
}
