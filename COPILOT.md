# COPILOT.md

## Project Overview

MCP server providing passthrough access to Alberta's My Health Records portal (`myhealthrecords.alberta.ca`) and AHS MyChart / Connect Care (`myahsconnect.albertahealthservices.ca/MyChartPRD/`). Enables natural language health record queries via Claude Desktop.

**Architecture:** Browser-based authentication via Puppeteer using shared Alberta SSO, then REST API calls to both MHR and MyChart backends using captured session cookies. See `README.md` for full details.

**Two delivery paths:**
1. **`.mcpb` + Claude Desktop** (production) — data flows directly between the user's machine and Alberta Health.
2. **Portal chat beta** (pre-launch experiment in `portal/`) — web-first onboarding for non-technical users at `myaihealth.ca/chat`. Uses Azure OpenAI Canada East only during beta. See the session plan at `~/.copilot/session-state/…/plan.md` for active experiment state and ADR-001 (`files/adr-001-swa-migration.md`) for the SWA migration decision.

## Key Specs

| File | Contents |
|------|----------|
| `README.md` | Setup, usage, tool reference, architecture overview |
| `ARCHITECTURE.md` | System architecture, directory structure, tech stack |
| `API-SPEC.md` | Reverse-engineered API endpoints, request/response formats |
| `MCP-TOOLS-SPEC.md` | MCP tool definitions, parameters, response formats |
| `AUTH-FLOW-SPEC.md` | Authentication flow, cookie management, session handling |

## Passthrough Principle

**This is a passthrough MCP server. No health data interpretation allowed.**

The MCP server's only job:
1. Authenticate with the API (via Puppeteer browser)
2. Fetch data using session cookies
3. Format for display
4. Return to Claude

**DO NOT:**
- Interpret lab results (normal/abnormal)
- Calculate trends or averages
- Store or cache health data
- Add business logic
- Make medical assessments

Claude handles all interpretation. The MCP server is just a pipe.

## Security First

This project handles protected health information under Alberta's Health Information Act (HIA) and Protection of Privacy Act (POPA).

### Non-Negotiable Rules

1. **Never log PII.** No names, health data, cookie values, or identifiers in logs.
2. **Never store health data.** Only session cookies are persisted, encrypted.
3. **Canadian data residency (our infrastructure).** All user-data-handling infrastructure in Canada Central or Canada East. The `myaihealth` Static Web App in Central US is migrating to the Container App (no user data on the current SWA beyond email addresses in the request-access flow). Azure OpenAI (`abhealthmcp-openai-cae`) in Canada East is the only LLM for the portal beta. Claude (Anthropic) for the `.mcpb` path still processes on US servers — disclosed in terms/privacy.
4. **Encrypt at rest.** AES-256-GCM for stored session cookies.
5. **Credentials never touch the server.** Users enter credentials directly in the Puppeteer browser window. Only session cookies are captured.
6. **Never suggest clinical actions.** The MCP server is a data passthrough — it must never flag lab values as abnormal/critical, suggest calling healthcare providers (including 911 or Health Link 811), recommend medication changes, alert about drug interactions, cross-reference clinical data to surface potential issues, or suggest screenings/follow-ups. All clinical interpretation and action recommendations are Claude's responsibility, not the MCP server's. This boundary keeps the tool clearly outside Health Canada's medical device regulations.

## Build Commands

```bash
npm install
npm run build          # tsc
npm test               # vitest run
npm run lint           # tsc --noEmit
```

Test auth flow: `npx tsx scripts/test-auth.ts`

### Deploying a New Version

**Always use `npm run deploy`** — it auto-bumps the version, builds, packs, verifies, and uploads the `.mcpb` to Azure:

```bash
npm run deploy              # bump patch (1.0.0 → 1.0.1)
npm run deploy -- minor     # bump minor (1.0.1 → 1.1.0)
npm run deploy -- major     # bump major (1.1.0 → 2.0.0)
```

This updates the version in all 5 locations automatically:
- `package.json`
- `manifest.json`
- `static/version.json` (checked by installed extensions for update notifications)
- `src/tools/connect-account.ts` (`CURRENT_VERSION`)
- `src/server/create-server.ts` (server info)

**Note:** The landing page (`static/`) is deployed via GitHub Actions on push to `main`, not by `npm run deploy`. The deploy script uploads the `.mcpb` bundle to Azure Blob Storage. Push to `main` to trigger the landing page + `version.json` deploy.

**Do NOT** manually run `mcpb pack` or `az storage blob upload` — use `npm run deploy` instead.

### Building Without Deploying

For local development only (no version bump, no upload):

```bash
npm run build                          # compile TypeScript
mcpb validate manifest.json            # check manifest is valid
mcpb pack . ab-health-mcp.mcpb         # build the bundle (~16MB)
```

### .mcpbignore — Critical Rules

The `.mcpbignore` file controls what's excluded from the `.mcpb` bundle. It uses **gitignore-style patterns**, which means **bare directory names match at ANY depth** — including inside `node_modules/`.

#### ⚠️ The #1 Rule: Always use root-relative paths for project directories

```
# WRONG — matches node_modules/debug/src/, node_modules/tldts-core/dist/cjs/src/, etc.
src/

# CORRECT — only matches the project's top-level src/ directory
/src/
```

**Every project directory in `.mcpbignore` MUST start with `/` to be root-relative.** Without the leading `/`, the pattern matches that directory name anywhere in the tree, which silently strips critical runtime code from `node_modules/` and causes the server to crash on startup with no error output.

Directories that MUST be root-relative (prefixed with `/`):
- `/src/` — project source (NOT `src/` which would match `node_modules/debug/src/`)
- `/api/` — Azure Functions (NOT `api/` which would match `build/api/`)
- `/extension/` — Chrome extension
- `/portal/` — web portal
- `/scripts/` — dev scripts
- `/static/` — static assets

Directories that are safe WITHOUT `/` (only exist inside `node_modules/` with those exact names):
- `node_modules/typescript/`
- `node_modules/vitest/`
- `.git/`, `.github/`, `.vscode/`

#### What the bundle MUST contain

The `.mcpb` must include these for the server to work:

| Path | Why |
|------|-----|
| `build/` | Compiled JS (all subdirs: `build/api/`, `build/tools/`, etc.) |
| `node_modules/` | Runtime dependencies (minus dev-only packages) |
| `manifest.json` | MCP server configuration |
| `package.json` | Module resolution (`"type": "module"`) |
| `icon.png` | Server icon |
| `README.md` | Shown in Claude Desktop |

#### Dev dependencies safe to exclude

These are ONLY used during development and can be excluded via `node_modules/<name>/`:

```
node_modules/typescript/
node_modules/vitest/
node_modules/@vitest/
node_modules/tsx/
node_modules/esbuild/
node_modules/@esbuild/
node_modules/vite/
node_modules/rollup/
node_modules/@rollup/
node_modules/@types/
node_modules/fsevents/
node_modules/@tailwindcss/
node_modules/tailwindcss/
node_modules/lightningcss/
node_modules/lightningcss-*/
node_modules/sharp/
node_modules/sharp-*/
node_modules/@img/
node_modules/rolldown/
node_modules/@rolldown/
node_modules/jiti/
node_modules/source-map/
node_modules/@jridgewell/
```

#### Verifying the bundle after building

Always verify the bundle includes critical files before uploading:

```bash
# Check build/api/ is included (auth client, MHR client, MyChart client)
unzip -l ab-health-mcp.mcpb | grep "build/api/"

# Check the debug package's src/ is included (required by puppeteer, etc.)
unzip -l ab-health-mcp.mcpb | grep "node_modules/debug/src/"

# Check key runtime deps are present
unzip -l ab-health-mcp.mcpb | grep -c "puppeteer-core"
unzip -l ab-health-mcp.mcpb | grep -c "tough-cookie"
unzip -l ab-health-mcp.mcpb | grep -c "zod/"

# Quick sanity: JS file count should be ~2400+
unzip -l ab-health-mcp.mcpb | grep "\.js$" | wc -l
```

#### Common .mcpbignore mistakes that cause silent crashes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| `src/` instead of `/src/` | Server crashes ~1s after `initialize` — `debug` package missing | Use `/src/` |
| `api/` instead of `/api/` | Server crashes on startup — `build/api/auth-client.js` missing | Use `/api/` |
| `extension/` instead of `/extension/` | May strip files from deps with `extension/` subdirs | Use `/extension/` |
| Missing runtime dep in exclusion list | `MODULE_NOT_FOUND` at startup | Only exclude known dev-only packages |
| `*.ts` too broad | Removes `.d.ts` from node_modules (harmless but wasteful) | Acceptable — `.d.ts` not needed at runtime |

## Current Implementation Status

### Phase 1 + 2 Complete, MyChart Integration Complete, Find-a-Provider Complete (48 tools)

**Core infrastructure:**
- `src/api/auth-client.ts` — Puppeteer browser-based SSO authentication (captures both MHR and MyChart sessions)
- `src/api/mhr-client.ts` — MHR REST API client with tough-cookie jar
- `src/api/mychart-client.ts` — MyChart REST API client with tough-cookie jar + CSRF token
- `src/auth/session-manager.ts` — AES-256-GCM encrypted session storage at `~/.mhr-records/` (v2 format: MHR jar + MyChart jar + CSRF token, backward compatible with v1)
- `src/helpers/session-helpers.ts` — Session validation and error formatting
- `src/helpers/content-helpers.ts` — PDF text extraction + image rendering (mupdf WASM, synchronous)
- `src/index.ts` — MCP server entry point (stdio transport)

**Session tools:** `connect_account`, `check_connection`, `disconnect_account`

**MHR health data tools (21, confirmed via HAR captures):**

> **Note:** As of March 2026, Alberta removed the `Control-Mapping-Id` header requirement from most MHR endpoints. Only the medications endpoint still requires it (CMID `8050`). The old CMID values (7xxx) now cause HTTP 500 errors.

| Tool | Endpoint |
|------|----------|
| `get_health_overview` | Multiple (composite) |
| `get_user_profile` | `/api/phr/v1/user` |
| `get_lab_results` | `/api/phr/v1/labresult/getData` |
| `get_diagnostic_imaging` | `/api/phr/v1/labresult/getData` |
| `get_immunizations` | `/api/phr/v1/myhealth/immunization-data-manager` |
| `get_medications` | `/api/phr/v1/medication` (CMID: 8050) |
| `get_referrals` | `/api/phr/v1/referral` |
| `get_vitals` | `/api/phr/v1/VitalSigns` |
| `get_blood_oxygen` | `/api/phr/v1/myhealth/blood-oxygensaturation-data-manager` |
| `get_blood_pressure` | `/api/phr/v1/myhealth/blood-pressure-data-manager` |
| `get_height_weight` | height + weight + BMI endpoints |
| `get_exercise` | `/api/phr/v1/exercise` |
| `get_procedures` | `/api/phr/v1/procedure` |
| `get_blood_glucose` | `/api/phr/v1/myhealth/blood-glucose-data-manager` |
| `get_sleep` | `/api/phr/v1/myhealth/sleep-session-data-manager-v2` |
| `get_dietary_intake` | `/api/phr/v1/myhealth/dietary-intake-data-manager` |
| `get_insulin` | insulin-injection + insulin-injection-use endpoints |
| `get_peak_flow` | `/api/phr/v1/myhealth/peak-flow-data-manager` |
| `get_waist_circumference` | `/api/phr/v1/myhealth/extendable-data-manager/waist-circumference` |
| `get_symptom_journal` | `/api/phr/v1/myhealth/extendable-data-manager/concern` |
| `download_attachment` | `/api/phr/v1/attachment/{id}/download` |

**MyChart tools (20, prefixed with `mc_`):**

All MyChart tools use `__RequestVerificationToken` CSRF header. Base URL: `https://myahsconnect.albertahealthservices.ca/MyChartPRD/`

| Tool | API Endpoint |
|------|-------------|
| `mc_get_visits` | `Visits/VisitsList/LoadUpcoming` + `LoadPast` |
| `mc_get_health_summary` | `api/health-summary/FetchHealthSummary` |
| `mc_get_allergies` | `api/allergies/LoadAllergies` |
| `mc_get_health_issues` | `api/HealthIssues/LoadHealthIssuesData` |
| `mc_get_care_team` | `Clinical/CareTeam/Load` |
| `mc_get_messages` | `api/conversations/GetConversationList` |
| `mc_get_medical_history` | `api/histories/LoadHistoriesViewModel` |
| `mc_get_documents` | `api/documents/viewer/LoadOtherDocuments` |
| `mc_get_upcoming_orders` | `api/upcoming-orders/GetUpcomingOrders` |
| `mc_get_test_results` | `api/test-results/GetList` + `GetDetails` |
| `mc_get_historical_results` | `api/past-results/GetMultipleHistoricalResultComponents` |
| `mc_get_family_tree` | `api/pedigree/LoadPedigree` |
| `mc_get_goals` | `api/goals/LoadPatientGoals` + `LoadCareTeamGoals` |
| `mc_get_referrals` | `api/referrals/listReferrals` |
| `mc_get_medications` | `api/medications/LoadMedicationsPage` |
| `mc_get_immunizations` | `api/immunizations/LoadImmunizations` |
| `mc_get_appointment_requests` | `Visits/VisitsList/LoadAppointmentRequest` |
| `mc_download_document` | `api/test-results/DownloadDocumentBinary` |
| `mc_list_proxy_access` | `ProxySwitch` |
| `mc_switch_context` | `api/proxy/SwitchToProxy` |

### Phase 3: Remote Mode (implemented, not yet productized)
- HTTP transport with Streamable HTTP
- Zero server-side storage (session encrypted into OAuth access token)
- Browser-based auth proxy via Chrome extension
- Azure Container Apps deployment (Canada Central)

### Landing Page ✅
- Static site at www.myaihealth.ca (Azure Static Web Apps)
- Gated download access via request form → Azure Communication Services email → 3-month SAS URL
- SEO: robots.txt, sitemap.xml, Schema.org JSON-LD, FAQ section
- Privacy-first messaging: pre-frames Claude Desktop security warning on landing page and in access request email
- Feature announcements: Family & Caregiver (proxy) access banner
- Analytics: Azure Application Insights (`myaihealth-insights`) — anonymous cookie-free visitor tracking on all pages (index, demo, terms, 404)
- Azure resources: Static Web App (`myaihealth`), Blob Storage (`myaihealthdownloads`), Communication Services (`myaihealth-comm`), Email Service (`myaihealth-email`), Application Insights (`myaihealth-insights`)

### Azure Cost Governance ✅
- Budget: `MainBudget` — $100 CAD/month with automated enforcement
- Alerts: 50% email, 75% email, 90% email + shutdown runbook, 100% email + shutdown runbook, forecasted 100% email
- Automation: `budget-enforcement-aa` Automation Account (free tier) with `shutdown-resources` PowerShell runbook — scales Container App to 0/0 and caps Log Analytics to 0 GB
- Action Group: `budget-enforcement-ag` triggers runbook via webhook
- Anomaly detection: ML-based daily cost anomaly alert
- Log Analytics daily cap: 0.5 GB/day (prevents runaway ingestion costs)

### Recent Additions (v1.3.0)
- **Find-a-Provider tool family** — 4 new tools (`find_provider`, `search_provider_by_name`, `find_provider_by_language`, `get_provider_details`) hitting the public `albertafindaprovider.ca` directory. No Alberta account, no PHI, no auth. Always real (no demo branching) — the data is public so calling the live API is safe even in demo mode. Client at `src/api/find-a-provider-client.ts` includes baked-in lookup tables (5 services, 29 languages, 32 PCNs) extracted from a HAR capture, fuzzy-match helpers, response trimming (drops `polygon`, `media`, `created_at` etc.), and a two-tier geocoder: Nominatim primary + zippopotam.us FSA-level fallback (Canadian postal coverage in Nominatim is patchy). Upstream `public-find` is a multi-field LIKE that matches addresses/clinic names too — `search_provider_by_name` post-filters to true name matches. Total tools 44 → 48.

### Recent Additions (v1.2.0)
- **Demo mode v2 (stateful, multi-persona)** — Demo mode is now stateful. Four interconnected personas — **Self** (Demo User, 39M, T2D+HTN+HLD), **Mother** (Margaret User, 72F, complex multimorbidity + polypharmacy), **Spouse** (Sarah User, 41F, Hashimoto + GAD + perimenopause, *Limited* access), **Child** (Liam User, 7M, asthma + ADHD + peanut allergy). `mc_list_proxy_access` returns all four. `mc_switch_context(proxy_id)` mutates the active persona singleton so every subsequent MHR + MyChart call returns that persona's data. Persona files live in `src/helpers/demo/personas/*.ts`; routing is via a `Proxy` wrapper in `src/helpers/demo/clients.ts` that late-binds every method call to the active persona — no edits needed to that file when adding a new persona. **Demo divergence from real**: real MHR can't switch mid-session (`selectedRecordId` is fixed at SSO), but demo MHR follows the MyChart switch so cross-persona reasoning works end-to-end. This is intentional and surfaced in the switch response's `note` field.

### Recent Additions (v1.1.28)
- **Tool annotations** — `readOnlyHint`, `destructiveHint`, `title` on all 48 tools (Anthropic directory Rule 17)
- **Demo mode** — Activated via `connect_account(demo=true)` when the user asks for demo/sample data. Returns sample Alberta health data with clinically coherent patient narrative. Calling `connect_account` without `demo=true` always exits demo mode.
- **Demo mode v2 (stateful, multi-persona)** — Demo mode is now stateful. Four interconnected personas are loaded — **Self** (Demo User, 39M, T2D+HTN+HLD), **Mother** (Margaret User, 72F, complex multimorbidity + polypharmacy), **Spouse** (Sarah User, 41F, Hashimoto + GAD + perimenopause, *Limited* access), **Child** (Liam User, 7M, asthma + ADHD + peanut allergy). `mc_list_proxy_access` returns all four. `mc_switch_context(proxy_id)` mutates the active persona singleton so every subsequent MHR + MyChart call returns that persona's data. Persona files live in `src/helpers/demo/personas/*.ts`; routing is via a `Proxy` wrapper in `src/helpers/demo/clients.ts` that late-binds every method call to the active persona — no edits needed to that file when adding a new persona. **Demo divergence from real**: real MHR can't switch mid-session (`selectedRecordId` is fixed at SSO), but demo MHR follows the MyChart switch so cross-persona reasoning works end-to-end. This is intentional and surfaced in the switch response's `note` field.
- **Version check** — `connect_account` checks `/api/check-update` before any other logic. Update notification is a separate content block with a direct download link (30-minute SAS URL from myaihealth.ca).
- **Formatting directives** — Every tool response prepends a `FORMATTING:` content block telling Claude how to display the data (table with columns, trend table, summary sections, etc.). Server instructions are kept minimal (~600 tokens) — medical disclaimer first, formatting rules, demo/tool usage.
- **MHR client refactored** — `mhr-client.ts` uses `fetchDateRange()` helper to eliminate duplication across 18 endpoint methods.
- **Medical disclaimers** — embedded in `connect_account` responses and all factory-generated tool responses. Includes data completeness warning (24-72hr delays, out-of-province gaps).
- **Security hardened** — SSRF/redirect validation, sanitized error output, SHA-256 session filenames, per-install random token salt, bounded pagination, date validation, rate limiting on OAuth endpoints, TOCTOU race condition fixes
- **Deploy automation** — `npm run deploy` handles version bump, build, pack, upload, and landing page deploy
- **Open source** — Public GitHub repo with squashed history, branch protection enabled
- **Family & proxy access** — `mc_list_proxy_access` and `mc_switch_context` tools for viewing family members' health records via MyChart shared access. Proxy context switch includes privacy notice.
- **Privacy-first messaging** — Landing page and access request email pre-frame the Claude Desktop security warning, explaining the local architecture is an intentional privacy feature
- **First-run consent** — Privacy notice shown on first `connect_account` call, disclosing that health data is sent to Anthropic's US servers. Requires explicit `accept_privacy=true` to proceed. Includes OIPC link and right-to-withdraw information.
- **In-app update with download link** — `/api/check-update` endpoint generates a 30-minute SAS download URL when a new version is available, shown as a prominent separate content block via `connect_account`

## Authentication

Authentication uses **Puppeteer** to open the real MHR login page in a Chrome window. The SSO flow traverses:

```
myhealthrecords.alberta.ca
  → console.myhealthrecords.alberta.ca (SAML SP)
    → identity.prd.telushealthspace.com (TELUS Health IdP)
      → sts.xiduam.ca → account.alberta.ca (user signs in here)
```

Puppeteer handles the entire SAML chain automatically. After MHR login, the browser navigates to MyChart's SAML endpoint (`/MyChartPRD/Authentication/Saml/Login?idp=MADI&forceAuthn=False`) which auto-authenticates via shared SSO. Cookies are extracted from both portals and loaded into separate `tough-cookie` CookieJars for API calls. A CSRF token is fetched from `/MyChartPRD/Home/CSRFToken` for MyChart requests.

**Browser profile** persists at `~/.mhr-records/browser-profile` to maintain SSO state between sessions.

## Cookie Management

Cookie-based auth is managed by `tough-cookie`:
- MHR cookies captured from Puppeteer browser across domains (`.alberta.ca`, `myhealthrecords.alberta.ca`, `account.alberta.ca`, `console.myhealthrecords.alberta.ca`)
- MyChart cookies captured from `myahsconnect.albertahealthservices.ca`
- Both jars serialized and encrypted with AES-256-GCM (v2 session format)
- Stored at `~/.mhr-records/session.enc`
- v2 format includes: MHR jar + MyChart jar + CSRF token (backward compatible with v1 MHR-only sessions)
- Loaded and injected into API requests via `Cookie` header

## Session Lifecycle

```
connect_account
  -> CHECK FOR UPDATES via /api/check-update (always, before anything else)
     -> if update available: include download URL as separate content block
  -> (if demo=true, enter demo mode and return sample data)
  -> (if demo not set, exit demo mode)
  -> (if valid session exists and force!=true, reuse it)
  -> (if first-ever connection, show privacy notice and return — user must call again with accept_privacy=true)
  -> if update available: block auth and return download URL
  -> launch Puppeteer browser (headless: false, channel: 'chrome')
  -> user logs in through real Alberta SSO at account.alberta.ca
  -> navigate to MyChart SAML login (auto-authenticates via shared SSO)
  -> extract MyChart cookies from browser
  -> navigate to MHR (auto-authenticates via shared SSO, retry once if needed)
  -> extract MHR cookies from browser
  -> fetch CSRF token from /MyChartPRD/Home/CSRFToken
  -> verify MHR session with /api/phr/v1/user
  -> encrypt and store v2 session (MHR jar + MyChart jar + CSRF token)

[any MHR tool call]
  -> load encrypted session
  -> check session: GET /api/phr/v1/session (keepalive)
  -> if expired, return "Session expired, reconnect"
  -> make MHR API call with cookies
  -> return formatted data

[any MyChart tool call]
  -> load encrypted session
  -> ensure MyChart jar and CSRF token available
  -> make MyChart API call with cookies + __RequestVerificationToken header
  -> return formatted data

disconnect_account
  -> delete encrypted session file
```

## Date Handling

The lab results API uses `Date.toDateString()` format in query params (e.g., `Mon Jan 01 1753`).

When the user provides dates:
1. Parse as YYYY-MM-DD
2. Convert to `Date` object
3. Call `.toDateString()` to get the API format
4. URL-encode the result

## Error Handling Pattern

```typescript
try {
  const client = await ensureSession();
  const data = await client.getLabResults(params);
  return { content: [{ type: 'text', text: JSON.stringify(formatted) }] };
} catch (error) {
  return { content: [{ type: 'text', text: formatError(error) }], isError: true };
}
```

Error mapping: `AuthRequiredError` → "Use connect_account", `SessionExpiredError` → "Session expired", `ApiError(500)` → "Unavailable", `NetworkError` → "Check internet".

## Dependencies

```json
{
  "@modelcontextprotocol/sdk": "^1.29.0",
  "express": "^5.x",
  "express-rate-limit": "^8.x",
  "mupdf": "^1.27.x",
  "puppeteer-core": "^24.x",
  "tough-cookie": "^6.x",
  "undici": "^8.x"
}
```

## Landing Page (myaihealth.ca)

The project includes a static landing page deployed to Azure Static Web Apps:

- **URL:** www.myaihealth.ca
- **Hosting:** Azure Static Web Apps (Free tier, `myaihealth` resource in `ab-health-mcp` resource group)
- **API function:** `api/request-access/` — Azure Function that generates a 3-month SAS download URL and emails it via Azure Communication Services. Email includes privacy-first messaging pre-framing the Claude Desktop security warning.
- **Email:** `noreply@myaihealth.ca` via Azure Communication Services (custom domain, verified)
- **Downloads:** `.mcpb` stored in Azure Blob Storage (`myaihealthdownloads` account, `downloads` container). **Not distributed via GitHub releases** — users must request access through the portal.
- **Version endpoint:** `static/version.json` — source of truth for latest version. Also used by `/api/check-update` endpoint which generates a 30-minute SAS download URL when a newer version is available.
- **Deploy:** Use `npm run deploy` — handles everything (see "Deploying a New Version" section above)

## Repository

- **Visibility:** Public (open source, MIT license)
- **Version:** v1.3.0 (use `npm run deploy` to bump)
- **Branch protection:** `main` branch has force push and deletion blocked, enforce_admins enabled
- **Distribution:** The `.mcpb` bundle is NOT in the repo or GitHub releases. It's gated behind the myaihealth.ca access request form. Users can clone and build from source if they prefer.
- **Do NOT** create GitHub releases with `.mcpb` attachments — this bypasses the access request flow.
- **Anthropic Directory:** Submission on hold. Demo mode (say "connect to demo health data") lets reviewers test without an Alberta account.

## Adding New Tools

All health data tools follow the same pattern — one file per tool in `src/tools/`:

**MHR tools:**
1. Add API method to `src/api/mhr-client.ts` — most endpoints use `fetchDateRange()` helper (1-2 lines)
2. Create tool file in `src/tools/` following existing `get-*.ts` pattern, or add to `simple-mhr-tools.ts` using factory
3. Register in `src/server/create-server.ts` with Zod schema for parameters
4. Add `formattingDirective()` to the response with appropriate hint and column names
5. To find new endpoints: capture HAR traffic in browser DevTools while navigating the MHR portal

**MyChart tools:**
1. Add API method to `src/api/mychart-client.ts`
2. Create tool file in `src/tools/` following existing `mc-*.ts` pattern, or add to `simple-mychart-tools.ts` using factory
3. Register in `src/server/create-server.ts` with Zod schema for parameters
4. Add `formattingDirective()` to the response with appropriate hint and column names
5. All MyChart endpoints use `__RequestVerificationToken` CSRF header (no Control-Mapping-Id)
6. To find new endpoints: capture HAR traffic while navigating AHS MyChart portal

**Tool factory patterns** (`src/tools/tool-factory.ts`):
- `simpleMhrTool(name, desc, method, resultKey, displayHint)` — no-param MHR passthrough
- `mhrDateRangeTool(name, desc, method, resultKey, defaultRange, displayHint)` — date-range MHR tool
- `simpleMyChartTool(name, desc, method, displayHint)` — no-param MyChart passthrough
- `formattingDirective(hint, columns)` — prepends FORMATTING content block to responses
