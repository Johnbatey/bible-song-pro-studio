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
  const metaList = [...VERSION_META];
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
            abbreviation: baseId,
            language: 'en',
            file,
            type: file.endsWith('.xml') ? 'xml' : 'json',
            isUser: true,
            userPath: filePath,
          });
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

function importBibleFile({ filePath, overwrite = false }) {
  if (!filePath || !fs.existsSync(filePath)) return { ok: false, error: 'File not found: ' + filePath };
  const ext = path.extname(filePath).toLowerCase();
  let baseId = path.basename(filePath, ext).replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase() || 'CUSTOM';
  let versionName = baseId;
  let booksData = {};
  let localizedBookNames = [];

  try {
    const content = fs.readFileSync(filePath, 'utf8');
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
  } catch (err) {
    return { ok: false, error: 'Failed to parse Bible file: ' + (err.message || String(err)) };
  }

  if (!booksData || typeof booksData !== 'object' || Object.keys(booksData).length === 0) {
    return { ok: false, error: 'No valid books or verses found in Bible file.' };
  }

  const allMeta = getAllVersionMeta();
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
  const payload = {
    id: baseId,
    name: versionName,
    abbreviation: baseId,
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
    return { id: meta.id, name: meta.name, abbreviation: meta.abbreviation, language: meta.language, books };
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
  clearUserBibles,
};
