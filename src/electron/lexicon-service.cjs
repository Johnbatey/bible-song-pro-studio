/* =========================================================================
   Open-Source Strong's Lexicon Service (Public Domain / CC0)
   Provides Greek & Hebrew root word definitions, transliterations, and
   live sermon speech term matching.
   ========================================================================= */

const STRONGS_LEXICON = new Map([
  // GREEK (New Testament)
  ['G26', {
    strongs: 'G26',
    language: 'Greek',
    lemma: 'ἀγάπη',
    transliteration: 'Agapē',
    pronunciation: 'ah-gah\'--pay',
    gloss: 'Unconditional Love',
    definition: 'Divine, benevolent, self-sacrificial love; the unconditional love of God towards humanity.',
    etymology: 'from G25 (ἀγαπάω)',
    kjvUsage: 'charity, dear, love, beloved',
    triggers: ['agape', 'agapao', 'unconditional love', 'divine love', 'sacrificial love', 'g26']
  }],
  ['G3056', {
    strongs: 'G3056',
    language: 'Greek',
    lemma: 'λόγος',
    transliteration: 'Logos',
    pronunciation: 'log\'-os',
    gloss: 'The Word / Divine Revelation',
    definition: 'The divine Word, expression of thought, communication, or the incarnate Son of God (John 1:1).',
    etymology: 'from G3004 (λέγω)',
    kjvUsage: 'account, cause, communication, doctrine, intent, news, word',
    triggers: ['logos', 'the word', 'divine word', 'word of god', 'g3056']
  }],
  ['G5485', {
    strongs: 'G5485',
    language: 'Greek',
    lemma: 'χάρις',
    transliteration: 'Charis',
    pronunciation: 'khar\'-ece',
    gloss: 'Grace / Unmerited Favor',
    definition: 'Unmerited favor, divine grace, goodwill, and spiritual gift bestowed freely by God.',
    etymology: 'from G5463 (χαίρω)',
    kjvUsage: 'acceptable, benefit, favor, gift, grace, thank, thanks',
    triggers: ['charis', 'karis', 'unmerited favor', 'divine grace', 'g5485']
  }],
  ['G3982', {
    strongs: 'G3982',
    language: 'Greek',
    lemma: 'πείθω',
    transliteration: 'Peitho',
    pronunciation: 'pi\'-tho',
    gloss: 'To Persuade / Trust',
    definition: 'To persuade, induce one by words to believe, have confidence, or obey.',
    etymology: 'from G4102 (πίστις)',
    kjvUsage: 'agree, assure, believe, have confidence, persuade, trust',
    triggers: ['peitho', 'persuade', 'g3982']
  }],
  ['G1411', {
    strongs: 'G1411',
    language: 'Greek',
    lemma: 'δύναμις',
    transliteration: 'Dunamis',
    pronunciation: 'doo\'-nam-is',
    gloss: 'Miraculous Power',
    definition: 'Power, inherent strength, ability, or miraculous performance worked by the Holy Spirit.',
    triggers: ['dunamis', 'dynamis', 'miraculous power', 'supernatural power', 'g1411']
  }],
  ['G4151', {
    strongs: 'G4151',
    language: 'Greek',
    lemma: 'πνεῦμα',
    transliteration: 'Pneuma',
    pronunciation: 'pnyoo\'-mah',
    gloss: 'Spirit / Wind / Breath',
    definition: 'The Holy Spirit, human spirit, breath of life, or spiritual wind.',
    triggers: ['pneuma', 'holy spirit', 'breath of god', 'pneuma hagion', 'g4151']
  }],
  ['G1577', {
    strongs: 'G1577',
    language: 'Greek',
    lemma: 'ἐκκλησία',
    transliteration: 'Ekklesia',
    pronunciation: 'ek-klay-see\'-ah',
    gloss: 'The Called-Out Assembly',
    definition: 'An assembly, congregation, or community of believers called out for God\'s purpose.',
    triggers: ['ekklesia', 'ecclesia', 'called out ones', 'the church', 'g1577']
  }],
  ['G3875', {
    strongs: 'G3875',
    language: 'Greek',
    lemma: 'παράκλητος',
    transliteration: 'Parakletos',
    pronunciation: 'par-ak\'-lay-tos',
    gloss: 'Comforter / Advocate / Helper',
    definition: 'One called alongside to help; advocate, intercessor, comforter, and counselor (the Holy Spirit).',
    triggers: ['paraclete', 'parakletos', 'comforter', 'advocate', 'helper', 'g3875']
  }],
  ['G2842', {
    strongs: 'G2842',
    language: 'Greek',
    lemma: 'κοινωνία',
    transliteration: 'Koinonia',
    pronunciation: 'koy-nohn-ee\'-ah',
    gloss: 'Fellowship / Communion',
    definition: 'Intimate fellowship, sharing in common, spiritual communion, and joint participation.',
    triggers: ['koinonia', 'fellowship', 'communion', 'joint participation', 'g2842']
  }],
  ['G4991', {
    strongs: 'G4991',
    language: 'Greek',
    lemma: 'σωτηρία',
    transliteration: 'Soteria',
    pronunciation: 'so-tay-ree\'-ah',
    gloss: 'Salvation / Deliverance',
    definition: 'Deliverance, preservation, safety, and eternal salvation from spiritual death.',
    triggers: ['soteria', 'salvation', 'deliverance', 'spiritual rescue', 'g4991']
  }],
  ['G4678', {
    strongs: 'G4678',
    language: 'Greek',
    lemma: 'σοφία',
    transliteration: 'Sophia',
    pronunciation: 'sof-ee\'-ah',
    gloss: 'Divine Wisdom',
    definition: 'Wisdom, deep spiritual insight, skill in divine affairs, and practical godly discernment.',
    triggers: ['sophia', 'divine wisdom', 'godly wisdom', 'g4678']
  }],
  ['G2222', {
    strongs: 'G2222',
    language: 'Greek',
    lemma: 'ζωή',
    transliteration: 'Zoē',
    pronunciation: 'dzoh-ay\'',
    gloss: 'Abundant / Eternal Life',
    definition: 'Life in the absolute sense, uncreated eternal life of God bestowed upon believers.',
    triggers: ['zoe', 'zoe life', 'eternal life', 'divine life', 'g2222']
  }],
  ['G225', {
    strongs: 'G225',
    language: 'Greek',
    lemma: 'ἀλήθεια',
    transliteration: 'Aletheia',
    pronunciation: 'al-ay\'-thi-ah',
    gloss: 'Truth / Reality',
    definition: 'Truth, absolute divine reality, sincerity, and unhidden divine fact.',
    triggers: ['aletheia', 'divine truth', 'absolute truth', 'g225']
  }],
  ['G5368', {
    strongs: 'G5368',
    language: 'Greek',
    lemma: 'φιλέω',
    transliteration: 'Phileo',
    pronunciation: 'fil-eh\'-oh',
    gloss: 'Brotherly Affection',
    definition: 'Friendly affection, deep warm friendship, personal love and affection.',
    triggers: ['phileo', 'philia', 'brotherly love', 'affectionate love', 'g5368']
  }],
  ['G4102', {
    strongs: 'G4102',
    language: 'Greek',
    lemma: 'πίστις',
    transliteration: 'Pistis',
    pronunciation: 'pístis',
    gloss: 'Faith / Moral Conviction',
    definition: 'persuasion, i.e. credence; moral conviction (of religious truth, or the truthfulness of God or a religious teacher), especially reliance upon Christ for salvation; abstractly, constancy in such profession; by extension, the system of religious (Gospel) truth itself.',
    etymology: 'from G3982 (πείθω)',
    kjvUsage: 'assurance, belief, believe, faith, fidelity',
    triggers: ['pistis', 'faith', 'divine trust', 'g4102']
  }],
  ['G1680', {
    strongs: 'G1680',
    language: 'Greek',
    lemma: 'ἐλπίς',
    transliteration: 'Elpis',
    pronunciation: 'el-pece\'',
    gloss: 'Joyful Expectation / Hope',
    definition: 'Favorable and confident expectation of good, holy hope in God\'s promises.',
    triggers: ['elpis', 'hope', 'joyful expectation', 'g1680']
  }],
  ['G1515', {
    strongs: 'G1515',
    language: 'Greek',
    lemma: 'εἰρήνη',
    transliteration: 'Eirene',
    pronunciation: 'i-ray\'-nay',
    gloss: 'Peace / Tranquility',
    definition: 'Peace, harmony, tranquility of soul, and divine quietness resulting from salvation.',
    triggers: ['eirene', 'greek peace', 'inner peace', 'g1515']
  }],
  ['G4172', {
    strongs: 'G4172',
    language: 'Greek',
    lemma: 'πόλις',
    transliteration: 'Polis',
    pronunciation: 'pol\'-is',
    gloss: 'City / Town',
    definition: 'Probably from the same as G4171, or perhaps from G4183; a town (properly with walls, of greater or less size): — city.',
    etymology: 'from G4171 (πόλεμος) or G4183 (πολύς)',
    kjvUsage: 'city (164), town (1)',
    triggers: ['city', 'cities', 'town', 'polis', 'g4172', 'g2031']
  }],

  // HEBREW (Old Testament)
  ['H2617', {
    strongs: 'H2617',
    language: 'Hebrew',
    lemma: 'חֶסֶד',
    transliteration: 'Hesed',
    pronunciation: 'kheh\'-sed',
    gloss: 'Covenant Loyal Love',
    definition: 'Covenant love, steadfast kindness, unfailing mercy, and loyal devotion of Yahweh.',
    triggers: ['hesed', 'chesed', 'steadfast love', 'covenant love', 'lovingkindness', 'h2617']
  }],
  ['H7965', {
    strongs: 'H7965',
    language: 'Hebrew',
    lemma: 'שָׁלוֹם',
    transliteration: 'Shalom',
    pronunciation: 'shaw-lome\'',
    gloss: 'Completeness / Peace / Wholeness',
    definition: 'Peace, completeness, health, welfare, safety, soundness, and holistic flourishing.',
    triggers: ['shalom', 'divine peace', 'completeness', 'wholeness', 'h7965']
  }],
  ['H7307', {
    strongs: 'H7307',
    language: 'Hebrew',
    lemma: 'רוּחַ',
    transliteration: 'Ruach',
    pronunciation: 'roo\'-akh',
    gloss: 'Spirit / Wind / Breath of God',
    definition: 'Spirit, wind, breath; the life-giving Spirit of Yahweh active in creation and renewal.',
    triggers: ['ruach', 'ruach hakodesh', 'breath of yahweh', 'spirit of god', 'h7307']
  }],
  ['H7225', {
    strongs: 'H7225',
    language: 'Hebrew',
    lemma: 'רֵאשִׁית',
    transliteration: 'Reshith',
    pronunciation: 'ray-sheeth\'',
    gloss: 'Beginning / First Fruits / Chief',
    definition: 'First, beginning, best, chief part, time of commencement, or principal element.',
    etymology: 'from the same as H7218 (רֹאשׁ)',
    kjvUsage: 'beginning (50), chief (10), firstfruits (5)',
    triggers: ['beginning', 'firstfruits', 'h7225']
  }],
  ['H1254', {
    strongs: 'H1254',
    language: 'Hebrew',
    lemma: 'בָּרָא',
    transliteration: 'Bara',
    pronunciation: 'baw-raw\'',
    gloss: 'To Create / Shape / Form',
    definition: 'To create, shape, form out of nothing; specifically divine creation ex nihilo.',
    etymology: 'primitive root',
    kjvUsage: 'create (42), creator (3), make (2)',
    triggers: ['created', 'create', 'creator', 'h1254']
  }],
  ['H8064', {
    strongs: 'H8064',
    language: 'Hebrew',
    lemma: 'שָׁמַיִם',
    transliteration: 'Shamayim',
    pronunciation: 'shaw-mah\'-yim',
    gloss: 'Heavens / Sky / Expanse',
    definition: 'Dual of an unused singular; the visible heavens, sky, atmosphere, or abode of God.',
    etymology: 'from an unused root meaning to be lofty',
    kjvUsage: 'heaven (398), heavens (21), air (21)',
    triggers: ['heaven', 'heavens', 'sky', 'h8064']
  }],
  ['H776', {
    strongs: 'H776',
    language: 'Hebrew',
    lemma: 'אֶרֶץ',
    transliteration: 'Eretz',
    pronunciation: 'eh\'-rets',
    gloss: 'Earth / Land / Ground',
    definition: 'From an unused root probably meaning to be firm; the earth, land, country, or ground.',
    etymology: 'from an unused root',
    kjvUsage: 'land (1543), earth (712), country (140), ground (98)',
    triggers: ['earth', 'land', 'ground', 'h776']
  }],
  ['H216', {
    strongs: 'H216',
    language: 'Hebrew',
    lemma: 'אוֹר',
    transliteration: 'Or',
    pronunciation: 'ore',
    gloss: 'Light / Dawn / Illumination',
    definition: 'Light, morning light, sun light, or spiritual illumination.',
    etymology: 'from H215 (אוֹר)',
    kjvUsage: 'light (114), day (2), bright (1)',
    triggers: ['light', 'lights', 'h216']
  }],
  ['H2822', {
    strongs: 'H2822',
    language: 'Hebrew',
    lemma: 'חֹשֶׁךְ',
    transliteration: 'Choshek',
    pronunciation: 'kho-shek\'',
    gloss: 'Darkness / Obscurity / Night',
    definition: 'Darkness, literal night, obscurity, or spiritual blindness.',
    etymology: 'from H2821 (חָשַׁךְ)',
    kjvUsage: 'darkness (77), dark (2), obscurity (1)',
    triggers: ['darkness', 'dark', 'h2822']
  }],
  ['H3117', {
    strongs: 'H3117',
    language: 'Hebrew',
    lemma: 'יוֹם',
    transliteration: 'Yom',
    pronunciation: 'yome',
    gloss: 'Day / Time / Period',
    definition: 'Day, warm hours of daylight, 24-hour day, or specific age/time.',
    etymology: 'from an unused root meaning to be hot',
    kjvUsage: 'day (2008), time (64), today (41)',
    triggers: ['day', 'days', 'h3117']
  }],
  ['H3915', {
    strongs: 'H3915',
    language: 'Hebrew',
    lemma: 'לַיְלָה',
    transliteration: 'Layil',
    pronunciation: 'lah\'-yil',
    gloss: 'Night / Night-Season',
    definition: 'Night, night-season, hours of darkness.',
    etymology: 'from a root meaning to fold back',
    kjvUsage: 'night (227), season (4)',
    triggers: ['night', 'nights', 'h3915']
  }],
  ['H4325', {
    strongs: 'H4325',
    language: 'Hebrew',
    lemma: 'מַיִם',
    transliteration: 'Mayim',
    pronunciation: 'mah\'-yim',
    gloss: 'Water / Waters / Sea',
    definition: 'Water, waters of the sea, rivers, or primeval ocean deep.',
    etymology: 'dual of a primitive noun',
    kjvUsage: 'water (571), waters (12)',
    triggers: ['water', 'waters', 'h4325']
  }],
  ['H7549', {
    strongs: 'H7549',
    language: 'Hebrew',
    lemma: 'רָקִיעַ',
    transliteration: 'Raqia',
    pronunciation: 'raw-kee\'-ah',
    gloss: 'Firmament / Expanse / Celestial Vault',
    definition: 'An expanse, celestial vault, visible arch of sky supporting upper waters.',
    etymology: 'from H7554 (רָקַע)',
    kjvUsage: 'firmament (17)',
    triggers: ['firmament', 'expanse', 'h7549']
  }],
  ['H3068', {
    strongs: 'H3068',
    language: 'Hebrew',
    lemma: 'יְהוָה',
    transliteration: 'Yahweh',
    pronunciation: 'yah-weh\'',
    gloss: 'The Covenant Name of God',
    definition: 'The personal, self-existent covenant name of God ("I AM THAT I AM").',
    triggers: ['yahweh', 'yhwh', 'jehovah', 'the lord god', 'h3068']
  }],
  ['H430', {
    strongs: 'H430',
    language: 'Hebrew',
    lemma: 'אֱלֹהִים',
    transliteration: 'Elohim',
    pronunciation: 'el-o-heem\'',
    gloss: 'God / Supreme Creator',
    definition: 'God, Supreme Deity, Creator of heaven and earth, showing divine majesty and power.',
    triggers: ['elohim', 'elohim god', 'supreme creator', 'h430']
  }],
  ['H136', {
    strongs: 'H136',
    language: 'Hebrew',
    lemma: 'אֲדֹנָי',
    transliteration: 'Adonai',
    pronunciation: 'ad-o-noy\'',
    gloss: 'Lord / Sovereign Master',
    definition: 'Lord, Master, Sovereign Ruler of all creation.',
    triggers: ['adonai', 'lord master', 'sovereign lord', 'h136']
  }],
  ['H6918', {
    strongs: 'H6918',
    language: 'Hebrew',
    lemma: 'קָדוֹשׁ',
    transliteration: 'Kadosh',
    pronunciation: 'kaw-doshe\'',
    gloss: 'Holy / Set Apart',
    definition: 'Sacred, holy, set apart, pure, and utterly transcendent above all creation.',
    triggers: ['kadosh', 'qadosh', 'holy one', 'set apart', 'h6918']
  }],
  ['H3045', {
    strongs: 'H3045',
    language: 'Hebrew',
    lemma: 'יָדַע',
    transliteration: 'Yada',
    pronunciation: 'yaw-dah\'',
    gloss: 'To Know Intimately',
    definition: 'To know experientially, perceive, understand, and enter into intimate relational knowledge.',
    triggers: ['yada', 'yada love', 'intimate knowledge', 'to know god', 'h3045']
  }],
  ['H1288', {
    strongs: 'H1288',
    language: 'Hebrew',
    lemma: 'בָּרַךְ',
    transliteration: 'Baruch / Barak',
    pronunciation: 'baw-rak\'',
    gloss: 'To Bless / Praise',
    definition: 'To bless, invoke divine favor, kneel in praise, or confer divine prosperity.',
    triggers: ['baruch', 'barak', 'baruch hashem', 'blessed be', 'h1288']
  }],
  ['H8451', {
    strongs: 'H8451',
    language: 'Hebrew',
    lemma: 'תּוֹרָה',
    transliteration: 'Torah',
    pronunciation: 'to-raw\'',
    gloss: 'Instruction / Law / Guidance',
    definition: 'Direction, instruction, divine law, and God\'s foundational teaching for life.',
    triggers: ['torah', 'divine instruction', 'law of god', 'gods law', 'h8451']
  }],
  ['H1984', {
    strongs: 'H1984',
    language: 'Hebrew',
    lemma: 'הַלְלוּיָהּ',
    transliteration: 'Hallelujah',
    pronunciation: 'hal-le-loo-yah\'',
    gloss: 'Praise Ye Yahweh',
    definition: 'Call to praise Yahweh; joyful adoration and thanksgiving to God.',
    triggers: ['hallelujah', 'alleluia', 'praise the lord', 'h1984']
  }],
]);

// Build fast reverse-lookup map for trigger words
const TRIGGER_MAP = new Map();
for (const entry of STRONGS_LEXICON.values()) {
  TRIGGER_MAP.set(entry.strongs.toLowerCase(), entry);
  TRIGGER_MAP.set(entry.transliteration.toLowerCase(), entry);
  for (const trigger of entry.triggers) {
    TRIGGER_MAP.set(trigger.toLowerCase(), entry);
  }
}

/**
 * Lookup a word study entry by Strong's number or transliterated term.
 * @param {string} query
 * @returns {object|null}
 */
function lookup(query) {
  if (!query) return null;
  const clean = String(query).trim().toLowerCase();
  return TRIGGER_MAP.get(clean) || null;
}

/**
 * Scan a sermon transcript for known original language terms.
 * @param {string} text
 * @returns {object|null}
 */
function detectWordStudyTerms(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();

  for (const [trigger, entry] of TRIGGER_MAP.entries()) {
    if (trigger.length < 3) continue;
    const regex = new RegExp(`\\b${trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(lower)) {
      return entry;
    }
  }

  return null;
}

/**
 * Annotate verse text with inline Strong's entries for matching words.
 * @param {string} text
 * @param {string} [book]
 * @returns {Array<{ word: string, strongs?: object }>}
 */
function annotateVerseWithStrongs(text, book) {
  if (!text || typeof text !== 'string') return [];
  const words = text.split(/(\s+|[.,;:!?—–\-"'()]+)/);

  return words.map((token) => {
    const cleanWord = token.replace(/[^a-zA-Z]/g, '').toLowerCase();
    if (cleanWord.length < 2) {
      return { word: token };
    }
    const match = TRIGGER_MAP.get(cleanWord);
    if (match) {
      return { word: token, strongs: match };
    }
    return { word: token };
  });
}

module.exports = {
  STRONGS_LEXICON,
  lookup,
  detectWordStudyTerms,
  annotateVerseWithStrongs,
};
