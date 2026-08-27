import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../i18n/useI18n';

export interface WorkspacePromptRequest {
  title: string;
  /** The sentence under the title. One line — this is not a place to explain. */
  hint?: string;
  initialValue: string;
  confirmLabel: string;
  onConfirm: (name: string) => void;
}

interface WorkspaceNameDialogProps {
  request: WorkspacePromptRequest | null;
  onClose: () => void;
}

/**
 * The name box for saving, forking and renaming an arrangement.
 *
 * Electron's renderer has no `window.prompt` — it is one of the APIs Chromium
 * ships and Electron removes — so anything that needs a string from the
 * operator has to draw its own. That is no loss: a native prompt could not
 * have shown the placeholder, disabled Save on an empty name, or matched the
 * app at all.
 */
export function WorkspaceNameDialog({ request, onClose }: WorkspaceNameDialogProps) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!request) return;
    setValue(request.initialValue);
    /* Focused and selected, so the common case — accept the suggestion, or type
       straight over it — is zero clicks either way. */
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 40);
    return () => window.clearTimeout(timer);
  }, [request]);

  if (!request) return null;

  const trimmed = value.trim();
  const canConfirm = trimmed.length > 0;

  const confirm = () => {
    if (!canConfirm) return;
    request.onConfirm(trimmed);
    onClose();
  };

  return (
    <div
      style={styles.scrim}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={styles.card} role="dialog" aria-modal="true" aria-label={request.title}>
        <div style={styles.title}>{request.title}</div>
        {request.hint && <div style={styles.hint}>{request.hint}</div>}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); confirm(); }
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
          }}
          placeholder={t('workspace.placeholder')}
          maxLength={60}
          spellCheck={false}
          style={styles.input}
        />
        <div style={styles.actions}>
          <button type="button" style={styles.secondary} onClick={onClose}>{t('common.cancel')}</button>
          <button
            type="button"
            style={{ ...styles.primary, opacity: canConfirm ? 1 : 0.45, cursor: canConfirm ? 'pointer' : 'not-allowed' }}
            disabled={!canConfirm}
            onClick={confirm}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  scrim: {
    position: 'fixed',
    inset: 0,
    zIndex: 100000,
    background: 'rgba(0, 0, 0, 0.55)',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 360,
    padding: 20,
    background: 'var(--bg-secondary, #161414)',
    border: '1px solid var(--block-line)',
    borderRadius: 'var(--bsp-r-max, 6px)',
    boxShadow: 'var(--bsp-e3)',
    fontFamily: 'var(--font-ui)',
  },
  title: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text-primary)',
    letterSpacing: '-0.01em',
  },
  hint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--text-dim)',
  },
  input: {
    width: '100%',
    marginTop: 14,
    padding: '9px 12px',
    background: 'var(--chrome-control)',
    border: '1px solid var(--block-line)',
    borderRadius: 'var(--bsp-r-base, 4px)',
    color: 'var(--text-primary)',
    fontSize: 13,
    fontFamily: 'var(--font-ui)',
    outline: 'none',
    boxSizing: 'border-box',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  secondary: {
    padding: '7px 14px',
    background: 'var(--chrome-control)',
    border: '1px solid var(--block-line)',
    borderRadius: 'var(--bsp-r-base, 4px)',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
  },
  primary: {
    padding: '7px 14px',
    background: 'var(--accent)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--bsp-r-base, 4px)',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
  },
};
