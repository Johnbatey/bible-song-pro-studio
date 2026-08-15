const assert = require('assert');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { createSongImportService } = require('../src/electron/song-import-service.cjs');

async function run() {
  console.log('Testing EasyWorship and OpenLP SQLite song title resolution...');

  const SQL = await initSqlJs();
  const service = createSongImportService();

  // Test 1: EasyWorship database with title join across sibling files (Songs.db + SongWords.db)
  const dir1 = path.join(__dirname, '../scratch/test1');
  fs.mkdirSync(dir1, { recursive: true });
  const dbSongs = new SQL.Database();
  dbSongs.run("CREATE TABLE song (rowid INTEGER PRIMARY KEY, title TEXT, author TEXT);");
  dbSongs.run("INSERT INTO song VALUES (1, 'How Great Thou Art', 'Carl Boberg');");
  fs.writeFileSync(path.join(dir1, 'Songs.db'), Buffer.from(dbSongs.export()));

  const dbWords = new SQL.Database();
  dbWords.run("CREATE TABLE word (rowid INTEGER PRIMARY KEY, song_id INTEGER, words TEXT);");
  dbWords.run("INSERT INTO word VALUES (1, 1, '{\\rtf1\\ansi O Lord my God, when I in awesome wonder\\par Consider all the worlds Thy hands have made.}');");
  fs.writeFileSync(path.join(dir1, 'SongWords.db'), Buffer.from(dbWords.export()));

  const res1 = await service.importFile(path.join(dir1, 'SongWords.db'));
  assert.strictEqual(res1.ok, true, 'EasyWorship title import failed');
  assert.strictEqual(res1.songs[0].title, 'How Great Thou Art');
  assert.strictEqual(res1.songs[0].author, 'Carl Boberg');

  // Test 2: EasyWorship database with missing title (fallback to lyric inference)
  const dir2 = path.join(__dirname, '../scratch/test2');
  fs.mkdirSync(dir2, { recursive: true });
  const dbInfer = new SQL.Database();
  dbInfer.run("CREATE TABLE word (rowid INTEGER PRIMARY KEY, words TEXT);");
  dbInfer.run("INSERT INTO word VALUES (1, '{\\rtf1\\ansi Chorus\\par What a beautiful Name it is\\par What a beautiful Name it is}');");
  fs.writeFileSync(path.join(dir2, 'SongWords.db'), Buffer.from(dbInfer.export()));

  const res2 = await service.importFile(path.join(dir2, 'SongWords.db'));
  assert.strictEqual(res2.ok, true, 'EasyWorship infer import failed');
  assert.strictEqual(res2.songs[0].title, 'What a beautiful Name it is');

  // Test 3: OpenLP database import
  const dir3 = path.join(__dirname, '../scratch/test3');
  fs.mkdirSync(dir3, { recursive: true });
  const dbOpenLp = new SQL.Database();
  dbOpenLp.run("CREATE TABLE songs (id INTEGER PRIMARY KEY, title TEXT, authors TEXT, lyrics TEXT);");
  dbOpenLp.run("INSERT INTO songs VALUES (1, 'Blessed Assurance', 'Fanny Crosby', '<verse name=\"v1\"><![CDATA[Blessed assurance, Jesus is mine!\\nO what a foretaste of glory divine!]]></verse>');");
  fs.writeFileSync(path.join(dir3, 'openlp.sqlite'), Buffer.from(dbOpenLp.export()));

  const res3 = await service.importFile(path.join(dir3, 'openlp.sqlite'));
  assert.strictEqual(res3.ok, true, 'OpenLP import failed');
  assert.strictEqual(res3.songs[0].title, 'Blessed Assurance');
  assert.strictEqual(res3.songs[0].author, 'Fanny Crosby');

  fs.rmSync(dir1, { recursive: true, force: true });
  fs.rmSync(dir2, { recursive: true, force: true });
  fs.rmSync(dir3, { recursive: true, force: true });
  console.log('✓ EasyWorship & OpenLP song title resolution & lyric inference verified 100%.');
}

run().catch((err) => {
  console.error('SQLite verification failed:', err);
  process.exit(1);
});
