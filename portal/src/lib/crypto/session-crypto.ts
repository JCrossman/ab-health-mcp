/**
 * Session data encryption using AES-256-GCM with random salt.
 *
 * Encrypts health session cookies at rest in the in-memory store.
 * Each encryption uses a unique random salt + IV for maximum security.
 *
 * Format: salt:iv:tag:ciphertext (all hex-encoded)
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

const ALGORITHM = "aes-256-gcm";
const SALT_LENGTH = 16;
const IV_LENGTH = 16;

function deriveKey(salt: Buffer): Buffer {
  const secret =
    process.env.MHR_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "MHR_ENCRYPTION_KEY or AUTH_SECRET is required for session encryption"
    );
  }
  return scryptSync(secret, salt, 32);
}

export function encryptSession(plaintext: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(salt);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();

  return `${salt.toString("hex")}:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

export function decryptSession(encrypted: string): string {
  const parts = encrypted.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted session format");
  }

  const [saltHex, ivHex, tagHex, ciphertext] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const key = deriveKey(salt);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
