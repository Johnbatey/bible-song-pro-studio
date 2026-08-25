const fs = require('fs');

let koffiModule = null;
let koffiLoadError = null;

function getKoffi() {
  if (koffiModule) return koffiModule;
  if (koffiLoadError) return null;
  try {
    koffiModule = require('koffi');
    return koffiModule;
  } catch (err) {
    koffiLoadError = err;
    console.warn('Failed to load Koffi native module:', err.message);
    return null;
  }
}

const path = require('path');

// NDIlib_FourCC_video_type_BGRA — ('B') | ('G'<<8) | ('R'<<16) | ('A'<<24).
// Electron's capturePage().toBitmap() already hands back BGRA, so the frame buffer
// can go straight to NDI with no per-pixel conversion.
const FOURCC_BGRA = 0x41524742;
const FRAME_FORMAT_PROGRESSIVE = 1;

/* Cached so TitleBar / Settings status polls (every ~2s) do not re-walk the
   filesystem. A missed install after the first lookup is rare; restarting the
   app picks it up. `null` means "looked, not found" — distinct from unset. */
let cachedLibPath = undefined;

/**
 * Universal dynamic NDI library locator across Windows, macOS, and Linux.
 * Adapts to NDI 5, NDI 6, NDI 7+, custom SDK directories, and system paths.
 *
 * Important on Windows: never readdir system roots like System32. An earlier
 * version walked every System32 subdirectory on each `ndi:status` poll, which
 * pegged the Electron main process at ~100% CPU and froze the UI cursor.
 */
function findLib() {
  if (cachedLibPath !== undefined) return cachedLibPath;

  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const isLinux = process.platform === 'linux';

  const platformFolder = isWin ? 'win32-x64' : isMac ? 'darwin' : 'linux-x64';

  const targetNames = isWin
    ? ['Processing.NDI.Lib.x64.dll', 'Processing.NDI.Lib.x86.dll']
    : isMac
    ? ['libndi.dylib', 'libndi.6.dylib', 'libndi.5.dylib', 'libndi.4.dylib']
    : ['libndi.so', 'libndi.so.6', 'libndi.so.5', 'libndi.so.4'];

  function checkDir(dir) {
    if (!dir || typeof dir !== 'string') return null;
    for (const name of targetNames) {
      const full = path.join(dir, name);
      try {
        if (fs.existsSync(full)) return full;
      } catch (_) {}
    }

    const subdirs = isWin
      ? ['v6', 'v5', 'v4', 'Bin/x64', 'Runtime', 'Runtime/v6', 'Runtime/v5', 'x64']
      : isMac
      ? ['lib/macOS', 'macOS', 'lib']
      : ['lib/x86_64-linux-gnu', 'x86_64-linux-gnu', 'lib', 'lib64'];

    for (const sub of subdirs) {
      for (const name of targetNames) {
        const full = path.join(dir, sub, name);
        try {
          if (fs.existsSync(full)) return full;
        } catch (_) {}
      }
    }
    return null;
  }

  /** Only NDI install roots are safe to readdir — never System32 / usr/lib. */
  function walkShallow(dir) {
    if (!dir) return null;
    const direct = checkDir(dir);
    if (direct) return direct;
    try {
      if (!fs.existsSync(dir)) return null;
      const subfolders = fs.readdirSync(dir);
      subfolders.sort((a, b) => b.localeCompare(a));
      for (const sub of subfolders) {
        const found = checkDir(path.join(dir, sub));
        if (found) return found;
      }
    } catch (_) {}
    return null;
  }

  function finish(found) {
    cachedLibPath = found || null;
    return cachedLibPath;
  }

  // 1. Dynamic Environment Variables (e.g. NDI_RUNTIME_DIR_V6, NDILIB_REDIST_DIR)
  const envKeys = Object.keys(process.env)
    .filter((k) => /^NDI/i.test(k) || /NDILIB/i.test(k))
    .sort((a, b) => b.localeCompare(a));

  for (const key of envKeys) {
    const val = process.env[key];
    if (val) {
      const found = checkDir(val);
      if (found) return finish(found);
    }
  }

  // 2. Bundled copy first — cheap, and the usual case for this app.
  let appPath = null;
  try {
    const { app } = require('electron');
    if (app && typeof app.getAppPath === 'function') {
      appPath = app.getAppPath();
    }
  } catch (_) {}

  const bundledCandidates = [
    process.resourcesPath && path.join(process.resourcesPath, 'bin/ndi'),
    process.resourcesPath && path.join(process.resourcesPath, 'assets/bin/ndi', platformFolder),
    process.resourcesPath && path.join(process.resourcesPath, 'app.asar.unpacked/assets/bin/ndi', platformFolder),
    appPath && path.join(appPath, 'assets/bin/ndi', platformFolder),
    path.join(__dirname, '../../assets/bin/ndi', platformFolder),
    path.join(__dirname, '../assets/bin/ndi', platformFolder),
    path.join(process.cwd(), 'assets/bin/ndi', platformFolder),
  ].filter(Boolean);

  for (const bundledDir of bundledCandidates) {
    const bundledFound = checkDir(bundledDir);
    if (bundledFound) return finish(bundledFound);
  }

  // 3. System NDI installs (Program Files\NDI\* only — shallow walk).
  if (isWin) {
    const ndiRoots = [
      process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'NDI'),
      process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'NDI'),
      process.env.ProgramW6432 && path.join(process.env.ProgramW6432, 'NDI'),
      'C:\\Program Files\\NDI',
      'C:\\Program Files (x86)\\NDI',
    ].filter(Boolean);

    for (const root of ndiRoots) {
      const found = walkShallow(root);
      if (found) return finish(found);
    }

    // Direct file probes only — never readdir these.
    for (const leaf of [
      process.env.SystemRoot && path.join(process.env.SystemRoot, 'System32'),
      'C:\\Windows\\System32',
    ].filter(Boolean)) {
      const found = checkDir(leaf);
      if (found) return finish(found);
    }
  } else if (isMac) {
    for (const base of [
      '/Library/NDI SDK for Apple/lib/macOS',
      '/Library/NDI Runtimes/macOS',
      '/Library/NDI SDK for Apple',
      '/opt/homebrew/lib',
      '/usr/local/lib',
      '/usr/lib',
    ]) {
      const found = checkDir(base);
      if (found) return finish(found);
    }
  } else if (isLinux) {
    for (const base of [
      '/usr/lib/x86_64-linux-gnu',
      '/usr/lib64',
      '/usr/lib',
      '/usr/local/lib',
      '/opt/ndi/lib/x86_64-linux-gnu',
      '/opt/ndi/lib',
      '/opt/ndi',
    ]) {
      const found = checkDir(base);
      if (found) return finish(found);
    }
  }

  return finish(null);
}

/**
 * What this app announces itself as on the network.
 *
 * "Studio" is load-bearing here, not decoration: the OBS/vMix plugin is also
 * called Bible Song Pro, and a church running both would have put two different
 * sources on the wire under one name for the switcher to pick between.
 *
 * Exported because main.cjs has three fallbacks of its own, and a default that
 * disagrees with itself across four call sites is how a stream ends up named
 * one thing on launch and another on a hotkey.
 */
const DEFAULT_NDI_NAME = 'Bible Song Pro Studio';

/**
 * NDI output.
 *
 * Rewritten against koffi's real API — the previous version declared its bindings with
 * `lib.func(...)` but then called them as `lib.func.NDIlib_initialize()`, which is not
 * where koffi puts them, so no NDI call ever actually ran. It also omitted `timecode`
 * from the video frame struct (shifting every field after it) and converted BGRA→RGBA
 * in a 2M-iteration JS loop per frame, at 15fps.
 */
function createNdiService() {
  let lib = null;
  let api = null;
  let sendInstance = null;
  let sourceName = DEFAULT_NDI_NAME;
  let isRunning = false;
  let captureTimer = null;
  let displayWindow = null;
  let lastError = '';
  let framesSent = 0;
  let capturing = false; // drop frames rather than queue them if capture falls behind
  let width = 1280;
  let height = 720;

  function initLibrary() {
    if (api) return true;
    const koffi = getKoffi();
    if (!koffi) {
      lastError = koffiLoadError ? `Koffi native module error: ${koffiLoadError.message}` : 'Koffi native module unavailable';
      return false;
    }
    let libPath = findLib();
    try {
      if (libPath) {
        lib = koffi.load(libPath);
      } else {
        const fallbackName = process.platform === 'win32'
          ? 'Processing.NDI.Lib.x64.dll'
          : process.platform === 'darwin'
          ? 'libndi.dylib'
          : 'libndi.so';
        lib = koffi.load(fallbackName);
        libPath = fallbackName;
      }
    } catch (err) {
      lastError = 'NDI runtime not found. Install the NDI SDK/Runtime from https://ndi.video';
      lib = null;
      api = null;
      return false;
    }

    try {

      koffi.struct('NDIlib_send_create_t', {
        p_ndi_name: 'const char *',
        p_groups: 'const char *',
        clock_video: 'bool',
        clock_audio: 'bool',
      });

      // Field order and types must match the C header exactly — koffi lays out
      // padding from these declarations.
      koffi.struct('NDIlib_video_frame_v2_t', {
        xres: 'int32_t',
        yres: 'int32_t',
        FourCC: 'int32_t',
        frame_rate_N: 'int32_t',
        frame_rate_D: 'int32_t',
        picture_aspect_ratio: 'float',
        frame_format_type: 'int32_t',
        timecode: 'int64_t',
        p_data: 'uint8_t *',
        line_stride_in_bytes: 'int32_t',
        p_metadata: 'const char *',
        timestamp: 'int64_t',
      });

      api = {
        initialize: lib.func('bool NDIlib_initialize()'),
        destroy: lib.func('void NDIlib_destroy()'),
        sendCreate: lib.func('void * NDIlib_send_create(const NDIlib_send_create_t *settings)'),
        sendDestroy: lib.func('void * NDIlib_send_destroy(void *instance)'),
        sendVideo: lib.func('void NDIlib_send_send_video_v2(void *instance, const NDIlib_video_frame_v2_t *frame)'),
        getConnections: lib.func('int NDIlib_send_get_no_connections(void *instance, uint32_t timeout_ms)'),
      };
      lastError = '';
      return true;
    } catch (err) {
      lastError = `Failed to load NDI runtime: ${err.message}`;
      lib = null;
      api = null;
      return false;
    }
  }

  function status() {
    return {
      ok: true,
      available: Boolean(findLib()),
      libraryLoaded: Boolean(api),
      running: isRunning,
      source: sourceName,
      instanceActive: Boolean(sendInstance),
      framesSent,
      width,
      height,
      connections: connectionCount(),
      lastError,
    };
  }

  /** Receivers currently subscribed — 0 means nobody is watching, so capture can idle. */
  function connectionCount() {
    if (!api || !sendInstance) return 0;
    try { return api.getConnections(sendInstance, 0); } catch { return 0; }
  }

  function start(name) {
    if (isRunning) return { ok: true, source: sourceName, status: status() };
    if (name) sourceName = name;
    if (!initLibrary()) return { ok: false, error: lastError, status: status() };

    try {
      if (!api.initialize()) {
        lastError = 'NDIlib_initialize failed — this CPU may lack the required instruction set.';
        return { ok: false, error: lastError, status: status() };
      }
      sendInstance = api.sendCreate({
        p_ndi_name: sourceName,
        p_groups: null,
        clock_video: true,
        clock_audio: false,
      });
      if (!sendInstance) {
        lastError = 'NDIlib_send_create returned null';
        return { ok: false, error: lastError, status: status() };
      }
      isRunning = true;
      framesSent = 0;
      lastError = '';
      console.log('NDI source started:', sourceName);
      return { ok: true, source: sourceName, status: status() };
    } catch (err) {
      lastError = err.message;
      return { ok: false, error: lastError, status: status() };
    }
  }

  function setDisplayWindow(win) {
    displayWindow = win;
  }

  function sendFrame(bgraBuffer, frameWidth, frameHeight, fps) {
    if (!isRunning || !sendInstance || !api) return false;
    try {
      api.sendVideo(sendInstance, {
        xres: frameWidth,
        yres: frameHeight,
        FourCC: FOURCC_BGRA,
        frame_rate_N: fps * 1000,
        frame_rate_D: 1000,
        picture_aspect_ratio: frameWidth / frameHeight,
        frame_format_type: FRAME_FORMAT_PROGRESSIVE,
        timecode: 0n, // 0 = let the SDK synthesise timecode
        p_data: bgraBuffer,
        line_stride_in_bytes: frameWidth * 4,
        p_metadata: null,
        timestamp: 0n,
      });
      framesSent += 1;
      return true;
    } catch (err) {
      lastError = err.message;
      return false;
    }
  }

  function startCapture(fps = 30, options = {}) {
    if (!isRunning || !displayWindow) return false;
    if (options.width) width = options.width;
    if (options.height) height = options.height;
    stopCapture();

    captureTimer = setInterval(async () => {
      if (!displayWindow || displayWindow.isDestroyed() || !sendInstance) { stopCapture(); return; }
      if (capturing) return;
      
      const now = Date.now();
      const numConnections = connectionCount();
      // When nobody is connected, publish at 1 FPS to keep NDI source discovery/preview responsive in OBS/vMix without wasting CPU
      if (numConnections === 0 && options.idleWhenUnwatched !== false) {
        if (captureTimer.lastIdleTick && now - captureTimer.lastIdleTick < 1000) return;
        captureTimer.lastIdleTick = now;
      }

      capturing = true;
      try {
        let rect = undefined;
        if (displayWindow.getContentBounds) {
          const bounds = displayWindow.getContentBounds();
          if (bounds && bounds.width > 0 && bounds.height > 0) {
            const scale = Math.min(bounds.width / 1920, bounds.height / 1080);
            const surfaceW = Math.max(1, Math.round(1920 * scale));
            const surfaceH = Math.max(1, Math.round(1080 * scale));
            const surfaceX = Math.max(0, Math.round((bounds.width - surfaceW) / 2));
            const surfaceY = Math.max(0, Math.round((bounds.height - surfaceH) / 2));
            rect = { x: surfaceX, y: surfaceY, width: surfaceW, height: surfaceH };
          }
        }
        let image = await displayWindow.capturePage(rect);
        if (image && !image.isEmpty()) {
          const targetW = width || 1920;
          const targetH = height || 1080;
          
          const size = image.getSize();
          if (size.width !== targetW || size.height !== targetH) {
            image = image.resize({ width: targetW, height: targetH, quality: 'best' });
          }
          
          const bitmap = image.toBitmap();
          if (bitmap && bitmap.length > 0) {
            sendFrame(bitmap, targetW, targetH, fps);
          }
        }
      } catch {
        // window closed mid-capture
      } finally {
        capturing = false;
      }
    }, Math.max(1000 / fps, 20));
    return true;
  }

  function stopCapture() {
    if (captureTimer) { clearInterval(captureTimer); captureTimer = null; }
    capturing = false;
  }

  function stop() {
    stopCapture();
    isRunning = false;
    if (sendInstance && api) {
      try { api.sendDestroy(sendInstance); } catch { /* already gone */ }
    }
    sendInstance = null;
    displayWindow = null;
    return { ok: true, status: status() };
  }

  function destroy() {
    stop();
    if (api) {
      try { api.destroy(); } catch { /* already gone */ }
    }
    api = null;
    lib = null;
    return { ok: true };
  }

  return { status, start, stop, destroy, setDisplayWindow, startCapture, stopCapture, sendFrame, connectionCount };
}

module.exports = { createNdiService, findLib, FOURCC_BGRA, DEFAULT_NDI_NAME };
