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
// accept for it. French and Spanish are included because Louis Segond, Ostervald
// and Reina-Valera ship in the bundle — a guard that only speaks English would
// reject a perfectly canonical bible in either.
//
// Two editions of one language do not necessarily agree: Ostervald calls the
// Song of Songs "Cantique" where Segond writes "Cantique des Cantiques", and
// writes "1 Thessalonicien" singular. Both spellings are listed, because the
// guard's job is to recognise the canon, not to arbitrate French.
//
// Diacritics are folded during comparison, so accents here are for readability.
const CANON = [
  // Old Testament — 39
  ['Genesis', 'Genèse'],
  ['Exodus', 'Exode', 'Éxodo'],
  ['Leviticus', 'Lévitique', 'Levítico'],
  ['Numbers', 'Nombres', 'Números'],
  ['Deuteronomy', 'Deutéronome', 'Deuteronomio'],
  ['Joshua', 'Josué'],
  ['Judges', 'Juges', 'Jueces'],
  ['Ruth', 'Rut'],
  ['1 Samuel'],
  ['2 Samuel'],
  ['1 Kings', '1 Rois', '1 Reyes'],
  ['2 Kings', '2 Rois', '2 Reyes'],
  ['1 Chronicles', '1 Chroniques', '1 Crónicas'],
  ['2 Chronicles', '2 Chroniques', '2 Crónicas'],
  ['Ezra', 'Esdras'],
  ['Nehemiah', 'Néhémie', 'Nehemías'],
  ['Esther', 'Ester'],
  ['Job'],
  ['Psalms', 'Psalm', 'Psalter', 'Psaumes', 'Salmos'],
  ['Proverbs', 'Proverbes', 'Proverbios'],
  ['Ecclesiastes', 'Qoheleth', 'Preacher', 'Ecclésiaste', 'Eclesiastés'],
  ['Song of Solomon', 'Song of Songs', 'Canticles', 'Song', 'Cantique des Cantiques', 'Cantique', 'Cantar de Los Cantares'],
  ['Isaiah', 'Ésaïe', 'Isaías'],
  ['Jeremiah', 'Jérémie', 'Jeremías'],
  ['Lamentations', 'Lamentaciones'],
  ['Ezekiel', 'Ézéchiel', 'Ezequiel'],
  ['Daniel'],
  ['Hosea', 'Osée', 'Oseas'],
  ['Joel', 'Joël'],
  ['Amos'],
  ['Obadiah', 'Abdias'],
  ['Jonah', 'Jonas'],
  ['Micah', 'Michée', 'Miqueas'],
  ['Nahum'],
  ['Habakkuk', 'Habacuc'],
  ['Zephaniah', 'Sophonie', 'Sofonías'],
  ['Haggai', 'Aggée', 'Hageo'],
  ['Zechariah', 'Zacharie', 'Zacarías'],
  ['Malachi', 'Malachie', 'Malaquías'],

  // New Testament — 27
  ['Matthew', 'Matthieu', 'San Mateo'],
  ['Mark', 'Marc', 'Marcos'],
  ['Luke', 'Luc', 'San Lucas'],
  ['John', 'Jean', 'Juan'],
  ['Acts', 'Acts of the Apostles', 'Actes', 'Hechos'],
  ['Romans', 'Romains', 'Romanos'],
  ['1 Corinthians', '1 Corinthiens', '1 Corintios'],
  ['2 Corinthians', '2 Corinthiens', '2 Corintios'],
  ['Galatians', 'Galates', 'Gálatas'],
  ['Ephesians', 'Éphésiens', 'Efesios'],
  ['Philippians', 'Philippiens', 'Filipenses'],
  ['Colossians', 'Colossiens', 'Colosenses'],
  ['1 Thessalonians', '1 Thessaloniciens', '1 Thessalonicien', '1 Tesalonicenses'],
  ['2 Thessalonians', '2 Thessaloniciens', '2 Thessalonicien', '2 Tesalonicenses'],
  ['1 Timothy', '1 Timothée', '1 Thimothée', '1 Timoteo'],
  ['2 Timothy', '2 Timothée', '2 Thimothée', '2 Timoteo'],
  ['Titus', 'Tite', 'Tito'],
  ['Philemon', 'Philémon', 'Filemón'],
  ['Hebrews', 'Hébreux', 'Hebreos'],
  ['James', 'Jacques', 'Santiago'],
  ['1 Peter', '1 Pierre', '1 Pedro'],
  ['2 Peter', '2 Pierre', '2 Pedro'],
  ['1 John', '1 Jean', '1 Juan'],
  ['2 John', '2 Jean', '2 Juan'],
  ['3 John', '3 Jean', '3 Juan'],
  ['Jude', 'Judas'],
  ['Revelation', 'Revelation of John', 'Revelation of Jesus Christ', 'Apocalypse', 'Apocalipsis']
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

// Shared by the build scripts (Node) and the panel (browser). One canon list, so
// an imported bible is held to exactly the same standard as a bundled one.
const BIBLE_CANON = {
  CANON,
  APOCRYPHA,
  normalise,
  checkProtestantCanon,
  assertProtestantCanon,
  extractZefaniaBookNames
};

if (typeof module !== 'undefined' && module.exports) module.exports = BIBLE_CANON;
if (typeof window !== 'undefined') window.BSP_BIBLE_CANON = BIBLE_CANON;
