const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { createNdiService, findLib } = require('../src/electron/ndi-service.cjs');

console.log('--- Verifying NDI Multi-OS Bundling & 2-Tier Resolution ---');

// 1. Verify existence of binaries for all 3 OSes
const requiredFiles = [
  'assets/bin/ndi/darwin/libndi.dylib',
  'assets/bin/ndi/darwin/libndi_licenses.txt',
  'assets/bin/ndi/win32-x64/Processing.NDI.Lib.x64.dll',
  'assets/bin/ndi/win32-x64/libndi_licenses.txt',
  'assets/bin/ndi/linux-x64/libndi.so',
  'assets/bin/ndi/linux-x64/libndi_licenses.txt',
];

for (const relPath of requiredFiles) {
  const fullPath = path.join(__dirname, '..', relPath);
  assert(fs.existsSync(fullPath), `Missing required NDI binary or license: ${relPath}`);
  const stat = fs.statSync(fullPath);
  console.log(`✓ Staged: ${relPath} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
}

// 2. Test dynamic library resolution (System & Bundled)
const resolvedPath = findLib();
console.log(`✓ Resolved NDI Library Path: ${resolvedPath}`);
assert(resolvedPath, 'findLib() returned null');
assert(fs.existsSync(resolvedPath), `Resolved path does not exist: ${resolvedPath}`);

// Test direct load of bundled Darwin binary into Koffi
const koffi = require('koffi');
const bundledDarwinLib = path.join(__dirname, '../assets/bin/ndi/darwin/libndi.dylib');
const loadedBundled = koffi.load(bundledDarwinLib);
assert(loadedBundled, 'Failed to load bundled libndi.dylib via Koffi');
console.log('✓ Direct Koffi load of bundled libndi.dylib succeeded');

// 3. Test NDI Service lifecycle
const ndiService = createNdiService();
const initialStatus = ndiService.status();
console.log('✓ Initial Status:', JSON.stringify(initialStatus));
assert(initialStatus.ok, 'Initial status ok was false');

const startResult = ndiService.start('Bible Song Pro Studio - Test');
console.log('✓ Start Result:', JSON.stringify(startResult));
assert(startResult.ok, `Failed to start NDI service: ${startResult.error}`);

const runningStatus = ndiService.status();
assert(runningStatus.running, 'NDI service is not running');
console.log(`✓ Running Status: Active=${runningStatus.instanceActive}, Running=${runningStatus.running}`);

const stopResult = ndiService.stop();
console.log('✓ Stop Result:', JSON.stringify(stopResult));
assert(stopResult.ok, 'Failed to stop NDI service');

const destroyResult = ndiService.destroy();
console.log('✓ Destroy Result:', JSON.stringify(destroyResult));
assert(destroyResult.ok, 'Failed to destroy NDI service');

console.log('\n✅ All NDI Multi-OS Bundling and Resolution tests PASSED successfully!\n');
