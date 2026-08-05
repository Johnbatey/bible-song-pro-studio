import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Block } from './Block';
import { fontWeight } from '../styles/type';
import { useAppStore } from '../stores/appStore';
import { CustomDropdown } from './CustomDropdown';
import { StageSettingsPopover } from './StageSettingsPopover';
import { useProgramSurfaceState } from '../hooks/useProgramSurfaceState';
import { publishStage, useStageState } from '../services/stage-bus';
import { StageSurface } from '../../stage/StageSurface';
import type { StageTheme } from '../../stage/theme';

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.05;
const STAGE_ASPECT = 16 / 9;
const SAFE_PAD = 48;

const LAYOUT_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'band',    label: 'Band / Lyrics' },
  { value: 'sermon',  label: 'Sermon Notes' },
  { value: 'minimal', label: 'Minimal' },
] as const;

type LayoutId = (typeof LAYOUT_OPTIONS)[number]['value'];

function clampZoom(v: number) {
  if (!Number.isFinite(v)) return 1;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v));
}

export function StagePanel() {
  const isExternalDisplayActive = useAppStore((s) => s.display.isExternalDisplayActive);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; ox: number; oy: number } | null>(null);
  const zoomRef = useRef(1);
  const settleTimer = useRef<number | undefined>(undefined);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [boxSize, setBoxSize] = useState({ w: 800, h: 450 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsBtnRef = useRef<HTMLButtonElement | null>(null);

  /* The stage's state and the live program state, both read from where they
     already live. The preview is the same <StageSurface> the stage window
     renders, driven by the same state — not a picture of it. */
  const stage = useStageState();
  const program = useProgramSurfaceState();
  const activeLayout = stage.layout.id as LayoutId;

  /* ── box size — measured from the viewport ── */
  const measureBox = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const r = vp.getBoundingClientRect();
    const availW = Math.max(240, r.width - SAFE_PAD);
    const availH = Math.max(160, r.height - SAFE_PAD);
    const h = Math.min(availH, availW / STAGE_ASPECT);
    const w = Math.round(h * STAGE_ASPECT);
    setBoxSize((c) => Math.abs(c.w - w) < 1 && Math.abs(c.h - h) < 1 ? c : { w, h: Math.round(h) });
  }, []);

  useLayoutEffect(() => {
    let frame = 0;
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measureBox);
    };
    schedule();
    const vp = viewportRef.current;
    const ro = vp && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    if (vp && ro) ro.observe(vp);
    return () => { window.cancelAnimationFrame(frame); ro?.disconnect(); };
  }, [measureBox]);

  useLayoutEffect(() => () => window.clearTimeout(settleTimer.current), []);

  const markInteracting = useCallback(() => {
    setIsInteracting(true);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => setIsInteracting(false), 220);
  }, []);

  const updateZoom = useCallback((next: number) => {
    const z = clampZoom(next);
    zoomRef.current = z;
    markInteracting();
    setZoom((c) => (Math.abs(c - z) < 0.001 ? c : z));
  }, [markInteracting]);

  const setZoomAround = useCallback((next: number, cx?: number, cy?: number) => {
    const vp = viewportRef.current;
    const z = clampZoom(next);
    if (!vp || cx === undefined || cy === undefined) { updateZoom(z); return; }
    const r = vp.getBoundingClientRect();
    const fx = cx - r.left - r.width / 2 - pan.x;
    const fy = cy - r.top - r.height / 2 - pan.y;
    const ratio = z / (zoomRef.current || zoom);
    setPan({ x: pan.x + fx * (1 - ratio), y: pan.y + fy * (1 - ratio) });
    updateZoom(z);
  }, [pan, updateZoom, zoom]);

  const fitStage = useCallback(() => {
    measureBox();
    updateZoom(1);
    setPan((c) => c.x === 0 && c.y === 0 ? c : { x: 0, y: 0 });
  }, [measureBox, updateZoom]);

  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement | null)?.closest('button,input,select')) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || e.altKey) {
        setZoomAround(zoomRef.current + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP), e.clientX, e.clientY);
        return;
      }
      markInteracting();
      setPan((c) => ({ x: c.x - e.deltaX, y: c.y - e.deltaY }));
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, [setZoomAround, markInteracting]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button,input,select')) return;
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, ox: pan.x, oy: pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsPanning(true);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    markInteracting();
    setPan({ x: d.ox + e.clientX - d.startX, y: d.oy + e.clientY - d.startY });
  }
  function finishPan(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) { dragRef.current = null; setIsPanning(false); }
  }

  /* Operator controls publish a message rather than setting local state: the
     stage windows have to receive the same one, and the preview below is
     rendered from the result of applying it. */
  const applyLayout = useCallback((id: LayoutId) => publishStage({ layout: id }), []);
  const applyTheme = useCallback((patch: Partial<StageTheme>) => publishStage({ theme: patch }), []);

  /* The surface is authored against a 1920x1080 stage and scaled into the box,
     so the preview is geometrically the stage rather than a reflow of it. */
  const outputScale = boxSize.w / 1920;
  const zoomLabel = `${Math.round(zoom * 100)}%`;

  return (
    <Block
      className="stage-panel-dock"
      title="Stage Display"
      subtitle="Operator monitor"
      flush
      bodyStyle={{ display: 'flex', overflow: 'hidden' }}
      footer={(
        <div style={styles.footerGrid}>
          {/* Left: live STAGE status pill */}
          <div style={styles.footerLeft}>
            <div
              style={{
                ...styles.stagePill,
                background: isExternalDisplayActive ? 'rgba(34,197,94,0.15)' : 'var(--chrome-control)',
                borderColor: isExternalDisplayActive ? 'rgba(34,197,94,0.4)' : 'var(--block-line)',
              }}
            >
              <span style={{
                ...styles.pillDot,
                background: isExternalDisplayActive ? '#22c55e' : 'var(--text-dim)',
                boxShadow: isExternalDisplayActive ? '0 0 6px rgba(34,197,94,0.8)' : 'none',
              }} />
              STAGE
            </div>
          </div>

          {/* Centre: view scale controls */}
          <div style={styles.footerCentre}>
            <span style={styles.footerLabel}>SCALE</span>
            <button style={styles.iconBtn} onClick={() => setZoomAround(zoom - ZOOM_STEP)} title="Zoom out">−</button>
            <span style={styles.zoomValue}>{zoomLabel}</span>
            <input
              style={styles.zoomSlider}
              type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={0.01} value={zoom}
              onChange={(e) => setZoomAround(Number(e.currentTarget.value))}
              title="Stage preview scale"
            />
            <button style={styles.iconBtn} onClick={() => setZoomAround(zoom + ZOOM_STEP)} title="Zoom in">+</button>
            <button style={styles.wideBtn} onClick={fitStage} title="Fit to view">FIT</button>
          </div>

          {/* Right: layout dropdown + appearance settings */}
          <div style={styles.footerRight}>
            {settingsOpen && (
              <StageSettingsPopover
                theme={stage.theme}
                onChange={applyTheme}
                onClose={() => setSettingsOpen(false)}
                anchorRef={settingsBtnRef}
              />
            )}
            <span style={styles.footerLabel}>LAYOUT</span>
            <CustomDropdown
              value={activeLayout}
              options={LAYOUT_OPTIONS as unknown as { value: string; label: string }[]}
              onChange={(v) => applyLayout(v as LayoutId)}
              title="Switch stage layout"
              buttonStyle={{ height: 26, padding: '0 10px', fontSize: 12, fontWeight: fontWeight.semibold }}
            />

            <div style={styles.divider} />

            <button
              ref={settingsBtnRef}
              style={styles.settingsBtn}
              onClick={() => setSettingsOpen((open) => !open)}
              title="Stage display appearance"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Settings
            </button>
          </div>
        </div>
      )}
    >
      <div
        ref={viewportRef}
        style={{ ...styles.viewport, cursor: isPanning ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPan}
        onPointerCancel={finishPan}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: boxSize.w,
            height: boxSize.h,
            transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
            transformOrigin: 'center center',
            willChange: isPanning || isInteracting ? 'transform' : 'auto',
          }}
        >
          <div style={styles.displayBox}>
            {/* The stage itself, in-process. This was an <iframe> onto the
                legacy display page on http://localhost:8942 — a second
                renderer that could disagree with the stage screen and the
                projector both. Now it is the same component the stage window
                mounts, reading the same state, so the preview cannot drift
                from what it is a preview of. */}
            <div style={{ ...styles.outputFrame, transform: `scale(${outputScale})` }}>
              <StageSurface state={stage} program={program} chrome={false} />
            </div>
          </div>
        </div>
      </div>
    </Block>
  );
}

const styles: Record<string, React.CSSProperties> = {
  footerGrid: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    alignItems: 'center',
    gap: 10,
    minWidth: '100%',
  },
  footerLeft: { display: 'flex', alignItems: 'center', gap: 6 },
  footerCentre: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  footerRight: { display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' },
  stagePill: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '3px 10px', borderRadius: 6, border: '1px solid',
    fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#ffffff',
    userSelect: 'none', transition: 'background 0.2s ease, border-color 0.2s ease',
  },
  pillDot: {
    width: 6, height: 6, borderRadius: '50%',
    transition: 'background 0.2s ease, box-shadow 0.2s ease',
  },
  footerLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
    color: 'var(--text-dim)', userSelect: 'none',
  },
  iconBtn: {
    width: 24, height: 24, border: '1px solid var(--block-line)',
    borderRadius: 5, background: 'var(--block-active)', color: 'var(--text-primary)',
    cursor: 'pointer', fontWeight: fontWeight.semibold, fontSize: 14,
    lineHeight: '1', fontFamily: 'var(--font-ui)',
  },
  wideBtn: {
    height: 24, padding: '0 8px', border: '1px solid var(--block-line)',
    borderRadius: 5, background: 'var(--block-active)', color: 'var(--text-primary)',
    cursor: 'pointer', fontSize: 10, fontWeight: fontWeight.bold,
    letterSpacing: '0.06em', fontFamily: 'var(--font-ui)',
  },
  settingsBtn: {
    display: 'flex', alignItems: 'center', gap: 5,
    height: 26, padding: '0 10px', border: '1px solid var(--block-line)',
    borderRadius: 5, background: 'var(--block-active)', color: 'var(--text-primary)',
    cursor: 'pointer', fontSize: 12, fontWeight: fontWeight.semibold,
    fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap',
  },
  zoomValue: {
    width: 38, textAlign: 'center', color: 'var(--text-secondary)',
    fontSize: 11, fontWeight: fontWeight.bold,
  },
  zoomSlider: { width: 88, accentColor: 'var(--chrome-control-active)' },
  divider: { width: 1, height: 18, background: 'var(--block-line)', margin: '0 2px' },
  viewport: {
    position: 'relative', flex: 1, minWidth: 0, minHeight: 0,
    overflow: 'hidden', background: 'var(--bg-primary)', touchAction: 'none',
  },
  outputFrame: {
    position: 'absolute', left: 0, top: 0, width: 1920, height: 1080,
    transformOrigin: 'top left',
    /* The surface owns pointer events for nothing; letting them through here
       would swallow the viewport's drag-to-pan. */
    pointerEvents: 'none',
  },
  displayBox: {
    position: 'relative', width: '100%', height: '100%',
    borderRadius: 6, overflow: 'hidden', background: '#000',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
  },
};
