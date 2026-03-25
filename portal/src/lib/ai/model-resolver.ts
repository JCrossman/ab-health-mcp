/**
 * Dynamic model resolver for BYOK support.
 *
 * Given a user ID and optional model preference, resolves to the
 * appropriate AI SDK LanguageModel instance using the user's stored API key.
 */

import { openai, createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAzure } from "@ai-sdk/azure";
import type { LanguageModel } from "ai";
import { getApiKey, getBaseUrl, listUserProviders, SUPPORTED_PROVIDERS } from "./providers";

interface ModelSelection {
  model: LanguageModel;
  providerId: string;
  modelId: string;
  canadianHosted: boolean;
}

const DEFAULT_MODEL = "gpt-4o";

/**
 * Resolve a LanguageModel for the given user and model preference.
 *
 * Priority:
 * 1. User's explicit model selection (if they have the key)
 * 2. First configured provider's default model
 * 3. Fall back to server's OpenAI key (OPENAI_API_KEY env var)
 */
export function resolveModel(
  userId: string,
  preferredModel?: string,
): ModelSelection {
  // Try user's preferred model
  if (preferredModel) {
    const resolved = tryResolveModel(userId, preferredModel);
    if (resolved) return resolved;
  }

  // Try user's configured providers (prefer Canadian-hosted)
  const configured = listUserProviders(userId);
  const canadianFirst = configured.sort((a, b) => {
    const provA = a.providerId === "azure-openai" || a.providerId === "ollama" ? 0 : 1;
    const provB = b.providerId === "azure-openai" || b.providerId === "ollama" ? 0 : 1;
    return provA - provB;
  });

  for (const config of canadianFirst) {
    if (!config.hasKey && config.providerId !== "ollama") continue;
    const defaultModel = getDefaultModel(config.providerId);
    if (defaultModel) {
      const resolved = tryResolveModel(userId, `${config.providerId}:${defaultModel}`);
      if (resolved) return resolved;
    }
  }

  // Fall back to server's OpenAI key
  return {
    model: openai(DEFAULT_MODEL),
    providerId: "openai",
    modelId: DEFAULT_MODEL,
    canadianHosted: false,
  };
}

function tryResolveModel(userId: string, modelSpec: string): ModelSelection | null {
  // modelSpec can be "provider:model" or just "model"
  let providerId: string;
  let modelId: string;

  if (modelSpec.includes(":")) {
    [providerId, modelId] = modelSpec.split(":", 2);
  } else {
    // Infer provider from model name
    const inferred = inferProvider(modelSpec);
    if (!inferred) return null;
    providerId = inferred;
    modelId = modelSpec;
  }

  const apiKey = getApiKey(userId, providerId);
  const baseUrl = getBaseUrl(userId, providerId);

  // For ollama, no key needed
  if (providerId === "ollama") {
    const ollama = createOpenAI({
      baseURL: baseUrl || "http://localhost:11434/v1",
      apiKey: "ollama",
    });
    return {
      model: ollama(modelId) as LanguageModel,
      providerId,
      modelId,
      canadianHosted: true,
    };
  }

  if (!apiKey) return null;

  switch (providerId) {
    case "openai": {
      const provider = createOpenAI({ apiKey });
      return {
        model: provider(modelId) as LanguageModel,
        providerId,
        modelId,
        canadianHosted: false,
      };
    }
    case "anthropic": {
      const provider = createAnthropic({ apiKey });
      return {
        model: provider(modelId) as LanguageModel,
        providerId,
        modelId,
        canadianHosted: false,
      };
    }
    case "google": {
      const provider = createGoogleGenerativeAI({ apiKey });
      return {
        model: provider(modelId) as LanguageModel,
        providerId,
        modelId,
        canadianHosted: false,
      };
    }
    case "azure-openai": {
      const provider = createAzure({
        apiKey,
        resourceName: baseUrl,
      });
      return {
        model: provider(modelId) as LanguageModel,
        providerId,
        modelId,
        canadianHosted: true,
      };
    }
    default:
      return null;
  }
}

function inferProvider(modelId: string): string | null {
  if (modelId.startsWith("gpt-") || modelId.startsWith("o1") || modelId.startsWith("o3")) return "openai";
  if (modelId.startsWith("claude-")) return "anthropic";
  if (modelId.startsWith("gemini-")) return "google";
  if (modelId.startsWith("llama") || modelId.startsWith("mistral") || modelId.startsWith("qwen")) return "ollama";
  return null;
}

function getDefaultModel(providerId: string): string | null {
  switch (providerId) {
    case "openai": return "gpt-4o";
    case "anthropic": return "claude-sonnet-4-20250514";
    case "google": return "gemini-2.5-pro";
    case "azure-openai": return "gpt-4o";
    case "ollama": return "llama3.3";
    default: return null;
  }
}

/**
 * Get available models for a user based on their configured API keys.
 */
export function getAvailableModels(userId: string): Array<{
  providerId: string;
  providerName: string;
  modelId: string;
  canadianHosted: boolean;
}> {
  const configured = listUserProviders(userId);
  const models: Array<{
    providerId: string;
    providerName: string;
    modelId: string;
    canadianHosted: boolean;
  }> = [];

  for (const config of configured) {
    const provider = SUPPORTED_PROVIDERS.find((p) => p.id === config.providerId);
    if (!provider) continue;
    if (!config.hasKey && config.providerId !== "ollama") continue;

    for (const modelId of provider.models) {
      models.push({
        providerId: provider.id,
        providerName: provider.name,
        modelId,
        canadianHosted: provider.canadianHosted,
      });
    }
  }

  return models;
}
