/**
 * Authenticated, stateless HTTP MCP endpoint.
 * Transport IDs never authorize health access; every request needs its own token.
 */
import express, { type ErrorRequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { logger } from '../utils/logger.js';
import { createMcpServer } from './create-server.js';
import { HealthOAuthProvider } from './oauth-provider.js';
import { decryptTokenToSession } from './token-crypto.js';
import { runWithSession } from './session-context.js';
import { chromeCookiesToJar, type ChromeCookie } from './cookie-converter.js';
import { fetchMyChartToken } from '../api/mychart-session.js';

const PORT = parseInt(process.env.MHR_HTTP_PORT || '3001', 10);
const ISSUER_URL = process.env.MHR_ISSUER_URL || `http://localhost:${PORT}`;

export function createHttpApp(oauthProvider = new HealthOAuthProvider()) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '16kb' }));
  app.set('trust proxy', 1);

  app.use(mcpAuthRouter({
    provider: oauthProvider,
    issuerUrl: new URL(ISSUER_URL),
    scopesSupported: ['health:read'],
    serviceDocumentationUrl: new URL('https://github.com/jcrossman/ab-health-mcp'),
  }));

  const authorizeLimiter = rateLimit({
    windowMs: 60_000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please wait before trying again.' },
  });

  app.post('/authorize/cookies', authorizeLimiter, async (req, res) => {
    const { flowId, mhrCookies, myChartCookies } = req.body as {
      flowId?: string; mhrCookies?: ChromeCookie[]; myChartCookies?: ChromeCookie[];
    };
    if (typeof flowId !== 'string' || !Array.isArray(mhrCookies) || mhrCookies.length === 0) {
      res.status(400).json({ error: 'Missing flowId or cookies' });
      return;
    }
    const pending = oauthProvider.pendingAuthorizes.get(flowId);
    if (!pending) {
      res.status(400).json({ error: 'Authorization flow expired. Please try again.' });
      return;
    }
    // Consume the flow before awaiting network activity to prevent double completion.
    oauthProvider.pendingAuthorizes.delete(flowId);
    try {
      const mhrJar = await chromeCookiesToJar(mhrCookies);
      const myChartJar = Array.isArray(myChartCookies) && myChartCookies.length > 0
        ? await chromeCookiesToJar(myChartCookies) : undefined;
      let myChartCsrfToken: string | undefined;
      if (myChartJar) {
        try {
          myChartCsrfToken = await fetchMyChartToken(myChartJar);
        } catch {
          logger.warn('MyChart session could not be established');
        }
      }
      const code = randomUUID();
      oauthProvider.storeAuthCode(code, pending.client, pending.params, {
        mhrJar, myChartJar, myChartCsrfToken,
      });
      const redirectUrl = new URL(pending.params.redirectUri);
      redirectUrl.searchParams.set('code', code);
      if (pending.params.state) redirectUrl.searchParams.set('state', pending.params.state);
      oauthProvider.completedFlows.store(flowId, redirectUrl.toString());
      res.json({ success: true });
    } catch {
      logger.warn('Extension cookie processing failed');
      res.status(500).json({ error: 'Cookie processing failed. Please start sign-in again.' });
    }
  });

  app.get('/authorize/status', (req, res) => {
    const flowId = req.query.flow_id;
    res.setHeader('Cache-Control', 'no-store');
    if (typeof flowId !== 'string' || !flowId) {
      res.status(400).json({ complete: false, error: 'Missing flow_id' });
      return;
    }
    const redirectUrl = oauthProvider.completedFlows.get(flowId);
    if (redirectUrl) {
      oauthProvider.completedFlows.delete(flowId);
      res.json({ complete: true, redirect: redirectUrl });
    } else {
      res.json({ complete: false });
    }
  });

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/mcp', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', process.env.PORTAL_ORIGIN || 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-protocol-version');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
  const bearerAuth = requireBearerAuth({ verifier: oauthProvider, requiredScopes: ['health:read'] });
  app.all('/mcp', bearerAuth, async (req, res) => {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      res.status(405).json({ error: 'Stateless MCP accepts POST requests only.' });
      return;
    }
    if (!req.is('application/json')) {
      res.status(415).json({ error: 'Content-Type must be application/json.' });
      return;
    }
    let sessionData;
    try {
      sessionData = await decryptTokenToSession(req.auth!.token);
    } catch {
      res.status(401).json({ error: 'Invalid or expired authorization.' });
      return;
    }
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const server = createMcpServer('remote');
    try {
      await server.connect(transport);
      await runWithSession(sessionData, () => transport.handleRequest(req, res, req.body));
    } catch {
      logger.warn('MCP request failed');
      if (!res.headersSent) res.status(500).json({ error: 'MCP request failed.' });
    } finally {
      await server.close();
    }
  });
  const errors: ErrorRequestHandler = (_error, _req, res, _next) => {
    if (!res.headersSent) res.status(400).json({ error: 'Invalid request.' });
  };
  app.use(errors);
  return { app, oauthProvider };
}

async function main(): Promise<void> {
  const { app, oauthProvider } = createHttpApp();
  const server = app.listen(PORT, () => logger.info(`MCP HTTP server listening on port ${PORT}`));
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      oauthProvider.destroy();
      server.close(() => process.exit(0));
    });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    logger.error('HTTP server failed to start');
    process.exitCode = 1;
  });
}
