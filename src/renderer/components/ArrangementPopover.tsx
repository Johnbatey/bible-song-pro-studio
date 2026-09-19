import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Song } from '../types';
import type { ArrangeProposal } from '../utils/song-arrange';
import { describeArrangement, shortLabel } from '../utils/song-arrange';
import { type, fontWeight } from '../styles/type';
import { BlockButton } from './Block';
import { useDraggableModal } from '../hooks/useDraggableModal';
import { useI18n } from '../../i18n/useI18n';

export interface ArrangementPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  song: Song;
  effectiveOrder: string[];
  setOrder: (order: string[]) => void;
  proposal: ArrangeProposal | null;
  applyProposal: () => void;
  setProposal: (p: ArrangeProposal | null) => void;
  runAutoArrange: () => void;
  arranging: boolean;
  undoSnapshot: Song | null;
  undoArrange: () => void;
  patchSelectedSong: (patch: Partial<Song>) => void;
}

const POPOVER_WIDTH = 340;

export function ArrangementPopover({
  isOpen,
  onClose,
  anchorRef,
  song,
  effectiveOrder,
  setOrder,
  proposal,
  applyProposal,
  setProposal,
  runAutoArrange,
  arranging,
  undoSnapshot,
  undoArrange,
  patchSelectedSong,
}: ArrangementPopoverProps) {
  const { t } = useI18n();
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const { modalStyle, headerProps } = useDraggableModal();

  const updatePosition = useCallback(() => {
    if (!anchorRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const estimatedHeight = 320;

    let top: number;
    if (anchor.top > window.innerHeight / 2) {
      top = Math.max(12, anchor.top - estimatedHeight - 10);
    } else {
      top = Math.min(window.innerHeight - estimatedHeight - 16, anchor.bottom + 8);
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
          marginBottom: 12,
          borderBottom: '1px solid var(--border-primary, rgba(255, 255, 255, 0.08))',
          cursor: 'grab',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #ffffff)', letterSpacing: '0.01em' }}>
            {t('songs.arrangement') || 'Play Order'}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              padding: '1px 6px',
              borderRadius: 4,
              background: 'rgba(255, 255, 255, 0.06)',
              color: 'var(--text-dim, #a1a1aa)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 160,
            }}
            title={describeArrangement(song)}
          >
            {describeArrangement(song)}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          data-no-drag
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
          title="Close Arrangement"
        >
          ✕
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* The order itself, editable */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {effectiveOrder.map((id, index) => {
            const slide = song.slides.find((s) => s.id === id);
            return (
              <span
                key={`${id}-${index}`}
                style={{
                  ...type.caption,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                  padding: '2px 4px 2px 6px',
                  borderRadius: 4,
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: 'var(--text-primary)',
                  fontSize: 11,
                }}
              >
                <button
                  type="button"
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '0 2px', lineHeight: 1, fontSize: 11 }}
                  disabled={index === 0}
                  title="Move earlier"
                  onClick={() => {
                    const next = [...effectiveOrder];
                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                    setOrder(next);
                  }}
                >
                  ‹
                </button>
                <span title={slide?.label} style={{ fontWeight: 600 }}>{shortLabel(slide?.label || '?')}</span>
                <button
                  type="button"
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '0 2px', lineHeight: 1, fontSize: 11 }}
                  disabled={index === effectiveOrder.length - 1}
                  title="Move later"
                  onClick={() => {
                    const next = [...effectiveOrder];
                    [next[index], next[index + 1]] = [next[index + 1], next[index]];
                    setOrder(next);
                  }}
                >
                  ›
                </button>
                <button
                  type="button"
                  style={{ background: 'transparent', border: 'none', color: 'var(--tally-fault, #ef4444)', cursor: 'pointer', padding: '0 2px', lineHeight: 1, fontSize: 11 }}
                  title="Remove from the order"
                  onClick={() => setOrder(effectiveOrder.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>

        {/* Add section buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          <span style={{ ...type.caption, color: 'var(--text-dim)', fontSize: 10.5 }}>{t('panel.add')}:</span>
          {song.slides.map((slide) => (
            <BlockButton
              key={slide.id}
              onClick={() => setOrder([...effectiveOrder, slide.id])}
              title={`Add ${slide.label} to the end of the order`}
              style={{ fontSize: 11, padding: '2px 6px' }}
            >
              + {shortLabel(slide.label)}
            </BlockButton>
          ))}
        </div>

        {proposal ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: 8,
              borderRadius: 6,
              border: '1px solid var(--chrome-control-active, #FF5500)',
              background: 'rgba(255, 85, 0, 0.08)',
            }}
          >
            <div style={{ ...type.caption, color: 'var(--text-secondary)' }}>
              {proposal.confidence < 0.6
                ? 'Guessed from the line breaks — check the sections before applying.'
                : 'Proposed sections and play order:'}
            </div>
            <div style={{ ...type.secondary, color: 'var(--text-primary)', fontWeight: 600 }}>
              {proposal.song.slides.map((s) => s.label).join(' · ')}
            </div>
            <div style={{ ...type.caption, color: 'var(--text-dim)' }}>
              Order:{' '}
              {(proposal.song.arrangement || proposal.song.slides.map((s) => s.id))
                .map((id) => shortLabel(proposal.song.slides.find((s) => s.id === id)?.label || '?'))
                .join(' ')}
            </div>
            {proposal.warnings.map((w) => (
              <div key={w} style={{ ...type.caption, color: 'var(--tally-fault)' }}>{w}</div>
            ))}
            <div style={{ display: 'flex', gap: 4 }}>
              <BlockButton onClick={applyProposal}>{t('panel.apply')}</BlockButton>
              <BlockButton onClick={() => setProposal(null)}>{t('panel.cancel')}</BlockButton>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingTop: 2 }}>
            <BlockButton
              onClick={runAutoArrange}
              disabled={arranging}
              title="Re-read the lyrics, split them into sections and work out the play order"
              style={{ fontSize: 11 }}
            >
              {arranging ? 'Reading…' : 'Auto-arrange'}
            </BlockButton>
            {undoSnapshot && (
              <BlockButton onClick={undoArrange} style={{ fontSize: 11 }}>Undo arrange</BlockButton>
            )}
            {song.arrangement && song.arrangement.length > 0 && (
              <BlockButton onClick={() => patchSelectedSong({ arrangement: undefined })} style={{ fontSize: 11 }}>
                Clear order
              </BlockButton>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
