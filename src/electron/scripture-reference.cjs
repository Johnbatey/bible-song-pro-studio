/* Each book carries its English name, its usual abbreviations, and — since the
   bundle ships Louis Segond, Ostervald and Reina-Valera, and the recogniser can
   be told to listen in French or Spanish — its native name in those languages
   too. Without these a French or Spanish reference parses its numbers correctly
   and then resolves to no book at all.

   Diacritics are folded on both sides before lookup (see normalize() in
   live-scripture-parser.cjs), so the accents here are for readability and
   'Génesis' matches whether or not the recogniser produced the accent.

   Spanish honorifics are listed both ways: Reina-Valera prints 'San Mateo',
   but nobody says the 'San' out loud. */
const ALL_BOOKS = [
  { name: 'Genesis', abbrev: ['Gen', 'Ge', 'Gn', 'Genèse'], chapters: 50 },
  { name: 'Exodus', abbrev: ['Exod', 'Ex', 'Exo', 'Exode', 'Éxodo'], chapters: 40 },
  { name: 'Leviticus', abbrev: ['Lev', 'Le', 'Lv', 'Lévitique', 'Levítico'], chapters: 27 },
  { name: 'Numbers', abbrev: ['Num', 'Nu', 'Nm', 'Nb', 'Nombres', 'Números'], chapters: 36 },
  { name: 'Deuteronomy', abbrev: ['Deut', 'Dt', 'De', 'Deutéronome', 'Deuteronomio'], chapters: 34 },
  { name: 'Joshua', abbrev: ['Josh', 'Jos', 'Jsh', 'Josué'], chapters: 24 },
  { name: 'Judges', abbrev: ['Judg', 'Jg', 'Jdgs', 'Juges', 'Jueces'], chapters: 21 },
  { name: 'Ruth', abbrev: ['Rth', 'Ru', 'Rut'], chapters: 4 },
  { name: '1 Samuel', abbrev: ['1 Sam', '1Sam', '1 Sm', '1Sm', '1 Sa', 'I Sam', 'ISam'], chapters: 31 },
  { name: '2 Samuel', abbrev: ['2 Sam', '2Sam', '2 Sm', '2Sm', '2 Sa', 'II Sam', 'IISam'], chapters: 24 },
  { name: '1 Kings', abbrev: ['1 Kgs', '1Kgs', '1 Ki', '1Ki', 'I Kgs', 'IKgs', '1 Rois', '1 Reyes'], chapters: 22 },
  { name: '2 Kings', abbrev: ['2 Kgs', '2Kgs', '2 Ki', '2Ki', 'II Kgs', 'IIKgs', '2 Rois', '2 Reyes'], chapters: 25 },
  { name: '1 Chronicles', abbrev: ['1 Chr', '1Chr', '1 Chron', '1Chron', 'I Chr', 'IChr', '1 Chroniques', '1 Crónicas'], chapters: 29 },
  { name: '2 Chronicles', abbrev: ['2 Chr', '2Chr', '2 Chron', '2Chron', 'II Chr', 'IIChr', '2 Chroniques', '2 Crónicas'], chapters: 36 },
  { name: 'Ezra', abbrev: ['Ezr', 'Ez', 'Esdras'], chapters: 10 },
  { name: 'Nehemiah', abbrev: ['Neh', 'Ne', 'Néhémie', 'Nehemías'], chapters: 13 },
  { name: 'Esther', abbrev: ['Esth', 'Es', 'Est', 'Ester'], chapters: 10 },
  { name: 'Job', abbrev: ['Jb'], chapters: 42 },
  { name: 'Psalms', abbrev: ['Ps', 'Psalm', 'Psa', 'Psm', 'Pss', 'Psaumes', 'Salmos'], chapters: 150 },
  { name: 'Proverbs', abbrev: ['Prov', 'Pr', 'Pro', 'Proverbes', 'Proverbios'], chapters: 31 },
  { name: 'Ecclesiastes', abbrev: ['Eccl', 'Ecc', 'Ec', 'Qoh', 'Ecclésiaste', 'Eclesiastés'], chapters: 12 },
  { name: 'Song of Solomon', abbrev: ['Song', 'SoS', 'SS', 'Cant', 'Cantique des Cantiques', 'Cantique', 'Cantar de Los Cantares'], chapters: 8 },
  { name: 'Isaiah', abbrev: ['Isa', 'Is', 'Isai', 'Ésaïe', 'Isaías'], chapters: 66 },
  { name: 'Jeremiah', abbrev: ['Jer', 'Je', 'Jr', 'Jérémie', 'Jeremías'], chapters: 52 },
  { name: 'Lamentations', abbrev: ['Lam', 'La', 'Lamentaciones'], chapters: 5 },
  { name: 'Ezekiel', abbrev: ['Ezek', 'Eze', 'Ezk', 'Ézéchiel', 'Ezequiel'], chapters: 48 },
  { name: 'Daniel', abbrev: ['Dan', 'Da', 'Dn'], chapters: 12 },
  { name: 'Hosea', abbrev: ['Hos', 'Ho', 'Osée', 'Oseas'], chapters: 14 },
  { name: 'Joel', abbrev: ['Jl'], chapters: 3 },
  { name: 'Amos', abbrev: ['Am'], chapters: 9 },
  { name: 'Obadiah', abbrev: ['Obad', 'Ob', 'Abdias'], chapters: 1 },
  { name: 'Jonah', abbrev: ['Jon', 'Jnh', 'Jonas'], chapters: 4 },
  { name: 'Micah', abbrev: ['Mic', 'Mi', 'Michée', 'Miqueas'], chapters: 7 },
  { name: 'Nahum', abbrev: ['Nah', 'Na'], chapters: 3 },
  { name: 'Habakkuk', abbrev: ['Hab', 'Hb', 'Habacuc'], chapters: 3 },
  { name: 'Zephaniah', abbrev: ['Zeph', 'Zep', 'Zp', 'Sophonie', 'Sofonías'], chapters: 3 },
  { name: 'Haggai', abbrev: ['Hag', 'Hg', 'Aggée', 'Hageo'], chapters: 2 },
  { name: 'Zechariah', abbrev: ['Zech', 'Zec', 'Zc', 'Zacharie', 'Zacarías'], chapters: 14 },
  { name: 'Malachi', abbrev: ['Mal', 'Ml', 'Malachie', 'Malaquías'], chapters: 4 },
  { name: 'Matthew', abbrev: ['Matt', 'Mt', 'Matthieu', 'San Mateo', 'Mateo'], chapters: 28 },
  { name: 'Mark', abbrev: ['Mk', 'Mrk', 'Marc', 'Marcos'], chapters: 16 },
  { name: 'Luke', abbrev: ['Lk', 'Lu', 'Luc', 'San Lucas', 'Lucas'], chapters: 24 },
  { name: 'John', abbrev: ['Jn', 'Jhn', 'Joh', 'Jean', 'Juan'], chapters: 21 },
  { name: 'Acts', abbrev: ['Act', 'Actes', 'Hechos'], chapters: 28 },
  { name: 'Romans', abbrev: ['Rom', 'Ro', 'Rm', 'Romains', 'Romanos'], chapters: 16 },
  { name: '1 Corinthians', abbrev: ['1 Cor', '1Cor', '1 Co', '1Co', 'I Cor', 'ICor', '1 Corinthiens', '1 Corintios'], chapters: 16 },
  { name: '2 Corinthians', abbrev: ['2 Cor', '2Cor', '2 Co', '2Co', 'II Cor', 'IICor', '2 Corinthiens', '2 Corintios'], chapters: 13 },
  { name: 'Galatians', abbrev: ['Gal', 'Ga', 'Galates', 'Gálatas'], chapters: 6 },
  { name: 'Ephesians', abbrev: ['Eph', 'Ep', 'Éphésiens', 'Efesios'], chapters: 6 },
  { name: 'Philippians', abbrev: ['Phil', 'Php', 'Phili', 'Philippiens', 'Filipenses'], chapters: 4 },
  { name: 'Colossians', abbrev: ['Col', 'Co', 'Colossiens', 'Colosenses'], chapters: 4 },
  { name: '1 Thessalonians', abbrev: ['1 Thess', '1Thess', '1 Th', '1Th', 'I Thess', 'IThess', '1 Thessaloniciens', '1 Thessalonicien', '1 Tesalonicenses'], chapters: 5 },
  { name: '2 Thessalonians', abbrev: ['2 Thess', '2Thess', '2 Th', '2Th', 'II Thess', 'IIThess', '2 Thessaloniciens', '2 Thessalonicien', '2 Tesalonicenses'], chapters: 3 },
  { name: '1 Timothy', abbrev: ['1 Tim', '1Tim', '1 Ti', '1Ti', 'I Tim', 'ITim', '1 Timothée', '1 Timoteo'], chapters: 6 },
  { name: '2 Timothy', abbrev: ['2 Tim', '2Tim', '2 Ti', '2Ti', 'II Tim', 'IITim', '2 Timothée', '2 Timoteo'], chapters: 4 },
  { name: 'Titus', abbrev: ['Tit', 'Ti', 'Tite', 'Tito'], chapters: 3 },
  { name: 'Philemon', abbrev: ['Philem', 'Phm', 'Pm', 'Filemón'], chapters: 1 },
  { name: 'Hebrews', abbrev: ['Heb', 'He', 'Hébreux', 'Hebreos'], chapters: 13 },
  { name: 'James', abbrev: ['Jas', 'Jm', 'Jacques', 'Santiago'], chapters: 5 },
  { name: '1 Peter', abbrev: ['1 Pet', '1Pet', '1 Pe', '1Pe', 'I Pet', 'IPet', '1 Pierre', '1 Pedro'], chapters: 5 },
  { name: '2 Peter', abbrev: ['2 Pet', '2Pet', '2 Pe', '2Pe', 'II Pet', 'IIPet', '2 Pierre', '2 Pedro'], chapters: 3 },
  { name: '1 John', abbrev: ['1 Jn', '1Jn', '1 Joh', '1Joh', 'I Jn', 'IJn', '1 Jean', '1 Juan'], chapters: 5 },
  { name: '2 John', abbrev: ['2 Jn', '2Jn', '2 Joh', '2Joh', 'II Jn', 'IJn2', '2 Jean', '2 Juan'], chapters: 1 },
  { name: '3 John', abbrev: ['3 Jn', '3Jn', '3 Joh', '3Joh', 'III Jn', 'IIIJn', '3 Jean', '3 Juan'], chapters: 1 },
  { name: 'Jude', abbrev: ['Jud', 'Judas'], chapters: 1 },
  { name: 'Revelation', abbrev: ['Rev', 'Re', 'Rv', 'Apocalypse', 'Apocalipsis'], chapters: 22 },
];

// Build lookup: lowercase name/abbrev -> normalized book name
const BOOK_LOOKUP = new Map();
ALL_BOOKS.forEach((book) => {
  BOOK_LOOKUP.set(book.name.toLowerCase(), book.name);
  book.abbrev.forEach((a) => BOOK_LOOKUP.set(a.toLowerCase().replace(/\./g, ''), book.name));
});

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

for (const [bookName, aliases] of Object.entries(EXTRA_BOOK_ALIASES)) {
  for (const alias of aliases) {
    BOOK_LOOKUP.set(alias.toLowerCase(), bookName);
  }
}

// Chapter counts for validation
const CHAPTER_COUNTS = {};
ALL_BOOKS.forEach((book) => { CHAPTER_COUNTS[book.name] = book.chapters; });

function normalizeBookName(input) {
  if (!input) return null;
  const cleaned = input.replace(/[\.\s]+/g, ' ').trim().toLowerCase();
  return BOOK_LOOKUP.get(cleaned) || null;
}

// Loose ref pattern — matches potential book+chapter, may include leading words
const LOOSE_REF_PATTERN = new RegExp(
  '((?:(?:[1-3]|I{1,3})\\s*)?[A-Z][a-z]+(?:\\s+(?:of\\s+)?[A-Z][a-z]+)?)\\s*(\\d+)(?::(\\d+)(?:\\s*[-–]\\s*(\\d+))?)?', 'gi'
);

// How a reference is actually *spoken* from a pulpit — "John chapter 3 verse 16",
// "Romans chapter 8", "First Peter chapter 5 verses 6 to 7". Written-form patterns
// never match these, so live transcripts produced no direct hits at all.
const SPOKEN_REF_PATTERN = new RegExp(
  '((?:(?:1st|2nd|3rd|[1-3]|first|second|third)\\s+)?[A-Z][a-z]+(?:\\s+(?:of\\s+)?[A-Z][a-z]+)?)' +
  '\\s+chapters?\\s+(\\d+)' +
  '(?:\\s*(?:,|and)?\\s*(?:verses?|vs\\.?)\\s+(\\d+)(?:\\s*(?:-|–|to|through)\\s*(\\d+))?)?',
  'gi'
);

const SPOKEN_ORDINALS = {
  first: '1', '1st': '1', second: '2', '2nd': '2', third: '3', '3rd': '3',
  premier: '1', primer: '1', primero: '1', deuxieme: '2', segundo: '2',
  troisieme: '3', tercero: '3', kinni: '1', kini: '1', keji: '2', keta: '3',
};
const SPOKEN_NUMBERS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
  wan: 1, won: 1, on: 1, tu: 2, too: 2, to: 2, tree: 3, free: 3, for: 4, fore: 4, foor: 4,
  fife: 5, fight: 5, sex: 6, sicks: 6, seek: 6, siven: 7, ate: 8, eights: 8, eighth: 8,
  nein: 9, tin: 10, tarty: 30, thurty: 30, foty: 40, fity: 50,
  uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  okan: 1, kan: 1, kini: 1, kinni: 1, meji: 2, keji: 2, meta: 3, keta: 3, merin: 4, kerin: 4,
  marun: 5, karun: 5, mefa: 6, kefa: 6, meje: 7, keje: 7, mejo: 8, kejo: 8, mesan: 9, kesan: 9,
  mewa: 10, kewa: 10, ogun: 20, ogbon: 30, ogoji: 40, aadota: 50,
};

/** Convert speech-to-text number words near reference markers into digits. */
function normalizeSpokenReferenceNumbers(text) {
  return String(text || '').replace(
    /\b(chapters?|verses?|vs\.?)\s+((?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[-\s]+(?:one|two|three|four|five|six|seven|eight|nine))?)\b(?:\s+(to|through)\s+((?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[-\s]+(?:one|two|three|four|five|six|seven|eight|nine))?)\b)?/gi,
    (_, marker, phrase, rangeWord, endPhrase) => {
      const toNumber = (value) => String(value).toLowerCase().split(/[-\s]+/)
        .reduce((sum, part) => sum + (SPOKEN_NUMBERS[part] || 0), 0);
      const start = toNumber(phrase);
      return `${marker} ${start}${endPhrase ? ` ${rangeWord} ${toNumber(endPhrase)}` : ''}`;
    },
  );
}

/** "First Corinthians" → "1 Corinthians" so the existing book lookup can resolve it. */
function normalizeSpokenBook(candidate) {
  const parts = String(candidate).trim().split(/\s+/);
  const lead = parts[0].toLowerCase();
  if (SPOKEN_ORDINALS[lead]) return [SPOKEN_ORDINALS[lead], ...parts.slice(1)].join(' ');
  return candidate;
}

/**
 * Finds the maximum length of contiguous matching words between query words and verse words.
 */
function maxContiguousWordMatch(queryWords, verseWords) {
  if (!queryWords.length || !verseWords.length) return { maxMatch: 0, matchRatio: 0 };
  const qClean = queryWords.map((w) => w.toLowerCase());
  const vClean = verseWords.map((w) => w.toLowerCase());
  let maxMatch = 0;

  for (let i = 0; i < qClean.length; i++) {
    for (let j = 0; j < vClean.length; j++) {
      let len = 0;
      while (i + len < qClean.length && j + len < vClean.length && qClean[i + len] === vClean[j + len]) {
        len++;
      }
      if (len > maxMatch) {
        maxMatch = len;
      }
    }
  }

  const matchRatio = maxMatch / Math.max(1, vClean.length);
  return { maxMatch, matchRatio };
}

// Homonym books that frequently appear in ordinary English speech
const HOMONYM_BOOKS = new Set(['Mark', 'Job', 'Acts', 'Numbers', 'Revelation', 'Ruth', 'James', 'Judges']);

function extractReferences(text) {
  text = normalizeSpokenReferenceNumbers(text);
  const results = [];
  const seen = new Set();
  let match;

  // Spoken form first — it carries the verse number, so it should win over the
  // written pattern's chapter-only interpretation of the same words.
  SPOKEN_REF_PATTERN.lastIndex = 0;
  while ((match = SPOKEN_REF_PATTERN.exec(text)) !== null) {
    const candidate = normalizeSpokenBook(match[1]);
    const chapter = parseInt(match[2], 10);
    const verseStart = match[3] ? parseInt(match[3], 10) : null;
    const verseEnd = match[4] ? parseInt(match[4], 10) : null;

    let book = null;
    let displayBook = candidate;
    const words = candidate.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const tryWords = words.slice(i).join(' ');
      book = normalizeBookName(tryWords);
      if (book) { displayBook = tryWords; break; }
    }
    if (!book) continue;
    const maxCh = CHAPTER_COUNTS[book];
    if (chapter < 1 || chapter > maxCh) continue;

    const key = `${book}|${chapter}|${verseStart || ''}|${verseEnd || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const fullRef = book + ' ' + chapter + (verseStart ? ':' + verseStart + (verseEnd && verseEnd !== verseStart ? '-' + verseEnd : '') : '');
    results.push({
      book, chapter,
      verseStart: verseStart || 1,
      verseEnd: verseEnd || verseStart || null,
      displayRef: fullRef,
      matchStart: match.index,
      matchEnd: match.index + match[0].length,
      confidence: verseStart ? 0.98 : 0.90,
    });
  }

  LOOSE_REF_PATTERN.lastIndex = 0;
  while ((match = LOOSE_REF_PATTERN.exec(text)) !== null) {
    const bookCandidate = match[1].trim();
    const chapter = parseInt(match[2], 10);
    const verseStart = match[3] ? parseInt(match[3], 10) : null;
    const verseEnd = match[4] ? parseInt(match[4], 10) : null;

    let book = null;
    let displayBook = bookCandidate;
    const words = bookCandidate.split(/\s+/);
    for (let i = words.length - 1; i >= 0; i--) {
      const tryWords = words.slice(i).join(' ');
      book = normalizeBookName(tryWords);
      if (book) {
        displayBook = tryWords;
        break;
      }
    }
    if (!book) continue;
    const maxCh = CHAPTER_COUNTS[book];
    if (chapter < 1 || chapter > maxCh) continue;

    // Guard against homonyms like "job 5", "acts 3" in ordinary text unless a verse is given
    // or it's preceded by biblical context markers
    if (HOMONYM_BOOKS.has(book) && !verseStart) {
      const preceding = text.slice(Math.max(0, match.index - 30), match.index).toLowerCase();
      const hasBibleMarker = /\b(book|chapter|read|reading|scripture|verse|bible|in|from|unto)\b/.test(preceding);
      if (!hasBibleMarker) continue;
    }

    const key = `${book}|${chapter}|${verseStart || ''}|${verseEnd || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const bookIdx = match[0].indexOf(displayBook);
    const fullRef = displayBook + ' ' + match[2] + (verseStart ? ':' + verseStart + (verseEnd && verseEnd !== verseStart ? '-' + verseEnd : '') : '');
    results.push({
      book, chapter,
      verseStart: verseStart || 1,
      verseEnd: verseEnd || verseStart || null,
      displayRef: fullRef,
      matchStart: match.index + (bookIdx >= 0 ? bookIdx : 0),
      matchEnd: match.index + (bookIdx >= 0 ? bookIdx : 0) + fullRef.length,
      confidence: verseStart ? 0.95 : 0.85,
    });
  }
  return results;
}

// Contextual hints — look for phrases like "in the book of", "Paul says in", "as it is written"
const CONTEXTUAL_PATTERNS = [
  /(?:in|from|read|reading)\s+(?:the\s+)?(?:book\s+(?:of\s+)?)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
  /(?:as|just\s+as)\s+(?:it\s+is\s+)?written\s+(?:in\s+)?(?:the\s+)?(?:book\s+(?:of\s+)?)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
  /(?:says|wrote|writes)\s+(?:in\s+)?(?:the\s+)?(?:book\s+(?:of\s+)?)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
  /(?:the\s+)?(?:apostle|prophet|author)\s+(?:paul|peter|john|james|jude|luke|matthew|mark|isaiah|jeremiah|moses|david|solomon)\s+(?:says|wrote|writes)\s+(?:in\s+)?/gi,
];

function extractContextualHints(text) {
  const hints = [];
  CONTEXTUAL_PATTERNS.forEach((pattern) => {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(text)) !== null) {
      const bookName = m[1];
      if (bookName) {
        const book = normalizeBookName(bookName);
        if (book) hints.push({ book, hintText: m[0].trim(), matchStart: m.index, matchEnd: m.index + m[0].length });
      }
    }
  });
  return hints;
}

// Flattened/cleaned verse lists, cached per version
const verbatimCorpusCache = new Map();

function getVerbatimCorpus(bibleData, versionId) {
  const key = versionId || 'KJV';
  const cached = verbatimCorpusCache.get(key);
  if (cached) return cached;
  const verses = [];
  for (const [book, chapters] of Object.entries(bibleData)) {
    for (const [ch, vMap] of Object.entries(chapters)) {
      for (const [vs, vt] of Object.entries(vMap)) {
        const cleaned = vt.replace(/[^\w\s']/g, '').toLowerCase();
        const vWords = cleaned.split(/\s+/).filter(Boolean);
        if (vWords.length < 4) continue;
        verses.push({
          book, chapter: parseInt(ch, 10), verse: parseInt(vs, 10),
          text: cleaned, original: vt,
          words: vWords, wordSet: new Set(vWords),
        });
      }
    }
  }
  verbatimCorpusCache.set(key, verses);
  return verses;
}

/**
 * Strict contiguous quote detection:
 * Requires at least 4 contiguous words in sequence (or 3 contiguous words for short verses covering >= 60% of verse).
 * Eliminates bag-of-words random matches completely.
 */
function findVerbatimQuotes(text, bibleData, versionId, candidates) {
  const results = [];
  const words = text.replace(/[^\w\s']/g, '').split(/\s+/).filter(Boolean);
  if (words.length < 3) return results;

  const corpus = Array.isArray(candidates)
    ? candidates
    : getVerbatimCorpus(bibleData, versionId);

  for (const v of corpus) {
    const vWords = v.words || v.text.split(/\s+/).filter(Boolean);
    if (vWords.length < 4) continue;

    const { maxMatch, matchRatio } = maxContiguousWordMatch(words, vWords);

    // Contiguous sequence requirement:
    // Minimum 4 continuous words, or 3 if it covers >= 60% of the entire verse
    if (maxMatch >= 4 || (maxMatch >= 3 && matchRatio >= 0.60)) {
      const confidence = Math.min(0.98, 0.70 + (maxMatch >= 6 ? 0.20 : maxMatch * 0.04) + matchRatio * 0.10);
      results.push({
        book: v.book,
        chapter: v.chapter,
        verse: v.verse,
        text: v.original,
        reference: `${v.book} ${v.chapter}:${v.verse}`,
        confidence,
        matchType: 'verbatim',
        wordOverlap: matchRatio,
        matchedWords: maxMatch,
        totalVerseWords: vWords.length,
      });
    }
  }

  // Deduplicate — keep highest confidence per verse
  const best = {};
  results.forEach((r) => {
    const key = `${r.book}|${r.chapter}|${r.verse}`;
    if (!best[key] || r.confidence > best[key].confidence) best[key] = r;
  });
  return Object.values(best).sort((a, b) => b.confidence - a.confidence).slice(0, 10);
}

module.exports = {
  ALL_BOOKS,
  normalizeBookName,
  extractReferences,
  extractContextualHints,
  findVerbatimQuotes,
  maxContiguousWordMatch,
};
