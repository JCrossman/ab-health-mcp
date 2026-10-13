/**
 * Opt-in, read-only check of the actual installer, not a separate auth implementation.
 * Credentials are entered only in Chrome. Responses remain in memory; only outcomes
 * are printed. The isolated profile and encrypted test session are removed on exit.
 *
 * npm run test:live -- ab-health-mcp.mcpb
 */
import { withBundle, withMcpClient, toolData } from './verify-bundle.js';
import { isRecord } from '../src/api/response-helpers.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

let failures = 0;
const safeErrors = new Set([
  'auth_required', 'session_expired', 'auth_failed', 'api_error',
  'network_error', 'upstream_contract_error', 'all_sources_unavailable',
]);

async function check(
  client: Client,
  name: string,
  args: Record<string, unknown>,
  valid: (data: Record<string, unknown>) => boolean,
): Promise<Record<string, unknown> | undefined> {
  try {
    const result = await client.callTool({ name, arguments: args }, undefined, {
      timeout: name === 'connect_account' ? 600_000 : 120_000,
    });
    const data = toolData(result);
    const passed = !result.isError && valid(data);
    if (!passed) failures++;
    console.log(JSON.stringify({
      check: name, outcome: passed ? 'pass' : 'fail',
      ...(typeof data.error === 'string' && safeErrors.has(data.error) ? { error: data.error } : {}),
      ...(isRecord(data.errors) ? { failedSections: Object.keys(data.errors).filter(key => [
        'profile', 'medications_mhr', 'recent_lab_results', 'allergies_mychart',
        'health_issues_mychart', 'immunizations_mychart',
      ].includes(key)) } : {}),
    }));
    return passed ? data : undefined;
  } catch (error) {
    failures++;
    console.log(JSON.stringify({ check: name, outcome: 'fail', errorType: error instanceof Error ? error.name : 'Error' }));
    return undefined;
  }
}

function findField(value: unknown, key: string, depth = 0): string | undefined {
  if (depth > 6) return undefined;
  if (isRecord(value) && typeof value[key] === 'string' && value[key]) return value[key];
  const children = Array.isArray(value) ? value : isRecord(value) ? Object.values(value) : [];
  for (const child of children) {
    const found = findField(child, key, depth + 1);
    if (found) return found;
  }
  return undefined;
}

async function main(): Promise<void> {
  console.log('Read-only installer check. Sign in only in the Chrome window. No record values or credentials will be printed.');
  await withBundle(process.argv[2] ?? 'ab-health-mcp.mcpb', async context => {
    let connected = false;
    await withMcpClient(context, false, async client => {
      const connection = await check(client, 'connect_account', { force: true, accept_privacy: true },
        data => data.connected === true && data.mhrConnected === true && data.myChartConnected === true);
      if (!connection) return;
      connected = true;
      await check(client, 'check_connection', {},
        data => data.connected === true && data.mhrConnected === true && data.myChartConnected === true);
      await check(client, 'get_medications', { max_results: 1 },
        data => Array.isArray(data.medications) && typeof data.totalRecords === 'number');
      const labs = await check(client, 'get_lab_results', { date_range: 'LastYear', max_results: 1 },
        data => Array.isArray(data.results) && typeof data.totalResults === 'number');
      await check(client, 'get_diagnostic_imaging', { date_range: 'LastYear', max_results: 1 },
        data => Array.isArray(data.results) && typeof data.totalResults === 'number');
      for (const name of ['mc_get_allergies', 'mc_get_health_issues', 'mc_get_medications', 'mc_get_immunizations', 'mc_get_visits']) {
        await check(client, name, {}, data => !data.error);
      }
      const tests = await check(client, 'mc_get_test_results', {}, data => !data.error);
      const orderKey = findField(tests, 'orderKey');
      if (orderKey) {
        await check(client, 'mc_get_test_results', { order_id: orderKey }, data => !data.error);
      } else {
        console.log(JSON.stringify({ check: 'MyChart result details', outcome: 'not-exercised', reason: 'no supported order key in the response' }));
      }
      await check(client, 'get_health_overview', {}, data =>
        data.partial === false && isRecord(data.errors) && Object.keys(data.errors).length === 0 &&
        isRecord(data.sources) && data.sources.mhr === true && data.sources.myChart === true);

      const attachmentId = findField(labs, 'thing_id');
      const filename = findField(labs, 'filename');
      if (attachmentId && filename) {
        try {
          const result = await client.callTool({
            name: 'download_attachment', arguments: { thing_id: attachmentId, filename },
          }, undefined, { timeout: 120_000 });
          const passed = !result.isError && Array.isArray(result.content) && result.content.length > 0;
          if (!passed) failures++;
          console.log(JSON.stringify({ check: 'download_attachment', outcome: passed ? 'pass' : 'fail' }));
        } catch {
          failures++;
          console.log(JSON.stringify({ check: 'download_attachment', outcome: 'fail' }));
        }
      } else {
        console.log(JSON.stringify({ check: 'download_attachment', outcome: 'not-exercised', reason: 'no attachment in the sampled result' }));
      }
    });

    if (connected) {
      await withMcpClient(context, false, async client => {
        await check(client, 'connect_account', {},
          data => data.connected === true && data.mhrConnected === true && data.myChartConnected === true);
        await check(client, 'mc_get_allergies', {}, data => !data.error);
        await check(client, 'disconnect_account', {}, data => data.connected === false);
      });
    }
    console.log(JSON.stringify({ check: 'live-installer', outcome: failures ? 'fail' : 'pass', failures, version: context.version }));
  });
  console.log('Temporary browser profile and encrypted test session removed.');
  if (failures) process.exitCode = 1;
}

main().catch(error => {
  console.error(JSON.stringify({ check: 'live-installer', outcome: 'fail', errorType: error instanceof Error ? error.name : 'Error' }));
  process.exitCode = 1;
});
