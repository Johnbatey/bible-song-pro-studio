const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { importBibleFile, getVersions } = require('../src/electron/bible-service.cjs');

function cleanUserDataBibles() {
  const userDir = path.join(__dirname, '../userData/bibles');
  if (fs.existsSync(userDir)) {
    const files = fs.readdirSync(userDir);
    files.forEach((f) => {
      if (f.startsWith('NIV_TEST') || f.startsWith('PACKAGE')) {
        try { fs.unlinkSync(path.join(userDir, f)); } catch (_) {}
      }
    });
  }
}

async function run() {
  console.log('Testing custom Bible translation import and overwrite handling...');
  cleanUserDataBibles();

  const tmpDir = path.join(__dirname, '../scratch/test_bible_import');
  fs.mkdirSync(tmpDir, { recursive: true });

  const customBibleFile = path.join(tmpDir, 'NIV_Custom.json');
  const biblePayload = {
    id: 'NIV_TEST',
    name: 'New International Version (Test)',
    books: {
      Genesis: {
        '1': {
          '1': 'In the beginning God created the heavens and the earth.',
        },
      },
    },
  };
  fs.writeFileSync(customBibleFile, JSON.stringify(biblePayload, null, 2), 'utf8');

  // Test 1: First import (new translation)
  const res1 = importBibleFile({ filePath: customBibleFile });
  assert.strictEqual(res1.ok, true, 'First import should succeed');
  assert.strictEqual(res1.imported, true, 'First import should mark as imported');
  assert.strictEqual(res1.versionId, 'NIV_TEST');

  // Verify it appears in getVersions
  const versions1 = getVersions();
  const found1 = versions1.find((v) => v.id === 'NIV_TEST');
  assert.ok(found1, 'Imported version should be listed in getVersions');
  assert.strictEqual(found1.name, 'New International Version (Test)');

  // Test 2: Re-import without overwrite flag (should report exists: true)
  const res2 = importBibleFile({ filePath: customBibleFile });
  assert.strictEqual(res2.ok, true, 'Re-import check should succeed');
  assert.strictEqual(res2.exists, true, 'Re-import should detect existing translation');
  assert.strictEqual(res2.versionId, 'NIV_TEST');

  // Test 3: Re-import WITH overwrite flag (should overwrite)
  const res3 = importBibleFile({ filePath: customBibleFile, overwrite: true });
  assert.strictEqual(res3.ok, true, 'Overwrite import should succeed');
  assert.strictEqual(res3.imported, true, 'Overwrite import should mark as imported');

  fs.rmSync(tmpDir, { recursive: true, force: true });
  cleanUserDataBibles();
  console.log('✓ Custom Bible import, existing version detection, and overwrite confirmed 100%.');
}

run().catch((err) => {
  console.error('Bible import verification failed:', err);
  process.exit(1);
});
