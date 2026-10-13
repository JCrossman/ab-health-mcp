import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { isRecord } from '../src/api/response-helpers.js';

export interface BundleContext {
  directory: string;
  home: string;
  version: string;
  sha256: string;
}

type ToolResult = Awaited<ReturnType<Client['callTool']>>;

export function toolData(result: ToolResult): Record<string, unknown> {
  assert(Array.isArray(result.content), 'The tool did not return content blocks.');
  const block: unknown = result.content.find((item: unknown) =>
    isRecord(item) && item.type === 'text' && typeof item.text === 'string' && item.text.startsWith('{'));
  assert(isRecord(block) && typeof block.text === 'string', 'The tool did not return structured data.');
  const data: unknown = JSON.parse(block.text);
  assert(isRecord(data), 'The tool returned an unsupported data shape.');
  return data;
}

export async function withBundle(bundle: string, operation: (context: BundleContext) => Promise<void>): Promise<void> {
  const archive = resolve(bundle);
  const names = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
    .split('\n').filter(Boolean);
  assert(names.every(name => !name.startsWith('/') && !/^[A-Za-z]:/.test(name) && !name.split('/').includes('..')),
    'The bundle contains an unsafe archive path.');
  assert(!names.some(name => /(^|\/)(?:\.env(?:\.[^/]*)?|[^/]+\.(?:har|enc))$/i.test(name) ||
    /^(?:tests|scripts|src)\//.test(name) || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(name)),
  'The bundle contains development or private files.');
  for (const required of [
    'manifest.json', 'package.json', 'build/index.js', 'build/api/mhr-config.js',
    'build/api/mychart-session.js', 'build/api/response-helpers.js',
    'node_modules/parse5/dist/index.js', 'node_modules/debug/src/index.js',
  ]) {
    assert(names.includes(required), `The bundle is missing required runtime code: ${required}`);
  }

  const temporary = await mkdtemp(join(tmpdir(), 'ab-health-mcp-bundle-'));
  try {
    const directory = join(temporary, 'package');
    const home = join(temporary, 'home');
    await mkdir(directory);
    await mkdir(home, { mode: 0o700 });
    execFileSync('unzip', ['-q', archive, '-d', directory], { stdio: 'pipe' });
    const manifest: unknown = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
    const pkg: unknown = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    assert(isRecord(manifest) && typeof manifest.version === 'string', 'The bundle manifest is invalid.');
    assert(isRecord(pkg) && pkg.version === manifest.version, 'Package and manifest versions disagree.');
    assert(isRecord(manifest.server) && manifest.server.entry_point === 'build/index.js', 'Unexpected installer entry point.');
    await operation({
      directory, home, version: manifest.version,
      sha256: createHash('sha256').update(await readFile(archive)).digest('hex'),
    });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function withMcpClient(context: BundleContext, extended: boolean, operation: (client: Client) => Promise<void>): Promise<void> {
  const env: Record<string, string> = {};
  for (const name of [
    'PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT',
    'TMP', 'TEMP', 'TMPDIR', 'LOCALAPPDATA', 'APPDATA', 'LANG', 'LC_ALL', 'DISPLAY',
  ]) {
    const value = process.env[name];
    if (value !== undefined) env[name] = value;
  }
  Object.assign(env, {
    HOME: context.home,
    USERPROFILE: context.home,
    LOG_LEVEL: 'error',
    AB_HEALTH_ENABLE_SELF_REPORT: extended ? '1' : '0',
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(context.directory, 'build', 'index.js')],
    cwd: context.directory,
    env,
    stderr: 'pipe',
  });
  transport.stderr?.on('data', () => {});
  const client = new Client({ name: 'ab-health-installer-check', version: '1.0.0' });
  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion()?.version, context.version, 'The installed runtime version does not match the manifest.');
    await operation(client);
  } finally {
    await client.close();
  }
}

export async function verifyBundle(bundle: string): Promise<void> {
  await withBundle(bundle, async context => {
    for (const extended of [false, true]) {
      await withMcpClient(context, extended, async client => {
        const { tools } = await client.listTools();
        assert.equal(tools.length, extended ? 48 : 41, 'Unexpected installed tool count.');
        assert.equal(tools.some(tool => tool.name === 'get_sleep'), extended, 'The opt-in tool flag is not respected.');
        assert(tools.find(tool => tool.name === 'get_lab_results')?.annotations?.readOnlyHint);
        const connection = await client.callTool({ name: 'check_connection', arguments: {} });
        assert.equal(toolData(connection).connected, false, 'An isolated bundle must not reuse a real session.');
        const labs = await client.callTool({ name: 'get_lab_results', arguments: { date_range: 'LastWeek' } });
        assert.equal(labs.isError, true, 'Unsigned data access must fail.');
        assert.equal(toolData(labs).error, 'auth_required');
        console.log(JSON.stringify({ check: 'packaged-stdio', tools: tools.length, outcome: 'pass' }));
      });
    }
    console.log(JSON.stringify({ check: 'bundle', outcome: 'pass', version: context.version, sha256: context.sha256 }));
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  verifyBundle(process.argv[2] ?? 'ab-health-mcp.mcpb').catch(error => {
    console.error(JSON.stringify({ check: 'bundle', outcome: 'fail', errorType: error instanceof Error ? error.name : 'Error' }));
    process.exitCode = 1;
  });
}
