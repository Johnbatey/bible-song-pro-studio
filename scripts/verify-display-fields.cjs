/* =========================================================================
   verify-display-fields — what the browser display is told
   -------------------------------------------------------------------------
   display.html is the one output that does not render ProgramSurface: it is a
   separate document driven by flat fields, so every parity check we have is
   blind to it. The only thing standing between the operator's theme and that
   page is backgroundFieldsFor, and until this script there was nothing
   asserting it resolved anything the way the projector does.

   Pure functions, so this runs in node — no window, no Electron.
   ========================================================================= */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = process.cwd();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bsp-display-fields-'));
const entry = path.join(tmp, 'entry.ts');
const bundle = path.join(tmp, 'entry.cjs');

fs.writeFileSync(entry, `
export { backgroundFieldsFor, displayFieldsFor } from ${JSON.stringify(path.join(root, 'src/renderer/utils/display-fields'))};
export { createDefaultTheme } from ${JSON.stringify(path.join(root, 'src/renderer/utils/defaultTheme'))};
export { buildSongScene } from ${JSON.stringify(path.join(root, 'src/renderer/utils/song-slides'))};
`);

execFileSync(
  path.join(root, 'node_modules/.bin/esbuild'),
  [entry, '--bundle', '--platform=node', '--format=cjs', `--outfile=${bundle}`, '--log-level=warning'],
  { stdio: 'inherit' },
);

const { backgroundFieldsFor, createDefaultTheme, buildSongScene } = require(bundle);

let passed = 0;
const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { passed += 1; console.log(`  ✓ ${name}`); return; }
  failures.push(`${name}\n      expected ${e}\n      actual   ${a}`);
  console.log(`  ✗ ${name}`);
}

/** The theme, with a ground bolted onto its full-screen section. */
function themeWith(fullScreen) {
  const theme = createDefaultTheme();
  return { ...theme, fullScreen: { ...theme.fullScreen, ...fullScreen } };
}

const scene = (background) => ({
  id: 's', name: 'Fixture', type: 'song', content: { text: 'Lyric' }, ...(background ? { background } : {}),
});

const ground = (fields) => ({ bgVideo: fields.bgVideo, bgCustomImage: fields.bgCustomImage, bgFill: fields.bgFill });

console.log('Background fields for the browser display:');

/* --- No scene background: the theme is the ground. --- */
check(
  'theme solid reaches the display',
  ground(backgroundFieldsFor(scene(), themeWith({ background: '', backgroundColor: '#123456' }), 'fullscreen')),
  { bgVideo: '', bgCustomImage: '', bgFill: '#123456' },
);

/* A theme always carries a backgroundColor, so reading it before `background`
   is what used to flatten every gradient the operator set. */
check(
  'theme gradient is not flattened to its start colour',
  ground(backgroundFieldsFor(
    scene(),
    themeWith({ background: 'linear-gradient(135deg, #0f172a, #312e81)', backgroundColor: '#0f172a' }),
    'fullscreen',
  )),
  { bgVideo: '', bgCustomImage: '', bgFill: 'linear-gradient(135deg, #0f172a, #312e81)' },
);

check(
  'theme image outranks the colour every theme carries',
  ground(backgroundFieldsFor(
    scene(),
    themeWith({ backgroundMediaUrl: '/media/still.png', backgroundMediaType: 'image', backgroundColor: '#123456' }),
    'fullscreen',
  )),
  { bgVideo: '', bgCustomImage: '/media/still.png', bgFill: '' },
);

check(
  'theme video reaches the display as a video, not a fill',
  ground(backgroundFieldsFor(
    scene(),
    themeWith({ backgroundMediaUrl: '/media/loop.mp4', backgroundMediaType: 'video', backgroundColor: '#123456' }),
    'fullscreen',
  )),
  { bgVideo: '/media/loop.mp4', bgCustomImage: '', bgFill: '' },
);

/* --- A scene with its own ground outranks the theme's. --- */
check(
  "a song's own gradient outranks the theme's image",
  ground(backgroundFieldsFor(
    scene({ type: 'gradient', gradient: 'linear-gradient(135deg, #062a20, #0f5132)' }),
    themeWith({ backgroundMediaUrl: '/media/still.png', backgroundMediaType: 'image' }),
    'fullscreen',
  )),
  { bgVideo: '', bgCustomImage: '', bgFill: 'linear-gradient(135deg, #062a20, #0f5132)' },
);

check(
  "a song's own clip outranks the theme's clip",
  ground(backgroundFieldsFor(
    scene({ type: 'video', mediaUrl: '/media/song.mp4', mediaType: 'video' }),
    themeWith({ backgroundMediaUrl: '/media/theme.mp4', backgroundMediaType: 'video' }),
    'fullscreen',
  )),
  { bgVideo: '/media/song.mp4', bgCustomImage: '', bgFill: '' },
);

/* --- Loop and fit follow whoever supplied the clip. --- */
check(
  "loop follows the theme when the theme supplied the clip",
  backgroundFieldsFor(
    scene(),
    themeWith({ backgroundMediaUrl: '/media/loop.mp4', backgroundMediaType: 'video', backgroundLoop: false }),
    'fullscreen',
  ).bgVideoLoop,
  false,
);

check(
  "loop follows the scene when the scene supplied the clip",
  backgroundFieldsFor(
    scene({ type: 'video', mediaUrl: '/media/song.mp4', loop: false }),
    themeWith({ backgroundMediaUrl: '/media/theme.mp4', backgroundMediaType: 'video', backgroundLoop: true }),
    'fullscreen',
  ).bgVideoLoop,
  false,
);

check(
  'fit follows the theme when the theme supplied the still',
  backgroundFieldsFor(
    scene(),
    themeWith({ backgroundMediaUrl: '/media/still.png', backgroundMediaType: 'image', backgroundFit: 'contain' }),
    'fullscreen',
  ).bgFit,
  'contain',
);

/* --- A lower third is a band over whatever is already on the projector. --- */
check(
  'lower third takes no ground from the theme',
  ground(backgroundFieldsFor(
    scene(),
    themeWith({ backgroundMediaUrl: '/media/still.png', backgroundMediaType: 'image' }),
    'lowerThird',
  )),
  { bgVideo: '', bgCustomImage: '', bgFill: '' },
);

/** A still on the LT band must stay on the band — never become the page fill. */
function themeWithLt(lowerThird) {
  const theme = createDefaultTheme();
  return { ...theme, lowerThird: { ...theme.lowerThird, ...lowerThird } };
}

check(
  'lower third band image does not become the page ground',
  ground(backgroundFieldsFor(
    scene(),
    themeWithLt({ backgroundMediaUrl: '/media/lt-band.png', backgroundMediaType: 'image' }),
    'lowerThird',
  )),
  { bgVideo: '', bgCustomImage: '', bgFill: '' },
);

/* --- What a song scene carries. --- */
console.log('\nSong scenes:');

const slideA = { id: 's1', label: 'Verse 1', text: 'Amazing grace' };
const slideB = { id: 's2', label: 'Verse 2', text: 'Twas grace that taught' };
const plainSong = { id: 'song-1', title: 'Amazing Grace', key: 'G', slides: [] };

/* A hardcoded gradient used to sit on every song scene, which is why songs
   ignored the theme while Scripture obeyed it. Absent has to stay absent: an
   empty object here would read as a background and swallow the theme. */
check(
  'a song with no background of its own carries none, so the theme shows',
  'background' in buildSongScene(plainSong, slideA)
    && buildSongScene(plainSong, slideA).background !== undefined,
  false,
);

const dressedSong = {
  ...plainSong,
  background: { type: 'video', mediaUrl: '/media/loop.mp4', mediaType: 'video', loop: true },
};

check(
  "a song's own background reaches the scene",
  buildSongScene(dressedSong, slideA).background,
  dressedSong.background,
);

/* The continuity guarantee. ProgramSurface's <video> has no key, so React keeps
   the DOM node while src is unchanged — and src is unchanged only because every
   slide of a song hands back the same background. If this ever produces a copy
   per slide the url would still be equal, but a future change that rebuilt the
   object per slide is exactly the kind that starts the clip over on every line
   the operator advances. Identity is the thing worth pinning. */
check(
  'every slide of a song hands back the same background, so the clip keeps playing',
  buildSongScene(dressedSong, slideA).background === buildSongScene(dressedSong, slideB).background,
  true,
);

fs.rmSync(tmp, { recursive: true, force: true });

if (failures.length) {
  throw new Error(`Display field drift:\n    ${failures.join('\n    ')}`);
}
console.log(`\nDisplay fields verified: ${passed} checks — theme ground, scene override, loop and fit ownership, song scene backgrounds.`);
