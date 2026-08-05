const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, nativeImage } = require('electron');

const baseUrl = process.argv[2] || 'http://127.0.0.1:5173';
const outDir = path.join(process.cwd(), 'artifacts', 'display-parity');
const width = 1280;
const height = 720;
const fixtures = [
  'Bible Fullscreen',
  'Compare View',
  'Lower Third',
  'Song Credit',
  'Alert And Transcription',
  'Solid Background',
  'Transparent Background',
  'Image Background',
  'Video Background',
  // A projected slide has to reach the audience window looking like the board
  // the operator saw. This is the case that fails if the projection stops
  // travelling: the direct render would draw the slide and the audience window
  // would fall back to centred text, which no threshold here would forgive.
  'Projected PowerPoint Slide',
];

app.on('window-all-closed', (event) => {
  event.preventDefault();
});

async function capture(url, name) {
  const win = new BrowserWindow({
    width,
    height,
    show: false,
    webPreferences: { backgroundThrottling: false },
  });
  await win.loadURL(url);
  await new Promise((resolve) => setTimeout(resolve, 900));
  const image = await win.webContents.capturePage();
  const pngPath = path.join(outDir, `${name}.png`);
  fs.writeFileSync(pngPath, image.toPNG());
  win.destroy();
  return nativeImage.createFromBuffer(image.toPNG()).resize({ width: 160, height: 90 }).toBitmap();
}

function compareBitmaps(a, b) {
  const length = Math.min(a.length, b.length);
  let total = 0;
  let max = 0;
  for (let i = 0; i < length; i += 4) {
    const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    const avg = d / 3;
    total += avg;
    if (avg > max) max = avg;
  }
  return { mean: total / Math.max(1, length / 4), max };
}

async function main() {
  await app.whenReady();
  fs.mkdirSync(outDir, { recursive: true });

  const reports = [];
  for (const fixture of fixtures) {
    const slug = fixture.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const encoded = encodeURIComponent(fixture);
    const direct = await capture(`${baseUrl}/program-surface-single.html?fixture=${encoded}`, `${slug}-direct`);
    const audience = await capture(`${baseUrl}/audience-display-fixture.html?fixture=${encoded}`, `${slug}-audience`);
    const diff = { fixture, ...compareBitmaps(direct, audience) };
    reports.push(diff);
  }

  const reportPath = path.join(outDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(reports, null, 2));

  const failed = reports.filter((diff) => diff.mean > 2 || diff.max > 140);
  if (failed.length) {
    throw new Error(`Display parity drift too high: ${failed.map((diff) => `${diff.fixture} mean=${diff.mean.toFixed(2)} max=${diff.max.toFixed(2)}`).join('; ')} report=${reportPath}`);
  }

  console.log(`Display parity verified: ${reports.map((diff) => `${diff.fixture} mean ${diff.mean.toFixed(2)} max ${diff.max.toFixed(2)}`).join(' | ')}, report ${reportPath}`);
  app.quit();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
  app.quit();
  setTimeout(() => process.exit(1), 500);
});
