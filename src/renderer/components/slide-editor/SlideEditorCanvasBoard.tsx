import React, { useRef, useState, useEffect, useCallback } from 'react';
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
  activeTool: ActiveTool;
  selectedElementId: string | null;
  selectedElementIds?: string[];
  onSelectElement: (id: string | null, additive?: boolean) => void;
  onUpdateElement: (id: string, updates: Partial<SlideElement>) => void;
  onUpdateSlideText: (title: string, body: string) => void;
  onDuplicateElements?: (ids?: string[]) => void;
  onAddElements?: (newEls: SlideElement[]) => void;
  smartSnap: boolean;
  strokeWidth?: number;
}

export function SlideEditorCanvasBoard({
  slide,
  activeTool,
  selectedElementId,
  selectedElementIds,
  onSelectElement,
  onUpdateElement,
  onUpdateSlideText,
  onDuplicateElements,
  onAddElements,
  smartSnap,
  strokeWidth = 4,
}: SlideEditorCanvasBoardProps) {
  const { t } = useI18n();
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

  const elements: SlideElement[] = slideElementsFor(slide);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const assetBaseUrl = useAssetBaseUrl();
  const mediaSrc = (value?: string) => assetUrl(value, assetBaseUrl);
  const bgValue = slide.background?.value || '#18181b';
  const bgType = slide.background?.type || 'color';

  /* Auto-fit canvas to viewport */
  const fitToViewport = useCallback(() => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const margin = 64;
    if (rect.width <= margin || rect.height <= margin) return;

    const fit = Math.min((rect.width - margin) / BOARD_WIDTH, (rect.height - margin) / BOARD_HEIGHT);
    const clampedScale = Math.min(Math.max(fit, 0.2), 2.0);
    setScale(clampedScale);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    fitToViewport();
  }, [fitToViewport]);

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

  /* Keyboard Cmd/Ctrl +/-/0 zoom */
  useEffect(() => {
    function handleCanvasZoomKeys(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+' || e.key === 'NumpadAdd') {
          e.preventDefault();
          e.stopPropagation();
          setScale((s) => Math.min(2.5, s + 0.1));
        } else if (e.key === '-' || e.key === '_' || e.key === 'NumpadSubtract') {
          e.preventDefault();
          e.stopPropagation();
          setScale((s) => Math.max(0.2, s - 0.1));
        } else if (e.key === '0' || e.key === 'Numpad0') {
          e.preventDefault();
          e.stopPropagation();
          fitToViewport();
        }
      }
    }
    window.addEventListener('keydown', handleCanvasZoomKeys, { capture: true });
    return () => window.removeEventListener('keydown', handleCanvasZoomKeys, { capture: true });
  }, [fitToViewport]);

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

        if (dragState.multiDrag && dragState.multiDrag.length > 1) {
          dragState.multiDrag.forEach((item) => {
            const itemNewX = item.initialX + dxPercent;
            const itemNewY = item.initialY + dyPercent;
            onUpdateElement(item.id, {
              x: Math.max(-50, Math.min(150, Math.round(itemNewX * 10) / 10)),
              y: Math.max(-50, Math.min(150, Math.round(itemNewY * 10) / 10)),
            });
          });
        } else {
          onUpdateElement(dragState.elementId, {
            x: Math.max(0, Math.min(100 - dragState.initialW, Math.round(newX * 10) / 10)),
            y: Math.max(0, Math.min(100 - dragState.initialH, Math.round(newY * 10) / 10)),
          });
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

          nw = Math.max(2, initW + 2 * effDx);
          nh = Math.max(2, initH + 2 * effDy);

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
          if (handle.includes('r')) nw = Math.min(Math.max(initW + dxPercent, 2), 100 - initX);
          if (handle.includes('l')) {
            const newX = Math.min(Math.max(initX + dxPercent, 0), initX + initW - 2);
            nx = newX;
            nw = initW - (newX - initX);
          }
          if (handle.includes('b')) nh = Math.min(Math.max(initH + dyPercent, 2), 100 - initY);
          if (handle.includes('t')) {
            const newY = Math.min(Math.max(initY + dyPercent, 0), initY + initH - 2);
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
        });
      }
    }

    function onPointerUp() {
      setDragState(null);
      setSnapGuides({});
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dragState, scale, smartSnap, onUpdateElement]);

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

        onUpdateElement(targetId, { points: currPts });
      }

      function onUpNewHandle() {
        window.removeEventListener('pointermove', onDragNewHandle);
        window.removeEventListener('pointerup', onUpNewHandle);
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
        onUpdateElement(drawingPencilId, { points: updatedPts });
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
          });
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
      {/* Top-Left Mode Indicator */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: 16,
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--bg-secondary)',
          padding: '6px 12px',
          borderRadius: 6,
          border: '1px solid var(--border-primary)',
          backdropFilter: 'blur(12px)',
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#FF5500',
            boxShadow: '0 0 10px #FF5500',
          }}
        />
        <span>
          {t('slideEditor.canvas.modeLabel')}{' '}
          {activeTool === 'pencil'
            ? t('slideEditor.canvas.modePencil')
            : activeTool === 'bezier'
            ? t('slideEditor.canvas.modeBezier')
            : t('slideEditor.canvas.modeDefault')}
        </span>
      </div>

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
            onClick={() => setScale((s) => Math.max(0.2, s - 0.1))}
            title={t('slideEditor.canvas.zoomOut')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="7" y1="11" x2="15" y2="11"/></svg>
          </button>

          <input
            type="range"
            min={0.2}
            max={2.0}
            step={0.02}
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            title={t('slideEditor.canvas.zoomLevel')}
          />

          <button
            type="button"
            onClick={() => setScale((s) => Math.min(2.0, s + 0.1))}
            title={t('slideEditor.canvas.zoomIn')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="7" y1="11" x2="15" y2="11"/><line x1="11" y1="7" x2="11" y2="15"/></svg>
          </button>

          <span className="zoombar-val">
            {Math.round(scale * 100)}%
          </span>

          <div className="zoombar-divider" />

          <button
            type="button"
            className="zoombar-fit"
            data-active={Math.abs(scale - 1) < 0.01 || undefined}
            onClick={fitToViewport}
            title={t('slideEditor.canvas.fitTitle')}
          >
            {t('slideEditor.canvas.fit')}
          </button>
        </div>
      </div>

      {/* Smooth GPU-Accelerated 1280x720 Canvas Board */}
      <div
        id="slide-canvas-root"
        style={{
          width: BOARD_WIDTH,
          height: BOARD_HEIGHT,
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${scale})`,
          transformOrigin: 'center center',
          willChange: isPanning || isInteracting ? 'transform' : 'auto',
          background:
            bgType === 'gradient'
              ? bgValue
              : bgType === 'color' && bgValue === 'transparent'
              ? 'repeating-conic-gradient(#262628 0% 25%, #161414 0% 50%) 50% / 24px 24px'
              : bgType === 'color'
              ? bgValue
              : '#18181b',
          borderRadius: 4,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.12)',
        }}
      >
        {/* Background Image */}
        {bgType === 'image' && bgValue && (
          <img
            src={mediaSrc(bgValue)}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
          />
        )}

        {/* Smart Snap Guide Lines */}
        {snapGuides.x !== undefined && (
          <div
            style={{
              position: 'absolute',
              top: 0, bottom: 0, left: `${snapGuides.x}%`,
              width: 1, background: '#FF5500', boxShadow: '0 0 8px #FF5500', zIndex: 99,
            }}
          />
        )}
        {snapGuides.y !== undefined && (
          <div
            style={{
              position: 'absolute',
              left: 0, right: 0, top: `${snapGuides.y}%`,
              height: 1, background: '#FF5500', boxShadow: '0 0 8px #FF5500', zIndex: 99,
            }}
          />
        )}

        {/* Elements Rendering */}
        {elements.map((el) => {
          if (el.hidden) return null;
          const isSelected = activeSelection.includes(el.id);
          const isEditing = el.id === editingTextId;
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
              }}
              onDoubleClick={(e) => {
                if (isLocked || activeTool === 'bezier') return;
                e.stopPropagation();
                onSelectElement(el.id, false);
                if (el.type === "text") setEditingTextId(el.id);
              }}
              onPointerDown={(e) => {
                if (isEditing || isLocked || activeTool === 'pencil' || activeTool === 'bezier') return;
                e.stopPropagation();

                const isShift = e.shiftKey || e.metaKey || e.ctrlKey;
                const isAlt = e.altKey;

                if (isAlt) {
                  const now = Date.now();
                  const targetsToDup = activeSelection.includes(el.id)
                    ? elements.filter((item) => activeSelection.includes(item.id))
                    : [el];

                  const maxZ = Math.max(0, ...elements.map((item) => item.zIndex || 1));
                  const duplicates: SlideElement[] = targetsToDup.map((target, idx) => ({
                    ...target,
                    id: `el-${now}-${idx}`,
                    x: Math.min(95, target.x + 2),
                    y: Math.min(95, target.y + 2),
                    zIndex: maxZ + 1 + idx,
                  }));

                  if (onAddElements) {
                    onAddElements(duplicates);
                  }

                  const activeDup = duplicates.find((d, idx) => targetsToDup[idx]?.id === el.id) || duplicates[0];
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
                      onUpdateElement(el.id, { content: evt.target.value });
                      if (el.id === 'title-el') onUpdateSlideText(evt.target.value, slide.body);
                      if (el.id === 'body-el') onUpdateSlideText(slide.title, evt.target.value);
                    }}
                    onBlur={() => setEditingTextId(null)}
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
                const strokeWidth = el.strokeWidth ?? el.borderWidth ?? 4;
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
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                );
              })()}

              {/* Bezier Node Control Guides Overlay */}
              {isSelected && el.type === 'bezier' && el.points && (
                <div
                  style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20,
                  }}
                >
                  {((el.points as any[]) || []).map((node, nodeIdx) => {
                    const localW = (el.width / 100) * BOARD_WIDTH;
                    const localH = (el.height / 100) * BOARD_HEIGHT;

                    const canClosePath = nodeIdx === 0 && el.points!.length >= 2 && !el.closed;
                    const isAnchorSelected = selectedBezierNodeIdx === nodeIdx;

                    const axPct = (node.x / localW) * 100;
                    const ayPct = (node.y / localH) * 100;

                    const h1xPct = (node.h1x / localW) * 100;
                    const h1yPct = (node.h1y / localH) * 100;
                    const h2xPct = (node.h2x / localW) * 100;
                    const h2yPct = (node.h2y / localH) * 100;

                    const showH1 = node.h1x !== node.x || node.h1y !== node.y;
                    const showH2 = node.h2x !== node.x || node.h2y !== node.y;

                    const handleDrag = (type: 'anchor' | 'h1' | 'h2', evt: React.PointerEvent) => {
                      evt.stopPropagation();
                      evt.preventDefault();

                      if (type === 'anchor' && canClosePath) {
                        const nextFill = (el.backgroundColor && el.backgroundColor !== 'transparent')
                          ? el.backgroundColor
                          : (el.fillColor && el.fillColor !== 'transparent')
                          ? el.fillColor
                          : '#FF5500';
                        optimizeBezierBounds({
                          ...el,
                          closed: true,
                          isLoopFilled: true,
                          backgroundColor: nextFill,
                          fillColor: nextFill,
                        });
                        setSelectedBezierNodeIdx(null);
                        setSelectedBezierHandleType(null);
                        return;
                      }

                      setSelectedBezierNodeIdx(nodeIdx);
                      setSelectedBezierHandleType(type);

                      const initialEl = elementsRef.current.find((item) => item.id === el.id) || el;
                      const initialPts = JSON.parse(JSON.stringify(initialEl.points || []));
                      let latestPts = initialPts;
                      const parentAbsX = (initialEl.x / 100) * BOARD_WIDTH;
                      const parentAbsY = (initialEl.y / 100) * BOARD_HEIGHT;

                      function onNodeMove(moveEv: PointerEvent) {
                        const movePt = getCanvasPoint(moveEv);
                        const localMoveX = movePt.x - parentAbsX;
                        const localMoveY = movePt.y - parentAbsY;

                        const ptsCopy = JSON.parse(JSON.stringify(initialPts));
                        const currNode = { ...ptsCopy[nodeIdx] };

                        if (type === 'anchor') {
                          const dx = localMoveX - currNode.x;
                          const dy = localMoveY - currNode.y;
                          currNode.x = localMoveX;
                          currNode.y = localMoveY;
                          currNode.h1x += dx;
                          currNode.h1y += dy;
                          currNode.h2x += dx;
                          currNode.h2y += dy;
                        } else if (type === 'h1') {
                          currNode.h1x = localMoveX;
                          currNode.h1y = localMoveY;
                          const rdx = currNode.x - localMoveX;
                          const rdy = currNode.y - localMoveY;
                          currNode.h2x = currNode.x + rdx;
                          currNode.h2y = currNode.y + rdy;
                        } else if (type === 'h2') {
                          currNode.h2x = localMoveX;
                          currNode.h2y = localMoveY;
                          const rdx = currNode.x - localMoveX;
                          const rdy = currNode.y - localMoveY;
                          currNode.h1x = currNode.x + rdx;
                          currNode.h1y = currNode.y + rdy;
                        }

                        ptsCopy[nodeIdx] = currNode;
                        latestPts = ptsCopy;
                        onUpdateElement(el.id, { points: ptsCopy });
                      }

                      function onNodeUp() {
                        window.removeEventListener('pointermove', onNodeMove);
                        window.removeEventListener('pointerup', onNodeUp);
                        const upEl = elementsRef.current.find((item) => item.id === el.id) || initialEl;
                        if (upEl && (upEl.closed || activeTool !== 'bezier')) {
                          optimizeBezierBounds({ ...upEl, points: latestPts });
                        }
                      }

                      window.addEventListener('pointermove', onNodeMove);
                      window.addEventListener('pointerup', onNodeUp);
                    };

                    return (
                      <React.Fragment key={nodeIdx}>
                        {/* Anchor Node Dot */}
                        <div
                          onPointerDown={(evt) => handleDrag('anchor', evt)}
                          style={{
                            position: 'absolute',
                            left: `${axPct}%`,
                            top: `${ayPct}%`,
                            transform: 'translate(-50%, -50%)',
                            width: canClosePath ? 14 : isAnchorSelected ? 12 : 9,
                            height: canClosePath ? 14 : isAnchorSelected ? 12 : 9,
                            background: canClosePath ? '#22c55e' : isAnchorSelected ? '#3b82f6' : '#ffffff',
                            border: canClosePath ? '2.5px solid #ffffff' : isAnchorSelected ? '2px solid #ffffff' : '1.5px solid #FF5500',
                            borderRadius: canClosePath ? '50%' : 2,
                            cursor: 'pointer',
                            pointerEvents: 'auto',
                            zIndex: isAnchorSelected ? 30 : 25,
                            boxShadow: canClosePath
                              ? '0 0 10px rgba(34, 197, 94, 0.9)'
                              : isAnchorSelected
                              ? '0 0 8px rgba(59, 130, 246, 0.9)'
                              : '0 0 4px rgba(0,0,0,0.6)',
                          }}
                          title={canClosePath ? t('slideEditor.canvas.closeBezierLoop') : t('slideEditor.canvas.anchorN', { n: nodeIdx + 1 })}
                        />

                        {/* Tangent Line & Handle Dot H1 */}
                        {showH1 && (() => {
                          const dx = node.h1x - node.x;
                          const dy = node.h1y - node.y;
                          const len = Math.sqrt(dx * dx + dy * dy);
                          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
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

                        {/* Tangent Line & Handle Dot H2 */}
                        {showH2 && (() => {
                          const dx = node.h2x - node.x;
                          const dy = node.h2y - node.y;
                          const len = Math.sqrt(dx * dx + dy * dy);
                          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
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

              {/* PowerPoint-style 8 Handle Resizing HUD */}
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

        {/* Illustrator-style live rubberband guide when drawing with Bezier Pen tool */}
        {activeTool === 'bezier' && bezierHoverPos && (() => {
          const activeEl = elements.find((item) => item.id === selectedElementId && item.type === 'bezier' && !item.closed);
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
    </section>
  );
}

