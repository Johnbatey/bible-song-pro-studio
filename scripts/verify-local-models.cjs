/* =========================================================================
   verify-local-models — every on-device model is really downloadable
   -------------------------------------------------------------------------
   The model catalogue is three strings pointing at Hugging Face. Nothing in
   the app checks them: a typo, a renamed repo, or an entry added as a
   placeholder all look identical to a correct one until an operator picks it,
   waits for a download, and gets a 404 — in a service, with the room waiting.

   So this asks the Hub directly. For each model it checks the repo resolves,
   that it carries a config, and that the weights the runtime will actually
   reach for exist: `dtype: 'q8'` in whisper-onnx-service resolves to the
   `_quantized` variants, so an encoder and a merged decoder in that dtype are
   what make the entry real rather than nominal.

   Needs the network, which is why it is not in verify:all — that suite has to
   pass on a machine with no connection. Run it when the catalogue changes.
   ========================================================================= */
const {
  LOCAL_MODELS,
  SUPPORTED_LANGUAGES,
  generationOptions,
} = require('../src/electron/whisper-onnx-service.cjs');
const assert = require('node:assert/strict');

const API = 'https://huggingface.co/api/models/';

/* What transformers.js resolves each dtype to. Only the ones the catalogue
   uses — an entry on a dtype nobody lists would be untested either way. */
const DTYPE_SUFFIX = {
  q8: '_quantized',
  int8: '_int8',
  fp16: '_fp16',
  q4: '_q4',
  uint8: '_uint8',
  fp32: '',
};

async function inspect(model) {
  const response = await fetch(`${API}${model.id}`);
  if (!response.ok) {
    return { ok: false, reason: `Hub returned ${response.status} for ${model.id}` };
  }
  const data = await response.json();
  const files = (data.siblings || []).map((s) => s.rfilename);

  if (!files.includes('config.json')) {
    return { ok: false, reason: 'no config.json — not a loadable model repo' };
  }

  const suffix = DTYPE_SUFFIX[model.dtype];
  if (suffix === undefined) {
    return { ok: false, reason: `unmapped dtype "${model.dtype}" — add it to DTYPE_SUFFIX` };
  }

  /* An encoder and a decoder, both in the dtype this model asks for. A repo
     with only fp32 weights would load nothing at q8. */
  const encoder = `onnx/encoder_model${suffix}.onnx`;
  const decoder = `onnx/decoder_model_merged${suffix}.onnx`;
  const missing = [encoder, decoder].filter((f) => !files.includes(f));
  if (missing.length) {
    return { ok: false, reason: `dtype "${model.dtype}" weights missing: ${missing.join(', ')}` };
  }

  return { ok: true, files: files.length };
}

async function main() {
  const failures = [];
  console.log(`Checking ${LOCAL_MODELS.length} on-device models against the Hub:\n`);

  for (const model of LOCAL_MODELS) {
    let result;
    try {
      result = await inspect(model);
    } catch (err) {
      result = { ok: false, reason: `could not reach the Hub: ${err.message}` };
    }
    if (result.ok) {
      console.log(`  ✓ ${model.label.padEnd(24)} ${model.id} (${model.dtype}, ${result.files} files)`);
    } else {
      console.log(`  ✗ ${model.label.padEnd(24)} ${model.id} — ${result.reason}`);
      failures.push(`${model.key}: ${result.reason}`);
    }
  }

  /* The catalogue's own invariants, which need no network. */
  const keys = LOCAL_MODELS.map((m) => m.key);
  const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (duplicates.length) failures.push(`duplicate model keys: ${[...new Set(duplicates)].join(', ')}`);

  const defaultModel = LOCAL_MODELS.find((m) => m.key === 'moonshine-tiny');
  if (!defaultModel) failures.push('moonshine-tiny is gone — the default points at nothing');

  /* At least one model that can actually hear a language other than English,
     or the sermon-language setting is decoration. */
  const multilingual = LOCAL_MODELS.filter((m) => m.multilingual);
  if (!multilingual.length) {
    failures.push('no multilingual model — the sermon language setting would do nothing');
  }

  /* The language reaches the recogniser through generationOptions and nowhere
     else. These pin the three behaviours that make the setting real. */
  console.log('\nSermon language reaches the recogniser:');
  const checks = [
    ['a language is passed to a multilingual model',
      () => assert.equal(generationOptions(multilingual[0], { language: 'fr' }).language, 'fr')],
    ["'auto' is sent as no language, so Whisper detects it",
      () => assert.equal('language' in generationOptions(multilingual[0], { language: 'auto' }), false)],
    ['an English-only model is never told a language',
      () => assert.equal('language' in generationOptions(
        LOCAL_MODELS.find((m) => m.family === 'whisper' && !m.multilingual), { language: 'fr' }), false)],
    ['Moonshine gets no Whisper kwargs at all',
      () => assert.deepEqual(generationOptions(
        LOCAL_MODELS.find((m) => m.family === 'moonshine'), { language: 'fr' }), {})],
  ];
  for (const [name, run] of checks) {
    try { run(); console.log(`  ✓ ${name}`); }
    catch (err) { console.log(`  ✗ ${name}`); failures.push(`${name}: ${err.message}`); }
  }
  console.log(`  languages offered: ${SUPPORTED_LANGUAGES.join(', ')}`);

  if (failures.length) {
    throw new Error(`On-device model catalogue is not downloadable:\n    ${failures.join('\n    ')}`);
  }
  console.log(`\nOn-device models verified: ${LOCAL_MODELS.length} repos resolve with q8 weights present, default is ${defaultModel.label}.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
