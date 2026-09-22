import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCipheriv, randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CookieJar } from 'tough-cookie';
import type { SessionManager } from '../src/auth/session-manager.js';

const state = vi.hoisted(() => ({ home: '' }));
vi.mock('node:os', async importOriginal => ({
  ...await importOriginal<typeof import('node:os')>(),
  homedir: () => state.home,
}));

let manager: SessionManager;
let jar: CookieJar;
let storage: string;

beforeEach(async () => {
  vi.resetModules();
  state.home = await mkdtemp(join(tmpdir(), 'ab-health-session-test-'));
  storage = join(state.home, '.mhr-records');
  vi.stubEnv('MHR_ENCRYPTION_KEY', '');
  vi.stubEnv('LOG_LEVEL', 'error');
  const module = await import('../src/auth/session-manager.js');
  manager = new module.SessionManager();
  jar = new CookieJar();
  await jar.setCookie('synthetic-session=synthetic-value; Path=/; Secure', 'https://myhealthrecords.alberta.ca');
});

afterEach(async () => {
  await manager?.clear();
  if (state.home) await rm(state.home, { recursive: true, force: true });
  state.home = '';
  vi.unstubAllEnvs();
});

describe('encrypted session compatibility', () => {
  it('round-trips v2 cookies and a refreshed token without plaintext storage', async () => {
    const myChartJar = new CookieJar();
    await myChartJar.setCookie('synthetic-chart=synthetic-value; Path=/; Secure', 'https://myahsconnect.albertahealthservices.ca');
    await manager.save({ mhrJar: jar, myChartJar, myChartCsrfToken: 'synthetic-csrf' });
    const loaded = await manager.load();
    expect(loaded?.myChartCsrfToken).toBe('synthetic-csrf');
    expect(await loaded?.mhrJar.getCookieString('https://myhealthrecords.alberta.ca')).toContain('synthetic-session=synthetic-value');
    const encrypted = await readFile(join(storage, 'session.enc'));
    expect(encrypted.includes(Buffer.from('synthetic-csrf'))).toBe(false);
    expect(encrypted.includes(Buffer.from('synthetic-value'))).toBe(false);
    expect((await readdir(storage)).some(name => name.endsWith('.tmp'))).toBe(false);
  });

  it('loads the older v1 cookie-jar format', async () => {
    await manager.save({ mhrJar: jar });
    const key = await readFile(join(storage, 'key'));
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(await jar.serialize()), 'utf8'), cipher.final()]);
    await writeFile(join(storage, 'session.enc'), Buffer.concat([iv, cipher.getAuthTag(), encrypted]));
    const loaded = await manager.load();
    expect(loaded?.myChartJar).toBeUndefined();
    expect(await loaded?.mhrJar.getCookieString('https://myhealthrecords.alberta.ca')).toContain('synthetic-session=synthetic-value');
  });

  it('finishes pending saves before clearing the session', async () => {
    await Promise.all([
      manager.save({ mhrJar: jar }),
      manager.clear(),
    ]);
    expect(await manager.exists()).toBe(false);
  });

  it('surfaces write errors without poisoning the next operation', async () => {
    await mkdir(join(storage, 'session.enc'), { recursive: true });
    await expect(manager.save({ mhrJar: jar })).rejects.toThrow();
    await rmdir(join(storage, 'session.enc'));
    await expect(manager.save({ mhrJar: jar })).resolves.toBeUndefined();
    expect(await manager.exists()).toBe(true);
  });
});
