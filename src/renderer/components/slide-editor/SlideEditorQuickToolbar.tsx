import React from 'react';

export type ActiveTool = 'select' | 'text' | 'box' | 'circle' | 'image' | 'pencil' | 'bezier' | 'eraser';

/**
 * The actions this toolbar offers on an imported PowerPoint slide.
 *
 * A different set from the native one, because a different set is what works:
 * adding a shape to a .pptx means writing new OOXML, which is not ported, and
 * a button that silently does nothing is worse than an absent one. Everything
 * here acts on the current selection through the slide engine.
 */
export interface PptxToolbarActions {
  canGroup: boolean;
  canUngroup: boolean;
  hasSelection: boolean;
  onGroup: () => void;
  onUngroup: () => void;
  onReorder: (toFront: boolean) => void;
  onDelete: () => void;
}

interface SlideEditorQuickToolbarProps {
  activeTool: ActiveTool;
  onSelectTool: (tool: ActiveTool) => void;
  smartSnap: boolean;
  onToggleSmartSnap: () => void;
  pptx?: PptxToolbarActions | null;
}

export function SlideEditorQuickToolbar({
  activeTool,
  onSelectTool,
  smartSnap,
  onToggleSmartSnap,
  pptx = null,
}: SlideEditorQuickToolbarProps) {
  if (pptx) return <PptxQuickToolbar actions={pptx} />;

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
    <div style={SHELL}>
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

const SHELL: React.CSSProperties = {
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
};

const ICON: React.CSSProperties = {
  width: 16,
  height: 16,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function PptxQuickToolbar({ actions }: { actions: PptxToolbarActions }) {
  const { canGroup, canUngroup, hasSelection, onGroup, onUngroup, onReorder, onDelete } = actions;

  const buttons: Array<{
    id: string;
    title: string;
    enabled: boolean;
    danger?: boolean;
    onClick: () => void;
    icon: React.ReactNode;
  }> = [
    {
      id: 'group',
      title: 'Group the selection (needs two or more shapes)',
      enabled: canGroup,
      onClick: onGroup,
      icon: (
        <svg viewBox="0 0 24 24" style={ICON}>
          <rect x="3" y="3" width="9" height="9" rx="1.5" />
          <rect x="12" y="12" width="9" height="9" rx="1.5" />
        </svg>
      ),
    },
    {
      id: 'ungroup',
      title: 'Ungroup, so each piece can be edited on its own',
      enabled: canUngroup,
      onClick: onUngroup,
      icon: (
        <svg viewBox="0 0 24 24" style={ICON}>
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="13" width="8" height="8" rx="1.5" strokeDasharray="3 2.5" />
        </svg>
      ),
    },
    {
      id: 'front',
      title: 'Bring to front',
      enabled: hasSelection,
      onClick: () => onReorder(true),
      icon: (
        <svg viewBox="0 0 24 24" style={ICON}>
          <rect x="3" y="3" width="12" height="12" rx="1.5" strokeDasharray="3 2.5" />
          <rect x="9" y="9" width="12" height="12" rx="1.5" fill="currentColor" fillOpacity="0.25" />
        </svg>
      ),
    },
    {
      id: 'back',
      title: 'Send to back',
      enabled: hasSelection,
      onClick: () => onReorder(false),
      icon: (
        <svg viewBox="0 0 24 24" style={ICON}>
          <rect x="9" y="9" width="12" height="12" rx="1.5" strokeDasharray="3 2.5" />
          <rect x="3" y="3" width="12" height="12" rx="1.5" fill="currentColor" fillOpacity="0.25" />
        </svg>
      ),
    },
    {
      id: 'delete',
      title: 'Remove from slide',
      enabled: hasSelection,
      danger: true,
      onClick: onDelete,
      icon: (
        <svg viewBox="0 0 24 24" style={ICON}>
          <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
        </svg>
      ),
    },
  ];

  return (
    <div style={SHELL}>
      {buttons.map((b, i) => (
        <React.Fragment key={b.id}>
          {i === 2 && <div style={{ width: 1, height: 20, background: 'rgba(255, 255, 255, 0.12)', margin: '0 2px' }} />}
          <button
            type="button"
            onClick={b.enabled ? b.onClick : undefined}
            disabled={!b.enabled}
            style={{
              width: 34,
              height: 34,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              borderRadius: 8,
              color: !b.enabled
                ? 'rgba(255, 255, 255, 0.22)'
                : b.danger
                ? '#f87171'
                : 'rgba(255, 255, 255, 0.75)',
              cursor: b.enabled ? 'pointer' : 'default',
              transition: 'all 0.15s ease',
            }}
            title={b.title}
          >
            {b.icon}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
