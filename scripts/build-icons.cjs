'use strict';

// Rasterises the app icon into the formats electron-builder needs.
//
//   node scripts/build-icons.cjs
//
// Sources (masters live in the brand pack, copies are kept here so the repo builds
// on its own):
//
//   assets/icons/app-icon-macos.svg   Apple's grid — 824x824 artwork on a 1024
//                                     canvas, so the icon carries the same visual
//                                     weight as native apps in the Dock
//   assets/icons/app-icon.svg         full-bleed squircle for Windows and Linux
//
// macOS gets the padded variant; Windows and Linux want full-bleed, so they get the
// other one. Using one file for all three is the usual reason an Electron app looks
// oversized in the Dock.
//
// Rasterising uses sips (ImageIO), which is present on every Mac and renders the
// gradients and the tally glow correctly. .icns is assembled by iconutil. .ico has
// no system tool, so it is written here — a Vista-era ICO is just a small header
// followed by embedded PNGs.

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const ICONS_DIR = path.join(REPO_ROOT, 'assets', 'icons');
const MACOS_SVG = path.join(ICONS_DIR, 'app-icon-macos.svg');
const FULLBLEED_SVG = path.join(ICONS_DIR, 'app-icon.svg');
const SMALL_SVG = path.join(ICONS_DIR, 'app-icon-small.svg');
const SMALL_MACOS_SVG = path.join(ICONS_DIR, 'app-icon-small-macos.svg');
const OUT_BASE = path.join(ICONS_DIR, 'bible-song-pro-icon');

// Below this, the full six-element mark collapses into a blob — each 2.5-unit bar
// lands on well under a pixel — so the simplified variant is used instead. Both
// .icns and .ico store per-size images, so this costs nothing at large sizes.
const SMALL_THRESHOLD = 32;

// name, pixel size — the set macOS expects inside an .iconset
const ICNS_SIZES = [
  ['icon_16x16', 16], ['icon_16x16@2x', 32],
  ['icon_32x32', 32], ['icon_32x32@2x', 64],
  ['icon_128x128', 128], ['icon_128x128@2x', 256],
  ['icon_256x256', 256], ['icon_256x256@2x', 512],
  ['icon_512x512', 512], ['icon_512x512@2x', 1024]
];

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

function render(svgPath, outPath, size) {
  execFileSync('sips', ['-s', 'format', 'png', svgPath, '--out', outPath, '-Z', String(size)],
    { stdio: 'ignore' });
  if (!fs.existsSync(outPath)) throw new Error(`sips produced nothing for ${outPath}`);
}

/**
 * Builds a .ico from PNG buffers. Entries store PNG data directly, which every
 * Windows version since Vista reads, and which keeps the alpha channel intact.
 */
function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);      // reserved
  header.writeUInt16LE(1, 2);      // 1 = icon
  header.writeUInt16LE(count, 4);

  const directory = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;

  pngBuffers.forEach(({ size, data }, index) => {
    const at = index * 16;
    directory.writeUInt8(size >= 256 ? 0 : size, at + 0);  // 0 means 256
    directory.writeUInt8(size >= 256 ? 0 : size, at + 1);
    directory.writeUInt8(0, at + 2);                        // palette size
    directory.writeUInt8(0, at + 3);                        // reserved
    directory.writeUInt16LE(1, at + 4);                     // colour planes
    directory.writeUInt16LE(32, at + 6);                    // bits per pixel
    directory.writeUInt32LE(data.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });

  return Buffer.concat([header, directory, ...pngBuffers.map(p => p.data)]);
}

function main() {
  for (const svg of [MACOS_SVG, FULLBLEED_SVG, SMALL_SVG, SMALL_MACOS_SVG]) {
    if (!fs.existsSync(svg)) {
      console.error(`missing source: ${path.relative(REPO_ROOT, svg)}`);
      process.exit(1);
    }
  }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'bsp-icons-'));
  try {
    // ---- macOS .icns, from the padded variant ----
    const iconset = path.join(work, 'icon.iconset');
    fs.mkdirSync(iconset);
    for (const [name, size] of ICNS_SIZES) {
      render(size <= SMALL_THRESHOLD ? SMALL_MACOS_SVG : MACOS_SVG, path.join(iconset, `${name}.png`), size);
    }
    execFileSync('iconutil', ['-c', 'icns', iconset, '-o', `${OUT_BASE}.icns`], { stdio: 'inherit' });
    console.log(`built ${path.relative(REPO_ROOT, OUT_BASE)}.icns (${ICNS_SIZES.length} sizes, Apple grid)`);

    // ---- Windows .ico, from the full-bleed variant ----
    const pngs = ICO_SIZES.map(size => {
      const file = path.join(work, `ico-${size}.png`);
      render(size <= SMALL_THRESHOLD ? SMALL_SVG : FULLBLEED_SVG, file, size);
      return { size, data: fs.readFileSync(file) };
    });
    fs.writeFileSync(`${OUT_BASE}.ico`, buildIco(pngs));
    console.log(`built ${path.relative(REPO_ROOT, OUT_BASE)}.ico  (${ICO_SIZES.join(', ')})`);

    // ---- Linux .png ----
    render(FULLBLEED_SVG, `${OUT_BASE}.png`, 512);
    console.log(`built ${path.relative(REPO_ROOT, OUT_BASE)}.png  (512)`);

    // Keep a vector alongside the rasters for anything that can use it.
    fs.copyFileSync(FULLBLEED_SVG, `${OUT_BASE}.svg`);
    console.log(`built ${path.relative(REPO_ROOT, OUT_BASE)}.svg`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

if (require.main === module) main();

module.exports = { buildIco, ICNS_SIZES, ICO_SIZES };
