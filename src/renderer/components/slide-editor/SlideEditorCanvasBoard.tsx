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
  } | null>(null);

  const [drawingPencilId, setDrawingPencilId] = useState<string | null>(null);
  const [selectedBezierNodeIdx, setSelectedBezierNodeIdx] = useState<number | null>(null);
  const [selectedBezierHandleType, setSelectedBezierHandleType] = useState<'anchor' | 'h1' | 'h2' | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

  const BOARD_WIDTH = 1280;
  const BOARD_HEIGHT = 720;

  const elements: SlideElement[] = slideElementsFor(slide);
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
    window.addEventListener('resize', fitToViewport);
    return () => window.removeEventListener('resize', fitToViewport);
  }, [fitToViewport]);

  /* Keyboard Spacebar for panning */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    const onBlur = () => setSpaceHeld(false);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
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
        onUpdateElement(dragState.elementId, {
          x: Math.max(0, Math.min(100 - dragState.initialW, Math.round(newX * 10) / 10)),
          y: Math.max(0, Math.min(100 - dragState.initialH, Math.round(newY * 10) / 10)),
        });
      } else {
        const handle = dragState.handle;
        let nx = dragState.initialX;
        let ny = dragState.initialY;
        let nw = dragState.initialW;
        let nh = dragState.initialH;

        if (handle.includes('r')) nw = Math.min(Math.max(dragState.initialW + dxPercent, 2), 100 - dragState.initialX);
        if (handle.includes('l')) {
          const newX = Math.min(Math.max(dragState.initialX + dxPercent, 0), dragState.initialX + dragState.initialW - 2);
          nx = newX;
          nw = dragState.initialW - (newX - dragState.initialX);
        }
        if (handle.includes('b')) nh = Math.min(Math.max(dragState.initialH + dyPercent, 2), 100 - dragState.initialY);
        if (handle.includes('t')) {
          const newY = Math.min(Math.max(dragState.initialY + dyPercent, 0), dragState.initialY + dragState.initialH - 2);
          ny = newY;
          nh = dragState.initialH - (newY - dragState.initialY);
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
  const optimizeBezierBounds = (bezierEl: SlideElement) => {
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
      });
    }
  };

  /* Keyboard Delete / Backspace for Bezier nodes */
  useEffect(() => {
    function handleNodeDeleteKeys(e: KeyboardEvent) {
      if (selectedBezierNodeIdx === null || !selectedElementId) return;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        const target = elements.find((el) => el.id === selectedElementId && el.type === 'bezier');
        if (!target || !target.points) return;
        e.preventDefault();
        e.stopPropagation();
        const newPts = [...(target.points as any[])];
        newPts.splice(selectedBezierNodeIdx, 1);
        if (newPts.length < 2) {
          onUpdateElement(target.id, { points: newPts });
          setSelectedBezierNodeIdx(null);
        } else {
          onUpdateElement(target.id, { points: newPts });
          setSelectedBezierNodeIdx(Math.max(0, selectedBezierNodeIdx - 1));
          optimizeBezierBounds({ ...target, points: newPts });
        }
      }
    }
    window.addEventListener('keydown', handleNodeDeleteKeys, { capture: true });
    return () => window.removeEventListener('keydown', handleNodeDeleteKeys, { capture: true });
  }, [selectedBezierNodeIdx, selectedElementId, elements, onUpdateElement]);

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
          x: 0, y: 0, width: 100, height: 100, content: 'bezier',
          points: [], closed: false, strokeColor: '#FF5500', strokeWidth: strokeWidth || 4,
          zIndex: (elements.length || 0) + 1,
        };
        isNew = true;
      }

      const localX = pt.x - ((target.x / 100) * BOARD_WIDTH);
      const localY = pt.y - ((target.y / 100) * BOARD_HEIGHT);
      const pts = (target.points || []) as any[];

      if (pts.length >= 2) {
        const first = pts[0];
        const dx = localX - first.x;
        const dy = localY - first.y;
        if (Math.sqrt(dx * dx + dy * dy) <= 18) {
          onUpdateElement(target.id, { closed: true });
          optimizeBezierBounds({ ...target, closed: true });
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
        const dragLocalX = movePt.x - ((target!.x / 100) * BOARD_WIDTH);
        const dragLocalY = movePt.y - ((target!.y / 100) * BOARD_HEIGHT);

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
        const curEl = elements.find((el) => el.id === targetId);
        if (curEl) optimizeBezierBounds(curEl);
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
                e.stopPropagation();
                onSelectElement(el.id, e.shiftKey || e.metaKey || e.ctrlKey);
              }}
              onDoubleClick={(e) => {
                if (isLocked) return;
                e.stopPropagation();
                onSelectElement(el.id, false);
                if (el.type === 'text') setEditingTextId(el.id);
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

                setDragState({
                  elementId: el.id,
                  handle: null,
                  startX: e.clientX,
                  startY: e.clientY,
                  initialX: elX,
                  initialY: elY,
                  initialW: elW,
                  initialH: elH,
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

                const fillOn = !!(el.isLoopFilled && (el.fillColor || el.backgroundColor) && (el.fillColor || el.backgroundColor) !== 'none');
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
                    const isAnchorSelected = selectedBezierNodeIdx === nodeIdx && selectedBezierHandleType === 'anchor';

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
                      setSelectedBezierNodeIdx(nodeIdx);
                      setSelectedBezierHandleType(type);

                      const elId = el.id;
                      function onNodeMove(moveEv: PointerEvent) {
                        const movePt = getCanvasPoint(moveEv);
                        const localMoveX = movePt.x - ((el.x / 100) * BOARD_WIDTH);
                        const localMoveY = movePt.y - ((el.y / 100) * BOARD_HEIGHT);

                        const currentEl = elements.find((item) => item.id === elId);
                        if (!currentEl || !currentEl.points) return;
                        const ptsCopy = [...(currentEl.points as any[])];
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
                        onUpdateElement(elId, { points: ptsCopy });
                      }

                      function onNodeUp() {
                        window.removeEventListener('pointermove', onNodeMove);
                        window.removeEventListener('pointerup', onNodeUp);
                        const curEl = elements.find((el) => el.id === elId);
                        if (curEl) optimizeBezierBounds(curEl);
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
                            width: 10,
                            height: 10,
                            background: canClosePath ? '#22c55e' : isAnchorSelected ? '#3b82f6' : '#ffffff',
                            border: '2px solid #FF5500',
                            borderRadius: canClosePath ? '50%' : 2,
                            cursor: 'pointer',
                            pointerEvents: 'auto',
                            zIndex: 25,
                            boxShadow: '0 0 6px rgba(0,0,0,0.6)',
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
      </div>
    </section>
  );
}
