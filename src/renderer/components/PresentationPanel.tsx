import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { CustomDropdown } from './CustomDropdown';

interface SlideItem {
  id: string;
  title: string;
  pagesCount: number;
  bg: string;
  subtitle?: string;
}

export function PresentationPanel() {
  const openSlideEditor = useAppStore((s) => s.openSlideEditor);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const [presentations, setPresentations] = useState<SlideItem[]>([
    { id: '1', title: 'Mama A song', pagesCount: 2, bg: 'linear-gradient(135deg, #f97316 0%, #7c2d12 100%)', subtitle: 'Jesus said unto them' },
    { id: '2', title: 'Master Room Love Wat', pagesCount: 1, bg: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)', subtitle: 'Click to add heading' },
    { id: '3', title: 'Worship Service Intro', pagesCount: 3, bg: 'linear-gradient(135deg, #065f46 0%, #022c22 100%)', subtitle: 'Click to add heading' },
  ]);

  function handleCreateNew(val: string) {
    if (val === 'manual') {
      openSlideEditor();
    }
  }

  function handleEditSlide(id: string) {
    setActiveMenuId(null);
    openSlideEditor(id);
  }

  function handleDeleteSlide(id: string) {
    setPresentations((prev) => prev.filter((item) => item.id !== id));
    setActiveMenuId(null);
  }

  return (
    <div style={styles.container}>
      {/* Top Controls Bar */}
      <div style={styles.topBar}>
        <CustomDropdown
          value="create"
          options={[
            { value: 'create', label: '+ Create new' },
            { value: 'manual', label: '✏ Create manually' },
            { value: 'import', label: '📥 Import presentation' },
            { value: 'ai', label: '✨ Generate with AI' },
          ]}
          onChange={handleCreateNew}
          buttonStyle={{ background: '#202024', height: 34, padding: '0 14px', borderRadius: 6, fontWeight: 700 }}
        />

        <div style={styles.searchBox}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            placeholder="Search for slide title or content"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          <button style={styles.gridToggleBtn} title="List View">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
          <button style={{ ...styles.gridToggleBtn, background: 'rgba(255, 255, 255, 0.08)' }} title="2 Column Grid View">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </button>
          <button style={styles.gridToggleBtn} title="3 Column Grid View">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
          </button>
        </div>
      </div>

      {/* Slide Cards Grid */}
      <div style={styles.gridContainer}>
        {presentations
          .filter((p) => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
          .map((item) => (
            <div key={item.id} style={styles.card} onDoubleClick={() => handleEditSlide(item.id)}>
              <div style={{ ...styles.cardThumb, background: item.bg }}>
                <div style={styles.cardTitleOverlay}>{item.subtitle}</div>
              </div>

              <div style={styles.cardFooter}>
                <div>
                  <div style={styles.cardTitle}>{item.title}</div>
                  <div style={styles.cardSubtitle}>{item.pagesCount} {item.pagesCount === 1 ? 'page' : 'pages'}</div>
                </div>

                <div style={{ position: 'relative' }}>
                  <button style={styles.moreBtn} onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}>
                    •••
                  </button>

                  {activeMenuId === item.id && (
                    <div style={styles.contextMenu}>
                      <button style={styles.menuItem} onClick={() => handleEditSlide(item.id)}>Edit slide</button>
                      <button style={styles.menuItem} onClick={() => setActiveMenuId(null)}>Rename</button>
                      <button style={styles.menuItem} onClick={() => setActiveMenuId(null)}>Duplicate</button>
                      <button style={{ ...styles.menuItem, color: '#ef4444' }} onClick={() => handleDeleteSlide(item.id)}>Delete</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'var(--font-ui)',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    flexShrink: 0,
  },
  searchBox: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 34,
    padding: '0 12px',
    background: '#202024',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
  },
  searchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: '#ffffff',
    fontSize: 12,
    outline: 'none',
  },
  gridToggleBtn: {
    width: 34,
    height: 34,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#202024',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    color: '#ffffff',
    cursor: 'pointer',
  },
  gridContainer: {
    flex: 1,
    overflowY: 'auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 14,
    alignContent: 'start',
  },
  card: {
    background: '#141416',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  cardThumb: {
    height: 110,
    padding: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  cardTitleOverlay: {
    fontSize: 11,
    fontWeight: 800,
    color: '#ffffff',
    textShadow: '0 1px 4px rgba(0,0,0,0.8)',
  },
  cardFooter: {
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#141416',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#ffffff',
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#71717a',
    marginTop: 2,
  },
  moreBtn: {
    background: 'transparent',
    border: 'none',
    color: '#a1a1aa',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    padding: '2px 6px',
  },
  contextMenu: {
    position: 'absolute',
    bottom: 'calc(100% + 4px)',
    right: 0,
    zIndex: 100,
    background: '#18181b',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.8)',
    padding: 4,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 120,
  },
  menuItem: {
    padding: '8px 12px',
    background: 'transparent',
    border: 'none',
    borderRadius: 4,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 500,
    textAlign: 'left',
    cursor: 'pointer',
  },
};
