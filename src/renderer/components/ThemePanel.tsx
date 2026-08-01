import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import type { Theme } from '../types';
import { v4 as uuid } from 'uuid';
import { type, fontWeight } from '../styles/type';

const PRESET_THEMES: Theme[] = [
  {
    id: 'theme-1',
    name: 'Classic Gold',
    lowerThird: {
      background: 'linear-gradient(135deg, rgba(201,169,110,0.95), rgba(244,228,176,0.95))',
      backgroundColor: '#C9A96E',
      backgroundOpacity: 0.95,
      accentColor: '#F4E4B0',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 36,
      fontWeight: 700,
      fontColor: '#1a1a1a',
      textAlign: 'left',
      padding: 20,
      borderRadius: 8,
      animation: 'slideInLeft',
      position: 'bottom-left',
    },
    fullScreen: {
      backgroundColor: '#0c0e14',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 48,
      fontWeight: 700,
      fontColor: '#F4E4B0',
      textAlign: 'center',
      animation: 'fadeIn',
    },
    slideTheme: {
      backgroundColor: '#0c0e14',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 36,
      fontWeight: 500,
      fontColor: '#f0ece4',
      accentColor: '#C9A96E',
      transition: 'crossfade',
    },
  },
  {
    id: 'theme-2',
    name: 'Midnight Blue',
    lowerThird: {
      background: 'linear-gradient(135deg, rgba(15,12,41,0.95), rgba(48,43,99,0.95))',
      backgroundColor: '#0f0c29',
      backgroundOpacity: 0.95,
      accentColor: '#3498db',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 32,
      fontWeight: 600,
      fontColor: '#ffffff',
      textAlign: 'left',
      padding: 18,
      borderRadius: 10,
      animation: 'slideInUp',
      position: 'bottom-left',
    },
    fullScreen: {
      backgroundColor: '#0f0c29',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 44,
      fontWeight: 600,
      fontColor: '#ffffff',
      textAlign: 'center',
      animation: 'zoomIn',
    },
    slideTheme: {
      backgroundColor: '#0f0c29',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 34,
      fontWeight: 500,
      fontColor: '#e0e0ff',
      accentColor: '#3498db',
      transition: 'slide',
    },
  },
  {
    id: 'theme-3',
    name: 'Emerald Grace',
    lowerThird: {
      background: 'linear-gradient(135deg, rgba(0,65,28,0.95), rgba(23,142,76,0.95))',
      backgroundColor: '#00411C',
      backgroundOpacity: 0.95,
      accentColor: '#2ecc71',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 36,
      fontWeight: 700,
      fontColor: '#ffffff',
      textAlign: 'left',
      padding: 20,
      borderRadius: 8,
      animation: 'slideInLeft',
      position: 'bottom-left',
    },
    fullScreen: {
      backgroundColor: '#001a0a',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 48,
      fontWeight: 700,
      fontColor: '#ffffff',
      textAlign: 'center',
      animation: 'fadeIn',
    },
    slideTheme: {
      backgroundColor: '#001a0a',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 36,
      fontWeight: 500,
      fontColor: '#e0ffe0',
      accentColor: '#2ecc71',
      transition: 'crossfade',
    },
  },
  {
    id: 'theme-4',
    name: 'Crimson Worship',
    lowerThird: {
      background: 'linear-gradient(135deg, rgba(120,20,20,0.95), rgba(180,50,50,0.95))',
      backgroundColor: '#781414',
      backgroundOpacity: 0.95,
      accentColor: '#e74c3c',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 34,
      fontWeight: 700,
      fontColor: '#ffffff',
      textAlign: 'left',
      padding: 20,
      borderRadius: 8,
      animation: 'slideInLeft',
      position: 'bottom-left',
    },
    fullScreen: {
      backgroundColor: '#1a0000',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 48,
      fontWeight: 700,
      fontColor: '#ffffff',
      textAlign: 'center',
      animation: 'zoomIn',
    },
    slideTheme: {
      backgroundColor: '#1a0000',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 36,
      fontWeight: 500,
      fontColor: '#ffe0e0',
      accentColor: '#e74c3c',
      transition: 'fade',
    },
  },
  {
    id: 'theme-5',
    name: 'Pure Light',
    lowerThird: {
      background: 'rgba(255,255,255,0.95)',
      backgroundColor: '#ffffff',
      backgroundOpacity: 0.95,
      accentColor: '#C9A96E',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 36,
      fontWeight: 700,
      fontColor: '#1a1a1a',
      textAlign: 'left',
      padding: 18,
      borderRadius: 10,
      animation: 'slideInUp',
      position: 'bottom-center',
    },
    fullScreen: {
      backgroundColor: '#ffffff',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 48,
      fontWeight: 700,
      fontColor: '#1a1a1a',
      textAlign: 'center',
      animation: 'fadeIn',
    },
    slideTheme: {
      backgroundColor: '#ffffff',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 36,
      fontWeight: 500,
      fontColor: '#1a1a1a',
      accentColor: '#C9A96E',
      transition: 'crossfade',
    },
  },
];

export function ThemePanel() {
  const themes = useAppStore((s) => s.themes);
  const addTheme = useAppStore((s) => s.addTheme);
  const updateTheme = useAppStore((s) => s.updateTheme);
  const removeTheme = useAppStore((s) => s.removeTheme);
  const activeTheme = useAppStore((s) => s.activeTheme);
  const setActiveTheme = useAppStore((s) => s.setActiveTheme);
  const [editTheme, setEditTheme] = useState<Theme | null>(null);

  const customPresetNames = new Set(themes.map((theme) => theme.name.replace(/\s+Copy$/, '')));
  const visiblePresets = PRESET_THEMES.filter((theme) => !customPresetNames.has(theme.name));
  const allThemes = [...themes, ...visiblePresets];

  const renameTheme = (theme: Theme, name: string) => {
    const updated = { ...theme, name };
    setEditTheme(updated);
    if (activeTheme?.id === theme.id) setActiveTheme(updated);
    if (name.trim()) updateTheme(theme.id, { name });
  };

  const commitThemeName = (theme: Theme) => {
    const nextName = theme.name.trim();
    const fallback = themes.find((item) => item.id === theme.id)?.name || 'Untitled Theme';
    const updated = { ...theme, name: nextName || fallback };
    setEditTheme(updated);
    if (activeTheme?.id === theme.id) setActiveTheme(updated);
    updateTheme(theme.id, { name: updated.name });
  };

  const deleteTheme = (theme: Theme) => {
    const existing = themes.find((item) => item.id === theme.id);
    if (!existing) return;
    const confirmed = window.confirm(`Delete "${theme.name}"? This cannot be undone.`);
    if (!confirmed) return;
    removeTheme(theme.id);
    if (activeTheme?.id === theme.id) setActiveTheme(null);
    if (editTheme?.id === theme.id) setEditTheme(null);
  };

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <h2 style={{ ...type.title }}>Design</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {activeTheme && (
            <button className="btn btn-sm btn-secondary" onClick={() => setEditTheme(activeTheme)}>
              Customize Active
            </button>
          )}
          <button
            className="btn btn-sm btn-primary"
            onClick={() => {
            const t: Theme = {
              id: `theme-${Date.now()}`,
              name: `Custom Design ${themes.length + 1}`,
              lowerThird: {
                background: 'rgba(0,0,0,0.8)',
                backgroundColor: '#000',
                backgroundOpacity: 0.8,
                accentColor: '#C9A96E',
                fontFamily: '-apple-system, SF Pro Display, sans-serif',
                fontSize: 32,
                fontWeight: 600,
                fontColor: '#ffffff',
                textAlign: 'left',
                padding: 16,
                borderRadius: 8,
                animation: 'fadeIn',
                position: 'bottom-left',
              },
              fullScreen: {
                backgroundColor: '#0c0e14',
                fontFamily: '-apple-system, SF Pro Display, sans-serif',
                fontSize: 40,
                fontWeight: 600,
                fontColor: '#ffffff',
                textAlign: 'center',
                animation: 'fadeIn',
              },
              slideTheme: {
                backgroundColor: '#0c0e14',
                fontFamily: '-apple-system, SF Pro Display, sans-serif',
                fontSize: 32,
                fontWeight: 500,
                fontColor: '#f0ece4',
                accentColor: '#C9A96E',
                transition: 'crossfade',
              },
            };
            addTheme(t);
            setActiveTheme(t);
            setEditTheme(t);
          }}
          >
            + Custom Design
          </button>
        </div>
      </div>

      <div style={styles.body}>
        <div style={styles.themeGrid}>
          {allThemes.map((theme) => (
            <div
              key={theme.id}
              className={`card card-hover ${activeTheme?.id === theme.id ? 'glass-accent' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setActiveTheme(theme)}
            >
              {/* Preview bar */}
              <div
                style={{
                  height: 60,
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: 10,
                  background: theme.lowerThird.background || theme.lowerThird.backgroundColor,
                  display: 'flex',
                  alignItems: 'flex-end',
                  padding: 8,
                }}
              >
                <div
                  style={{
                    width: '60%',
                    height: 6,
                    borderRadius: 3,
                    background: theme.lowerThird.fontColor,
                    opacity: 0.8,
                  }}
                />
              </div>
              <div style={{ ...type.heading, fontWeight: fontWeight.medium }}>{theme.name}</div>
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                <span className="badge" style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}>
                  LT
                </span>
                <span className="badge" style={{ background: 'var(--green-dim)', color: 'var(--green)' }}>
                  Full
                </span>
                <span className="badge" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                  Slides
                </span>
              </div>
              <div style={{ marginTop: 8, ...type.caption, color: 'var(--text-dim)' }}>
                Anim: {theme.lowerThird.animation}
              </div>
              <div style={styles.cardActions}>
                <button
                  className="btn btn-sm btn-secondary"
                  style={{ flex: 1 }}
                  onClick={(event) => {
                    event.stopPropagation();
                    const existing = themes.find((t) => t.id === theme.id);
                    const editable = existing || { ...theme, id: `theme-${Date.now()}`, name: `${theme.name} Copy` };
                    if (!existing) addTheme(editable);
                    setEditTheme(editable);
                  }}
                >
                  Edit Design
                </button>
                {themes.some((item) => item.id === theme.id) && (
                  <button
                    className="btn btn-sm btn-secondary"
                    style={styles.deleteButton}
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteTheme(theme);
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Theme editor */}
        {editTheme && (
          <div className="card" style={styles.editorCard}>
            <div style={styles.editorHeader}>
              <label style={styles.nameField}>
                <span style={styles.nameLabel}>Design Preset Name</span>
                <input
                  className="input"
                  value={editTheme.name}
                  onChange={(event) => renameTheme(editTheme, event.target.value)}
                  onBlur={() => commitThemeName(editTheme)}
                />
              </label>
              {themes.some((theme) => theme.id === editTheme.id) && (
                <button className="btn btn-sm btn-secondary" style={styles.deleteButton} onClick={() => deleteTheme(editTheme)}>
                  Delete Design
                </button>
              )}
              <button className="btn btn-sm btn-secondary" onClick={() => setEditTheme(null)}>
                Back to Design
              </button>
            </div>
            <div style={styles.editorBody}>
              <div style={styles.editorColumn}>
                <div className="section-title">Lower Third</div>
                <ThemeFormSection
                  values={editTheme.lowerThird}
                  onChange={(updates) => {
                    const updated = { ...editTheme, lowerThird: { ...editTheme.lowerThird, ...updates } };
                    setEditTheme(updated);
                    if (activeTheme?.id === editTheme.id) setActiveTheme(updated);
                    useAppStore.getState().updateTheme(editTheme.id, updated);
                  }}
                />
              </div>
              <div style={styles.editorColumn}>
                <div className="section-title">Full Screen</div>
                <ThemeFormSection
                  values={editTheme.fullScreen}
                  onChange={(updates) => {
                    const updated = { ...editTheme, fullScreen: { ...editTheme.fullScreen, ...updates } };
                    setEditTheme(updated);
                    if (activeTheme?.id === editTheme.id) setActiveTheme(updated);
                    useAppStore.getState().updateTheme(editTheme.id, updated);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ThemeFormSection({ values, onChange }: { values: any; onChange: (updates: any) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Font Family</label>
        <select
          className="input"
          value={values.fontFamily || ''}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
        >
          <option value="-apple-system, SF Pro Display, sans-serif">SF Pro Display</option>
          <option value="Inter, sans-serif">Inter</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="'Playfair Display', serif">Playfair Display</option>
          <option value="'Montserrat', sans-serif">Montserrat</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1 }}>
          <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Font Size</label>
          <input
            className="input"
            type="number"
            value={values.fontSize || 32}
            onChange={(e) => onChange({ fontSize: parseInt(e.target.value) })}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Font Weight</label>
          <select
            className="input"
            value={values.fontWeight || 400}
            onChange={(e) => onChange({ fontWeight: parseInt(e.target.value) })}
          >
            <option value="300">Light (300)</option>
            <option value="400">Regular (400)</option>
            <option value="500">Medium (500)</option>
            <option value="600">Semi-Bold (600)</option>
            <option value="700">Bold (700)</option>
            <option value="800">Extra Bold (800)</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1 }}>
          <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Font Color</label>
          <input
            className="input"
            type="color"
            value={values.fontColor || '#ffffff'}
            onChange={(e) => onChange({ fontColor: e.target.value })}
            style={{ height: 34, padding: 2 }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Animation</label>
          <select
            className="input"
            value={values.animation || 'fadeIn'}
            onChange={(e) => onChange({ animation: e.target.value })}
          >
            <option value="fadeIn">Fade In</option>
            <option value="slideInLeft">Slide Left</option>
            <option value="slideInRight">Slide Right</option>
            <option value="slideInUp">Slide Up</option>
            <option value="slideInDown">Slide Down</option>
            <option value="zoomIn">Zoom In</option>
            <option value="scaleIn">Scale In</option>
            <option value="flipIn">Flip In</option>
            <option value="bounceIn">Bounce In</option>
            <option value="elasticIn">Elastic In</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1 }}>
          <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Background</label>
          <input
            className="input"
            type="color"
            value={values.backgroundColor || values.background?.match(/#[0-9a-fA-F]{6}/)?.[0] || '#0c0e14'}
            onChange={(e) => onChange({ backgroundColor: e.target.value, background: e.target.value })}
            style={{ height: 34, padding: 2 }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Radius</label>
          <input
            className="input"
            type="number"
            value={values.borderRadius ?? 0}
            onChange={(e) => onChange({ borderRadius: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1 }}>
          <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Width %</label>
          <input
            className="input"
            type="number"
            min="40"
            max="100"
            value={values.width ?? 92}
            onChange={(e) => onChange({ width: parseInt(e.target.value) || 92 })}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Offset Y</label>
          <input
            className="input"
            type="number"
            value={values.offsetY ?? 0}
            onChange={(e) => onChange({ offsetY: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    height: '100%',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    paddingRight: 4,
  },
  header: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  body: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  themeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 12,
  },
  cardActions: {
    display: 'flex',
    gap: 6,
    marginTop: 10,
  },
  deleteButton: {
    color: 'var(--red)',
    borderColor: 'rgba(231, 76, 60, 0.24)',
  },
  editorCard: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    maxHeight: 'min(520px, 70vh)',
  },
  editorHeader: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  nameField: {
    flex: '1 1 260px',
    minWidth: 180,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  nameLabel: {
    ...type.label,
    color: 'var(--text-dim)',
  },
  editorBody: {
    minHeight: 0,
    overflowY: 'auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 16,
    paddingRight: 4,
  },
  editorColumn: {
    minWidth: 0,
  },
};
