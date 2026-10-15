#!/usr/bin/env npx tsx

// Keep old automation fail-closed without parsing or echoing personal details.
console.error('Portal invitations are retired. Use https://www.myaihealth.ca/api/download-latest for the desktop extension.');
process.exitCode = 1;
