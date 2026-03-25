/**
 * Token encryption/decryption for the zero-storage OAuth architecture.
 *
 * Encrypts SessionData (cookie jars + CSRF token) into a base64url-encoded
 * access token using AES-256-GCM. The token IS the encrypted session —
 * the server stores nothing.
 *
 * Same algorithm as session-manager.ts but uses a server-wide key
 * from MHR_ENCRYPTION_KEY (required for remote mode).
 */

import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { CookieJar } from 'tough-cookie';
import type { SessionData } from '../auth/session-manager.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

const SALT_DIR = join(homedir(), '.mhr-records');
const TOKEN_SALT_PATH = join(SALT_DIR, 'token-salt');

function getOrCreateTokenSalt(): Buffer {
  if (existsSync(TOKEN_SALT_PATH)) {
    return readFileSync(TOKEN_SALT_PATH);
  }
  mkdirSync(SALT_DIR, { recursive: true, mode: 0o700 });
  const salt = randomBytes(32);
  writeFileSync(TOKEN_SALT_PATH, salt, { mode: 0o600 });
  return salt;
}

let _encryptionKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (_encryptionKey) return _encryptionKey;

  const envKey = process.env.MHR_ENCRYPTION_KEY;
  if (!envKey) {
    throw new Error(
      'MHR_ENCRYPTION_KEY environment variable is required for remote mode. ' +
      'Set it to any strong passphrase (32+ characters recommended).',
    );
  }

  _encryptionKey = pbkdf2Sync(envKey, getOrCreateTokenSalt(), 100_000, 32, 'sha256');
  return _encryptionKey;
}

function encrypt(data: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: [IV (16)] [AuthTag (16)] [Encrypted data]
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64url');
}

function decrypt(token: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(token, 'base64url');

  if (data.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('Invalid token: too short');
  }

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
}

interface SerializedToken {
  version: 1;
  mhr: object;
  myChart?: object;
  myChartCsrfToken?: string;
  expiresAt: number;
}

/**
 * Encrypt SessionData into an opaque access token string.
 * The token contains the full cookie jar — the server stores nothing.
 */
export async function encryptSessionToToken(
  data: SessionData,
  expiresInSeconds = 28800, // 8 hours
): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

  const envelope: SerializedToken = {
    version: 1,
    mhr: await data.mhrJar.serialize(),
    myChart: data.myChartJar ? await data.myChartJar.serialize() : undefined,
    myChartCsrfToken: data.myChartCsrfToken,
    expiresAt,
  };

  const token = encrypt(JSON.stringify(envelope));
  return { token, expiresAt };
}

/**
 * Decrypt an access token back into SessionData.
 * Throws if the token is invalid, tampered with, or expired.
 */
export async function decryptTokenToSession(token: string): Promise<SessionData> {
  let raw: string;
  try {
    raw = decrypt(token);
  } catch {
    throw new Error('Invalid or tampered token');
  }

  const envelope: SerializedToken = JSON.parse(raw);

  if (envelope.version !== 1) {
    throw new Error(`Unsupported token version: ${envelope.version}`);
  }

  if (envelope.expiresAt < Math.floor(Date.now() / 1000)) {
    throw new Error('Token has expired');
  }

  const mhrJar = await CookieJar.deserialize(envelope.mhr);
  const myChartJar = envelope.myChart
    ? await CookieJar.deserialize(envelope.myChart)
    : undefined;

  return {
    mhrJar,
    myChartJar,
    myChartCsrfToken: envelope.myChartCsrfToken,
  };
}
