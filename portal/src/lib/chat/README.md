# Chat Guardrail Layers

This document explains the cost and abuse controls layered into the chat API route.
All thresholds live in `src/lib/chat/limits.ts` — edit that file to tune without touching logic.

## Layer 1 — System Prompt Hard-Scoping

`route.ts` includes an explicit refusal directive in the system prompt.
The LLM will politely decline any request that is not about the user's Alberta health records.

## Layer 2 — Pre-LLM Off-Topic Short-Circuit (`scope-filter.ts`)

Before calling the LLM, the last user message is tested against a conservative regex classifier.
Only clear matches (poetry, code, roleplay, jailbreaks, weather, recipes, etc.) are blocked.
Ambiguous messages pass through so the system prompt can handle them.

- **No tokens consumed** when short-circuited.
- Triggers `chat.off_topic.blocked` App Insights event (reason only, never message content).
- After **5 off-topic blocks in one hour**, the user is abuse-throttled (1 msg / 5 min) for the rest of the day.

## Layer 3 — Per-User Quotas (`usage-limits.ts`)

| Limit | Default | Config key |
|-------|---------|------------|
| Messages / day | 50 | `MAX_MESSAGES_PER_DAY` |
| Conversations / day | 20 | `MAX_CONVERSATIONS_PER_DAY` |
| Input tokens / conversation | 30 000 | `MAX_TOKENS_PER_CONVERSATION` |
| Abuse throttle cooldown | 5 min | `ABUSE_THROTTLE_WINDOW_MS` |

On limit hit → HTTP 429 with a plain-language message.

## Layer 4 — Spend Caps (`cost.ts`)

Pricing constants and rolling counters (in-memory, reset with process restart).

| Cap | Default | Config key |
|-----|---------|------------|
| Per-user / day | $2 | `PER_USER_DAILY_SPEND_CAP_USD` |
| Global / day | $10 | `DAILY_BETA_SPEND_CAP_USD` |
| Global / month (kill-switch) | $100 | `MONTHLY_BETA_SPEND_CAP_USD` |

A **worst-case pre-check** (estimated input + full `DEFAULT_MAX_OUTPUT_TOKENS` output) runs before each LLM call.
Actual spend is recorded in `onFinish` using real token counts.

Monthly cap exceeded → HTTP 503, no further requests served until process restart (manual reset).

## Layer 5 — Funnel Telemetry (`telemetry/events.ts`)

App Insights custom events (server-side Node SDK, initialized in `instrumentation.ts`).
Requires `APPLICATIONINSIGHTS_CONNECTION_STRING` env var.

**Events emitted (all anonymous — no PII, no health data):**

| Event | Properties |
|-------|-----------|
| `chat.message.sent` | userHash, conversationIdHash, messageIndex, inputTokensEstimated |
| `chat.message.completed` | userHash, conversationIdHash, inputTokens, outputTokens, estCostUsd, latencyMs |
| `chat.off_topic.blocked` | userHash, reason |
| `chat.quota.hit` | userHash, quota |
| `chat.abuse.throttled` | userHash |
| `chat.error` | userHash, errorType |

A PII guard in `trackEvent` redacts any prop value longer than 64 chars or containing `@`.

## How to Adjust

1. Open `src/lib/chat/limits.ts`.
2. Change the exported constant(s).
3. Redeploy (in-memory counters reset on restart).
