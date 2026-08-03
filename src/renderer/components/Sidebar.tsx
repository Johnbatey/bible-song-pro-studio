import { useAppStore } from '../stores/appStore';
import { type, fontWeight, iconSize } from '../styles/type';

type PanelView = 'scenes' | 'bible' | 'songs' | 'live' | 'media' | 'themes' | 'presentation' | 'settings' | 'history';

interface SidebarProps {
  activePanel: PanelView;
  onPanelChange: (panel: PanelView) => void;
  collapsed: boolean;
}

const panels: Array<{ id: PanelView; label: string; icon: React.ReactNode }> = [
  {
    id: 'scenes',
    label: 'Scenes',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8H4z" fill="currentColor" fillOpacity="0.15" />
        <path d="M4 11h16M4 7h16M4 7l3-4h3l-3 4M11 7l3-4h3l-3 4M18 7l3-4" />
      </svg>
    ),
  },
  {
    id: 'bible',
    label: 'Bible',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" fill="currentColor" fillOpacity="0.15" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" fill="currentColor" fillOpacity="0.15" />
      </svg>
    ),
  },
  {
    id: 'songs',
    label: 'Songs',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" fill="currentColor" fillOpacity="0.25" />
        <circle cx="18" cy="16" r="3" fill="currentColor" fillOpacity="0.25" />
      </svg>
    ),
  },
  {
    id: 'live',
    label: 'Live Scripture',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="2" width="6" height="11" rx="3" fill="currentColor" fillOpacity="0.2" />
        <path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" />
      </svg>
    ),
  },
  {
    id: 'presentation',
    label: 'Slides',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" fill="currentColor" fillOpacity="0.15" />
        <path d="M8 21h8M12 17v4M10 8.5l5 3-5 3v-6z" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'media',
    label: 'Media',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" fillOpacity="0.12" />
        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    ),
  },
];

export function Sidebar({ activePanel, onPanelChange, collapsed }: SidebarProps) {
  const openSettings = useAppStore((s) => s.openSettings);

  return (
    <nav
      style={{
        width: collapsed ? 56 : 200,
        minWidth: collapsed ? 56 : 200,
        height: '100%',
        minHeight: 0,
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        padding: '8px 0',
        gap: 2,
        transition: 'width 0.25s ease, min-width 0.25s ease',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {panels.map((panel) => (
        <button
          key={panel.id}
          onClick={() => {
            if (panel.id === 'settings') {
              openSettings('output');
            } else if (panel.id === 'themes') {
              useAppStore.getState().openThemeDesigner();
            } else {
              onPanelChange(panel.id);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 14px',
            border: 'none',
            borderLeft: activePanel === panel.id ? '3px solid var(--accent)' : '3px solid transparent',
            background: activePanel === panel.id ? 'var(--accent-dim)' : 'transparent',
            color: activePanel === panel.id ? 'var(--accent)' : '#ffffff',
            ...type.body,
            fontWeight: activePanel === panel.id ? fontWeight.semibold : fontWeight.regular,
            cursor: 'pointer',
            transition: 'all 0.15s',
            borderRadius: '0 6px 6px 0',
            fontFamily: 'var(--font-ui)',
            whiteSpace: 'nowrap',
            justifyContent: collapsed ? 'center' : 'flex-start',
            paddingLeft: collapsed ? 0 : 14,
          }}
          onMouseEnter={(e) => {
            if (activePanel !== panel.id) {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.color = '#ffffff';
            }
          }}
          onMouseLeave={(e) => {
            if (activePanel !== panel.id) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#ffffff';
            }
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20 }}>{panel.icon}</span>
          {!collapsed && <span>{panel.label}</span>}
        </button>
      ))}
    </nav>
  );
}
