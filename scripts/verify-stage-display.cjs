/* Runtime check for the stage display window.
 *
 * Loads the built stage entry the way the app loads it — file://, the real
 * preload, webSecurity on — then drives it over the same IPC the main process
 * uses and asserts what came out.
 *
 * The three things this exists to catch, all of which the old vanilla page
 * could fail silently:
 *   - the program pane is a real component, not an <iframe> onto some origin
 *   - operator state arrives over IPC and reaches the screen
 *   - a window opened mid-service catches up from the retained snapshot
 *   - nothing the page loads is blocked by its own CSP
 *
 * Usage: electron scripts/verify-stage-display.cjs   (after `vite build`)
 */
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');

const distEntry = path.resolve(__dirname, '../dist/stage-display.html');
const outDir = path.join(process.cwd(), 'artifacts', 'stage-display');

/** What a window opening mid-service would be handed to catch up. */
const SNAPSHOT = {
  current: { title: 'Psalm 23:1', body: 'The LORD is my shepherd; I shall not want.' },
  next: { title: 'Psalm 23:2', body: 'He maketh me to lie down in green pastures.' },
  songTitle: 'Amazing Grace',
  songSubtitle: 'Verse 2',
  timer: { running: false, startedAtMs: null, accumulatedSeconds: 125 },
};

function averageLuma(buffer) {
  let total = 0;
  for (let i = 0; i < buffer.length; i += 4) {
    total += (buffer[i] * 0.2126) + (buffer[i + 1] * 0.7152) + (buffer[i + 2] * 0.0722);
  }
  return total / Math.max(1, buffer.length / 4);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  assert(fs.existsSync(distEntry), `Missing ${distEntry} — run \`npm run build:renderer\` first`);
  await app.whenReady();
  fs.mkdirSync(outDir, { recursive: true });

  // Stand in for the handlers the real main process registers.
  ipcMain.handle('stage:getState', () => SNAPSHOT);
  ipcMain.handle('display:getState', () => ({}));
  ipcMain.handle('media:baseUrl', () => 'http://localhost:8942');

  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    webPreferences: {
      preload: path.resolve(__dirname, '../src/electron/preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });

  /* Record CSP violations from the moment the document exists. font-src was
     too narrow for the @font-face set the page installs from the asset server,
     so themed fonts fell back to system ones with nothing reported anywhere. */
  win.webContents.on('did-start-loading', () => {
    win.webContents.executeJavaScript(`
      window.__cspViolations = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        window.__cspViolations.push(e.violatedDirective + ' <- ' + e.blockedURI);
      });
    `).catch(() => {});
  });

  await win.loadURL(`file://${distEntry}`);
  await new Promise((resolve) => setTimeout(resolve, 800));

  // 1. The snapshot reached the screen.
  const text = await win.webContents.executeJavaScript('document.body.innerText');
  assert(text.includes('The LORD is my shepherd'), 'Stage did not render the retained snapshot');
  assert(text.includes('Psalm 23:2'), 'Stage did not render the next item from the snapshot');
  assert(text.includes('AMAZING GRACE') || text.includes('Amazing Grace'), 'Stage did not render the song cue');
  assert(text.includes('02:05'), `Stage did not render the snapshot timer (02:05); got: ${text.replace(/\s+/g, ' ').slice(0, 200)}`);

  // 2. No iframe, and the real component is mounted.
  const shape = await win.webContents.executeJavaScript(`(() => {
    const inner = document.querySelector('.stage-display .stage-program > *');
    return {
      iframes: document.querySelectorAll('iframe').length,
      programMounted: !!inner && inner.className.includes('program-surface'),
    };
  })()`);
  assert(shape.iframes === 0, `Stage rendered ${shape.iframes} iframe(s); the program pane must be a component`);
  assert(shape.programMounted, 'ProgramSurface is not mounted in the stage program pane');

  // 3. A live operator message updates it.
  win.webContents.send('stage:message', { kind: 'content', current: { title: 'John 3:16', body: 'For God so loved the world.' } });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const after = await win.webContents.executeJavaScript('document.body.innerText');
  assert(after.includes('For God so loved the world'), 'Live stage:message did not reach the screen');

  // 4. Nothing the page asked for was refused by its own policy.
  const violations = await win.webContents.executeJavaScript('window.__cspViolations || []');
  assert(violations.length === 0, `CSP blocked ${violations.length}: ${violations.join(', ')}`);

  // 5. It is not a black rectangle.
  const image = await win.webContents.capturePage();
  const pngPath = path.join(outDir, 'stage.png');
  fs.writeFileSync(pngPath, image.toPNG());
  const luma = averageLuma(nativeImage.createFromBuffer(image.toPNG()).resize({ width: 64, height: 64 }).toBitmap());
  assert(Number.isFinite(luma) && luma > 1, `Stage appears blank; average luma=${luma}`);

  console.log(`Stage display verified: no iframes, ProgramSurface mounted, IPC snapshot + live update rendered, no CSP violations, luma ${luma.toFixed(2)}, screenshot ${pngPath}`);
  win.destroy();
  app.quit();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
  app.quit();
  setTimeout(() => process.exit(1), 500);
});
