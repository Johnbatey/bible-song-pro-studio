/* =========================================================================
   <ImportConflictModal> — duplicate detection on song import
   -------------------------------------------------------------------------
   Shown when any imported songs have titles that match songs already in the
   library. Gives the operator a clear choice — skip, overwrite, or cancel —
   rather than silently dropping duplicates.
   ========================================================================= */
import { useEffect, useRef } from 'react';
import type { Song } from '../types';
import { type } from '../styles/type';

export type ConflictResolution = 'skip' | 'overwrite' | 'cancel';

export interface ImportConflict {
  /** The newly imported song. */
  incoming: Song;
  /** The matching song already in the library. */
  existing: Song;
}

interface ImportConflictModalProps {
  /** Songs that have no match — shown as a count. */
  freshCount: number;
  /** Songs that collide with existing titles. */
  conflicts: ImportConflict[];
  onResolve: (resolution: ConflictResolution) => void;
}

export function ImportConflictModal({ freshCount, conflicts, onResolve }: ImportConflictModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  /* Close on Escape. */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onResolve('cancel');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onResolve]);

  /* Clicking the backdrop cancels. */
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onResolve('cancel');
  };

  const total = freshCount + conflicts.length;

  return (
    <div ref={overlayRef} style={styles.overlay} onClick={handleBackdrop}>
      <div style={styles.modal} role="dialog" aria-modal="true" aria-labelledby="import-conflict-title">
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <span style={styles.headerIcon} aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
            <span id="import-conflict-title" style={styles.title}>Duplicate Songs Detected</span>
          </div>
          <button type="button" style={styles.close} onClick={() => onResolve('cancel')} title="Cancel import" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={styles.body}>
          <p style={styles.summary}>
            <strong>{conflicts.length}</strong> of <strong>{total}</strong> song{total === 1 ? '' : 's'} already
            {conflicts.length === 1 ? ' exists' : ' exist'} in your library:
          </p>

          <div style={styles.listWrap}>
            {conflicts.map((c) => (
              <div key={c.existing.id} style={styles.conflictRow}>
                <span style={styles.conflictIcon} aria-hidden>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="8" r="6.5" />
                    <path d="M8 5v4" />
                    <path d="M8 11h.01" />
                  </svg>
                </span>
                <div style={styles.conflictInfo}>
                  <span style={styles.conflictTitle}>{c.incoming.title}</span>
                  {c.incoming.artist && (
                    <span style={styles.conflictArtist}> · {c.incoming.artist}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {freshCount > 0 && (
            <p style={styles.freshNote}>
              {freshCount} new song{freshCount === 1 ? '' : 's'} will be added regardless of your choice below.
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onResolve('cancel')}>
            Cancel
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onResolve('skip')}
              title="Import only the new songs, leave existing ones untouched"
            >
              Skip existing
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onResolve('overwrite')}
              title="Replace existing songs with the newly imported versions"
            >
              Overwrite existing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Inline styles (consistent with SettingsModal pattern) ── */
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 10001,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.55)',
    backdropFilter: 'blur(6px)',
    animation: 'fadeIn 0.15s ease',
  },
  modal: {
    width: 480,
    maxWidth: 'calc(100vw - 32px)',
    maxHeight: 'calc(100vh - 64px)',
    background: 'var(--bg-surface, #1e1e1e)',
    border: '1px solid var(--border-primary, rgba(255,255,255,0.1))',
    borderRadius: 12,
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.7)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animation: 'modalPop 0.2s ease',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 18px',
    borderBottom: '1px solid var(--border-primary, rgba(255,255,255,0.1))',
    background: 'var(--bg-secondary, #252525)',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    display: 'inline-flex',
    color: 'var(--tally-fault, #ff6b6b)',
  },
  title: {
    ...type.heading,
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text-primary, #fff)',
  },
  close: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-dim, rgba(255,255,255,0.4))',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  body: {
    flex: 1,
    minHeight: 0,
    padding: '16px 18px',
    overflowY: 'auto',
  },
  summary: {
    ...type.secondary,
    color: 'var(--text-secondary, rgba(255,255,255,0.7))',
    margin: 0,
    marginBottom: 12,
    lineHeight: 1.5,
  },
  listWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    maxHeight: 240,
    overflowY: 'auto',
    borderRadius: 8,
    border: '1px solid var(--border-primary, rgba(255,255,255,0.1))',
    background: 'var(--bg-elevated, rgba(255,255,255,0.03))',
    padding: 4,
  },
  conflictRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    borderRadius: 6,
    background: 'transparent',
    transition: 'background 0.1s',
  },
  conflictIcon: {
    display: 'inline-flex',
    color: 'var(--tally-fault, #ff6b6b)',
    flexShrink: 0,
    opacity: 0.7,
  },
  conflictInfo: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  conflictTitle: {
    ...type.heading,
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary, #fff)',
  },
  conflictArtist: {
    ...type.caption,
    color: 'var(--text-dim, rgba(255,255,255,0.4))',
  },
  freshNote: {
    ...type.caption,
    color: 'var(--text-dim, rgba(255,255,255,0.4))',
    margin: 0,
    marginTop: 12,
    fontStyle: 'italic',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 18px',
    borderTop: '1px solid var(--border-primary, rgba(255,255,255,0.1))',
    background: 'var(--bg-secondary, #252525)',
    flexShrink: 0,
  },
};
