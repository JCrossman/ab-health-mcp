# Alberta Health MCP Server - Architecture Spec

## Overview

MCP server that provides a passthrough API to Alberta's My Health Records portal (`myhealthrecords.alberta.ca`) and AHS MyChart / Connect Care (`myahsconnect.albertahealthservices.ca/MyChartPRD/`). Enables natural language access to personal health data via Claude Desktop and M365 Copilot.

**This is a read-only passthrough.** The MCP server does not store health data, modify records, or add business logic. It authenticates, fetches, and formats.

## System Architecture

```
┌──────────────────────────────────┐
│  Claude Desktop                  │
└──────────────┬───────────────────┘
               │ MCP Protocol (stdio or Streamable HTTP)
               ▼
┌──────────────────────────────────┐
│   Alberta Health MCP Server      │
│   (Node.js / TypeScript)         │
└──────┬───────────┬───────┬───────┘
       │           │       │
       ▼           ▼       ▼
┌──────────┐ ┌──────────┐ ┌───────────────────────────────────┐
│ Puppeteer│ │ MHR API  │ │ MyChart API                       │
│ (Chrome) │ │ (REST)   │ │ (REST + CSRF)                     │
└────┬─────┘ └──────────┘ └───────────────────────────────────┘
     │        myhealthrecords   myahsconnect.albertahealthservices
     │        .alberta.ca       .ca/MyChartPRD/
     ▼ (SSO)
┌──────────────────────────────────┐
│ account.alberta.ca (SSO login)   │
│   → MyChart SAML auto-auth      │
│   → MHR SSO auto-auth           │
└──────────────────────────────────┘
```

## Technology Stack

- **Runtime:** Node.js 22+
- **Language:** TypeScript (strict mode)
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **HTTP Client:** `undici`
- **Browser Automation:** `puppeteer-core` (for SSO authentication; requires system Chrome)
- **Cookie Management:** `tough-cookie` (serializable cookie jar)
- **PDF Processing:** `mupdf` (WASM — text extraction and image rendering for scanned PDFs)
- **HTTP Server:** `express` (for remote/OAuth mode)
- **Rate Limiting:** `express-rate-limit` (OAuth endpoints)
- **Transport:** stdio (local Claude Desktop); Streamable HTTP (remote mode, implemented)
- **Session Storage:** Local encrypted file (AES-256-GCM) at `~/.mhr-records/session.enc` for stdio; encrypted into OAuth access token for HTTP mode (zero server-side storage)
  - v2 format: MHR cookie jar + MyChart cookie jar + CSRF token (backward compatible with v1)
- **Browser Profile:** Persistent at `~/.mhr-records/browser-profile`
- **MHR Auth:** Most endpoints no longer require `Control-Mapping-Id` (removed by Alberta, March 2026). Medications still requires CMID `8050`.
- **MyChart Auth:** `__RequestVerificationToken` CSRF header (token obtained from `/MyChartPRD/Home/CSRFToken`)

## Key Domains

| Domain | Purpose |
|--------|---------|
| `account.alberta.ca` | Alberta SSO authentication (user enters credentials here) |
| `console.myhealthrecords.alberta.ca` | SAML Service Provider — intermediary sign-in page |
| `identity.prd.telushealthspace.com` | TELUS Health Identity Provider (SAML IdP) |
| `sts.xiduam.ca` | Security Token Service (SAML chain) |
| `myhealthrecords.alberta.ca` | My Health Records JSON REST API |
| `myahsconnect.albertahealthservices.ca` | AHS MyChart / Connect Care portal (REST + CSRF) |

## Passthrough Principle

Identical to the DATS project. This MCP server:

1. Accepts requests from Claude/Copilot clients
2. Calls the My Health Records and MyChart APIs
3. Formats the response for display
4. Returns the data

**DO NOT:**
- Interpret or analyze health data (that is Claude's job, not the MCP server's)
- Cache health data beyond the session
- Add business logic or validation
- Store any health information

## Data Residency

All project infrastructure in Azure Canada Central. Note: conversations are processed by Claude (Anthropic) on US-based servers — health data leaves Canada when sent to Claude for interpretation. This extension does not control Anthropic's data handling. Our infrastructure complies with POPA and HIA (Health Information Act).

## Azure Infrastructure

All resources live in the `ab-health-mcp` resource group, Health MCP subscription (`e247b2e9-...`), Canada Central.

| Resource | Type | Purpose |
|----------|------|---------|
| `myaihealth` | Static Web App (Free) | Landing page + 3 API functions (`request-access`, `check-update`, `download`) |
| `myaihealthdownloads` | Storage Account (Standard_LRS) | `.mcpb` bundle + `version.json` + `accessrequests` table |
| `myaihealth-comm` / `myaihealth-email` | Communication Services | Transactional emails (`noreply@myaihealth.ca`) |
| `ab-health-mcp` | Container App (0.5 vCPU / 1Gi) | Remote mode HTTP server (Phase 3, not yet productized) |
| `ab-health-mcp-env` | Managed Environment (Consumption) | Hosts the Container App |
| `abhealthmcpacr` | Container Registry (Basic) | Docker images for Container App |
| `myaihealth-insights` | Application Insights | Visitor analytics for myaihealth.ca (cookie-free) |
| `workspace-abhealthmcpnOID` | Log Analytics Workspace | Backend for App Insights + Container App logs (0.5 GB/day cap) |

### Cost Governance

- **Budget:** `MainBudget` — $100 CAD/month with automated enforcement
- **Alerts:** Email at 50%, 75%; email + automated shutdown at 90%, 100%; forecasted alert at 100%
- **Enforcement:** `budget-enforcement-aa` Automation Account with `shutdown-resources` PowerShell runbook — scales Container App to 0 replicas and caps Log Analytics ingestion when triggered
- **Action Group:** `budget-enforcement-ag` — triggers the runbook via webhook
- **Anomaly detection:** ML-based cost anomaly alert emails on unusual spending patterns

### Monitoring & Analytics

- **Application Insights** (`myaihealth-insights`) — anonymous visitor tracking on all 4 static HTML pages (index, demo, terms, 404). Uses the JS SDK with `disableCookiesUsage: true`. Tracks pageviews, sessions, geography, referrers, browser/OS. Free tier (5 GB/month ingestion).
- **Log Analytics** — Container App and environment logs. Daily ingestion cap of 0.5 GB to prevent runaway costs.

## Directory Structure

```
ab-health-mcp/
├── src/
│   ├── index.ts                    # MCP server entry point (stdio, 44 tools)
│   ├── types.ts                    # TypeScript interfaces for API responses
│   ├── api/
│   │   ├── auth-client.ts          # Puppeteer SSO auth with stealth measures
│   │   ├── mhr-client.ts           # MHR REST API client with cookie jar + retry-on-401
│   │   └── mychart-client.ts       # MyChart REST API client with cookie jar + CSRF + retry
│   ├── auth/
│   │   └── session-manager.ts      # AES-256-GCM encrypted session storage (v2: MHR + MyChart)
│   ├── tools/
│   │   ├── tool-factory.ts         # Factory functions with pagination (offset/max_results)
│   │   ├── simple-mhr-tools.ts     # 14 simple MHR tools (via factory)
│   │   ├── simple-mychart-tools.ts # 11 simple MyChart tools (via factory)
│   │   ├── connect-account.ts      # Complex tools with unique logic (individual files)
│   │   ├── check-connection.ts
│   │   ├── disconnect-account.ts
│   │   ├── get-health-overview.ts
│   │   ├── get-user-profile.ts
│   │   ├── get-lab-results.ts
│   │   ├── get-diagnostic-imaging.ts
│   │   ├── get-immunizations.ts
│   │   ├── get-height-weight.ts
│   │   ├── download-attachment.ts
│   │   ├── mc-get-visits.ts
│   │   ├── mc-get-messages.ts
│   │   ├── mc-get-documents.ts
│   │   ├── mc-get-test-results.ts
│   │   ├── mc-get-historical-results.ts
│   │   ├── mc-get-goals.ts
│   │   ├── mc-get-referrals.ts
│   │   ├── mc-switch-context.ts
│   │   └── mc-download-document.ts
│   ├── helpers/
│   │   ├── session-helpers.ts      # Session validation, cross-keepalive
│   │   ├── content-helpers.ts      # PDF text extraction + image rendering (mupdf WASM)
│   │   └── demo-data.ts            # Sample health data for demo mode
│   ├── server/
│   │   ├── create-server.ts        # MCP server factory (registers all 44 tools)
│   │   ├── http-index.ts           # HTTP entry point (Streamable HTTP + OAuth 2.1)
│   │   ├── oauth-provider.ts       # OAuth 2.1 provider (auth code flow)
│   │   ├── token-crypto.ts         # Encrypt/decrypt session into OAuth access token
│   │   ├── session-context.ts      # AsyncLocalStorage for per-request session
│   │   └── cookie-converter.ts     # Chrome extension cookie → tough-cookie converter
│   └── utils/
│       ├── errors.ts               # Typed errors (SessionExpired, AuthRequired, etc.)
│       ├── logger.ts               # Stderr logging (no PII)
│       └── formatters.ts           # Date/value formatting
├── static/                         # Landing page (myaihealth.ca)
│   ├── index.html                  # Single-page site (Tailwind CSS + App Insights)
│   ├── demo.html                   # Demo gallery page
│   ├── terms.html                  # Terms of use
│   ├── 404.html                    # Custom 404 page
│   ├── og-image.png                # Open Graph preview image (1200×630)
│   └── hero.png / flatIcons.png    # Gemini-generated graphics
├── api/                            # Azure Functions (landing page backend)
│   ├── request-access/             # Form handler → SAS URL + ACS email notification
│   ├── check-update/               # Version check → 30-minute SAS download URL
│   └── download/                   # Signed download redirect
├── extension/                      # Chrome extension (cookie capture for remote auth)
├── portal/                         # Next.js web portal (alternative to Claude Desktop)
├── staticwebapp.config.json        # Azure Static Web Apps config
├── scripts/
│   └── test-auth.ts                # Standalone auth flow test
├── package.json
├── tsconfig.json
└── README.md
```
