/**
 * API key encryption using AES-256-GCM.
 *
 * Reuses the same encryption pattern as the MCP server's session manager.
 * Keys are encrypted at rest and only decrypted when needed for API calls.
 *
 * For MVP: stores in-memory with disk persistence.
 * For production: will use Cosmos DB with encryption.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const SALT_LENGTH = 16;
const IV_LENGTH = 16;

function deriveKey(salt: Buffer): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('API_KEY_ENCRYPTION_SECRET or AUTH_SECRET environment variable is required');
  }
  return scryptSync(secret, salt, 32);
}

export function encryptApiKey(plaintext: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(salt);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();

  // Format: salt:iv:tag:ciphertext
  return `${salt.toString("hex")}:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

export function decryptApiKey(encrypted: string): string {
  const parts = encrypted.split(":");

  // Support legacy format (iv:tag:ciphertext) with static salt
  if (parts.length === 3) {
    const [ivHex, tagHex, ciphertext] = parts;
    const legacySecret = process.env.API_KEY_ENCRYPTION_SECRET || process.env.AUTH_SECRET;
    if (!legacySecret) throw new Error("Encryption secret required");
    const key = scryptSync(legacySecret, "api-key-salt", 32);
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  // New format: salt:iv:tag:ciphertext
  const [saltHex, ivHex, tagHex, ciphertext] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const key = deriveKey(salt);
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
