/**
 * Preserve old emailed download links without reading or forwarding tokens.
 */
module.exports = async function (context) {
  context.res = {
    status: 302,
    headers: {
      Location: '/api/download-latest',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
    body: '',
  };
};
