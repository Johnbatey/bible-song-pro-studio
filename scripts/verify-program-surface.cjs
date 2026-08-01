const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, nativeImage } = require('electron');

const targetUrl = process.argv[2] || 'http://127.0.0.1:5173/program-surface-harness.html';
const outDir = path.join(process.cwd(), 'artifacts', 'program-surface');

function averageLuma(buffer) {
  let total = 0;
  let count = 0;
  for (let i = 0; i < buffer.length; i += 4) {
    total += (buffer[i] * 0.2126) + (buffer[i + 1] * 0.7152) + (buffer[i + 2] * 0.0722);
    count += 1;
  }
  return total / Math.max(1, count);
}

async function main() {
  await app.whenReady();
  fs.mkdirSync(outDir, { recursive: true });

  const win = new BrowserWindow({
    width: 1440,
    height: 1000,
    show: false,
    webPreferences: {
      backgroundThrottling: false,
    },
  });

  await win.loadURL(targetUrl);
  await new Promise((resolve) => setTimeout(resolve, 800));

  const image = await win.webContents.capturePage();
  const pngPath = path.join(outDir, 'harness.png');
  fs.writeFileSync(pngPath, image.toPNG());

  const resized = nativeImage.createFromBuffer(image.toPNG()).resize({ width: 64, height: 64 });
  const luma = averageLuma(resized.toBitmap());
  if (!Number.isFinite(luma) || luma < 3) {
    throw new Error(`ProgramSurface harness appears blank; average luma=${luma}`);
  }

  const caseCount = await win.webContents.executeJavaScript('document.querySelectorAll(".surface-case").length');
  if (caseCount < 9) {
    throw new Error(`Expected at least 9 ProgramSurface fixtures, found ${caseCount}`);
  }

  console.log(`ProgramSurface harness verified: ${caseCount} fixtures, average luma ${luma.toFixed(2)}, screenshot ${pngPath}`);
  win.destroy();
  app.quit();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
  app.quit();
  setTimeout(() => process.exit(1), 500);
});
