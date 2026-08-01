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
      workspace: box('.operator-workspace'),
      transcript: box('.transcript-region'),
      program: box('.program-dock'),
      sidebar: box('.sidebar-region'),
      content: box('.left-workspace'),
      previewStage: box('.pv-dock [title="Fullscreen output"]') ? box('.pv-dock') : null,
      transcriptPanel: Boolean(document.querySelector('.transcript-panel')),
      bottomTranscriptBar: Boolean(document.querySelector('.transcription-bar')),
    };
  })()`);

  assertBox('workspace', layout.workspace);
  assertBox('transcript', layout.transcript);
  assertBox('program', layout.program);
  assertBox('sidebar', layout.sidebar);
  assertBox('content', layout.content);

  if (!layout.transcriptPanel) {
    throw new Error('Transcript panel is not rendered in the top-left region');
  }
  if (layout.bottomTranscriptBar) {
    throw new Error('Legacy bottom transcription bar is still rendered');
  }
  if (!(layout.transcript.x < layout.program.x && layout.transcript.y < layout.sidebar.y)) {
    throw new Error('Transcript region is not positioned top-left of the operator layout');
  }
  if (!(layout.program.y < layout.content.y && layout.program.x > layout.transcript.x)) {
    throw new Error('Program dock is not positioned in the top-right region');
  }
  if (!(layout.sidebar.x < layout.content.x && layout.sidebar.y > layout.transcript.y)) {
    throw new Error('Sidebar region is not positioned below the transcript panel');
  }

  console.log(`Operator layout verified, screenshot ${pngPath}`);
  win.destroy();
  app.quit();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
  app.quit();
  setTimeout(() => process.exit(1), 500);
});
