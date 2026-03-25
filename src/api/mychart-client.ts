/**
 * MyChart (AHS Connect) REST API client.
 *
 * Wraps confirmed MyChart endpoints at myahsconnect.albertahealthservices.ca.
 * Uses cookie-based authentication with CSRF token protection.
 * This is a pure passthrough — no health data interpretation or caching.
 */

import { CookieJar } from 'tough-cookie';
import { SessionExpiredError, ApiError, NetworkError } from '../utils/errors.js';

const MYCHART_BASE = 'https://myahsconnect.albertahealthservices.ca';

export class MyChartClient {
  constructor(
    private cookieJar: CookieJar,
    private csrfToken: string,
  ) {}

  /**
   * Check response status and throw appropriate errors.
   */
  private checkResponse(response: Response): void {
    if (response.status === 401 || response.status === 403) {
      throw new SessionExpiredError('MyChart session expired. Use connect_account to sign in again.');
    }
    if (response.status >= 500) {
      throw new ApiError(response.status, 'MyChart (AHS Connect) is currently unavailable. Try again later.');
    }
  }

  /**
   * Retry a request once after a keepalive ping when 401/403 is received.
   * Avoids false "session expired" errors from transient auth failures.
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        // Try refreshing the session before giving up
        try {
          await this.keepAlive();
        } catch {
          throw error; // Keepalive also failed — session truly expired
        }
        // Keepalive succeeded — retry the original request
        return await fn();
      }
      throw error;
    }
  }

  /**
   * Make a GET request to a MyChart endpoint (returns JSON).
   */
  private async get(path: string): Promise<unknown> {
    return this.withRetry(async () => {
      const url = `${MYCHART_BASE}/MyChartPRD/${path}`;
      const cookies = await this.cookieJar.getCookieString(url);

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'GET',
          headers: {
            'Cookie': cookies,
            'Accept': 'application/json',
            'Referer': `${MYCHART_BASE}/MyChartPRD/Home`,
            'Cache-Control': 'no-cache',
          },
        });
      } catch {
        throw new NetworkError('Could not reach MyChart (AHS Connect). Check your internet connection.');
      }

      this.checkResponse(response);
      await this.storeCookies(response, url);
      return response.json();
    });
  }

  /**
   * Store Set-Cookie response headers back into the cookie jar.
   */
  private async storeCookies(response: Response, url: string): Promise<void> {
    const setCookies = response.headers.getSetCookie?.() ?? [];
    for (const cookie of setCookies) {
      try {
        await this.cookieJar.setCookie(cookie, url);
      } catch {
        // Ignore malformed cookies
      }
    }
  }

  /**
   * Navigate to a MyChart page (GET with redirect follow).
   * Used for context switching — not a JSON API call.
   * Follows redirects and stores any Set-Cookie headers.
   */
  private async navigate(path: string): Promise<void> {
    const url = `${MYCHART_BASE}/MyChartPRD/${path}`;
    const cookies = await this.cookieJar.getCookieString(url);

    let response: Response;
    try {
      // Use manual redirect following to capture cookies at each hop
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cookie': cookies,
          'Accept': 'text/html',
          'Referer': `${MYCHART_BASE}/MyChartPRD/Home`,
        },
        redirect: 'manual',
      });
    } catch {
      throw new NetworkError('Could not reach MyChart (AHS Connect). Check your internet connection.');
    }

    await this.storeCookies(response, url);

    // Follow redirects manually to capture cookies at each step
    let redirectCount = 0;
    while ((response.status === 301 || response.status === 302 || response.status === 303 || response.status === 307) && redirectCount < 10) {
      redirectCount++;
      const location = response.headers.get('location');
      if (!location) break;

      const nextUrl = location.startsWith('http') ? location : new URL(location, url).href;

      // Validate redirect stays on trusted domains
      try {
        const redirectHost = new URL(nextUrl).hostname;
        if (!redirectHost.endsWith('.alberta.ca') && !redirectHost.endsWith('.albertahealthservices.ca')) {
          break; // Stop following redirects to untrusted domains
        }
      } catch {
        break; // Invalid URL — stop
      }

      const nextCookies = await this.cookieJar.getCookieString(nextUrl);

      try {
        response = await fetch(nextUrl, {
          method: 'GET',
          headers: {
            'Cookie': nextCookies,
            'Accept': 'text/html',
            'Referer': url,
          },
          redirect: 'manual',
        });
      } catch {
        throw new NetworkError('Could not reach MyChart (AHS Connect). Check your internet connection.');
      }

      await this.storeCookies(response, nextUrl);
    }

    this.checkResponse(response);
    await response.text();
  }

  /**
   * Refresh the CSRF token from the server.
   * Must be called after context switches.
   */
  private async refreshCsrfToken(): Promise<void> {
    const url = `${MYCHART_BASE}/MyChartPRD/Home/CSRFToken`;
    const cookies = await this.cookieJar.getCookieString(url);

    try {
      const response = await fetch(url, {
        headers: {
          'Cookie': cookies,
          'Accept': 'text/html',
          'Referer': `${MYCHART_BASE}/MyChartPRD/Home`,
        },
      });
      await this.storeCookies(response, url);
      if (response.ok) {
        const html = (await response.text()).trim();
        const match = html.match(/value="([^"]+)"/);
        if (match) {
          this.csrfToken = match[1];
        } else if (!html.includes('<')) {
          this.csrfToken = html;
        }
      }
    } catch {
      // Non-critical — existing token may still work
    }
  }

  /**
   * Make a POST request to a MyChart API endpoint.
   * All MyChart data endpoints use POST with JSON bodies.
   */
  private async post(path: string, body: Record<string, unknown> = {}): Promise<unknown> {
    return this.withRetry(async () => {
      const url = `${MYCHART_BASE}/MyChartPRD/${path}`;
      const cookies = await this.cookieJar.getCookieString(url);

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Cookie': cookies,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Origin': MYCHART_BASE,
            'Referer': `${MYCHART_BASE}/MyChartPRD/Home`,
            '__RequestVerificationToken': this.csrfToken,
            'Cache-Control': 'no-cache',
          },
          body: JSON.stringify(body),
        });
      } catch {
        throw new NetworkError('Could not reach MyChart (AHS Connect). Check your internet connection.');
      }

      this.checkResponse(response);

      if (response.status === 204) {
        return {};
      }

      return response.json();
    });
  }

  /**
   * Make a POST request with form-encoded body (used by some older MyChart endpoints).
   */
  private async postForm(path: string, params: Record<string, string> = {}): Promise<unknown> {
    return this.withRetry(async () => {
      const url = `${MYCHART_BASE}/MyChartPRD/${path}`;
      const cookies = await this.cookieJar.getCookieString(url);

      const body = new URLSearchParams(params).toString();

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Cookie': cookies,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'Origin': MYCHART_BASE,
            'Referer': `${MYCHART_BASE}/MyChartPRD/Home`,
            '__RequestVerificationToken': this.csrfToken,
            'Cache-Control': 'no-cache',
          },
          body,
        });
      } catch {
        throw new NetworkError('Could not reach MyChart (AHS Connect). Check your internet connection.');
      }

      this.checkResponse(response);

      return response.json();
    });
  }

  // --- Visits ---

  async getUpcomingVisits(): Promise<unknown> {
    return this.postForm('Visits/VisitsList/LoadUpcoming', {
      timeZone: 'America/Edmonton',
    });
  }

  async getPastVisits(): Promise<unknown> {
    return this.postForm('Visits/VisitsList/LoadPast', {
      serializedIndex: '',
    });
  }

  async getVisitDetails(csn: string): Promise<unknown> {
    return this.post('api/visits/past-details/GetVisitDetailsPast', {
      csn,
      eorgID: '',
    });
  }

  // --- Health Summary ---

  async getHealthSummary(): Promise<unknown> {
    return this.post('api/health-summary/FetchHealthSummary', {});
  }

  // --- Allergies ---

  async getAllergies(): Promise<unknown> {
    return this.post('api/allergies/LoadAllergies', {
      isHealthSummary: true,
    });
  }

  // --- Health Issues (Diagnoses/Conditions) ---

  async getHealthIssues(): Promise<unknown> {
    return this.post('api/HealthIssues/LoadHealthIssuesData', {
      isHealthSummary: true,
    });
  }

  // --- Care Team ---

  async getCareTeam(): Promise<unknown> {
    return this.postForm('Clinical/CareTeam/Load', {});
  }

  // --- Messages / Conversations ---

  async getConversationList(tag: number = 1, page: number = 1): Promise<unknown> {
    return this.post('api/conversations/GetConversationList', {
      tag,
      localLoadParams: {
        loadStartInstantISO: '',
        loadEndInstantISO: '',
        pagingInfo: page,
      },
      externalLoadParams: {},
      searchQuery: '',
      PageNonce: '',
    });
  }

  async getConversationDetails(id: string): Promise<unknown> {
    return this.post('api/conversations/GetConversationDetails', {
      id,
      messageId: '',
      organizationId: '',
      PageNonce: '',
    });
  }

  // --- Medical History ---

  async getMedicalHistory(): Promise<unknown> {
    return this.post('api/histories/LoadHistoriesViewModel', {});
  }

  // --- Documents ---

  async getDocuments(): Promise<unknown> {
    return this.post('api/documents/viewer/LoadOtherDocuments', {
      isInitialLoad: true,
    });
  }

  async getDocumentDetails(dcsId: string, fileExtension: string): Promise<unknown> {
    return this.post('api/documents/viewer/GetDocumentDetails', {
      dcsId,
      fileExtension,
      organizationId: '',
      useOldMobileLink: false,
    });
  }

  // --- Upcoming Orders (Tests/Procedures) ---

  async getUpcomingOrders(): Promise<unknown> {
    return this.post('api/upcoming-orders/GetUpcomingOrders', {
      selectedOrderID: '',
      PageNonce: '',
    });
  }

  // --- Test Results ---

  async getTestResultsList(searchString: string = ''): Promise<unknown> {
    return this.post('api/test-results/GetList', {
      groupType: 0,
      searchString,
      maxResults: 0,
      isCurAdmFilterEnabled: false,
    });
  }

  async getTestResultDetails(orderKey: string): Promise<unknown> {
    return this.post('api/test-results/GetDetails', {
      orderKey,
      organizationID: '',
      PageNonce: '',
    });
  }

  /**
   * Load the full report content for a test result (procedure reports, narratives).
   * The reportID and assumedVariables come from getTestResultDetails response.
   */
  async getReportContent(reportID: string, assumedVariables: Record<string, string> = {}): Promise<unknown> {
    return this.post('api/report-content/LoadReportContent', {
      reportID,
      assumedVariables,
      isFullReportPage: false,
      uniqueClass: '',
      nonce: '',
    });
  }

  // --- Family Tree / Pedigree ---

  async getFamilyTree(): Promise<unknown> {
    return this.post('api/pedigree/LoadPedigree', {
      welcomeLocale: '',
    });
  }

  // --- Goals ---

  async getPatientGoals(): Promise<unknown> {
    return this.post('api/goals/LoadPatientGoals', {
      PageNonce: '',
    });
  }

  async getCareTeamGoals(): Promise<unknown> {
    return this.post('api/goals/LoadCareTeamGoals', {
      PageNonce: '',
    });
  }

  // --- Referrals ---

  async getReferralsList(): Promise<unknown> {
    return this.post('api/referrals/listReferrals', {});
  }

  async getReferralDetails(rflId: string): Promise<unknown> {
    return this.post('api/referrals/getReferralDetails', {
      RflId: rflId,
      GetFullRFL: false,
    });
  }

  // --- Medications ---

  async getMedications(): Promise<unknown> {
    return this.post('api/medications/LoadMedicationsPage', {
      context: 2,
    });
  }

  // --- Immunizations ---

  async getImmunizations(): Promise<unknown> {
    return this.post('api/immunizations/LoadImmunizations', {});
  }

  // --- Historical Result Trends ---

  /**
   * Get historical trend data for specific test result components.
   * The orderID and componentIDs come from getTestResultDetails response.
   */
  async getHistoricalResults(orderID: string, componentIDs: string[]): Promise<unknown> {
    return this.post('api/past-results/GetMultipleHistoricalResultComponents', {
      orderID,
      selectedComponentIDs: componentIDs,
      isInitialLoad: true,
      startTime: '',
      endTime: '',
      organizationID: '',
      PageNonce: '',
    });
  }

  // --- Appointment Requests ---

  /**
   * Get pending appointment requests.
   */
  async getAppointmentRequests(): Promise<unknown> {
    return this.postForm('Visits/VisitsList/LoadAppointmentRequest', {});
  }

  // --- Session Keepalive ---

  /**
   * Ping MyChart to keep the session alive.
   * Uses the lightweight KeepAlive endpoint (no data returned).
   * Throws SessionExpiredError if the session is no longer valid.
   */
  async keepAlive(): Promise<void> {
    const url = `${MYCHART_BASE}/MyChartPRD/Home/KeepAlive?cnt=1&noCache=${Math.random()}`;
    const cookies = await this.cookieJar.getCookieString(url);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cookie': cookies,
          'Accept': 'text/html',
          'Referer': `${MYCHART_BASE}/MyChartPRD/Home`,
        },
      });
    } catch {
      throw new NetworkError('Could not reach MyChart (AHS Connect). Check your internet connection.');
    }

    if (response.status === 401 || response.status === 403) {
      throw new SessionExpiredError('MyChart session expired. Use connect_account to sign in again.');
    }
  }

  // --- Document Download ---

  /**
   * Download a document/scan binary (image, PDF, etc.) by its download URL path.
   * The downloadUrl comes from the GetDocumentDetails response.
   */
  async downloadDocumentBinary(downloadUrlPath: string): Promise<{ buffer: Buffer; contentType: string }> {
    let url: string;
    if (downloadUrlPath.startsWith('http')) {
      // Only allow HTTPS URLs on the MyChart domain to prevent SSRF
      const parsed = new URL(downloadUrlPath);
      const allowed = new URL(MYCHART_BASE);
      if (parsed.hostname !== allowed.hostname || parsed.protocol !== 'https:') {
        throw new ApiError(400, 'Download URL must be HTTPS on the MyChart domain.');
      }
      url = downloadUrlPath;
    } else {
      url = `${MYCHART_BASE}/MyChartPRD${downloadUrlPath}`;
    }
    const cookies = await this.cookieJar.getCookieString(url);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cookie': cookies,
          'Accept': '*/*',
          'Referer': `${MYCHART_BASE}/MyChartPRD/Home`,
        },
        redirect: 'manual',
      });
    } catch {
      throw new NetworkError('Could not reach MyChart (AHS Connect). Check your internet connection.');
    }

    // Follow redirects manually, validating each hop stays on the MyChart domain
    let redirectCount = 0;
    while ((response.status === 301 || response.status === 302 || response.status === 303 || response.status === 307) && redirectCount < 5) {
      redirectCount++;
      const location = response.headers.get('location');
      if (!location) break;
      const nextUrl = location.startsWith('http') ? location : new URL(location, url).href;
      const nextParsed = new URL(nextUrl);
      if (nextParsed.hostname !== new URL(MYCHART_BASE).hostname || nextParsed.protocol !== 'https:') {
        throw new ApiError(400, 'Download redirect left the MyChart domain.');
      }
      const nextCookies = await this.cookieJar.getCookieString(nextUrl);
      try {
        response = await fetch(nextUrl, {
          method: 'GET',
          headers: { 'Cookie': nextCookies, 'Accept': '*/*' },
          redirect: 'manual',
        });
      } catch {
        throw new NetworkError('Could not reach MyChart (AHS Connect). Check your internet connection.');
      }
    }

    if (response.status === 401 || response.status === 403) {
      throw new SessionExpiredError('MyChart session expired. Use connect_account to sign in again.');
    }
    if (!response.ok) {
      throw new ApiError(response.status, `Document download failed (HTTP ${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') ?? 'application/octet-stream';

    return {
      buffer: Buffer.from(arrayBuffer),
      contentType,
    };
  }

  // --- Proxy / Friends & Family Access ---

  /**
   * Get the list of accessible patient contexts (self + proxy patients).
   * Returns proxy subjects with IDs for context switching.
   */
  async getProxyAccessList(): Promise<unknown> {
    return this.get(`ProxySwitch?noCache=${Math.random()}`);
  }

  /**
   * Switch to viewing a proxy patient's records.
   * After switching, all subsequent API calls return the proxy patient's data.
   */
  async switchToProxy(proxyId: string): Promise<void> {
    await this.navigate(`inside.asp?mode=proxyswitch&action=switchcontext&src=0&eid=${encodeURIComponent(proxyId)}`);
    await this.refreshCsrfToken();
  }

  /**
   * Switch back to viewing your own records.
   */
  async switchToSelf(): Promise<void> {
    await this.navigate('inside.asp?mode=self');
    await this.refreshCsrfToken();
  }
}
