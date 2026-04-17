/**
 * Azure Function: /api/request-access
 *
 * Receives access request form submissions.
 *
 * channel === "mcpb" (default):
 *   Generates a 3-month download link (Azure Blob SAS URL), sends a branded
 *   welcome email to the user with their download link, notifies the admin,
 *   and logs the request to Azure Table Storage.
 *
 * channel === "portal-beta":
 *   Requires x-admin-key header (BETA_INVITE_ADMIN_KEY env var).
 *   Generates a 30-day HMAC-signed invite token and emails the user a
 *   portal-beta invitation linking to https://www.myaihealth.ca/welcome.
 *
 * Environment variables required (mcpb channel):
 *   STORAGE_CONNECTION_STRING — Azure Blob Storage (also used for Table Storage)
 *   STORAGE_CONTAINER — Container name (e.g., "downloads")
 *   MCPB_BLOB_NAME — Blob name (e.g., "ab-health-mcp.mcpb")
 *   NOTIFY_EMAIL — Admin email address for notifications
 *   ACS_CONNECTION_STRING — Azure Communication Services connection string
 *   ACS_FROM_EMAIL — Verified sender (e.g., noreply@myaihealth.ca)
 *
 * Additional environment variables (portal-beta channel):
 *   BETA_INVITE_SECRET — HMAC signing secret (random 32+ bytes, hex-encoded)
 *   BETA_INVITE_ADMIN_KEY — Value expected in x-admin-key header
 */

const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require('@azure/storage-blob');
const { EmailClient } = require('@azure/communication-email');
const crypto = require('crypto');

if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = crypto;
}

// Module-level Table Storage client (created once for connection reuse)
let tableClient = null;
function getTableClient() {
  if (!tableClient) {
    const connStr = process.env.STORAGE_CONNECTION_STRING;
    if (connStr) {
      try {
        const { TableClient } = require('@azure/data-tables');
        tableClient = TableClient.fromConnectionString(connStr, 'accessrequests', { allowInsecureConnection: false });
      } catch {
        // Table Storage logging unavailable
      }
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

  const { name, email, reason, turnstileToken, channel: rawChannel } = req.body || {};
  const channel = rawChannel === 'portal-beta' ? 'portal-beta' : 'mcpb';

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

  // portal-beta channel requires a valid admin key header
  if (channel === 'portal-beta') {
    const adminKey = process.env.BETA_INVITE_ADMIN_KEY;
    if (!adminKey || req.headers['x-admin-key'] !== adminKey) {
      context.res = { status: 401, body: { error: 'Unauthorized.' } };
      return;
    }
  }

  const acsConnectionString = process.env.ACS_CONNECTION_STRING;
  const notifyEmail = process.env.NOTIFY_EMAIL;

  if (channel === 'mcpb') {
    const connectionString = process.env.STORAGE_CONNECTION_STRING;
    if (!connectionString || !acsConnectionString || !notifyEmail) {
      context.res = { status: 503, body: { error: 'Service temporarily unavailable.' } };
      return;
    }
  } else {
    // portal-beta
    const betaSecret = process.env.BETA_INVITE_SECRET;
    if (!betaSecret || !acsConnectionString || !notifyEmail) {
      context.res = { status: 503, body: { error: 'Service temporarily unavailable.' } };
      return;
    }
  }

  try {
    if (channel === 'portal-beta') {
      await handlePortalBetaInvite(context, req, { name, email, notifyEmail });
    } else {
      await handleMcpbRequest(context, req, { name, email, reason, clientIp });
    }
  } catch (error) {
    context.log.error('Access request failed:', error.message);
    context.res = {
      status: 500,
      body: { error: 'Something went wrong. Please try again later.' },
    };
  }
};

// ---------------------------------------------------------------------------
// portal-beta invite handler
// ---------------------------------------------------------------------------
async function handlePortalBetaInvite(context, req, { name, email, notifyEmail }) {
  const betaSecret = process.env.BETA_INVITE_SECRET;
  const acsConnectionString = process.env.ACS_CONNECTION_STRING;
  const fromEmail = process.env.ACS_FROM_EMAIL || 'noreply@myaihealth.ca';

  const token = generateInviteToken(email.trim().toLowerCase(), betaSecret);
  const inviteUrl = `https://www.myaihealth.ca/welcome?invite=${token}`;
  const emailClient = new EmailClient(acsConnectionString);

  // Send invite to user
  try {
    const userMessage = {
      senderAddress: fromEmail,
      replyTo: [{ address: 'support@myaihealth.ca' }],
      recipients: { to: [{ address: email.trim() }] },
      content: {
        subject: "You're invited to try MyAI Health 🎉",
        html: buildPortalBetaEmailHtml({ name: name.trim(), inviteUrl }),
      },
    };
    const userPoller = await emailClient.beginSend(userMessage);
    const userPollResult = userPoller.getOperationState();
    if (userPollResult.error) {
      context.log.error('Portal-beta user email error:', userPollResult.error.message);
    }
  } catch (err) {
    context.log.error('Portal-beta user email failed:', err.message);
  }

  // Admin notification (fire-and-forget)
  try {
    const adminMessage = {
      senderAddress: fromEmail,
      recipients: { to: [{ address: notifyEmail }] },
      content: {
        subject: `MyAI Health Portal Beta Invite: ${sanitizeForHeader(name)}`,
        html: buildPortalBetaAdminEmailHtml({ name: name.trim(), email: email.trim(), inviteUrl }),
      },
    };
    const adminPoller = await emailClient.beginSend(adminMessage);
    const adminPollResult = adminPoller.getOperationState();
    if (adminPollResult.error) {
      context.log.error('Portal-beta admin email error:', adminPollResult.error.message);
    }
  } catch (err) {
    context.log.error('Portal-beta admin email failed:', err.message);
  }

  context.res = {
    status: 200,
    body: { success: true, message: 'Beta invite sent.' },
  };
}

// ---------------------------------------------------------------------------
// mcpb download request handler (original logic)
// ---------------------------------------------------------------------------
async function handleMcpbRequest(context, req, { name, email, reason, clientIp }) {
  const connectionString = process.env.STORAGE_CONNECTION_STRING;
  const acsConnectionString = process.env.ACS_CONNECTION_STRING;
  const notifyEmail = process.env.NOTIFY_EMAIL;
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
  const expiresOn = new Date();
  expiresOn.setMonth(expiresOn.getMonth() + 3);

  if (signingKey) {
    const tokenData = `${email.trim().toLowerCase()}:${Date.now()}`;
    const token = crypto.createHmac('sha256', signingKey).update(tokenData).digest('hex');
    downloadUrl = `https://www.myaihealth.ca/api/download?token=${token}`;
  } else {
    const credential = new StorageSharedKeyCredential(accountName, accountKey);
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
    recipients: { to: [{ address: notifyEmail }] },
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
      recipients: { to: [{ address: email.trim() }] },
      content: {
        subject: 'Your MyAI Health add-on is ready 🎉',
        html: buildUserEmailHtml({ name: name.trim(), downloadUrl, expiresOn }),
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
}

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
  <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#374151;">You're one of the first Albertans to take control of your health data with AI. Your add-on is ready to download.</p>

  <!-- Download Button -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:8px 0 28px;">
    <a href="${downloadUrl}" style="display:inline-block;background-color:#0277b5;color:#ffffff;font-size:18px;font-weight:600;text-decoration:none;padding:16px 40px;border-radius:8px;letter-spacing:0.2px;">⬇ Download Add-on</a>
  </td></tr>
  </table>

  <p style="margin:0 0 20px;font-size:12px;color:#9ca3af;text-align:center;">Link expires ${expiryDate}</p>
</td></tr>

<!-- Security Warning Heads-Up -->
<tr><td style="padding:0 32px 24px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff7ed;border:2px solid #fed7aa;border-radius:10px;overflow:hidden;">
  <tr><td style="padding:20px 24px;">

    <!-- Heading with shield icon -->
    <table role="presentation" cellpadding="0" cellspacing="0">
    <tr>
      <td style="vertical-align:middle;padding-right:10px;">
        <span style="font-size:24px;">🛡️</span>
      </td>
      <td style="vertical-align:middle;">
        <h2 style="margin:0;font-size:17px;font-weight:700;color:#9a3412;">You&rsquo;ll see a warning &mdash; that&rsquo;s a good thing</h2>
      </td>
    </tr>
    </table>

    <p style="margin:14px 0 16px;font-size:15px;line-height:1.6;color:#374151;">When you install the add-on, Claude Desktop will show this message:</p>

    <!-- Simulated warning message -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#451a03;border-radius:8px;">
    <tr><td style="padding:14px 18px;">
      <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:middle;padding-right:10px;">
          <span style="font-size:18px;">⚠️</span>
        </td>
        <td style="vertical-align:middle;">
          <span style="color:#fbbf24;font-size:14px;font-weight:500;">Installing will grant access to everything on your computer.</span>
        </td>
      </tr>
      </table>
    </td></tr>
    </table>

    <p style="margin:16px 0 0;font-size:15px;line-height:1.7;color:#374151;"><strong style="color:#9a3412;">This is normal.</strong> Claude Desktop shows this warning for <em>every</em> add-on that runs on your computer. Here&rsquo;s what it really means:</p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;font-size:15px;line-height:1.7;color:#374151;">
      <tr><td style="vertical-align:top;padding-right:8px;color:#16a34a;font-weight:bold;">✓</td><td>Your health data goes <strong>directly between your computer and Alberta&rsquo;s health portals</strong></td></tr>
      <tr><td style="vertical-align:top;padding-right:8px;color:#16a34a;font-weight:bold;">✓</td><td>Your data <strong>never passes through our servers</strong> &mdash; there is no middleman</td></tr>
      <tr><td style="vertical-align:top;padding-right:8px;color:#16a34a;font-weight:bold;">✓</td><td>The add-on <strong>does not read your files</strong>, browse your folders, or touch anything else on your computer</td></tr>
      <tr><td style="vertical-align:top;padding-right:8px;color:#16a34a;font-weight:bold;">✓</td><td>We built it this way <strong>on purpose to protect your privacy</strong></td></tr>
    </table>

    <p style="margin:14px 0 0;font-size:14px;line-height:1.5;color:#6b7280;">The code is open source &mdash; you can see exactly what it does at <a href="https://github.com/JCrossman/ab-health-mcp" style="color:#0277b5;text-decoration:none;font-weight:500;">github.com/JCrossman/ab-health-mcp</a></p>

  </td></tr>
  </table>
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
  <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.85);">&copy; 2026 MyAI Health &middot; <a href="https://www.myaihealth.ca/privacy" style="color:rgba(255,255,255,0.9);text-decoration:underline;">Privacy</a> &middot; <a href="https://www.myaihealth.ca/terms" style="color:rgba(255,255,255,0.9);text-decoration:underline;">Terms</a></p>
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

// ---------------------------------------------------------------------------
// Invite token helpers (portal-beta)
// ---------------------------------------------------------------------------
function generateInviteToken(email, secret) {
  const payload = Buffer.from(JSON.stringify({
    email,
    issuedAt: Date.now(),
    channel: 'portal-beta',
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

// ---------------------------------------------------------------------------
// Portal-beta invite email (user)
// ---------------------------------------------------------------------------
function buildPortalBetaEmailHtml({ name, inviteUrl }) {
  const escapedName = escapeHtml(name);
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
  <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1a1a2e;">You&rsquo;re invited to try MyAI Health 🎉</h1>
</td></tr>

<!-- Body -->
<tr><td style="padding:0 32px 24px;">
  <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151;">Hi ${escapedName},</p>
  <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151;">You&rsquo;ve been invited to try our new MyAI Health portal &mdash; a simple chat experience where you can ask questions about your Alberta health records in plain language.</p>
  <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#374151;">No downloads needed. Just sign in and start chatting with your health data.</p>

  <!-- CTA Button -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:8px 0 12px;">
    <a href="${inviteUrl}" style="display:inline-block;background-color:#0277b5;color:#ffffff;font-size:18px;font-weight:600;text-decoration:none;padding:16px 40px;border-radius:8px;letter-spacing:0.2px;">Get Started &rarr;</a>
  </td></tr>
  </table>

  <p style="margin:12px 0 0;font-size:13px;color:#9ca3af;text-align:center;">This link is good for 30 days.</p>
</td></tr>

<!-- What to expect -->
<tr><td style="padding:0 32px 24px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;padding:20px 24px;">
  <tr><td>
    <h2 style="margin:0 0 14px;font-size:16px;font-weight:700;color:#1a1a2e;">What you can do:</h2>
    <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:15px;line-height:1.8;color:#374151;">
      <tr><td style="vertical-align:top;padding-right:8px;">•</td><td>Ask about your lab results, medications, and immunizations</td></tr>
      <tr><td style="vertical-align:top;padding-right:8px;">•</td><td>Get plain-English answers &mdash; no medical jargon</td></tr>
      <tr><td style="vertical-align:top;padding-right:8px;">•</td><td>Your data is never stored &mdash; it goes straight from Alberta&rsquo;s portal to you</td></tr>
    </table>
  </td></tr>
  </table>
</td></tr>

<!-- Disclaimer -->
<tr><td style="padding:0 32px 24px;">
  <p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;border-left:3px solid #e5e7eb;padding-left:12px;"><strong>Note:</strong> This tool gives you health information, not medical advice. Always talk to your doctor about your results.</p>
</td></tr>

<!-- Unsubscribe -->
<tr><td style="padding:0 32px 28px;">
  <p style="margin:0;font-size:13px;line-height:1.6;color:#9ca3af;">Didn&rsquo;t ask for this? No problem &mdash; just ignore it and nothing will happen. Or email us at <a href="mailto:support@myaihealth.ca" style="color:#0277b5;text-decoration:none;">support@myaihealth.ca</a> and we&rsquo;ll remove you right away.</p>
</td></tr>

<!-- Footer -->
<tr><td style="background-color:#0277b5;padding:20px 32px;text-align:center;">
  <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.85);">&copy; 2026 MyAI Health &middot; <a href="https://www.myaihealth.ca/privacy" style="color:rgba(255,255,255,0.9);text-decoration:underline;">Privacy</a> &middot; <a href="https://www.myaihealth.ca/terms" style="color:rgba(255,255,255,0.9);text-decoration:underline;">Terms</a></p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Portal-beta admin notification email
// ---------------------------------------------------------------------------
function buildPortalBetaAdminEmailHtml({ name, email, inviteUrl }) {
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;">
  <h2 style="margin:0 0 16px;color:#1a1a2e;">Portal Beta Invite Sent</h2>
  <table style="margin:16px 0;font-size:14px;line-height:1.7;color:#374151;border-collapse:collapse;" cellpadding="0" cellspacing="0">
    <tr><td style="padding:4px 12px 4px 0;font-weight:600;white-space:nowrap;vertical-align:top;">Name:</td><td>${escapeHtml(name)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;font-weight:600;white-space:nowrap;vertical-align:top;">Email:</td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
    <tr><td style="padding:4px 12px 4px 0;font-weight:600;white-space:nowrap;vertical-align:top;">Time:</td><td>${new Date().toISOString()}</td></tr>
  </table>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">
  <h3 style="margin:0 0 8px;font-size:14px;color:#1a1a2e;">Invite Link (expires 30 days)</h3>
  <p style="background:#f0f9ff;padding:12px;border-radius:8px;word-break:break-all;font-size:13px;">
    <a href="${inviteUrl}">${inviteUrl}</a>
  </p>
</div>`;
}
