import { describe, expect, it } from 'vitest';
import { isNewerVersion } from '../src/utils/version.js';

describe('isNewerVersion', () => {
  it('orders stable releases numerically', () => {
    expect(isNewerVersion('1.4.10', '1.4.9')).toBe(true);
    expect(isNewerVersion('1.4.1', '1.4.1')).toBe(false);
    expect(isNewerVersion('1.3.9', '1.4.0')).toBe(false);
  });

  it('never treats a stable release as newer than a later prerelease', () => {
    expect(isNewerVersion('1.4.1', '1.4.2-rc.1')).toBe(false);
  });

  it('ranks a release above its own prereleases', () => {
    expect(isNewerVersion('1.4.2', '1.4.2-rc.1')).toBe(true);
    expect(isNewerVersion('1.4.2-rc.1', '1.4.2')).toBe(false);
    expect(isNewerVersion('1.4.2-rc.2', '1.4.2-rc.1')).toBe(true);
    expect(isNewerVersion('1.4.2-rc.10', '1.4.2-rc.9')).toBe(true);
  });

  it('rejects malformed versions instead of prompting an update', () => {
    expect(isNewerVersion('latest', '1.4.1')).toBe(false);
    expect(isNewerVersion('1.5', '1.4.1')).toBe(false);
    expect(isNewerVersion('1.5.0', 'dev')).toBe(false);
  });
});
