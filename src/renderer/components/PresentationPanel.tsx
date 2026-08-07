import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../stores/appStore';
import { SlideCanvas } from './SlideCanvas';
import { NativeSlideBoard, NATIVE_BOARD_W, slideElementsFor } from './NativeSlideBoard';
import { useDeckPreview } from '../hooks/useDeckPreview';
import { useDeckPackage } from '../hooks/useDeckPackage';
import { projectNativeSlide, projectParsedSlide } from '../utils/slide-projection';
import type { PresentationDeck, PresentationSlide, Scene, SlideBackground, SlideProjection } from '../types';
import type { ParsedSlide, SlideSizeEmu } from '../slide-engine/state';
import type { ParsedShape } from '../slide-engine/parser/slide-parser';
import { CustomDropdown } from './CustomDropdown';
import { useBarPosition, MoveBarButton } from '../hooks/useBarPosition';
import { usePptxImport } from '../hooks/usePptxImport';
import { Block, BlockButton } from './Block';

/** Card-shaped view of a deck. */
interface SlideItem {
  id: string;
  title: string;
  pagesCount: number;
  bg: string;
  subtitle?: string;
}

const CARD_THUMB_W = 200;

const CARD_BACKGROUNDS = [
  'linear-gradient(135deg, #f97316 0%, #7c2d12 100%)',
  'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
  'linear-gradient(135deg, #065f46 0%, #022c22 100%)',
  'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
];

/** Thumbnail for Page 2 project slides: measures card width dynamically for 16:9 aspect fit. */
function ProjectSlideThumb({
  slide,
  slideSizeEmu,
  fallbackTitle,
  fallbackSubtitle,
  fallbackBg,
}: {
  slide: PresentationSlide | ParsedSlide;
  slideSizeEmu?: SlideSizeEmu | null;
  fallbackTitle?: string;
  fallbackSubtitle?: string;
  fallbackBg?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(210);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const measure = () => {
      const w = Math.round(node.getBoundingClientRect().width);
      if (w > 0) setWidth(w);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const aspect = slideSizeEmu && slideSizeEmu.cx > 0 ? slideSizeEmu.cy / slideSizeEmu.cx : 9 / 16;
  const height = Math.max(90, Math.round(width * aspect));
  const isParsed = 'parsed' in slide && (slide as ParsedSlide).parsed;
  const isNative = !isParsed && 'body' in slide;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: height,
        background: '#090a0f',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: '1px solid var(--block-line)',
      }}
    >
      {isParsed ? (
        <SlideCanvas
          slide={slide as ParsedSlide}
          slideSizeEmu={slideSizeEmu}
          width={width}
          dynamicAutofit
        />
      ) : isNative ? (
        /* The same board the editor draws and the display projects, shrunk to
           the card. A card that showed its own summary of the slide would go
           on disagreeing with both. */
        <NativeSlideBoard
          elements={slideElementsFor(slide as PresentationSlide)}
          background={(slide as PresentationSlide).background}
          width={width}
          boardHeight={Math.round(NATIVE_BOARD_W * aspect)}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            background: fallbackBg || 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>{fallbackTitle}</div>
          {fallbackSubtitle && (
            <div
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.7)',
                marginTop: 4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {fallbackSubtitle}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Card thumbnail: the deck's actual first slide once it scrolls into view. */
function CardThumb({ deck, fallback, caption }: { deck?: PresentationDeck; fallback: string; caption?: string }) {
  const { ref, preview } = useDeckPreview(deck);
  const [width, setWidth] = useState(CARD_THUMB_W);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const w = Math.round(node.getBoundingClientRect().width);
      if (w > 0) setWidth(w);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return (
    <div ref={ref} style={{ ...styles.cardThumb, background: preview ? '#000' : fallback }}>
      {preview ? (
        <SlideCanvas
          slide={preview.slide}
          slideSizeEmu={preview.slideSizeEmu}
          width={width}
          dynamicAutofit
        />
      ) : (
        <div style={styles.cardTitleOverlay}>{caption}</div>
      )}
    </div>
  );
}

export function PresentationPanel() {
  const openSlideEditor = useAppStore((s) => s.openSlideEditor);
  const presentationDecks = useAppStore((s) => s.presentationDecks);
  const addPresentationDeck = useAppStore((s) => s.addPresentationDeck);
  const updatePresentationDeck = useAppStore((s) => s.updatePresentationDeck);
  const deletePresentationDeck = useAppStore((s) => s.deletePresentationDeck);

  const currentScene = useAppStore((s) => s.display.currentScene);
  const projectScene = useAppStore((s) => s.projectScene);
  const cutToScene = useAppStore((s) => s.cutToScene);
  const setPreviewScene = useAppStore((s) => s.setPreviewScene);
  const isStudio = useAppStore((s) => s.display.mode) === 'studio';

  /* Page navigation state: null = Decks List (Page 1), string = Open Project View (Page 2) */
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { position: barPosition, move: moveBar } = useBarPosition('bsp_slidesBarPosition');
  const [activeMenu, setActiveMenu] = useState<{ id: string; x: number; y: number; btnRect?: DOMRect } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { inputRef, pick: pickPptx, onInputChange, status, clearStatus } = usePptxImport();

  /* Auto-close floating context menu on click outside, scroll, resize or escape key */
  useEffect(() => {
    if (!activeMenu) return;
    function handleGlobalClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setActiveMenu(null);
      }
    }
    function handleScrollResize() {
      setActiveMenu(null);
    }

    window.addEventListener('mousedown', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollResize, true);
    window.addEventListener('resize', handleScrollResize);
    return () => {
      window.removeEventListener('mousedown', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollResize, true);
      window.removeEventListener('resize', handleScrollResize);
    };
  }, [activeMenu]);

  const selectedDeck = presentationDecks.find((d) => d.id === selectedDeckId) || null;

  /* If a deck was open on Page 2 and gets deleted externally, return to Page 1 */
  useEffect(() => {
    if (selectedDeckId && !selectedDeck) {
      setSelectedDeckId(null);
    }
  }, [selectedDeckId, selectedDeck]);

  /* Open PowerPoint package if selected deck is a .pptx file */
  const isPptxSelected = selectedDeck?.sourceType === 'pptx' && Boolean(selectedDeck.sourcePath);
  const pkg = useDeckPackage(selectedDeck, Boolean(selectedDeckId && isPptxSelected));

  const presentations: SlideItem[] = presentationDecks.map((deck, index) => ({
    id: deck.id,
    title: deck.title || 'Untitled deck',
    pagesCount: deck.slides?.length ?? 0,
    bg: deck.slides?.[0]?.background?.type === 'color' || deck.slides?.[0]?.background?.type === 'gradient'
      ? String(deck.slides[0].background?.value || CARD_BACKGROUNDS[index % CARD_BACKGROUNDS.length])
      : CARD_BACKGROUNDS[index % CARD_BACKGROUNDS.length],
    subtitle: deck.slides?.[0]?.title || deck.slides?.[0]?.body || '',
  }));

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('New Presentation Deck');

  function handleCreateNew(val: string) {
    if (val === 'manual') {
      setNewProjectTitle('New Presentation Deck');
      setIsCreateModalOpen(true);
    } else if (val === 'import') {
      clearStatus();
      pickPptx();
    }
  }

  function handleConfirmCreateProject() {
    const title = newProjectTitle.trim() || 'New Presentation Deck';
    const newDeck: PresentationDeck = {
      id: `deck-${Date.now()}`,
      title,
      slides: [
        {
          id: `slide-${Date.now()}`,
          title: 'Welcome',
          body: title,
          label: 'Slide 1',
          notes: '',
          transition: 'fade',
          durationMs: 3000,
          hidden: false,
          buildCount: 0,
          buildStep: 0,
          background: { type: 'gradient', value: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)' },
          elements: [
            {
              id: `text-${Date.now()}`,
              type: 'text',
              content: title,
              x: 10,
              y: 35,
              width: 80,
              height: 30,
              fontSize: 48,
              color: '#ffffff',
              fontWeight: 700,
              textAlign: 'center',
            },
          ],
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    addPresentationDeck(newDeck);
    setIsCreateModalOpen(false);
    setSelectedDeckId(newDeck.id);
  }

  function handleEditSlide(id: string) {
    setActiveMenu(null);
    openSlideEditor(id);
  }

  function handleDeleteSlide(id: string) {
    deletePresentationDeck(id);
    setActiveMenu(null);
    if (selectedDeckId === id) setSelectedDeckId(null);
  }

  function handleDuplicateDeck(deckId: string) {
    const target = presentationDecks.find((d) => d.id === deckId);
    if (!target) return;
    const newDeck: PresentationDeck = {
      ...target,
      id: `deck-${Date.now()}`,
      title: `${target.title} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    addPresentationDeck(newDeck);
    setActiveMenu(null);
  }

  function handleRenameDeck(deckId: string) {
    const target = presentationDecks.find((d) => d.id === deckId);
    if (!target) return;
    const newTitle = window.prompt('Rename presentation deck:', target.title);
    if (newTitle && newTitle.trim()) {
      updatePresentationDeck(deckId, { title: newTitle.trim(), updatedAt: Date.now() });
    }
    setActiveMenu(null);
  }

  function handleAddSlideToDeck() {
    if (!selectedDeck) return;
    const count = (selectedDeck.slides?.length || 0) + 1;
    const newSlide: PresentationSlide = {
      id: `slide-${Date.now()}`,
      title: `Slide ${count}`,
      body: 'Enter slide text...',
      label: `Slide ${count}`,
      notes: '',
      transition: 'fade',
      durationMs: 3000,
      hidden: false,
      buildCount: 0,
      buildStep: 0,
    };
    const updatedDeck = {
      ...selectedDeck,
      slides: [...(selectedDeck.slides || []), newSlide],
      updatedAt: Date.now(),
    };
    updatePresentationDeck(selectedDeck.id, updatedDeck);
  }

  /* Projects a slide live onto Program / Output display */
  function handleProjectSlide(slide: PresentationSlide | ParsedSlide, index: number, direct = false) {
    if (!selectedDeck) return;

    const sceneId = `deck-${selectedDeck.id}-slide-${index}`;
    let text = '';
    let bg: Scene['background'];
    /* The slide itself travels with the scene, so the output paints the design
       rather than a transcript of it. `text` is still filled in below: the
       stage display, the queue and the session history all read a scene as a
       line of text, and none of them has a slide to paint. */
    let projection: SlideProjection;

    if ('body' in slide) {
      const pSlide = slide as PresentationSlide;
      text = pSlide.body || pSlide.title || pSlide.label || `Slide ${index + 1}`;
      projection = projectNativeSlide(pSlide, selectedDeck);
      if (pSlide.background) {
        const b = pSlide.background as SlideBackground;
        bg = {
          type: b.type === 'color' ? 'solid' : b.type === 'gradient' ? 'gradient' : b.type === 'image' ? 'image' : b.type === 'video' ? 'video' : 'solid',
          color: b.type === 'color' ? b.value : undefined,
          gradient: b.type === 'gradient' ? b.value : undefined,
          mediaUrl: (b.type === 'image' || b.type === 'video') ? b.value : undefined,
        };
      }
    } else if ('shapes' in slide || 'parsed' in slide) {
      const pSlide = slide as ParsedSlide;
      const shapes = (pSlide.shapes as ParsedShape[]) || [];
      const runs: string[] = [];
      shapes.forEach((shape) => {
        shape.paragraphs?.forEach((p) => {
          p?.forEach((r) => {
            if (r?.text?.trim()) runs.push(r.text.trim());
          });
        });
      });
      text = runs.join('\n') || `Slide ${index + 1}`;
      projection = projectParsedSlide(pSlide, pkg.slideSizeEmu);
    } else {
      text = `Slide ${index + 1}`;
      projection = { kind: 'native', elements: [] };
    }

    const scene: Scene = {
      id: sceneId,
      name: `${selectedDeck.title} — Slide ${index + 1}`,
      type: 'presentation',
      content: {
        text,
        slide: projection,
        slideId: String(index),
        slides: selectedDeck.slides?.map((s, idx) => ({
          id: s.id || String(idx),
          text: s.body || s.title || s.label || `Slide ${idx + 1}`,
          notes: s.notes || '',
        })),
      },
      background: bg,
    };

    if (direct || !isStudio) {
      cutToScene(scene);
    } else {
      projectScene(scene);
    }
  }

  function isSlideLive(index: number) {
    if (!selectedDeck || !currentScene) return false;
    if (currentScene.id === `deck-${selectedDeck.id}-slide-${index}`) return true;
    if (currentScene.content?.reference === selectedDeck.title && currentScene.content?.slideId === String(index)) return true;
    return false;
  }

  /* Page 1 Toolbar */
  const page1Toolbar = (
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

  /* Page 2 Toolbar */
  const page2Toolbar = (
    <div className="blk blk--bar">
      <BlockButton onClick={() => setSelectedDeckId(null)} style={styles.backBtn}>
        ← Projects
      </BlockButton>

      <div style={styles.searchBox}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          placeholder="Search slides in this project..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      <button
        style={styles.editorActionBtn}
        onClick={() => selectedDeck && handleEditSlide(selectedDeck.id)}
        title="Open full slide editor modal to edit design & layers"
      >
        ✏ Open in Editor
      </button>

      <button
        style={styles.addSlideBtn}
        onClick={handleAddSlideToDeck}
        title="Add a new slide to this project"
      >
        + Add Slide
      </button>

      <MoveBarButton
        position={barPosition}
        onMove={moveBar}
        label="Pro Slides"
        style={styles.moveBarBtn}
      />
    </div>
  );

  /* Compute slides list for Page 2 */
  const page2SlidesList: Array<{ slide: PresentationSlide | ParsedSlide; index: number; title: string; subtitle: string }> = (() => {
    if (!selectedDeck) return [];

    if (isPptxSelected && pkg.slides.length > 0) {
      return pkg.slides.map((s, idx) => {
        let snippet = `Slide ${idx + 1}`;
        const shapes = (s.shapes as ParsedShape[]) || [];
        const textRuns: string[] = [];
        shapes.forEach((shp) => {
          shp.paragraphs?.forEach((p) => {
            p?.forEach((r) => {
              if (r?.text?.trim()) textRuns.push(r.text.trim());
            });
          });
        });
        if (textRuns.length > 0) snippet = textRuns.slice(0, 3).join(' ');
        return {
          slide: s,
          index: idx,
          title: `Slide ${idx + 1}`,
          subtitle: snippet,
        };
      });
    }

    return (selectedDeck.slides || []).map((s, idx) => ({
      slide: s,
      index: idx,
      title: s.title || s.label || `Slide ${idx + 1}`,
      subtitle: s.body || s.notes || '',
    }));
  })();

  const filteredPage2Slides = page2SlidesList.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      String(item.index + 1) === q
    );
  });

  return (
    <div className="blk-col" style={styles.container}>
      {/* Top Bar */}
      {barPosition === 'top' && (!selectedDeck ? page1Toolbar : page2Toolbar)}

      {/* PAGE 1: PROJECTS GRID VIEW */}
      {!selectedDeck ? (
        <Block className="blk-fill" title="Slides Projects" subtitle={`${presentations.length}`} bodyStyle={styles.gridContainer}>
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
              <div
                key={item.id}
                style={styles.card}
                onClick={() => setSelectedDeckId(item.id)}
                onDoubleClick={() => handleEditSlide(item.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveMenu({
                    id: item.id,
                    x: e.clientX,
                    y: e.clientY,
                  });
                }}
                title="Click to view project slides · double-click to open editor · right-click for options"
              >
                <CardThumb
                  deck={presentationDecks.find((d) => d.id === item.id)}
                  fallback={item.bg}
                  caption={item.subtitle}
                />

                <div style={styles.cardFooter}>
                  <div>
                    <div style={styles.cardTitle}>{item.title}</div>
                    <div style={styles.cardSubtitle}>{item.pagesCount} {item.pagesCount === 1 ? 'page' : 'pages'}</div>
                  </div>

                  <button
                    style={styles.moreBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeMenu?.id === item.id) {
                        setActiveMenu(null);
                      } else {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setActiveMenu({
                          id: item.id,
                          x: rect.right,
                          y: rect.bottom,
                          btnRect: rect,
                        });
                      }
                    }}
                  >
                    •••
                  </button>
                </div>
              </div>
            ))}
        </Block>
      ) : (
        /* PAGE 2: PROJECT SLIDES VIEW */
        <Block
          className="blk-fill"
          title={<>Project: <span style={{ color: 'var(--f4621f, #ea580c)' }}>{selectedDeck.title}</span></>}
          subtitle={`${page2SlidesList.length} ${page2SlidesList.length === 1 ? 'slide' : 'slides'}`}
          tools={(
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <BlockButton onClick={() => setSelectedDeckId(null)}>← Projects</BlockButton>
              <BlockButton onClick={() => handleEditSlide(selectedDeck.id)}>✏ Open in Editor</BlockButton>
            </div>
          )}
          bodyStyle={styles.projectSlidesGrid}
        >
          {pkg.status && isPptxSelected && (
            <div style={styles.pptxStatusNote}>
              {pkg.status.text}
            </div>
          )}

          {filteredPage2Slides.length === 0 && (
            <div style={styles.emptyState}>
              No slides found in this project. Use <strong>+ Add Slide</strong> above to create one.
            </div>
          )}

          {filteredPage2Slides.map(({ slide, index, title, subtitle }) => {
            const live = isSlideLive(index);
            const slideBg = 'background' in slide && slide.background ? (slide.background as SlideBackground) : null;
            const fallbackBg = slideBg && (slideBg.type === 'color' || slideBg.type === 'gradient')
              ? String(slideBg.value)
              : CARD_BACKGROUNDS[index % CARD_BACKGROUNDS.length];

            return (
              <div
                key={('id' in slide && slide.id) ? slide.id : `slide-${index}`}
                className={`card card-hover ${live ? 'glass-accent' : ''}`}
                style={{
                  ...styles.projectSlideCard,
                  borderColor: live ? 'var(--border-accent, #f4621f)' : 'var(--block-line)',
                  boxShadow: live ? '0 0 12px rgba(244, 98, 31, 0.4)' : undefined,
                }}
                onClick={() => handleProjectSlide(slide, index, false)}
                onDoubleClick={() => handleProjectSlide(slide, index, true)}
                title="Click to project live · double-click to force Go Live"
              >
                {/* Slide Preview Miniature */}
                <div style={{ position: 'relative', width: '100%' }}>
                  <ProjectSlideThumb
                    slide={slide}
                    slideSizeEmu={pkg.slideSizeEmu}
                    fallbackTitle={title}
                    fallbackSubtitle={subtitle}
                    fallbackBg={fallbackBg}
                  />

                  {/* Index Badge */}
                  <div style={styles.slideIndexBadge}>{index + 1}</div>

                  {/* Live Status Badge */}
                  {live && (
                    <div style={styles.liveBadge}>
                      <span style={styles.liveDot} /> LIVE
                    </div>
                  )}
                </div>

                {/* Footer Info */}
                <div style={styles.projectSlideFooter}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.projectSlideTitle}>{title}</div>
                    <div style={styles.projectSlideSubtitle}>{subtitle || `Slide ${index + 1}`}</div>
                  </div>

                  <div style={{ display: 'flex', gap: 4 }}>
                    {isStudio && (
                      <button
                        className="btn btn-sm btn-ghost"
                        style={styles.miniActionBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProjectSlide(slide, index, false);
                        }}
                      >
                        Stage
                      </button>
                    )}
                    <button
                      className={`btn btn-sm ${live ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ ...styles.miniActionBtn, background: live ? '#f4621f' : undefined }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleProjectSlide(slide, index, true);
                      }}
                    >
                      {live ? 'Live' : 'Go Live'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </Block>
      )}

      {/* Bottom Bar */}
      {barPosition === 'bottom' && (!selectedDeck ? page1Toolbar : page2Toolbar)}

      {/* Project Creation Modal */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setIsCreateModalOpen(false)}
        >
          <div
            style={{
              width: 420,
              maxWidth: '90vw',
              background: '#161414',
              border: '1px solid var(--block-line, #262628)',
              borderRadius: 12,
              padding: 24,
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              color: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Create New Pro Slide Project</div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: 18 }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-dim, #d4d4d8)' }}>
              Enter a name for your new presentation deck project:
            </div>

            <input
              type="text"
              value={newProjectTitle}
              onChange={(e) => setNewProjectTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmCreateProject();
              }}
              autoFocus
              placeholder="e.g. Sunday Service Presentation"
              style={{
                width: '100%',
                padding: '10px 14px',
                background: '#111010',
                border: '1px solid var(--block-line, #262628)',
                borderRadius: 8,
                color: '#ffffff',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: '1px solid var(--block-line, #262628)',
                  borderRadius: 6,
                  color: '#ffffff',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCreateProject}
                style={{
                  padding: '8px 18px',
                  background: 'var(--accent, #f4621f)',
                  border: 'none',
                  borderRadius: 6,
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(244, 98, 31, 0.4)',
                }}
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Project Context Menu (Portalled to document.body to prevent clipping under chrome bar) */}
      {activeMenu && (() => {
        const activeDeck = presentationDecks.find((d) => d.id === activeMenu.id);
        if (!activeDeck) return null;

        const menuW = 175;
        const menuH = 185;
        const padding = 8;
        let top = 0;
        let left = 0;

        if (activeMenu.btnRect) {
          const rect = activeMenu.btnRect;
          const spaceBelow = window.innerHeight - rect.bottom;
          const spaceAbove = rect.top;

          if (spaceBelow >= menuH + padding || spaceBelow >= spaceAbove) {
            top = Math.min(rect.bottom + 4, window.innerHeight - menuH - padding);
          } else {
            top = Math.max(padding, rect.top - menuH - 4);
          }
          left = Math.max(padding, Math.min(rect.right - menuW, window.innerWidth - menuW - padding));
        } else {
          const spaceBelow = window.innerHeight - activeMenu.y;
          top = spaceBelow >= menuH + padding
            ? activeMenu.y + 4
            : Math.max(padding, activeMenu.y - menuH - 4);
          left = Math.max(padding, Math.min(activeMenu.x, window.innerWidth - menuW - padding));
        }

        return createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top,
              left,
              zIndex: 99999,
              background: '#18181b',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 8,
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(0, 0, 0, 0.5)',
              padding: 4,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 175,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              style={styles.menuItem}
              onClick={() => {
                setActiveMenu(null);
                setSelectedDeckId(activeDeck.id);
              }}
            >
              👁 View project slides
            </button>
            <button
              style={styles.menuItem}
              onClick={() => handleEditSlide(activeDeck.id)}
            >
              ✏ Edit design in editor
            </button>
            <button
              style={styles.menuItem}
              onClick={() => handleRenameDeck(activeDeck.id)}
            >
              Rename project
            </button>
            <button
              style={styles.menuItem}
              onClick={() => handleDuplicateDeck(activeDeck.id)}
            >
              Duplicate project
            </button>
            <button
              style={{ ...styles.menuItem, color: '#ef4444' }}
              onClick={() => handleDeleteSlide(activeDeck.id)}
            >
              Delete project
            </button>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}


const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    minHeight: 0,
    fontFamily: 'var(--font-ui)',
  },
  backBtn: {
    padding: '0 10px',
    height: 30,
    fontSize: 12,
    fontWeight: 600,
  },
  editorActionBtn: {
    height: 30,
    padding: '0 10px',
    background: '#202024',
    border: '1px solid var(--block-line)',
    borderRadius: 6,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  addSlideBtn: {
    height: 30,
    padding: '0 10px',
    background: 'var(--accent, #f4621f)',
    border: 'none',
    borderRadius: 6,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
  },
  moveBarBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    background: 'transparent',
    border: 'none',
    borderRadius: 6,
    color: '#ffffff',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
    marginLeft: 'auto',
  },
  importStatus: {
    gridColumn: '1 / -1',
    padding: '8px 12px',
    fontSize: 12,
    background: 'var(--block-active)',
    border: '1px solid var(--block-line)',
    borderRadius: 6,
    cursor: 'pointer',
  },
  pptxStatusNote: {
    gridColumn: '1 / -1',
    padding: '8px 12px',
    fontSize: 12,
    color: 'var(--text-dim)',
    background: 'var(--block-active)',
    border: '1px solid var(--block-line)',
    borderRadius: 6,
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
  /* gridAutoRows is max-content, not auto: the cards clip their own overflow,
     so an auto row has a zero automatic minimum and Chromium squeezes every
     row to fit the scroller's height the moment the grid is taller than the
     body — which stacks the cards on top of one another. max-content pins each
     row to the card it holds and lets the body scroll instead. */
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gridAutoRows: 'max-content',
    gap: 14,
    alignContent: 'start',
  },
  projectSlidesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
    gridAutoRows: 'max-content',
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    minHeight: 110,
    overflow: 'hidden',
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
    minWidth: 140,
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
  projectSlideCard: {
    background: 'var(--block-bg)',
    border: '1px solid var(--block-line)',
    borderRadius: 6,
    /* The .card class carries 16px of padding for text cards. These hold a
       thumbnail that runs edge to edge, so it has to go. */
    padding: 0,
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  projectSlideThumbBox: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16 / 9',
    background: '#090a0f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderBottom: '1px solid var(--block-line)',
  },
  nativeSlideThumbInner: {
    padding: 12,
    textAlign: 'center',
    width: '100%',
  },
  nativeSlideThumbTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#ffffff',
  },
  nativeSlideThumbSubtitle: {
    fontSize: 11,
    color: 'var(--text-dim)',
    marginTop: 4,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  slideIndexBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    background: 'rgba(0, 0, 0, 0.75)',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: 4,
    border: '1px solid rgba(255, 255, 255, 0.15)',
  },
  liveBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    background: '#f4621f',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 800,
    padding: '2px 6px',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    boxShadow: '0 2px 6px rgba(244, 98, 31, 0.5)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#ffffff',
  },
  projectSlideFooter: {
    padding: '8px 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  projectSlideTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#ffffff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  projectSlideSubtitle: {
    fontSize: 10,
    color: 'var(--text-dim)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: 2,
  },
  miniActionBtn: {
    fontSize: 11,
    padding: '3px 7px',
  },
};

