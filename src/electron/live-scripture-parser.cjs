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

const THEOLOGICAL_TERMS = new Set([
  'god', 'lord', 'jesus', 'christ', 'spirit', 'father', 'son', 'holy',
  'salvation', 'grace', 'faith', 'righteous', 'righteousness', 'covenant',
  'mercy', 'glory', 'kingdom', 'resurrection', 'cross', 'shepherd',
  'commandment', 'commandments', 'blessed', 'blessing', 'gospel', 'prayer',
  'worship', 'praise', 'redemption', 'eternal', 'life', 'light', 'darkness',
  'truth', 'peace', 'savior', 'disciple', 'apostle', 'prophet', 'repentance',
  'forgive', 'forgiveness', 'sin', 'sins', 'healed', 'healing', 'miracle',
  'testimony', 'tabernacle', 'temple', 'altar', 'sacrifice', 'lamb', 'zion',
  'israel', 'jerusalem', 'heavens', 'earth', 'creation', 'everlasting',
  'anointed', 'anointing', 'sanctified', 'justified', 'redeemed', 'begotten'
]);

const BIBLICAL_LEMMAS = {
  loveth: 'love', loving: 'love', loved: 'love', loves: 'love',
  saith: 'say', saying: 'say', said: 'say', says: 'say',
  giveth: 'give', giving: 'give', gave: 'give', given: 'give', gives: 'give',
  believeth: 'believe', believing: 'believe', believed: 'believe', believes: 'believe',
  abideth: 'abide', abiding: 'abide', abode: 'abide', abides: 'abide', dwelleth: 'abide', dwells: 'abide', dwelling: 'abide',
  walketh: 'walk', walking: 'walk', walked: 'walk', walks: 'walk',
  knoweth: 'know', knowing: 'know', knew: 'know', known: 'know', knows: 'know',
  cometh: 'come', coming: 'come', came: 'come', comes: 'come',
  doeth: 'do', doing: 'do', did: 'do', done: 'do', doth: 'do',
  hath: 'have', having: 'have', had: 'have', has: 'have',
  seeketh: 'seek', seeking: 'seek', sought: 'seek', seeks: 'seek',
  leadeth: 'lead', leading: 'lead', led: 'lead', leads: 'lead',
  maketh: 'make', making: 'make', made: 'make', makes: 'make',
  heareth: 'hear', hearing: 'hear', heard: 'hear', hears: 'hear',
  speaketh: 'speak', speaking: 'speak', spoke: 'speak', spoken: 'speak', speaks: 'speak',
  judgeth: 'judge', judging: 'judge', judged: 'judge', judges: 'judge',
  standeth: 'stand', standing: 'stand', stood: 'stand', stands: 'stand',
  runneth: 'run', running: 'run', ran: 'run', runs: 'run',
  sendeth: 'send', sending: 'send', sent: 'send', sends: 'send',
  saveth: 'save', saving: 'save', saved: 'save', saves: 'save',
  healeth: 'heal', healing: 'heal', healed: 'heal', heals: 'heal',
};

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
  tarty: 'thirty', thurty: 'thirty', foty: 'forty', fity: 'fifty', sixtin: 'sixteen',
  seventin: 'seventeen', eightin: 'eighteen', ninetin: 'nineteen',
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

const VERSE_MARKERS = new Set(['verse', 'verses', 'v', 'vs', 'ese', 'versiculo', 'versiculos', 'verso', 'versos', 'verset', 'versets', 'ver']);
const CHAPTER_MARKERS = new Set(['chapter', 'chapters', 'chap', 'ch', 'ori', 'capitulo', 'capitulos', 'cap', 'chapitre', 'chapitres']);
const FILLERS = new Set(['of', 'the', 'ti', 'la', 'le', 'les', 'in', 'at', 'from']);
const RANGE_CONNECTORS = new Set(['to', 'through', 'thru', 'until', 'unto', 'and', 'ati', 'si', 'a', 'hasta', 'al', 'jusqua', 'jusqu', 'au', 'et', 'de']);

const EXTRA_BOOK_ALIASES = {
  Genesis: ['genese', 'jenesis', 'oriki', 'genisis'],
  Exodus: ['exodo', 'exode', 'eksodu', 'ekisodu'],
  Leviticus: ['levitico', 'levitique', 'lefiti', 'lefitiku', 'leave it to us', 'leviticas', 'levitic'],
  Numbers: ['number', 'nums', 'numeros', 'nombres', 'numeri', 'nomba'],
  Deuteronomy: ['deuteronomio', 'deuteronome', 'detronome', 'ditaronomy', 'ditronomy', 'diuteronomi', 'deuteronomi', 'dutronomy', 'due to ronald me', 'due teronomy'],
  Joshua: ['josue', 'joshua', 'josua'],
  Judges: ['jueces', 'juges', 'george', 'georges', 'george s', 'adajo', 'onidajo'],
  Ruth: ['rut', 'routes', 'roots', 'root', 'ruutu'],
  Psalms: ['salmo', 'salmos', 'psaume', 'psaumes', 'salm', 'salms', 'sams', 'sam', 'saamu', 'saam', 'psam', 'psams', 'sama', 'sums', 'some'],
  Proverbs: ['proverbios', 'proverbes', 'owe', 'proverb'],
  Ecclesiastes: ['eclesiastes', 'ecclesiaste', 'ecclesia sees', 'ectilestiasthesis', 'ecclessiastes', 'ecclisiastes', 'oniwaasu', 'oniwasu', 'ecclesiast', 'a classy astiz'],
  'Song of Solomon': ['song of songs', 'songs', 'cantares', 'cantar de los cantares', 'cantique des cantiques', 'cantique', 'orin solomoni', 'orin solomon', 'canticles'],
  Isaiah: ['isaias', 'esaie', 'isaiah', 'woli isaiah', 'isaya'],
  Jeremiah: ['jeremias', 'jeremie', 'jerry maya', 'jerry mayaw', 'jerry mayer', 'jeremiya', 'jeremaya'],
  Lamentations: ['lamentaciones', 'lamentation', 'orin aron', 'ekun jeremiah'],
  Ezekiel: ['ezequiel', 'ezechiel', 'esekieli', 'ezekieli'],
  Daniel: ['danieli', 'daniyel'],
  Hosea: ['oseas', 'osee', 'hoseya', 'hoshea'],
  Joel: ['joeli'],
  Amos: ['amosi'],
  Obadiah: ['abdias', 'obadiya'],
  Jonah: ['jonas', 'jona'],
  Micah: ['miqueas', 'michee', 'mika'],
  Nahum: ['nahumu'],
  Habakkuk: ['habacuc', 'abaco', 'abacu', 'abacuk', 'ababkuk', 'abraco', 'abracu', 'abracul', 'abacouk', 'abacog', 'abacogue', 'abacuum', 'habakuku', 'abakuk', 'how back hook', 'have a cook'],
  Zephaniah: ['sofonias', 'sophonie', 'ziphaniah', 'zi fania', 'ziffanai', 'sefania', 'zefaniya'],
  Haggai: ['hagai', 'haggaye', 'agee', 'hageo', 'haggai'],
  Zechariah: ['zacarías', 'zacarias', 'zacharie', 'zekariya', 'sechariah'],
  Malachi: ['malachie', 'malaquias', 'malaki', 'malakai'],
  Matthew: ['mateo', 'matthieu', 'mathieu', 'mathew', 'matiu', 'matyu', 'mathews'],
  Mark: ['marcos', 'marc', 'marke', 'maku'],
  Luke: ['lucas', 'luc', 'lukee', 'luku'],
  John: ['juan', 'jean', 'jhon', 'johanu'],
  Acts: ['hechos', 'actes', 'acts of apostles', 'ise awon aposteli', 'aposteli'],
  Romans: ['romanos', 'romains', 'romance', 'arokolu', 'ara romu', 'romu'],
  '1 Corinthians': ['corinthians', '1 corintios', 'primer corintios', '1 corinthiens', 'premier corinthiens', 'corinthians 1', '1st corinthians', 'first corinthians', '1st cor', 'first cor', 'ara korinti kinni', 'korinti kinni', 'korinti kini'],
  '2 Corinthians': ['2 corintios', 'segundo corintios', '2 corinthiens', 'deuxieme corinthiens', 'corinthians 2', '2nd corinthians', 'second corinthians', '2nd cor', 'second cor', 'ara korinti keji', 'korinti keji'],
  Galatians: ['galates', 'galatas', 'ara galatia', 'galatia', 'collations', 'collatians', 'glacians'],
  Ephesians: ['ephesiens', 'efesios', 'ara efesu', 'efesu', 'effusions', 'fusions'],
  Philippians: ['philippiens', 'filipenses', 'ara filipi', 'filipi', 'philipians', 'flipians', 'philipia', 'flip ya'],
  Colossians: ['colossiens', 'colosenses', 'ara kolose', 'kolose', 'collisions', 'collosians'],
  '1 Thessalonians': ['thesalonians', 'thessalonia', 'tesalonia', 'thessaloniciens 1', 'tesalonicenses 1', '1st thessalonians', 'first thessalonians', '1st thess', 'first thess', 'ara tesalonika kinni', 'tesalonika kinni'],
  '2 Thessalonians': ['2 thessalonians', 'thessaloniciens 2', 'tesalonicenses 2', '2nd thessalonians', 'second thessalonians', '2nd thess', 'second thess', 'ara tesalonika keji', 'tesalonika keji'],
  '1 Timothy': ['timoti', 'timoteo 1', '1er timothee', '1st timothy', 'first timothy', '1st tim', 'first tim', 'timoti kinni', 'timoti kini'],
  '2 Timothy': ['timoteo 2', '2e timothee', '2nd timothy', 'second timothy', '2nd tim', 'second tim', 'timoti keji'],
  Titus: ['titus', 'tight us', 'tightest', 'tytus', 'tightos', 'title', 'titers', 'titous', 'tight as', 'tite', 'tito', 'titu', 'tightis', 'tightist'],
  Philemon: ['philemon', 'filemon', 'fill him on', 'file a month', 'philimon', 'fylemon', 'file him on', 'filimoni', 'fill a mon'],
  Hebrews: ['hebreux', 'hebreos', 'awon heberu', 'heberu'],
  James: ['jacques', 'santiago', 'jakobu', 'jakob'],
  '1 Peter': ['1 pedro', 'primer pedro', '1 pierre', 'premier pierre', 'peter 1', '1st peter', 'first peter', '1st pet', 'first pet', 'peteru kinni', 'peteru kini'],
  '2 Peter': ['2 pedro', 'segundo pedro', '2 pierre', 'deuxieme pierre', 'peter 2', '2nd peter', 'second peter', '2nd pet', 'second pet', 'peteru keji'],
  '1 John': ['1 juan', 'primer juan', '1 jean', 'premier jean', 'john 1', '1st john', 'first john', '1st jn', 'first jn', 'johanu kinni', 'johanu kini'],
  '2 John': ['2 juan', 'segundo juan', '2 jean', 'deuxieme jean', 'john 2', '2nd john', 'second john', '2nd jn', 'second jn', 'johanu keji'],
  '3 John': ['3 juan', 'tercer juan', '3 jean', 'troisieme jean', 'john 3', '3rd john', 'third john', '3rd jn', 'third jn', 'johanu keta'],
  Jude: ['judas', 'juda'],
  Revelation: ['revelations', 'apocalipsis', 'apocalypse', 'ifihan', 'revelation of john'],
  '1 Samuel': ['primer samuel', 'premier samuel', 'samuel 1', '1st samuel', 'first samuel', '1st sam', 'first sam', 'samuel kinni', 'samuel kini', 'sameli kinni', 'sameli kini'],
  '2 Samuel': ['segundo samuel', 'deuxieme samuel', 'samuel 2', '2nd samuel', 'second samuel', '2nd sam', 'second sam', 'samuel keji', 'sameli keji'],
  '1 Kings': ['1 reyes', 'primer reyes', '1 rois', 'premier rois', 'kings 1', '1st kings', 'first kings', '1st kgs', 'first kgs', 'awon oba kinni', 'oba kinni', 'oba kini'],
  '2 Kings': ['2 reyes', 'segundo reyes', '2 rois', 'deuxieme rois', 'kings 2', '2nd kings', 'second kings', '2nd kgs', 'second kgs', 'awon oba keji', 'oba keji'],
  '1 Chronicles': ['1 cronicas', 'primer cronicas', '1 chroniques', 'premier chroniques', 'chronicles 1', '1st chronicles', 'first chronicles', '1st chron', 'first chron', 'kronika kinni', 'kronika kini'],
  '2 Chronicles': ['2 cronicas', 'segundo cronicas', '2 chroniques', 'deuxieme chroniques', 'chronicles 2', '2nd chronicles', 'second chronicles', '2nd chron', 'second chron', 'kronika keji'],
};

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
}
function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function normalizeNumberToken(token) { const key = normalize(token); return NUMBER_ALIASES[key] || key; }
function lemmatize(word) { const norm = normalize(word); return BIBLICAL_LEMMAS[norm] || norm; }

const SERMON_FILLER_PATTERN = /\b(?:as\s+(?:the\s+)?(?:bible|scripture|word\s+of\s+god|apostle\s+paul|jesus|prophet)\s+(?:says|said|declares|tells\s+us|writes|stated)|turn\s+(?:your\s+)?(?:bibles?\s+)?to|open\s+(?:your\s+)?(?:bibles?\s+)?to|let\s+(?:us|the\s+church)\s+read|for\s+(?:the\s+)?(?:bible|scripture)\s+(?:says|states|declares)|you\s+know\s+(?:the\s+)?(?:bible|scripture)\s+says|i\s+read\s+from|we\s+read\s+in|praise\s+the\s+lord|hallelujah|amen|glory\s+to\s+god)\b/gi;

function cleanSermonUtterance(text) {
  return String(text || '').replace(SERMON_FILLER_PATTERN, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * French writes its compound numbers with hyphens, so a recogniser hands back
 * "vingt-trois" as one token and nothing above knows it means 23.
 *
 * Splitting on the hyphen is not enough: "quatre-vingt-trois" is four-twenties-
 * three, and three naive pieces add up to 27 rather than 83. So the longest
 * known alias wins at each step — "quatre-vingt" is claimed as eighty before
 * "quatre" can be claimed as four. Tokens that are already an alias in their
 * own right ("dix-sept") never reach here, because the caller resolves them
 * first.
 */
function expandHyphenatedNumber(token) {
  const pieces = token.split('-').filter(Boolean);
  if (pieces.length < 2) return [token];
  const out = [];
  let index = 0;
  while (index < pieces.length) {
    let matched = null;
    for (let take = pieces.length - index; take >= 1; take--) {
      const candidate = pieces.slice(index, index + take).join('-');
      const resolved = NUMBER_ALIASES[candidate] || (candidate in NUMBER_WORDS ? candidate : null);
      if (resolved) { matched = { resolved, take }; break; }
    }
    /* An unknown piece means this was never a number — hand the token back
       whole so the caller fails it rather than parsing half of it. */
    if (!matched) return [token];
    out.push(matched.resolved);
    index += matched.take;
  }
  return out;
}

function parseNumber(tokens) {
  const parts = (Array.isArray(tokens) ? tokens : String(tokens || '').split(/\s+/))
    .map(normalizeNumberToken)
    .flatMap((token) => (token.includes('-') ? expandHyphenatedNumber(token) : [token]))
    .filter((token) => token && token !== 'and');
  if (!parts.length) return null;
  const digitParts = parts.map((token) => /^\d$/.test(token) ? token : (NUMBER_WORDS[token] <= 9 ? String(NUMBER_WORDS[token]) : null));
  if (digitParts.every(Boolean) && digitParts.length <= 3) return Number(digitParts.join(''));
  let current = 0;
  let prevValue = null;
  for (const token of parts) {
    if (/^\d+$/.test(token)) {
      const num = Number(token);
      if (prevValue !== null && prevValue < 10 && num >= 20 && num < 100) return null;
      current += num;
      prevValue = num;
      continue;
    }
    if (!(token in NUMBER_WORDS)) return null;
    const value = NUMBER_WORDS[token];
    if (value === 100) {
      current = Math.max(1, current) * 100;
      prevValue = 100;
    } else {
      if (prevValue !== null && prevValue < 10 && value >= 20 && value < 100) return null;
      current += value;
      prevValue = value;
    }
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
    const raw = tokens.join(' ');
    const key = phonetic(raw);
    if (!key || key.length < 3) return '';
    let best = { book: '', score: -Infinity };
    for (const [alias, book] of aliasEntries) {
      const aliasKey = phonetic(alias);
      if (!aliasKey) continue;
      const distance = levenshtein(key, aliasKey);
      let score = 1 - distance / Math.max(key.length, aliasKey.length, 1);
      if (aliasKey.startsWith(key) || key.startsWith(aliasKey)) score += 0.10;
      if (distance === 0) score += 0.20;
      if (tokens.length === alias.split(' ').length) score += 0.06;
      if (score > best.score) best = { book, score };
    }
    // Stricter threshold for single/short words to prevent conversational words matching books
    const threshold = raw.length <= 4 ? 0.85 : 0.72;
    return best.score >= threshold ? best.book : '';
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
    const cleanedText = cleanSermonUtterance(text);
    const normalized = normalize(cleanedText || text);
    const queryTokens = verseIndex.tokenize(cleanedText || text);
    const minimum = options.interim ? 3 : 4;
    if (queryTokens.length < minimum) return [];
    const index = verseIndex.getIndex(versionId);
    const unique = [...new Set(queryTokens)];
    const uniqueLemmas = new Set(unique.map(lemmatize));
    const candidates = new Set();
    unique.forEach((token) => (index.postings.get(token) || []).forEach(([docId]) => candidates.add(docId)));
    const queryWords = normalized.split(/\s+/).filter(Boolean);
    const queryLemmas = queryWords.map(lemmatize);

    return [...candidates].map((docId) => {
      const doc = index.docs[docId];
      const docNormalized = normalize(doc.text);
      const docWords = docNormalized.split(/\s+/).filter(Boolean);
      const docLemmas = docWords.map(lemmatize);
      const docTokens = verseIndex.tokenize(doc.text);
      const docSet = new Set(docTokens);
      const docLemmaSet = new Set(docTokens.map(lemmatize));

      const exactOverlap = unique.filter((token) => docSet.has(token)).length;
      const lemmaOverlap = [...uniqueLemmas].filter((token) => docLemmaSet.has(token)).length;
      const overlap = Math.max(exactOverlap, lemmaOverlap);

      // Theological keyword count
      const theoMatches = unique.filter((token) => THEOLOGICAL_TERMS.has(token) && docLemmaSet.has(lemmatize(token))).length;

      const queryCoverage = overlap / Math.max(1, unique.length);
      const entryCoverage = overlap / Math.max(1, new Set(docTokens).size);

      // Check contiguous match length (exact and lemmatized)
      let maxContiguous = 0;
      for (let i = 0; i < queryWords.length; i++) {
        for (let j = 0; j < docWords.length; j++) {
          let len = 0;
          while (
            i + len < queryWords.length &&
            j + len < docWords.length &&
            (queryWords[i + len] === docWords[j + len] || queryLemmas[i + len] === docLemmas[j + len])
          ) {
            len++;
          }
          if (len > maxContiguous) maxContiguous = len;
        }
      }

      const exact = docNormalized === normalized;
      const prefix = docNormalized.startsWith(normalized) && normalized.length >= 8;
      const contained = normalized.includes(docNormalized) && docTokens.length >= 4;
      const contiguousBonus = maxContiguous >= 4 ? 1.2 + (maxContiguous >= 6 ? 0.6 : 0) : maxContiguous >= 3 ? 0.5 : 0;
      const theologicalBonus = theoMatches * 0.35;
      const lengthPenalty = Math.max(0.5, Math.min(1.0, (queryWords.length + 2) / Math.max(docWords.length, 1)));

      const score = ((exact ? 2.8 : 0) + (prefix ? 1.8 : 0) + (contained ? 1.0 : 0) + contiguousBonus + theologicalBonus + queryCoverage * 0.80 + entryCoverage * 0.40) * lengthPenalty;

      return { doc, overlap, score, exact, prefix, maxContiguous, theoMatches };
    }).filter((item) => item.exact || item.prefix || item.maxContiguous >= 4 || (item.theoMatches >= 2 && item.overlap >= 3) || (item.overlap >= 4 && item.score >= (options.interim ? 1.20 : 1.00)))
      .sort((a, b) => b.score - a.score).slice(0, options.limit || 6)
      .map(({ doc, score, exact, prefix, maxContiguous }) => ({
        book: doc.book, chapter: doc.chapter, verseStart: doc.verse, verseEnd: doc.verse,
        versionId, reason: exact ? 'quoted-verse-exact' : prefix ? 'quoted-verse-interim' : maxContiguous >= 4 ? 'quoted-verse-phrase' : 'quoted-verse-bm25',
        confidence: Math.min(0.98, exact ? 0.98 : prefix ? 0.92 : maxContiguous >= 4 ? 0.88 : 0.50 + Math.min(0.38, score * 0.22)), excerpt: doc.text,
      }));
  }
  return { parseDirect, quoteCandidates, normalize, parseNumber, aliases, cleanSermonUtterance, lemmatize };
}

module.exports = { createLiveScriptureParser };
