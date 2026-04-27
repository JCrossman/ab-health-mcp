# Copilot Instructions

## Project Overview

MCP server providing passthrough access to Alberta's My Health Records portal (`myhealthrecords.alberta.ca`) and AHS MyChart / Connect Care (`myahsconnect.albertahealthservices.ca/MyChartPRD/`). Read the spec files before writing code:

- `ARCHITECTURE.md` — System architecture, directory structure, tech stack
- `API-SPEC.md` — Reverse-engineered API endpoints and response schemas
- `MCP-TOOLS-SPEC.md` — MCP tool definitions, parameters, response formats
- `AUTH-FLOW-SPEC.md` — Cookie-based SSO authentication flow
- `COPILOT.md` — Implementation order, session lifecycle, security rules

## Build & Test

```bash
npm install
npm run build          # tsc
npm test               # vitest run
npm test -- myfile     # run a single test file by name
npm run lint           # tsc --noEmit
```

Test auth flow manually: `MHR_USERNAME=... MHR_PASSWORD=... npx tsx scripts/test-auth.ts`

## Building the .mcpb Bundle

The `.mcpb` file is the one-click installer for Claude Desktop. **Always use the `mcpb` CLI** (installed globally via `npm install -g @anthropic-ai/mcpb`) — never raw `zip`.

```bash
npm run build                          # compile TypeScript first
mcpb validate manifest.json            # check manifest is valid
mcpb pack . ab-health-mcp.mcpb         # build the bundle (~16MB)
```

The `.mcpbignore` file controls what's excluded. **Do NOT use raw `zip`** — it will include dev dependencies and inflate the bundle from 16MB to 1GB+.

After building, upload to Azure Blob Storage:
```bash
az storage blob upload \
  --account-name myaihealthdownloads --container-name downloads \
  --name ab-health-mcp.mcpb --file ab-health-mcp.mcpb \
  --overwrite --auth-mode key
```

## Architecture

```
Claude/Copilot ──MCP (stdio)──▶ MCP Server ──REST──▶ myhealthrecords.alberta.ca
                                         │     └──REST──▶ myahsconnect.albertahealthservices.ca (MyChart)
                                         │
                                         └──SSO──▶ account.alberta.ca
```

- **Transport:** stdio (local); Streamable HTTP (remote, implemented)
- **Auth:** Cookie-based via Alberta SSO — no Bearer tokens or API keys. The entire auth state lives in HTTP cookies managed by `tough-cookie`. Shared SSO authenticates both MHR and MyChart.
- **Session storage:** Encrypted local file (AES-256-GCM) for stdio; encrypted into OAuth access token for HTTP mode (zero server-side storage). Stores MHR jar + MyChart jar + CSRF token (v2 format, backward compatible with v1).
- **Session timeout:** ~10 minutes. Call `/api/phr/v1/session?SessionMode=Patient&IsKeypressed=true` to keep alive.

## Passthrough Principle

The MCP server is a pipe — it authenticates, fetches, formats, and returns. **Do not:**

- Interpret or analyze health data (normal/abnormal, trends, averages)
- Cache health data beyond the session
- Add business logic or medical assessments
- Store any health information

Claude/Copilot handles all interpretation.

## Security Constraints (Non-Negotiable)

This project handles protected health information under Alberta's HIA and POPA.

1. **Never log PII** — no names, health data, cookie values, or identifiers in logs
2. **Never store health data** — only session cookies are persisted, encrypted with AES-256-GCM
3. **Canadian data residency (our infrastructure)** — all project infrastructure in Azure Canada Central. Note: Claude (Anthropic) processes conversations on US-based servers.
4. **Credentials are transient** — used once for auth, then immediately discarded

## Key Conventions

### Tool pattern

One file per MCP tool in `src/tools/`. MHR tools follow `get-*.ts` naming, MyChart tools follow `mc-*.ts` naming (tool names prefixed with `mc_`). Every data tool follows the same structure: validate session → call API (passthrough) → format response → return. See `MCP-TOOLS-SPEC.md` for the factory pattern (`simpleMhrTool`, `mhrDateRangeTool`, `simpleMyChartTool`).

### Error handling

Use typed errors (`SessionExpiredError`, `AuthRequiredError`). Map to user-friendly messages:
- No session → "Use connect_account to sign in"
- Session expired / API 401 → "Session expired, use connect_account again"
- API 500 → "My Health Records is currently unavailable"

### Date format quirk

The lab results API uses `Date.toDateString()` format in query params (e.g., `Mon Jan 01 1753`). When accepting user dates as YYYY-MM-DD, convert with `new Date(dateStr).toDateString()` then URL-encode.

### Required headers

MHR endpoints previously required a `Control-Mapping-Id` header, but Alberta removed this requirement for most endpoints (as of March 2026). Sending the old CMID values now causes HTTP 500 errors. Only the medications endpoint still requires a CMID:
- Medications: `8050` (changed from `7701`)

MyChart endpoints need a `__RequestVerificationToken` CSRF header:
- Token obtained from `/MyChartPRD/Home/CSRFToken` during authentication
- All `mc_` prefixed tools send this header automatically via `mychart-client.ts`
- No Control-Mapping-Id needed for MyChart endpoints

### Implementation phases

Phase 1 (core): auth client, MHR REST client, session manager, connect/check/disconnect tools, lab results, user profile. ✅ **Complete.**

Phase 2: Additional MHR data tools (immunizations, medications, etc.). ✅ **Complete.**

MyChart integration: MyChart REST client, 20 `mc_` prefixed tools, shared SSO auth, v2 session format. ✅ **Complete.**

Phase 3: Remote mode — HTTP transport, zero-storage OAuth tokens, Chrome extension auth, Azure Container Apps. ✅ **Implemented** (not yet productized).

**Portal chat beta (active experiment, pre-launch):** A web-first onboarding path for non-technical users at `myaihealth.ca/chat` (the `portal/` Next.js app). Gated beta, 20–50 invited users. Uses **Azure AI Foundry Canada East only** (`PORTAL_MODEL_MODE=beta-azure-ca`). **Full resume state and remaining checklist live in `IMPLEMENTATION-PLAN.md` under "Active Workstream — Portal Chat Beta".** Kept in parallel with the `.mcpb` Claude Desktop path; not a replacement.

### Azure Infrastructure

All user-data-handling resources in `ab-health-mcp` resource group, Canada Central or Canada East. Key resources:
- **Static Web App** (`myaihealth`) — Free tier, Central US ⚠️ **migration in progress** (see ADR-001; being collapsed into the Container App as Next.js SSR for Canadian residency). Hosts landing page + `/api/request-access` today.
- **Blob Storage** (`myaihealthdownloads`) — `.mcpb` bundle distribution, Canada Central
- **Communication Services** (`myaihealth-comm`) — transactional emails, global
- **Container App** (`ab-health-mcp`) — Canada Central. Hosts remote MCP (Phase 3). System-assigned managed identity granted `Key Vault Secrets User` on `abhealthmcp-kv`. Target host for portal (ADR-001 Option C).
- **Container Registry** (`abhealthmcpacr`) — Docker images, Canada Central
- **Azure AI Foundry** (`abhealthmcp-openai-cae`) — Canada East. `gpt-4o` deployment (model 2024-11-20), 10K TPM. Only LLM for portal beta. Configure via `AZURE_AI_FOUNDRY_ENDPOINT` (preferred) or legacy `AZURE_OPENAI_RESOURCE_NAME`. Apply for abuse-monitoring opt-out before scaling beyond beta.
- **Key Vault** (`abhealthmcp-kv`) — Canada Central, RBAC-enabled. Secrets: `azure-openai-key-cae`.
- **Application Insights** (`myaihealth-insights`) — anonymous analytics on static pages + portal funnel events (server-side via Node SDK when `APPLICATIONINSIGHTS_CONNECTION_STRING` is set on the Container App)
- **Log Analytics** (`workspace-abhealthmcpnOID`) — App Insights + Container App logs, 0.5 GB/day cap
- **Budget enforcement** — $100/month with automated shutdown runbook at 90%/100% (Automation Account + Action Group)
- **Cost anomaly alert** — ML-based daily anomaly detection

### Portal guardrails (when touching `portal/src/app/api/chat/route.ts`)

The portal chat API enforces three layered guardrails. Preserve all of them when editing:
- **Scope filter** (`portal/src/lib/chat/scope-filter.ts`) — pre-LLM off-topic short-circuit returning canned redirects without calling the model.
- **Usage limits** (`portal/src/lib/chat/usage-limits.ts`) — per-user message/conversation/token/abuse quotas. In-memory for beta; thresholds in `portal/src/lib/chat/limits.ts`.
- **Cost caps** (`portal/src/lib/chat/cost.ts`) — per-user $/day + global $/day + $/month kill-switch with pre-request estimation.
- **Telemetry** (`portal/src/lib/telemetry/events.ts`) — `trackEvent` wraps App Insights and strips likely-PII (values > 64 chars or containing `@`). Never log prompt content, health data, or identifiers.
- **Feature flag** — `PORTAL_MODEL_MODE` defaults to `beta-azure-ca` (Azure AI Foundry Canada East only). Set to `multi` to re-enable BYOK multi-provider. The chat route ignores client-supplied model in beta mode; enforcement is server-side.
