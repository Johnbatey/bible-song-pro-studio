const assert = require('assert');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { importBibleFile, getVersions, getChapter, deleteVersion, repairStoredBookNumbers } = require('../src/electron/bible-service.cjs');

const userDir = path.join(__dirname, '../userData/bibles');
const TESTS = ['NIV_TEST', 'SQLITE_TEST', 'JP_TEST', 'LEGACY_TEST'];

function cleanUserDataBibles() {
  if (!fs.existsSync(userDir)) return;
  fs.readdirSync(userDir).forEach((f) => {
    if (TESTS.some((id) => f.startsWith(id)) || f === 'KJV.json') {
      try { fs.unlinkSync(path.join(userDir, f)); } catch (_) {}
    }
  });
}

async function run() {
  console.log('Testing custom Bible translation import, SQLite import, and refusal handling...');
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
  const res1 = await importBibleFile({ filePath: customBibleFile });
  assert.strictEqual(res1.ok, true, 'First import should succeed');
  assert.strictEqual(res1.imported, true, 'First import should mark as imported');
  assert.strictEqual(res1.versionId, 'NIV_TEST');

  // Verify it appears in getVersions
  const versions1 = getVersions();
  const found1 = versions1.find((v) => v.id === 'NIV_TEST');
  assert.ok(found1, 'Imported version should be listed in getVersions');
  assert.strictEqual(found1.name, 'New International Version (Test)');
  assert.strictEqual(found1.isUser, true, 'Imported version must be marked isUser, or the panel hides Delete');

  // Test 2: Re-import without overwrite flag (should report exists: true)
  const res2 = await importBibleFile({ filePath: customBibleFile });
  assert.strictEqual(res2.ok, true, 'Re-import check should succeed');
  assert.strictEqual(res2.exists, true, 'Re-import should detect existing translation');
  assert.strictEqual(res2.versionId, 'NIV_TEST');

  // Test 3: Re-import WITH overwrite flag (should overwrite)
  const res3 = await importBibleFile({ filePath: customBibleFile, overwrite: true });
  assert.strictEqual(res3.ok, true, 'Overwrite import should succeed');
  assert.strictEqual(res3.imported, true, 'Overwrite import should mark as imported');

  // Test 4: SQLite import, OpenLP shape (book_number + separate names table)
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run('CREATE TABLE book (book_number INTEGER PRIMARY KEY, book_name TEXT);');
  db.run('CREATE TABLE verse (book_number INTEGER, chapter INTEGER, verse INTEGER, text TEXT);');
  db.run("INSERT INTO book VALUES (43, 'John');");
  db.run("INSERT INTO verse VALUES (43, 3, 16, 'For God so loved the world, that he gave his only begotten Son.');");
  db.run("INSERT INTO verse VALUES (43, 3, 17, 'For God sent not his Son into the world to condemn the world.');");
  const sqlitePath = path.join(tmpDir, 'SQLITE_TEST.sqlite');
  fs.writeFileSync(sqlitePath, Buffer.from(db.export()));
  db.close();

  const res4 = await importBibleFile({ filePath: sqlitePath });
  assert.strictEqual(res4.ok, true, 'SQLite import should succeed: ' + (res4.error || ''));
  assert.strictEqual(res4.versionId, 'SQLITE_TEST');
  const sqliteVersion = getVersions().find((v) => v.id === 'SQLITE_TEST');
  assert.ok(sqliteVersion && sqliteVersion.isUser, 'SQLite import should be listed as a user version');
  const john3 = getChapter('SQLITE_TEST', 'John', 3);
  assert.strictEqual(john3.length, 2, 'SQLite verses should be readable through getChapter');
  assert.match(john3[0].text, /For God so loved the world/, 'Verse text should survive the import');

  // Test 5: a file whose id collides with a bundled translation is refused, not written
  const kjvFile = path.join(tmpDir, 'KJV.xml');
  fs.writeFileSync(kjvFile, '<bible><b n="Genesis"><c n="1"><v n="1">In the beginning</v></c></b></bible>', 'utf8');
  const res5 = await importBibleFile({ filePath: kjvFile });
  assert.strictEqual(res5.ok, false, 'Importing over a bundled id should be refused');
  assert.match(res5.error, /built-in/, 'Refusal should explain that the translation is built in');
  assert.strictEqual(fs.existsSync(path.join(userDir, 'KJV.json')), false, 'Refused import must not leave a dead file behind');

  // Test 6: an orphan written before that refusal is visible and removable
  fs.mkdirSync(userDir, { recursive: true });
  const orphan = path.join(userDir, 'KJV.json');
  fs.writeFileSync(orphan, JSON.stringify({ id: 'KJV', name: 'Stranded KJV', books: { Genesis: { '1': { '1': 'x' } } } }), 'utf8');
  const kjvMeta = getVersions().find((v) => v.id === 'KJV');
  assert.strictEqual(kjvMeta.hasUserCopy, true, 'A colliding user file should be reported on the bundled entry');
  assert.strictEqual(kjvMeta.isUser, false, 'The bundled text is still the one in use');
  const del = deleteVersion('KJV');
  assert.strictEqual(del.ok, true, 'The stranded copy should be deletable');
  assert.strictEqual(del.removedUserCopyOnly, true, 'Deleting it must be reported as removing only the copy');
  assert.strictEqual(fs.existsSync(orphan), false, 'The stranded file should be gone');
  assert.strictEqual(getVersions().find((v) => v.id === 'KJV').hasUserCopy, false, 'The mark should clear with the file');

  // Test 7: a Zefania n attribute holding a book name ("1 Samuel") is a name, not a number
  const jpFile = path.join(tmpDir, 'JP_TEST.xml');
  fs.writeFileSync(jpFile, `<bible translation="Japanese CO1955 Test">
  <BIBLEBOOK n="1 Samuel"><CHAPTER cnumber="1"><VERS vnumber="1">サムエル記上の一節</VERS></CHAPTER></BIBLEBOOK>
  <BIBLEBOOK n="2 Samuel"><CHAPTER cnumber="1"><VERS vnumber="1">サムエル記下の一節</VERS></CHAPTER></BIBLEBOOK>
</bible>`, 'utf8');
  const res7 = await importBibleFile({ filePath: jpFile });
  assert.strictEqual(res7.ok, true, 'Named-book XML import should succeed: ' + (res7.error || ''));
  const jpSaved = JSON.parse(fs.readFileSync(path.join(userDir, 'JP_TEST.json'), 'utf8'));
  const jpFirst = jpSaved.localizedBookNames.find((b) => b.name === 'サムエル記上');
  const jpSecond = jpSaved.localizedBookNames.find((b) => b.name === 'サムエル記下');
  assert.ok(jpFirst && jpSecond, 'Japanese book names should be recorded');
  assert.strictEqual(jpFirst.number, 9, 'n="1 Samuel" must map to 1 Samuel, not Genesis');
  assert.strictEqual(jpFirst.code, '1SA');
  assert.strictEqual(jpSecond.number, 10, 'n="2 Samuel" must map to 2 Samuel, not Exodus');
  assert.strictEqual(jpSecond.code, '2SA');

  // The bilingual view hands the localized book name to the English translation.
  const crossMapped = getChapter('KJV', 'サムエル記上', 1);
  assert.ok(crossMapped.length > 0, 'A localized book name should resolve in another translation');
  assert.strictEqual(crossMapped[0].book, '1 Samuel', 'Localized 1 Samuel must pair with English 1 Samuel');

  // Test 8: translations imported before the book-name fix get their stored numbers corrected
  fs.writeFileSync(path.join(userDir, 'LEGACY_TEST.json'), JSON.stringify({
    id: 'LEGACY_TEST',
    name: 'Legacy import',
    books: { '1 Samuel': { '1': { '1': 'legacy verse' } } },
    localizedBookNames: [
      { number: 1, code: 'GEN', name: '1 Samuel' },
      { number: 1, code: 'GEN', name: 'サムエル記上' },
    ],
  }, null, 2), 'utf8');
  repairStoredBookNumbers();
  const legacy = JSON.parse(fs.readFileSync(path.join(userDir, 'LEGACY_TEST.json'), 'utf8'));
  assert.deepStrictEqual(legacy.localizedBookNames[0], { number: 9, code: '1SA', name: '1 Samuel' }, 'A stored English book name should recover its number');
  assert.deepStrictEqual(legacy.localizedBookNames[1], { number: 9, code: '1SA', name: 'サムエル記上' }, 'A stored local book name should recover its number from the language tables');

  fs.rmSync(tmpDir, { recursive: true, force: true });
  cleanUserDataBibles();
  console.log('✓ Custom Bible import, SQLite import, bundled-id refusal, orphan recovery, named-book XML mapping, and stored book-number repair confirmed 100%.');
}

run().catch((err) => {
  console.error('Bible import verification failed:', err);
  process.exit(1);
});
