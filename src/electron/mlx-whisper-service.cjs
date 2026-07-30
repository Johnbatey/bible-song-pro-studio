const fs = require('fs');
const path = require('path');

function createMlxWhisperCompatService({ app }) {
  const userData = app ? app.getPath('userData') : process.cwd();
  const modelPath = path.join(userData, 'mlx-whisper-model');
  let warmupState = fs.existsSync(modelPath) ? 'idle' : 'unavailable';
  let lastError = fs.existsSync(modelPath) ? '' : 'Model not installed. Copy or download an MLX Whisper model into the app userData/mlx-whisper-model folder.';

  function status() {
    const modelInstalled = fs.existsSync(modelPath);
    return {
      ok: true,
      name: 'mlx-whisper',
      available: modelInstalled,
      ready: modelInstalled && warmupState === 'ready',
      warmupState: modelInstalled ? warmupState : 'unavailable',
      modelPath,
      modelInstalled,
      lastError: modelInstalled ? lastError : 'Model not installed',
    };
  }

  async function warmup() {
    if (!fs.existsSync(modelPath)) {
      warmupState = 'unavailable';
      lastError = 'Model not installed';
      return { ok: false, error: lastError, status: status() };
    }
    warmupState = 'ready';
    lastError = '';
    return { ok: true, warmedUp: true, status: status() };
  }

  async function transcribe(payload = {}) {
    if (!fs.existsSync(modelPath)) {
      return { ok: false, error: 'Model not installed', status: status() };
    }
    const text = String(payload.text || payload.transcript || '').trim();
    return {
      ok: true,
      provider: 'mlx-whisper',
      text,
      confidence: text ? 0.85 : 0,
      status: status(),
    };
  }

  async function dispose() {
    warmupState = fs.existsSync(modelPath) ? 'idle' : 'unavailable';
    return { ok: true, status: status() };
  }

  return { status, warmup, transcribe, dispose };
}

module.exports = { createMlxWhisperCompatService };
