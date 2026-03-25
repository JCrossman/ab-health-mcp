/**
 * OAuth 2.1 Server Provider for the zero-storage MCP architecture.
 *
 * Implements OAuthServerProvider from the MCP SDK to bridge OAuth ↔ Alberta SSO.
 * All user data lives in the encrypted access token — the server stores nothing
 * persistently.
 *
 * In-memory stores (auth codes, client registrations) are ephemeral:
 * - Auth codes expire after 60 seconds
 * - Client registrations are lost on server restart (Claude auto-re-registers)
 */

import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import type { OAuthServerProvider, AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type { OAuthClientInformationFull, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { SessionData } from '../auth/session-manager.js';
import { encryptSessionToToken, decryptTokenToSession } from './token-crypto.js';
import { logger } from '../utils/logger.js';

// ─── In-memory client store ───────────────────────────────────────────────────

export class InMemoryClientsStore implements OAuthRegisteredClientsStore {
  private clients = new Map<string, OAuthClientInformationFull>();

  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    return this.clients.get(clientId);
  }

  async registerClient(
    client: OAuthClientInformationFull,
  ): Promise<OAuthClientInformationFull> {
    this.clients.set(client.client_id, client);
    logger.info(`OAuth client registered: ${client.client_name || client.client_id}`);
    return client;
  }
}

// ─── In-memory auth code store (60-second TTL) ───────────────────────────────

interface PendingAuthCode {
  client: OAuthClientInformationFull;
  params: AuthorizationParams;
  sessionData: SessionData;
  createdAt: number;
}

const AUTH_CODE_TTL_MS = 60_000;

class AuthCodeStore {
  private codes = new Map<string, PendingAuthCode>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Clean up expired codes every 30 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 30_000);
  }

  store(code: string, data: PendingAuthCode): void {
    this.codes.set(code, data);
  }

  get(code: string): PendingAuthCode | undefined {
    const data = this.codes.get(code);
    if (!data) return undefined;
    if (Date.now() - data.createdAt > AUTH_CODE_TTL_MS) {
      this.codes.delete(code);
      return undefined;
    }
    return data;
  }

  delete(code: string): void {
    this.codes.delete(code);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [code, data] of this.codes) {
      if (now - data.createdAt > AUTH_CODE_TTL_MS) {
        this.codes.delete(code);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.codes.clear();
  }
}

// ─── Pending authorize requests (between form display and form submission) ────

export interface PendingAuthorize {
  client: OAuthClientInformationFull;
  params: AuthorizationParams;
  createdAt: number;
}

const AUTHORIZE_TTL_MS = 300_000; // 5 minutes to complete login

class PendingAuthorizeStore {
  private pending = new Map<string, PendingAuthorize>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  store(id: string, data: PendingAuthorize): void {
    this.pending.set(id, data);
  }

  get(id: string): PendingAuthorize | undefined {
    const data = this.pending.get(id);
    if (!data) return undefined;
    if (Date.now() - data.createdAt > AUTHORIZE_TTL_MS) {
      this.pending.delete(id);
      return undefined;
    }
    return data;
  }

  delete(id: string): void {
    this.pending.delete(id);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, data] of this.pending) {
      if (now - data.createdAt > AUTHORIZE_TTL_MS) {
        this.pending.delete(id);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.pending.clear();
  }
}

// ─── Completed flows (between cookie POST and status poll) ────────────────────

interface CompletedFlow {
  redirectUrl: string;
  createdAt: number;
}

const COMPLETED_FLOW_TTL_MS = 120_000; // 2 minutes to complete redirect

class CompletedFlowStore {
  private flows = new Map<string, CompletedFlow>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 30_000);
  }

  store(flowId: string, redirectUrl: string): void {
    this.flows.set(flowId, { redirectUrl, createdAt: Date.now() });
  }

  get(flowId: string): string | undefined {
    const data = this.flows.get(flowId);
    if (!data) return undefined;
    if (Date.now() - data.createdAt > COMPLETED_FLOW_TTL_MS) {
      this.flows.delete(flowId);
      return undefined;
    }
    return data.redirectUrl;
  }

  delete(flowId: string): void {
    this.flows.delete(flowId);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, data] of this.flows) {
      if (now - data.createdAt > COMPLETED_FLOW_TTL_MS) {
        this.flows.delete(id);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.flows.clear();
  }
}

// ─── OAuth Server Provider ───────────────────────────────────────────────────

export class HealthOAuthProvider implements OAuthServerProvider {
  readonly clientsStore = new InMemoryClientsStore();
  private authCodes = new AuthCodeStore();
  readonly pendingAuthorizes = new PendingAuthorizeStore();
  readonly completedFlows = new CompletedFlowStore();

  /**
   * Begin the authorization flow.
   * Serves an HTML login form. The form POSTs to /authorize/login
   * with the OAuth params + user credentials.
   */
  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    // Generate a pending authorize ID and store the OAuth params
    const authorizeId = randomUUID();
    this.pendingAuthorizes.store(authorizeId, {
      client,
      params,
      createdAt: Date.now(),
    });

    // Serve the auth page (extension-based flow)
    res.setHeader('Content-Type', 'text/html');
    res.send(authPageHtml(authorizeId));
  }

  /**
   * Store an auth code after successful authentication.
   * Called by the /authorize/login handler after Puppeteer auth succeeds.
   */
  storeAuthCode(
    code: string,
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    sessionData: SessionData,
  ): void {
    this.authCodes.store(code, {
      client,
      params,
      sessionData,
      createdAt: Date.now(),
    });
  }

  /**
   * Return the PKCE code challenge for an authorization code.
   */
  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const data = this.authCodes.get(authorizationCode);
    if (!data) {
      throw new Error('Invalid or expired authorization code');
    }
    return data.params.codeChallenge;
  }

  /**
   * Exchange an authorization code for an access token.
   * The token IS the encrypted session (zero-storage).
   */
  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<OAuthTokens> {
    const data = this.authCodes.get(authorizationCode);
    if (!data) {
      throw new Error('Invalid or expired authorization code');
    }

    if (data.client.client_id !== client.client_id) {
      throw new Error('Authorization code was not issued to this client');
    }

    // Delete the code (one-time use)
    this.authCodes.delete(authorizationCode);

    // Encrypt the session cookies INTO the access token
    const { token, expiresAt } = await encryptSessionToToken(data.sessionData);
    const expiresIn = expiresAt - Math.floor(Date.now() / 1000);

    logger.info('Token issued (session encrypted into token, zero storage)');

    return {
      access_token: token,
      token_type: 'bearer',
      expires_in: expiresIn,
    };
  }

  /**
   * Refresh tokens are not supported in zero-storage mode.
   * Users re-authenticate when the session expires.
   */
  async exchangeRefreshToken(): Promise<OAuthTokens> {
    throw new Error('Refresh tokens are not supported. Please re-authenticate.');
  }

  /**
   * Verify an access token by decrypting it.
   * The decrypted session data is stored in AuthInfo.extra for downstream use.
   */
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const sessionData = await decryptTokenToSession(token);

    return {
      token,
      clientId: 'verified',
      scopes: ['health:read'],
      extra: { sessionData },
    };
  }

  destroy(): void {
    this.authCodes.destroy();
    this.pendingAuthorizes.destroy();
    this.completedFlows.destroy();
  }
}

// ─── Extension Auth Page HTML ─────────────────────────────────────────────────

function authPageHtml(authorizeId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign In — Alberta Health Records</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #1e293b;
      border-radius: 12px;
      padding: 2rem;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.3);
    }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p.desc { color: #94a3b8; font-size: 0.875rem; margin-bottom: 1.5rem; line-height: 1.5; }
    .shield { text-align: center; margin-bottom: 1.25rem; font-size: 2rem; }
    .btn-primary {
      display: block;
      width: 100%;
      padding: 0.875rem;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      text-align: center;
      transition: background 0.15s;
    }
    .btn-primary:hover { background: #2563eb; }
    .status {
      margin-top: 1.25rem;
      padding: 0.75rem;
      border-radius: 8px;
      font-size: 0.875rem;
      text-align: center;
    }
    .status-waiting {
      background: #1e3a5f;
      color: #93c5fd;
    }
    .status-success {
      background: #14532d;
      color: #86efac;
    }
    .status-error {
      background: #450a0a;
      color: #fca5a5;
    }
    .ext-missing {
      margin-top: 1.25rem;
      padding: 1rem;
      background: #312e81;
      border-radius: 8px;
      font-size: 0.8125rem;
      color: #c7d2fe;
      line-height: 1.5;
      display: none;
    }
    .ext-missing a { color: #a5b4fc; }
    .ext-detected {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.8125rem;
      color: #86efac;
      margin-top: 0.5rem;
    }
    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid #334155;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      vertical-align: middle;
      margin-right: 0.375rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .info { font-size: 0.75rem; color: #64748b; text-align: center; margin-top: 1rem; line-height: 1.5; }
    .steps { list-style: none; margin-bottom: 1.5rem; }
    .steps li {
      padding: 0.5rem 0;
      padding-left: 1.75rem;
      position: relative;
      color: #cbd5e1;
      font-size: 0.875rem;
    }
    .steps li::before {
      content: attr(data-step);
      position: absolute;
      left: 0;
      width: 1.25rem;
      height: 1.25rem;
      background: #334155;
      border-radius: 50%;
      text-align: center;
      line-height: 1.25rem;
      font-size: 0.75rem;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="shield">🛡️</div>
    <h1>Alberta Health Records</h1>
    <p class="desc">Connect your health records to Claude using the browser extension.</p>

    <ol class="steps">
      <li data-step="1">Click the button below to open Alberta's login portal</li>
      <li data-step="2">Sign in with your MyAlberta Digital ID</li>
      <li data-step="3">The extension will automatically capture your session</li>
    </ol>

    <a href="https://myhealthrecords.alberta.ca" target="_blank" rel="noopener" class="btn-primary" id="loginBtn">
      Sign in at Alberta Health
    </a>

    <div id="extDetected" class="ext-detected" style="display:none">
      ✓ Extension connected
    </div>

    <div id="extMissing" class="ext-missing">
      <strong>Extension not detected.</strong><br>
      Install the <a href="https://github.com/jcrossman/ab-health-mcp#chrome-extension" target="_blank">Alberta Health MCP Connector</a> extension, then refresh this page.
    </div>

    <div id="status" class="status status-waiting" style="display:none">
      <span class="spinner"></span> Waiting for sign-in...
    </div>

    <p class="info">
      Your credentials go directly to Alberta's official portal.<br>
      This server never sees or stores your password.
    </p>
  </div>

  <div data-flow-id="${authorizeId}" id="flowData"></div>

  <script>
    const flowId = document.getElementById('flowData').dataset.flowId;
    const statusEl = document.getElementById('status');
    const extDetected = document.getElementById('extDetected');
    const extMissing = document.getElementById('extMissing');
    let polling = false;

    // Detect extension via DOM attribute set by content.js
    setTimeout(() => {
      if (document.documentElement.dataset.abHealthExt === 'true') {
        extDetected.style.display = 'inline-flex';
      } else {
        extMissing.style.display = 'block';
      }
    }, 1500);

    // Start polling when user clicks the login button
    document.getElementById('loginBtn').addEventListener('click', () => {
      if (polling) return;
      polling = true;
      statusEl.style.display = 'block';
      pollStatus();
    });

    async function pollStatus() {
      try {
        const resp = await fetch('/authorize/status?flow_id=' + encodeURIComponent(flowId));
        const data = await resp.json();

        if (data.complete && data.redirect) {
          statusEl.className = 'status status-success';
          statusEl.innerHTML = '✓ Authenticated! Redirecting to Claude...';
          setTimeout(() => { window.location.href = data.redirect; }, 500);
          return;
        }
      } catch {
        // Network error — keep polling
      }

      setTimeout(pollStatus, 2000);
    }
  </script>
</body>
</html>`;
}
