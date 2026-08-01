import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { type, fontWeight } from '../styles/type';

export function SessionHistoryPanel() {
  const [sessions, setSessions] = useState<Array<any>>([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);

  useEffect(() => { refresh(); }, []);

  async function refresh() {
    const s = await window.BSP?.session?.status().catch(() => null);
    setStatus(s);
    const list = await window.BSP?.session?.list().catch(() => ({ sessions: [] }));
    setSessions(list?.sessions || []);
  }

  async function loadSession(id: string) {
    const data = await window.BSP?.session?.get(id).catch(() => null);
    setSelectedSession(id);
    setSessionData(data?.session || null);
  }

  async function exportSession(id: string, format: 'json' | 'csv') {
    const result = await window.BSP?.session?.export({ id, format }).catch(() => null);
    if (!result?.ok || !result?.data) return;
    const blob = new Blob([result.data], { type: format === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename || `session.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div style={styles.header}>
        <h2 style={styles.h2}>Session History</h2>
        <div style={styles.actions}>
          <span style={{ ...type.caption, color: 'var(--text-dim)' }}>{status?.active ? '● Recording' : '○ Idle'}</span>
          <button className="btn btn-sm btn-secondary" onClick={async () => { await window.BSP?.session?.start({ name: 'Session ' + new Date().toLocaleString() }); refresh(); }}>New Session</button>
          <button className="btn btn-sm btn-secondary" onClick={async () => { await window.BSP?.session?.end(); refresh(); }}>End Session</button>
          <button className="btn btn-sm btn-secondary" onClick={refresh}>Refresh</button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', ...type.body }}>
          No sessions yet. Sessions are recorded automatically when you project verses.
        </div>
      ) : (
        <div style={styles.split}>
          <div className="card" style={styles.list}>
            <div className="section-title">Sessions</div>
            {sessions.map((s: any) => (
              <button
                key={s.id}
                style={{ ...styles.sessionBtn, background: selectedSession === s.id ? 'var(--accent-dim)' : 'transparent' }}
                onClick={() => loadSession(s.id)}
              >
                <strong style={{ ...type.secondary }}>{s.name}</strong>
                <span style={{ ...type.caption, color: 'var(--text-dim)' }}>
                  {new Date(s.startedAt).toLocaleString()} — {s.entries || 0} entries
                </span>
              </button>
            ))}
          </div>
          <div className="card" style={styles.detail}>
            <div className="section-title">
              Details
              {selectedSession && (
                <span style={{ float: 'right' }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => exportSession(selectedSession!, 'json')} style={{ marginRight: 4 }}>JSON</button>
                  <button className="btn btn-sm btn-secondary" onClick={() => exportSession(selectedSession!, 'csv')}>CSV</button>
                </span>
              )}
            </div>
            {sessionData ? (
              <div style={{ maxHeight: 400, overflow: 'auto' }}>
                {(sessionData.entries || []).map((entry: any, i: number) => (
                  <div key={entry.id || i} style={styles.entry}>
                    <div style={styles.entryRef}>{entry.reference || '—'}</div>
                    <div style={styles.entryText}>{entry.text?.substring(0, 120)}</div>
                    <div style={styles.entryMeta}>
                      {new Date(entry.timestamp).toLocaleTimeString()} · {entry.mode || entry.source} · conf: {entry.confidence?.toFixed(2) || '—'}
                    </div>
                  </div>
                ))}
                {(!sessionData.entries || sessionData.entries.length === 0) && (
                  <div style={{ color: 'var(--text-dim)', ...type.secondary, padding: 20, textAlign: 'center' }}>No entries in this session.</div>
                )}
              </div>
            ) : (
              <div style={{ color: 'var(--text-dim)', ...type.secondary, padding: 20, textAlign: 'center' }}>Select a session to view details.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  h2: { ...type.title },
  actions: { display: 'flex', gap: 6, alignItems: 'center' },
  split: { display: 'grid', gridTemplateColumns: '260px minmax(0,1fr)', gap: 12 },
  list: { display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 480, overflow: 'auto' },
  sessionBtn: { textAlign: 'left', padding: '8px 10px', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: 2 },
  detail: { maxHeight: 480, overflow: 'auto' },
  entry: { padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  entryRef: { ...type.secondary, fontWeight: fontWeight.semibold, color: 'var(--accent)' },
  entryText: { ...type.caption, color: 'var(--text-secondary)', lineHeight: 1.4, margin: '2px 0' },
  entryMeta: { ...type.caption, color: 'var(--text-dim)' },
};
