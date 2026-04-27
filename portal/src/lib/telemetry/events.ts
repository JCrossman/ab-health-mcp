/**
 * Typed App Insights event emitter.
 *
 * All events are anonymous — no PII, no prompt content, no health data.
 * A PII guard strips any prop value longer than 64 chars or containing '@'
 * (email shape) before emission.
 */

import type { TelemetryClient } from "applicationinsights";

let _client: TelemetryClient | null = null;

/** Called once from instrumentation.ts after App Insights is initialized. */
export function setTelemetryClient(client: TelemetryClient): void {
  _client = client;
}

/** Strip values that look like PII. */
function redactPiiProps(
  props: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v.length > 64 || v.includes("@")) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[telemetry] PII guard redacted prop "${k}"`);
      }
      out[k] = "<redacted>";
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Emit a named App Insights event.
 * Props are serialized to strings; all values pass through the PII guard.
 * No-op if App Insights is not initialized.
 */
export function trackEvent(
  name: string,
  props: Record<string, string | number | boolean>
): void {
  if (!_client) return;
  const stringProps: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) {
    stringProps[k] = String(v);
  }
  _client.trackEvent({ name, properties: redactPiiProps(stringProps) });
}

// ── Typed event helpers ────────────────────────────────────────────────────

export function trackMessageSent(
  userHash: string,
  conversationIdHash: string,
  messageIndex: number,
  inputTokensEstimated: number
): void {
  trackEvent("chat.message.sent", {
    userHash,
    conversationIdHash,
    messageIndex,
    inputTokensEstimated,
  });
}

export function trackMessageCompleted(
  userHash: string,
  conversationIdHash: string,
  inputTokens: number,
  outputTokens: number,
  estCostUsd: number,
  latencyMs: number
): void {
  trackEvent("chat.message.completed", {
    userHash,
    conversationIdHash,
    inputTokens,
    outputTokens,
    estCostUsd,
    latencyMs,
  });
}

export function trackOffTopicBlocked(userHash: string, reason: string): void {
  trackEvent("chat.off_topic.blocked", { userHash, reason });
}

export function trackQuotaHit(
  userHash: string,
  quota:
    | "daily-messages"
    | "conversation-tokens"
    | "daily-conversations"
    | "per-user-spend"
    | "global-daily-spend"
    | "global-monthly-spend"
    | "abuse-throttle"
): void {
  trackEvent("chat.quota.hit", { userHash, quota });
}

export function trackAbuseThrottled(userHash: string): void {
  trackEvent("chat.abuse.throttled", { userHash });
}

export function trackChatError(userHash: string, errorType: string): void {
  trackEvent("chat.error", { userHash, errorType });
}
