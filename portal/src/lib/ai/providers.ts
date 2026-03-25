/**
 * API Key store for managing user's AI provider keys.
 *
 * For MVP: In-memory storage with encrypted values.
 * For production: Cosmos DB with per-user partitioning.
 */

import { encryptApiKey, decryptApiKey } from "@/lib/crypto/api-keys";

export interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  canadianHosted: boolean;
  models: string[];
  keyPlaceholder: string;
  keyPrefix?: string;
  baseUrlConfigurable?: boolean;
}

export const SUPPORTED_PROVIDERS: ProviderConfig[] = [
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o, GPT-4o-mini, o1, o3",
    canadianHosted: false,
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "o1", "o3-mini"],
    keyPlaceholder: "sk-...",
    keyPrefix: "sk-",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude Sonnet 4, Claude Opus 4",
    canadianHosted: false,
    models: ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-haiku-3-5-20241022"],
    keyPlaceholder: "sk-ant-...",
    keyPrefix: "sk-ant-",
  },
  {
    id: "google",
    name: "Google AI",
    description: "Gemini 2.5 Pro, Gemini 2.5 Flash",
    canadianHosted: false,
    models: ["gemini-2.5-pro", "gemini-2.5-flash"],
    keyPlaceholder: "AI...",
  },
  {
    id: "azure-openai",
    name: "Azure OpenAI (Canada)",
    description: "GPT-4o on Azure Canada Central — data stays in Canada 🇨🇦",
    canadianHosted: true,
    models: ["gpt-4o"],
    keyPlaceholder: "your-azure-key",
    baseUrlConfigurable: true,
  },
  {
    id: "ollama",
    name: "Ollama (Self-hosted)",
    description: "Run models locally — data never leaves your machine",
    canadianHosted: true,
    models: ["llama3.3", "mistral", "qwen2.5"],
    keyPlaceholder: "not required",
    baseUrlConfigurable: true,
  },
];

interface StoredKey {
  providerId: string;
  encryptedKey: string;
  baseUrl?: string;
  createdAt: string;
}

// Use globalThis to persist state across Next.js API route module boundaries.
// Without this, each route handler may get its own module instance with a separate Map.
const globalForProviders = globalThis as unknown as {
  _ahp_userKeys?: Map<string, Map<string, StoredKey>>;
};
if (!globalForProviders._ahp_userKeys) {
  globalForProviders._ahp_userKeys = new Map();
}
const userKeys = globalForProviders._ahp_userKeys;

export function setApiKey(
  userId: string,
  providerId: string,
  apiKey: string,
  baseUrl?: string,
): void {
  if (!userKeys.has(userId)) {
    userKeys.set(userId, new Map());
  }
  userKeys.get(userId)!.set(providerId, {
    providerId,
    encryptedKey: apiKey ? encryptApiKey(apiKey) : "",
    baseUrl,
    createdAt: new Date().toISOString(),
  });
}

export function getApiKey(userId: string, providerId: string): string | null {
  const stored = userKeys.get(userId)?.get(providerId);
  if (!stored?.encryptedKey) return null;
  return decryptApiKey(stored.encryptedKey);
}

export function getBaseUrl(userId: string, providerId: string): string | undefined {
  return userKeys.get(userId)?.get(providerId)?.baseUrl;
}

export function removeApiKey(userId: string, providerId: string): void {
  userKeys.get(userId)?.delete(providerId);
}

export function listUserProviders(userId: string): Array<{
  providerId: string;
  hasKey: boolean;
  baseUrl?: string;
  createdAt: string;
}> {
  const keys = userKeys.get(userId);
  if (!keys) return [];
  return Array.from(keys.values()).map((k) => ({
    providerId: k.providerId,
    hasKey: !!k.encryptedKey,
    baseUrl: k.baseUrl,
    createdAt: k.createdAt,
  }));
}
