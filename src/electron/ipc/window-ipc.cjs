let electron = null;
try {
  electron = require('electron');
} catch {}

function registerWindowIpc({
  getMainWindow,
  createDockPopoutWindow,
  getDockPopoutWindows,
  broadcastDockPopouts,
  buildAppMenu,
  updateMenuWorkspaces,
  setMenuLocale,
  ipc = electron?.ipcMain,
}) {
  if (!ipc) return;

  ipc.on('dock:syncMenu', (_, openIds) => {
    buildAppMenu?.(openIds);
  });

  ipc.on('ui:setLocale', (_, locale) => {
    setMenuLocale?.(locale);
    buildAppMenu?.();
  });

  ipc.handle('dock:popOut', (_, p) => createDockPopoutWindow?.(p?.id));

  ipc.handle('dock:closePopout', (_, p) => {
    const id = String(p?.id || '');
    const popouts = getDockPopoutWindows?.();
    const win = popouts?.get(id);
    if (win && !win.isDestroyed()) {
      win.close();
      popouts?.delete(id);
      broadcastDockPopouts?.();
      return { ok: true };
    }
    return { ok: false };
  });

  ipc.handle('dock:focusPopout', (_, p) => {
    const id = String(p?.id || '');
    const popouts = getDockPopoutWindows?.();
    const win = popouts?.get(id);
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.focus();
      return { ok: true };
    }
    return { ok: false };
  });

  ipc.handle('dock:listPopouts', () => {
    const popouts = getDockPopoutWindows?.();
    return popouts ? Array.from(popouts.keys()) : [];
  });

  ipc.on('store:broadcast', (event, snapshot) => {
    if (!electron?.BrowserWindow) return;
    for (const win of electron.BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed() && win.webContents.id !== event.sender.id) {
        win.webContents.send('store:sync', snapshot);
      }
    }
  });

  ipc.on('store:requestSync', (event) => {
    const mainWindow = getMainWindow?.();
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents.id !== event.sender.id) {
      mainWindow.webContents.send('store:syncRequest');
    }
  });

  ipc.on('workspace:sync', (_, payload) => {
    const list = Array.isArray(payload?.list)
      ? payload.list
          .filter((w) => w && w.id)
          .map((w) => ({ id: String(w.id), name: String(w.name || 'Untitled layout') }))
      : [];
    updateMenuWorkspaces?.({ list, activeId: payload?.activeId ? String(payload.activeId) : null });
    buildAppMenu?.();
  });

  ipc.handle('window:minimize', () => getMainWindow?.()?.minimize());
  ipc.handle('window:maximize', () => {
    const win = getMainWindow?.();
    if (win) {
      win.isMaximized() ? win.unmaximize() : win.maximize();
    }
  });
  ipc.handle('window:close', () => getMainWindow?.()?.close());
  ipc.handle('window:isMaximized', () => getMainWindow?.()?.isMaximized());
  ipc.handle('window:isFullScreen', () => getMainWindow?.()?.isFullScreen());
}

module.exports = {
  registerWindowIpc,
};
