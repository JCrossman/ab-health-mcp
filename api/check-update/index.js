/**
 * Azure Function: /api/check-update
 *
 * Called by the MCP extension's connect_account tool to check if a
 * newer version is available. If an update exists, returns a short-lived
 * (24-hour) SAS download URL so the user can update immediately.
 *
 * Query params:
 *   v — installed version (e.g., "1.1.15")
 *
 * Returns:
 *   { updateAvailable: false } — if current
 *   { updateAvailable: true, latestVersion: "1.1.16", downloadUrl: "https://..." } — if outdated
 *
 * Environment variables (shared with request-access):
 *   STORAGE_CONNECTION_STRING
 *   STORAGE_CONTAINER
 *   MCPB_BLOB_NAME
 */

const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require('@azure/storage-blob');

// Cache the latest version for 5 minutes to avoid reading blob on every call
let cachedVersion = null;
let cacheExpiry = 0;

module.exports = async function (context, req) {
  const installedVersion = (req.query.v || '').trim();

  if (!installedVersion) {
    context.res = { status: 400, body: { error: 'Missing version parameter (v)' } };
    return;
  }

  const connectionString = process.env.STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    context.res = { status: 503, body: { error: 'Service unavailable' } };
    return;
  }

  try {
    const containerName = process.env.STORAGE_CONTAINER || 'downloads';
    const blobName = process.env.MCPB_BLOB_NAME || 'ab-health-mcp.mcpb';

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Get latest version from version.json blob (or use cached)
    let latestVersion;
    if (cachedVersion && Date.now() < cacheExpiry) {
      latestVersion = cachedVersion;
    } else {
      try {
        const versionBlob = containerClient.getBlobClient('version.json');
        const downloadResponse = await versionBlob.download(0);
        const body = await streamToString(downloadResponse.readableStreamBody);
        latestVersion = JSON.parse(body).version;
        cachedVersion = latestVersion;
        cacheExpiry = Date.now() + 5 * 60 * 1000;
      } catch {
        // Fallback: read version from the hosted static site
        const res = await fetch('https://www.myaihealth.ca/version.json');
        if (res.ok) {
          const data = await res.json();
          latestVersion = data.version;
        }
      }
    }

    if (!latestVersion) {
      context.res = { status: 200, body: { updateAvailable: false } };
      return;
    }

    // Compare versions
    if (!isNewer(latestVersion, installedVersion)) {
      context.res = { status: 200, body: { updateAvailable: false, version: installedVersion } };
      return;
    }

    // Generate a 24-hour SAS download URL
    const accountName = connectionString.match(/AccountName=([^;]+)/)?.[1];
    const accountKey = connectionString.match(/AccountKey=([^;]+)/)?.[1];
    const blobClient = containerClient.getBlobClient(blobName);

    const expiresOn = new Date();
    expiresOn.setMinutes(expiresOn.getMinutes() + 30);

    const credential = new StorageSharedKeyCredential(accountName, accountKey);
    const sasToken = generateBlobSASQueryParameters({
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('r'),
      expiresOn,
    }, credential).toString();

    const downloadUrl = `${blobClient.url}?${sasToken}`;

    context.res = {
      status: 200,
      body: {
        updateAvailable: true,
        latestVersion,
        installedVersion,
        downloadUrl,
      },
    };
  } catch (err) {
    context.log.error('check-update error:', err.message);
    context.res = { status: 200, body: { updateAvailable: false } };
  }
};

function isNewer(latest, installed) {
  const l = latest.split('.').map(Number);
  const i = installed.split('.').map(Number);
  for (let j = 0; j < Math.max(l.length, i.length); j++) {
    const lv = l[j] || 0;
    const iv = i[j] || 0;
    if (lv > iv) return true;
    if (lv < iv) return false;
  }
  return false;
}

async function streamToString(readableStream) {
  const chunks = [];
  for await (const chunk of readableStream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
