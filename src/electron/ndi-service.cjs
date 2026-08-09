const koffi = require('koffi');
const fs = require('fs');

// NDIlib_FourCC_video_type_BGRA — ('B') | ('G'<<8) | ('R'<<16) | ('A'<<24).
// Electron's capturePage().toBitmap() already hands back BGRA, so the frame buffer
// can go straight to NDI with no per-pixel conversion.
const FOURCC_BGRA = 0x41524742;
const FRAME_FORMAT_PROGRESSIVE = 1;

const LIB_CANDIDATES = [
  '/usr/local/lib/libndi.dylib',
  '/Library/NDI SDK for Apple/lib/macOS/libndi.dylib',
  '/Library/NDI SDK for Apple/lib/macOS/libndi.5.dylib',
  '/usr/local/lib/libndi.so',
  '/usr/lib/libndi.so',
  'C:\\Program Files\\NDI\\NDI 5 Runtime\\v5\\Processing.NDI.Lib.x64.dll',
];

function findLib() {
  if (process.env.NDI_RUNTIME_DIR_V5) {
    const candidates = [
      `${process.env.NDI_RUNTIME_DIR_V5}/libndi.dylib`,
      `${process.env.NDI_RUNTIME_DIR_V5}/libndi.so`,
    ];
    for (const candidate of candidates) {
      try { fs.accessSync(candidate); return candidate; } catch { /* keep looking */ }
    }
  }
  for (const candidate of LIB_CANDIDATES) {
    try { fs.accessSync(candidate); return candidate; } catch { /* keep looking */ }
  }
  return null;
}

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
  let sourceName = 'Bible Song Pro';
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
    const libPath = findLib();
    if (!libPath) {
      lastError = 'NDI runtime not found. Install the NDI SDK/Runtime from https://ndi.video';
      return false;
    }
    try {
      lib = koffi.load(libPath);

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
        sendDestroy: lib.func('void NDIlib_send_destroy(void *instance)'),
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

  function startCapture(fps = 15, options = {}) {
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
        const image = await displayWindow.capturePage(rect);
        if (image && !image.isEmpty()) {
          const bitmap = image.toBitmap();
          const size = image.getSize();
          if (bitmap && bitmap.length > 0 && size.width > 0 && size.height > 0) {
            const totalPixels = Math.floor(bitmap.length / 4);
            const aspect = size.width / size.height;
            const realWidth = Math.max(1, Math.round(Math.sqrt(totalPixels * aspect)));
            const realHeight = Math.max(1, Math.round(totalPixels / realWidth));
            sendFrame(bitmap, realWidth, realHeight, fps);
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

module.exports = { createNdiService, findLib, FOURCC_BGRA };
