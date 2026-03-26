#!/usr/bin/env node

/**
 * Deploy script: bump version, build, pack, upload, deploy.
 *
 * Usage:
 *   npm run deploy              # bump patch (1.0.0 → 1.0.1)
 *   npm run deploy -- minor     # bump minor (1.0.1 → 1.1.0)
 *   npm run deploy -- major     # bump major (1.1.0 → 2.0.0)
 *
 * Updates version in: package.json, manifest.json, static/version.json,
 * src/tools/connect-account.ts, and src/server/create-server.ts.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const bumpType = process.argv[2] || 'patch';
if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error(`Usage: deploy [patch|minor|major] (got "${bumpType}")`);
  process.exit(1);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

function bump(version, type) {
  const [major, minor, patch] = version.split('.').map(Number);
  switch (type) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'patch': return `${major}.${minor}.${patch + 1}`;
  }
}

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd: root, stdio: 'inherit' });
}

// 1. Read current version from package.json
const pkg = readJson(join(root, 'package.json'));
const oldVersion = pkg.version;
const newVersion = bump(oldVersion, bumpType);
console.log(`\n🔄 Bumping version: ${oldVersion} → ${newVersion} (${bumpType})\n`);

// 2. Update package.json
pkg.version = newVersion;
writeJson(join(root, 'package.json'), pkg);
console.log('✓ package.json');

// 3. Update manifest.json
const manifest = readJson(join(root, 'manifest.json'));
manifest.version = newVersion;
writeJson(join(root, 'manifest.json'), manifest);
console.log('✓ manifest.json');

// 4. Update static/version.json
writeJson(join(root, 'static', 'version.json'), { version: newVersion });
console.log('✓ static/version.json');

// 5. Update CURRENT_VERSION in connect-account.ts
const connectPath = join(root, 'src', 'tools', 'connect-account.ts');
let connectSrc = readFileSync(connectPath, 'utf8');
connectSrc = connectSrc.replace(
  /const CURRENT_VERSION = '[^']+'/,
  `const CURRENT_VERSION = '${newVersion}'`,
);
writeFileSync(connectPath, connectSrc);
console.log('✓ src/tools/connect-account.ts');

// 6. Update version in create-server.ts
const serverPath = join(root, 'src', 'server', 'create-server.ts');
let serverSrc = readFileSync(serverPath, 'utf8');
serverSrc = serverSrc.replace(
  /version: '[^']+'/,
  `version: '${newVersion}'`,
);
writeFileSync(serverPath, serverSrc);
console.log('✓ src/server/create-server.ts');

// 7. Build
console.log('\n📦 Building...');
run('npm run build');

// 8. Pack
console.log('\n📦 Packing .mcpb...');
run('mcpb pack . ab-health-mcp.mcpb');

// 9. Verify bundle
console.log('\n🔍 Verifying bundle...');
run('unzip -l ab-health-mcp.mcpb | grep "build/api/" | head -4');
run('unzip -l ab-health-mcp.mcpb | grep "node_modules/debug/src/index.js"');

// 10. Upload to Azure
console.log('\n☁️  Uploading to Azure...');
run('az storage blob upload --account-name myaihealthdownloads --container-name downloads --name ab-health-mcp.mcpb --file ab-health-mcp.mcpb --overwrite --auth-mode key');

// 11. Deploy landing page (with updated version.json)
console.log('\n🌐 Deploying landing page...');
run('swa deploy ./static --api-location ./api --api-language node --api-version 18 --app-name myaihealth --env production');

console.log(`\n✅ Deployed v${newVersion} successfully!\n`);
