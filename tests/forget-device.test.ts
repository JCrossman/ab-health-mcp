import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, readdir, readFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CookieJar } from 'tough-cookie';
import { profile } from './fixtures.js';

const state = vi.hoisted(() => ({ home: '' }));
vi.mock('node:os', async original => ({ ...await original<typeof import('node:os')>(), homedir: () => state.home }));
let root: string;
let context: typeof import('../src/server/session-context.js');
let helpers: typeof import('../src/helpers/session-helpers.js');
let disconnect: typeof import('../src/tools/disconnect-account.js');
let lifecycle: typeof import('../src/auth/desktop-operation.js');
beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('No external network in synthetic tests')));
  state.home = await mkdtemp(join(tmpdir(), 'health-forget-test-'));
  root = join(state.home, '.mhr-records');
  await mkdir(join(root, 'browser-profile'), { recursive: true });
  await writeFile(join(root, 'browser-profile', 'synthetic'), 'synthetic');
  await writeFile(join(root, 'privacy-acknowledged'), 'keep');
  await writeFile(join(state.home, 'unrelated'), 'keep');
  context = await import('../src/server/session-context.js');
  helpers = await import('../src/helpers/session-helpers.js');
  disconnect = await import('../src/tools/disconnect-account.js');
  lifecycle = await import('../src/auth/desktop-operation.js');
  await helpers.sessionManager.save({ mhrJar: new CookieJar() });
});
afterEach(async () => {
  vi.restoreAllMocks();
  if (state.home) await rm(state.home, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('ordinary disconnect keeps remembered sign-in but explains that distinction', async () => {
  const result = await context.runOnDesktop(() => disconnect.disconnectAccountTool.handler());
  expect(result.isError).not.toBe(true);
  expect(result.content[0].text).toContain('may still remember');
  expect(await helpers.sessionManager.exists()).toBe(false);
  expect(await readdir(root)).toContain('browser-profile');
});

it('explicit forgetting removes only MCP credentials and dedicated profile', async () => {
  const result = await context.runOnDesktop(() => disconnect.disconnectAccountTool.handler({ forget_device: true }));
  expect(result.isError).not.toBe(true);
  expect((await readdir(root)).sort()).toEqual(['privacy-acknowledged', 'session-generation']);
  expect(await readFile(join(state.home, 'unrelated'), 'utf8')).toBe('keep');
});

it('refuses profile symlinks and active Chrome markers without claiming cleanup success', async () => {
  await writeFile(join(root, 'browser-profile', 'SingletonLock'), 'synthetic');
  let result = await context.runOnDesktop(() => disconnect.disconnectAccountTool.handler({ forget_device: true }));
  expect(result.isError).toBe(true);
  await rm(join(root, 'browser-profile'), { recursive: true });
  const other = join(state.home, 'normal-browser');
  await mkdir(other);
  await writeFile(join(other, 'sentinel'), 'keep');
  await symlink(other, join(root, 'browser-profile'));
  result = await context.runOnDesktop(() => disconnect.disconnectAccountTool.handler({ forget_device: true }));
  expect(result.isError).toBe(true);
  expect(await readFile(join(other, 'sentinel'), 'utf8')).toBe('keep');
});

it('waits for in-flight sign-in writes, then clears them before reporting success', async () => {
  let release!: () => void;
  let started!: () => void;
  const start = new Promise<void>(resolve => { started = resolve; });
  const wait = new Promise<void>(resolve => { release = resolve; });
  const write = context.runOnDesktop(() => lifecycle.withDesktopOperation(async () => {
    started();
    await wait;
    await helpers.sessionManager.save({ mhrJar: new CookieJar() });
  }));
  await start;
  const forget = context.runOnDesktop(() => disconnect.disconnectAccountTool.handler({ forget_device: true }));
  release();
  await write;
  expect((await forget).isError).not.toBe(true);
  expect((await readdir(root)).sort()).toEqual(['privacy-acknowledged', 'session-generation']);
});

it('does not let an old refresh resurrect a forgotten session', async () => {
  const myChartJar = new CookieJar();
  await helpers.sessionManager.save({ mhrJar: new CookieJar(), myChartJar, myChartCsrfToken: 'synthetic' });
  const client = await context.runOnDesktop(() => helpers.ensureMyChartSession());
  await context.runOnDesktop(() => disconnect.disconnectAccountTool.handler({ forget_device: true }));
  vi.mocked(fetch).mockResolvedValue(new Response('<input type="hidden" name="__RequestVerificationToken" value="synthetic-next">', { headers: { 'Content-Type': 'text/html' } }));
  await expect(client.refreshSession()).rejects.toMatchObject({ name: 'SessionExpiredError' });
  expect((await readdir(root)).sort()).toEqual(['privacy-acknowledged', 'session-generation']);
});

it('blocks session acquisition while forgetting waits, then invalidates the cache again', async () => {
  let release!: () => void;
  let started!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const start = new Promise<void>(resolve => { started = resolve; });
  const operation = context.runOnDesktop(() => lifecycle.withDesktopOperation(async () => {
    started();
    await wait;
  }));
  await start;
  const forget = context.runOnDesktop(() => disconnect.disconnectAccountTool.handler({ forget_device: true }));
  const load = context.runOnDesktop(() => helpers.loadSessionData());
  release();
  await operation;
  expect((await forget).isError).not.toBe(true);
  expect(await load).toBeNull();
  expect(await context.runOnDesktop(() => helpers.loadSessionData())).toBeNull();
});

it('revokes clients and persistence in another independent desktop module graph', async () => {
  await helpers.sessionManager.save({
    mhrJar: new CookieJar(), myChartJar: new CookieJar(), myChartCsrfToken: 'synthetic',
  });
  vi.resetModules();
  const secondHelpers = await import('../src/helpers/session-helpers.js');
  const secondContext = await import('../src/server/session-context.js');
  const secondData = await secondContext.runOnDesktop(() => secondHelpers.loadSessionData());
  const { MHRClient } = await import('../src/api/mhr-client.js');
  const keepalive = vi.spyOn(MHRClient.prototype, 'getSessionStatus').mockResolvedValue({
    isSessionExpired: false, numberOfMilliSecondsLeftForSessionExpire: 600_000,
  });
  const client = await secondContext.runOnDesktop(() => secondHelpers.ensureMyChartSession());
  await vi.waitFor(() => expect(keepalive).toHaveBeenCalled());
  expect(secondData).not.toBeNull();
  expect((await context.runOnDesktop(() => disconnect.disconnectAccountTool.handler({ forget_device: true }))).isError).not.toBe(true);
  vi.mocked(fetch).mockClear();
  await expect(client.refreshSession()).rejects.toMatchObject({ name: 'SessionExpiredError' });
  await expect(client.getAllergies()).rejects.toMatchObject({ name: 'SessionExpiredError' });
  await expect(secondHelpers.sessionManager.save(secondData!)).rejects.toMatchObject({ name: 'SessionExpiredError' });
  await expect(secondContext.runOnDesktop(() => secondHelpers.loadSessionData())).rejects.toMatchObject({ name: 'SessionExpiredError' });
  expect(fetch).not.toHaveBeenCalled();
  expect(await helpers.sessionManager.exists()).toBe(false);
});

it('does not automatically reclaim an abandoned lock or delete its replacement', async () => {
  const lock = join(root, 'desktop-operation.lock');
  await mkdir(lock);
  await writeFile(join(lock, 'owner'), 'synthetic-abandoned-owner');
  const result = await context.runOnDesktop(() => disconnect.disconnectAccountTool.handler({ forget_device: true }));
  expect(result.isError).toBe(true);
  expect(await readFile(join(lock, 'owner'), 'utf8')).toBe('synthetic-abandoned-owner');
});

it.each(['json', 'attachment'] as const)('does not deliver a delayed MHR %s body after forgetting', async kind => {
  const client = await context.runOnDesktop(() => helpers.ensureSession());
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const response = new Response(new ReadableStream<Uint8Array>({
    start(value) { controller = value; },
  }), { headers: { 'Content-Type': kind === 'json' ? 'application/json' : 'application/pdf' } });
  const bodyRead = kind === 'json' ? vi.spyOn(response, 'json') : vi.spyOn(response, 'arrayBuffer');
  vi.mocked(fetch).mockResolvedValue(response);
  const result = kind === 'json' ? client.getUser() : client.downloadAttachment('synthetic', 'synthetic.pdf');
  await vi.waitFor(() => expect(bodyRead).toHaveBeenCalled());
  const forget = await context.runOnDesktop(() => disconnect.disconnectAccountTool.handler({ forget_device: true }));
  expect(forget.isError).not.toBe(true);
  controller.enqueue(new TextEncoder().encode(kind === 'json' ? JSON.stringify(profile) : 'synthetic binary'));
  controller.close();
  await expect(result).rejects.toMatchObject({ name: 'SessionExpiredError' });
});
