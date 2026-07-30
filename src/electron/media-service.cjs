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
 * Owns the user's imported backgrounds. Files are copied into userData/media so a
 * service still resolves after the original is moved or deleted, and are served over
 * the app's HTTP server at /media/<file> so the display window and any browser/NDI
 * client can reach them.
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

  /** Drops entries whose file has vanished (user cleared the folder by hand). */
  function list() {
    const items = readIndex();
    const alive = items.filter((item) => fs.existsSync(path.join(mediaDir, item.file)));
    if (alive.length !== items.length) writeIndex(alive);
    return { ok: true, items: alive };
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

        const id = crypto.randomUUID();
        const file = id + ext;
        fs.copyFileSync(sourcePath, path.join(mediaDir, file));

        const item = {
          id,
          file,
          // strip using the on-disk extension, not the lowercased one, or "photo.PNG" keeps its suffix
          name: path.basename(sourcePath, rawExt),
          type: kind,
          size: stat.size,
          addedAt: Date.now(),
          url: '/media/' + file,
        };
        items.push(item);
        added.push(item);
      } catch (err) {
        errors.push(`${path.basename(String(sourcePath))}: ${err.message}`);
      }
    });

    if (added.length > 0) writeIndex(items);
    return { ok: added.length > 0, items: added, errors };
  }

  function remove(id) {
    const items = readIndex();
    const target = items.find((item) => item.id === id);
    if (!target) return { ok: false, error: 'Not found' };
    try {
      const filePath = path.join(mediaDir, target.file);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
      return { ok: false, error: err.message };
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

  /** Resolves a /media/<file> request to an on-disk path, refusing path traversal. */
  function resolve(fileName) {
    const safe = path.basename(String(fileName || ''));
    if (!safe) return null;
    const full = path.join(mediaDir, safe);
    if (!full.startsWith(mediaDir)) return null;
    return fs.existsSync(full) ? full : null;
  }

  return { list, importPaths, remove, rename, resolve, mediaDir, IMAGE_EXTS, VIDEO_EXTS };
}

module.exports = { createMediaService, IMAGE_EXTS, VIDEO_EXTS };
