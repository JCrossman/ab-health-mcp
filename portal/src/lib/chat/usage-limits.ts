/**
 * Per-user usage tracking: daily message quota, conversation limits, and abuse throttle.
 * In-memory only — suitable for beta scale. No persistence across process restarts.
 */

import crypto from "crypto";

interface DailyBucket {
  date: string; // YYYY-MM-DD UTC
  messageCount: number;
  conversationCount: number;
  conversationKeys: Set<string>;
}

interface HourlyBucket {
  hour: number; // epoch ms floored to the hour
  offTopicCount: number;
}

interface AbuseState {
  throttledUntil: number; // epoch ms; 0 = not throttled
  lastAllowedAt: number;  // epoch ms of last allowed message (for spacing check)
}

interface ConversationTokenBucket {
  estimatedInputTokens: number;
  lastActivity: number; // epoch ms
}

const dailyStore = new Map<string, DailyBucket>();
const hourlyStore = new Map<string, HourlyBucket>();
const abuseStore = new Map<string, AbuseState>();
const conversationTokenStore = new Map<string, ConversationTokenBucket>();

function utcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentHourEpoch(): number {
  return Math.floor(Date.now() / 3_600_000) * 3_600_000;
}

function endOfUTCDay(): number {
  const d = new Date();
  d.setUTCHours(23, 59, 59, 999);
  return d.getTime();
}

function getOrCreateDaily(userId: string): DailyBucket {
  const today = utcDate();
  const existing = dailyStore.get(userId);
  if (existing && existing.date === today) return existing;
  const fresh: DailyBucket = {
    date: today,
    messageCount: 0,
    conversationCount: 0,
    conversationKeys: new Set(),
  };
  dailyStore.set(userId, fresh);
  return fresh;
}

function getOrCreateHourly(userId: string): HourlyBucket {
  const hour = currentHourEpoch();
  const existing = hourlyStore.get(userId);
  if (existing && existing.hour === hour) return existing;
  const fresh: HourlyBucket = { hour, offTopicCount: 0 };
  hourlyStore.set(userId, fresh);
  return fresh;
}

/** Hash the first message content + userId to get a stable conversation identifier. */
export function deriveConversationKey(userId: string, firstMsgContent: string): string {
  return crypto
    .createHash("sha256")
    .update(`${userId}:${firstMsgContent}`)
    .digest("hex")
    .slice(0, 16);
}

/** Rough token estimate: 1 token ≈ 4 chars */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export type UsageDenialReason =
  | "daily-messages"
  | "conversation-tokens"
  | "daily-conversations"
  | "abuse-throttle";

export interface UsageCheckResult {
  allowed: boolean;
  reason?: UsageDenialReason;
}

export interface UsageLimits {
  maxMessagesPerDay: number;
  maxTokensPerConversation: number;
  maxConversationsPerDay: number;
  abuseThrottleWindowMs: number;
}

/**
 * Check and (if allowed) record a new message attempt.
 * Call this BEFORE sending to the LLM.
 */
export function checkAndRecordMessage(
  userId: string,
  conversationKey: string,
  estimatedInputTokens: number,
  limits: UsageLimits
): UsageCheckResult {
  const now = Date.now();

  // Abuse throttle: user is blocked until throttledUntil, with 1 msg per throttleWindow
  const abuse = abuseStore.get(userId);
  if (abuse && abuse.throttledUntil > 0 && now < abuse.throttledUntil) {
    const timeSinceLast = now - (abuse.lastAllowedAt ?? 0);
    if (timeSinceLast < limits.abuseThrottleWindowMs) {
      return { allowed: false, reason: "abuse-throttle" };
    }
    // 5+ minutes have passed; allow this one message but keep them throttled
    abuse.lastAllowedAt = now;
    return { allowed: true };
  }

  const daily = getOrCreateDaily(userId);

  if (daily.messageCount >= limits.maxMessagesPerDay) {
    return { allowed: false, reason: "daily-messages" };
  }

  const isNewConversation = !daily.conversationKeys.has(conversationKey);
  if (isNewConversation && daily.conversationCount >= limits.maxConversationsPerDay) {
    return { allowed: false, reason: "daily-conversations" };
  }

  const convoStoreKey = `${userId}:${conversationKey}`;
  const convo = conversationTokenStore.get(convoStoreKey);
  const currentTokens = convo?.estimatedInputTokens ?? 0;
  if (currentTokens + estimatedInputTokens > limits.maxTokensPerConversation) {
    return { allowed: false, reason: "conversation-tokens" };
  }

  // All checks passed — record
  daily.messageCount++;
  if (isNewConversation) {
    daily.conversationCount++;
    daily.conversationKeys.add(conversationKey);
  }
  conversationTokenStore.set(convoStoreKey, {
    estimatedInputTokens: currentTokens + estimatedInputTokens,
    lastActivity: now,
  });

  if (abuse) {
    abuse.lastAllowedAt = now;
  } else {
    abuseStore.set(userId, { throttledUntil: 0, lastAllowedAt: now });
  }

  return { allowed: true };
}

/**
 * Record an off-topic block.
 * @returns true if the user just crossed the abuse threshold and should now be throttled.
 */
export function recordOffTopicBlock(
  userId: string,
  abuseThreshold: number
): boolean {
  const hourly = getOrCreateHourly(userId);
  hourly.offTopicCount++;

  if (hourly.offTopicCount >= abuseThreshold) {
    const existing = abuseStore.get(userId) ?? { throttledUntil: 0, lastAllowedAt: 0 };
    existing.throttledUntil = endOfUTCDay();
    abuseStore.set(userId, existing);
    return true;
  }

  return false;
}

// Hourly cleanup: evict stale entries
setInterval(
  () => {
    const today = utcDate();
    for (const [key, bucket] of dailyStore) {
      if (bucket.date !== today) dailyStore.delete(key);
    }
    const hour = currentHourEpoch();
    for (const [key, bucket] of hourlyStore) {
      if (bucket.hour !== hour) hourlyStore.delete(key);
    }
    const now = Date.now();
    for (const [key, bucket] of conversationTokenStore) {
      if (now - bucket.lastActivity > 24 * 3_600_000) conversationTokenStore.delete(key);
    }
    // Clean up expired abuse throttles
    for (const [, state] of abuseStore) {
      if (state.throttledUntil > 0 && now >= state.throttledUntil) {
        state.throttledUntil = 0;
      }
    }
  },
  3_600_000 // every hour
);
