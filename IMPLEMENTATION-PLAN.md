# Implementation Plan

## Status: Phase 1 + 2 Complete, MyChart Integration Complete

All core infrastructure, MHR health data tools (24), and MyChart tools (20) are implemented and working. Total: 44 tools.

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
