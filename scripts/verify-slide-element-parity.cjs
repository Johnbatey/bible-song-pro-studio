const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

/**
 * The slide editor and the screen must agree about what a block looks like.
 *
 * Two components draw the same SlideElement: the editor canvas the operator
 * builds on, and the board that goes to air. They drifted apart, in both
 * directions and silently:
 *
 *   - the canvas ignored letterSpacing, textTransform, textDecoration, vAlign
 *     and rotation, so five sidebar controls looked dead while working
 *   - the air board knew only circles, so a triangle or a star built on the
 *     canvas reached the congregation as a rounded rectangle, and a line
 *     reached it wearing a 3px border on every side
 *
 * Neither is catchable by types — both sides compile perfectly while drawing
 * different pictures. So it is checked here: every property an editor control
 * can write must be read by both renderers, and both must know the same
 * shapes.
 */

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const CANVAS = 'src/renderer/components/slide-editor/SlideEditorCanvasBoard.tsx';
const AIR = 'src/renderer/components/NativeSlideBoard.tsx';

const editorSources = [
  CANVAS,
  'src/renderer/components/slide-editor/SlideEditorRightSidebar.tsx',
  'src/renderer/components/slide-editor/SlideEditorQuickToolbar.tsx',
  'src/renderer/components/slide-editor/SlideEditorLeftRail.tsx',
  'src/renderer/components/SlideEditorModal.tsx',
];

/**
 * Properties both renderers must handle even though no control writes them
 * today — they arrive on template and imported slides, and a renderer that
 * quietly drops one produces a slide that looks different on screen than it
 * did on the canvas, with no control anywhere to explain why.
 */
const ALWAYS_REQUIRED = ['rotation', 'opacity', 'zIndex'];

/** Every property name an editor control writes onto an element. */
function writtenProperties() {
  const found = new Set(ALWAYS_REQUIRED);
  for (const file of editorSources) {
    const source = read(file);
    const calls = source.matchAll(/(?:on)?[Uu]pdateElement\w*\(\s*[^,]+,\s*\{([^}]*)\}/gs);
    for (const call of calls) {
      for (const part of call[1].split(',')) {
        const explicit = part.match(/^\s*([A-Za-z][A-Za-z0-9]*)\s*:/);
        if (explicit) { found.add(explicit[1]); continue; }
        /* Shorthand — `{ vAlign }` rather than `{ vAlign: vAlign }`. Missing
           these is how vAlign escaped an earlier pass of this same check. */
        const shorthand = part.match(/^\s*([A-Za-z][A-Za-z0-9]*)\s*$/);
        if (shorthand) found.add(shorthand[1]);
      }
    }
  }
  return found;
}

/** Every property name a renderer reads off the element it is drawing. */
function readProperties(file) {
  const source = read(file);
  return new Set([...source.matchAll(/\bel\.([A-Za-z][A-Za-z0-9]*)/g)].map((m) => m[1]));
}

/** The shape vocabulary a renderer can draw, from its `content === '…'` tests. */
function shapeVocabulary(file) {
  const source = read(file);
  return new Set([...source.matchAll(/el\.content === '([a-z]+)'/g)].map((m) => m[1]));
}

const written = writtenProperties();
const canvasReads = readProperties(CANVAS);
const airReads = readProperties(AIR);

/* `content` is the text/shape payload and `id` is identity — both are written
   by controls but consumed structurally rather than read off `el.` for style. */
const notStyle = new Set(['id', 'content']);

const missingOnAir = [...written].filter((p) => !notStyle.has(p) && !airReads.has(p)).sort();
assert.deepEqual(
  missingOnAir,
  [],
  `the editor can set these but the air renderer (${AIR}) ignores them, so they would be lost the moment the slide is taken: ${missingOnAir.join(', ')}`,
);

const missingOnCanvas = [...written].filter((p) => !notStyle.has(p) && !canvasReads.has(p)).sort();
assert.deepEqual(
  missingOnCanvas,
  [],
  `the editor can set these but its own canvas (${CANVAS}) does not draw them, so the control looks dead: ${missingOnCanvas.join(', ')}`,
);

const canvasShapes = shapeVocabulary(CANVAS);
const airShapes = shapeVocabulary(AIR);
const unshownOnAir = [...canvasShapes].filter((s) => !airShapes.has(s)).sort();
assert.deepEqual(
  unshownOnAir,
  [],
  `these shapes draw on the editor canvas but not on air, so they would reach the room as something else: ${unshownOnAir.join(', ')}`,
);

/* A border deliberately set to 0 — which is how a Line is built — must survive.
   `el.borderWidth || 3` turns it back into 3 and puts a box around the line. */
for (const file of [CANVAS, AIR]) {
  assert.doesNotMatch(
    read(file),
    /borderWidth:\s*el\.borderWidth\s*\|\|/,
    `${file} must not use "el.borderWidth || n" — it rewrites a deliberate 0 back to n, which puts a border around every Line`,
  );
}

console.log(
  `Slide element parity verified: ${written.size} editable properties drawn by both the editor canvas and the air board, `
  + `shape vocabulary matched (${[...canvasShapes].sort().join(', ')}), zero-width borders preserved.`,
);
