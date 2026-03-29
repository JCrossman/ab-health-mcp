/**
 * HTTP entry point for the Alberta Health MCP Server with OAuth 2.1.
 *
 * Serves the MCP tools via Streamable HTTP transport with OAuth authentication.
 * Supports two modes:
 *
 * 1. **Remote connector** (Claude Desktop "Add connector"):
 *    Users paste the server URL. OAuth flow opens Alberta SSO in their browser.
 *    Session cookies are encrypted INTO the access token (zero server storage).
 *
 * 2. **Portal mode** (web portal direct access):
 *    CORS-enabled /mcp endpoint with mcp-session-id headers.
 *    No OAuth — the portal handles auth via its own browser-based flow.
 *
 * Usage:
 *   MHR_HTTP_PORT=3001 MHR_ENCRYPTION_KEY=<key> node build/server/http-index.js
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { logger } from '../utils/logger.js';
import { createMcpServer } from './create-server.js';
import { HealthOAuthProvider } from './oauth-provider.js';
import { decryptTokenToSession } from './token-crypto.js';
import { sessionContext } from './session-context.js';
import { chromeCookiesToJar, type ChromeCookie } from './cookie-converter.js';

const PORT = parseInt(process.env.MHR_HTTP_PORT || '3001', 10);
const ISSUER_URL = process.env.MHR_ISSUER_URL || `http://localhost:${PORT}`;

// Map MCP session IDs → transports (for multi-session support)
const transports = new Map<string, StreamableHTTPServerTransport>();

async function main(): Promise<void> {
  logger.info('Starting Alberta Health MCP HTTP server with OAuth...');

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Trust proxy (Azure Container Apps terminates TLS at the load balancer)
  app.set('trust proxy', 1);

  // ─── OAuth Provider ─────────────────────────────────────────────────────────
  const oauthProvider = new HealthOAuthProvider();

  // Mount SDK-provided OAuth routes (discovery, registration, token)
  app.use(mcpAuthRouter({
    provider: oauthProvider,
    issuerUrl: new URL(ISSUER_URL),
    scopesSupported: ['health:read'],
    serviceDocumentationUrl: new URL('https://github.com/jcrossman/ab-health-mcp'),
  }));

  // ─── Extension cookie capture endpoint ──────────────────────────────────────
  // The Chrome extension POSTs captured cookies here after the user logs in
  // at Alberta's real portal. The server converts them to CookieJar format,
  // fetches the MyChart CSRF token, generates an auth code, and marks the
  // flow as complete for the polling authorize page.

  const authorizeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please wait a minute and try again.' },
  });

  app.post('/authorize/cookies', authorizeLimiter, async (req, res) => {
    const { flowId, mhrCookies, myChartCookies } = req.body as {
      flowId?: string;
      mhrCookies?: ChromeCookie[];
      myChartCookies?: ChromeCookie[];
    };

    if (!flowId || !mhrCookies || mhrCookies.length === 0) {
      res.status(400).json({ error: 'Missing flowId or cookies' });
      return;
    }

    // Look up the pending authorize request
    const pending = oauthProvider.pendingAuthorizes.get(flowId);
    if (!pending) {
      res.status(400).json({ error: 'Authorization flow expired. Please try again.' });
      return;
    }

    try {
      // Convert Chrome cookie objects to tough-cookie CookieJar
      const mhrJar = await chromeCookiesToJar(mhrCookies);
      const myChartJar = myChartCookies && myChartCookies.length > 0
        ? await chromeCookiesToJar(myChartCookies)
        : undefined;

      // Fetch MyChart CSRF token server-side (no PerimeterX on MyChart)
      let myChartCsrfToken: string | undefined;
      if (myChartJar) {
        try {
          const csrfUrl = 'https://myahsconnect.albertahealthservices.ca/MyChartPRD/Home/CSRFToken';
          const csrfCookies = await myChartJar.getCookieString(csrfUrl);
          const csrfResponse = await fetch(csrfUrl, {
            headers: {
              'Cookie': csrfCookies,
              'Accept': 'text/html',
              'Referer': 'https://myahsconnect.albertahealthservices.ca/MyChartPRD/Home',
            },
          });
          if (csrfResponse.ok) {
            const csrfHtml = (await csrfResponse.text()).trim();
            const match = csrfHtml.match(/value="([^"]+)"/);
            if (match) {
              myChartCsrfToken = match[1];
            } else if (!csrfHtml.includes('<')) {
              myChartCsrfToken = csrfHtml;
            }
          }
        } catch {
          logger.warn('Failed to fetch MyChart CSRF token — MyChart tools may not work');
        }
      }

      // Build session data
      const sessionData = {
        mhrJar,
        myChartJar,
        myChartCsrfToken,
      };

      // Generate auth code and store it
      const code = randomUUID();
      oauthProvider.storeAuthCode(code, pending.client, pending.params, sessionData);

      // Build redirect URL
      const redirectUrl = new URL(pending.params.redirectUri);
      redirectUrl.searchParams.set('code', code);
      if (pending.params.state) {
        redirectUrl.searchParams.set('state', pending.params.state);
      }

      // Mark flow as complete (the polling authorize page will pick this up)
      oauthProvider.completedFlows.store(flowId, redirectUrl.toString());

      // Clean up the pending authorize
      oauthProvider.pendingAuthorizes.delete(flowId);

      logger.info('Extension cookies received, auth code issued');
      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cookie processing failed';
      logger.warn(`Extension cookie processing failed: ${message}`);
      res.status(500).json({ error: 'Cookie processing failed. Please try again.' });
    }
  });

  // ─── Flow status polling endpoint ─────────────────────────────────────────
  // The authorize page polls this to detect when the extension has sent cookies.
  app.get('/authorize/status', (req, res) => {
    const flowId = req.query.flow_id as string;

    if (!flowId) {
      res.status(400).json({ complete: false, error: 'Missing flow_id' });
      return;
    }

    const redirectUrl = oauthProvider.completedFlows.get(flowId);
    if (redirectUrl) {
      // Flow is complete — return the redirect URL and clean up
      oauthProvider.completedFlows.delete(flowId);
      res.json({ complete: true, redirect: redirectUrl });
    } else {
      res.json({ complete: false });
    }
  });

  // ─── Health check ───────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', sessions: transports.size });
  });

  // ─── MCP endpoint with Bearer auth ─────────────────────────────────────────

  // Bearer auth middleware — validates the encrypted token
  const bearerAuth = requireBearerAuth({
    verifier: oauthProvider,
  });

  // CORS headers for portal access
  app.use('/mcp', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.PORTAL_ORIGIN || 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id, Authorization');
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // MCP request handler — supports both OAuth (Bearer) and portal (session-id) modes
  app.all('/mcp', async (req, res) => {
    const hasBearer = req.headers.authorization?.startsWith('Bearer ');
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    // ── OAuth mode (Claude Desktop remote connector) ──────────────────────
    if (hasBearer) {
      try {
        // Validate and decrypt the Bearer token
        await new Promise<void>((resolve, reject) => {
          bearerAuth(req, res, (err?: unknown) => {
            if (err) reject(err);
            else resolve();
          });
        });

        // Extract session data from the verified token
        const token = req.headers.authorization!.slice(7);
        const sessionData = await decryptTokenToSession(token);

        // Create a per-request transport+server (stateless — no session tracking)
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });
        const server = createMcpServer();
        await server.connect(transport);

        // Run the MCP request with the decrypted session in AsyncLocalStorage
        await sessionContext.run(sessionData, async () => {
          await transport.handleRequest(req, res);
        });

        // Clean up after request
        await server.close();
      } catch (error) {
        if (!res.headersSent) {
          const message = error instanceof Error ? error.message : 'Authentication failed';
          res.status(401).json({ error: message });
        }
      }
      return;
    }

    // ── Portal mode (mcp-session-id header, no OAuth) ─────────────────────
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
      return;
    }

    if (req.method === 'POST' && !sessionId) {
      // New portal session
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          transports.set(newSessionId, transport);
          logger.info(`MCP HTTP session created: ${newSessionId.substring(0, 8)}...`);
        },
      });

      const server = createMcpServer();
      transport.onclose = () => {
        const sid = Array.from(transports.entries())
          .find(([, t]) => t === transport)?.[0];
        if (sid) {
          transports.delete(sid);
          logger.info(`MCP HTTP session closed: ${sid.substring(0, 8)}...`);
        }
      };

      await server.connect(transport);
      await transport.handleRequest(req, res);
      return;
    }

    if (sessionId && !transports.has(sessionId)) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid or expired session.' },
        id: null,
      });
      return;
    }

    res.status(405).send('Method not allowed');
  });

  // ─── Start server ──────────────────────────────────────────────────────────
  const server = app.listen(PORT, () => {
    logger.info(`MCP HTTP server listening on port ${PORT}`);
    logger.info(`Issuer URL: ${ISSUER_URL}`);
    logger.info(`OAuth discovery: ${ISSUER_URL}/.well-known/oauth-authorization-server`);
    logger.info(`MCP endpoint: ${ISSUER_URL}/mcp`);
  });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      logger.info(`Received ${signal}, shutting down...`);
      for (const [sid, transport] of transports) {
        transport.close?.();
        transports.delete(sid);
      }
      oauthProvider.destroy();
      server.close(() => process.exit(0));
    });
  }
}

main().catch((error) => {
  logger.error(`HTTP server failed to start: ${error}`);
  process.exit(1);
});
