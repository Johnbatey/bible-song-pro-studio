'use strict';

// Protestant 66-book canon guard.
//
// Bible Song Pro ships the 66-book Protestant canon only. Editions carrying the
// Apocrypha / Deuterocanon are not bundled, in any language. That is a product
// decision, and it is enforced here at build time rather than by remembering to
// check — a source file dropped into bibles/source/ a year from now gets the same
// scrutiny as the ones that are there today.
//
// Deliberately format-agnostic: callers extract book names however their format
// stores them (Zefania <b n="...">, JSON keys, USFM ids) and hand over a plain
// array. The plugin and the desktop app can then share one guard.

// Each row is one canonical book: the English name first, then every spelling we
// accept for it. French is included because Louis Segond ships in the bundle — a
// guard that only speaks English would reject a perfectly canonical French bible.
// Diacritics are folded during comparison, so accents here are for readability.
const CANON = [
  // Old Testament — 39
  ['Genesis', 'Genèse'], ['Exodus', 'Exode'], ['Leviticus', 'Lévitique'],
  ['Numbers', 'Nombres'], ['Deuteronomy', 'Deutéronome'],
  ['Joshua', 'Josué'], ['Judges', 'Juges'], ['Ruth'],
  ['1 Samuel'], ['2 Samuel'],
  ['1 Kings', '1 Rois'], ['2 Kings', '2 Rois'],
  ['1 Chronicles', '1 Chroniques'], ['2 Chronicles', '2 Chroniques'],
  ['Ezra', 'Esdras'], ['Nehemiah', 'Néhémie'], ['Esther'], ['Job'],
  ['Psalms', 'Psalm', 'Psalter', 'Psaumes'],
  ['Proverbs', 'Proverbes'],
  ['Ecclesiastes', 'Qoheleth', 'Preacher', 'Ecclésiaste'],
  ['Song of Solomon', 'Song of Songs', 'Canticles', 'Song', 'Cantique des Cantiques'],
  ['Isaiah', 'Ésaïe'], ['Jeremiah', 'Jérémie'], ['Lamentations'],
  ['Ezekiel', 'Ézéchiel'], ['Daniel'],
  ['Hosea', 'Osée'], ['Joel', 'Joël'], ['Amos'], ['Obadiah', 'Abdias'],
  ['Jonah', 'Jonas'], ['Micah', 'Michée'], ['Nahum'], ['Habakkuk', 'Habacuc'],
  ['Zephaniah', 'Sophonie'], ['Haggai', 'Aggée'], ['Zechariah', 'Zacharie'],
  ['Malachi', 'Malachie'],

  // New Testament — 27
  ['Matthew', 'Matthieu'], ['Mark', 'Marc'], ['Luke', 'Luc'], ['John', 'Jean'],
  ['Acts', 'Acts of the Apostles', 'Actes'],
  ['Romans', 'Romains'],
  ['1 Corinthians', '1 Corinthiens'], ['2 Corinthians', '2 Corinthiens'],
  ['Galatians', 'Galates'], ['Ephesians', 'Éphésiens'],
  ['Philippians', 'Philippiens'], ['Colossians', 'Colossiens'],
  ['1 Thessalonians', '1 Thessaloniciens'], ['2 Thessalonians', '2 Thessaloniciens'],
  // "Thimothée" is a typo in some upstream data; accepted so a source typo cannot
  // fail a build, while usfx-to-zefania.js corrects it for display.
  ['1 Timothy', '1 Timothée', '1 Thimothée'], ['2 Timothy', '2 Timothée', '2 Thimothée'],
  ['Titus', 'Tite'], ['Philemon', 'Philémon'], ['Hebrews', 'Hébreux'],
  ['James', 'Jacques'],
  ['1 Peter', '1 Pierre'], ['2 Peter', '2 Pierre'],
  ['1 John', '1 Jean'], ['2 John', '2 Jean'], ['3 John', '3 Jean'],
  ['Jude'],
  ['Revelation', 'Revelation of John', 'Revelation of Jesus Christ', 'Apocalypse']
];

// Anything here fails the build outright, whatever else the file contains.
const APOCRYPHA = [
  'Tobit', 'Tobias', 'Judith',
  'Wisdom', 'Wisdom of Solomon', 'Book of Wisdom',
  'Sirach', 'Ecclesiasticus',
  'Baruch', 'Letter of Jeremiah', 'Epistle of Jeremiah',
  '1 Maccabees', '2 Maccabees', '3 Maccabees', '4 Maccabees',
  '1 Esdras', '2 Esdras', '3 Esdras', '4 Esdras',
  'Prayer of Manasseh', 'Prayer of Manasses', 'Manasseh', 'Manasses',
  'Susanna', 'Bel and the Dragon', 'Bel', 'Dragon',
  'Additions to Esther', 'Rest of Esther', 'Greek Esther',
  'Additions to Daniel', 'Prayer of Azariah',
  'Song of the Three Children', 'Song of the Three Young Men', 'Song of the Three Holy Children',
  'Psalm 151', 'Psalms of Solomon',
  'Laodiceans', 'Epistle to the Laodiceans',
  'Jubilees', 'Enoch', '1 Enoch', '2 Enoch'
];

const ORDINALS = {
  i: '1', ii: '2', iii: '3', iv: '4',
  first: '1', second: '2', third: '3', fourth: '4',
  '1st': '1', '2nd': '2', '3rd': '3', '4th': '4',
  premier: '1', deuxieme: '2', troisieme: '3'
};

// Collapses spelling, punctuation and numbering differences so that
// "I Samuel", "1. Samuel" and "First Samuel" all land on "1samuel".
function normalise(raw) {
  let s = String(raw == null ? '' : raw).toLowerCase().trim();
  // Fold diacritics so "Genèse", "Ésaïe" and "Ézéchiel" compare as plain letters.
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/^(the|le|la|les)\s+/, '');
  s = s.replace(/[’'`]/g, '');          // Young's -> youngs
  s = s.replace(/[^a-z0-9]+/g, ' ').trim();  // any other punctuation -> space
  const parts = s.split(' ').filter(Boolean);
  if (parts.length > 1 && Object.prototype.hasOwnProperty.call(ORDINALS, parts[0])) {
    parts[0] = ORDINALS[parts[0]];
  }
  return parts.join('');
}

const CANON_LOOKUP = new Map();
CANON.forEach((names, index) => {
  for (const name of names) CANON_LOOKUP.set(normalise(name), index);
});

const APOCRYPHA_LOOKUP = new Set(APOCRYPHA.map(normalise));

/**
 * Check a list of book names against the Protestant canon.
 * Returns { ok, errors[] } — never throws, so callers choose how to fail.
 */
function checkProtestantCanon(bookNames) {
  const errors = [];
  const names = Array.isArray(bookNames) ? bookNames : [];
  const seen = new Map();
  const unknown = [];
  const apocryphal = [];

  for (const raw of names) {
    const key = normalise(raw);
    if (APOCRYPHA_LOOKUP.has(key)) {
      apocryphal.push(raw);
      continue;
    }
    if (!CANON_LOOKUP.has(key)) {
      unknown.push(raw);
      continue;
    }
    const index = CANON_LOOKUP.get(key);
    seen.set(index, (seen.get(index) || 0) + 1);
  }

  if (apocryphal.length) {
    errors.push(`contains Apocrypha / Deuterocanon: ${apocryphal.join(', ')}`);
  }
  if (unknown.length) {
    errors.push(`unrecognised book name(s): ${unknown.join(', ')}` +
      ' — if this is a legitimate spelling, add it to CANON in scripts/bible-canon.js');
  }

  const missing = [];
  const duplicated = [];
  CANON.forEach((names_, index) => {
    const count = seen.get(index) || 0;
    if (count === 0) missing.push(names_[0]);
    else if (count > 1) duplicated.push(`${names_[0]} (x${count})`);
  });

  if (missing.length) errors.push(`missing ${missing.length} book(s): ${missing.join(', ')}`);
  if (duplicated.length) errors.push(`duplicate book(s): ${duplicated.join(', ')}`);

  if (names.length !== 66 && !errors.length) {
    errors.push(`expected exactly 66 books, found ${names.length}`);
  }

  return { ok: errors.length === 0, errors, bookCount: names.length };
}

/** Same check, but throws with a build-stopping message. */
function assertProtestantCanon(bookNames, label) {
  const result = checkProtestantCanon(bookNames);
  if (result.ok) return result;
  const where = label ? ` in ${label}` : '';
  throw new Error(
    `Canon check failed${where} (${result.bookCount} books found):\n` +
    result.errors.map(e => `  - ${e}`).join('\n') +
    '\n\nBible Song Pro bundles the 66-book Protestant canon only.'
  );
}

/** Pull book names out of a Zefania-style XML string. */
function extractZefaniaBookNames(xmlText) {
  return [...String(xmlText || '').matchAll(/<b\b[^>]*\bn="([^"]*)"/g)].map(m => m[1]);
}

module.exports = {
  CANON,
  APOCRYPHA,
  normalise,
  checkProtestantCanon,
  assertProtestantCanon,
  extractZefaniaBookNames
};
