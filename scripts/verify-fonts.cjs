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
   declares is dead weight in every installer. */
const declared = new Set();
const shared = fs.readFileSync(path.join(root, 'src/shared/display-fonts.ts'), 'utf8');
for (const m of shared.matchAll(/'([^']+\.(?:ttf|otf|woff2?))'/g)) declared.add(m[1]);

const present = new Set(files);
const declaredMissing = [...declared].filter((file) => !present.has(file));

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

assert.equal(declaredMissing.length, 0, 'every declared face must have a file');
assert.equal(
  broken.length,
  0,
  `${broken.length} bundled "fonts" are not fonts — see above. Replace them with real files; `
  + 'a .ttf extension on an HTML error page is still an HTML error page.',
);

console.log(`Fonts verified: ${files.length} files, all with a valid sfnt/woff signature, `
  + `and every face declared in display-fonts.ts has one.`);
