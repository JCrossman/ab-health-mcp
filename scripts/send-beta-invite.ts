#!/usr/bin/env npx tsx
/**
 * scripts/send-beta-invite.ts
 *
 * Issues a portal-beta invite by POSTing to the /api/request-access endpoint.
 *
 * Usage:
 *   npx tsx scripts/send-beta-invite.ts --email user@example.com --name "Jane Doe"
 *   npx tsx scripts/send-beta-invite.ts --email user@example.com --name "Jane Doe" --dry-run
 *
 * Environment variables required:
 *   BETA_INVITE_ADMIN_KEY  — must match the value configured on the server
 *   REQUEST_ACCESS_URL     — full URL to the endpoint (default: https://www.myaihealth.ca/api/request-access)
 */

import { parseArgs } from 'node:util';
import { createHmac } from 'node:crypto';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
  strict: true,
});

const email = values['email'];
const name = values['name'];
const dryRun = values['dry-run'];

if (!email || !name) {
  console.error('Usage: npx tsx scripts/send-beta-invite.ts --email <email> --name "<name>" [--dry-run]');
  process.exit(1);
}

const adminKey = process.env.BETA_INVITE_ADMIN_KEY;
if (!adminKey) {
  console.error('Error: BETA_INVITE_ADMIN_KEY env var is not set.');
  process.exit(1);
}

const endpointUrl = process.env.REQUEST_ACCESS_URL ?? 'https://www.myaihealth.ca/api/request-access';

const payload = { name, email, channel: 'portal-beta' };

if (dryRun) {
  console.log('\n--- DRY RUN (no email will be sent) ---');
  console.log('Endpoint:', endpointUrl);
  console.log('Payload:', JSON.stringify(payload, null, 2));
  console.log('Headers: { x-admin-key: <redacted>, content-type: application/json }');

  // Show what the invite token would look like (using local secret if available)
  const secret = process.env.BETA_INVITE_SECRET;
  if (secret) {
    const tokenPayload = Buffer.from(JSON.stringify({
      email: email.trim().toLowerCase(),
      issuedAt: Date.now(),
      channel: 'portal-beta',
    })).toString('base64url');
    const sig = createHmac('sha256', secret).update(tokenPayload).digest('hex');
    const token = `${tokenPayload}.${sig}`;
    console.log('\nSample invite URL:');
    console.log(`  https://www.myaihealth.ca/welcome?invite=${token}`);
  } else {
    console.log('\n(Set BETA_INVITE_SECRET locally to preview the invite token.)');
  }
  process.exit(0);
}

console.log(`Sending portal-beta invite to ${email}...`);

const res = await fetch(endpointUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-admin-key': adminKey,
  },
  body: JSON.stringify(payload),
});

const body = await res.json().catch(() => ({}));

if (res.ok) {
  console.log(`✅ Invite sent successfully. (${res.status})`);
} else {
  console.error(`❌ Failed: ${res.status} ${res.statusText}`);
  console.error(body);
  process.exit(1);
}
