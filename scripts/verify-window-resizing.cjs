const fs = require('node:fs');
const path = require('node:path');

const mainPath = path.join(process.cwd(), 'src', 'electron', 'main.cjs');
const mainSource = fs.readFileSync(mainPath, 'utf8');

function assertIncludes(label, needle) {
  if (!mainSource.includes(needle)) {
    throw new Error(`${label} missing: ${needle}`);
  }
}

function assertNotIncludes(label, needle) {
  if (mainSource.includes(needle)) {
    throw new Error(`${label} still present: ${needle}`);
  }
}

assertIncludes('main window native frame', 'frame: true');
assertIncludes('main window resizable flag', 'resizable: true');
assertIncludes('main window minimum size', 'win.setMinimumSize(640, 480)');
assertIncludes('display output fitted bounds helper', 'function resizableOutputBounds(bounds)');
assertIncludes('display output minimum size', 'displayWindow.setMinimumSize(640, 360)');
assertIncludes('display output resizable flag', 'displayWindow.setResizable(true)');

assertNotIncludes('hidden titlebar chrome', 'titleBarStyle');
assertNotIncludes('forced fullscreen output window', 'fullscreen: true');
assertNotIncludes('frameless output window', 'frame: false, alwaysOnTop: true');
assertNotIncludes('raw monitor bounds used for output window', 'const d = bounds || screen.getPrimaryDisplay().bounds');

console.log('Window resizing architecture verified');
