/**
 * Content script for the Alberta Health MCP Connector extension.
 *
 * Runs on the MCP server's /authorize page. Reads the flow_id
 * from the DOM and stores it so the background worker knows
 * where to send captured cookies.
 */

(function () {
  // Signal to the page that the extension is installed
  document.documentElement.dataset.abHealthExt = 'true';

  // Read the flow ID from the DOM
  const flowEl = document.querySelector('[data-flow-id]');
  if (!flowEl) return;

  const flowId = flowEl.dataset.flowId;
  if (!flowId) return;

  // Store the flow context for the background worker
  chrome.storage.session.set({
    flowId,
    serverUrl: window.location.origin,
  });

  console.log('[AB Health MCP] Flow registered:', flowId.substring(0, 8) + '...');
})();
