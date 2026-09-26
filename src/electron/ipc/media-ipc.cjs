const path = require('node:path');
const fs = require('node:fs');

let electron = null;
try {
  electron = require('electron');
} catch {}

function registerMediaIpc({
  getMainWindow,
  mediaService,
  ndiService,
  streamingService,
  sessionHistory,
  songImportService,
  settingsService,
  deepgramService,
  obsService,
  transcriptionService,
  recordingsService,
  windowManager,
  displayPort,
  getActiveDisplayId,
  setDisplayState,
  DEFAULT_NDI_NAME = 'Bible Song Pro',
  ipc = electron?.ipcMain,
  dialog = electron?.dialog,
  shell = electron?.shell,
  desktopCapturer = electron?.desktopCapturer,
}) {
  if (!ipc) return;

  // ── AI & Transcription ──
  ipc.handle('ai:status', () => transcriptionService?.status() || { ok: false });
  ipc.handle('ai:warmup', (_, p) => transcriptionService?.warmup(p));
  ipc.handle('ai:transcribe', (_, p) => transcriptionService?.transcribe(p));
  ipc.handle('ai:dispose', (_, p) => transcriptionService?.dispose(p));
  ipc.handle('ai:setEngine', (_, e) => transcriptionService?.setActiveEngine(e));
  ipc.handle('ai:setLocalModel', (_, m) => {
    const result = transcriptionService?.setLocalModel(m);
    if (result?.ok) settingsService?.set({ sttLocalModel: m });
    return result;
  });

  // ── Streaming Speech-to-Text (Deepgram) ──
  ipc.handle('stt:start', (_, p) => deepgramService?.start({
    apiKey: settingsService?.get('deepgramApiKey'),
    model: p?.model || settingsService?.get('deepgramModel'),
    language: p?.language || settingsService?.get('deepgramLanguage'),
  }) || { ok: false, error: 'Deepgram service unavailable' });
  ipc.handle('stt:stop', () => deepgramService?.stop() || { ok: true });
  ipc.handle('stt:status', () => deepgramService?.status() || { ok: false });
  ipc.on('stt:audio', (_, chunk) => {
    if (!chunk) return;
    deepgramService?.sendAudio(Buffer.from(chunk));
  });

  // ── NDI Output ──
  ipc.handle('ndi:start', async (_, p) => {
    const r = ndiService?.start(p?.name || DEFAULT_NDI_NAME);
    if (r?.ok) {
      const activeDisplayId = getActiveDisplayId?.();
      let dispWin = windowManager?.getDisplayWindow();
      if (!dispWin || dispWin.isDestroyed()) {
        const show = Boolean(activeDisplayId);
        dispWin = windowManager?.createDisplayWindow(null, { show });
      }
      if (dispWin && !dispWin.isDestroyed()) {
        ndiService?.setDisplayWindow(dispWin);
        ndiService?.startCapture(p?.fps || 30, { width: p?.width || 1920, height: p?.height || 1080 });
      }
    }
    return r || { ok: false, error: 'NDI service unavailable' };
  });

  ipc.handle('ndi:stop', () => {
    const r = ndiService?.stop() || { ok: true };
    const streamActive = Boolean(streamingService?.status()?.running);
    const activeDisplayId = getActiveDisplayId?.();
    const dispWin = windowManager?.getDisplayWindow();
    if (!activeDisplayId && !streamActive && dispWin && !dispWin.isDestroyed()) {
      dispWin.close();
    }
    return r;
  });
  ipc.handle('ndi:status', () => ndiService?.status() || { ok: false });

  // ── Direct RTMP / SRT Live Streaming ──
  ipc.handle('stream:start', async (_, p) => {
    const config = {
      service: p?.service || settingsService?.get('streamService'),
      server: p?.server || settingsService?.get('streamServer'),
      key: typeof p?.key === 'string' ? p.key : settingsService?.get('streamKey'),
      srtUrl: p?.srtUrl || settingsService?.get('streamSrtUrl'),
      protocol: p?.protocol || settingsService?.get('streamProtocol'),
      resolution: p?.resolution || settingsService?.get('streamResolution'),
      fps: p?.fps || settingsService?.get('streamFps'),
      bitrate: p?.bitrate || settingsService?.get('streamBitrate'),
      encoder: p?.encoder || settingsService?.get('streamEncoder'),
    };

    let dispWin = windowManager?.getDisplayWindow();
    if (!dispWin || dispWin.isDestroyed()) {
      const show = Boolean(getActiveDisplayId?.());
      dispWin = windowManager?.createDisplayWindow(null, { show });
    }
    if (dispWin && !dispWin.isDestroyed()) {
      streamingService?.setDisplayWindow(dispWin);
    }
    const r = streamingService?.start(config);
    return r || { ok: false, error: 'Streaming service unavailable' };
  });

  ipc.handle('stream:stop', () => {
    const r = streamingService?.stop() || { ok: true };
    const ndiActive = Boolean(ndiService?.status()?.running);
    const dispWin = windowManager?.getDisplayWindow();
    if (!getActiveDisplayId?.() && !ndiActive && dispWin && !dispWin.isDestroyed()) {
      dispWin.close();
    }
    return r;
  });
  ipc.handle('stream:status', () => streamingService?.status() || { ok: false });
  ipc.handle('stream:checkFfmpeg', () => streamingService?.checkFfmpeg() || { available: false });

  // ── Desktop Capturer ──
  ipc.handle('desktop:get-sources', async (_e, opts = { types: ['window', 'screen'] }) => {
    try {
      if (!desktopCapturer) return [];
      const sources = await desktopCapturer.getSources(opts);
      return sources.map((s) => ({
        id: s.id,
        name: s.name,
        thumbnail: s.thumbnail ? s.thumbnail.toDataURL() : null,
        appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
      }));
    } catch (err) {
      console.error('Failed to get desktop capture sources:', err);
      return [];
    }
  });

  // ── Session History ──
  ipc.handle('session:start', (_, p) => sessionHistory?.startSession(p?.name));
  ipc.handle('session:end', () => sessionHistory?.endSession());
  ipc.handle('session:addEntry', (_, p) => {
    const r = sessionHistory?.addEntry(p);
    if (p?.reference) setDisplayState?.({ scene: { content: { text: p.text, reference: p.reference, version: p.version || 'KJV' } }, type: 'verse' });
    return r;
  });
  ipc.handle('session:list', () => ({ ok: true, sessions: sessionHistory?.listSessions() || [] }));
  ipc.handle('session:get', (_, id) => ({ ok: true, session: sessionHistory?.getSession(id) }));
  ipc.handle('session:export', (_, p) => sessionHistory?.exportSession(p?.id, p?.format || 'json'));
  ipc.handle('session:status', () => sessionHistory?.getStatus() || { ok: false });

  // ── Songs ──
  ipc.handle('song:importFile', (_, p) => songImportService?.importFile(p?.filePath));
  ipc.handle('song:importText', (_, p) => songImportService?.importText(p?.text, p?.title));
  ipc.handle('song:arrangeText', (_, p) => songImportService?.arrangeText(p?.text)
    || { ok: false, error: 'Song import service unavailable' });
  ipc.handle('song:pick', async () => {
    const mainWindow = getMainWindow?.();
    if (!dialog) return { ok: false, canceled: true, filePaths: [] };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Worship Songs & Databases',
      properties: ['openFile', 'multiSelections'],
      filters: [{
        name: 'Worship Songs & Databases (EasyWorship, OpenLP, OpenLyrics, ChordPro, Text)',
        extensions: ['db', 'ddb', 'sqlite', 'sqlite3', 'xml', 'pro', 'chordpro', 'chopro', 'txt']
      }],
    });
    if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true, filePaths: [] };
    return { ok: true, filePaths: result.filePaths };
  });

  // ── OBS Studio ──
  ipc.handle('obs:connect', (_, p) => obsService?.connect({
    url: p?.url || settingsService?.get('obsUrl'),
    password: typeof p?.password === 'string' ? p.password : settingsService?.get('obsPassword'),
  }) || { ok: false, error: 'OBS service unavailable' });
  ipc.handle('obs:disconnect', () => obsService?.disconnect() || { ok: true });
  ipc.handle('obs:status', () => obsService?.status() || { ok: false });
  ipc.handle('obs:setScene', (_, p) => obsService?.setScene(p?.sceneName) || { ok: false });
  ipc.handle('obs:toggleStream', () => obsService?.toggleStream() || { ok: false });
  ipc.handle('obs:toggleRecord', () => obsService?.toggleRecord() || { ok: false });
  ipc.handle('obs:refresh', () => obsService?.refreshState() || { ok: false });

  // ── Media Library ──
  ipc.handle('media:list', () => mediaService?.list() || { ok: false, items: [] });
  ipc.handle('media:import', (_, p) => mediaService?.importPaths(p?.paths) || { ok: false, items: [], errors: ['Media service unavailable'] });
  ipc.handle('media:importOptimized', (_, p) => mediaService?.importOptimizedImage(p?.path) || { ok: false, error: 'Media service unavailable' });
  ipc.handle('media:remove', (_, p) => mediaService?.remove(p?.id) || { ok: false });
  ipc.handle('media:relink', (_, p) => mediaService?.relink(p?.id, p?.path) || { ok: false, error: 'Media service unavailable' });
  ipc.handle('media:reveal', (_, p) => {
    const target = String(p?.path || '');
    if (!target || !fs.existsSync(target)) return { ok: false, error: 'File not found' };
    shell?.showItemInFolder(target);
    return { ok: true };
  });
  ipc.handle('media:rename', (_, p) => mediaService?.rename(p?.id, p?.name) || { ok: false });
  ipc.handle('media:baseUrl', () => `http://localhost:${displayPort}`);

  // ── Settings ──
  ipc.handle('settings:get', () => settingsService?.getPublic() || { ok: false, settings: {} });
  ipc.handle('settings:set', (_, patch) => {
    const result = settingsService?.set(patch) || { ok: false, settings: {} };
    deepgramService?.configure({
      apiKey: settingsService?.get('deepgramApiKey'),
      model: settingsService?.get('deepgramModel'),
      language: settingsService?.get('deepgramLanguage'),
    });
    if (result.ok && result.settings && electron?.BrowserWindow) {
      electron.BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          try { win.webContents.send('settings:updated', result.settings); } catch (_) {}
        }
      });
    }
    return result;
  });
}

module.exports = {
  registerMediaIpc,
};
