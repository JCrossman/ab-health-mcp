# Implementation Plan

## Status: v1.2.0 — Demo Mode v2 (4-persona sandwich-generation)

All core infrastructure, MHR health data tools (24), MyChart tools (20), and a stateful 4-persona demo mode are implemented. Total: 44 tools.

---

## 🟢 Active Workstream — Demo Mode v2 + Find-a-Provider

Major demo upgrade: demo mode is now **stateful and multi-persona**. Four interconnected personas (Demo User / Margaret User / Sarah User / Liam User) representing a sandwich-generation household are loaded simultaneously. `mc_switch_context` mutates the active persona so all MHR + MyChart tools follow the switch, enabling cross-person reasoning (e.g., "compare HbA1c trends between me and my mom").

Find-a-Provider — a new tool family for searching `albertafindaprovider.ca` — is **paused** waiting for a user-supplied HAR capture.

### What shipped (this workstream)

- [x] **Demo refactor** — `src/helpers/demo-data.ts` (1734-line monolith) split into `src/helpers/demo/{index,context,clients,shared}.ts` + `personas/{self,mother,spouse,child}.ts`. Self persona migrated 1:1, behavior identical.
- [x] **Stateful clients** — `src/helpers/demo/clients.ts` wraps `MHRClient` / `MyChartClient` in a `Proxy` that late-binds every method call to the currently active persona. Adding a new persona requires zero edits to the client file.
- [x] **Switch wires** — `switchToProxy(eid)` / `switchToSelf()` mutate the active-persona singleton. `getProxyAccessList()` and `getUser()`'s `authorizedRecords` reflect all four personas. `mc_switch_context` response carries a demo-mode `note` documenting the MHR-follows-switch divergence.
- [x] **Persona: Mother** — Margaret User (72F): T2D + AFib + HFpEF + mild Alzheimer-type dementia + CKD3a + osteoarthritis + chronic pain. 12 active meds (polypharmacy), recent ED visit for AFib RVR + post-fall Oct 2024, donepezil + metoprolol bradycardia signal, glipizide hypos. Care team: family doc, cardiologist, endocrinologist, neurologist (cognitive), geriatrician. (`src/helpers/demo/personas/mother.ts`, ~1519 lines, commit `35afff6`)
- [x] **Persona: Spouse** — Sarah User (41F): Hashimoto hypothyroidism, GAD on sertraline, migraine with aura on topiramate, perimenopause with hormone panel, Mirena IUD (Mar 2024), penicillin allergy, recent normal mammo/Pap. *Limited* proxy access (deliberately differentiated from Mother's Full). Caregiver-burnout thread to family doc referencing helping with Margaret's Oct 2024 fall. (`src/helpers/demo/personas/spouse.ts`, ~1134 lines, commit `1ef85b5`)
- [x] **Persona: Child** — Liam User (7M, DOB 2017-05-14 matches Sarah's documented vaginal delivery date): mild persistent asthma w/ recent ED visit, ADHD on Concerta (pre-stimulant ECG documented), peanut allergy + EpiPen, seasonal allergic rhinitis, recent strep treated with amoxicillin (explicit "penicillin tolerated" allergy entry so AI doesn't inherit mother's PCN allergy). Full custodial proxy. (`src/helpers/demo/personas/child.ts`, ~1058 lines, commit `c7d3d43`)
- [x] **Persona: Self refresh** — `getMedicalHistory` and `getFamilyTree` in self.ts updated so Mother family-history entry references Margaret by name with her full active condition list, and the family tree includes Sarah (spouse) and Liam (son) with their conditions. Enables consistent cross-persona reasoning. (commit `8860e73`)

### What remains (in this workstream)

- [ ] **`fap-har-intake`** — **BLOCKED ON USER** supplying HAR capture of `albertafindaprovider.ca/find-a-doc/map` interactions (search, filter, marker click, detail view). Mine endpoints, request/response shapes, pagination, geolocation handling. Document discovered endpoints in `API-SPEC.md`.
- [ ] **`fap-tool-design`** — Decide tool surface based on HAR. Default proposal: `find_provider` (search/filter) + `get_provider_details` (full profile by ID).
- [ ] **`fap-client`** — Implement `src/api/find-a-provider-client.ts` (plain `fetch`, no cookie jar, no auth — public site).
- [ ] **`fap-tools`** — Tool files in `src/tools/`. Bypass `isDemoMode()` — always hits real site.
- [ ] **`fap-register`** — Register in `src/server/create-server.ts`.
- [ ] **Version bump + .mcpb release for v1.3.0** when find-a-provider lands.

### Decisions / rationale

- **Why split demo mode into per-persona files?** A 4-persona demo at the richness level of the original Self persona would push a single file past 6000 lines. Per-persona files (~1000–1500 lines each) keep editing manageable and let us add a 5th persona later without touching shared code.
- **Why MHR-follows-switch divergence?** Real MHR pins `selectedRecordId` at SSO sign-in. If demo MHR did the same, asking "show Margaret's labs" would silently return Self's data after a MyChart switch. The divergence is documented in the tool's response `note` and in `COPILOT.md`.
- **Why differentiate Spouse access (Limited vs Full)?** Demonstrates the real-world proxy access tier distinction that exists in AHS Connect Care. AI agents need to know how to handle "limited" responses gracefully.
- **Why always-real find-a-provider, even in demo mode?** Provider data is public (no PHI), and calling the real API validates the integration is wired correctly even when the rest of the data is synthetic.

### Released as

- **v1.2.0** — 4-persona demo mode (this workstream's persona work)
- **v1.3.0 (planned)** — adds find-a-provider tool family

---

## 🟡 Parked Workstream — Portal Chat Beta (paused pre-launch)

Web-first onboarding experiment for non-technical users at `myaihealth.ca/chat`. **16 of 22 tasks done.** Portal code + Canadian infra are complete and building cleanly. Remaining work is deployment (DNS cutover, Container App wiring).

### 👉 DNS/Infra Questions — Answered

1. **DNS TTL** — Lower `www` CNAME TTL to 300s at least 24h before cutover. (Owner needs to action this.)
2. **Container App** — Use a **new** Container App for the portal. The existing `ab-health-mcp` runs the MCP HTTP server; bundling Chrome (~400MB) would bloat it. Create `ab-health-portal` in the same environment.
3. **Parallel-run window** — 72h. Keep the SWA alive during this window to validate `.mcpb` download SAS flow and `check-update` API. The MCP tool's update check points to `www.myaihealth.ca/api/check-update` (line 25 of `connect-account.ts`).
4. **AZURE_SWA_TOKEN** — Used only in `.github/workflows/ci-cd.yml:88` for the SWA deploy step. Can be retired after migration; replace with portal container deploy step.
5. **Hostname pinning** — The update check URL in `connect-account.ts` uses `www.myaihealth.ca`. All shipped `.mcpb` versions point there. After migration, `www.myaihealth.ca` must still resolve and serve `/api/check-update` + `/api/download-latest`.

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

### Azure Cutover Procedure — Zero-Downtime SWA → Container App Migration

Migrate `www.myaihealth.ca` from Azure Static Web App to a **new** Container App (`ab-health-portal`) running the Next.js portal as SSR. The existing `ab-health-mcp` Container App (MCP HTTP server) is unchanged.

**Target state:**

| Component | Where | URL |
|-----------|-------|-----|
| Landing page + Chat + API functions | Container App (`ab-health-portal`) | `www.myaihealth.ca` → Container App |
| .mcpb bundle | Azure Blob Storage (unchanged) | Same SAS URLs |
| MCP server (Phase 3) | Container App (`ab-health-mcp`, unchanged) | Not public-facing |

**Critical dependency:** The `.mcpb` extension installed on users' machines calls `https://www.myaihealth.ca/api/check-update?v=X.X.X` and `https://www.myaihealth.ca/api/download-latest`. These **must keep working** during and after cutover.

#### Phase 0: Pre-cutover prep (day before)

1. **Lower DNS TTL** to 300s (5 min) on the `www` CNAME record. Wait 24h for old TTL to expire from caches.
2. **Port SWA API functions to Next.js routes:**
   - `api/check-update` → `portal/src/app/api/check-update/route.ts`
   - `api/download-latest` → `portal/src/app/api/download-latest/route.ts`
   - `api/request-access` → `portal/src/app/api/request-access/route.ts`
3. **Add env vars to provision script** for the API functions: `STORAGE_CONNECTION_STRING`, `ACS_CONNECTION_STRING`, `ACS_FROM_EMAIL`, `NOTIFY_EMAIL`, `TURNSTILE_SECRET_KEY`
4. **Migrate landing page** — Copy `static/index.html` content into `portal/src/app/page.tsx` as a Next.js page, preserving every section, class, and style exactly.
5. **Migrate static assets** — Copy all images, PDFs, fonts, favicon, og-image from `static/` to `portal/public/`.
6. **Migrate terms/demo** — Convert `terms.html` and `demo.html` into Next.js pages at `/terms` and `/demo`.
7. **Migrate SEO** — Bring over structured data (JSON-LD), Open Graph tags, sitemap.xml, robots.txt.
8. **Unify navigation** — Landing page nav links to `/chat`; chat page nav matches landing page style.

#### Phase 1: Deploy the new site (cutover day)

9. **Run provisioning script:** `bash scripts/provision-portal.sh`
10. **Push to main** — CI/CD builds the Docker image and deploys to the Container App.
11. **Verify via Container App FQDN** (before DNS change):
    - [ ] Landing page loads (pixel-perfect match)
    - [ ] `/chat` works (Google OAuth + AI responses)
    - [ ] `/api/check-update?v=1.0.0` returns `{ updateAvailable: true, ... }`
    - [ ] `/api/download-latest` redirects to SAS URL
    - [ ] `/api/request-access` (POST with test data)
    - [ ] "Connect" → Alberta SSO login page streams correctly
    - [ ] Health data queries return results
    - [ ] `/terms`, `/demo`, `/welcome`, `/privacy` all load

#### Phase 2: DNS cutover

12. **Add custom domain to Container App:**
    ```bash
    az containerapp hostname add \
      --name ab-health-portal \
      --resource-group ab-health-mcp \
      --hostname www.myaihealth.ca
    ```
13. **Get the Container App's verification TXT record and FQDN:**
    ```bash
    az containerapp hostname list \
      --name ab-health-portal \
      --resource-group ab-health-mcp
    ```
14. **Update DNS records** — Add TXT record for domain verification (if required). Change `www` CNAME from SWA → Container App FQDN.
15. **Bind managed TLS certificate:**
    ```bash
    az containerapp hostname bind \
      --name ab-health-portal \
      --resource-group ab-health-mcp \
      --hostname www.myaihealth.ca \
      --environment ab-health-mcp-env \
      --validation-method CNAME
    ```

#### Phase 3: Parallel-run validation (72 hours)

16. Both the SWA and Container App are live — SWA still exists, just no traffic hitting it.
17. **Verify everything via real URL:**
    - [ ] `https://www.myaihealth.ca` shows landing page
    - [ ] `https://www.myaihealth.ca/chat` works end-to-end
    - [ ] Existing `.mcpb` installs can check for updates
    - [ ] New access requests come through
    - [ ] TLS certificate is valid and not expiring
18. **Monitor:** Container App logs, App Insights error spikes, Azure AI Foundry call success rate.

#### Phase 4: Decommission SWA (after 72h)

19. **Remove SWA deploy step from CI/CD** (`.github/workflows/ci-cd.yml`) — delete the "Deploy website to Azure Static Web Apps" step, remove `AZURE_SWA_TOKEN` from GitHub secrets.
20. **Delete the Static Web App resource:**
    ```bash
    az staticwebapp delete --name myaihealth --resource-group ab-health-mcp
    ```
21. **Restore DNS TTL** to 3600s (1 hour) for caching efficiency.

#### Rollback plan

If the Container App has issues after DNS cutover:
1. Revert DNS CNAME back to the SWA hostname (takes effect within TTL — 5 min with lowered TTL).
2. The SWA is still running and serving the original site.
3. Fix the Container App issue, then re-attempt cutover.

#### Risk mitigation

| Risk | Mitigation |
|------|------------|
| DNS propagation delay | TTL lowered to 300s 24h before cutover |
| API functions break | Port and test before DNS change; SWA stays as fallback |
| TLS certificate delay | Azure managed certs can take 15 min; verify before announcing |
| Container App cold start | Set min-replicas=1 (already configured in provision script) |
| `.mcpb` update checks fail | Test `/api/check-update` and `/api/download-latest` on Container App FQDN before DNS switch |

---

### Security Hardening (Phase 2 — Post-Beta)

Deferred from initial security audit. All critical/high items from Phase 1 are fixed and pushed. These are important for production hardening but not blocking for beta.

#### C3. Encrypt health session store at rest (CRITICAL)

**Problem:** Health session cookies stored as plaintext in-memory Map. Any heap dump exposes all active sessions.

**File:** `portal/src/lib/auth/health-session-store.ts`

**Approach:** Reuse the AES-256-GCM pattern from `portal/src/lib/crypto/api-keys.ts`. Encrypt serialized `HealthSessionData` JSON before storing in Map, decrypt on read. Use `MHR_ENCRYPTION_KEY` env var with fallback to `AUTH_SECRET`. Fix static salt issue (H6) at the same time — use random salt prepended to ciphertext (`salt:iv:tag:ciphertext`).

#### H3. AI output guardrails for PHI (HIGH)

**Problem:** No output-side filtering for raw health data JSON or prompt injection in AI responses.

**File:** `portal/src/app/api/chat/route.ts` (in `streamText` `onFinish` callback)

**Approach:**
1. Add `containsSuspiciousOutput(text)` — detects JSON blobs >500 chars, raw cookie strings, patterns like `"mhrCookies":`.
2. Wire into `onFinish` callback — emit `chat.suspicious_output` telemetry event.
3. Strengthen system prompt: "Never output raw JSON from tool results."
4. Phase 2b: integrate Azure AI Content Safety API for real-time PHI detection.

#### H4. Re-enable Chrome sandbox in Docker (HIGH)

**Problem:** `--no-sandbox` disables Chromium's security sandbox in the Container App.

**Files:** `portal/Dockerfile`, `portal/src/app/api/auth-stream/route.ts`

**Approach:** Configure Docker for sandbox support — `--shm-size=256m` or tmpfs at `/dev/shm`, remove `--no-sandbox` (keep `--disable-setuid-sandbox`), update `provision-portal.sh` for shared memory.

#### H5. Persistent rate limiting with Redis (HIGH)

**Problem:** All rate limits, usage quotas, and spend caps are in-memory — reset on container restart.

**Files:** `portal/src/lib/rate-limit.ts`, `portal/src/lib/chat/usage-limits.ts`, `portal/src/lib/chat/cost.ts`

**Approach:** Azure Cache for Redis (Basic tier, Canada Central, ~$20/month). Replace in-memory Maps with Redis INCR/HSET. Fallback to in-memory if Redis unavailable. Update `provision-portal.sh`.

#### L5. HIA audit trail for health data access (LOW → MEDIUM for compliance)

**Problem:** Alberta HIA Section 64(1) requires audit trails for health information access. Current telemetry is anonymous.

**Approach:** Encrypted, append-only audit log in Azure Table Storage (Canada Central). `logHealthAccess(userId, toolName, timestamp)` encrypted with AES-256-GCM. Wire into `executeHealthTool()` in `direct-client.ts`. Retention: 2 years per HIA.

#### H6. Fix static KDF salt

**Problem:** `scryptSync(secret, "api-key-salt", 32)` uses a hardcoded static salt.

**Fix:** Included with C3 — use random salt prepended to ciphertext. Apply same fix to `api-keys.ts`.

---

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
