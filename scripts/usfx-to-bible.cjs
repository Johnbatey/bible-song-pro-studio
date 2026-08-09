'use strict';

// Converts a USFX bible (the format eBible.org publishes) into the simple
// Zefania-style XML that bibles/source/ holds and the panel's parseBible() reads.
//
//   node scripts/usfx-to-zefania.js <input_usfx.xml> --code ASV [--out bibles/source/ASV.xml]
//
// Why this exists: eBible.org is the practical source for public-domain scripture
// and publishes USFX, which is milestone-based (<v id="1"/> markers with the text
// as following siblings) rather than nested. It also carries Strong's tags,
// footnotes, cross-references and section headings that must not end up on a
// projection screen mid-service.
//
// Canon is checked here on the USFX book *code* (GEN, EXO, ...), which is
// language-independent, so a French or Yoruba bible is validated as strictly as
// an English one. build-bibles.js then re-checks the output by book name. Two
// independent gates, deliberately.

const fs = require('fs');
const path = require('path');

// The 66, in canonical order, with the USFX code each one uses.
const CANON_CODES = [
  ['GEN', 'Genesis'], ['EXO', 'Exodus'], ['LEV', 'Leviticus'], ['NUM', 'Numbers'],
  ['DEU', 'Deuteronomy'], ['JOS', 'Joshua'], ['JDG', 'Judges'], ['RUT', 'Ruth'],
  ['1SA', '1 Samuel'], ['2SA', '2 Samuel'], ['1KI', '1 Kings'], ['2KI', '2 Kings'],
  ['1CH', '1 Chronicles'], ['2CH', '2 Chronicles'], ['EZR', 'Ezra'], ['NEH', 'Nehemiah'],
  ['EST', 'Esther'], ['JOB', 'Job'], ['PSA', 'Psalms'], ['PRO', 'Proverbs'],
  ['ECC', 'Ecclesiastes'], ['SNG', 'Song of Solomon'], ['ISA', 'Isaiah'], ['JER', 'Jeremiah'],
  ['LAM', 'Lamentations'], ['EZK', 'Ezekiel'], ['DAN', 'Daniel'], ['HOS', 'Hosea'],
  ['JOL', 'Joel'], ['AMO', 'Amos'], ['OBA', 'Obadiah'], ['JON', 'Jonah'],
  ['MIC', 'Micah'], ['NAM', 'Nahum'], ['HAB', 'Habakkuk'], ['ZEP', 'Zephaniah'],
  ['HAG', 'Haggai'], ['ZEC', 'Zechariah'], ['MAL', 'Malachi'],
  ['MAT', 'Matthew'], ['MRK', 'Mark'], ['LUK', 'Luke'], ['JHN', 'John'],
  ['ACT', 'Acts'], ['ROM', 'Romans'], ['1CO', '1 Corinthians'], ['2CO', '2 Corinthians'],
  ['GAL', 'Galatians'], ['EPH', 'Ephesians'], ['PHP', 'Philippians'], ['COL', 'Colossians'],
  ['1TH', '1 Thessalonians'], ['2TH', '2 Thessalonians'], ['1TI', '1 Timothy'], ['2TI', '2 Timothy'],
  ['TIT', 'Titus'], ['PHM', 'Philemon'], ['HEB', 'Hebrews'], ['JAS', 'James'],
  ['1PE', '1 Peter'], ['2PE', '2 Peter'], ['1JN', '1 John'], ['2JN', '2 John'],
  ['3JN', '3 John'], ['JUD', 'Jude'], ['REV', 'Revelation']
];

// Known typos in upstream <h> values. Faithful to the text, not to the misspelling.
const NAME_CORRECTIONS = { 'Thimothée': 'Timothée' };

// Elements whose *content* is not scripture and must not reach the screen.
const DROP_WITH_CONTENT = ['f', 'x', 'fig', 'rem', 'note', 's', 'd', 'toc', 'h', 'id', 'ide', 'cl'];

function stripElements(xml, tagNames) {
  let out = xml;
  for (const tag of tagNames) {
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), ' ');
    out = out.replace(new RegExp(`<${tag}\\b[^>]*\\/>`, 'gi'), ' ');
  }
  return out;
}

function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Turn a verse fragment into clean projection text.
function cleanVerseText(fragment) {
  let text = stripElements(fragment, DROP_WITH_CONTENT);
  text = text.replace(/<[^>]*>/g, ' ');   // unwrap everything else, keeping inner text
  text = decodeEntities(text);
  text = text.replace(/\s+/g, ' ').trim();
  text = text.replace(/\s+([,.;:!?])/g, '$1');   // markup removal can strand punctuation

  // Elided articles arrive as separate inline elements, so collapsing whitespace
  // leaves "qu ’ il" where French wants "qu’il". Same for English "God’s".
  text = text.replace(/(\p{L})\s*([’'’])\s*(\p{L})/gu, '$1$2$3');

  // Opening quotes and brackets should hug the word that follows.
  text = text.replace(/([«“(\[])\s+/g, '$1').replace(/\s+([»”)\]])/g, '$1');
  return text;
}

// Upstream <h> values are ALL CAPS; the panel shows them as-is, so title-case them.
// Articles and prepositions stay lowercase unless they lead — "Cantique des Cantiques",
// not "Cantique Des Cantiques".
const MINOR_WORDS = new Set([
  'de', 'des', 'du', 'la', 'le', 'les', 'et', 'a', 'au', 'aux', 'of', 'the', 'to', 'and'
]);

function titleCase(name) {
  const words = String(name).toLocaleLowerCase('fr').split(/(\s+)/);
  let wordIndex = 0;
  return words.map(part => {
    if (/^\s+$/.test(part) || !part) return part;
    const isFirst = wordIndex === 0;
    wordIndex += 1;
    const plain = part.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!isFirst && MINOR_WORDS.has(plain)) return part;
    return part.replace(/(^|[’'\-])(\p{L})/gu, (_, sep, ch) => sep + ch.toLocaleUpperCase('fr'));
  }).join('');
}

function parseUsfx(xmlText) {
  const books = new Map();
  const bookRe = /<book\b[^>]*\bid="([A-Z0-9]{3})"[^>]*>([\s\S]*?)<\/book>/g;

  for (const match of xmlText.matchAll(bookRe)) {
    const code = match[1];
    const body = match[2];

    const headingMatch = body.match(/<h\b[^>]*>([\s\S]*?)<\/h>/);
    const rawName = headingMatch ? decodeEntities(headingMatch[1]).trim() : '';

    // Everything before the first chapter marker is front matter.
    const firstChapter = body.search(/<c\b[^>]*\bid="/);
    if (firstChapter === -1) continue;

    const chapters = [];
    const chapterRe = /<c\b[^>]*\bid="([^"]+)"[^>]*\/?>/g;
    const markers = [...body.matchAll(chapterRe)];

    for (let i = 0; i < markers.length; i += 1) {
      const start = markers[i].index + markers[i][0].length;
      const end = i + 1 < markers.length ? markers[i + 1].index : body.length;
      const chapterBody = body.slice(start, end);

      const verses = [];
      const verseRe = /<v\b[^>]*\bid="([^"]+)"[^>]*\/?>/g;
      const vMarkers = [...chapterBody.matchAll(verseRe)];

      for (let j = 0; j < vMarkers.length; j += 1) {
        const vStart = vMarkers[j].index + vMarkers[j][0].length;
        const vEnd = j + 1 < vMarkers.length ? vMarkers[j + 1].index : chapterBody.length;
        let fragment = chapterBody.slice(vStart, vEnd);

        // <ve /> closes a verse; anything after it is paragraph scaffolding.
        const verseEnd = fragment.search(/<ve\b[^>]*\/?>/);
        if (verseEnd !== -1) fragment = fragment.slice(0, verseEnd);

        const text = cleanVerseText(fragment);
        if (text) verses.push({ n: vMarkers[j][1], text });
      }

      if (verses.length) chapters.push({ n: markers[i][1], verses });
    }

    if (chapters.length) books.set(code, { code, name: rawName, chapters });
  }

  return books;
}

function assertCanonByCode(books, label) {
  const present = new Set(books.keys());
  const missing = CANON_CODES.filter(([code]) => !present.has(code)).map(([, name]) => name);
  const extra = [...present].filter(code => !CANON_CODES.some(([c]) => c === code));

  const errors = [];
  if (missing.length) errors.push(`missing ${missing.length} book(s): ${missing.join(', ')}`);
  if (extra.length) {
    errors.push(`non-canonical book(s) present: ${extra.join(', ')}` +
      ' — Bible Song Pro bundles the 66-book Protestant canon only');
  }
  if (errors.length) {
    throw new Error(`Canon check failed for ${label}:\n` + errors.map(e => `  - ${e}`).join('\n'));
  }
}

function toZefania(books) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<bible>'];

  for (const [code, fallbackName] of CANON_CODES) {
    const book = books.get(code);
    let name = book.name ? titleCase(book.name) : fallbackName;
    for (const [wrong, right] of Object.entries(NAME_CORRECTIONS)) {
      name = name.replace(wrong, right);
    }

    lines.push(`<b n="${escapeXml(name)}">`);
    for (const chapter of book.chapters) {
      lines.push(`<c n="${escapeXml(chapter.n)}">`);
      for (const verse of chapter.verses) {
        lines.push(`<v n="${escapeXml(verse.n)}">${escapeXml(verse.text)}</v>`);
      }
      lines.push('</c>');
    }
    lines.push('</b>');
  }

  lines.push('</bible>', '');
  return lines.join('\n');
}

// The desktop app stores bibles as { "Genesis": { "1": { "1": "text" } } } rather
// than XML, so the same parse can serve both surfaces.
function toNestedJson(books) {
  const out = {};
  for (const [code, fallbackName] of CANON_CODES) {
    const book = books.get(code);
    let name = book.name ? titleCase(book.name) : fallbackName;
    for (const [wrong, right] of Object.entries(NAME_CORRECTIONS)) {
      name = name.replace(wrong, right);
    }
    const chapters = {};
    for (const chapter of book.chapters) {
      const verses = {};
      for (const verse of chapter.verses) verses[verse.n] = verse.text;
      chapters[chapter.n] = verses;
    }
    out[name] = chapters;
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const input = args.find(a => !a.startsWith('--'));
  const codeIndex = args.indexOf('--code');
  const outIndex = args.indexOf('--out');
  const formatIndex = args.indexOf('--format');
  const format = formatIndex !== -1 ? args[formatIndex + 1] : 'zefania';

  if (!input || codeIndex === -1) {
    console.error('usage: node scripts/usfx-to-zefania.js <input_usfx.xml> --code ASV ' +
      '[--out path] [--format zefania|json]');
    process.exit(1);
  }

  const code = args[codeIndex + 1];
  const defaultExt = format === "json" ? "json" : "xml";
  const outPath = outIndex !== -1
    ? path.resolve(args[outIndex + 1])
    : path.join(__dirname, "..", "assets", "bibles", `${code}.${defaultExt}`);

  const xmlText = fs.readFileSync(path.resolve(input), 'utf8');
  const books = parseUsfx(xmlText);
  assertCanonByCode(books, path.basename(input));

  const output = format === 'json'
    ? JSON.stringify(toNestedJson(books), null, 2)
    : toZefania(books);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, output, 'utf8');

  const verseCount = [...books.values()]
    .reduce((sum, b) => sum + b.chapters.reduce((s, c) => s + c.verses.length, 0), 0);
  const mb = (Buffer.byteLength(output, 'utf8') / (1024 * 1024)).toFixed(1);
  console.log(`${code}: 66 books, ${verseCount} verses -> ${path.relative(process.cwd(), outPath)} (${mb} MB)`);
}

if (require.main === module) main();

module.exports = { parseUsfx, toZefania, assertCanonByCode, cleanVerseText, CANON_CODES };
