import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

type Response = { status: number; headers?: Record<string, string>; body: unknown };
type Context = { res?: Response; log: { error: ReturnType<typeof vi.fn> } };
type Handler = (context: Context, request?: unknown) => Promise<void>;

function load(name: string, env: Record<string, string> = {}, storage: object = {}) {
  const module = { exports: {} };
  const require = vi.fn((dependency: string) => {
    if (dependency === '@azure/storage-blob') return storage;
    throw new Error('Unexpected API dependency');
  });
  const fetch = vi.fn().mockRejectedValue(new Error('Network forbidden'));
  const log = { error: vi.fn() };
  runInNewContext(readFileSync(new URL(`../api/${name}/index.js`, import.meta.url), 'utf8'), {
    module, require, fetch, process: { env }, Date, Buffer,
  });
  return { handler: module.exports as Handler, require, fetch, context: { log } as Context };
}

const unreadableRequest = new Proxy({}, {
  get() { throw new Error('Request details must not be read'); },
});
const env = {
  STORAGE_CONNECTION_STRING: 'AccountName=synthetic;AccountKey=c3ludGhldGlj;',
};

function storageMock() {
  const download = vi.fn().mockResolvedValue({
    readableStreamBody: Readable.from(['{"version":"2.0.0"}']),
  });
  const getBlobClient = vi.fn(() => ({ url: 'https://synthetic.blob.example/downloads/bundle.mcpb', download }));
  const getContainerClient = vi.fn(() => ({ getBlobClient }));
  const fromConnectionString = vi.fn(() => ({ getContainerClient }));
  const generate = vi.fn((_options: object, _credential: object) => ({ toString: () => 'synthetic-read-only-sas' }));
  return {
    download, getBlobClient, getContainerClient, fromConnectionString, generate,
    module: {
      BlobServiceClient: { fromConnectionString },
      StorageSharedKeyCredential: class {},
      BlobSASPermissions: { parse: vi.fn((permissions: string) => permissions) },
      SASProtocol: { Https: 'https' },
      generateBlobSASQueryParameters: generate,
    },
  };
}

describe('retired access requests and legacy links', () => {
  it.each([
    undefined,
    { body: { name: 'Synthetic Person', email: 'synthetic@example.invalid', reason: 'synthetic private reason' } },
    { body: { channel: 'portal-beta' }, headers: { 'x-admin-key': 'synthetic-admin-key' } },
    { body: 'not JSON' },
    unreadableRequest,
  ])('retires every access request without inspecting input or contacting any provider (%#)', async request => {
    const api = load('request-access', {
      ...env, BETA_INVITE_SECRET: 'synthetic', ACS_CONNECTION_STRING: 'synthetic',
      TURNSTILE_SECRET_KEY: 'synthetic', DISABLE_ACCESS_REQUESTS: 'false',
    });
    await api.handler(api.context, request);
    expect(api.context.res).toEqual({
      status: 410,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
      body: {
        error: 'Access requests and portal invitations are no longer available. Download the desktop extension directly.',
        downloadUrl: 'https://www.myaihealth.ca/api/download-latest',
      },
    });
    expect(api.require).not.toHaveBeenCalled();
    expect(api.fetch).not.toHaveBeenCalled();
    expect(api.context.log.error).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'a'.repeat(64), 'not-a-token', 'synthetic@example.invalid'])(
    'redirects old links to one fixed public path, without forwarding token %s', async token => {
      const api = load('download');
      await api.handler(api.context, { query: { token }, headers: { 'x-forwarded-for': '192.0.2.10' } });
      expect(api.context.res).toEqual({
        status: 302,
        headers: { Location: '/api/download-latest', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
        body: '',
      });
      expect(api.require).not.toHaveBeenCalled();
      expect(api.fetch).not.toHaveBeenCalled();
      expect(api.context.log.error).not.toHaveBeenCalled();
    },
  );

  it('does not even read legacy request properties', async () => {
    const api = load('download');
    await api.handler(api.context, unreadableRequest);
    expect(api.context.res?.status).toBe(302);
  });
});

describe('public installer redirect', () => {
  it('creates only a read-only HTTPS blob SAS lasting 30 minutes, without request metadata', async () => {
    const storage = storageMock();
    const api = load('download-latest', env, storage.module);
    const before = Date.now();
    await api.handler(api.context, unreadableRequest);
    expect(storage.generate).toHaveBeenCalledOnce();
    const options = storage.generate.mock.calls[0]![0] as unknown as {
      containerName: string; blobName: string; permissions: string; protocol: string; expiresOn: Date;
    };
    expect(options).toEqual({
      containerName: 'downloads', blobName: 'ab-health-mcp.mcpb',
      permissions: 'r', protocol: 'https', expiresOn: expect.any(Date),
    });
    expect(options.expiresOn.getTime()).toBeGreaterThanOrEqual(before + 30 * 60_000);
    expect(options.expiresOn.getTime()).toBeLessThanOrEqual(Date.now() + 30 * 60_000);
    expect(api.context.res).toEqual({
      status: 302,
      headers: {
        Location: 'https://synthetic.blob.example/downloads/bundle.mcpb?synthetic-read-only-sas',
        'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
      },
      body: '',
    });
    expect(api.require.mock.calls).toEqual([['@azure/storage-blob']]);
    expect(api.fetch).not.toHaveBeenCalled();
    expect(storage.download).not.toHaveBeenCalled();
    expect(api.context.log.error).not.toHaveBeenCalled();
  });

  it('keeps configured container and blob names', async () => {
    const storage = storageMock();
    const api = load('download-latest', { ...env, STORAGE_CONTAINER: 'custom', MCPB_BLOB_NAME: 'custom.mcpb' }, storage.module);
    await api.handler(api.context);
    expect(storage.getContainerClient).toHaveBeenCalledWith('custom');
    expect(storage.getBlobClient).toHaveBeenCalledWith('custom.mcpb');
  });

  it('returns an uncached 503 without storage work when not configured', async () => {
    const storage = storageMock();
    const api = load('download-latest', {}, storage.module);
    await api.handler(api.context, unreadableRequest);
    expect(api.context.res?.status).toBe(503);
    expect(api.context.res?.headers?.['Cache-Control']).toBe('no-store');
    expect(storage.fromConnectionString).not.toHaveBeenCalled();
    expect(api.context.log.error).not.toHaveBeenCalled();
  });

  it('does not log or return SDK errors, SAS URLs, credentials, or request details', async () => {
    const storage = storageMock();
    storage.fromConnectionString.mockImplementation(() => {
      throw new Error('synthetic@example.invalid https://private.invalid/?sig=synthetic-secret');
    });
    const api = load('download-latest', env, storage.module);
    await api.handler(api.context, unreadableRequest);
    expect(api.context.res?.status).toBe(500);
    expect(api.context.log.error.mock.calls).toEqual([['download-latest redirect failed']]);
    expect(JSON.stringify(api.context.res)).not.toMatch(/synthetic|sig=|private\.invalid/);
    expect(api.context.res?.headers?.['Cache-Control']).toBe('no-store');
  });
});

describe('update checks', () => {
  it('keeps the official update link and only reads public version metadata', async () => {
    const storage = storageMock();
    const api = load('check-update', env, storage.module);
    await api.handler(api.context, { query: { v: '1.0.0' } });
    expect(api.context.res).toEqual({
      status: 200,
      body: {
        updateAvailable: true, latestVersion: '2.0.0', installedVersion: '1.0.0',
        downloadUrl: 'https://www.myaihealth.ca/api/download-latest',
      },
    });
    expect(storage.getBlobClient).toHaveBeenCalledWith('version.json');
    expect(api.require.mock.calls).toEqual([['@azure/storage-blob']]);
    expect(api.fetch).not.toHaveBeenCalled();
    expect(api.context.log.error).not.toHaveBeenCalled();
  });

  it('contains raw SDK errors when checking updates', async () => {
    const storage = storageMock();
    storage.fromConnectionString.mockImplementation(() => { throw new Error('synthetic-secret'); });
    const api = load('check-update', env, storage.module);
    await api.handler(api.context, { query: { v: '1.0.0' } });
    expect(api.context.log.error.mock.calls).toEqual([['check-update failed']]);
    expect(api.context.res).toEqual({ status: 200, body: { updateAvailable: false } });
  });

  it('rejects malformed query shapes without throwing', async () => {
    const api = load('check-update', env);
    await api.handler(api.context, { query: { v: ['1.0.0'] } });
    expect(api.context.res?.status).toBe(400);
  });
});
