const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, nativeImage } = require('electron');

const targetUrl = process.argv[2] || 'http://127.0.0.1:5173/audience-display-fixture.html';
const outDir = path.join(process.cwd(), 'artifacts', 'audience-display');

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
    width: 1280,
    height: 720,
    show: false,
    webPreferences: {
      backgroundThrottling: false,
    },
  });

  await win.loadURL(targetUrl);
  await new Promise((resolve) => setTimeout(resolve, 900));

  const text = await win.webContents.executeJavaScript('document.body.innerText');
  if (!text.includes('All things work together for good')) {
    throw new Error('Audience display did not render the fixture IPC update state');
  }

  const listenerCount = await win.webContents.executeJavaScript('window.__BSP_AUDIENCE_FIXTURE__?.listenerCount?.()');
  if (listenerCount !== 1) {
    throw new Error(`Expected one audience display listener, found ${listenerCount}`);
  }

  const image = await win.webContents.capturePage();
  const pngPath = path.join(outDir, 'fixture.png');
  fs.writeFileSync(pngPath, image.toPNG());

  const resized = nativeImage.createFromBuffer(image.toPNG()).resize({ width: 64, height: 64 });
  const luma = averageLuma(resized.toBitmap());
  if (!Number.isFinite(luma) || luma < 3) {
    throw new Error(`Audience display appears blank; average luma=${luma}`);
  }

  console.log(`Audience display IPC host verified: average luma ${luma.toFixed(2)}, screenshot ${pngPath}`);
  win.destroy();
  app.quit();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
  app.quit();
  setTimeout(() => process.exit(1), 500);
});
