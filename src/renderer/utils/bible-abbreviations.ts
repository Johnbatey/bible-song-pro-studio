/* =========================================================================
   bible-abbreviations — intelligent Bible version & book name abbreviation
   -------------------------------------------------------------------------
   Handles the 250+ to 1000+ Bible versions across multiple languages:
   - Maps full names (e.g. "New Living Translation 1996", "NEWLIVINGTRANSLATION1996")
     to their concise acronyms (e.g. "NLT").
   - Intelligently extracts acronyms from parenthesized notes, PascalCase/camelCase,
     and compound words.
   - Provides book name abbreviation matching standard ecclesiastical style
     (e.g. "Genesis" -> "Gen.", "1 Corinthians" -> "1 Cor.").
   ========================================================================= */

/**
 * Direct lookup dictionary for popular and widely used Bible versions.
 * Normalized keys (lowercase, non-alphanumeric removed).
 */
const BIBLE_VERSION_MAP: Record<string, string> = {
  // English
  newlivingtranslation: 'NLT',
  newlivingtranslation1996: 'NLT',
  newlivingtranslation2015: 'NLT',
  newliving: 'NLT',
  nlt: 'NLT',
  nlt1996: 'NLT',
  nlt2015: 'NLT',

  newinternationalversion: 'NIV',
  newinternationalversion1984: 'NIV',
  newinternationalversion2011: 'NIV',
  newinternationalversionuk: 'NIVUK',
  niv: 'NIV',
  niv84: 'NIV',
  niv2011: 'NIV',
  nivuk: 'NIVUK',

  kingjamesversion: 'KJV',
  kingjamesversion1611: 'KJV',
  kingjamesversion1769: 'KJV',
  kingjames: 'KJV',
  kjv: 'KJV',
  kjv1611: 'KJV',
  kjv1769: 'KJV',
  authorisedversion: 'AV',
  authorizedversion: 'AV',

  newkingjamesversion: 'NKJV',
  newkingjames: 'NKJV',
  nkjv: 'NKJV',

  englishstandardversion: 'ESV',
  englishstandardversion2016: 'ESV',
  englishstandard: 'ESV',
  esv: 'ESV',

  newamericanstandardbible: 'NASB',
  newamericanstandardbible1995: 'NASB',
  newamericanstandardbible2020: 'NASB',
  newamericanstandard: 'NASB',
  nasb: 'NASB',
  nasb95: 'NASB',
  nasb1995: 'NASB',
  nasb2020: 'NASB',

  amplifiedbible: 'AMP',
  amplifiedbibleclassic: 'AMPC',
  amplified: 'AMP',
  amp: 'AMP',
  ampc: 'AMPC',

  themessage: 'MSG',
  themessagebible: 'MSG',
  message: 'MSG',
  msg: 'MSG',

  christianstandardbible: 'CSB',
  christianstandard: 'CSB',
  csb: 'CSB',

  holmanchristianstandardbible: 'HCSB',
  holmanchristianstandard: 'HCSB',
  hcsb: 'HCSB',

  contemporaryenglishversion: 'CEV',
  cev: 'CEV',

  goodnewstranslation: 'GNT',
  goodnewsbible: 'GNB',
  gnt: 'GNT',
  gnb: 'GNB',

  revisedstandardversion: 'RSV',
  revisedstandard: 'RSV',
  rsv: 'RSV',

  newrevisedstandardversion: 'NRSV',
  newrevisedstandardversionupdatededition: 'NRSVUE',
  nrsv: 'NRSV',
  nrsvue: 'NRSVUE',
  nrsva: 'NRSV',

  thepassiontranslation: 'TPT',
  passiontranslation: 'TPT',
  tpt: 'TPT',

  newcenturyversion: 'NCV',
  ncv: 'NCV',

  newenglishtranslation: 'NET',
  netbible: 'NET',
  net: 'NET',

  americanstandardversion: 'ASV',
  americanstandardversion1901: 'ASV',
  asv: 'ASV',

  darbytranslation: 'DBY',
  darbytranslation1890: 'DBY',
  darby: 'DBY',
  dby: 'DBY',

  youngsliteraltranslation: 'YLT',
  youngsliteraltranslation1898: 'YLT',
  youngsliteral: 'YLT',
  ylt: 'YLT',

  legacystandardbible: 'LSB',
  lsb: 'LSB',

  bereanstandardbible: 'BSB',
  bereanstudybible: 'BSB',
  bsb: 'BSB',

  treeoflifeversion: 'TLV',
  tlv: 'TLV',

  modernenglishversion: 'MEV',
  mev: 'MEV',

  commonenglishbible: 'CEB',
  ceb: 'CEB',

  easytoreadversion: 'ERV',
  erv: 'ERV',

  internationalchildrensbible: 'ICB',
  icb: 'ICB',

  newinternationalreadersversion: 'NIRV',
  nirv: 'NIRV',

  completejewishbible: 'CJB',
  cjb: 'CJB',

  orthodoxjewishbible: 'OJB',
  ojb: 'OJB',

  worldenglishbible: 'WEB',
  web: 'WEB',

  bibleinbasicenglish: 'BBE',
  bbe: 'BBE',

  genevabible: 'GNV',
  geneva1599: 'GNV',
  gnv: 'GNV',

  douayrheims: 'DRA',
  douayrheimsbible: 'DRA',
  drb: 'DRA',
  dra: 'DRA',

  // French
  louissegond: 'LSG',
  louissegond1910: 'LSG',
  louissegond1979: 'LSG',
  lsg: 'LSG',
  lsg1910: 'LSG',

  ostervald: 'OST',
  ostervald1881: 'OST',
  ostervald1996: 'OST',
  ost: 'OST',

  francaiscourant: 'BFC',
  bfc: 'BFC',
  paroledevie: 'PDV',
  pdv: 'PDV',
  nouvelleeditiondegeneve: 'NEG',
  neg: 'NEG',
  bibledusemeur: 'BDS',
  bds: 'BDS',
  tobible: 'TOB',
  tob: 'TOB',

  // Spanish
  reinavalera: 'RVR',
  reinavalera1909: 'RVR',
  reinavalera1960: 'RVR60',
  reinavalera1995: 'RVR95',
  reinavalerapuritacompletada: 'RVC',
  rvr: 'RVR',
  rvr1909: 'RVR',
  rvr1960: 'RVR60',
  rvr60: 'RVR60',
  rvr1995: 'RVR95',
  rvr95: 'RVR95',
  rv1909: 'RVR',
  rv09: 'RVR',

  nuevainternacional: 'NVI',
  nuevapruebainternacional: 'NVI',
  nvi: 'NVI',
  dioshablahoy: 'DHH',
  dhh: 'DHH',
  palabraddediosparatodos: 'PDT',
  pdt: 'PDT',
  nuevatraduccionviviente: 'NTV',
  ntv: 'NTV',
  bibliadelasamericas: 'LBLA',
  lbla: 'LBLA',
  nuevabibliadelasamericas: 'NBLA',
  nbla: 'NBLA',

  // Portuguese
  almeidarevistaecorrigida: 'ARC',
  arc: 'ARC',
  almeidarevisadaeatualizada: 'ARA',
  almeidarevistaeatualizada: 'ARA',
  ara: 'ARA',
  almeidacorrigidafiel: 'ACF',
  acf: 'ACF',
  almeidaseculoxxi: 'A21',
  a21: 'A21',
  novatraducaonalenguagemdehoje: 'NTLH',
  ntlh: 'NTLH',
  novatraduccionviva: 'NVT',
  nvt: 'NVT',

  // German
  lutherbibel: 'LUT',
  luther1912: 'LUT',
  luther1984: 'LUT',
  lut: 'LUT',
  schlachter: 'SCH',
  schlachter2000: 'SCH',
  sch2000: 'SCH',
  sch: 'SCH',
  elberfelder: 'ELB',
  elb: 'ELB',
  einheitsuebersetzung: 'EUB',
  eub: 'EUB',
  gutehoffnung: 'GHB',
  neuegenferuebersetzung: 'NGU',
  ngu: 'NGU',

  // Italian
  nuovariveduta: 'NRV',
  nuovariveduta2006: 'NR06',
  nuovadiodati: 'LND',
  lnd: 'LND',
  conferenzaepiscopaleitaliana: 'CEI',
  cei: 'CEI',

  // Russian / Slavic
  synodal: 'RST',
  synodaltranslation: 'RST',
  russiansynodal: 'RST',
  rst: 'RST',

  // Tagalog
  datingbiblia: 'TAB',
  angdatingbiblia: 'TAB',
  tab: 'TAB',
  adb: 'TAB',
  magandangbalitabiblia: 'MBB',
  mbb: 'MBB',

  // Chinese
  chineseunionversion: 'CUV',
  cuv: 'CUV',
  cuvs: 'CUVS',
  cuvt: 'CUVT',
  contemporarychineseversion: 'CCV',
  ccv: 'CCV',

  // Korean
  koreanrevisedversion: 'KRV',
  krv: 'KRV',
  newkoreanrevisedversion: 'NKRV',
  nkrv: 'NKRV',

  // African languages
  bibelimimo: 'YOR',
  yorubabible: 'YOR',
  yor: 'YOR',
  igbobible: 'IGB',
  baibul: 'IGB',
  igb: 'IGB',
  hausabible: 'HAU',
  littafimaitsarki: 'HAU',
  hau: 'HAU',
  swahiliunionversion: 'SUV',
  suv: 'SUV',
  nigerianpidgin: 'NPB',
  pidginbible: 'NPB',
  npb: 'NPB',
};

const VERSION_PREFIX_STOPWORDS = new Set([
  'the', 'of', 'and', 'a', 'an', 'for', 'in', 'to',
  'de', 'da', 'do', 'dos', 'das', 'del', 'la', 'le', 'les', 'du', 'des', 'e', 'y', 'et', 'und', 'der', 'die', 'das', 'von',
  'bible', 'version', 'translation', 'edition', 'revised', 'revision', 'rev'
]);

function buildVersionPrefix(tokens: string[]): string {
  const words = tokens.filter((token) => {
    if (!/[A-Za-z]/.test(token)) return false;
    return !VERSION_PREFIX_STOPWORDS.has(token.toLowerCase());
  });
  if (words.length < 2) return '';
  return words.slice(0, 2).map((word) => word[0].toUpperCase()).join('');
}

function abbreviateSingleWord(word: string): string {
  const letters = String(word || '').replace(/[^A-Za-z]/g, '');
  if (!letters) return word || '';
  if (letters.length <= 6 && letters === letters.toUpperCase()) return letters;
  if (letters.length <= 4) return letters.toUpperCase();
  const vowels = 'aeiou';
  let abbr = letters[0];
  let foundFirstConsonant = false;
  let seenVowelAfterFirst = false;
  for (let i = 1; i < letters.length && abbr.length < 3; i++) {
    const ch = letters[i];
    const isVowel = vowels.includes(ch.toLowerCase());
    if (!foundFirstConsonant) {
      if (!isVowel) {
        abbr += ch;
        foundFirstConsonant = true;
      }
    } else if (seenVowelAfterFirst) {
      if (!isVowel) {
        abbr += ch;
        break;
      }
    } else if (isVowel) {
      seenVowelAfterFirst = true;
    }
  }
  if (abbr.length < 3) abbr = letters.slice(0, 3);
  return abbr.toUpperCase();
}

/**
 * Shortens any Bible version name into its canonical/abbreviated form.
 * Works seamlessly with 250+ to 1000+ versions.
 *
 * @example
 * shortenBibleVersionName("New Living Translation 1996") // "NLT"
 * shortenBibleVersionName("NEWLIVINGTRANSLATION1996") // "NLT"
 * shortenBibleVersionName("King James Version (1769)") // "KJV"
 * shortenBibleVersionName("American Standard Version (1901)") // "ASV"
 * shortenBibleVersionName("Louis Segond 1910") // "LSG"
 * shortenBibleVersionName("Reina-Valera 1909") // "RVR"
 */
export function shortenBibleVersionName(name: string): string {
  if (!name || typeof name !== 'string') return name || '';
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  const normalized = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (BIBLE_VERSION_MAP[normalized]) return BIBLE_VERSION_MAP[normalized];
  const withoutYear = normalized.replace(/\d{4}$/, '');
  if (BIBLE_VERSION_MAP[withoutYear]) return BIBLE_VERSION_MAP[withoutYear];

  // Acronym in parens, e.g. "King James Version (KJV)" -> KJV, ignoring years like (1769)
  const parenMatch = trimmed.match(/\(([A-Za-z][A-Za-z0-9]{1,5})\)/);
  if (parenMatch) return parenMatch[1].toUpperCase();

  // Strip trailing parenthesized years like (1901) or (1769)
  const withoutParenYear = trimmed.replace(/\s*\(\d{4}\)\s*/g, '').trim();

  // If already an uppercase acronym like "NLT", "KJV", "ESV", "NASB"
  if (/^[A-Z0-9]{2,6}$/.test(withoutParenYear)) return withoutParenYear;

  // Split PascalCase, camelCase, words, underscores, or digits
  const splitWords = withoutParenYear
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([A-Za-z]+)(\d+)/g, '$1 $2')
    .split(/[\s_\-]+/)
    .filter(Boolean);

  const cleanTokens = splitWords
    .map((token) => token.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ''))
    .filter(Boolean);
  const wordTokens = cleanTokens.filter((token) => /[A-Za-z]/.test(token));
  const numberTokens = cleanTokens.filter((token) => /^\d+$/.test(token));

  if (
    wordTokens.length === 1 &&
    wordTokens[0].length <= 6 &&
    wordTokens.length + numberTokens.length === cleanTokens.length
  ) {
    return wordTokens[0].toUpperCase();
  }

  // Initials of significant words (filtering out prepositions and conjunctions)
  const significantWords = wordTokens.filter(
    (token) => !VERSION_PREFIX_STOPWORDS.has(token.toLowerCase())
  );
  const wordsForInitials = significantWords.length >= 2 ? significantWords : wordTokens;
  const initials = wordsForInitials.map((token) => token[0].toUpperCase()).join('');
  if (initials.length >= 2 && initials.length <= 6) return initials;

  if (wordTokens.length === 1) return abbreviateSingleWord(wordTokens[0]);

  const letters = trimmed.replace(/[^A-Za-z0-9]/g, '');
  if (letters) return letters.slice(0, 6).toUpperCase();
  return trimmed;
}

const BOOK_ABBREVIATIONS: Record<string, string> = {
  genesis: 'Gen.',
  exodus: 'Ex.',
  leviticus: 'Lev.',
  numbers: 'Num.',
  deuteronomy: 'Deut.',
  joshua: 'Josh.',
  judges: 'Judg.',
  ruth: 'Ruth',
  '1 samuel': '1 Sam.',
  '2 samuel': '2 Sam.',
  '1 kings': '1 Kings',
  '2 kings': '2 Kings',
  '1 chronicles': '1 Chron.',
  '2 chronicles': '2 Chron.',
  ezra: 'Ezra',
  nehemiah: 'Neh.',
  esther: 'Esth.',
  job: 'Job',
  psalms: 'Ps.',
  psalm: 'Ps.',
  proverbs: 'Prov.',
  ecclesiastes: 'Eccles.',
  'song of solomon': 'Song.',
  'song of songs': 'Song.',
  isaiah: 'Isa.',
  jeremiah: 'Jer.',
  lamentations: 'Lam.',
  ezekiel: 'Ezek.',
  daniel: 'Dan.',
  hosea: 'Hos.',
  joel: 'Joel',
  amos: 'Amos',
  obadiah: 'Obad.',
  jonah: 'Jonah',
  micah: 'Mic.',
  nahum: 'Nah.',
  habakkuk: 'Hab.',
  zephaniah: 'Zeph.',
  haggai: 'Hag.',
  zechariah: 'Zech.',
  malachi: 'Mal.',
  matthew: 'Matt.',
  mark: 'Mark',
  luke: 'Luke',
  john: 'John',
  acts: 'Acts',
  romans: 'Rom.',
  '1 corinthians': '1 Cor.',
  '2 corinthians': '2 Cor.',
  galatians: 'Gal.',
  ephesians: 'Eph.',
  philippians: 'Phil.',
  colossians: 'Col.',
  '1 thessalonians': '1 Thess.',
  '2 thessalonians': '2 Thess.',
  '1 timothy': '1 Tim.',
  '2 timothy': '2 Tim.',
  titus: 'Titus',
  philemon: 'Philem.',
  hebrews: 'Heb.',
  james: 'James',
  '1 peter': '1 Pet.',
  '2 peter': '2 Pet.',
  '1 john': '1 John',
  '2 john': '2 John',
  '3 john': '3 John',
  jude: 'Jude',
  revelation: 'Rev.',
  revelations: 'Rev.',
};

function shortenBibleToken(token: string): string {
  if (!token) return token;
  const match = token.match(/^(.+?)([.,;:]*)$/);
  const core = match ? match[1] : token;
  const suffix = match ? match[2] : '';
  if (!core) return token;
  if (/\d/.test(core) || /^[ivxlcdm]+$/i.test(core)) return core + suffix;
  if (core.length <= 4) return core + suffix;
  return core.slice(0, 3) + '.' + suffix;
}

/**
 * Shortens a Bible book name or reference prefix into standard abbreviation.
 *
 * @example
 * shortenBibleBookName("Genesis") // "Gen."
 * shortenBibleBookName("1 Corinthians") // "1 Cor."
 * shortenBibleBookName("Genesis 1:2") // "Gen. 1:2"
 */
export function shortenBibleBookName(name: string): string {
  if (!name || typeof name !== 'string') return name || '';
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  const lower = trimmed.toLowerCase();
  if (BOOK_ABBREVIATIONS[lower]) return BOOK_ABBREVIATIONS[lower];

  // If passed a full reference like "1 Corinthians 13:4" or "Genesis 1:2"
  const refMatch = trimmed.match(/^((?:\d\s+)?[A-Za-zÀ-ÿ\s]+?)\s+(\d+[:\d–,-]*)$/);
  if (refMatch) {
    const book = refMatch[1].trim();
    const chapVerse = refMatch[2].trim();
    const bookLower = book.toLowerCase();
    const shortBook = BOOK_ABBREVIATIONS[bookLower] || book
      .split(/\s+/)
      .map((part) => (part.includes('-') ? part.split('-').map(shortenBibleToken).join('-') : shortenBibleToken(part)))
      .join(' ');
    return `${shortBook} ${chapVerse}`;
  }

  return trimmed
    .split(/\s+/)
    .map((part) => (part.includes('-') ? part.split('-').map(shortenBibleToken).join('-') : shortenBibleToken(part)))
    .join(' ');
}

export interface FormatBibleReferenceOptions {
  showVersion?: boolean;
  shortenVersions?: boolean;
  shortenBooks?: boolean;
}

/**
 * Formats a Bible reference string honoring user Bible display options:
 * - Extracts and abbreviates version tags (e.g. "NEWLIVINGTRANSLATION1996" -> "NLT")
 * - Handles showVersion (true / false)
 * - Handles shortenBooks (e.g. "Genesis 1:2" -> "Gen. 1:2")
 *
 * @example
 * formatBibleReference("Genesis 1:2 (NEWLIVINGTRANSLATION1996)", "NEWLIVINGTRANSLATION1996", { shortenVersions: true })
 * // => "Genesis 1:2 (NLT)"
 */
export function formatBibleReference(
  rawReference: string,
  version?: string,
  options?: FormatBibleReferenceOptions
): string {
  const showVersion = options?.showVersion !== false;
  const shortenVersions = options?.shortenVersions !== false;
  const shortenBooks = Boolean(options?.shortenBooks);

  let baseRef = (rawReference || '').trim();
  let verTag = (version || '').trim();

  // Strip trailing (VERSION) tag if already present in rawReference
  const parenMatch = baseRef.match(/\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    if (!verTag) verTag = parenMatch[1];
    baseRef = baseRef.slice(0, parenMatch.index).trim();
  }

  // Also handle "Book Chap:Verse VERSION" format if space-separated
  if (verTag && baseRef.toLowerCase().endsWith(` ${verTag.toLowerCase()}`)) {
    baseRef = baseRef.slice(0, baseRef.length - verTag.length).trim();
  }

  if (shortenBooks) {
    baseRef = shortenBibleBookName(baseRef);
  }

  if (!showVersion || !verTag) {
    return baseRef;
  }

  const displayVer = shortenVersions ? shortenBibleVersionName(verTag) : verTag;
  return `${baseRef} (${displayVer})`;
}
