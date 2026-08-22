const fs = require('fs');
const path = require('path');
const { stripHugeDataUrlsFromJson } = require('./strip-data-urls.cjs');

// Persists renderer store slices (scenes, songs, themes, preferences) to userData
// so nothing is lost on quit. Mirrors the file-IO pattern in session-history-service.cjs.
function createAppStoreService({ app }) {
  const userData = app ? app.getPath('userData') : process.cwd();
  const filePath = path.join(userData, 'app-state.json');
  let writeTimer = null;
  let pending = null;

  // Returns the raw JSON *string* — the renderer hands it straight to Zustand's
  // persist middleware, which does its own parsing. Parsing here would double-decode.
  function load() {
    try {
      if (!fs.existsSync(filePath)) return { ok: true, state: null };
      const raw = fs.readFileSync(filePath, 'utf8');
      if (!raw.trim()) return { ok: true, state: null };
      JSON.parse(raw); // validate; a truncated file should read as "no saved state"
      /* A saved deck that inlined a 33 MB photo as a data URL would come back
         over IPC as a 44 MB string and abort() the renderer. Drop those here. */
      return { ok: true, state: stripHugeDataUrlsFromJson(raw) };
    } catch (err) {
      console.error('app-store load failed:', err.message);
      return { ok: false, state: null, error: err.message };
    }
  }

  function flush() {
    writeTimer = null;
    if (pending == null) return;
    const payload = pending;
    pending = null;
    try {
      const tmp = filePath + '.tmp';
      fs.writeFileSync(tmp, payload, 'utf8');
      fs.renameSync(tmp, filePath);
    } catch (err) {
      console.error('app-store save failed:', err.message);
    }
  }

  // Coalesce bursts of writes — the store can update many times per second while
  // scenes are being cut.
  function save(value) {
    const raw = typeof value === 'string' ? value : JSON.stringify(value);
    pending = stripHugeDataUrlsFromJson(raw);
    if (!writeTimer) writeTimer = setTimeout(flush, 400);
    return { ok: true };
  }

  function clear() {
    if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
    pending = null;
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  return { load, save, clear, flush, filePath };
}

module.exports = { createAppStoreService };
