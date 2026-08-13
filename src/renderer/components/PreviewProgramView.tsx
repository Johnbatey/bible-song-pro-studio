import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { useProgramSurfaceState } from '../hooks/useProgramSurfaceState';
import { useAssetBaseUrl } from '../hooks/useAssetBaseUrl';
import { resolveBgVideoLoop } from '../utils/background';
import { ProgramSurface } from './display/ProgramSurface';
import { Block, BlockButton, BlockSegment } from './Block';
import { type, fontWeight } from '../styles/type';

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
  const setOutputMode = useAppStore((s) => s.setOutputMode);
  const activeTheme = useAppStore((s) => s.activeTheme);
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
  const previewSurfaceState = useMemo(
    () => ({
      scene: previewScene, outputMode, theme: activeTheme, videoTransport: previewTransport,
      showStandbyBrand,
      bgVideoLoop: resolveBgVideoLoop(previewScene?.background, activeTheme),
    }),
    [previewScene, outputMode, activeTheme, previewTransport, showStandbyBrand],
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

  const measureStage = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const viewportRect = viewport.getBoundingClientRect();
    const columns = isStudio ? 2 : 1;
    const totalGap = isStudio ? STAGE_GAP : 0;
    const availableWidth = Math.max(240, viewportRect.width - STAGE_SAFE_PAD);
    const availableHeight = Math.max(160, viewportRect.height - STAGE_SAFE_PAD - STAGE_LABEL_HEIGHT);
    const itemHeight = Math.max(
      120,
      Math.min(availableHeight, (availableWidth - totalGap) / columns / STAGE_ASPECT),
    );
    const itemWidth = Math.round(itemHeight * STAGE_ASPECT);
    const next = {
      itemWidth,
      width: itemWidth * columns + totalGap,
      height: Math.round(STAGE_LABEL_HEIGHT + itemHeight),
    };

    setStageSize((current) => {
      if (
        Math.abs(current.width - next.width) < 1 &&
        Math.abs(current.height - next.height) < 1 &&
        Math.abs(current.itemWidth - next.itemWidth) < 1
      ) {
        return current;
      }
      return next;
    });
  }, [isStudio]);

  const fitStage = useCallback(() => {
    measureStage();
    updateZoom(1);
    setPan((current) => current.x === 0 && current.y === 0 ? current : { x: 0, y: 0 });
  }, [measureStage, updateZoom]);

  useLayoutEffect(() => {
    let frame = 0;
    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measureStage);
    };
    scheduleMeasure();
    const viewport = viewportRef.current;
    const observer = viewport && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(scheduleMeasure)
      : null;
    if (viewport && observer) observer.observe(viewport);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [isStudio, measureStage]);

  useLayoutEffect(() => {
    updateZoom(1);
    setPan({ x: 0, y: 0 });
    measureStage();
  }, [isStudio, measureStage, updateZoom]);

  const setZoomAround = useCallback((next: number, clientX?: number, clientY?: number) => {
    const viewport = viewportRef.current;
    const nextZoom = clampZoom(next);
    if (!viewport || clientX === undefined || clientY === undefined) {
      updateZoom(nextZoom);
      return;
    }
    const rect = viewport.getBoundingClientRect();
    const focusX = clientX - rect.left - rect.width / 2 - pan.x;
    const focusY = clientY - rect.top - rect.height / 2 - pan.y;
    const currentZoom = zoomRef.current || zoom;
    const ratio = nextZoom / currentZoom;
    setPan({
      x: pan.x + focusX * (1 - ratio),
      y: pan.y + focusY * (1 - ratio),
    });
    updateZoom(nextZoom);
  }, [pan, updateZoom, zoom]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onNativeWheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement | null)?.closest('button,input')) return;
      event.preventDefault();

      if (event.ctrlKey || event.metaKey || event.altKey) {
        const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        setZoomAround(zoomRef.current + delta, event.clientX, event.clientY);
        return;
      }

      markInteracting();
      setPan((current) => ({
        x: current.x - event.deltaX,
        y: current.y - event.deltaY,
      }));
    };

    viewport.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onNativeWheel);
  }, [setZoomAround, markInteracting]);

  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (event.defaultPrevented) return;
    if (event.ctrlKey || event.metaKey || event.altKey) {
      const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoomAround(zoom + delta, event.clientX, event.clientY);
      return;
    }
    setPan((current) => ({
      x: current.x - event.deltaX,
      y: current.y - event.deltaY,
    }));
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button,input')) return;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: pan.x, y: pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
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
              color: '#ffffff',
              borderColor: isStudio ? 'var(--chrome-control-active)' : 'var(--chrome-control)',
              background: isStudio ? 'var(--chrome-control-active)' : 'var(--chrome-control)',
              fontWeight: isStudio ? 600 : 500,
            }}
            onClick={() => {
              if (isStudio) {
                setMode('basic');
                onPanelChange?.('bible');
              } else {
                /* Switching to Studio used to open the Scenes window as well.
                   Changing mode is a claim about how takes work, not a request
                   to rearrange the operator's panels — the layout is theirs. */
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
                active={outputMode === 'fullscreen'}
                onClick={() => setOutputMode('fullscreen')}
                title="Fullscreen Output Mode (FS)"
              >
                FS
              </BlockButton>
              <BlockButton
                active={outputMode === 'lowerThird'}
                onClick={() => setOutputMode('lowerThird')}
                title="Lower Third Output Mode (LT)"
              >
                LT
              </BlockButton>
            </BlockSegment>

            <div className="zoombar-pill">
              <button
                type="button"
                onClick={() => setZoomAround(zoom - ZOOM_STEP)}
                title="Zoom out"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="7" y1="11" x2="15" y2="11"/></svg>
              </button>
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
                onClick={() => setZoomAround(zoom + ZOOM_STEP)}
                title="Zoom in"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="7" y1="11" x2="15" y2="11"/><line x1="11" y1="7" x2="11" y2="15"/></svg>
              </button>
              <span className="zoombar-val">{zoomLabel}</span>
              <div className="zoombar-divider" />
              <button
                type="button"
                className="zoombar-fit"
                data-active={zoom === 1 || undefined}
                onClick={fitStage}
                title="Fit preview/program to view"
              >
                Fit
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
                Preview{hasPendingTake ? ' · ready to take' : ''}
              </div>
              <div style={{ ...styles.displayBox, borderColor: 'var(--tally-preview)', boxShadow: hasPendingTake ? '0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px var(--tally-preview)' : undefined }}>
                <div style={{ ...styles.outputFrame, transform: `scale(${outputScale})` }}>
                  <ProgramSurface
                    preview
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
              Program{!isStudio ? ' · live' : ''}
            </div>
            <div style={{ ...styles.displayBox, borderColor: 'var(--tally-program)' }}>
              {isTransitioning && (
                <div style={styles.transitionOverlay}>
                  <div style={styles.transitionSpinner} />
                </div>
              )}
              <div style={{ ...styles.outputFrame, transform: `scale(${outputScale})` }}>
                <ProgramSurface
                  preview
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
    /* will-change is applied only while panning or zooming — see isInteracting.
       Holding it permanently pins the raster scale and blurs the output as you
       zoom in; never using it repaints the whole subtree on every gesture
       frame. Toggling gives the compositor the gesture and a fresh raster once
       the view settles. */
  },
  previewCol: {
    flex: '0 0 auto',
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  programColSolo: {
    flex: '0 0 auto',
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
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
    borderRadius: 6,
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
  transitionOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.5)',
    zIndex: 10,
  },
  transitionSpinner: {
    width: 20,
    height: 20,
    border: '2px solid rgba(255,255,255,0.1)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
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
    ...type.label,
    fontWeight: fontWeight.bold,
  },
  zoomValue: {
    width: 38,
    textAlign: 'center',
    color: 'var(--text-secondary)',
    ...type.label,
    fontWeight: fontWeight.bold,
  },
  zoomSlider: {
    width: 92,
    /* Tinting the track with the accent made the loudest thing in the footer a
       zoom control. Left to the native dark rendering — grey track, white
       thumb — it recedes and orange goes back to meaning live. */
    accentColor: 'var(--chrome-control-active)',
  },
};
