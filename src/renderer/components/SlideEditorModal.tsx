import React, { useCallback, useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { SlideEditorHeader } from './slide-editor/SlideEditorHeader';
import { SlideEditorLeftRail } from './slide-editor/SlideEditorLeftRail';
import { SlideEditorQuickToolbar, type ActiveTool } from './slide-editor/SlideEditorQuickToolbar';
import { SlideEditorCanvasBoard } from './slide-editor/SlideEditorCanvasBoard';
import { SlideEditorRightSidebar } from './slide-editor/SlideEditorRightSidebar';
import { PptxDeckView } from './PptxDeckView';
import { SlideCanvas } from './SlideCanvas';
import type { ParsedShape } from '../slide-engine/parser/slide-parser';

/** Width the rail draws PowerPoint thumbnails at. */
const RAIL_THUMB_W = 150;
import { useDeckPackage } from '../hooks/useDeckPackage';
import { useSlideHistory } from '../hooks/useSlideHistory';
import { deriveSlideText } from '../slide-engine/io/deck-import';
import { buildDeckFromPptx } from '../hooks/usePptxImport';
import type { PresentationDeck, PresentationSlide, SlideElement } from '../types';

export function SlideEditorModal() {
  const isSlideEditorOpen = useAppStore((s) => s.isSlideEditorOpen);
  const closeSlideEditor = useAppStore((s) => s.closeSlideEditor);
  const activePresentationId = useAppStore((s) => s.activePresentationId);
  const presentationDecks = useAppStore((s) => s.presentationDecks);
  const addPresentationDeck = useAppStore((s) => s.addPresentationDeck);
  const scenes = useAppStore((s) => s.scenes);
  const openSlideEditor = useAppStore((s) => s.openSlideEditor);

  // Deck State
  const [deck, setDeck] = useState<PresentationDeck>(() => {
    const existing = presentationDecks.find((d) => d.id === activePresentationId);
    if (existing) return existing;
    return {
      id: activePresentationId || `deck-${Date.now()}`,
      title: 'Untitled Presentation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      aspectRatio: '16:9',
      slides: [
        {
          id: 'slide-1',
          title: 'Welcome Presentation',
          body: 'Double click text to edit content',
          label: 'Slide 1',
          notes: '',
          transition: 'fade',
          durationMs: 3000,
          hidden: false,
          buildCount: 1,
          buildStep: 1,
          background: { type: 'gradient', value: 'linear-gradient(135deg, #f97316 0%, #7c2d12 100%)' },
          aspectRatio: '16:9',
          elements: [
            {
              id: 'title-1',
              type: 'text',
              x: 6.3,
              y: 20.4,
              width: 87.5,
              height: 18.5,
              content: 'Welcome Presentation',
              fontSize: 64,
              fontFamily: 'Inter',
              fontWeight: 700,
              color: '#ffffff',
              textAlign: 'center',
              zIndex: 1,
            },
            {
              id: 'body-1',
              type: 'text',
              x: 8.3,
              y: 44.4,
              width: 83.3,
              height: 27.8,
              content: 'Double click text to edit content',
              fontSize: 36,
              fontFamily: 'Inter',
              fontWeight: 500,
              color: 'rgba(255, 255, 255, 0.85)',
              textAlign: 'center',
              zIndex: 2,
            },
          ],
        },
      ],
    };
  });

  const [history, setHistory] = useState<PresentationDeck[]>([]);
  const [historyPointer, setHistoryPointer] = useState(-1);

  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [smartSnap, setSmartSnap] = useState(true);

  /* An imported PowerPoint deck is rendered from its own package, not from the
     stored title/body pair — those are only what the library grid and search
     read. The package is reopened here so the editor shows the real slides. */
  const isPptxDeck = deck.sourceType === 'pptx';
  const pkg = useDeckPackage(deck, isSlideEditorOpen && isPptxDeck);

  /* Undo for an imported deck works on the slide's XML, not on the deck
     record — the parsed records hold live XML node references and cannot be
     cloned. So it needs its own stack, separate from the native deck history
     above, and the header routes to whichever one applies. */
  const [importStatus, setImportStatus] = useState<string | null>(null);


  const [pptxRevision, setPptxRevision] = useState(0);
  /* Lifted out of the deck view so the chrome's Design and Layer tabs act on
     the same selection the canvas shows. */
  const [pptxSelected, setPptxSelected] = useState<ParsedShape[]>([]);
  const setPptxSelection = useCallback((shapes: ParsedShape[]) => setPptxSelected(shapes), []);

  /* The rail draws PowerPoint slides with the same canvas as the board, so a
     thumbnail cannot drift from what it is a thumbnail of. */
  const renderPptxThumb = useCallback((index: number) => {
    const slide = pkg.slides[index];
    if (!slide?.parsed) return <div style={{ height: 90, width: '100%' }} />;
    return (
      <SlideCanvas
        slide={slide}
        slideSizeEmu={pkg.slideSizeEmu}
        width={RAIL_THUMB_W}
        dynamicAutofit={false}
        revision={pptxRevision}
      />
    );
  }, [pkg.slides, pkg.slideSizeEmu, pptxRevision]);

  const pptxHistory = useSlideHistory(
    pkg.activeIndex,
    /* An undo re-parses the slide, which replaces its record with a new
       object — so the package has to re-publish, not just bump a counter, or
       the canvas keeps rendering the pre-undo shapes. */
    useCallback(() => {
      pkg.refresh();
      setPptxRevision((n) => n + 1);
    }, [pkg.refresh]),
    isPptxDeck,
  );

  // Sync deck when activePresentationId changes
  useEffect(() => {
    if (!isSlideEditorOpen) return;
    const existing = presentationDecks.find((d) => d.id === activePresentationId);
    if (existing && existing.slides.length > 0) {
      setDeck(existing);
      setHistory([existing]);
      setHistoryPointer(0);
    } else {
      const scene = scenes.find((sc) => sc.id === activePresentationId);
      const title = scene?.name || 'Untitled Presentation';
      const slides = scene?.content?.slides || [];
      if (slides.length > 0) {
        const newDeck: PresentationDeck = {
          id: activePresentationId || `deck-${Date.now()}`,
          title,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          aspectRatio: '16:9',
          slides: slides.map((s, idx) => ({
            id: s.id || `slide-${idx + 1}`,
            title: s.title || `Slide ${idx + 1}`,
            body: s.text || '',
            label: s.label || `Slide ${idx + 1}`,
            notes: s.notes || '',
            transition: 'fade',
            durationMs: 3000,
            hidden: false,
            buildCount: 1,
            buildStep: 1,
            background: { type: 'color', value: '#18181b' },
            aspectRatio: '16:9',
          })),
        };
        setDeck(newDeck);
        setHistory([newDeck]);
        setHistoryPointer(0);
      }
    }
  }, [isSlideEditorOpen, activePresentationId, presentationDecks, scenes]);

  // Push new deck state into history stack
  const updateDeckState = (updater: (prev: PresentationDeck) => PresentationDeck) => {
    setDeck((prev) => {
      const next = updater(prev);
      const newHistory = history.slice(0, historyPointer + 1);
      newHistory.push(next);
      setHistory(newHistory);
      setHistoryPointer(newHistory.length - 1);
      return next;
    });
  };

  // Import File Handler (PPTX, PDF, JSON, TXT, MD, Images)
  const handleImportFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const reader = new FileReader();

    if (ext === 'json') {
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          if (parsed && Array.isArray(parsed.slides)) {
            updateDeckState(() => ({ ...parsed, id: deck.id, title: parsed.title || file.name.replace(/\.json$/, '') }));
          } else if (Array.isArray(parsed)) {
            updateDeckState((prev) => ({ ...prev, slides: parsed }));
          }
        } catch (err) {
          console.error('Failed to parse JSON presentation', err);
        }
      };
      reader.readAsText(file);
    } else if (ext === 'txt' || ext === 'md') {
      reader.onload = (e) => {
        const rawText = e.target?.result as string;
        const blocks = rawText.split(/\n\s*\n/).filter((b) => b.trim().length > 0);
        const importedSlides: PresentationSlide[] = blocks.map((block, idx) => {
          const lines = block.trim().split('\n');
          const title = lines[0].replace(/^#+\s*/, '').trim();
          const body = lines.slice(1).join('\n').trim();
          return {
            id: `imported-${idx}-${Date.now()}`,
            title: title || `Slide ${idx + 1}`,
            body: body || title,
            label: `Slide ${idx + 1}`,
            notes: '',
            transition: 'fade',
            durationMs: 3000,
            hidden: false,
            buildCount: 1,
            buildStep: 1,
            background: { type: 'color', value: '#18181b' },
            aspectRatio: '16:9',
            elements: [
              {
                id: `title-${idx}`,
                type: 'text',
                x: 10,
                y: 20,
                width: 80,
                height: 25,
                content: title,
                fontSize: 54,
                fontFamily: 'Inter',
                fontWeight: 700,
                color: '#ffffff',
                textAlign: 'center',
                zIndex: 1,
              },
              ...(body ? [{
                id: `body-${idx}`,
                type: 'text' as const,
                x: 15,
                y: 50,
                width: 70,
                height: 35,
                content: body,
                fontSize: 32,
                fontFamily: 'Inter',
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.85)',
                textAlign: 'center' as const,
                zIndex: 2,
              }] : []),
            ],
          };
        });

        if (importedSlides.length > 0) {
          updateDeckState((prev) => ({
            ...prev,
            title: file.name.replace(/\.[^/.]+$/, ''),
            slides: importedSlides,
          }));
          setActiveSlideIndex(0);
        }
      };
      reader.readAsText(file);
    } else if (file.type.startsWith('image/')) {
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        const newSlide: PresentationSlide = {
          id: `img-slide-${Date.now()}`,
          title: file.name.replace(/\.[^/.]+$/, ''),
          body: '',
          label: `Slide ${slides.length + 1}`,
          notes: '',
          transition: 'fade',
          durationMs: 3000,
          hidden: false,
          buildCount: 1,
          buildStep: 1,
          background: { type: 'image', value: imageUrl },
          aspectRatio: '16:9',
        };
        updateDeckState((prev) => ({ ...prev, slides: [...slides, newSlide] }));
        setActiveSlideIndex(slides.length);
      };
      reader.readAsDataURL(file);
    } else if (ext === 'pptx') {
      /* The real engine, the same one the Slides page uses. This branch used
         to discard the file's bytes and fabricate a blue-gradient slide named
         after it, which looked like an import and was not one. */
      setImportStatus(`Reading ${file.name}…`);
      const result = await buildDeckFromPptx(file, (done, total) => {
        setImportStatus(`Parsing slide ${done} of ${total}…`);
      });
      if ('error' in result) {
        setImportStatus(result.error);
        return;
      }
      // A PowerPoint deck is its own deck, not slides appended to this one:
      // it carries its own masters, theme and slide size.
      addPresentationDeck(result.deck);
      setImportStatus(null);
      openSlideEditor(result.deck.id);
    } else {
      setImportStatus(`${ext ? ext.toUpperCase() : 'That file type'} import is not supported yet — PowerPoint (.pptx), JSON, TXT, MD and images are.`);
    }
  };

  const handleUndo = () => {
    if (historyPointer > 0) {
      const prev = history[historyPointer - 1];
      setHistoryPointer(historyPointer - 1);
      setDeck(prev);
    }
  };

  const handleRedo = () => {
    if (historyPointer < history.length - 1) {
      const next = history[historyPointer + 1];
      setHistoryPointer(historyPointer + 1);
      setDeck(next);
    }
  };

  if (!isSlideEditorOpen) return null;

  const slides = deck.slides.length > 0 ? deck.slides : [
    {
      id: 'slide-default',
      title: 'Untitled Slide',
      body: 'Double click to edit',
      label: 'Slide 1',
      notes: '',
      transition: 'fade' as const,
      durationMs: 3000,
      hidden: false,
      buildCount: 1,
      buildStep: 1,
      background: { type: 'color' as const, value: '#18181b' },
      aspectRatio: '16:9' as const,
    },
  ];

  const activeSlide = slides[activeSlideIndex] || slides[0];
  const selectedElement = activeSlide.elements?.find((el) => el.id === selectedElementId) || null;

  // Tool Selection Handlers
  const handleSelectTool = (tool: ActiveTool) => {
    setActiveTool(tool);
    if (tool === 'text') {
      const newElement: SlideElement = {
        id: `text-${Date.now()}`,
        type: 'text',
        x: 25,
        y: 37,
        width: 50,
        height: 16.7,
        content: 'New Text Box',
        fontSize: 48,
        fontFamily: 'Inter',
        fontWeight: 600,
        color: '#ffffff',
        textAlign: 'center',
        zIndex: (activeSlide.elements?.length || 0) + 1,
      };
      handleUpdateSlideElements([...(activeSlide.elements || []), newElement]);
      setSelectedElementId(newElement.id);
      setActiveTool('select');
    } else if (tool === 'box' || tool === 'circle') {
      const newElement: SlideElement = {
        id: `shape-${Date.now()}`,
        type: 'shape',
        x: 34.4,
        y: 33.3,
        width: 31.3,
        height: 33.3,
        content: tool === 'circle' ? 'circle' : 'rectangle',
        backgroundColor: 'rgba(244, 98, 31, 0.25)',
        borderColor: '#f4621f',
        borderWidth: 3,
        borderRadius: tool === 'circle' ? 300 : 12,
        zIndex: (activeSlide.elements?.length || 0) + 1,
      };
      handleUpdateSlideElements([...(activeSlide.elements || []), newElement]);
      setSelectedElementId(newElement.id);
      setActiveTool('select');
    }
  };

  // Slide CRUD Actions
  function handleAddSlide() {
    const newSlide: PresentationSlide = {
      id: `slide-${Date.now()}`,
      title: 'New Slide',
      body: 'Double click to edit body',
      label: `Slide ${slides.length + 1}`,
      notes: '',
      transition: 'fade',
      durationMs: 3000,
      hidden: false,
      buildCount: 1,
      buildStep: 1,
      background: { type: 'color', value: '#18181b' },
      aspectRatio: deck.aspectRatio || '16:9',
      elements: [
        {
          id: `title-${Date.now()}`,
          type: 'text',
          x: 6.3,
          y: 20.4,
          width: 87.5,
          height: 18.5,
          content: 'New Slide Title',
          fontSize: 64,
          fontFamily: 'Inter',
          fontWeight: 700,
          color: '#ffffff',
          textAlign: 'center',
          zIndex: 1,
        },
      ],
    };
    const nextSlides = [...slides, newSlide];
    updateDeckState((prev) => ({ ...prev, slides: nextSlides }));
    setActiveSlideIndex(nextSlides.length - 1);
  }

  function handleDuplicateSlide(index: number) {
    const target = slides[index];
    if (!target) return;
    const duplicated: PresentationSlide = {
      ...target,
      id: `slide-${Date.now()}`,
      title: `${target.title} (Copy)`,
      elements: target.elements?.map((el) => ({ ...el, id: `${el.id}-copy-${Date.now()}` })),
    };
    const nextSlides = [...slides];
    nextSlides.splice(index + 1, 0, duplicated);
    updateDeckState((prev) => ({ ...prev, slides: nextSlides }));
    setActiveSlideIndex(index + 1);
  }

  function handleDeleteSlide(index: number) {
    if (slides.length <= 1) return;
    const nextSlides = slides.filter((_, i) => i !== index);
    updateDeckState((prev) => ({ ...prev, slides: nextSlides }));
    setActiveSlideIndex(Math.min(index, nextSlides.length - 1));
  }

  function handleMoveSlide(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= slides.length) return;
    const nextSlides = [...slides];
    const [moved] = nextSlides.splice(fromIndex, 1);
    nextSlides.splice(toIndex, 0, moved);
    updateDeckState((prev) => ({ ...prev, slides: nextSlides }));
    setActiveSlideIndex(toIndex);
  }

  function handleApplyTemplate(templateType: string) {
    let tplBg = 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)';
    if (templateType === 'announcement') tplBg = 'linear-gradient(135deg, #f97316 0%, #7c2d12 100%)';
    if (templateType === 'sermon') tplBg = 'linear-gradient(135deg, #18181b 0%, #09090b 100%)';

    handleUpdateSlide({
      background: { type: 'gradient', value: tplBg },
      aspectRatio: templateType === 'lower-third' ? 'lower-third' : '16:9',
    });
  }

  function handleUpdateSlide(updates: Partial<PresentationSlide>) {
    const updatedSlides = slides.map((s, idx) => (idx === activeSlideIndex ? { ...s, ...updates } : s));
    updateDeckState((prev) => ({ ...prev, slides: updatedSlides }));
  }

  function handleUpdateSlideElements(elements: SlideElement[]) {
    handleUpdateSlide({ elements });
  }

  function handleUpdateElement(elementId: string, updates: Partial<SlideElement>) {
    const currentElements = activeSlide.elements || [];
    const updatedElements = currentElements.map((el) => (el.id === elementId ? { ...el, ...updates } : el));
    handleUpdateSlideElements(updatedElements);
  }

  function handleDeleteElement(elementId: string) {
    const currentElements = activeSlide.elements || [];
    const updatedElements = currentElements.filter((el) => el.id !== elementId);
    handleUpdateSlideElements(updatedElements);
    setSelectedElementId(null);
  }

  function handleSaveToDeck() {
    addPresentationDeck(isPptxDeck ? deckWithPptxEdits() : deck);
    closeSlideEditor();
  }

  /**
   * Fold this session's slide edits into the deck record.
   *
   * The OOXML goes on the slide as `editor`, which is what gets written back
   * into the package on reopen. The title and body are re-derived from the
   * edited shapes by the same reader the import used, so the library grid and
   * search see the new wording rather than the wording at import time.
   */
  function deckWithPptxEdits(): PresentationDeck {
    const edits = pkg.collectEdits();
    if (edits.size === 0) return deck;

    const slides = deck.slides.map((slide, index) => {
      const edit = edits.get(index);
      if (!edit) return slide;
      const parsed = pkg.slides[index];
      const text = parsed ? deriveSlideText(parsed, index) : null;
      return {
        ...slide,
        title: text ? text.title : slide.title,
        body: text ? text.body : slide.body,
        editor: edit,
      };
    });

    return { ...deck, slides, updatedAt: Date.now() };
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#0b0d12',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-ui)',
        color: '#ffffff',
      }}
    >
      {/* Top Header */}
      <SlideEditorHeader
        title={deck.title}
        onUpdateTitle={(title) => updateDeckState((prev) => ({ ...prev, title }))}
        canUndo={isPptxDeck ? pptxHistory.canUndo : historyPointer > 0}
        canRedo={isPptxDeck ? pptxHistory.canRedo : historyPointer < history.length - 1}
        onUndo={isPptxDeck ? pptxHistory.undo : handleUndo}
        onRedo={isPptxDeck ? pptxHistory.redo : handleRedo}
        onImportFile={handleImportFile}
        onBackToDeck={closeSlideEditor}
        onSaveToDeck={handleSaveToDeck}
        onSaveExport={handleSaveToDeck}
      />

      {importStatus && (
        <div
          onClick={() => setImportStatus(null)}
          style={{
            padding: '8px 16px',
            fontSize: 12,
            color: 'rgba(255,255,255,0.75)',
            background: '#16191f',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer',
          }}
        >
          {importStatus}
        </div>
      )}

      {/* Main Studio Body Workspace */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        <>
        {/* Left Rail */}
        <SlideEditorLeftRail
          slides={isPptxDeck ? deck.slides : slides}
          activeSlideIndex={isPptxDeck ? pkg.activeIndex : activeSlideIndex}
          onSelectSlide={(idx) => {
            if (isPptxDeck) { pkg.setActiveIndex(idx); return; }
            setActiveSlideIndex(idx);
            setSelectedElementId(null);
          }}
          renderThumb={isPptxDeck ? renderPptxThumb : undefined}
          readOnlyDeck={isPptxDeck}
          onAddSlide={handleAddSlide}
          onDuplicateSlide={handleDuplicateSlide}
          onDeleteSlide={handleDeleteSlide}
          onMoveSlide={handleMoveSlide}
          onApplyTemplate={handleApplyTemplate}
        />

        {/* Center Freeboard Viewport */}
        {isPptxDeck ? (
          <PptxDeckView
            slides={pkg.slides}
            slideSizeEmu={pkg.slideSizeEmu}
            activeIndex={pkg.activeIndex}
            onSelectSlide={pkg.setActiveIndex}
            status={pkg.status}
            onEdited={pptxHistory.record}
            onSlideShown={pptxHistory.ensureBaseline}
            externalRevision={pptxRevision}
            onSelectionChange={setPptxSelection}
            showRail={false}
            showInspector={false}
          />
        ) : (
        <SlideEditorCanvasBoard
          slide={activeSlide}
          activeTool={activeTool}
          selectedElementId={selectedElementId}
          onSelectElement={setSelectedElementId}
          onUpdateElement={handleUpdateElement}
          onUpdateSlideText={(title, body) => handleUpdateSlide({ title, body })}
          smartSnap={smartSnap}
        />
        )}

        {/* Bottom Floating Quick Toolbar */}
        <SlideEditorQuickToolbar
          activeTool={activeTool}
          onSelectTool={handleSelectTool}
          smartSnap={smartSnap}
          onToggleSmartSnap={() => setSmartSnap(!smartSnap)}
        />

        {/* Right Inspector Sidebar */}
        <SlideEditorRightSidebar
          slide={activeSlide}
          selectedElement={selectedElement}
          onUpdateSlide={handleUpdateSlide}
          onUpdateElement={handleUpdateElement}
          onDeleteElement={handleDeleteElement}
        />
        </>
      </div>
    </div>
  );
}
