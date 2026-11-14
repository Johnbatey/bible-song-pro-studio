const fs = require('fs');
const path = require('path');
const { ALL_BOOKS } = require('./scripture-reference.cjs');
const {
  CANONICAL_BOOKS,
  matchCanonicalBook,
  parseXmlBible,
  parseZefaniaXml,
  parseOsisXml,
  parseOpenSongXml,
  parseUsfmText,
  parseJsonBible,
} = require('./bible-parsing.cjs');

// Bundled scripture is public domain and 66-book Protestant canon only — see
// BIBLES.md. Copyrighted translations (NIV, NKJV, NLT, NASB, ESV) are not shipped;
// users import their own licensed copy instead.
const VERSION_META = [
  { id: 'KJV', name: 'King James Version (1769)', abbreviation: 'KJV', language: 'en', file: 'KJV.json', type: 'json' },
  { id: 'ASV', name: 'American Standard Version (1901)', abbreviation: 'ASV', language: 'en', file: 'ASV.json', type: 'json' },
  { id: 'Darby', name: 'Darby Translation (1890)', abbreviation: 'DBY', language: 'en', file: 'Darby.json', type: 'json' },
  { id: 'YLT', name: "Young's Literal Translation (1898)", abbreviation: 'YLT', language: 'en', file: 'YLT.json', type: 'json' },
  { id: 'LSG', name: 'Louis Segond 1910', abbreviation: 'LSG', language: 'fr', file: 'LSG.json', type: 'json' },
  { id: 'OST', name: 'Ostervald', abbreviation: 'OST', language: 'fr', file: 'OST.json', type: 'json' },
  { id: 'RV1909', name: 'Reina-Valera 1909', abbreviation: 'RVR', language: 'es', file: 'RV1909.json', type: 'json' },
];

const BOOK_ALIASES = new Map();

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addBookAlias(alias, book) {
  const key = fold(alias);
  if (key) BOOK_ALIASES.set(key, book);
  const compact = key.replace(/\s+/g, '');
  if (compact) BOOK_ALIASES.set(compact, book);
}

ALL_BOOKS.forEach((book) => {
  addBookAlias(book.name, book.name);
  book.abbrev.forEach((alias) => addBookAlias(alias, book.name));
});

const BIBLE_VERSION_MAP = {
  newlivingtranslation: 'NLT',
  newlivingtranslation1996: 'NLT',
  newlivingtranslation2015: 'NLT',
  newliving: 'NLT',
  nlt: 'NLT',
  newinternationalversion: 'NIV',
  niv: 'NIV',
  kingjamesversion: 'KJV',
  kjv: 'KJV',
  newkingjamesversion: 'NKJV',
  nkjv: 'NKJV',
  englishstandardversion: 'ESV',
  esv: 'ESV',
  newamericanstandardbible: 'NASB',
  nasb: 'NASB',
  themessage: 'MSG',
  message: 'MSG',
  msg: 'MSG',
  amplifiedbible: 'AMP',
  amplified: 'AMP',
  amp: 'AMP',
  christianstandardbible: 'CSB',
  csb: 'CSB',
  holmanchristianstandardbible: 'HCSB',
  hcsb: 'HCSB',
  contemporaryenglishversion: 'CEV',
  cev: 'CEV',
  goodnewstranslation: 'GNT',
  goodnewsbible: 'GNB',
  gnt: 'GNT',
  gnb: 'GNB',
  revisedstandardversion: 'RSV',
  rsv: 'RSV',
  newrevisedstandardversion: 'NRSV',
  nrsv: 'NRSV',
  thepassiontranslation: 'TPT',
  passiontranslation: 'TPT',
  tpt: 'TPT',
  americanstandardversion: 'ASV',
  asv: 'ASV',
  darbytranslation: 'DBY',
  darby: 'DBY',
  dby: 'DBY',
  youngsliteraltranslation: 'YLT',
  ylt: 'YLT',
  louissegond: 'LSG',
  lsg: 'LSG',
  ostervald: 'OST',
  ost: 'OST',
  reinavalera: 'RVR',
  reinavalera1909: 'RVR',
  reinavalera1960: 'RVR60',
  rvr: 'RVR',
  nvi: 'NVI',
  arc: 'ARC',
  ara: 'ARA',
};

function shortenBibleVersionName(name) {
  if (!name || typeof name !== 'string') return name || '';
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  const normalized = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (BIBLE_VERSION_MAP[normalized]) return BIBLE_VERSION_MAP[normalized];
  const withoutYear = normalized.replace(/\d{4}$/, '');
  if (BIBLE_VERSION_MAP[withoutYear]) return BIBLE_VERSION_MAP[withoutYear];

  const parenMatch = trimmed.match(/\(([A-Za-z][A-Za-z0-9]{1,5})\)/);
  if (parenMatch) return parenMatch[1].toUpperCase();

  const withoutParenYear = trimmed.replace(/\s*\(\d{4}\)\s*/g, '').trim();
  if (/^[A-Z0-9]{2,6}$/.test(withoutParenYear)) return withoutParenYear;

  const splitWords = withoutParenYear
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([A-Za-z]+)(\d+)/g, '$1 $2')
    .split(/[\s_\-]+/)
    .filter(Boolean);

  const cleanTokens = splitWords
    .map((token) => token.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ''))
    .filter(Boolean);
  const wordTokens = cleanTokens.filter((token) => /[A-Za-z]/.test(token));
  const numberTokens = cleanTokens.filter((token) => /^\d+$/.test(token));

  if (
    wordTokens.length === 1 &&
    wordTokens[0].length <= 6 &&
    wordTokens.length + numberTokens.length === cleanTokens.length
  ) {
    return wordTokens[0].toUpperCase();
  }

  const initials = wordTokens.map((token) => token[0].toUpperCase()).join('');
  if (initials.length >= 2 && initials.length <= 6) return initials;

  const letters = trimmed.replace(/[^A-Za-z0-9]/g, '');
  if (letters) return letters.slice(0, 6).toUpperCase();
  return trimmed;
}
[
  ['psalm', 'Psalms'],
  ['psalms', 'Psalms'],
  ['song of songs', 'Song of Solomon'],
  ['songs', 'Song of Solomon'],
  ['revelations', 'Revelation'],
  ['first samuel', '1 Samuel'],
  ['second samuel', '2 Samuel'],
  ['first kings', '1 Kings'],
  ['second kings', '2 Kings'],
  ['first chronicles', '1 Chronicles'],
  ['second chronicles', '2 Chronicles'],
  ['first corinthians', '1 Corinthians'],
  ['second corinthians', '2 Corinthians'],
  ['first thessalonians', '1 Thessalonians'],
  ['second thessalonians', '2 Thessalonians'],
  ['first timothy', '1 Timothy'],
  ['second timothy', '2 Timothy'],
  ['first peter', '1 Peter'],
  ['second peter', '2 Peter'],
  ['first john', '1 John'],
  ['second john', '2 John'],
  ['third john', '3 John'],
  ['i samuel', '1 Samuel'],
  ['ii samuel', '2 Samuel'],
  ['i kings', '1 Kings'],
  ['ii kings', '2 Kings'],
  ['i chronicles', '1 Chronicles'],
  ['ii chronicles', '2 Chronicles'],
  ['i corinthians', '1 Corinthians'],
  ['ii corinthians', '2 Corinthians'],
  ['i thessalonians', '1 Thessalonians'],
  ['ii thessalonians', '2 Thessalonians'],
  ['i timothy', '1 Timothy'],
  ['ii timothy', '2 Timothy'],
  ['i peter', '1 Peter'],
  ['ii peter', '2 Peter'],
  ['i john', '1 John'],
  ['ii john', '2 John'],
  ['iii john', '3 John'],
].forEach(([alias, book]) => addBookAlias(alias, book));

let cache = null;
const bibleSearchCache = new Map();

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function getBibleDir() {
  return path.join(__dirname, '../../assets/bibles');
}

function parseKjvXml(xml) {
  const bible = {};
  const bookRe = /<b n="([^"]+)">([\s\S]*?)<\/b>/g;
  let bookMatch;
  while ((bookMatch = bookRe.exec(xml))) {
    const book = decodeEntities(bookMatch[1]);
    bible[book] = {};
    const chapterRe = /<c n="([^"]+)">([\s\S]*?)<\/c>/g;
    let chapterMatch;
    while ((chapterMatch = chapterRe.exec(bookMatch[2]))) {
      const chapter = String(chapterMatch[1]);
      bible[book][chapter] = {};
      const verseRe = /<v n="([^"]+)">([\s\S]*?)<\/v>/g;
      let verseMatch;
      while ((verseMatch = verseRe.exec(chapterMatch[2]))) {
        bible[book][chapter][String(verseMatch[1])] = decodeEntities(verseMatch[2].replace(/\s+/g, ' ').trim());
      }
    }
  }
  return bible;
}

function getUserBibleDir() {
  let userDataPath = '';
  try {
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function') userDataPath = app.getPath('userData');
  } catch (_) {}
  if (!userDataPath) {
    userDataPath = path.join(__dirname, '../../userData');
  }
  const dir = path.join(userDataPath, 'bibles');
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  }
  return dir;
}

function getAllVersionMeta() {
  /* Copies, not the VERSION_META objects themselves: a user file that collides
     with a bundled id marks its meta below, and that mark must not stick to the
     bundled list for the rest of the process. */
  const metaList = VERSION_META.map((meta) => ({ ...meta }));
  const userDir = getUserBibleDir();
  if (fs.existsSync(userDir)) {
    try {
      const files = fs.readdirSync(userDir);
      files.forEach((file) => {
        if (!file.endsWith('.json') && !file.endsWith('.xml')) return;
        const baseId = path.basename(file, path.extname(file));
        const existing = metaList.find((m) => m.id.toLowerCase() === baseId.toLowerCase());
        if (!existing) {
          let metaName = baseId;
          const filePath = path.join(userDir, file);
          try {
            if (file.endsWith('.json')) {
              const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              if (parsed && parsed.name) metaName = parsed.name;
            }
          } catch (_) {}
          metaList.push({
            id: baseId,
            name: metaName,
            abbreviation: shortenBibleVersionName(metaName || baseId),
            language: 'en',
            file,
            type: file.endsWith('.xml') ? 'xml' : 'json',
            isUser: true,
            userPath: filePath,
          });
        } else if (!existing.isUser) {
          /* A user file whose name collides with a bundled id used to be skipped
             silently. The bundled id wins in loadVersion, so the file was never
             listed and never deletable — a permanent orphan. Mark the bundled
             entry with the copy so the UI can offer to remove it. */
          existing.hasUserCopy = true;
          existing.userCopyPath = path.join(userDir, file);
        }
      });
    } catch (_) {}
  }
  return metaList;
}

function loadVersion(meta) {
  const filePath = meta.userPath || path.join(getBibleDir(), meta.file);
  if (!fs.existsSync(filePath)) return {};
  if (meta.type === 'xml') return parseKjvXml(fs.readFileSync(filePath, 'utf8'));
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const books = (parsed && parsed.books && typeof parsed.books === 'object') ? parsed.books : parsed;
    if (parsed && Array.isArray(parsed.localizedBookNames)) {
      meta.localizedBookNames = parsed.localizedBookNames;
      parsed.localizedBookNames.forEach((b) => {
        if (b.name) {
          const canonical = matchCanonicalBook(b.code || b.name || String(b.number));
          if (canonical) {
            addBookAlias(b.name, canonical.name);
            addBookAlias(canonical.name, b.name);
            addBookAlias(canonical.code, b.name);
          }
        }
      });
    }
    return books;
  } catch (_) {
    return {};
  }
}

function getData() {
  if (cache) return cache;
  const versions = {};
  const allMeta = getAllVersionMeta();
  allMeta.forEach((meta) => {
    versions[meta.id] = loadVersion(meta);
  });
  cache = { versions };
  return cache;
}

/* ── SQLite bibles ────────────────────────────────────────
 * OpenLP and EasyWorship keep scripture in SQLite, which is why the picker has
 * always listed *.sqlite and *.db. sql.js is the engine the song importer
 * already uses; it is loaded on the first database import, not at startup. */
let sqlEnginePromise = null;

function loadSqlEngine() {
  if (!sqlEnginePromise) {
    sqlEnginePromise = require('sql.js')().catch((err) => {
      sqlEnginePromise = null;
      throw err;
    });
  }
  return sqlEnginePromise;
}

function isSqliteDatabase(buffer) {
  return Boolean(buffer) && buffer.length >= 16
    && buffer.subarray(0, 15).toString('latin1') === 'SQLite format 3';
}

function sqliteIdent(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

/* sql.js answers with column names as the file spells them, so every row is
   folded to lower case before anything looks a column up. */
function sqliteRows(db, sql) {
  const stmt = db.prepare(sql);
  const rows = [];
  try {
    while (stmt.step()) {
      const raw = stmt.getAsObject();
      const row = {};
      Object.keys(raw).forEach((key) => { row[String(key).toLowerCase()] = raw[key]; });
      rows.push(row);
    }
  } finally {
    stmt.free();
  }
  return rows;
}

function sqliteColumns(db, table) {
  try {
    return sqliteRows(db, `PRAGMA table_info(${sqliteIdent(table)})`).map((row) => String(row.name || ''));
  } catch (_) {
    return [];
  }
}

const SQLITE_BOOK_COLUMNS = ['book_name', 'bookname', 'book', 'book_number', 'booknumber'];
const SQLITE_TEXT_COLUMNS = ['text', 'scripture', 'verse_text', 'content'];

/** Canonical order, for the files that store a `book_number` and no names. */
function bookNameForNumber(value) {
  const canonical = CANONICAL_BOOKS.find((book) => book.number === Number(value));
  return canonical ? canonical.name : '';
}

async function parseSqliteBibleFile(buffer, fallbackName) {
  const SQL = await loadSqlEngine();
  const db = new SQL.Database(buffer);
  try {
    const tables = sqliteRows(db, "SELECT name FROM sqlite_master WHERE type='table'")
      .map((row) => String(row.name || ''))
      .filter(Boolean);
    const verseTable = tables.find((table) => {
      const cols = sqliteColumns(db, table);
      return cols.includes('chapter') && cols.includes('verse')
        && cols.some((column) => SQLITE_BOOK_COLUMNS.includes(column))
        && cols.some((column) => SQLITE_TEXT_COLUMNS.includes(column));
    });
    if (!verseTable) throw new Error('no verse table (expected book, chapter, verse and text columns)');

    /* A names table inside the file beats our canon order: it is the file's own. */
    const bookNames = new Map();
    for (const table of tables) {
      if (table === verseTable) continue;
      const cols = sqliteColumns(db, table);
      const numberCol = ['book_number', 'booknumber', 'number'].find((column) => cols.includes(column));
      const nameCol = ['book_name', 'bookname', 'name'].find((column) => cols.includes(column));
      if (!numberCol || !nameCol) continue;
      try {
        sqliteRows(db, `SELECT * FROM ${sqliteIdent(table)}`).forEach((row) => {
          const number = Number(row[numberCol]);
          const name = String(row[nameCol] || '').trim();
          if (Number.isFinite(number) && name) bookNames.set(number, name);
        });
      } catch (_) { /* a table we cannot read is not a reason to fail the import */ }
    }

    const cols = sqliteColumns(db, verseTable);
    const bookCol = SQLITE_BOOK_COLUMNS.find((column) => cols.includes(column));
    const textCol = SQLITE_TEXT_COLUMNS.find((column) => cols.includes(column));
    const bibleData = {};
    const localizedBookNames = [];
    sqliteRows(db, `SELECT * FROM ${sqliteIdent(verseTable)}`).forEach((row) => {
      const bookValue = String(row[bookCol] ?? '').trim();
      const numbered = /^\d+$/.test(bookValue);
      const book = numbered
        ? (bookNames.get(Number(bookValue)) || bookNameForNumber(bookValue) || bookValue)
        : bookValue;
      const chapter = String(row.chapter ?? '').trim().replace(/\.0+$/, '');
      const verse = String(row.verse ?? '').trim().replace(/\.0+$/, '');
      const text = String(row[textCol] ?? '').replace(/\s+/g, ' ').trim();
      if (!book || !chapter || !verse || !text) return;
      if (!bibleData[book]) bibleData[book] = {};
      if (!bibleData[book][chapter]) bibleData[book][chapter] = {};
      bibleData[book][chapter][verse] = text;
      if (numbered && bookNames.has(Number(bookValue)) && !localizedBookNames.some((b) => b.name === book)) {
        const canonical = CANONICAL_BOOKS.find((b) => b.number === Number(bookValue));
        localizedBookNames.push({ code: canonical ? canonical.code : '', name: book });
      }
    });

    /* The translation's own name, when a metadata table carries one. */
    let name = '';
    for (const table of tables) {
      const tableCols = sqliteColumns(db, table);
      if (!tableCols.includes('name') || tableCols.includes('verse')) continue;
      try {
        const hit = sqliteRows(db, `SELECT * FROM ${sqliteIdent(table)} LIMIT 5`)
          .map((row) => String(row.name || '').trim())
          .find((value) => value.length > 1);
        if (hit) { name = hit; break; }
      } catch (_) {}
    }

    return { name: name || fallbackName, bibleData, localizedBookNames };
  } finally {
    try { db.close(); } catch (_) {}
  }
}

async function importBibleFile({ filePath, overwrite = false }) {
  if (!filePath || !fs.existsSync(filePath)) return { ok: false, error: 'File not found: ' + filePath };
  const ext = path.extname(filePath).toLowerCase();
  let baseId = path.basename(filePath, ext).replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase() || 'CUSTOM';
  let versionName = baseId;
  let booksData = {};
  let localizedBookNames = [];

  try {
    const buffer = fs.readFileSync(filePath);
    if (isSqliteDatabase(buffer)) {
      const res = await parseSqliteBibleFile(buffer, baseId);
      versionName = res.name || baseId;
      booksData = res.bibleData;
      localizedBookNames = res.localizedBookNames;
    } else if (ext === '.db' || ext === '.sqlite' || ext === '.sqlite3') {
      /* The picker offers these extensions, so a database that is not SQLite has
         to say so rather than be handed to a JSON parser. */
      return { ok: false, error: 'That database is not a SQLite file. Export it as SQLite, XML or JSON and import it again.' };
    } else {
      const content = buffer.toString('utf8');
      if (ext === '.xml' || ext === '.osis' || ext === '.usfx' || ext === '.xmm' || content.trim().startsWith('<?xml') || content.includes('<bible')) {
        const res = parseXmlBible(content, baseId);
        versionName = res.name || baseId;
        booksData = res.bibleData;
        localizedBookNames = res.localizedBookNames;
      } else if (ext === '.usfm' || ext === '.sfm' || content.trim().startsWith('\\id')) {
        const res = parseUsfmText(content, baseId);
        booksData = res.bibleData;
        localizedBookNames = res.localizedBookNames;
      } else {
        const parsed = JSON.parse(content);
        if (parsed.id) baseId = String(parsed.id).trim().toUpperCase();
        if (parsed.name) versionName = String(parsed.name).trim();
        const res = parseJsonBible(parsed, baseId);
        booksData = res.bibleData;
        localizedBookNames = res.localizedBookNames;
      }
    }
  } catch (err) {
    return { ok: false, error: 'Failed to parse Bible file: ' + (err.message || String(err)) };
  }

  if (!booksData || typeof booksData !== 'object' || Object.keys(booksData).length === 0) {
    return { ok: false, error: 'No valid books or verses found in Bible file.' };
  }

  const allMeta = getAllVersionMeta();
  /* Importing KJV.xml used to write userDir/KJV.json, which the loader never
     saw (the bundled KJV wins), leaving a file the operator could not use or
     delete. Refuse it and say what to do instead. */
  const idCollision = allMeta.find((m) => m.id.toLowerCase() === baseId.toLowerCase());
  if (idCollision && !idCollision.isUser) {
    return {
      ok: false,
      error: `"${idCollision.name}" is a built-in translation, so a file cannot be added under the id ${baseId}. Save it as ${baseId}_Custom (or any other name) and import it again.`,
    };
  }
  const existing = allMeta.find((m) => m.id.toLowerCase() === baseId.toLowerCase() || m.name.toLowerCase() === versionName.toLowerCase());

  if (existing && !overwrite) {
    return {
      ok: true,
      exists: true,
      versionId: existing.id,
      versionName: existing.name,
      filePath,
    };
  }

  const userDir = getUserBibleDir();
  const targetPath = path.join(userDir, `${baseId}.json`);
  const abbr = shortenBibleVersionName(versionName || baseId);
  const payload = {
    id: baseId,
    name: versionName,
    abbreviation: abbr,
    books: booksData,
    localizedBookNames,
  };

  fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf8');
  cache = null;
  bibleSearchCache.clear();

  return {
    ok: true,
    imported: true,
    versionId: baseId,
    versionName,
  };
}

function normalizeBookName(input, versionId = 'KJV') {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const bible = getData().versions[versionId] || getData().versions.KJV || {};
  const books = Object.keys(bible);
  const rawKey = fold(raw);
  const compactRaw = rawKey.replace(/\s+/g, '');

  const exact = books.find((book) => fold(book) === rawKey);
  if (exact) return exact;

  const canonical = matchCanonicalBook(raw);
  if (canonical) {
    const meta = getAllVersionMeta().find((m) => m.id === versionId);
    if (meta && Array.isArray(meta.localizedBookNames)) {
      const loc = meta.localizedBookNames.find((b) => b.number === canonical.number || b.code === canonical.code);
      if (loc && books.includes(loc.name)) return loc.name;
    }
    if (books[canonical.number - 1]) return books[canonical.number - 1];
  }

  const aliased = BOOK_ALIASES.get(rawKey) || BOOK_ALIASES.get(compactRaw);
  if (aliased) {
    const aliasExact = books.find((book) => fold(book) === fold(aliased));
    if (aliasExact) return aliasExact;
  }

  return books.find((book) => fold(book) === rawKey)
    || books.find((book) => fold(book).startsWith(rawKey))
    || books.find((book) => fold(book).replace(/\s+/g, '').startsWith(compactRaw))
    || books.find((book) => rawKey.startsWith(fold(book)))
    || raw;
}

function normalizeReferenceQuery(query) {
  let raw = String(query || '').replace(/\s+/g, ' ').trim();
  raw = raw.replace(/^([1-3])(?=\p{L})/u, '$1 ');
  raw = raw.replace(/^(.+?\s+\d+)\s+(\d+(?:\s*[-–]\s*\d+)?)$/u, '$1:$2');
  raw = raw.replace(/\b(chapters?|chap|ch)\s+(\d+)\b/gi, '$2');
  raw = raw.replace(/\b(verses?|vs?|v)\s+(\d+(?:\s*[-–]\s*\d+)?)\b/gi, ':$2');
  raw = raw.replace(/\s*:\s*/g, ':').replace(/\s*[-–]\s*/g, '-');
  return raw.trim();
}

function normalizeSearchText(value) {
  return fold(value);
}

function parseReference(query, versionId = 'KJV') {
  const raw = normalizeReferenceQuery(query);
  const match = raw.match(/^(.+?)\s+(\d+)(?::(\d+)(?:\s*[-–]\s*(\d+))?)?$/);
  if (!match) return null;
  return {
    book: normalizeBookName(match[1], versionId),
    chapter: Number(match[2]),
    verseStart: match[3] ? Number(match[3]) : 1,
    verseEnd: match[4] ? Number(match[4]) : (match[3] ? Number(match[3]) : 999),
  };
}

function getVersions() {
  const data = getData();
  const allMeta = getAllVersionMeta();
  return allMeta.map((meta) => {
    const books = Object.entries(data.versions[meta.id] || {}).map(([name, chapters]) => ({
      name,
      chapters: Object.keys(chapters || {}).length,
    }));
    /* isUser has to travel: the panel decides whether to offer Delete from it,
       and dropping it here is why imported translations had no Delete button. */
    return {
      id: meta.id,
      name: meta.name,
      abbreviation: meta.abbreviation,
      language: meta.language,
      books,
      isUser: Boolean(meta.isUser),
      hasUserCopy: Boolean(meta.hasUserCopy),
    };
  });
}

function getBooks(versionId = 'KJV') {
  const bible = getData().versions[versionId] || getData().versions.KJV || {};
  return Object.entries(bible).map(([name, chapters]) => ({
    name,
    chapters: Object.keys(chapters || {}).length,
  }));
}

function getChapter(versionId = 'KJV', bookName, chapterNumber) {
  const bible = getData().versions[versionId] || getData().versions.KJV || {};
  const book = normalizeBookName(bookName, versionId);
  const chapter = bible[book]?.[String(chapterNumber)] || {};
  return Object.entries(chapter).map(([verse, text]) => ({
    book,
    chapter: Number(chapterNumber),
    verse: Number(verse),
    text,
    version: versionId,
    reference: `${book} ${chapterNumber}:${verse}`,
  }));
}

function buildBibleSearchIndex(versionId = 'KJV') {
  const bible = getData().versions[versionId] || getData().versions.KJV || {};
  const entries = [];
  for (const [book, chapters] of Object.entries(bible)) {
    for (const [chapter, verses] of Object.entries(chapters || {})) {
      for (const [verse, text] of Object.entries(verses || {})) {
        entries.push({
          book,
          chapter: Number(chapter),
          verse: Number(verse),
          text,
          version: versionId,
          reference: `${book} ${chapter}:${verse}`,
          searchText: normalizeSearchText(`${book} ${chapter}:${verse} ${text}`),
        });
      }
    }
  }
  return entries;
}

function getBibleSearchIndex(versionId = 'KJV') {
  const key = versionId || 'KJV';
  if (!bibleSearchCache.has(key)) bibleSearchCache.set(key, buildBibleSearchIndex(key));
  return bibleSearchCache.get(key) || [];
}

function isBibleReferenceQuery(query) {
  const q = normalizeReferenceQuery(query);
  if (!q) return false;
  if (q.includes(':')) return /^(.+?)\s+\d+:\d*(?:-\d+)?$/u.test(q);
  return /^(.+?)\s+\d+$/u.test(q);
}

function searchKeywords(versionId = 'KJV', query = '', limit = 30, options = {}) {
  const q = normalizeSearchText(query).trim();
  if (!q || q.length < 2) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const selectedBook = normalizeBookName(options.book || '', versionId);
  const hasBookFilter = Boolean(options.book);
  const results = [];
  for (const entry of getBibleSearchIndex(versionId)) {
    if (hasBookFilter && normalizeBookName(entry.book, versionId) !== selectedBook) continue;
    if (!tokens.every((token) => entry.searchText.includes(token))) continue;
    const { searchText, ...result } = entry;
    results.push(result);
    if (results.length >= limit) break;
  }
  return results;
}

function search(versionId = 'KJV', query = '', limit = 30, options = {}) {
  const bible = getData().versions[versionId] || getData().versions.KJV || {};
  const ref = parseReference(query, versionId);
  if (ref && bible[ref.book]?.[String(ref.chapter)]) {
    return getChapter(versionId, ref.book, ref.chapter)
      .filter((v) => v.verse >= ref.verseStart && v.verse <= ref.verseEnd)
      .slice(0, limit);
  }

  if (!isBibleReferenceQuery(query)) return searchKeywords(versionId, query, limit, options);
  return [];
}

function clearUserBibles() {
  const userDir = getUserBibleDir();
  if (fs.existsSync(userDir)) {
    try {
      const files = fs.readdirSync(userDir);
      files.forEach((file) => {
        try {
          fs.unlinkSync(path.join(userDir, file));
        } catch (_) {}
      });
    } catch (_) {}
  }
  cache = null;
  bibleSearchCache.clear();
  return { ok: true };
}

function deleteVersion(versionId) {
  if (!versionId) return { ok: false, error: 'No version specified' };
  const userDir = getUserBibleDir();
  const wanted = String(versionId).toLowerCase();
  const target = getAllVersionMeta().find((v) => v.id.toLowerCase() === wanted);
  /* A bundled id can still have the operator's file behind it, imported before
     that import was refused. The bundled text itself is not ours to delete, but
     the stranded copy is theirs, so removing it is allowed. */
  const userFiles = [];
  if (target && target.isUser) {
    userFiles.push(target.userPath || path.join(userDir, target.file || `${target.id}.json`));
  } else if (target && target.hasUserCopy && target.userCopyPath) {
    userFiles.push(target.userCopyPath);
  }
  if (!userFiles.length) {
    return { ok: false, error: 'Cannot delete bundled translation or version not found' };
  }
  try {
    for (const filePath of userFiles) {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    /* Clear the whole index: a bundled id whose user copy is gone has different
       contents than it did a moment ago. */
    cache = null;
    bibleSearchCache.clear();
    return { ok: true, versionId, removedUserCopyOnly: Boolean(target && !target.isUser) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  getData,
  getVersions,
  getBooks,
  getChapter,
  search,
  searchKeywords,
  parseReference,
  normalizeReferenceQuery,
  normalizeSearchText,
  importBibleFile,
  deleteVersion,
  clearUserBibles,
};
