const assert = require('node:assert/strict');

const {
  arrangeLyrics,
  canonicalSectionKey,
  isChordLine,
} = require('../src/electron/lyric-sections.cjs');

/**
 * Auto-arrange has two halves that fail in ways types cannot see.
 *
 * The sectioniser is a heuristic. Every rule in it exists because some real
 * lyric sheet broke the rule before it: a chord line read as lyrics, a chorus
 * typed out three times becoming three slides, `[G]Amazing grace` opening a
 * section because the old parser matched `[...]` as a prefix and treated any
 * tag starting with "v" as a verse. Nothing about that is expressible in a
 * type, and all of it silently produces a plausible-looking wrong answer.
 *
 * The expansion has one specific bug encoded here as assertion 19. Scene ids
 * are built from the slide id, so an arrangement that plays the chorus three
 * times used to emit three identical ids — which lit every chorus card LIVE at
 * once, made Next jump backwards, collided the scroll refs, and handed React
 * duplicate keys. All four compile perfectly.
 */

/* Checks are collected and run at the end rather than as they are declared,
   because some of them are async — the arrange orchestrator awaits what is
   normally an IPC call. Running them here would have let a rejected promise
   pass as a tick. */
const checks = [];
function check(label, fn) {
  checks.push([label, fn]);
}

const names = (result) => result.sections.map((s) => s.name);

// ---------------------------------------------------------------- Part A

const CHORUS = 'Praise him praise him all the day\nPraise him praise him evermore';

check('unlabelled sheet, chorus typed 3x -> one chorus section, 6-entry order', () => {
  const result = arrangeLyrics([
    'Amazing grace how sweet the sound\nThat saved a wretch like me',
    CHORUS,
    'I once was lost but now am found\nWas blind but now I see',
    CHORUS,
    'Through many dangers toils and snares\nI have already come',
    CHORUS,
  ].join('\n\n'));

  assert.deepEqual(names(result), ['Verse 1', 'Chorus', 'Verse 2', 'Verse 3']);
  assert.equal(result.verseOrder.length, 6);
  assert.equal(result.verseOrder.filter((x) => x === 'Chorus').length, 3);
});

check('chorus repeated with an extra tail line still clusters', () => {
  // The min() denominator earns its place here. Under a Jaccard denominator
  // this scores ~0.7 and splits into two sections.
  const result = arrangeLyrics([
    'Amazing grace how sweet the sound\nThat saved a wretch like me',
    CHORUS,
    'I once was lost but now am found\nWas blind but now I see',
    `${CHORUS}\nOh oh oh`,
  ].join('\n\n'));

  assert.deepEqual(names(result), ['Verse 1', 'Chorus', 'Verse 2']);
  assert.deepEqual(result.verseOrder, ['Verse 1', 'Chorus', 'Verse 2', 'Chorus']);
});

check('colon headers are honoured verbatim, no inference', () => {
  const result = arrangeLyrics('Verse 1:\nAmazing grace\n\nChorus:\nPraise him all the day');
  assert.deepEqual(names(result), ['Verse 1', 'Chorus']);
  assert.equal(result.confidence, 1);
});

check('whole-line bracket headers', () => {
  const result = arrangeLyrics('[Verse 1]\nAmazing grace\n\n[Chorus]\nPraise him');
  assert.deepEqual(names(result), ['Verse 1', 'Chorus']);
});

check('[Vamp] is a header but [G]Amazing grace is a lyric', () => {
  // Pins the old `tag.startsWith('v')` bug from song-import-service.cjs:74,
  // which made both of these open a verse.
  const result = arrangeLyrics('[Verse 1]\n[G]Amazing grace how sweet\n\n[Vamp]\nOh oh oh');
  assert.deepEqual(names(result), ['Verse 1', 'Vamp']);
  assert.deepEqual(result.sections[0].lines, ['Amazing grace how sweet']);
});

check('a bracket header outside the lexicon is still a header; a bare chord is not', () => {
  // The lexicon classifies headers, it does not gatekeep them — otherwise
  // [Instrumental Break] reads as a lyric. A chord alone in brackets is the one
  // thing that must not open a section.
  const result = arrangeLyrics('[Opening Refrain]\nA one\n\n[Instrumental Break]\nB one');
  assert.deepEqual(names(result), ['Opening Refrain', 'Instrumental Break']);

  const chord = arrangeLyrics('[Verse 1]\nA one\n[G]\nA two');
  assert.deepEqual(names(chord), ['Verse 1']);
  assert.deepEqual(chord.sections[0].lines, ['A one', 'A two']);
});

check('a verse after a tagged chorus is not swallowed into it', () => {
  // A blank line closes the open section even in header mode. Without that,
  // untagged lyrics following a tagged section were appended to it.
  const result = arrangeLyrics(`A one\nA two\n\n[Chorus]\n${CHORUS}\n\nB one\nB two`);
  assert.equal(result.sections.length, 3);
  assert.deepEqual(result.sections[2].lines, ['B one', 'B two']);
});

check('ChordPro {soc}/{eoc} and {comment:} survive', () => {
  // Pins song-import-service.cjs:80, which dropped every line starting with `{`.
  const result = arrangeLyrics('{title: Test}\n{soc}\nPraise him all the day\n{eoc}\n{comment: Bridge}\nYou alone are worthy');
  assert.deepEqual(names(result), ['Chorus', 'Bridge']);
});

check('chord-only lines are dropped, lyric lines kept', () => {
  const result = arrangeLyrics('G          D\nAmazing grace how sweet\nEm         C\nThat saved a wretch');
  assert.deepEqual(result.sections[0].lines, ['Amazing grace how sweet', 'That saved a wretch']);
});

check('lyrics before the first tag are kept', () => {
  // These used to vanish: the old parser had no open section to put them in.
  const result = arrangeLyrics('Amazing grace how sweet\nThat saved a wretch\n[Chorus]\nPraise him');
  assert.equal(result.sections.length, 2);
  assert.deepEqual(result.sections[0].lines, ['Amazing grace how sweet', 'That saved a wretch']);
});

check('no blank lines anywhere -> quatrains, and it admits it guessed', () => {
  const lines = Array.from({ length: 12 }, (_, i) => `Line number ${i + 1} of the song`);
  const result = arrangeLyrics(lines.join('\n'));
  assert.equal(result.sections.length, 3);
  assert.ok(result.confidence < 0.6, `expected low confidence, got ${result.confidence}`);
});

check('a single block emits no arrangement', () => {
  const result = arrangeLyrics('Amazing grace how sweet\nThat saved a wretch');
  assert.equal(result.sections.length, 1);
  assert.deepEqual(result.verseOrder, []);
});

check('an order that is just each section once is suppressed', () => {
  const result = arrangeLyrics('[Verse 1]\nOne line\n\n[Verse 2]\nAnother line');
  assert.deepEqual(result.verseOrder, []);
});

check('empty and whitespace-only input do not throw', () => {
  assert.deepEqual(arrangeLyrics('').sections, []);
  assert.deepEqual(arrangeLyrics('   \n  \n').sections, []);
  assert.deepEqual(arrangeLyrics(null).sections, []);
  assert.deepEqual(arrangeLyrics(undefined).verseOrder, []);
});

check('section lexicon resolves the shorthands OpenLyrics and ChordPro use', () => {
  assert.deepEqual(canonicalSectionKey('V1'), { key: 'verse', number: 1 });
  assert.deepEqual(canonicalSectionKey('Verse 2:'), { key: 'verse', number: 2 });
  assert.deepEqual(canonicalSectionKey('c'), { key: 'chorus', number: null });
  assert.deepEqual(canonicalSectionKey('PRE-CHORUS 2'), { key: 'prechorus', number: 2 });
  assert.deepEqual(canonicalSectionKey('Refrain'), { key: 'chorus', number: null });
  assert.deepEqual(canonicalSectionKey('Verse II'), { key: 'verse', number: 2 });
  // Not sections — this is what keeps a chord from opening one.
  assert.equal(canonicalSectionKey('G'), null);
  assert.equal(canonicalSectionKey('Amazing grace'), null);
  assert.equal(canonicalSectionKey(''), null);
});

check('chord-line detection accepts real chords and rejects lyrics', () => {
  assert.equal(isChordLine('G  D  Em  C'), true);
  assert.equal(isChordLine('D/F# Cadd9 Bbmaj7'), true);
  assert.equal(isChordLine('Amazing grace'), false);
  assert.equal(isChordLine('Be still my soul'), false);
  assert.equal(isChordLine(''), false);
});

check('arranging its own output reproduces it (idempotent)', () => {
  // Catches a labeller that renames Chorus to Verse 3 on a second pass.
  const source = [
    'Amazing grace how sweet the sound\nThat saved a wretch like me',
    CHORUS,
    'I once was lost but now am found\nWas blind but now I see',
    CHORUS,
  ].join('\n\n');

  const first = arrangeLyrics(source);
  const byName = new Map(first.sections.map((s) => [s.name, s]));
  const rendered = first.verseOrder
    .map((name) => `[${name}]\n${byName.get(name).lines.join('\n')}`)
    .join('\n\n');
  const second = arrangeLyrics(rendered);

  assert.deepEqual(second.sections, first.sections);
  assert.deepEqual(second.verseOrder, first.verseOrder);
});

check('500 blocks returns quickly with the cap warning, rather than hanging', () => {
  const many = Array.from({ length: 500 }, (_, i) => `Unique line number ${i} here`).join('\n\n');
  const started = Date.now();
  const result = arrangeLyrics(many);
  const elapsed = Date.now() - started;

  assert.equal(result.sections.length, 500);
  assert.ok(result.warnings.some((w) => /too many sections/i.test(w)), 'expected a cap warning');
  assert.ok(elapsed < 2000, `arrangeLyrics took ${elapsed}ms on 500 blocks`);
});

// ------------------------------------------------- Part A2: the import path

const { createSongImportService } = require('../src/electron/song-import-service.cjs');

const importer = createSongImportService();
const openLyrics = (order, verses) => [
  '<song><properties><titles><title>T</title></titles>',
  order ? `<verseOrder>${order}</verseOrder>` : '',
  '</properties><lyrics>',
  ...verses.map(([name, text]) => `<verse name="${name}"><lines>${text}</lines></verse>`),
  '</lyrics></song>',
].join('\n');

check('OpenLyrics <verseOrder> becomes an arrangement', () => {
  // The format has carried this all along and the parser was discarding it, so
  // a song that repeats its chorus imported as a straight run of verses.
  const result = importer.importText(openLyrics('v1 c v2 c b c', [
    ['v1', 'one'], ['c', 'two'], ['v2', 'three'], ['b', 'four'],
  ]));
  assert.equal(result.ok, true);
  assert.deepEqual(result.songs[0].verseOrder, [
    'Verse 1', 'Chorus', 'Verse 2', 'Chorus', 'Bridge', 'Chorus',
  ]);
});

check('OpenLyrics verse names are prettified, not shown as v1 and c', () => {
  const result = importer.importText(openLyrics(null, [['v1', 'one'], ['c', 'two'], ['b', 'three']]));
  assert.deepEqual(result.songs[0].verses.map((v) => v.name), ['Verse 1', 'Chorus', 'Bridge']);
});

check('<verseOrder> resolves case-insensitively and past a part suffix', () => {
  const result = importer.importText(openLyrics('V1 C v1a', [['v1', 'one'], ['c', 'two']]));
  assert.deepEqual(result.songs[0].verseOrder, ['Verse 1', 'Chorus', 'Verse 1']);
});

check('a <verseOrder> token with no verse is dropped and reported, never invented', () => {
  const result = importer.importText(openLyrics('v1 c v9 c', [['v1', 'one'], ['c', 'two']]));
  assert.deepEqual(result.songs[0].verseOrder, ['Verse 1', 'Chorus', 'Chorus']);
  assert.ok(result.songs[0].warnings.some((w) => /v9/.test(w)), 'expected a warning naming v9');
});

check('a pasted plain sheet sections itself instead of becoming one slide', () => {
  // The defect this whole change exists for: importText's old fallback put the
  // entire file into a single verse named v1.
  const result = importer.importText([
    'A one', 'A two', '', 'CH one', 'CH two', '', 'B one', 'B two', '', 'CH one', 'CH two',
  ].join('\n'));
  assert.equal(result.songs[0].format, 'plain');
  assert.deepEqual(result.songs[0].verses.map((v) => v.name), ['Verse 1', 'Chorus', 'Verse 2']);
  assert.deepEqual(result.songs[0].verseOrder, ['Verse 1', 'Chorus', 'Verse 2', 'Chorus']);
});

check('ChordPro is still reported as chordpro, plain text as plain', () => {
  assert.equal(importer.importText('{title: X}\n{soc}\nPraise him\n{eoc}').songs[0].format, 'chordpro');
  assert.equal(importer.importText('[Chorus]\nPraise him').songs[0].format, 'chordpro');
  assert.equal(importer.importText('Just some lyrics\nand more').songs[0].format, 'plain');
});

check('binary and empty input are still refused', () => {
  assert.equal(importer.importText('').ok, false);
  assert.equal(importer.importText('  \n ').ok, false);
  assert.equal(importer.importText(`abc${String.fromCharCode(0)}def`).ok, false);
  assert.match(importer.importText(`a${String.fromCharCode(0)}b`).error, /binary/i);
});

check('arrangeText sections without importing, for a song already in the library', () => {
  const result = importer.arrangeText('A one\nA two\n\nCH one\nCH two\n\nB one\nB two\n\nCH one\nCH two');
  assert.equal(result.ok, true);
  assert.equal(result.sections.length, 3);
  assert.equal(result.verseOrder.length, 4);
  assert.equal(typeof result.confidence, 'number');
  assert.equal(importer.arrangeText('').ok, false);
});

// ---------------------------------------------------------------- Part B

/* getFormattedSlides is renderer TypeScript, which no verify script can
   require directly. esbuild is already present as a Vite dependency, so the
   real module is compiled and exercised here rather than grepped for — the
   collision below is a runtime property of the output, and reading the source
   would not prove it. */
const esbuild = require('esbuild');

const compiled = esbuild.buildSync({
  entryPoints: ['src/renderer/utils/song-slides.ts'],
  format: 'cjs',
  platform: 'node',
  write: false,
});
const shim = { exports: {} };
new Function('module', 'exports', compiled.outputFiles[0].text)(shim, shim.exports);
const { getFormattedSlides, songSceneId, expandArrangement } = shim.exports;

const SLIDES = [
  { id: 's1', label: 'Verse 1', text: 'a one\na two', order: 0 },
  { id: 's2', label: 'Chorus', text: 'c one\nc two\nc three\nc four', order: 1 },
  { id: 's3', label: 'Verse 2', text: 'b one\nb two', order: 2 },
  { id: 's4', label: 'Bridge', text: 'd one\nd two', order: 3 },
];
const song = (arrangement) => ({ id: 'song1', title: 'Test', slides: SLIDES, arrangement });

const V1_C_V2_C_B_C = ['s1', 's2', 's3', 's2', 's4', 's2'];

check('no arrangement -> ids identical to the slide ids, as before the field existed', () => {
  const slides = getFormattedSlides(song(undefined), 'auto');
  assert.deepEqual(slides.map((s) => s.id), ['s1', 's2', 's3', 's4']);
  assert.deepEqual(slides.map((s) => s.label), ['Verse 1', 'Chorus', 'Verse 2', 'Bridge']);
});

check('V1 C V2 C B C expands to six entries over four slides', () => {
  const slides = getFormattedSlides(song(V1_C_V2_C_B_C), 'auto');
  assert.equal(slides.length, 6);
  assert.deepEqual(slides.map((s) => s.slideId), V1_C_V2_C_B_C);
  assert.deepEqual(slides.map((s) => s.label), [
    'Verse 1', 'Chorus', 'Verse 2', 'Chorus · 2', 'Bridge', 'Chorus · 3',
  ]);
});

check('every projected slide has a unique scene id — this assertion is the bug', () => {
  // Three identical ids used to light three chorus cards LIVE at once, send
  // Next backwards, collide slideRefs and duplicate React keys.
  const target = song(V1_C_V2_C_B_C);
  for (const lines of ['auto', 1, 2, 4, 6]) {
    const slides = getFormattedSlides(target, lines);
    const ids = slides.map((s) => songSceneId(target, s));
    assert.equal(
      new Set(ids).size,
      slides.length,
      `duplicate scene id at linesPerSlide=${lines}: ${ids.join(', ')}`,
    );
  }
});

check('the first occurrence keeps the bare slide id, so persisted scenes still resolve', () => {
  const target = song(V1_C_V2_C_B_C);
  const slides = getFormattedSlides(target, 'auto');
  assert.equal(slides[1].id, 's2');
  assert.equal(songSceneId(target, slides[1]), 'song-song1-s2');
  assert.equal(slides[3].id, 's2-r2');
});

check('an arrangement naming a deleted slide drops that entry only', () => {
  const slides = getFormattedSlides(song(['s1', 'sGONE', 's2']), 'auto');
  assert.deepEqual(slides.map((s) => s.slideId), ['s1', 's2']);
});

check('an arrangement of nothing but deleted slides falls back to list order', () => {
  const slides = getFormattedSlides(song(['gone', 'also-gone']), 'auto');
  assert.deepEqual(slides.map((s) => s.id), ['s1', 's2', 's3', 's4']);
});

check('a corrupt arrangement falls back to list order rather than throwing', () => {
  for (const bad of ['V1 C', 42, {}, [null, 42], [undefined], true]) {
    const slides = getFormattedSlides(song(bad), 'auto');
    assert.deepEqual(slides.map((s) => s.id), ['s1', 's2', 's3', 's4'], `bad arrangement: ${JSON.stringify(bad)}`);
  }
});

check('arrangement plus line-chunking stays unique and readably labelled', () => {
  const slides = getFormattedSlides(song(V1_C_V2_C_B_C), 2);
  const chorusChunks = slides.filter((s) => s.slideId === 's2').map((s) => s.label);
  // The 4-line chorus splits in two, three times over.
  assert.deepEqual(chorusChunks, [
    'Chorus (1/2)', 'Chorus (2/2)',
    'Chorus · 2 (1/2)', 'Chorus · 2 (2/2)',
    'Chorus · 3 (1/2)', 'Chorus · 3 (2/2)',
  ]);
  assert.deepEqual(new Set(slides.map((s) => s.id)).size, slides.length);
});

check('expandArrangement is exported so the arrangement editor shares the filter', () => {
  assert.equal(typeof expandArrangement, 'function');
  assert.deepEqual(expandArrangement(song(['s2', 's2'])).map((s) => s.id), ['s2', 's2']);
  assert.deepEqual(expandArrangement(song(undefined)).map((s) => s.id), ['s1', 's2', 's3', 's4']);
});

// ---------------------------------------------------------------- Part D

/* arrangeExistingSong is what Auto-arrange actually runs. Its job is not the
   heuristic — that is Part A — but deciding what to keep: a label the operator
   chose, and above all a slide id, because scenes and queue entries already
   built on that id must keep resolving after Apply. */
const arrangeBundle = esbuild.buildSync({
  entryPoints: ['src/renderer/utils/song-arrange.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  write: false,
});
const arrangeShim = { exports: {} };
new Function('module', 'exports', 'require', arrangeBundle.outputFiles[0].text)(
  arrangeShim, arrangeShim.exports, require,
);
const { arrangeExistingSong, describeArrangement, shortLabel } = arrangeShim.exports;

// The renderer calls this over IPC; here it goes straight to the real service.
global.window = { BSP: { song: { arrangeText: async ({ text }) => importer.arrangeText(text) } } };

const CHORUS_TEXT = 'Praise him praise him all the day\nPraise him praise him evermore';

check('a song imported as one slab is re-sectioned', async () => {
  const slab = {
    id: 'x', title: 'T',
    slides: [{ id: 'only', label: 'v1', text: `A one\nA two\n\n${CHORUS_TEXT}\n\nB one\nB two\n\n${CHORUS_TEXT}` }],
  };
  const out = await arrangeExistingSong(slab);
  assert.ok(!('error' in out), 'expected a proposal');
  assert.deepEqual(out.song.slides.map((s) => s.label), ['Verse 1', 'Chorus', 'Verse 2']);
  assert.equal(out.song.arrangement.length, 4);
  assert.equal(out.changed, true);
});

check('slide ids survive re-arranging when the text is unchanged', async () => {
  // The reason Apply does not break scenes and queue entries already built on
  // these slides.
  const song = {
    id: 'x', title: 'T',
    slides: [
      { id: 'keep-a', label: 'Verse 1', text: 'A one\nA two' },
      { id: 'keep-b', label: 'Chorus', text: CHORUS_TEXT },
      { id: 'keep-c', label: 'Verse 2', text: 'B one\nB two' },
      { id: 'dupe', label: 'Chorus', text: CHORUS_TEXT },
    ],
  };
  const out = await arrangeExistingSong(song);
  assert.ok(!('error' in out));
  // The duplicate chorus collapses, and the survivor keeps the original id.
  assert.deepEqual(out.song.slides.map((s) => s.id), ['keep-a', 'keep-b', 'keep-c']);
  assert.deepEqual(out.song.arrangement.map((id) => id), ['keep-a', 'keep-b', 'keep-c', 'keep-b']);
});

check('labels the operator chose are not renamed', async () => {
  const song = {
    id: 'x', title: 'T',
    slides: [
      { id: 'a', label: 'Opening Refrain', text: 'A one\nA two' },
      { id: 'b', label: 'Sending', text: 'B one\nB two' },
    ],
  };
  const out = await arrangeExistingSong(song);
  assert.deepEqual(out.song.slides.map((s) => s.label), ['Opening Refrain', 'Sending']);
});

check('an already-tidy song reports nothing to change', async () => {
  const song = {
    id: 'x', title: 'T',
    slides: [
      { id: 'a', label: 'Verse 1', text: 'A one\nA two' },
      { id: 'b', label: 'Chorus', text: CHORUS_TEXT },
    ],
  };
  const out = await arrangeExistingSong(song);
  assert.equal(out.changed, false, 'expected changed:false so the UI can decline to offer Apply');
});

check('the original song object is never mutated', async () => {
  const song = {
    id: 'x', title: 'T',
    slides: [{ id: 'only', label: 'v1', text: `A one\n\n${CHORUS_TEXT}\n\nB one\n\n${CHORUS_TEXT}` }],
  };
  const before = JSON.stringify(song);
  await arrangeExistingSong(song);
  assert.equal(JSON.stringify(song), before);
});

check('the header summary reads as a play order, not a slide count', () => {
  const song = {
    id: 'x', title: 'T',
    slides: [
      { id: 'a', label: 'Verse 1', text: 'x' },
      { id: 'b', label: 'Chorus', text: 'y' },
      { id: 'c', label: 'Pre-Chorus', text: 'z' },
    ],
    arrangement: ['a', 'c', 'b', 'a', 'c', 'b'],
  };
  assert.equal(describeArrangement(song), '6 slides · V1 PC C V1 PC C');
  assert.match(describeArrangement({ ...song, arrangement: undefined }), /^Plays in order · 3 slides$/);
  assert.equal(shortLabel('Verse 12'), 'V12');
  assert.equal(shortLabel('Pre-Chorus'), 'PC');
  assert.equal(shortLabel('Chorus'), 'C');
});

// ---------------------------------------------------------------- Part C

/* Nothing type-checks the contextBridge. A renderer calling a channel that
   preload never bound, or that main never handled, compiles perfectly and
   returns undefined at runtime — in this case leaving Auto-arrange looking
   like it silently did nothing. */
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

check('every window.BSP.song.* the renderer calls is bound in preload and handled in main', () => {
  const called = new Set();
  for (const file of walk(path.join(process.cwd(), 'src/renderer'))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const m of source.matchAll(/window\.BSP\??\.song\??\.(\w+)/g)) called.add(m[1]);
  }
  assert.ok(called.size > 0, 'expected the renderer to call at least one song channel');

  const preload = read('src/electron/preload.cjs');
  const main = read('src/electron/main.cjs');
  const types = read('src/renderer/types/index.ts');

  for (const method of called) {
    assert.ok(
      preload.includes(`ipcRenderer.invoke('song:${method}'`),
      `preload.cjs does not bind song:${method}`,
    );
    assert.ok(
      main.includes(`ipcMain.handle('song:${method}'`),
      `main.cjs does not handle song:${method}`,
    );
    assert.match(types, new RegExp(`\\b${method}\\s*:\\s*\\(payload`), `types/index.ts does not declare song.${method}`);
  }
});

check('arrangeText specifically is wired end to end', () => {
  assert.ok(read('src/electron/preload.cjs').includes("ipcRenderer.invoke('song:arrangeText'"));
  assert.ok(read('src/electron/main.cjs').includes("ipcMain.handle('song:arrangeText'"));
  assert.equal(typeof createSongImportService().arrangeText, 'function');
});

check('the persist version is untouched — bumping it without a migrate wipes the library', () => {
  /* appStore defines no migrate function. Zustand, on a version mismatch with
     no migrator, discards persisted state and falls back to initial — which
     here means every operator's songs, themes, workspaces and verse history.
     `arrangement` is optional precisely so no bump is needed. */
  const store = read('src/renderer/stores/appStore.ts');
  assert.match(store, /version:\s*1\b/, 'persist version changed; an optional field must not require it');
  assert.doesNotMatch(store, /\bmigrate\s*:/, 'a migrate function appeared — revisit whether version 1 is still right');
});

(async () => {
  let n = 0;
  for (const [label, fn] of checks) {
    await fn();
    n += 1;
    console.log(`${String(n).padStart(2)} ✓ ${label}`);
  }
  console.log(`\nSong arrange verified: ${n} checks passed.`);
})().catch((err) => {
  console.error(`\nFAILED after ${checks.length} declared checks:\n`, err.message);
  process.exit(1);
});
