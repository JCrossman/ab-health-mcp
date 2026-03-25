# Alberta Health MCP Server

An MCP (Model Context Protocol) server that provides Claude Desktop with passthrough access to Alberta's [My Health Records](https://myhealthrecords.alberta.ca) portal and [AHS MyChart (Connect Care)](https://myahsconnect.albertahealthservices.ca/MyChartPRD/). Ask Claude about your lab results, immunizations, medications, vitals, appointments, clinical documents, and more — all through natural language.

## What It Does

```
You: "Show me my lab results from the last 6 months and explain anything unusual"
Claude: [calls get_lab_results] Here are your results...
```

The MCP server authenticates with Alberta's SSO (shared across both portals), fetches your health data from MHR and MyChart, and passes it to Claude for interpretation. It's a read-only passthrough — no health data is stored, cached, or analyzed by the server itself. Claude handles all interpretation.

## Quick Start

### Option 1: One-Click Install (Recommended)

1. **Download** [`ab-health-mcp.mcpb`](https://github.com/JCrossman/ab-health-mcp/releases/latest/download/ab-health-mcp.mcpb)
2. **Double-click** the downloaded file — Claude Desktop installs it automatically
3. Tell Claude: **"Connect to My Health Records"**
4. Chrome opens to Alberta's real login page — sign in with your MyAlberta credentials
5. Start asking: **"Show me my lab results"**, **"Am I up to date on immunizations?"**, etc.

**No Node.js. No terminal. No configuration files. No API keys.**

> **Requirements:** [Claude Desktop](https://claude.ai/download) and Google Chrome. You need a [MyAlberta](https://account.alberta.ca) account with My Health Records access.

### Option 2: Developer Install

<details>
<summary>For contributors or users who prefer manual setup</summary>

#### Prerequisites

- Node.js 20+
- [Claude Desktop](https://claude.ai/download)
- Google Chrome
- A [MyAlberta](https://account.alberta.ca) account with My Health Records access

#### Install

```bash
git clone https://github.com/JCrossman/ab-health-mcp.git
cd ab-health-mcp
npm install
npm run build
```

#### Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "ab-health-mcp": {
      "command": "node",
      "args": ["/path/to/ab-health-mcp/build/index.js"]
    }
  }
}
```

Restart Claude Desktop. You'll see the tools appear in the connectors panel.

</details>

### Usage

1. Tell Claude: **"Connect to My Health Records"**
2. A browser window opens — log in with your MyAlberta credentials
3. Once logged in, your session is established (covers both MHR and MyChart)
4. Ask Claude anything: **"Summarize my recent lab results"**, **"Am I up to date on immunizations?"**, etc.

## Architecture

```
Claude Desktop ──MCP (stdio)──▶ MCP Server (local) ──REST──▶ myhealthrecords.alberta.ca
                                     │                  └──REST──▶ myahsconnect.albertahealthservices.ca (MyChart)
                                     │
                                     └──Puppeteer──▶ account.alberta.ca (SSO login)

Claude Desktop ──HTTPS──▶ MCP Server (Azure Canada Central) ──REST──▶ Same endpoints
                               │
                          OAuth 2.1/PKCE
                               │
                     SSO cookies encrypted INTO the access token
                     (zero server-side storage)
```

### Local Mode (stdio)
- **Transport:** stdio (local Claude Desktop)
- **Auth:** Browser-based via Puppeteer — user logs in through the real Alberta SSO page
- **Session:** Encrypted cookie storage (AES-256-GCM) at `~/.mhr-records/session.enc`

### Remote Mode (OAuth)
- **Transport:** Streamable HTTP over HTTPS
- **Auth:** OAuth 2.1 with PKCE — Claude Desktop acts as an OAuth client
- **Session:** Zero server-side storage — SSO cookies are encrypted into the OAuth access token itself. The server is fully stateless.
- **Infrastructure:** Azure Container Apps (Canada Central) — HIA/POPA compliant

Both modes share the same 44 tools and session keepalive logic. Session timeout is ~10 minutes per system. Tools auto-keepalive both MHR and MyChart on each call.

### Auth Flow

The auth flow navigates to the Alberta SSO login page directly. After login, sessions for both MHR and MyChart are established using the shared SSO cookies. Puppeteer includes stealth measures to avoid WAF bot detection.

```
account.alberta.ca/ui/sign-in/signin
  → User enters MyAlberta credentials (or auto-login via persistent browser profile)
  → SSO session cookies established

myahsconnect.albertahealthservices.ca/MyChartPRD/
  → SAML auto-authenticates via shared SSO (no re-prompt)
  → MyChart session cookies + CSRF token established

myhealthrecords.alberta.ca
  → Auto-authenticates via shared SSO cookies
  → MHR session cookies established
```

Puppeteer handles this automatically. The persistent browser profile at `~/.mhr-records/browser-profile` preserves SSO cookies across sessions, enabling auto-login without re-entering credentials.

## Tools (44)

### Session Management

| Tool | Description |
|------|-------------|
| `connect_account` | Opens Chrome for MyAlberta SSO login. Captures and encrypts session cookies for both MHR and MyChart. |
| `check_connection` | Verifies session is active, returns time remaining. Also serves as keepalive. |
| `disconnect_account` | Clears stored encrypted session data. |

### Health Data (MHR)

| Tool | Description | API Endpoint | CMID |
|------|-------------|-------------|------|
| `get_health_overview` | Comprehensive health overview from both MHR and MyChart in a single call | Multiple | — |
| `get_user_profile` | User profile and authorized records (MHR) | `/api/phr/v1/user` | — |
| `get_lab_results` | Lab test results with date/name filtering (MHR) | `/api/phr/v1/labresult/getData` | 7736 |
| `get_diagnostic_imaging` | X-rays, ultrasounds, echocardiograms, CT/MRI (MHR) | `/api/phr/v1/labresult/getData` | 7712 |
| `get_immunizations` | Vaccine records — dates, names, sources (MHR) | `/api/phr/v1/myhealth/immunization-data-manager` | 7695 |
| `get_medications` | Current and past prescriptions (MHR) | `/api/phr/v1/medication` | 7701 |
| `get_referrals` | Specialist referral records (MHR) | `/api/phr/v1/referral` | 7705 |
| `get_vitals` | Clinical vitals — pulse, temp, respiratory rate (MHR) | `/api/phr/v1/VitalSigns` | 7730 |
| `get_blood_oxygen` | SpO2 saturation readings (MHR) | `/api/phr/v1/myhealth/blood-oxygensaturation-data-manager` | 7722 |
| `get_blood_pressure` | Blood pressure readings (MHR) | `/api/phr/v1/myhealth/blood-pressure-data-manager` | 7716 |
| `get_height_weight` | Height, weight, and BMI trends (MHR) | height, weight, BMI endpoints | 7749, 7750, 7748 |
| `get_exercise` | Exercise and physical activity records (MHR) | `/api/phr/v1/exercise` | 7742 |
| `get_procedures` | Medical procedure records — surgeries, biopsies (MHR) | `/api/phr/v1/procedure` | 7739 |
| `get_blood_glucose` | Blood glucose monitoring for diabetes management (MHR) | `/api/phr/v1/myhealth/blood-glucose-data-manager` | 7724 |
| `get_sleep` | Sleep session records — duration and quality (MHR) | `/api/phr/v1/myhealth/sleep-session-data-manager-v2` | 7757 |
| `get_dietary_intake` | Food and nutrition tracking data (MHR) | `/api/phr/v1/myhealth/dietary-intake-data-manager` | 7764 |
| `get_insulin` | Insulin injection and usage records (MHR) | insulin-injection + insulin-injection-use endpoints | 7725, 7726 |
| `get_peak_flow` | Peak expiratory flow for asthma monitoring (MHR) | `/api/phr/v1/myhealth/peak-flow-data-manager` | 7731 |
| `get_waist_circumference` | Waist circumference measurements (MHR) | `/api/phr/v1/myhealth/extendable-data-manager/waist-circumference` | 7751 |
| `get_symptom_journal` | Logged symptoms and health concerns (MHR) | `/api/phr/v1/myhealth/extendable-data-manager/concern` | 7760 |
| `download_attachment` | Downloads PDF reports from lab/imaging results (MHR) | `/api/phr/v1/attachment/{id}/download` | — |

### Health Data (MyChart / AHS Connect)

MyChart tools access data from AHS Connect Care (`myahsconnect.albertahealthservices.ca/MyChartPRD/`). All MyChart tools are prefixed with `mc_` and require a `__RequestVerificationToken` CSRF header (no Control-Mapping-Id).

| Tool | Description |
|------|-------------|
| `mc_get_visits` | Past and upcoming appointments (MyChart) |
| `mc_get_health_summary` | Health summary overview (MyChart) |
| `mc_get_allergies` | Allergy list (MyChart) |
| `mc_get_health_issues` | Active diagnoses and conditions (MyChart) |
| `mc_get_care_team` | Care team providers (MyChart) |
| `mc_get_messages` | Patient messages and conversations (MyChart) |
| `mc_get_medical_history` | Medical and family history (MyChart) |
| `mc_get_documents` | Clinical documents (MyChart) |
| `mc_get_upcoming_orders` | Upcoming tests and procedures (MyChart) |
| `mc_get_test_results` | Test results from AHS labs, including scan images (MyChart) |
| `mc_get_historical_results` | Historical trend data for specific test result components (MyChart) |
| `mc_get_family_tree` | Family tree and pedigree (MyChart) |
| `mc_get_goals` | Patient and care team goals (MyChart) |
| `mc_get_referrals` | Referral details from AHS (MyChart) |
| `mc_get_medications` | Medications from AHS (MyChart) |
| `mc_get_immunizations` | Immunization records from AHS (MyChart) |
| `mc_get_appointment_requests` | Pending appointment requests awaiting scheduling (MyChart) |
| `mc_download_document` | Download scan images or documents from test results (MyChart) |
| `mc_list_proxy_access` | List available patient records — own and shared/proxy (MyChart) |
| `mc_switch_context` | Switch to viewing a different patient's records via proxy access (MyChart) |

### Example Queries

- "Give me a complete health summary — profile, immunizations, medications, and recent labs"
- "Show me how my blood work has changed over the past year"
- "Am I up to date on my vaccinations?"
- "Download my latest ECG report"
- "Explain my most recent lab results in plain language"
- "Show me my upcoming appointments from MyChart"
- "What medications am I on according to AHS Connect Care?"
- "Do I have any active referrals in MyChart?"
- "Show me my care team and any messages from my doctors"
- "Show me my procedure history"
- "Do I have access to any shared or family health records?"

## Project Structure

```
ab-health-mcp/
├── src/
│   ├── index.ts                    # MCP server entry point (stdio transport, 44 tools)
│   ├── types.ts                    # TypeScript interfaces for API responses
│   ├── api/
│   │   ├── auth-client.ts          # Puppeteer SSO auth with stealth measures
│   │   ├── programmatic-auth.ts    # Server-side Puppeteer auth (for OAuth flow)
│   │   ├── mhr-client.ts           # MHR REST API client with cookie jar + retry-on-401
│   │   └── mychart-client.ts       # MyChart REST API client with cookie jar + CSRF + retry
│   ├── auth/
│   │   └── session-manager.ts      # AES-256-GCM encrypted session storage (v2)
│   ├── helpers/
│   │   ├── session-helpers.ts      # Session validation, cross-keepalive
│   │   └── content-helpers.ts      # PDF text extraction + image rendering (mupdf WASM)
│   ├── server/
│   │   ├── http-index.ts           # HTTP entry point with OAuth 2.1 + portal modes
│   │   ├── create-server.ts        # MCP server factory (registers all 44 tools with schemas)
│   │   ├── oauth-provider.ts       # OAuth 2.1 provider (zero-storage token architecture)
│   │   ├── token-crypto.ts         # AES-256-GCM token encryption/decryption
│   │   └── session-context.ts      # AsyncLocalStorage for per-request sessions
│   ├── tools/
│   │   ├── tool-factory.ts         # Factory functions with pagination (offset/max_results)
│   │   ├── simple-mhr-tools.ts     # 14 simple MHR tools via factory
│   │   ├── simple-mychart-tools.ts # 11 simple MyChart tools via factory
│   │   └── ...                     # Individual tool files (see Tools section)
│   └── utils/
│       ├── errors.ts               # Typed errors (SessionExpired, AuthRequired, etc.)
│       ├── logger.ts               # Stderr logger (no PII)
│       └── formatters.ts           # Date format conversion utilities
├── static/                         # Landing page (myaihealth.ca)
│   ├── index.html                  # Single-page site (Tailwind CSS)
│   ├── hero.png                    # Hero illustration
│   ├── og-image.png                # Open Graph preview image (1200×630)
│   ├── flatIcons.png               # Icon set
│   └── favicon.png                 # Site favicon
├── api/                            # Azure Functions for landing page
│   └── request-access/             # Access request form handler (ACS email + SAS URL)
├── portal/                         # Next.js web portal (chat UI)
├── Dockerfile                      # Multi-stage build for Azure Container Apps
├── staticwebapp.config.json        # Azure Static Web Apps config
├── scripts/
│   └── test-auth.ts                # Standalone auth flow test script
├── package.json
└── tsconfig.json
```

## Build & Test

```bash
npm install          # Install dependencies
npm run build        # TypeScript compilation
npm run lint         # Type checking (tsc --noEmit)
npm test             # Run tests (vitest)
```

### Build .mcpb Bundle

The `.mcpb` file is the one-click installer for Claude Desktop. Use the [`mcpb` CLI](https://www.npmjs.com/package/@anthropic-ai/mcpb) — never raw `zip`.

```bash
npm run build                          # compile TypeScript first
mcpb validate manifest.json            # check manifest
mcpb pack . ab-health-mcp.mcpb         # build bundle (~16MB)
```

Upload to Azure Blob Storage for distribution:
```bash
az storage blob upload \
  --account-name myaihealthdownloads --container-name downloads \
  --name ab-health-mcp.mcpb --file ab-health-mcp.mcpb \
  --overwrite --auth-mode key
```

> **Note:** `.mcpbignore` excludes dev dependencies, source code, docs, and non-runtime directories. Never use raw `zip` — it will include everything and produce a 1GB+ file instead of 16MB.
>
> **⚠️ Critical:** All directory patterns in `.mcpbignore` MUST be root-relative (e.g., `/src/` not `src/`). Bare patterns match inside `node_modules/` and silently strip critical runtime code. See `COPILOT.md` for full build documentation.

### Test Auth Flow

```bash
npx tsx scripts/test-auth.ts
```

Opens a browser, you log in, and it verifies session + API calls work.

## Security

This project handles protected health information under Alberta's Health Information Act (HIA) and Protection of Privacy Act (POPA).

### Non-Negotiable Rules

1. **No PII in logs.** No names, health data, cookie values, or identifiers in log output.
2. **No health data stored.** Only encrypted session cookies are persisted (local mode) or encrypted into tokens (remote mode). All health data is returned to Claude and discarded.
3. **Credentials never touch the server.** In local mode, users enter credentials in the browser via Puppeteer. In remote mode, credentials are entered on the Alberta SSO page in the user's own browser.
4. **Encryption at rest.** Local: AES-256-GCM at `~/.mhr-records/session.enc`. Remote: AES-256-GCM in the OAuth access token (held on user's machine by Claude Desktop).
5. **Zero server-side storage (remote mode).** The server stores nothing — no database, no user data. Session cookies are encrypted into the OAuth token. If the server is compromised, there is no stored user data to leak.
6. **Canadian data residency.** Azure Canada Central for HIA/POPA compliance.

### Passthrough Principle

The MCP server is a pipe. It does **NOT**:
- Interpret or analyze health data (that's Claude's job)
- Cache health data beyond the session
- Calculate trends or averages
- Make medical assessments
- Store any health information

## Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP server framework |
| `puppeteer-core` | Browser automation for SSO login (requires system Chrome) |
| `tough-cookie` | Cookie jar management and serialization |
| `undici` | HTTP client |
| `express` | HTTP server for remote/OAuth mode |
| `express-rate-limit` | Rate limiting for OAuth endpoints |
| `mupdf` | PDF text extraction and image rendering (WASM) |

## Landing Page

The project has a landing page at [www.myaihealth.ca](https://www.myaihealth.ca) for explaining the extension and distributing downloads. Includes Open Graph meta tags for rich link previews in chat apps and a section recommending the free PubMed connector for medical research.

- **Hosting:** Azure Static Web Apps (Free tier)
- **API function:** `/api/request-access` — accepts form submissions, generates a 7-day SAS download link for the `.mcpb` file, and emails the link via Azure Communication Services
- **Email:** `noreply@myaihealth.ca` via Azure Communication Services (custom domain, verified SPF/DKIM/DMARC)
- **Download storage:** Azure Blob Storage (`myaihealthdownloads` account, `downloads` container)

### Deployment

```bash
# Deploy static site + API function
swa deploy ./static \
  --api-location ./api \
  --api-language node --api-version 18 \
  --deployment-token <TOKEN> \
  --env production
```

### Required App Settings

| Setting | Description |
|---------|-------------|
| `STORAGE_CONNECTION_STRING` | Azure Blob Storage connection string |
| `STORAGE_CONTAINER` | Container name (default: `downloads`) |
| `MCPB_BLOB_NAME` | Blob name (default: `ab-health-mcp.mcpb`) |
| `NOTIFY_EMAIL` | Email to receive access request notifications |
| `ACS_CONNECTION_STRING` | Azure Communication Services connection string |
| `ACS_FROM_EMAIL` | Verified sender email (default: `noreply@myaihealth.ca`) |

## Roadmap

- [x] **Phase 1 + 2: MHR Tools** — 24 tools for My Health Records (lab results, immunizations, medications, vitals, procedures, imaging, and more)
- [x] **MyChart Integration** — 20 tools for AHS Connect Care (visits, allergies, care team, messages, documents, scan downloads, proxy access, etc.)
- [x] **Session auto-refresh** — Cross-keepalive between MHR and MyChart, retry-once-with-keepalive on 401/403
- [x] **Desktop Extension** — One-click `.mcpb` install for Claude Desktop
- [x] **Landing Page** — myaihealth.ca with gated download access via Azure Communication Services email
- [ ] **Phase 3: Remote Mode** — OAuth 2.1 remote connector, Azure Container Apps deployment, zero-storage architecture
- [ ] **MFA support** — Relay MFA challenges for Alberta accounts with multi-factor enabled

## License

ISC
