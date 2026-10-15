/**
 * Azure Function: /api/check-update
 *
 * Called by the MCP extension's connect_account tool to check if a
 * newer version is available. If an update exists, returns the public
 * download redirector so the user can update immediately.
 *
 * Query params:
 *   v — installed version (e.g., "1.1.15")
 *
 * Returns:
 *   { updateAvailable: false } — if current
 *   { updateAvailable: true, latestVersion: "1.1.16", downloadUrl: "https://..." } — if outdated
 *
 * Environment variables (shared with download-latest):
 *   STORAGE_CONNECTION_STRING
 *   STORAGE_CONTAINER
 */

const { BlobServiceClient } = require('@azure/storage-blob');

// Cache the latest version for 5 minutes to avoid reading blob on every call
let cachedVersion = null;
let cacheExpiry = 0;

module.exports = async function (context, req) {
  const installedVersion = typeof req.query?.v === 'string' ? req.query.v.trim() : '';

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

    // Return a short, copy-paste-safe redirector URL instead of the raw SAS.
    // Long SAS URLs get truncated by chat UIs (Claude Desktop) at % or & chars,
    // producing PublicAccessNotPermitted errors. /api/download-latest 302-redirects
    // to a fresh 30-minute SAS on each click.
    const downloadUrl = 'https://www.myaihealth.ca/api/download-latest';

    context.res = {
      status: 200,
      body: {
        updateAvailable: true,
        latestVersion,
        installedVersion,
        downloadUrl,
      },
    };
  } catch {
    context.log.error('check-update failed');
    context.res = { status: 200, body: { updateAvailable: false } };
  }
};

// Mirrors src/utils/version.ts: strict semver, release > prerelease of the same core.
function isNewer(latest, installed) {
  const pattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
  const l = pattern.exec(String(latest));
  const i = pattern.exec(String(installed));
  if (!l || !i || l[0] !== latest || i[0] !== installed) return false;
  for (let j = 1; j <= 3; j++) {
    const left = BigInt(l[j]);
    const right = BigInt(i[j]);
    if (left !== right) return left > right;
  }
  const lp = l[4];
  const ip = i[4];
  if (lp === ip) return false;
  if (lp === undefined) return true;
  if (ip === undefined) return false;
  const a = lp.split('.');
  const b = ip.split('.');
  for (let j = 0; j < Math.max(a.length, b.length); j++) {
    if (a[j] === undefined) return false;
    if (b[j] === undefined) return true;
    const an = /^\d+$/.test(a[j]) ? BigInt(a[j]) : undefined;
    const bn = /^\d+$/.test(b[j]) ? BigInt(b[j]) : undefined;
    if (an !== undefined && bn !== undefined) {
      if (an !== bn) return an > bn;
    } else if (an !== undefined) {
      return false;
    } else if (bn !== undefined) {
      return true;
    } else if (a[j] !== b[j]) {
      return a[j] > b[j];
    }
  }
  return false;
}

module.exports.isNewer = isNewer;

async function streamToString(readableStream) {
  const chunks = [];
  for await (const chunk of readableStream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
