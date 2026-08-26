import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface DropdownOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  sublabel?: string;
  icon?: React.ReactNode;
  group?: string;
  badge?: string;
  badgeColor?: string;
  statusDot?: 'green' | 'red' | 'amber' | 'blue';
}

interface CustomDropdownProps<T extends string = string> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (val: T) => void;
  title?: string;
  style?: React.CSSProperties;
  buttonStyle?: React.CSSProperties;
  zIndex?: number;
}

export function CustomDropdown<T extends string = string>({
  value,
  options,
  onChange,
  title,
  style,
  buttonStyle,
  zIndex = 100005,
}: CustomDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number; flip: boolean } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value) || { value, label: value || options[0]?.label || '' };

  /**
   * The menu is portalled to the body rather than positioned inside the
   * container, so a toolbar that scrolls horizontally can clip its own
   * overflow without also clipping this. That means measuring the button.
   */
  const measure = useCallback(() => {
    const button = containerRef.current?.getBoundingClientRect();
    if (!button) return;
    const estimatedHeight = Math.min(340, options.length * 48 + 40);
    const flip = button.bottom + estimatedHeight + 8 > window.innerHeight;
    setMenuRect({
      top: flip ? button.top - 4 : button.bottom + 4,
      left: button.left,
      width: button.width,
      flip,
    });
  }, [options.length]);

  useEffect(() => {
    if (!isOpen) return;
    measure();
    // Capture phase so scrolling any ancestor — including the toolbar itself —
    // keeps the menu attached to its button.
    const reflow = () => measure();
    window.addEventListener('scroll', reflow, true);
    window.addEventListener('resize', reflow);
    return () => {
      window.removeEventListener('scroll', reflow, true);
      window.removeEventListener('resize', reflow);
    };
  }, [isOpen, measure]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      // The menu no longer lives inside the container, so it needs its own check.
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', width: style?.width || 'auto', flexShrink: 0, ...style }}>
      <button
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '6px 12px',
          height: 34,
          background: 'var(--chrome-control, #1d1b1c)',
          border: '1px solid var(--border-primary, #262628)',
          borderRadius: 6,
          color: 'var(--text-primary)',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'var(--font-ui)',
          transition: 'all 0.15s ease',
          ...buttonStyle,
        }}
        onClick={() => setIsOpen(!isOpen)}
        title={title}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', flex: 1, minWidth: 0 }}>
          {selectedOption?.statusDot && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: selectedOption.statusDot === 'green' ? '#22c55e' : selectedOption.statusDot === 'amber' ? '#f59e0b' : '#ef4444',
                boxShadow: selectedOption.statusDot === 'green' ? '0 0 6px rgba(34, 197, 94, 0.7)' : selectedOption.statusDot === 'amber' ? '0 0 6px rgba(245, 158, 11, 0.7)' : '0 0 6px rgba(239, 68, 68, 0.7)',
                flexShrink: 0,
              }}
            />
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
            {selectedOption?.label || value}
          </span>
        </div>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            color: 'var(--text-dim)',
            flexShrink: 0,
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && menuRect && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menuRect.top,
            left: menuRect.left,
            transform: menuRect.flip ? 'translateY(-100%)' : undefined,
            zIndex: zIndex,
            minWidth: Math.max(menuRect.width, 240),
            maxWidth: 380,
            background: 'var(--bg-secondary, #161414)',
            border: '1px solid var(--border-primary, #262628)',
            borderRadius: 6,
            boxShadow: 'var(--shadow-lg)',
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            maxHeight: 340,
            overflowY: 'auto',
          }}
        >
          {options.map((opt, idx) => {
            const prevGroup = idx > 0 ? options[idx - 1].group : undefined;
            const isNewGroup = opt.group && opt.group !== prevGroup;
            const isSelected = opt.value === value;

            return (
              <div key={opt.value} style={{ display: 'contents' }}>
                {isNewGroup && (
                  <div
                    style={{
                      padding: idx === 0 ? '4px 10px 4px 10px' : '8px 10px 4px 10px',
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--text-dim, #888)',
                      borderTop: idx > 0 ? '1px solid var(--border-primary, #262628)' : 'none',
                      marginTop: idx > 0 ? 4 : 0,
                      display: 'flex',
                      alignItems: 'center',
                      userSelect: 'none',
                    }}
                  >
                    <span>{opt.group}</span>
                  </div>
                )}
                <button
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '8px 12px',
                    background: isSelected ? 'var(--accent-dim, rgba(255, 85, 0, 0.15))' : 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    color: isSelected ? 'var(--accent, #FF5500)' : 'var(--text-primary)',
                    fontSize: 13,
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    fontFamily: 'var(--font-ui)',
                  }}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'var(--bg-hover, rgba(255, 255, 255, 0.08))';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', flex: 1, minWidth: 0 }}>
                    {opt.icon && (
                      <span style={{ display: 'flex', alignItems: 'center', color: isSelected ? 'var(--accent)' : 'var(--text-secondary)', flexShrink: 0 }}>
                        {opt.icon}
                      </span>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden', flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
                        {opt.statusDot && (
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: opt.statusDot === 'green' ? '#22c55e' : opt.statusDot === 'amber' ? '#f59e0b' : '#ef4444',
                              boxShadow: opt.statusDot === 'green' ? '0 0 6px rgba(34, 197, 94, 0.7)' : opt.statusDot === 'amber' ? '0 0 6px rgba(245, 158, 11, 0.7)' : '0 0 6px rgba(239, 68, 68, 0.7)',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        {opt.badge && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '1px 5px',
                              borderRadius: 4,
                              background: opt.badgeColor ? `${opt.badgeColor}22` : 'rgba(255, 255, 255, 0.1)',
                              color: opt.badgeColor || 'var(--text-dim)',
                              border: `1px solid ${opt.badgeColor ? `${opt.badgeColor}44` : 'rgba(255, 255, 255, 0.15)'}`,
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.sublabel && (
                        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent, #FF5500)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

