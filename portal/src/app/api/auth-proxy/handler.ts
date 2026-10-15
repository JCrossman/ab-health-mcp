/**
 * SSO Reverse Proxy for Alberta Health authentication.
 *
 * Proxies requests to Alberta's SSO domains through the portal backend.
 * The user's browser renders Alberta's real login pages and executes all JS.
 * The proxy captures Set-Cookie headers from the SAML chain.
 *
 * Flow:
 *   1. Portal opens popup/iframe to /api/auth-proxy/start
 *   2. Proxy redirects to Alberta SSO login via proxied URL
 *   3. User authenticates (credentials go to Alberta, not stored here)
 *   4. Proxy captures cookies from SAML chain responses
 *   5. After auth, cookies are stored per-user in the session store
 *
 * Proxied domains:
 *   - account.alberta.ca (SSO login SPA)
 *   - sts.xiduam.ca (WS-Federation/SAML)
 *   - myhealth.alberta.ca (redirect hub)
 *   - myhealthrecords.alberta.ca (MHR)
 *   - myahsconnect.albertahealthservices.ca (MyChart)
 *   - console.myhealthrecords.alberta.ca (MHR API)
 *
 * TODO: Full reverse proxy implementation with URL rewriting.
 * For MVP development, health sessions can be established via the
 * connect_account MCP tool (stdio mode) and shared with the portal.
 */

import { NextResponse } from "next/server";

const ALLOWED_DOMAINS = [
  "account.alberta.ca",
  "sts.xiduam.ca",
  "myhealth.alberta.ca",
  "myhealthrecords.alberta.ca",
  "console.myhealthrecords.alberta.ca",
  "myahsconnect.albertahealthservices.ca",
  "ahs.queue-it.net",
];

/**
 * Start the SSO proxy flow.
 * Redirects to Alberta's login page through the proxy.
 */
export async function GET() {
  // TODO: Implement full reverse proxy
  // For now, return info about the planned flow
  return NextResponse.json({
    status: "not_implemented",
    message:
      "SSO reverse proxy is under development. For now, connect via the CLI (connect_account tool) or use the manual session import.",
    planned_flow: [
      "1. GET /api/auth-proxy/start → Redirect to proxied Alberta SSO",
      "2. User authenticates on Alberta's login page (rendered through proxy)",
      "3. SAML chain completes, proxy captures Set-Cookie headers",
      "4. Cookies stored per-user, popup closes",
      "5. Portal detects connection and enables health tools in chat",
    ],
    proxied_domains: ALLOWED_DOMAINS,
  });
}
