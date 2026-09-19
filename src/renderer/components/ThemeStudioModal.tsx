import React, { useState, useMemo, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../stores/appStore';
import type { Theme, Scene } from '../types';
import { type, fontWeight } from '../styles/type';
import { useAssetBaseUrl } from '../hooks/useAssetBaseUrl';
import { ThemeEditorForm, type ThemeSurface } from './ThemeEditorForm';
import { createDefaultTheme, ensureTheme } from '../utils/defaultTheme';
import { useI18n } from '../../i18n/useI18n';
import { ProgramSurface, type ProgramSurfaceState } from './display/ProgramSurface';
import './ThemeStudio.css';

export const PRESET_THEMES: Theme[] = [
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
      fontSize: 54,
      referenceFontSize: 34,
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
      backgroundOpacity: 0.95,
      accentColor: '#FFCF66',
      referenceColor: '#FFCF66',
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
      width: 75,
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
      fontFamily: 'Georgia, serif',
      fontSize: 56,
      referenceFontSize: 34,
      fontWeight: 700,
      fontColor: '#ffffff',
      referenceColor: '#FFCF66',
      textAlign: 'center',
      animation: 'fadeIn',
      offsetX: 0,
      offsetY: 0,
    },
    slideTheme: {
      backgroundColor: '#1a0505',
      fontFamily: 'Georgia, serif',
      fontSize: 38,
      fontWeight: 600,
      fontColor: '#ffffff',
      accentColor: '#FFCF66',
      transition: 'fade',
    },
  },
  {
    id: 'theme-2',
    name: 'Midnight Blue',
    lowerThird: {
      background: 'linear-gradient(135deg, rgba(15,32,67,0.95), rgba(43,8,75,0.95))',
      backgroundType: 'gradient',
      backgroundColor: '#0F2043',
      backgroundOpacity: 0.95,
      accentColor: '#3498db',
      referenceColor: '#3498db',
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
      width: 75,
      offsetX: 0,
      offsetY: 0,
    },
    fullScreen: {
      background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
      backgroundType: 'gradient',
      backgroundColor: '#0f0c29',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 52,
      referenceFontSize: 32,
      fontWeight: 700,
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
      backgroundType: 'gradient',
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
      width: 75,
      offsetX: 0,
      offsetY: 0,
    },
    fullScreen: {
      background: 'linear-gradient(135deg, #001a0a, #00411c, #178e4c)',
      backgroundType: 'gradient',
      backgroundColor: '#001a0a',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 52,
      referenceFontSize: 32,
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
      backgroundType: 'gradient',
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
      width: 75,
      offsetX: 0,
      offsetY: 0,
    },
    fullScreen: {
      background: 'linear-gradient(135deg, #1b0000, #781414, #e65100)',
      backgroundType: 'gradient',
      backgroundColor: '#1a0000',
      fontFamily: '-apple-system, SF Pro Display, sans-serif',
      fontSize: 52,
      referenceFontSize: 32,
      fontWeight: 700,
      fontColor: '#ffffff',
      referenceColor: '#e74c3c',
      textAlign: 'center',
      animation: 'fadeIn',
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
      transition: 'crossfade',
    },
  },
];

export function ThemeStudioModal() {
  const { t } = useI18n();
  const isThemeStudioOpen = useAppStore((s) => s.isThemeStudioOpen);
  const closeThemeStudio = useAppStore((s) => s.closeThemeStudio);
  const themes = useAppStore((s) => s.themes);
  const activeTheme = useAppStore((s) => s.activeTheme);
  const setActiveTheme = useAppStore((s) => s.setActiveTheme);
  const addTheme = useAppStore((s) => s.addTheme);
  const updateTheme = useAppStore((s) => s.updateTheme);
  const removeTheme = useAppStore((s) => s.removeTheme);
  const pushNotice = useAppStore((s) => s.notify);
  const assetBaseUrl = useAssetBaseUrl();

  const allThemes = useMemo(() => {
    const customMap = new Map(themes.map((t) => [t.id, ensureTheme(t)]));
    const mergedPresets = PRESET_THEMES.map((preset) => customMap.get(preset.id) || ensureTheme(preset));
    const nonPresetCustoms = themes.filter((t) => !PRESET_THEMES.some((p) => p.id === t.id)).map(ensureTheme);
    return [...mergedPresets, ...nonPresetCustoms];
  }, [themes]);

  const [selectedThemeId, setSelectedThemeId] = useState<string>(() => {
    return activeTheme?.id || PRESET_THEMES[0].id;
  });

  const selectedTheme = useMemo(() => {
    const found = allThemes.find((th) => th.id === selectedThemeId) || allThemes[0] || createDefaultTheme();
    return ensureTheme(found);
  }, [allThemes, selectedThemeId]);

  const themeStudioInitialOptions = useAppStore((s) => s.themeStudioInitialOptions);

  // Active edit surface tab: 'full' | 'lt'
  const [surfaceTab, setSurfaceTab] = useState<ThemeSurface>(() => {
    return themeStudioInitialOptions?.surfaceTab || 'full';
  });

  // Sample preview text type: 'bible' | 'song'
  const [sampleType, setSampleType] = useState<'bible' | 'song'>(() => {
    return themeStudioInitialOptions?.contentMode || 'bible';
  });

  // Sync initial tab & mode whenever modal opens with options
  useEffect(() => {
    if (isThemeStudioOpen && themeStudioInitialOptions) {
      if (themeStudioInitialOptions.contentMode) {
        setSampleType(themeStudioInitialOptions.contentMode);
      }
      if (themeStudioInitialOptions.surfaceTab) {
        setSurfaceTab(themeStudioInitialOptions.surfaceTab);
      }
    }
  }, [isThemeStudioOpen, themeStudioInitialOptions]);

  // Search in themes catalog
  const [themeSearch, setThemeSearch] = useState('');
  const [themeFilterTab, setThemeFilterTab] = useState<'all' | 'preset' | 'custom'>('all');

  // Canvas Viewport Pan & Zoom state (Slide Editor style)
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

  const [scale, setScale] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const BOARD_WIDTH = 960;
  const BOARD_HEIGHT = 540;

  const fitToViewport = useCallback(() => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const margin = 56;
    if (rect.width <= margin || rect.height <= margin) return;
    const fit = Math.min((rect.width - margin) / BOARD_WIDTH, (rect.height - margin) / BOARD_HEIGHT);
    setScale(Math.max(0.2, Math.min(2.0, Math.round(fit * 100) / 100)));
    setPan({ x: 0, y: 0 });
  }, []);

  useLayoutEffect(() => {
    fitToViewport();
  }, [fitToViewport]);

  const onViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    if ((e.target as HTMLElement).closest('button, input, select, .studio-canvas-footer, .zoombar-pill')) {
      return;
    }
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      ox: pan.x,
      oy: pan.y,
    };
    setIsPanning(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const onViewportPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning || !dragRef.current) return;
    setPan({
      x: dragRef.current.ox + (e.clientX - dragRef.current.startX),
      y: dragRef.current.oy + (e.clientY - dragRef.current.startY),
    });
  };

  const finishViewportPan = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    setIsPanning(false);
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const onViewportWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    setScale((s) => Math.max(0.2, Math.min(2.5, Math.round((s + delta) * 100) / 100)));
  };

  const sampleVerseText = 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.';
  const sampleVerseRef = 'John 3:16 (KJV)';

  const sampleSongText = 'Amazing grace! How sweet the sound\nThat saved a wretch like me!\nI once was lost, but now am found;\nWas blind, but now I see.';
  const sampleSongRef = 'Amazing Grace • Verse 1';

  // Live Canvas Scene & ProgramSurface State (Unconditional Hooks)
  const canvasScene: Scene = useMemo(() => ({
    id: `theme-studio-${sampleType}-${surfaceTab}`,
    name: sampleType === 'bible' ? 'John 3:16' : 'Amazing Grace',
    type: sampleType === 'bible' ? 'bible' : 'song',
    content: {
      text: sampleType === 'bible' ? sampleVerseText : sampleSongText,
      reference: sampleType === 'bible' ? sampleVerseRef : sampleSongRef,
      songCredit: sampleType === 'song' ? { author: 'John Newton', copyright: 'Public Domain' } : undefined,
      version: 'KJV',
    },
    transition: { type: 'cut', duration: 0 },
  }), [sampleType, surfaceTab, sampleVerseText, sampleSongText, sampleVerseRef, sampleSongRef]);

  const effectivePreviewTheme = useMemo(() => {
    const isLinked = selectedTheme.linkBibleSong !== false;
    if (isLinked) return selectedTheme;
    if (sampleType === 'song') {
      return {
        ...selectedTheme,
        fullScreen: selectedTheme.songFullScreen || selectedTheme.fullScreen,
        lowerThird: selectedTheme.songLowerThird || selectedTheme.lowerThird,
      };
    } else {
      return {
        ...selectedTheme,
        fullScreen: selectedTheme.bibleFullScreen || selectedTheme.fullScreen,
        lowerThird: selectedTheme.bibleLowerThird || selectedTheme.lowerThird,
      };
    }
  }, [selectedTheme, sampleType]);

  const canvasSurfaceState: ProgramSurfaceState = useMemo(() => ({
    scene: canvasScene,
    theme: effectivePreviewTheme,
    mode: surfaceTab === 'full' ? 'fullscreen' : 'lowerThird',
    outputMode: surfaceTab === 'full' ? 'fullscreen' : 'lowerThird',
    showReference: true,
  }), [canvasScene, effectivePreviewTheme, surfaceTab]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isThemeStudioOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeThemeStudio();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isThemeStudioOpen, closeThemeStudio]);

  const filteredThemes = allThemes.filter((th) => {
    const matchesSearch = th.name.toLowerCase().includes(themeSearch.toLowerCase());
    if (!matchesSearch) return false;
    const isCustomItem = themes.some((c) => c.id === th.id && !PRESET_THEMES.some((p) => p.id === c.id));
    if (themeFilterTab === 'preset') return !isCustomItem;
    if (themeFilterTab === 'custom') return isCustomItem;
    return true;
  });

  const isCustom = themes.some((th) => th.id === selectedTheme.id && !PRESET_THEMES.some((p) => p.id === th.id));

  const isLinked = selectedTheme.linkBibleSong !== false;

  const toggleLinkBibleSong = () => {
    if (isLinked) {
      // Unlink: duplicate current fullScreen & lowerThird into bible and song specific properties
      const updated: Theme = {
        ...selectedTheme,
        linkBibleSong: false,
        bibleFullScreen: selectedTheme.bibleFullScreen || { ...selectedTheme.fullScreen },
        bibleLowerThird: selectedTheme.bibleLowerThird || { ...selectedTheme.lowerThird },
        songFullScreen: selectedTheme.songFullScreen || { ...selectedTheme.fullScreen },
        songLowerThird: selectedTheme.songLowerThird || { ...selectedTheme.lowerThird },
      };
      updateTheme(selectedTheme.id, updated);
      pushNotice({
        id: `theme-link-${Date.now()}`,
        text: 'Bible and Song styles unlinked — customize each independently',
        type: 'info',
        duration: 2.5,
        animation: 'slideDown',
      });
    } else {
      // Link: copy currently viewed sample type styles to master fullScreen & lowerThird
      const currentFs = sampleType === 'song'
        ? (selectedTheme.songFullScreen || selectedTheme.fullScreen)
        : (selectedTheme.bibleFullScreen || selectedTheme.fullScreen);
      const currentLt = sampleType === 'song'
        ? (selectedTheme.songLowerThird || selectedTheme.lowerThird)
        : (selectedTheme.bibleLowerThird || selectedTheme.lowerThird);

      const updated: Theme = {
        ...selectedTheme,
        linkBibleSong: true,
        fullScreen: { ...currentFs },
        lowerThird: { ...currentLt },
        bibleFullScreen: { ...currentFs },
        bibleLowerThird: { ...currentLt },
        songFullScreen: { ...currentFs },
        songLowerThird: { ...currentLt },
      };
      updateTheme(selectedTheme.id, updated);
      pushNotice({
        id: `theme-link-${Date.now()}`,
        text: 'Bible and Song styles linked — changes apply to both',
        type: 'info',
        duration: 2.5,
        animation: 'slideDown',
      });
    }
  };

  const handleApplyTheme = () => {
    setActiveTheme(selectedTheme);
    pushNotice({
      id: `theme-apply-${Date.now()}`,
      text: `Theme "${selectedTheme.name}" set as active`,
      type: 'info',
      duration: 2.5,
      animation: 'slideDown',
    });
  };

  const handleCreateNewTheme = () => {
    const newId = `theme-${Date.now()}`;
    const newTheme: Theme = {
      ...createDefaultTheme(),
      id: newId,
      name: `Custom Theme ${themes.length + 1}`,
    };
    addTheme(newTheme);
    setSelectedThemeId(newId);
    pushNotice({
      id: `theme-new-${Date.now()}`,
      text: `Created new theme "${newTheme.name}"`,
      type: 'info',
      duration: 2,
      animation: 'slideDown',
    });
  };

  const handleDuplicateTheme = (themeToDup?: Theme, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const target = themeToDup || selectedTheme;
    const newId = `theme-${Date.now()}`;
    const newTheme: Theme = {
      ...target,
      id: newId,
      name: `${target.name} (Copy)`,
    };
    addTheme(newTheme);
    setSelectedThemeId(newId);
    pushNotice({
      id: `theme-dup-${Date.now()}`,
      text: `Duplicated theme as "${newTheme.name}"`,
      type: 'info',
      duration: 2,
      animation: 'slideDown',
    });
  };

  const handleDeleteTheme = (themeId?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const idToDelete = themeId || selectedTheme.id;
    const isCustomTarget = themes.some((th) => th.id === idToDelete && !PRESET_THEMES.some((p) => p.id === th.id));
    if (!isCustomTarget) return;

    removeTheme(idToDelete);
    if (selectedThemeId === idToDelete) {
      if (allThemes.length > 1) {
        const remaining = allThemes.filter((t) => t.id !== idToDelete);
        setSelectedThemeId(remaining[0].id);
      } else {
        setSelectedThemeId(PRESET_THEMES[0].id);
      }
    }
    pushNotice({
      id: `theme-del-${Date.now()}`,
      text: 'Deleted custom theme',
      type: 'info',
      duration: 2,
      animation: 'slideDown',
    });
  };

  const handleUpdateCurrentTheme = (updates: any) => {
    const isSurfaceFull = surfaceTab === 'full';

    if (isLinked) {
      const targetKey = isSurfaceFull ? 'fullScreen' : 'lowerThird';
      const currentSurfaceObj = isSurfaceFull ? selectedTheme.fullScreen : selectedTheme.lowerThird;
      const updatedSurfaceObj = { ...currentSurfaceObj, ...updates };

      updateTheme(selectedTheme.id, {
        ...selectedTheme,
        [targetKey]: updatedSurfaceObj,
        bibleFullScreen: isSurfaceFull ? updatedSurfaceObj : selectedTheme.bibleFullScreen,
        bibleLowerThird: !isSurfaceFull ? updatedSurfaceObj : selectedTheme.bibleLowerThird,
        songFullScreen: isSurfaceFull ? updatedSurfaceObj : selectedTheme.songFullScreen,
        songLowerThird: !isSurfaceFull ? updatedSurfaceObj : selectedTheme.songLowerThird,
      });
    } else {
      // Unlinked: edit only current sample type's surface
      if (sampleType === 'song') {
        const targetKey = isSurfaceFull ? 'songFullScreen' : 'songLowerThird';
        const currentSurfaceObj = isSurfaceFull
          ? (selectedTheme.songFullScreen || selectedTheme.fullScreen)
          : (selectedTheme.songLowerThird || selectedTheme.lowerThird);
        const updatedSurfaceObj = { ...currentSurfaceObj, ...updates };

        updateTheme(selectedTheme.id, {
          ...selectedTheme,
          [targetKey]: updatedSurfaceObj,
        });
      } else {
        const targetKey = isSurfaceFull ? 'bibleFullScreen' : 'bibleLowerThird';
        const masterKey = isSurfaceFull ? 'fullScreen' : 'lowerThird';
        const currentSurfaceObj = isSurfaceFull
          ? (selectedTheme.bibleFullScreen || selectedTheme.fullScreen)
          : (selectedTheme.bibleLowerThird || selectedTheme.lowerThird);
        const updatedSurfaceObj = { ...currentSurfaceObj, ...updates };

        updateTheme(selectedTheme.id, {
          ...selectedTheme,
          [targetKey]: updatedSurfaceObj,
          [masterKey]: updatedSurfaceObj,
        });
      }
    }
  };

  const currentFormValues = useMemo(() => {
    const isSurfaceFull = surfaceTab === 'full';
    if (isLinked) {
      return isSurfaceFull ? selectedTheme.fullScreen : selectedTheme.lowerThird;
    }
    if (sampleType === 'song') {
      return isSurfaceFull
        ? (selectedTheme.songFullScreen || selectedTheme.fullScreen)
        : (selectedTheme.songLowerThird || selectedTheme.lowerThird);
    } else {
      return isSurfaceFull
        ? (selectedTheme.bibleFullScreen || selectedTheme.fullScreen)
        : (selectedTheme.bibleLowerThird || selectedTheme.lowerThird);
    }
  }, [selectedTheme, surfaceTab, sampleType, isLinked]);

  const handleRenameTheme = (name: string) => {
    updateTheme(selectedTheme.id, {
      ...selectedTheme,
      name,
    });
  };

  if (!isThemeStudioOpen) {
    return null;
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'var(--bsp-ground, #0c0b0b)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        color: 'var(--text-primary, #ffffff)',
        fontFamily: 'var(--font-ui, sans-serif)',
      }}
    >
      {/* 1. TOP STUDIO HEADER */}
      <header
        style={{
          height: 48,
          background: 'var(--bsp-surface, #161414)',
          borderBottom: '1px solid var(--border-primary, #262628)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          gap: 16,
          flexShrink: 0,
        }}
      >
        {/* Left: Studio Brand & Active Theme Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                background: 'var(--accent, #FF5500)',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              ✦
            </span>
            <span style={{ fontSize: 13, fontWeight: fontWeight.bold, letterSpacing: '0.04em' }}>
              Theme Studio
            </span>
          </div>

          <div style={{ width: 1, height: 18, background: 'var(--border-primary, #262628)' }} />

          {/* Theme Name input */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              className="input"
              value={selectedTheme.name}
              onChange={(e) => handleRenameTheme(e.target.value)}
              placeholder="Theme name..."
              style={{
                height: 28,
                fontSize: 12,
                fontWeight: 600,
                padding: '0 10px',
                width: 220,
                background: 'var(--bg-secondary)',
              }}
            />
          </div>

          <span
            style={{
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 3,
              background: isCustom ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.08)',
              color: isCustom ? '#60a5fa' : 'var(--text-dim)',
              fontWeight: 600,
            }}
          >
            {isCustom ? 'Custom Theme' : 'Theme Preset'}
          </span>
        </div>

        {/* Right Action Controls: Apply to Live, Done */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleApplyTheme}
            title="Set this theme as active for audience output"
            style={{
              height: 30,
              padding: '0 12px',
              fontSize: 12,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: activeTheme?.id === selectedTheme.id ? 'rgba(34, 197, 94, 0.2)' : 'var(--bg-secondary)',
              borderColor: activeTheme?.id === selectedTheme.id ? 'rgba(34, 197, 94, 0.5)' : 'var(--border-primary)',
              color: activeTheme?.id === selectedTheme.id ? '#4ade80' : 'var(--text-primary)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{activeTheme?.id === selectedTheme.id ? 'Active Theme' : 'Apply Theme'}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={closeThemeStudio}
            title="Close Theme Studio (Esc)"
            style={{
              height: 30,
              padding: '0 12px',
              fontSize: 12,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span>Done</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {/* 2. MAIN 3-PANE WORKSPACE */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        
        {/* ========================================================================= */}
        {/* LEFT PANE: THEMES EXPLORER CATALOG                                        */}
        {/* ========================================================================= */}
        <aside className="studio-left-sidebar">
          {/* Header */}
          <div className="studio-left-sidebar-header">
            <div className="studio-left-header-title">
              <span>Themes Library</span>
              <span className="studio-count-pill">{allThemes.length}</span>
            </div>

            <button
              type="button"
              className="studio-new-btn"
              onClick={handleCreateNewTheme}
              title="Create new theme design"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>New</span>
            </button>
          </div>

          {/* Search & Filter Tabs */}
          <div className="studio-left-controls">
            <div className="studio-search-bar">
              <span className="studio-search-icon">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                className="studio-search-input"
                value={themeSearch}
                onChange={(e) => setThemeSearch(e.target.value)}
                placeholder="Search themes..."
              />
              {themeSearch && (
                <button
                  type="button"
                  className="studio-search-clear"
                  onClick={() => setThemeSearch('')}
                  title="Clear search"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* Filter Category Segmented Tabs */}
            <div className="studio-segmented-pill">
              <button
                type="button"
                className={`studio-segmented-tab ${themeFilterTab === 'all' ? 'active' : ''}`}
                onClick={() => setThemeFilterTab('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`studio-segmented-tab ${themeFilterTab === 'preset' ? 'active' : ''}`}
                onClick={() => setThemeFilterTab('preset')}
              >
                Presets
              </button>
              <button
                type="button"
                className={`studio-segmented-tab ${themeFilterTab === 'custom' ? 'active' : ''}`}
                onClick={() => setThemeFilterTab('custom')}
              >
                Custom
              </button>
            </div>
          </div>

          {/* Theme Thumbnail Cards List */}
          <div className="studio-themes-list">
            {filteredThemes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b', fontSize: 12 }}>
                No themes found matching your filter
              </div>
            ) : (
              filteredThemes.map((theme) => {
                const isSelected = theme.id === selectedTheme.id;
                const isActive = activeTheme?.id === theme.id;
                const isCustomItem = themes.some((th) => th.id === theme.id && !PRESET_THEMES.some((p) => p.id === th.id));

                return (
                  <div
                    key={theme.id}
                    onClick={() => setSelectedThemeId(theme.id)}
                    className={`studio-theme-card ${isSelected ? 'selected' : ''}`}
                  >
                    {/* Miniature 16:9 Thumbnail */}
                    <div
                      className="studio-theme-thumb"
                      style={{
                        background: theme.fullScreen.background || theme.fullScreen.backgroundColor || '#0c0e14',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: theme.fullScreen.fontFamily || 'sans-serif',
                          fontSize: 9.5,
                          fontWeight: theme.fullScreen.fontWeight || 700,
                          color: theme.fullScreen.fontColor || '#ffffff',
                          textAlign: 'center',
                          lineHeight: 1.25,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
                        }}
                      >
                        {theme.name}
                      </span>
                    </div>

                    {/* Info Row: Title & Action Icons */}
                    <div className="studio-theme-card-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                        <span className="studio-theme-card-title">
                          {theme.name}
                        </span>
                        {isActive && (
                          <span className="studio-active-tag" title="Active presentation theme">
                            <span className="studio-active-dot" />
                            <span>LIVE</span>
                          </span>
                        )}
                      </div>

                      <div className="studio-theme-actions" onClick={(e) => e.stopPropagation()}>
                        {/* Duplicate */}
                        <button
                          type="button"
                          onClick={(e) => handleDuplicateTheme(theme, e)}
                          title="Duplicate theme"
                          className="studio-icon-btn"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>

                        {/* Delete Custom Theme */}
                        {isCustomItem && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteTheme(theme.id, e)}
                            title="Delete custom theme"
                            className="studio-icon-btn delete"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ========================================================================= */}
        {/* ========================================================================= */}
        {/* CENTER PANE: INFINITE GRID CANVAS VIEWPORT WITH PAN & ZOOM (SLIDE EDITOR) */}
        {/* ========================================================================= */}
        <main
          ref={viewportRef}
          className="studio-canvas-area"
          onPointerDown={onViewportPointerDown}
          onPointerMove={onViewportPointerMove}
          onPointerUp={finishViewportPan}
          onPointerCancel={finishViewportPan}
          onWheel={onViewportWheel}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundPosition: `${pan.x}px ${pan.y}px`,
            minWidth: 0,
            minHeight: 0,
            position: 'relative',
            overflow: 'hidden',
            cursor: isPanning ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
        >
          {/* Floating Zoom Bar (Slide Editor Style) */}
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: 14,
              right: 16,
              zIndex: 40,
              userSelect: 'none',
            }}
          >
            <div className="zoombar-pill">
              <input
                type="range"
                min={0.2}
                max={2.0}
                step={0.02}
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                title="Zoom Level"
              />
              <span className="zoombar-val">
                {Math.round(scale * 100)}%
              </span>
              <div className="zoombar-divider" />
              <button
                type="button"
                className="zoombar-fit"
                onClick={fitToViewport}
                title="Fit Canvas to Viewport"
              >
                Fit
              </button>
            </div>
          </div>

          {/* Canvas Viewport Area */}
          <div
            style={{
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
              pointerEvents: 'none',
            }}
          >
            {/* The 16:9 Presentation Stage Card with Scaled 1920x1080 ProgramSurface */}
            {(() => {
              const isFsTransparent =
                selectedTheme.fullScreen.backgroundType === 'transparent' ||
                selectedTheme.fullScreen.background === 'transparent' ||
                selectedTheme.fullScreen.backgroundColor === 'transparent' ||
                selectedTheme.fullScreen.backgroundOpacity === 0;
              const showCheckerboard = surfaceTab === 'lt' || isFsTransparent;
              return (
                <div
                  style={{
                    width: BOARD_WIDTH,
                    height: BOARD_HEIGHT,
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${scale})`,
                    transformOrigin: 'center center',
                    willChange: isPanning ? 'transform' : 'auto',
                    borderRadius: 8,
                    overflow: 'hidden',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.12)',
                    background: showCheckerboard
                      ? 'repeating-conic-gradient(#262628 0% 25%, #161414 0% 50%) 50% / 24px 24px'
                      : '#000',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: 1920,
                      height: 1080,
                      transformOrigin: 'top left',
                      transform: 'scale(0.5)',
                    }}
                  >
                    <ProgramSurface
                      state={canvasSurfaceState}
                      preview={false}
                      assetBaseUrl={assetBaseUrl}
                    />
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 3. BOTTOM CANVAS BAR: DOUBLE HEIGHT WITH PRO STROKE SWITCHERS */}
          <div
            className="studio-canvas-footer"
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            {/* Mode Switcher: Full Screen vs Lower Third */}
            <div className="studio-footer-group">
              <span className="studio-footer-label">
                Display Mode
              </span>
              <div className="studio-footer-pill">
                <button
                  type="button"
                  onClick={() => setSurfaceTab('full')}
                  className={`studio-footer-btn ${surfaceTab === 'full' ? 'active' : ''}`}
                  title="Switch preview and editing to Full Screen mode"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="14" x="2" y="3" rx="2" />
                    <line x1="8" x2="16" y1="21" y2="21" />
                    <line x1="12" x2="12" y1="17" y2="21" />
                  </svg>
                  <span>Full Screen</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSurfaceTab('lt')}
                  className={`studio-footer-btn ${surfaceTab === 'lt' ? 'active' : ''}`}
                  title="Switch preview and editing to Lower Third mode"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="14" x="2" y="3" rx="2" />
                    <rect x="5" y="11" width="14" height="3.5" rx="1" fill="currentColor" opacity="0.8" />
                    <line x1="8" x2="16" y1="21" y2="21" />
                    <line x1="12" x2="12" y1="17" y2="21" />
                  </svg>
                  <span>Lower Third</span>
                </button>
              </div>
            </div>

            {/* Sample Content Switcher: Bible vs Song Lyrics */}
            <div className="studio-footer-group">
              <span className="studio-footer-label">
                Content Mode
              </span>
              <div className="studio-footer-pill">
                <button
                  type="button"
                  onClick={() => setSampleType('bible')}
                  className={`studio-footer-btn ${sampleType === 'bible' ? 'active' : ''}`}
                  title="Preview with Bible verse"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                    <path d="M6 6h10" />
                    <path d="M6 10h10" />
                  </svg>
                  <span>Bible</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSampleType('song')}
                  className={`studio-footer-btn ${sampleType === 'song' ? 'active' : ''}`}
                  title="Preview with Song Lyrics sample"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                  <span>Song Lyrics</span>
                </button>
              </div>

              {/* Link / Unlink Toggle Button */}
              <button
                type="button"
                onClick={toggleLinkBibleSong}
                className={`studio-footer-link-btn ${isLinked ? 'linked' : 'unlinked'}`}
                title={isLinked ? 'Bible and Song styles are LINKED (shared). Click to unlink and customize each independently.' : 'Bible and Song styles are UNLINKED (independent). Click to link them.'}
              >
                {isLinked ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M5.16 11.75l-1.72 1.71a5 5 0 0 0 7.07 7.07l1.72-1.71" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                )}
                <span>{isLinked ? 'Linked Styles' : 'Independent'}</span>
              </button>
            </div>
          </div>
        </main>

        {/* ========================================================================= */}
        {/* RIGHT SIDEBAR: FULL SCREEN & LOWER THIRD STYLING INSPECTOR                */}
        {/* ========================================================================= */}
        <aside className="studio-right-sidebar">
          {/* Header with Title and Collapse/Close Button */}
          <div className="studio-sidebar-header">
            <span className="studio-sidebar-title">
              {!isLinked ? (sampleType === 'bible' ? 'Bible • ' : 'Song • ') : ''}
              {surfaceTab === 'full' ? 'Full Screen' : 'Lower Third'}
            </span>
            <button
              type="button"
              onClick={closeThemeStudio}
              className="studio-collapse-btn"
              title="Close Inspector"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="11 17 6 12 11 7" />
                <polyline points="18 17 13 12 18 7" />
              </svg>
            </button>
          </div>

          {/* Top Tabs: Full Screen vs Lower Third */}
          <div className="studio-tabs-row">
            <div className="studio-segmented-pill">
              <button
                type="button"
                onClick={() => setSurfaceTab('full')}
                className={`studio-segmented-tab ${surfaceTab === 'full' ? 'active' : ''}`}
              >
                Full Screen
              </button>
              <button
                type="button"
                onClick={() => setSurfaceTab('lt')}
                className={`studio-segmented-tab ${surfaceTab === 'lt' ? 'active' : ''}`}
              >
                Lower Third
              </button>
            </div>
          </div>

          {/* Form Inspector for the selected surface */}
          <div className="studio-sidebar-scroll">
            <ThemeEditorForm
              surface={surfaceTab}
              contentMode={sampleType}
              values={currentFormValues}
              onChange={handleUpdateCurrentTheme}
            />
          </div>
        </aside>

      </div>
    </div>,
    document.body
  );
}
