import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import type { Theme } from '../types';
import { v4 as uuid } from 'uuid';
import { type, fontWeight } from '../styles/type';
import { Block, BlockButton } from './Block';
import { AppleToggle } from './AppleToggle';
import { MediaGrid } from './MediaGrid';
import { gradientCss, parseBackgroundInfo } from '../utils/background';

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
      referenceFontSize: 24,
      fontWeight: 700,
      fontColor: '#1a1a1a',
      textAlign: 'left',
      padding: 20,
      borderRadius: 6,
      animation: 'slideInLeft',
      position: 'bottom-left',
      offsetX: 0,
      offsetY: 0,
    },
    fullScreen: {
      background: '#9c1a1a',
      backgroundColor: '#9c1a1a',
      fontFamily: 'Georgia, serif',
      fontSize: 65,
      referenceFontSize: 50,
      fontWeight: 700,
      fontColor: '#ffffff',
      referenceColor: '#F4E4B0',
      textAlign: 'center',
      animation: 'fadeIn',
      offsetX: 0,
      offsetY: 0,
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
      referenceFontSize: 22,
      fontWeight: 600,
      fontColor: '#ffffff',
      textAlign: 'left',
      padding: 18,
      borderRadius: 6,
      animation: 'slideInUp',
      position: 'bottom-left',
      offsetX: 0,
      offsetY: 0,
    },
    fullScreen: {
      background: 'linear-gradient(135deg, #0f172a, #1e1b4b, #312e81)',
      backgroundColor: '#0f0c29',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 44,
      referenceFontSize: 26,
      fontWeight: 600,
      fontColor: '#ffffff',
      textAlign: 'center',
      animation: 'zoomIn',
      offsetX: 0,
      offsetY: 0,
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
      referenceFontSize: 24,
      fontWeight: 700,
      fontColor: '#ffffff',
      textAlign: 'left',
      padding: 20,
      borderRadius: 6,
      animation: 'slideInLeft',
      position: 'bottom-left',
      offsetX: 0,
      offsetY: 0,
    },
    fullScreen: {
      background: 'linear-gradient(135deg, #001a0a, #00411c, #178e4c)',
      backgroundColor: '#001a0a',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 48,
      referenceFontSize: 28,
      fontWeight: 700,
      fontColor: '#ffffff',
      textAlign: 'center',
      animation: 'fadeIn',
      offsetX: 0,
      offsetY: 0,
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
      referenceFontSize: 24,
      fontWeight: 700,
      fontColor: '#ffffff',
      textAlign: 'left',
      padding: 20,
      borderRadius: 6,
      animation: 'slideInLeft',
      position: 'bottom-left',
      offsetX: 0,
      offsetY: 0,
    },
    fullScreen: {
      background: 'linear-gradient(135deg, #1b0000, #781414, #e65100)',
      backgroundColor: '#1a0000',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 48,
      referenceFontSize: 28,
      fontWeight: 700,
      fontColor: '#ffffff',
      textAlign: 'center',
      animation: 'zoomIn',
      offsetX: 0,
      offsetY: 0,
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
      referenceFontSize: 24,
      fontWeight: 700,
      fontColor: '#1a1a1a',
      textAlign: 'left',
      padding: 18,
      borderRadius: 6,
      animation: 'slideInUp',
      position: 'bottom-center',
      offsetX: 0,
      offsetY: 0,
    },
    fullScreen: {
      background: '#ffffff',
      backgroundColor: '#ffffff',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 48,
      referenceFontSize: 28,
      fontWeight: 700,
      fontColor: '#1a1a1a',
      textAlign: 'center',
      animation: 'fadeIn',
      offsetX: 0,
      offsetY: 0,
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
  {
    id: 'theme-6',
    name: 'Royal Purple',
    lowerThird: {
      background: 'linear-gradient(135deg, rgba(74,20,140,0.95), rgba(123,31,162,0.95))',
      backgroundColor: '#4a148c',
      backgroundOpacity: 0.95,
      accentColor: '#e1bee7',
      fontFamily: 'Inter, sans-serif',
      fontSize: 34,
      referenceFontSize: 22,
      fontWeight: 700,
      fontColor: '#ffffff',
      textAlign: 'left',
      padding: 18,
      borderRadius: 6,
      animation: 'slideInLeft',
      position: 'bottom-left',
      offsetX: 0,
      offsetY: 0,
    },
    fullScreen: {
      background: 'linear-gradient(135deg, #1a0033, #4a148c, #7b1fa2)',
      backgroundColor: '#1a0033',
      fontFamily: 'Inter, sans-serif',
      fontSize: 46,
      referenceFontSize: 26,
      fontWeight: 700,
      fontColor: '#ffffff',
      textAlign: 'center',
      animation: 'fadeIn',
      offsetX: 0,
      offsetY: 0,
    },
    slideTheme: {
      backgroundColor: '#1a0033',
      fontFamily: 'Inter, sans-serif',
      fontSize: 34,
      fontWeight: 500,
      fontColor: '#f3e5f5',
      accentColor: '#ab47bc',
      transition: 'crossfade',
    },
  },
  {
    id: 'theme-7',
    name: 'Ocean Breeze',
    lowerThird: {
      background: 'linear-gradient(135deg, rgba(2,119,189,0.95), rgba(0,172,193,0.95))',
      backgroundColor: '#0277bd',
      backgroundOpacity: 0.95,
      accentColor: '#80deea',
      fontFamily: 'Montserrat, sans-serif',
      fontSize: 34,
      referenceFontSize: 22,
      fontWeight: 600,
      fontColor: '#ffffff',
      textAlign: 'left',
      padding: 18,
      borderRadius: 6,
      animation: 'slideInUp',
      position: 'bottom-left',
      offsetX: 0,
      offsetY: 0,
    },
    fullScreen: {
      background: 'linear-gradient(135deg, #001f3f, #003366, #00509d)',
      backgroundColor: '#002171',
      fontFamily: 'Montserrat, sans-serif',
      fontSize: 46,
      referenceFontSize: 26,
      fontWeight: 700,
      fontColor: '#ffffff',
      textAlign: 'center',
      animation: 'zoomIn',
      offsetX: 0,
      offsetY: 0,
    },
    slideTheme: {
      backgroundColor: '#002171',
      fontFamily: 'Montserrat, sans-serif',
      fontSize: 34,
      fontWeight: 500,
      fontColor: '#e0f7fa',
      accentColor: '#26c6da',
      transition: 'slide',
    },
  },
  {
    id: 'theme-8',
    name: 'Sunset Warmth',
    lowerThird: {
      background: 'linear-gradient(135deg, rgba(230,81,0,0.95), rgba(245,124,0,0.95))',
      backgroundColor: '#e65100',
      backgroundOpacity: 0.95,
      accentColor: '#ffe0b2',
      fontFamily: 'Inter, sans-serif',
      fontSize: 34,
      referenceFontSize: 22,
      fontWeight: 700,
      fontColor: '#ffffff',
      textAlign: 'left',
      padding: 18,
      borderRadius: 6,
      animation: 'slideInLeft',
      position: 'bottom-left',
      offsetX: 0,
      offsetY: 0,
    },
    fullScreen: {
      background: 'linear-gradient(135deg, #1b0000, #4a1500, #e65100)',
      backgroundColor: '#1b0000',
      fontFamily: 'Inter, sans-serif',
      fontSize: 48,
      referenceFontSize: 28,
      fontWeight: 700,
      fontColor: '#ffcc80',
      textAlign: 'center',
      animation: 'fadeIn',
      offsetX: 0,
      offsetY: 0,
    },
    slideTheme: {
      backgroundColor: '#1b0000',
      fontFamily: 'Inter, sans-serif',
      fontSize: 36,
      fontWeight: 500,
      fontColor: '#fff3e0',
      accentColor: '#ff9800',
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
  /* Which output each card is previewing. Per card, not one setting for the
     grid: comparing two themes usually means looking at the same output on
     both, but checking one theme's lower third should not reframe the other
     eleven. Full screen is the default because it is what most of a service
     is. */
  const [thumbMode, setThumbMode] = useState<Record<string, ThumbMode>>({});
  const thumbModeFor = (id: string): ThumbMode => thumbMode[id] ?? 'full';

  // Combine default preset themes with custom user created/modified themes smoothly
  const themeMap = new Map<string, Theme>();
  PRESET_THEMES.forEach((preset) => themeMap.set(preset.id, preset));
  themes.forEach((theme) => {
    const existing = themeMap.get(theme.id);
    themeMap.set(theme.id, existing ? { ...existing, ...theme } : theme);
  });
  const allThemes = Array.from(themeMap.values());

  /**
   * Carry an edit into the editor, the library, and — only if this is the theme
   * that is live — the output.
   *
   * Editing is not choosing. Opening a preset to change its colours used to
   * make it the active theme, so an operator who wanted to tidy up a theme they
   * were not using changed what the congregation was looking at. Which theme is
   * live is decided by clicking the thumbnail, and nothing else decides it.
   *
   * The active theme still updates as it is edited, because that is the whole
   * point of editing the one you are running: the projector follows the colour
   * picker live rather than after a save.
   */
  const applyThemeEdit = (updated: Theme) => {
    setEditTheme(updated);
    if (activeTheme?.id === updated.id) setActiveTheme(updated);
    updateTheme(updated.id, updated);
  };

  const renameTheme = (theme: Theme, name: string) => {
    const updated = { ...theme, name };
    setEditTheme(updated);
    if (activeTheme?.id === updated.id) setActiveTheme(updated);
    /* An empty box mid-typing is not a name; it is committed on blur. */
    if (name.trim()) updateTheme(theme.id, updated);
  };

  const commitThemeName = (theme: Theme) => {
    const nextName = theme.name.trim();
    const fallback = theme.name || 'Untitled Theme';
    applyThemeEdit({ ...theme, name: nextName || fallback });
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
      {!editTheme ? (
        /* PAGE 1: PRESET GRID VIEW */
        <Block
          title="Design Presets"
          subtitle={`${allThemes.length}`}
          tools={(
            <>
              {activeTheme && (
                <BlockButton onClick={() => setEditTheme(activeTheme)}>
                  Customize Active
                </BlockButton>
              )}
              <BlockButton
                onClick={() => {
                  const t: Theme = {
                    id: `theme-${Date.now()}`,
                    name: `Custom Design ${themes.length + 1}`,
                    lowerThird: {
                      background: 'rgba(0,0,0,0.85)',
                      backgroundColor: '#000000',
                      backgroundOpacity: 0.85,
                      accentColor: '#C9A96E',
                      fontFamily: '-apple-system, SF Pro Display, sans-serif',
                      fontSize: 32,
                      fontWeight: 600,
                      fontColor: '#ffffff',
                      textAlign: 'left',
                      padding: 16,
                      borderRadius: 6,
                      animation: 'fadeIn',
                      position: 'bottom-left',
                    },
                    fullScreen: {
                      background: 'linear-gradient(135deg, #0f172a, #1e1b4b, #312e81)',
                      backgroundColor: '#0c0e14',
                      fontFamily: '-apple-system, SF Pro Display, sans-serif',
                      fontSize: 44,
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
              </BlockButton>
            </>
          )}
        >
          <div style={styles.themeGrid}>
              {allThemes.map((theme) => (
                <div
                  key={theme.id}
                  className={`card card-hover ${activeTheme?.id === theme.id ? 'glass-accent' : ''}`}
                  style={{ cursor: 'pointer', padding: 12 }}
                  onClick={() => setActiveTheme(theme)}
                >
                  {/* Realistic 16:9 Presentation Display Thumbnail */}
                  <ThemeThumbnailPreview theme={theme} mode={thumbModeFor(theme.id)} />

                  {/* Header Row: Preset Name & the two output modes.
                      These were badges — three labels stating that a theme has
                      a full screen, a lower third and slides, which every theme
                      does, so they said nothing and cost the row. They switch
                      the thumbnail now.

                      SLIDES is gone rather than switchable: nothing renders
                      with theme.slideTheme. Pro Slides paint their own design
                      edge to edge, so a slides preview would have advertised
                      styling the theme does not apply. */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: 6 }}>
                    <div style={{ ...type.heading, fontWeight: fontWeight.bold, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                      {theme.name}
                    </div>
                    <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                      {THUMB_MODES.map((option) => {
                        const selected = thumbModeFor(theme.id) === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            className="badge"
                            /* Previewing is not choosing, the same rule Edit
                               Design follows: only the card applies a theme. */
                            onClick={(event) => {
                              event.stopPropagation();
                              setThumbMode((current) => ({ ...current, [theme.id]: option.id }));
                            }}
                            title={option.hint}
                            style={{
                              fontSize: 9,
                              padding: '2px 5px',
                              cursor: 'pointer',
                              border: 'none',
                              background: selected ? option.tint : 'transparent',
                              color: selected ? option.color : 'var(--text-dim)',
                              fontWeight: selected ? fontWeight.bold : fontWeight.medium,
                            }}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action Buttons Row */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <button
                      className="btn btn-sm btn-secondary"
                      style={{ flex: 1, padding: '5px 8px', fontSize: 12 }}
                      /* Opens the editor and nothing else — see applyThemeEdit.
                         The card behind this button is what applies a theme,
                         which is why the click stops here. */
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditTheme(theme);
                      }}
                    >
                      Edit Design
                    </button>
                    {themes.some((item) => item.id === theme.id) && (
                      <button
                        className="btn btn-sm btn-secondary"
                        style={{ ...styles.deleteButton, padding: '5px 8px', fontSize: 12 }}
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
        </Block>
      ) : (
        /* PAGE 2: PRESET EDITOR VIEW */
        <Block
          title={<>Edit Design: <span style={{ color: 'var(--accent)' }}>{editTheme.name}</span></>}
          tools={(
            <>
              <BlockButton onClick={() => setEditTheme(null)}>← Presets</BlockButton>
              {themes.some((theme) => theme.id === editTheme.id) && (
                <BlockButton style={styles.deleteButton} onClick={() => deleteTheme(editTheme)}>
                  Delete Design
                </BlockButton>
              )}
              <BlockButton active onClick={() => setEditTheme(null)}>Done</BlockButton>
            </>
          )}
        >
            <div style={styles.editorCard}>
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
              </div>
              <div style={styles.editorBody}>
                {/* Column 1: FULL SCREEN (Left Column) */}
                <div style={styles.editorColumn}>
                  <div className="section-title" style={{ color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="badge" style={{ background: 'var(--green-dim)', color: 'var(--green)' }}>FULL SCREEN</span>
                  </div>
                  <ThemeFormSection
                    allowMedia
                    values={editTheme.fullScreen}
                    onChange={(updates) => applyThemeEdit({
                      ...editTheme,
                      fullScreen: { ...editTheme.fullScreen, ...updates },
                    })}
                  />
                </div>

                {/* Column 2: LOWER THIRD (Right Column) */}
                <div style={styles.editorColumn}>
                  <div className="section-title" style={{ color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="badge" style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}>LOWER THIRD</span>
                  </div>
                  <ThemeFormSection
                    values={editTheme.lowerThird}
                    onChange={(updates) => applyThemeEdit({
                      ...editTheme,
                      lowerThird: { ...editTheme.lowerThird, ...updates },
                    })}
                  />
                </div>
              </div>
            </div>
        </Block>
      )}
    </div>
  );
}

type ThumbMode = 'full' | 'lt';

/* Full screen first: it is the output a service spends most of its time in,
   and it is the default the card opens on. */
const THUMB_MODES: { id: ThumbMode; label: string; tint: string; color: string; hint: string }[] = [
  { id: 'full', label: 'FULL', tint: 'var(--green-dim)', color: 'var(--green)', hint: 'Preview the full screen output' },
  { id: 'lt', label: 'LT', tint: 'var(--blue-dim)', color: 'var(--blue)', hint: 'Preview the lower third, over transparency' },
];

/* Checkerboard, the standard way a still says "nothing is painted here". A
   lower third is a band drawn over whatever the projector is already showing,
   so previewing it on the theme's full-screen ground would misrepresent it as
   part of one picture — which is exactly what the stacked preview did. */
const TRANSPARENCY_CHECKS = {
  backgroundColor: '#15161a',
  backgroundImage:
    'linear-gradient(45deg, #23252b 25%, transparent 25%),' +
    'linear-gradient(-45deg, #23252b 25%, transparent 25%),' +
    'linear-gradient(45deg, transparent 75%, #23252b 75%),' +
    'linear-gradient(-45deg, transparent 75%, #23252b 75%)',
  backgroundSize: '12px 12px',
  backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
};

function ThemeThumbnailPreview({ theme, mode }: { theme: Theme; mode: ThumbMode }) {
  const fs = theme.fullScreen;
  const lt = theme.lowerThird;

  const fsBg = fs.background || fs.backgroundColor || '#0c0e14';
  const ltBg = lt.background || lt.backgroundColor || 'rgba(0,0,0,0.85)';
  const ltOpacity = typeof lt.backgroundOpacity === 'number' ? lt.backgroundOpacity : 0.95;
  const ltRadius = lt.borderRadius ? Math.min(6, lt.borderRadius / 2) : 4;
  const ltWidth = lt.width ? `${lt.width}%` : '92%';
  const textAlign = fs.textAlign || 'center';
  const ltTextAlign = lt.textAlign || 'left';

  const fsRefColor = fs.syncRefColor ? fs.fontColor : (fs.referenceColor || lt.accentColor || fs.fontColor || '#ffffff');
  const ltRefColor = lt.syncRefColor ? lt.fontColor : (lt.referenceColor || lt.accentColor || '#C9A96E');

  const fsShadowCss = fs.textShadowEnabled ? '0px 1px 4px rgba(0,0,0,0.9)' : undefined;
  const ltShadowCss = lt.textShadowEnabled ? '0px 1px 3px rgba(0,0,0,0.9)' : undefined;

  const showFull = mode === 'full';

  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '16 / 9',
        borderRadius: 6,
        overflow: 'hidden',
        position: 'relative',
        ...(showFull ? { background: fsBg } : TRANSPARENCY_CHECKS),
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        marginBottom: 8,
        display: 'flex',
        flexDirection: 'column',
        /* Full screen centres its verse in the frame; a lower third sits where
           it sits, near the bottom, over nothing. */
        justifyContent: showFull ? 'center' : 'flex-end',
        padding: '8px 10px 6px 10px',
        boxSizing: 'border-box',
      }}
    >
      {/* Full Screen Content Preview */}
      {showFull && (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center',
          justifyContent: 'center',
          flex: 1,
          width: '100%',
        }}
      >
        <div
          style={{
            fontFamily: fs.fontFamily,
            fontWeight: fs.fontWeight || 700,
            color: fsRefColor,
            fontSize: 9,
            lineHeight: 1.2,
            marginBottom: 2,
            opacity: 0.9,
            textShadow: fsShadowCss,
          }}
        >
          Genesis 1:1
        </div>
        <div
          style={{
            fontFamily: fs.fontFamily,
            fontWeight: fs.fontWeight || 600,
            color: fs.fontColor || '#ffffff',
            fontSize: 10,
            lineHeight: 1.25,
            textAlign,
            maxWidth: '92%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textShadow: fsShadowCss,
          }}
        >
          In the beginning God created...
        </div>
      </div>
      )}

      {/* Mini Lower Third Preview */}
      {!showFull && (
      <div
        style={{
          width: ltWidth,
          margin: '0 auto',
          background: ltBg,
          opacity: ltOpacity,
          borderRadius: ltRadius,
          padding: '3px 6px',
          boxSizing: 'border-box',
          borderLeft: lt.accentColor ? `3px solid ${lt.accentColor}` : undefined,
          display: 'flex',
          flexDirection: 'column',
          alignItems: ltTextAlign === 'right' ? 'flex-end' : ltTextAlign === 'center' ? 'center' : 'flex-start',
        }}
      >
        <div
          style={{
            fontFamily: lt.fontFamily || fs.fontFamily,
            fontWeight: 700,
            color: lt.fontColor || '#ffffff',
            fontSize: 8,
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%',
            textShadow: ltShadowCss,
          }}
        >
          In the beginning God created the heaven
        </div>
        <div
          style={{
            fontFamily: lt.fontFamily || fs.fontFamily,
            fontWeight: 600,
            color: ltRefColor,
            fontSize: 7,
            lineHeight: 1.1,
            marginTop: 1,
            textShadow: ltShadowCss,
          }}
        >
          Genesis 1:1 (KJV)
        </div>
      </div>
      )}
    </div>
  );
}

/* `allowMedia` is the full-screen column only. A lower third is a band drawn
   over whatever is already on the projector; giving it its own clip would put
   a second video behind the band and on top of the one already playing. */
function ThemeFormSection({ values, onChange, allowMedia = false }: { values: any; onChange: (updates: any) => void; allowMedia?: boolean }) {
  const safeInt = (val: string, fallback = 0) => {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? fallback : parsed;
  };

  const bgInfo = parseBackgroundInfo(values.background, values.backgroundColor);
  /* Media, when set, is the type regardless of what `backgroundType` says —
     the resolver reads it first, so the editor has to agree or the dropdown
     would show "Gradient" over a clip that is actually playing. */
  const currentBgType = values.backgroundMediaUrl && values.backgroundMediaType
    ? values.backgroundMediaType
    : values.backgroundType || bgInfo.type;
  const currentStart = values.gradientStart || bgInfo.start;
  const currentEnd = values.gradientEnd || bgInfo.end;
  const currentDir = values.gradientDirection || bgInfo.dir;
  const currentSolid = values.backgroundColor || bgInfo.color;
  const currentOpacity = typeof values.backgroundOpacity === 'number' ? values.backgroundOpacity : 0.95;

  /* Leaving media behind has to erase it, not just stop pointing at it: the
     resolver checks backgroundMediaUrl before any colour, so a stale url would
     keep the old clip on screen under a solid the operator just picked. */
  const CLEAR_MEDIA = { backgroundMediaUrl: '', backgroundMediaType: undefined };

  const handleBgTypeChange = (newType: string) => {
    if (newType === 'image' || newType === 'video') {
      /* No file yet — the grid below asks. Type is staged so the grid knows
         which half of the library to show. */
      onChange({ backgroundMediaType: newType, backgroundMediaUrl: values.backgroundMediaUrl || '' });
    } else if (newType === 'transparent') {
      onChange({ ...CLEAR_MEDIA, backgroundType: 'transparent', background: 'transparent', backgroundColor: 'transparent' });
    } else if (newType === 'solid') {
      const solidColor = currentSolid && currentSolid !== 'transparent' ? currentSolid : (values.gradientStart || '#0f172a');
      onChange({ ...CLEAR_MEDIA, backgroundType: 'solid', background: solidColor, backgroundColor: solidColor });
    } else if (newType === 'gradient') {
      const start = currentStart && currentStart !== 'transparent' ? currentStart : '#0f172a';
      const end = currentEnd && currentEnd !== 'transparent' ? currentEnd : '#312e81';
      const dir = currentDir || '135deg';
      onChange({
        ...CLEAR_MEDIA,
        backgroundType: 'gradient',
        background: gradientCss(start, end, dir),
        backgroundColor: start,
        gradientStart: start,
        gradientEnd: end,
        gradientDirection: dir,
      });
    }
  };

  const handleGradientChange = (updates: { start?: string; end?: string; dir?: string }) => {
    const s = updates.start ?? currentStart;
    const e = updates.end ?? currentEnd;
    const d = updates.dir ?? currentDir;
    const gradCss = gradientCss(s, e, d);
    onChange({
      backgroundType: 'gradient',
      background: gradCss,
      backgroundColor: s,
      gradientStart: s,
      gradientEnd: e,
      gradientDirection: d,
    });
  };

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
            value={values.fontSize ?? 32}
            onChange={(e) => onChange({ fontSize: safeInt(e.target.value, 32) })}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Font Weight</label>
          <select
            className="input"
            value={values.fontWeight || 400}
            onChange={(e) => onChange({ fontWeight: safeInt(e.target.value, 400) })}
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
            {/* Bounce In and Elastic In are retired. Both overshot their
                resting position, which is the one thing broadcast motion does
                not do — a lower third that springs reads as amateur on air.
                A theme saved with either still opens and still plays; it just
                plays on the house curve, and the option says so rather than
                disappearing and silently resetting the operator's choice. */}
            {(values.animation === 'bounceIn' || values.animation === 'elasticIn') && (
              <option value={values.animation}>
                {values.animation === 'bounceIn' ? 'Bounce In' : 'Elastic In'} (retired)
              </option>
            )}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1 }}>
          <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Ref Font Size</label>
          <input
            className="input"
            type="number"
            value={values.referenceFontSize ?? 26}
            onChange={(e) => onChange({ referenceFontSize: safeInt(e.target.value, 26) })}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Text Alignment</label>
          <select
            className="input"
            value={values.textAlign || 'center'}
            onChange={(e) => onChange({ textAlign: e.target.value })}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      </div>

      {/* Reference Color & Sync to Verse Option */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', marginTop: 2 }}>
        <div style={{ flex: 1 }}>
          <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Reference Color</label>
          <input
            className="input"
            type="color"
            disabled={Boolean(values.syncRefColor)}
            value={values.syncRefColor ? (values.fontColor || '#ffffff') : (values.referenceColor || values.accentColor || '#C9A96E')}
            onChange={(e) => onChange({ referenceColor: e.target.value, syncRefColor: false })}
            style={{ height: 34, padding: 2, opacity: values.syncRefColor ? 0.4 : 1, cursor: values.syncRefColor ? 'not-allowed' : 'pointer' }}
          />
        </div>
        <div style={{ flex: 1, paddingBottom: 6 }}>
          <AppleToggle
            label="Sync to Verse"
            checked={Boolean(values.syncRefColor)}
            onChange={(checked) => {
              onChange({
                syncRefColor: checked,
                referenceColor: checked ? (values.fontColor || '#ffffff') : (values.referenceColor || values.accentColor || '#C9A96E'),
              });
            }}
          />
        </div>
      </div>

      {/* Text Shadow Controls Block */}
      <div style={{ background: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', marginTop: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: values.textShadowEnabled ? 6 : 0 }}>
          <span style={{ ...type.label, color: 'var(--text-dim)', fontWeight: 600 }}>Text Shadow</span>
          <AppleToggle
            label="Enable Shadow"
            checked={Boolean(values.textShadowEnabled)}
            onChange={(checked) => onChange({ textShadowEnabled: checked })}
          />
        </div>

        {values.textShadowEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1 }}>
                <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Shadow Level</label>
                <select
                  className="input"
                  value={values.textShadowLevel || 'medium'}
                  onChange={(e) => {
                    const lvl = e.target.value;
                    const blur = lvl === 'heavy' ? 16 : lvl === 'subtle' ? 4 : 8;
                    onChange({ textShadowLevel: lvl, textShadowBlur: blur });
                  }}
                >
                  <option value="subtle">Subtle (Soft Drop)</option>
                  <option value="medium">Medium (Broadcast Sharp)</option>
                  <option value="heavy">Heavy (Deep Glow)</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Shadow Color</label>
                <input
                  className="input"
                  type="color"
                  value={values.textShadowColor || '#000000'}
                  onChange={(e) => onChange({ textShadowColor: e.target.value })}
                  style={{ height: 34, padding: 2 }}
                />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <label style={{ ...type.label, color: 'var(--text-dim)' }}>Blur Radius</label>
                <span style={{ ...type.caption, color: 'var(--text-dim)' }}>{values.textShadowBlur ?? 8}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                value={values.textShadowBlur ?? 8}
                onChange={(e) => onChange({ textShadowBlur: safeInt(e.target.value, 8) })}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Background Style Editor */}
      <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', marginTop: 4 }}>
        <div style={{ ...type.label, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span>Background Style</span>
          <span className="badge" style={{ fontSize: 10 }}>{currentBgType.toUpperCase()}</span>
        </div>

        {/* Live Swatch Preview */}
        <div
          style={{
            height: 36,
            borderRadius: 6,
            marginBottom: 10,
            border: '1px solid rgba(255,255,255,0.1)',
            background: values.background || values.backgroundColor || '#0c0e14',
            opacity: currentOpacity,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          }}
        >
          {currentBgType === 'image' ? 'Image Background'
            : currentBgType === 'video' ? 'Video Background'
            : currentBgType === 'gradient' ? 'Gradient Preview'
            : currentBgType === 'transparent' ? 'Transparent'
            : 'Solid Preview'}
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Background Type</label>
            <select
              className="input"
              value={currentBgType}
              onChange={(e) => handleBgTypeChange(e.target.value)}
            >
              <option value="solid">Solid Color</option>
              <option value="gradient">Gradient</option>
              {allowMedia && <option value="image">Image</option>}
              {allowMedia && <option value="video">Video</option>}
              <option value="transparent">Transparent</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Opacity ({Math.round(currentOpacity * 100)}%)</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={currentOpacity}
              onChange={(e) => onChange({ backgroundOpacity: parseFloat(e.target.value) })}
              style={{ width: '100%', marginTop: 8 }}
            />
          </div>
        </div>

        {allowMedia && (currentBgType === 'image' || currentBgType === 'video') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <MediaGrid
              kind={currentBgType}
              selectedUrl={values.backgroundMediaUrl || ''}
              onSelect={(item) => onChange({
                backgroundMediaUrl: item.url,
                backgroundMediaType: item.type,
                backgroundFit: values.backgroundFit || 'cover',
              })}
            />
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Fit</label>
                <select
                  className="input"
                  value={values.backgroundFit || 'cover'}
                  onChange={(e) => onChange({ backgroundFit: e.target.value })}
                >
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                  <option value="fill">Stretch</option>
                </select>
              </div>
              {currentBgType === 'video' && (
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, ...type.caption, color: 'var(--text-secondary)', paddingBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={values.backgroundLoop !== false}
                    onChange={(e) => onChange({ backgroundLoop: e.target.checked })}
                  />
                  Loop
                </label>
              )}
            </div>
          </div>
        )}

        {currentBgType === 'solid' && (
          <div>
            <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Solid Fill Color</label>
            <input
              className="input"
              type="color"
              value={currentSolid.startsWith('#') ? currentSolid : '#0c0e14'}
              onChange={(e) => onChange({ backgroundColor: e.target.value, background: e.target.value })}
              style={{ height: 34, padding: 2, width: '100%' }}
            />
          </div>
        )}

        {currentBgType === 'gradient' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Gradient Presets */}
            <div>
              <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>Gradient Presets</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                {[
                  { name: 'Sapphire', start: '#0f172a', end: '#312e81', dir: '135deg' },
                  { name: 'Purple', start: '#1a0033', end: '#7b1fa2', dir: '135deg' },
                  { name: 'Emerald', start: '#001a0a', end: '#178e4c', dir: '135deg' },
                  { name: 'Crimson', start: '#1b0000', end: '#e65100', dir: '135deg' },
                  { name: 'Gold', start: '#1a140a', end: '#c9a96e', dir: '135deg' },
                  { name: 'Midnight', start: '#070913', end: '#0f172a', dir: '180deg' },
                ].map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    className="btn btn-sm btn-secondary"
                    style={{ fontSize: 10, padding: '3px 6px', background: `linear-gradient(${p.dir}, ${p.start}, ${p.end})`, color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                    onClick={() => handleGradientChange({ start: p.start, end: p.end, dir: p.dir })}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1 }}>
                <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Start Color</label>
                <input
                  className="input"
                  type="color"
                  value={currentStart.startsWith('#') ? currentStart : '#0f172a'}
                  onChange={(e) => handleGradientChange({ start: e.target.value })}
                  style={{ height: 32, padding: 2 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>End Color</label>
                <input
                  className="input"
                  type="color"
                  value={currentEnd.startsWith('#') ? currentEnd : '#312e81'}
                  onChange={(e) => handleGradientChange({ end: e.target.value })}
                  style={{ height: 32, padding: 2 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Direction</label>
                <select
                  className="input"
                  value={currentDir}
                  onChange={(e) => handleGradientChange({ dir: e.target.value })}
                >
                  <option value="135deg">Diagonal (135°)</option>
                  <option value="180deg">Top to Bottom (180°)</option>
                  <option value="90deg">Left to Right (90°)</option>
                  <option value="45deg">Reverse Diag (45°)</option>
                  <option value="radial">Radial Circle</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1 }}>
          <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Radius</label>
          <input
            className="input"
            type="number"
            value={values.borderRadius ?? 0}
            onChange={(e) => onChange({ borderRadius: safeInt(e.target.value, 0) })}
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
            onChange={(e) => onChange({ width: safeInt(e.target.value, 92) })}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Position X (px)</label>
          <input
            className="input"
            type="number"
            value={values.offsetX ?? 0}
            onChange={(e) => onChange({ offsetX: safeInt(e.target.value, 0) })}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ ...type.label, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Position Y (px)</label>
          <input
            className="input"
            type="number"
            value={values.offsetY ?? 0}
            onChange={(e) => onChange({ offsetY: safeInt(e.target.value, 0) })}
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
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
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
