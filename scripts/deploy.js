#!/usr/bin/env node

/**
 * Deploy script: bump version, build, pack, upload, deploy.
 *
 * Usage:
 *   npm run deploy              # bump patch (1.0.0 → 1.0.1)
 *   npm run deploy -- minor     # bump minor (1.0.1 → 1.1.0)
 *   npm run deploy -- major     # bump major (1.1.0 → 2.0.0)
 *
 * Updates package.json, package-lock.json, manifest.json, static/version.json,
 * and src/version.ts. Publishes only after tests and packaged-runtime checks.
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

// Validate before changing release metadata or uploading anything.
run('npm test');
run('npm run lint');

// 1. Read current version from package.json
const pkg = readJson(join(root, 'package.json'));
const oldVersion = pkg.version;
if (!/^\d+\.\d+\.\d+$/.test(oldVersion)) {
  throw new Error('Expected a stable three-part package version.');
}
const newVersion = bump(oldVersion, bumpType);
console.log(`\n🔄 Bumping version: ${oldVersion} → ${newVersion} (${bumpType})\n`);

// 2. Keep the dependency lockfile's package version synchronized too.
run(`npm version ${newVersion} --no-git-tag-version`);

// 3. Update manifest.json
const manifest = readJson(join(root, 'manifest.json'));
manifest.version = newVersion;
writeJson(join(root, 'manifest.json'), manifest);
console.log('✓ manifest.json');

// 4. Update static/version.json
writeJson(join(root, 'static', 'version.json'), { version: newVersion });
console.log('✓ static/version.json');

// 5. Update VERSION in src/version.ts (single source of truth read by both
//    create-server.ts and connect-account.ts)
const versionTsPath = join(root, 'src', 'version.ts');
let versionTsSrc = readFileSync(versionTsPath, 'utf8');
versionTsSrc = versionTsSrc.replace(
  /export const VERSION = '[^']+'/,
  `export const VERSION = '${newVersion}'`,
);
writeFileSync(versionTsPath, versionTsSrc);
console.log('✓ src/version.ts');

// 6. Build
console.log('\n📦 Building...');
run('npm run build:css');
run('npm run build');
run('npm test');
run('npm run lint');

// 8. Pack
console.log('\n📦 Packing .mcpb...');
run('mcpb validate manifest.json');
run('mcpb pack . ab-health-mcp.mcpb');

// 9. Verify bundle
console.log('\n🔍 Verifying bundle...');
run('npm run test:bundle -- ab-health-mcp.mcpb');

// 10. Upload to Azure
console.log('\n☁️  Uploading to Azure...');
run('az storage blob upload --account-name myaihealthdownloads --container-name downloads --name ab-health-mcp.mcpb --file ab-health-mcp.mcpb --overwrite --auth-mode key --only-show-errors --output none');
run('az storage blob upload --account-name myaihealthdownloads --container-name downloads --name version.json --file static/version.json --content-type application/json --overwrite --auth-mode key --only-show-errors --output none');

// 11. Deploy landing page (with updated version.json). The API's runtime
//     dependencies must be installed locally or the deployed functions return 500.
console.log('\n🌐 Deploying landing page...');
run('npm ci --prefix api --omit=dev --no-audit --no-fund');
run('swa deploy ./static --api-location ./api --api-language node --api-version 18 --app-name myaihealth --env production');

console.log(`\n✅ Deployed v${newVersion} successfully!\n`);
