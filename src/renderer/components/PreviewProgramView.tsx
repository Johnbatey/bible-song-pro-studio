import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import type { Scene } from '../types';
import { useProgramSurfaceState } from '../hooks/useProgramSurfaceState';
import { useAssetBaseUrl } from '../hooks/useAssetBaseUrl';
import { resolveBgVideoLoop } from '../utils/background';
import { ensureTheme } from '../utils/defaultTheme';
import { resolveEffectiveOutputMode } from '../utils/outputMode';
import { ProgramSurface } from './display/ProgramSurface';
import { Block, BlockButton, BlockSegment } from './Block';
import { type, fontWeight } from '../styles/type';

function getSceneDescription(scene: Scene | null | undefined): string {
  if (!scene) return '';
  if (scene.name && scene.name.trim().length > 0) {
    return scene.name;
  }
  if (scene.content?.reference) {
    return scene.content.reference;
  }
  if (scene.type === 'bible') {
    return 'Scripture';
  }
  if (scene.type === 'song') {
    return scene.content?.text ? scene.content.text.split('\n')[0] : 'Song';
  }
  if (scene.type === 'presentation') {
    return 'Presentation';
  }
  return scene.type.toUpperCase();
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.05;
const STAGE_GAP = 12;
const STAGE_LABEL_HEIGHT = 20;
const STAGE_SAFE_PAD = 76;
const STAGE_ASPECT = 16 / 9;

function clampZoom(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, value));
}

interface PreviewProgramViewProps {
  /** Studio mode opens the Scenes panel, basic mode returns to Bible. */
  onPanelChange?: (panel: string) => void;
}

export function PreviewProgramView({ onPanelChange }: PreviewProgramViewProps = {}) {
  const currentScene = useAppStore((s) => s.display.currentScene);
  const previewScene = useAppStore((s) => s.display.previewScene);
  const isTransitioning = useAppStore((s) => s.display.isTransitioning);
  const mode = useAppStore((s) => s.display.mode);
  const setMode = useAppStore((s) => s.setMode);
  const outputMode = useAppStore((s) => s.display.outputMode);
  const bibleOutputMode = useAppStore((s) => s.display.bibleOutputMode);
  const songOutputMode = useAppStore((s) => s.display.songOutputMode);
  const setOutputMode = useAppStore((s) => s.setOutputMode);
  const setBibleOutputMode = useAppStore((s) => s.setBibleOutputMode);
  const setSongOutputMode = useAppStore((s) => s.setSongOutputMode);
  const rawTheme = useAppStore((s) => s.activeTheme);
  const activeTheme = useMemo(() => ensureTheme(rawTheme), [rawTheme]);
  const activeAlert = useAppStore((s) => s.activeAlert);
  const transcription = useAppStore((s) => s.transcription.text);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; x: number; y: number } | null>(null);
  const zoomRef = useRef(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  /* True while the view is moving. Drives will-change on the stage: the
     compositor gets the gesture, then the layer is released so Chromium
     re-rasterises at the resting scale instead of stretching a stale texture. */
  const [isInteracting, setIsInteracting] = useState(false);
  const settleTimer = useRef<number | undefined>(undefined);
  const [stageSize, setStageSize] = useState({ width: 960, height: 560, itemWidth: 474 });

  /* Stable identities so the memoised surfaces are not re-rendered by every
     zoom or pan tick — those only move the wrapper's transform. */
  const previewTransport = useAppStore((s) =>
    s.display.videoTransport.target === 'preview' ? s.display.videoTransport : null);
  /* Preview deliberately does NOT carry blackout: it shows what is cued, and
     blackout is a statement about what is on air. It does follow the standby
     preference, so the two panes agree about the idle card. */
  const showStandbyBrand = useAppStore((s) => s.showStandbyBrand);
  const standbyMedia = useAppStore((s) => s.standbyMedia);
  const previewSurfaceState = useMemo(
    () => ({
      scene: previewScene, outputMode, theme: activeTheme, videoTransport: previewTransport,
      showStandbyBrand, standbyMedia,
      bgVideoLoop: resolveBgVideoLoop(previewScene?.background, activeTheme),
    }),
    [previewScene, outputMode, activeTheme, previewTransport, showStandbyBrand, standbyMedia],
  );
  /* Shared with the stage display's program pane — both are claims about what
     the congregation is seeing, so neither derives it privately. */
  const programSurfaceState = useProgramSurfaceState();
  /* These panes are always mounted, so they are the clock the transport reads:
     the audience window may not be open, and the browser and NDI clients are
     not ours to ask. Only the pane the transport is pointed at reports. */
  const videoTarget = useAppStore((s) => s.display.videoTransport.target);
  const reportVideoClock = useAppStore((s) => s.reportVideoClock);
  const setVideoPlaying = useAppStore((s) => s.setVideoPlaying);
  /* Scenes store media relative, so these panes have to resolve it — without
     this an imported image or video renders as nothing here. */
  const assetBaseUrl = useAssetBaseUrl();

  const isStudio = mode === 'studio';
  // Something is staged that the audience isn't seeing yet
  const hasPendingTake = isStudio && Boolean(previewScene) && currentScene?.id !== previewScene?.id;
  const zoomLabel = `${Math.round(zoom * 100)}%`;
  const outputScale = stageSize.itemWidth / 1920;

  const activeCategoryScene = previewScene || currentScene;
  const activeEffectiveMode = useMemo(
    () => resolveEffectiveOutputMode(activeCategoryScene, { outputMode, bibleOutputMode, songOutputMode }),
    [activeCategoryScene, outputMode, bibleOutputMode, songOutputMode],
  );

  const handleOutputModeToggle = (targetMode: 'fullscreen' | 'lowerThird') => {
    if (activeCategoryScene?.type === 'bible') {
      setBibleOutputMode(targetMode);
    } else if (activeCategoryScene?.type === 'song') {
      setSongOutputMode(targetMode);
    } else {
      setOutputMode(targetMode);
    }
  };

  const markInteracting = useCallback(() => {
    setIsInteracting(true);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => setIsInteracting(false), 220);
  }, []);

  useLayoutEffect(() => () => window.clearTimeout(settleTimer.current), []);

  const updateZoom = useCallback((next: number) => {
    const nextZoom = clampZoom(next);
    zoomRef.current = nextZoom;
    markInteracting();
    setZoom((current) => Math.abs(current - nextZoom) < 0.001 ? current : nextZoom);
  }, [markInteracting]);

  const fitToViewport = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const { clientWidth: w, clientHeight: h } = el;
    if (w <= 0 || h <= 0) return;
    const availW = Math.max(160, w - STAGE_SAFE_PAD);
    const availH = Math.max(120, h - STAGE_SAFE_PAD);
    const zoomW = availW / stageSize.width;
    const zoomH = availH / stageSize.height;
    const fitZoom = clampZoom(Math.min(zoomW, zoomH));
    zoomRef.current = fitZoom;
    markInteracting();
    setZoom(fitZoom);
    setPan({ x: 0, y: 0 });
  }, [stageSize, markInteracting]);

  /* Recompute stageSize from container width and studio mode */
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w <= 0 || h <= 0) continue;
        const availableHeight = Math.max(120, h - STAGE_SAFE_PAD);
        if (isStudio) {
          /* Two displays side by side */
          const maxItemWidth = (w - STAGE_SAFE_PAD - STAGE_GAP) / 2;
          const maxItemHeight = availableHeight - STAGE_LABEL_HEIGHT;
          const itemWidthByHeight = maxItemHeight * STAGE_ASPECT;
          const itemWidth = Math.max(160, Math.min(maxItemWidth, itemWidthByHeight));
          const itemHeight = itemWidth / STAGE_ASPECT;
          const totalWidth = itemWidth * 2 + STAGE_GAP;
          const totalHeight = itemHeight + STAGE_LABEL_HEIGHT;
          setStageSize({ width: Math.round(totalWidth), height: Math.round(totalHeight), itemWidth: Math.round(itemWidth) });
        } else {
          /* Single display */
          const maxItemWidth = w - STAGE_SAFE_PAD;
          const maxItemHeight = availableHeight - STAGE_LABEL_HEIGHT;
          const itemWidthByHeight = maxItemHeight * STAGE_ASPECT;
          const itemWidth = Math.max(200, Math.min(maxItemWidth, itemWidthByHeight));
          const itemHeight = itemWidth / STAGE_ASPECT;
          setStageSize({ width: Math.round(itemWidth), height: Math.round(itemHeight + STAGE_LABEL_HEIGHT), itemWidth: Math.round(itemWidth) });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isStudio]);

  const setZoomAround = useCallback((next: number) => {
    updateZoom(next);
  }, [updateZoom]);

  const fitStage = useCallback(() => {
    fitToViewport();
  }, [fitToViewport]);

  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const delta = -event.deltaY * 0.005;
      setZoomAround(zoom + delta);
    } else {
      markInteracting();
      setPan((current) => ({
        x: current.x - event.deltaX,
        y: current.y - event.deltaY,
      }));
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('[data-no-pan="true"]')) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: pan.x,
      y: pan.y,
    };
    setIsPanning(true);
    markInteracting();
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    markInteracting();
    setPan({
      x: drag.x + event.clientX - drag.startX,
      y: drag.y + event.clientY - drag.startY,
    });
  }

  function finishPan(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      setIsPanning(false);
    }
  }

  return (
    <Block
      className="pv-dock"
      title="Output"
      subtitle={isStudio ? 'Preview · Program' : 'Program'}
      flush
      bodyStyle={{ display: 'flex', overflow: 'hidden' }}
      footer={(
        <div style={styles.footerGrid}>
          {/* Empty left track — the grid's 1fr/auto/1fr is what centres the
              cluster, so both flanks have to stay even when unused. */}
          <div style={styles.footerLeft} />

          {/* Centre: Studio, then the output-mode switch, then scale */}
          <div style={styles.footerCentre}>
          <button
            style={{
              ...styles.studioBtn,
              // Studio is a workspace mode — nothing is on air because of it.
              color: 'var(--text-primary)',
              borderColor: isStudio ? 'var(--border-primary)' : 'var(--border-primary)',
              background: isStudio ? 'var(--chrome-control-active)' : 'var(--chrome-control)',
              fontWeight: isStudio ? 600 : 500,
            }}
            onClick={() => {
              if (isStudio) {
                setMode('basic');
              } else {
                setMode('studio');
              }
            }}
            title="Toggle Studio Mode & Canvas Editor"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
            <span>Studio</span>
          </button>

            <BlockSegment>
              <BlockButton
                active={activeEffectiveMode === 'fullscreen'}
                onClick={() => handleOutputModeToggle('fullscreen')}
                title={`Fullscreen Output Mode (FS)${activeCategoryScene?.type ? ` [${activeCategoryScene.type}]` : ''}`}
              >
                FS
              </BlockButton>
              <BlockButton
                active={activeEffectiveMode === 'lowerThird'}
                onClick={() => handleOutputModeToggle('lowerThird')}
                title={`Lower Third Output Mode (LT)${activeCategoryScene?.type ? ` [${activeCategoryScene.type}]` : ''}`}
              >
                LT
              </BlockButton>
            </BlockSegment>

            <div className="zoombar-pill">
              <input
                type="range"
                min={ZOOM_MIN}
                max={ZOOM_MAX}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoomAround(Number(event.currentTarget.value))}
                title="Preview/program scale"
              />
              <button
                type="button"
                className="zoombar-label"
                onClick={() => setZoom(1)}
                title="Reset zoom to 100%"
              >
                {Math.round(zoom * 100)}%
              </button>
            </div>
          </div>

          {/* Both flanking tracks stay, so the cluster holds the true middle. */}
          <div style={styles.footerRight} />
        </div>
      )}
    >
      <div
        ref={viewportRef}
        style={{ ...styles.viewport, cursor: isPanning ? 'grabbing' : 'grab' }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPan}
        onPointerCancel={finishPan}
      >
        <div
          ref={stageRef}
          style={{
            ...styles.stage,
            width: stageSize.width,
            height: stageSize.height,
            transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
            willChange: isPanning || isInteracting ? 'transform' : 'auto',
          }}
        >
          {isStudio && (
            <div style={{ ...styles.previewCol, width: stageSize.itemWidth }}>
              {/* Preview is green whether or not a take is pending — a cued
                  source is still a cued source. The readiness lives in the
                  label and the border, not in a sixth colour: the tally set is
                  five states and yellow is not one of them. */}
              <div style={styles.label}>
                <span style={{ ...styles.dot, background: 'var(--tally-preview)' }} />
                <span>Preview{hasPendingTake ? ' · ready to take' : ''}</span>
                {previewScene && (
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, maxWidth: '55%', overflow: 'hidden' }}>
                    <span
                      className="pv-hud-pill-next"
                      title={`Next Up: ${getSceneDescription(previewScene)}`}
                    >
                      Next: {getSceneDescription(previewScene)}
                    </span>
                  </div>
                )}
              </div>
              <div style={{
                ...styles.displayBox,
                borderColor: 'var(--tally-preview)',
                boxShadow: hasPendingTake ? '0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px var(--tally-preview)' : undefined,
                background: previewSurfaceState.outputMode === 'lowerThird'
                  ? 'repeating-conic-gradient(#262628 0% 25%, #161414 0% 50%) 50% / 24px 24px'
                  : '#000',
              }}>
                <div style={{ ...styles.outputFrame, transform: `scale(${outputScale})` }}>
                  <ProgramSurface
                    className="program-pane-surface"
                    preview={false}
                    state={previewSurfaceState}
                    assetBaseUrl={assetBaseUrl}
                    onVideoClock={videoTarget === 'preview' ? reportVideoClock : undefined}
                    onVideoPlayState={videoTarget === 'preview' ? setVideoPlaying : undefined}
                  />
                </div>
              </div>
            </div>
          )}
          <div style={{ ...(isStudio ? styles.previewCol : styles.programColSolo), width: stageSize.itemWidth }}>
            {/* Program was red, which in this system means Fault — a dropped
                source or no signal. Program is Signal, and the reason the
                whole palette is built around one orange: if it is orange, it
                is on screen. */}
            <div style={styles.label}>
              <span style={{ ...styles.dot, background: 'var(--tally-program)' }} />
              <span>Program{!isStudio ? ' · live' : ''}</span>
              {currentScene && (
                <span
                  className="pv-hud-pill-live"
                  title={`On Air: ${getSceneDescription(currentScene)}`}
                  style={{
                    marginLeft: 'auto',
                    maxWidth: '50%',
                  }}
                >
                  Live: {getSceneDescription(currentScene)}
                </span>
              )}
            </div>
            <div style={{
              ...styles.displayBox,
              borderColor: 'var(--tally-program)',
              background: (programSurfaceState.outputMode || programSurfaceState.mode) === 'lowerThird'
                ? 'repeating-conic-gradient(#262628 0% 25%, #161414 0% 50%) 50% / 24px 24px'
                : '#000',
            }}>
              <div style={{ ...styles.outputFrame, transform: `scale(${outputScale})` }}>
                <ProgramSurface
                  className="program-pane-surface"
                  preview={false}
                  state={programSurfaceState}
                  assetBaseUrl={assetBaseUrl}
                  onVideoClock={videoTarget === 'program' ? reportVideoClock : undefined}
                  onVideoPlayState={videoTarget === 'program' ? setVideoPlaying : undefined}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Block>
  );
}

const styles: Record<string, React.CSSProperties> = {
  /* Three tracks so the Studio button lands on the true centre of the bar,
     whatever the scale controls and FS/LT weigh on either side. */
  footerGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    gap: 10,
    /* minWidth rather than width so the row can exceed a narrow footer and let
       it scroll, instead of absorbing the squeeze and crushing the controls. */
    minWidth: '100%',
  },
  footerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  /* Scale trails the output-mode switch; its own inner spacing is tighter than
     the block gutter separating the three controls. */
  footerScale: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  footerCentre: {
    display: 'flex',
    alignItems: 'center',
    /* The same gutter window blocks sit apart by. */
    gap: 'var(--block-gap)',
    minWidth: 0,
  },
  footerRight: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  studioBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 28,
    padding: '0 14px',
    borderRadius: 6,
    border: '1px solid var(--block-line)',
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
    transition: 'color 0.15s ease, background 0.15s ease, border-color 0.15s ease',
  },
  viewport: {
    position: 'relative',
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    background: 'var(--bg-primary)',
    touchAction: 'none',
  },
  stage: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    display: 'flex',
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
    transformOrigin: 'center center',
  },
  previewCol: {
    flex: '0 0 auto',
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  programColSolo: {
    flex: '0 0 auto',
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    ...type.label,
    color: 'var(--text-secondary)',
    marginBottom: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
  },
  displayBox: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16/9',
    borderRadius: 0,
    overflow: 'hidden',
    background: '#000',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
  },
  outputFrame: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 1920,
    height: 1080,
    transformOrigin: 'top left',
  },
  footerLabel: {
    ...type.label,
    color: 'var(--text-dim)',
  },
  zoomBtn: {
    width: 24,
    height: 24,
    border: '1px solid var(--block-line)',
    borderRadius: 5,
    background: 'var(--block-active)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontWeight: fontWeight.semibold,
  },
  zoomBtnWide: {
    height: 24,
    padding: '0 8px',
    border: '1px solid var(--block-line)',
    borderRadius: 5,
    background: 'var(--block-active)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontWeight: fontWeight.semibold,
  },
};
