const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

/**
 * Every bundled face must actually be a face.
 *
 * Sixteen of the twenty .ttf files in public/fonts were GitHub "Page not found"
 * pages — all exactly 320 KB, because a fetch that hit dead URLs wrote the same
 * error page twenty times over and the .ttf extension made it look done. The
 * effect is invisible in code review, invisible to TypeScript, invisible in the
 * operator console, and shows up only on the projector: the operator picks Lora
 * for scripture and the congregation gets whatever the OS substitutes.
 *
 * A font is a binary format with a four-byte signature. Checking it costs
 * nothing and is the only thing that would have caught this.
 *
 * Deliberately NOT in verify:all or CI yet: it fails today, correctly, on the
 * sixteen files described above. Add it to both in the same commit that
 * replaces them, so the suite goes green because the bug is fixed rather than
 * because the check was tuned to accept it.
 */

const root = process.cwd();
const FONT_DIR = path.join(root, 'public/fonts');

/* sfnt wrappers: 0x00010000 (TrueType), "true"/"ttcf" (Apple), "OTTO" (CFF),
   plus the two web wrappers. Anything else is not a font, whatever it is
   called. */
const SIGNATURES = {
  '.ttf': [[0x00, 0x01, 0x00, 0x00], [0x74, 0x72, 0x75, 0x65], [0x74, 0x74, 0x63, 0x66], [0x4f, 0x54, 0x54, 0x4f]],
  '.otf': [[0x4f, 0x54, 0x54, 0x4f], [0x00, 0x01, 0x00, 0x00]],
  '.woff': [[0x77, 0x4f, 0x46, 0x46]],
  '.woff2': [[0x77, 0x4f, 0x46, 0x32]],
};

function signatureOf(file) {
  const head = Buffer.alloc(4);
  const fd = fs.openSync(file, 'r');
  try { fs.readSync(fd, head, 0, 4, 0); } finally { fs.closeSync(fd); }
  return head;
}

const files = fs.readdirSync(FONT_DIR)
  .filter((name) => SIGNATURES[path.extname(name).toLowerCase()])
  .sort();

assert.ok(files.length > 0, 'no font files found in public/fonts');

const broken = [];
for (const name of files) {
  const full = path.join(FONT_DIR, name);
  const head = signatureOf(full);
  const allowed = SIGNATURES[path.extname(name).toLowerCase()];
  const ok = allowed.some((sig) => sig.every((byte, i) => head[i] === byte));
  if (!ok) {
    const sample = fs.readFileSync(full, 'utf8').slice(0, 200).replace(/\s+/g, ' ').trim();
    broken.push({ name, head: head.toString('hex'), size: fs.statSync(full).size, sample: sample.slice(0, 90) });
  }
}

/* The declared set and the shipped set have to agree in both directions. A
   face declared with no file behind it falls back silently; a file nothing
   declares is dead weight in every installer.

   And the two declaration sites have to agree with each other. display.html
   serves the browser and network output; display-fonts.ts serves the bundled
   audience and stage windows. A face in one but not the other is the operator
   picking a font and one of the two screens quietly substituting another —
   which is the failure display-fonts.ts's own header warns about. */
const fileRefs = (source) => new Set(
  [...source.matchAll(/[\w-]+\.(?:ttf|otf|woff2?)/g)].map((m) => m[0]),
);

const present = new Set(files);
const shared = fs.readFileSync(path.join(root, 'src/shared/display-fonts.ts'), 'utf8');
const displayHtml = fs.readFileSync(path.join(root, 'display.html'), 'utf8');

const declared = fileRefs(shared);
const inHtml = fileRefs(displayHtml);
const declaredMissing = [...declared].filter((file) => !present.has(file));
const htmlMissing = [...inHtml].filter((file) => !present.has(file));

/* The brand faces are not part of that symmetry and must not be held to it.
   brand-faces.css owns them, and the entries that link it get them from there
   — display.html does not link it, so it declares Source Serif 4 inline. That
   asymmetry is the design, not drift. Only the operator-selectable
   presentation faces have to match on both surfaces. */
const brand = fileRefs(fs.readFileSync(path.join(FONT_DIR, 'brand-faces.css'), 'utf8'));
const presentation = (set) => [...set].filter((f) => !brand.has(f));

const onlyInShared = presentation(declared).filter((f) => !inHtml.has(f));
const onlyInHtml = presentation(inHtml).filter((f) => !declared.has(f));

if (broken.length > 0) {
  console.error(`\n${broken.length} of ${files.length} bundled fonts are not fonts:\n`);
  for (const b of broken) {
    console.error(`  ${b.name}  ${b.size} bytes  magic=${b.head}`);
    console.error(`    starts: ${b.sample}`);
  }
}
if (declaredMissing.length > 0) {
  console.error(`\ndisplay-fonts.ts declares files that are not shipped: ${declaredMissing.join(', ')}`);
}
if (htmlMissing.length > 0) {
  console.error(`\ndisplay.html references files that are not shipped: ${htmlMissing.join(', ')}`);
}
if (onlyInShared.length > 0 || onlyInHtml.length > 0) {
  console.error('\nthe two font declaration sites disagree:');
  if (onlyInShared.length > 0) console.error(`  only in display-fonts.ts: ${onlyInShared.join(', ')}`);
  if (onlyInHtml.length > 0) console.error(`  only in display.html:     ${onlyInHtml.join(', ')}`);
}

assert.equal(declaredMissing.length, 0, 'every face declared in display-fonts.ts must have a file');
assert.equal(htmlMissing.length, 0, 'every face referenced in display.html must have a file');
assert.equal(
  onlyInShared.length + onlyInHtml.length,
  0,
  'display.html and display-fonts.ts must offer the same faces — see above',
);
assert.equal(
  broken.length,
  0,
  `${broken.length} bundled "fonts" are not fonts — see above. Replace them with real files; `
  + 'a .ttf extension on an HTML error page is still an HTML error page.',
);

console.log(`Fonts verified: ${files.length} files, all with a valid sfnt/woff signature, `
  + `and every face declared in display-fonts.ts has one.`);
