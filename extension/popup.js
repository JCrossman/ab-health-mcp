/**
 * Popup script — manual cookie capture fallback.
 *
 * When the user clicks "Capture & Send Cookies", this sends a message
 * to the background worker to trigger the capture flow.
 */

const btn = document.getElementById('captureBtn');
const status = document.getElementById('status');

btn.addEventListener('click', async () => {
  btn.disabled = true;
  status.className = 'info';
  status.style.display = 'block';
  status.textContent = 'Capturing cookies...';

  // Check if there's an active flow
  const { flowId } = await chrome.storage.session.get('flowId');
  if (!flowId) {
    status.className = 'error';
    status.textContent =
      'No pending connection. Start from Claude Desktop first.';
    btn.disabled = false;
    return;
  }

  // Trigger manual capture via background worker
  chrome.runtime.sendMessage({ type: 'manual-capture' }, (response) => {
    if (chrome.runtime.lastError) {
      status.className = 'error';
      status.textContent = 'Extension error. Try refreshing.';
      btn.disabled = false;
      return;
    }

    if (response && response.success) {
      status.className = 'success';
      status.textContent = '✓ Cookies sent! Return to Claude.';
    } else {
      status.className = 'error';
      status.textContent = response?.error || 'Capture failed. Try again.';
      btn.disabled = false;
    }
  });
});
