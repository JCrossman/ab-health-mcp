# Alberta Health Authentication Flow Spec

## Overview

My Health Records and AHS MyChart (Connect Care) both use Alberta's centralized SSO system at `account.alberta.ca`. Authentication is browser-based — a real Chrome instance navigates through the SSO flow, and session cookies are captured for API calls.

This is fundamentally different from token-based auth. There are no Bearer tokens, no API keys, and no OAuth flows. The entire auth state lives in HTTP cookies. MyChart additionally requires a CSRF token (`__RequestVerificationToken`) for API calls.

## Actual Auth Flow (Discovered via HAR Analysis)

The flow navigates directly to the Alberta SSO login page, then establishes MyChart and MHR sessions separately via explicit navigation:

```
1. Navigate to account.alberta.ca/ui/sign-in/signin (SSO login page)
   → SPA auto-loads and makes API calls:
     - GET /api/metadata
     - GET /api/is-login-token-valid (401 if not logged in)
     - GET /api/application-session-process?p=...
     - GET /api/partially-signed-in-account
   → If persistent SSO cookies exist: auto-authenticates (0 rate-limited calls)
   → Otherwise: user enters MyAlberta credentials
     - POST /api/account-checks (username check) ← RATE-LIMITED
     - POST /api/signin (credential verification) ← RATE-LIMITED
   → WAF generates qd4v5cb38r-* fingerprint headers (anti-bot protection)
   → Post-login: GET /api/is-login-token-valid, /api/account-details

2. Navigate to MyChart SAML login (auto-authenticates via shared SSO):
   → GET myahsconnect.albertahealthservices.ca/MyChartPRD/Authentication/Saml/Login?idp=MADI&forceAuthn=False
   → SAML chain uses SSO cookies to auto-authenticate
   → Wait for URL to contain /MyChartPRD/Home or /MyChartPRD/default.asp
   → MyChart session established

3. Navigate to MHR to establish its session:
   → GET myhealthrecords.alberta.ca
   → SSO cookies auto-authenticate
   → Wait for URL to contain /ng/
   → MHR session established

4. Cookie extraction + CSRF token:
   → Extract MyChart cookies from browser cookie store
   → Extract MHR cookies from browser cookie store
   → Fetch CSRF token via HTTP: GET /MyChartPRD/Home/CSRFToken
     (returns HTML <input> with token value)
```

## Implementation: Puppeteer Browser Automation

**Direct API auth was abandoned** because:
- The SSO is a multi-party SAML/WS-Federation chain
- `account.alberta.ca` is a JavaScript SPA with anti-bot WAF protection
- WAF generates `qd4v5cb38r-*` challenge tokens via in-browser JavaScript
- Rate limiting on `account-checks` and `signin` endpoints

**Current implementation** (`src/api/auth-client.ts`):

### Stealth Measures

The SSO WAF fingerprints the browser to detect automation. Puppeteer includes several stealth measures to appear as a normal Chrome instance:

```typescript
// Launch args
args: [
  '--disable-blink-features=AutomationControlled',  // Remove automation flag
  '--disable-infobars',                              // Remove "controlled by automation" bar
]

// Page-level overrides (via evaluateOnNewDocument)
navigator.webdriver = false;         // Primary bot detection signal
navigator.plugins = [Chrome PDF, ...]; // Real browser plugins
navigator.languages = ['en-US', 'en']; // Real language preferences
window.chrome = { runtime: {} };     // Chrome extension API stub
```

### Entry Point

Navigates directly to `account.alberta.ca/ui/sign-in/signin` — the SSO login page. After SSO login completes, the browser navigates explicitly to MyChart (SAML auto-auth) and then MHR (SSO auto-auth) to establish each session separately. This avoids the portal redirect chain (which can trigger queue-it waiting rooms) and gives precise control over session establishment.

### Session Detection

After SSO login, sessions are established via explicit navigation:
- MyChart: navigate to SAML login URL, wait for `/MyChartPRD/Home` or `/MyChartPRD/default.asp`
- MHR: navigate to `myhealthrecords.alberta.ca`, wait for `/ng/`
- Response monitoring tracks which sessions have been successfully established

### Persistent Browser Profile

Uses `~/.mhr-records/browser-profile` to preserve SSO cookies across auth attempts:
- First login: user enters credentials (2 rate-limited calls)
- Subsequent logins: SSO cookies auto-authenticate (0 rate-limited calls)
- If stale cookies cause issues (429/loops), profile is cleared and retried

## Auth Architecture (Historical Context)

Two approaches were evaluated. The original spec recommended starting with Option B.

### Option A: Browser-Based Auth ✅ (IMPLEMENTED)

Same pattern as the DATS project. User authenticates in a real browser, session cookies are captured and stored encrypted.

```
┌──────────────┐    ┌───────────────────┐    ┌─────────────────────┐
│ Claude/Copilot│    │ Auth Proxy (Azure) │    │ account.alberta.ca  │
└──────┬───────┘    └────────┬──────────┘    └──────────┬──────────┘
       │                     │                          │
       │ 1. connect_account  │                          │
       │────────────────────>│                          │
       │                     │                          │
       │ 2. Return auth URL  │                          │
       │<────────────────────│                          │
       │                     │                          │
       │    User opens URL in browser                   │
       │    ┌──────────────────────────────────────────>│
       │    │                                           │
       │    │         3. User enters MyAlberta creds    │
       │    │                                           │
       │    │ 4. POST /signin (form-encoded)            │
       │    │──────────────────────────────────────────>│
       │    │                                           │
       │    │ 5. Session cookies returned               │
       │    │<──────────────────────────────────────────│
       │    │                                           │
       │    │ 6. Navigate to myhealthrecords            │
       │    │    (establishes cross-domain session)      │
       │    │                                           │
       │    │ 7. Auth proxy captures cookies            │
       │    │    Encrypts + stores                      │
       │    │                                           │
       │ 8. check_connection                            │
       │────────────────────>│                          │
       │                     │                          │
       │ 9. Session ready    │                          │
       │<────────────────────│                          │
```

**Pros:** Handles all SSO complexity (CSRF tokens, cookie domains, redirects). Battle-tested in DATS project.
**Cons:** Requires Azure hosting for auth proxy. Browser must be opened.

### Option B: Direct API Auth ❌ (ABANDONED)

The MCP server directly calls the `account.alberta.ca` API endpoints, acting as a headless client.

```
┌──────────────┐    ┌───────────────────┐    ┌─────────────────────┐
│ Claude/Copilot│    │ MCP Server        │    │ account.alberta.ca  │
└──────┬───────┘    └────────┬──────────┘    └──────────┬──────────┘
       │                     │                          │
       │ 1. connect_account  │                          │
       │   (username, pass)  │                          │
       │────────────────────>│                          │
       │                     │                          │
       │                     │ 2. GET /metadata         │
       │                     │─────────────────────────>│
       │                     │                          │
       │                     │ 3. POST /account-checks  │
       │                     │─────────────────────────>│
       │                     │                          │
       │                     │ 4. POST /signin          │
       │                     │─────────────────────────>│
       │                     │                          │
       │                     │ 5. Cookies set           │
       │                     │<─────────────────────────│
       │                     │                          │
       │                     │ 6. GET /application-session-process
       │                     │─────────────────────────>│
       │                     │                          │
       │                     │ 7. Navigate to MHR domain│
       │                     │ (follow redirects w/     │
       │                     │  cookie jar)             │
       │                     │                          │
       │ 8. Connected        │                          │
       │<────────────────────│                          │
```

**Pros:** No Azure infrastructure needed. Simpler deployment.
**Cons:** Credentials pass through Claude conversation history. More fragile if SSO flow changes. May break on CAPTCHA, MFA, or JS challenges.

### Recommendation

**Option A (Puppeteer browser automation) is the implemented approach.** Option B was attempted first but failed due to the multi-party SAML chain and JS-rendered login page at `account.alberta.ca`. The SSO also rate-limits API endpoints (`account-checks`, `signin`) aggressively.

For remote/mobile mode (Phase 3), a browser auth proxy will be needed since Puppeteer requires a local display.

---

## Direct Auth Implementation (Option B — Historical Reference)

> **Note:** This section documents the originally planned direct API approach. It was abandoned because the SSO login page at `account.alberta.ca/ui/sign-in/sign-in-from-ped` is a JavaScript SPA that cannot be driven via simple HTTP requests. The actual implementation uses Puppeteer (see above).

### Step-by-Step Flow

```typescript
class AuthClient {
  private cookieJar: CookieJar;
  private baseUrl = 'https://account.alberta.ca/app/account/services/api';

  async authenticate(username: string, password: string): Promise<AuthResult> {
    // 1. Get metadata and initial cookies
    await this.fetch(`${this.baseUrl}/metadata`);

    // 2. Check if already logged in
    const tokenCheck = await this.fetch(`${this.baseUrl}/is-login-token-valid`);
    // Expect 401 if not logged in

    // 3. Get the application session process URL
    // IMPORTANT: The `p` parameter must be obtained by first loading
    // the MHR login page. It's an encoded redirect token.
    // You need to figure out how to obtain this programmatically.
    // Option: Fetch the MHR login page, extract the redirect URL,
    // parse the `p` parameter from the account.alberta.ca URL.

    // 4. Check account exists
    await this.fetch(`${this.baseUrl}/account-checks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `UserName=${encodeURIComponent(username)}`
    });

    // 5. Sign in
    await this.fetch(`${this.baseUrl}/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `Username=${encodeURIComponent(username)}&Password=${encodeURIComponent(password)}`
    });

    // 6. Verify login
    const valid = await this.fetch(`${this.baseUrl}/is-login-token-valid`);
    // Should return 200 now

    // 7. Complete application session
    await this.fetch(`${this.baseUrl}/application-session-process?p=${this.redirectToken}`);

    // 8. Now make a request to myhealthrecords.alberta.ca
    // The cookies from account.alberta.ca should establish the session
    const user = await this.fetch('https://myhealthrecords.alberta.ca/api/phr/v1/user');

    return { success: true, cookies: this.cookieJar.serialize() };
  }
}
```

### The `p` Parameter Problem

The biggest challenge in direct auth is obtaining the `p` parameter for `application-session-process`. This token identifies which application the user is signing into.

**Approach 1: Capture from initial redirect**
1. Fetch `https://myhealthrecords.alberta.ca/` (or the login page)
2. Follow redirects until you hit `account.alberta.ca`
3. Extract the `p` parameter from the URL

**Approach 2: Hardcode and refresh**
The `p` parameter may be stable for a given application. Compare the two values captured in the HAR:
- `CsS3WS0pfsHF7LZnuA1EDEDjSfYljU0Kwj...` (session 1)
- `zqrNd0hgQjogldUDe0NBgsp_joIljU0Kwj...` (session 2)

These are different, so the parameter changes per session. Approach 1 is required.

**Approach 3: Reverse engineer the encoding**
The `p` parameter appears to be base64url-encoded. It may contain the redirect URL and a nonce. Decoding and constructing it programmatically would be the most robust approach but requires more analysis.

---

## Cookie Management

### Cookie Jar

Use a cookie jar library (e.g., `tough-cookie`) to:
1. Store cookies from `account.alberta.ca`
2. Send cookies with requests to `myhealthrecords.alberta.ca`
3. Handle domain-scoping (`.alberta.ca` cookies apply to subdomains)

### Cookie Storage

**Local mode (stdio) — IMPLEMENTED:**
- MHR cookies extracted from Puppeteer browser via `page.cookies()`
- MyChart cookies extracted after SAML auto-authentication
- CSRF token fetched from `/MyChartPRD/Home/CSRFToken`
- Loaded into separate `tough-cookie` CookieJars (MHR jar + MyChart jar)
- Serialized to JSON in v2 format: `{version: 2, mhr: {...}, myChart: {...}, myChartCsrfToken: "..."}`
- Encrypted with AES-256-GCM, stored at `~/.mhr-records/session.enc`
- v2 format is backward compatible with v1 (MHR-only sessions)
- Key from `MHR_ENCRYPTION_KEY` env var or auto-generated at `~/.mhr-records/key`

**Browser profile:**
- Puppeteer uses persistent profile at `~/.mhr-records/browser-profile`
- Maintains SSO state between sessions, reducing rate limiting

**Remote mode (HTTP) — implemented, not yet productized:**
- Session cookies encrypted into the OAuth access token (AES-256-GCM)
- Zero server-side storage — the token IS the session
- Token includes MHR jar + MyChart jar + CSRF token + expiry
- Server decrypts on each request, runs MCP tools, discards
- See `src/server/token-crypto.ts` and `src/server/http-index.ts`

### Session Keepalive

The session times out after ~10 minutes of inactivity. The MCP server should:
1. Call `GET /api/phr/v1/session?SessionMode=Patient&IsKeypressed=true` before each API call
2. If session is expired, prompt the user to re-authenticate

---

## Security Requirements

1. **Credentials never stored.** Only session cookies are persisted.
2. **No PII in logs.** Never log usernames, health data, or cookie values.
3. **Encryption at rest.** Session cookies encrypted with AES-256-GCM.
4. **Canadian data residency.** All remote storage in Azure Canada Central.
5. **Credential handling (Option B):**
   - Accept credentials via MCP tool parameters
   - Use immediately for authentication
   - Discard after session is established
   - Note: In local/stdio mode, credentials briefly appear in Claude's context. This is acceptable for personal desktop use but not for remote/shared deployments.

---

## MFA / Additional Security

The HAR capture did not show MFA (multi-factor authentication). However, `account.alberta.ca` may enforce MFA for some accounts. If encountered:

1. The `partially-signed-in-account` endpoint (returned 400 in HAR) may be relevant
2. The MFA flow would likely require a second factor (SMS, authenticator app)
3. This would make Option B (direct API auth) infeasible
4. Fall back to Option A (browser-based auth) which handles MFA natively

---

## Testing Auth

```bash
# Quick test of direct auth flow
curl -c cookies.txt -b cookies.txt \
  'https://account.alberta.ca/app/account/services/api/metadata'

curl -c cookies.txt -b cookies.txt \
  -X POST \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'UserName=your_username' \
  'https://account.alberta.ca/app/account/services/api/account-checks'

curl -c cookies.txt -b cookies.txt \
  -X POST \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'Username=your_username&Password=your_password' \
  'https://account.alberta.ca/app/account/services/api/signin'

# Then test health records API
curl -c cookies.txt -b cookies.txt \
  'https://myhealthrecords.alberta.ca/api/phr/v1/user'
```
