import { mkdir, writeFile, readFile, unlink, rmdir, lstat } from 'node:fs/promises';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { AuthRequiredError } from '../utils/errors.js';
import { requireDesktopExecution } from '../server/session-context.js';

const directory = join(homedir(), '.mhr-records');
const lock = join(directory, 'desktop-operation.lock');
let pending: Promise<unknown> = Promise.resolve();
const owner = new AsyncLocalStorage<{ active: boolean }>();

// Never reclaim by a stale PID: another process may have replaced that lock.
// Interrupted operations fail closed until the user explicitly recovers the lock.
export function withDesktopStorageLock<T>(operation: () => Promise<T>): Promise<T> {
  if (owner.getStore()?.active) return operation();
  const result = pending.then(async () => {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const root = await lstat(directory);
    if (root.isSymbolicLink() || !root.isDirectory()) throw new AuthRequiredError('Cannot safely access desktop sign-in storage.');
    try {
      await mkdir(lock, { mode: 0o700 });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
        throw new AuthRequiredError('Desktop sign-in storage is locked. Close other MCP sign-in operations and retry. If an interrupted operation left a lock, recover only the desktop-operation.lock folder after all MCP processes are stopped.');
      }
      throw error;
    }
    const token = randomUUID();
    await writeFile(join(lock, 'owner'), token, { mode: 0o600, flag: 'wx' });
    const ownership = { active: true };
    try {
      return await owner.run(ownership, operation);
    } finally {
      ownership.active = false;
      if (await readFile(join(lock, 'owner'), 'utf8') !== token) {
        throw new AuthRequiredError('Desktop sign-in lock changed; cleanup could not complete safely.');
      }
      await unlink(join(lock, 'owner'));
      await rmdir(lock);
    }
  });
  pending = result.catch(() => {});
  return result;
}

export function withDesktopOperation<T>(operation: () => Promise<T>): Promise<T> {
  requireDesktopExecution();
  return withDesktopStorageLock(operation);
}
