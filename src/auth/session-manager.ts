/**
 * Encrypted local session storage.
 *
 * Persists session data encrypted with AES-256-GCM.
 * Storage location: ~/.mhr-records/session.enc
 *
 * Stores both MHR and MyChart sessions:
 * - MHR: tough-cookie CookieJar for myhealthrecords.alberta.ca
 * - MyChart: tough-cookie CookieJar + CSRF token for myahsconnect.albertahealthservices.ca
 *
 * Security:
 * - Only session cookies are stored — never health data
 * - AES-256-GCM with random IV per encryption
 * - Key from MHR_ENCRYPTION_KEY env var or auto-generated
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, unlink, access, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { CookieJar } from 'tough-cookie';
import { logger } from '../utils/logger.js';
import { withDesktopStorageLock } from './desktop-operation.js';
import { SessionExpiredError } from '../utils/errors.js';

const STORAGE_DIR = join(homedir(), '.mhr-records');
const SESSION_FILE = join(STORAGE_DIR, 'session.enc');
const KEY_FILE = join(STORAGE_DIR, 'key');
const SALT_FILE = join(STORAGE_DIR, 'salt');
const GENERATION_FILE = join(STORAGE_DIR, 'session-generation');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export interface SessionData {
  mhrJar: CookieJar;
  myChartJar?: CookieJar;
  myChartCsrfToken?: string;
  desktopGeneration?: string;
}

interface SerializedSessionV2 {
  version: 2;
  mhr: object;
  myChart?: object;
  myChartCsrfToken?: string;
  desktopGeneration?: string;
}

async function ensureStorageDir(): Promise<void> {
  await mkdir(STORAGE_DIR, { recursive: true, mode: 0o700 });
}

async function getEncryptionKey(): Promise<Buffer> {
  // Prefer environment variable
  const envKey = process.env.MHR_ENCRYPTION_KEY;
  if (envKey) {
    // Derive a 32-byte key using PBKDF2 with per-installation random salt
    const { pbkdf2Sync } = await import('node:crypto');
    await ensureStorageDir();
    let salt: Buffer;
    try {
      salt = await readFile(SALT_FILE);
    } catch {
      salt = randomBytes(16);
      await writeFile(SALT_FILE, salt, { mode: 0o600 });
    }
    return pbkdf2Sync(envKey, salt, 100_000, 32, 'sha256');
  }

  // Auto-generate and store a key
  await ensureStorageDir();
  try {
    const stored = await readFile(KEY_FILE);
    if (stored.length === 32) return stored;
  } catch {
    // Key doesn't exist yet
  }

  const key = randomBytes(32);
  await writeFile(KEY_FILE, key, { mode: 0o600 });
  logger.info('Generated new encryption key');
  return key;
}

function encrypt(data: string, key: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: [IV (16)] [AuthTag (16)] [Encrypted data]
  return Buffer.concat([iv, authTag, encrypted]);
}

function decrypt(data: Buffer, key: Buffer): string {
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
}

export class SessionManager {
  private queueWrite(operation: () => Promise<void>): Promise<void> {
    return withDesktopStorageLock(operation);
  }

  /**
   * Save session data (MHR + optional MyChart) to encrypted storage.
   */
  save(data: SessionData): Promise<void> {
    return this.queueWrite(() => this.writeSession(data));
  }

  private async writeSession(data: SessionData): Promise<void> {
    await ensureStorageDir();
    if (data.desktopGeneration) {
      await this.assertCurrent(data);
    } else {
      data.desktopGeneration = randomBytes(32).toString('hex');
      await writeFile(GENERATION_FILE, data.desktopGeneration, { mode: 0o600 });
    }
    const key = await getEncryptionKey();

    const envelope: SerializedSessionV2 = {
      version: 2,
      mhr: await data.mhrJar.serialize(),
      myChart: data.myChartJar ? await data.myChartJar.serialize() : undefined,
      myChartCsrfToken: data.myChartCsrfToken,
      desktopGeneration: data.desktopGeneration,
    };

    const encrypted = encrypt(JSON.stringify(envelope), key);
    const temporaryFile = join(STORAGE_DIR, `session-${randomBytes(8).toString('hex')}.tmp`);
    try {
      await writeFile(temporaryFile, encrypted, { mode: 0o600 });
      await rename(temporaryFile, SESSION_FILE);
    } finally {
      try {
        await unlink(temporaryFile);
      } catch (error) {
        if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT')) {
          logger.warn('Could not remove a temporary encrypted session file.');
        }
      }
    }
    logger.info('Session saved');
  }

  /**
   * Load session data from encrypted storage.
   * Handles both v1 (plain CookieJar) and v2 (MHR + MyChart) formats.
   * Returns null if no session exists.
   */
  async load(): Promise<SessionData | null> {
    return withDesktopStorageLock(async () => {
    try {
      const encrypted = await readFile(SESSION_FILE);
      const key = await getEncryptionKey();
      const serialized = decrypt(encrypted, key);
      const parsed = JSON.parse(serialized);
      let generation: string | undefined;
      try { generation = await readFile(GENERATION_FILE, 'utf8'); }
      catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      }
      if (generation !== undefined && generation !== parsed.desktopGeneration) return null;

      // v2 format: { version: 2, mhr: {...}, myChart?: {...}, myChartCsrfToken?: "..." }
      if (parsed.version === 2) {
        const mhrJar = await CookieJar.deserialize(parsed.mhr);
        const myChartJar = parsed.myChart
          ? await CookieJar.deserialize(parsed.myChart)
          : undefined;
        logger.info('Session loaded (v2)');
        const data: SessionData = {
          mhrJar,
          myChartJar,
          myChartCsrfToken: parsed.myChartCsrfToken,
          desktopGeneration: parsed.desktopGeneration,
        };
        if (generation === undefined) {
          data.desktopGeneration = undefined;
          await this.writeSession(data);
        }
        return data;
      }

      // v1 format: plain serialized CookieJar (backward compatibility)
      const mhrJar = await CookieJar.deserialize(parsed);
      logger.info('Session loaded (v1 — MHR only)');
      const data = { mhrJar };
      await this.writeSession(data);
      return data;
    } catch {
      return null;
    }
    });
  }

  /**
   * Check if a stored session exists.
   */
  async exists(): Promise<boolean> {
    return withDesktopStorageLock(async () => {
    try {
      await access(SESSION_FILE);
      return true;
    } catch {
      return false;
    }
    });
  }

  async assertCurrent(data: SessionData): Promise<void> {
    await withDesktopStorageLock(async () => {
      if (!data.desktopGeneration) throw new SessionExpiredError();
      let generation: string;
      try { generation = await readFile(GENERATION_FILE, 'utf8'); }
      catch { throw new SessionExpiredError(); }
      if (generation !== data.desktopGeneration) throw new SessionExpiredError();
      try { await access(SESSION_FILE); } catch { throw new SessionExpiredError(); }
    });
  }

  /**
   * Delete the stored session.
   */
  clear(): Promise<void> {
    return this.queueWrite(async () => {
      await writeFile(GENERATION_FILE, randomBytes(32).toString('hex'), { mode: 0o600 });
      try {
        await unlink(SESSION_FILE);
        logger.info('Session cleared');
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return;
        logger.error('Could not remove the saved health portal session.');
        throw error;
      }
    });
  }

  forget(): Promise<void> {
    return this.queueWrite(async () => {
      await writeFile(GENERATION_FILE, randomBytes(32).toString('hex'), { mode: 0o600 });
      for (const file of [SESSION_FILE, KEY_FILE, SALT_FILE]) {
        try {
          await unlink(file);
        } catch (error) {
          if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
            logger.error('Could not remove a saved desktop authentication file.');
            throw error;
          }
        }
      }
    });
  }
}
