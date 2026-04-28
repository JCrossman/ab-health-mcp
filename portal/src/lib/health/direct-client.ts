/**
 * Direct REST client for Alberta health APIs.
 *
 * Uses stored session cookies from the portal's health-session-store
 * to make API calls directly to MHR and MyChart, bypassing the MCP server.
 * This is necessary because the portal's headless auth session cookies
 * are not shared with the MCP server process.
 */

import { CookieJar } from "tough-cookie";
import { getHealthSession } from "@/lib/auth/health-session-store";
import type { HealthSessionData } from "@/lib/auth/health-auth";

const MHR_BASE = "https://myhealthrecords.alberta.ca";
const MYCHART_BASE = "https://myahsconnect.albertahealthservices.ca";

interface HealthClient {
  mhrJar: CookieJar;
  myChartJar?: CookieJar;
  myChartCsrfToken?: string;
  mhrConnected: boolean;
  myChartConnected: boolean;
}

async function createClient(
  sessionData: HealthSessionData
): Promise<HealthClient> {
  const mhrJar = await CookieJar.deserialize(
    JSON.parse(sessionData.mhrCookies)
  );
  const myChartJar = sessionData.myChartCookies
    ? await CookieJar.deserialize(JSON.parse(sessionData.myChartCookies))
    : undefined;

  return {
    mhrJar,
    myChartJar,
    myChartCsrfToken: sessionData.myChartCsrfToken,
    mhrConnected: sessionData.mhrConnected,
    myChartConnected: sessionData.myChartConnected,
  };
}

// MHR API helpers

async function mhrFetch(
  jar: CookieJar,
  path: string,
  controlMappingId: string,
  queryParams?: URLSearchParams
): Promise<Response> {
  const url = queryParams
    ? `${MHR_BASE}${path}?${queryParams}`
    : `${MHR_BASE}${path}`;
  const cookies = await jar.getCookieString(url);

  const headers: Record<string, string> = {
    Cookie: cookies,
    Accept: "application/json",
    "Accept-Language": "en-CA",
    Referer: `${MHR_BASE}/ng/`,
    "Cache-Control": "no-cache",
  };
  if (controlMappingId) {
    headers["Control-Mapping-Id"] = controlMappingId;
  }

  return fetch(url, { method: "GET", headers });
}

/** Send a keepalive to warm up / refresh the MHR session. */
async function mhrKeepalive(jar: CookieJar): Promise<boolean> {
  try {
    const ts = Math.floor(Date.now() / 1000);
    const resp = await mhrFetch(jar, "/api/phr/v1/session", "", new URLSearchParams({
      SessionMode: "Patient",
      IsKeypressed: "true",
      KeyPressedUnixTimeStamp: String(ts),
    }));
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * MHR GET with automatic retry.
 * On 401/403, sends a session keepalive then retries once — handles
 * transient "cold session" failures without falsely reporting expiry.
 */
async function mhrGet(
  jar: CookieJar,
  path: string,
  controlMappingId: string,
  queryParams?: URLSearchParams
): Promise<unknown> {
  let response = await mhrFetch(jar, path, controlMappingId, queryParams);

  if (response.status === 401 || response.status === 403) {
    // Try warming up the session and retry once
    const alive = await mhrKeepalive(jar);
    if (alive) {
      response = await mhrFetch(jar, path, controlMappingId, queryParams);
    }
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error("SESSION_EXPIRED");
  }
  if (!response.ok) {
    throw new Error(`MHR API error: ${response.status}`);
  }
  return response.json();
}

async function myChartPost(
  jar: CookieJar,
  csrfToken: string,
  path: string,
  body: Record<string, unknown> = {}
): Promise<unknown> {
  const url = `${MYCHART_BASE}/MyChartPRD/${path}`;
  const cookies = await jar.getCookieString(url);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Cookie: cookies,
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: MYCHART_BASE,
      Referer: `${MYCHART_BASE}/MyChartPRD/Home`,
      __RequestVerificationToken: csrfToken,
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify(body),
  });

  // Save Set-Cookie headers back to jar
  const setCookies = response.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookies) {
    try {
      await jar.setCookie(cookie, url);
    } catch {
      /* ignore */
    }
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error("SESSION_EXPIRED");
  }
  if (response.status === 204) return {};
  if (!response.ok) {
    throw new Error(`MyChart API error: ${response.status}`);
  }
  return response.json();
}

/** Form-encoded POST for MyChart endpoints that expect URL-encoded bodies (visits, care team). */
async function myChartPostForm(
  jar: CookieJar,
  csrfToken: string,
  path: string,
  params: Record<string, string> = {}
): Promise<unknown> {
  const url = `${MYCHART_BASE}/MyChartPRD/${path}`;
  const cookies = await jar.getCookieString(url);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Cookie: cookies,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Origin: MYCHART_BASE,
      Referer: `${MYCHART_BASE}/MyChartPRD/Home`,
      __RequestVerificationToken: csrfToken,
      "Cache-Control": "no-cache",
    },
    body: new URLSearchParams(params).toString(),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("SESSION_EXPIRED");
  }
  if (!response.ok) {
    throw new Error(`MyChart API error: ${response.status}`);
  }
  return response.json();
}

/** GET for MyChart endpoints (proxy access list). */
async function myChartGet(
  jar: CookieJar,
  path: string
): Promise<unknown> {
  const url = `${MYCHART_BASE}/MyChartPRD/${path}`;
  const cookies = await jar.getCookieString(url);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Cookie: cookies,
      Accept: "application/json",
      Referer: `${MYCHART_BASE}/MyChartPRD/Home`,
      "Cache-Control": "no-cache",
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("SESSION_EXPIRED");
  }
  if (!response.ok) {
    throw new Error(`MyChart API error: ${response.status}`);
  }
  return response.json();
}

/** Download binary content from MyChart (documents, scans, images). */
async function myChartDownload(
  jar: CookieJar,
  downloadUrlPath: string
): Promise<{ base64: string; contentType: string }> {
  let url: string;
  if (downloadUrlPath.startsWith("http")) {
    const parsed = new URL(downloadUrlPath);
    const allowed = new URL(MYCHART_BASE);
    if (parsed.hostname !== allowed.hostname) {
      throw new Error("Download URL must be on the MyChart domain.");
    }
    url = downloadUrlPath;
  } else {
    url = `${MYCHART_BASE}/MyChartPRD${downloadUrlPath}`;
  }
  const cookies = await jar.getCookieString(url);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Cookie: cookies,
      Accept: "*/*",
      Referer: `${MYCHART_BASE}/MyChartPRD/Home`,
    },
    redirect: "follow",
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("SESSION_EXPIRED");
  }
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return { base64, contentType };
}

/** Download binary attachment from MHR (lab result PDFs, imaging reports). */
async function mhrDownload(
  jar: CookieJar,
  thingId: string,
  filename: string
): Promise<{ base64: string; contentType: string }> {
  const params = new URLSearchParams({ bName: filename });
  const url = `${MHR_BASE}/api/phr/v1/attachment/${encodeURIComponent(thingId)}/download?${params}`;
  const cookies = await jar.getCookieString(url);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Cookie: cookies,
      Accept: "*/*",
      Referer: `${MHR_BASE}/ng/`,
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("SESSION_EXPIRED");
  }
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return { base64, contentType };
}

// Date helpers

const DEFAULT_START = "Mon Jan 01 1753";
const DEFAULT_END = new Date().toDateString();

function toApiDate(dateStr?: string): string {
  if (!dateStr) return DEFAULT_START;
  return new Date(dateStr).toDateString();
}

function dateRangeParams(
  dateRange: string = "All",
  startDate?: string,
  endDate?: string
): URLSearchParams {
  return new URLSearchParams({
    startDate: startDate ? toApiDate(startDate) : DEFAULT_START,
    endDate: endDate ? toApiDate(endDate) : DEFAULT_END,
    dateRangeOptions: dateRange,
  });
}

// Tool implementations

const toolHandlers: Record<
  string,
  (client: HealthClient, args: Record<string, unknown>) => Promise<string>
> = {
  check_connection: async (client) => {
    if (!client.mhrConnected && !client.myChartConnected) {
      return JSON.stringify({ connected: false, message: "Health account is not connected." });
    }

    let mhrOk = false;
    if (client.mhrConnected) {
      mhrOk = await mhrKeepalive(client.mhrJar);
    }

    return JSON.stringify({
      connected: true,
      mhr: mhrOk,
      myChart: client.myChartConnected,
      message: mhrOk && client.myChartConnected
        ? "Both MHR and MyChart are connected."
        : mhrOk
          ? "MHR is connected. MyChart is not available."
          : client.myChartConnected
            ? "MyChart is connected. MHR session may need a moment to warm up — data calls will retry automatically."
            : "Session may be expired. Please reconnect.",
    });
  },

  get_health_overview: async (client) => {
    const data = await mhrGet(client.mhrJar, "/api/phr/v1/myhealth/vitals-manager", "");
    return JSON.stringify(data);
  },

  get_user_profile: async (client) => {
    const data = await mhrGet(client.mhrJar, "/api/phr/v1/profile", "");
    return JSON.stringify(data);
  },

  get_lab_results: async (client, args) => {
    const params = dateRangeParams(args.date_range as string, args.start_date as string, args.end_date as string);
    params.set("labConfiguration", "00000000-0000-0000-0000-000000000000");
    params.set("showOtherSection", "True");
    params.set("ignoreConfig", "True");
    const data = await mhrGet(client.mhrJar, "/api/phr/v1/labresult/getData", "", params);
    return JSON.stringify(data);
  },

  get_medications: async (client) => {
    const params = new URLSearchParams({ type: "all", status: "Medication", includeOrphanRefills: "false" });
    const data = await mhrGet(client.mhrJar, "/api/phr/v1/medication", "8050", params);
    return JSON.stringify(data);
  },

  get_immunizations: async (client, args) => {
    const params = dateRangeParams(args.date_range as string);
    const data = await mhrGet(client.mhrJar, "/api/phr/v1/myhealth/immunization-data-manager", "", params);
    return JSON.stringify(data);
  },

  get_vitals: async (client, args) => {
    const params = dateRangeParams(args.date_range as string);
    params.set("types", "Pls,Res,Tmp");
    const data = await mhrGet(client.mhrJar, "/api/phr/v1/VitalSigns", "", params);
    return JSON.stringify(data);
  },

  get_blood_pressure: async (client, args) => {
    const params = dateRangeParams(args.date_range as string);
    params.set("types", "Bp");
    const data = await mhrGet(client.mhrJar, "/api/phr/v1/VitalSigns", "", params);
    return JSON.stringify(data);
  },

  get_blood_glucose: async (client, args) => {
    const params = dateRangeParams(args.date_range as string);
    params.set("types", "Glu");
    const data = await mhrGet(client.mhrJar, "/api/phr/v1/VitalSigns", "", params);
    return JSON.stringify(data);
  },

  get_blood_oxygen: async (client, args) => {
    const params = dateRangeParams(args.date_range as string);
    params.set("types", "SpO2");
    const data = await mhrGet(client.mhrJar, "/api/phr/v1/VitalSigns", "", params);
    return JSON.stringify(data);
  },

  get_referrals: async (client, args) => {
    const params = dateRangeParams(args.date_range as string);
    const data = await mhrGet(client.mhrJar, "/api/phr/v1/referral", "", params);
    return JSON.stringify(data);
  },

  get_procedures: async (client, args) => {
    const params = dateRangeParams(args.date_range as string);
    const data = await mhrGet(client.mhrJar, "/api/phr/v1/procedure", "", params);
    return JSON.stringify(data);
  },

  get_diagnostic_imaging: async (client, args) => {
    const params = dateRangeParams(args.date_range as string);
    const data = await mhrGet(client.mhrJar, "/api/phr/v1/diagnosticImaging", "", params);
    return JSON.stringify(data);
  },

  // MyChart tools
  mc_get_health_summary: async (client) => {
    if (!client.myChartJar || !client.myChartCsrfToken) throw new Error("MyChart not connected");
    return JSON.stringify(await myChartPost(client.myChartJar, client.myChartCsrfToken, "api/health-summary/FetchHealthSummary"));
  },

  mc_get_allergies: async (client) => {
    if (!client.myChartJar || !client.myChartCsrfToken) throw new Error("MyChart not connected");
    return JSON.stringify(await myChartPost(client.myChartJar, client.myChartCsrfToken, "api/allergies/LoadAllergies", { isHealthSummary: true }));
  },

  mc_get_care_team: async (client) => {
    if (!client.myChartJar || !client.myChartCsrfToken) throw new Error("MyChart not connected");
    return JSON.stringify(await myChartPostForm(client.myChartJar, client.myChartCsrfToken, "Clinical/CareTeam/Load"));
  },

  mc_get_visits: async (client, args) => {
    if (!client.myChartJar || !client.myChartCsrfToken) throw new Error("MyChart not connected");
    const timeFrame = (args.time_frame as string) || "all";

    if (args.visit_id) {
      return JSON.stringify(await myChartPost(client.myChartJar, client.myChartCsrfToken, "api/visits/past-details/GetVisitDetailsPast", {
        csn: args.visit_id as string, eorgID: "",
      }));
    }

    if (timeFrame === "upcoming") {
      return JSON.stringify(await myChartPostForm(client.myChartJar, client.myChartCsrfToken, "Visits/VisitsList/LoadUpcoming", { timeZone: "America/Edmonton" }));
    } else if (timeFrame === "past") {
      return JSON.stringify(await myChartPostForm(client.myChartJar, client.myChartCsrfToken, "Visits/VisitsList/LoadPast", { serializedIndex: "" }));
    } else {
      const [upcoming, past] = await Promise.all([
        myChartPostForm(client.myChartJar, client.myChartCsrfToken, "Visits/VisitsList/LoadUpcoming", { timeZone: "America/Edmonton" }),
        myChartPostForm(client.myChartJar, client.myChartCsrfToken, "Visits/VisitsList/LoadPast", { serializedIndex: "" }),
      ]);
      return JSON.stringify({ upcoming, past });
    }
  },

  mc_get_medications: async (client) => {
    if (!client.myChartJar || !client.myChartCsrfToken) throw new Error("MyChart not connected");
    return JSON.stringify(await myChartPost(client.myChartJar, client.myChartCsrfToken, "api/medications/LoadMedicationsPage", { context: 2 }));
  },

  mc_get_test_results: async (client, args) => {
    if (!client.myChartJar || !client.myChartCsrfToken) throw new Error("MyChart not connected");

    // Get report content by report ID
    if (args.report_id) {
      return JSON.stringify(await myChartPost(client.myChartJar, client.myChartCsrfToken, "api/report-content/LoadReportContent", {
        reportID: args.report_id as string,
        assumedVariables: args.order_id ? { ordId: args.order_id as string } : {},
        isFullReportPage: false, uniqueClass: "", nonce: "",
      }));
    }

    // Get details for a specific test result
    if (args.order_id) {
      const details = await myChartPost(client.myChartJar, client.myChartCsrfToken, "api/test-results/GetDetails", {
        orderKey: args.order_id as string, organizationID: "", PageNonce: "",
      }) as Record<string, unknown>;

      // Auto-fetch report content if available
      let reportContent: unknown = null;
      try {
        const resultsArr = details.results as Array<Record<string, unknown>> | undefined;
        const firstResult = resultsArr?.[0];
        const reportDetails = firstResult?.reportDetails as Record<string, unknown> | undefined;
        if (reportDetails?.reportID) {
          const reportVars = reportDetails.reportVars as Record<string, string> | undefined;
          reportContent = await myChartPost(client.myChartJar, client.myChartCsrfToken, "api/report-content/LoadReportContent", {
            reportID: reportDetails.reportID as string,
            assumedVariables: reportVars ?? { ordId: args.order_id as string },
            isFullReportPage: false, uniqueClass: "", nonce: "",
          });
        }
      } catch { /* report fetch is optional */ }

      // Extract scan info so the AI knows images are available
      const resultsArr = details.results as Array<Record<string, unknown>> | undefined;
      const scans = (resultsArr?.[0]?.scans as Array<{ dcsId: string; fileExtension: string }>) ?? [];
      const result = reportContent ? { details, reportContent } : details;

      if (scans.length > 0) {
        const scanSummary = scans.map((s, i) => `  ${i + 1}. ${s.fileExtension} — dcs_id: ${s.dcsId}`).join("\n");
        return JSON.stringify(result) + `\n\n📎 This test result has ${scans.length} attached scan(s)/image(s):\n${scanSummary}\n\nTo view these, use the mc_download_document tool with the dcs_id and file_extension above.`;
      }

      return JSON.stringify(result);
    }

    // List all test results
    return JSON.stringify(await myChartPost(client.myChartJar, client.myChartCsrfToken, "api/test-results/GetList", {
      groupType: 0, searchString: (args.search_string as string) || "", maxResults: 0, isCurAdmFilterEnabled: false,
    }));
  },

  // --- New MyChart tools ---

  mc_get_health_issues: async (client) => {
    if (!client.myChartJar || !client.myChartCsrfToken) throw new Error("MyChart not connected");
    return JSON.stringify(await myChartPost(client.myChartJar, client.myChartCsrfToken, "api/HealthIssues/LoadHealthIssuesData", { isHealthSummary: true }));
  },

  mc_get_messages: async (client, args) => {
    if (!client.myChartJar || !client.myChartCsrfToken) throw new Error("MyChart not connected");
    const folder = (args.folder as string) || "inbox";
    const page = (args.page as number) || 1;

    if (args.message_id) {
      return JSON.stringify(await myChartPost(client.myChartJar, client.myChartCsrfToken, "api/conversations/GetConversationDetails", {
        id: args.message_id as string, messageId: "", organizationId: "", PageNonce: "",
      }));
    }

    const makeListBody = (tag: number) => ({
      tag, localLoadParams: { loadStartInstantISO: "", loadEndInstantISO: "", pagingInfo: page },
      externalLoadParams: {}, searchQuery: "", PageNonce: "",
    });

    if (folder === "inbox") {
      return JSON.stringify(await myChartPost(client.myChartJar, client.myChartCsrfToken, "api/conversations/GetConversationList", makeListBody(1)));
    } else if (folder === "sent") {
      return JSON.stringify(await myChartPost(client.myChartJar, client.myChartCsrfToken, "api/conversations/GetConversationList", makeListBody(7)));
    } else {
      const [inbox, sent] = await Promise.all([
        myChartPost(client.myChartJar, client.myChartCsrfToken, "api/conversations/GetConversationList", makeListBody(1)),
        myChartPost(client.myChartJar, client.myChartCsrfToken, "api/conversations/GetConversationList", makeListBody(7)),
      ]);
      return JSON.stringify({ inbox, sent });
    }
  },

  mc_get_medical_history: async (client) => {
    if (!client.myChartJar || !client.myChartCsrfToken) throw new Error("MyChart not connected");
    return JSON.stringify(await myChartPost(client.myChartJar, client.myChartCsrfToken, "api/histories/LoadHistoriesViewModel"));
  },

  mc_get_documents: async (client, args) => {
    if (!client.myChartJar || !client.myChartCsrfToken) throw new Error("MyChart not connected");

    if (args.document_id) {
      return JSON.stringify(await myChartPost(client.myChartJar, client.myChartCsrfToken, "api/documents/viewer/GetDocumentDetails", {
        dcsId: args.document_id as string,
        fileExtension: (args.file_extension as string) || "PDF",
        organizationId: "", useOldMobileLink: false,
      }));
    }

    return JSON.stringify(await myChartPost(client.myChartJar, client.myChartCsrfToken, "api/documents/viewer/LoadOtherDocuments", { isInitialLoad: true }));
  },

  mc_download_document: async (client, args) => {
    if (!client.myChartJar || !client.myChartCsrfToken) throw new Error("MyChart not connected");

    if (!args.dcs_id || !args.file_extension) {
      return JSON.stringify({ error: true, message: "Both dcs_id and file_extension are required. These come from test result scans[] or document listings." });
    }

    // Step 1: Get document metadata including download URL
    const docDetails = await myChartPost(client.myChartJar, client.myChartCsrfToken, "api/documents/viewer/GetDocumentDetails", {
      dcsId: args.dcs_id as string, fileExtension: args.file_extension as string,
      organizationId: "", useOldMobileLink: false,
    }) as Record<string, unknown>;

    const downloadUrl = docDetails.downloadUrl as string | undefined;
    const displayName = (docDetails.displayName as string) || `document.${args.file_extension}`;

    if (!downloadUrl) {
      return JSON.stringify({ metadata: docDetails, message: "Document metadata retrieved but no download URL available." });
    }

    // Step 2: Download the binary content
    const { base64, contentType } = await myChartDownload(client.myChartJar, downloadUrl);
    const sizeKB = Math.round((base64.length * 3 / 4) / 1024);

    return JSON.stringify({
      displayName, contentType, sizeKB,
      content: base64,
      message: `Downloaded ${displayName} (${sizeKB}KB, ${contentType}). Content is base64-encoded.`,
    });
  },

  mc_get_upcoming_orders: async (client) => {
    if (!client.myChartJar || !client.myChartCsrfToken) throw new Error("MyChart not connected");
    return JSON.stringify(await myChartPost(client.myChartJar, client.myChartCsrfToken, "api/upcoming-orders/GetUpcomingOrders", {
      selectedOrderID: "", PageNonce: "",
    }));
  },

  mc_get_family_tree: async (client) => {
    if (!client.myChartJar || !client.myChartCsrfToken) throw new Error("MyChart not connected");
    return JSON.stringify(await myChartPost(client.myChartJar, client.myChartCsrfToken, "api/pedigree/LoadPedigree", { welcomeLocale: "" }));
  },

  mc_get_goals: async (client) => {
    if (!client.myChartJar || !client.myChartCsrfToken) throw new Error("MyChart not connected");
    const [patient, careTeam] = await Promise.all([
      myChartPost(client.myChartJar, client.myChartCsrfToken, "api/goals/LoadPatientGoals", { PageNonce: "" }),
      myChartPost(client.myChartJar, client.myChartCsrfToken, "api/goals/LoadCareTeamGoals", { PageNonce: "" }),
    ]);
    return JSON.stringify({ patientGoals: patient, careTeamGoals: careTeam });
  },

  mc_get_referrals: async (client, args) => {
    if (!client.myChartJar || !client.myChartCsrfToken) throw new Error("MyChart not connected");
    if (args.referral_id) {
      return JSON.stringify(await myChartPost(client.myChartJar, client.myChartCsrfToken, "api/referrals/getReferralDetails", {
        RflId: args.referral_id as string, GetFullRFL: false,
      }));
    }
    return JSON.stringify(await myChartPost(client.myChartJar, client.myChartCsrfToken, "api/referrals/listReferrals"));
  },

  mc_get_immunizations: async (client) => {
    if (!client.myChartJar || !client.myChartCsrfToken) throw new Error("MyChart not connected");
    return JSON.stringify(await myChartPost(client.myChartJar, client.myChartCsrfToken, "api/immunizations/LoadImmunizations"));
  },

  mc_get_historical_results: async (client, args) => {
    if (!client.myChartJar || !client.myChartCsrfToken) throw new Error("MyChart not connected");
    if (!args.order_id || !args.component_ids) {
      return JSON.stringify({ error: true, message: "order_id and component_ids are required. Get these from mc_get_test_results details." });
    }
    return JSON.stringify(await myChartPost(client.myChartJar, client.myChartCsrfToken, "api/past-results/GetMultipleHistoricalResultComponents", {
      orderID: args.order_id as string,
      selectedComponentIDs: args.component_ids as string[],
      isInitialLoad: true, startTime: "", endTime: "", organizationID: "", PageNonce: "",
    }));
  },

  mc_get_appointment_requests: async (client) => {
    if (!client.myChartJar || !client.myChartCsrfToken) throw new Error("MyChart not connected");
    return JSON.stringify(await myChartPostForm(client.myChartJar, client.myChartCsrfToken, "Visits/VisitsList/LoadAppointmentRequest"));
  },

  mc_list_proxy_access: async (client) => {
    if (!client.myChartJar) throw new Error("MyChart not connected");
    return JSON.stringify(await myChartGet(client.myChartJar, `ProxySwitch?noCache=${Math.random()}`));
  },

  // MHR download tool
  download_attachment: async (client, args) => {
    if (!args.thing_id || !args.filename) {
      return JSON.stringify({ error: true, message: "Both thing_id and filename are required. These come from get_lab_results or get_diagnostic_imaging attachment metadata." });
    }
    const { base64, contentType } = await mhrDownload(client.mhrJar, args.thing_id as string, args.filename as string);
    const sizeKB = Math.round((base64.length * 3 / 4) / 1024);
    return JSON.stringify({
      filename: args.filename, contentType, sizeKB,
      content: base64,
      message: `Downloaded ${args.filename} (${sizeKB}KB, ${contentType}). Content is base64-encoded.`,
    });
  },
};

/**
 * Execute a health tool using the portal's stored session cookies.
 */
export async function executeHealthTool(
  userId: string,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<string> {
  const sessionData = getHealthSession(userId);

  if (!sessionData) {
    return JSON.stringify({
      error: true,
      message: "Health account not connected. Use the Connect button to sign in with your MyAlberta Digital ID.",
    });
  }

  const handler = toolHandlers[toolName];
  if (!handler) {
    return JSON.stringify({ error: true, message: `Unknown health tool: ${toolName}` });
  }

  try {
    const client = await createClient(sessionData);
    return await handler(client, args);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "SESSION_EXPIRED") {
      return JSON.stringify({ session_expired: true, error: true, message: "Health session expired. Please reconnect using the Connect button." });
    }
    return JSON.stringify({ error: true, message: `Health API error: ${message}` });
  }
}
