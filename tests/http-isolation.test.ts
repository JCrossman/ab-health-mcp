import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { CookieJar } from 'tough-cookie';
import { profile } from './fixtures.js';

const state = vi.hoisted(() => ({ home: '' }));
vi.mock('node:os', async original => ({
  ...await original<typeof import('node:os')>(),
  homedir: () => state.home,
}));

let server: Server;
let url: string;
let provider: { destroy(): void };
let tokens: string[];
let expired: string;
let helpers: typeof import('../src/helpers/session-helpers.js');

beforeAll(async () => {
  state.home = await mkdtemp(join(tmpdir(), 'health-http-test-'));
  vi.stubEnv('MHR_ENCRYPTION_KEY', 'synthetic-test-key-not-a-real-credential');
  const { encryptSessionToToken } = await import('../src/server/token-crypto.js');
  helpers = await import('../src/helpers/session-helpers.js');
  const desktopJar = new CookieJar();
  await desktopJar.setCookie('synthetic=desktop-owner; Path=/; Secure', 'https://myhealthrecords.alberta.ca');
  await helpers.sessionManager.save({ mhrJar: desktopJar });
  vi.spyOn(helpers.sessionManager, 'load');
  vi.spyOn(helpers.sessionManager, 'save').mockResolvedValue();
  vi.spyOn(helpers.sessionManager, 'clear').mockResolvedValue();
  vi.spyOn(helpers.sessionManager, 'exists').mockResolvedValue(true);
  // Health requests never leave the process; only loopback MCP uses fetch.
  tokens = [];
  for (const name of ['owner-a', 'owner-b']) {
    const jar = new CookieJar();
    await jar.setCookie(`synthetic=${name}; Path=/; Secure`, 'https://myhealthrecords.alberta.ca');
    tokens.push((await encryptSessionToToken({ mhrJar: jar })).token);
    expired = (await encryptSessionToToken({ mhrJar: jar }, -10)).token;
  }
  const nativeFetch = globalThis.fetch;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, options) => {
    const address = String(input);
    if (address.startsWith('http://127.0.0.1:')) return nativeFetch(input, options);
    if (address === 'https://myhealthrecords.alberta.ca/api/phr/v1/user') {
      const cookie = new Headers(options?.headers).get('Cookie') ?? '';
      return Response.json({ ...profile, name: cookie.includes('owner-a') ? 'Synthetic A' : 'Synthetic B' });
    }
    throw new Error('Unexpected network request in isolation test');
  });
  const { createHttpApp } = await import('../src/server/http-index.js');
  const { app, oauthProvider } = createHttpApp();
  provider = oauthProvider;
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.on('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing loopback port');
  url = `http://127.0.0.1:${address.port}/mcp`;
});

afterAll(async () => {
  provider?.destroy();
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  if (state.home) await rm(state.home, { recursive: true, force: true });
});

function call(body: unknown, token?: string, contentType = 'application/json', method = 'POST') {
  return fetch(url, {
    method,
    headers: {
      'Content-Type': contentType,
      Accept: 'application/json, text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}

const profileCall = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_user_profile', arguments: {} } };

it('denies anonymous initialize, tools, lifecycle and misleading media types even with desktop state', async () => {
  const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'synthetic', version: '1' } } };
  for (const body of [init, profileCall]) {
    expect((await call(body)).status).toBe(401);
    expect((await call(body, undefined, 'text/plain; note="application/json"')).status).toBe(401);
  }
  expect((await call({}, undefined, 'application/json', 'DELETE')).status).toBe(401);
  expect(helpers.sessionManager.load).not.toHaveBeenCalled();
});

it('isolates interleaved authenticated owners and never touches desktop storage', async () => {
  const results = await Promise.all([tokens[0], tokens[1], tokens[0]].map(async token => {
    const response = await call(profileCall, token);
    expect(response.status).toBe(200);
    expect(response.headers.get('mcp-session-id')).toBeNull();
    return await response.text();
  }));
  expect(results[0]).toContain('Synthetic A');
  expect(results[1]).toContain('Synthetic B');
  expect(results[1]).not.toContain('Synthetic A');
  expect(results[2]).toContain('Synthetic A');
  expect(helpers.sessionManager.load).not.toHaveBeenCalled();
  expect(helpers.sessionManager.save).not.toHaveBeenCalled();
});

it('rejects invalid, expired and missing tokens on every call without hanging', async () => {
  for (const token of ['invalid-synthetic', expired, undefined]) {
    expect((await call(profileCall, token)).status).toBe(401);
  }
  expect((await call(profileCall, tokens[0], 'text/plain; note="application/json"')).status).toBe(415);
});

it('does not permit remote sign-in, demo changes or desktop disconnect', async () => {
  for (const name of ['connect_account', 'disconnect_account']) {
    const response = await call({ ...profileCall, params: { name, arguments: { demo: true, forget_device: true } } }, tokens[0]);
    const data = await response.json();
    expect(data.result.isError).toBe(true);
  }
  expect(helpers.sessionManager.clear).not.toHaveBeenCalled();
});

it('supports authenticated SDK initialization and refuses reused transport IDs without a token', async () => {
  const response = await call({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'synthetic', version: '1' } },
  }, tokens[0]);
  expect(response.status).toBe(200);
  expect((await response.json()).result.serverInfo.name).toBe('ab-health-mcp');
  const stolen = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'mcp-session-id': 'synthetic-guessed-id' },
    body: JSON.stringify(profileCall),
  });
  expect(stolen.status).toBe(401);
});

it('rejects malformed JSON without echoing payloads or using desktop sessions', async () => {
  const response = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens[0]}` },
    body: '{"synthetic-private-data":',
  });
  expect(response.status).toBe(400);
  expect(await response.text()).not.toContain('synthetic-private-data');
  expect(helpers.sessionManager.load).not.toHaveBeenCalled();
});
