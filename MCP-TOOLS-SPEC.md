# Alberta Health MCP Tools Spec

## Tool Design Principles

1. **Read-only passthrough.** Every tool fetches data from the API and formats it. No health data is stored, cached, or analyzed by the MCP server.
2. **Let Claude interpret.** The tools return structured health data. Claude (or Copilot) handles interpretation, trend analysis, and natural language summaries.
3. **Fail to the API.** If a request is invalid, let the API return the error. Don't validate client-side.
4. **Minimal tool surface.** Start with confirmed endpoints only. Add tools as new endpoints are verified.

---

## Phase 1 Tools (Confirmed and Implemented)

### connect_account

Opens a Chrome browser window for the user to sign in via Alberta SSO. Credentials never touch the MCP server — they are entered directly in the browser. After login, session cookies are captured for both MHR and MyChart, encrypted, and stored locally.

If a valid session already exists, returns immediately without opening a browser. Use `force=true` to re-authenticate.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| force | boolean | No | Force re-authentication even if a valid session exists. Also exits demo mode. |
| demo | boolean | No | Connect in demo mode with sample data. No browser or Alberta account needed. |
| accept_privacy | boolean | No | Set to true to acknowledge the privacy notice and proceed. Required on first use. |

**Behavior:**
1. If demo mode: return sample data immediately
2. If force=true without demo: exit demo mode
3. Check if a valid session already exists — if so, return immediately (unless `force=true`). Includes update check.
4. If first-ever real connection: show privacy notice (health data sent to Anthropic's US servers). User must call again with `accept_privacy=true` to proceed.
4. **Check for updates** via `/api/check-update` — if a newer version exists, return a download URL and block authentication. User must update before connecting.
5. Launch Chrome via Puppeteer (`headless: false`)
6. Navigate to `account.alberta.ca/ui/sign-in/signin` (SSO login)
7. User enters MyAlberta credentials (or auto-authenticates via persistent profile)
8. Navigate to MyChart SAML login (auto-authenticates via shared SSO)
9. Extract MyChart cookies and CSRF token
10. Navigate to MHR (auto-authenticates via shared SSO, retry once if needed)
11. Extract MHR cookies
12. Verify session by calling `/api/phr/v1/user`
13. Encrypt and store session (v2 format) at `~/.mhr-records/session.enc`
14. Close browser, return success with user name and connection status

**Response:**
```json
{
  "connected": true,
  "message": "Successfully connected to My Health Records and MyChart (AHS Connect).",
  "userName": "Jane Doe",
  "authorizedRecords": 1,
  "mhrConnected": true,
  "myChartConnected": true,
  "disclaimer": "IMPORTANT: This is your health record data..."
}
```

### check_connection

Verifies that the auth session is established and valid.

**Parameters:** None

**Behavior:**
1. Check if encrypted session exists
2. Call `GET /api/phr/v1/session?SessionMode=Patient&IsKeypressed=true`
3. Return session status

**Response:**
```json
{
  "connected": true,
  "userName": "Jane Doe",
  "sessionTimeRemaining": 600000
}
```

### disconnect_account

Clears stored session cookies.

**Parameters:** None

**Behavior:**
1. Delete encrypted session file (local) or Cosmos DB record (remote)
2. Confirm disconnection

### get_user_profile

Returns the authenticated user's profile and authorized records.

**Parameters:** None

**Calls:** `GET /api/phr/v1/user`

**Response (formatted):**
```json
{
  "name": "Jane Doe",
  "personId": "aaaaaaaa-...",
  "activeRecord": {
    "id": "11111111-...",
    "name": "Jane Doe",
    "relationship": "Self",
    "isCustodian": true
  },
  "authorizedRecords": [ ... ],
  "accountCreated": "2019-04-04"
}
```

### get_lab_results

Returns lab test results with optional date filtering.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| date_range | string | No | `All` | One of: `All`, `LastWeek`, `LastMonth`, `Last3Months`, `Last6Months`, `LastYear` |
| start_date | string | No | null | Custom start date (YYYY-MM-DD) |
| end_date | string | No | null | Custom end date (YYYY-MM-DD) |
| test_name | string | No | null | Filter results by test name (client-side filter) |

**Calls:** `GET /api/phr/v1/labresult/getData?startDate=...&endDate=...&dateRangeOptions=...&labConfiguration=00000000-0000-0000-0000-000000000000&showOtherSection=True&ignoreConfig=True`


**Date conversion:** If `start_date`/`end_date` are provided as YYYY-MM-DD, convert to the API's expected format: `{Day} {Mon} {DD} {YYYY}` (e.g., `Mon Jan 01 1753`). Use JavaScript's `new Date(dateStr).toDateString()`.

**Response (formatted):**
```json
{
  "totalResults": 59,
  "results": [
    {
      "date": "Nov 4, 2025 11:08 AM",
      "laboratory": "CCLAB",
      "orderedBy": "DR. SMITH",
      "facility": "EDM WMC University of Alberta Hospital",
      "status": "Final",
      "groups": [
        {
          "name": "CBC, No Differential",
          "status": "Final",
          "tests": [
            {
              "name": "Auto WBC",
              "value": "5.9",
              "displayValue": "5.9 10*9/L",
              "unit": "10*9/L",
              "referenceRange": "4.0-11.0 (10*9/L)",
              "status": "Final"
            }
          ],
          "attachments": []
        }
      ],
      "thingId": "xxxxxxxx-..."
    }
  ]
}
```

### download_attachment

Downloads a PDF or file attachment from a lab result.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| thing_id | string | Yes | The thingId of the lab result |
| filename | string | Yes | The attachment filename |

**Calls:** `GET /api/phr/v1/attachment/{thingId}/download?bName={filename}`

**Response:** Returns the file as MCP content blocks — PDFs are text-extracted (or rendered as images if scanned), images are returned inline. Claude can read the document contents directly.

---

## Implemented Tools (Endpoints Confirmed via HAR)

All of the following tools have been implemented and verified with real API calls.

### get_immunizations

**Calls:** `GET /api/phr/v1/myhealth/immunization-data-manager?startDate=...&endDate=...&dateRangeOptions=...`


**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| date_range | string | No | `All` | One of: `All`, `LastWeek`, `LastMonth`, `Last3Months`, `Last6Months`, `LastYear` |

**Response:** Array of immunization records. Each has `itemKey`, `effectiveDate`, and `values` array containing: `date-administered`, `administrator`, `name`, `edu-content`, `source`.

### get_medications

**Calls:** `GET /api/phr/v1/medication?startIndex=-1&endIndex=-1&type=all&status=Medication&includeOrphanRefills=false`

**Headers:** `Control-Mapping-Id: 8050` (required — only MHR endpoint that still needs CMID)

**Parameters:** None

### get_referrals

**Calls:** `GET /api/phr/v1/referral?startDate=...&endDate=...&dateRangeOptions=...`


**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| date_range | string | No | `AllData` | Date range filter |

### get_diagnostic_imaging

**Calls:** `GET /api/phr/v1/labresult/getData?...` (same endpoint as lab results, different CMID)


**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| date_range | string | No | `All` | Date range filter |

**Note:** Returns imaging reports (X-rays, ultrasounds, echocardiograms, CT, MRI) with PDF attachments. Use `download_attachment` to retrieve the PDFs.

### get_vitals

**Calls:** `GET /api/phr/v1/VitalSigns?startDate=...&endDate=...&dateRangeOptions=...&types=Res`


**Response:** Array of vital sign readings (pulse, temperature, respiratory rate, etc.) from clinical visits. Each has `when`, `title`, `value`, `unit`, `description`.

### get_blood_oxygen

**Calls:** `GET /api/phr/v1/myhealth/blood-oxygensaturation-data-manager?startDate=...&endDate=...&dateRangeOptions=...`


### get_blood_pressure

**Calls:** `GET /api/phr/v1/myhealth/blood-pressure-data-manager?startDate=...&endDate=...&dateRangeOptions=...`


### get_height_weight

Makes 3 parallel API calls:
- `GET /api/phr/v1/myhealth/height-data-manager?...`
- `GET /api/phr/v1/myhealth/weight-data-manager?...`
- `GET /api/phr/v1/bmi?...`

**Response:** Combined `{ height, weight, bmi }` arrays.

### get_exercise

**Calls:** `GET /api/phr/v1/exercise?startDate=...&endDate=...&dateRangeOptions=...`


**Response:** Array of exercise records with `source`, `calorieUnit`, `distanceUnit`, `durationUnit`, `exerciseValues`.

### download_attachment

**Calls:** `GET /api/phr/v1/attachment/{thingId}/download?bName={filename}`

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| thing_id | string | Yes | The thingId from attachment metadata |
| filename | string | Yes | The attachment filename |

**Response:** Returns MCP content blocks (`text` / `image`) produced from the downloaded file. PDFs are text-extracted or rendered as images if scanned, allowing Claude to read the document contents directly.

---

## Endpoints Not Yet Implemented

These sections exist in the MHR portal menu but have not been verified via HAR capture:

| Section | Likely Endpoint |
|---------|----------------|
| Allergies | `GET /api/phr/v1/allergy/...` |
| Appointments | `GET /api/phr/v1/appointment/...` |
| Medical Conditions | `GET /api/phr/v1/condition/...` |
| Family History | `GET /api/phr/v1/familyhistory/...` |

To add these: navigate to each section in the browser with DevTools open, export HAR, and follow the existing tool pattern.

---

## Additional MHR Tools (Implemented)

These tools were discovered from additional HAR analysis and are fully implemented:

### get_health_overview

Composite tool that calls multiple MHR and MyChart endpoints in a single request, returning a broad health snapshot (profile, medications, allergies, recent labs, health issues, immunizations).

**Parameters:** None

### get_procedures

**Calls:** `GET /api/phr/v1/procedure?startDate=...&endDate=...&dateRangeOptions=...`


**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| date_range | string | No | `All` | Date range filter |

### get_blood_glucose

**Calls:** `GET /api/phr/v1/myhealth/blood-glucose-data-manager?startDate=...&endDate=...&dateRangeOptions=...`


**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| date_range | string | No | `All` | Date range filter |

### get_sleep

**Calls:** `GET /api/phr/v1/myhealth/sleep-session-data-manager-v2?startDate=...&endDate=...&dateRangeOptions=...`


**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| date_range | string | No | `All` | Date range filter |

### get_dietary_intake

**Calls:** `GET /api/phr/v1/myhealth/dietary-intake-data-manager?startDate=...&endDate=...&dateRangeOptions=...`


**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| date_range | string | No | `All` | Date range filter |

### get_insulin

Makes 2 parallel API calls:
- `GET /api/phr/v1/myhealth/insulin-injection-data-manager?...`
- `GET /api/phr/v1/myhealth/insulin-injection-use-data-manager?...`

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| date_range | string | No | `All` | Date range filter |

**Response:** Combined `{ injections, usage }` arrays.

### get_peak_flow

**Calls:** `GET /api/phr/v1/myhealth/peak-flow-data-manager?startDate=...&endDate=...&dateRangeOptions=...`


**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| date_range | string | No | `All` | Date range filter |

### get_waist_circumference

**Calls:** `GET /api/phr/v1/myhealth/extendable-data-manager/waist-circumference?startDate=...&endDate=...&dateRangeOptions=...`


**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| date_range | string | No | `All` | Date range filter |

### get_symptom_journal

**Calls:** `GET /api/phr/v1/myhealth/extendable-data-manager/concern?startDate=...&endDate=...&dateRangeOptions=...`


**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| date_range | string | No | `AllData` | Date range filter |

---

## Tool Implementation Pattern

Every data tool follows the same pattern:

```typescript
import { mhrDateRangeTool } from './tool-factory.js';

// Simple date-range tool (most MHR tools follow this pattern)
export const getLabResultsTool = mhrDateRangeTool(
  'get_lab_results',
  'Get lab test results from your My Health Records account',
  (client, params) => client.getLabResults(params),
  'results',
);

// Other factory helpers:
// simpleMhrTool(name, description, method, resultKey) — no params
// simpleMyChartTool(name, description, method) — MyChart tools
```

---

## Error Handling

| Error | MCP Response |
|-------|-------------|
| No session | `"Not connected. Use connect_account to sign in to your MyAlberta account."` |
| Session expired | `"Session expired. Use connect_account to sign in again."` |
| API 401 | Same as session expired |
| API 500 | `"My Health Records is currently unavailable. Try again later."` |
| Network error | `"Could not reach My Health Records. Check your internet connection."` |

---

## Response Formatting Guidelines

- Return structured JSON, not markdown tables (let Claude format for the user)
- Include all data from the API response; do not filter or summarize
- Convert dates to ISO 8601 where possible, but keep the API's `displayDate` fields
- Preserve ordering from the API response
- Include `thingId` and other identifiers so users can reference specific results

---

## MyChart (AHS Connect Care) Tools

### Overview

20 tools providing access to AHS Connect Care (MyChart) at `https://myahsconnect.albertahealthservices.ca/MyChartPRD/`. All tools are prefixed with `mc_` and use `__RequestVerificationToken` CSRF header instead of Control-Mapping-Id. CSRF token is obtained during authentication from `/MyChartPRD/Home/CSRFToken`.

**Authentication:** MyChart shares Alberta's SSO with MHR. After Puppeteer SSO login, the browser navigates to MyChart's SAML endpoint which auto-authenticates. Cookies and CSRF token are stored in the v2 session format.

**Tool pattern:** Each MyChart tool calls `ensureMyChartSession()` to get an authenticated `MyChartClient`, calls the appropriate API method, and returns JSON-stringified response.

### mc_get_visits

Returns past and upcoming appointments from MyChart.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| time_frame | string | No | `all` | One of: `upcoming`, `past`, `all` |
| visit_id | string | No | null | CSN (contact serial number) for visit details |

**Calls:**
- `POST Visits/VisitsList/LoadUpcoming` (body: `timeZone=America/Edmonton`)
- `POST Visits/VisitsList/LoadPast` (body: `serializedIndex=`)
- `POST api/visits/past-details/GetVisitDetailsPast` (body: `{csn, eorgID: ''}`) — when `visit_id` provided

### mc_get_health_summary

Returns health summary overview from MyChart.

**Parameters:** None

**Calls:** `POST api/health-summary/FetchHealthSummary` (body: `{}`)

### mc_get_allergies

Returns allergy list from MyChart.

**Parameters:** None

**Calls:** `POST api/allergies/LoadAllergies` (body: `{isHealthSummary: true}`)

### mc_get_health_issues

Returns active diagnoses and conditions from MyChart.

**Parameters:** None

**Calls:** `POST api/HealthIssues/LoadHealthIssuesData` (body: `{isHealthSummary: true}`)

### mc_get_care_team

Returns care team providers from MyChart.

**Parameters:** None

**Calls:** `POST Clinical/CareTeam/Load` (form-encoded body: `{}`)

### mc_get_messages

Returns patient messages and conversations from MyChart.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| folder | string | No | `all` | One of: `inbox`, `sent`, `all` |
| message_id | string | No | null | Conversation ID for message details |

**Calls:**
- `POST api/conversations/GetConversationList` (body: `{tag, localLoadParams, externalLoadParams, searchQuery, PageNonce}`)
- `POST api/conversations/GetConversationDetails` (body: `{id, messageId, organizationId, PageNonce}`) — when `message_id` provided

### mc_get_medical_history

Returns medical and family history from MyChart.

**Parameters:** None

**Calls:** `POST api/histories/LoadHistoriesViewModel` (body: `{}`)

### mc_get_documents

Returns clinical documents from MyChart.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| document_id | string | No | null | DCS ID for document details |
| file_extension | string | No | null | File extension (e.g., `pdf`) for document download |

**Calls:**
- `POST api/documents/viewer/LoadOtherDocuments` (body: `{isInitialLoad: true}`)
- `POST api/documents/viewer/GetDocumentDetails` (body: `{dcsId, fileExtension, organizationId, useOldMobileLink}`) — when `document_id` provided

### mc_get_upcoming_orders

Returns upcoming tests and procedures from MyChart.

**Parameters:** None

**Calls:** `POST api/upcoming-orders/GetUpcomingOrders` (body: `{selectedOrderID, PageNonce}`)

### mc_get_test_results

Returns test results from AHS labs via MyChart.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| search_string | string | No | null | Filter results by search term |
| order_id | string | No | null | Order key for result details |

**Calls:**
- `POST api/test-results/GetList` (body: `{groupType, searchString, maxResults, isCurAdmFilterEnabled}`)
- `POST api/test-results/GetDetails` (body: `{orderKey, organizationID, PageNonce}`) — when `order_id` provided

### mc_get_family_tree

Returns family tree and pedigree from MyChart.

**Parameters:** None

**Calls:** `POST api/pedigree/LoadPedigree` (body: `{welcomeLocale: ''}`)

### mc_get_goals

Returns patient and care team goals from MyChart.

**Parameters:** None

**Calls:**
- `POST api/goals/LoadPatientGoals` (body: `{PageNonce: ''}`)
- `POST api/goals/LoadCareTeamGoals` (body: `{PageNonce: ''}`)

**Response:** Combined `{patientGoals, careTeamGoals}` object.

### mc_get_referrals

Returns referral details from AHS via MyChart.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| referral_id | string | No | null | RFL ID for referral details |

**Calls:**
- `POST api/referrals/listReferrals` (body: `{}`)
- `POST api/referrals/getReferralDetails` (body: `{RflId, GetFullRFL: false}`) — when `referral_id` provided

### mc_get_medications

Returns medications from AHS via MyChart.

**Parameters:** None

**Calls:** `POST api/medications/LoadMedicationsPage` (body: `{context: 2}`)

### mc_get_immunizations

Returns immunization records from AHS via MyChart.

**Parameters:** None

**Calls:** `POST api/immunizations/LoadImmunizations` (body: `{}`)

### mc_download_document

Downloads scan images or documents from test results via MyChart.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| dcs_id | string | Yes | Document content service ID (dcsId) from test result scans or document listings |
| file_extension | string | Yes | File extension (e.g., JPG, PNG, PDF) from the scan/document metadata |

**Calls:** `POST api/test-results/DownloadDocumentBinary` (body: `{dcsId, fileExtension, organizationId, useOldMobileLink}`)

**Response:** Returns the document as base64-encoded content blocks, allowing Claude to view images or read PDF text directly.

### mc_get_historical_results

Returns historical trend data for specific test result components from MyChart — shows how a test value has changed over time.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| order_id | string | Yes | Order key from mc_get_test_results details |
| component_ids | string[] | Yes | Array of component IDs from the test result details to get historical trends for |

**Calls:** `POST api/past-results/GetMultipleHistoricalResultComponents` (body: `{orderID, selectedComponentIDs, isInitialLoad: true, startTime: '', endTime: '', organizationID: '', PageNonce: ''}`)

### mc_get_appointment_requests

Returns pending appointment requests awaiting scheduling from MyChart.

**Parameters:** None

**Calls:** `POST Visits/VisitsList/LoadAppointmentRequest` (form-encoded body: `{}`)

### mc_list_proxy_access

Lists all patient records accessible via proxy access in MyChart — includes own records and any Friends & Family / guardian / shared records. Use this to discover proxy IDs for mc_switch_context.

**Parameters:** None

**Calls:** `GET ProxySwitch?noCache={random}`

### mc_switch_context

Switches MyChart to view a different patient's records via Friends & Family proxy access. After switching, all mc_* tools return the selected patient's data.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| proxy_id | string | Yes | Patient proxy ID from mc_list_proxy_access, or "self" to switch back to own records |

**Calls:** Navigates to `inside.asp?mode=proxyswitch&action=switchcontext&src=0&eid={proxyId}` or `inside.asp?mode=self` (for switching back). Refreshes CSRF token after switch.

**Usage flow:**
1. Call `mc_list_proxy_access` to see available patients
2. Call `mc_switch_context` with the desired proxy ID
3. Use `mc_get_test_results` and other `mc_*` tools — they now return the proxy patient's data
4. Call `mc_switch_context` with `proxy_id="self"` to switch back
