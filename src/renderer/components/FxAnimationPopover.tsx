import React, { useCallback, useLayoutEffect, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../stores/appStore';
import type { FxTransitionType, FxAnimationSettings } from '../types';
import { AppleToggle } from './AppleToggle';
import { useDraggableModal } from '../hooks/useDraggableModal';

export interface FxAnimationPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  workspaceLabel?: 'Bible' | 'Songs' | 'Slides' | string;
  mode?: 'text' | 'slides';
  customSettings?: FxAnimationSettings;
  onCustomSettingsChange?: (settings: Partial<FxAnimationSettings>) => void;
}

const POPOVER_WIDTH = 280;

export const TEXT_TRANSITION_OPTIONS: Array<{ value: FxTransitionType; label: string }> = [
  { value: 'fade', label: 'Fade (Easy Ease)' },
  { value: 'zoom', label: 'Zoom (Easy Ease)' },
  { value: 'slide-up', label: 'Slide Up (Easy Ease)' },
  { value: 'slide-down', label: 'Slide Down (Easy Ease)' },
  { value: 'slide-left', label: 'Slide Left (Easy Ease)' },
  { value: 'slide-right', label: 'Slide Right (Easy Ease)' },
  { value: 'type', label: 'Type-On (Clip Reveal)' },
  { value: 'zoom-type', label: 'Zoom + Type-On (Clip Reveal)' },
  { value: 'type-words', label: 'Type-On (Word by Word)' },
  { value: 'zoom-type-words', label: 'Zoom + Type-On (Word by Word)' },
  { value: 'cut', label: 'Cut (Instant)' },
];

export const SLIDE_TRANSITION_OPTIONS: Array<{ value: FxTransitionType; label: string }> = [
  { value: 'fade', label: 'Dissolve' },
  { value: 'slide-left', label: 'Slide Left' },
  { value: 'slide-right', label: 'Slide Right' },
  { value: 'slide-up', label: 'Slide Up' },
  { value: 'slide-down', label: 'Slide Down' },
  { value: 'zoom', label: 'Scale In' },
  { value: 'cut', label: 'Cut' },
];

export function FxAnimationPopover({
  isOpen,
  onClose,
  anchorRef,
  workspaceLabel,
  mode,
  customSettings,
  onCustomSettingsChange,
}: FxAnimationPopoverProps) {
  const isSlidesMode = mode === 'slides' || workspaceLabel?.toLowerCase() === 'slides';
  const effectiveLabel = workspaceLabel || (isSlidesMode ? 'Slides' : 'Bible');

  const storeTextFx = useAppStore((s) => s.fxSettings);
  const setStoreTextFx = useAppStore((s) => s.setFxSettings);
  const storeSlideFx = useAppStore((s) => s.slideFxSettings);
  const setStoreSlideFx = useAppStore((s) => s.setSlideFxSettings);

  const activeFxSettings = customSettings || (isSlidesMode ? storeSlideFx : storeTextFx);
  const handleUpdateSettings = (updates: Partial<FxAnimationSettings>) => {
    if (onCustomSettingsChange) {
      onCustomSettingsChange(updates);
    } else if (isSlidesMode) {
      setStoreSlideFx(updates);
    } else {
      setStoreTextFx(updates);
    }
  };

  const options = isSlidesMode ? SLIDE_TRANSITION_OPTIONS : TEXT_TRANSITION_OPTIONS;

  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const { modalStyle, headerProps } = useDraggableModal();

  const updatePosition = useCallback(() => {
    if (!anchorRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const estimatedHeight = 270;

    let top = anchor.bottom + 8;
    if (top + estimatedHeight > window.innerHeight - 16) {
      top = Math.max(12, anchor.top - estimatedHeight - 8);
    }
    const left = Math.max(12, Math.min(anchor.left, window.innerWidth - POPOVER_WIDTH - 16));

    setPos({ top, left });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen || !pos) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: POPOVER_WIDTH,
        maxHeight: `calc(100vh - ${Math.max(20, pos.top)}px - 20px)`,
        overflowY: 'auto',
        background: 'var(--bsp-surface, #1C1A19)',
        border: '1px solid var(--bsp-edge, #2D2A28)',
        borderRadius: 8,
        boxShadow: '0 16px 44px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.06)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '12px 14px 14px',
        color: 'var(--text-primary, #ffffff)',
        backdropFilter: 'blur(20px)',
        userSelect: 'none',
        ...modalStyle,
      }}
    >
      {/* Title & Drag Handle Header */}
      <div
        {...headerProps}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 8,
          marginBottom: 2,
          borderBottom: '1px solid var(--border-primary, rgba(255, 255, 255, 0.08))',
          cursor: 'grab',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontFamily: "'Georgia', serif",
              fontStyle: 'italic',
              fontSize: 15,
              fontWeight: 900,
              color: '#FF5500',
              lineHeight: 1,
            }}
          >
            fx
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #ffffff)', letterSpacing: '0.01em' }}>
            Animation FX
          </span>
          <span
            style={{
              background: 'rgba(255, 85, 0, 0.15)',
              color: '#FF5500',
              border: '1px solid rgba(255, 85, 0, 0.3)',
              padding: '1px 6px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {effectiveLabel}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: 4,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-dim, #a1a1aa)',
            cursor: 'pointer',
            fontSize: 12,
            lineHeight: 1,
            padding: 0,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-dim, #a1a1aa)';
          }}
          title="Close FX Settings"
        >
          ✕
        </button>
      </div>

      {/* Transition Selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #d4d4d8)' }}>
          Transition
        </label>
        <select
          value={activeFxSettings.transitionType}
          onChange={(e) => handleUpdateSettings({ transitionType: e.target.value as FxTransitionType })}
          style={{
            height: 34,
            padding: '0 10px',
            background: 'var(--chrome-control, #27272a)',
            border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.12))',
            borderRadius: 6,
            color: 'var(--text-primary, #ffffff)',
            fontSize: 13,
            fontWeight: 500,
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ background: '#18181b', color: '#fff' }}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Duration Slider */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #d4d4d8)' }}>
            Duration
          </label>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'monospace',
              color: '#FF5500',
              background: 'rgba(255, 85, 0, 0.12)',
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            {activeFxSettings.duration.toFixed(1)}s
          </span>
        </div>
        <input
          type="range"
          min="0.1"
          max="5.0"
          step="0.1"
          value={activeFxSettings.duration}
          onChange={(e) => handleUpdateSettings({ duration: parseFloat(e.target.value) || 0.4 })}
          onDoubleClick={() => handleUpdateSettings({ duration: 0.4 })}
          title="Transition duration (Double-click to reset to 0.4s)"
          style={{
            width: '100%',
            height: 5,
            accentColor: '#FF5500',
            cursor: 'pointer',
          }}
        />
      </div>

      {/* Animate Background Toggle */}
      <div
        style={{
          paddingTop: 8,
          borderTop: '1px solid var(--border-primary, rgba(255, 255, 255, 0.08))',
        }}
      >
        <AppleToggle
          checked={activeFxSettings.animateBackground}
          onChange={(checked) => handleUpdateSettings({ animateBackground: checked })}
          label="Animate Background"
          description={isSlidesMode ? "Animate slide background alongside elements" : "Animate background alongside text"}
        />
      </div>

      {/* Stage Display FX Animation Toggle */}
      <div
        style={{
          paddingTop: 8,
          borderTop: '1px solid var(--border-primary, rgba(255, 255, 255, 0.08))',
        }}
      >
        <AppleToggle
          checked={activeFxSettings.stageDisplayFxEnabled !== false}
          onChange={(checked) => handleUpdateSettings({ stageDisplayFxEnabled: checked })}
          label="Stage Display FX"
          description="Play transition animations on stage confidence display"
        />
      </div>
    </div>,
    document.body
  );
}
