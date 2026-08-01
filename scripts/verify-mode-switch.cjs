const { app, BrowserWindow } = require('electron');

const targetUrl = process.argv[2] || 'http://127.0.0.1:5173/';

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  await app.whenReady();

  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    show: false,
    webPreferences: {
      backgroundThrottling: false,
    },
  });

  // A render crash during unmount surfaces as an uncaught page error, not as a
  // failed assertion — collect them so the switch cases below can fail on it.
  const pageErrors = [];
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) pageErrors.push(message);
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    pageErrors.push(`render-process-gone: ${details.reason}`);
  });

  await win.loadURL(targetUrl);
  await wait(900);

  const result = await win.webContents.executeJavaScript(`(async () => {
    const read = () => {
      const programDock = document.querySelector('.program-dock');
      const pvDock = document.querySelector('.pv-dock');
      const programLabel = Array.from(document.querySelectorAll('.pv-dock *')).find((node) => /program/i.test(node.textContent || ''));
      const programSurface = document.querySelector('.pv-dock .program-surface');
      const basicButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Basic');
      const studioButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Studio');
      const programRect = programDock?.getBoundingClientRect();
      const surfaceRect = programSurface?.getBoundingClientRect();
      return {
        hasBasicButton: Boolean(basicButton),
        hasStudioButton: Boolean(studioButton),
        programDock: programRect ? { w: programRect.width, h: programRect.height } : null,
        surface: surfaceRect ? { w: surfaceRect.width, h: surfaceRect.height } : null,
        hasProgramText: Boolean(programLabel),
      };
    };
    const before = read();
    const basicButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Basic');
    basicButton?.click();
    await new Promise((resolve) => setTimeout(resolve, 800));
    const afterBasic = read();
    const studioButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Studio');
    studioButton?.click();
    await new Promise((resolve) => setTimeout(resolve, 500));
    const afterStudio = read();
    return { before, afterBasic, afterStudio, bodyText: document.body.innerText.slice(0, 2000) };
  })()`);

  for (const [label, state] of Object.entries({ before: result.before, afterBasic: result.afterBasic, afterStudio: result.afterStudio })) {
    if (!state.programDock || state.programDock.w < 300 || state.programDock.h < 160) {
      throw new Error(`${label}: Program dock collapsed: ${JSON.stringify(state.programDock)}`);
    }
    if (!state.surface || state.surface.w < 200 || state.surface.h < 100) {
      throw new Error(`${label}: Program surface collapsed or missing: ${JSON.stringify(state.surface)}`);
    }
    if (!state.hasProgramText) {
      throw new Error(`${label}: Program label/content missing. Body: ${result.bodyText}`);
    }
  }

  // ── Mode switch while a slide scene is live ────────────────────────────────
  // The empty-state pass above only ever renders the standby branch, so it never
  // mounts ProgramSurface's dangerouslySetInnerHTML subtree. Seed a slide scene
  // first, then leave Studio: that is the path that unmounts a ProgramSurface
  // holding injected HTML, and it is where the removeChild crash lives.
  const withContent = await win.webContents.executeJavaScript(`(async () => {
    const store = window.__BSP_TEST__?.store;
    if (!store) return { skipped: 'no test seam' };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const click = (label) => Array.from(document.querySelectorAll('button'))
      .find((b) => b.textContent.trim() === label)?.click();

    // Every shape a live scene can take, since we do not yet know which one
    // desyncs React on unmount. 'slide-html' reproduces SlideEditor's
    // formatBody() output for a body with a blank line and a bullet: a stray
    // </p>, an unclosed <p>, a parentless <li>.
    const scenes = {
      'slide-html': { type: 'presentation', content: {
        text: 'Title Body line Point one',
        html: '<h1>Title</h1></p><p>Body line<br/><li>Point one</li>' } },
      'bible': { type: 'bible', content: {
        text: 'For God so loved the world', reference: 'John 3:16', version: 'KJV' } },
      'bible-compare': { type: 'bible', content: {
        text: 'For God so loved the world', reference: 'John 3:16', version: 'KJV',
        secondaryVerse: { text: 'For God loved the world so much', reference: 'John 3:16', version: 'NLT' } } },
      'song': { type: 'song', content: {
        text: 'Verse one line', credit: { title: 'Song', author: 'Author', ccli: '12345' } } },
      'video-bg': { type: 'media', content: { text: 'With video background' },
        background: { type: 'video', value: '/lowerthirds/none.mp4' } },
    };

    const results = [];
    for (const [name, partial] of Object.entries(scenes)) {
      const scene = { id: 'fixture-' + name, name: name, ...partial };
      for (const outputMode of ['fullscreen', 'lowerThird']) {
        store.getState().setMode('studio');
        store.getState().setOutputMode(outputMode);
        await sleep(150);
        store.getState().projectScene(scene);
        store.getState().takeToProgram(false);
        await sleep(350);

        const mounted = Boolean(document.querySelector('.pv-dock .program-surface'));
        click('Basic');
        await sleep(500);
        const s1 = document.querySelector('.pv-dock .program-surface')?.getBoundingClientRect();
        const afterBasic = { w: s1?.width || 0, h: s1?.height || 0,
          rootChildren: document.getElementById('root')?.childElementCount || 0 };

        click('Studio');
        await sleep(400);
        const s2 = document.querySelector('.pv-dock .program-surface')?.getBoundingClientRect();
        const afterStudio = { w: s2?.width || 0, h: s2?.height || 0,
          rootChildren: document.getElementById('root')?.childElementCount || 0 };

        results.push({ case: name + '/' + outputMode, mounted, afterBasic, afterStudio });
      }
    }
    return { results };
  })()`);

  if (withContent.skipped) {
    throw new Error(`Slide-scene case could not run: ${withContent.skipped}`);
  }
  for (const r of withContent.results) {
    if (!r.mounted) throw new Error(`${r.case}: scene never mounted a program surface`);
    for (const [phase, state] of Object.entries({ afterBasic: r.afterBasic, afterStudio: r.afterStudio })) {
      if (state.rootChildren === 0) {
        throw new Error(`${r.case} ${phase}: React root emptied — the app blanked`);
      }
      if (state.w < 200 || state.h < 100) {
        throw new Error(`${r.case} ${phase}: Program surface collapsed: ${JSON.stringify(state)}`);
      }
    }
  }

  const fatal = pageErrors.filter((m) => /removeChild|NotFoundError|Minified React error|render-process-gone/i.test(m));
  if (fatal.length) {
    throw new Error(`Uncaught page error during mode switch:\n  ${fatal.join('\n  ')}`);
  }

  console.log('Studio/basic mode switch verified (empty state and live slide scene)');
  win.destroy();
  app.quit();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
  app.quit();
  setTimeout(() => process.exit(1), 500);
});
