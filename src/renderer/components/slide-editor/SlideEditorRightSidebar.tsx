import React, { useState } from 'react';
import type { PresentationSlide, SlideElement } from '../../types';

interface SlideEditorRightSidebarProps {
  slide: PresentationSlide;
  selectedElement: SlideElement | null;
  onUpdateSlide: (updates: Partial<PresentationSlide>) => void;
  onUpdateElement: (id: string, updates: Partial<SlideElement>) => void;
  onDeleteElement: (id: string) => void;
}

export function SlideEditorRightSidebar({
  slide,
  selectedElement,
  onUpdateSlide,
  onUpdateElement,
  onDeleteElement,
}: SlideEditorRightSidebarProps) {
  const [activeTab, setActiveTab] = useState<'design' | 'layer' | 'ai'>('design');

  const bgType = slide.background?.type || 'color';
  const bgValue = slide.background?.value || '#18181b';

  return (
    <aside
      style={{
        width: 280,
        minWidth: 280,
        background: '#15171d',
        borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      {/* Inspector Tri-Tab Header */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: '#111318' }}>
        {(['design', 'layer', 'ai'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '10px 8px',
              background: activeTab === tab ? '#1c1e26' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #f4621f' : '2px solid transparent',
              color: activeTab === tab ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {tab === 'ai' ? 'AI Studio' : tab}
          </button>
        ))}
      </div>

      {/* Inspector Viewport Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {activeTab === 'design' && (
          <>
            {/* Aspect Ratio */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.65)', textTransform: 'uppercase' }}>
                Aspect Ratio
              </label>
              <div style={{ display: 'flex', gap: 4, background: 'rgba(0, 0, 0, 0.3)', padding: 3, borderRadius: 6 }}>
                {(['16:9', '4:3', 'lower-third'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => onUpdateSlide({ aspectRatio: ratio })}
                    style={{
                      flex: 1,
                      padding: '5px 6px',
                      background: (slide.aspectRatio || '16:9') === ratio ? '#f4621f' : 'transparent',
                      border: 'none',
                      borderRadius: 4,
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            {/* Background Style */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.65)', textTransform: 'uppercase' }}>
                Canvas Background
              </label>
              <div style={{ display: 'flex', gap: 4, background: 'rgba(0, 0, 0, 0.3)', padding: 3, borderRadius: 6 }}>
                {(['color', 'gradient', 'image'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      onUpdateSlide({
                        background: {
                          type,
                          value:
                            type === 'gradient'
                              ? 'linear-gradient(135deg, #f97316 0%, #7c2d12 100%)'
                              : type === 'color'
                              ? '#18181b'
                              : '',
                        },
                      })
                    }
                    style={{
                      flex: 1,
                      padding: '5px 6px',
                      background: bgType === type ? '#f4621f' : 'transparent',
                      border: 'none',
                      borderRadius: 4,
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Background Details */}
            {bgType === 'color' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.6)' }}>Solid Color</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={bgValue.startsWith('#') ? bgValue : '#18181b'}
                    onChange={(e) => onUpdateSlide({ background: { type: 'color', value: e.target.value } })}
                    style={{ width: 36, height: 32, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={bgValue}
                    onChange={(e) => onUpdateSlide({ background: { type: 'color', value: e.target.value } })}
                    style={{
                      flex: 1,
                      background: '#1c1e26',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 6,
                      color: '#ffffff',
                      padding: '6px 8px',
                      fontSize: 12,
                    }}
                  />
                </div>
              </div>
            )}

            {bgType === 'gradient' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.6)' }}>Preset Gradient</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {[
                    'linear-gradient(135deg, #f97316 0%, #7c2d12 100%)',
                    'linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%)',
                    'linear-gradient(135deg, #10b981 0%, #064e3b 100%)',
                    'linear-gradient(135deg, #8b5cf6 0%, #4c1d95 100%)',
                    'linear-gradient(135deg, #ec4899 0%, #831843 100%)',
                    'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
                  ].map((grad, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onUpdateSlide({ background: { type: 'gradient', value: grad } })}
                      style={{
                        height: 32,
                        background: grad,
                        border: bgValue === grad ? '2px solid #f4621f' : '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 6,
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Element Properties */}
            {selectedElement && selectedElement.type === 'text' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.65)', textTransform: 'uppercase' }}>
                  Typography
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.6)' }}>Font Size</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="range"
                      min="16"
                      max="120"
                      value={selectedElement.fontSize || 36}
                      onChange={(e) => onUpdateElement(selectedElement.id, { fontSize: parseInt(e.target.value, 10) })}
                      style={{ flex: 1, accentColor: '#f4621f' }}
                    />
                    <span style={{ fontSize: 12, color: '#ffffff', fontWeight: 700, width: 32 }}>
                      {selectedElement.fontSize || 36}px
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.6)' }}>Text Color</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="color"
                      value={selectedElement.color?.startsWith('#') ? selectedElement.color : '#ffffff'}
                      onChange={(e) => onUpdateElement(selectedElement.id, { color: e.target.value })}
                      style={{ width: 36, height: 32, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={selectedElement.color || '#ffffff'}
                      onChange={(e) => onUpdateElement(selectedElement.id, { color: e.target.value })}
                      style={{
                        flex: 1,
                        background: '#1c1e26',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 6,
                        color: '#ffffff',
                        padding: '6px 8px',
                        fontSize: 12,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'layer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.65)', textTransform: 'uppercase' }}>
              Layer Inspector
            </span>

            {selectedElement ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, color: '#ffffff', fontWeight: 600 }}>
                  Selected Element: <span style={{ color: '#f4621f' }}>{selectedElement.id}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteElement(selectedElement.id)}
                  style={{
                    padding: '8px 12px',
                    background: '#ff453a',
                    border: 'none',
                    borderRadius: 6,
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Delete Selected Element
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center', marginTop: 20 }}>
                Select an element on the canvas to inspect its layer hierarchy.
              </div>
            )}
          </div>
        )}

        {activeTab === 'ai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.65)', textTransform: 'uppercase' }}>
              AI Studio Generator
            </span>
            <textarea
              placeholder="Describe the slide theme or sermon content..."
              style={{
                height: 80,
                background: '#1c1e26',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 6,
                color: '#ffffff',
                padding: 8,
                fontSize: 12,
                resize: 'none',
              }}
            />
            <button
              type="button"
              style={{
                padding: '8px 12px',
                background: '#f4621f',
                border: 'none',
                borderRadius: 6,
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Generate AI Slide
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
