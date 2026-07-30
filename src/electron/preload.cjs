const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('BSP', {
  platform: () => ipcRenderer.invoke('get:platform'),
  userDataPath: () => ipcRenderer.invoke('get:userDataPath'),

  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    isFullScreen: () => ipcRenderer.invoke('window:isFullScreen'),
    onFullScreenChange: (cb) => { ipcRenderer.on('fullscreen:changed', (_, val) => cb(val)); },
  },

  display: {
    open: (index) => ipcRenderer.invoke('display:open', index),
    close: () => ipcRenderer.invoke('display:close'),
    getDisplays: () => ipcRenderer.invoke('display:getDisplays'),
    sendState: (state) => ipcRenderer.invoke('display:sendState', state),
    getState: () => ipcRenderer.invoke('display:getState'),
    isOpen: () => ipcRenderer.invoke('display:isOpen'),
    getStatus: () => ipcRenderer.invoke('display:getStatus'),
  },

  bible: {
    getVersions: () => ipcRenderer.invoke('bible:getVersions'),
    getBooks: (versionId) => ipcRenderer.invoke('bible:getBooks', versionId),
    getChapter: (payload) => ipcRenderer.invoke('bible:getChapter', payload),
    search: (payload) => ipcRenderer.invoke('bible:search', payload),
  },

  verse: {
    detect: (payload) => ipcRenderer.invoke('verse:detect', payload),
  },

  audio: {
    getInputDevices: () => ipcRenderer.invoke('audio:getInputDevices'),
  },

  ai: {
    status: () => ipcRenderer.invoke('ai:status'),
    warmup: (payload) => ipcRenderer.invoke('ai:warmup', payload),
    transcribe: (payload) => ipcRenderer.invoke('ai:transcribe', payload),
    dispose: (payload) => ipcRenderer.invoke('ai:dispose', payload),
    setEngine: (engine) => ipcRenderer.invoke('ai:setEngine', engine),
    getMlxWhisperStatus: () => ipcRenderer.invoke('ai:getMlxWhisperStatus'),
    warmupMlxWhisper: (payload) => ipcRenderer.invoke('ai:warmupMlxWhisper', payload),
    transcribeMlxWhisper: (payload) => ipcRenderer.invoke('ai:transcribeMlxWhisper', payload),
    disposeMlxWhisper: () => ipcRenderer.invoke('ai:disposeMlxWhisper'),
  },

  ndi: {
    start: () => ipcRenderer.invoke('ndi:start'),
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
  },

  store: {
    load: () => ipcRenderer.invoke('store:load'),
    save: (value) => ipcRenderer.invoke('store:save', { value }),
    clear: () => ipcRenderer.invoke('store:clear'),
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
    remove: (id) => ipcRenderer.invoke('media:remove', { id }),
    rename: (id, name) => ipcRenderer.invoke('media:rename', { id, name }),
    baseUrl: () => ipcRenderer.invoke('media:baseUrl'),
    // Electron 32+ removed File.path; webUtils is the sanctioned replacement and must
    // be called here in the preload, with the real File object.
    pathForFile: (file) => {
      try { return webUtils.getPathForFile(file); } catch { return ''; }
    },
  },

  openSlideEditor: () => ipcRenderer.invoke('slide-editor:open'),
  openStageDisplay: () => ipcRenderer.invoke('stage-display:open'),
  getDisplayUrl: () => ipcRenderer.invoke('get:displayUrl'),
  onDisplayMessage: (cb) => { ipcRenderer.on('display:message', (_, msg) => cb(msg)); },
  sendDisplayMessage: (msg) => { ipcRenderer.send('display:message', msg); },
});
