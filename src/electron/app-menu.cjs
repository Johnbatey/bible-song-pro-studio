const { app, Menu, MenuItem, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

let setMenuLocale = (locale) => {};
let mt = (k, fallback) => fallback || k;
try {
  const menuMsg = require('../i18n/menu-messages.cjs');
  setMenuLocale = menuMsg.setMenuLocale || setMenuLocale;
  mt = menuMsg.mt || mt;
} catch (err) {
  console.warn('[AppMenu] Warning: Could not load menu-messages.cjs, using default labels:', err?.message);
}

/**
 * All dockable panels in display order for the native menu, grouped with
 * separators. This mirrors DOCKS in docks.tsx but lives here so the main
 * process doesn't need to parse the renderer bundle.
 */
const DOCK_DEFS = [
  /* Sources — what goes on the screen. */
  { id: 'bible' },
  { id: 'songs' },
  { id: 'presentation' },
  { id: 'media' },
  null, // separator
  /* Displays — the screens it goes to. */
  { id: 'output' },
  { id: 'stage' },
  null,
  /* Service — what is running right now. */
  { id: 'live' },
  { id: 'messages' },
  { id: 'transcript' },
  { id: 'queue' },
  { id: 'history' },
  null,
  /* Looks — how all of it is dressed. */
  { id: 'scenes' },
  { id: 'sources' },
  { id: 'audiomixer' },
  { id: 'promixer' },
];

/**
 * What the renderer last told us about saved arrangements.
 */
let menuWorkspaces = { list: [], activeId: null };

/**
 * The last dock ids the renderer reported.
 */
let menuOpenIds = [];

let getMainWindow = () => null;

function initAppMenu(mainWindowGetter) {
  getMainWindow = mainWindowGetter;
}

function sendWorkspaceCommand(action, id) {
  const mainWindow = getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('workspace:command', { action, id: id || null });
  }
}

function revealLayoutsFolder() {
  const userData = app.getPath('userData');
  const stageLayouts = path.join(userData, 'stage-layouts.json');
  if (fs.existsSync(stageLayouts)) {
    shell.showItemInFolder(stageLayouts);
    return { ok: true, path: userData };
  }
  shell.openPath(userData);
  return { ok: true, path: userData };
}

function buildAppMenu(openIds) {
  if (openIds !== undefined) {
    menuOpenIds = openIds;
  } else {
    openIds = menuOpenIds;
  }
  const mainWindow = getMainWindow();
  const openSet = new Set(openIds || []);

  const dockItems = DOCK_DEFS.map((def) => {
    if (def === null) return new MenuItem({ type: 'separator' });
    return new MenuItem({
      label: mt(`dock.${def.id}`),
      type: 'checkbox',
      checked: openSet.has(def.id),
      click() {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('dock:toggle', def.id);
        }
      },
    });
  });

  dockItems.push(new MenuItem({ type: 'separator' }));
  dockItems.push(new MenuItem({
    label: mt('menu.resetLayout'),
    accelerator: process.platform === 'darwin' ? 'Cmd+Shift+R' : 'Ctrl+Shift+R',
    click() {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('dock:resetLayout');
      }
    },
  }));

  const active = menuWorkspaces.list.find((w) => w.id === menuWorkspaces.activeId) || null;
  const activeLabel = active ? `“${active.name}”` : mt('menu.defaultLayout');

  const workspaceItems = [
    new MenuItem({
      label: mt('menu.defaultLayout'),
      type: 'checkbox',
      checked: !active,
      click() { sendWorkspaceCommand('activate', null); },
    }),
  ];

  if (menuWorkspaces.list.length > 0) {
    workspaceItems.push(new MenuItem({ type: 'separator' }));
    for (const ws of menuWorkspaces.list) {
      workspaceItems.push(new MenuItem({
        label: ws.name,
        type: 'checkbox',
        checked: ws.id === menuWorkspaces.activeId,
        click() { sendWorkspaceCommand('activate', ws.id); },
      }));
    }
  }

  workspaceItems.push(new MenuItem({ type: 'separator' }));
  workspaceItems.push(new MenuItem({
    label: mt('menu.saveLayout'),
    accelerator: process.platform === 'darwin' ? 'Cmd+Shift+S' : 'Ctrl+Shift+S',
    click() { sendWorkspaceCommand('save'); },
  }));
  workspaceItems.push(new MenuItem({
    label: mt('menu.saveAsLayout'),
    click() { sendWorkspaceCommand('saveAs'); },
  }));
  workspaceItems.push(new MenuItem({
    label: mt('menu.updateLayout', { name: activeLabel }),
    enabled: Boolean(active),
    click() { sendWorkspaceCommand('update'); },
  }));

  workspaceItems.push(new MenuItem({ type: 'separator' }));
  workspaceItems.push(new MenuItem({
    label: mt('menu.renameLayout', { name: activeLabel }),
    enabled: Boolean(active),
    click() { sendWorkspaceCommand('rename'); },
  }));
  workspaceItems.push(new MenuItem({
    label: mt('menu.deleteLayout', { name: activeLabel }),
    enabled: Boolean(active),
    click() { sendWorkspaceCommand('delete'); },
  }));

  workspaceItems.push(new MenuItem({ type: 'separator' }));
  workspaceItems.push(new MenuItem({
    label: mt('menu.importWorkspace'),
    click() { sendWorkspaceCommand('import'); },
  }));
  workspaceItems.push(new MenuItem({
    label: mt('menu.exportLayout', { name: activeLabel }),
    click() { sendWorkspaceCommand('export'); },
  }));

  workspaceItems.push(new MenuItem({ type: 'separator' }));
  workspaceItems.push(new MenuItem({
    label: mt('menu.showLayoutsFolder'),
    click() { revealLayoutsFolder(); },
  }));

  const template = [
    ...(process.platform === 'darwin'
      ? [{
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      }]
      : []),
    {
      label: mt('menu.edit'),
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: mt('menu.view'),
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: mt('menu.dock'),
      submenu: dockItems,
    },
    {
      label: mt('menu.workspace'),
      submenu: workspaceItems,
    },
    {
      label: mt('menu.window'),
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(process.platform === 'darwin'
          ? [{ type: 'separator' }, { role: 'front' }]
          : [{ role: 'close' }]),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function updateMenuWorkspaces(payload) {
  menuWorkspaces = payload || { list: [], activeId: null };
}

function getMenuWorkspaces() {
  return menuWorkspaces;
}

module.exports = {
  initAppMenu,
  buildAppMenu,
  updateMenuWorkspaces,
  getMenuWorkspaces,
  revealLayoutsFolder,
  sendWorkspaceCommand,
  setMenuLocale,
};
