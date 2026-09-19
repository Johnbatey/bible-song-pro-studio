import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseDraggableModalOptions {
  initialOffset?: { x: number; y: number };
}

export function useDraggableModal(options: UseDraggableModalOptions = {}) {
  const [position, setPosition] = useState(options.initialOffset || { x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initPosX: number; initPosY: number }>({
    startX: 0,
    startY: 0,
    initPosX: 0,
    initPosY: 0,
  });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only drag with left mouse button (0)
      if (e.button !== 0) return;

      const target = e.target as HTMLElement;
      // Do not initiate dragging if user clicks on interactive elements
      if (target.closest('button, input, select, textarea, a, .no-drag, [data-no-drag]')) {
        return;
      }

      setIsDragging(true);
      dragStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initPosX: position.x,
        initPosY: position.y,
      };
      e.preventDefault();
    },
    [position],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.startX;
      const deltaY = e.clientY - dragStartRef.current.startY;
      setPosition({
        x: dragStartRef.current.initPosX + deltaX,
        y: dragStartRef.current.initPosY + deltaY,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const modalStyle: React.CSSProperties = {
    transform: `translate(${position.x}px, ${position.y}px)`,
    transition: isDragging ? 'none' : 'transform 0.05s ease-out',
    userSelect: isDragging ? 'none' : undefined,
  };

  const headerProps = {
    onMouseDown: handleMouseDown,
    style: {
      cursor: isDragging ? 'grabbing' : 'grab',
      userSelect: 'none' as const,
    },
  };

  const resetPosition = useCallback(() => setPosition({ x: 0, y: 0 }), []);

  return {
    position,
    isDragging,
    modalStyle,
    headerProps,
    handleMouseDown,
    resetPosition,
  };
}
