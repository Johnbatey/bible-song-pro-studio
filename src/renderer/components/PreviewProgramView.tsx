import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { ProgramSurface } from './display/ProgramSurface';
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

export function PreviewProgramView() {
  const currentScene = useAppStore((s) => s.display.currentScene);
  const previewScene = useAppStore((s) => s.display.previewScene);
  const isTransitioning = useAppStore((s) => s.display.isTransitioning);
  const mode = useAppStore((s) => s.display.mode);
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
  const [stageSize, setStageSize] = useState({ width: 960, height: 560, itemWidth: 474 });

  const isStudio = mode === 'studio';
  // Something is staged that the audience isn't seeing yet
  const hasPendingTake = isStudio && Boolean(previewScene) && currentScene?.id !== previewScene?.id;
  const zoomLabel = `${Math.round(zoom * 100)}%`;
  const outputScale = stageSize.itemWidth / 1920;

  const updateZoom = useCallback((next: number) => {
    const nextZoom = clampZoom(next);
    zoomRef.current = nextZoom;
    setZoom((current) => Math.abs(current - nextZoom) < 0.001 ? current : nextZoom);
  }, []);

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

      setPan((current) => ({
        x: current.x - event.deltaX,
        y: current.y - event.deltaY,
      }));
    };

    viewport.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onNativeWheel);
  }, [setZoomAround]);

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
    <div className="pv-dock" style={styles.container}>
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
          }}
        >
          {isStudio && (
            <div style={{ ...styles.previewCol, width: stageSize.itemWidth }}>
              <div style={styles.label}>
                <span style={{ ...styles.dot, background: hasPendingTake ? '#f1c40f' : '#2ecc71' }} />
                Preview{hasPendingTake ? ' · ready to take' : ''}
              </div>
              <div style={{ ...styles.displayBox, borderColor: hasPendingTake ? '#f1c40f' : undefined }}>
                <div style={{ ...styles.outputFrame, transform: `scale(${outputScale})` }}>
                  <ProgramSurface
                    preview
                    state={{ scene: previewScene, outputMode, theme: activeTheme }}
                  />
                </div>
              </div>
            </div>
          )}
          <div style={{ ...(isStudio ? styles.previewCol : styles.programColSolo), width: stageSize.itemWidth }}>
            <div style={styles.label}>
              <span style={{ ...styles.dot, background: '#e74c3c' }} />
              Program{!isStudio ? ' · live' : ''}
            </div>
            <div style={{ ...styles.displayBox, borderColor: 'var(--border-accent)' }}>
              {isTransitioning && (
                <div style={styles.transitionOverlay}>
                  <div style={styles.transitionSpinner} />
                </div>
              )}
              <div style={{ ...styles.outputFrame, transform: `scale(${outputScale})` }}>
                <ProgramSurface
                  preview
                  state={{ scene: currentScene, outputMode, theme: activeTheme, activeAlert, transcription }}
                />
              </div>
            </div>
          </div>
        </div>
        <div style={styles.zoomControls}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>OUTPUT:</span>
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 5, padding: 2, gap: 2, border: '1px solid var(--border-primary)' }}>
                <button
                  style={{
                    height: 22,
                    padding: '0 10px',
                    border: 'none',
                    borderRadius: 4,
                    background: outputMode === 'fullscreen' ? 'var(--accent)' : 'transparent',
                    color: outputMode === 'fullscreen' ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: outputMode === 'fullscreen' ? 700 : 500,
                    fontSize: 11,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => setOutputMode('fullscreen')}
                  title="Fullscreen Output Mode (FS)"
                >
                  FS
                </button>
                <button
                  style={{
                    height: 22,
                    padding: '0 10px',
                    border: 'none',
                    borderRadius: 4,
                    background: outputMode === 'lowerThird' ? 'var(--accent)' : 'transparent',
                    color: outputMode === 'lowerThird' ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: outputMode === 'lowerThird' ? 700 : 500,
                    fontSize: 11,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => setOutputMode('lowerThird')}
                  title="Lower Third Output Mode (LT)"
                >
                  LT
                </button>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button style={styles.zoomBtn} onClick={() => setZoomAround(zoom - ZOOM_STEP)} title="Zoom out">-</button>
            <span style={styles.zoomValue}>{zoomLabel}</span>
            <input
              style={styles.zoomSlider}
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoomAround(Number(event.currentTarget.value))}
              title="Preview/program scale"
            />
            <button style={styles.zoomBtn} onClick={() => setZoomAround(zoom + ZOOM_STEP)} title="Zoom in">+</button>
            <button style={styles.zoomBtnWide} onClick={fitStage} title="Fit preview/program to view">FIT</button>
            <button style={styles.zoomBtnWide} onClick={() => { updateZoom(1); setPan({ x: 0, y: 0 }); }} title="Reset scale and pan">1:1</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    padding: 0,
    background: '#161414',
    border: '1px solid #262628',
    borderRadius: 6,
    overflow: 'hidden',
  },
  viewport: {
    position: 'relative',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    background: '#0c0c0e',
    borderRadius: 0,
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
    willChange: 'transform',
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
  zoomControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '6px 12px',
    borderRadius: 0,
    borderTop: '1px solid var(--border-primary)',
    background: 'rgba(12, 14, 20, 0.94)',
    backdropFilter: 'blur(14px)',
    boxShadow: '0 -2px 10px rgba(0,0,0,0.2)',
    cursor: 'default',
  },
  zoomBtn: {
    width: 24,
    height: 24,
    border: '1px solid var(--border-primary)',
    borderRadius: 5,
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontWeight: fontWeight.semibold,
  },
  zoomBtnWide: {
    height: 24,
    padding: '0 8px',
    border: '1px solid var(--border-primary)',
    borderRadius: 5,
    background: 'rgba(255,255,255,0.06)',
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
    accentColor: 'var(--accent)',
  },
};
