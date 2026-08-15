'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const bibleService = require('../src/electron/bible-service.cjs');

console.log('Testing Factory Reset functionality...');

// 1. Create a dummy user Bible file
const dummyPath = path.join(__dirname, 'temp-user-bible.json');
fs.writeFileSync(
  dummyPath,
  JSON.stringify({
    id: 'CUSTOM_TEST_BIBLE',
    name: 'Custom Test Bible Translation',
    books: {
      Genesis: { '1': { '1': 'In the beginning...' } },
    },
  }),
  'utf8'
);

const importRes = bibleService.importBibleFile({ filePath: dummyPath, overwrite: true });
if (fs.existsSync(dummyPath)) fs.unlinkSync(dummyPath);

assert.strictEqual(importRes.ok, true, 'Custom Bible import failed: ' + importRes.error);
assert.strictEqual(importRes.versionId, 'CUSTOM_TEST_BIBLE');

// 2. Perform Factory Reset
const clearBibleRes = bibleService.clearUserBibles();
assert.strictEqual(clearBibleRes.ok, true, 'clearUserBibles failed');

const allVersionsAfter = bibleService.getVersions();
const foundTestBible = allVersionsAfter.some((v) => v.id === 'CUSTOM_TEST_BIBLE');
assert.strictEqual(foundTestBible, false, 'User Bible still exists after factory reset');

console.log('✓ Factory reset wipes user imported Bibles 100%.');
