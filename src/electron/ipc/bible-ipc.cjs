let electron = null;
try {
  electron = require('electron');
} catch {}

function registerBibleIpc({
  bibleService,
  verseDetectionService,
  lexiconService,
  ipc = electron?.ipcMain,
  dialog = electron?.dialog,
}) {
  if (!ipc) return;

  ipc.handle('bible:getVersions', () => bibleService?.getVersions());
  ipc.handle('bible:getBooks', (_, v) => bibleService?.getBooks(v));
  ipc.handle('bible:getChapter', (_, p) => bibleService?.getChapter(p?.versionId, p?.book, p?.chapter));
  ipc.handle('bible:search', (_, p) => bibleService?.search(p?.versionId, p?.query, p?.limit, { book: p?.book || '' }));
  
  ipc.handle('bible:pick', async () => {
    if (!dialog) return { ok: false, canceled: true };
    const res = await dialog.showOpenDialog({
      title: 'Import Bible Translation',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Bible Files (*.xml, *.osis, *.usfx, *.xmm, *.usfm, *.sfm, *.json, *.csv, *.sqlite, *.db)', extensions: ['xml', 'osis', 'usfx', 'xmm', 'usfm', 'sfm', 'json', 'csv', 'sqlite', 'db', 'bible'] },
        { name: 'XML / OSIS / USFX / OpenSong (*.xml, *.osis, *.usfx, *.xmm)', extensions: ['xml', 'osis', 'usfx', 'xmm'] },
        { name: 'USFM Scripture Files (*.usfm, *.sfm)', extensions: ['usfm', 'sfm'] },
        { name: 'JSON & CSV Files (*.json, *.csv)', extensions: ['json', 'csv'] },
        { name: 'SQLite / OpenLP Databases (*.sqlite, *.db)', extensions: ['sqlite', 'db'] },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
    });
    if (res.canceled || !res.filePaths || !res.filePaths.length) {
      return { ok: false, canceled: true };
    }
    return { ok: true, filePaths: res.filePaths };
  });
  
  ipc.handle('bible:importFile', (_, p) => bibleService?.importBibleFile(p || {}));

  ipc.handle('verse:detect', (_, p) => verseDetectionService?.detect(p?.text, p?.options || {}));
  ipc.handle('verse:warmIndex', (_, p) => verseDetectionService?.warmIndex(p?.versionId || 'KJV'));
  ipc.handle('verse:indexStatus', () => verseDetectionService?.indexStatus());

  ipc.handle('lexicon:lookup', (_, query) => lexiconService?.lookup(query));
  ipc.handle('lexicon:detect', (_, text) => lexiconService?.detectWordStudyTerms(text));
  ipc.handle('lexicon:annotate', (_, p) => lexiconService?.annotateVerseWithStrongs(p?.text, p?.book));
}

module.exports = {
  registerBibleIpc,
};
