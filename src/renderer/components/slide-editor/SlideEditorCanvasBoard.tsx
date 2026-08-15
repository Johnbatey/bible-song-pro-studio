import React, { useRef, useState, useEffect } from 'react';
import type { PresentationSlide, SlideElement } from '../../types';
import { slideElementsFor, hexToRgba } from '../NativeSlideBoard';
import type { ActiveTool } from './SlideEditorQuickToolbar';

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
}: SlideEditorCanvasBoardProps) {
  const activeSelection = selectedElementIds && selectedElementIds.length > 0
    ? selectedElementIds
    : (selectedElementId ? [selectedElementId] : []);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.75);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
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

  const BOARD_WIDTH = 1280;
  const BOARD_HEIGHT = 720;

  // Auto-fit function
  const fitToViewport = () => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const margin = 64;
    if (rect.width <= margin || rect.height <= margin) return;

    const fit = Math.min((rect.width - margin) / BOARD_WIDTH, (rect.height - margin) / BOARD_HEIGHT);
    const clampedScale = Math.min(Math.max(fit, 0.2), 2.0);
    setScale(clampedScale);
    setPanX((rect.width - BOARD_WIDTH) / 2);
    setPanY((rect.height - BOARD_HEIGHT) / 2);
  };

  useEffect(() => {
    fitToViewport();
    window.addEventListener('resize', fitToViewport);
    return () => window.removeEventListener('resize', fitToViewport);
  }, []);

  /* Keyboard CMD/Ctrl +/-/0 for Canvas-only zoom */
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
  }, []);

  // Wheel zoom / pan
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      setScale((s) => Math.min(Math.max(s * zoomFactor, 0.2), 2.5));
    } else {
      setPanX((px) => px - e.deltaX);
      setPanY((py) => py - e.deltaY);
    }
  };

  // Pointer drag for moving / resizing elements
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
          // Snap center X (50%)
          const centerX = newX + dragState.initialW / 2;
          if (Math.abs(centerX - 50) < 1.5) {
            newX = 50 - dragState.initialW / 2;
            guides.x = 50;
          }
          // Snap center Y (50%)
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

  /* Shared with the projected board and the deck cards: an untouched slide has
     to show the same two layers wherever it is drawn. */
  const elements: SlideElement[] = slideElementsFor(slide);

  const bgValue = slide.background?.value || '#18181b';
  const bgType = slide.background?.type || 'color';

  /* Spacebar key listener for Space+Drag panning */
  const [spaceHeld, setSpaceHeld] = useState(false);

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

  /* Native non-passive wheel listener for smooth wheel pan & Ctrl/Cmd zoom */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
        setScale((s) => Math.min(Math.max(s * zoomFactor, 0.2), 2.5));
      } else {
        setPanX((px) => px - e.deltaX);
        setPanY((py) => py - e.deltaY);
      }
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <section
      ref={viewportRef}
      id="canvas-viewport"
      onPointerDown={(e) => {
        const isBgClick = e.target === viewportRef.current || (e.target as HTMLElement).id === 'slide-canvas-root';
        if (spaceHeld || e.button === 1 || (e.button === 0 && e.altKey) || isBgClick) {
          setIsPanning(true);
          setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
        }
        if (isBgClick) {
          onSelectElement(null);
          setEditingTextId(null);
        }
      }}
      onPointerMove={(e) => {
        if (isPanning) {
          setPanX(e.clientX - panStart.x);
          setPanY(e.clientY - panStart.y);
        }
      }}
      onPointerUp={() => setIsPanning(false)}
      onPointerLeave={() => setIsPanning(false)}
      style={{
        flex: 1,
        backgroundColor: 'var(--bg-primary)',
        backgroundImage:
          'linear-gradient(var(--border-primary) 1px, transparent 1px), linear-gradient(90deg, var(--border-primary) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        cursor: isPanning || spaceHeld ? 'grabbing' : 'default',
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
        <span>Slide Builder Mode: Creating Custom Slide Canvas</span>
      </div>

      {/* Sleek Bottom-Center Canvas Zoom Pill Bar */}
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
            title="Zoom Out"
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
            title="Canvas zoom level"
          />

          <button
            type="button"
            onClick={() => setScale((s) => Math.min(2.0, s + 0.1))}
            title="Zoom In"
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
            title="Fit slide to view"
          >
            Fit
          </button>
        </div>
      </div>

      {/* Free-floating 1280x720 Canvas Board */}
      <div
        id="slide-canvas-root"
        style={{
          width: BOARD_WIDTH,
          height: BOARD_HEIGHT,
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
          transformOrigin: 'center center',
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
            src={bgValue}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
          />
        )}

        {/* Smart Snap Guide Lines */}
        {snapGuides.x !== undefined && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${snapGuides.x}%`,
              width: 1,
              background: '#FF5500',
              boxShadow: '0 0 8px #FF5500',
              zIndex: 99,
            }}
          />
        )}
        {snapGuides.y !== undefined && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${snapGuides.y}%`,
              height: 1,
              background: '#FF5500',
              boxShadow: '0 0 8px #FF5500',
              zIndex: 99,
            }}
          />
        )}

        {/* Elements Rendering in Percentage */}
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
                if (isEditing || isLocked) return;
                e.stopPropagation();

                const isShift = e.shiftKey || e.metaKey || e.ctrlKey;
                const isAlt = e.altKey;

                if (isAlt) {
                  // Alt / Option + Drag to Duplicate
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
                /* Rotation is applied on air, so it is applied here. Without
                   it a rotated block sat square in the editor and turned the
                   moment it was taken. */
                transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                cursor: isEditing ? 'text' : isLocked ? 'not-allowed' : 'move',
                border: isSelected ? (isLocked ? '1.5px dashed #FF5500' : '1.5px solid #FF5500') : '1px transparent solid',
                boxShadow: computeBoxShadow(el) || (isSelected ? '0 0 0 2px rgba(255, 85, 0, 0.3)' : undefined),
                borderRadius: isSelected ? 4 : undefined,
                boxSizing: 'border-box',
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
                      width: '100%',
                      height: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: el.color || '#ffffff',
                      fontFamily: el.fontFamily || 'Inter',
                      fontSize: el.fontSize || 36,
                      fontWeight: el.fontWeight || 500,
                      fontStyle: el.fontStyle || 'normal',
                      textAlign: el.textAlign || 'center',
                      lineHeight: el.lineHeight || 1.3,
                      /* Typing into a block must not change how it is set, or
                         the text reflows the moment you double-click it. */
                      letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : undefined,
                      textTransform: el.textTransform || 'none',
                      textDecoration: el.textDecoration || 'none',
                      textShadow: computeTextShadow(el),
                      resize: 'none',
                    }}
                  />
                ) : (
                  /* Letter spacing, Case, Decoration, vertical alignment and
                     opacity were all missing here while the renderer that goes
                     to air honoured every one of them. Setting any of them did
                     nothing visible, so they read as broken controls — the
                     change was real, it just could not be seen until the slide
                     was on screen. This block now matches ElementBox in
                     NativeSlideBoard property for property. */
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      color: el.color || '#ffffff',
                      fontFamily: el.fontFamily || 'Inter',
                      fontSize: el.fontSize || 36,
                      fontWeight: el.fontWeight || 500,
                      fontStyle: el.fontStyle || 'normal',
                      textAlign: el.textAlign || 'center',
                      lineHeight: el.lineHeight || 1.3,
                      letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : undefined,
                      textTransform: el.textTransform || 'none',
                      textDecoration: el.textDecoration || 'none',
                      textShadow: computeTextShadow(el),
                      display: 'flex',
                      alignItems: el.vAlign === 'top' ? 'flex-start' : el.vAlign === 'bottom' ? 'flex-end' : 'center',
                      justifyContent: el.textAlign === 'left' ? 'flex-start' : el.textAlign === 'right' ? 'flex-end' : 'center',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
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
                  src={el.content}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: el.borderRadius !== undefined ? `${el.borderRadius}px` : '0px',
                    borderColor: el.borderColor || 'transparent',
                    borderWidth: el.borderWidth !== undefined ? `${el.borderWidth}px` : '0px',
                    borderStyle: (el.borderWidth ?? 0) > 0 ? 'solid' : 'none',
                    opacity: el.opacity ?? 1,
                    boxSizing: 'border-box',
                  }}
                />
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
                      width: '100%',
                      height: '100%',
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

              {/* Lock Badge for Locked Selected Elements */}
              {isSelected && isLocked && (
                <div
                  style={{
                    position: 'absolute',
                    top: -10,
                    right: -10,
                    background: '#FF5500',
                    color: '#ffffff',
                    borderRadius: '50%',
                    width: 20,
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                    zIndex: 12,
                  }}
                  title="Layer is locked (unmovable)"
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
                        evt.stopPropagation();
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
                        width: 10,
                        height: 10,
                        background: '#FF5500',
                        border: '2px solid #ffffff',
                        borderRadius: 2,
                        zIndex: 10,
                        ...h.style,
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
