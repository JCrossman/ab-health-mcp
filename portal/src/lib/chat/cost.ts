/**
 * Global and per-user spend tracking.
 * In-memory only — suitable for beta scale.
 *
 * Pricing based on Azure OpenAI gpt-4o (2024-11-20):
 *   Input:  $2.50 / 1M tokens
 *   Output: $10.00 / 1M tokens
 */

import {
  INPUT_COST_PER_TOKEN_USD,
  OUTPUT_COST_PER_TOKEN_USD,
  DAILY_BETA_SPEND_CAP_USD,
  MONTHLY_BETA_SPEND_CAP_USD,
} from "./limits";

interface SpendBucket {
  period: string;
  totalUsd: number;
}

function utcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function utcMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

// Singleton counters — shared across all requests in this process
const globalDaily: SpendBucket = { period: utcDate(), totalUsd: 0 };
const globalMonthly: SpendBucket = { period: utcMonth(), totalUsd: 0 };
const userDailyStore = new Map<string, SpendBucket>();

function freshGlobalDaily(): SpendBucket {
  const today = utcDate();
  if (globalDaily.period !== today) {
    globalDaily.period = today;
    globalDaily.totalUsd = 0;
  }
  return globalDaily;
}

function freshGlobalMonthly(): SpendBucket {
  const month = utcMonth();
  if (globalMonthly.period !== month) {
    globalMonthly.period = month;
    globalMonthly.totalUsd = 0;
  }
  return globalMonthly;
}

function getOrCreateUserDaily(userId: string): SpendBucket {
  const today = utcDate();
  const existing = userDailyStore.get(userId);
  if (existing && existing.period === today) return existing;
  const fresh: SpendBucket = { period: today, totalUsd: 0 };
  userDailyStore.set(userId, fresh);
  return fresh;
}

/** Estimate USD cost from token counts. */
export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    inputTokens * INPUT_COST_PER_TOKEN_USD + outputTokens * OUTPUT_COST_PER_TOKEN_USD
  );
}

export type SpendQuota =
  | "global-monthly-spend"
  | "global-daily-spend"
  | "per-user-spend";

export type SpendCheckResult =
  | { allowed: true }
  | { allowed: false; quota: SpendQuota };

/**
 * Check whether a request with the given worst-case token cost can proceed.
 * Call BEFORE invoking the LLM.
 */
export function checkSpendCaps(
  userId: string,
  estimatedInputTokens: number,
  estimatedMaxOutputTokens: number,
  perUserCapUsd: number
): SpendCheckResult {
  const worstCase = estimateCostUsd(estimatedInputTokens, estimatedMaxOutputTokens);

  if (freshGlobalMonthly().totalUsd + worstCase > MONTHLY_BETA_SPEND_CAP_USD) {
    return { allowed: false, quota: "global-monthly-spend" };
  }

  if (freshGlobalDaily().totalUsd + worstCase > DAILY_BETA_SPEND_CAP_USD) {
    return { allowed: false, quota: "global-daily-spend" };
  }

  if (getOrCreateUserDaily(userId).totalUsd + worstCase > perUserCapUsd) {
    return { allowed: false, quota: "per-user-spend" };
  }

  return { allowed: true };
}

/**
 * Record actual spend after a completed LLM call.
 * @returns the cost in USD that was added.
 */
export function recordActualSpend(
  userId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const cost = estimateCostUsd(inputTokens, outputTokens);
  freshGlobalDaily().totalUsd += cost;
  freshGlobalMonthly().totalUsd += cost;
  getOrCreateUserDaily(userId).totalUsd += cost;
  return cost;
}
