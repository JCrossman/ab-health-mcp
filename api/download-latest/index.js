/**
 * Azure Function: /api/download-latest
 *
 * Short, copy-paste-safe URL that 302-redirects to a freshly generated
 * 30-minute SAS URL for the current .mcpb bundle. Exists because long
 * SAS URLs returned from /api/check-update get truncated by chat UIs
 * (Claude Desktop, etc.) when the % or & characters confuse link parsers.
 *
 * Usage: the /api/check-update endpoint returns this short URL as
 * downloadUrl for in-app update notifications. Existing installs benefit
 * on their next update check — no client rebuild required.
 *
 * Environment variables:
 *   STORAGE_CONNECTION_STRING
 *   STORAGE_CONTAINER        (default: "downloads")
 *   MCPB_BLOB_NAME           (default: "ab-health-mcp.mcpb")
 */

const {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol,
  StorageSharedKeyCredential,
} = require('@azure/storage-blob');

module.exports = async function (context) {
  const connectionString = process.env.STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    context.res = {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
      body: redirectPage(
        'Service unavailable',
        'Download service is temporarily unavailable. Please try again later.',
      ),
    };
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
    expiresOn.setMinutes(expiresOn.getMinutes() + 30);

    const sasToken = generateBlobSASQueryParameters({
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('r'),
      protocol: SASProtocol.Https,
      expiresOn,
    }, credential).toString();

    const downloadUrl = `${blobClient.url}?${sasToken}`;

    context.res = {
      status: 302,
      headers: {
        Location: downloadUrl,
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      },
      body: '',
    };
  } catch {
    context.log.error('download-latest redirect failed');
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
      body: redirectPage(
        'Download failed',
        'Something went wrong. Please try again in a moment.',
      ),
    };
  }
};

function redirectPage(title, message) {
  return `<!DOCTYPE html>
<html lang="en-CA">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — MyAI Health</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;color:#1e293b;}
.card{text-align:center;padding:3rem;max-width:480px;}.card h1{font-size:1.5rem;margin-bottom:1rem;}.card p{color:#64748b;line-height:1.6;}a{color:#0277b5;}</style>
</head><body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}
