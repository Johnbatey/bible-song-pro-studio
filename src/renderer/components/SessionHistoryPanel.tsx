import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { type, fontWeight } from '../styles/type';
import { Block, BlockButton } from './Block';
import { CustomDropdown } from './CustomDropdown';

export function SessionHistoryPanel() {
  const [sessions, setSessions] = useState<Array<any>>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [sessionData, setSessionData] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);

  useEffect(() => { refresh(); }, []);

  async function refresh() {
    const s = await window.BSP?.session?.status().catch(() => null);
    setStatus(s);
    const list = await window.BSP?.session?.list().catch(() => ({ sessions: [] }));
    const allSessions = list?.sessions || [];
    setSessions(allSessions);
    if (allSessions.length > 0) {
      const activeId = selectedSession || allSessions[0].id;
      loadSession(activeId);
    }
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

  const sessionOptions = sessions.length > 0
    ? sessions.map((s) => ({
        value: s.id,
        label: `${s.name || 'Session'} (${new Date(s.startedAt).toLocaleDateString()})`,
      }))
    : [{ value: '', label: 'No saved sessions' }];

  return (
    <Block
      className="blk-fill"
      title="History"
      subtitle={status?.active ? '● Recording' : undefined}
      tools={(
        <>
          <BlockButton
            onClick={async () => { await window.BSP?.session?.start({ name: 'Session ' + new Date().toLocaleTimeString() }); refresh(); }}
            title="Start a new session"
          >
            + New
          </BlockButton>
          {status?.active && (
            <BlockButton
              onClick={async () => { await window.BSP?.session?.end(); refresh(); }}
              title="End active session"
            >
              End
            </BlockButton>
          )}
          <BlockButton onClick={refresh} title="Refresh history">⟳</BlockButton>
        </>
      )}
    >
      {/* Session Switcher & Export Bar */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #262628' }}>
        <CustomDropdown
          value={selectedSession}
          onChange={(val) => loadSession(val)}
          options={sessionOptions}
          buttonStyle={{ flex: 1, height: 28, fontSize: 11 }}
          title="Select Session"
        />
        {selectedSession && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <CustomDropdown
              value={exportFormat}
              onChange={(val) => setExportFormat(val as 'json' | 'csv')}
              options={[
                { value: 'json', label: 'JSON' },
                { value: 'csv', label: 'CSV' },
              ]}
              buttonStyle={{ width: 75, height: 28, fontSize: 11 }}
              title="Select Export Format"
            />
            <BlockButton
              onClick={() => exportSession(selectedSession, exportFormat)}
              title={`Export session as ${exportFormat.toUpperCase()}`}
              style={{ height: 28, fontSize: 11 }}
            >
              Export
            </BlockButton>
          </div>
        )}
      </div>

      {sessionData && sessionData.entries && sessionData.entries.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 0' }}>
          {sessionData.entries.map((entry: any, i: number) => (
            <div
              key={entry.id || i}
              style={{
                padding: '8px 10px',
                background: '#141416',
                border: '1px solid #262628',
                borderRadius: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#FF5500' }}>{entry.reference || 'Projection'}</span>
                <span style={{ fontSize: 10, color: '#a1a1aa' }}>{new Date(entry.timestamp).toLocaleTimeString()}</span>
              </div>
              {entry.text && (
                <div style={{ fontSize: 12, color: '#ffffff', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {entry.text}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: '#a1a1aa', fontSize: 12, padding: '16px 12px', textAlign: 'center' }}>
          No session history yet. Projected scriptures will appear here automatically.
        </div>
      )}
    </Block>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sessionBtn: { width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: 2 },
  entry: { padding: '8px 0', borderBottom: '1px solid var(--block-line)' },
  entryRef: { ...type.secondary, fontWeight: fontWeight.semibold, color: 'var(--accent)' },
  entryText: { ...type.caption, color: 'var(--text-secondary)', lineHeight: 1.4, margin: '2px 0' },
  entryMeta: { ...type.caption, color: 'var(--text-dim)' },
};
