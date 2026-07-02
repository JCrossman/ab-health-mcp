/**
 * Demo-mode performance benchmark.
 *
 * Spawns the built MCP server over stdio with AB_HEALTH_PERF_LOG=1, runs a
 * scripted set of representative tool calls against the demo personas, and
 * reports per-tool latency + payload-byte stats. Establishes the baseline
 * we measure perf branch optimizations against.
 *
 * Usage:
 *   npm run build
 *   npx tsx scripts/bench-demo.ts
 *
 * Writes a summary table to stdout and (optionally) a JSON snapshot:
 *   npx tsx scripts/bench-demo.ts --out scripts/perf-baseline.json
 *
 * Compare a snapshot against an earlier baseline:
 *   npx tsx scripts/bench-demo.ts --diff scripts/perf-baseline.json
 *
 * No PII / PHI: only tool name, demo flag, duration_ms, response_bytes,
 * and is_error are captured (those are the only fields the server emits).
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

interface BenchCall {
  name: string;
  args?: Record<string, unknown>;
  /** Optional tag so multiple invocations of the same tool can be tracked separately. */
  label?: string;
}

interface PerfLine {
  perf: true;
  tool: string;
  demo: boolean;
  duration_ms: number;
  response_bytes: number;
  is_error: boolean;
}

interface CallRecord {
  label: string;
  tool: string;
  duration_ms: number;
  response_bytes: number;
  is_error: boolean;
}

/**
 * Representative demo prompts, broken into the call sequences Claude tends
 * to issue. Each block roughly corresponds to one user prompt. Order
 * matters: connect_account must come first; mc_switch_context flips active
 * persona for subsequent calls.
 */
const SCRIPT: BenchCall[] = [
  // Session establishment
  { name: 'connect_account', args: { demo: true, accept_privacy: true }, label: 'connect_account[demo]' },
  { name: 'check_connection', label: 'check_connection[after-connect]' },

  // Single-tool prompts (Self)
  { name: 'get_user_profile', label: 'self.get_user_profile' },
  { name: 'get_lab_results', args: { date_range: 'LastYear' }, label: 'self.get_lab_results[LastYear]' },
  { name: 'get_lab_results', args: { date_range: 'All' }, label: 'self.get_lab_results[All]' },
  { name: 'get_medications', label: 'self.get_medications' },
  { name: 'get_immunizations', args: { date_range: 'All' }, label: 'self.get_immunizations' },
  { name: 'get_vitals', args: { date_range: 'Last6Months' }, label: 'self.get_vitals' },
  { name: 'get_blood_pressure', args: { date_range: 'Last6Months' }, label: 'self.get_blood_pressure' },
  { name: 'get_blood_glucose', args: { date_range: 'Last6Months' }, label: 'self.get_blood_glucose' },
  { name: 'get_diagnostic_imaging', args: { date_range: 'All' }, label: 'self.get_diagnostic_imaging' },

  // MyChart single-tool
  { name: 'mc_get_allergies', label: 'self.mc_get_allergies' },
  { name: 'mc_get_health_issues', label: 'self.mc_get_health_issues' },
  { name: 'mc_get_medications', label: 'self.mc_get_medications' },
  { name: 'mc_get_care_team', label: 'self.mc_get_care_team' },
  { name: 'mc_get_visits', args: { time_frame: 'past' }, label: 'self.mc_get_visits[past]' },
  { name: 'mc_get_messages', args: { folder: 'inbox' }, label: 'self.mc_get_messages[inbox]' },

  // Composite tool (one call replaces several)
  { name: 'get_health_overview', label: 'self.get_health_overview' },

  // Proxy / multi-persona flow
  { name: 'mc_list_proxy_access', label: 'mc_list_proxy_access' },
  { name: 'mc_switch_context', args: { proxy_id: 'mother' }, label: 'switch->mother' },
  { name: 'get_health_overview', label: 'mother.get_health_overview' },
  { name: 'get_medications', label: 'mother.get_medications' },
  { name: 'get_lab_results', args: { date_range: 'LastYear' }, label: 'mother.get_lab_results[LastYear]' },
  { name: 'mc_switch_context', args: { proxy_id: 'spouse' }, label: 'switch->spouse' },
  { name: 'get_health_overview', label: 'spouse.get_health_overview' },
  { name: 'mc_switch_context', args: { proxy_id: 'child' }, label: 'switch->child' },
  { name: 'get_health_overview', label: 'child.get_health_overview' },
  { name: 'mc_switch_context', args: { proxy_id: 'self' }, label: 'switch->self' },

  // Cleanup
  { name: 'disconnect_account', label: 'disconnect_account' },
];

const records: CallRecord[] = [];
const stderrPerfLines: PerfLine[] = [];

function parsePerfLines(buf: string): void {
  for (const line of buf.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      const obj = JSON.parse(trimmed) as Partial<PerfLine>;
      if (obj.perf === true && typeof obj.tool === 'string') {
        stderrPerfLines.push(obj as PerfLine);
      }
    } catch {
      // not a JSON perf line — ignore (normal logger output)
    }
  }
}

async function runBench(): Promise<void> {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [join(REPO_ROOT, 'build', 'index.js')],
    env: {
      ...process.env,
      AB_HEALTH_PERF_LOG: '1',
      LOG_LEVEL: 'error',
    },
    stderr: 'pipe',
  });

  // Collect stderr (where perf lines and logger writes go).
  let stderrBuf = '';
  const stderrStream = transport.stderr;
  if (stderrStream) {
    stderrStream.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString('utf8');
    });
  }

  const client = new Client({ name: 'bench-demo', version: '0.0.1' }, { capabilities: {} });
  await client.connect(transport);

  for (const call of SCRIPT) {
    const t0 = performance.now();
    let isError = false;
    let bytes = 0;
    try {
      const res = await client.callTool({ name: call.name, arguments: call.args ?? {} });
      isError = Boolean(res.isError);
      if (Array.isArray(res.content)) {
        for (const c of res.content as Array<{ text?: string }>) {
          if (typeof c?.text === 'string') bytes += Buffer.byteLength(c.text, 'utf8');
        }
      }
    } catch (err) {
      isError = true;
      process.stderr.write(`[bench] ${call.label ?? call.name} threw: ${(err as Error).message}\n`);
    }
    const dt = Math.round((performance.now() - t0) * 100) / 100;
    records.push({
      label: call.label ?? call.name,
      tool: call.name,
      duration_ms: dt,
      response_bytes: bytes,
      is_error: isError,
    });
  }

  await client.close();
  // Drain any final stderr
  await new Promise((r) => setTimeout(r, 50));
  parsePerfLines(stderrBuf);
}

function pad(s: string, n: number, right = false): string {
  if (s.length >= n) return s.slice(0, n);
  return right ? s.padStart(n) : s.padEnd(n);
}

function printSummary(): void {
  console.log('\n=== Demo-mode perf summary (client-observed: round-trip incl. JSON-RPC) ===\n');
  console.log(
    pad('Label', 42) +
      pad('Tool', 28) +
      pad('Dur (ms)', 10, true) +
      pad('Bytes', 10, true) +
      pad('Err', 5, true),
  );
  console.log('-'.repeat(95));
  for (const r of records) {
    console.log(
      pad(r.label, 42) +
        pad(r.tool, 28) +
        pad(r.duration_ms.toFixed(2), 10, true) +
        pad(String(r.response_bytes), 10, true) +
        pad(r.is_error ? 'YES' : '', 5, true),
    );
  }
  const totalDur = records.reduce((a, r) => a + r.duration_ms, 0);
  const totalBytes = records.reduce((a, r) => a + r.response_bytes, 0);
  console.log('-'.repeat(95));
  console.log(
    pad(`TOTAL (${records.length} calls)`, 70) +
      pad(totalDur.toFixed(2), 10, true) +
      pad(String(totalBytes), 10, true),
  );

  // Cross-check with server-side timings
  if (stderrPerfLines.length) {
    const totalServerDur = stderrPerfLines.reduce((a, l) => a + l.duration_ms, 0);
    console.log(
      `\nServer-side handler-only total: ${totalServerDur.toFixed(2)} ms across ${stderrPerfLines.length} perf lines.`,
    );
  }
}

function asSnapshot(): Record<string, unknown> {
  return {
    capturedAt: new Date().toISOString(),
    nodeVersion: process.version,
    calls: records.map((r) => ({
      label: r.label,
      tool: r.tool,
      duration_ms: r.duration_ms,
      response_bytes: r.response_bytes,
      is_error: r.is_error,
    })),
    server_perf_lines: stderrPerfLines,
    totals: {
      calls: records.length,
      duration_ms: records.reduce((a, r) => a + r.duration_ms, 0),
      response_bytes: records.reduce((a, r) => a + r.response_bytes, 0),
    },
  };
}

function diff(against: string): void {
  if (!existsSync(against)) {
    console.error(`Baseline file not found: ${against}`);
    return;
  }
  const baseline = JSON.parse(readFileSync(against, 'utf8')) as ReturnType<typeof asSnapshot>;
  const baseByLabel = new Map<string, { duration_ms: number; response_bytes: number }>();
  for (const c of baseline.calls as CallRecord[]) {
    baseByLabel.set(c.label, { duration_ms: c.duration_ms, response_bytes: c.response_bytes });
  }
  console.log('\n=== Diff vs baseline ===\n');
  console.log(
    pad('Label', 42) +
      pad('Δ ms', 12, true) +
      pad('Δ bytes', 12, true) +
      pad('Δ bytes %', 11, true),
  );
  console.log('-'.repeat(77));
  let dDur = 0;
  let dBytes = 0;
  for (const r of records) {
    const b = baseByLabel.get(r.label);
    if (!b) continue;
    const dms = r.duration_ms - b.duration_ms;
    const db = r.response_bytes - b.response_bytes;
    const pct = b.response_bytes > 0 ? (db / b.response_bytes) * 100 : 0;
    dDur += dms;
    dBytes += db;
    console.log(
      pad(r.label, 42) +
        pad((dms >= 0 ? '+' : '') + dms.toFixed(2), 12, true) +
        pad((db >= 0 ? '+' : '') + String(db), 12, true) +
        pad((pct >= 0 ? '+' : '') + pct.toFixed(1) + '%', 11, true),
    );
  }
  console.log('-'.repeat(77));
  console.log(
    pad('TOTAL', 42) +
      pad((dDur >= 0 ? '+' : '') + dDur.toFixed(2), 12, true) +
      pad((dBytes >= 0 ? '+' : '') + String(dBytes), 12, true),
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const diffIdx = args.indexOf('--diff');

  await runBench();
  printSummary();

  if (outIdx >= 0 && args[outIdx + 1]) {
    const out = args[outIdx + 1];
    writeFileSync(out, JSON.stringify(asSnapshot(), null, 2));
    console.log(`\nSnapshot written to ${out}`);
  }

  if (diffIdx >= 0 && args[diffIdx + 1]) {
    diff(args[diffIdx + 1]);
  }
}

main().catch((err) => {
  console.error('Bench failed:', err);
  process.exit(1);
});
