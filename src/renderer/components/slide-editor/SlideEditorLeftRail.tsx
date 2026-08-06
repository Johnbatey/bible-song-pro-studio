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
  renderThumb?: (index: number, width: number) => React.ReactNode;
  /* PowerPoint decks have a fixed slide list: adding, duplicating, deleting
     and reordering would have to rewrite the package, which is not ported. */
  readOnlyDeck?: boolean;
}

function RailSlideThumb({
  index,
  renderThumb,
}: {
  index: number;
  renderThumb: (index: number, width: number) => React.ReactNode;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState<number>(180);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect?.width;
      if (measured && measured > 0) {
        setWidth(Math.round(measured));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', overflow: 'hidden', background: '#000', display: 'flex' }}>
      {renderThumb(index, width)}
    </div>
  );
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
    { id: 'worship', name: 'Worship Song Classic', bg: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)', text: 'Sing unto the Lord a new song' },
    { id: 'sermon', name: 'Sermon Key Points', bg: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)', text: '01. Main Scripture & Key Takeaways' },
    { id: 'scripture', name: 'Scripture Verse Display', bg: 'linear-gradient(135deg, #0b132b 0%, #1c2541 100%)', text: '"For God so loved the world..." — John 3:16' },
    { id: 'lower-third', name: 'Lower Third Overlay Bar', bg: 'rgba(0, 0, 0, 0.85)', text: 'Pastor David · Guest Speaker' },
    { id: 'announcement', name: 'Event Announcement', bg: 'linear-gradient(135deg, #4c1d95 0%, #831843 100%)', text: 'Sunday Worship Service · 10 AM' },
    { id: 'welcome', name: 'Welcome & Fellowship', bg: 'linear-gradient(135deg, #1c1917 0%, #292524 100%)', text: 'Welcome to Our Church Family' },
    { id: 'offering', name: 'Offering & Tithing', bg: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)', text: 'Honour the Lord with your wealth' },
    { id: 'benediction', name: 'Benediction & Closing', bg: 'linear-gradient(135deg, #450a0a 0%, #1c0505 100%)', text: 'The Peace & Blessing of Christ' },
  ];

  return (
    <aside
      style={{
        width: 240,
        minWidth: 240,
        background: 'var(--bg-surface, #161414)',
        borderRight: '1px solid var(--block-line, #262628)',
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
                      <RailSlideThumb index={idx} renderThumb={renderThumb} />
                    ) : (
                    <div
                      style={{
                        width: '100%',
                        aspectRatio: '16 / 9',
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
                        background: 'var(--bg-surface, #161414)',
                        borderTop: '1px solid var(--block-line, #262628)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ fontSize: 9, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', fontWeight: 600 }}>
                        {slide.transition || 'fade'}
                      </span>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {!readOnlyDeck && idx > 0 && (
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
                        {!readOnlyDeck && idx < slides.length - 1 && (
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
                        {!readOnlyDeck && (
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
                        )}
                        {slides.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSlide(idx);
                            }}
                            style={{
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: 'none',
                              borderRadius: 4,
                              color: '#f87171',
                              cursor: 'pointer',
                              fontSize: 11,
                              padding: '2px 5px',
                              lineHeight: 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title="Delete Slide"
                          >
                            <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                              <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
                            </svg>
                          </button>
                        )}
                      </div>
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
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 8,
                overflow: 'hidden',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(244, 98, 31, 0.5)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <TemplateCardThumb id={tpl.id} bg={tpl.bg} />
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.9)',
                  padding: '6px 10px',
                  background: 'rgba(0, 0, 0, 0.6)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                {tpl.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function getTemplateElements(id: string): any[] {
  if (id === 'worship') {
    return [
      { id: '1', type: 'text', content: 'AMAZING GRACE, HOW SWEET THE SOUND', x: 10, y: 28, width: 80, height: 25, fontSize: 48, color: '#ffffff', fontWeight: 700, textAlign: 'center' },
      { id: '2', type: 'text', content: 'That saved a wretch like me! I once was lost, but now am found', x: 10, y: 56, width: 80, height: 20, fontSize: 28, color: 'rgba(255, 255, 255, 0.8)', textAlign: 'center' },
    ];
  }
  if (id === 'sermon') {
    return [
      { id: 'card', type: 'shape', x: 8, y: 12, width: 84, height: 76, backgroundColor: 'rgba(35, 34, 33, 0.7)', borderColor: 'rgba(255, 85, 0, 0.3)', borderWidth: 1, borderRadius: 16 },
      { id: 'badge', type: 'shape', x: 12, y: 18, width: 6, height: 10, backgroundColor: '#f4621f', borderRadius: 12 },
      { id: 'num', type: 'text', content: '01', x: 12, y: 19, width: 6, height: 8, fontSize: 24, color: '#ffffff', fontWeight: 700, textAlign: 'center' },
      { id: 'title', type: 'text', content: 'FAITH OVER FEAR: WALKING IN PURPOSE', x: 20, y: 18, width: 68, height: 12, fontSize: 34, color: '#ffffff', fontWeight: 700 },
      { id: 'body', type: 'text', content: '• Trusting God in times of uncertainty\n• Stepping out of your comfort zone\n• Building a foundation rooted in Prayer', x: 20, y: 34, width: 68, height: 48, fontSize: 26, color: '#d4d4d8' },
    ];
  }
  if (id === 'scripture') {
    return [
      { id: 'verse', type: 'text', content: '"For God so loved the world, that he gave his only begotten Son..."', x: 10, y: 25, width: 80, height: 40, fontSize: 36, color: '#ffffff', fontWeight: 700, textAlign: 'center' },
      { id: 'ref', type: 'text', content: 'JOHN 3:16 (KJV)', x: 25, y: 70, width: 50, height: 12, fontSize: 26, color: '#f4621f', fontWeight: 700, textAlign: 'center' },
    ];
  }
  if (id === 'lower-third') {
    return [
      { id: 'bg', type: 'shape', x: 6, y: 70, width: 88, height: 22, backgroundColor: 'rgba(22, 20, 20, 0.92)', borderColor: '#f4621f', borderWidth: 2, borderRadius: 12 },
      { id: 'name', type: 'text', content: 'PASTOR DAVID E. JOHNSON', x: 10, y: 73, width: 80, height: 10, fontSize: 32, color: '#ffffff', fontWeight: 700 },
      { id: 'role', type: 'text', content: 'Senior Pastor · Grace Community Church', x: 10, y: 82, width: 80, height: 8, fontSize: 20, color: '#f4621f', fontWeight: 700 },
    ];
  }
  if (id === 'announcement') {
    return [
      { id: 'badge', type: 'shape', x: 35, y: 15, width: 30, height: 8, backgroundColor: '#f4621f', borderRadius: 22 },
      { id: 'badgetxt', type: 'text', content: 'UPCOMING EVENT', x: 35, y: 16, width: 30, height: 6, fontSize: 16, color: '#ffffff', fontWeight: 700, textAlign: 'center' },
      { id: 'title', type: 'text', content: 'SUNDAY NIGHT WORSHIP & HEALING', x: 10, y: 28, width: 80, height: 25, fontSize: 44, color: '#ffffff', fontWeight: 700, textAlign: 'center' },
      { id: 'details', type: 'text', content: 'THIS SUNDAY · 6:00 PM · MAIN SANCTUARY', x: 10, y: 56, width: 80, height: 25, fontSize: 24, color: 'rgba(255, 255, 255, 0.85)', textAlign: 'center' },
    ];
  }
  if (id === 'welcome') {
    return [
      { id: 'title', type: 'text', content: 'WELCOME TO OUR CHURCH', x: 10, y: 30, width: 80, height: 25, fontSize: 52, color: '#ffffff', fontWeight: 700, textAlign: 'center' },
      { id: 'sub', type: 'text', content: 'We are so glad you are worshipping with us today!', x: 10, y: 58, width: 80, height: 18, fontSize: 28, color: '#f4621f', fontWeight: 700, textAlign: 'center' },
    ];
  }
  if (id === 'offering') {
    return [
      { id: 'title', type: 'text', content: 'TITHE & OFFERING', x: 10, y: 20, width: 80, height: 20, fontSize: 48, color: '#ffffff', fontWeight: 700, textAlign: 'center' },
      { id: 'verse', type: 'text', content: '"Honor the LORD with your wealth..."', x: 10, y: 42, width: 80, height: 18, fontSize: 22, color: 'rgba(255, 255, 255, 0.8)', textAlign: 'center' },
      { id: 'ways', type: 'text', content: 'GIVE ONLINE: www.church.org/give', x: 10, y: 64, width: 80, height: 15, fontSize: 24, color: '#22c55e', fontWeight: 700, textAlign: 'center' },
    ];
  }
  if (id === 'benediction') {
    return [
      { id: 'title', type: 'text', content: 'GO IN PEACE & GRACE', x: 10, y: 30, width: 80, height: 25, fontSize: 48, color: '#ffffff', fontWeight: 700, textAlign: 'center' },
      { id: 'sub', type: 'text', content: 'The LORD bless you and keep you', x: 10, y: 58, width: 80, height: 20, fontSize: 26, color: '#f4621f', fontWeight: 700, textAlign: 'center' },
    ];
  }
  return [];
}

function TemplateCardThumb({ id, bg }: { id: string; bg: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = React.useState(210);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setContainerW(w);
    };
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const scale = containerW / 1280;
  const height = Math.max(80, Math.round(containerW * (720 / 1280)));
  const isLowerThird = id === 'lower-third';
  const isTransparent = isLowerThird || bg === 'transparent';
  const elements = getTemplateElements(id);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        aspectRatio: '16 / 9',
        height,
        position: 'relative',
        overflow: 'hidden',
        background: isTransparent
          ? 'repeating-conic-gradient(#262628 0% 25%, #161414 0% 50%) 50% / 14px 14px'
          : bg,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: 1280,
          height: 720,
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
          pointerEvents: 'none',
        }}
      >
        {elements.map((el) => (
          <div
            key={el.id}
            style={{
              position: 'absolute',
              left: `${el.x}%`,
              top: `${el.y}%`,
              width: `${el.width}%`,
              height: `${el.height}%`,
              zIndex: el.zIndex || 1,
            }}
          >
            {el.type === 'text' && (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  color: el.color || '#ffffff',
                  fontFamily: el.fontFamily || 'Inter',
                  fontSize: el.fontSize || 36,
                  fontWeight: el.fontWeight || 500,
                  textAlign: el.textAlign || 'center',
                  lineHeight: el.lineHeight || 1.3,
                  textShadow: el.textShadow || '0 2px 8px rgba(0, 0, 0, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: el.textAlign === 'left' ? 'flex-start' : el.textAlign === 'right' ? 'flex-end' : 'center',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {el.content}
              </div>
            )}
            {el.type === 'shape' && (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: el.backgroundColor || 'rgba(255, 255, 255, 0.1)',
                  borderColor: el.borderColor || 'transparent',
                  borderWidth: el.borderWidth || 0,
                  borderStyle: el.borderWidth ? 'solid' : 'none',
                  borderRadius: el.borderRadius || 0,
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
