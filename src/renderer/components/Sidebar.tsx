type PanelView = 'scenes' | 'bible' | 'songs' | 'live' | 'media' | 'themes' | 'presentation' | 'songlibrary' | 'settings' | 'history';

interface SidebarProps {
  activePanel: PanelView;
  onPanelChange: (panel: PanelView) => void;
  collapsed: boolean;
}

const panels: Array<{ id: PanelView; label: string; icon: string }> = [
  { id: 'scenes', label: 'Scenes', icon: '🎬' },
  { id: 'bible', label: 'Bible', icon: '📖' },
  { id: 'songs', label: 'Songs', icon: '🎵' },
  { id: 'live', label: 'Live Scripture', icon: '🎙️' },
  { id: 'presentation', label: 'Slides', icon: '📽️' },
  { id: 'media', label: 'Media', icon: '🖼️' },
  { id: 'themes', label: 'Themes', icon: '🎨' },
  { id: 'songlibrary', label: 'Song Library', icon: '📚' },
  { id: 'history', label: 'History', icon: '📋' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export function Sidebar({ activePanel, onPanelChange, collapsed }: SidebarProps) {
  return (
    <nav
      style={{
        width: collapsed ? 56 : 200,
        minWidth: collapsed ? 56 : 200,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-primary)',
        display: 'flex',
        flexDirection: 'column',
        padding: '8px 0',
        gap: 2,
        transition: 'width 0.25s ease, min-width 0.25s ease',
        overflow: 'hidden',
      }}
    >
      {panels.map((panel) => (
        <button
          key={panel.id}
          onClick={() => onPanelChange(panel.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            border: 'none',
            background: activePanel === panel.id ? 'var(--accent-dim)' : 'transparent',
            color: activePanel === panel.id ? 'var(--accent)' : 'var(--text-secondary)',
            fontSize: 13,
            fontWeight: activePanel === panel.id ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.15s',
            borderRadius: 0,
            fontFamily: 'var(--font-sans)',
            whiteSpace: 'nowrap',
            justifyContent: collapsed ? 'center' : 'flex-start',
            paddingLeft: collapsed ? 0 : 16,
          }}
          onMouseEnter={(e) => {
            if (activePanel !== panel.id) {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (activePanel !== panel.id) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>{panel.icon}</span>
          {!collapsed && <span>{panel.label}</span>}
        </button>
      ))}
    </nav>
  );
}
