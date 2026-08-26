const fs = require('fs');
const path = require('path');

const SECRET_KEYS = new Set(['deepgramApiKey', 'speechmaticsApiKey', 'obsPassword']);

const DEFAULTS = {
  deepgramApiKey: '',
  deepgramModel: 'nova-2',
  deepgramLanguage: 'en',
  sttEngine: 'deepgram', // 'deepgram' | 'local'
  /* Which on-device recogniser runs. Empty means "whatever the service
     defaults to", so a fresh install follows the default in
     whisper-onnx-service without this file having to name it twice. Stored
     because the weights are a download: an operator who fetched Moonshine Base
     and found it restored to the default on the next launch would have paid
     for it and not got it. */
  sttLocalModel: '',
  /* The language the preacher is speaking. 'auto' lets Whisper detect it per
     utterance; naming one is faster and steadier, which is what a service
     wants. Only a multilingual model can honour anything but English — the
     Language settings row says so rather than offering a choice that would go
     nowhere. */
  sermonLanguage: 'auto', // 'auto' | 'en' | 'fr' | 'es' | 'pt'
  obsUrl: 'ws://127.0.0.1:4455',
  obsPassword: '',
  obsAutoConnect: false,
  audioOutputDeviceId: 'default',
  audioCueDeviceId: 'default',
  audioMasterVolume: 100,
  audioMonoMixdown: false,
};

/**
 * App settings, including API keys. Kept in userData (never in the repo or renderer
 * state) and redacted on the way out so a key can be set and used but not read back
 * into the UI or logs.
 */
function createSettingsService({ app }) {
  const userData = app ? app.getPath('userData') : process.cwd();
  const filePath = path.join(userData, 'settings.json');
  let cache = null;

  function readAll() {
    if (cache) return cache;
    try {
      cache = fs.existsSync(filePath)
        ? { ...DEFAULTS, ...JSON.parse(fs.readFileSync(filePath, 'utf8')) }
        : { ...DEFAULTS };
    } catch {
      cache = { ...DEFAULTS };
    }
    return cache;
  }

  function persist() {
    try {
      const tmp = filePath + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(cache, null, 2), 'utf8');
      fs.renameSync(tmp, filePath);
      // Keys live here — keep them off other accounts on shared machines.
      fs.chmodSync(filePath, 0o600);
      return true;
    } catch (err) {
      console.error('settings save failed:', err.message);
      return false;
    }
  }

  /** Secrets are reported as a boolean "is it set", never echoed back. */
  function getPublic() {
    const all = readAll();
    const out = {};
    Object.keys(all).forEach((key) => {
      if (SECRET_KEYS.has(key)) out[key + 'Set'] = Boolean(all[key]);
      else out[key] = all[key];
    });
    return { ok: true, settings: out };
  }

  function get(key) {
    return readAll()[key];
  }

  function set(patch) {
    const all = readAll();
    Object.entries(patch || {}).forEach(([key, value]) => {
      if (!(key in DEFAULTS)) return;
      // An empty string for a secret means "leave it alone"; use clearSecret to remove.
      if (SECRET_KEYS.has(key) && value === '') return;
      all[key] = value;
    });
    cache = all;
    persist();
    return getPublic();
  }

  function clearSecret(key) {
    if (!SECRET_KEYS.has(key)) return { ok: false, error: 'Not a secret setting' };
    readAll()[key] = '';
    persist();
    return getPublic();
  }

  function reset() {
    cache = { ...DEFAULTS };
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (_) {}
    return getPublic();
  }

  return { get, set, getPublic, clearSecret, reset, filePath };
}

module.exports = { createSettingsService, DEFAULTS };
