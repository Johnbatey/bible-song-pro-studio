import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { CustomDropdown } from './CustomDropdown';
import { useBarPosition, MoveBarButton } from '../hooks/useBarPosition';
import { usePptxImport } from '../hooks/usePptxImport';
import { Block } from './Block';

/** Card-shaped view of a deck. The grid never sees the deck record itself. */
interface SlideItem {
  id: string;
  title: string;
  pagesCount: number;
  bg: string;
  subtitle?: string;
}

/** Cycles so a grid of decks does not come out one flat colour. */
const CARD_BACKGROUNDS = [
  'linear-gradient(135deg, #f97316 0%, #7c2d12 100%)',
  'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
  'linear-gradient(135deg, #065f46 0%, #022c22 100%)',
  'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
];

export function PresentationPanel() {
  const openSlideEditor = useAppStore((s) => s.openSlideEditor);
  const presentationDecks = useAppStore((s) => s.presentationDecks);
  const deletePresentationDeck = useAppStore((s) => s.deletePresentationDeck);
  const [searchQuery, setSearchQuery] = useState('');
  const { position: barPosition, move: moveBar } = useBarPosition('bsp_slidesBarPosition');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const { inputRef, pick: pickPptx, onInputChange, status, clearStatus } = usePptxImport();

  /* Reads the deck store rather than holding its own list — the grid used to be
     three hardcoded demo cards, which meant nothing imported or saved could ever
     appear here. */
  const presentations: SlideItem[] = presentationDecks.map((deck, index) => ({
    id: deck.id,
    title: deck.title || 'Untitled deck',
    pagesCount: deck.slides?.length ?? 0,
    bg: deck.slides?.[0]?.background?.type === 'color' || deck.slides?.[0]?.background?.type === 'gradient'
      ? String(deck.slides[0].background?.value || CARD_BACKGROUNDS[index % CARD_BACKGROUNDS.length])
      : CARD_BACKGROUNDS[index % CARD_BACKGROUNDS.length],
    subtitle: deck.slides?.[0]?.title || deck.slides?.[0]?.body || '',
  }));

  function handleCreateNew(val: string) {
    if (val === 'manual') {
      openSlideEditor();
    } else if (val === 'import') {
      clearStatus();
      pickPptx();
    }
  }

  function handleEditSlide(id: string) {
    setActiveMenuId(null);
    openSlideEditor(id);
  }

  function handleDeleteSlide(id: string) {
    deletePresentationDeck(id);
    setActiveMenuId(null);
  }

  /* Built once and rendered into whichever slot is active — the same element in
     both places, so scrolling and every control behave identically. */
  const toolbar = (
      <div className="blk blk--bar">
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
        <input
          ref={inputRef}
          type="file"
          accept=".pptx"
          onChange={onInputChange}
          style={{ display: 'none' }}
        />

        <div style={styles.searchBox}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            placeholder="Search for slide title or content"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <div className="blk-seg">
          <button style={styles.gridToggleBtn} title="List View">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
          <button style={{ ...styles.gridToggleBtn, background: 'var(--block-active)' }} title="2 Column Grid View">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </button>
          <button style={styles.gridToggleBtn} title="3 Column Grid View">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
          </button>
        </div>

        <MoveBarButton
          position={barPosition}
          onMove={moveBar}
          label="Pro Slides"
          style={styles.moveBarBtn}
        />
      </div>
  );

  return (
    <div className="blk-col" style={styles.container}>
      {barPosition === 'top' && toolbar}

      {/* Slide Cards Grid */}
      <Block className="blk-fill" title="Slides" subtitle={`${presentations.length}`} bodyStyle={styles.gridContainer}>
        {status && (
          <div
            style={{
              ...styles.importStatus,
              color: status.level === 'error' ? '#f87171' : status.level === 'done' ? '#4ade80' : 'var(--text-dim)',
            }}
            onClick={clearStatus}
          >
            {status.text}
          </div>
        )}
        {presentations.length === 0 && (
          <div style={styles.emptyState}>
            No decks yet. Use <strong>+ Create new</strong> to build one, or import a presentation.
          </div>
        )}
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
      </Block>

      {barPosition === 'bottom' && toolbar}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    minHeight: 0,
    fontFamily: 'var(--font-ui)',
  },
  moveBarBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, background: 'transparent', border: 'none', borderRadius: 6, color: '#ffffff', cursor: 'pointer', flexShrink: 0, padding: 0, marginLeft: 'auto' },
  importStatus: {
    gridColumn: '1 / -1',
    padding: '8px 12px',
    fontSize: 12,
    background: 'var(--block-active)',
    border: '1px solid var(--block-line)',
    borderRadius: 6,
    cursor: 'pointer',
  },
  emptyState: {
    gridColumn: '1 / -1',
    padding: '32px 16px',
    textAlign: 'center',
    color: 'var(--text-dim)',
    fontSize: 13,
  },
  searchBox: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 34,
    padding: '0 12px',
    background: 'var(--block-active)',
    border: '1px solid var(--block-line)',
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
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    borderRadius: 4,
    color: '#ffffff',
    cursor: 'pointer',
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 14,
    alignContent: 'start',
  },
  card: {
    background: 'var(--block-bg)',
    border: '1px solid var(--block-line)',
    borderRadius: 6,
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
    background: 'var(--block-bg)',
    borderTop: '1px solid var(--block-line)',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#ffffff',
  },
  cardSubtitle: {
    fontSize: 11,
    color: 'var(--text-dim)',
    marginTop: 2,
  },
  moreBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
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
