/**
 * Multi-user session store for HTTP transport.
 *
 * In stdio mode, session state is global (one user per process).
 * In HTTP mode, each portal user gets their own session, keyed by user ID.
 *
 * Health session cookies (MHR + MyChart) are stored per-user in memory
 * with encrypted persistence to disk (one file per user).
 *
 * This module does NOT store health data — only session cookies.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { CookieJar } from 'tough-cookie';
import { logger } from '../utils/logger.js';

const STORAGE_DIR = join(homedir(), '.mhr-records', 'sessions');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// TTL for inactive sessions (24 hours)
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface UserSessionData {
  mhrJar: CookieJar;
  myChartJar?: CookieJar;
  myChartCsrfToken?: string;
}

interface SessionEntry {
  data: UserSessionData;
  lastAccessed: number;
}

interface SerializedSession {
  version: 2;
  mhr: object;
  myChart?: object;
  myChartCsrfToken?: string;
}

let encryptionKey: Buffer | null = null;

async function ensureStorageDir(): Promise<void> {
  await mkdir(STORAGE_DIR, { recursive: true, mode: 0o700 });
}

async function getEncryptionKey(): Promise<Buffer> {
  if (encryptionKey) return encryptionKey;

  const envKey = process.env.MHR_ENCRYPTION_KEY;
  if (envKey) {
    const { pbkdf2Sync } = await import('node:crypto');
    await ensureStorageDir();
    const saltFile = join(homedir(), '.mhr-records', 'salt');
    let salt: Buffer;
    try {
      salt = await readFile(saltFile);
    } catch {
      salt = randomBytes(16);
      await writeFile(saltFile, salt, { mode: 0o600 });
    }
    encryptionKey = pbkdf2Sync(envKey, salt, 100_000, 32, 'sha256');
    return encryptionKey;
  }

  const keyFile = join(homedir(), '.mhr-records', 'key');
  await mkdir(join(homedir(), '.mhr-records'), { recursive: true, mode: 0o700 });
  try {
    const stored = await readFile(keyFile);
    if (stored.length === 32) {
      encryptionKey = stored;
      return encryptionKey;
    }
  } catch {
    // Key doesn't exist yet
  }

  const key = randomBytes(32);
  await writeFile(keyFile, key, { mode: 0o600 });
  encryptionKey = key;
  return encryptionKey;
}

function encrypt(data: string, key: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
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

function sessionFilePath(userId: string): string {
  // Hash userId to prevent path traversal and filename collisions
  const hash = createHash('sha256').update(userId).digest('hex');
  return join(STORAGE_DIR, `${hash}.enc`);
}

/**
 * In-memory session store keyed by user ID.
 * Entries auto-expire after SESSION_TTL_MS of inactivity.
 */
class UserSessionStore {
  private sessions = new Map<string, SessionEntry>();

  async get(userId: string): Promise<UserSessionData | null> {
    const entry = this.sessions.get(userId);
    if (entry) {
      if (Date.now() - entry.lastAccessed > SESSION_TTL_MS) {
        this.sessions.delete(userId);
        await this.deleteFromDisk(userId);
        return null;
      }
      entry.lastAccessed = Date.now();
      return entry.data;
    }

    // Try loading from disk
    const data = await this.loadFromDisk(userId);
    if (data) {
      this.sessions.set(userId, { data, lastAccessed: Date.now() });
    }
    return data;
  }

  async set(userId: string, data: UserSessionData): Promise<void> {
    this.sessions.set(userId, { data, lastAccessed: Date.now() });
    await this.saveToDisk(userId, data);
  }

  async delete(userId: string): Promise<void> {
    this.sessions.delete(userId);
    await this.deleteFromDisk(userId);
  }

  async has(userId: string): Promise<boolean> {
    if (this.sessions.has(userId)) return true;
    try {
      const data = await this.loadFromDisk(userId);
      return data !== null;
    } catch {
      return false;
    }
  }

  private async saveToDisk(userId: string, data: UserSessionData): Promise<void> {
    try {
      await ensureStorageDir();
      const key = await getEncryptionKey();
      const envelope: SerializedSession = {
        version: 2,
        mhr: await data.mhrJar.serialize(),
        myChart: data.myChartJar ? await data.myChartJar.serialize() : undefined,
        myChartCsrfToken: data.myChartCsrfToken,
      };
      const encrypted = encrypt(JSON.stringify(envelope), key);
      await writeFile(sessionFilePath(userId), encrypted, { mode: 0o600 });
    } catch (err) {
      logger.error(`Failed to persist session for user: ${err}`);
    }
  }

  private async loadFromDisk(userId: string): Promise<UserSessionData | null> {
    try {
      const key = await getEncryptionKey();
      const encrypted = await readFile(sessionFilePath(userId));
      const serialized = decrypt(encrypted, key);
      const parsed = JSON.parse(serialized);

      if (parsed.version === 2) {
        const mhrJar = await CookieJar.deserialize(parsed.mhr);
        const myChartJar = parsed.myChart
          ? await CookieJar.deserialize(parsed.myChart)
          : undefined;
        return { mhrJar, myChartJar, myChartCsrfToken: parsed.myChartCsrfToken };
      }

      // v1 fallback
      const mhrJar = await CookieJar.deserialize(parsed);
      return { mhrJar };
    } catch {
      return null;
    }
  }

  private async deleteFromDisk(userId: string): Promise<void> {
    try {
      await unlink(sessionFilePath(userId));
    } catch {
      // File may not exist
    }
  }

  /**
   * Remove expired sessions from memory and disk.
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [userId, entry] of this.sessions) {
      if (now - entry.lastAccessed > SESSION_TTL_MS) {
        this.sessions.delete(userId);
        await this.deleteFromDisk(userId);
      }
    }
  }
}

export const userSessionStore = new UserSessionStore();

// Run cleanup every hour
setInterval(() => {
  userSessionStore.cleanup().catch(() => {});
}, 60 * 60 * 1000).unref();
