import React, { useRef, useState, useEffect } from 'react';
import type { PresentationSlide, SlideElement } from '../types';

interface SlideEditorCanvasProps {
  slide: PresentationSlide;
  zoomLevel: number; // 50, 75, 100, 150, 200, or 0 (auto-fit)
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (id: string, updates: Partial<SlideElement>) => void;
  onUpdateSlideText: (title: string, body: string) => void;
}

export function SlideEditorCanvas({
  slide,
  zoomLevel,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  onUpdateSlideText,
}: SlideEditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{
    elementId: string;
    handle: string | null; // null for move, 'nw'|'ne'|'se'|'sw'|'n'|'e'|'s'|'w' for resize
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    initialW: number;
    initialH: number;
  } | null>(null);

  // Aspect ratio dimensions (1920x1080 canonical)
  const isLowerThird = slide.aspectRatio === 'lower-third';
  const is43 = slide.aspectRatio === '4:3';
  const canvasWidth = is43 ? 1440 : 1920;
  const canvasHeight = isLowerThird ? 360 : 1080;

  // Auto-fit scale calculation based on container bounds
  useEffect(() => {
    function computeScale() {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const availW = rect.width - 40;
      const availH = rect.height - 40;
      const fitW = availW / canvasWidth;
      const fitH = availH / canvasHeight;
      const fitScale = Math.min(fitW, fitH);

      if (zoomLevel === 0) {
        setScale(Math.max(0.15, fitScale));
      } else {
        setScale((zoomLevel / 100) * fitScale);
      }
    }

    computeScale();
    window.addEventListener('resize', computeScale);
    return () => window.removeEventListener('resize', computeScale);
  }, [zoomLevel, canvasWidth, canvasHeight]);

  // Pointer drag for moving / resizing elements
  useEffect(() => {
    if (!dragState) return;

    function onPointerMove(e: PointerEvent) {
      if (!dragState) return;
      const deltaX = (e.clientX - dragState.startX) / scale;
      const deltaY = (e.clientY - dragState.startY) / scale;

      if (!dragState.handle) {
        // Move element
        const nextX = Math.round(dragState.initialX + deltaX);
        const nextY = Math.round(dragState.initialY + deltaY);
        onUpdateElement(dragState.elementId, { x: nextX, y: nextY });
      } else {
        // Resize element from handle
        let newW = dragState.initialW;
        let newH = dragState.initialH;
        let newX = dragState.initialX;
        let newY = dragState.initialY;

        if (dragState.handle.includes('e')) newW = Math.max(50, dragState.initialW + deltaX);
        if (dragState.handle.includes('s')) newH = Math.max(30, dragState.initialH + deltaY);
        if (dragState.handle.includes('w')) {
          const w = Math.max(50, dragState.initialW - deltaX);
          newX = dragState.initialX + (dragState.initialW - w);
          newW = w;
        }
        if (dragState.handle.includes('n')) {
          const h = Math.max(30, dragState.initialH - deltaY);
          newY = dragState.initialY + (dragState.initialH - h);
          newH = h;
        }

        onUpdateElement(dragState.elementId, {
          x: Math.round(newX),
          y: Math.round(newY),
          width: Math.round(newW),
          height: Math.round(newH),
        });
      }
    }

    function onPointerUp() {
      setDragState(null);
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dragState, scale, onUpdateElement]);

  const elements = slide.elements && slide.elements.length > 0 ? slide.elements : [
    {
      id: 'title-el',
      type: 'text' as const,
      x: 120,
      y: 180,
      width: 1680,
      height: 240,
      content: slide.title || 'Click to edit Title',
      fontSize: 64,
      fontFamily: 'Inter',
      fontWeight: 700,
      color: '#ffffff',
      textAlign: 'center' as const,
      zIndex: 1,
    },
    {
      id: 'body-el',
      type: 'text' as const,
      x: 160,
      y: 460,
      width: 1600,
      height: 480,
      content: slide.body || 'Click to edit Body content',
      fontSize: 36,
      fontFamily: 'Inter',
      fontWeight: 500,
      color: 'rgba(255, 255, 255, 0.85)',
      textAlign: 'center' as const,
      zIndex: 2,
    },
  ];

  const bgValue = slide.background?.value || '#18181b';
  const bgType = slide.background?.type || 'color';

  return (
    <div
      ref={containerRef}
      onClick={(e) => {
        if (e.target === containerRef.current || (e.target as HTMLElement).id === 'canvas-bg-root') {
          onSelectElement(null);
          setEditingTextId(null);
        }
      }}
      style={{
        flex: 1,
        background: '#0d0d0f',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: 20,
      }}
    >
      {/* Scaled Canonical Canvas Viewport */}
      <div
        id="canvas-bg-root"
        style={{
          width: canvasWidth,
          height: canvasHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          background: bgType === 'gradient' ? bgValue : bgType === 'color' ? bgValue : '#18181b',
          borderRadius: isLowerThird ? 12 : 4,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {/* Background Image / Video if present */}
        {bgType === 'image' && bgValue && (
          <img
            src={bgValue}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
          />
        )}

        {/* Slide Elements Layer */}
        {elements.map((el) => {
          const isSelected = el.id === selectedElementId;
          const isEditing = el.id === editingTextId;

          return (
            <div
              key={el.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectElement(el.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onSelectElement(el.id);
                if (el.type === 'text') setEditingTextId(el.id);
              }}
              onPointerDown={(e) => {
                if (isEditing) return;
                e.stopPropagation();
                onSelectElement(el.id);
                setDragState({
                  elementId: el.id,
                  handle: null,
                  startX: e.clientX,
                  startY: e.clientY,
                  initialX: el.x,
                  initialY: el.y,
                  initialW: el.width,
                  initialH: el.height,
                });
              }}
              style={{
                position: 'absolute',
                left: el.x,
                top: el.y,
                width: el.width,
                height: el.height,
                zIndex: el.zIndex || 1,
                cursor: isEditing ? 'text' : 'move',
                border: isSelected ? '2px dashed #FF5500' : '1px transparent solid',
                boxSizing: 'border-box',
                userSelect: isEditing ? 'text' : 'none',
              }}
            >
              {/* Text Element Render */}
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
                      textAlign: el.textAlign || 'center',
                      lineHeight: el.lineHeight || 1.3,
                      resize: 'none',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      color: el.color || '#ffffff',
                      fontFamily: el.fontFamily || 'Inter',
                      fontSize: el.fontSize || 36,
                      fontWeight: el.fontWeight || 500,
                      textAlign: el.textAlign || 'center',
                      lineHeight: el.lineHeight || 1.3,
                      textShadow: el.textShadow || '0 2px 8px rgba(0, 0, 0, 0.6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: el.textAlign === 'left' ? 'flex-start' : el.textAlign === 'right' ? 'flex-end' : 'center',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {el.content}
                  </div>
                )
              )}

              {/* Image Element Render */}
              {el.type === 'image' && (
                <img
                  src={el.content}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: el.borderRadius || 0,
                    opacity: el.opacity ?? 1,
                  }}
                />
              )}

              {/* Shape Element Render */}
              {el.type === 'shape' && (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: el.backgroundColor || 'rgba(255, 85, 0, 0.2)',
                    borderColor: el.borderColor || '#FF5500',
                    borderWidth: el.borderWidth || 2,
                    borderStyle: 'solid',
                    borderRadius: el.borderRadius || 8,
                    opacity: el.opacity ?? 1,
                  }}
                />
              )}

              {/* Selection Resize Handles */}
              {isSelected && !isEditing && (
                <>
                  {['nw', 'ne', 'se', 'sw'].map((handle) => {
                    const isNorth = handle.includes('n');
                    const isWest = handle.includes('w');
                    return (
                      <div
                        key={handle}
                        onPointerDown={(evt) => {
                          evt.stopPropagation();
                          setDragState({
                            elementId: el.id,
                            handle,
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
                          top: isNorth ? -6 : 'auto',
                          bottom: isNorth ? 'auto' : -6,
                          left: isWest ? -6 : 'auto',
                          right: isWest ? 'auto' : -6,
                          width: 12,
                          height: 12,
                          background: '#FF5500',
                          border: '2px solid #ffffff',
                          borderRadius: 2,
                          cursor: `${handle}-resize`,
                          zIndex: 10,
                        }}
                      />
                    );
                  })}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
