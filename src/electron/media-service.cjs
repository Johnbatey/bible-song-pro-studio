const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.avif']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi']);

function kindFor(ext) {
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (VIDEO_EXTS.has(ext)) return 'video';
  return null;
}

/**
 * Owns the user's imported backgrounds.
 *
 * The library **references files where they already live**. It used to copy
 * every import into userData/media, which quietly doubled the disk cost of a
 * media folder — a single 173 MB loop costs 346 MB — and left the operator with
 * two copies to keep in step. A church media drive is already organised; the
 * app's job is to point at it, not to reorganise it.
 *
 * What that trades away is the guarantee that a service always resolves. So the
 * library is honest instead: an entry whose file has moved or been deleted is
 * reported `missing`, stays in the library rather than vanishing from it, and
 * can be pointed at the file's new home with `relink`. Losing the path is a
 * recoverable mistake; silently dropping the entry is not.
 *
 * Files are served over the app's HTTP server at /media/<id> so the display
 * window and any browser or NDI client can reach them.
 *
 * Entries imported by older builds carry `file` and live in userData/media.
 * They keep working: `resolve` falls back to that copy, and they are never
 * reported missing while it exists.
 */
function createMediaService({ app }) {
  const userData = app ? app.getPath('userData') : process.cwd();
  const mediaDir = path.join(userData, 'media');
  const indexPath = path.join(mediaDir, 'index.json');

  function ensureDir() {
    if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
  }

  function readIndex() {
    try {
      if (!fs.existsSync(indexPath)) return [];
      const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeIndex(items) {
    ensureDir();
    const tmp = indexPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(items, null, 2), 'utf8');
    fs.renameSync(tmp, indexPath);
  }

  /** The path an entry actually plays from: its own location, or a legacy copy. */
  function locate(item) {
    if (!item) return null;
    if (item.sourcePath && fs.existsSync(item.sourcePath)) return item.sourcePath;
    if (item.file) {
      const legacy = path.join(mediaDir, item.file);
      if (fs.existsSync(legacy)) return legacy;
    }
    return null;
  }

  /**
   * Every entry, each flagged with whether its file is reachable right now.
   * Nothing is pruned — a missing file is a prompt to relink, not a reason to
   * throw away the name, the type and the place it sits in the operator's
   * library.
   */
  function list() {
    const items = readIndex().map((item) => ({
      ...item,
      missing: locate(item) === null,
    }));
    return { ok: true, items };
  }

  function importPaths(paths) {
    ensureDir();
    const items = readIndex();
    const added = [];
    const errors = [];

    (paths || []).forEach((sourcePath) => {
      try {
        if (!sourcePath || !fs.existsSync(sourcePath)) {
          errors.push(`${path.basename(String(sourcePath))}: file not found`);
          return;
        }
        const stat = fs.statSync(sourcePath);
        if (stat.isDirectory()) {
          errors.push(`${path.basename(sourcePath)}: folders are not supported`);
          return;
        }
        const rawExt = path.extname(sourcePath);
        const ext = rawExt.toLowerCase();
        const kind = kindFor(ext);
        if (!kind) {
          errors.push(`${path.basename(sourcePath)}: unsupported type (${ext || 'no extension'})`);
          return;
        }

        const absolute = path.resolve(sourcePath);
        /* Importing the same file twice would give the operator two rows that
           relink and remove independently — one library entry per file. */
        const existing = items.find((item) => item.sourcePath && path.resolve(item.sourcePath) === absolute);
        if (existing) {
          errors.push(`${path.basename(sourcePath)}: already in the library`);
          return;
        }

        const item = {
          id: crypto.randomUUID(),
          sourcePath: absolute,
          // strip using the on-disk extension, not the lowercased one, or "photo.PNG" keeps its suffix
          name: path.basename(sourcePath, rawExt),
          type: kind,
          size: stat.size,
          addedAt: Date.now(),
        };
        item.url = '/media/' + item.id;
        items.push(item);
        added.push({ ...item, missing: false });
      } catch (err) {
        errors.push(`${path.basename(String(sourcePath))}: ${err.message}`);
      }
    });

    if (added.length > 0) writeIndex(items);
    return { ok: added.length > 0, items: added, errors };
  }

  /**
   * Point an entry at the file's new home — the fix for a drive that remounted
   * somewhere else, or a folder someone tidied. Everything about the entry
   * survives except the path, so scenes already built on it keep working.
   */
  function relink(id, newPath) {
    const items = readIndex();
    const target = items.find((item) => item.id === id);
    if (!target) return { ok: false, error: 'Not found' };
    if (!newPath || !fs.existsSync(newPath)) return { ok: false, error: 'That file does not exist' };

    const stat = fs.statSync(newPath);
    if (stat.isDirectory()) return { ok: false, error: 'Choose a file, not a folder' };

    const kind = kindFor(path.extname(newPath).toLowerCase());
    if (!kind) return { ok: false, error: 'Unsupported file type' };
    /* Relinking a video to an image would leave every scene built on this entry
       rendering the wrong element. Re-import instead — that is a new item. */
    if (kind !== target.type) {
      return { ok: false, error: `That is ${kind === 'image' ? 'an image' : 'a video'}, and this entry is ${target.type === 'image' ? 'an image' : 'a video'}` };
    }

    target.sourcePath = path.resolve(newPath);
    target.size = stat.size;
    /* A legacy copy is now dead weight — the entry plays from its own file. */
    if (target.file) {
      try {
        const legacy = path.join(mediaDir, target.file);
        if (fs.existsSync(legacy)) fs.unlinkSync(legacy);
      } catch { /* leaving a stale copy behind is not worth failing the relink */ }
      delete target.file;
    }
    target.url = '/media/' + target.id;
    writeIndex(items);
    return { ok: true, item: { ...target, missing: false } };
  }

  /**
   * Drop an entry from the library. The operator's own file is left exactly
   * where it is — the library never held the only copy, so deleting it here
   * would be destroying something the app was only ever pointing at. A legacy
   * copy inside userData/media is ours to clean up, and is.
   */
  function remove(id) {
    const items = readIndex();
    const target = items.find((item) => item.id === id);
    if (!target) return { ok: false, error: 'Not found' };
    if (target.file) {
      try {
        const legacy = path.join(mediaDir, target.file);
        if (fs.existsSync(legacy)) fs.unlinkSync(legacy);
      } catch { /* the index entry still goes */ }
    }
    writeIndex(items.filter((item) => item.id !== id));
    return { ok: true };
  }

  function rename(id, name) {
    const items = readIndex();
    const target = items.find((item) => item.id === id);
    if (!target) return { ok: false, error: 'Not found' };
    target.name = String(name || '').trim() || target.name;
    writeIndex(items);
    return { ok: true, item: target };
  }

  /**
   * Resolves a /media/<key> request to an on-disk path.
   *
   * The key is matched against the index — an id, or a legacy copy's filename —
   * and never joined onto a path. That is the whole traversal defence now that
   * entries can live anywhere on the disk: the only paths this can return are
   * ones already in the library because the operator imported them.
   */
  function resolve(key) {
    const raw = String(key || '');
    if (!raw) return null;
    const items = readIndex();
    const byId = items.find((item) => item.id === raw);
    if (byId) return locate(byId);
    const safe = path.basename(raw);
    const byFile = items.find((item) => item.file && item.file === safe);
    return byFile ? locate(byFile) : null;
  }

  return { list, importPaths, relink, remove, rename, resolve, mediaDir, IMAGE_EXTS, VIDEO_EXTS };
}

module.exports = { createMediaService, IMAGE_EXTS, VIDEO_EXTS };
