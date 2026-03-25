/**
 * Azure Function: /api/request-access
 *
 * Receives access request form submissions, generates a 7-day
 * download link (Azure Blob SAS URL), and emails the admin with
 * the requester's info + a ready-to-share download link.
 *
 * Environment variables required:
 *   STORAGE_CONNECTION_STRING — Azure Blob Storage connection string
 *   STORAGE_CONTAINER — Container name (e.g., "downloads")
 *   MCPB_BLOB_NAME — Blob name (e.g., "ab-health-mcp.mcpb")
 *   NOTIFY_EMAIL — Admin email address for notifications
 *   ACS_CONNECTION_STRING — Azure Communication Services connection string
 *   ACS_FROM_EMAIL — Verified sender (e.g., noreply@myaihealth.ca)
 */

const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require('@azure/storage-blob');
const { EmailClient } = require('@azure/communication-email');
const crypto = require('crypto');

if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = crypto;
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
    const credential = new StorageSharedKeyCredential(accountName, accountKey);

    const expiresOn = new Date();
    expiresOn.setDate(expiresOn.getDate() + 7);

    const sasToken = generateBlobSASQueryParameters({
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('r'),
      expiresOn,
    }, credential).toString();

    const downloadUrl = `${blobClient.url}?${sasToken}`;

    const fromEmail = process.env.ACS_FROM_EMAIL || 'noreply@myaihealth.ca';
    const emailClient = new EmailClient(acsConnectionString);
    const safeName = sanitizeForHeader(name);
    const safeReason = reason ? reason.trim() : '';

    const message = {
      senderAddress: fromEmail,
      recipients: {
        to: [{ address: notifyEmail }],
      },
      content: {
        subject: `MyAI Health Access Request: ${safeName}`,
        html: `
          <h2>New Access Request</h2>
          <p><strong>Name:</strong> ${escapeHtml(name.trim())}</p>
          <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email.trim())}">${escapeHtml(email.trim())}</a></p>
          ${safeReason ? `<p><strong>Reason:</strong> ${escapeHtml(safeReason)}</p>` : ''}
          <hr>
          <h3>Download Link (expires in 7 days)</h3>
          <p>Copy and paste this link in your reply to ${escapeHtml(name.trim())}:</p>
          <p style="background: #f0f9ff; padding: 12px; border-radius: 8px; word-break: break-all;">
            <a href="${downloadUrl}">${downloadUrl}</a>
          </p>
          <p style="color: #666; font-size: 12px;">This link will expire on ${expiresOn.toLocaleDateString('en-CA')}.</p>
        `,
      },
    };

    const poller = await emailClient.beginSend(message);
    await poller.pollUntilDone();

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
