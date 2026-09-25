import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import { SlideEditorHeader } from './slide-editor/SlideEditorHeader';
import { SlideEditorLeftRail } from './slide-editor/SlideEditorLeftRail';
import { SlideEditorQuickToolbar, type ActiveTool } from './slide-editor/SlideEditorQuickToolbar';
import { SlideEditorCanvasBoard } from './slide-editor/SlideEditorCanvasBoard';
import { SlideEditorRightSidebar, type PptxInspector } from './slide-editor/SlideEditorRightSidebar';
import type { LayerRow } from './slide-editor/LayerList';
import { PptxDeckView } from './PptxDeckView';
import { SlideCanvas } from './SlideCanvas';
import { NativeSlideBoard, slideElementsFor } from './NativeSlideBoard';
import type { ParsedShape } from '../slide-engine/parser/slide-parser';

/** Width the rail draws PowerPoint thumbnails at. */
const RAIL_THUMB_W = 150;
import { useDeckPackage } from '../hooks/useDeckPackage';
import { useSlideHistory } from '../hooks/useSlideHistory';
import { deriveSlideText } from '../slide-engine/io/deck-import';
import { buildDeckFromPptx } from '../hooks/usePptxImport';
import { markSlideDirty } from '../slide-engine/io/save';
import { setShapeText } from '../slide-engine/edit/text';
import {
  deleteShapes,
  reorderShapes,
  setShapesFill,
  setShapesStroke,
  setShapesTextColor,
  setShapesFontFamily,
  setShapesFontWeight,
  setShapesFontSize,
  setShapesLineHeight,
  setShapesLetterSpacing,
  setShapesTextAlign,
} from '../slide-engine/edit/style';
import { groupShapes, layerUnits, moveLayerUnit, selectionHasGroup, ungroupShapes } from '../slide-engine/edit/grouping';
import type { SelectionState } from '../slide-engine/edit/geometry';
import type { PresentationDeck, PresentationSlide, SlideElement, SlideBackground } from '../types';
import { getCustomTemplates } from '../services/customTemplateStore';
import { importSlideImage } from '../utils/import-slide-image';
import { useI18n } from '../../i18n/useI18n';

export function SlideEditorModal() {
  const { t } = useI18n();
  const isSlideEditorOpen = useAppStore((s) => s.isSlideEditorOpen);
  const closeSlideEditor = useAppStore((s) => s.closeSlideEditor);
  const activePresentationId = useAppStore((s) => s.activePresentationId);
  const presentationDecks = useAppStore((s) => s.presentationDecks);
  const addPresentationDeck = useAppStore((s) => s.addPresentationDeck);
  const scenes = useAppStore((s) => s.scenes);
  const openSlideEditor = useAppStore((s) => s.openSlideEditor);
  const uiThemeMode = useAppStore((s) => s.uiThemeMode);
  const isDarkUI = uiThemeMode !== 'light';
  const defaultSlideBg: SlideBackground = isDarkUI
    ? { type: 'color', value: '#ffffff' }
    : { type: 'color', value: '#18181b' };
  const defaultSlideTextColor = isDarkUI ? '#000000' : '#ffffff';

  // Deck State
  const [deck, setDeck] = useState<PresentationDeck>(() => {
    const existing = presentationDecks.find((d) => d.id === activePresentationId);
    if (existing) return existing;
    const isDark = useAppStore.getState().uiThemeMode !== 'light';
    const initBg: SlideBackground = isDark
      ? { type: 'color', value: '#ffffff' }
      : { type: 'color', value: '#18181b' };
    const initTextColor = isDark ? '#000000' : '#ffffff';

    return {
      id: activePresentationId || `deck-${Date.now()}`,
      title: t('slideEditor.defaults.untitledPresentation'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      aspectRatio: '16:9',
      slides: [
        {
          id: 'slide-1',
          title: t('slideEditor.defaults.welcomePresentation'),
          body: '',
          label: 'Slide 1',
          notes: '',
          transition: 'fade',
          durationMs: 3000,
          hidden: false,
          buildCount: 1,
          buildStep: 1,
          background: initBg,
          aspectRatio: '16:9',
          elements: [
            {
              id: 'title-1',
              type: 'text',
              x: 6.3,
              y: 35.0,
              width: 87.5,
              height: 25.0,
              content: t('slideEditor.defaults.welcomePresentation'),
              fontSize: 64,
              fontFamily: 'Inter',
              fontWeight: 700,
              color: initTextColor,
              textAlign: 'center',
              zIndex: 1,
            },
          ],
        },
      ],
    };
  });

  const [history, setHistory] = useState<PresentationDeck[]>(() => [deck]);
  const [historyPointer, setHistoryPointer] = useState(0);
  const deckRef = useRef<PresentationDeck>(deck);
  const historyRef = useRef<PresentationDeck[]>([deck]);
  const historyPointerRef = useRef(0);

  useEffect(() => {
    historyRef.current = history;
    historyPointerRef.current = historyPointer;
    deckRef.current = deck;
  }, [history, historyPointer, deck]);

  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'single' | 'artboard'>('artboard');
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const selectedElementId = selectedElementIds[selectedElementIds.length - 1] || null;
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [activeStrokeWidth, setActiveStrokeWidth] = useState<number>(4);
  const [smartSnap, setSmartSnap] = useState(true);
  const [clipToCanvas, setClipToCanvas] = useState(false);

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


  /* Edits mutate the parsed records and the XML nodes behind them in place —
     that is what lets a save round-trip into the .pptx — so React needs an
     explicit nudge to repaint, and everything derived from the shapes has to
     hang off this rather than off object identity. */
  const [pptxRevision, setPptxRevision] = useState(0);
  /* Lifted out of the deck view so the chrome's Design and Layer tabs act on
     the same selection the canvas shows. */
  const [pptxSelection, setPptxSelection] = useState<SelectionState | null>(null);
  // A selection is only meaningful for the slide it was made on.
  useEffect(() => { setPptxSelection(null); }, [pkg.activeIndex]);

  /* The rail draws PowerPoint slides with the same canvas as the board, so a
     thumbnail cannot drift from what it is a thumbnail of. */
  const renderPptxThumb = useCallback((index: number, width = 180) => {
    const slide = pkg.slides[index];
    const thumbH = Math.round((width * 9) / 16);
    if (!slide?.parsed) return <div style={{ height: thumbH, width: '100%' }} />;
    return (
      <SlideCanvas
        slide={slide}
        slideSizeEmu={pkg.slideSizeEmu}
        width={width}
        dynamicAutofit={false}
        /* Only the slide being edited can have changed, and the revision ticks
           per keystroke — handing it to all of them would redraw the whole rail
           on every character typed. */
        revision={index === pkg.activeIndex ? pptxRevision : 0}
      />
    );
  }, [pkg.slides, pkg.slideSizeEmu, pkg.activeIndex, pptxRevision]);

  const pptxHistory = useSlideHistory(
    pkg.activeIndex,
    /* An undo re-parses the slide, which replaces its record with a new
       object — so the package has to re-publish, not just bump a counter, or
       the canvas keeps rendering the pre-undo shapes. The selection goes with
       them: it names shapes that no longer exist, and a stale one leaves the
       canvas showing a selection box around nothing it can act on. */
    useCallback(() => {
      pkg.refresh();
      setPptxSelection(null);
      setPptxRevision((n) => n + 1);
    }, [pkg.refresh]),
    isPptxDeck,
  );

  /* ---- PowerPoint editing -------------------------------------------------
     The engine that does the work sits below; these are the wires from the
     chrome's tabs and toolbar to it. They live here rather than in the deck
     view because the inspector, the layer list and the toolbar are all outside
     that view now, and every one of them acts on the same selection. */

  const pptxSlide = isPptxDeck ? pkg.slides[pkg.activeIndex] || null : null;
  const pptxShapes = (pptxSlide?.shapes as ParsedShape[]) || [];
  const pptxSelected = pptxSelection
    ? pptxShapes.filter((s) => pptxSelection.ids.includes(s.id))
    : [];

  /** An edit landed: snapshot it for undo and repaint from the new records. */
  const handlePptxEdited = useCallback(() => {
    pptxHistory.record();
    setPptxRevision((n) => n + 1);
  }, [pptxHistory]);

  const commitStyle = useCallback((fn: () => void) => {
    fn();
    markSlideDirty(pptxSlide);
    handlePptxEdited();
  }, [pptxSlide, handlePptxEdited]);

  const handlePptxReorder = useCallback((toFront: boolean) => {
    if (!pptxSlide || !pptxSelection) return;
    commitStyle(() => {
      pptxSlide.shapes = reorderShapes(pptxShapes, pptxSelection.ids, toFront);
    });
  }, [pptxSlide, pptxShapes, pptxSelection, commitStyle]);

  const handlePptxDelete = useCallback(() => {
    if (!pptxSlide || !pptxSelection) return;
    commitStyle(() => {
      pptxSlide.shapes = deleteShapes(pptxShapes, pptxSelection.ids, pptxSelection.groupNode);
    });
    setPptxSelection(null);
  }, [pptxSlide, pptxShapes, pptxSelection, commitStyle]);
  const slides: PresentationSlide[] = deck.slides.length > 0 ? deck.slides : [
    {
      id: 'slide-default',
      title: t('slideEditor.defaults.untitledSlide'),
      body: '',
      label: t('slideEditor.defaults.slideN', { n: 1 }),
      notes: '',
      transition: 'fade' as const,
      durationMs: 3000,
      hidden: false,
      buildCount: 1,
      buildStep: 1,
      background: defaultSlideBg,
      aspectRatio: '16:9' as const,
      elements: [],
    },
  ];

  const activeSlide = slides[activeSlideIndex] || slides[0];
  const activeSlideElements = slideElementsFor(activeSlide);
  const selectedElement = activeSlideElements.find((el) => el.id === selectedElementId) || null;

  const handleUndo = useCallback(() => {
    const p = historyPointerRef.current;
    const h = historyRef.current;
    if (p > 0) {
      const prev = h[p - 1];
      historyPointerRef.current = p - 1;
      setHistoryPointer(p - 1);
      setDeck(prev);
      deckRef.current = prev;
    }
  }, []);

  const handleRedo = useCallback(() => {
    const p = historyPointerRef.current;
    const h = historyRef.current;
    if (p < h.length - 1 && p >= 0) {
      const next = h[p + 1];
      historyPointerRef.current = p + 1;
      setHistoryPointer(p + 1);
      setDeck(next);
      deckRef.current = next;
    }
  }, []);

  // Push new deck state into history stack
  const updateDeckState = useCallback((updater: (prev: PresentationDeck) => PresentationDeck, recordHistory = true) => {
    setDeck((prev) => {
      const next = updater(prev);
      deckRef.current = next;
      if (recordHistory) {
        setHistory((h) => {
          const p = historyPointerRef.current;
          const newHistory = h.slice(0, p + 1);
          newHistory.push(next);
          historyRef.current = newHistory;
          historyPointerRef.current = newHistory.length - 1;
          setHistoryPointer(newHistory.length - 1);
          return newHistory;
        });
      }
      return next;
    });
  }, []);

  const commitHistorySnapshot = useCallback(() => {
    const currentDeck = deckRef.current;
    setHistory((h) => {
      const p = historyPointerRef.current;
      if (p >= 0 && h[p] === currentDeck) return h;
      const newHistory = h.slice(0, p + 1);
      newHistory.push(currentDeck);
      historyRef.current = newHistory;
      historyPointerRef.current = newHistory.length - 1;
      setHistoryPointer(newHistory.length - 1);
      return newHistory;
    });
  }, []);

  const handleUpdateSlide = useCallback((updates: Partial<PresentationSlide>, recordHistory = true) => {
    updateDeckState((prev) => {
      const currentSlides = prev.slides.length > 0 ? prev.slides : slides;
      const updatedSlides = currentSlides.map((s, idx) => (idx === activeSlideIndex ? { ...s, ...updates } : s));
      return { ...prev, slides: updatedSlides };
    }, recordHistory);
  }, [activeSlideIndex, slides, updateDeckState]);

  const handleSelectElement = useCallback((id: string | null, additive = false) => {
    if (id === null) {
      setSelectedElementIds([]);
      return;
    }
    if (additive) {
      setSelectedElementIds((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      );
    } else {
      setSelectedElementIds([id]);
    }
  }, []);

  const handleUpdateSlideElements = useCallback((elements: SlideElement[], recordHistory = true) => {
    handleUpdateSlide({ elements }, recordHistory);
  }, [handleUpdateSlide]);

  const handleUpdateElement = useCallback((elementId: string, updates: Partial<SlideElement>, recordHistory = true) => {
    updateDeckState((prev) => {
      const currentSlides = prev.slides.length > 0 ? prev.slides : slides;
      const targetSlide = currentSlides[activeSlideIndex] || currentSlides[0];
      const currentElements = slideElementsFor(targetSlide);
      const updatedElements = currentElements.map((el) => (el.id === elementId ? { ...el, ...updates } : el));
      const updatedSlides = currentSlides.map((s, idx) => (idx === activeSlideIndex ? { ...s, elements: updatedElements } : s));
      return { ...prev, slides: updatedSlides };
    }, recordHistory);
  }, [activeSlideIndex, slides, updateDeckState]);

  const handleDeleteElement = useCallback((elementId: string) => {
    const updatedElements = activeSlideElements.filter((el) => !selectedElementIds.includes(el.id) && el.id !== elementId);
    handleUpdateSlideElements(updatedElements);
    setSelectedElementIds([]);
  }, [activeSlideElements, selectedElementIds, handleUpdateSlideElements]);

  const handleDuplicateElements = useCallback((idsToDuplicate?: string[]) => {
    const targetIds = idsToDuplicate || selectedElementIds;
    if (!targetIds.length) return;
    const targets = activeSlideElements.filter((el) => targetIds.includes(el.id));
    if (!targets.length) return;

    const now = Date.now();
    const maxZ = Math.max(0, ...activeSlideElements.map((e) => e.zIndex || 1));
    const duplicates: SlideElement[] = targets.map((target, idx) => ({
      ...target,
      id: `el-${now}-${idx}`,
      x: Math.min(90, target.x + 3),
      y: Math.min(90, target.y + 3),
      zIndex: maxZ + 1 + idx,
    }));

    handleUpdateSlideElements([...activeSlideElements, ...duplicates]);
    setSelectedElementIds(duplicates.map((d) => d.id));
  }, [activeSlideElements, selectedElementIds, handleUpdateSlideElements]);

  // Tool Selection Handlers
  const handleSelectTool = useCallback((tool: ActiveTool | string) => {
    setActiveTool(tool as ActiveTool);
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
        zIndex: (activeSlideElements.length) + 1,
      };
      handleUpdateSlideElements([...activeSlideElements, newElement]);
      handleSelectElement(newElement.id);
      setActiveTool('select');
    } else if (tool === 'pencil' || tool === 'bezier') {
      setActiveTool(tool);
    } else if (['box', 'rectangle', 'rounded', 'circle', 'triangle', 'star', 'line'].includes(tool)) {
      const isCircle = tool === 'circle';
      const isRounded = tool === 'rounded';
      const isLine = tool === 'line';
      const isSquareLike = isCircle || tool === 'triangle' || tool === 'star';

      const elemWidth = isLine ? 31.3 : isSquareLike ? 20.3 : 31.3;
      const elemHeight = isLine ? 1 : isSquareLike ? 36.1 : 33.3;

      const newElement: SlideElement = {
        id: `shape-${Date.now()}`,
        type: 'shape',
        x: Math.round(((100 - elemWidth) / 2) * 10) / 10,
        y: isLine ? 48 : Math.round(((100 - elemHeight) / 2) * 10) / 10,
        width: elemWidth,
        height: elemHeight,
        content: tool,
        backgroundColor: '#FF5500',
        borderColor: '#FF5500',
        borderWidth: isLine ? 0 : 3,
        borderRadius: isCircle ? 300 : isRounded ? 12 : 0,
        zIndex: (activeSlideElements.length) + 1,
      };
      handleUpdateSlideElements([...activeSlideElements, newElement]);
      handleSelectElement(newElement.id);
      setActiveTool('select');
    } else if (tool === 'image') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (!file) return;
        setImportStatus(`Optimising ${file.name}…`);
        const imported = await importSlideImage(file);
        if ('error' in imported) {
          setImportStatus(imported.error);
          return;
        }
        const newElement: SlideElement = {
          id: `image-${Date.now()}`,
          type: 'image',
          content: imported.url,
          x: 20,
          y: 15,
          width: 60,
          height: 70,
          zIndex: (activeSlideElements.length) + 1,
        };
        handleUpdateSlideElements([...activeSlideElements, newElement]);
        handleSelectElement(newElement.id);
        setImportStatus(null);
      };
      input.click();
      setActiveTool('select');
    }
  }, [activeSlideElements, handleUpdateSlideElements, handleSelectElement]);

  /* Keyboard shortcuts for slide editor (Undo/Redo, Cmd+D duplicate, Delete, Cmd+A select all, Arrow nudge, V/T/P/B/R/O/C/L/H tool selection) */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      // Cmd/Ctrl +/-/0/1 (Canvas Zoom - Photoshop & Illustrator standard)
      if (e.metaKey || e.ctrlKey) {
        const key = e.key;
        const code = e.code;
        const keyCode = e.keyCode || e.which;

        const isZoomIn =
          key === '=' ||
          key === '+' ||
          key === 'Add' ||
          code === 'Equal' ||
          code === 'NumpadAdd' ||
          keyCode === 187 ||
          keyCode === 61 ||
          (e.shiftKey && (key === '+' || code === 'Equal'));

        const isZoomOut =
          key === '-' ||
          key === '_' ||
          key === 'Subtract' ||
          code === 'Minus' ||
          code === 'NumpadSubtract' ||
          keyCode === 189 ||
          keyCode === 173;

        const isFit = key === '0' || code === 'Digit0' || code === 'Numpad0' || keyCode === 48;
        const isActual = key === '1' || code === 'Digit1' || code === 'Numpad1' || keyCode === 49;

        if (isZoomIn) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('slide-editor-zoom-event', { detail: { action: 'in' } }));
          return;
        }
        if (isZoomOut) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('slide-editor-zoom-event', { detail: { action: 'out' } }));
          return;
        }
        if (isFit) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('slide-editor-zoom-event', { detail: { action: 'fit' } }));
          return;
        }
        if (isActual) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('slide-editor-zoom-event', { detail: { action: 'actual' } }));
          return;
        }
      }

      // Single Key Pro Design Tool Shortcuts (V, T, P, B, R, O, C, L, H)
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'v') {
          e.preventDefault();
          setActiveTool('select');
          return;
        }
        if (key === 't') {
          e.preventDefault();
          handleSelectTool('text');
          return;
        }
        if (key === 'p') {
          e.preventDefault();
          setActiveTool('bezier');
          return;
        }
        if (key === 'b') {
          e.preventDefault();
          setActiveTool('pencil');
          return;
        }
        if (key === 'r') {
          e.preventDefault();
          handleSelectTool('rectangle');
          return;
        }
        if (key === 'o' || key === 'c') {
          e.preventDefault();
          handleSelectTool('circle');
          return;
        }
        if (key === 'l') {
          e.preventDefault();
          handleSelectTool('line');
          return;
        }
        if (key === 'h') {
          e.preventDefault();
          setActiveTool('pan');
          return;
        }
      }

      // Cmd+Z / Ctrl+Z (Undo) & Cmd+Shift+Z / Ctrl+Shift+Z / Ctrl+Y (Redo)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          if (isPptxDeck) pptxHistory.redo();
          else handleRedo();
        } else {
          if (isPptxDeck) pptxHistory.undo();
          else handleUndo();
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (isPptxDeck) pptxHistory.redo();
        else handleRedo();
        return;
      }

      // Escape (Deselect all elements & reset active tool to Select mode)
      if (e.key === 'Escape') {
        setActiveTool('select');
        setSelectedElementIds([]);
        return;
      }

      // Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.defaultPrevented) return;
        const targetTag = (e.target as HTMLElement)?.tagName;
        if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
        if (isPptxDeck) {
          if (pptxSelection && pptxSelection.ids.length > 0) {
            e.preventDefault();
            handlePptxDelete();
          }
        } else {
          if (selectedElementIds.length > 0) {
            e.preventDefault();
            const updated = activeSlideElements.filter((el) => !selectedElementIds.includes(el.id));
            handleUpdateSlideElements(updated);
            setSelectedElementIds([]);
          }
        }
        return;
      }

      // Cmd+D / Ctrl+D (Duplicate selected elements)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        if (!isPptxDeck && selectedElementIds.length > 0) {
          e.preventDefault();
          handleDuplicateElements();
        }
        return;
      }

      // Cmd+A / Ctrl+A (Select All elements on slide)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        if (!isPptxDeck && activeSlideElements.length > 0) {
          e.preventDefault();
          setSelectedElementIds(activeSlideElements.map((el) => el.id));
        }
        return;
      }

      // Cmd + ] / Ctrl + ] (Move Up) & Cmd + [ / Ctrl + [ (Move Down)
      if ((e.metaKey || e.ctrlKey) && (e.key === ']' || e.key === '[')) {
        if (isPptxDeck) {
          if (pptxSelection && pptxSelection.ids.length > 0) {
            e.preventDefault();
            handlePptxReorder(e.key === ']');
          }
        } else {
          if (selectedElementIds.length > 0) {
            e.preventDefault();
            const dir = e.shiftKey ? (e.key === ']' ? 'top' : 'bottom') : (e.key === ']' ? 'up' : 'down');
            const currentEls = [...activeSlideElements];
            const elementsWithZ = currentEls.map((el, i) => ({
              ...el,
              zIndex: el.zIndex !== undefined ? el.zIndex : i + 1,
            }));
            const maxZ = Math.max(1, ...elementsWithZ.map((item) => item.zIndex));
            const minZ = Math.min(1, ...elementsWithZ.map((item) => item.zIndex));

            const updated = elementsWithZ.map((el) => {
              if (!selectedElementIds.includes(el.id) || el.locked) return el;
              let newZ = el.zIndex;
              if (dir === 'up') newZ = Math.min(maxZ + 5, el.zIndex + 1);
              if (dir === 'down') newZ = Math.max(1, el.zIndex - 1);
              if (dir === 'top') newZ = maxZ + 1;
              if (dir === 'bottom') newZ = Math.max(1, minZ - 1);
              return { ...el, zIndex: newZ };
            });
            handleUpdateSlideElements(updated);
          }
        }
        return;
      }

      // Arrow Keys (Nudge selected elements if elements are selected, or switch slide if no elements are selected)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (!isPptxDeck && selectedElementIds.length > 0) {
          e.preventDefault();
          const amount = e.shiftKey ? 2 : 0.5;
          const dx = e.key === 'ArrowLeft' ? -amount : e.key === 'ArrowRight' ? amount : 0;
          const dy = e.key === 'ArrowUp' ? -amount : e.key === 'ArrowDown' ? amount : 0;

          const updated = activeSlideElements.map((el) => {
            if (!selectedElementIds.includes(el.id) || el.locked) return el;
            return {
              ...el,
              x: parseFloat((el.x + dx).toFixed(1)),
              y: parseFloat((el.y + dy).toFixed(1)),
            };
          });
          handleUpdateSlideElements(updated);
        } else if (selectedElementIds.length === 0 && (!isPptxDeck || !pptxSelection?.ids?.length)) {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            const totalSlides = isPptxDeck ? (pkg.slides?.length || 0) : slides.length;
            const currentIdx = isPptxDeck ? pkg.activeIndex : activeSlideIndex;
            if (currentIdx < totalSlides - 1) {
              const nextIdx = currentIdx + 1;
              if (isPptxDeck) pkg.setActiveIndex(nextIdx);
              else setActiveSlideIndex(nextIdx);
            }
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const currentIdx = isPptxDeck ? pkg.activeIndex : activeSlideIndex;
            if (currentIdx > 0) {
              const prevIdx = currentIdx - 1;
              if (isPptxDeck) pkg.setActiveIndex(prevIdx);
              else setActiveSlideIndex(prevIdx);
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPptxDeck, pptxSelection, selectedElementIds, activeSlideElements, handlePptxDelete, handleDuplicateElements, handleUpdateSlideElements, handleUndo, handleRedo, pptxHistory, slides, activeSlideIndex, pkg]);

  const handlePptxTextEdit = useCallback((shape: ParsedShape, value: string) => {
    setShapeText(shape, value);
    markSlideDirty(pptxSlide);
    handlePptxEdited();
  }, [pptxSlide, handlePptxEdited]);

  /* Grouping is records-level and writes no XML, so there is nothing for the
     slide's undo stack to snapshot — only the repaint is needed. Marking the
     slide dirty here would also make an untouched deck look edited on save. */
  const handlePptxGroup = useCallback(() => {
    if (!pptxSelection) return;
    const next = groupShapes(pptxShapes, pptxSelection.ids);
    if (!next) return;
    setPptxSelection(next);
    setPptxRevision((n) => n + 1);
  }, [pptxShapes, pptxSelection]);

  const handlePptxUngroup = useCallback(() => {
    if (!pptxSelection) return;
    let released = 0;
    commitStyle(() => {
      released = ungroupShapes(pptxShapes, pptxSelection.ids);
    });
    if (released === 0) return;
    setPptxSelection({ ids: pptxSelection.ids, groupId: null, groupNode: null });
    setPptxRevision((n) => n + 1);
  }, [pptxShapes, pptxSelection, commitStyle]);

  /* The slide's stack, bottom entry first. Rebuilt whenever the records change
     — they mutate in place, so the revision is what marks them as changed. */
  const pptxLayers = useMemo(
    () => layerUnits(pptxShapes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pptxSlide, pptxRevision],
  );

  /** Layer rows read top first; `layerUnits` counts up from the bottom. */
  const pptxLayerRows: LayerRow[] = pptxLayers
    .map((unit) => ({
      id: unit.key,
      label: unit.label,
      kind: unit.kind,
      selected: !!pptxSelection && unit.ids.some((id) => pptxSelection.ids.includes(id)),
    }))
    .reverse();

  const handleSelectLayer = useCallback((key: string, additive: boolean) => {
    const unit = pptxLayers.find((u) => u.key === key);
    if (!unit) return;
    if (additive) {
      const current = pptxSelection?.ids || [];
      const already = unit.ids.every((id) => current.includes(id));
      const ids = already
        ? current.filter((id) => !unit.ids.includes(id))
        : [...new Set([...current, ...unit.ids])];
      setPptxSelection(ids.length ? { ids, groupId: null, groupNode: null } : null);
      return;
    }
    /* Match what a click on the canvas produces, so the two ways of selecting
       a group behave identically — including drilling into it afterwards. */
    const first = pptxShapes.find((s) => s.id === unit.ids[0]) || null;
    const grouped = unit.ids.length > 1 || unit.kind === 'group';
    setPptxSelection({
      ids: unit.ids,
      groupId: grouped ? ((first?.groupId as string) || null) : null,
      groupNode: grouped ? ((first?.groupNode as Element) || null) : null,
    });
  }, [pptxLayers, pptxShapes, pptxSelection]);

  const handleReorderLayer = useCallback((fromRow: number, toRow: number) => {
    if (!pptxSlide) return;
    // Row indices run top-down, unit indices bottom-up; both lists lose the
    // dragged entry before the drop lands, so the flip is the same either side.
    const n = pptxLayers.length;
    commitStyle(() => {
      pptxSlide.shapes = moveLayerUnit(pptxShapes, pptxLayers, n - 1 - fromRow, n - 1 - toRow);
    });
  }, [pptxSlide, pptxShapes, pptxLayers, commitStyle]);

  const handleDeleteLayer = useCallback((key: string) => {
    const unit = pptxLayers.find((u) => u.key === key);
    if (!unit || !pptxSlide) return;
    /* A real PowerPoint group goes as one <p:grpSp>, rather than each child
       being unhooked and an empty group left in the file. A records-level
       group is several spTree children and has to go one at a time. */
    const groupNode = unit.nodes.length === 1 && unit.nodes[0].localName === 'grpSp'
      ? unit.nodes[0]
      : null;
    commitStyle(() => {
      pptxSlide.shapes = deleteShapes(pptxShapes, unit.ids, groupNode);
    });
    setPptxSelection((sel) =>
      sel && sel.ids.some((id) => unit.ids.includes(id)) ? null : sel);
  }, [pptxLayers, pptxSlide, pptxShapes, commitStyle]);

  const pptxInspector: PptxInspector | null = isPptxDeck && !pkg.status && pptxSlide?.parsed
    ? {
        selected: pptxSelected,
        shapes: pptxShapes,
        layers: pptxLayerRows,
        onSelectLayer: handleSelectLayer,
        onReorderLayer: handleReorderLayer,
        onDeleteLayer: handleDeleteLayer,
        onFill: (hex) => commitStyle(() => setShapesFill(pptxSelected, hex)),
        onStroke: (hex, w) => commitStyle(() => setShapesStroke(pptxSelected, hex, w)),
        onTextColor: (hex) => commitStyle(() => setShapesTextColor(pptxSelected, hex)),
        onFontFamily: (font) => commitStyle(() => setShapesFontFamily(pptxSelected, font)),
        onFontWeight: (wt) => commitStyle(() => setShapesFontWeight(pptxSelected, wt)),
        onFontSize: (sz) => commitStyle(() => setShapesFontSize(pptxSelected, sz)),
        onLineHeight: (lh) => commitStyle(() => setShapesLineHeight(pptxSelected, lh)),
        onLetterSpacing: (ls) => commitStyle(() => setShapesLetterSpacing(pptxSelected, ls)),
        onTextAlign: (al) => commitStyle(() => setShapesTextAlign(pptxSelected, al)),
        onReorder: handlePptxReorder,
        onDelete: handlePptxDelete,
        onEditText: handlePptxTextEdit,
        onGroup: handlePptxGroup,
        onUngroup: handlePptxUngroup,
        canGroup: pptxSelected.length > 1,
        canUngroup: selectionHasGroup(pptxSelected),
      }
    : null;

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
      const title = scene?.name || t('slideEditor.defaults.untitledPresentation');
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
            title: s.title || t('slideEditor.defaults.slideN', { n: idx + 1 }),
            body: s.text || '',
            label: s.label || t('slideEditor.defaults.slideN', { n: idx + 1 }),
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
            title: title || t('slideEditor.defaults.slideN', { n: idx + 1 }),
            body: body || title,
            label: t('slideEditor.defaults.slideN', { n: idx + 1 }),
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
      setImportStatus(t('slideEditor.modal.importOptimising', { name: file.name }));
      const imported = await importSlideImage(file);
      if ('error' in imported) {
        setImportStatus(imported.error);
        return;
      }
      const newSlide: PresentationSlide = {
        id: `img-slide-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        body: '',
        label: t('slideEditor.defaults.slideN', { n: slides.length + 1 }),
        notes: '',
        transition: 'fade',
        durationMs: 3000,
        hidden: false,
        buildCount: 1,
        buildStep: 1,
        background: { type: 'image', value: imported.url },
        aspectRatio: '16:9',
      };
      updateDeckState((prev) => ({ ...prev, slides: [...slides, newSlide] }));
      setActiveSlideIndex(slides.length);
      setImportStatus(null);
    } else if (ext === 'pptx') {
      /* The real engine, the same one the Slides page uses. This branch used
         to discard the file's bytes and fabricate a blue-gradient slide named
         after it, which looked like an import and was not one. */
      setImportStatus(t('slideEditor.modal.importReading', { name: file.name }));
      const result = await buildDeckFromPptx(file, (done, total) => {
        setImportStatus(t('slideEditor.modal.importParsing', { done, total }));
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
      setImportStatus(t('slideEditor.errors.importNotSupported', { ext: ext ? ext.toUpperCase() : 'That file type' }));
    }
  };

  const renderNativeThumb = useCallback((index: number, width: number) => {
    const slide = slides[index];
    if (!slide) return null;
    return (
      <NativeSlideBoard
        elements={slideElementsFor(slide)}
        background={slide.background}
        width={width}
      />
    );
  }, [slides]);

  if (!isSlideEditorOpen) return null;

  function normalizeAndSortSlides2D(slidesList: PresentationSlide[]): PresentationSlide[] {
    if (slidesList.length === 0) return [];

    let minX = Infinity;
    let minY = Infinity;
    slidesList.forEach((s, idx) => {
      const gx = s.gridX ?? idx;
      const gy = s.gridY ?? 0;
      if (gx < minX) minX = gx;
      if (gy < minY) minY = gy;
    });

    if (minX === Infinity || minX > 0) minX = 0;
    if (minY === Infinity || minY > 0) minY = 0;

    const normalized = slidesList.map((s, idx) => ({
      ...s,
      gridX: (s.gridX ?? idx) - minX,
      gridY: (s.gridY ?? 0) - minY,
    }));

    normalized.sort((a, b) => {
      const rowDiff = (a.gridY ?? 0) - (b.gridY ?? 0);
      if (rowDiff !== 0) return rowDiff;
      return (a.gridX ?? 0) - (b.gridX ?? 0);
    });

    return normalized;
  }

  // Slide CRUD Actions
  function handleAddSlide() {
    let createdSlideId = `slide-${Date.now()}`;
    updateDeckState((prev) => {
      const current = prev.slides.length > 0 ? prev.slides : slides;
      const active = current[activeSlideIndex] || current[current.length - 1];
      const gx = active ? (active.gridX ?? activeSlideIndex) + 1 : current.length;
      const gy = active ? (active.gridY ?? 0) : 0;

      // Shift existing slides at or to the right on that row
      current.forEach((s) => {
        if ((s.gridY ?? 0) === gy && (s.gridX ?? 0) >= gx) {
          s.gridX = (s.gridX ?? 0) + 1;
        }
      });

      const newSlide: PresentationSlide = {
        id: createdSlideId,
        title: t('slideEditor.defaults.newSlide'),
        body: '',
        label: t('slideEditor.defaults.slideN', { n: current.length + 1 }),
        notes: '',
        transition: 'fade',
        durationMs: 3000,
        hidden: false,
        buildCount: 1,
        buildStep: 1,
        background: defaultSlideBg,
        aspectRatio: prev.aspectRatio || '16:9',
        gridX: gx,
        gridY: gy,
        elements: [
          {
            id: `title-${Date.now()}`,
            type: 'text',
            x: 6.3,
            y: 20.4,
            width: 87.5,
            height: 18.5,
            content: t('slideEditor.defaults.newSlideTitle'),
            fontSize: 64,
            fontFamily: 'Inter',
            fontWeight: 700,
            color: defaultSlideTextColor,
            textAlign: 'center',
            zIndex: 1,
          },
        ],
      };

      const sorted = normalizeAndSortSlides2D([...current, newSlide]);
      return { ...prev, slides: sorted };
    });

    setTimeout(() => {
      setDeck((latest) => {
        const foundIdx = latest.slides.findIndex((s) => s.id === createdSlideId);
        if (foundIdx >= 0) setActiveSlideIndex(foundIdx);
        return latest;
      });
    }, 0);

    setSelectedElementIds([]);
  }

  function handleAddSlideAt(direction: 'top' | 'bottom' | 'left' | 'right', fromIndex: number) {
    let createdSlideId = '';

    updateDeckState((prev) => {
      let lastAssignedGx = -1;
      let lastAssignedGy = 0;
      const currentSlides: PresentationSlide[] = (prev.slides.length > 0 ? prev.slides : [{
        id: 'slide-1',
        title: t('slideEditor.defaults.welcomePresentation'),
        body: '',
        label: t('slideEditor.defaults.slideN', { n: 1 }),
        notes: '',
        transition: 'fade' as const,
        durationMs: 3000,
        hidden: false,
        buildCount: 1,
        buildStep: 1,
        background: defaultSlideBg,
        aspectRatio: prev.aspectRatio || '16:9',
        elements: [],
      }]).map((s, idx) => {
        let gx = s.gridX;
        let gy = s.gridY;
        if (gx === undefined || gy === undefined) {
          gx = lastAssignedGx + 1;
          gy = lastAssignedGy;
        }
        lastAssignedGx = gx;
        lastAssignedGy = gy;
        return { ...s, gridX: gx, gridY: gy };
      });

      const validFrom = Math.max(0, Math.min(currentSlides.length - 1, fromIndex));
      const fromSlide = currentSlides[validFrom];
      const fromGx = fromSlide.gridX ?? validFrom;
      const fromGy = fromSlide.gridY ?? 0;

      const isOccupied = (gx: number, gy: number) => {
        return currentSlides.some((s) => (s.gridX ?? 0) === gx && (s.gridY ?? 0) === gy);
      };

      let newGx = fromGx;
      let newGy = fromGy;

      if (direction === 'bottom') {
        const targetGy = fromGy + 1;
        if (!isOccupied(fromGx, targetGy)) {
          // Empty slot exists directly below! Fill the column without shifting other rows down.
          newGx = fromGx;
          newGy = targetGy;
        } else {
          // Slot is occupied, create a new row between fromGy and fromGy + 1
          currentSlides.forEach((s) => {
            if ((s.gridY ?? 0) >= targetGy) {
              s.gridY = (s.gridY ?? 0) + 1;
            }
          });
          newGx = fromGx;
          newGy = targetGy;
        }
      } else if (direction === 'top') {
        if (fromGy > 0 && !isOccupied(fromGx, fromGy - 1)) {
          // Empty slot exists directly above! Fill the column without shifting other rows up.
          newGx = fromGx;
          newGy = fromGy - 1;
        } else if (fromGy === 0) {
          // At top edge, shift all rows down to create a new top row at 0
          currentSlides.forEach((s) => {
            s.gridY = (s.gridY ?? 0) + 1;
          });
          newGx = fromGx;
          newGy = 0;
        } else {
          // Above slot is occupied, insert a row at fromGy
          currentSlides.forEach((s) => {
            if ((s.gridY ?? 0) >= fromGy) {
              s.gridY = (s.gridY ?? 0) + 1;
            }
          });
          newGx = fromGx;
          newGy = fromGy;
        }
      } else if (direction === 'right') {
        const targetGx = fromGx + 1;
        if (!isOccupied(targetGx, fromGy)) {
          // Empty slot directly to the right!
          newGx = targetGx;
          newGy = fromGy;
        } else {
          // Slot is occupied, shift slides at or to the right of targetGx in this row
          currentSlides.forEach((s) => {
            if ((s.gridY ?? 0) === fromGy && (s.gridX ?? 0) >= targetGx) {
              s.gridX = (s.gridX ?? 0) + 1;
            }
          });
          newGx = targetGx;
          newGy = fromGy;
        }
      } else if (direction === 'left') {
        if (fromGx > 0 && !isOccupied(fromGx - 1, fromGy)) {
          // Empty slot directly to the left! Fill it without moving fromSlide
          newGx = fromGx - 1;
          newGy = fromGy;
        } else if (fromGx === 0) {
          // At the leftmost column edge: shift all columns across all rows right by 1
          currentSlides.forEach((s) => {
            s.gridX = (s.gridX ?? 0) + 1;
          });
          newGx = 0;
          newGy = fromGy;
        } else {
          // Slot (fromGx - 1) is occupied, so insert a column before fromGx: shift fromSlide and slides to its right
          currentSlides.forEach((s) => {
            if ((s.gridY ?? 0) === fromGy && (s.gridX ?? 0) >= fromGx) {
              s.gridX = (s.gridX ?? 0) + 1;
            }
          });
          newGx = fromGx;
          newGy = fromGy;
        }
      }

      createdSlideId = `slide-${Date.now()}`;
      const newSlide: PresentationSlide = {
        id: createdSlideId,
        title: t('slideEditor.defaults.newSlide'),
        body: '',
        label: t('slideEditor.defaults.slideN', { n: currentSlides.length + 1 }),
        notes: '',
        transition: 'fade',
        durationMs: 3000,
        hidden: false,
        buildCount: 1,
        buildStep: 1,
        background: defaultSlideBg,
        aspectRatio: prev.aspectRatio || '16:9',
        gridX: newGx,
        gridY: newGy,
        elements: [
          {
            id: `title-${Date.now()}`,
            type: 'text',
            x: 6.3,
            y: 20.4,
            width: 87.5,
            height: 18.5,
            content: t('slideEditor.defaults.newSlideTitle'),
            fontSize: 64,
            fontFamily: 'Inter',
            fontWeight: 700,
            color: defaultSlideTextColor,
            textAlign: 'center',
            zIndex: 1,
          },
        ],
      };

      currentSlides.push(newSlide);
      const sorted = normalizeAndSortSlides2D(currentSlides);
      return { ...prev, slides: sorted };
    });

    setTimeout(() => {
      setDeck((latest) => {
        const foundIdx = latest.slides.findIndex((s) => s.id === createdSlideId);
        if (foundIdx >= 0) {
          setActiveSlideIndex(foundIdx);
        }
        return latest;
      });
    }, 0);

    setSelectedElementIds([]);
  }

  function handleMoveElementBetweenSlides(
    fromIndex: number,
    toIndex: number,
    elementIds: string[],
    isDuplicate: boolean,
    dropCoords?: { x: number; y: number }
  ) {
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= slides.length || toIndex >= slides.length) return;
    const sourceSlide = slides[fromIndex];
    const targetSlide = slides[toIndex];
    if (!sourceSlide || !targetSlide) return;

    const sourceElements = slideElementsFor(sourceSlide);
    const targetElements = slideElementsFor(targetSlide);

    const itemsToTransfer = sourceElements.filter((el) => elementIds.includes(el.id));
    if (itemsToTransfer.length === 0) return;

    const now = Date.now();
    const maxZ = Math.max(0, ...targetElements.map((e) => e.zIndex || 1));

    const transferredElements: SlideElement[] = itemsToTransfer.map((el, idx) => {
      const newId = isDuplicate ? `el-${now}-${idx}` : el.id;
      let newX = el.x;
      let newY = el.y;
      if (dropCoords) {
        newX = Math.max(0, Math.min(95, Math.round(dropCoords.x * 10) / 10));
        newY = Math.max(0, Math.min(95, Math.round(dropCoords.y * 10) / 10));
      }
      return {
        ...el,
        id: newId,
        x: newX,
        y: newY,
        zIndex: maxZ + 1 + idx,
      };
    });

    const nextSourceElements = isDuplicate
      ? sourceElements
      : sourceElements.filter((el) => !elementIds.includes(el.id));

    const nextTargetElements = [...targetElements, ...transferredElements];

    updateDeckState((prev) => {
      const current = prev.slides.length > 0 ? prev.slides : slides;
      const updated = current.map((s, idx) => {
        if (idx === fromIndex && fromIndex === toIndex) {
          return { ...s, elements: nextTargetElements };
        }
        if (idx === fromIndex) {
          return { ...s, elements: nextSourceElements };
        }
        if (idx === toIndex) {
          return { ...s, elements: nextTargetElements };
        }
        return s;
      });
      return { ...prev, slides: updated };
    });

    setActiveSlideIndex(toIndex);
    setSelectedElementIds(transferredElements.map((el) => el.id));
  }

  function handleDuplicateSlide(index: number) {
    const target = slides[index];
    if (!target) return;
    let createdSlideId = `slide-${Date.now()}`;
    const duplicated: PresentationSlide = {
      ...target,
      id: createdSlideId,
      title: `${target.title}${t('slideEditor.defaults.copySuffix')}`,
      gridX: (target.gridX ?? index) + 1,
      gridY: target.gridY ?? 0,
      elements: target.elements?.map((el) => ({ ...el, id: `${el.id}-copy-${Date.now()}` })),
    };
    updateDeckState((prev) => {
      const current = prev.slides.length > 0 ? prev.slides : slides;
      current.forEach((s) => {
        if ((s.gridY ?? 0) === (target.gridY ?? 0) && (s.gridX ?? 0) >= (duplicated.gridX ?? 0)) {
          s.gridX = (s.gridX ?? 0) + 1;
        }
      });
      const sorted = normalizeAndSortSlides2D([...current, duplicated]);
      return { ...prev, slides: sorted };
    });
    setTimeout(() => {
      setDeck((latest) => {
        const foundIdx = latest.slides.findIndex((s) => s.id === createdSlideId);
        if (foundIdx >= 0) setActiveSlideIndex(foundIdx);
        return latest;
      });
    }, 0);
  }

  function handleDeleteSlide(index: number) {
    if (isPptxDeck) {
      if (pkg.slides.length <= 1) return;
      pkg.slides.splice(index, 1);
      deck.slides.splice(index, 1);
      pkg.setActiveIndex(Math.min(index, pkg.slides.length - 1));
      setPptxRevision((n) => n + 1);
      handleSaveToDeck();
      return;
    }
    if (slides.length <= 1) return;
    updateDeckState((prev) => {
      const remaining = (prev.slides.length > 0 ? prev.slides : slides).filter((_, i) => i !== index);
      const sorted = normalizeAndSortSlides2D(remaining);
      return { ...prev, slides: sorted };
    });
    setActiveSlideIndex(Math.min(index, slides.length - 2));
  }

  function handleMoveSlide(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    if (isPptxDeck) {
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= pkg.slides.length || toIndex >= pkg.slides.length) return;
      const [movedPkg] = pkg.slides.splice(fromIndex, 1);
      pkg.slides.splice(toIndex, 0, movedPkg);
      const [movedDeck] = deck.slides.splice(fromIndex, 1);
      deck.slides.splice(toIndex, 0, movedDeck);
      pkg.setActiveIndex(toIndex);
      setPptxRevision((n) => n + 1);
      handleSaveToDeck();
      return;
    }
    updateDeckState((prev) => {
      const currentSlides = prev.slides.length > 0 ? [...prev.slides] : [...slides];
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= currentSlides.length || toIndex >= currentSlides.length) return prev;

      // Extract existing sorted grid slots in reading order
      const existingGridSlots = currentSlides.map((s, idx) => ({
        gridX: s.gridX ?? idx,
        gridY: s.gridY ?? 0,
      }));

      // Reorder the slides array
      const [moved] = currentSlides.splice(fromIndex, 1);
      currentSlides.splice(toIndex, 0, moved);

      // Reassign spatial grid positions according to the reordered list
      const updated = currentSlides.map((s, idx) => ({
        ...s,
        gridX: existingGridSlots[idx]?.gridX ?? idx,
        gridY: existingGridSlots[idx]?.gridY ?? 0,
      }));

      const sorted = normalizeAndSortSlides2D(updated);
      return { ...prev, slides: sorted };
    });
    setActiveSlideIndex(toIndex);
  }

  function handleMoveArtboardToGrid(slideIndex: number, targetGridX: number, targetGridY: number) {
    if (slideIndex < 0 || slideIndex >= slides.length) return;
    const targetSlide = slides[slideIndex];
    if (!targetSlide) return;
    const targetSlideId = targetSlide.id;

    updateDeckState((prev) => {
      const currentSlides = (prev.slides.length > 0 ? prev.slides : slides).map((s, idx) => ({
        ...s,
        gridX: s.gridX ?? idx,
        gridY: s.gridY ?? 0,
      }));

      const moving = currentSlides[slideIndex];
      if (!moving) return prev;

      const oldGx = moving.gridX ?? slideIndex;
      const oldGy = moving.gridY ?? 0;

      if (oldGx === targetGridX && oldGy === targetGridY) return prev;

      // Check if another slide occupies the target slot
      const occupant = currentSlides.find((s, idx) => idx !== slideIndex && s.gridX === targetGridX && s.gridY === targetGridY);

      if (occupant) {
        // Swap positions with the occupant
        occupant.gridX = oldGx;
        occupant.gridY = oldGy;
        moving.gridX = targetGridX;
        moving.gridY = targetGridY;
      } else {
        // Move into empty grid slot directly
        moving.gridX = targetGridX;
        moving.gridY = targetGridY;
      }

      const sorted = normalizeAndSortSlides2D(currentSlides);
      return { ...prev, slides: sorted };
    });

    setTimeout(() => {
      setDeck((latest) => {
        const foundIdx = latest.slides.findIndex((s) => s.id === targetSlideId);
        if (foundIdx >= 0) {
          setActiveSlideIndex(foundIdx);
        }
        return latest;
      });
    }, 0);
  }

  function handleApplyTemplate(templateType: string) {
    if (templateType.startsWith('custom-tpl-')) {
      const customTemplates = getCustomTemplates();
      const match = customTemplates.find((t) => t.id === templateType);
      if (match) {
        const now = Date.now();
        const clonedEls: SlideElement[] = (match.elements || []).map((el, idx) => ({
          ...el,
          id: `el-${now}-${idx}`,
        }));
        handleUpdateSlide({
          background: match.background ? { ...match.background } : { type: 'color', value: '#18181b' },
          elements: clonedEls,
        });
        return;
      }
    }

    let tplBg = 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)';
    let elements: SlideElement[] = [];

    if (templateType === 'worship') {
      tplBg = 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)';
      elements = [
        {
          id: `el-${Date.now()}-1`,
          type: 'text',
          content: 'AMAZING GRACE, HOW SWEET THE SOUND',
          x: 10,
          y: 28,
          width: 80,
          height: 25,
          fontSize: 48,
          color: '#ffffff',
          fontWeight: 700,
          textAlign: 'center',
        },
        {
          id: `el-${Date.now()}-2`,
          type: 'text',
          content: 'That saved a wretch like me! I once was lost, but now am found',
          x: 10,
          y: 56,
          width: 80,
          height: 20,
          fontSize: 28,
          color: 'rgba(255, 255, 255, 0.8)',
          textAlign: 'center',
        },
      ];
    } else if (templateType === 'sermon') {
      tplBg = 'linear-gradient(135deg, #18181b 0%, #09090b 100%)';
      elements = [
        {
          id: `el-${Date.now()}-card`,
          type: 'shape',
          content: 'box',
          x: 8,
          y: 12,
          width: 84,
          height: 76,
          backgroundColor: 'rgba(35, 34, 33, 0.7)',
          borderColor: 'rgba(255, 85, 0, 0.3)',
          borderWidth: 1,
          borderRadius: 6,
        },
        {
          id: `el-${Date.now()}-badge`,
          type: 'shape',
          content: 'box',
          x: 12,
          y: 18,
          width: 6,
          height: 10,
          backgroundColor: '#FF5500',
          borderRadius: 6,
        },
        {
          id: `el-${Date.now()}-num`,
          type: 'text',
          content: '01',
          x: 12,
          y: 19,
          width: 6,
          height: 8,
          fontSize: 24,
          color: '#ffffff',
          fontWeight: 700,
          textAlign: 'center',
        },
        {
          id: `el-${Date.now()}-title`,
          type: 'text',
          content: 'FAITH OVER FEAR: WALKING IN PURPOSE',
          x: 20,
          y: 18,
          width: 68,
          height: 12,
          fontSize: 34,
          color: '#ffffff',
          fontWeight: 700,
        },
        {
          id: `el-${Date.now()}-body`,
          type: 'text',
          content: '• Trusting God in times of uncertainty\n• Stepping out of your comfort zone\n• Building a foundation rooted in Prayer',
          x: 20,
          y: 34,
          width: 68,
          height: 48,
          fontSize: 26,
          color: 'var(--text-secondary)',
        },
      ];
    } else if (templateType === 'scripture') {
      tplBg = 'linear-gradient(135deg, #0b132b 0%, #1c2541 100%)';
      elements = [
        {
          id: `el-${Date.now()}-verse`,
          type: 'text',
          content: '"For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life."',
          x: 10,
          y: 25,
          width: 80,
          height: 40,
          fontSize: 36,
          color: '#ffffff',
          fontWeight: 700,
          textAlign: 'center',
        },
        {
          id: `el-${Date.now()}-ref`,
          type: 'text',
          content: 'JOHN 3:16 (KJV)',
          x: 25,
          y: 70,
          width: 50,
          height: 12,
          fontSize: 26,
          color: '#FF5500',
          fontWeight: 700,
          textAlign: 'center',
        },
      ];
    } else if (templateType === 'lower-third') {
      tplBg = 'transparent';
      elements = [
        {
          id: `el-${Date.now()}-bg`,
          type: 'shape',
          content: 'box',
          x: 6,
          y: 70,
          width: 88,
          height: 22,
          backgroundColor: 'rgba(22, 20, 20, 0.92)',
          borderColor: '#FF5500',
          borderWidth: 2,
          borderRadius: 6,
        },
        {
          id: `el-${Date.now()}-name`,
          type: 'text',
          content: 'PASTOR DAVID E. JOHNSON',
          x: 10,
          y: 73,
          width: 80,
          height: 10,
          fontSize: 32,
          color: '#ffffff',
          fontWeight: 700,
        },
        {
          id: `el-${Date.now()}-role`,
          type: 'text',
          content: 'Senior Pastor · Grace Community Church',
          x: 10,
          y: 82,
          width: 80,
          height: 8,
          fontSize: 20,
          color: '#FF5500',
          fontWeight: 700,
        },
      ];
    } else if (templateType === 'announcement') {
      tplBg = 'linear-gradient(135deg, #4c1d95 0%, #831843 100%)';
      elements = [
        {
          id: `el-${Date.now()}-badge`,
          type: 'shape',
          content: 'box',
          x: 35,
          y: 15,
          width: 30,
          height: 8,
          backgroundColor: '#FF5500',
          borderRadius: 6,
        },
        {
          id: `el-${Date.now()}-badgetxt`,
          type: 'text',
          content: 'UPCOMING EVENT',
          x: 35,
          y: 16,
          width: 30,
          height: 6,
          fontSize: 16,
          color: '#ffffff',
          fontWeight: 700,
          textAlign: 'center',
        },
        {
          id: `el-${Date.now()}-title`,
          type: 'text',
          content: 'SUNDAY NIGHT WORSHIP & HEALING',
          x: 10,
          y: 28,
          width: 80,
          height: 25,
          fontSize: 44,
          color: '#ffffff',
          fontWeight: 700,
          textAlign: 'center',
        },
        {
          id: `el-${Date.now()}-details`,
          type: 'text',
          content: 'THIS SUNDAY · 6:00 PM · MAIN SANCTUARY\nJoin us for a powerful evening of praise, prayer and communion.',
          x: 10,
          y: 56,
          width: 80,
          height: 25,
          fontSize: 24,
          color: 'rgba(255, 255, 255, 0.85)',
          textAlign: 'center',
        },
      ];
    } else if (templateType === 'welcome') {
      tplBg = 'linear-gradient(135deg, #1c1917 0%, #292524 100%)';
      elements = [
        {
          id: `el-${Date.now()}-title`,
          type: 'text',
          content: 'WELCOME TO OUR CHURCH',
          x: 10,
          y: 30,
          width: 80,
          height: 25,
          fontSize: 52,
          color: '#ffffff',
          fontWeight: 700,
          textAlign: 'center',
        },
        {
          id: `el-${Date.now()}-sub`,
          type: 'text',
          content: 'We are so glad you are worshipping with us today!',
          x: 10,
          y: 58,
          width: 80,
          height: 18,
          fontSize: 28,
          color: '#FF5500',
          fontWeight: 700,
          textAlign: 'center',
        },
      ];
    } else if (templateType === 'offering') {
      tplBg = 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)';
      elements = [
        {
          id: `el-${Date.now()}-title`,
          type: 'text',
          content: 'TITHE & OFFERING',
          x: 10,
          y: 20,
          width: 80,
          height: 20,
          fontSize: 48,
          color: '#ffffff',
          fontWeight: 700,
          textAlign: 'center',
        },
        {
          id: `el-${Date.now()}-verse`,
          type: 'text',
          content: '"Honor the LORD with your wealth and with the firstfruits of all your produce." — Proverbs 3:9',
          x: 10,
          y: 42,
          width: 80,
          height: 18,
          fontSize: 22,
          color: 'rgba(255, 255, 255, 0.8)',
          textAlign: 'center',
        },
        {
          id: `el-${Date.now()}-ways`,
          type: 'text',
          content: 'GIVE ONLINE: www.church.org/give  |  TEXT TO GIVE: (800) 555-GIVE',
          x: 10,
          y: 64,
          width: 80,
          height: 15,
          fontSize: 24,
          color: 'var(--tally-preview)',
          fontWeight: 700,
          textAlign: 'center',
        },
      ];
    } else if (templateType === 'benediction') {
      tplBg = 'linear-gradient(135deg, #450a0a 0%, #1c0505 100%)';
      elements = [
        {
          id: `el-${Date.now()}-title`,
          type: 'text',
          content: 'GO IN PEACE & GRACE',
          x: 10,
          y: 30,
          width: 80,
          height: 25,
          fontSize: 48,
          color: '#ffffff',
          fontWeight: 700,
          textAlign: 'center',
        },
        {
          id: `el-${Date.now()}-sub`,
          type: 'text',
          content: 'The LORD bless you and keep you; the LORD make his face shine upon you.',
          x: 10,
          y: 58,
          width: 80,
          height: 20,
          fontSize: 26,
          color: '#FF5500',
          fontWeight: 700,
          textAlign: 'center',
        },
      ];
    }

    handleUpdateSlide({
      background: {
        type: templateType === 'lower-third' ? 'color' : 'gradient',
        value: tplBg,
      },
      aspectRatio: templateType === 'lower-third' ? 'lower-third' : '16:9',
      elements: elements.length > 0 ? elements : activeSlide.elements,
    });
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
        background: 'var(--bsp-ground, #111010)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-ui)',
        color: 'var(--text-primary, #ffffff)',
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
            handleSelectElement(null);
          }}
          renderThumb={isPptxDeck ? renderPptxThumb : renderNativeThumb}
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
            status={pkg.status}
            selection={pptxSelection}
            onSelectionChange={setPptxSelection}
            onEdited={handlePptxEdited}
            onSlideShown={pptxHistory.ensureBaseline}
            revision={pptxRevision}
          />
        ) : (
        <SlideEditorCanvasBoard
          slide={activeSlide}
          slides={slides}
          activeSlideIndex={activeSlideIndex}
          viewMode={viewMode}
          onToggleViewMode={() => setViewMode((m) => (m === 'artboard' ? 'single' : 'artboard'))}
          onSelectSlide={setActiveSlideIndex}
          onAddSlideAt={handleAddSlideAt}
          onMoveSlideToGrid={handleMoveArtboardToGrid}
          onMoveElementBetweenSlides={handleMoveElementBetweenSlides}
          activeTool={activeTool}
          strokeWidth={activeStrokeWidth}
          selectedElementId={selectedElementId}
          selectedElementIds={selectedElementIds}
          onSelectElement={handleSelectElement}
          onUpdateElement={handleUpdateElement}
          onCommitHistory={commitHistorySnapshot}
          onUpdateSlideText={(title, body) => handleUpdateSlide({ title, body })}
          onDuplicateElements={handleDuplicateElements}
          onAddElements={(newEls) => handleUpdateSlideElements([...activeSlideElements, ...newEls])}
          smartSnap={smartSnap}
          clipToCanvas={clipToCanvas}
          onToggleClipToCanvas={() => setClipToCanvas(!clipToCanvas)}
        />
        )}

        {/* Top Floating Quick Toolbar */}
        <SlideEditorQuickToolbar
          activeTool={activeTool}
          strokeWidth={activeStrokeWidth}
          onChangeStrokeWidth={setActiveStrokeWidth}
          onSelectTool={handleSelectTool}
          smartSnap={smartSnap}
          onToggleSmartSnap={() => setSmartSnap(!smartSnap)}
          clipToCanvas={clipToCanvas}
          onToggleClipToCanvas={() => setClipToCanvas(!clipToCanvas)}
          viewMode={viewMode}
          onToggleViewMode={() => setViewMode((m) => (m === 'artboard' ? 'single' : 'artboard'))}
          selectedElementId={selectedElementId}
          onUpdateElement={handleUpdateElement}
          onAddElements={(newEls) => handleUpdateSlideElements([...activeSlideElements, ...newEls])}
          pptx={pptxInspector ? {
            canGroup: pptxInspector.canGroup,
            canUngroup: pptxInspector.canUngroup,
            hasSelection: pptxSelected.length > 0,
            onGroup: handlePptxGroup,
            onUngroup: handlePptxUngroup,
            onReorder: handlePptxReorder,
            onDelete: handlePptxDelete,
          } : null}
        />

        {/* Right Inspector Sidebar */}
        <SlideEditorRightSidebar
          slide={activeSlide}
          selectedElement={selectedElement}
          selectedElementIds={selectedElementIds}
          onUpdateSlide={handleUpdateSlide}
          onUpdateElement={handleUpdateElement}
          onDeleteElement={handleDeleteElement}
          onDuplicateElements={handleDuplicateElements}
          onSelectElement={handleSelectElement}
          onReorderElements={handleUpdateSlideElements}
          pptx={pptxInspector}
        />
        </>
      </div>
    </div>
  );
}
