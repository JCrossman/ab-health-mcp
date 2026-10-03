import { afterEach, describe, expect, it, vi } from 'vitest';
import { observeSsoLogin } from '../src/api/auth-client.js';

afterEach(() => vi.useRealTimers());

function pageObserver() {
  const on = vi.fn();
  const off = vi.fn();
  const observer = observeSsoLogin({ on, off });
  const response = on.mock.calls.find(([event]) => event === 'response')?.[1];
  const close = on.mock.calls.find(([event]) => event === 'close')?.[1];
  return { observer, response, close, off };
}

describe('SSO completion observer', () => {
  it('does not miss a returning login that completes during navigation', async () => {
    const { observer, response, off } = pageObserver();
    response({
      url: () => 'https://account.alberta.ca/app/account/services/api/is-login-token-valid',
      status: () => 200,
    });
    await expect(observer.wait()).resolves.toBeUndefined();
    expect(off).toHaveBeenCalledWith('response', expect.any(Function));
    expect(off).toHaveBeenCalledWith('close', expect.any(Function));
  });

  it('ignores similarly named responses from other domains', async () => {
    vi.useFakeTimers();
    const { observer, response } = pageObserver();
    response({ url: () => 'https://example.invalid/is-login-token-valid', status: () => 200 });
    const result = expect(observer.wait()).rejects.toMatchObject({ name: 'AuthRequiredError' });
    await vi.advanceTimersByTimeAsync(180_000);
    await result;
  });

  it('reports a closed window without waiting for a timeout', async () => {
    const { observer, close } = pageObserver();
    const result = expect(observer.wait()).rejects.toMatchObject({ name: 'AuthRequiredError' });
    close();
    await result;
  });

  it('does not continue after the window closes immediately after SSO', async () => {
    const { observer, response, close } = pageObserver();
    response({
      url: () => 'https://account.alberta.ca/app/account/services/api/is-login-token-valid',
      status: () => 200,
    });
    close();
    await expect(observer.wait()).rejects.toMatchObject({ name: 'AuthRequiredError' });
  });
});
