'use strict';

const fs = require('fs');
const path = require('path');

const CANONICAL_BOOKS = [
  { number: 1, code: 'GEN', name: 'Genesis', aliases: ['gen', 'genesis', 'ge', 'gn'] },
  { number: 2, code: 'EXO', name: 'Exodus', aliases: ['exo', 'exodus', 'ex'] },
  { number: 3, code: 'LEV', name: 'Leviticus', aliases: ['lev', 'leviticus', 'le', 'lv'] },
  { number: 4, code: 'NUM', name: 'Numbers', aliases: ['num', 'numbers', 'nu', 'nm', 'nb'] },
  { number: 5, code: 'DEU', name: 'Deuteronomy', aliases: ['deu', 'deuteronomy', 'dt', 'deut'] },
  { number: 6, code: 'JOS', name: 'Joshua', aliases: ['jos', 'joshua', 'josh', 'js'] },
  { number: 7, code: 'JDG', name: 'Judges', aliases: ['jdg', 'judges', 'judg', 'jg'] },
  { number: 8, code: 'RUT', name: 'Ruth', aliases: ['rut', 'ruth', 'ru', 'rth'] },
  { number: 9, code: '1SA', name: '1 Samuel', aliases: ['1sa', '1 samuel', '1sam', '1s'] },
  { number: 10, code: '2SA', name: '2 Samuel', aliases: ['2sa', '2 samuel', '2sam', '2s'] },
  { number: 11, code: '1KI', name: '1 Kings', aliases: ['1ki', '1 kings', '1kg', '1k'] },
  { number: 12, code: '2KI', name: '2 Kings', aliases: ['2ki', '2 kings', '2kg', '2k'] },
  { number: 13, code: '1CH', name: '1 Chronicles', aliases: ['1ch', '1 chronicles', '1chr', '1chr'] },
  { number: 14, code: '2CH', name: '2 Chronicles', aliases: ['2ch', '2 chronicles', '2chr', '2chr'] },
  { number: 15, code: 'EZR', name: 'Ezra', aliases: ['ezr', 'ezra', 'ez'] },
  { number: 16, code: 'NEH', name: 'Nehemiah', aliases: ['neh', 'nehemiah', 'ne'] },
  { number: 17, code: 'EST', name: 'Esther', aliases: ['est', 'esther', 'es'] },
  { number: 18, code: 'JOB', name: 'Job', aliases: ['job', 'jb'] },
  { number: 19, code: 'PSA', name: 'Psalms', aliases: ['psa', 'psalms', 'psalm', 'ps'] },
  { number: 20, code: 'PRO', name: 'Proverbs', aliases: ['pro', 'proverbs', 'prov', 'pr'] },
  { number: 21, code: 'ECC', name: 'Ecclesiastes', aliases: ['ecc', 'ecclesiastes', 'eccl', 'ec'] },
  { number: 22, code: 'SNG', name: 'Song of Solomon', aliases: ['sng', 'song of solomon', 'song', 'so', 'canticles'] },
  { number: 23, code: 'ISA', name: 'Isaiah', aliases: ['isa', 'isaiah', 'is'] },
  { number: 24, code: 'JER', name: 'Jeremiah', aliases: ['jer', 'jeremiah', 'jr'] },
  { number: 25, code: 'LAM', name: 'Lamentations', aliases: ['lam', 'lamentations', 'la'] },
  { number: 26, code: 'EZK', name: 'Ezekiel', aliases: ['ezk', 'ezekiel', 'eze', 'ezek'] },
  { number: 27, code: 'DAN', name: 'Daniel', aliases: ['dan', 'daniel', 'dn', 'da'] },
  { number: 28, code: 'HOS', name: 'Hosea', aliases: ['hos', 'hosea', 'ho'] },
  { number: 29, code: 'JOL', name: 'Joel', aliases: ['jol', 'joel', 'jl'] },
  { number: 30, code: 'AMO', name: 'Amos', aliases: ['amo', 'amos', 'am'] },
  { number: 31, code: 'OBA', name: 'Obadiah', aliases: ['oba', 'obadiah', 'ob'] },
  { number: 32, code: 'JON', name: 'Jonah', aliases: ['jon', 'jonah', 'jnh'] },
  { number: 33, code: 'MIC', name: 'Micah', aliases: ['mic', 'micah', 'mc'] },
  { number: 34, code: 'NAM', name: 'Nahum', aliases: ['nam', 'nahum', 'na'] },
  { number: 35, code: 'HAB', name: 'Habakkuk', aliases: ['hab', 'habakkuk', 'hb'] },
  { number: 36, code: 'ZEP', name: 'Zephaniah', aliases: ['zep', 'zephaniah', 'zp'] },
  { number: 37, code: 'HAG', name: 'Haggai', aliases: ['hag', 'haggai', 'hg'] },
  { number: 38, code: 'ZEC', name: 'Zechariah', aliases: ['zec', 'zechariah', 'zc'] },
  { number: 39, code: 'MAL', name: 'Malachi', aliases: ['mal', 'malachi', 'ml'] },
  { number: 40, code: 'MAT', name: 'Matthew', aliases: ['mat', 'matthew', 'mt'] },
  { number: 41, code: 'MRK', name: 'Mark', aliases: ['mrk', 'mark', 'mk', 'mar'] },
  { number: 42, code: 'LUK', name: 'Luke', aliases: ['luk', 'luke', 'lk'] },
  { number: 43, code: 'JHN', name: 'John', aliases: ['jhn', 'john', 'jn', 'joh'] },
  { number: 44, code: 'ACT', name: 'Acts', aliases: ['act', 'acts', 'ac'] },
  { number: 45, code: 'ROM', name: 'Romans', aliases: ['rom', 'romans', 'ro', 'rm'] },
  { number: 46, code: '1CO', name: '1 Corinthians', aliases: ['1co', '1 corinthians', '1cor', '1c'] },
  { number: 47, code: '2CO', name: '2 Corinthians', aliases: ['2co', '2 corinthians', '2cor', '2c'] },
  { number: 48, code: 'GAL', name: 'Galatians', aliases: ['gal', 'galatians', 'ga'] },
  { number: 49, code: 'EPH', name: 'Ephesians', aliases: ['eph', 'ephesians', 'ep'] },
  { number: 50, code: 'PHP', name: 'Philippians', aliases: ['php', 'philippians', 'phi', 'pp'] },
  { number: 51, code: 'COL', name: 'Colossians', aliases: ['col', 'colossians', 'cl'] },
  { number: 52, code: '1TH', name: '1 Thessalonians', aliases: ['1th', '1 thessalonians', '1thess', '1t'] },
  { number: 53, code: '2TH', name: '2 Thessalonians', aliases: ['2th', '2 thessalonians', '2thess', '2t'] },
  { number: 54, code: '1TI', name: '1 Timothy', aliases: ['1ti', '1 timothy', '1tim', '1tm'] },
  { number: 55, code: '2TI', name: '2 Timothy', aliases: ['2ti', '2 timothy', '2tim', '2tm'] },
  { number: 56, code: 'TIT', name: 'Titus', aliases: ['tit', 'titus', 'ti'] },
  { number: 57, code: 'PHM', name: 'Philemon', aliases: ['phm', 'philemon', 'phlm', 'pm'] },
  { number: 58, code: 'HEB', name: 'Hebrews', aliases: ['heb', 'hebrews', 'hb'] },
  { number: 59, code: 'JAS', name: 'James', aliases: ['jas', 'james', 'jm'] },
  { number: 60, code: '1PE', name: '1 Peter', aliases: ['1pe', '1 peter', '1pet', '1p'] },
  { number: 61, code: '2PE', name: '2 Peter', aliases: ['2pe', '2 peter', '2pet', '2p'] },
  { number: 62, code: '1JN', name: '1 John', aliases: ['1jn', '1 john', '1j'] },
  { number: 63, code: '2JN', name: '2 John', aliases: ['2jn', '2 john', '2j'] },
  { number: 64, code: '3JN', name: '3 John', aliases: ['3jn', '3 john', '3j'] },
  { number: 65, code: 'JUD', name: 'Jude', aliases: ['jud', 'jude', 'jd'] },
  { number: 66, code: 'REV', name: 'Revelation', aliases: ['rev', 'revelation', 're', 'apocalypse'] },
];

function decodeXmlEntities(val = '') {
  return String(val || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripTags(val = '') {
  return decodeXmlEntities(String(val || ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseXmlAttributes(attrString = '') {
  const attrs = {};
  const regex = /([a-zA-Z0-9_:-]+)=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match = null;
  while ((match = regex.exec(attrString))) {
    const key = match[1].toLowerCase();
    const value = match[2] !== undefined ? match[2] : match[3] !== undefined ? match[3] : match[4];
    attrs[key] = decodeXmlEntities(value);
  }
  return attrs;
}

function matchCanonicalBook(identifier = '') {
  if (!identifier) return null;
  const str = String(identifier).trim();
  const num = parseInt(str, 10);
  if (!isNaN(num) && num >= 1 && num <= 66) {
    return CANONICAL_BOOKS[num - 1];
  }
  const clean = str.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const matchCode = CANONICAL_BOOKS.find((b) => b.code === clean || b.code === clean.slice(0, 3));
  if (matchCode) return matchCode;

  const lower = str.toLowerCase().trim();
  return CANONICAL_BOOKS.find((b) => b.name.toLowerCase() === lower || b.aliases.includes(lower));
}

const { BIBLE_BOOK_TRANSLATIONS } = require('./bible-translations.cjs');

function detectBibleLanguage(text = '', nameHint = '') {
  const hintRaw = `${nameHint || ''} ${typeof text === 'string' ? text.slice(0, 4000) : ''}`.toLowerCase();
  const commonMap = [
    { key: 'yoruba', patterns: ['yoruba', 'bibeli mimo', 'yor'] },
    { key: 'french', patterns: ['french', 'français', 'francais', ' segond', ' ostervald', 'lsg'] },
    { key: 'spanish', patterns: ['spanish', 'español', 'espanol', ' reina', ' valera', 'rvr'] },
    { key: 'chinese', patterns: ['chinese', '中文', '汉语', '繁體', '和合本'] },
    { key: 'german', patterns: ['german', 'deutsch', 'luther'] },
    { key: 'portuguese', patterns: ['portuguese', 'português', 'almeida'] },
    { key: 'tagalog', patterns: ['tagalog', 'filipino', 'ang biblia'] },
    { key: 'russian', patterns: ['russian', 'русский', 'синодальный'] },
    { key: 'swahili', patterns: ['swahili', 'kiswahili', 'biblia takatifu'] },
    { key: 'amharic', patterns: ['amharic', 'አማርኛ'] },
    { key: 'arabic', patterns: ['arabic', 'العربية'] },
    { key: 'hindi', patterns: ['hindi', 'हिंदी'] },
    { key: 'igbo', patterns: ['igbo'] },
    { key: 'hausa', patterns: ['hausa'] },
    { key: 'zulu', patterns: ['zulu', 'ibhayibheli'] },
  ];
  for (const entry of commonMap) {
    if (entry.patterns.some((p) => hintRaw.includes(p))) return entry.key;
  }
  for (const langKey of Object.keys(BIBLE_BOOK_TRANSLATIONS)) {
    if (langKey.length > 3 && hintRaw.includes(langKey.toLowerCase())) return langKey;
  }
  return null;
}

const LANG_ALIASES = {
  french: 'fr',
  français: 'fr',
  francais: 'fr',
  hindi: 'hi',
};

function resolveLocalizedBookName(extractedName, bNumber, detectedLang) {
  const bKey = String(bNumber);
  const targetKey = detectedLang ? (LANG_ALIASES[detectedLang.toLowerCase()] || detectedLang) : null;
  const translationMap = targetKey ? (BIBLE_BOOK_TRANSLATIONS[targetKey] || BIBLE_BOOK_TRANSLATIONS[targetKey.toLowerCase()]) : null;

  if (translationMap && translationMap[bKey]) {
    return translationMap[bKey];
  }

  let clean = stripTags(extractedName || '').trim();
  if (clean && !/^\d+$/.test(clean) && !clean.toLowerCase().startsWith('book ')) {
    return clean;
  }

  const canonical = CANONICAL_BOOKS[bNumber - 1];
  return canonical ? canonical.name : `Book ${bNumber}`;
}

function parseXmlBible(xmlText, fallbackId) {
  const bibleData = {};
  const localizedBookNames = [];

  const bibleTagMatch = xmlText.match(/<bible\b([^>]*)>/i) || xmlText.match(/<xmlbible\b([^>]*)>/i);
  const sysAttrs = bibleTagMatch ? parseXmlAttributes(bibleTagMatch[1] || '') : {};
  const titleTagMatch = xmlText.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const name = sysAttrs.translation || sysAttrs.biblename || sysAttrs.title || sysAttrs.name || (titleTagMatch ? stripTags(titleTagMatch[1]) : fallbackId);
  const detectedLang = detectBibleLanguage(xmlText, name);

  const bookRegex = /<(BIBLEBOOK|book|b|div)\b([^>]*)>([\s\S]*?)<\/(?:BIBLEBOOK|book|b|div)>/gi;
  let bookMatch = null;
  let bookIndex = 1;

  while ((bookMatch = bookRegex.exec(xmlText))) {
    const tagName = bookMatch[1].toLowerCase();
    const attrString = bookMatch[2] || '';
    const bookXml = bookMatch[3] || '';

    if (tagName === 'div' && !attrString.toLowerCase().includes('type="book"') && !attrString.toLowerCase().includes('osisid')) {
      continue;
    }

    const attrs = parseXmlAttributes(attrString);
    const bNumber = parseInt(attrs.bnumber || attrs.number || attrs.n || attrs.bno || String(bookIndex), 10);
    const rawIdentifier = attrs.bname || attrs.name || attrs.n || attrs.osisid || attrs.id || '';
    const canonical = CANONICAL_BOOKS[bNumber - 1] || matchCanonicalBook(rawIdentifier) || CANONICAL_BOOKS[bookIndex - 1] || { name: `Book ${bNumber}`, code: `B${bNumber}` };

    const localizedName = resolveLocalizedBookName(rawIdentifier, canonical.number || bNumber, detectedLang);
    localizedBookNames.push({ number: canonical.number || bNumber, code: canonical.code || `B${bNumber}`, name: localizedName });

    if (!bibleData[localizedName]) bibleData[localizedName] = {};

    const chapterRegex = /<(CHAPTER|chapter|c)\b([^>]*)>([\s\S]*?)<\/(?:CHAPTER|chapter|c)>/gi;
    let chapterMatch = null;
    let chIndex = 1;

    while ((chapterMatch = chapterRegex.exec(bookXml))) {
      const chAttrs = parseXmlAttributes(chapterMatch[2] || '');
      const chXml = chapterMatch[3] || '';
      const cRaw = chAttrs.cnumber || chAttrs.number || chAttrs.n || chAttrs.osisid || String(chIndex);
      const cNum = String(cRaw).split('.').pop() || String(chIndex);

      if (!bibleData[localizedName][cNum]) bibleData[localizedName][cNum] = {};

      const verseRegex = /<(VERS|verse|v)\b([^>]*)>([\s\S]*?)(?:<\/(?:VERS|verse|v)>|(?=<(?:VERS|verse|v)\b))/gi;
      let verseMatch = null;
      let vIndex = 1;

      while ((verseMatch = verseRegex.exec(chXml))) {
        const vAttrs = parseXmlAttributes(verseMatch[2] || '');
        const vRaw = vAttrs.vnumber || vAttrs.number || vAttrs.n || vAttrs.osisid || String(vIndex);
        const vNum = String(vRaw).split('.').pop() || String(vIndex);
        const vText = stripTags(verseMatch[3] || '');
        if (vText) bibleData[localizedName][cNum][vNum] = vText;
        vIndex++;
      }
      chIndex++;
    }
    bookIndex++;
  }

  return { name, bibleData, localizedBookNames };
}

function parseZefaniaXml(xmlText, fallbackId) {
  return parseXmlBible(xmlText, fallbackId);
}

function parseOsisXml(xmlText, fallbackId) {
  const bibleData = {};
  const localizedBookNames = [];

  const titleMatch = xmlText.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const name = titleMatch ? stripTags(titleMatch[1]) : fallbackId;
  const detectedLang = detectBibleLanguage(xmlText, name);

  const bookRegex = /<div\b([^>]*\btype="book"[^>]*)>([\s\S]*?)<\/div>/gi;
  let bookMatch = null;
  let bookIndex = 1;

  while ((bookMatch = bookRegex.exec(xmlText))) {
    const attrs = parseXmlAttributes(bookMatch[1] || '');
    const bookXml = bookMatch[2] || '';
    const osisId = attrs.osisid || attrs.id || '';
    const canonical = matchCanonicalBook(osisId) || CANONICAL_BOOKS[bookIndex - 1] || { name: `Book ${bookIndex}`, code: `B${bookIndex}` };

    const titleInnerMatch = bookXml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const rawTitle = titleInnerMatch ? stripTags(titleInnerMatch[1]) : canonical.name;
    const localizedName = resolveLocalizedBookName(rawTitle, canonical.number || bookIndex, detectedLang);

    localizedBookNames.push({ number: canonical.number || bookIndex, code: canonical.code || `B${bookIndex}`, name: localizedName });
    if (!bibleData[localizedName]) bibleData[localizedName] = {};

    const chapterRegex = /<chapter\b([^>]*)>([\s\S]*?)(?:<\/chapter>|(?=<chapter\b))/gi;
    let chapterMatch = null;
    while ((chapterMatch = chapterRegex.exec(bookXml))) {
      const chAttrs = parseXmlAttributes(chapterMatch[1] || '');
      const chXml = chapterMatch[2] || '';
      const osisRef = chAttrs.osisid || chAttrs.n || '1';
      const cNum = osisRef.split('.').pop() || '1';

      if (!bibleData[localizedName][cNum]) bibleData[localizedName][cNum] = {};

      const verseRegex = /<verse\b([^>]*)>([\s\S]*?)(?:<\/verse>|(?=<verse\b))/gi;
      let verseMatch = null;
      while ((verseMatch = verseRegex.exec(chXml))) {
        const vAttrs = parseXmlAttributes(verseMatch[1] || '');
        const osisVRef = vAttrs.osisid || vAttrs.n || '1';
        const vNum = osisVRef.split('.').pop() || '1';
        const vText = stripTags(verseMatch[2] || '');
        if (vText) bibleData[localizedName][cNum][vNum] = vText;
      }
    }
    bookIndex++;
  }

  return { name, bibleData, localizedBookNames };
}

function parseOpenSongXml(xmlText, fallbackId) {
  const bibleData = {};
  const localizedBookNames = [];

  const name = fallbackId;
  const detectedLang = detectBibleLanguage(xmlText, fallbackId);
  const bookRegex = /<b\b([^>]*)>([\s\S]*?)<\/b>/gi;
  let bookMatch = null;
  let bookIndex = 1;

  while ((bookMatch = bookRegex.exec(xmlText))) {
    const attrs = parseXmlAttributes(bookMatch[1] || '');
    const bookXml = bookMatch[2] || '';
    const rawName = attrs.n || attrs.name || `Book ${bookIndex}`;
    const canonical = matchCanonicalBook(rawName) || CANONICAL_BOOKS[bookIndex - 1] || { name: rawName, code: `B${bookIndex}` };

    const localizedName = resolveLocalizedBookName(rawName, canonical.number || bookIndex, detectedLang);
    localizedBookNames.push({ number: canonical.number || bookIndex, code: canonical.code || `B${bookIndex}`, name: localizedName });

    if (!bibleData[localizedName]) bibleData[localizedName] = {};

    const chapterRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
    let chapterMatch = null;
    while ((chapterMatch = chapterRegex.exec(bookXml))) {
      const chAttrs = parseXmlAttributes(chapterMatch[1] || '');
      const chXml = chapterMatch[2] || '';
      const cNum = String(chAttrs.n || chAttrs.number || '1');
      if (!bibleData[localizedName][cNum]) bibleData[localizedName][cNum] = {};

      const verseRegex = /<v\b([^>]*)>([\s\S]*?)<\/v>/gi;
      let verseMatch = null;
      while ((verseMatch = verseRegex.exec(chXml))) {
        const vAttrs = parseXmlAttributes(verseMatch[1] || '');
        const vNum = String(vAttrs.n || vAttrs.number || '1');
        const vText = stripTags(verseMatch[2] || '');
        if (vText) bibleData[localizedName][cNum][vNum] = vText;
      }
    }
    bookIndex++;
  }

  return { name, bibleData, localizedBookNames };
}

function parseUsfmText(usfmText, fallbackId) {
  const bibleData = {};
  const localizedBookNames = [];
  const detectedLang = detectBibleLanguage(usfmText, fallbackId);

  const lines = usfmText.split(/\r?\n/);
  let currentBookName = '';
  let currentBookCanonical = null;
  let currentChapter = '1';
  let currentVerse = '1';
  let bookIndex = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('\\id ')) {
      const code = line.split(/\s+/)[1]?.toUpperCase();
      currentBookCanonical = matchCanonicalBook(code) || CANONICAL_BOOKS[bookIndex - 1] || { name: code, code };
      currentBookName = resolveLocalizedBookName(currentBookCanonical.name, currentBookCanonical.number || bookIndex, detectedLang);
    } else if (line.startsWith('\\h ') || line.startsWith('\\toc2 ')) {
      const hTitle = line.replace(/^\\[a-z0-9]+\s+/, '').trim();
      if (hTitle) currentBookName = resolveLocalizedBookName(hTitle, currentBookCanonical?.number || bookIndex, detectedLang);
    } else if (line.startsWith('\\c ')) {
      currentChapter = line.split(/\s+/)[1] || '1';
      if (currentBookName) {
        if (!localizedBookNames.some((b) => b.name === currentBookName)) {
          localizedBookNames.push({
            number: currentBookCanonical?.number || bookIndex,
            code: currentBookCanonical?.code || `B${bookIndex}`,
            name: currentBookName,
          });
          bookIndex++;
        }
        if (!bibleData[currentBookName]) bibleData[currentBookName] = {};
        if (!bibleData[currentBookName][currentChapter]) bibleData[currentBookName][currentChapter] = {};
      }
    } else if (line.startsWith('\\v ')) {
      const parts = line.replace('\\v ', '').split(/\s+/);
      currentVerse = parts[0];
      const text = stripTags(parts.slice(1).join(' '));
      if (currentBookName && currentChapter && text) {
        if (!bibleData[currentBookName]) bibleData[currentBookName] = {};
        if (!bibleData[currentBookName][currentChapter]) bibleData[currentBookName][currentChapter] = {};
        bibleData[currentBookName][currentChapter][currentVerse] = text;
      }
    }
  }

  return { name: fallbackId, bibleData, localizedBookNames };
}

function parseJsonBible(jsonObj, fallbackId) {
  const bibleData = {};
  const localizedBookNames = [];
  let bookIndex = 1;
  const detectedLang = detectBibleLanguage(JSON.stringify(jsonObj), fallbackId);

  const root = jsonObj.books || jsonObj.versions?.[fallbackId] || jsonObj.bible || jsonObj;

  if (typeof root === 'object' && !Array.isArray(root)) {
    Object.keys(root).forEach((bName) => {
      const canonical = matchCanonicalBook(bName) || CANONICAL_BOOKS[bookIndex - 1] || { name: bName, code: `B${bookIndex}` };
      const localizedName = resolveLocalizedBookName(bName, canonical.number || bookIndex, detectedLang);
      localizedBookNames.push({ number: canonical.number || bookIndex, code: canonical.code || `B${bookIndex}`, name: localizedName });

      bibleData[localizedName] = {};
      const chaptersObj = root[bName];
      if (typeof chaptersObj === 'object') {
        Object.keys(chaptersObj).forEach((cNum) => {
          bibleData[localizedName][cNum] = {};
          const versesObj = chaptersObj[cNum];
          if (typeof versesObj === 'object') {
            Object.keys(versesObj).forEach((vNum) => {
              bibleData[localizedName][cNum][vNum] = stripTags(String(versesObj[vNum] || ''));
            });
          }
        });
      }
      bookIndex++;
    });
  }

  return { name: fallbackId, bibleData, localizedBookNames };
}

module.exports = {
  CANONICAL_BOOKS,
  matchCanonicalBook,
  detectBibleLanguage,
  resolveLocalizedBookName,
  parseXmlBible,
  parseZefaniaXml,
  parseOsisXml,
  parseOpenSongXml,
  parseUsfmText,
  parseJsonBible,
};
