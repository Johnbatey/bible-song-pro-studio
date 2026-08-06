import React, { useState } from 'react';
import { LayerList, type LayerRow } from './LayerList';
import { ShapeInspector } from '../ShapeInspector';
import { SlideTextPanel } from '../SlideTextPanel';
import type { ParsedShape } from '../../slide-engine/parser/slide-parser';
import type { PresentationSlide, SlideElement } from '../../types';

/**
 * Everything the inspector needs to act on an imported PowerPoint slide.
 *
 * Present only for a PowerPoint deck. The engine behind it edits parsed OOXML
 * records rather than the native element model, so the Design and Layer tabs
 * swap their contents wholesale rather than trying to drive both through one
 * set of controls that would fit neither.
 */
export interface PptxInspector {
  selected: ParsedShape[];
  /** Every text box on the slide, for the fields under the Design tab. */
  shapes: ParsedShape[];
  /** The slide's stack, topmost first. */
  layers: LayerRow[];
  onSelectLayer: (id: string, additive: boolean) => void;
  onReorderLayer: (from: number, to: number) => void;
  onDeleteLayer: (id: string) => void;
  onFill: (hex: string) => void;
  onStroke: (hex: string, widthPx?: number | null) => void;
  onTextColor: (hex: string) => void;
  onReorder: (toFront: boolean) => void;
  onDelete: () => void;
  onEditText: (shape: ParsedShape, value: string) => void;
  onGroup: () => void;
  onUngroup: () => void;
  canGroup: boolean;
  canUngroup: boolean;
}

interface SlideEditorRightSidebarProps {
  slide: PresentationSlide;
  selectedElement: SlideElement | null;
  onUpdateSlide: (updates: Partial<PresentationSlide>) => void;
  onUpdateElement: (id: string, updates: Partial<SlideElement>) => void;
  onDeleteElement: (id: string) => void;
  onSelectElement: (id: string | null) => void;
  onReorderElements: (elements: SlideElement[]) => void;
  pptx?: PptxInspector | null;
}

/** Topmost first, which is how a layer panel reads. */
function nativeLayerRows(elements: SlideElement[], selectedId: string | null): LayerRow[] {
  return [...elements]
    .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
    .map((el) => ({
      id: el.id,
      label: (el.content || '').trim().slice(0, 34) || el.type,
      kind: el.type === 'text' ? 'text' : el.type === 'image' ? 'image' : 'shape',
      selected: el.id === selectedId,
    }));
}

export function SlideEditorRightSidebar({
  slide,
  selectedElement,
  onUpdateSlide,
  onUpdateElement,
  onDeleteElement,
  onSelectElement,
  onReorderElements,
  pptx = null,
}: SlideEditorRightSidebarProps) {
  const [activeTab, setActiveTab] = useState<'design' | 'layer' | 'ai'>('design');

  const bgType = slide.background?.type || 'color';
  const bgValue = slide.background?.value || '#18181b';

  const nativeElements = slide.elements || [];
  const nativeRows = nativeLayerRows(nativeElements, selectedElement?.id || null);

  /* Rows come in topmost-first; z-index counts the other way. Reassigning the
     whole run rather than nudging one value keeps the stack free of ties,
     which is what makes a second drag land where it looks like it should. */
  function handleNativeReorder(from: number, to: number) {
    const order = [...nativeRows];
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    const zById = new Map(order.map((row, i) => [row.id, order.length - i]));
    onReorderElements(nativeElements.map((el) => ({ ...el, zIndex: zById.get(el.id) ?? el.zIndex })));
  }

  return (
    <aside
      style={{
        width: 280,
        minWidth: 280,
        background: 'var(--bg-surface, #161414)',
        borderLeft: '1px solid var(--block-line, #262628)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      {/* Inspector Tri-Tab Header */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--block-line, #262628)', background: 'var(--bg-primary, #111010)' }}>
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
        {/* ---- Design ------------------------------------------------- */}
        {activeTab === 'design' && pptx && (
          <>
            <ShapeInspector
              selected={pptx.selected}
              onFill={pptx.onFill}
              onStroke={pptx.onStroke}
              onTextColor={pptx.onTextColor}
              onReorder={pptx.onReorder}
              onDelete={pptx.onDelete}
            />
            <SlideTextPanel shapes={pptx.shapes} onEdit={pptx.onEditText} />
          </>
        )}

        {activeTab === 'design' && !pptx && (
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

        {/* ---- Layer -------------------------------------------------- */}
        {activeTab === 'layer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.65)', textTransform: 'uppercase' }}>
              Layers — top first
            </span>

            {pptx && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={pptx.onGroup}
                  disabled={!pptx.canGroup}
                  style={groupButtonStyle(pptx.canGroup)}
                  title="Group the selection so it moves and restyles as one"
                >
                  Group
                </button>
                <button
                  type="button"
                  onClick={pptx.onUngroup}
                  disabled={!pptx.canUngroup}
                  style={groupButtonStyle(pptx.canUngroup)}
                  title="Break the group so each piece can be edited on its own"
                >
                  Ungroup
                </button>
              </div>
            )}

            {pptx ? (
              <LayerList
                rows={pptx.layers}
                onSelect={pptx.onSelectLayer}
                onReorder={pptx.onReorderLayer}
                onDelete={pptx.onDeleteLayer}
                emptyHint="This slide's artwork all comes from its layout, so there is nothing on the slide itself to restack."
              />
            ) : (
              <LayerList
                rows={nativeRows}
                onSelect={(id) => onSelectElement(id)}
                onReorder={handleNativeReorder}
                onDelete={onDeleteElement}
                emptyHint="This slide has no elements yet. Add a text box or a shape from the toolbar."
              />
            )}
          </div>
        )}

        {/* ---- AI Studio ---------------------------------------------- */}
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

function groupButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    height: 28,
    background: '#1c2029',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 5,
    color: enabled ? '#fff' : 'rgba(255,255,255,0.3)',
    fontSize: 11,
    cursor: enabled ? 'pointer' : 'default',
  };
}
