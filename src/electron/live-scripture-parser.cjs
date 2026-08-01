const bibleService = require('./bible-service.cjs');
const { ALL_BOOKS } = require('./scripture-reference.cjs');

const CONTEXT_EXPIRY_MS = 60000;
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'your', 'into', 'their', 'there',
  'then', 'than', 'when', 'what', 'were', 'will', 'would', 'could', 'should', 'about', 'which',
  'because', 'been', 'being', 'just', 'also', 'unto', 'shall', 'said', 'them', 'they', 'you',
  'our', 'out', 'his', 'her', 'him', 'she', 'who', 'why', 'how', 'let', 'lets', 'please',
  'turn', 'open', 'bible', 'bibles', 'scripture', 'verse', 'verses', 'chapter', 'book', 'read',
  'going', 'gonna', 'we', 'to', 'of', 'in', 'on', 'at', 'is', 'it', 'be', 'as', 'an', 'or', 'a',
]);
const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};
const NUMBER_ALIASES = {
  oh: 'zero', o: 'zero', first: 'one', '1st': 'one', second: 'two', '2nd': 'two',
  third: 'three', '3rd': 'three', fourth: 'four', '4th': 'four', fifth: 'five', '5th': 'five',
  won: 'one', wan: 'one', on: 'one', to: 'two', too: 'two', tu: 'two', tree: 'three', free: 'three',
  for: 'four', fore: 'four', foor: 'four', fife: 'five', fight: 'five', fights: 'five',
  sex: 'six', sicks: 'six', seek: 'six', seeks: 'six', siven: 'seven', ate: 'eight',
  eights: 'eight', eighth: 'eight', eigth: 'eight', aight: 'eight', nein: 'nine', tin: 'ten',
  y: 'and', et: 'and',
  uno: 'one', una: 'one', un: 'one', primer: 'one', primero: 'one', dos: 'two',
  segundo: 'two', tres: 'three', tercero: 'three', cuatro: 'four', cuarto: 'four',
  cinco: 'five', quinto: 'five', seis: 'six', sexto: 'six', siete: 'seven',
  septimo: 'seven', octavo: 'eight', ocho: 'eight', nueve: 'nine', noveno: 'nine',
  diez: 'ten', decimo: 'ten', once: 'eleven', doce: 'twelve', trece: 'thirteen',
  catorce: 'fourteen', quince: 'fifteen', dieciseis: 'sixteen', diecisiete: 'seventeen',
  dieciocho: 'eighteen', diecinueve: 'nineteen', veinte: 'twenty', veintiuno: '21',
  veintidos: '22', veintitres: '23', veinticuatro: '24', veinticinco: '25',
  veintiseis: '26', veintisiete: '27', veintiocho: '28', veintinueve: '29',
  treinta: 'thirty', cuarenta: 'forty', cincuenta: 'fifty', sesenta: 'sixty',
  setenta: 'seventy', ochenta: 'eighty', noventa: 'ninety', cien: 'hundred', ciento: 'hundred',
  une: 'one', premiere: 'one', deux: 'two', deuxieme: 'two', seconde: 'two',
  trois: 'three', troisieme: 'three', quatre: 'four', quatrieme: 'four', cinq: 'five',
  cinquieme: 'five', sixieme: 'six', sept: 'seven', septieme: 'seven', huit: 'eight',
  huitieme: 'eight', neuf: 'nine', neuvieme: 'nine', onze: 'eleven', douze: 'twelve',
  treize: 'thirteen', quatorze: 'fourteen', seize: 'sixteen', dixsept: 'seventeen',
  'dix-sept': 'seventeen', dixhuit: 'eighteen', 'dix-huit': 'eighteen',
  dixneuf: 'nineteen', 'dix-neuf': 'nineteen', vingt: 'twenty', trente: 'thirty',
  quarante: 'forty', soixante: 'sixty', soixantedix: 'seventy', 'soixante-dix': 'seventy',
  quatrevingt: 'eighty', 'quatre-vingt': 'eighty', quatrevingtdix: 'ninety',
  'quatre-vingt-dix': 'ninety', cent: 'hundred',
  okan: 'one', kan: 'one', kini: 'one', kinni: 'one', meji: 'two', keji: 'two',
  meta: 'three', keta: 'three', merin: 'four', kerin: 'four', marun: 'five',
  karun: 'five', mefa: 'six', kefa: 'six', meje: 'seven', keje: 'seven',
  mejo: 'eight', kejo: 'eight', mesan: 'nine', kesan: 'nine', mewa: 'ten',
  kewa: 'ten', mokanla: 'eleven', mejila: 'twelve', metala: 'thirteen',
  merinla: 'fourteen', medogun: 'fifteen', merindinlogun: 'sixteen',
  metadinlogun: 'seventeen', mejidinlogun: 'eighteen', mokandinlogun: 'nineteen',
  ogun: 'twenty', ogbon: 'thirty', ogoji: 'forty', aadota: 'fifty', ogota: 'sixty',
  aadorin: 'seventy', ogorin: 'eighty', aadorun: 'ninety', ogorun: 'hundred',
};
const VERSE_MARKERS = new Set(['verse', 'verses', 'v', 'vs', 'ese', 'versiculo', 'versiculos', 'verso', 'versos', 'verset', 'versets']);
const CHAPTER_MARKERS = new Set(['chapter', 'chapters', 'chap', 'ch', 'ori', 'capitulo', 'capitulos', 'cap', 'chapitre', 'chapitres']);
const FILLERS = new Set(['of', 'the', 'ti', 'la', 'le', 'les']);
const RANGE_CONNECTORS = new Set(['to', 'through', 'thru', 'until', 'unto', 'and', 'ati', 'si', 'a', 'hasta', 'al', 'jusqua', 'jusqu', 'au', 'et', 'de']);

const EXTRA_BOOK_ALIASES = {
  Genesis: ['genese'], Exodus: ['exodo', 'exode'], Leviticus: ['levitico', 'levitique'],
  Numbers: ['number', 'nums', 'numeros', 'nombres'], Deuteronomy: ['deuteronomio', 'deuteronome', 'detronome', 'ditaronomy', 'ditronomy'],
  Joshua: ['josue'], Judges: ['jueces', 'juges', 'george', 'georges', 'george s'],
  Ruth: ['rut', 'routes', 'roots', 'root'], Psalms: ['salmo', 'salmos', 'psaume', 'psaumes', 'salm', 'salms', 'sams', 'sam', 'saamu', 'saam'],
  Proverbs: ['proverbios', 'proverbes'], Ecclesiastes: ['eclesiastes', 'ecclesiaste', 'ecclesia sees', 'ectilestiasthesis', 'ecclessiastes', 'oniwaasu'],
  'Song of Solomon': ['song of songs', 'songs', 'cantares', 'cantar de los cantares', 'cantique des cantiques', 'cantique', 'orin solomoni'],
  Isaiah: ['isaias', 'esaie'], Jeremiah: ['jeremias', 'jeremie', 'jerry maya', 'jerry mayaw', 'jerry mayer'],
  Ezekiel: ['ezequiel', 'ezechiel'], Hosea: ['oseas', 'osee'], Obadiah: ['abdias'],
  Jonah: ['jonas'], Micah: ['miqueas', 'michee'], Habakkuk: ['habacuc', 'abaco', 'abacu', 'abacuk', 'ababkuk', 'abraco', 'abracu', 'abracul', 'abacouk', 'abacog', 'abacogue', 'abacuum'],
  Zephaniah: ['sofonias', 'sophonie', 'ziphaniah', 'zi fania', 'ziffanai'],
  Matthew: ['mateo', 'matthieu', 'mathieu', 'mathew'], Mark: ['marcos', 'marc', 'marke'],
  Luke: ['lucas', 'luc', 'lukee'], John: ['juan', 'jean', 'jhon'], Acts: ['hechos', 'actes'],
  Romans: ['romanos', 'romains', 'romance'], Philemon: ['filemon', 'fill him on', 'file a month', 'philimon', 'fylemon', 'file him on'],
  Revelation: ['revelations', 'apocalipsis', 'apocalypse', 'ifihan'],
  '1 Thessalonians': ['thesalonians', 'thessalonia', 'tesalonia'],
  '1 Timothy': ['timoti'], '1 Corinthians': ['corinthians'],
  '1 Samuel': ['primer samuel', 'premier samuel'], '2 Samuel': ['segundo samuel', 'deuxieme samuel'],
  '1 Kings': ['1 reyes', 'primer reyes', '1 rois', 'premier rois'],
  '2 Kings': ['2 reyes', 'segundo reyes', '2 rois', 'deuxieme rois'],
  '1 Chronicles': ['1 cronicas', 'primer cronicas', '1 chroniques', 'premier chroniques'],
  '2 Chronicles': ['2 cronicas', 'segundo cronicas', '2 chroniques', 'deuxieme chroniques'],
  '1 Corinthians': ['corinthians', '1 corintios', 'primer corintios', '1 corinthiens', 'premier corinthiens'],
  '2 Corinthians': ['2 corintios', 'segundo corintios', '2 corinthiens', 'deuxieme corinthiens'],
  '1 Peter': ['1 pedro', 'primer pedro', '1 pierre', 'premier pierre'],
  '2 Peter': ['2 pedro', 'segundo pedro', '2 pierre', 'deuxieme pierre'],
  '1 John': ['1 juan', 'primer juan', '1 jean', 'premier jean'],
  '2 John': ['2 juan', 'segundo juan', '2 jean', 'deuxieme jean'],
  '3 John': ['3 juan', 'tercer juan', '3 jean', 'troisieme jean'],
};

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
}
function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function normalizeNumberToken(token) { const key = normalize(token); return NUMBER_ALIASES[key] || key; }
function parseNumber(tokens) {
  const parts = (Array.isArray(tokens) ? tokens : String(tokens || '').split(/\s+/))
    .map(normalizeNumberToken).filter((token) => token && token !== 'and');
  if (!parts.length) return null;
  const digitParts = parts.map((token) => /^\d$/.test(token) ? token : (NUMBER_WORDS[token] <= 9 ? String(NUMBER_WORDS[token]) : null));
  if (digitParts.every(Boolean) && digitParts.length <= 3) return Number(digitParts.join(''));
  let current = 0;
  for (const token of parts) {
    if (/^\d+$/.test(token)) { current += Number(token); continue; }
    if (!(token in NUMBER_WORDS)) return null;
    const value = NUMBER_WORDS[token];
    current = value === 100 ? Math.max(1, current) * 100 : current + value;
  }
  return current || null;
}
function levenshtein(left, right) {
  const row = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i++) {
    let previous = row[0]; row[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[right.length];
}
function phonetic(value) {
  return normalize(value).replace(/\bps(?=alm)/g, 's').replace(/\bph/g, 'f').replace(/\bkn/g, 'n')
    .replace(/\bwr/g, 'r').replace(/kh/g, 'k').replace(/[aeiou]/g, '').replace(/(.)\1+/g, '$1').replace(/\s+/g, ' ').trim();
}

function createLiveScriptureParser({ verseIndex }) {
  let referenceContext = null;
  const aliases = new Map();
  const addAlias = (alias, canonical) => { const key = normalize(alias); if (key) aliases.set(key, canonical); };
  ALL_BOOKS.forEach((book) => {
    addAlias(book.name, book.name);
    book.abbrev.forEach((alias) => addAlias(alias, book.name));
  });
  Object.entries(EXTRA_BOOK_ALIASES).forEach(([book, values]) => values.forEach((alias) => addAlias(alias, book)));
  const aliasEntries = [...aliases.entries()].sort((a, b) => b[0].length - a[0].length);

  function getBible(versionId) {
    return bibleService.getData().versions[versionId] || bibleService.getData().versions.KJV || {};
  }
  function normalizeRange(book, chapter, verseStart, verseEnd, versionId, reason) {
    chapter = Number(chapter); verseStart = Number(verseStart);
    const verses = getBible(versionId)[book]?.[String(chapter)];
    if (!verses || !verses[String(verseStart)]) return null;
    const end = Number(verseEnd);
    return { book, chapter, verseStart, verseEnd: end > verseStart && verses[String(end)] ? end : verseStart, versionId, reason };
  }
  function rangeWidth(tokens, index) {
    const token = normalize(tokens[index]);
    // "twenty and eight" is one number; "28 and 30" is a verse range.
    if (token === 'and' && NUMBER_WORDS[normalizeNumberToken(tokens[index - 1])] >= 20) return 0;
    if ((token === 'titi' && normalize(tokens[index + 1]) === 'de') || (token === 'jusqu' && normalize(tokens[index + 1]) === 'a')) return 2;
    return RANGE_CONNECTORS.has(token) ? 1 : 0;
  }
  function buildSpoken(book, chapterTokens, verseTokens, versionId, reason = 'spoken-reference') {
    const connector = verseTokens.findIndex((_, index) => rangeWidth(verseTokens, index) > 0);
    const width = connector >= 0 ? rangeWidth(verseTokens, connector) : 0;
    const startTokens = connector > 0 ? verseTokens.slice(0, connector) : verseTokens;
    const endTokens = connector > 0 ? verseTokens.slice(connector + width) : [];
    return normalizeRange(book, parseNumber(chapterTokens), parseNumber(startTokens), parseNumber(endTokens), versionId, reason);
  }
  function resolveSpoken(book, rawTokens, versionId, reason = 'spoken-reference') {
    const tokens = rawTokens.filter((token) => token && !FILLERS.has(normalize(token)));
    const verseIndexAt = tokens.findIndex((token) => VERSE_MARKERS.has(normalize(token)));
    if (verseIndexAt > 0 && verseIndexAt < tokens.length - 1) {
      return buildSpoken(book, tokens.slice(0, verseIndexAt).filter((token) => !CHAPTER_MARKERS.has(normalize(token))), tokens.slice(verseIndexAt + 1), versionId, reason);
    }
    if (verseIndexAt >= 0) return null;
    const withoutChapter = tokens.filter((token) => !CHAPTER_MARKERS.has(normalize(token)));
    const candidates = [];
    for (let split = 1; split < withoutChapter.length; split++) {
      const candidate = buildSpoken(book, withoutChapter.slice(0, split), withoutChapter.slice(split), versionId, reason);
      if (!candidate) continue;
      const chapterWords = withoutChapter.slice(0, split).filter((token) => normalize(token) !== 'and').length;
      candidates.push({ candidate, score: (chapterWords === 1 ? 3 : chapterWords === 2 ? 1 : 0) + (candidate.chapter <= 150 ? 1 : 0) });
    }
    return candidates.sort((a, b) => b.score - a.score)[0]?.candidate || null;
  }
  function findPhonetic(tokens) {
    const key = phonetic(tokens.join(' '));
    if (!key) return '';
    let best = { book: '', score: -Infinity };
    for (const [alias, book] of aliasEntries) {
      const aliasKey = phonetic(alias);
      const distance = levenshtein(key, aliasKey);
      let score = 1 - distance / Math.max(key.length, aliasKey.length, 1);
      if (aliasKey.startsWith(key) || key.startsWith(aliasKey)) score += 0.12;
      if (distance === 0) score += 0.2;
      if (tokens.length === alias.split(' ').length) score += 0.06;
      if (score > best.score) best = { book, score };
    }
    return best.score >= 0.58 ? best.book : '';
  }
  function setContext(match) {
    if (match?.book && match?.chapter) referenceContext = { book: match.book, chapter: match.chapter, versionId: match.versionId, at: Date.now() };
  }
  function validContext(versionId) {
    if (!referenceContext || Date.now() - referenceContext.at > CONTEXT_EXPIRY_MS) return null;
    if (referenceContext.versionId !== versionId) return null;
    return referenceContext;
  }
  function parseDirect(text, versionId) {
    const input = normalize(text);
    if (!input) return null;
    const context = validContext(versionId);
    const standalone = input.match(/^(?:verse|verses|v|vs|ese|versiculo|verso|verset)\s+(.+)$/u);
    if (standalone && context) {
      const match = buildSpoken(context.book, [String(context.chapter)], standalone[1].split(/\s+/), versionId, 'context-verse-reference');
      if (match) return { ...match, confidence: 1.02 };
    }
    for (const [alias, book] of aliasEntries) {
      const match = input.match(new RegExp(`(?:^|\\s)${escapeRegex(alias)}(?:\\s+(.+))$`, 'u'));
      if (!match) continue;
      const rest = match[1].split(/\s+/).filter(Boolean);
      const direct = resolveSpoken(book, rest, versionId);
      if (direct) { setContext(direct); return { ...direct, confidence: 1 }; }
      const chapterOnly = parseNumber(rest.filter((token) => !CHAPTER_MARKERS.has(normalize(token))));
      if (chapterOnly && getBible(versionId)[book]?.[String(chapterOnly)]) {
        referenceContext = { book, chapter: chapterOnly, versionId, at: Date.now() };
        return { book, chapter: chapterOnly, versionId, contextOnly: true, reason: 'chapter-context', confidence: 0.8 };
      }
    }
    const tokens = input.split(/\s+/);
    // The rolling transcript may contain lead-in sermon words. Try book starts near its tail.
    for (let start = Math.max(0, tokens.length - 12); start < tokens.length - 2; start++) {
      for (let count = 1; count <= Math.min(3, tokens.length - start - 2); count++) {
        const book = findPhonetic(tokens.slice(start, start + count));
        if (!book) continue;
        const direct = resolveSpoken(book, tokens.slice(start + count), versionId, 'phonetic-reference');
        if (direct) { setContext(direct); return { ...direct, confidence: 0.94 }; }
      }
    }
    return null;
  }
  function quoteCandidates(text, versionId, options = {}) {
    const normalized = normalize(text);
    const queryTokens = verseIndex.tokenize(text);
    const minimum = options.interim ? 2 : 4;
    if (queryTokens.length < minimum) return [];
    const index = verseIndex.getIndex(versionId);
    const unique = [...new Set(queryTokens)];
    const candidates = new Set();
    unique.forEach((token) => (index.postings.get(token) || []).forEach(([docId]) => candidates.add(docId)));
    return [...candidates].map((docId) => {
      const doc = index.docs[docId];
      const docNormalized = normalize(doc.text);
      const docTokens = verseIndex.tokenize(doc.text);
      const docSet = new Set(docTokens);
      const overlap = unique.filter((token) => docSet.has(token)).length;
      const queryCoverage = overlap / Math.max(1, unique.length);
      const entryCoverage = overlap / Math.max(1, new Set(docTokens).size);
      const exact = docNormalized === normalized;
      const prefix = docNormalized.startsWith(normalized) && normalized.length >= 8;
      const contained = normalized.includes(docNormalized) && docTokens.length >= 4;
      const score = (exact ? 2 : 0) + (prefix ? 1.25 : 0) + (contained ? 0.55 : 0) + queryCoverage * 0.62 + entryCoverage * 0.38;
      return { doc, overlap, score, exact, prefix };
    }).filter((item) => item.exact || item.prefix || (item.overlap >= 3 && item.score >= (options.interim ? 1.05 : 0.72)))
      .sort((a, b) => b.score - a.score).slice(0, options.limit || 6)
      .map(({ doc, score, exact, prefix }) => ({
        book: doc.book, chapter: doc.chapter, verseStart: doc.verse, verseEnd: doc.verse,
        versionId, reason: exact ? 'quoted-verse-exact' : prefix ? 'quoted-verse-interim' : 'quoted-verse-bm25',
        confidence: Math.min(0.98, exact ? 0.98 : prefix ? 0.9 : 0.45 + score * 0.35), excerpt: doc.text,
      }));
  }
  return { parseDirect, quoteCandidates, normalize, parseNumber, aliases };
}

module.exports = { createLiveScriptureParser };
