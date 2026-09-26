let electron = null;
try {
  electron = require('electron');
} catch {}

function registerDisplayIpc({
  windowManager,
  getDisplayState,
  setDisplayState,
  getStageState,
  setStageState,
  stageLayoutsService,
  getActiveDisplayId,
  setActiveDisplayId,
  broadcastDisplayState,
  broadcastStageWindows,
  broadcastStageLayouts,
  getNdiService,
  getStreamingService,
  ipc = electron?.ipcMain,
}) {
  if (!ipc) return;

  ipc.handle('display:open', (_, arg) => {
    let target = null;
    let fullscreen = true;
    if (typeof arg === 'string' || typeof arg === 'number') target = arg;
    else if (arg && typeof arg === 'object') {
      target = arg.displayId !== undefined ? arg.displayId : arg.bounds;
      if (typeof arg.fullscreen === 'boolean') fullscreen = arg.fullscreen;
    }
    const win = windowManager?.createDisplayWindow(target, { fullscreen });
    setActiveDisplayId?.(arg?.displayId || 'auto');
    broadcastDisplayState?.();
    return { ok: true };
  });

  ipc.handle('display:toggleFullScreen', () => {
    const dispWin = windowManager?.getDisplayWindow();
    if (!dispWin || dispWin.isDestroyed()) return { ok: false };
    const willBeFullscreen = !dispWin.__isFrameless;
    windowManager?.createDisplayWindow(null, { fullscreen: willBeFullscreen });
    broadcastDisplayState?.();
    return { ok: true, isFullScreen: willBeFullscreen };
  });

  ipc.handle('display:close', () => {
    const dispWin = windowManager?.getDisplayWindow();
    if (dispWin && !dispWin.isDestroyed()) {
      dispWin.hide();
    }
    setActiveDisplayId?.(null);
    broadcastDisplayState?.();
    return { ok: true };
  });

  ipc.handle('display:getDisplays', () => windowManager?.getDisplayPayload() || []);

  ipc.handle('display:getActive', () => {
    const activeId = getActiveDisplayId?.();
    const dispWin = windowManager?.getDisplayWindow();
    const isOpen = Boolean(activeId && dispWin && !dispWin.isDestroyed() && dispWin.isVisible());
    return { ok: true, displayId: activeId, isOpen };
  });

  ipc.handle('display:sendState', (_, s) => setDisplayState?.(s));
  ipc.handle('display:getState', () => getDisplayState?.() || {});
  
  ipc.handle('display:isOpen', () => {
    const activeId = getActiveDisplayId?.();
    const dispWin = windowManager?.getDisplayWindow();
    return Boolean(activeId && dispWin && !dispWin.isDestroyed() && dispWin.isVisible());
  });

  ipc.handle('display:getStatus', () => {
    const activeId = getActiveDisplayId?.();
    const dispWin = windowManager?.getDisplayWindow();
    const bounds = (dispWin && !dispWin.isDestroyed()) ? dispWin.getBounds() : null;
    return {
      isOpen: Boolean(activeId && dispWin && !dispWin.isDestroyed() && dispWin.isVisible()),
      isFullScreen: Boolean(dispWin && !dispWin.isDestroyed() && dispWin.__isFrameless),
      displayId: activeId,
      bounds,
      theme: getDisplayState?.()?.theme?.name || 'Default',
    };
  });

  ipc.on('display:message', (event, msg) => {
    if (!electron?.BrowserWindow) return;
    for (const win of electron.BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed() && win.webContents.id !== event.sender.id) {
        win.webContents.send('display:message', msg);
      }
    }
  });

  ipc.handle('slide-editor:open', () => {
    windowManager?.createSlideEditorWindow();
    return true;
  });

  ipc.handle('stage-display:open', (_, arg) => {
    const win = windowManager?.createStageDisplayWindow(arg?.targetDisplay, {
      fullscreen: arg?.fullscreen !== undefined ? arg?.fullscreen : true,
    });
    broadcastStageWindows?.();
    return { ok: true };
  });

  ipc.handle('stage-display:close', () => {
    const stageWin = windowManager?.getStageDisplayWindow();
    if (stageWin && !stageWin.isDestroyed()) {
      if (stageWin.isFullScreen?.()) stageWin.setFullScreen(false);
      stageWin.hide();
    }
    const liveStages = windowManager?.liveStageWindows() || [];
    for (const win of [...liveStages]) {
      if (win && !win.isDestroyed()) {
        if (win.isFullScreen?.()) win.setFullScreen(false);
        win.hide();
      }
    }
    broadcastStageWindows?.();
    return { ok: true, open: false };
  });

  ipc.handle('stage-display:isOpen', () => {
    const stageWin = windowManager?.getStageDisplayWindow();
    const liveStages = windowManager?.liveStageWindows() || [];
    return Boolean((stageWin && !stageWin.isDestroyed() && stageWin.isVisible()) || [...liveStages].some((w) => w.isVisible()));
  });

  ipc.handle('stage-designer:open', () => {
    windowManager?.createStageDesignerWindow();
    return true;
  });

  ipc.on('stage-designer:dirty', (event, dirty) => {
    const dirtyMap = windowManager?.getDirtyDesigners();
    dirtyMap?.set(event.sender.id, !!dirty);
  });

  ipc.handle('stage-designer:close', (event) => {
    if (!electron?.BrowserWindow) return { ok: false };
    const win = electron.BrowserWindow.fromWebContents(event.sender);
    if (!win) return { ok: false };
    win.close();
    return { ok: true };
  });

  ipc.handle('stage:sendState', (event, message) => setStageState?.(message, event.sender.id));
  ipc.handle('stage:getState', () => getStageState?.() || {});
  ipc.on('stage:message', (event, message) => setStageState?.(message, event.sender.id));

  ipc.handle('stage-layouts:list', () => stageLayoutsService?.list() || []);
  ipc.handle('stage-layouts:save', (_, layout) => {
    const res = stageLayoutsService?.save(layout);
    broadcastStageLayouts?.();
    return res || { ok: false };
  });
  ipc.handle('stage-layouts:delete', (_, id) => {
    const res = stageLayoutsService?.delete(id);
    broadcastStageLayouts?.();
    return res || { ok: false };
  });
  ipc.handle('stage-layouts:setActive', (_, id) => {
    const res = stageLayoutsService?.setActive(id);
    broadcastStageLayouts?.();
    return res || { ok: false };
  });
}

module.exports = {
  registerDisplayIpc,
};
