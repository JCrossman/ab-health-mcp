import type { TelemetryClient } from "applicationinsights";
import { isPortalEnabled } from "../availability";

type Quota = "daily-messages" | "conversation-tokens" | "daily-conversations" |
  "per-user-spend" | "global-daily-spend" | "global-monthly-spend" | "abuse-throttle";
type Events = {
  "chat.message.sent": { messageIndex: number; inputTokensEstimated: number };
  "chat.message.completed": { inputTokens: number; outputTokens: number; estCostUsd: number; latencyMs: number };
  "chat.off_topic.blocked": Record<string, never>;
  "chat.quota.hit": { quota: Quota };
  "chat.abuse.throttled": Record<string, never>;
  "chat.error": { errorType: "request" | "provider" | "unknown" };
  "chat.suspicious_output": Record<string, never>;
};

const fields: Record<keyof Events, Record<string, "number" | readonly string[]>> = {
  "chat.message.sent": { messageIndex: "number", inputTokensEstimated: "number" },
  "chat.message.completed": { inputTokens: "number", outputTokens: "number", estCostUsd: "number", latencyMs: "number" },
  "chat.off_topic.blocked": {},
  "chat.quota.hit": { quota: ["daily-messages", "conversation-tokens", "daily-conversations", "per-user-spend", "global-daily-spend", "global-monthly-spend", "abuse-throttle"] },
  "chat.abuse.throttled": {},
  "chat.error": { errorType: ["request", "provider", "unknown"] },
  "chat.suspicious_output": {},
};

let client: Pick<TelemetryClient, "trackEvent"> | null = null;

export function isTelemetryEnabled(): boolean {
  return isPortalEnabled() && process.env.PORTAL_TELEMETRY_ENABLED === "true";
}

export function setTelemetryClient(value: Pick<TelemetryClient, "trackEvent">): void {
  client = isTelemetryEnabled() ? value : null;
}

/** No user, conversation, prompt-derived hashes, free text, URLs or health fields. */
export function trackEvent<N extends keyof Events>(name: N, props: Events[N]): void {
  if (!isTelemetryEnabled() || !client || !Object.hasOwn(fields, name)) return;
  const properties: Record<string, string> = {};
  for (const [key, rule] of Object.entries(fields[name])) {
    const value = (props as Record<string, unknown>)[key];
    if (rule === "number") {
      if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1e9) {
        properties[key] = String(value);
      }
    } else if (typeof value === "string" && rule.includes(value)) {
      properties[key] = value;
    }
  }
  client.trackEvent({ name, properties });
}

export function trackMessageSent(messageIndex: number, inputTokensEstimated: number): void {
  trackEvent("chat.message.sent", { messageIndex, inputTokensEstimated });
}

export function trackMessageCompleted(inputTokens: number, outputTokens: number, estCostUsd: number, latencyMs: number): void {
  trackEvent("chat.message.completed", { inputTokens, outputTokens, estCostUsd, latencyMs });
}

export function trackOffTopicBlocked(): void {
  trackEvent("chat.off_topic.blocked", {});
}

export function trackQuotaHit(quota: Quota): void {
  trackEvent("chat.quota.hit", { quota });
}

export function trackAbuseThrottled(): void {
  trackEvent("chat.abuse.throttled", {});
}

export function trackChatError(errorType: Events["chat.error"]["errorType"]): void {
  trackEvent("chat.error", { errorType });
}
