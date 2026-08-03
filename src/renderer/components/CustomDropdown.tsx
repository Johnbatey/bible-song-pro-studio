import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface DropdownOption<T extends string = string> {
  value: T;
  label: string;
  sublabel?: string;
}

interface CustomDropdownProps<T extends string = string> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (val: T) => void;
  title?: string;
  style?: React.CSSProperties;
  buttonStyle?: React.CSSProperties;
}

export function CustomDropdown<T extends string = string>({
  value,
  options,
  onChange,
  title,
  style,
  buttonStyle,
}: CustomDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number; flip: boolean } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  /**
   * The menu is portalled to the body rather than positioned inside the
   * container, so a toolbar that scrolls horizontally can clip its own
   * overflow without also clipping this. That means measuring the button.
   */
  const measure = useCallback(() => {
    const button = containerRef.current?.getBoundingClientRect();
    if (!button) return;
    const estimatedHeight = Math.min(240, options.length * 38 + 8);
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
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', flexShrink: 0, ...style }}>
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '6px 12px',
          height: 34,
          background: 'var(--chrome-control)',
          border: '1px solid var(--chrome-control)',
          borderRadius: 6,
          color: '#ffffff',
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
        <span>{selectedOption?.label || value}</span>
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
            color: '#ffffff',
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
            zIndex: 1500,
            minWidth: menuRect.width,
            width: 'max-content',
            background: '#161414',
            border: '1px solid #262628',
            borderRadius: 8,
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.8)',
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '8px 12px',
                  background: isSelected ? 'rgba(255, 85, 0, 0.1)' : 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  color: isSelected ? '#FF5500' : '#ffffff',
                  fontSize: 13,
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                  fontFamily: 'var(--font-ui)',
                }}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span>{opt.label}</span>
                {opt.sublabel && (
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{opt.sublabel}</span>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
