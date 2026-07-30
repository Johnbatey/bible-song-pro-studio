const fs = require('fs');
const path = require('path');

function createSessionHistoryService({ app }) {
  const userData = app ? app.getPath('userData') : process.cwd();
  const historyDir = path.join(userData, 'sessions');
  let currentSession = null;
  let entries = [];

  function ensureDir() {
    if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });
  }

  function startSession(name) {
    ensureDir();
    if (currentSession) endSession();
    currentSession = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name || 'Session ' + new Date().toLocaleDateString(),
      startedAt: new Date().toISOString(),
      endedAt: null,
      entries: [],
    };
    entries = currentSession.entries;
    return { ok: true, session: currentSession };
  }

  function addEntry(entry) {
    if (!currentSession) startSession();
    const e = {
      id: entries.length + 1,
      timestamp: new Date().toISOString(),
      type: entry.type || 'verse',
      reference: entry.reference || '',
      book: entry.book || '',
      chapter: entry.chapter || null,
      verse: entry.verse || null,
      text: entry.text || '',
      confidence: entry.confidence || null,
      mode: entry.mode || '',
      source: entry.source || 'manual',
    };
    entries.push(e);
    autoSave();
    return { ok: true, entry: e };
  }

  function endSession() {
    if (!currentSession) return { ok: false, error: 'No active session' };
    currentSession.endedAt = new Date().toISOString();
    autoSave(true);
    currentSession = null;
    entries = [];
    return { ok: true };
  }

  function autoSave(force) {
    if (!currentSession) return;
    const filePath = path.join(historyDir, currentSession.id + '.json');
    try {
      fs.writeFileSync(filePath, JSON.stringify({
        session: { id: currentSession.id, name: currentSession.name, startedAt: currentSession.startedAt, endedAt: currentSession.endedAt },
        entries: entries,
      }, null, 2));
    } catch {}
  }

  function listSessions() {
    ensureDir();
    const files = fs.readdirSync(historyDir).filter((f) => f.endsWith('.json'));
    return files.map((f) => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(historyDir, f), 'utf8'));
        return data.session;
      } catch { return null; }
    }).filter(Boolean).sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  }

  function getSession(id) {
    ensureDir();
    const filePath = path.join(historyDir, id + '.json');
    if (!fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch { return null; }
  }

  function exportSession(id, format) {
    const data = getSession(id);
    if (!data) return { ok: false, error: 'Session not found' };
    if (format === 'csv') {
      let csv = 'Timestamp,Type,Reference,Book,Chapter,Verse,Confidence,Mode,Source,Text\n';
      data.entries.forEach((e) => {
        csv += `"${e.timestamp}","${e.type}","${e.reference}","${e.book}","${e.chapter || ''}","${e.verse || ''}","${e.confidence || ''}","${e.mode}","${e.source}","${(e.text || '').replace(/"/g, '""')}"\n`;
      });
      return { ok: true, data: csv, format: 'csv', filename: data.session.name.replace(/\s+/g, '_') + '.csv' };
    }
    return { ok: true, data: JSON.stringify(data, null, 2), format: 'json', filename: data.session.name.replace(/\s+/g, '_') + '.json' };
  }

  function getStatus() {
    return {
      ok: true,
      active: !!currentSession,
      session: currentSession ? { id: currentSession.id, name: currentSession.name, startedAt: currentSession.startedAt, entries: entries.length } : null,
      historyDir,
      totalSessions: listSessions().length,
    };
  }

  return { startSession, endSession, addEntry, listSessions, getSession, exportSession, getStatus };
}

module.exports = { createSessionHistoryService };
