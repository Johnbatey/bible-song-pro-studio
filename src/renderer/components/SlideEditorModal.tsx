import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { CustomDropdown } from './CustomDropdown';

export function SlideEditorModal() {
  const isSlideEditorOpen = useAppStore((s) => s.isSlideEditorOpen);
  const closeSlideEditor = useAppStore((s) => s.closeSlideEditor);
  const activePresentationId = useAppStore((s) => s.activePresentationId);

  const [activePageIndex, setActivePageIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [pages, setPages] = useState([
    { id: '1', title: 'Jesus said unto them', subtitle: 'Double click to edit subtitle', bg: 'linear-gradient(135deg, #f97316 0%, #7c2d12 100%)' },
    { id: '2', title: 'Double click to edit title', subtitle: 'Double click to edit subtitle', bg: '#ffffff' },
  ]);
  const [bgType, setBgType] = useState<'Color' | 'Image' | 'Video' | 'Gradient'>('Color');
  const [colorOverlay, setColorOverlay] = useState('#FF5700');

  if (!isSlideEditorOpen) return null;

  const activePage = pages[activePageIndex] || pages[0];

  function handleSave() {
    closeSlideEditor();
  }

  function handleAddPage() {
    setPages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        title: 'Double click to edit title',
        subtitle: 'Double click to edit subtitle',
        bg: '#18181b',
      },
    ]);
  }

  return (
    <div style={styles.overlay}>
      {/* Top Header Bar */}
      <header style={styles.header}>
        <div style={styles.headerTitle}>{activePresentationId ? 'Mama A song' : 'Untitled Presentation'}</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button style={styles.saveBtn} onClick={handleSave}>
            Save changes
          </button>
          <button style={styles.closeBtn} onClick={closeSlideEditor} title="Close Slide Editor">
            ✕ Close
          </button>
        </div>
      </header>

      {/* Main 3-Column Workspace */}
      <div style={styles.workspace}>
        {/* Left Column: Pages Rail */}
        <div style={styles.leftCol}>
          <div style={styles.pagesList}>
            {pages.map((pg, idx) => (
              <div key={pg.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#71717a', marginTop: 4 }}>{idx + 1}</span>
                <div
                  style={{
                    ...styles.pageThumb,
                    border: activePageIndex === idx ? '2px solid #FF5500' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: pg.bg,
                  }}
                  onClick={() => setActivePageIndex(idx)}
                >
                  <div style={{ fontSize: 8, fontWeight: 800, color: idx === 1 ? '#000' : '#fff', textAlign: 'center' }}>
                    {pg.title}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button style={styles.addPageBtn} onClick={handleAddPage}>
            + Add new page
          </button>
        </div>

        {/* Center Column: Slide Canvas Stage & Toolbar */}
        <div style={styles.centerCol}>
          {/* Top Floating Toolbar */}
          <div style={styles.floatingToolbarContainer}>
            <div style={styles.toolbarLabel}>Add content</div>
            <div style={styles.floatingToolbar}>
              <button style={styles.addBtn}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
                <span>Text</span>
              </button>
              <button style={styles.addBtn}>
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
                background: activePage.bg,
              }}
            >
              <div style={styles.slideTitleText}>{activePage.title}</div>
              <div style={styles.slideSubtitleText}>{activePage.subtitle}</div>
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

        {/* Right Column: Page Inspector Panel */}
        <div style={styles.rightCol}>
          <div style={styles.inspectorHeader}>
            <span>Page {activePageIndex + 1}</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </div>

          <div style={styles.inspectorBody}>
            <div style={styles.accSection}>
              <div style={styles.propLabel}>Background type</div>
              <CustomDropdown
                value={bgType}
                options={[
                  { value: 'Color', label: 'Color' },
                  { value: 'Image', label: 'Image' },
                  { value: 'Video', label: 'Video' },
                  { value: 'Gradient', label: 'Gradient' },
                ]}
                onChange={(v) => setBgType(v as any)}
                buttonStyle={{ width: '100%' }}
              />
            </div>

            <div style={styles.accSection}>
              <div style={styles.propLabel}>Color overlay</div>
              <div style={styles.colorInputContainer}>
                <input
                  type="color"
                  value={colorOverlay}
                  onChange={(e) => setColorOverlay(e.target.value)}
                  style={{ width: 22, height: 22, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 4 }}
                />
                <input
                  style={styles.propInputNoBorder}
                  value={colorOverlay.replace('#', '').toUpperCase()}
                  onChange={(e) => setColorOverlay(`#${e.target.value}`)}
                />
                <span style={{ fontSize: 11, color: '#71717a', fontWeight: 600 }}>100%</span>
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
    background: '#0c0c0e',
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
    width: 220,
    background: '#141416',
    borderRight: '1px solid rgba(255, 255, 255, 0.08)',
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  pagesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    overflowY: 'auto',
  },
  pageThumb: {
    width: 170,
    height: 100,
    borderRadius: 8,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
  },
  addPageBtn: {
    padding: '8px',
    background: '#202024',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 14,
  },
  centerCol: {
    flex: 1,
    position: 'relative',
    background: '#0c0c0e',
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
    width: 720,
    height: 405,
    borderRadius: 12,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    textAlign: 'center',
  },
  slideTitleText: {
    fontSize: 32,
    fontWeight: 800,
    color: '#ffffff',
    textShadow: '0 2px 8px rgba(0,0,0,0.6)',
  },
  slideSubtitleText: {
    fontSize: 18,
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 8,
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
    width: 280,
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
  },
  propLabel: {
    fontSize: 11,
    color: '#a1a1aa',
    marginBottom: 4,
  },
  colorInputContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 34,
    padding: '0 10px',
    background: '#202024',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
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
};
