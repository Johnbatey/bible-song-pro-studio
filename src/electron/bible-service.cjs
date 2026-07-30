const fs = require('fs');
const path = require('path');

const VERSION_META = [
  { id: 'KJV', name: 'King James Version (1769)', abbreviation: 'KJV', language: 'en', file: 'KJV.json', type: 'json' },
  { id: 'NKJV', name: 'New King James Version', abbreviation: 'NKJV', language: 'en', file: 'NKJV_bible.json', type: 'json' },
  { id: 'NASB', name: 'New American Standard Bible', abbreviation: 'NASB', language: 'en', file: 'NASB_bible.json', type: 'json' },
  { id: 'NLT', name: 'New Living Translation', abbreviation: 'NLT', language: 'en', file: 'NLT_bible.json', type: 'json' },
];

const BOOK_ALIASES = new Map([
  ['psalm', 'Psalms'],
  ['psalms', 'Psalms'],
  ['song of songs', 'Song of Solomon'],
  ['songs', 'Song of Solomon'],
  ['revelations', 'Revelation'],
]);

let cache = null;

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
  const exact = books.find((book) => book.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  const aliased = BOOK_ALIASES.get(raw.toLowerCase());
  if (aliased) {
    const aliasExact = books.find((book) => book.toLowerCase() === aliased.toLowerCase());
    if (aliasExact) return aliasExact;
  }
  return books.find((book) => book.toLowerCase() === raw.toLowerCase())
    || books.find((book) => book.toLowerCase().startsWith(raw.toLowerCase()))
    || books.find((book) => raw.toLowerCase().startsWith(book.toLowerCase()))
    || raw;
}

function parseReference(query, versionId = 'KJV') {
  const raw = String(query || '').replace(/\s+/g, ' ').trim();
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

function search(versionId = 'KJV', query = '', limit = 30) {
  const bible = getData().versions[versionId] || getData().versions.KJV || {};
  const ref = parseReference(query, versionId);
  if (ref && bible[ref.book]?.[String(ref.chapter)]) {
    return getChapter(versionId, ref.book, ref.chapter)
      .filter((v) => v.verse >= ref.verseStart && v.verse <= ref.verseEnd)
      .slice(0, limit);
  }

  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return [];
  const results = [];
  for (const [book, chapters] of Object.entries(bible)) {
    for (const [chapter, verses] of Object.entries(chapters || {})) {
      for (const [verse, text] of Object.entries(verses || {})) {
        if (String(text).toLowerCase().includes(needle)) {
          results.push({
            book,
            chapter: Number(chapter),
            verse: Number(verse),
            text,
            version: versionId,
            reference: `${book} ${chapter}:${verse}`,
          });
          if (results.length >= limit) return results;
        }
      }
    }
  }
  return results;
}

module.exports = {
  getData,
  getVersions,
  getBooks,
  getChapter,
  search,
};
