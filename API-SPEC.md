# Alberta Health API Spec (Reverse Engineered)

## Base URL

```
https://myhealthrecords.alberta.ca
```

All API endpoints are JSON REST. The SPA is an Angular app served from `/ng/`. API calls are same-origin XHR requests authenticated via server-side session cookies.

## Authentication

Authentication is handled by a multi-party SAML SSO chain. The flow is cookie-based with no Bearer tokens or API keys.

> **Implementation note:** The MCP server uses Puppeteer to open a real Chrome browser for authentication. The user signs in through the standard Alberta SSO page. See `AUTH-FLOW-SPEC.md` for the full SAML chain details and implementation.

### Auth Flow (from original HAR capture)

These are the API endpoints called by the SSO SPA at `account.alberta.ca`. In the actual MCP implementation, Puppeteer handles this flow automatically via the browser.

```
1. GET  account.alberta.ca/app/account/services/api/metadata
2. GET  account.alberta.ca/app/account/services/api/is-login-token-valid
   -> Returns 401 if not logged in
3. GET  account.alberta.ca/app/account/services/api/application-session-process?p={encoded_redirect_token}
   -> The `p` parameter is an encoded token that identifies the target application (myhealthrecords)
4. POST account.alberta.ca/app/account/services/api/account-checks
   -> Body: UserName={username} (form-encoded)
   -> Validates the account exists
5. POST account.alberta.ca/app/account/services/api/signin
   -> Body: Username={username}&Password={password} (form-encoded)
   -> Content-Type: application/x-www-form-urlencoded
   -> Sets session cookies on success
6. GET  account.alberta.ca/app/account/services/api/is-login-token-valid
   -> Should return 200 after successful signin
7. GET  account.alberta.ca/app/account/services/api/application-session-process?p={encoded_redirect_token}
   -> Establishes session for the health records app
8. GET  account.alberta.ca/app/account/services/api/account-details
   -> Returns account metadata
```

### Session Management

- Sessions are cookie-based (ASP.NET backend)
- Session timeout: ~10 minutes (600,000ms based on session endpoint response)
- Session keepalive: `GET /api/phr/v1/session?SessionMode=Patient&IsKeypressed=true`
- Response: `{"isSessionExpired": false, "numberOfMilliSecondsLeftForSessionExpire": 600000.0}`

### Important Auth Notes

- The `p` parameter in `application-session-process` is application-specific. It must be obtained by navigating to the login page of the target app. Each session generates a new `p` value.
- Cookies are HTTPOnly and managed by the browser. The MCP server will need to capture and replay these cookies using a cookie jar.
- The SSO domain `account.alberta.ca` uses CORS with `access-control-allow-credentials: true`.

---

## Core Endpoints

### App Initialization

#### GET /api/combined/v1/initial

Returns the full app configuration including site settings, menu structure, theme, localisation strings, and CMS content. ~992KB response.

**Response structure:**
```json
{
  "data": {
    "/api/cms/v1/settings/browser": { "siteSettings": { ... } },
    "/api/cms/v1/pages/root/browser": { ... },
    "/api/cms/v1/theme/browser": { ... },
    "/api/cms/v1/menu/root": { "menu": [ ... ] },
    "/api/phr/v1/locale": [ ... ],
    "/api/phr/v1/localisation/common": { ... },
    "/api/phr/v1/localisation/tile": { ... },
    "/api/phr/v1/localisation/appointment": { ... },
    "/api/cms/v1/contents/browser/Header": { ... },
    "/api/cms/v1/contents/browser/Footer": { ... },
    "/api/phr/v1/unitdecimalprecission": [ ... ]
  }
}
```

Not needed for MCP server operation. Useful only for understanding available features.

### User Profile

#### GET /api/phr/v1/user

Returns the authenticated user's profile and authorized records.

**Response:**
```json
{
  "personId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "authorizedRecords": [
    {
      "id": "11111111-2222-3333-4444-555555555555",
      "isCustodian": true,
      "displayName": "Jane Doe",
      "name": "Jane Doe",
      "relationshipType": "Self",
      "patientInfo": ""
    }
  ],
  "selectedRecordId": "11111111-2222-3333-4444-555555555555",
  "defaultUserLanguage": "en-CA",
  "isEmergencyAccessMode": false,
  "createdDateTimeUtc": "2019-04-04T00:38:35.833",
  "name": "Jane Doe"
}
```

**Key fields:**
- `selectedRecordId`: The active health record UUID. Used in other API calls.
- `authorizedRecords`: List of records the user can access (may include dependents).
- `personId`: The user's account UUID.

#### GET/POST /api/phr/v1/user/IsRecordSelected

Returns `true` or `false`. POST variant has no body.

#### GET /api/phr/v1/record/{recordId}/getattributes

Returns attributes for a specific record. Empty array `[]` observed.

---

## Health Data Endpoints

### Lab Results

#### GET /api/phr/v1/labresult/getData

The primary health data endpoint. Returns all lab test results.

**Query Parameters:**

| Parameter | Example | Description |
|-----------|---------|-------------|
| `startDate` | `Mon Jan 01 1753` | Start date (human-readable format) |
| `endDate` | `Fri Dec 31 9999` | End date |
| `dateRangeOptions` | `All`, `LastWeek`, `Last6Months` | Predefined range |
| `labConfiguration` | `00000000-0000-0000-0000-000000000000` | Lab config UUID (zeros = all) |
| `showOtherSection` | `True` | Include "Other" section |
| `ignoreConfig` | `True` | Ignore lab configuration filtering |
| `startIndex`, `endIndex` | `-1`, `-1` | Request the complete list, as the current portal does |

**Request Header:**
- `Control-Mapping-Id: <resolved lab mapping>` from the authenticated CMS configuration; never hard-code a captured ID.

**Response:** An array of lab result entries, or a `{ "totalCount": number, "data": [...] }` envelope. The client accepts complete envelopes and rejects incomplete or unsupported responses instead of reporting zero records. Preset ranges such as `LastYear` omit all-time date bounds; explicit dates use `dateRangeOptions=Custom`.

```json
[
  {
    "labTestDate": {
      "date": 4, "month": 11, "year": 2025,
      "hour": 11, "minute": 8, "second": 0, "hasTimePart": false
    },
    "labResultDate": "2025-11-04T11:08:00",
    "labResultDisplayDate": "2025-11-04T11:08:00",
    "labResultDisplayDateText": "Nov 4, 2025 11:08 AM",
    "laboratoryName": "CCLAB",
    "orderedByName": "DR. SMITH",
    "orderByType": "EDM WMC University of Alberta Hospital",
    "source": "Netcare Connector",
    "clientId": 0000000000,
    "thingId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "versionStamp": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
    "isReadOnly": false,
    "isItemRestricted": true,
    "customData": [],
    "group": [
      {
        "groupName": "Surgical Pathology",
        "laboratoryName": "CCLAB",
        "isOtherSection": false,
        "hasGroupWithOutResult": false,
        "labOrderStatus": "Final",
        "attachmentCount": 1,
        "attachment": [
          {
            "name": "Surgical Pathology 2025-11-04 11 08 AM.pdf.pdf",
            "viewUrl": "https://myhealthrecords.alberta.ca/ViewFile.aspx?THID=...&BName=...",
            "downloadUrl": "https://myhealthrecords.alberta.ca/api/phr/v1/attachment/{id}/download?bName=...",
            "contentType": "application/pdf"
          }
        ],
        "results": [
          {
            "when": "Nov 4, 2025 11:08 AM",
            "whenDate": "2025-11-04T11:08:00",
            "displayDate": "Nov 4, 2025 11:08 AM",
            "name": "Surgical Pathology",
            "values": {
              "displayValue": "",
              "unitText": "",
              "prevDisplayValue": ""
            },
            "index": 0,
            "clinicalCode": {
              "text": "Surgical Pathology",
              "code": [
                {
                  "value": "XCA01379-7",
                  "family": "Lab-Test-Results",
                  "type": "AHSLabTestResults",
                  "version": "2017-02-23"
                }
              ]
            },
            "eduContent": "1|XCA01379-7|Surgical Pathology|en-CA|3",
            "resultUniqueId": "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz",
            "customData": [ ... ],
            "labOrderStatus": "Final",
            "labOrderStatusValue": "f"
          }
        ],
        "customData": []
      }
    ]
  }
]
```

**Result with numeric values (e.g., blood test):**
```json
{
  "name": "Prostate Specific Antigen (PSA), total",
  "values": {
    "displayValue": "1.4 ug/L",
    "value": "1.4",
    "unitText": "ug/L",
    "rangeDisplayText": "<2.6 (ug/L)",
    "prevDisplayValue": "1.4 ug/L"
  },
  "clinicalCode": {
    "text": "Prostate Specific Antigen (PSA), total",
    "code": [{ "value": "2857-1", "family": "Lab-Test-Results", "type": "AHSLabTestResults" }]
  }
}
```

**Multi-result group example (CBC):**
```
Auto WBC:    5.9 10*9/L   (range: 4.0-11.0)
RBC:         4.75 10*12/L (range: 4.30-6.00)
Hemoglobin:  147 g/L      (range: 135-175)
... etc
```

### Vital Signs / Latest Data

#### GET /api/phr/v1/latestdata?type={type}&clientDateTime={datetime}

Returns latest readings for a specific vital type. Returns 204 No Content if no data.

| Parameter | Example | Description |
|-----------|---------|-------------|
| `type` | `bp` | Vital sign type (bp = blood pressure) |
| `clientDateTime` | `2026-03-06T15:42` | Client local datetime |

**Request Header:**
- `Control-Mapping-Id: 7962`

#### GET /api/phr/v1/latestdata/tileaction?type={type}

Returns tile display metadata for a vital type.

**Response:**
```json
{
  "actionType": "None",
  "noDataMessage": "No new data available",
  "hideNoDataMessage": false,
  "hideNotificationText": false,
  "hasCombinedNotificationCount": false
}
```

### Attachments

#### GET /api/phr/v1/attachment/{thingId}/download?bName={filename}

Downloads a PDF or other attachment associated with a lab result or report.

### Educational Content

#### GET /api/phr/v1/educontent?educontent={encoded_string}

Returns educational information about a specific lab test. The `educontent` parameter is a pipe-delimited string: `{version}|{code}|{name}|{locale}|{level}`.

Example: `"1|2857-1|Prostate Specific Antigen (PSA), total|en-CA|3"`

---

## Permissions

#### GET /api/phr/v1/recordquerypermissions

Returns a map of data type UUIDs to permission levels for the active record.

```json
{
  "recordId": "11111111-2222-3333-4444-555555555555",
  "dataTypePermissions": {
    "9f4e0fcd-10d7-416d-855a-90514ce2016b": 15,
    "92ba621e-66b3-4a01-bd73-74844aed4f5b": 15,
    ...
  }
}
```

Permission value `15` likely means full CRUD (bitmask: read=1, write=2, update=4, delete=8).

---

## Notifications

#### GET /api/phr/v1/notificationproxy/count?includeRecommendations=false

Returns notification count. Observed response: `{}`

#### POST /api/phr/v1/notificationproxy/thingTypes?unreadOnly=true

Returns unread notifications filtered by type.

**Body:**
```json
{ "typeIds": ["5800eab5-a8c2-482a-a4d6-f1db25ae08c3"] }
```

**Response:** `[]` (empty array when no unread notifications)

---

## Session Management

#### GET /api/phr/v1/session?SessionMode=Patient&IsKeypressed=true

Keepalive / session check.

**Response:**
```json
{
  "isSessionExpired": false,
  "numberOfMilliSecondsLeftForSessionExpire": 600000.0
}
```

Call this periodically to prevent session timeout (every ~5 minutes).

#### POST /api/phr/v1/locale

Set the user's locale.

**Body:** `{"language": "en-CA"}`

---

## Endpoints Confirmed via Additional HAR Captures

These endpoints were verified by navigating the MHR portal and capturing network traffic.

### Immunizations

#### GET /api/phr/v1/myhealth/immunization-data-manager

**Query Parameters:** `startDate`, `endDate`, `dateRangeOptions` (same pattern as lab results)

**Historical header:** `Control-Mapping-Id: 7695` (not sent by the current client).

**Response:** Array of immunization records. Each has `itemKey` (thingId, versionStamp), `effectiveDate`, and `values` array with entries for `date-administered`, `administrator`, `name`, `edu-content`, `source`.

### Medications

#### GET /api/phr/v1/medication

**Query Parameters:** `startIndex=-1`, `endIndex=-1`, `type=all`, `status=Medication`, `includeOrphanRefills=false`

**Request Header:** Resolve the read-only Medication control from CMS and send its `Control-Mapping-Id`. Select `FilterByConfiguredAppIds`, not the editable Other Medicines control.

### Referrals

#### GET /api/phr/v1/referral

**Query Parameters:** `startDate`, `endDate`, `dateRangeOptions=AllData`

**Historical header:** `Control-Mapping-Id: 7705` (not sent by the current client).

### Diagnostic Imaging

#### GET /api/phr/v1/labresult/getData (diagnostic-imaging mapping)

Same endpoint and paging contract as lab results, but resolve the control on `/ResultsAndReadings/DiagnosticImagingReports` rather than `/ResultsAndReadings/LabResults`. Do not reuse the lab mapping or a historical CMID.

Response includes PDF attachments with download URLs.

### Vital Signs

#### GET /api/phr/v1/VitalSigns

**Query Parameters:** `startDate`, `endDate`, `dateRangeOptions`, `types`

The current client selects vital signs with `types`. CMIDs in the historical reference below are not sent by the client:

| CMID | types | Description |
|------|-------|-------------|
| 7715 | `Pls,Res,Tmp` | All vitals (pulse, respiration, temperature) |
| 7717 | `Pls` | Pulse only |
| 7718 | `Tmp` | Temperature only |
| 7730 | `Res` | Respiration only |

**Current client:** `types=Pls,Res,Tmp`; no fixed control-mapping header.

**Response:** Array of vital sign readings with `when`, `whenDS`, `title`, `value`, `unit`, `description`.

### Blood Oxygen Saturation

#### GET /api/phr/v1/myhealth/blood-oxygensaturation-data-manager

**Historical header:** `Control-Mapping-Id: 7722` (not sent by the current client).

### Blood Pressure

#### GET /api/phr/v1/myhealth/blood-pressure-data-manager

**Historical header:** `Control-Mapping-Id: 7716` (not sent by the current client).

### Height / Weight / BMI

- Height: `GET /api/phr/v1/myhealth/height-data-manager` (CMID: 7749)
- Weight: `GET /api/phr/v1/myhealth/weight-data-manager` (CMID: 7750)
- BMI: `GET /api/phr/v1/bmi` (CMID: 7748)

BMI response has different structure: `heightValue`, `weightValue`, `when`, `bmiValue`, `notes`.

### Exercise

#### GET /api/phr/v1/exercise

**Historical header:** `Control-Mapping-Id: 7742` (not sent by the current client).

**Response:** Array with `source`, `calorieUnit`, `distanceUnit`, `durationUnit`, `exerciseValues`.

### Procedures

#### GET /api/phr/v1/procedure

**Query Parameters:** `startDate`, `endDate`, `dateRangeOptions`

**Historical header:** `Control-Mapping-Id: 7739` (not sent by the current client).

### Blood Glucose

#### GET /api/phr/v1/myhealth/blood-glucose-data-manager

**Query Parameters:** `startDate`, `endDate`, `dateRangeOptions`

**Historical header:** `Control-Mapping-Id: 7724` (not sent by the current client).

### Insulin

- Injections: `GET /api/phr/v1/myhealth/insulin-injection-data-manager` (CMID: 7725)
- Usage: `GET /api/phr/v1/myhealth/insulin-injection-use-data-manager` (CMID: 7726)

**Query Parameters:** `startDate`, `endDate`, `dateRangeOptions`

### Peak Flow (Asthma)

#### GET /api/phr/v1/myhealth/peak-flow-data-manager

**Query Parameters:** `startDate`, `endDate`, `dateRangeOptions`

**Historical header:** `Control-Mapping-Id: 7731` (not sent by the current client).

### Sleep Sessions

#### GET /api/phr/v1/myhealth/sleep-session-data-manager-v2

**Query Parameters:** `startDate`, `endDate`, `dateRangeOptions`

**Historical header:** `Control-Mapping-Id: 7757` (not sent by the current client).

### Dietary Intake

#### GET /api/phr/v1/myhealth/dietary-intake-data-manager

**Query Parameters:** `startDate`, `endDate`, `dateRangeOptions`

**Historical header:** `Control-Mapping-Id: 7764` (not sent by the current client).

### Waist Circumference

#### GET /api/phr/v1/myhealth/extendable-data-manager/waist-circumference

**Query Parameters:** `startDate`, `endDate`, `dateRangeOptions`

**Historical header:** `Control-Mapping-Id: 7751` (not sent by the current client).

### Symptom Journal

#### GET /api/phr/v1/myhealth/extendable-data-manager/concern

**Query Parameters:** `startDate`, `endDate`, `dateRangeOptions=AllData`

**Historical header:** `Control-Mapping-Id: 7760` (not sent by the current client).

---

## Control-Mapping-Id Reference

Control mappings are deployment-specific metadata, not stable API constants. Read `GET /api/cms/v1/pages/root/browser` with the active session and locale, then resolve the requested page and control. Settings may be an object or a list. Missing or ambiguous matches are errors.

| View | CMS page | Selection |
|------|----------|-----------|
| Medications | `/HealthSummary/Medicines` | `MedicationCtrl.Medication`, `FilterByConfiguredAppIds`, read-only |
| Labs | `/ResultsAndReadings/LabResults` | `LabResultCtrls.LabResult` |
| Imaging | `/ResultsAndReadings/DiagnosticImagingReports` | `LabResultCtrls.LabResult` |

The old medication ID `8050` now fails. Other historical 7xxx IDs are not usable fallbacks. The editable Other Medicines control is not interchangeable with read-only pharmacy records. Metadata is reused only within an API client instance; health data is not cached.

---

## Common Request Headers

All API requests include:
```
Accept: application/json, text/plain, */*
Accept-Language: en-CA
Cache-Control: no-cache
Referer: https://myhealthrecords.alberta.ca/ng/
```

Medications, labs, and imaging additionally send their discovered view mapping:
```
Control-Mapping-Id: <resolved mapping>
```

Do not add mapping headers to other endpoints without a verified contract.

---

## Date Format Quirks

The `labresult/getData` endpoint uses a non-standard date format in query parameters:

```
startDate=Mon Jan 01 1753
endDate=Fri Dec 31 9999
```

This is JavaScript's `Date.toDateString()` output format: `{Day} {Month} {DD} {YYYY}`.

The `dateRangeOptions` parameter accepts: `All`, `LastWeek`, `Last6Months`, and likely others like `LastMonth`, `LastYear`, `Last3Months`.

---

## MyChart (AHS Connect Care) API

### Base URL

```
https://myahsconnect.albertahealthservices.ca/MyChartPRD/
```

All MyChart endpoints are relative to this base URL. The portal is an ASP.NET MVC application (Epic MyChart). Most endpoints use POST with JSON or form-encoded bodies.

### Authentication

MyChart shares Alberta's SSO with MHR. During Puppeteer-based authentication:

1. User logs in via the normal MHR SSO flow (account.alberta.ca)
2. Browser navigates to `/MyChartPRD/Authentication/Saml/Login?idp=MADI&forceAuthn=False`
3. Shared SSO session auto-authenticates MyChart (no re-prompt)
4. Cookies are captured from `myahsconnect.albertahealthservices.ca`
5. Read the hidden `__RequestVerificationToken` input on the authenticated `/MyChartPRD/Home` page and keep its cookies with the token.

### CSRF Token

All MyChart API requests require:
```
__RequestVerificationToken: {csrf_token}
```

This replaces MHR's control-mapping header. `/Home/CSRFToken` can return an empty HTTP 200 and must not be treated as a token source. Desktop authentication reads the Home-page DOM; HTTP refresh parses the named hidden input. Login redirects, missing tokens, and conflicting tokens fail explicitly. Refresh after context changes or an auth rejection, and persist the updated desktop token/cookies together in the existing v2 format.

### Common Request Headers

```
Accept: application/json
Content-Type: application/json (or application/x-www-form-urlencoded for form endpoints)
__RequestVerificationToken: {csrf_token}
Cookie: {mychart_session_cookies}
```

### MyChart Endpoints

#### Visits

##### POST Visits/VisitsList/LoadUpcoming

Returns upcoming appointments.

**Body (form-encoded):** `timeZone=America/Edmonton`

##### POST Visits/VisitsList/LoadPast

Returns past visit history.

**Body (form-encoded):** `serializedIndex=`

##### POST api/visits/past-details/GetVisitDetailsPast

Returns details for a specific past visit.

**Body (JSON):**
```json
{
  "csn": "12345",
  "eorgID": ""
}
```

#### Health Summary

##### POST api/health-summary/FetchHealthSummary

Returns health summary overview.

**Body (JSON):** `{}`

#### Allergies

##### POST api/allergies/LoadAllergies

Returns allergy list.

**Body (JSON):**
```json
{
  "isHealthSummary": true
}
```

#### Health Issues

##### POST api/HealthIssues/LoadHealthIssuesData

Returns active diagnoses and conditions.

**Body (JSON):**
```json
{
  "isHealthSummary": true
}
```

#### Care Team

##### POST Clinical/CareTeam/Load

Returns care team providers.

**Body (form-encoded):** `{}`

#### Messages / Conversations

##### POST api/conversations/GetConversationList

Returns conversations list. Filter by `tag` for inbox/sent.

**Body (JSON):**
```json
{
  "tag": "inbox",
  "localLoadParams": null,
  "externalLoadParams": null,
  "searchQuery": null,
  "PageNonce": ""
}
```

##### POST api/conversations/GetConversationDetails

Returns details for a specific conversation.

**Body (JSON):**
```json
{
  "id": "conversation_id",
  "messageId": null,
  "organizationId": null,
  "PageNonce": ""
}
```

#### Medical History

##### POST api/histories/LoadHistoriesViewModel

Returns medical and family history.

**Body (JSON):** `{}`

#### Documents

##### POST api/documents/viewer/LoadOtherDocuments

Returns clinical documents list.

**Body (JSON):**
```json
{
  "isInitialLoad": true
}
```

##### POST api/documents/viewer/GetDocumentDetails

Returns details for a specific document.

**Body (JSON):**
```json
{
  "dcsId": "document_id",
  "fileExtension": "pdf",
  "organizationId": null,
  "useOldMobileLink": false
}
```

#### Upcoming Orders

##### POST api/upcoming-orders/GetUpcomingOrders

Returns upcoming tests and procedures.

**Body (JSON):**
```json
{
  "selectedOrderID": null,
  "PageNonce": ""
}
```

#### Test Results

##### POST api/test-results/GetList

Returns test results list.

**Body (JSON):**
```json
{
  "groupType": null,
  "searchString": "",
  "maxResults": null,
  "isCurAdmFilterEnabled": false
}
```

##### POST api/test-results/GetDetails

Returns details for a specific test result.

**Body (JSON):**
```json
{
  "orderKey": "order_key",
  "organizationID": null,
  "PageNonce": ""
}
```

#### Family Tree / Pedigree

##### POST api/pedigree/LoadPedigree

Returns family tree and pedigree.

**Body (JSON):**
```json
{
  "welcomeLocale": ""
}
```

#### Goals

##### POST api/goals/LoadPatientGoals

Returns patient goals.

**Body (JSON):**
```json
{
  "PageNonce": ""
}
```

##### POST api/goals/LoadCareTeamGoals

Returns care team goals.

**Body (JSON):**
```json
{
  "PageNonce": ""
}
```

#### Referrals

##### POST api/referrals/listReferrals

Returns referrals list.

**Body (JSON):** `{}`

##### POST api/referrals/getReferralDetails

Returns details for a specific referral.

**Body (JSON):**
```json
{
  "RflId": "referral_id",
  "GetFullRFL": false
}
```

#### Medications

##### POST api/medications/LoadMedicationsPage

Returns medications list.

**Body (JSON):**
```json
{
  "context": 2
}
```

#### Immunizations

##### POST api/immunizations/LoadImmunizations

Returns immunization records.

**Body (JSON):** `{}`

#### CSRF Token

##### GET /MyChartPRD/Home

The authenticated HTML contains a hidden input named `__RequestVerificationToken`. Read that specific input, not an arbitrary `value` attribute, and retain any updated cookies.

**Response:** HTML. The old `/Home/CSRFToken` route is not a reliable source. A successful keepalive response alone also does not prove the session is authenticated.

---

## Alberta Find a Provider (Public Directory)

`https://albertafindaprovider.ca` exposes a public Laravel-backed JSON API used by the find-a-doc map UI. **No authentication required.** Returns clinic and physician directory information for all of Alberta. Reverse-engineered from a HAR capture (June 2026).

### Common envelope

All listing endpoints return:

```json
{
  "items": [...],
  "limit": "25",
  "total": 1330,
  "offset": 0,
  "pages": 54,
  "page": 1
}
```

`limit` is enforced server-side at 25 max. `with[]` query params eager-load related objects (PCN, physicians, clinics, services, languages, anp records).

### Endpoints

#### `GET /search`

Geo-radius search of clinics. Used by the map's circle search.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `lat` | number | Latitude (decimal degrees) |
| `lng` | number | Longitude (decimal degrees) |
| `radius` | number | Radius in kilometres (max 70) |
| `limit` | number | Page size (max 25) |
| `anp` | 0 \| 1 | Filter to clinics accepting new patients |
| `gender-pref` | "m" \| "f" | At least one provider of this gender |
| `language-ids[]` | number[] | Filter to clinics with a provider speaking each language |
| `pcn-ids[]` | number[] | Filter to one or more PCNs |
| `service-ids[]` | number[] | Filter to clinics offering each service |
| `is-dedicated-walk-in` | 0 \| 1 | Walk-in clinics only |
| `address` | string | Display-only echo of the geocoded address |
| `with[]` | string | Eager-loads (`pcn`, `physicians`, `physicians.languages`, `physicians.specialties`, `services`, `specialties`) |

**Response items:** Clinic objects with `id`, `pcn_id`, `name`, `street_address`, `city`, `province`, `postal_code`, `lat`, `lng`, `phone_number`, `phone_extension`, `email`, `website`, `place_id` (Google), `is_access_clinic`, `is_dedicated_walk_in`, `anp_behaviour`, `limited_panel_message`, `is_clinic_always_anp`, `is_clinic_never_anp`, plus eager-loaded relations.

#### `GET /search/directory/clinics`

Paginated clinic directory. Same envelope and item shape as `/search` but no geo filtering.

**Query params:** `page`, `limit` (≤25), `with[]`, `ids[]` (numeric IDs for direct lookup — bypasses pagination).

#### `GET /search/directory/physicians`

Paginated physician/NP directory.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `is_nurse_practitioner` | 0 \| 1 | Required. Splits doctors and NPs into separate result sets. |
| `page`, `limit` | number, number | Pagination (limit ≤25). |
| `public-find` | string | Free-text search across multiple fields (name, clinic, address, PCN). NOT name-only. |
| `ids[]` | number[] | Direct lookup. |
| `with[]` | string[] | `pcn`, `clinics`, `anp`, `languages`, `specialties`. |

**Response items:** Physician objects with `id`, `pcn_id`, `first_name`, `last_name`, `friendly_name`, `clinical_name`, `gender` ("m"/"f"), `nurse_practitioner` (0/1), `anp_qualifier_within_clinic_relationship`, plus eager-loaded relations. The `anp` relation contains per-clinic accepting-new-patients records: `{clinic_id, physician_id, anp, anp_qualifier}`.

### Lookup tables (extracted from HAR)

**Service IDs:** 1=Open After Hours, 2=Wheelchair Access, 4=Walk-in Services, 5=Virtual Appointments, 6=Online Booking.

**Language IDs (sample):** 1=Cantonese, 2=English, 3=Arabic, 5=French, 13=Farsi, 19=Hindi, 21=Spanish, 27=Mandarin, 33=Punjabi, 35=Russian, 51=Urdu, 99=Other.

**PCN IDs (sample):** 11=Cold Lake, 15=Grande Prairie, 33=Edmonton North, 34=Edmonton O-day'min, 35=Edmonton Southside, 36=Edmonton West, 42=No PCN.

(Full enumerations live in `src/api/find-a-provider-client.ts`.)

### Quirks

- The `/search` endpoint sets `distance` to `null` in the response despite sorting by distance — clients must compute their own distance from each item's `lat`/`lng`.
- `public-find` is a multi-field substring LIKE — matches "Smith" against "Smith Street", clinic names, etc. Post-filter on `friendly_name`/`clinical_name`/`first_name`/`last_name` for true name matches.
- `pcn.polygon` returns a large GeoJSON FeatureCollection per PCN; strip it before passing to LLMs.
- Postal-code geocoding via Nominatim is patchy in Canada; zippopotam.us provides reliable FSA-level fallback.
