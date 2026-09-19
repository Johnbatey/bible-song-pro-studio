import React, { useEffect } from 'react';

export interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutCategory {
  title: string;
  color: string;
  items: ShortcutItem[];
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: 'Live Output & Presentation',
    color: '#FF5500',
    items: [
      { keys: ['→', 'Space', 'PgDn'], description: 'Next slide / verse / song section' },
      { keys: ['←', 'PgUp'], description: 'Previous slide / verse' },
      { keys: ['ESC'], description: 'Clear output (Standby / Black screen)' },
      { keys: ['⌘', '⇧', 'B'], description: 'Emergency audience blackout' },
      { keys: ['F5', '⌘', 'T'], description: 'Studio mode Take / Transition' },
    ],
  },
  {
    title: 'Spotlight & Navigation',
    color: '#38bdf8',
    items: [
      { keys: ['⌘', 'K'], description: 'Global Spotlight search (Scripture, Songs, Slides)' },
      { keys: ['?'], description: 'Open Keyboard Shortcuts cheat sheet' },
      { keys: ['⌘', ','], description: 'Open Application Settings' },
      { keys: ['⌘', 'D'], description: 'Toggle Output Mode (Fullscreen ↔ Lower-Third)' },
      { keys: ['⌘', 'M'], description: 'Toggle Studio Mode (Live ↔ Preview)' },
    ],
  },
  {
    title: 'Slide Editor Studio',
    color: '#a855f7',
    items: [
      { keys: ['⌘', 'Z'], description: 'Undo last element move / edit' },
      { keys: ['⌘', '⇧', 'Z'], description: 'Redo action' },
      { keys: ['⌘', 'E'], description: 'Launch Pro Slide Editor' },
      { keys: ['⌫', 'Del'], description: 'Delete selected shape, text or media layer' },
      { keys: ['↑', '↓', '←', '→'], description: 'Nudge selected object (Hold Shift for 10px)' },
    ],
  },
  {
    title: 'Workspace Ergonomics',
    color: '#10b981',
    items: [
      { keys: ['Double Click'], description: 'Instant Take / Go Live on slide or scripture' },
      { keys: ['Right Click'], description: 'Context menu for verse / slide / song actions' },
      { keys: ['Drag & Drop'], description: 'Import PowerPoint, video clips, and song files' },
      { keys: ['Click & Drag'], description: 'Dock splitting and custom workspace layout' },
    ],
  },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100001,
        fontFamily: 'var(--bsp-font-interface, system-ui, -apple-system, sans-serif)',
      }}
    >
      <div
        className="shortcuts-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shortcuts-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: 'rgba(255, 85, 0, 0.15)',
                border: '1px solid rgba(255, 85, 0, 0.35)',
                color: '#FF5500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
                fontWeight: 800,
              }}
            >
              ⌨
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary, #F5F3F1)' }}>
                Keyboard Shortcuts & Operator Cheat Sheet
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim, #8A8580)', marginTop: '2px' }}>
                High-speed control keys for live production & worship presentation
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 26,
              height: 26,
              borderRadius: 4,
              border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.1))',
              background: 'var(--chrome-control, transparent)',
              color: 'var(--text-secondary, #8A8580)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              padding: 0,
              transition: 'all 0.15s ease',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content: 2-Column Grid of Categories */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '14px',
            backgroundColor: 'var(--bg-surface, #1C1A19)',
          }}
        >
          {SHORTCUT_CATEGORIES.map((cat) => (
            <div
              key={cat.title}
              className="shortcuts-modal-card"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: cat.color,
                  }}
                />
                <span style={{ fontSize: '11.5px', fontWeight: 750, color: 'var(--text-primary, #F5F3F1)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {cat.title}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cat.items.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      fontSize: '12px',
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary, #F5F3F1)', flex: 1, minWidth: 0, fontSize: '12px', fontWeight: 500 }}>
                      {item.description}
                    </span>

                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {item.keys.map((k, ki) => (
                        <kbd
                          key={ki}
                          className="shortcuts-modal-kbd"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="shortcuts-modal-footer">
          <span>Press <kbd className="shortcuts-modal-kbd" style={{ minWidth: 'auto', height: 18, padding: '0 5px' }}>?</kbd> or <kbd className="shortcuts-modal-kbd" style={{ minWidth: 'auto', height: 18, padding: '0 5px' }}>ESC</kbd> to toggle this cheat sheet</span>
          <span style={{ fontWeight: 600 }}>Bible Song Pro Studio</span>
        </div>
      </div>
    </div>
  );
};
