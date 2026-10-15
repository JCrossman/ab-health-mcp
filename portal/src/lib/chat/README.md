# Chat Guardrail Layers

This document explains the cost and abuse controls layered into the chat API route.
All thresholds live in `src/lib/chat/limits.ts` — edit that file to tune without touching logic.

## Availability and activation gate

Portal deployment remains disabled. Only the exact server-side value
`PORTAL_DEPLOY_ENABLED=true` can open the application gate; never set it as part of
this remediation. Each API route checks availability before loading its handler,
auth configuration, browser launcher or provider code. Middleware and page layouts
are additional containment, not the API access-control boundary.

Activation is a separate review: verify authentication and patient isolation,
provider retention, dependency advisories, rate/cost limits, and the dormant
portal's HTTP integration. Disabled mode is containment, not proof of safe activation.
The portal runtime now requires Node 24 or newer. Use a supported Node 24 LTS
deployment image and repeat the production audit before any rollout.

### Dependency review (2026-10-14)

Coordinated upgrades: Next/ESLint config 16.4.0 (stable, not the registry's
canary-tagged `latest`), Auth.js 5.0.0-beta.32 / core 0.41.3, React 19.3.0,
AI SDK 6.0.302 with matching v3 adapters, Puppeteer core 25.12.0,
Application Insights 3.17.0, TypeScript 6.0.3 and Tailwind 4.3.3.
Puppeteer 25 is ESM-only; portal adapters now pass its imported instance to
`addExtra` rather than letting the CommonJS helper require it.

The initial `npm audit --omit=dev` reported 60 findings (3 critical, 17 high,
32 moderate, 8 low). After compatible package-manager updates the runtime audit
reports zero. A full development audit still reports five high dependency entries
for one unfixed advisory: `braces <=3.0.3`, GHSA-vfj7-8cjw-p6xm, through
`eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`.
This is developer lint pattern processing, not a production dependency; do not
lint untrusted patterns or downgrade Next's ESLint config to silence the report.
No patched braces release was available in the reviewed registry.

The legacy `/api/health/connect` shared-profile endpoint is permanently retired:
even enabling the portal returns 410, and its former launcher throws without
opening a browser or reusing a profile.
Remaining activation prerequisites include live, user-approved provider/auth
acceptance of the isolated streaming flow. Custom MCP authentication/retention must be reviewed before
use; the separate HTTP server no longer supports anonymous portal access.
No real sign-in, model invocation, health request, deployment, or stored-data
cleanup is part of these offline checks.

## Browser history

`MemoryHistory` is instantiated for one freshly verified account and page lifetime.
It uses no localStorage or sessionStorage. Account/session loss, sign-out, pagehide,
backgrounding, bfcache restore and focus revalidation invalidate the old store,
abort fetches and unmount chat state. Late responses cannot write into an invalidated
store or a new account's instance. Refresh starts empty.
Each lifetime has a distinct React subtree key, so even batched clear/reopen updates
cannot reuse an old AI SDK transport or message state.

Legacy `ab-health-conversations` and `ab-health-msgs-*` keys have no trusted owner.
They are never read/imported. The privacy/unavailable pages offer an explicit,
targeted removal button; visiting alone does not delete anything. Shipping that
removal option to existing users requires approval. It never changes Claude
Desktop history, other browser keys, provider copies or Alberta records.

## Layer 1 — System Prompt Hard-Scoping

`app/api/chat/handler.ts` includes an explicit refusal directive in the system prompt.
The LLM will politely decline any request that is not about the user's Alberta health records.

## Layer 2 — Pre-LLM Off-Topic Short-Circuit (`scope-filter.ts`)

Before calling the LLM, the last user message is tested against a conservative regex classifier.
Only clear matches (poetry, code, roleplay, jailbreaks, weather, recipes, etc.) are blocked.
Ambiguous messages pass through so the system prompt can handle them.

- **No tokens consumed** when short-circuited.
- May emit `chat.off_topic.blocked` if telemetry is explicitly enabled (no message content).
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
Requires both `PORTAL_DEPLOY_ENABLED=true` and `PORTAL_TELEMETRY_ENABLED=true`,
plus `APPLICATIONINSIGHTS_CONNECTION_STRING`. No client is initialized while disabled.

**Allowlisted technical event fields:**

| Event | Properties |
|-------|-----------|
| `chat.message.sent` | messageIndex, inputTokensEstimated |
| `chat.message.completed` | inputTokens, outputTokens, estCostUsd, latencyMs |
| `chat.off_topic.blocked` | none |
| `chat.quota.hit` | fixed quota enum |
| `chat.abuse.throttled` | none |
| `chat.error` | request/provider/unknown enum |
| `chat.suspicious_output` | none |

Unknown events/properties, free text, invalid numbers and unrecognized enum values
are discarded at runtime as well as restricted by TypeScript. User IDs and
conversation hashes are not emitted; hashes would be pseudonymous, not anonymous.
This does not claim hosting providers collect no operational metadata.
The SDK uses a private client with automatic request/dependency/exception/console
collection, web instrumentation and disk retry caching turned off.

## Offline validation

Use Node 24 LTS:

```sh
npm ci --prefix portal --ignore-scripts
npm run lint --prefix portal
(cd portal && npx tsc --noEmit)
PORTAL_DEPLOY_ENABLED=false NEXT_TELEMETRY_DISABLED=1 npm run build --prefix portal
npm audit --prefix portal --omit=dev
npm test -- tests/portal-privacy.test.ts
```

Optional UI regression (installed Chrome, isolated synthetic browser context only):
start the built app on loopback with
`PORTAL_DEPLOY_ENABLED=false NEXT_TELEMETRY_DISABLED=1 npm run start --prefix portal -- --hostname 127.0.0.1 --port 3123`,
then run
`PORTAL_BROWSER_TEST_URL=http://127.0.0.1:3123 npm test -- tests/portal-browser.test.ts`.
Stop the server after checking. The test verifies 320px/desktop rendering, no
auth/provider/browser analytics requests, and explicit targeted legacy removal
without touching unrelated synthetic keys.

## How to Adjust

1. Open `src/lib/chat/limits.ts`.
2. Change the exported constant(s).
3. Redeploy (in-memory counters reset on restart).
