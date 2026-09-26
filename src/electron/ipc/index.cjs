const { IpcRegistry } = require('./registry.cjs');
const { registerBibleIpc } = require('./bible-ipc.cjs');
const { registerWindowIpc } = require('./window-ipc.cjs');
const { registerDisplayIpc } = require('./display-ipc.cjs');
const { registerMediaIpc } = require('./media-ipc.cjs');

module.exports = {
  IpcRegistry,
  registerBibleIpc,
  registerWindowIpc,
  registerDisplayIpc,
  registerMediaIpc,
};
