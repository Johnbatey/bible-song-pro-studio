const fs = require('fs');
const path = require('path');
const { ALL_BOOKS } = require('./scripture-reference.cjs');

// Bundled scripture is public domain and 66-book Protestant canon only — see
// BIBLES.md. Copyrighted translations (NIV, NKJV, NLT, NASB, ESV) are not shipped;
// users import their own licensed copy instead.
const VERSION_META = [
  { id: 'KJV', name: 'King James Version (1769)', abbreviation: 'KJV', language: 'en', file: 'KJV.json', type: 'json' },
  { id: 'ASV', name: 'American Standard Version (1901)', abbreviation: 'ASV', language: 'en', file: 'ASV.json', type: 'json' },
  { id: 'Darby', name: 'Darby Translation (1890)', abbreviation: 'DBY', language: 'en', file: 'Darby.json', type: 'json' },
  { id: 'YLT', name: "Young's Literal Translation (1898)", abbreviation: 'YLT', language: 'en', file: 'YLT.json', type: 'json' },
  { id: 'LSG', name: 'Louis Segond 1910', abbreviation: 'LSG', language: 'fr', file: 'LSG.json', type: 'json' },
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

function loadVersion(meta) {
  const filePath = path.join(getBibleDir(), meta.file);
  if (!fs.existsSync(filePath)) return {};
  if (meta.type === 'xml') return parseKjvXml(fs.readFileSync(filePath, 'utf8'));
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getData() {
  if (cache) return cache;
  const versions = {};
  VERSION_META.forEach((meta) => {
    versions[meta.id] = loadVersion(meta);
  });
  cache = { versions };
  return cache;
}

function normalizeBookName(input, versionId = 'KJV') {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const books = Object.keys(getData().versions[versionId] || getData().versions.KJV || {});
  const rawKey = fold(raw);
  const compactRaw = rawKey.replace(/\s+/g, '');
  const exact = books.find((book) => fold(book) === rawKey);
  if (exact) return exact;
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
  return VERSION_META.map((meta) => {
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
};
