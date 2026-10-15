import { afterEach, expect, it, vi } from 'vitest';
import { CookieJar } from 'tough-cookie';
import { loadSessionData, invalidateSessionCache, sessionManager } from '../src/helpers/session-helpers.js';

afterEach(() => {
  invalidateSessionCache();
  vi.restoreAllMocks();
});

it('never reads a desktop session without an explicit execution context', async () => {
  const load = vi.spyOn(sessionManager, 'load').mockResolvedValue({ mhrJar: new CookieJar() });
  await expect(loadSessionData()).rejects.toMatchObject({ name: 'AuthRequiredError' });
  expect(load).not.toHaveBeenCalled();
});
