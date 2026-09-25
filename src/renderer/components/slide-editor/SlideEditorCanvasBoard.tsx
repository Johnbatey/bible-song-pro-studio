import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import type { PresentationSlide, SlideElement } from '../../types';
import { useAssetBaseUrl } from '../../hooks/useAssetBaseUrl';
import { slideElementsFor, hexToRgba } from '../NativeSlideBoard';
import { assetUrl } from '../../utils/asset-url';
import type { ActiveTool } from './SlideEditorQuickToolbar';
import { useI18n } from '../../../i18n/useI18n';

function computeTextShadow(el: SlideElement): string | undefined {
  if (el.shadowEnabled) {
    const col = el.shadowColor || '#000000';
    const blur = el.shadowBlur ?? 8;
    const x = el.shadowOffsetX ?? 0;
    const y = el.shadowOffsetY ?? 4;
    const opacity = el.shadowOpacity ?? 0.5;
    return `${x}px ${y}px ${blur}px ${hexToRgba(col, opacity)}`;
  }
  if (el.shadowEnabled === false) return undefined;
  return el.textShadow || undefined;
}

function computeBoxShadow(el: SlideElement): string | undefined {
  if (el.boxShadowEnabled) {
    const col = el.boxShadowColor || '#000000';
    const blur = el.boxShadowBlur ?? 12;
    const x = el.boxShadowOffsetX ?? 0;
    const y = el.boxShadowOffsetY ?? 6;
    const opacity = el.boxShadowOpacity ?? 0.4;
    return `${x}px ${y}px ${blur}px ${hexToRgba(col, opacity)}`;
  }
  if (el.boxShadowEnabled === false) return undefined;
  return el.boxShadow || undefined;
}

interface SlideEditorCanvasBoardProps {
  slide: PresentationSlide;
  slides?: PresentationSlide[];
  activeSlideIndex?: number;
  viewMode?: 'single' | 'artboard';
  onToggleViewMode?: () => void;
  onSelectSlide?: (index: number) => void;
  onAddSlideAt?: (direction: 'top' | 'bottom' | 'left' | 'right', fromIndex: number) => void;
  onMoveSlideToGrid?: (slideIndex: number, targetGridX: number, targetGridY: number) => void;
  onMoveElementBetweenSlides?: (
    fromIndex: number,
    toIndex: number,
    elementIds: string[],
    isDuplicate: boolean,
    dropCoords?: { x: number; y: number }
  ) => void;
  activeTool: ActiveTool;
  selectedElementId: string | null;
  selectedElementIds?: string[];
  onSelectElement: (id: string | null, additive?: boolean) => void;
  onUpdateElement: (id: string, updates: Partial<SlideElement>, recordHistory?: boolean) => void;
  onCommitHistory?: () => void;
  onUpdateSlideText: (title: string, body: string) => void;
  onDuplicateElements?: (ids?: string[]) => void;
  onAddElements?: (newEls: SlideElement[]) => void;
  smartSnap: boolean;
  strokeWidth?: number;
  clipToCanvas?: boolean;
  onToggleClipToCanvas?: () => void;
}

export function SlideEditorCanvasBoard({
  slide,
  slides: propsSlides,
  activeSlideIndex = 0,
  viewMode = 'artboard',
  onToggleViewMode,
  onSelectSlide,
  onAddSlideAt,
  onMoveSlideToGrid,
  onMoveElementBetweenSlides,
  activeTool,
  selectedElementId,
  selectedElementIds,
  onSelectElement,
  onUpdateElement,
  onCommitHistory,
  onUpdateSlideText,
  onDuplicateElements,
  onAddElements,
  smartSnap,
  strokeWidth = 4,
  clipToCanvas: propClipToCanvas,
  onToggleClipToCanvas,
}: SlideEditorCanvasBoardProps) {
  const { t } = useI18n();
  const [internalClipToCanvas, setInternalClipToCanvas] = useState(false);
  const clipToCanvas = propClipToCanvas !== undefined ? propClipToCanvas : internalClipToCanvas;
  const toggleClipToCanvas = onToggleClipToCanvas || (() => setInternalClipToCanvas(!internalClipToCanvas));

  const slideList = (propsSlides && propsSlides.length > 0) ? propsSlides : [slide];
  const currentActiveIndex = activeSlideIndex ?? 0;
  const [hoveredDropSlideIndex, setHoveredDropSlideIndex] = useState<number | null>(null);

  const [artboardDrag, setArtboardDrag] = useState<{
    slideIndex: number;
    startPointerX: number;
    startPointerY: number;
    startX: number;
    startY: number;
    deltaX: number;
    deltaY: number;
    targetGridX: number;
    targetGridY: number;
    isDragging: boolean;
  } | null>(null);

  const activeSelection = selectedElementIds && selectedElementIds.length > 0
    ? selectedElementIds
    : (selectedElementId ? [selectedElementId] : []);

  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; ox: number; oy: number } | null>(null);

  const [scale, setScale] = useState(0.75);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);

  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [snapGuides, setSnapGuides] = useState<{ x?: number; y?: number }>({});

  const [dragState, setDragState] = useState<{
    elementId: string;
    handle: string | null;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    initialW: number;
    initialH: number;
    multiDrag?: {
      id: string;
      initialX: number;
      initialY: number;
      width: number;
      height: number;
    }[];
  } | null>(null);

  const [drawingPencilId, setDrawingPencilId] = useState<string | null>(null);
  const [selectedBezierNodeIdx, setSelectedBezierNodeIdx] = useState<number | null>(null);
  const [selectedBezierHandleType, setSelectedBezierHandleType] = useState<'anchor' | 'h1' | 'h2' | null>(null);
  const [bezierHoverPos, setBezierHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

  const BOARD_WIDTH = 1280;
  const BOARD_HEIGHT = 720;
  const GAP_X = 140;
  const GAP_Y = 140;

  interface ArtboardLayoutItem {
    slide: PresentationSlide;
    index: number;
    gridX: number;
    gridY: number;
    posX: number;
    posY: number;
  }

  const artboardLayout = useMemo<ArtboardLayoutItem[]>(() => {
    if (slideList.length === 0) return [];

    let curX = 0;
    let curY = 0;
    const rawCoords = slideList.map((s, idx) => {
      let gx = s.gridX;
      let gy = s.gridY;
      if (gx === undefined || gy === undefined) {
        gx = idx === 0 ? 0 : curX + 1;
        gy = idx === 0 ? 0 : curY;
      }
      curX = gx;
      curY = gy;
      return { slide: s, index: idx, gridX: gx, gridY: gy };
    });

    let minGx = Infinity;
    let maxGx = -Infinity;
    let minGy = Infinity;
    let maxGy = -Infinity;

    rawCoords.forEach((item) => {
      if (item.gridX < minGx) minGx = item.gridX;
      if (item.gridX > maxGx) maxGx = item.gridX;
      if (item.gridY < minGy) minGy = item.gridY;
      if (item.gridY > maxGy) maxGy = item.gridY;
    });

    if (minGx === Infinity) { minGx = 0; maxGx = 0; minGy = 0; maxGy = 0; }

    return rawCoords.map((item) => {
      const relGx = item.gridX - minGx;
      const relGy = item.gridY - minGy;
      return {
        ...item,
        posX: relGx * (BOARD_WIDTH + GAP_X),
        posY: relGy * (BOARD_HEIGHT + GAP_Y),
      };
    });
  }, [slideList]);

  const { totalWidth, totalHeight } = useMemo(() => {
    if (artboardLayout.length === 0) {
      return { totalWidth: BOARD_WIDTH, totalHeight: BOARD_HEIGHT };
    }
    let maxRight = 0;
    let maxBottom = 0;
    artboardLayout.forEach((item) => {
      const r = item.posX + BOARD_WIDTH;
      const b = item.posY + BOARD_HEIGHT;
      if (r > maxRight) maxRight = r;
      if (b > maxBottom) maxBottom = b;
    });
    if (artboardDrag?.isDragging) {
      const dragRight = (artboardDrag.targetGridX + 1) * (BOARD_WIDTH + GAP_X);
      const dragBottom = (artboardDrag.targetGridY + 1) * (BOARD_HEIGHT + GAP_Y);
      if (dragRight > maxRight) maxRight = dragRight;
      if (dragBottom > maxBottom) maxBottom = dragBottom;
    }
    return {
      totalWidth: Math.max(BOARD_WIDTH, maxRight),
      totalHeight: Math.max(BOARD_HEIGHT, maxBottom),
    };
  }, [artboardLayout, artboardDrag]);

  const elements: SlideElement[] = slideElementsFor(slide);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const assetBaseUrl = useAssetBaseUrl();
  const mediaSrc = (value?: string) => assetUrl(value, assetBaseUrl);
  const bgValue = slide.background?.value || '#18181b';
  const bgType = slide.background?.type || 'color';

  const [isModeTransitioning, setIsModeTransitioning] = useState(false);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);

  /* Auto-fit canvas to viewport: fits either single active slide or all artboards */
  const fitToViewport = useCallback((mode: 'single' | 'artboard' = viewMode, targetIdx: number = activeSlideIndex) => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const margin = 64;
    if (rect.width <= margin || rect.height <= margin) return;

    if (mode === 'single') {
      const fit = Math.min((rect.width - margin) / BOARD_WIDTH, (rect.height - margin) / BOARD_HEIGHT);
      const clampedScale = Math.min(Math.max(Math.round(fit * 100) / 100, 0.15), 2.5);
      const targetItem = artboardLayout.find((item) => item.index === targetIdx) || artboardLayout[0];
      const anchorX = targetItem ? targetItem.posX + BOARD_WIDTH / 2 : BOARD_WIDTH / 2;
      const anchorY = targetItem ? targetItem.posY + BOARD_HEIGHT / 2 : BOARD_HEIGHT / 2;
      const targetPanX = (totalWidth / 2 - anchorX) * clampedScale;
      const targetPanY = (totalHeight / 2 - anchorY) * clampedScale;
      setScale(clampedScale);
      setPan({ x: targetPanX, y: targetPanY });
    } else {
      const fit = Math.min((rect.width - margin) / totalWidth, (rect.height - margin) / totalHeight);
      const clampedScale = Math.min(Math.max(Math.round(fit * 100) / 100, 0.08), 3.0);
      setScale(clampedScale);
      setPan({ x: 0, y: 0 });
    }
  }, [totalWidth, totalHeight, viewMode, activeSlideIndex, artboardLayout]);

  // Auto-fit canvas on initial mount, viewMode changes, and viewport resize
  const hasAutoFittedRef = useRef(false);
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const doFit = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 100 && rect.height > 100) {
        fitToViewport(viewMode, activeSlideIndex);
      }
    };

    // Immediate attempt on mount
    doFit();

    // Frame-delayed attempt to ensure parent layout has finished measuring
    const raf = requestAnimationFrame(() => {
      doFit();
    });

    const timer = setTimeout(() => {
      doFit();
    }, 100);

    // ResizeObserver on viewport to handle window / panel resizing
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      const h = entries[0]?.contentRect?.height;
      if (w && h && w > 100 && h > 100) {
        if (!hasAutoFittedRef.current) {
          hasAutoFittedRef.current = true;
          fitToViewport(viewMode, activeSlideIndex);
        }
      }
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      ro.disconnect();
    };
  }, [fitToViewport, viewMode, activeSlideIndex]);

  // Trigger smooth zoom transition when switching viewMode ('single' <-> 'artboard')
  const prevViewModeRef = useRef(viewMode);
  useEffect(() => {
    const isModeChange = prevViewModeRef.current !== viewMode;
    prevViewModeRef.current = viewMode;
    if (isModeChange) {
      setIsModeTransitioning(true);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = setTimeout(() => {
        setIsModeTransitioning(false);
      }, 460);
      fitToViewport(viewMode, activeSlideIndex);
    }
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, [viewMode, fitToViewport, activeSlideIndex]);

  // Instantly center active slide without canvas animation when switching slides in Single mode
  const prevActiveIndexRef = useRef(activeSlideIndex);
  useEffect(() => {
    const isSlideChange = prevActiveIndexRef.current !== activeSlideIndex;
    prevActiveIndexRef.current = activeSlideIndex;
    if (isSlideChange && viewMode === 'single') {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      setIsModeTransitioning(false);
      fitToViewport('single', activeSlideIndex);
    }
  }, [activeSlideIndex, viewMode, fitToViewport]);

  /* Keyboard shortcut: Space key for hand/pan tool toggle */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('input,textarea,[contenteditable="true"]')) return;
      if (e.code === 'Space' && !e.repeat) {
        setSpaceHeld(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceHeld(false);
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  /* Anchor-aware Zoom In: zooms in toward the center of the active/selected slide */
  const zoomIn = useCallback(() => {
    const oldScale = scale;
    const newScale = Math.min(3.0, Math.round((oldScale + 0.15) * 100) / 100);
    if (Math.abs(newScale - oldScale) < 0.001) return;

    const targetItem = artboardLayout.find((item) => item.index === activeSlideIndex) || artboardLayout[0];
    const anchorX = targetItem ? targetItem.posX + BOARD_WIDTH / 2 : BOARD_WIDTH / 2;
    const anchorY = targetItem ? targetItem.posY + BOARD_HEIGHT / 2 : BOARD_HEIGHT / 2;

    // Anchor formula: keep (anchorX, anchorY) at same screen position
    const newPanX = pan.x + (totalWidth / 2 - anchorX) * (newScale - oldScale);
    const newPanY = pan.y + (totalHeight / 2 - anchorY) * (newScale - oldScale);

    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  }, [scale, pan, totalWidth, totalHeight, artboardLayout, activeSlideIndex]);

  /* Anchor-aware Zoom Out: zooms out towards the active slide */
  const zoomOut = useCallback(() => {
    const oldScale = scale;
    const newScale = Math.max(0.12, Math.round((oldScale - 0.15) * 100) / 100);
    if (Math.abs(newScale - oldScale) < 0.001) return;

    const targetItem = artboardLayout.find((item) => item.index === activeSlideIndex) || artboardLayout[0];
    const anchorX = targetItem ? targetItem.posX + BOARD_WIDTH / 2 : BOARD_WIDTH / 2;
    const anchorY = targetItem ? targetItem.posY + BOARD_HEIGHT / 2 : BOARD_HEIGHT / 2;

    const newPanX = pan.x + (totalWidth / 2 - anchorX) * (newScale - oldScale);
    const newPanY = pan.y + (totalHeight / 2 - anchorY) * (newScale - oldScale);

    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  }, [scale, pan, totalWidth, totalHeight, artboardLayout, activeSlideIndex]);

  /* Zoom to 100% Actual Size (1:1) and center on active slide */
  const zoomToActual = useCallback(() => {
    const newScale = 1.0;
    const targetItem = artboardLayout.find((item) => item.index === activeSlideIndex) || artboardLayout[0];
    const anchorX = targetItem ? targetItem.posX + BOARD_WIDTH / 2 : BOARD_WIDTH / 2;
    const anchorY = targetItem ? targetItem.posY + BOARD_HEIGHT / 2 : BOARD_HEIGHT / 2;

    const newPanX = (totalWidth / 2 - anchorX) * newScale;
    const newPanY = (totalHeight / 2 - anchorY) * newScale;

    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  }, [totalWidth, totalHeight, artboardLayout, activeSlideIndex]);

  const zoomInRef = useRef(zoomIn);
  zoomInRef.current = zoomIn;
  const zoomOutRef = useRef(zoomOut);
  zoomOutRef.current = zoomOut;
  const fitRef = useRef(fitToViewport);
  fitRef.current = fitToViewport;
  const actualRef = useRef(zoomToActual);
  actualRef.current = zoomToActual;

  /* Keyboard Cmd/Ctrl +/-/0/1 zoom (Photoshop & Illustrator standard) */
  useEffect(() => {
    function handleCanvasZoomKeys(e: KeyboardEvent) {
      if (!e.ctrlKey && !e.metaKey) return;

      const key = e.key;
      const code = e.code;
      const keyCode = e.keyCode || e.which;

      // Zoom In: Cmd/Ctrl + '+' or '=' or 'Add' or 'Equal' or 'NumpadAdd' or keyCode 187 / 61
      const isZoomIn =
        key === '=' ||
        key === '+' ||
        key === 'Add' ||
        code === 'Equal' ||
        code === 'NumpadAdd' ||
        keyCode === 187 ||
        keyCode === 61 ||
        (e.shiftKey && (key === '+' || code === 'Equal'));

      // Zoom Out: Cmd/Ctrl + '-' or '_' or 'Subtract' or code === 'Minus' or code === 'NumpadSubtract' or keyCode 189 / 173
      const isZoomOut =
        key === '-' ||
        key === '_' ||
        key === 'Subtract' ||
        code === 'Minus' ||
        code === 'NumpadSubtract' ||
        keyCode === 189 ||
        keyCode === 173;

      // Fit to Window: Cmd/Ctrl + '0' or code === 'Digit0' or code === 'Numpad0' or keyCode 48
      const isFit = key === '0' || code === 'Digit0' || code === 'Numpad0' || keyCode === 48;

      // 100% 1:1 Actual Size: Cmd/Ctrl + '1' or code === 'Digit1' or code === 'Numpad1' or keyCode 49
      const isActualSize = key === '1' || code === 'Digit1' || code === 'Numpad1' || keyCode === 49;

      if (isZoomIn) {
        e.preventDefault();
        e.stopPropagation();
        zoomInRef.current();
      } else if (isZoomOut) {
        e.preventDefault();
        e.stopPropagation();
        zoomOutRef.current();
      } else if (isFit) {
        e.preventDefault();
        e.stopPropagation();
        fitRef.current();
      } else if (isActualSize) {
        e.preventDefault();
        e.stopPropagation();
        actualRef.current();
      }
    }

    const onCustomZoom = (e: Event) => {
      const customEvt = e as CustomEvent<{ action: 'in' | 'out' | 'fit' | 'actual' }>;
      if (customEvt.detail?.action === 'in') zoomInRef.current();
      else if (customEvt.detail?.action === 'out') zoomOutRef.current();
      else if (customEvt.detail?.action === 'fit') fitRef.current();
      else if (customEvt.detail?.action === 'actual') actualRef.current();
    };

    window.addEventListener('keydown', handleCanvasZoomKeys, { capture: true });
    window.addEventListener('slide-editor-zoom-event', onCustomZoom);
    return () => {
      window.removeEventListener('keydown', handleCanvasZoomKeys, { capture: true });
      window.removeEventListener('slide-editor-zoom-event', onCustomZoom);
    };
  }, []);

  /* Smooth Wheel Panning & Cursor-centered Zooming */
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement | null)?.closest('button,input,textarea,select')) return;
      e.preventDefault();

      if (e.ctrlKey || e.metaKey || e.altKey) {
        const r = vp.getBoundingClientRect();
        const oldScale = scale;
        const newScale = Math.min(Math.max(oldScale + (e.deltaY > 0 ? -0.1 : 0.1), 0.2), 2.5);
        const fx = e.clientX - r.left - r.width / 2 - pan.x;
        const fy = e.clientY - r.top - r.height / 2 - pan.y;
        const ratio = newScale / oldScale;
        setPan({ x: pan.x + fx * (1 - ratio), y: pan.y + fy * (1 - ratio) });
        setScale(newScale);
      } else {
        setPan((c) => ({ x: c.x - e.deltaX, y: c.y - e.deltaY }));
      }
    };

    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, [scale, pan]);

  /* Pointer Drag for moving & resizing elements */
  useEffect(() => {
    if (!dragState) return;

    function onPointerMove(e: PointerEvent) {
      if (!dragState) return;
      const dxPx = (e.clientX - dragState.startX) / scale;
      const dyPx = (e.clientY - dragState.startY) / scale;

      const dxPercent = (dxPx / BOARD_WIDTH) * 100;
      const dyPercent = (dyPx / BOARD_HEIGHT) * 100;

      if (!dragState.handle) {
        let newX = dragState.initialX + dxPercent;
        let newY = dragState.initialY + dyPercent;
        const guides: { x?: number; y?: number } = {};

        if (smartSnap) {
          const centerX = newX + dragState.initialW / 2;
          if (Math.abs(centerX - 50) < 1.5) {
            newX = 50 - dragState.initialW / 2;
            guides.x = 50;
          }
          const centerY = newY + dragState.initialH / 2;
          if (Math.abs(centerY - 50) < 1.5) {
            newY = 50 - dragState.initialH / 2;
            guides.y = 50;
          }
        }

        setSnapGuides(guides);

        // Cross-Artboard Hit Testing when in Artboard View
        if (viewMode === 'artboard' && artboardLayout.length > 1) {
          const vpRect = viewportRef.current?.getBoundingClientRect();
          if (vpRect) {
            const mouseCanvasX = (e.clientX - vpRect.left - vpRect.width / 2 - pan.x) / scale;
            const mouseCanvasY = (e.clientY - vpRect.top - vpRect.height / 2 - pan.y) / scale;
            const absX = mouseCanvasX + totalWidth / 2;
            const absY = mouseCanvasY + totalHeight / 2;

            let targetIdx: number | null = null;
            for (const item of artboardLayout) {
              if (
                absX >= item.posX - 10 &&
                absX <= item.posX + BOARD_WIDTH + 10 &&
                absY >= item.posY - 10 &&
                absY <= item.posY + BOARD_HEIGHT + 10
              ) {
                targetIdx = item.index;
                break;
              }
            }
            setHoveredDropSlideIndex(targetIdx);
          }
        }

        if (dragState.multiDrag && dragState.multiDrag.length > 1) {
          dragState.multiDrag.forEach((item) => {
            const itemNewX = item.initialX + dxPercent;
            const itemNewY = item.initialY + dyPercent;
            onUpdateElement(item.id, {
              x: Math.round(itemNewX * 10) / 10,
              y: Math.round(itemNewY * 10) / 10,
            }, false);
          });
        } else {
          onUpdateElement(dragState.elementId, {
            x: Math.round(newX * 10) / 10,
            y: Math.round(newY * 10) / 10,
          }, false);
        }
      } else {
        const handle = dragState.handle;
        const dragEl = elementsRef.current.find((item) => item.id === dragState.elementId);
        const isCircle = dragEl?.content === 'circle';
        const isAlt = e.altKey;
        const isShift = e.shiftKey || isCircle;

        const initX = dragState.initialX;
        const initY = dragState.initialY;
        const initW = dragState.initialW;
        const initH = dragState.initialH;
        const centerX = initX + initW / 2;
        const centerY = initY + initH / 2;

        let nw = initW;
        let nh = initH;
        let nx = initX;
        let ny = initY;

        if (isAlt) {
          // Alt/Option key: Center-origin symmetric scaling
          let effDx = 0;
          let effDy = 0;
          if (handle.includes('r')) effDx = dxPercent;
          else if (handle.includes('l')) effDx = -dxPercent;
          if (handle.includes('b')) effDy = dyPercent;
          else if (handle.includes('t')) effDy = -dyPercent;

          nw = Math.max(1, initW + 2 * effDx);
          nh = Math.max(1, initH + 2 * effDy);

          if (isShift && ['br', 'bl', 'tr', 'tl'].includes(handle)) {
            const initPxW = (initW / 100) * BOARD_WIDTH;
            const initPxH = (initH / 100) * BOARD_HEIGHT;
            const ratio = isCircle ? 1.0 : (initPxW > 0 ? initPxH / initPxW : 1.0);
            const pxW = (nw / 100) * BOARD_WIDTH;
            const pxH = pxW * ratio;
            nh = (pxH / BOARD_HEIGHT) * 100;
          }

          nx = centerX - nw / 2;
          ny = centerY - nh / 2;
        } else {
          // Standard corner/edge scaling
          if (handle.includes('r')) nw = Math.max(initW + dxPercent, 1);
          if (handle.includes('l')) {
            const newX = Math.min(initX + dxPercent, initX + initW - 1);
            nx = newX;
            nw = initW - (newX - initX);
          }
          if (handle.includes('b')) nh = Math.max(initH + dyPercent, 1);
          if (handle.includes('t')) {
            const newY = Math.min(initY + dyPercent, initY + initH - 1);
            ny = newY;
            nh = initH - (newY - initY);
          }

          if (isShift && ['br', 'bl', 'tr', 'tl'].includes(handle)) {
            const initPxW = (initW / 100) * BOARD_WIDTH;
            const initPxH = (initH / 100) * BOARD_HEIGHT;
            const ratio = isCircle ? 1.0 : (initPxW > 0 ? initPxH / initPxW : 1.0);
            const pxW = (nw / 100) * BOARD_WIDTH;
            const pxH = pxW * ratio;
            const newHPercent = (pxH / BOARD_HEIGHT) * 100;
            if (handle.includes('t')) {
              ny = initY + (initH - newHPercent);
            }
            nh = newHPercent;
          }
        }

        onUpdateElement(dragState.elementId, {
          x: Math.round(nx * 10) / 10,
          y: Math.round(ny * 10) / 10,
          width: Math.round(nw * 10) / 10,
          height: Math.round(nh * 10) / 10,
        }, false);
      }
    }

    function onPointerUp(e: PointerEvent) {
      if (dragState) {
        // Check cross-artboard drop
        if (viewMode === 'artboard' && hoveredDropSlideIndex !== null && hoveredDropSlideIndex !== currentActiveIndex && onMoveElementBetweenSlides) {
          const vpRect = viewportRef.current?.getBoundingClientRect();
          if (vpRect) {
            const mouseCanvasX = (e.clientX - vpRect.left - vpRect.width / 2 - pan.x) / scale;
            const mouseCanvasY = (e.clientY - vpRect.top - vpRect.height / 2 - pan.y) / scale;
            const absX = mouseCanvasX + totalWidth / 2;
            const absY = mouseCanvasY + totalHeight / 2;

            const targetItem = artboardLayout.find((it) => it.index === hoveredDropSlideIndex);
            const targetPosX = targetItem ? targetItem.posX : 0;
            const targetPosY = targetItem ? targetItem.posY : 0;

            const dropLocalX = Math.max(0, Math.min(95, ((absX - targetPosX) / BOARD_WIDTH) * 100));
            const dropLocalY = Math.max(0, Math.min(95, ((absY - targetPosY) / BOARD_HEIGHT) * 100));

            const effectiveIds = activeSelection.length > 0 ? activeSelection : [dragState.elementId];
            onMoveElementBetweenSlides(currentActiveIndex, hoveredDropSlideIndex, effectiveIds, e.altKey, { x: dropLocalX, y: dropLocalY });
          }
        } else {
          const dxPx = (e.clientX - dragState.startX) / scale;
          const dyPx = (e.clientY - dragState.startY) / scale;
          if (Math.abs(dxPx) > 0.5 || Math.abs(dyPx) > 0.5) {
            if (onCommitHistory) onCommitHistory();
          }
        }
      }
      setDragState(null);
      setHoveredDropSlideIndex(null);
      setSnapGuides({});
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dragState, scale, pan, smartSnap, viewMode, artboardLayout, totalWidth, totalHeight, currentActiveIndex, hoveredDropSlideIndex, activeSelection, onUpdateElement, onCommitHistory, onMoveElementBetweenSlides]);

  /* Calculate canvas-local pixel position from pointer event */
  const getCanvasPoint = (e: React.PointerEvent | PointerEvent) => {
    const root = document.getElementById('slide-canvas-root');
    if (!root) return { x: 0, y: 0 };
    const rect = root.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(BOARD_WIDTH, (e.clientX - rect.left) / scale)),
      y: Math.max(0, Math.min(BOARD_HEIGHT, (e.clientY - rect.top) / scale)),
    };
  };

  /* Artboard Free Drag & Reposition in Grid */
  const handleArtboardHeaderPointerDown = (
    index: number,
    layoutItem: { index: number; slide: PresentationSlide; gridX: number; gridY: number; posX: number; posY: number },
    e: React.PointerEvent
  ) => {
    if (e.button !== 0 || viewMode !== 'artboard') return;
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    setArtboardDrag({
      slideIndex: index,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      startX: layoutItem.posX,
      startY: layoutItem.posY,
      deltaX: 0,
      deltaY: 0,
      targetGridX: layoutItem.gridX,
      targetGridY: layoutItem.gridY,
      isDragging: false,
    });
  };

  const handleArtboardHeaderPointerMove = (e: React.PointerEvent) => {
    if (!artboardDrag) return;
    const rawDeltaX = (e.clientX - artboardDrag.startPointerX) / scale;
    const rawDeltaY = (e.clientY - artboardDrag.startPointerY) / scale;
    const isDrag = artboardDrag.isDragging || Math.hypot(rawDeltaX, rawDeltaY) > 5;

    const curPosX = artboardDrag.startX + rawDeltaX;
    const curPosY = artboardDrag.startY + rawDeltaY;

    const targetGx = Math.max(0, Math.round(curPosX / (BOARD_WIDTH + GAP_X)));
    const targetGy = Math.max(0, Math.round(curPosY / (BOARD_HEIGHT + GAP_Y)));

    setArtboardDrag((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        deltaX: rawDeltaX,
        deltaY: rawDeltaY,
        targetGridX: targetGx,
        targetGridY: targetGy,
        isDragging: isDrag,
      };
    });
  };

  const handleArtboardHeaderPointerUp = (e: React.PointerEvent) => {
    if (!artboardDrag) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (artboardDrag.isDragging) {
      onMoveSlideToGrid?.(artboardDrag.slideIndex, artboardDrag.targetGridX, artboardDrag.targetGridY);
    } else {
      onSelectSlide?.(artboardDrag.slideIndex);
    }
    setArtboardDrag(null);
  };

  /* Optimize Bezier element bounding box */
  const optimizeBezierBounds = (bezierEl: SlideElement, extraPatch?: Partial<SlideElement>) => {
    const pts = (bezierEl.points || []) as any[];
    if (pts.length < 2) return;

    let minX = BOARD_WIDTH, maxX = 0, minY = BOARD_HEIGHT, maxY = 0;
    const parentAbsX = (bezierEl.x / 100) * BOARD_WIDTH;
    const parentAbsY = (bezierEl.y / 100) * BOARD_HEIGHT;

    const absPoints = pts.map((node) => ({
      x: node.x + parentAbsX,
      y: node.y + parentAbsY,
      h1x: node.h1x + parentAbsX,
      h1y: node.h1y + parentAbsY,
      h2x: node.h2x + parentAbsX,
      h2y: node.h2y + parentAbsY,
    }));

    absPoints.forEach((node) => {
      const coords = [node.x, node.y, node.h1x, node.h1y, node.h2x, node.h2y];
      for (let i = 0; i < coords.length; i += 2) {
        if (coords[i] < minX) minX = coords[i];
        if (coords[i] > maxX) maxX = coords[i];
        if (coords[i + 1] < minY) minY = coords[i + 1];
        if (coords[i + 1] > maxY) maxY = coords[i + 1];
      }
    });

    const padding = 15;
    minX = Math.max(0, minX - padding);
    maxX = Math.min(BOARD_WIDTH, maxX + padding);
    minY = Math.max(0, minY - padding);
    maxY = Math.min(BOARD_HEIGHT, maxY + padding);

    const width = maxX - minX;
    const height = maxY - minY;

    if (width > 2 && height > 2) {
      const newPoints = absPoints.map((node) => ({
        x: node.x - minX,
        y: node.y - minY,
        h1x: node.h1x - minX,
        h1y: node.h1y - minY,
        h2x: node.h2x - minX,
        h2y: node.h2y - minY,
      }));

      const nx = Math.round((minX / BOARD_WIDTH) * 1000) / 10;
      const ny = Math.round((minY / BOARD_HEIGHT) * 1000) / 10;
      const nw = Math.round((width / BOARD_WIDTH) * 1000) / 10;
      const nh = Math.round((height / BOARD_HEIGHT) * 1000) / 10;

      onUpdateElement(bezierEl.id, {
        points: newPoints,
        x: nx,
        y: ny,
        width: nw,
        height: nh,
        vbW: width,
        vbH: height,
        closed: bezierEl.closed,
        isLoopFilled: bezierEl.isLoopFilled,
        backgroundColor: bezierEl.backgroundColor,
        fillColor: bezierEl.fillColor,
        strokeColor: bezierEl.strokeColor,
        borderColor: bezierEl.borderColor,
        strokeWidth: bezierEl.strokeWidth,
        borderWidth: bezierEl.borderWidth,
        fillOpacity: bezierEl.fillOpacity,
        strokeOpacity: bezierEl.strokeOpacity,
        ...extraPatch,
      });
    }
  };

  /* Keyboard Delete / Backspace for Bezier nodes */
  useEffect(() => {
    function handleNodeDeleteKeys(e: KeyboardEvent) {
      if (selectedBezierNodeIdx === null || !selectedElementId) return;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        const target = elements.find((el) => el.id === selectedElementId && el.type === 'bezier');
        if (!target || !target.points || selectedBezierNodeIdx >= target.points.length) return;
        e.preventDefault();
        e.stopPropagation();
        const newPts = [...(target.points as any[])];
        newPts.splice(selectedBezierNodeIdx, 1);
        if (newPts.length < 2) {
          onUpdateElement(target.id, { points: newPts, closed: false, isLoopFilled: false });
          setSelectedBezierNodeIdx(null);
        } else {
          const isStillClosed = Boolean(target.closed && newPts.length >= 3);
          const nextIdx = Math.max(0, Math.min(newPts.length - 1, selectedBezierNodeIdx));
          setSelectedBezierNodeIdx(nextIdx);
          optimizeBezierBounds({
            ...target,
            points: newPts,
            closed: isStillClosed,
            isLoopFilled: isStillClosed,
          });
        }
      }
    }
    window.addEventListener('keydown', handleNodeDeleteKeys, { capture: true });
    return () => window.removeEventListener('keydown', handleNodeDeleteKeys, { capture: true });
  }, [selectedBezierNodeIdx, selectedElementId, elements, onUpdateElement, activeTool]);

  /* Finalize open bezier element when switching tools or pressing Enter/Escape */
  useEffect(() => {
    function handleFinishBezierKeys(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key === 'Escape') {
        const target = elements.find((el) => el.id === selectedElementId && el.type === 'bezier' && !el.closed);
        if (target && (target.points?.length || 0) >= 2) {
          optimizeBezierBounds(target);
          setSelectedBezierNodeIdx(null);
          setSelectedBezierHandleType(null);
        }
      }
    }
    window.addEventListener('keydown', handleFinishBezierKeys);
    return () => window.removeEventListener('keydown', handleFinishBezierKeys);
  }, [elements, selectedElementId]);

  const prevToolRef = useRef(activeTool);
  useEffect(() => {
    if (prevToolRef.current === 'bezier' && activeTool !== 'bezier') {
      const target = elements.find((el) => el.id === selectedElementId && el.type === 'bezier' && !el.closed);
      if (target && (target.points?.length || 0) >= 2) {
        optimizeBezierBounds(target);
      }
    }
    prevToolRef.current = activeTool;
  }, [activeTool, elements, selectedElementId]);

  /* Pointer events on viewport for canvas panning & vector drawing */
  const onViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const isAnchorClick = Boolean((e.target as HTMLElement)?.title?.includes('Anchor') || (e.target as HTMLElement)?.classList?.contains('se-node-anchor'));
    const isCanvasClick = !isAnchorClick && !(e.target as HTMLElement)?.closest('button, input, select, textarea');
    const isBgClick = e.target === viewportRef.current || (e.target as HTMLElement).id === 'slide-canvas-root';

    if (activeTool === 'pencil' && isCanvasClick) {
      e.stopPropagation();
      const pt = getCanvasPoint(e);
      const newId = `pencil-${Date.now()}`;
      const newPencil: SlideElement = {
        id: newId,
        type: 'pencil',
        x: 0, y: 0, width: 100, height: 100, content: 'pencil',
        points: [[pt.x, pt.y]],
        strokeColor: '#FF5500', strokeWidth: strokeWidth || 4, isLoopFilled: false, fillColor: '#FF5500',
        zIndex: (elements.length || 0) + 1,
      };
      if (onAddElements) onAddElements([newPencil]);
      onSelectElement(newId, false);
      setDrawingPencilId(newId);
      return;
    }

    if (activeTool === 'bezier' && isCanvasClick) {
      e.stopPropagation();
      const pt = getCanvasPoint(e);
      let target = elements.find((el) => el.id === selectedElementId && el.type === 'bezier' && !el.closed);
      let isNew = false;
      if (!target) {
        const newId = `bezier-${Date.now()}`;
        target = {
          id: newId,
          type: 'bezier',
          x: 0, y: 0, width: 100, height: 100,
          vbW: BOARD_WIDTH, vbH: BOARD_HEIGHT,
          content: 'bezier',
          points: [], closed: false, strokeColor: '#FF5500', strokeWidth: strokeWidth || 4,
          zIndex: (elements.length || 0) + 1,
        };
        isNew = true;
      }

      const targetAbsX = (target.x / 100) * BOARD_WIDTH;
      const targetAbsY = (target.y / 100) * BOARD_HEIGHT;
      const localX = pt.x - targetAbsX;
      const localY = pt.y - targetAbsY;
      const pts = (target.points || []) as any[];

      // If clicking near first node with >= 2 points, close the loop!
      if (pts.length >= 2) {
        const first = pts[0];
        const dx = localX - first.x;
        const dy = localY - first.y;
        if (Math.sqrt(dx * dx + dy * dy) <= 24) {
          const nextFill = (target.backgroundColor && target.backgroundColor !== 'transparent')
            ? target.backgroundColor
            : (target.fillColor && target.fillColor !== 'transparent')
            ? target.fillColor
            : '#FF5500';
          optimizeBezierBounds({
            ...target,
            closed: true,
            isLoopFilled: true,
            backgroundColor: nextFill,
            fillColor: nextFill,
          });
          setSelectedBezierNodeIdx(null);
          setSelectedBezierHandleType(null);
          return;
        }
      }

      const newNode = { x: localX, y: localY, h1x: localX, h1y: localY, h2x: localX, h2y: localY };
      const newPts = [...pts, newNode];
      const newIdx = newPts.length - 1;

      if (isNew) {
        if (onAddElements) onAddElements([{ ...target, points: newPts }]);
        onSelectElement(target.id, false);
      } else {
        onUpdateElement(target.id, { points: newPts });
      }

      setSelectedBezierNodeIdx(newIdx);
      setSelectedBezierHandleType('h2');

      const targetId = target.id;
      function onDragNewHandle(moveEv: PointerEvent) {
        const movePt = getCanvasPoint(moveEv);
        const dragLocalX = movePt.x - targetAbsX;
        const dragLocalY = movePt.y - targetAbsY;

        const currPts = [...newPts];
        const currNode = { ...currPts[newIdx] };
        currNode.h2x = dragLocalX;
        currNode.h2y = dragLocalY;
        currNode.h1x = currNode.x - (dragLocalX - currNode.x);
        currNode.h1y = currNode.y - (dragLocalY - currNode.y);
        currPts[newIdx] = currNode;

        onUpdateElement(targetId, { points: currPts }, false);
      }

      function onUpNewHandle() {
        window.removeEventListener('pointermove', onDragNewHandle);
        window.removeEventListener('pointerup', onUpNewHandle);
        if (onCommitHistory) onCommitHistory();
      }

      window.addEventListener('pointermove', onDragNewHandle);
      window.addEventListener('pointerup', onUpNewHandle);
      return;
    }

    /* Panning Trigger: Space+Drag, Middle Click, Alt+Click, or clicking background in Select mode */
    if (spaceHeld || e.button === 1 || (e.button === 0 && e.altKey) || (isBgClick && activeTool === 'select')) {
      dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, ox: pan.x, oy: pan.y };
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
      setIsPanning(true);
      if (isBgClick) {
        onSelectElement(null);
        setEditingTextId(null);
        setSelectedBezierNodeIdx(null);
        setSelectedBezierHandleType(null);
      }
    }
  };

  const onViewportPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (d && d.pointerId === e.pointerId) {
      setIsInteracting(true);
      setPan({ x: d.ox + e.clientX - d.startX, y: d.oy + e.clientY - d.startY });
      return;
    }

    if (activeTool === 'bezier') {
      const pt = getCanvasPoint(e);
      setBezierHoverPos(pt);
    } else if (bezierHoverPos) {
      setBezierHoverPos(null);
    }

    if (drawingPencilId) {
      const pt = getCanvasPoint(e);
      const el = elements.find((item) => item.id === drawingPencilId);
      if (el && Array.isArray(el.points)) {
        const updatedPts = [...el.points, [pt.x, pt.y]];
        onUpdateElement(drawingPencilId, { points: updatedPts }, false);
      }
    }
  };

  const finishViewportPan = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
      setIsPanning(false);
      setIsInteracting(false);
    }
    if (drawingPencilId) {
      const el = elements.find((item) => item.id === drawingPencilId);
      if (el && Array.isArray(el.points) && el.points.length > 0) {
        let pts = [...(el.points as number[][])];
        let isLoopFilled = false;

        if (pts.length > 2) {
          const startPt = pts[0];
          const endPt = pts[pts.length - 1];
          const dist = Math.sqrt((startPt[0] - endPt[0]) ** 2 + (startPt[1] - endPt[1]) ** 2);
          if (dist < 20) {
            pts.push([startPt[0], startPt[1]]);
            isLoopFilled = true;
          }
        }

        let minX = BOARD_WIDTH, maxX = 0, minY = BOARD_HEIGHT, maxY = 0;
        pts.forEach((p) => {
          if (p[0] < minX) minX = p[0];
          if (p[0] > maxX) maxX = p[0];
          if (p[1] < minY) minY = p[1];
          if (p[1] > maxY) maxY = p[1];
        });

        const padding = 10;
        minX = Math.max(0, minX - padding);
        maxX = Math.min(BOARD_WIDTH, maxX + padding);
        minY = Math.max(0, minY - padding);
        maxY = Math.min(BOARD_HEIGHT, maxY + padding);

        const w = maxX - minX;
        const h = maxY - minY;

        if (w > 2 && h > 2) {
          const normPoints = pts.map((p) => [p[0] - minX, p[1] - minY]);
          const nx = Math.round((minX / BOARD_WIDTH) * 1000) / 10;
          const ny = Math.round((minY / BOARD_HEIGHT) * 1000) / 10;
          const nw = Math.round((w / BOARD_WIDTH) * 1000) / 10;
          const nh = Math.round((h / BOARD_HEIGHT) * 1000) / 10;

          onUpdateElement(drawingPencilId, {
            points: normPoints,
            isLoopFilled,
            x: nx,
            y: ny,
            width: nw,
            height: nh,
            vbW: w,
            vbH: h,
          }, true);
        } else if (onCommitHistory) {
          onCommitHistory();
        }
      }
      setDrawingPencilId(null);
    }
  };

  return (
    <section
      ref={viewportRef}
      id="canvas-viewport"
      onPointerDown={onViewportPointerDown}
      onPointerMove={onViewportPointerMove}
      onPointerUp={finishViewportPan}
      onPointerCancel={finishViewportPan}
      style={{
        flex: 1,
        backgroundColor: 'var(--bg-primary)',
        backgroundImage:
          'linear-gradient(var(--border-primary) 1px, transparent 1px), linear-gradient(90deg, var(--border-primary) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        cursor: isPanning || spaceHeld ? 'grabbing' : activeTool === 'pencil' || activeTool === 'bezier' ? 'crosshair' : 'default',
      }}
    >


      {/* Bottom-Center Zoom Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 18,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 40,
          userSelect: 'none',
        }}
      >
        <div className="zoombar-pill">
          <button
            type="button"
            className="zoombar-fit"
            onClick={zoomOut}
            title="Zoom Out (Ctrl/Cmd -)"
            style={{ padding: '4px 8px', fontSize: 13, fontWeight: 700 }}
          >
            −
          </button>

          <input
            type="range"
            min={0.12}
            max={3.0}
            step={0.01}
            value={scale}
            onChange={(e) => {
              const newScale = parseFloat(e.target.value);
              const oldScale = scale;
              if (Math.abs(newScale - oldScale) < 0.001) return;
              if (newScale > oldScale) {
                let anchorX = totalWidth / 2;
                let anchorY = totalHeight / 2;
                if (viewMode === 'artboard') {
                  const targetItem = artboardLayout.find((item) => item.index === activeSlideIndex) || artboardLayout[0];
                  if (targetItem) {
                    anchorX = targetItem.posX + BOARD_WIDTH / 2;
                    anchorY = targetItem.posY + BOARD_HEIGHT / 2;
                  }
                } else {
                  anchorX = BOARD_WIDTH / 2;
                  anchorY = BOARD_HEIGHT / 2;
                }
                const newPanX = pan.x + (totalWidth / 2 - anchorX) * (newScale - oldScale);
                const newPanY = pan.y + (totalHeight / 2 - anchorY) * (newScale - oldScale);
                setScale(newScale);
                setPan({ x: newPanX, y: newPanY });
              } else {
                const scaleRatio = newScale / oldScale;
                setScale(newScale);
                setPan({ x: pan.x * scaleRatio, y: pan.y * scaleRatio });
              }
            }}
            title={t('slideEditor.canvas.zoomLevel')}
          />

          <button
            type="button"
            className="zoombar-fit"
            onClick={zoomIn}
            title="Zoom In (Ctrl/Cmd +)"
            style={{ padding: '4px 8px', fontSize: 13, fontWeight: 700 }}
          >
            +
          </button>

          <span
            className="zoombar-val"
            onClick={zoomToActual}
            title="100% Actual Size (Ctrl/Cmd + 1)"
            style={{ cursor: 'pointer' }}
          >
            {Math.round(scale * 100)}%
          </span>

          <div className="zoombar-divider" />

          <button
            type="button"
            className="zoombar-fit"
            data-active={Math.abs(scale - 1) < 0.01 || undefined}
            onClick={zoomToActual}
            title="100% 1:1 Actual Size (Ctrl/Cmd + 1)"
          >
            100%
          </button>

          <button
            type="button"
            className="zoombar-fit"
            onClick={() => fitToViewport()}
            title={`${t('slideEditor.canvas.fitTitle')} (Ctrl/Cmd + 0)`}
          >
            {t('slideEditor.canvas.fit')}
          </button>

          <button
            type="button"
            className="zoombar-fit"
            data-active={clipToCanvas || undefined}
            onClick={toggleClipToCanvas}
            title={clipToCanvas ? t('slideEditor.canvas.clipCanvasOn') : t('slideEditor.canvas.clipCanvasOff')}
          >
            {clipToCanvas ? t('slideEditor.canvas.trimViewActive') : t('slideEditor.canvas.trimView')}
          </button>

          {onToggleViewMode && (
            <button
              type="button"
              className="zoombar-fit"
              data-active={viewMode === 'artboard' || undefined}
              onClick={onToggleViewMode}
              title={viewMode === 'artboard' ? 'Switch to Single Slide View' : 'Switch to Side-by-Side Artboard View'}
            >
              {viewMode === 'artboard' ? 'Artboards' : 'Single'}
            </button>
          )}
        </div>
      </div>

      {/* Canvas Workspace: Multi-Artboard Infinite Container or Single Slide Board */}
      <div
        id="slide-artboards-container"
        style={{
          width: totalWidth,
          height: totalHeight,
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${scale})`,
          transformOrigin: 'center center',
          transition: isModeTransitioning
            ? 'transform 0.46s cubic-bezier(0.16, 1, 0.3, 1)'
            : 'none',
          willChange: isPanning || isInteracting || artboardDrag?.isDragging || isModeTransitioning ? 'transform' : 'auto',
        }}
      >
        {/* Dynamic Grid Snap Drop Slot Indicator when Dragging Artboard */}
        {viewMode === 'artboard' && artboardDrag?.isDragging && (
          <div
            style={{
              position: 'absolute',
              left: artboardDrag.targetGridX * (BOARD_WIDTH + GAP_X),
              top: artboardDrag.targetGridY * (BOARD_HEIGHT + GAP_Y),
              width: BOARD_WIDTH,
              height: BOARD_HEIGHT,
              border: '3px dashed #ff5500',
              borderRadius: 0,
              background: 'rgba(255, 85, 0, 0.10)',
              pointerEvents: 'none',
              zIndex: 50,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 36px rgba(255, 85, 0, 0.25)',
              transition: 'left 0.12s ease-out, top 0.12s ease-out',
            }}
          >
            <div
              style={{
                padding: '10px 22px',
                background: 'rgba(18, 18, 22, 0.95)',
                border: '1.5px solid rgba(255, 85, 0, 0.75)',
                borderRadius: 8,
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.9)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: 'none', stroke: '#ff5500', strokeWidth: 2.5 }}>
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Place Slide {artboardDrag.slideIndex + 1} at Row {artboardDrag.targetGridY + 1}, Col {artboardDrag.targetGridX + 1}</span>
            </div>
          </div>
        )}

        {artboardLayout.map((layoutItem) => {
          const curSlide = layoutItem.slide;
          const curIdx = layoutItem.index;
          const isActive = curIdx === currentActiveIndex;
          const isDropTarget = hoveredDropSlideIndex === curIdx && !isActive;
          const isBeingDragged = artboardDrag?.slideIndex === curIdx && artboardDrag.isDragging;
          const curBgValue = curSlide.background?.value || '#18181b';
          const curBgType = curSlide.background?.type || 'color';
          const curElements = isActive ? elements : slideElementsFor(curSlide);

          return (
            <div
              key={curSlide.id || `artboard-${curIdx}`}
              id={isActive ? 'slide-canvas-root' : undefined}
              className={`artboard-frame ${isDropTarget ? 'artboard-drop-target' : ''}`}
              onClick={(e) => {
                if (!isActive) {
                  e.stopPropagation();
                  onSelectSlide?.(curIdx);
                }
              }}
              style={{
                width: BOARD_WIDTH,
                height: BOARD_HEIGHT,
                position: 'absolute',
                left: isBeingDragged ? layoutItem.posX + (artboardDrag?.deltaX ?? 0) : layoutItem.posX,
                top: isBeingDragged ? layoutItem.posY + (artboardDrag?.deltaY ?? 0) : layoutItem.posY,
                zIndex: isBeingDragged ? 1000 : (isActive ? 20 : 1),
                opacity: isBeingDragged ? 0.92 : (viewMode === 'single' && !isActive ? 0 : 1),
                pointerEvents: viewMode === 'single' && !isActive ? 'none' : 'auto',
                flexShrink: 0,
                overflow: clipToCanvas ? 'hidden' : 'visible',
                background:
                  curBgType === 'gradient'
                    ? curBgValue
                    : curBgType === 'color' && curBgValue === 'transparent'
                    ? 'repeating-conic-gradient(#262628 0% 25%, #161414 0% 50%) 50% / 24px 24px'
                    : curBgType === 'color'
                    ? curBgValue
                    : '#18181b',
                borderRadius: 0,
                boxShadow: isBeingDragged
                  ? '0 30px 80px rgba(0, 0, 0, 0.95), 0 0 0 3px #ff5500, 0 0 32px rgba(255, 85, 0, 0.5)'
                  : isActive
                  ? (clipToCanvas
                      ? '0 20px 60px rgba(0, 0, 0, 0.85), 0 0 0 2px #ff5500'
                      : '0 20px 60px rgba(0, 0, 0, 0.85), 0 0 0 2px #ff5500, 0 0 24px rgba(255, 85, 0, 0.35)')
                  : (isDropTarget
                      ? '0 20px 60px rgba(0, 0, 0, 0.85), 0 0 0 3px #06b6d4, 0 0 30px rgba(6, 182, 212, 0.5)'
                      : '0 12px 36px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.12)'),
                outline: isActive
                  ? (clipToCanvas ? 'none' : '1px dashed rgba(255, 85, 0, 0.6)')
                  : (isDropTarget ? '2px dashed #06b6d4' : 'none'),
                transition: isBeingDragged || viewMode === 'single'
                  ? 'none'
                  : 'opacity 0.36s cubic-bezier(0.16, 1, 0.3, 1), left 0.28s cubic-bezier(0.2, 0, 0, 1), top 0.28s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.18s ease, outline 0.18s ease',
              }}
            >
              {/* Artboard Header Tag (Only in Artboard View) */}
              {viewMode === 'artboard' && (
                <div
                  className={`artboard-header-tag ${isActive ? 'active' : ''}`}
                  onPointerDown={(e) => handleArtboardHeaderPointerDown(curIdx, layoutItem, e)}
                  onPointerMove={handleArtboardHeaderPointerMove}
                  onPointerUp={handleArtboardHeaderPointerUp}
                  onPointerCancel={handleArtboardHeaderPointerUp}
                  style={{
                    cursor: artboardDrag?.slideIndex === curIdx && artboardDrag.isDragging ? 'grabbing' : 'grab',
                    touchAction: 'none',
                    userSelect: 'none',
                  }}
                  title="Drag to reposition artboard in grid • Click to select"
                >
                  {/* 6-dot drag grip */}
                  <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: 'currentColor', opacity: 0.7 }}>
                    <circle cx="8" cy="6" r="1.5" />
                    <circle cx="16" cy="6" r="1.5" />
                    <circle cx="8" cy="12" r="1.5" />
                    <circle cx="16" cy="12" r="1.5" />
                    <circle cx="8" cy="18" r="1.5" />
                    <circle cx="16" cy="18" r="1.5" />
                  </svg>
                  <span>
                    {t('slideEditor.defaults.slideN', { n: curIdx + 1 })}
                    {curSlide.title ? ` • ${curSlide.title}` : ''}
                  </span>
                </div>
              )}

              {/* 4 Directional Add (+) Buttons - Photoshop Style on Active Artboard */}
              {viewMode === 'artboard' && isActive && onAddSlideAt && (
                <>
                  {/* Top (+) */}
                  <button
                    type="button"
                    className="artboard-add-btn"
                    style={{ top: -54, left: '50%', transform: 'translateX(-50%)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddSlideAt('top', curIdx);
                    }}
                    title="Add artboard before (above)"
                  >
                    <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' }}>
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>

                  {/* Bottom (+) */}
                  <button
                    type="button"
                    className="artboard-add-btn"
                    style={{ bottom: -54, left: '50%', transform: 'translateX(-50%)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddSlideAt('bottom', curIdx);
                    }}
                    title="Add artboard after (below)"
                  >
                    <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' }}>
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>

                  {/* Left (+) */}
                  <button
                    type="button"
                    className="artboard-add-btn"
                    style={{ left: -54, top: '50%', transform: 'translateY(-50%)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddSlideAt('left', curIdx);
                    }}
                    title="Add artboard to the left (before)"
                  >
                    <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' }}>
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>

                  {/* Right (+) */}
                  <button
                    type="button"
                    className="artboard-add-btn"
                    style={{ right: -54, top: '50%', transform: 'translateY(-50%)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddSlideAt('right', curIdx);
                    }}
                    title="Add artboard to the right (after)"
                  >
                    <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' }}>
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                </>
              )}

              {/* Background Image */}
              {curBgType === 'image' && curBgValue && (
                <img
                  src={mediaSrc(curBgValue)}
                  alt=""
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                />
              )}

              {/* Smart Snap Guide Lines on Active Board */}
              {isActive && snapGuides.x !== undefined && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0, bottom: 0, left: `${snapGuides.x}%`,
                    width: 1, background: '#FF5500', boxShadow: '0 0 8px #FF5500', zIndex: 99,
                  }}
                />
              )}
              {isActive && snapGuides.y !== undefined && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0, right: 0, top: `${snapGuides.y}%`,
                    height: 1, background: '#FF5500', boxShadow: '0 0 8px #FF5500', zIndex: 99,
                  }}
                />
              )}

              {/* Elements for this Artboard */}
              {curElements.map((el) => {
                if (el.hidden) return null;
                const isSelected = isActive && activeSelection.includes(el.id);
                const isEditing = isActive && el.id === editingTextId;
                const isLocked = Boolean(el.locked);

                const elX = el.x;
                const elY = el.y;
                const elW = el.width;
                const elH = el.height;

                return (
                  <div
                    key={el.id}
                    onClick={(e) => {
                      if (activeTool === 'bezier') return;
                      e.stopPropagation();
                      if (!isActive) {
                        onSelectSlide?.(curIdx);
                        onSelectElement(el.id, false);
                      }
                    }}
                    onDoubleClick={(e) => {
                      if (isLocked || activeTool === 'bezier') return;
                      e.stopPropagation();
                      if (!isActive) onSelectSlide?.(curIdx);
                      onSelectElement(el.id, false);
                      if (el.type === 'text') setEditingTextId(el.id);
                    }}
                    onPointerDown={(e) => {
                      if (!isActive) {
                        e.stopPropagation();
                        onSelectSlide?.(curIdx);
                        onSelectElement(el.id, false);
                        return;
                      }
                      if (isEditing || activeTool === 'pencil' || activeTool === 'bezier') return;
                      e.stopPropagation();

                      const isShift = e.shiftKey || e.metaKey || e.ctrlKey;
                      const isAlt = e.altKey;

                      if (isLocked) {
                        onSelectElement(el.id, isShift);
                        return;
                      }

                      if (isAlt) {
                        const now = Date.now();
                        const targetsToDup = activeSelection.includes(el.id)
                          ? elements.filter((item) => activeSelection.includes(item.id))
                          : [el];

                        const maxZ = Math.max(0, ...elements.map((item) => item.zIndex || 1));
                        const duplicates: SlideElement[] = targetsToDup.map((target, dIdx) => ({
                          ...target,
                          id: `el-${now}-${dIdx}`,
                          x: Math.min(95, target.x + 2),
                          y: Math.min(95, target.y + 2),
                          zIndex: maxZ + 1 + dIdx,
                        }));

                        if (onAddElements) {
                          onAddElements(duplicates);
                        }

                        const activeDup = duplicates.find((d, dIdx) => targetsToDup[dIdx]?.id === el.id) || duplicates[0];
                        if (activeDup) {
                          onSelectElement(activeDup.id, false);
                          setDragState({
                            elementId: activeDup.id,
                            handle: null,
                            startX: e.clientX,
                            startY: e.clientY,
                            initialX: activeDup.x,
                            initialY: activeDup.y,
                            initialW: activeDup.width,
                            initialH: activeDup.height,
                          });
                        }
                        return;
                      }

                      if (!isSelected || isShift) {
                        onSelectElement(el.id, isShift);
                      }

                      const currentSelectedIds = selectedElementIds || (selectedElementId ? [selectedElementId] : []);
                      const effectiveSelected = (currentSelectedIds.includes(el.id))
                        ? currentSelectedIds
                        : isShift ? [...currentSelectedIds, el.id] : [el.id];

                      const multiDrag = effectiveSelected.map((id) => {
                        const targetEl = elementsRef.current.find((item) => item.id === id);
                        return {
                          id,
                          initialX: targetEl ? targetEl.x : 0,
                          initialY: targetEl ? targetEl.y : 0,
                          width: targetEl ? targetEl.width : 0,
                          height: targetEl ? targetEl.height : 0,
                        };
                      });

                      setDragState({
                        elementId: el.id,
                        handle: null,
                        startX: e.clientX,
                        startY: e.clientY,
                        initialX: elX,
                        initialY: elY,
                        initialW: elW,
                        initialH: elH,
                        multiDrag,
                      });
                    }}
                    style={{
                      position: 'absolute',
                      left: `${elX}%`,
                      top: `${elY}%`,
                      width: `${elW}%`,
                      height: `${elH}%`,
                      zIndex: el.zIndex || 1,
                      transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                      cursor: isEditing ? 'text' : isLocked ? 'not-allowed' : activeTool === 'pencil' || activeTool === 'bezier' ? 'crosshair' : 'move',
                      border: isSelected ? (isLocked ? '1.5px dashed #FF5500' : '1.5px solid #FF5500') : '1px transparent solid',
                      boxShadow: computeBoxShadow(el) || (isSelected ? '0 0 0 2px rgba(255, 85, 0, 0.3)' : undefined),
                      borderRadius: isSelected ? 4 : undefined,
                      boxSizing: 'border-box',
                      pointerEvents: dragState && dragState.elementId !== el.id ? 'none' : 'auto',
                    }}
                  >
                    {/* Text Element */}
                    {el.type === 'text' && (
                      isEditing ? (
                        <textarea
                          autoFocus
                          value={el.content}
                          onChange={(evt) => {
                            onUpdateElement(el.id, { content: evt.target.value }, false);
                            if (el.id === 'title-el') onUpdateSlideText(evt.target.value, curSlide.body);
                            if (el.id === 'body-el') onUpdateSlideText(curSlide.title, evt.target.value);
                          }}
                          onBlur={() => {
                            setEditingTextId(null);
                            if (onCommitHistory) onCommitHistory();
                          }}
                          style={{
                            width: '100%', height: '100%',
                            background: 'transparent', border: 'none', outline: 'none',
                            color: el.color || '#ffffff', fontFamily: el.fontFamily || 'Inter',
                            fontSize: el.fontSize || 36, fontWeight: el.fontWeight || 500,
                            fontStyle: el.fontStyle || 'normal', textAlign: el.textAlign || 'center',
                            lineHeight: el.lineHeight || 1.3,
                            letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : undefined,
                            textTransform: el.textTransform || 'none', textDecoration: el.textDecoration || 'none',
                            textShadow: computeTextShadow(el), resize: 'none',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%', height: '100%',
                            color: el.color || '#ffffff', fontFamily: el.fontFamily || 'Inter',
                            fontSize: el.fontSize || 36, fontWeight: el.fontWeight || 500,
                            fontStyle: el.fontStyle || 'normal', textAlign: el.textAlign || 'center',
                            lineHeight: el.lineHeight || 1.3,
                            letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : undefined,
                            textTransform: el.textTransform || 'none', textDecoration: el.textDecoration || 'none',
                            textShadow: computeTextShadow(el),
                            display: 'flex',
                            alignItems: el.vAlign === 'top' ? 'flex-start' : el.vAlign === 'bottom' ? 'flex-end' : 'center',
                            justifyContent: el.textAlign === 'left' ? 'flex-start' : el.textAlign === 'right' ? 'flex-end' : 'center',
                            wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                            opacity: el.opacity ?? 1,
                          }}
                        >
                          {el.content}
                        </div>
                      )
                    )}

                    {/* Image Element */}
                    {el.type === 'image' && (
                      <img
                        src={mediaSrc(el.content)}
                        alt=""
                        draggable={false}
                        style={{
                          width: '100%', height: '100%', objectFit: 'cover',
                          borderRadius: el.borderRadius !== undefined ? `${el.borderRadius}px` : '0px',
                          borderColor: el.borderColor || 'transparent',
                          borderWidth: el.borderWidth !== undefined ? `${el.borderWidth}px` : '0px',
                          borderStyle: (el.borderWidth ?? 0) > 0 ? 'solid' : 'none',
                          opacity: el.opacity ?? 1,
                          boxSizing: 'border-box',
                          pointerEvents: 'none',
                          WebkitUserDrag: 'none',
                          userSelect: 'none',
                        } as React.CSSProperties & { WebkitUserDrag?: string }}
                      />
                    )}

                    {/* Pencil or Bezier Vector Element */}
                    {(el.type === 'pencil' || el.type === 'bezier') && (() => {
                      const isPencil = el.type === 'pencil';
                      const pts = (el.points || []) as any[];
                      let d = '';
                      if (isPencil) {
                        if (pts.length > 0) {
                          d = `M ${pts[0][0]} ${pts[0][1]}`;
                          for (let i = 1; i < pts.length; i++) {
                            d += ` L ${pts[i][0]} ${pts[i][1]}`;
                          }
                        }
                      } else {
                        if (pts.length > 0) {
                          d = `M ${pts[0].x} ${pts[0].y}`;
                          for (let i = 1; i < pts.length; i++) {
                            const prev = pts[i - 1];
                            const curr = pts[i];
                            d += ` C ${prev.h2x} ${prev.h2y} ${curr.h1x} ${curr.h1y} ${curr.x} ${curr.y}`;
                          }
                          if (el.closed && pts.length > 1) {
                            const last = pts[pts.length - 1];
                            const first = pts[0];
                            d += ` C ${last.h2x} ${last.h2y} ${first.h1x} ${first.h1y} ${first.x} ${first.y} Z`;
                          }
                        }
                      }

                      const fillOn = Boolean(
                        (el.isLoopFilled || el.closed || el.type === 'bezier') &&
                        (el.fillColor || el.backgroundColor) &&
                        (el.fillColor || el.backgroundColor) !== 'none' &&
                        (el.fillColor || el.backgroundColor) !== 'transparent'
                      );
                      const fillColor = fillOn ? (el.fillColor || el.backgroundColor || '#FF5500') : 'none';
                      const strokeColor = el.strokeColor || el.borderColor || '#FF5500';
                      const strokeWidthVal = el.strokeWidth ?? el.borderWidth ?? 4;
                      const vbW = el.vbW || ((el.width / 100) * BOARD_WIDTH);
                      const vbH = el.vbH || ((el.height / 100) * BOARD_HEIGHT);

                      return (
                        <svg
                          viewBox={`0 0 ${vbW} ${vbH}`}
                          preserveAspectRatio="none"
                          style={{
                            width: '100%', height: '100%', overflow: 'visible',
                            filter: computeBoxShadow(el), boxSizing: 'border-box',
                          }}
                        >
                          <path
                            d={d}
                            fill={fillOn ? fillColor : 'none'}
                            fillOpacity={fillOn && el.fillOpacity != null ? el.fillOpacity : 1}
                            stroke={strokeColor}
                            strokeWidth={strokeWidthVal}
                            strokeOpacity={el.strokeOpacity != null ? el.strokeOpacity : 1}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      );
                    })()}

                    {/* Bezier Nodes & Handles (Only on active selected bezier element) */}
                    {isActive && isSelected && el.type === 'bezier' && el.points && (
                      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                        {(el.points as any[]).map((node, nIdx) => {
                          const localW = (el.width / 100) * BOARD_WIDTH;
                          const localH = (el.height / 100) * BOARD_HEIGHT;
                          const axPct = (node.x / localW) * 100;
                          const ayPct = (node.y / localH) * 100;
                          const h1xPct = (node.h1x / localW) * 100;
                          const h1yPct = (node.h1y / localH) * 100;
                          const h2xPct = (node.h2x / localW) * 100;
                          const h2yPct = (node.h2y / localH) * 100;
                          const isNodeSelected = selectedBezierNodeIdx === nIdx;

                          const handleDrag = (handleType: 'anchor' | 'h1' | 'h2', evt: React.PointerEvent) => {
                            evt.preventDefault();
                            evt.stopPropagation();
                            try { (evt.target as HTMLElement).setPointerCapture(evt.pointerId); } catch {}
                            setSelectedBezierNodeIdx(nIdx);
                            setSelectedBezierHandleType(handleType);

                            const startX = evt.clientX;
                            const startY = evt.clientY;
                            const initPoints = JSON.parse(JSON.stringify(el.points));

                            const onMove = (moveEvt: PointerEvent) => {
                              const dxPx = (moveEvt.clientX - startX) / scale;
                              const dyPx = (moveEvt.clientY - startY) / scale;
                              const updated = JSON.parse(JSON.stringify(initPoints));
                              const curr = updated[nIdx];

                              if (handleType === 'anchor') {
                                curr.x += dxPx;
                                curr.y += dyPx;
                                curr.h1x += dxPx;
                                curr.h1y += dyPx;
                                curr.h2x += dxPx;
                                curr.h2y += dyPx;
                              } else if (handleType === 'h1') {
                                curr.h1x += dxPx;
                                curr.h1y += dyPx;
                                if (moveEvt.altKey) {
                                  const vx = curr.h1x - curr.x;
                                  const vy = curr.h1y - curr.y;
                                  curr.h2x = curr.x - vx;
                                  curr.h2y = curr.y - vy;
                                }
                              } else if (handleType === 'h2') {
                                curr.h2x += dxPx;
                                curr.h2y += dyPx;
                                if (moveEvt.altKey) {
                                  const vx = curr.h2x - curr.x;
                                  const vy = curr.h2y - curr.y;
                                  curr.h1x = curr.x - vx;
                                  curr.h1y = curr.y - vy;
                                }
                              }

                              onUpdateElement(el.id, { points: updated }, false);
                            };

                            const onUp = () => {
                              window.removeEventListener('pointermove', onMove);
                              window.removeEventListener('pointerup', onUp);
                              if (onCommitHistory) onCommitHistory();
                            };

                            window.addEventListener('pointermove', onMove);
                            window.addEventListener('pointerup', onUp);
                          };

                          return (
                            <React.Fragment key={nIdx}>
                              <div
                                onPointerDown={(evt) => handleDrag('anchor', evt)}
                                style={{
                                  position: 'absolute',
                                  left: `${axPct}%`,
                                  top: `${ayPct}%`,
                                  transform: 'translate(-50%, -50%)',
                                  width: 10,
                                  height: 10,
                                  background: isNodeSelected ? '#FF5500' : '#ffffff',
                                  border: '2px solid #FF5500',
                                  borderRadius: 2,
                                  cursor: 'pointer',
                                  pointerEvents: 'auto',
                                  zIndex: 25,
                                  boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                                }}
                                title={t('slideEditor.canvas.anchorN', { n: nIdx + 1 })}
                              />

                              {isNodeSelected && (() => {
                                const dx = node.h1x - node.x;
                                const dy = node.h1y - node.y;
                                const len = Math.sqrt(dx * dx + dy * dy);
                                const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
                                return (
                                  <>
                                    <div
                                      style={{
                                        position: 'absolute',
                                        left: `${axPct}%`,
                                        top: `${ayPct}%`,
                                        width: `${(len / localW) * 100}%`,
                                        height: 1.5,
                                        background: 'rgba(255, 85, 0, 0.75)',
                                        transformOrigin: '0 50%',
                                        transform: `rotate(${angle}deg)`,
                                        pointerEvents: 'none',
                                        zIndex: 22,
                                      }}
                                    />
                                    <div
                                      onPointerDown={(evt) => handleDrag('h1', evt)}
                                      style={{
                                        position: 'absolute',
                                        left: `${h1xPct}%`,
                                        top: `${h1yPct}%`,
                                        transform: 'translate(-50%, -50%)',
                                        width: 8,
                                        height: 8,
                                        background: '#FF5500',
                                        border: '1.5px solid #ffffff',
                                        borderRadius: '50%',
                                        cursor: 'grab',
                                        pointerEvents: 'auto',
                                        zIndex: 24,
                                      }}
                                      title={t('slideEditor.canvas.controlHandle1')}
                                    />
                                  </>
                                );
                              })()}

                              {isNodeSelected && (() => {
                                const dx = node.h2x - node.x;
                                const dy = node.h2y - node.y;
                                const len = Math.sqrt(dx * dx + dy * dy);
                                const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
                                return (
                                  <>
                                    <div
                                      style={{
                                        position: 'absolute',
                                        left: `${axPct}%`,
                                        top: `${ayPct}%`,
                                        width: `${(len / localW) * 100}%`,
                                        height: 1.5,
                                        background: 'rgba(255, 85, 0, 0.75)',
                                        transformOrigin: '0 50%',
                                        transform: `rotate(${angle}deg)`,
                                        pointerEvents: 'none',
                                        zIndex: 22,
                                      }}
                                    />
                                    <div
                                      onPointerDown={(evt) => handleDrag('h2', evt)}
                                      style={{
                                        position: 'absolute',
                                        left: `${h2xPct}%`,
                                        top: `${h2yPct}%`,
                                        transform: 'translate(-50%, -50%)',
                                        width: 8,
                                        height: 8,
                                        background: '#FF5500',
                                        border: '1.5px solid #ffffff',
                                        borderRadius: '50%',
                                        cursor: 'grab',
                                        pointerEvents: 'auto',
                                        zIndex: 24,
                                      }}
                                      title={t('slideEditor.canvas.controlHandle2')}
                                    />
                                  </>
                                );
                              })()}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}

                    {/* Shape Element */}
                    {el.type === 'shape' && (() => {
                      const computedRadius =
                        el.content === 'circle'
                          ? '50%'
                          : el.borderRadius !== undefined
                          ? `${el.borderRadius}px`
                          : el.content === 'rectangle'
                          ? '0px'
                          : '12px';

                      const borderWidth = el.borderWidth !== undefined ? el.borderWidth : 3;
                      const rawBg = el.backgroundColor !== undefined ? el.backgroundColor : '#FF5500';
                      const rawBorder = el.borderColor || '#FF5500';

                      return (
                        <div
                          style={{
                            width: '100%', height: '100%',
                            backgroundColor: hexToRgba(rawBg, el.fillOpacity ?? 1),
                            borderColor: hexToRgba(rawBorder, el.strokeOpacity ?? 1),
                            borderWidth: `${borderWidth}px`,
                            borderStyle: borderWidth > 0 ? 'solid' : 'none',
                            borderRadius: computedRadius,
                            clipPath:
                              el.content === 'triangle'
                                ? 'polygon(50% 0%, 0% 100%, 100% 100%)'
                                : el.content === 'star'
                                ? 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'
                                : undefined,
                            opacity: el.opacity ?? 1,
                            boxSizing: 'border-box',
                          }}
                        />
                      );
                    })()}

                    {/* Lock Badge */}
                    {isSelected && isLocked && (
                      <div
                        style={{
                          position: 'absolute', top: -10, right: -10,
                          background: '#FF5500', color: '#ffffff', borderRadius: '50%',
                          width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.5)', zIndex: 12,
                        }}
                        title={t('slideEditor.canvas.layerLocked')}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="4" y="10" width="16" height="11" rx="2" />
                          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                        </svg>
                      </div>
                    )}

                    {/* 8 Handle Resizing HUD */}
                    {isSelected && !isEditing && !isLocked && (
                      <>
                        {[
                          { name: 'tl', style: { top: -6, left: -6, cursor: 'nwse-resize' } },
                          { name: 'tr', style: { top: -6, right: -6, cursor: 'nesw-resize' } },
                          { name: 'bl', style: { bottom: -6, left: -6, cursor: 'nesw-resize' } },
                          { name: 'br', style: { bottom: -6, right: -6, cursor: 'nwse-resize' } },
                          { name: 't', style: { top: -6, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' } },
                          { name: 'b', style: { bottom: -6, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' } },
                          { name: 'l', style: { top: '50%', left: -6, transform: 'translateY(-50%)', cursor: 'ew-resize' } },
                          { name: 'r', style: { top: '50%', right: -6, transform: 'translateY(-50%)', cursor: 'ew-resize' } },
                        ].map((h) => (
                          <div
                            key={h.name}
                            onPointerDown={(evt) => {
                              evt.preventDefault();
                              evt.stopPropagation();
                              try { (evt.target as HTMLElement).setPointerCapture(evt.pointerId); } catch {}
                              setDragState({
                                elementId: el.id,
                                handle: h.name,
                                startX: evt.clientX,
                                startY: evt.clientY,
                                initialX: el.x,
                                initialY: el.y,
                                initialW: el.width,
                                initialH: el.height,
                              });
                            }}
                            style={{
                              position: 'absolute',
                              width: 10, height: 10,
                              background: '#FF5500', border: '2px solid #ffffff', borderRadius: 2,
                              zIndex: 10, ...h.style,
                            }}
                          />
                        ))}
                      </>
                    )}
                  </div>
                );
              })}

              {/* Live rubberband guide for Bezier Pen tool */}
              {isActive && activeTool === 'bezier' && bezierHoverPos && (() => {
                const activeEl = curElements.find((item) => item.id === selectedElementId && item.type === 'bezier' && !item.closed);
                if (!activeEl || !activeEl.points || activeEl.points.length === 0) return null;
                const pts = activeEl.points as any[];
                const last = pts[pts.length - 1];
                const first = pts[0];
                const absLastX = last.x + ((activeEl.x / 100) * BOARD_WIDTH);
                const absLastY = last.y + ((activeEl.y / 100) * BOARD_HEIGHT);
                const absFirstX = first.x + ((activeEl.x / 100) * BOARD_WIDTH);
                const absFirstY = first.y + ((activeEl.y / 100) * BOARD_HEIGHT);

                const dxFirst = bezierHoverPos.x - absFirstX;
                const dyFirst = bezierHoverPos.y - absFirstY;
                const isNearFirst = pts.length >= 2 && Math.sqrt(dxFirst * dxFirst + dyFirst * dyFirst) <= 24;

                return (
                  <svg
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      pointerEvents: 'none',
                      zIndex: 35,
                      overflow: 'visible',
                    }}
                    viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
                  >
                    <line
                      x1={absLastX}
                      y1={absLastY}
                      x2={isNearFirst ? absFirstX : bezierHoverPos.x}
                      y2={isNearFirst ? absFirstY : bezierHoverPos.y}
                      stroke={isNearFirst ? '#22c55e' : '#FF5500'}
                      strokeWidth={2}
                      strokeDasharray="4,4"
                      strokeOpacity={0.85}
                    />
                    {isNearFirst && (
                      <circle
                        cx={absFirstX}
                        cy={absFirstY}
                        r={12}
                        fill="rgba(34, 197, 94, 0.25)"
                        stroke="#22c55e"
                        strokeWidth={2.5}
                      />
                    )}
                  </svg>
                );
              })()}
            </div>
          );
        })}
      </div>
    </section>
  );
}
