'use strict';

const fs = require('fs');
const path = require('path');
const { app, shell, dialog } = require('electron');

let currentVideoProcess = null;
let currentAudioProcess = null;
let videoStartTime = 0;
let audioStartTime = 0;

function getDefaultRecordingsDir() {
  const documents = app.getPath('documents');
  const target = path.join(documents, 'Bible Song Pro Recordings');
  if (!fs.existsSync(target)) {
    try {
      fs.mkdirSync(target, { recursive: true });
    } catch {
      // Fallback
    }
  }
  return target;
}

function generateSafeFilename(prefix, ext) {
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  return `${prefix}_${dateStr}.${ext}`;
}

function initRecordingsService(ipcMain, getMainWindow) {
  ipcMain.handle('recordings:get-dir', async () => {
    return getDefaultRecordingsDir();
  });

  ipcMain.handle('recordings:choose-dir', async () => {
    const win = getMainWindow ? getMainWindow() : null;
    const res = await dialog.showOpenDialog(win, {
      title: 'Select Recordings Output Folder',
      defaultPath: getDefaultRecordingsDir(),
      properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    return res.filePaths[0];
  });

  ipcMain.handle('recordings:open-folder', async (_e, customDir) => {
    const dir = customDir || getDefaultRecordingsDir();
    shell.openPath(dir);
    return { ok: true };
  });

  ipcMain.handle('recordings:start-video', async (_e, config = {}) => {
    const outDir = config.outputDirectory || getDefaultRecordingsDir();
    const ext = config.format || 'fmp4';
    const filename = generateSafeFilename('Recording', ext === 'fmp4' ? 'mp4' : ext);
    const targetPath = path.join(outDir, filename);

    videoStartTime = Date.now();
    currentVideoProcess = {
      filePath: targetPath,
      startTime: videoStartTime,
      format: ext,
    };

    return {
      ok: true,
      filePath: targetPath,
      startTime: videoStartTime,
    };
  });

  ipcMain.handle('recordings:stop-video', async () => {
    if (!currentVideoProcess) return { ok: false, error: 'not-recording' };
    const saved = { ...currentVideoProcess, duration: (Date.now() - videoStartTime) / 1000 };
    currentVideoProcess = null;
    return { ok: true, recording: saved };
  });

  ipcMain.handle('recordings:start-audio', async (_e, config = {}) => {
    const outDir = config.outputDirectory || getDefaultRecordingsDir();
    const format = String(config.format || 'wav-48-24');
    const ext = format.startsWith('wav') ? 'wav' : format.split('-')[0];
    const filename = generateSafeFilename('Audio_Master', ext);
    const targetPath = path.join(outDir, filename);

    audioStartTime = Date.now();
    currentAudioProcess = {
      filePath: targetPath,
      startTime: audioStartTime,
      format,
    };

    return {
      ok: true,
      filePath: targetPath,
      startTime: audioStartTime,
    };
  });

  ipcMain.handle('recordings:stop-audio', async () => {
    if (!currentAudioProcess) return { ok: false, error: 'not-recording' };
    const saved = { ...currentAudioProcess, duration: (Date.now() - audioStartTime) / 1000 };
    currentAudioProcess = null;
    return { ok: true, recording: saved };
  });
}

module.exports = {
  initRecordingsService,
  getDefaultRecordingsDir,
};
