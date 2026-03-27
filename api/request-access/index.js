/**
 * Azure Function: /api/request-access
 *
 * Receives access request form submissions, generates a 3-month
 * download link (Azure Blob SAS URL), sends a branded welcome email
 * to the user with their download link, notifies the admin, and logs
 * the request to Azure Table Storage.
 *
 * Environment variables required:
 *   STORAGE_CONNECTION_STRING — Azure Blob Storage (also used for Table Storage)
 *   STORAGE_CONTAINER — Container name (e.g., "downloads")
 *   MCPB_BLOB_NAME — Blob name (e.g., "ab-health-mcp.mcpb")
 *   NOTIFY_EMAIL — Admin email address for notifications
 *   ACS_CONNECTION_STRING — Azure Communication Services connection string
 *   ACS_FROM_EMAIL — Verified sender (e.g., noreply@myaihealth.ca)
 */

const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require('@azure/storage-blob');
const { EmailClient } = require('@azure/communication-email');
const crypto = require('crypto');

let TableClient;
try {
  TableClient = require('@azure/data-tables').TableClient;
} catch {
  // Table Storage logging unavailable — function continues without it
}

if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = crypto;
}

// Module-level Table Storage client (created once for connection reuse)
let tableClient = null;
function getTableClient() {
  if (!tableClient && TableClient) {
    const connStr = process.env.STORAGE_CONNECTION_STRING;
    if (connStr) {
      tableClient = TableClient.fromConnectionString(connStr, 'accessrequests', { allowInsecureConnection: false });
    }
  }
  return tableClient;
}

// In-memory rate limiting (per function instance; resets on cold start)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) rateLimitMap.delete(ip);
  }
}, 5 * 60 * 1000);

const MAX_NAME_LENGTH = 200;
const MAX_EMAIL_LENGTH = 254;
const MAX_REASON_LENGTH = 2000;
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

module.exports = async function (context, req) {
  // Kill switch — set DISABLE_ACCESS_REQUESTS=true to reject all submissions
  if (process.env.DISABLE_ACCESS_REQUESTS === 'true') {
    context.res = { status: 503, body: { error: 'Access requests are temporarily closed. Please check back later.' } };
    return;
  }

  const clientIp = (req.headers['x-forwarded-for'] || req.headers['x-client-ip'] || 'unknown').split(',')[0].trim();
  if (isRateLimited(clientIp)) {
    context.res = { status: 429, body: { error: 'Too many requests. Please try again later.' } };
    return;
  }

  const { name, email, reason, turnstileToken } = req.body || {};

  // Verify Cloudflare Turnstile token
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    if (!turnstileToken) {
      context.res = { status: 400, body: { error: 'Verification required. Please complete the CAPTCHA.' } };
      return;
    }
    try {
      const formData = new URLSearchParams();
      formData.append('secret', turnstileSecret);
      formData.append('response', turnstileToken);
      formData.append('remoteip', clientIp);
      const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: formData,
      });
      const verifyResult = await verifyRes.json();
      if (!verifyResult.success) {
        context.res = { status: 403, body: { error: 'Verification failed. Please try again.' } };
        return;
      }
    } catch (err) {
      context.log.error('Turnstile verification error:', err.message);
      context.res = { status: 500, body: { error: 'Verification service unavailable. Please try again later.' } };
      return;
    }
  }

  if (typeof name !== 'string' || typeof email !== 'string' ||
      (reason !== undefined && reason !== null && typeof reason !== 'string')) {
    context.res = { status: 400, body: { error: 'Invalid input.' } };
    return;
  }

  if (!name.trim() || !email.trim()) {
    context.res = { status: 400, body: { error: 'Name and email are required.' } };
    return;
  }

  if (name.length > MAX_NAME_LENGTH || email.length > MAX_EMAIL_LENGTH ||
      (reason && reason.length > MAX_REASON_LENGTH)) {
    context.res = { status: 400, body: { error: 'Input exceeds maximum allowed length.' } };
    return;
  }

  if (!EMAIL_RE.test(email)) {
    context.res = { status: 400, body: { error: 'Invalid email address.' } };
    return;
  }

  const connectionString = process.env.STORAGE_CONNECTION_STRING;
  const acsConnectionString = process.env.ACS_CONNECTION_STRING;
  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (!connectionString || !acsConnectionString || !notifyEmail) {
    context.res = { status: 503, body: { error: 'Service temporarily unavailable.' } };
    return;
  }

  try {
    const containerName = process.env.STORAGE_CONTAINER || 'downloads';
    const blobName = process.env.MCPB_BLOB_NAME || 'ab-health-mcp.mcpb';

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);

    const accountName = connectionString.match(/AccountName=([^;]+)/)?.[1];
    const accountKey = connectionString.match(/AccountKey=([^;]+)/)?.[1];

    // Generate a clean download URL via our /api/download redirect
    const signingKey = process.env.DOWNLOAD_SIGNING_KEY;
    let downloadUrl;

    if (signingKey) {
      // Create an HMAC token from the email + timestamp
      const tokenData = `${email.trim().toLowerCase()}:${Date.now()}`;
      const token = crypto.createHmac('sha256', signingKey).update(tokenData).digest('hex');
      downloadUrl = `https://www.myaihealth.ca/api/download?token=${token}`;
    } else {
      // Fallback: direct SAS URL if signing key not configured
      const credential = new StorageSharedKeyCredential(accountName, accountKey);
      const expiresOn = new Date();
      expiresOn.setMonth(expiresOn.getMonth() + 3);
      const sasToken = generateBlobSASQueryParameters({
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse('r'),
        expiresOn,
      }, credential).toString();
      downloadUrl = `${blobClient.url}?${sasToken}`;
    }

    const fromEmail = process.env.ACS_FROM_EMAIL || 'noreply@myaihealth.ca';
    const emailClient = new EmailClient(acsConnectionString);
    const safeName = sanitizeForHeader(name);
    const safeReason = reason ? reason.trim() : '';
    const now = new Date();
    const userAgent = req.headers['user-agent'] || 'unknown';

    // 1. Send admin notification email
    const adminMessage = {
      senderAddress: fromEmail,
      recipients: {
        to: [{ address: notifyEmail }],
      },
      content: {
        subject: `MyAI Health Access Request: ${safeName}`,
        html: buildAdminEmailHtml({
          name: name.trim(),
          email: email.trim(),
          reason: safeReason,
          downloadUrl,
          expiresOn,
          clientIp,
          timestamp: now,
        }),
      },
    };

    const adminPoller = await emailClient.beginSend(adminMessage);
    const adminPollResult = adminPoller.getOperationState();
    if (adminPollResult.error) {
      throw new Error(`Admin email send failed: ${adminPollResult.error.message}`);
    }

    // 2. Send branded welcome email to the user (non-blocking)
    try {
      const userMessage = {
        senderAddress: fromEmail,
        replyTo: [{ address: notifyEmail }],
        recipients: {
          to: [{ address: email.trim() }],
        },
        content: {
          subject: 'Your MyAI Health extension is ready 🎉',
          html: buildUserEmailHtml({
            name: name.trim(),
            downloadUrl,
            expiresOn,
          }),
        },
      };
      const userPoller = await emailClient.beginSend(userMessage);
      const userPollResult = userPoller.getOperationState();
      if (userPollResult.error) {
        context.log.error('User email send error:', userPollResult.error.message);
      }
    } catch (userEmailErr) {
      context.log.error('User email send failed:', userEmailErr.message);
    }

    // 3. Log to Azure Table Storage (fire-and-forget)
    logAccessRequest(context, {
      name: name.trim(),
      email: email.trim(),
      reason: safeReason,
      ip: clientIp,
      userAgent,
      downloadUrl,
      timestamp: now,
    });

    context.res = {
      status: 200,
      body: { success: true, message: 'Access request submitted successfully.' },
    };
  } catch (error) {
    context.log.error('Access request failed:', error.message);
    context.res = {
      status: 500,
      body: { error: 'Something went wrong. Please try again later.' },
    };
  }
};

// ---------------------------------------------------------------------------
// Table Storage logging (fire-and-forget)
// ---------------------------------------------------------------------------
function logAccessRequest(context, data) {
  try {
    const client = getTableClient();
    if (!client) return;

    const suffix = crypto.randomBytes(4).toString('hex');
    const entity = {
      partitionKey: 'requests',
      rowKey: `${data.timestamp.toISOString()}-${suffix}`,
      name: data.name,
      email: data.email,
      reason: data.reason,
      timestamp: data.timestamp.toISOString(),
      ip: data.ip,
      userAgent: data.userAgent,
      downloadUrl: data.downloadUrl,
    };

    // Fire-and-forget: don't await, but catch errors
    client.createEntity(entity).catch((err) => {
      context.log.error('Table Storage log failed:', err.message);
    });
  } catch (err) {
    context.log.error('Table Storage log setup failed:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Branded user welcome email
// ---------------------------------------------------------------------------
function buildUserEmailHtml({ name, downloadUrl, expiresOn }) {
  const escapedName = escapeHtml(name);
  const expiryDate = expiresOn.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

<!-- Header -->
<tr><td style="background-color:#0277b5;padding:28px 32px;text-align:center;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
  <tr>
    <td style="vertical-align:middle;padding-right:10px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#ffffff" style="display:block;">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
    </td>
    <td style="vertical-align:middle;">
      <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">MyAI Health</span>
    </td>
  </tr>
  </table>
</td></tr>

<!-- Hero -->
<tr><td style="padding:36px 32px 20px;text-align:center;">
  <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1a1a2e;">Welcome to your AI-powered health journey 🎉</h1>
</td></tr>

<!-- Body -->
<tr><td style="padding:0 32px 24px;">
  <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151;">Hi ${escapedName},</p>
  <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#374151;">You're one of the first Albertans to take control of your health data with AI. Your extension is ready to download.</p>

  <!-- Download Button -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:8px 0 28px;">
    <a href="${downloadUrl}" style="display:inline-block;background-color:#0277b5;color:#ffffff;font-size:18px;font-weight:600;text-decoration:none;padding:16px 40px;border-radius:8px;letter-spacing:0.2px;">⬇ Download Extension</a>
  </td></tr>
  </table>

  <p style="margin:0 0 20px;font-size:12px;color:#9ca3af;text-align:center;">Link expires ${expiryDate}</p>
</td></tr>

<!-- Getting Started -->
<tr><td style="padding:0 32px 24px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;padding:20px 24px;">
  <tr><td>
    <h2 style="margin:0 0 14px;font-size:16px;font-weight:700;color:#1a1a2e;">Getting started:</h2>
    <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:15px;line-height:1.7;color:#374151;">
      <tr><td style="vertical-align:top;padding-right:10px;font-weight:600;color:#0277b5;">1.</td><td>Double-click the downloaded file &mdash; Claude Desktop installs it automatically</td></tr>
      <tr><td style="vertical-align:top;padding-right:10px;font-weight:600;color:#0277b5;">2.</td><td>Say <em>&ldquo;Connect to health data in demo mode&rdquo;</em> to try it with sample data</td></tr>
      <tr><td style="vertical-align:top;padding-right:10px;font-weight:600;color:#0277b5;">3.</td><td>When you&rsquo;re ready, say <em>&ldquo;Connect to My Health Records&rdquo;</em> to use your real data</td></tr>
    </table>
  </td></tr>
  </table>
</td></tr>

<!-- What You Can Do -->
<tr><td style="padding:0 32px 24px;">
  <h2 style="margin:0 0 14px;font-size:16px;font-weight:700;color:#1a1a2e;">What you can do:</h2>
  <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:15px;line-height:1.8;color:#374151;">
    <tr><td style="vertical-align:top;padding-right:8px;">•</td><td>Ask about lab results, medications, immunizations, and vitals in plain language</td></tr>
    <tr><td style="vertical-align:top;padding-right:8px;">•</td><td>Track trends across years of health data</td></tr>
    <tr><td style="vertical-align:top;padding-right:8px;">•</td><td>Generate PDF health reports to take to your doctor</td></tr>
    <tr><td style="vertical-align:top;padding-right:8px;">•</td><td>Voice-interact &mdash; speak your questions instead of typing</td></tr>
  </table>
</td></tr>

<!-- Disclaimer -->
<tr><td style="padding:0 32px 28px;">
  <p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;border-left:3px solid #e5e7eb;padding-left:12px;"><strong>Important:</strong> This tool provides health information, not medical advice. Always discuss findings with your healthcare provider.</p>
</td></tr>

<!-- CTA -->
<tr><td style="padding:0 32px 32px;">
  <p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">Questions? Reply to this email or visit <a href="https://www.myaihealth.ca" style="color:#0277b5;text-decoration:none;font-weight:500;">myaihealth.ca</a></p>
</td></tr>

<!-- Footer -->
<tr><td style="background-color:#0277b5;padding:20px 32px;text-align:center;">
  <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.85);">&copy; 2025 MyAI Health &middot; <a href="https://www.myaihealth.ca/privacy" style="color:rgba(255,255,255,0.9);text-decoration:underline;">Privacy</a> &middot; <a href="https://www.myaihealth.ca/terms" style="color:rgba(255,255,255,0.9);text-decoration:underline;">Terms</a></p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Admin notification email
// ---------------------------------------------------------------------------
function buildAdminEmailHtml({ name, email, reason, downloadUrl, expiresOn, clientIp, timestamp }) {
  const ts = timestamp.toISOString();
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;">
  <h2 style="margin:0 0 16px;color:#1a1a2e;">New Access Request</h2>
  <p style="margin:0 0 6px;padding:8px 12px;background:#e0f2fe;border-radius:6px;font-size:14px;color:#0369a1;">
    ✅ The user has <strong>already received</strong> their download link automatically.
  </p>
  <table style="margin:16px 0;font-size:14px;line-height:1.7;color:#374151;border-collapse:collapse;" cellpadding="0" cellspacing="0">
    <tr><td style="padding:4px 12px 4px 0;font-weight:600;white-space:nowrap;vertical-align:top;">Name:</td><td>${escapeHtml(name)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;font-weight:600;white-space:nowrap;vertical-align:top;">Email:</td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
    ${reason ? `<tr><td style="padding:4px 12px 4px 0;font-weight:600;white-space:nowrap;vertical-align:top;">Reason:</td><td>${escapeHtml(reason)}</td></tr>` : ''}
    <tr><td style="padding:4px 12px 4px 0;font-weight:600;white-space:nowrap;vertical-align:top;">IP:</td><td style="font-family:monospace;font-size:13px;">${escapeHtml(clientIp)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;font-weight:600;white-space:nowrap;vertical-align:top;">Time:</td><td>${escapeHtml(ts)}</td></tr>
  </table>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">
  <h3 style="margin:0 0 8px;font-size:14px;color:#1a1a2e;">Download Link (expires ${expiresOn.toLocaleDateString('en-CA')})</h3>
  <p style="background:#f0f9ff;padding:12px;border-radius:8px;word-break:break-all;font-size:13px;">
    <a href="${downloadUrl}">${downloadUrl}</a>
  </p>
</div>`;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function sanitizeForHeader(str) {
  return str.replace(/[\r\n\t]/g, ' ').substring(0, 200);
}
