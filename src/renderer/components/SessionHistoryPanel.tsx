import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { type, fontWeight } from '../styles/type';
import { Block, BlockButton } from './Block';

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
    <div className="blk-row" style={{ height: '100%' }}>
      <Block
        title="Sessions"
        subtitle={status?.active ? '● Recording' : '○ Idle'}
        style={{ flex: '0 0 300px' }}
        tools={(
          <>
            <BlockButton
              onClick={async () => { await window.BSP?.session?.start({ name: 'Session ' + new Date().toLocaleString() }); refresh(); }}
              title="Start a new session"
            >
              New
            </BlockButton>
            <BlockButton onClick={async () => { await window.BSP?.session?.end(); refresh(); }} title="End the current session">End</BlockButton>
            <BlockButton icon onClick={refresh} title="Refresh">⟳</BlockButton>
          </>
        )}
      >
        {sessions.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', ...type.secondary, padding: 20, textAlign: 'center' }}>
            No sessions yet. Sessions are recorded automatically when you project verses.
          </div>
        ) : sessions.map((s: any) => (
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
      </Block>

      <Block
        className="blk-fill"
        title="Details"
        tools={selectedSession ? (
          <>
            <BlockButton onClick={() => exportSession(selectedSession!, 'json')} title="Export as JSON">JSON</BlockButton>
            <BlockButton onClick={() => exportSession(selectedSession!, 'csv')} title="Export as CSV">CSV</BlockButton>
          </>
        ) : undefined}
      >
        {sessionData ? (
          <>
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
          </>
        ) : (
          <div style={{ color: 'var(--text-dim)', ...type.secondary, padding: 20, textAlign: 'center' }}>Select a session to view details.</div>
        )}
      </Block>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sessionBtn: { width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: 2 },
  entry: { padding: '8px 0', borderBottom: '1px solid var(--block-line)' },
  entryRef: { ...type.secondary, fontWeight: fontWeight.semibold, color: 'var(--accent)' },
  entryText: { ...type.caption, color: 'var(--text-secondary)', lineHeight: 1.4, margin: '2px 0' },
  entryMeta: { ...type.caption, color: 'var(--text-dim)' },
};
