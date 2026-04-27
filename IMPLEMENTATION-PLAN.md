# Implementation Plan

## Status: Phase 1 + 2 Complete, MyChart Integration Complete, v1.1.28

All core infrastructure, MHR health data tools (24), and MyChart tools (20) are implemented and working. Total: 44 tools.

# Implementation Plan

## Status: Phase 1 + 2 Complete, MyChart Integration Complete, v1.1.28

All core infrastructure, MHR health data tools (24), and MyChart tools (20) are implemented and working. Total: 44 tools.

---

## 🟡 Active Workstream — Portal Chat Beta (paused, resume here)

Web-first onboarding experiment for non-technical users at `myaihealth.ca/chat`. **16 of 22 tasks done.** Portal code + Canadian infra are complete and building cleanly. Remaining work is deployment (DNS cutover, Container App wiring).

### 👉 To resume: answer these 5 questions, then tell the assistant to dispatch `migrate-swa`

1. Who controls `myaihealth.ca` DNS, and what's the current TTL on the `www` record? (Lower TTL ≥ 24h before cutover.)
2. Deploy portal into the **existing** Container App `ab-health-mcp` or a **new** one in the same environment? *(Recommended: new one — keeps the MCP server image lean, avoids bundling Chrome.)*
3. Parallel-run window between portal go-live and deleting the Central US SWA? *(Recommended: 72h to validate `.mcpb` download SAS flow over a weekend.)*
4. Can the `AZURE_SWA_TOKEN` GitHub secret be retired after migration, or is it used elsewhere?
5. Any shipped `.mcpb` versions pinned to a non-`www` hostname for `check-update`?

### What shipped

**Infrastructure (Canada Central / Canada East)**
- [x] Azure resource region audit (only `myaihealth` SWA non-Canadian)
- [x] ADR-001 selected **Option C**: collapse SWA into Container App as Next.js SSR (`docs/adr-001-swa-migration.md` — see session artifacts)
- [x] Azure OpenAI `abhealthmcp-openai-cae` (Canada East), `gpt-4o` @ 10K TPM
- [x] Key Vault `abhealthmcp-kv` (Canada Central) holds `azure-openai-key-cae` + `azure-openai-endpoint-cae`; Container App managed identity granted `Key Vault Secrets User`

**Portal code** (all builds in `portal/`)
- [x] Locked to Azure OpenAI Canada East via `PORTAL_MODEL_MODE=beta-azure-ca` (multi-provider code preserved)
- [x] `/welcome` pre-framing page (grade-6, ~450 words)
- [x] Starter-prompt chips on empty chat
- [x] 3-layer chat guardrails in `portal/src/lib/chat/`: scope filter (off-topic short-circuit, no LLM call), usage limits (50 msg/day, 20 conv/day, 30K tokens/conv, abuse throttle), cost caps (per-user $2/day, global $10/day, $100/month kill-switch)
- [x] App Insights funnel in `portal/src/lib/telemetry/events.ts` with PII-scrubbing `trackEvent`
- [x] Graceful re-auth (inline "Sign in again" button, one auto-retry of last question)
- [x] Beta invite flow: admin-gated `channel=portal-beta` on `/api/request-access`; HMAC-signed 30-day tokens; `/api/beta-invite/validate`; `scripts/send-beta-invite.ts` CLI
- [x] Streamed cloud browser auth (`/api/auth-stream`): headless Puppeteer streams CDP screencast via SSE; user sees Alberta's real login page in a canvas; credentials never touch our code. Works in Container Apps.

**Copy & accessibility**
- [x] Plain-language pass — ~32 strings rewritten to grade-6; `copy-glossary.md` at repo root
- [x] WCAG 2.2 AA audit — 28/32 findings fixed (all 12 blockers)

**Privacy/legal**
- [x] Two-path privacy story in `static/terms.html`, `portal/src/app/privacy/page.tsx`, `README.md`, `static/index.html`
- [ ] Canadian privacy lawyer review (required before public launch — not beta)

### What remains (all user-gated)

- [ ] **`migrate-swa`** — execute the Option C migration (blocked on the 5 questions above)
- [ ] **`verify-residency`** — re-audit post-migration
- [ ] **`portal-container-deploy`** — wire `APPLICATIONINSIGHTS_CONNECTION_STRING` + Key Vault secret refs (`AZURE_OPENAI_API_KEY=keyvaultref:azure-openai-key-cae`) + `AZURE_OPENAI_RESOURCE_NAME=abhealthmcp-openai-cae` + `AUTH_SECRET` + `BETA_INVITE_SECRET` + `PORTAL_MODEL_MODE=beta-azure-ca` into the Container App. Pin to 1 replica (in-memory guardrails).
- [ ] **`usability-sessions`** — recruit 5 non-technical Albertans, run moderated sessions
- [ ] **`beta-launch`** — `scripts/send-beta-invite.ts` for first wave
- [ ] **`beta-readout`** — completion rate, time-to-first-answer, drop-off map, $/user
- [ ] **`next-step-decision`** — public launch / iterate / pivot back to `.mcpb` installer polish

### Pre-deploy follow-ups

1. **Azure OpenAI abuse-monitoring opt-out** — MS retains prompts up to 30 days by default; apply for modified content filtering opt-out for regulated health workloads.
2. **Guardrail counters are in-memory** — reset on Container App restart (fine for beta; Redis/Cosmos for public).
3. **3 deferred a11y items** before beta: streaming-response SR announcements, chart alt-text (`chart-block.tsx`), mobile sidebar nav.
4. **10K TPM** on Azure OpenAI sized for 20–50 users; monitor + bump if throttled.
5. **9–12 pre-existing portal lint errors** (unrelated to this work) — separate pass.

### Session artifacts (session-local, may not survive across CLI restarts)

If the working session is still alive, extra context lives in `~/.copilot/session-state/<session-id>/files/`: `region-audit.md`, `adr-001-swa-migration.md`, `azure-openai-provisioning.md`, `keyvault-setup.md`, `a11y-audit.md`. If lost, the info above is sufficient to resume.

---

### Recent Changes (v1.1.24–v1.1.28)
- **Response formatting** — Per-tool `FORMATTING:` directives prepended as separate content blocks (table, trend_table, summary_sections, detail, grouped_tables). Server instructions slimmed to ~600 tokens.
- **Demo mode fixed** — Removed `DEMO_MODE` env var / `user_config`. Demo mode now only activates via `connect_account(demo=true)` prompt. Calling without `demo=true` always exits demo mode.
- **Update check fixed** — Single upfront check at start of `connect_account`, before any other logic. Notification is a separate content block (not buried in JSON).
- **MHR client simplified** — `fetchDateRange()` helper eliminates duplication across 18 endpoint methods (385 → 200 lines).
- **Codebase simplified** — 242 lines removed, tool descriptions standardized, server instructions reduced by ~550 tokens.

## What Was Built

### Step 1: Prove the Auth Flow ✅

**Original approach (abandoned):** Direct API calls to `account.alberta.ca` endpoints. Failed because the SSO is a 4-party SAML chain (MHR console → TELUS Health IdP → xiduam STS → Alberta SSO) with JS-rendered pages.

**Final approach:** Puppeteer opens a real Chrome window to the MHR login page. The user signs in normally through the real Alberta SSO. After login, cookies are extracted from the browser and loaded into a `tough-cookie` CookieJar for API calls.

Verified with live testing: session ✅, user profile ✅, lab results (59 entries) ✅, immunizations (11 records) ✅.

### Step 2: Build the API Client ✅

`src/api/mhr-client.ts` wraps all confirmed API endpoints:
- Session keepalive, user profile, lab results, diagnostic imaging
- Immunizations, medications, referrals
- Vital signs, blood oxygen, blood pressure, height/weight/BMI, exercise
- Procedures, blood glucose, sleep, dietary intake, insulin, peak flow
- Waist circumference, symptom journal
- Attachment download (binary PDF)
- Health overview (composite)

### Step 3: Build the MCP Server ✅

24 MHR tools registered with stdio transport. All tools follow the pattern:
1. `ensureSession()` — load encrypted cookies, verify session alive
2. Call MHR API method
3. Format response
4. Return to Claude

### Step 4: Capture More Endpoints ✅

Additional HAR captures (`Immunications.har`, `new_services.har`, `new_services_2.har`, `new_services_3.har`) verified all Phase 2 endpoints:

| Endpoint | Original CMID | Source HAR | Current Status |
|----------|---------------|------------|----------------|
| Lab Results | 7736 | Original HAR | CMID removed — works without it |
| Diagnostic Imaging | 7712 | new_services_3.har | CMID removed — works without it |
| Immunizations | 7695 | Immunications.har | CMID removed — works without it |
| Medications | 7701 → **8050** | new_services.har → mhrMedications.har | **New CMID 8050 required** |
| Referrals | 7705 | new_services.har | CMID removed — works without it |
| Vital Signs | 7730 | new_services_2.har | CMID removed — works without it |
| Blood Oxygen | 7722 | new_services_2.har | CMID removed — works without it |
| Blood Pressure | 7716 | new_services_2.har | CMID removed — works without it |
| Height | 7749 | new_services_2.har | CMID removed — works without it |
| Weight | 7750 | new_services_2.har | CMID removed — works without it |
| BMI | 7748 | new_services_2.har | CMID removed — works without it |
| Exercise | 7742 | new_services_2.har | CMID removed — works without it |
| Procedures | 7739 | new_services_3.har | CMID removed — works without it |
| Blood Glucose | 7724 | new_services_2.har | CMID removed — works without it |
| Sleep | 7757 | new_services_3.har | CMID removed — works without it |
| Dietary Intake | 7764 | new_services_3.har | CMID removed — works without it |
| Insulin (injection) | 7725 | new_services_3.har | CMID removed — works without it |
| Insulin (usage) | 7726 | new_services_3.har | CMID removed — works without it |
| Peak Flow | 7731 | new_services_3.har | CMID removed — works without it |
| Waist Circumference | 7751 | new_services_3.har | CMID removed — works without it |
| Symptom Journal | 7760 | new_services_3.har | CMID removed — works without it |

> **March 2026 API change:** Alberta removed the `Control-Mapping-Id` requirement from most endpoints. Sending old 7xxx values causes HTTP 500. Only medications requires CMID `8050` (changed from `7701`).

## Step 5: MyChart (AHS Connect Care) Integration ✅

### Overview

AHS MyChart (Connect Care) at `myahsconnect.albertahealthservices.ca/MyChartPRD/` shares Alberta's SSO with MHR. After the user logs in via Puppeteer, the browser navigates to MyChart's SAML login endpoint which auto-authenticates via the shared session.

### What Was Built

**New infrastructure:**
- `src/api/mychart-client.ts` — MyChart REST API client with cookie jar + CSRF token
- v2 session format in `session-manager.ts` — stores MHR jar + MyChart jar + CSRF token (backward compatible with v1)
- `auth-client.ts` updated to capture both MHR and MyChart sessions during SSO login

**Authentication differences from MHR:**
- MyChart uses `__RequestVerificationToken` CSRF header (not Control-Mapping-Id)
- CSRF token obtained from `GET /MyChartPRD/Home/CSRFToken`
- Most endpoints use POST with JSON or form-encoded bodies (not GET)
- MyChart auth is optional — if it fails, MHR-only session is still returned

**15 new MyChart tools (all `mc_` prefixed), plus 5 additional tools added later:**

| Tool | API Endpoint | HTTP Method |
|------|-------------|-------------|
| `mc_get_visits` | `Visits/VisitsList/LoadUpcoming` + `LoadPast` | POST (form) |
| `mc_get_health_summary` | `api/health-summary/FetchHealthSummary` | POST |
| `mc_get_allergies` | `api/allergies/LoadAllergies` | POST |
| `mc_get_health_issues` | `api/HealthIssues/LoadHealthIssuesData` | POST |
| `mc_get_care_team` | `Clinical/CareTeam/Load` | POST (form) |
| `mc_get_messages` | `api/conversations/GetConversationList` | POST |
| `mc_get_medical_history` | `api/histories/LoadHistoriesViewModel` | POST |
| `mc_get_documents` | `api/documents/viewer/LoadOtherDocuments` | POST |
| `mc_get_upcoming_orders` | `api/upcoming-orders/GetUpcomingOrders` | POST |
| `mc_get_test_results` | `api/test-results/GetList` + `GetDetails` | POST |
| `mc_get_family_tree` | `api/pedigree/LoadPedigree` | POST |
| `mc_get_goals` | `api/goals/LoadPatientGoals` + `LoadCareTeamGoals` | POST |
| `mc_get_referrals` | `api/referrals/listReferrals` | POST |
| `mc_get_medications` | `api/medications/LoadMedicationsPage` | POST |
| `mc_get_immunizations` | `api/immunizations/LoadImmunizations` | POST |
| `mc_download_document` | `api/test-results/DownloadDocumentBinary` | POST |
| `mc_get_historical_results` | `api/past-results/GetMultipleHistoricalResultComponents` | POST |
| `mc_get_appointment_requests` | `Visits/VisitsList/LoadAppointmentRequest` | POST (form) |
| `mc_list_proxy_access` | `ProxySwitch` | GET |
| `mc_switch_context` | `inside.asp?mode=proxyswitch` | Navigation |

All endpoints are relative to base URL: `https://myahsconnect.albertahealthservices.ca/MyChartPRD/`

## Step 6: Remote Mode (Implemented, Not Yet Productized)

HTTP/OAuth mode is implemented but not yet deployed to production:
1. ✅ Express HTTP server with Streamable HTTP transport (`src/server/http-index.ts`)
2. ✅ Zero server-side storage — session cookies encrypted into OAuth access token (`src/server/token-crypto.ts`)
3. ✅ OAuth 2.1 provider with auth code flow (`src/server/oauth-provider.ts`)
4. ✅ Chrome extension cookie capture for auth (`src/server/cookie-converter.ts`)
5. ✅ Azure Container Apps deployment config (Canada Central)
6. ☐ Production deployment and Claude connector registration

## Resolved Questions

1. **The `p` parameter** — Irrelevant. Puppeteer handles the full SAML chain automatically.
2. **Additional required headers** — `Control-Mapping-Id` was previously required for most data endpoints (values confirmed via HAR captures). As of March 2026, Alberta removed this requirement from most endpoints — only medications still requires CMID `8050`.
3. **Referer/Origin enforcement** — The API requires `Referer: https://myhealthrecords.alberta.ca/ng/`.
4. **Rate limiting** — `account.alberta.ca` enforces rate limiting on `/account-checks` and `/signin`. Mitigated with persistent browser profile at `~/.mhr-records/browser-profile`.
5. **MFA** — Not encountered in testing. Puppeteer would handle it natively if present.
6. **Cookie management** — `tough-cookie` works well. Cookies extracted from Puppeteer, serialized, encrypted, and replayed in API calls.
