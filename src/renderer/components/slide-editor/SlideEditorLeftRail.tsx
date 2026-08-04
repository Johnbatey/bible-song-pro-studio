import React, { useState } from 'react';
import type { PresentationSlide } from '../../types';

interface SlideEditorLeftRailProps {
  slides: PresentationSlide[];
  activeSlideIndex: number;
  onSelectSlide: (index: number) => void;
  onAddSlide: () => void;
  onDuplicateSlide: (index: number) => void;
  onDeleteSlide: (index: number) => void;
  onMoveSlide: (fromIndex: number, toIndex: number) => void;
  onApplyTemplate: (templateType: string) => void;
  /* Supplied by the PowerPoint path, whose slides are parsed OOXML rather than
     the native element model — the rail draws whatever this returns in place
     of its own background-and-title preview. */
  renderThumb?: (index: number) => React.ReactNode;
  /* PowerPoint decks have a fixed slide list: adding, duplicating, deleting
     and reordering would have to rewrite the package, which is not ported. */
  readOnlyDeck?: boolean;
}

export function SlideEditorLeftRail({
  slides,
  activeSlideIndex,
  onSelectSlide,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onMoveSlide,
  onApplyTemplate,
  renderThumb,
  readOnlyDeck = false,
}: SlideEditorLeftRailProps) {
  const [activeTab, setActiveTab] = useState<'slides' | 'templates'>('slides');

  const prebuiltTemplates = [
    { id: 'worship', name: 'Worship Song Classic', bg: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)', text: 'Sing unto the Lord a new song' },
    { id: 'sermon', name: 'Sermon Points Dark', bg: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)', text: 'Main Scripture & Key Takeaways' },
    { id: 'lower-third', name: 'Lower Third Overlay', bg: 'rgba(0, 0, 0, 0.85)', text: 'Speaker Name & Title' },
    { id: 'announcement', name: 'Event Announcement', bg: 'linear-gradient(135deg, #f97316 0%, #7c2d12 100%)', text: 'Sunday Service & Worship' },
  ];

  return (
    <aside
      style={{
        width: 240,
        minWidth: 240,
        background: '#15171d',
        borderRight: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      {/* Rail Nav Segmented Switcher */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div
          style={{
            display: 'flex',
            background: 'rgba(0, 0, 0, 0.3)',
            padding: 3,
            borderRadius: 8,
            gap: 2,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('slides')}
            style={{
              flex: 1,
              padding: '6px 8px',
              background: activeTab === 'slides' ? '#f4621f' : 'transparent',
              border: 'none',
              borderRadius: 6,
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
              <rect x="3" y="4" width="18" height="13" rx="2" />
              <path d="M7 21h10M12 17v4" />
            </svg>
            Slides
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            style={{
              flex: 1,
              padding: '6px 8px',
              background: activeTab === 'templates' ? '#f4621f' : 'transparent',
              border: 'none',
              borderRadius: 6,
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
            Templates
          </button>
        </div>
      </div>

      {/* Main Panel Content */}
      {activeTab === 'slides' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Section Header */}
          <div
            style={{
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.65)', textTransform: 'uppercase' }}>
              Slides Deck
            </span>
            {!readOnlyDeck && (
            <button
              type="button"
              onClick={onAddSlide}
              style={{
                width: 24,
                height: 24,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f4621f',
                border: 'none',
                borderRadius: 4,
                color: '#ffffff',
                cursor: 'pointer',
              }}
              title="Add New Slide"
            >
              <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2.5 }}>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            )}
          </div>

          {/* Slides List */}
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
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: isActive ? '#f4621f' : 'rgba(255, 255, 255, 0.4)',
                      minWidth: 16,
                      marginTop: 4,
                      textAlign: 'right',
                    }}
                  >
                    {idx + 1}
                  </span>

                  <div
                    style={{
                      flex: 1,
                      background: '#1c1e26',
                      border: isActive ? '2px solid #f4621f' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 8,
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    {renderThumb ? (
                      <div style={{ width: '100%', overflow: 'hidden', background: '#000', display: 'flex' }}>
                        {renderThumb(idx)}
                      </div>
                    ) : (
                    <div
                      style={{
                        width: '100%',
                        height: 90,
                        background: bgType === 'gradient' ? bgValue : bgType === 'color' ? bgValue : '#18181b',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 6,
                        boxSizing: 'border-box',
                        position: 'relative',
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
                          zIndex: 2,
                          maxWidth: '95%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {slide.title || `Slide ${idx + 1}`}
                      </div>
                    </div>
                    )}

                    <div
                      style={{
                        padding: '4px 8px',
                        background: '#15171d',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ fontSize: 9, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', fontWeight: 600 }}>
                        {slide.transition || 'fade'}
                      </span>
                      {!readOnlyDeck && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMoveSlide(idx, idx - 1);
                            }}
                            style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: 10 }}
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
                            style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: 10 }}
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
                          style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: 10 }}
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
                            style={{ background: 'none', border: 'none', color: '#ff453a', cursor: 'pointer', fontSize: 10 }}
                            title="Delete Slide"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footnote */}
          <div
            style={{
              padding: '8px 12px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              background: '#15171d',
              fontSize: 11,
              color: 'rgba(255, 255, 255, 0.5)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Active Slide: <strong style={{ color: '#ffffff' }}>{activeSlideIndex + 1}</strong></span>
            <span>Total: {slides.length}</span>
          </div>
        </div>
      ) : (
        /* Templates Panel */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 12, overflowY: 'auto', gap: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.65)', textTransform: 'uppercase' }}>
            Slide Templates
          </span>

          {prebuiltTemplates.map((tpl) => (
            <div
              key={tpl.id}
              onClick={() => onApplyTemplate(tpl.id)}
              style={{
                background: '#1c1e26',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                overflow: 'hidden',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  height: 70,
                  background: tpl.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 8,
                  textAlign: 'center',
                  color: '#ffffff',
                  fontSize: 10,
                  fontWeight: 600,
                }}
              >
                {tpl.text}
              </div>
              <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, color: '#ffffff' }}>
                {tpl.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
