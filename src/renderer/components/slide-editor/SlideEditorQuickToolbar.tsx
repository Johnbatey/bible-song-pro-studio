import React from 'react';

export type ActiveTool = 'select' | 'text' | 'box' | 'circle' | 'image' | 'pencil' | 'bezier' | 'eraser';

interface SlideEditorQuickToolbarProps {
  activeTool: ActiveTool;
  onSelectTool: (tool: ActiveTool) => void;
  smartSnap: boolean;
  onToggleSmartSnap: () => void;
}

export function SlideEditorQuickToolbar({
  activeTool,
  onSelectTool,
  smartSnap,
  onToggleSmartSnap,
}: SlideEditorQuickToolbarProps) {
  const tools: { id: ActiveTool; title: string; icon: React.ReactNode }[] = [
    {
      id: 'select',
      title: 'Selection & Resize Tool',
      icon: (
        <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
          <path d="M13 13l6 6" />
        </svg>
      ),
    },
    {
      id: 'text',
      title: 'Add Text Box',
      icon: (
        <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
          <path d="M4 7V4h16v3M9 20h6M12 4v16" />
        </svg>
      ),
    },
    {
      id: 'box',
      title: 'Add Rectangle Box',
      icon: (
        <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
          <rect x="3" y="3" width="18" height="18" rx="4" />
        </svg>
      ),
    },
    {
      id: 'circle',
      title: 'Add Circle Shape',
      icon: (
        <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      ),
    },
    {
      id: 'image',
      title: 'Add Image Asset',
      icon: (
        <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
          <rect x="3" y="3" width="18" height="18" rx="3.5" />
          <circle cx="9" cy="9" r="2" />
          <path d="M21 15l-3.086-3.086a2 2 0 00-2.828 0L6 21" />
        </svg>
      ),
    },
    {
      id: 'pencil',
      title: 'Pencil (Freehand Drawing)',
      icon: (
        <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
          <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4Z" />
        </svg>
      ),
    },
    {
      id: 'bezier',
      title: 'Bezier Pen Tool',
      icon: (
        <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2.15, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
          <path d="M3 21l6.6-2.2L20.2 8.2a2.4 2.4 0 0 0 0-3.4l-1-1a2.4 2.4 0 0 0-3.4 0L5.2 14.4 3 21z" />
          <path d="M14.5 5.1l4.4 4.4" />
          <circle cx="10.2" cy="13.8" r="1.8" />
        </svg>
      ),
    },
    {
      id: 'eraser',
      title: 'Eraser Tool',
      icon: (
        <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
          <path d="M20 20H7L3 16c-.5-.5-.5-1.4 0-2l8-8c.5-.5 1.4-.5 2 0l7 7c.5.5.5 1.4 0 2l-2 2" />
        </svg>
      ),
    },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        background: '#15171d',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        borderRadius: 12,
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(20px)',
        userSelect: 'none',
      }}
    >
      {tools.map((tool) => {
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            type="button"
            onClick={() => onSelectTool(tool.id)}
            style={{
              width: 34,
              height: 34,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isActive ? '#f4621f' : 'transparent',
              border: 'none',
              borderRadius: 8,
              color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title={tool.title}
          >
            {tool.icon}
          </button>
        );
      })}

      <div style={{ width: 1, height: 20, background: 'rgba(255, 255, 255, 0.12)', margin: '0 4px' }} />

      {/* Smart Snap Toggle Button */}
      <button
        type="button"
        onClick={onToggleSmartSnap}
        style={{
          width: 34,
          height: 34,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: smartSnap ? 'rgba(244, 98, 31, 0.2)' : 'transparent',
          border: smartSnap ? '1px solid #f4621f' : '1px solid transparent',
          borderRadius: 8,
          color: smartSnap ? '#f4621f' : 'rgba(255, 255, 255, 0.75)',
          cursor: 'pointer',
        }}
        title="Smart Snap (snap to center & edges)"
      >
        <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
          <path d="M12 3v18M3 12h18" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      </button>
    </div>
  );
}
