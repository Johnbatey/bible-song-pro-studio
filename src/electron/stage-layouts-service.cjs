/* =========================================================================
   Stage layouts — the operator's own presets, on disk
   -------------------------------------------------------------------------
   The four presets compiled into the app are read-only by design. Everything
   an operator builds in the Stage Layout Designer lives here instead, in
   userData/stage-layouts.json, because the designer runs in its own window and
   localStorage does not reliably cross a file:// window boundary in Electron —
   the same reason src/stage/theme.ts probes storage before trusting it.

   Writes are tmp-then-rename, as in app-store-service.cjs: a layout file half
   written when the machine lost power is a layout file that reads as corrupt
   on the Sunday morning it is needed.
   ========================================================================= */
const fs = require('fs');
const path = require('path');

const FILE_NAME = 'stage-layouts.json';
const MAX_LAYOUTS = 200;

function createStageLayoutsService({ app }) {
  const userData = app ? app.getPath('userData') : process.cwd();
  const filePath = path.join(userData, FILE_NAME);

  /** { layouts: [...], activeId: string|null }. A file that will not parse is
      treated as absent rather than thrown: the app still opens, with presets. */
  function read() {
    try {
      if (!fs.existsSync(filePath)) return { layouts: [], activeId: null };
      const raw = fs.readFileSync(filePath, 'utf8');
      if (!raw.trim()) return { layouts: [], activeId: null };
      const parsed = JSON.parse(raw);
      return {
        layouts: Array.isArray(parsed.layouts) ? parsed.layouts : [],
        activeId: typeof parsed.activeId === 'string' ? parsed.activeId : null,
      };
    } catch (err) {
      console.error('stage-layouts read failed:', err.message);
      return { layouts: [], activeId: null };
    }
  }

  function write(data) {
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, filePath);
  }

  function list() {
    const data = read();
    return { ok: true, layouts: data.layouts, activeId: data.activeId };
  }

  /**
   * Insert or replace by id.
   *
   * The renderer has already normalised the layout through
   * src/stage/layout-model.ts, so this stores what it was handed and only
   * guards the two things a store must guard on its own: that there is an id
   * to key on, and that the file cannot grow without bound.
   */
  function save(layout) {
    if (!layout || typeof layout !== 'object' || !layout.id) {
      return { ok: false, error: 'layout must have an id' };
    }
    try {
      const data = read();
      const index = data.layouts.findIndex((item) => item && item.id === layout.id);
      const record = { ...layout, updatedAt: Date.now() };
      if (index === -1) {
        if (data.layouts.length >= MAX_LAYOUTS) {
          return { ok: false, error: `at most ${MAX_LAYOUTS} saved layouts` };
        }
        data.layouts.push(record);
      } else {
        data.layouts[index] = record;
      }
      write(data);
      return { ok: true, layout: record };
    } catch (err) {
      console.error('stage-layouts save failed:', err.message);
      return { ok: false, error: err.message };
    }
  }

  function remove(id) {
    try {
      const data = read();
      data.layouts = data.layouts.filter((item) => !item || item.id !== id);
      // A deleted layout cannot stay the active one, or the next boot restores
      // a layout that is no longer anywhere.
      if (data.activeId === id) data.activeId = null;
      write(data);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /** Which layout the stage should come back to after a restart. A preset id
      is legal here too — the operator's choice is a choice either way. */
  function setActive(id) {
    try {
      const data = read();
      data.activeId = typeof id === 'string' && id ? id : null;
      write(data);
      return { ok: true, activeId: data.activeId };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  return { list, save, remove, setActive, filePath };
}

module.exports = { createStageLayoutsService };
