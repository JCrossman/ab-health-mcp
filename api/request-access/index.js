/**
 * Retired endpoint. Do not inspect the request or restore invitation handling:
 * downloading the desktop extension no longer requires personal details.
 */
module.exports = async function (context) {
  context.res = {
    status: 410,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
    body: {
      error: 'Access requests and portal invitations are no longer available. Download the desktop extension directly.',
      downloadUrl: 'https://www.myaihealth.ca/api/download-latest',
    },
  };
};
