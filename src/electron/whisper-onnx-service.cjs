const fs = require('fs');
const path = require('path');

let pipeline = null;

function createOnnxWhisperService({ app }) {
  const userData = app ? app.getPath('userData') : process.cwd();
  const cacheDir = path.join(userData, 'huggingface-cache');
  let pipe = null;
  let warmupState = 'idle';
  let lastError = '';
  let modelId = 'Xenova/whisper-tiny.en';

  function status() {
    return {
      ok: true,
      name: 'whisper-onnx',
      modelId,
      available: true,
      ready: warmupState === 'ready',
      warmupState,
      cacheDir,
      lastError,
      backends: ['onnxruntime-web'],
    };
  }

  async function warmup(payload = {}) {
    try {
      if (payload.modelId) modelId = payload.modelId;
      warmupState = 'loading';
      process.env.TRANSFORMERS_CACHE = cacheDir;
      if (!pipeline) pipeline = (await import('@xenova/transformers')).pipeline;
      pipe = await pipeline('automatic-speech-recognition', modelId, {
        quantized: true,
        progress_callback: (progress) => {
          if (progress.status === 'progress') warmupState = 'downloading';
        },
      });
      warmupState = 'ready';
      lastError = '';
      return { ok: true, warmedUp: true, modelId, status: status() };
    } catch (err) {
      warmupState = 'error';
      lastError = err.message;
      return { ok: false, error: err.message, status: status() };
    }
  }

  async function transcribe(payload = {}) {
    try {
      if (!pipe) {
        const warmResult = await warmup(payload);
        if (!warmResult.ok) return warmResult;
      }

      let audioInput;

      // Accept: filePath, audioData (Float32Array as plain array), base64 audio
      if (payload.filePath) {
        if (!fs.existsSync(payload.filePath)) {
          return { ok: false, error: 'Audio file not found: ' + payload.filePath };
        }
        audioInput = payload.filePath;
      } else if (payload.audioData) {
        const arr = payload.audioData;
        // Already a Float32Array when it comes straight off the capture worklet;
        // only copy when a plain array arrives (REST callers, older payloads).
        audioInput = arr instanceof Float32Array ? arr : Float32Array.from(arr);
      } else if (payload.base64) {
        const buffer = Buffer.from(payload.base64, 'base64');
        const int16 = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 2);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768.0;
        audioInput = float32;
      } else if (payload.text) {
        // Passthrough mode for non-audio testing
        return {
          ok: true,
          provider: 'whisper-onnx',
          text: payload.text,
          confidence: 0.85,
          isPassthrough: true,
          status: status(),
        };
      } else {
        return { ok: false, error: 'No audio input provided. Send filePath, audioData, or base64.' };
      }

      const result = await pipe(audioInput, {
        return_timestamps: 'chunk',
        language: payload.language || 'en',
        task: payload.task || 'transcribe',
        chunk_length_s: payload.chunkLength || 30,
        stride_length_s: payload.strideLength || 4,
      });

      const segments = (result.chunks || []).map((chunk) => ({
        start: chunk.timestamp?.[0] || 0,
        end: chunk.timestamp?.[1] || 0,
        text: chunk.text || '',
      }));

      return {
        ok: true,
        provider: 'whisper-onnx',
        modelId,
        text: result.text || '',
        segments,
        confidence: segments.length > 0 ? 0.88 : 0,
        duration: segments.length > 0 ? segments[segments.length - 1].end : 0,
        status: status(),
      };
    } catch (err) {
      return { ok: false, error: err.message, status: status() };
    }
  }

  async function dispose() {
    try {
      pipe = null;
      warmupState = 'idle';
      return { ok: true, status: status() };
    } catch (err) {
      return { ok: false, error: err.message, status: status() };
    }
  }

  return { status, warmup, transcribe, dispose };
}

module.exports = { createOnnxWhisperService };
