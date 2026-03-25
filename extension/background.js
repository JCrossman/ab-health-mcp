/**
 * Background service worker for the Alberta Health MCP Connector extension.
 *
 * Detects when MHR session cookies appear after the user logs in,
 * establishes a MyChart session in a background tab, then sends
 * all captured cookies to the MCP server.
 */

const MHR_DOMAIN = 'myhealthrecords.alberta.ca';
const MYCHART_DOMAIN = 'myahsconnect.albertahealthservices.ca';
const MYCHART_SAML_URL =
  'https://myahsconnect.albertahealthservices.ca/MyChartPRD/Authentication/Saml/Login?idp=MADI&forceAuthn=False';

let debounceTimer = null;

// Listen for cookies being set on the MHR domain
chrome.cookies.onChanged.addListener((changeInfo) => {
  if (changeInfo.removed) return;
  if (!changeInfo.cookie.domain.includes(MHR_DOMAIN)) return;

  // Debounce: wait 3 seconds after the last cookie change before capturing.
  // MHR sets multiple cookies in sequence during login.
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => captureAndSend(), 3000);
});

/**
 * Main capture flow: read stored flow context, capture cookies,
 * establish MyChart session, and POST everything to the server.
 */
async function captureAndSend() {
  debounceTimer = null;

  // Check for an active flow
  const { flowId, serverUrl } = await chrome.storage.session.get([
    'flowId',
    'serverUrl',
  ]);

  if (!flowId || !serverUrl) {
    // No pending auth flow — user is just browsing MHR normally
    return;
  }

  console.log('[AB Health MCP] Cookies detected, starting capture...');

  try {
    // Step 1: Read MHR cookies
    const mhrCookies = await chrome.cookies.getAll({ domain: MHR_DOMAIN });
    if (mhrCookies.length === 0) {
      console.log('[AB Health MCP] No MHR cookies found');
      return;
    }
    console.log(`[AB Health MCP] Captured ${mhrCookies.length} MHR cookies`);

    // Step 2: Establish MyChart session in a background tab
    let myChartCookies = [];
    try {
      myChartCookies = await establishMyChartSession();
      console.log(
        `[AB Health MCP] Captured ${myChartCookies.length} MyChart cookies`,
      );
    } catch (err) {
      console.warn('[AB Health MCP] MyChart session failed (MHR-only mode):', err);
    }

    // Step 3: Send cookies to the MCP server
    const response = await fetch(`${serverUrl}/authorize/cookies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flowId,
        mhrCookies: sanitizeCookies(mhrCookies),
        myChartCookies: sanitizeCookies(myChartCookies),
      }),
    });

    if (response.ok) {
      console.log('[AB Health MCP] Cookies sent successfully');
      // Clear the flow — auth is complete
      await chrome.storage.session.remove(['flowId', 'serverUrl']);
    } else {
      const errText = await response.text();
      console.error('[AB Health MCP] Server rejected cookies:', errText);
    }
  } catch (err) {
    console.error('[AB Health MCP] Capture failed:', err);
  }
}

/**
 * Open MyChart SAML URL in a background tab to establish the session
 * via shared SSO cookies, then read the resulting cookies.
 */
function establishMyChartSession() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('MyChart session timeout'));
    }, 15000);

    chrome.tabs.create({ url: MYCHART_SAML_URL, active: false }, (tab) => {
      if (!tab || !tab.id) {
        clearTimeout(timeout);
        reject(new Error('Failed to create tab'));
        return;
      }

      const tabId = tab.id;

      // Listen for the tab to finish loading
      function onUpdated(updatedTabId, changeInfo) {
        if (updatedTabId !== tabId) return;
        if (changeInfo.status !== 'complete') return;

        chrome.tabs.onUpdated.removeListener(onUpdated);
        clearTimeout(timeout);

        // Give cookies a moment to settle, then read them
        setTimeout(async () => {
          try {
            const cookies = await chrome.cookies.getAll({
              domain: MYCHART_DOMAIN,
            });
            // Close the background tab
            chrome.tabs.remove(tabId).catch(() => {});
            resolve(cookies);
          } catch (err) {
            chrome.tabs.remove(tabId).catch(() => {});
            reject(err);
          }
        }, 2000);
      }

      chrome.tabs.onUpdated.addListener(onUpdated);
    });
  });
}

/**
 * Strip storeId from cookies before sending (not needed by server).
 */
function sanitizeCookies(cookies) {
  return cookies.map(({ storeId, ...rest }) => rest);
}

/**
 * Manual trigger from popup — captures cookies on demand
 * for cases where auto-detection didn't fire.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'manual-capture') {
    captureAndSend()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep the message channel open for async response
  }
});
