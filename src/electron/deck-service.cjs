/* =========================================================================
   deck-service — reading presentation packages off disk
   -------------------------------------------------------------------------
   An imported deck keeps only its source path: a .pptx is far too large to
   hold in the persisted renderer state. Reopening one in the editor means
   reading the file back, which is what this does.

   Deliberately narrow. The renderer supplies the path, so this is the boundary
   where a renderer bug — or anything that reached the renderer — must not be
   able to turn a "reopen my deck" call into a read of the whole disk. Hence
   the extension check, the regular-file check and the size cap.
   ========================================================================= */
const fs = require('fs');
const path = require('path');

const MAX_DECK_BYTES = 200 * 1024 * 1024;

/**
 * @param {string} filePath  absolute path to a .pptx
 * @returns {Promise<{ok: true, data: Buffer, name: string, size: number}
 *                  | {ok: false, error: string}>}
 */
async function readDeck(filePath) {
  const target = String(filePath || '');
  if (!target || !/\.pptx$/i.test(target)) {
    return { ok: false, error: 'not-a-pptx' };
  }

  try {
    const stat = await fs.promises.stat(target);
    if (!stat.isFile()) return { ok: false, error: 'not-a-file' };
    if (stat.size > MAX_DECK_BYTES) return { ok: false, error: 'too-large' };

    const data = await fs.promises.readFile(target);
    return { ok: true, data, name: path.basename(target), size: stat.size };
  } catch (err) {
    // ENOENT is the common one and the renderer words it as "moved or deleted".
    return { ok: false, error: String((err && err.code) || (err && err.message) || err) };
  }
}

module.exports = { readDeck, MAX_DECK_BYTES };
