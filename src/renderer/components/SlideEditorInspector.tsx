import React, { useState } from 'react';
import type { PresentationSlide, SlideElement } from '../types';

interface SlideEditorInspectorProps {
  slide: PresentationSlide;
  selectedElement: SlideElement | null;
  onUpdateSlide: (updates: Partial<PresentationSlide>) => void;
  onUpdateElement: (id: string, updates: Partial<SlideElement>) => void;
  onDeleteElement: (id: string) => void;
}

export function SlideEditorInspector({
  slide,
  selectedElement,
  onUpdateSlide,
  onUpdateElement,
  onDeleteElement,
}: SlideEditorInspectorProps) {
  const [activeTab, setActiveTab] = useState<'slide' | 'element'>('slide');

  const bgType = slide.background?.type || 'color';
  const bgValue = slide.background?.value || '#18181b';

  return (
    <div
      style={{
        width: 280,
        minWidth: 280,
        background: '#161414',
        borderLeft: '1px solid #262628',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        userSelect: 'none',
      }}
    >
      {/* Inspector Tabs Header */}
      <div style={{ display: 'flex', borderBottom: '1px solid #262628', background: '#141416' }}>
        <button
          type="button"
          onClick={() => setActiveTab('slide')}
          style={{
            flex: 1,
            padding: '10px 14px',
            background: activeTab === 'slide' ? '#232221' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'slide' ? '2px solid #FF5500' : 'none',
            color: activeTab === 'slide' ? '#ffffff' : '#a1a1aa',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Slide Settings
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('element')}
          style={{
            flex: 1,
            padding: '10px 14px',
            background: activeTab === 'element' ? '#232221' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'element' ? '2px solid #FF5500' : 'none',
            color: activeTab === 'element' ? '#ffffff' : '#a1a1aa',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Element Properties
        </button>
      </div>

      {/* Inspector Content Viewport */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {activeTab === 'slide' ? (
          /* Slide Properties Section */
          <>
            {/* Aspect Ratio */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase' }}>
                Aspect Ratio
              </label>
              <div style={{ display: 'flex', gap: 4, background: '#232221', padding: 3, borderRadius: 6 }}>
                {(['16:9', '4:3', 'lower-third'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => onUpdateSlide({ aspectRatio: ratio })}
                    style={{
                      flex: 1,
                      padding: '4px 6px',
                      background: (slide.aspectRatio || '16:9') === ratio ? '#FF5500' : 'transparent',
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

            {/* Background Fill Type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase' }}>
                Background Style
              </label>
              <div style={{ display: 'flex', gap: 4, background: '#232221', padding: 3, borderRadius: 6 }}>
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
                      padding: '4px 6px',
                      background: bgType === type ? '#FF5500' : 'transparent',
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

            {/* Background Value Inputs */}
            {bgType === 'color' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, color: '#a1a1aa' }}>Solid Color</label>
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
                      background: '#232221',
                      border: '1px solid #262628',
                      borderRadius: 4,
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
                <label style={{ fontSize: 11, color: '#a1a1aa' }}>Preset Gradient</label>
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
                        border: bgValue === grad ? '2px solid #FF5500' : '1px solid #262628',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {bgType === 'image' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, color: '#a1a1aa' }}>Image URL</label>
                <input
                  type="text"
                  value={bgValue}
                  placeholder="https://example.com/image.jpg"
                  onChange={(e) => onUpdateSlide({ background: { type: 'image', value: e.target.value } })}
                  style={{
                    background: '#232221',
                    border: '1px solid #262628',
                    borderRadius: 4,
                    color: '#ffffff',
                    padding: '6px 8px',
                    fontSize: 12,
                  }}
                />
              </div>
            )}

            {/* Slide Transition Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase' }}>
                Transition Effect
              </label>
              <select
                value={slide.transition || 'fade'}
                onChange={(e) => onUpdateSlide({ transition: e.target.value as any })}
                style={{
                  background: '#232221',
                  border: '1px solid #262628',
                  borderRadius: 6,
                  color: '#ffffff',
                  padding: '8px 10px',
                  fontSize: 12,
                  outline: 'none',
                }}
              >
                <option value="fade">Fade</option>
                <option value="cut">Cut</option>
                <option value="crossfade">Crossfade</option>
                <option value="slide-left">Slide Left</option>
                <option value="slide-right">Slide Right</option>
                <option value="zoom-in">Zoom In</option>
              </select>
            </div>
          </>
        ) : (
          /* Element Properties Section */
          selectedElement ? (
            <>
              {/* Typography Properties for Text Elements */}
              {selectedElement.type === 'text' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase' }}>
                      Font Size
                    </label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="range"
                        min="16"
                        max="120"
                        value={selectedElement.fontSize || 36}
                        onChange={(e) => onUpdateElement(selectedElement.id, { fontSize: parseInt(e.target.value, 10) })}
                        style={{ flex: 1, accentColor: '#FF5500' }}
                      />
                      <span style={{ fontSize: 12, color: '#ffffff', fontWeight: 700, width: 30 }}>
                        {selectedElement.fontSize || 36}px
                      </span>
                    </div>
                  </div>

                  {/* Text Color */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase' }}>
                      Text Color
                    </label>
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
                          background: '#232221',
                          border: '1px solid #262628',
                          borderRadius: 4,
                          color: '#ffffff',
                          padding: '6px 8px',
                          fontSize: 12,
                        }}
                      />
                    </div>
                  </div>

                  {/* Text Alignment */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase' }}>
                      Alignment
                    </label>
                    <div style={{ display: 'flex', gap: 4, background: '#232221', padding: 3, borderRadius: 6 }}>
                      {(['left', 'center', 'right', 'justify'] as const).map((align) => (
                        <button
                          key={align}
                          type="button"
                          onClick={() => onUpdateElement(selectedElement.id, { textAlign: align })}
                          style={{
                            flex: 1,
                            padding: '4px 6px',
                            background: (selectedElement.textAlign || 'center') === align ? '#FF5500' : 'transparent',
                            border: 'none',
                            borderRadius: 4,
                            color: '#ffffff',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                          }}
                        >
                          {align[0].toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Layer Actions */}
              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => onDeleteElement(selectedElement.id)}
                  style={{
                    padding: '8px 12px',
                    background: '#ef4444',
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
            </>
          ) : (
            <div style={{ fontSize: 12, color: '#a1a1aa', textAlign: 'center', marginTop: 40 }}>
              Select an element on the canvas to inspect its properties.
            </div>
          )
        )}
      </div>
    </div>
  );
}
