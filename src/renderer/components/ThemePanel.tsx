import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import type { Theme } from '../types';
import { type, fontWeight } from '../styles/type';
import { Block, BlockButton } from './Block';
import { useAssetBaseUrl } from '../hooks/useAssetBaseUrl';
import { assetUrl } from '../utils/asset-url';
import { ThemeEditorForm, type ThemeSurface } from './ThemeEditorForm';

const PRESET_THEMES: Theme[] = [
  {
    id: 'theme-bsp-studio-pro',
    name: 'BSP Studio Pro',
    lowerThird: {
      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(5, 7, 13, 0.95))',
      backgroundType: 'gradient',
      backgroundColor: '#0f172a',
      gradientStart: '#0f172a',
      gradientEnd: '#05070d',
      gradientDirection: '135deg',
      backgroundOpacity: 0.95,
      accentColor: '#FF5500',
      referenceColor: '#FF5500',
      fontFamily: 'Inter, -apple-system, SF Pro Display, sans-serif',
      fontSize: 36,
      referenceFontSize: 24,
      fontWeight: 700,
      fontColor: '#ffffff',
      textAlign: 'center',
      padding: 20,
      borderRadius: 6,
      animation: 'slideInLeft',
      position: 'bottom-center',
      width: 75,
      offsetX: 0,
      offsetY: 0,
    },
    fullScreen: {
      background: 'linear-gradient(135deg, #0f172a, #05070d)',
      backgroundType: 'gradient',
      backgroundColor: '#0f172a',
      gradientStart: '#0f172a',
      gradientEnd: '#05070d',
      gradientDirection: '135deg',
      fontFamily: 'Inter, -apple-system, SF Pro Display, sans-serif',
      fontSize: 60,
      referenceFontSize: 36,
      fontWeight: 700,
      fontColor: '#ffffff',
      referenceColor: '#FF5500',
      textAlign: 'center',
      animation: 'fadeIn',
      offsetX: 0,
      offsetY: 0,
    },
    slideTheme: {
      backgroundColor: '#0f172a',
      fontFamily: 'Inter, -apple-system, SF Pro Display, sans-serif',
      fontSize: 40,
      fontWeight: 600,
      fontColor: '#ffffff',
      accentColor: '#FF5500',
      transition: 'fade',
    },
  },
  {
    id: 'theme-1',
    name: 'Classic Gold',
    lowerThird: {
      background: 'linear-gradient(135deg, #9A1312, #000000)',
      backgroundType: 'gradient',
      backgroundColor: '#9A1312',
      gradientStart: '#9A1312',
      gradientEnd: '#000000',
      gradientDirection: '135deg',
      savedGradientStart: '#9A1312',
      savedGradientEnd: '#000000',
      savedGradientDir: '135deg',
      savedSolidColor: '#9A1312',
      backgroundOpacity: 0.95,
      accentColor: '#FFCF66',
      referenceColor: '#FFCF66',
      savedRefColor: '#FFCF66',
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
      background: 'linear-gradient(135deg, #9A1312, #000000)',
      backgroundType: 'gradient',
      backgroundColor: '#9A1312',
      gradientStart: '#9A1312',
      gradientEnd: '#000000',
      gradientDirection: '135deg',
      savedGradientStart: '#9A1312',
      savedGradientEnd: '#000000',
      savedGradientDir: '135deg',
      savedSolidColor: '#9A1312',
      fontFamily: 'Georgia, serif',
      fontSize: 65,
      referenceFontSize: 50,
      fontWeight: 700,
      fontColor: '#ffffff',
      referenceColor: '#FFCF66',
      savedRefColor: '#FFCF66',
      textAlign: 'center',
      animation: 'fadeIn',
      offsetX: 0,
      offsetY: 0,
    },
    slideTheme: {
      backgroundColor: '#9A1312',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 36,
      fontWeight: 500,
      fontColor: '#ffffff',
      accentColor: '#FFCF66',
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
      referenceColor: '#3498db',
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
      referenceColor: '#3498db',
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
      referenceColor: '#2ecc71',
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
      referenceColor: '#2ecc71',
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
      referenceColor: '#e74c3c',
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
      referenceColor: '#e74c3c',
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
      referenceColor: '#C9A96E',
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
      referenceColor: '#C9A96E',
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
      referenceColor: '#e1bee7',
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
      referenceColor: '#e1bee7',
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
      referenceColor: '#80deea',
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
      referenceColor: '#80deea',
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
];

export function ThemePanel() {
  const themes = useAppStore((s) => s.themes);
  const addTheme = useAppStore((s) => s.addTheme);
  const updateTheme = useAppStore((s) => s.updateTheme);
  const removeTheme = useAppStore((s) => s.removeTheme);
  const activeTheme = useAppStore((s) => s.activeTheme);
  const setActiveTheme = useAppStore((s) => s.setActiveTheme);
  const [editTheme, setEditTheme] = useState<Theme | null>(null);
  const [editSurface, setEditSurface] = useState<ThemeSurface>('full');
  /* Which output each card is previewing. Per card, not one setting for the
     grid: comparing two themes usually means looking at the same output on
     both, but checking one theme's lower third should not reframe the other
     eleven. Full screen is the default because it is what most of a service
     is. */
  const [thumbMode, setThumbMode] = useState<Record<string, ThumbMode>>({});
  const thumbModeFor = (id: string): ThumbMode => thumbMode[id] ?? 'full';

  const openEditor = (theme: Theme, surface: ThemeSurface = 'full') => {
    setEditSurface(surface);
    setEditTheme(theme);
  };

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
                <BlockButton onClick={() => openEditor(activeTheme, thumbModeFor(activeTheme.id))}>
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
                  openEditor(t, 'full');
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
                        openEditor(theme, thumbModeFor(theme.id));
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
          bodyStyle={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
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
                  <span style={styles.nameLabel}>Design name</span>
                  <input
                    className="input"
                    value={editTheme.name}
                    onChange={(event) => renameTheme(editTheme, event.target.value)}
                    onBlur={() => commitThemeName(editTheme)}
                  />
                </label>
              </div>

              <div style={styles.editorPreview}>
                <ThemeThumbnailPreview theme={editTheme} mode={editSurface} />
              </div>

              <div style={styles.surfaceTabs} role="tablist" aria-label="Output to edit">
                {THUMB_MODES.map((option) => {
                  const selected = editSurface === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setEditSurface(option.id)}
                      style={{
                        ...styles.surfaceTab,
                        background: selected ? option.tint : 'transparent',
                        color: selected ? option.color : 'var(--text-dim)',
                        fontWeight: selected ? fontWeight.semibold : fontWeight.medium,
                      }}
                    >
                      {option.id === 'full' ? 'Full screen' : 'Lower third'}
                    </button>
                  );
                })}
              </div>
              <p style={styles.surfaceHint}>
                {editSurface === 'full'
                  ? 'Editing the full-stage look — colour, still or clip behind the verse.'
                  : 'Editing the banner only. An image here fills the lower third, not the whole screen.'}
              </p>

              <div style={styles.editorBody}>
                <ThemeEditorForm
                  key={editSurface}
                  surface={editSurface}
                  values={editSurface === 'full' ? editTheme.fullScreen : editTheme.lowerThird}
                  onChange={(updates) => applyThemeEdit(
                    editSurface === 'full'
                      ? { ...editTheme, fullScreen: { ...editTheme.fullScreen, ...updates } }
                      : { ...editTheme, lowerThird: { ...editTheme.lowerThird, ...updates } },
                  )}
                />
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
  const assetBaseUrl = useAssetBaseUrl();
  const fs = theme.fullScreen;
  const lt = theme.lowerThird;

  const mediaSrc = fs.backgroundMediaUrl
    ? assetUrl(fs.backgroundMediaUrl, assetBaseUrl)
    : '';
  const ltMediaSrc = lt.backgroundMediaUrl
    ? assetUrl(lt.backgroundMediaUrl, assetBaseUrl)
    : '';
  const fsBg = fs.background || fs.backgroundColor || '#0c0e14';
  const ltBg = lt.background || lt.backgroundColor || 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(5, 7, 13, 0.95))';
  const ltRadius = lt.borderRadius ? Math.min(6, Math.max(2, lt.borderRadius / 4)) : 4;
  const ltWidth = lt.width ? `${lt.width}%` : '75%';
  const textAlign = fs.textAlign || 'center';
  const ltTextAlign = lt.textAlign || 'left';

  const fsRefColor = fs.syncRefColor
    ? (fs.fontColor || '#ffffff')
    : (fs.referenceColor || lt.referenceColor || lt.accentColor || fs.fontColor || '#ffffff');
  const ltRefColor = lt.syncRefColor
    ? (lt.fontColor || '#ffffff')
    : (lt.referenceColor || fs.referenceColor || lt.accentColor || '#FF5500');

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
        justifyContent: showFull ? 'center' : 'flex-end',
        padding: showFull ? '8px 10px 6px 10px' : '0 0 8px 0',
        boxSizing: 'border-box',
      }}
    >
      {showFull && mediaSrc && fs.backgroundMediaType === 'image' && (
        <img
          src={mediaSrc}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: fs.backgroundFit || 'cover', pointerEvents: 'none' }}
        />
      )}
      {showFull && mediaSrc && fs.backgroundMediaType === 'video' && (
        <video
          src={mediaSrc}
          muted
          playsInline
          preload="metadata"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: fs.backgroundFit || 'cover', pointerEvents: 'none' }}
        />
      )}
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
          position: 'relative',
          zIndex: 1,
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

      {/* Mini Lower Third Preview — Exact match to ProgramSurface.tsx */}
      {!showFull && (
      <div
        style={{
          width: ltWidth,
          margin: '0 auto',
          background: ltBg,
          backgroundImage: ltMediaSrc && lt.backgroundMediaType === 'image'
            ? `url("${ltMediaSrc.replace(/"/g, '%22')}")`
            : undefined,
          backgroundSize: lt.backgroundFit || 'cover',
          backgroundPosition: 'center',
          borderRadius: ltRadius,
          padding: '4px 8px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: ltTextAlign === 'right' ? 'flex-end' : ltTextAlign === 'center' ? 'center' : 'flex-start',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {ltMediaSrc && lt.backgroundMediaType === 'video' && (
          <video
            src={ltMediaSrc}
            muted
            playsInline
            preload="metadata"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: lt.backgroundFit || 'cover', pointerEvents: 'none' }}
          />
        )}
        <div
          style={{
            fontFamily: lt.fontFamily || fs.fontFamily,
            fontWeight: lt.fontWeight || 700,
            color: lt.fontColor || '#ffffff',
            fontSize: 8,
            lineHeight: 1.15,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%',
            textAlign: ltTextAlign,
            textShadow: ltShadowCss,
            position: 'relative',
            zIndex: 1,
          }}
        >
          In the beginning God created the heaven
        </div>
        <div
          style={{
            fontFamily: lt.fontFamily || fs.fontFamily,
            fontWeight: 700,
            color: ltRefColor,
            fontSize: 7,
            lineHeight: 1.1,
            marginTop: 2,
            textAlign: ltTextAlign,
            textShadow: ltShadowCss,
            position: 'relative',
            zIndex: 1,
          }}
        >
          Genesis 1:1 (KJV)
        </div>
      </div>
      )}
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
    flex: 1,
    minHeight: 0,
  },
  editorPreview: {
    flexShrink: 0,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
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
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    paddingRight: 4,
    paddingBottom: 16,
  },
  surfaceTabs: {
    display: 'flex',
    gap: 4,
    padding: 3,
    marginTop: 4,
    borderRadius: 8,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  surfaceTab: {
    flex: 1,
    border: 'none',
    borderRadius: 6,
    padding: '8px 10px',
    fontSize: 12,
    cursor: 'pointer',
    letterSpacing: '0.02em',
  },
  surfaceHint: {
    ...type.caption,
    color: 'var(--text-dim)',
    margin: '8px 0 12px',
    lineHeight: 1.4,
  },
};
