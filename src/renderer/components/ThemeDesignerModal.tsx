import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { CustomDropdown } from './CustomDropdown';

export function ThemeDesignerModal() {
  const isThemeDesignerOpen = useAppStore((s) => s.isThemeDesignerOpen);
  const closeThemeDesigner = useAppStore((s) => s.closeThemeDesigner);
  const activeTheme = useAppStore((s) => s.activeTheme);
  const updateTheme = useAppStore((s) => s.updateTheme);
  const themes = useAppStore((s) => s.themes);
  const setActiveTheme = useAppStore((s) => s.setActiveTheme);

  const [categoryTab, setCategoryTab] = useState<'scriptures' | 'slides'>('scriptures');
  const [selectedElement, setSelectedElement] = useState<'scripture' | 'reference' | 'background'>('scripture');
  const [zoomLevel, setZoomLevel] = useState(100);

  // Active theme properties
  const [fontFamily, setFontFamily] = useState(activeTheme?.fullScreen.fontFamily || 'Aptos');
  const [fontWeight, setFontWeight] = useState(activeTheme?.fullScreen.fontWeight || 700);
  const [fontSize, setFontSize] = useState(activeTheme?.fullScreen.fontSize || 64);
  const [lineHeight, setLineHeight] = useState(activeTheme?.fullScreen.lineHeight || 1.18);
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [fontColor, setFontColor] = useState(activeTheme?.fullScreen.fontColor || '#FFF7ED');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right' | 'justify'>(activeTheme?.fullScreen.textAlign || 'center');
  const [vAlign, setVAlign] = useState<'top' | 'middle' | 'bottom'>('middle');
  const [posX, setPosX] = useState(168);
  const [posY, setPosY] = useState(360);
  const [dimW, setDimW] = useState(1583);
  const [dimH, setDimH] = useState(320);
  const [refGap, setRefGap] = useState(44);
  const [lockAspect, setLockAspect] = useState(true);
  const [textCase, setTextCase] = useState<'none' | 'uppercase' | 'capitalize' | 'lowercase'>('none');
  const [textDecoration, setTextDecoration] = useState<'none' | 'underline' | 'line-through'>('none');

  if (!isThemeDesignerOpen) return null;

  function handleSave() {
    if (activeTheme) {
      updateTheme(activeTheme.id, {
        fullScreen: {
          ...activeTheme.fullScreen,
          fontFamily,
          fontWeight,
          fontSize,
          lineHeight,
          fontColor,
          textAlign: textAlign === 'justify' ? 'center' : textAlign,
        },
      });
    }
    closeThemeDesigner();
  }

  return (
    <div style={styles.overlay}>
      {/* Top Header Bar */}
      <header style={styles.header}>
        <div style={styles.headerTitle}>Theme Designer</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button style={styles.saveBtn} onClick={handleSave}>
            Save changes
          </button>
          <button style={styles.closeBtn} onClick={closeThemeDesigner} title="Close Theme Designer">
            ✕ Close
          </button>
        </div>
      </header>

      {/* Main 3-Column Workspace */}
      <div style={styles.workspace}>
        {/* Left Column: Preset Templates */}
        <div style={styles.leftCol}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <button style={styles.toolBtn}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>New</span>
            </button>
            <button style={styles.toolBtn}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Import</span>
            </button>
            <button style={styles.toolBtn}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span>Export</span>
            </button>
          </div>

          <div style={styles.sectionLabel}>ALL THEMES ({themes.length || 3})</div>

          <div style={styles.searchBox}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input placeholder="Search themes" style={styles.searchInput} />
          </div>

          <div style={styles.pillGroup}>
            <button
              style={{
                ...styles.pillBtn,
                background: categoryTab === 'scriptures' ? '#FF5500' : 'transparent',
                color: categoryTab === 'scriptures' ? '#ffffff' : '#a1a1aa',
              }}
              onClick={() => setCategoryTab('scriptures')}
            >
              Scriptures
            </button>
            <button
              style={{
                ...styles.pillBtn,
                background: categoryTab === 'slides' ? '#FF5500' : 'transparent',
                color: categoryTab === 'slides' ? '#ffffff' : '#a1a1aa',
              }}
              onClick={() => setCategoryTab('slides')}
            >
              Slides
            </button>
          </div>

          {/* Theme Preset Cards */}
          <div style={styles.presetList}>
            <div
              style={{
                ...styles.presetCard,
                border: activeTheme?.id === 'selah' || !activeTheme ? '1px solid #FF5500' : '1px solid rgba(255, 255, 255, 0.08)',
              }}
              onClick={() => setActiveTheme(themes[0] || null)}
            >
              <div style={styles.selahThumb}>
                <div style={styles.selahRef}>Genesis 1:1 (NKJV)</div>
                <div style={styles.selahText}>In the beginning God created the heaven and the earth</div>
              </div>
              <div style={styles.cardFooter}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Selah</span>
                <span style={styles.tagMain}>Main</span>
              </div>
            </div>

            <div
              style={{
                ...styles.presetCard,
                border: activeTheme?.id === 'eden' ? '1px solid #FF5500' : '1px solid rgba(255, 255, 255, 0.08)',
              }}
              onClick={() => setActiveTheme(themes[1] || null)}
            >
              <div style={styles.edenThumb}>
                <div style={styles.edenText}>In the beginning God created the heaven and the earth</div>
                <div style={styles.edenRef}>Genesis 1:1 (NKJV)</div>
              </div>
              <div style={styles.cardFooter}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Eden</span>
              </div>
            </div>

            <div
              style={{
                ...styles.presetCard,
                border: activeTheme?.id === 'lt' ? '1px solid #FF5500' : '1px solid rgba(255, 255, 255, 0.08)',
              }}
              onClick={() => setActiveTheme(themes[2] || null)}
            >
              <div style={styles.ltThumb}>
                <div style={styles.ltBox}>
                  <div style={styles.ltRef}>GENESIS 1:1 (NKJV)</div>
                  <div style={styles.ltText}>IN THE BEGINNING GOD CREATED THE HEAVEN AND THE EARTH</div>
                </div>
              </div>
              <div style={styles.cardFooter}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Lower Third</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center Column: Interactive Canvas & Floating Toolbar */}
        <div style={styles.centerCol}>
          {/* Top Floating Add-Content Toolbar */}
          <div style={styles.floatingToolbarContainer}>
            <div style={styles.toolbarLabel}>Add content</div>
            <div style={styles.floatingToolbar}>
              <button style={styles.addBtn}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
                <span>Text</span>
              </button>
              <button style={{ ...styles.addBtn, background: 'rgba(255, 255, 255, 0.08)', borderRadius: 6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                <span>Scripture</span>
              </button>
              <button style={styles.addBtn}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                <span>Shape ∨</span>
              </button>
              <button style={styles.addBtn}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>Image ∨</span>
              </button>
            </div>
          </div>

          {/* Canvas Viewport Stage */}
          <div style={styles.canvasContainer}>
            <div
              style={{
                ...styles.canvasStage,
                transform: `scale(${zoomLevel / 100})`,
                fontFamily: fontFamily,
              }}
            >
              {/* Group Reference Badge Top Right */}
              <div style={styles.groupRefBadge}>Group reference</div>

              {/* Selected Bounding Box Container */}
              <div
                style={{
                  ...styles.boundingBox,
                  border: selectedElement === 'scripture' ? '1px solid #FF5500' : '1px solid transparent',
                }}
                onClick={() => setSelectedElement('scripture')}
              >
                <div style={{ fontSize: Math.round(fontSize * 0.4), color: '#eab308', marginBottom: refGap / 4, textAlign: 'center', fontWeight: 600 }}>
                  Genesis 1:1 (NKJV)
                </div>
                <div
                  style={{
                    fontSize: Math.round(fontSize * 0.7),
                    fontWeight: fontWeight,
                    color: fontColor,
                    lineHeight: lineHeight,
                    textAlign: textAlign === 'justify' ? 'center' : textAlign,
                    textTransform: textCase === 'uppercase' ? 'uppercase' : textCase === 'lowercase' ? 'lowercase' : textCase === 'capitalize' ? 'capitalize' : 'none',
                    textDecoration: textDecoration,
                  }}
                >
                  In the beginning God created the heaven and the earth
                </div>

                {/* 8 Bounding Box Resizing Handles matching the reference design */}
                {selectedElement === 'scripture' && (
                  <>
                    <div style={{ ...styles.handle, top: -4, left: -4 }} />
                    <div style={{ ...styles.handle, top: -4, left: '50%', transform: 'translateX(-50%)' }} />
                    <div style={{ ...styles.handle, top: -4, right: -4 }} />
                    <div style={{ ...styles.handle, top: '50%', left: -4, transform: 'translateY(-50%)' }} />
                    <div style={{ ...styles.handle, top: '50%', right: -4, transform: 'translateY(-50%)' }} />
                    <div style={{ ...styles.handle, bottom: -4, left: -4 }} />
                    <div style={{ ...styles.handle, bottom: -4, left: '50%', transform: 'translateX(-50%)' }} />
                    <div style={{ ...styles.handle, bottom: -4, right: -4 }} />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Zoom Controls */}
          <div style={styles.zoomBar}>
            <button style={styles.zoomBtn} onClick={() => setZoomLevel(Math.max(40, zoomLevel - 10))}>-</button>
            <input
              type="range"
              min="40"
              max="150"
              value={zoomLevel}
              onChange={(e) => setZoomLevel(Number(e.target.value))}
              style={{ width: 100, accentColor: '#FF5500' }}
            />
            <button style={styles.zoomBtn} onClick={() => setZoomLevel(Math.min(150, zoomLevel + 10))}>+</button>
            <span style={{ fontSize: 11, color: '#a1a1aa' }}>{zoomLevel}%</span>
          </div>
        </div>

        {/* Right Column: Properties & Inspector */}
        <div style={styles.rightCol}>
          <div style={styles.inspectorHeader}>
            <span>Verse</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </div>

          <div style={styles.inspectorBody}>
            {/* Accordion 1: Layout */}
            <div style={styles.accSection}>
              <div style={styles.accTitle}>
                <span>Layout</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={styles.propLabel}>Alignment</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <div style={styles.alignGroup}>
                    <button style={{ ...styles.alignIconBtn, background: textAlign === 'left' ? '#FF5500' : 'transparent' }} onClick={() => setTextAlign('left')}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
                    </button>
                    <button style={{ ...styles.alignIconBtn, background: textAlign === 'center' ? '#FF5500' : 'transparent' }} onClick={() => setTextAlign('center')}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>
                    </button>
                    <button style={{ ...styles.alignIconBtn, background: textAlign === 'right' ? '#FF5500' : 'transparent' }} onClick={() => setTextAlign('right')}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>
                    </button>
                  </div>
                  <div style={styles.alignGroup}>
                    <button style={{ ...styles.alignIconBtn, background: vAlign === 'top' ? '#FF5500' : 'transparent' }} onClick={() => setVAlign('top')}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><rect x="7" y="10" width="10" height="8" rx="1"/></svg>
                    </button>
                    <button style={{ ...styles.alignIconBtn, background: vAlign === 'middle' ? '#FF5500' : 'transparent' }} onClick={() => setVAlign('middle')}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="12" x2="20" y2="12"/><rect x="7" y="6" width="10" height="12" rx="1"/></svg>
                    </button>
                    <button style={{ ...styles.alignIconBtn, background: vAlign === 'bottom' ? '#FF5500' : 'transparent' }} onClick={() => setVAlign('bottom')}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="18" x2="20" y2="18"/><rect x="7" y="6" width="10" height="8" rx="1"/></svg>
                    </button>
                  </div>
                </div>
              </div>

              <div style={styles.propRow}>
                <div style={{ flex: 1 }}>
                  <div style={styles.propLabel}>Position</div>
                  <div style={styles.inputWithPrefix}>
                    <span style={styles.inputPrefix}>X</span>
                    <input style={styles.propInputNoBorder} value={posX} onChange={(e) => setPosX(Number(e.target.value))} />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 16 }} />
                  <div style={styles.inputWithPrefix}>
                    <span style={styles.inputPrefix}>Y</span>
                    <input style={styles.propInputNoBorder} value={posY} onChange={(e) => setPosY(Number(e.target.value))} />
                  </div>
                </div>
              </div>

              <div style={styles.propRow}>
                <div style={{ flex: 1 }}>
                  <div style={styles.propLabel}>Dimension</div>
                  <div style={styles.inputWithPrefix}>
                    <span style={styles.inputPrefix}>W</span>
                    <input style={styles.propInputNoBorder} value={dimW} onChange={(e) => setDimW(Number(e.target.value))} />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 16 }} />
                  <div style={styles.inputWithPrefix}>
                    <span style={styles.inputPrefix}>H</span>
                    <input style={styles.propInputNoBorder} value={dimH} onChange={(e) => setDimH(Number(e.target.value))} />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={styles.propLabel}>Reference gap</div>
                <input
                  type="number"
                  value={refGap}
                  onChange={(e) => setRefGap(Number(e.target.value))}
                  style={styles.propInput}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#a1a1aa', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={lockAspect}
                  onChange={(e) => setLockAspect(e.target.checked)}
                  style={{ accentColor: '#FF5500', width: 14, height: 14 }}
                />
                <span>Lock aspect ratio</span>
              </label>
            </div>

            {/* Accordion 2: Scripture */}
            <div style={styles.accSection}>
              <div style={styles.accTitle}>
                <span>Scripture</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={styles.propLabel}>Font</div>
                <CustomDropdown
                  value={fontFamily}
                  options={[
                    { value: 'Aptos', label: 'Aptos' },
                    { value: 'General Sans', label: 'General Sans' },
                    { value: 'Inter', label: 'Inter' },
                    { value: 'Figtree', label: 'Figtree' },
                    { value: 'Roboto', label: 'Roboto' },
                  ]}
                  onChange={(v) => setFontFamily(v)}
                  buttonStyle={{ width: '100%' }}
                />
              </div>

              <div style={styles.propRow}>
                <div style={{ flex: 1 }}>
                  <div style={styles.propLabel}>Weight</div>
                  <CustomDropdown
                    value={String(fontWeight)}
                    options={[
                      { value: '400', label: 'Regular' },
                      { value: '500', label: 'Medium' },
                      { value: '600', label: 'Semi Bold' },
                      { value: '700', label: 'Bold' },
                      { value: '800', label: 'Extra Bold' },
                    ]}
                    onChange={(v) => setFontWeight(Number(v))}
                    buttonStyle={{ width: '100%' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={styles.propLabel}>Size</div>
                  <input
                    type="number"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    style={styles.propInput}
                  />
                </div>
              </div>

              <div style={styles.propRow}>
                <div style={{ flex: 1 }}>
                  <div style={styles.propLabel}>Line height</div>
                  <input
                    type="number"
                    step="0.05"
                    value={lineHeight}
                    onChange={(e) => setLineHeight(Number(e.target.value))}
                    style={styles.propInput}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={styles.propLabel}>Letter spacing</div>
                  <input
                    type="number"
                    value={letterSpacing}
                    onChange={(e) => setLetterSpacing(Number(e.target.value))}
                    style={styles.propInput}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={styles.propLabel}>Color</div>
                <div style={styles.colorInputContainer}>
                  <input
                    type="color"
                    value={fontColor}
                    onChange={(e) => setFontColor(e.target.value)}
                    style={{ width: 20, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 3 }}
                  />
                  <input
                    style={styles.propInputNoBorder}
                    value={fontColor.replace('#', '').toUpperCase()}
                    onChange={(e) => setFontColor(`#${e.target.value}`)}
                  />
                  <span style={{ fontSize: 11, color: '#71717a', fontWeight: 600 }}>100%</span>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={styles.propLabel}>Alignment</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button style={{ ...styles.alignIconBtn, flex: 1, background: textAlign === 'left' ? '#202024' : 'transparent' }} onClick={() => setTextAlign('left')}>Left</button>
                  <button style={{ ...styles.alignIconBtn, flex: 1, background: textAlign === 'center' ? '#202024' : 'transparent' }} onClick={() => setTextAlign('center')}>Center</button>
                  <button style={{ ...styles.alignIconBtn, flex: 1, background: textAlign === 'right' ? '#202024' : 'transparent' }} onClick={() => setTextAlign('right')}>Right</button>
                  <button style={{ ...styles.alignIconBtn, flex: 1, background: textAlign === 'justify' ? '#202024' : 'transparent' }} onClick={() => setTextAlign('justify')}>Justify</button>
                </div>
              </div>

              <div style={styles.propRow}>
                <div style={{ flex: 1 }}>
                  <div style={styles.propLabel}>Decoration</div>
                  <div style={{ display: 'flex', gap: 2, background: '#202024', borderRadius: 6, padding: 2 }}>
                    <button style={{ ...styles.caseBtn, background: textDecoration === 'none' ? '#141416' : 'transparent' }} onClick={() => setTextDecoration('none')}>—</button>
                    <button style={{ ...styles.caseBtn, background: textDecoration === 'underline' ? '#141416' : 'transparent' }} onClick={() => setTextDecoration('underline')}><u>U</u></button>
                    <button style={{ ...styles.caseBtn, background: textDecoration === 'line-through' ? '#141416' : 'transparent' }} onClick={() => setTextDecoration('line-through')}><s>S</s></button>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={styles.propLabel}>Case</div>
                  <div style={{ display: 'flex', gap: 2, background: '#202024', borderRadius: 6, padding: 2 }}>
                    <button style={{ ...styles.caseBtn, background: textCase === 'none' ? '#141416' : 'transparent' }} onClick={() => setTextCase('none')}>—</button>
                    <button style={{ ...styles.caseBtn, background: textCase === 'uppercase' ? '#141416' : 'transparent' }} onClick={() => setTextCase('uppercase')}>PB</button>
                    <button style={{ ...styles.caseBtn, background: textCase === 'capitalize' ? '#141416' : 'transparent' }} onClick={() => setTextCase('capitalize')}>Pb</button>
                    <button style={{ ...styles.caseBtn, background: textCase === 'lowercase' ? '#141416' : 'transparent' }} onClick={() => setTextCase('lowercase')}>pb</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Accordion 3: Effects */}
            <div style={styles.accSection}>
              <div style={styles.accTitle}>
                <span>Effects</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 2000,
    background: 'var(--bg-primary)',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'var(--font-ui)',
  },
  header: {
    height: 56,
    padding: '0 20px',
    background: '#141416',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#ffffff',
  },
  saveBtn: {
    padding: '6px 16px',
    background: '#FF5500',
    border: 'none',
    borderRadius: 6,
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  closeBtn: {
    padding: '6px 14px',
    background: '#202024',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    color: '#a1a1aa',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  workspace: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  leftCol: {
    width: 240,
    background: '#141416',
    borderRight: '1px solid rgba(255, 255, 255, 0.08)',
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  },
  toolBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: '6px 8px',
    background: '#202024',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: '#71717a',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 10px',
    height: 32,
    background: '#202024',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: '#ffffff',
    fontSize: 12,
    outline: 'none',
  },
  pillGroup: {
    display: 'flex',
    background: '#202024',
    borderRadius: 6,
    padding: 3,
    marginBottom: 14,
  },
  pillBtn: {
    flex: 1,
    padding: '4px',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  presetList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  presetCard: {
    borderRadius: 6,
    overflow: 'hidden',
    cursor: 'pointer',
    background: '#18181b',
  },
  selahThumb: {
    height: 100,
    background: 'radial-gradient(circle at center, #ea580c 0%, #7c2d12 60%, #000000 100%)',
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  selahRef: {
    fontSize: 8,
    color: '#eab308',
    fontWeight: 700,
  },
  selahText: {
    fontSize: 9,
    color: '#ffffff',
    fontWeight: 800,
    marginTop: 2,
  },
  edenThumb: {
    height: 100,
    background: 'linear-gradient(135deg, #065f46 0%, #022c22 100%)',
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  edenText: {
    fontSize: 9,
    color: '#ffffff',
    fontWeight: 700,
  },
  edenRef: {
    fontSize: 8,
    color: '#a7f3d0',
    marginTop: 4,
  },
  ltThumb: {
    height: 100,
    background: '#09090b',
    display: 'flex',
    alignItems: 'flex-end',
    padding: 8,
  },
  ltBox: {
    width: '100%',
    background: '#FF5500',
    padding: 6,
    borderRadius: 4,
  },
  ltRef: {
    fontSize: 7,
    color: '#ffffff',
    fontWeight: 700,
  },
  ltText: {
    fontSize: 8,
    color: '#ffffff',
    fontWeight: 800,
  },
  cardFooter: {
    padding: '8px 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#141416',
  },
  tagMain: {
    padding: '2px 6px',
    background: '#FF5500',
    borderRadius: 4,
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
  },
  centerCol: {
    flex: 1,
    position: 'relative',
    background: 'var(--bg-primary)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  floatingToolbarContainer: {
    position: 'absolute',
    top: 14,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    zIndex: 10,
  },
  toolbarLabel: {
    fontSize: 10,
    color: '#71717a',
    fontWeight: 600,
  },
  floatingToolbar: {
    display: 'flex',
    gap: 4,
    background: '#141416',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 4,
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    background: 'transparent',
    border: 'none',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  canvasContainer: {
    flex: 1,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  canvasStage: {
    width: 800,
    height: 450,
    background: 'radial-gradient(circle at center, #ea580c 0%, #7c2d12 60%, #000000 100%)',
    borderRadius: 8,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    transition: 'transform 0.15s ease',
  },
  groupRefBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: '4px 10px',
    background: 'rgba(0, 0, 0, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 600,
  },
  boundingBox: {
    width: 600,
    padding: 20,
    borderRadius: 6,
    position: 'relative',
    cursor: 'move',
  },
  handle: {
    position: 'absolute',
    width: 8,
    height: 8,
    background: '#ffffff',
    border: '1px solid #FF5500',
    borderRadius: 2,
  },
  zoomBar: {
    position: 'absolute',
    bottom: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#141416',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 999,
    padding: '4px 14px',
  },
  zoomBtn: {
    background: 'transparent',
    border: 'none',
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  rightCol: {
    width: 290,
    background: '#141416',
    borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  },
  inspectorHeader: {
    padding: '14px 18px',
    fontSize: 14,
    fontWeight: 700,
    color: '#ffffff',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inspectorBody: {
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  accSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingBottom: 14,
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  },
  accTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#ffffff',
    marginBottom: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  propLabel: {
    fontSize: 11,
    color: '#a1a1aa',
    marginBottom: 4,
  },
  propRow: {
    display: 'flex',
    gap: 10,
    marginBottom: 10,
  },
  alignGroup: {
    flex: 1,
    display: 'flex',
    background: '#202024',
    borderRadius: 6,
    padding: 2,
  },
  alignIconBtn: {
    flex: 1,
    height: 26,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: 4,
    color: '#ffffff',
    cursor: 'pointer',
  },
  inputWithPrefix: {
    display: 'flex',
    alignItems: 'center',
    height: 32,
    background: '#202024',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    padding: '0 8px',
  },
  inputPrefix: {
    fontSize: 11,
    fontWeight: 600,
    color: '#71717a',
    marginRight: 6,
  },
  propInputNoBorder: {
    flex: 1,
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 600,
    outline: 'none',
  },
  propInput: {
    width: '100%',
    height: 32,
    padding: '0 10px',
    background: '#202024',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 600,
    outline: 'none',
    boxSizing: 'border-box',
  },
  colorInputContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 32,
    padding: '0 10px',
    background: '#202024',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
  },
  caseBtn: {
    flex: 1,
    height: 24,
    border: 'none',
    borderRadius: 4,
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
