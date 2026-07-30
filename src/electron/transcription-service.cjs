const os = require('os');
const { createOnnxWhisperService } = require('./whisper-onnx-service.cjs');
const { createMlxWhisperCompatService } = require('./mlx-whisper-service.cjs');

function isAppleSilicon() {
  return os.platform() === 'darwin' && os.arch() === 'arm64';
}

function createTranscriptionService({ app }) {
  const onnx = createOnnxWhisperService({ app });
  const mlx = createMlxWhisperCompatService({ app });
  let activeEngine = 'onnx';

  function getEngine(name) {
    if (name === 'mlx' && isAppleSilicon()) return mlx;
    return onnx;
  }

  function status() {
    const onnxStatus = onnx.status();
    const mlxStatus = mlx.status();
    return {
      ok: true,
      activeEngine,
      platform: { os: os.platform(), arch: os.arch(), isAppleSilicon: isAppleSilicon() },
      engines: {
        onnx: onnxStatus,
        mlx: mlxStatus,
      },
    };
  }

  function setActiveEngine(name) {
    if (name === 'mlx' && !isAppleSilicon()) {
      return { ok: false, error: 'MLX Whisper requires Apple Silicon (arm64)' };
    }
    if (name !== 'onnx' && name !== 'mlx') {
      return { ok: false, error: 'Unknown engine: ' + name + '. Use "onnx" or "mlx".' };
    }
    if (name === 'mlx') {
      const s = mlx.status();
      if (!s.available) {
        return { ok: false, error: 'MLX model not installed. Download model to: ' + s.modelPath, status: status() };
      }
    }
    activeEngine = name;
    return { ok: true, activeEngine, status: status() };
  }

  async function warmup(payload = {}) {
    const engine = getEngine(payload.engine || activeEngine);
    const result = await engine.warmup(payload);
    if (result.ok && payload.engine && payload.engine !== activeEngine) {
      // Keep engine selection stable unless explicitly requested
    }
    return { ...result, activeEngine: payload.engine || activeEngine };
  }

  async function transcribe(payload = {}) {
    const engine = getEngine(payload.engine || activeEngine);
    const result = await engine.transcribe(payload);
    return { ...result, activeEngine: payload.engine || activeEngine };
  }

  async function dispose(payload = {}) {
    const engine = getEngine(payload.engine || activeEngine);
    const result = await engine.dispose();
    return { ...result, activeEngine: payload.engine || activeEngine };
  }

  return { status, setActiveEngine, warmup, transcribe, dispose };
}

module.exports = { createTranscriptionService };
