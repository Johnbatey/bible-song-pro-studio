import { useEffect, useRef, useState } from 'react';
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
  /* A service started from the phone is named by date; the desk can fix that
     while it runs. The draft only re-syncs from the live name when the operator
     is not in the middle of editing it. */
  const [nameDraft, setNameDraft] = useState('');
  const nameDirty = useRef(false);
  /* Ending clears the phone's history lists too, so a stray click should not do
     it: the first click arms, the second ends. */
  const [endArmed, setEndArmed] = useState(false);

  /* The armed window lives in main, so arming here disarms the phone immediately
     and arming there updates this button before a second click could land. */
  useEffect(() => {
    const off = window.BSP?.session?.onEndArm?.((payload) => setEndArmed(Boolean(payload?.armed)));
    return () => { if (typeof off === 'function') off(); };
  }, []);

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    const live = status?.session?.name;
    if (live && !nameDirty.current) setNameDraft(live);
  }, [status?.session?.name]);

  useEffect(() => {
    if (!status?.active) setEndArmed(false);
  }, [status?.active]);

  async function endService() {
    if (!endArmed) {
      await window.BSP?.session?.armEnd({ armed: true });
      return;
    }
    await window.BSP?.session?.armEnd({ armed: false });
    await window.BSP?.session?.end();
    refresh();
  }

  async function renameActive() {
    const name = nameDraft.trim();
    if (!name) return;
    const res = await window.BSP?.session?.rename({ name }).catch(() => null);
    if (!res?.ok) return;
    nameDirty.current = false;
    await refresh();
  }

  async function refresh() {
    const s = await window.BSP?.session?.status().catch(() => null);
    setStatus(s);
    /* A finished service is not renameable, so the next one starts from its own
       name rather than a leftover draft. */
    if (!s?.active) nameDirty.current = false;
    setEndArmed(Boolean(s?.endArm?.armed));
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
      /* The name is the one thing worth seeing without opening the panel: it is
         what the saved history will be filed under. Capped and ellipsised here,
         because .blk__subtitle is nowrap and unsrinkable and a long name would
         otherwise push the tools out of a narrow dock's chrome bar. */
      subtitle={status?.active ? (
        <span
          title={status?.session?.name || 'Recording'}
          style={{ display: 'inline-block', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom' }}
        >
          {'● ' + (status?.session?.name || 'Recording')}
        </span>
      ) : undefined}
      tools={(
        <>
          <BlockButton
            onClick={async () => { await window.BSP?.session?.start(); refresh(); }}
            title="Start a new session"
          >
            + New
          </BlockButton>
          {status?.active && (
            <BlockButton
              onClick={endService}
              title={endArmed ? 'Click again to end the service' : 'End active session'}
              style={endArmed ? { color: '#FF5500' } : undefined}
            >
              {endArmed ? 'Sure? End' : 'End'}
            </BlockButton>
          )}
          <BlockButton onClick={refresh} title="Refresh history">⟳</BlockButton>
        </>
      )}
    >
      {/* Session Switcher & Export Bar — scrolls sideways in a narrow dock */}
      <div className="bar-scroll" style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border-primary)' }}>
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

      {status?.active && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
          <input
            value={nameDraft}
            onChange={(e) => { nameDirty.current = true; setNameDraft(e.target.value); }}
            onKeyDown={(e) => { if (e.key === 'Enter') renameActive(); }}
            placeholder="Name this service"
            maxLength={80}
            aria-label="Service name"
            style={{
              flex: 1,
              minWidth: 0,
              height: 28,
              padding: '0 8px',
              background: 'var(--chrome-control)',
              border: '1px solid var(--border-primary)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: 12,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <BlockButton
            onClick={renameActive}
            title="Rename the running service"
            style={{ height: 28, fontSize: 11 }}
          >
            Rename
          </BlockButton>
        </div>
      )}

      {sessionData && sessionData.entries && sessionData.entries.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 0' }}>
          {sessionData.entries.map((entry: any, i: number) => (
            <div
              key={entry.id || i}
              style={{
                padding: '8px 10px',
                background: 'var(--chrome-control)',
                border: '1px solid var(--border-primary)',
                borderRadius: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#FF5500' }}>{entry.reference || 'Projection'}</span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{new Date(entry.timestamp).toLocaleTimeString()}</span>
              </div>
              {entry.text && (
                <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {entry.text}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: 'var(--text-dim)', fontSize: 12, padding: '16px 12px', textAlign: 'center' }}>
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
