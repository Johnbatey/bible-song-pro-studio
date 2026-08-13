import React, { useState, useRef } from 'react';
import { LayerList, type LayerRow } from './LayerList';
import { ShapeInspector } from '../ShapeInspector';
import { SlideTextPanel } from '../SlideTextPanel';
import { CustomDropdown } from '../CustomDropdown';
import { AppleToggle } from '../AppleToggle';
import { slideElementsFor } from '../NativeSlideBoard';
import type { ParsedShape } from '../../slide-engine/parser/slide-parser';
import type { PresentationSlide, SlideElement } from '../../types';

export interface PptxInspector {
  selected: ParsedShape[];
  shapes: ParsedShape[];
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

const FONT_FAMILIES = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Aptos', label: 'Aptos' },
  { value: 'General Sans', label: 'General Sans' },
  { value: 'Outfit', label: 'Outfit' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'SF Pro Display', label: 'SF Pro Display' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Oswald', label: 'Oswald' },
  { value: 'Bebas Neue', label: 'Bebas Neue' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Courier New', label: 'Courier New' },
];

const FONT_WEIGHTS = [
  { value: '100', label: 'Thin (100)' },
  { value: '300', label: 'Light (300)' },
  { value: '400', label: 'Regular (400)' },
  { value: '500', label: 'Medium (500)' },
  { value: '600', label: 'Semi Bold (600)' },
  { value: '700', label: 'Bold (700)' },
  { value: '800', label: 'Extra Bold (800)' },
  { value: '900', label: 'Black (900)' },
];

/* The sizes the app's own templates and defaults actually use — 26, 32, 36,
   48, 54, 64 — were missing from this list, so opening a stock slide showed a
   size the menu could not offer back once you had moved off it. */
const FONT_SIZES = [
  '12', '14', '16', '18', '20', '24', '26', '28', '32', '36', '40', '42',
  '48', '54', '60', '64', '72', '80', '96', '120', '144',
].map((v) => ({ value: v, label: v }));

/**
 * A CSS colour as a `#rrggbb` string, or null if it is not one yet.
 *
 * `<input type="color">` only accepts that exact form — hand it `rgba(255,
 * 255, 255, 0.85)`, which is what the default body element carries, and
 * Chromium silently shows black. Shorthand is expanded; anything else (a named
 * colour, a partly-typed hex) returns null so the caller can decline to commit.
 */
function normalizeHex(value: string | undefined): string | null {
  if (!value) return null;
  const hex = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) return hex.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toLowerCase();
  }
  const rgb = hex.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    const to2 = (n: string) => Math.min(255, parseInt(n, 10)).toString(16).padStart(2, '0');
    return `#${to2(rgb[1])}${to2(rgb[2])}${to2(rgb[3])}`;
  }
  return null;
}

/* Drawn rather than typed. The four horizontal buttons all rendered '≡' bar
   one, so three of them were the same picture and the group looked inert
   whichever you pressed. */
function AlignIcon({ align }: { align: 'left' | 'center' | 'right' | 'justify' }) {
  const rows: Array<[number, number]> = align === 'left'
    ? [[1, 14], [1, 9], [1, 14], [1, 9]]
    : align === 'right'
    ? [[1, 14], [6, 9], [1, 14], [6, 9]]
    : align === 'center'
    ? [[1, 14], [3.5, 9], [1, 14], [3.5, 9]]
    : [[1, 14], [1, 14], [1, 14], [1, 14]];
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      {rows.map(([x, w], i) => (
        <rect key={i} x={x} y={2.5 + i * 3.2} width={w} height="1.6" rx="0.8" fill="currentColor" />
      ))}
    </svg>
  );
}

function VAlignIcon({ vAlign }: { vAlign: 'top' | 'middle' | 'bottom' }) {
  const barY = vAlign === 'top' ? 2 : vAlign === 'bottom' ? 12.4 : 7.2;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1" y={barY} width="14" height="1.6" rx="0.8" fill="currentColor" />
      <rect
        x="4.5"
        y={vAlign === 'top' ? 5.2 : vAlign === 'bottom' ? 5.2 : 2}
        width="7"
        height={vAlign === 'middle' ? 4.4 : 8.4}
        rx="1"
        fill="currentColor"
        opacity="0.45"
      />
      {vAlign === 'middle' && <rect x="4.5" y="9.6" width="7" height="4.4" rx="1" fill="currentColor" opacity="0.45" />}
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
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
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  // Accordion Section Expansion States
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    canvas: true,
    typography: true,
    shape: true,
    effects: true,
    geometry: true,
  });

  const [lockAspect, setLockAspect] = useState(true);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const bgType = slide.background?.type || 'color';
  const bgValue = slide.background?.value || '#18181b';

  /* Through the same helper both canvases render with, so a slide that has
     never been touched still shows its default title and body here — reading
     `slide.elements` straight gave an empty list for exactly those slides, and
     the inspector had nothing to point at. */
  const nativeElements = slideElementsFor(slide);
  const nativeRows = nativeLayerRows(nativeElements, selectedElement?.id || null);

  /**
   * Which element the Typography controls act on.
   *
   * This used to fall through to `elements.find(type === 'text')` whenever the
   * selection was not text, which produced the two complaints this panel
   * earns: select a shape and the font controls silently retype some other
   * block, or — on a slide with no text at all — appear live and do nothing.
   *
   * Now it is one of three states, and the panel says which:
   *   text selected      → edit that element
   *   nothing selected   → edit the slide's first text element, named in the
   *                        header so the operator knows what will change
   *   non-text selected  → null, and Typography does not render at all
   */
  const firstTextElement = nativeElements.find((e) => e.type === 'text') || null;
  const targetTextElement =
    selectedElement
      ? (selectedElement.type === 'text' ? selectedElement : null)
      : firstTextElement;
  const typographyScope = selectedElement
    ? (selectedElement.type === 'text' ? 'selected' : 'unavailable')
    : (firstTextElement ? 'default' : 'unavailable');

  /** Every Typography control writes through here, so none of them can act on
      a target that is not there. */
  const setText = (updates: Partial<SlideElement>) => {
    if (targetTextElement) onUpdateElement(targetTextElement.id, updates);
  };

  /* Free-typed fields — line height, letter spacing, the hex box — need
     somewhere to hold a half-finished value. Without it `parseFloat('1.')` is
     NaN and `#FF55` is not a colour, and committing either on every keystroke
     is what made these three feel like they fought back. The draft is keyed by
     element and field, so changing selection drops it. */
  const [draft, setDraft] = useState<{ key: string; value: string } | null>(null);
  const draftKey = (field: string) => `${targetTextElement?.id || 'none'}:${field}`;
  const fieldValue = (field: string, actual: string | number) =>
    draft && draft.key === draftKey(field) ? draft.value : String(actual);
  const editField = (field: string, value: string, commit: (v: string) => void) => {
    setDraft({ key: draftKey(field), value });
    commit(value);
  };

  function handleNativeReorder(from: number, to: number) {
    const order = [...nativeRows];
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    const zById = new Map(order.map((row, i) => [row.id, order.length - i]));
    onReorderElements(nativeElements.map((el) => ({ ...el, zIndex: zById.get(el.id) ?? el.zIndex })));
  }

  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const val = evt.target?.result as string;
      if (val) {
        onUpdateSlide({ background: { type: 'image', value: val } });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <aside
      style={{
        width: 290,
        minWidth: 290,
        background: '#141416',
        borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      <input
        type="file"
        ref={bgFileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleBgImageUpload}
      />

      {/* Tri-Tab Header */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: '#111010' }}>
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
              borderBottom: activeTab === tab ? '2px solid #FF5500' : '2px solid transparent',
              color: activeTab === tab ? '#ffffff' : 'rgba(255, 255, 255, 0.55)',
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

      {/* Viewport Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }} className="bar-scroll">
        {/* ---- DESIGN TAB ------------------------------------------------- */}
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
            {/* Aspect Ratio & Canvas Section */}
            <div style={styles.sectionCard}>
              <div style={styles.sectionHeader} onClick={() => toggleSection('canvas')}>
                <span style={styles.sectionTitle}>Canvas & Aspect</span>
                <ChevronIcon open={Boolean(openSections.canvas)} />
              </div>

              {openSections.canvas && (
                <div style={styles.sectionBody}>
                  {/* Aspect Ratio Pills */}
                  <div style={styles.propRowCol}>
                    <span style={styles.propLabel}>Aspect Ratio</span>
                    <div style={styles.pillGroup}>
                      {(['16:9', '4:3', 'lower-third'] as const).map((ratio) => (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => onUpdateSlide({ aspectRatio: ratio })}
                          style={{
                            ...styles.pillBtn,
                            background: (slide.aspectRatio || '16:9') === ratio ? '#FF5500' : 'transparent',
                            color: (slide.aspectRatio || '16:9') === ratio ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                          }}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lock Aspect Ratio */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11, color: '#ffffff', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={lockAspect}
                        onChange={(e) => setLockAspect(e.target.checked)}
                        style={{ accentColor: '#FF5500', cursor: 'pointer' }}
                      />
                      Lock aspect ratio
                    </label>
                  </div>

                  {/* Canvas Background Header & Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <span style={styles.propLabel}>Canvas Background</span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSlide({
                          background: {
                            type: 'color',
                            value: bgValue === 'transparent' ? '#18181b' : 'transparent',
                          },
                        })
                      }
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        border: 'none',
                        background: bgValue === 'transparent' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                        color: bgValue === 'transparent' ? '#f87171' : '#4ade80',
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {bgValue === 'transparent' ? 'Background: OFF' : 'Background: ON'}
                    </button>
                  </div>

                  {/* Background Mode Pills */}
                  <div style={styles.pillGroup}>
                    {(['color', 'gradient', 'image', 'none'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() =>
                          onUpdateSlide({
                            background: {
                              type: type === 'none' ? 'color' : type,
                              value:
                                type === 'none'
                                  ? 'transparent'
                                  : type === 'gradient'
                                  ? 'linear-gradient(135deg, #f97316 0%, #7c2d12 100%)'
                                  : type === 'color'
                                  ? bgValue === 'transparent' ? '#18181b' : bgValue
                                  : bgValue || '',
                            },
                          })
                        }
                        style={{
                          ...styles.pillBtn,
                          fontSize: 10,
                          background:
                            (type === 'none' && bgValue === 'transparent') ||
                            (type !== 'none' && bgType === type && bgValue !== 'transparent')
                              ? '#FF5500'
                              : 'transparent',
                          color:
                            (type === 'none' && bgValue === 'transparent') ||
                            (type !== 'none' && bgType === type && bgValue !== 'transparent')
                              ? '#ffffff'
                              : 'rgba(255, 255, 255, 0.7)',
                        }}
                      >
                        {type === 'none' ? 'Off / Trans' : type}
                      </button>
                    ))}
                  </div>

                  {/* Solid Color Picker */}
                  {bgType === 'color' && bgValue !== 'transparent' && (
                    <div style={styles.colorPillRow}>
                      <input
                        type="color"
                        value={bgValue.startsWith('#') ? bgValue : '#18181b'}
                        onChange={(e) => onUpdateSlide({ background: { type: 'color', value: e.target.value } })}
                        style={styles.colorSwatch}
                      />
                      <input
                        type="text"
                        value={bgValue.toUpperCase()}
                        onChange={(e) => onUpdateSlide({ background: { type: 'color', value: e.target.value } })}
                        style={styles.colorHexInput}
                      />
                      <span style={styles.opacityBadge}>100%</span>
                    </div>
                  )}

                  {/* Gradient Presets */}
                  {bgType === 'gradient' && (
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
                            height: 28,
                            background: grad,
                            border: bgValue === grad ? '2px solid #FF5500' : '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: 6,
                            cursor: 'pointer',
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Background Image Upload & Presets */}
                  {bgType === 'image' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => bgFileInputRef.current?.click()}
                        style={{
                          padding: '8px 12px',
                          background: '#202024',
                          border: '1px dashed rgba(255, 255, 255, 0.2)',
                          borderRadius: 6,
                          color: '#ffffff',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                        }}
                      >
                        📁 Choose Image File
                      </button>

                      {bgValue && bgValue.startsWith('data:') && (
                        <div style={{ fontSize: 10, color: '#4ade80', fontWeight: 600, textAlign: 'center' }}>
                          ✓ Custom image loaded
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Typography. Hidden outright when the selection is a shape or an
                image: a control that cannot act on what is selected is worse
                than a control that is not there, because it invites the click
                and then swallows it. */}
            {typographyScope === 'unavailable' ? (
              selectedElement && (
                <div style={styles.sectionCard}>
                  <div style={styles.sectionHeader}>
                    <span style={{ ...styles.sectionTitle, color: 'var(--text-dim)' }}>Typography</span>
                  </div>
                  <div style={{ ...styles.sectionBody, color: 'var(--text-dim)', fontSize: 11 }}>
                    {selectedElement.type === 'shape' ? 'A shape has no type.' : 'An image has no type.'} Select a
                    text block to set its font.
                  </div>
                </div>
              )
            ) : (
            <div style={styles.sectionCard}>
              <div style={styles.sectionHeader} onClick={() => toggleSection('typography')}>
                <span style={styles.sectionTitle}>
                  Typography
                  {typographyScope === 'default' && targetTextElement && (
                    <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>
                      {' '}— {(targetTextElement.content || 'first text block').toString().trim().slice(0, 18) || 'first text block'}
                    </span>
                  )}
                </span>
                <ChevronIcon open={Boolean(openSections.typography)} />
              </div>

              {openSections.typography && (
                <div style={styles.sectionBody}>
                  {/* Font Family Dropdown */}
                  <div style={styles.propRowCol}>
                    <span style={styles.propLabel}>Font</span>
                    <CustomDropdown
                      value={targetTextElement?.fontFamily || 'Inter'}
                      options={FONT_FAMILIES}
                      onChange={(font) => setText({ fontFamily: font })}
                    />
                  </div>

                  {/* Weight & Size Row */}
                  <div style={styles.twoColRow}>
                    <div style={styles.propRowCol}>
                      <span style={styles.propLabel}>Weight</span>
                      <CustomDropdown
                        value={String(targetTextElement?.fontWeight ?? 600)}
                        options={FONT_WEIGHTS}
                        /* As a number: the dropdown hands back a string, and a
                           stored '700' failed the `fontWeight ?? 600` readback
                           comparisons elsewhere that expect the numeric form. */
                        onChange={(wt) => setText({ fontWeight: parseInt(wt, 10) })}
                      />
                    </div>
                    <div style={styles.propRowCol}>
                      <span style={styles.propLabel}>Size</span>
                      <CustomDropdown
                        value={String(targetTextElement?.fontSize ?? 42)}
                        options={FONT_SIZES}
                        onChange={(sz) => setText({ fontSize: parseInt(sz, 10) })}
                      />
                    </div>
                  </div>

                  {/* Line Height & Letter Spacing Row */}
                  <div style={styles.twoColRow}>
                    <div style={styles.propRowCol}>
                      <span style={styles.propLabel}>Line height</span>
                      <div style={styles.iconInputBox}>
                        <span style={styles.iconInputBadge}>⤢</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0.5"
                          max="3"
                          value={fieldValue('lineHeight', targetTextElement?.lineHeight ?? 1.3)}
                          onChange={(e) => editField('lineHeight', e.target.value, (v) => {
                            const n = parseFloat(v);
                            /* An empty box, or a half-typed '1.', parses to NaN
                               — and NaN written into the element takes the text
                               block's layout down with it. Held until the value
                               is a number. */
                            if (Number.isFinite(n) && n >= 0.5 && n <= 3) setText({ lineHeight: n });
                          })}
                          onBlur={() => setDraft(null)}
                          style={styles.iconInput}
                        />
                      </div>
                    </div>
                    <div style={styles.propRowCol}>
                      <span style={styles.propLabel}>Letter spacing</span>
                      <div style={styles.iconInputBox}>
                        <span style={styles.iconInputBadge}>|A|</span>
                        <input
                          type="number"
                          step="1"
                          min="-20"
                          max="80"
                          value={fieldValue('letterSpacing', targetTextElement?.letterSpacing ?? 0)}
                          onChange={(e) => editField('letterSpacing', e.target.value, (v) => {
                            const n = parseFloat(v);
                            if (Number.isFinite(n) && n >= -20 && n <= 80) setText({ letterSpacing: n });
                          })}
                          onBlur={() => setDraft(null)}
                          style={styles.iconInput}
                        />
                        <span style={{ fontSize: 10, color: 'var(--text-dim)', paddingRight: 4 }}>px</span>
                      </div>
                    </div>
                  </div>

                  {/* Color Swatch */}
                  <div style={styles.propRowCol}>
                    <span style={styles.propLabel}>Color</span>
                    <div style={styles.colorPillRow}>
                      <input
                        type="color"
                        value={normalizeHex(targetTextElement?.color) || '#ffffff'}
                        onChange={(e) => {
                          setDraft(null);
                          setText({ color: e.target.value });
                        }}
                        style={styles.colorSwatch}
                      />
                      <input
                        type="text"
                        spellCheck={false}
                        value={fieldValue('color', (targetTextElement?.color || '#FFFFFF').toUpperCase())}
                        onChange={(e) => editField('color', e.target.value, (v) => {
                          /* Six digits exactly while typing. Shorthand is a real
                             colour, so accepting it here meant '#FF5500' flashed
                             yellow on its way past '#FF5' — every prefix of a hex
                             you are half-way through repainting the slide. Blur
                             below still takes shorthand, so '#F50' typed and
                             committed on its own works. */
                          if (/^#[0-9a-f]{6}$/i.test(v.trim())) setText({ color: v.trim().toLowerCase() });
                        })}
                        onBlur={(e) => {
                          const hex = normalizeHex(e.target.value);
                          if (hex) setText({ color: hex });
                          setDraft(null);
                        }}
                        style={styles.colorHexInput}
                      />
                      <span style={styles.opacityBadge}>
                        {Math.round((targetTextElement?.opacity ?? 1) * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Horizontal & Vertical Alignment */}
                  <div style={styles.propRowCol}>
                    <span style={styles.propLabel}>Alignment</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {/* Horizontal Alignment */}
                      <div style={{ ...styles.segmentGroup, flex: 1 }}>
                        {(['left', 'center', 'right', 'justify'] as const).map((align) => {
                          const on = (targetTextElement?.textAlign || 'center') === align;
                          return (
                            <button
                              key={align}
                              type="button"
                              onClick={() => setText({ textAlign: align })}
                              style={{
                                ...styles.segmentBtn,
                                background: on ? '#2c2c30' : 'transparent',
                                color: on ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
                              }}
                              title={`Align ${align}`}
                            >
                              <AlignIcon align={align} />
                            </button>
                          );
                        })}
                      </div>

                      {/* Vertical Alignment */}
                      <div style={{ ...styles.segmentGroup, width: 90 }}>
                        {(['top', 'middle', 'bottom'] as const).map((vAlign) => {
                          const on = (targetTextElement?.vAlign || 'middle') === vAlign;
                          return (
                            <button
                              key={vAlign}
                              type="button"
                              onClick={() => setText({ vAlign })}
                              style={{
                                ...styles.segmentBtn,
                                background: on ? '#2c2c30' : 'transparent',
                                color: on ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
                              }}
                              title={`Vertical ${vAlign}`}
                            >
                              <VAlignIcon vAlign={vAlign} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Decoration & Case (BS, Bs, bs for BibleSong) */}
                  <div style={styles.twoColRow}>
                    {/* Decoration */}
                    <div style={styles.propRowCol}>
                      <span style={styles.propLabel}>Decoration</span>
                      <div style={styles.segmentGroup}>
                        {(['none', 'underline', 'line-through'] as const).map((deco) => {
                          const on = (targetTextElement?.textDecoration || 'none') === deco;
                          return (
                            <button
                              key={deco}
                              type="button"
                              onClick={() => setText({ textDecoration: deco })}
                              style={{
                                ...styles.segmentBtn,
                                background: on ? '#2c2c30' : 'transparent',
                                color: on ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
                                textDecoration: deco === 'none' ? undefined : deco,
                              }}
                              title={deco === 'none' ? 'No decoration' : deco === 'underline' ? 'Underline' : 'Strikethrough'}
                            >
                              {deco === 'none' ? '―' : deco === 'underline' ? 'U' : 'S'}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Case (BS, Bs, bs for BibleSong) */}
                    <div style={styles.propRowCol}>
                      <span style={styles.propLabel}>Case</span>
                      <div style={styles.segmentGroup}>
                        {(['none', 'uppercase', 'capitalize', 'lowercase'] as const).map((tc) => {
                          const on = (targetTextElement?.textTransform || 'none') === tc;
                          return (
                            <button
                              key={tc}
                              type="button"
                              onClick={() => setText({ textTransform: tc })}
                              style={{
                                ...styles.segmentBtn,
                                background: on ? '#2c2c30' : 'transparent',
                                color: on ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
                                fontWeight: tc === 'uppercase' ? 700 : 500,
                              }}
                              title={`Case: ${tc}`}
                            >
                              {tc === 'none' ? '―' : tc === 'uppercase' ? 'BS' : tc === 'capitalize' ? 'Bs' : 'bs'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Shape Style & Border Section */}
            {selectedElement && (selectedElement.type === 'shape' || selectedElement.type === 'image') && (
              <div style={styles.sectionCard}>
                <div style={styles.sectionHeader} onClick={() => toggleSection('shape')}>
                  <span style={styles.sectionTitle}>Shape & Border</span>
                  <ChevronIcon open={Boolean(openSections.shape)} />
                </div>

                {openSections.shape && (
                  <div style={styles.sectionBody}>
                    {/* Border Radius Slider */}
                    <div style={styles.propRowCol}>
                      <span style={styles.propLabel}>Corner Radius ({selectedElement.borderRadius || 0}px)</span>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={selectedElement.borderRadius || 0}
                        onChange={(e) => onUpdateElement(selectedElement.id, { borderRadius: parseInt(e.target.value, 10) })}
                        style={{ accentColor: '#FF5500' }}
                      />
                    </div>

                    {/* Fill Color */}
                    {selectedElement.type === 'shape' && (
                      <div style={styles.propRowCol}>
                        <span style={styles.propLabel}>Fill Color</span>
                        <div style={styles.colorPillRow}>
                          <input
                            type="color"
                            value={selectedElement.backgroundColor?.startsWith('#') ? selectedElement.backgroundColor : '#FF5500'}
                            onChange={(e) => onUpdateElement(selectedElement.id, { backgroundColor: e.target.value })}
                            style={styles.colorSwatch}
                          />
                          <input
                            type="text"
                            value={(selectedElement.backgroundColor || '#FF5500').toUpperCase()}
                            onChange={(e) => onUpdateElement(selectedElement.id, { backgroundColor: e.target.value })}
                            style={styles.colorHexInput}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Geometry & Position Section */}
            {selectedElement && (
              <div style={styles.sectionCard}>
                <div style={styles.sectionHeader} onClick={() => toggleSection('geometry')}>
                  <span style={styles.sectionTitle}>Geometry & Transform</span>
                  <ChevronIcon open={Boolean(openSections.geometry)} />
                </div>

                {openSections.geometry && (
                  <div style={styles.sectionBody}>
                    <div style={styles.twoColRow}>
                      <div style={styles.propRowCol}>
                        <span style={styles.propLabel}>X Position (%)</span>
                        <input
                          type="number"
                          value={selectedElement.x}
                          onChange={(e) => onUpdateElement(selectedElement.id, { x: parseFloat(e.target.value) })}
                          style={styles.numberInput}
                        />
                      </div>
                      <div style={styles.propRowCol}>
                        <span style={styles.propLabel}>Y Position (%)</span>
                        <input
                          type="number"
                          value={selectedElement.y}
                          onChange={(e) => onUpdateElement(selectedElement.id, { y: parseFloat(e.target.value) })}
                          style={styles.numberInput}
                        />
                      </div>
                    </div>

                    <div style={styles.twoColRow}>
                      <div style={styles.propRowCol}>
                        <span style={styles.propLabel}>Width (%)</span>
                        <input
                          type="number"
                          value={selectedElement.width}
                          onChange={(e) => onUpdateElement(selectedElement.id, { width: parseFloat(e.target.value) })}
                          style={styles.numberInput}
                        />
                      </div>
                      <div style={styles.propRowCol}>
                        <span style={styles.propLabel}>Height (%)</span>
                        <input
                          type="number"
                          value={selectedElement.height}
                          onChange={(e) => onUpdateElement(selectedElement.id, { height: parseFloat(e.target.value) })}
                          style={styles.numberInput}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ---- LAYER TAB -------------------------------------------------- */}
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
                >
                  Group
                </button>
                <button
                  type="button"
                  onClick={pptx.onUngroup}
                  disabled={!pptx.canUngroup}
                  style={groupButtonStyle(pptx.canUngroup)}
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

        {/* ---- AI STUDIO TAB ---------------------------------------------- */}
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
                background: '#FF5500',
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

const styles: Record<string, React.CSSProperties> = {
  sectionCard: {
    background: '#1a1a1e',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  sectionHeader: {
    padding: '10px 12px',
    background: '#1d1d22',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    userSelect: 'none',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#ffffff',
  },
  sectionBody: {
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  propRowCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  propLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  twoColRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  pillGroup: {
    display: 'flex',
    gap: 4,
    background: '#141416',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    padding: 3,
  },
  pillBtn: {
    flex: 1,
    padding: '5px 4px',
    border: 'none',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  },
  colorPillRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#141416',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    padding: '4px 8px',
    height: 32,
    boxSizing: 'border-box',
  },
  colorSwatch: {
    width: 20,
    height: 20,
    padding: 0,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    borderRadius: 3,
  },
  colorHexInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 600,
    outline: 'none',
  },
  opacityBadge: {
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.45)',
  },
  iconInputBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: '#141416',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    padding: '0 8px',
    height: 32,
  },
  iconInputBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  iconInput: {
    flex: 1,
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: '#ffffff',
    fontSize: 12,
    outline: 'none',
  },
  segmentGroup: {
    display: 'flex',
    background: '#141416',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    padding: 2,
  },
  segmentBtn: {
    flex: 1,
    height: 26,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  },
  numberInput: {
    background: '#141416',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    color: '#ffffff',
    padding: '6px 8px',
    fontSize: 12,
    outline: 'none',
  },
};
