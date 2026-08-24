/* =========================================================================
   The on-device transcriber
   -------------------------------------------------------------------------
   Runs speech recognition locally through transformers.js, with no network
   involved once the model is on disk. Still called whisper-onnx for its engine
   key and its file name — both are written into settings and into
   transcription-service.cjs — but it is no longer only Whisper: Moonshine runs
   here too, and the model is the operator's choice.

   Moonshine is why this moved from @xenova/transformers 2.x to
   @huggingface/transformers 3.x. The Moonshine architecture landed in v3 and
   does not exist in v2 at all, so there was no adding it without the upgrade.

   The two families do not take the same call. Whisper accepts the long-form
   arguments — chunking, striding, per-chunk timestamps, a language and a task
   — because it was trained on 30-second windows and everything longer is
   stitched. Moonshine takes the audio and very little else: it handles
   variable-length input natively, and handing it Whisper's generation kwargs
   makes it throw. So the options are chosen per family, and there is a bare
   retry underneath in case a future model rejects something anyway.
   ========================================================================= */
const fs = require('fs');
const path = require('path');

let transformers = null;

/**
 * What an operator can pick from.
 *
 * Moonshine Tiny leads and is the default. It was built for streaming speech
 * and answers fastest on short utterances, which is the shape of the audio this
 * app feeds it (see LOCAL_CHUNK_SECONDS in LiveScripturePanel) — Whisper's
 * 30-second window is the wrong instrument for a verse said in four.
 *
 * Whisper stays, because it is what earlier installs ran and some rooms will
 * have tuned around it. An operator who had picked it keeps it: the choice is
 * persisted in settings now (sttLocalModel) and only a fresh install lands on
 * the default.
 *
 * Every id here is a real Hugging Face repo carrying a full set of ONNX
 * weights, `_quantized` included, which is what `dtype: 'q8'` below resolves
 * to. None of them is a placeholder, and adding one that is would fail at the
 * first download rather than at review — see scripts/verify-local-models.cjs,
 * which checks each id against the Hub.
 *
 * No download sizes here on purpose. The real figures depend on which weight
 * files the runtime picks for the dtype it settles on, and a number printed in
 * the UI that disagrees with the progress bar is worse than no number.
 */
const MODELS = [
  {
    key: 'moonshine-base',
    id: 'onnx-community/moonshine-base-ONNX',
    label: 'Moonshine Base',
    approxSize: '145 MB',
    note: 'The recommended default. Built for live speech with superior accuracy on names and citations.',
    family: 'moonshine',
    dtype: 'q8',
  },
  {
    key: 'moonshine-tiny',
    id: 'onnx-community/moonshine-tiny-ONNX',
    label: 'Moonshine Tiny',
    approxSize: '75 MB',
    note: 'Built for live speech — ultra fast response time with a lightweight footprint.',
    family: 'moonshine',
    dtype: 'q8',
  },
  {
    key: 'whisper-tiny-en',
    id: 'Xenova/whisper-tiny.en',
    label: 'Whisper Tiny (English)',
    approxSize: '75 MB',
    note: 'English only. Well proven, but tuned for 30-second windows.',
    family: 'whisper',
    multilingual: false,
    dtype: 'q8',
  },
  {
    key: 'whisper-tiny-multi',
    id: 'Xenova/whisper-tiny',
    label: 'Whisper Tiny (multilingual)',
    approxSize: '75 MB',
    note: 'Understands French, Spanish and 90+ more. Slower than Moonshine.',
    family: 'whisper',
    multilingual: true,
    dtype: 'q8',
  },
  {
    key: 'whisper-base-multi',
    id: 'Xenova/whisper-base',
    label: 'Whisper Base (multilingual)',
    approxSize: '145 MB',
    note: 'The most accurate multilingual model. Best for non-English sermons.',
    family: 'whisper',
    multilingual: true,
    dtype: 'q8',
  },
];

/** Language codes a multilingual model can be locked to. */
const SUPPORTED_LANGUAGES = ['en', 'fr', 'es'];

/* By key, not by position. The list is ordered for the operator reading the
   dropdown, and a reorder must not quietly change which recogniser a fresh
   install runs. */
const DEFAULT_MODEL = MODELS.find((m) => m.key === 'moonshine-base') || MODELS[0];

/**
 * Whisper's long-form arguments, which Moonshine does not take.
 */
function generationOptions(model, payload = {}) {
  if (model.family !== 'whisper') return {};
  const options = {
    return_timestamps: 'chunk',
    chunk_length_s: payload.chunkLength || 30,
    stride_length_s: payload.strideLength || 4,
    initial_prompt: payload.initialPrompt || 'Bible scripture reading and preaching: Genesis, Exodus, Leviticus, Numbers, Deuteronomy, Joshua, Judges, Ruth, Samuel, Kings, Chronicles, Ezra, Nehemiah, Esther, Job, Psalms, Proverbs, Ecclesiastes, Song of Solomon, Isaiah, Jeremiah, Lamentations, Ezekiel, Daniel, Hosea, Joel, Amos, Obadiah, Jonah, Micah, Nahum, Habakkuk, Zephaniah, Haggai, Zechariah, Malachi, Matthew, Mark, Luke, John, Acts, Romans, Corinthians, Galatians, Ephesians, Philippians, Colossians, Thessalonians, Timothy, Titus, Philemon, Hebrews, James, Peter, Jude, Revelation, Chapter, Verse.',
  };
  /* Only a multilingual checkpoint has a language to be told and a task to
     choose between. See the note on whisper-tiny-en above. */
  if (model.multilingual) {
    /* 'auto' is the absence of a language, not a language: Whisper detects it
       from the audio when none is given. Passing the string through would send
       it looking for a language called "auto" and throw. */
    const requested = payload.language;
    if (requested && requested !== 'auto') options.language = requested;
    options.task = payload.task || 'transcribe';
  }
  return options;
}

/** By key or by full repo id, so a settings value from either era resolves. */
function findModel(value) {
  if (!value) return null;
  return MODELS.find((m) => m.key === value || m.id === value) || null;
}

function createOnnxWhisperService({ app }) {
  const userData = app ? app.getPath('userData') : process.cwd();
  const cacheDir = path.join(userData, 'huggingface-cache');
  let pipe = null;
  let warmupState = 'idle';
  let lastError = '';
  /** A note about a successful-but-adjusted run. Never an error. */
  let lastNotice = '';
  let model = DEFAULT_MODEL;
  let downloadProgress = 0;

  /** A model is on disk when its cache folder exists — that is what makes the
      difference between "will start instantly" and "needs the internet". */
  function isCached(candidate) {
    try {
      return fs.existsSync(path.join(cacheDir, candidate.id));
    } catch {
      return false;
    }
  }

  function status() {
    return {
      ok: true,
      name: 'whisper-onnx',
      modelId: model.id,
      modelKey: model.key,
      modelLabel: model.label,
      family: model.family,
      available: true,
      ready: warmupState === 'ready',
      warmupState,
      downloadProgress,
      cacheDir,
      lastError,
      lastNotice,
      backends: ['onnxruntime-node'],
      /* Whether the running model can be told a language at all. The Language
         settings row reads this: offering French to an English-only recogniser
         would be the same empty promise the old mockup made. */
      multilingual: Boolean(model.multilingual),
      supportedLanguages: SUPPORTED_LANGUAGES,
      models: MODELS.map((m) => ({
        key: m.key,
        id: m.id,
        label: m.label,
        note: m.note,
        approxSize: m.approxSize,
        family: m.family,
        multilingual: Boolean(m.multilingual),
        downloaded: isCached(m),
      })),
    };
  }

  async function loadTransformers() {
    if (!transformers) transformers = await import('@huggingface/transformers');
    /* v3 reads the cache location off `env` rather than the TRANSFORMERS_CACHE
       environment variable v2 used, so setting it has to happen after import
       and before the first pipeline call. */
    transformers.env.cacheDir = cacheDir;
    return transformers;
  }

  /** Switches model without loading it. The next warmup or transcribe does that. */
  function setModel(value) {
    const next = findModel(value);
    if (!next) return { ok: false, error: `Unknown model: ${value}`, status: status() };
    if (next.key === model.key) return { ok: true, status: status() };
    model = next;
    /* The loaded pipeline belongs to the old model; keeping it would transcribe
       the next utterance with the recogniser the operator just switched away
       from. */
    pipe = null;
    warmupState = 'idle';
    downloadProgress = 0;
    lastError = '';
    lastNotice = '';
    return { ok: true, status: status() };
  }

  async function warmup(payload = {}) {
    try {
      const requested = payload.modelId || payload.modelKey;
      if (requested) {
        const result = setModel(requested);
        if (!result.ok) return result;
      }
      if (pipe) return { ok: true, warmedUp: true, modelId: model.id, status: status() };

      warmupState = 'loading';
      downloadProgress = 0;
      const { pipeline } = await loadTransformers();
      pipe = await pipeline('automatic-speech-recognition', model.id, {
        dtype: model.dtype,
        progress_callback: (progress) => {
          if (progress.status === 'progress') {
            warmupState = 'downloading';
            downloadProgress = Math.round(progress.progress || 0);
          } else if (progress.status === 'done') {
            downloadProgress = 100;
          }
        },
      });
      warmupState = 'ready';
      downloadProgress = 100;
      lastError = '';
      return { ok: true, warmedUp: true, modelId: model.id, status: status() };
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

      /* The bare retry is the safety net: a model that rejects one of the
         options above must still produce a transcript rather than a failure
         the operator sees as the microphone having died. */
      let result;
      try {
        result = await pipe(audioInput, generationOptions(model, payload));
        lastNotice = '';
      } catch (optionError) {
        /* Recorded apart from lastError on purpose. This path produced a
           transcript, so the operator has nothing to fix and must not be shown
           a red line in Settings; it is a note for whoever adds the next
           model and finds it rejecting an argument. */
        lastNotice = `Retried without generation options: ${optionError.message}`;
        result = await pipe(audioInput);
      }

      const segments = (result.chunks || []).map((chunk) => ({
        start: chunk.timestamp?.[0] || 0,
        end: chunk.timestamp?.[1] || 0,
        text: chunk.text || '',
      }));

      return {
        ok: true,
        provider: 'whisper-onnx',
        modelId: model.id,
        text: result.text || '',
        segments,
        confidence: (result.text || '').trim() ? 0.88 : 0,
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
      downloadProgress = 0;
      return { ok: true, status: status() };
    } catch (err) {
      return { ok: false, error: err.message, status: status() };
    }
  }

  return { status, warmup, transcribe, dispose, setModel, models: MODELS };
}

module.exports = { createOnnxWhisperService, LOCAL_MODELS: MODELS, SUPPORTED_LANGUAGES, generationOptions };
