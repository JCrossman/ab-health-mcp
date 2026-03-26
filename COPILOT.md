# COPILOT.md

## Project Overview

MCP server providing passthrough access to Alberta's My Health Records portal (`myhealthrecords.alberta.ca`) and AHS MyChart / Connect Care (`myahsconnect.albertahealthservices.ca/MyChartPRD/`). Enables natural language health record queries via Claude Desktop.

**Architecture:** Browser-based authentication via Puppeteer using shared Alberta SSO, then REST API calls to both MHR and MyChart backends using captured session cookies. See `README.md` for full details.

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
3. **Canadian data residency.** All remote infrastructure in Canada Central.
4. **Encrypt at rest.** AES-256-GCM for stored session cookies.
5. **Credentials never touch the server.** Users enter credentials directly in the Puppeteer browser window. Only session cookies are captured.

## Build Commands

```bash
npm install
npm run build          # tsc
npm test               # vitest run
npm run lint           # tsc --noEmit
```

Test auth flow: `npx tsx scripts/test-auth.ts`

### Deploying a New Version

**Always use `npm run deploy`** — it auto-bumps the version, builds, packs, verifies, uploads to Azure, and deploys the landing page in one command:

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

### Phase 1 + 2 Complete, MyChart Integration Complete (44 tools)

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

| Tool | Endpoint | CMID |
|------|----------|------|
| `get_health_overview` | Multiple (composite) | — |
| `get_user_profile` | `/api/phr/v1/user` | — |
| `get_lab_results` | `/api/phr/v1/labresult/getData` | 7736 |
| `get_diagnostic_imaging` | `/api/phr/v1/labresult/getData` | 7712 |
| `get_immunizations` | `/api/phr/v1/myhealth/immunization-data-manager` | 7695 |
| `get_medications` | `/api/phr/v1/medication` | 7701 |
| `get_referrals` | `/api/phr/v1/referral` | 7705 |
| `get_vitals` | `/api/phr/v1/VitalSigns` | 7730 |
| `get_blood_oxygen` | `/api/phr/v1/myhealth/blood-oxygensaturation-data-manager` | 7722 |
| `get_blood_pressure` | `/api/phr/v1/myhealth/blood-pressure-data-manager` | 7716 |
| `get_height_weight` | height (7749) + weight (7750) + BMI (7748) | — |
| `get_exercise` | `/api/phr/v1/exercise` | 7742 |
| `get_procedures` | `/api/phr/v1/procedure` | 7739 |
| `get_blood_glucose` | `/api/phr/v1/myhealth/blood-glucose-data-manager` | 7724 |
| `get_sleep` | `/api/phr/v1/myhealth/sleep-session-data-manager-v2` | 7757 |
| `get_dietary_intake` | `/api/phr/v1/myhealth/dietary-intake-data-manager` | 7764 |
| `get_insulin` | insulin-injection (7725) + insulin-injection-use (7726) | — |
| `get_peak_flow` | `/api/phr/v1/myhealth/peak-flow-data-manager` | 7731 |
| `get_waist_circumference` | `/api/phr/v1/myhealth/extendable-data-manager/waist-circumference` | 7751 |
| `get_symptom_journal` | `/api/phr/v1/myhealth/extendable-data-manager/concern` | 7760 |
| `download_attachment` | `/api/phr/v1/attachment/{id}/download` | — |

**MyChart tools (20, prefixed with `mc_`):**

All MyChart tools use `__RequestVerificationToken` CSRF header instead of Control-Mapping-Id. Base URL: `https://myahsconnect.albertahealthservices.ca/MyChartPRD/`

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

### Phase 3: Remote Mode (not started)
- HTTP transport with Streamable HTTP
- Cosmos DB session storage
- Browser-based auth proxy
- Azure Container Apps deployment

### Landing Page ✅
- Static site at www.myaihealth.ca (Azure Static Web Apps)
- Gated download access via request form → Azure Communication Services email → SAS URL
- Azure resources: Static Web App (`myaihealth`), Blob Storage (`myaihealthdownloads`), Communication Services (`myaihealth-comm`), Email Service (`myaihealth-email`)

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
  -> (if valid session exists and force!=true, reuse it and return immediately)
  -> launch Puppeteer browser (headless: false, channel: 'chrome')
  -> user logs in through real Alberta SSO
  -> extract MHR cookies from browser
  -> verify MHR session with /api/phr/v1/user
  -> navigate to MyChart SAML login (auto-authenticates via shared SSO)
  -> extract MyChart cookies from browser
  -> fetch CSRF token from /MyChartPRD/Home/CSRFToken
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
  "@modelcontextprotocol/sdk": "^1.27.1",
  "mupdf": "^0.5.x",
  "puppeteer-core": "^24.x",
  "tough-cookie": "^6.x",
  "undici": "^7.x"
}
```

## Landing Page (myaihealth.ca)

The project includes a static landing page deployed to Azure Static Web Apps:

- **URL:** www.myaihealth.ca
- **Hosting:** Azure Static Web Apps (Free tier, `myaihealth` resource in `ab-health-mcp` resource group)
- **API function:** `api/request-access/` — Azure Function that generates a 7-day SAS download URL and emails it via Azure Communication Services
- **Email:** `noreply@myaihealth.ca` via Azure Communication Services (custom domain, verified)
- **Downloads:** `.mcpb` stored in Azure Blob Storage (`myaihealthdownloads` account, `downloads` container). **Not distributed via GitHub releases** — users must request access through the portal.
- **Deploy landing page:** `swa deploy ./static --api-location ./api --api-language node --api-version 18 --app-name myaihealth --env production`
- **Deploy mcpb:** `mcpb pack . ab-health-mcp.mcpb` then `az storage blob upload --account-name myaihealthdownloads --container-name downloads --name ab-health-mcp.mcpb --file ab-health-mcp.mcpb --overwrite --auth-mode key`

## Repository

- **Visibility:** Public (open source, MIT license)
- **Branch protection:** `main` branch has force push and deletion blocked, enforce_admins enabled
- **Distribution:** The `.mcpb` bundle is NOT in the repo or GitHub releases. It's gated behind the myaihealth.ca access request form. Users can clone and build from source if they prefer.
- **Do NOT** create GitHub releases with `.mcpb` attachments — this bypasses the access request flow.

## Adding New Tools

All health data tools follow the same pattern — one file per tool in `src/tools/`:

**MHR tools:**
1. Add API method to `src/api/mhr-client.ts`
2. Create tool file in `src/tools/` following existing `get-*.ts` pattern
3. Register in `src/index.ts` with Zod schema for parameters
4. To find new endpoints: capture HAR traffic in browser DevTools while navigating the MHR portal

**MyChart tools:**
1. Add API method to `src/api/mychart-client.ts`
2. Create tool file in `src/tools/` following existing `mc-*.ts` pattern (prefixed with `mc_`)
3. Register in `src/index.ts` with Zod schema for parameters
4. All MyChart endpoints use `__RequestVerificationToken` CSRF header (no Control-Mapping-Id)
5. To find new endpoints: capture HAR traffic while navigating AHS MyChart portal
