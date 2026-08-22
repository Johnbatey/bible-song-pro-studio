const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('BSP', {
  platform: () => ipcRenderer.invoke('get:platform'),
  userDataPath: () => ipcRenderer.invoke('get:userDataPath'),
  version: () => ipcRenderer.invoke('get:version'),

  /* Opens a link in the operator's own browser. The main process refuses
     anything that is not https and on its allowlist. */
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    isFullScreen: () => ipcRenderer.invoke('window:isFullScreen'),
    onFullScreenChange: (cb) => { ipcRenderer.on('fullscreen:changed', (_, val) => cb(val)); },
  },

  display: {
    open: (target) => ipcRenderer.invoke('display:open', target),
    getActive: () => ipcRenderer.invoke('display:getActive'),
    onListChanged: (cb) => {
      const handler = (_, displays) => cb(displays);
      ipcRenderer.on('display:listChanged', handler);
      return () => ipcRenderer.removeListener('display:listChanged', handler);
    },
    close: () => ipcRenderer.invoke('display:close'),
    getDisplays: () => ipcRenderer.invoke('display:getDisplays'),
    sendState: (state) => ipcRenderer.invoke('display:sendState', state),
    getState: () => ipcRenderer.invoke('display:getState'),
    isOpen: () => ipcRenderer.invoke('display:isOpen'),
    getStatus: () => ipcRenderer.invoke('display:getStatus'),
    onMessage: (cb) => {
      const handler = (_, msg) => cb(msg);
      ipcRenderer.on('display:message', handler);
      return () => ipcRenderer.removeListener('display:message', handler);
    },
  },

  /* The stage display's own feed. Deliberately the same shape as `display`
     above: the two windows are siblings, and an operator message reaches the
     stage the same way program state reaches the projector. */
  stage: {
    sendState: (message) => ipcRenderer.invoke('stage:sendState', message),
    getState: () => ipcRenderer.invoke('stage:getState'),
    onMessage: (cb) => {
      const handler = (_, msg) => cb(msg);
      ipcRenderer.on('stage:message', handler);
      return () => ipcRenderer.removeListener('stage:message', handler);
    },
  },

  /* The operator's own saved layouts. Kept in a file rather than in the
     renderer's storage because the Stage Layout Designer is a separate window
     and has to read and write the same library the operator panel does. */
  stageLayouts: {
    list: () => ipcRenderer.invoke('stage-layouts:list'),
    save: (layout) => ipcRenderer.invoke('stage-layouts:save', layout),
    delete: (id) => ipcRenderer.invoke('stage-layouts:delete', id),
    setActive: (id) => ipcRenderer.invoke('stage-layouts:setActive', id),
    onChanged: (cb) => {
      const handler = (_, payload) => cb(payload);
      ipcRenderer.on('stage-layouts:changed', handler);
      return () => ipcRenderer.removeListener('stage-layouts:changed', handler);
    },
  },

  bible: {
    getVersions: () => ipcRenderer.invoke('bible:getVersions'),
    getBooks: (versionId) => ipcRenderer.invoke('bible:getBooks', versionId),
    getChapter: (payload) => ipcRenderer.invoke('bible:getChapter', payload),
    search: (payload) => ipcRenderer.invoke('bible:search', payload),
    pick: () => ipcRenderer.invoke('bible:pick'),
    importFile: (payload) => ipcRenderer.invoke('bible:importFile', payload),
  },

  verse: {
    detect: (payload) => ipcRenderer.invoke('verse:detect', payload),
  },

  /* No `audio` bridge — see main.cjs. Microphones are enumerated in the
     renderer, which is the only side that can see them. */

  ai: {
    status: () => ipcRenderer.invoke('ai:status'),
    warmup: (payload) => ipcRenderer.invoke('ai:warmup', payload),
    transcribe: (payload) => ipcRenderer.invoke('ai:transcribe', payload),
    dispose: (payload) => ipcRenderer.invoke('ai:dispose', payload),
    setEngine: (engine) => ipcRenderer.invoke('ai:setEngine', engine),
    setLocalModel: (model) => ipcRenderer.invoke('ai:setLocalModel', model),
    getMlxWhisperStatus: () => ipcRenderer.invoke('ai:getMlxWhisperStatus'),
    warmupMlxWhisper: (payload) => ipcRenderer.invoke('ai:warmupMlxWhisper', payload),
    transcribeMlxWhisper: (payload) => ipcRenderer.invoke('ai:transcribeMlxWhisper', payload),
    disposeMlxWhisper: () => ipcRenderer.invoke('ai:disposeMlxWhisper'),
  },

  ndi: {
    start: (payload) => ipcRenderer.invoke('ndi:start', payload),
    stop: () => ipcRenderer.invoke('ndi:stop'),
    status: () => ipcRenderer.invoke('ndi:status'),
  },

  session: {
    start: (payload) => ipcRenderer.invoke('session:start', payload),
    end: () => ipcRenderer.invoke('session:end'),
    addEntry: (payload) => ipcRenderer.invoke('session:addEntry', payload),
    list: () => ipcRenderer.invoke('session:list'),
    get: (id) => ipcRenderer.invoke('session:get', id),
    export: (payload) => ipcRenderer.invoke('session:export', payload),
    status: () => ipcRenderer.invoke('session:status'),
  },

  song: {
    importFile: (payload) => ipcRenderer.invoke('song:importFile', payload),
    importText: (payload) => ipcRenderer.invoke('song:importText', payload),
    arrangeText: (payload) => ipcRenderer.invoke('song:arrangeText', payload),
    pick: () => ipcRenderer.invoke('song:pick'),
  },

  store: {
    load: () => ipcRenderer.invoke('store:load'),
    save: (value) => ipcRenderer.invoke('store:save', { value }),
    clear: () => ipcRenderer.invoke('store:clear'),
    broadcast: (snapshot) => ipcRenderer.send('store:broadcast', snapshot),
    requestSync: () => ipcRenderer.send('store:requestSync'),
    onRemote: (cb) => {
      const handler = (_, snapshot) => cb(snapshot);
      ipcRenderer.on('store:remote', handler);
      return () => ipcRenderer.removeListener('store:remote', handler);
    },
    onSyncRequest: (cb) => {
      const handler = () => cb();
      ipcRenderer.on('store:syncRequest', handler);
      return () => ipcRenderer.removeListener('store:syncRequest', handler);
    },
  },

  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch),
    clearSecret: (key) => ipcRenderer.invoke('settings:clearSecret', { key }),
  },

  stt: {
    start: (payload) => ipcRenderer.invoke('stt:start', payload || {}),
    stop: () => ipcRenderer.invoke('stt:stop'),
    status: () => ipcRenderer.invoke('stt:status'),
    sendAudio: (chunk) => ipcRenderer.send('stt:audio', chunk),
    onEvent: (cb) => {
      const handler = (_, event) => cb(event);
      ipcRenderer.on('stt:event', handler);
      return () => ipcRenderer.removeListener('stt:event', handler);
    },
  },

  obs: {
    connect: (payload) => ipcRenderer.invoke('obs:connect', payload || {}),
    disconnect: () => ipcRenderer.invoke('obs:disconnect'),
    status: () => ipcRenderer.invoke('obs:status'),
    setScene: (sceneName) => ipcRenderer.invoke('obs:setScene', { sceneName }),
    toggleStream: () => ipcRenderer.invoke('obs:toggleStream'),
    toggleRecord: () => ipcRenderer.invoke('obs:toggleRecord'),
    refresh: () => ipcRenderer.invoke('obs:refresh'),
    onEvent: (cb) => {
      const handler = (_, event) => cb(event);
      ipcRenderer.on('obs:event', handler);
      return () => ipcRenderer.removeListener('obs:event', handler);
    },
  },

  media: {
    list: () => ipcRenderer.invoke('media:list'),
    pick: () => ipcRenderer.invoke('media:pick'),
    import: (paths) => ipcRenderer.invoke('media:import', { paths }),
    importOptimized: (filePath) => ipcRenderer.invoke('media:importOptimized', { path: filePath }),
    remove: (id) => ipcRenderer.invoke('media:remove', { id }),
    rename: (id, name) => ipcRenderer.invoke('media:rename', { id, name }),
    /* Relink points an entry at the file's new home. `relink` takes a known
       path; `pickRelink` opens a chooser on the last known folder first. */
    relink: (id, path) => ipcRenderer.invoke('media:relink', { id, path }),
    pickRelink: (id, currentPath, name) => ipcRenderer.invoke('media:pickRelink', { id, currentPath, name }),
    reveal: (path) => ipcRenderer.invoke('media:reveal', { path }),
    baseUrl: () => ipcRenderer.invoke('media:baseUrl'),
    // Electron 32+ removed File.path; webUtils is the sanctioned replacement and must
    // be called here in the preload, with the real File object.
    pathForFile: (file) => {
      try { return webUtils.getPathForFile(file); } catch { return ''; }
    },
  },

  deck: {
    // Reads a .pptx back from disk so the editor can reopen an imported deck.
    // Only the path is persisted; the package itself never enters app state.
    read: (filePath) => ipcRenderer.invoke('deck:read', { filePath }),
    pick: () => ipcRenderer.invoke('deck:pick'),
    // Electron 32+ removed File.path; webUtils must be called here, in the
    // preload, with the real File object.
    pathForFile: (file) => {
      try { return webUtils.getPathForFile(file); } catch { return ''; }
    },
  },

  dock: {
    /**
     * Fire-and-forget: push the current set of open dock ids so the native
     * menu can update its checkmarks. Called on every dockview layout change.
     */
    syncMenu: (openIds) => ipcRenderer.send('dock:syncMenu', openIds),

    /**
     * Subscribe to native-menu toggle events. The main process sends the dock
     * id that was clicked. Returns an unsubscribe function.
     */
    onToggle: (cb) => {
      const handler = (_, id) => cb(id);
      ipcRenderer.on('dock:toggle', handler);
      return () => ipcRenderer.removeListener('dock:toggle', handler);
    },

    /**
     * Subscribe to the native-menu "Reset Layout" item. Returns an unsubscribe
     * function.
     */
    onResetLayout: (cb) => {
      const handler = () => cb();
      ipcRenderer.on('dock:resetLayout', handler);
      return () => ipcRenderer.removeListener('dock:resetLayout', handler);
    },
    popOut: (id) => ipcRenderer.invoke('dock:popOut', { id }),
    focusPopout: (id) => ipcRenderer.invoke('dock:focusPopout', { id }),
    listPopouts: () => ipcRenderer.invoke('dock:listPopouts'),
    onPopoutsChanged: (cb) => {
      const handler = (_, ids) => cb(ids);
      ipcRenderer.on('dock:popouts', handler);
      return () => ipcRenderer.removeListener('dock:popouts', handler);
    },
  },

  /* Named dock arrangements. The renderer owns the layout trees and the file
     format; this side only carries the menu's view of the list, the menu's
     commands back, and the two operations that need a native file dialog. */
  workspace: {
    /** Push the list and the active id so the Workspace menu can be rebuilt. */
    sync: (payload) => ipcRenderer.send('workspace:sync', payload),
    /** Subscribe to Workspace menu clicks. Returns an unsubscribe function. */
    onCommand: (cb) => {
      const handler = (_, payload) => cb(payload);
      ipcRenderer.on('workspace:command', handler);
      return () => ipcRenderer.removeListener('workspace:command', handler);
    },
    exportFile: (payload) => ipcRenderer.invoke('workspace:export', payload),
    importFile: () => ipcRenderer.invoke('workspace:import'),
  },

  openSlideEditor: () => ipcRenderer.invoke('slide-editor:open'),
  openStageDisplay: () => ipcRenderer.invoke('stage-display:open'),
  closeStageDisplay: () => ipcRenderer.invoke('stage-display:close'),
  openStageDesigner: () => ipcRenderer.invoke('stage-designer:open'),

  /* The stage screen can also be closed from its own title bar, so the panel
     asks once on mount and then listens rather than assuming its own toggle
     is the only thing that ever changes the answer. */
  isStageDisplayOpen: () => ipcRenderer.invoke('stage-display:isOpen'),
  onStageDisplayState: (cb) => {
    const handler = (_, payload) => cb(!!payload?.open);
    ipcRenderer.on('stage-display:state', handler);
    return () => ipcRenderer.removeListener('stage-display:state', handler);
  },

  /* The designer tells the main process when it holds unsaved work, because
     only the main process can stop a window closing long enough to ask. */
  stageDesigner: {
    setDirty: (dirty) => ipcRenderer.send('stage-designer:dirty', !!dirty),
    close: () => ipcRenderer.invoke('stage-designer:close'),
  },
  /* Blackout is toggled in three places — the BLACK button, Cmd+Shift+B, and
     POST /api/display/blackout — and the renderer's store is the one authority
     on it, because the renderer is what pushes display state outward. The
     other two therefore ask the renderer rather than writing the main
     process's copy, which the next state push would have overwritten. */
  onBlackoutToggle: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('shortcut:blackout', handler);
    return () => ipcRenderer.removeListener('shortcut:blackout', handler);
  },
  getDisplayUrl: () => ipcRenderer.invoke('get:displayUrl'),
  onDisplayMessage: (cb) => {
    const handler = (_, msg) => cb(msg);
    ipcRenderer.on('display:message', handler);
    return () => ipcRenderer.removeListener('display:message', handler);
  },
  sendDisplayMessage: (msg) => { ipcRenderer.send('display:message', msg); },
  lexicon: {
    lookup: (query) => ipcRenderer.invoke('lexicon:lookup', query),
    detect: (text) => ipcRenderer.invoke('lexicon:detect', text),
    annotate: (text, book) => ipcRenderer.invoke('lexicon:annotate', { text, book }),
  },
  feedback: {
    send: (payload) => ipcRenderer.invoke('feedback:send', payload),
  },
  updates: {
    check: () => ipcRenderer.invoke('app:checkForUpdates'),
  },
});
