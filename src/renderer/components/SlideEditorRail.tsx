import React from 'react';
import type { PresentationSlide } from '../types';

interface SlideEditorRailProps {
  slides: PresentationSlide[];
  activeSlideIndex: number;
  onSelectSlide: (index: number) => void;
  onAddSlide: () => void;
  onDuplicateSlide: (index: number) => void;
  onDeleteSlide: (index: number) => void;
  onMoveSlide: (fromIndex: number, toIndex: number) => void;
}

export function SlideEditorRail({
  slides,
  activeSlideIndex,
  onSelectSlide,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onMoveSlide,
}: SlideEditorRailProps) {
  return (
    <div
      style={{
        width: 220,
        minWidth: 220,
        background: '#161414',
        borderRight: '1px solid #262628',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        userSelect: 'none',
      }}
    >
      {/* Header with Add Slide Action */}
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid #262628',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', letterSpacing: '0.02em' }}>
          SLIDES ({slides.length})
        </span>
        <button
          type="button"
          onClick={onAddSlide}
          style={{
            background: '#FF5500',
            border: 'none',
            color: '#ffffff',
            borderRadius: 4,
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          title="Add New Slide"
        >
          + Add
        </button>
      </div>

      {/* Slide Thumbnails List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {slides.map((slide, idx) => {
          const isActive = idx === activeSlideIndex;
          const bgValue = slide.background?.value || '#18181b';
          const bgType = slide.background?.type || 'color';

          return (
            <div
              key={slide.id || idx}
              onClick={() => onSelectSlide(idx)}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                cursor: 'pointer',
              }}
            >
              {/* Slide Number */}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: isActive ? '#FF5500' : '#a1a1aa',
                  minWidth: 16,
                  marginTop: 4,
                  textAlign: 'right',
                }}
              >
                {idx + 1}
              </span>

              {/* Thumbnail Container */}
              <div
                style={{
                  flex: 1,
                  background: '#1d1b1c',
                  border: isActive ? '2px solid #FF5500' : '1px solid #262628',
                  borderRadius: 6,
                  overflow: 'hidden',
                  position: 'relative',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Visual Preview Box */}
                <div
                  style={{
                    width: '100%',
                    height: 96,
                    background: bgType === 'gradient' ? bgValue : bgType === 'color' ? bgValue : '#18181b',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 8,
                    position: 'relative',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                  }}
                >
                  {bgType === 'image' && bgValue && (
                    <img
                      src={bgValue}
                      alt=""
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}

                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#ffffff',
                      textAlign: 'center',
                      lineHeight: 1.2,
                      zIndex: 2,
                      maxWidth: '90%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {slide.title || `Slide ${idx + 1}`}
                  </div>
                  {slide.body && (
                    <div
                      style={{
                        fontSize: 8,
                        color: 'rgba(255, 255, 255, 0.7)',
                        textAlign: 'center',
                        marginTop: 2,
                        zIndex: 2,
                        maxWidth: '90%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {slide.body}
                    </div>
                  )}
                </div>

                {/* Footer Controls & Transition Badge */}
                <div
                  style={{
                    padding: '4px 8px',
                    background: '#161414',
                    borderTop: '1px solid #262628',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: 9, color: '#a1a1aa', textTransform: 'uppercase', fontWeight: 600 }}>
                    {slide.transition || 'fade'}
                  </span>

                  {/* Actions (Duplicate, Delete, Move) */}
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveSlide(idx, idx - 1);
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: '0 2px', fontSize: 10 }}
                        title="Move Up"
                      >
                        ▲
                      </button>
                    )}
                    {idx < slides.length - 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveSlide(idx, idx + 1);
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: '0 2px', fontSize: 10 }}
                        title="Move Down"
                      >
                        ▼
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicateSlide(idx);
                      }}
                      style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: '0 2px', fontSize: 10 }}
                      title="Duplicate Slide"
                    >
                      ❐
                    </button>
                    {slides.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSlide(idx);
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 2px', fontSize: 10 }}
                        title="Delete Slide"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
