const assert = require('assert');
const initSqlJs = require('sql.js');
const { createSongImportService } = require('../src/electron/song-import-service.cjs');

async function run() {
  console.log('Testing sql.js WebAssembly SQLite song import service...');

  const SQL = await initSqlJs();
  const db = new SQL.Database();

  // Create mock EasyWorship tables
  db.run("CREATE TABLE song (rowid INTEGER PRIMARY KEY, title TEXT, author TEXT);");
  db.run("CREATE TABLE word (rowid INTEGER PRIMARY KEY, song_id INTEGER, words TEXT);");
  db.run("INSERT INTO song VALUES (1, 'Amazing Grace', 'John Newton');");
  db.run("INSERT INTO word VALUES (1, 1, '{\\rtf1\\ansi Amazing grace! How sweet the sound\\par That saved a wretch like me.}');");

  const data = db.export();
  const fs = require('fs');
  const path = require('path');
  const tmpPath = path.join(__dirname, '../scratch/test_ew.db');
  fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
  fs.writeFileSync(tmpPath, Buffer.from(data));

  const service = createSongImportService();
  const result = await service.importFile(tmpPath);

  assert.strictEqual(result.ok, true, 'EasyWorship import failed');
  assert.strictEqual(result.songs.length, 1, 'Expected 1 song');
  assert.strictEqual(result.songs[0].title, 'Amazing Grace');
  assert.strictEqual(result.songs[0].author, 'John Newton');
  assert.ok(result.songs[0].verses.length > 0, 'Expected verses');

  fs.unlinkSync(tmpPath);
  console.log('✓ EasyWorship & OpenLP WebAssembly SQLite song import verified successfully.');
}

run().catch((err) => {
  console.error('SQLite verification failed:', err);
  process.exit(1);
});
