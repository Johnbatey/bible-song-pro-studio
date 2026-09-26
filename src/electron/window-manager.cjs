const { app, BrowserWindow, screen, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { buildAppMenu } = require('./app-menu.cjs');

let isDev = false;
let mainWindow = null;
let displayWindow = null;
let stageDisplayWindow = null;
let prewarmedStageDesignerWindow = null;

const stageWindows = new Set();
const stageDesignerWindows = new Set();
const dirtyDesigners = new Map();
const dockPopoutWindows = new Map();

let getDisplayState = () => ({});
let getStageState = () => ({});
let getNdiService = () => null;
let getStageLayoutsService = () => null;
let broadcastDisplayStateCb = () => {};

function initWindowManager(config = {}) {
  if (typeof config.isDev === 'boolean') isDev = config.isDev;
  if (config.getDisplayState) getDisplayState = config.getDisplayState;
  if (config.getStageState) getStageState = config.getStageState;
  if (config.getNdiService) getNdiService = config.getNdiService;
  if (config.getStageLayoutsService) getStageLayoutsService = config.getStageLayoutsService;
  if (config.broadcastDisplayState) broadcastDisplayStateCb = config.broadcastDisplayState;
}

function createSplashWindow() {
  const isMac = process.platform === 'darwin';
  const s = new BrowserWindow({
    width: 1000,
    height: 620,
    frame: false,
    transparent: isMac,
    resizable: false,
    alwaysOnTop: true,
    backgroundColor: '#0C0B0B',
    center: true,
    show: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  const v = `?v=${encodeURIComponent(app.getVersion())}`;
  s.loadURL(isDev
    ? `http://localhost:5173/splash.html${v}`
    : `file://${path.join(__dirname, '../../dist/splash.html')}${v}`);
  s.center();
  return s;
}

function createMainWindow({ autoShow = true } = {}) {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 640,
    minHeight: 480,
    frame: true,
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    thickFrame: true,
    backgroundColor: '#0c0e14',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });
  win.setResizable(true);
  win.setMinimumSize(640, 480);
  win.loadURL(isDev ? 'http://localhost:5173' : `file://${path.join(__dirname, '../../dist/index.html')}`);
  if (isDev) win.webContents.openDevTools();
  if (autoShow) {
    win.once('ready-to-show', () => {
      win.maximize();
      win.show();
      win.focus();
    });
  }
  mainWindow = win;
  return win;
}

function getDisplayPayload() {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().map((display, index) => {
    const isPrimary = display.id === primary.id;
    const isInternal = Boolean(display.internal);
    const fallback = isInternal
      ? (isPrimary ? 'Built-in Display' : `Internal Display ${index + 1}`)
      : `External Display ${index + 1}`;
    return {
      id: String(display.id),
      index,
      name: display.label || fallback,
      label: display.label || fallback,
      isPrimary,
      isInternal,
      bounds: display.bounds,
      resolution: `${Math.round(display.bounds.width * display.scaleFactor)}×${Math.round(display.bounds.height * display.scaleFactor)}`,
      scaleFactor: display.scaleFactor,
    };
  });
}

function chooseDisplay(displayId) {
  const displays = screen.getAllDisplays();
  if (displays.length === 0) return null;
  const primary = screen.getPrimaryDisplay();

  if (displayId !== undefined && displayId !== null && displayId !== 'auto') {
    const exact = displays.find((d) => String(d.id) === String(displayId));
    if (exact) return exact;
    if (typeof displayId === 'number' && displays[displayId]) return displays[displayId];
  }

  return displays.find((d) => !d.internal && d.id !== primary.id)
    || displays.find((d) => !d.internal)
    || displays.find((d) => d.id !== primary.id)
    || primary
    || displays[0];
}

function broadcastDisplayList() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('display:listChanged', getDisplayPayload());
  }
}

function liveStageWindows() {
  for (const win of stageWindows) if (win.isDestroyed()) stageWindows.delete(win);
  return stageWindows;
}

function liveStageDesignerWindows() {
  for (const win of stageDesignerWindows) if (win.isDestroyed()) stageDesignerWindows.delete(win);
  return stageDesignerWindows;
}

function broadcastStageWindows() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const isOpen = Boolean((stageDisplayWindow && !stageDisplayWindow.isDestroyed() && stageDisplayWindow.isVisible()) || [...liveStageWindows()].some((w) => w.isVisible()));
    mainWindow.webContents.send('stage-display:state', { open: isOpen });
  }
}

function resizableOutputBounds(bounds) {
  const margin = 48;
  const width = Math.max(640, Math.min(1280, bounds.width - margin * 2));
  const height = Math.max(360, Math.round(width * 9 / 16));
  const fittedHeight = Math.min(height, Math.max(360, bounds.height - margin * 2));
  return {
    x: Math.round(bounds.x + (bounds.width - width) / 2),
    y: Math.round(bounds.y + (bounds.height - fittedHeight) / 2),
    width: Math.round(width),
    height: Math.round(fittedHeight),
  };
}

function createDisplayWindow(targetOrBounds, options = {}) {
  const primary = screen.getPrimaryDisplay();
  let targetDisplay = null;
  let explicitBounds = null;

  if (targetOrBounds && typeof targetOrBounds.id !== 'undefined') {
    targetDisplay = targetOrBounds;
  } else if (targetOrBounds && typeof targetOrBounds.width === 'number') {
    explicitBounds = targetOrBounds;
    const allDisplays = screen.getAllDisplays();
    targetDisplay = allDisplays.find((d) =>
      d.bounds.x === explicitBounds.x && d.bounds.y === explicitBounds.y &&
      d.bounds.width === explicitBounds.width && d.bounds.height === explicitBounds.height
    ) || primary;
  } else {
    targetDisplay = chooseDisplay('auto') || primary;
  }

  const isFullScreen = options.fullscreen !== undefined ? options.fullscreen : true;

  if (displayWindow && !displayWindow.isDestroyed()) {
    const isCurrentlyFrameless = Boolean(displayWindow.__isFrameless);
    if (isCurrentlyFrameless !== isFullScreen) {
      displayWindow.close();
      displayWindow = null;
    } else {
      if (isFullScreen) {
        displayWindow.setBounds(targetDisplay.bounds);
        try { displayWindow.setContentBounds(targetDisplay.bounds); } catch {}
      } else {
        displayWindow.setBounds(explicitBounds || resizableOutputBounds(targetDisplay.bounds));
      }
      if (options.show !== false) {
        displayWindow.show();
        broadcastDisplayStateCb();
      } else {
        displayWindow.hide();
      }
      return displayWindow;
    }
  }

  const bounds = isFullScreen
    ? targetDisplay.bounds
    : (explicitBounds || resizableOutputBounds(targetDisplay.bounds || screen.getPrimaryDisplay().workArea || screen.getPrimaryDisplay().bounds));
  const showWindow = options.show !== false;

  displayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 640,
    minHeight: 360,
    frame: !isFullScreen,
    autoHideMenuBar: true,
    resizable: !isFullScreen,
    maximizable: true,
    fullscreenable: true,
    thickFrame: !isFullScreen,
    transparent: true,
    backgroundColor: '#00000000',
    show: showWindow,
    enableLargerThanScreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  displayWindow.__isFrameless = isFullScreen;

  if (isFullScreen) {
    displayWindow.setBounds(targetDisplay.bounds);
    try { displayWindow.setContentBounds(targetDisplay.bounds); } catch {}
  } else {
    displayWindow.setResizable(true);
    displayWindow.setMinimumSize(640, 360);
    displayWindow.setAspectRatio(16 / 9);
  }

  displayWindow.loadURL(isDev ? 'http://localhost:5173/audience-display.html' : `file://${path.join(__dirname, '../../dist/audience-display.html')}`);
  displayWindow.setMenuBarVisibility(false);
  displayWindow.webContents.setAudioMuted(true);

  displayWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      displayWindow.hide();
      broadcastDisplayStateCb();
    }
  });

  displayWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[DisplayWindow] Renderer process crash detected:', details);
    if (displayWindow && !displayWindow.isDestroyed()) {
      setTimeout(() => {
        if (displayWindow && !displayWindow.isDestroyed()) {
          console.info('[DisplayWindow] Auto-recovering display window after crash...');
          displayWindow.reload();
        }
      }, 250);
    }
  });

  displayWindow.webContents.on('unresponsive', () => {
    console.warn('[DisplayWindow] Window became unresponsive.');
  });

  displayWindow.webContents.on('did-finish-load', () => {
    broadcastDisplayStateCb();
    const ndi = getNdiService();
    if (ndi && ndi.status().running) {
      ndi.setDisplayWindow(displayWindow);
      ndi.startCapture();
    }
  });
  return displayWindow;
}

function createStageDisplayWindow(targetDisplay, options = {}) {
  const primary = screen.getPrimaryDisplay();
  const target = targetDisplay || chooseDisplay('auto') || primary;
  const isFullScreen = options.fullscreen !== undefined ? options.fullscreen : true;
  const bounds = isFullScreen ? target.bounds : resizableOutputBounds(target.bounds || screen.getPrimaryDisplay().workArea || screen.getPrimaryDisplay().bounds);
  const showWindow = options.show !== false;

  if (stageDisplayWindow && !stageDisplayWindow.isDestroyed()) {
    const isCurrentlyFrameless = Boolean(stageDisplayWindow.__isFrameless);
    if (isCurrentlyFrameless !== isFullScreen) {
      stageDisplayWindow.close();
      stageDisplayWindow = null;
    } else {
      if (isFullScreen) {
        stageDisplayWindow.setBounds(target.bounds);
        try { stageDisplayWindow.setContentBounds(target.bounds); } catch {}
      } else {
        stageDisplayWindow.setBounds(bounds);
      }
      stageWindows.add(stageDisplayWindow);
      if (showWindow) {
        stageDisplayWindow.show();
        stageDisplayWindow.webContents.send('display:message', { type: 'display:update', state: getDisplayState() });
        const stState = getStageState();
        if (Object.keys(stState).length > 0) stageDisplayWindow.webContents.send('stage:message', stState);
      } else {
        stageDisplayWindow.hide();
      }
      broadcastStageWindows();
      return stageDisplayWindow;
    }
  }

  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 640,
    minHeight: 480,
    frame: !isFullScreen,
    autoHideMenuBar: true,
    resizable: !isFullScreen,
    maximizable: true,
    fullscreenable: true,
    thickFrame: !isFullScreen,
    enableLargerThanScreen: true,
    backgroundColor: '#000000',
    title: 'BSP Stage Display',
    show: showWindow,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });

  win.__isFrameless = isFullScreen;

  if (isFullScreen) {
    win.setBounds(target.bounds);
    try { win.setContentBounds(target.bounds); } catch {}
  }

  stageDisplayWindow = win;
  win.loadURL(isDev ? 'http://localhost:5173/stage-display.html' : `file://${path.join(__dirname, '../../dist/stage-display.html')}`);
  win.setMenuBarVisibility(false);
  win.webContents.setAudioMuted(true);

  stageWindows.add(win);
  broadcastStageWindows();

  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
      broadcastStageWindows();
    }
  });

  win.on('closed', () => {
    stageWindows.delete(win);
    if (stageDisplayWindow === win) stageDisplayWindow = null;
    broadcastStageWindows();
  });

  win.webContents.on('render-process-gone', (event, details) => {
    console.error('[StageDisplay] Renderer process crash detected:', details);
    if (!win.isDestroyed()) {
      setTimeout(() => {
        if (!win.isDestroyed()) {
          console.info('[StageDisplay] Auto-recovering stage display window after crash...');
          win.reload();
        }
      }, 250);
    }
  });

  win.webContents.on('did-finish-load', () => {
    if (!win.isDestroyed()) {
      win.webContents.send('display:message', { type: 'display:update', state: getDisplayState() });
      const stState = getStageState();
      if (Object.keys(stState).length > 0) win.webContents.send('stage:message', stState);
    }
  });

  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
  return win;
}

function setupStageDesignerEvents(win) {
  const contentsId = win.webContents.id;

  win.on('closed', () => {
    stageDesignerWindows.delete(win);
    dirtyDesigners.delete(contentsId);
    if (prewarmedStageDesignerWindow === win) {
      prewarmedStageDesignerWindow = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  let closeConfirmed = false;
  win.on('close', (event) => {
    if (closeConfirmed || !dirtyDesigners.get(contentsId)) {
      if (!app.isQuitting) {
        event.preventDefault();
        stageDesignerWindows.delete(win);
        dirtyDesigners.delete(contentsId);
        win.hide();
        prewarmedStageDesignerWindow = win;
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
      }
      return;
    }
    event.preventDefault();
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
    dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Cancel', 'Discard changes'],
      defaultId: 0,
      cancelId: 0,
      message: 'This layout has unsaved changes.',
      detail: 'Closing the designer now will discard them.',
    }).then(({ response }) => {
      if (response !== 1 || win.isDestroyed()) {
        if (win && !win.isDestroyed()) {
          win.focus();
        }
        return;
      }
      closeConfirmed = true;
      dirtyDesigners.delete(contentsId);
      if (!app.isQuitting) {
        win.hide();
        stageDesignerWindows.delete(win);
        prewarmedStageDesignerWindow = win;
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
      } else {
        win.close();
      }
    }).catch(() => {});
  });

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('display:message', { type: 'display:update', state: getDisplayState() });
    const stState = getStageState();
    if (Object.keys(stState).length > 0) win.webContents.send('stage:message', stState);
  });

  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
}

function prewarmStageDesignerWindow() {
  if (prewarmedStageDesignerWindow && !prewarmedStageDesignerWindow.isDestroyed()) return;
  try {
    const win = new BrowserWindow({
      width: 1440,
      height: 920,
      minWidth: 1040,
      minHeight: 640,
      resizable: true,
      maximizable: true,
      fullscreenable: true,
      thickFrame: true,
      show: false,
      backgroundColor: '#0b0d12',
      title: 'BSP Stage Layout Designer',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        backgroundThrottling: false,
      },
    });
    win.loadURL(isDev ? 'http://localhost:5173/stage-designer.html' : `file://${path.join(__dirname, '../../dist/stage-designer.html')}`);
    win.setMenuBarVisibility(false);
    setupStageDesignerEvents(win);
    prewarmedStageDesignerWindow = win;
  } catch (e) {
    console.warn('[StageDesigner] Prewarm failed:', e);
  }
}

function broadcastStageLayouts() {
  const service = getStageLayoutsService();
  if (!service) return;
  const payload = service.list();
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('stage-layouts:changed', payload);
  }
}

function createStageDesignerWindow() {
  for (const existing of liveStageDesignerWindows()) {
    if (existing.isVisible()) {
      if (existing.isMinimized()) existing.restore();
      existing.focus();
      return existing;
    }
  }

  if (prewarmedStageDesignerWindow && !prewarmedStageDesignerWindow.isDestroyed()) {
    const win = prewarmedStageDesignerWindow;
    stageDesignerWindows.add(win);
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    win.webContents.send('display:message', { type: 'display:update', state: getDisplayState() });
    const stState = getStageState();
    if (Object.keys(stState).length > 0) win.webContents.send('stage:message', stState);
    broadcastStageLayouts();
    return win;
  }

  const win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1040, minHeight: 640,
    resizable: true, maximizable: true, fullscreenable: true, thickFrame: true,
    backgroundColor: '#0b0d12', title: 'BSP Stage Layout Designer',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, webSecurity: true, backgroundThrottling: false },
  });
  win.loadURL(isDev ? 'http://localhost:5173/stage-designer.html' : `file://${path.join(__dirname, '../../dist/stage-designer.html')}`);
  win.setMenuBarVisibility(false);
  setupStageDesignerEvents(win);
  stageDesignerWindows.add(win);
  win.show();
  win.focus();
  return win;
}

function broadcastDockPopouts() {
  const ids = Array.from(dockPopoutWindows.keys());
  buildAppMenu(ids);
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('dock:popouts', ids);
  }
}

function createDockPopoutWindow(dockId) {
  const id = String(dockId || '');
  const existing = dockPopoutWindows.get(id);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.focus();
    return { ok: true };
  }

  let x, y;
  if (mainWindow && !mainWindow.isDestroyed()) {
    const mainBounds = mainWindow.getBounds();
    x = Math.round(mainBounds.x + Math.max(20, (mainBounds.width - 540) / 2));
    y = Math.round(mainBounds.y + 60);
  }

  const win = new BrowserWindow({
    width: 520,
    height: 720,
    minWidth: 340,
    minHeight: 280,
    x,
    y,
    resizable: true,
    maximizable: true,
    fullscreenable: false,
    fullscreen: false,
    alwaysOnTop: true,
    thickFrame: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 12, y: 7 },
    backgroundColor: '#b8b8bd',
    title: id,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });

  if (win.isFullScreen()) win.setFullScreen(false);
  if (win.isMaximized()) win.unmaximize();

  const query = `dock=${encodeURIComponent(id)}`;
  win.loadURL(isDev
    ? `http://localhost:5173/dock-popout.html?${query}`
    : `file://${path.join(__dirname, '../../dist/dock-popout.html')}?${query}`);
  win.setMenuBarVisibility(false);
  dockPopoutWindows.set(id, win);
  win.on('closed', () => {
    dockPopoutWindows.delete(id);
    broadcastDockPopouts();
  });
  win.webContents.once('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('store:syncRequest');
    }
    broadcastDockPopouts();
  });
  return { ok: true };
}

function createSlideEditorWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 640,
    minHeight: 480,
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    thickFrame: true,
    backgroundColor: '#0b0d12',
    title: 'BSP Slide Editor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });
  win.loadURL(isDev ? 'http://localhost:5173/slide-editor/index.html' : `file://${path.join(__dirname, '../../dist/slide-editor/index.html')}`);
  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
  return win;
}

module.exports = {
  initWindowManager,
  createSplashWindow,
  createMainWindow,
  getMainWindow: () => mainWindow,
  getDisplayWindow: () => displayWindow,
  getStageDisplayWindow: () => stageDisplayWindow,
  getStageWindows: () => stageWindows,
  liveStageWindows,
  getStageDesignerWindows: () => stageDesignerWindows,
  liveStageDesignerWindows,
  getDirtyDesigners: () => dirtyDesigners,
  getDockPopoutWindows: () => dockPopoutWindows,
  getDisplayPayload,
  chooseDisplay,
  broadcastDisplayList,
  broadcastStageWindows,
  createDisplayWindow,
  createStageDisplayWindow,
  prewarmStageDesignerWindow,
  createStageDesignerWindow,
  broadcastStageLayouts,
  broadcastDockPopouts,
  createDockPopoutWindow,
  createSlideEditorWindow,
};
