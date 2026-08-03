const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const targetUrl = process.argv[2] || 'http://127.0.0.1:5173/';
const outDir = path.join(process.cwd(), 'artifacts', 'operator-layout');

function assertBox(name, box) {
  if (!box || box.w <= 0 || box.h <= 0) {
    throw new Error(`${name} region is missing or collapsed`);
  }
}

async function main() {
  await app.whenReady();
  fs.mkdirSync(outDir, { recursive: true });

  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    show: false,
    webPreferences: {
      backgroundThrottling: false,
    },
  });

  await win.loadURL(targetUrl);
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const image = await win.webContents.capturePage();
  const pngPath = path.join(outDir, 'layout.png');
  fs.writeFileSync(pngPath, image.toPNG());

  const layout = await win.webContents.executeJavaScript(`(() => {
    const box = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
    };
    return {
      dockRoot: box('.bsp-dock-root'),
      groups: Array.from(document.querySelectorAll('.dv-groupview')).map((el) => {
        const rect = el.getBoundingClientRect();
        return { w: rect.width, h: rect.height };
      }),
      tabTitles: Array.from(document.querySelectorAll('.dv-default-tab'))
        .map((el) => el.textContent.trim())
        .filter(Boolean),
      panels: Array.from(document.querySelectorAll('.dock-panel')).length,
      transcriptPanel: Boolean(document.querySelector('.transcript-panel')),
      programDock: Boolean(document.querySelector('.pv-dock')),
      bottomTranscriptBar: Boolean(document.querySelector('.transcription-bar')),
    };
  })()`);

  // The arrangement is the operator's to change, so position is no longer
  // assertable. What must hold is that the dock host is up, every dock in the
  // default layout is present, and none of them collapsed to nothing.
  assertBox('dock root', layout.dockRoot);

  const EXPECTED = ['Live transcript', 'Output', 'History', 'Bible', 'Queue'];
  for (const title of EXPECTED) {
    if (!layout.tabTitles.some((t) => t.toLowerCase() === title.toLowerCase())) {
      throw new Error(`Default layout is missing the "${title}" dock (saw: ${layout.tabTitles.join(', ') || 'none'})`);
    }
  }

  if (layout.groups.length < 2) {
    throw new Error(`Expected the default layout to be split across several groups, saw ${layout.groups.length}`);
  }
  layout.groups.forEach((g, i) => assertBox(`dock group ${i}`, g));

  if (!layout.transcriptPanel) {
    throw new Error('Transcript panel is not rendered in any dock');
  }
  if (!layout.programDock) {
    throw new Error('Preview/Program dock is not rendered');
  }
  if (layout.bottomTranscriptBar) {
    throw new Error('Legacy bottom transcription bar is still rendered');
  }

  console.log(`Dock layout verified (${layout.groups.length} groups: ${layout.tabTitles.join(', ')}), screenshot ${pngPath}`);
  win.destroy();
  app.quit();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
  app.quit();
  setTimeout(() => process.exit(1), 500);
});
