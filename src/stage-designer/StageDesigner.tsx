/* =========================================================================
   <StageDesigner> — the Stage Layout Designer
   -------------------------------------------------------------------------
   A window of its own, because laying out a confidence monitor is a two-screen
   job: the canvas here, the actual stage screen over there, both live. A modal
   inside the operator's window would put the layout on top of the thing the
   layout is for.

   Three ideas hold the whole tool together.

   The canvas is the real <StageSurface>, not a sketch of it — so "does the
   verse fit" is answered by the renderer that will have to fit it.

   Edits go straight to the stage while Live is on, so the person walking back
   from the platform sees the change they asked for before they sit down.

   And the four presets are read-only. Opening one gives you a copy. An
   operator who has spent an hour bending Default out of shape needs Default to
   still be there.
   ========================================================================= */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LAYOUTS, LAYOUT_IDS, type StageLayout, type StageZone, type ZoneType } from '../stage/layouts';
import {
  cloneLayout,
  clamp,
  isPresetId,
  layoutsEqual,
  normalizeLayout,
  normalizeZone,
  uid,
  ZONE_HINTS,
  ZONE_LABELS,
  ZONE_TYPES,
} from '../stage/layout-model';
import { useLayoutLibrary } from '../stage/layout-library';
import { useLayoutHistory } from './useLayoutHistory';
import { DesignerCanvas } from './DesignerCanvas';
import { Inspector } from './Inspector';
import { LayerList } from './LayerList';
import { useStageFeeds } from './useStageFeeds';
import { isTypingTarget } from './keyboard';
import { Menu, MenuItem } from './Menu';
import { Back, Plus, Redo, Undo, ZONE_ICONS } from './icons';
import { sampleContent, sampleProgramState, SAMPLE_LABELS, type SampleKind } from './sample-content';
import type { StageMode } from '../stage/stage-state';
import './designer.css';

const GRID_STEPS = [0, 1, 2.5, 5, 10];
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;

const MODE_LABELS: Record<StageMode, string> = {
  confidence: 'Zones only',
  hybrid: 'Over output',
  program: 'Output only',
};

const MODE_HINTS: Record<StageMode, string> = {
  confidence: 'The layout on its own background.',
  hybrid: 'The zones floating over the program output.',
  program: 'The program output alone, no zones.',
};

const SAMPLE_HINTS: Record<SampleKind, string> = {
  scripture: 'A long verse, to see where the text stops fitting.',
  song: 'A lyric stanza with a section title.',
  slide: 'A projected slide, for the Slide zone.',
};

/** How long edits settle before they go out on the wire with Live on. Long
    enough that a drag is one message rather than sixty, short enough that
    letting go of the mouse looks instant. */
const LIVE_DEBOUNCE_MS = 120;

function blankLayout(): StageLayout {
  return normalizeLayout({
    id: uid('layout'),
    name: 'New layout',
    bgColor: '#000000',
    zones: [
      { id: uid(), type: 'current-text', x: 5, y: 12, w: 90, h: 62, fontSize: 52, fontWeight: 600, color: 'text', textAlign: 'center' },
    ],
  });
}

export function StageDesigner() {
  const library = useLayoutLibrary();
  const feeds = useStageFeeds();

  const history = useLayoutHistory(blankLayout());
  const { layout, setLayout } = history;

  /** The saved layout this draft came from, or null for something unsaved. */
  const [sourceId, setSourceId] = useState<string | null>(null);
  /** The draft as it was when last saved or loaded, for the dirty flag. */
  const [baseline, setBaseline] = useState<StageLayout | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [status, setStatus] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null);

  const [zoom, setZoom] = useState(1);
  const [grid, setGrid] = useState(2.5);
  const [showGrid, setShowGrid] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [live, setLive] = useState(true);
  const [mode, setMode] = useState<StageMode>('confidence');
  const [sampleKind, setSampleKind] = useState<SampleKind>('scripture');
  const [forceSample, setForceSample] = useState(false);

  const dirty = !!baseline && !layoutsEqual(baseline, layout);
  const isUnsaved = !sourceId;

  /* ---- what the canvas renders under the overlay -------------------------- */
  /* Nothing live means nothing to design against, so the sample steps in on
     its own. The operator can also force it on to check a layout against a
     long verse while a short one is up. */
  const stageIsIdle = !feeds.stage.current?.body && !feeds.stage.current?.title && !feeds.program.scene;
  const usingSample = forceSample || stageIsIdle;

  const { previewStage, previewProgram } = useMemo(() => {
    if (!usingSample) return { previewStage: feeds.stage, previewProgram: feeds.program };
    const sample = sampleContent(sampleKind);
    return {
      previewStage: {
        ...feeds.stage,
        current: sample.current,
        next: sample.next,
        songTitle: sample.songTitle,
        songSubtitle: sample.songSubtitle,
        messages: sample.messages,
        timer: sample.timer,
      },
      previewProgram: sampleProgramState(sample.slide),
    };
  }, [usingSample, sampleKind, feeds.stage, feeds.program]);

  const canvasStage = useMemo(() => ({ ...previewStage, mode }), [previewStage, mode]);

  /* Zone types the operator's own theme is currently suppressing. The canvas
     marks these rather than hiding the fact: a clock zone that draws nothing
     because the operator turned clocks off is not a broken layout, and the
     designer should say which of the two it is. */
  const hiddenTypes = useMemo(() => {
    const hidden = new Set<string>();
    const { theme, clockVisible, timerVisible } = feeds.stage;
    if (!(clockVisible && theme.showClock)) hidden.add('clock');
    if (!(timerVisible && theme.showTimer)) hidden.add('timer');
    return hidden;
  }, [feeds.stage]);

  /* ---- live push ---------------------------------------------------------- */
  /* What the stage was last given. The rule for Live is one sentence — push
     when what I am looking at differs from what the stage already has — and
     that ref is the second half of it.

     Without it, opening the designer *is* an edit: the draft would go out on
     mount and replace whatever was on the stage with the designer's opening
     guess. That is the exact failure the editor this replaces had, where the
     first Save silently wiped a live layout, and it is worth a ref to make
     structurally impossible rather than a rule someone has to remember. */
  const stageHasRef = useRef<StageLayout | null>(null);
  const liveTimer = useRef<number | undefined>(undefined);

  const pushLayout = useCallback((next: StageLayout) => {
    stageHasRef.current = next;
    window.BSP?.stage?.sendState?.({
      customLayout: { id: next.id, name: next.name, bgColor: next.bgColor, zones: next.zones },
    }).catch(() => { /* not the desktop app */ });
  }, []);

  useEffect(() => {
    if (!live || !stageHasRef.current) return;
    if (layoutsEqual(stageHasRef.current, layout)) return;
    window.clearTimeout(liveTimer.current);
    liveTimer.current = window.setTimeout(() => pushLayout(layout), LIVE_DEBOUNCE_MS);
    return () => window.clearTimeout(liveTimer.current);
  }, [live, layout, pushLayout]);

  /* Tell the main process whether closing this window would lose work, so the
     close button can ask rather than the operator finding out afterwards.

     Only real edits count. An untouched draft is also technically unsaved —
     the designer opens onto a copy of a preset when the library is empty — but
     prompting about work nobody did trains people to dismiss the prompt, and
     then it is not there when it matters. */
  useEffect(() => {
    window.BSP?.stageDesigner?.setDirty?.(dirty);
  }, [dirty]);

  /* ---- opening things ----------------------------------------------------- */
  /**
   * Load a layout into the editor.
   *
   * `adopt` is for the one call that runs on open. It means "the stage already
   * has this" — the designer bootstraps onto whatever is live, so nothing
   * needs sending and nothing must be sent. Every other caller leaves it
   * false, and Live then does what Live promises: opening a saved layout puts
   * it on the stage.
   */
  const openLayout = useCallback((
    next: StageLayout,
    source: string | null,
    message: string,
    adopt = false,
  ) => {
    const normalized = normalizeLayout(next);
    history.reset(normalized);
    setSourceId(source);
    setBaseline(normalized);
    setSelection([]);
    setStatus({ text: message, tone: 'ok' });
    if (adopt) stageHasRef.current = normalized;
  }, [history]);

  /* On open, pick up where the operator left off: the layout the stage is
     actually showing if it is a custom one, otherwise their last saved
     layout, otherwise a blank. Opening onto an unrelated default and then
     saving is how the reference editor used to wipe a live layout. */
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current || !library.loaded) return;
    bootstrapped.current = true;

    const liveLayout = feeds.stage.layout;
    if (liveLayout && !isPresetId(liveLayout.id) && liveLayout.zones.length > 0) {
      const match = library.layouts.find((item) => item.id === liveLayout.id);
      openLayout(
        normalizeLayout(liveLayout),
        match?.id || null,
        match ? `Editing “${match.name}”, live on the stage` : 'Editing the layout currently on the stage',
        true,
      );
      return;
    }
    const active = library.layouts.find((item) => item.id === library.activeId) || library.layouts[0];
    if (active) {
      openLayout(active, active.id, `Opened “${active.name}”`, true);
      return;
    }
    const preset = LAYOUTS[liveLayout?.id] || LAYOUTS.default;
    openLayout(
      cloneLayout(preset, { name: `${preset.name} copy` }),
      null,
      `Started from the ${preset.name} preset — presets themselves are read-only`,
      true,
    );
  }, [library.loaded, library.layouts, library.activeId, feeds.stage.layout, openLayout]);

  /* ---- zone edits --------------------------------------------------------- */
  const setZones = useCallback((zones: StageZone[], silent: boolean) => {
    setLayout((current) => ({ ...current, zones }), { silent });
  }, [setLayout]);

  const patchZone = useCallback((id: string, patch: Partial<StageZone>, coalesceKey?: string) => {
    setLayout(
      (current) => ({
        ...current,
        zones: current.zones.map((zone) => (zone.id === id ? normalizeZone({ ...zone, ...patch }) : zone)),
      }),
      { coalesceKey },
    );
  }, [setLayout]);

  const addZone = useCallback((type: ZoneType) => {
    /* Dropped a little down and right of the last one so a run of additions
       fans out instead of stacking into a single unclickable pile. */
    const offset = (layout.zones.length % 6) * 3;
    const zone = normalizeZone({
      id: uid(),
      type,
      x: 8 + offset,
      y: 10 + offset,
      w: type === 'slide' ? 60 : 40,
      h: type === 'clock' || type === 'timer' || type === 'playlist' ? 8 : 26,
      fontSize: type === 'clock' || type === 'timer' ? 28 : type === 'playlist' ? 18 : 40,
      color: type === 'clock' ? 'faint' : type === 'timer' || type === 'playlist' ? 'accent' : 'text',
      textAlign: 'center',
    });
    setLayout((current) => ({ ...current, zones: [...current.zones, zone] }));
    setSelection([zone.id]);
    setStatus({ text: `Added ${ZONE_LABELS[type]}`, tone: 'ok' });
  }, [layout.zones.length, setLayout]);

  const duplicateSelection = useCallback(() => {
    if (selection.length === 0) return;
    const copies = layout.zones
      .filter((zone) => selection.includes(zone.id))
      .map((zone) => normalizeZone({
        ...zone,
        id: uid(),
        x: clamp(zone.x + 3, 0, 100 - zone.w),
        y: clamp(zone.y + 3, 0, 100 - zone.h),
      }));
    setLayout((current) => ({ ...current, zones: [...current.zones, ...copies] }));
    setSelection(copies.map((zone) => zone.id));
  }, [layout.zones, selection, setLayout]);

  const deleteSelection = useCallback(() => {
    if (selection.length === 0) return;
    setLayout((current) => ({
      ...current,
      zones: current.zones.filter((zone) => !selection.includes(zone.id)),
    }));
    setSelection([]);
  }, [selection, setLayout]);

  /** Move a zone to a new index in the paint order. Both indices are into the
      zones array, so the layer list's display order is its own business. */
  const moveZone = useCallback((from: number, to: number) => {
    setLayout((current) => {
      if (from === to || from < 0 || from >= current.zones.length) return current;
      const target = clamp(to, 0, current.zones.length - 1);
      const zones = current.zones.slice();
      const [moved] = zones.splice(from, 1);
      zones.splice(target, 0, moved);
      return { ...current, zones };
    });
  }, [setLayout]);

  /** Cmd+] and Cmd+[ — one step, for when the pointer is already elsewhere. */
  const nudgeOrder = useCallback((id: string, direction: 1 | -1) => {
    const index = layout.zones.findIndex((zone) => zone.id === id);
    if (index === -1) return;
    moveZone(index, index + direction);
  }, [layout.zones, moveZone]);

  const toggleZoneFlag = useCallback((id: string, key: 'visible' | 'locked') => {
    setLayout((current) => ({
      ...current,
      zones: current.zones.map((zone) => {
        if (zone.id !== id) return zone;
        if (key === 'visible') return { ...zone, visible: zone.visible === false };
        return { ...zone, locked: !zone.locked };
      }),
    }));
  }, [setLayout]);

  /* ---- align and distribute ---------------------------------------------- */
  const align = useCallback((edge: 'left' | 'hcentre' | 'right' | 'top' | 'vmiddle' | 'bottom') => {
    const chosen = layout.zones.filter((zone) => selection.includes(zone.id));
    if (chosen.length === 0) return;

    /* One zone aligns to the stage; several align to each other. Anything else
       makes "align left" mean two different things depending on a count the
       operator is not thinking about. */
    const frame = chosen.length === 1
      ? { x: 0, y: 0, w: 100, h: 100 }
      : {
        x: Math.min(...chosen.map((z) => z.x)),
        y: Math.min(...chosen.map((z) => z.y)),
        w: Math.max(...chosen.map((z) => z.x + z.w)) - Math.min(...chosen.map((z) => z.x)),
        h: Math.max(...chosen.map((z) => z.y + z.h)) - Math.min(...chosen.map((z) => z.y)),
      };

    setLayout((current) => ({
      ...current,
      zones: current.zones.map((zone) => {
        if (!selection.includes(zone.id)) return zone;
        switch (edge) {
          case 'left': return { ...zone, x: frame.x };
          case 'right': return { ...zone, x: frame.x + frame.w - zone.w };
          case 'hcentre': return { ...zone, x: round2(frame.x + (frame.w - zone.w) / 2) };
          case 'top': return { ...zone, y: frame.y };
          case 'bottom': return { ...zone, y: frame.y + frame.h - zone.h };
          case 'vmiddle': return { ...zone, y: round2(frame.y + (frame.h - zone.h) / 2) };
          default: return zone;
        }
      }),
    }));
  }, [layout.zones, selection, setLayout]);

  const distribute = useCallback((axis: 'h' | 'v') => {
    const chosen = layout.zones
      .filter((zone) => selection.includes(zone.id))
      .sort((a, b) => (axis === 'h' ? a.x - b.x : a.y - b.y));
    if (chosen.length < 3) return;

    /* Even gaps between the edges, not even spacing of the centres: zones of
       different sizes spaced by centre look wrong, and it is the whitespace
       the eye is actually reading. */
    const first = chosen[0];
    const last = chosen[chosen.length - 1];
    const start = axis === 'h' ? first.x + first.w : first.y + first.h;
    const end = axis === 'h' ? last.x : last.y;
    const occupied = chosen.slice(1, -1).reduce((sum, zone) => sum + (axis === 'h' ? zone.w : zone.h), 0);
    const gap = (end - start - occupied) / (chosen.length - 1);

    const positions = new Map<string, number>();
    let cursor = start;
    for (const zone of chosen.slice(1, -1)) {
      cursor += gap;
      positions.set(zone.id, round2(cursor));
      cursor += axis === 'h' ? zone.w : zone.h;
    }

    setLayout((current) => ({
      ...current,
      zones: current.zones.map((zone) => {
        const at = positions.get(zone.id);
        if (at === undefined) return zone;
        return axis === 'h' ? { ...zone, x: at } : { ...zone, y: at };
      }),
    }));
  }, [layout.zones, selection, setLayout]);

  const fillStage = useCallback(() => {
    if (selection.length !== 1) return;
    patchZone(selection[0], { x: 0, y: 0, w: 100, h: 100 });
  }, [selection, patchZone]);

  const nudge = useCallback((dx: number, dy: number) => {
    if (selection.length === 0) return;
    setLayout((current) => ({
      ...current,
      zones: current.zones.map((zone) => (
        selection.includes(zone.id)
          ? {
            ...zone,
            x: round2(clamp(zone.x + dx, 0, 100 - zone.w)),
            y: round2(clamp(zone.y + dy, 0, 100 - zone.h)),
          }
          : zone
      )),
    }), { coalesceKey: `nudge:${selection.join(',')}` });
  }, [selection, setLayout]);

  /* ---- saving ------------------------------------------------------------- */
  const commit = useCallback(async (asNew: boolean) => {
    const target: StageLayout = asNew
      ? { ...layout, id: uid('layout'), name: nextCopyName(layout.name, library.layouts) }
      : { ...layout, id: sourceId || layout.id };

    const result = await library.save(target);
    if (!result.ok) {
      setStatus({ text: result.error || 'Could not save', tone: 'warn' });
      return;
    }
    await library.setActive(target.id);
    history.reset(target);
    setSourceId(target.id);
    setBaseline(target);
    pushLayout(target);
    setStatus({ text: `Saved “${target.name}”`, tone: 'ok' });
  }, [layout, sourceId, library, history, pushLayout]);

  const deleteFromLibrary = useCallback(async (id: string, name: string) => {
    await library.remove(id);
    if (id === sourceId) {
      setSourceId(null);
      setBaseline(null);
    }
    setStatus({ text: `Deleted “${name}”`, tone: 'ok' });
  }, [library, sourceId]);

  /* ---- keyboard ----------------------------------------------------------- */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Never steal a key from a field. Backspace in the name box must delete
      // a character, not the selected zones.
      if (isTypingTarget(event.target)) return;

      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) history.redo();
        else history.undo();
        return;
      }
      if (meta && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateSelection();
        return;
      }
      if (meta && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setSelection(layout.zones.filter((zone) => !zone.locked).map((zone) => zone.id));
        return;
      }
      if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void commit(false);
        return;
      }
      if (meta && (event.key === ']' || event.key === '[')) {
        event.preventDefault();
        if (selection.length === 1) nudgeOrder(selection[0], event.key === ']' ? 1 : -1);
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelection();
        return;
      }
      if (event.key === 'Escape') {
        setSelection([]);
        return;
      }

      const step = event.shiftKey ? Math.max(grid, 1) * 5 : (grid || 0.5);
      if (event.key === 'ArrowLeft') { event.preventDefault(); nudge(-step, 0); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); nudge(step, 0); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); nudge(0, -step); }
      else if (event.key === 'ArrowDown') { event.preventDefault(); nudge(0, step); }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [history, duplicateSelection, deleteSelection, layout.zones, selection, nudgeOrder, grid, nudge, commit]);

  /* Status messages are progress reports, not a log — one at a time, and gone
     before the operator has to wonder whether it still applies. */
  useEffect(() => {
    if (!status) return;
    const id = window.setTimeout(() => setStatus(null), 4000);
    return () => window.clearTimeout(id);
  }, [status]);

  const selectedZone = selection.length === 1
    ? layout.zones.find((zone) => zone.id === selection[0]) || null
    : null;

  /* Touching a zone dismisses whatever the status bar was saying. The bar is
     also the live geometry readout, and "Opened Sunday Confidence" sitting
     over it for four seconds is exactly four seconds of not being able to see
     the coordinates you are dragging. */
  const selectZones = useCallback((ids: string[]) => {
    setStatus(null);
    setSelection(ids);
  }, []);

  const beginInteraction = useCallback(() => {
    setStatus(null);
    history.begin();
  }, [history]);

  /* Movable / Draggable Stage Toolbar State */
  const [floatbarPos, setFloatbarPos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingFloatbar, setIsDraggingFloatbar] = useState(false);
  const floatbarDragStartRef = useRef<{ x: number; y: number; initialX: number; initialY: number }>({ x: 0, y: 0, initialX: 0, initialY: 0 });

  const handleFloatbarPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDraggingFloatbar(true);
    const currentX = floatbarPos ? floatbarPos.x : window.innerWidth / 2;
    const currentY = floatbarPos ? floatbarPos.y : 54;
    floatbarDragStartRef.current = { x: e.clientX, y: e.clientY, initialX: currentX, initialY: currentY };
  };

  useEffect(() => {
    if (!isDraggingFloatbar) return;
    const onPointerMove = (e: PointerEvent) => {
      const dx = e.clientX - floatbarDragStartRef.current.x;
      const dy = e.clientY - floatbarDragStartRef.current.y;
      setFloatbarPos({
        x: floatbarDragStartRef.current.initialX + dx,
        y: Math.max(10, floatbarDragStartRef.current.initialY + dy),
      });
    };
    const onPointerUp = () => setIsDraggingFloatbar(false);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [isDraggingFloatbar]);

  return (
    <div className="dz-app">
      <header className="dz-topbar">
        <div className="dz-topbar-left">
          {/* The way out, in the same place and with the same words as the
              slide editor's. The main process closes the window rather than
              hiding it, so Back and the red button ask the same question about
              unsaved work. */}
          <button
            type="button"
            className="dz-back"
            title="Close the designer and return to Bible Song Pro"
            onClick={() => { void window.BSP?.stageDesigner?.close?.(); }}
          >
            <Back />
            Back to app
          </button>
          <span className="dz-sep" />
          <span className="dz-brand">Stage Layout</span>
          <input
            className="dz-name"
            value={layout.name}
            spellCheck={false}
            onChange={(event) => {
              const nameVal = event.target.value;
              setLayout((current) => ({ ...current, name: nameVal }), { coalesceKey: 'name' });
            }}
            aria-label="Layout name"
          />
          <span className="dz-dirty" data-on={(dirty || isUnsaved) || undefined}>
            {isUnsaved ? 'Unsaved' : dirty ? 'Edited' : 'Saved'}
          </span>
        </div>

        <div className="dz-topbar-right">
          <button type="button" onClick={history.undo} disabled={!history.canUndo} title="Undo (Cmd+Z)" aria-label="Undo"><Undo /></button>
          <button type="button" onClick={history.redo} disabled={!history.canRedo} title="Redo (Shift+Cmd+Z)" aria-label="Redo"><Redo /></button>
          <span className="dz-sep" />
          <label className="dz-toggle" title="Push every edit to the stage as you make it">
            <input type="checkbox" checked={live} onChange={(event) => setLive(event.currentTarget.checked)} />
            <span>Live</span>
          </label>
          <button type="button" onClick={() => { pushLayout(layout); setStatus({ text: 'Sent to the stage', tone: 'ok' }); }}>
            Send to stage
          </button>
          <span className="dz-sep" />
          <button type="button" onClick={() => void commit(true)}>Save as new</button>
          <button
            type="button"
            className="dz-primary"
            onClick={() => void commit(false)}
            disabled={!!sourceId && !dirty}
            title="Cmd+S"
          >
            {sourceId ? 'Save' : 'Save layout'}
          </button>
        </div>
      </header>

      <div className="dz-body">
        <aside className="dz-rail dz-rail-left">
          <section className="dz-library">
            <h2 className="dz-panel-title">Presets</h2>
            <p className="dz-note dz-note-tight">Read-only. Opening one gives you a copy to edit.</p>
            <ul className="dz-library-list">
              {LAYOUT_IDS.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    className="dz-library-item"
                    onClick={() => openLayout(
                      cloneLayout(LAYOUTS[id], { name: nextCopyName(`${LAYOUTS[id].name} copy`, library.layouts) }),
                      null,
                      `Copied the ${LAYOUTS[id].name} preset`,
                    )}
                  >
                    <span>{LAYOUTS[id].name}</span>
                    <span className="dz-library-meta">{plural(LAYOUTS[id].zones.length, 'zone')}</span>
                  </button>
                </li>
              ))}
            </ul>

            <h2 className="dz-panel-title">
              My layouts
              <span className="dz-panel-count">{library.layouts.length}</span>
            </h2>
            {library.loaded && library.layouts.length === 0 && (
              <p className="dz-note">Nothing saved yet. Save this one to start a library.</p>
            )}
            <ul className="dz-library-list">
              {library.layouts.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="dz-library-item"
                    data-active={item.id === sourceId || undefined}
                    onClick={() => openLayout(item, item.id, `Opened “${item.name}”`)}
                  >
                    <span>{item.name}</span>
                    <span className="dz-library-meta">{plural(item.zones.length, 'zone')}</span>
                  </button>
                  <button
                    type="button"
                    className="dz-library-delete"
                    title={`Delete “${item.name}”`}
                    onClick={() => void deleteFromLibrary(item.id, item.name)}
                  >✕</button>
                </li>
              ))}
            </ul>

            <div className="dz-btn-row">
              <button type="button" onClick={() => openLayout(blankLayout(), null, 'Started a new layout')}>
                New layout
              </button>
            </div>
          </section>

          <LayerList
            zones={layout.zones}
            selection={selection}
            hiddenTypes={hiddenTypes}
            onSelect={(id, additive) => selectZones(
              !additive
                ? [id]
                : selection.includes(id) ? selection.filter((item) => item !== id) : [...selection, id],
            )}
            onToggle={toggleZoneFlag}
            onReorder={moveZone}
          />
        </aside>

        <main className="dz-main">
          {/* Floating over the canvas rather than stacked above it. Two rows of
              fifteen bare buttons showed the operator everything and told them
              nothing; four menus put the same choices one click away and give
              the canvas back the space. */}
          <div
            className="dz-floatbar"
            style={
              floatbarPos
                ? { left: floatbarPos.x, top: floatbarPos.y, transform: 'translateX(-50%)' }
                : { top: 54 }
            }
          >
            <div className="dz-floatbar-card">
              {/* Integrated Top Drag Handle & Label */}
              <div
                onPointerDown={handleFloatbarPointerDown}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: isDraggingFloatbar ? 'grabbing' : 'grab',
                  paddingBottom: 4,
                  width: '100%',
                  userSelect: 'none',
                }}
                title="Drag to move toolbar"
              >
                <div style={{ width: 24, height: 2.5, background: 'rgba(255, 255, 255, 0.25)', borderRadius: 2, marginBottom: 2 }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255, 255, 255, 0.55)', letterSpacing: '0.01em' }}>Add to layout</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Menu
                label="Add layer"
                icon={<Plus />}
                title="Place a new zone on the stage"
                width={268}
              >
                {(close) => ZONE_TYPES.map((type) => {
                  const Icon = ZONE_ICONS[type];
                  return (
                    <MenuItem
                      key={type}
                      icon={Icon ? <Icon /> : null}
                      label={ZONE_LABELS[type]}
                      hint={ZONE_HINTS[type]}
                      onClick={() => { addZone(type); close(); }}
                    />
                  );
                })}
              </Menu>

              <span className="dz-floatbar-sep" />

              <Menu label="View" value={MODE_LABELS[mode]} title="What the canvas draws">
                {(close) => (['confidence', 'hybrid', 'program'] as StageMode[]).map((item) => (
                  <MenuItem
                    key={item}
                    label={MODE_LABELS[item]}
                    hint={MODE_HINTS[item]}
                    selected={mode === item}
                    onClick={() => { setMode(item); close(); }}
                  />
                ))}
              </Menu>

              <Menu
                label="Content"
                value={usingSample ? SAMPLE_LABELS[sampleKind] : 'Live'}
                title="What the zones are filled with while you design"
              >
                {(close) => (
                  <>
                    <MenuItem
                      label="Live"
                      hint={stageIsIdle ? 'Nothing is on the stage right now' : 'Draw what is actually on the stage'}
                      selected={!usingSample}
                      onClick={() => { if (!stageIsIdle) { setForceSample(false); close(); } }}
                    />
                    <div className="dz-menu-sep" />
                    {(Object.keys(SAMPLE_LABELS) as SampleKind[]).map((kind) => (
                      <MenuItem
                        key={kind}
                        label={SAMPLE_LABELS[kind]}
                        hint={SAMPLE_HINTS[kind]}
                        selected={usingSample && sampleKind === kind}
                        onClick={() => { setSampleKind(kind); setForceSample(true); close(); }}
                      />
                    ))}
                  </>
                )}
              </Menu>

              {/* The trigger reports snapping only when it is *off*. Lighting
                  up the default state teaches the eye to ignore the light. */}
              <Menu
                label="Grid"
                value={`${grid === 0 ? 'Off' : `${grid}%`}${snapEnabled ? '' : ' · no snap'}`}
                title="Grid size, and whether things snap to it"
                active={!snapEnabled}
              >
                {() => (
                  <>
                    <div className="dz-menu-head">Grid size</div>
                    <div className="dz-menu-chips">
                      {GRID_STEPS.map((step) => (
                        <button
                          key={step}
                          type="button"
                          data-active={grid === step || undefined}
                          onClick={() => setGrid(step)}
                        >
                          {step === 0 ? 'Off' : `${step}%`}
                        </button>
                      ))}
                    </div>
                    <div className="dz-menu-sep" />
                    <label className="dz-menu-check">
                      <input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.currentTarget.checked)} />
                      <span>Show the grid</span>
                    </label>
                    <label className="dz-menu-check" title="Hold Alt while dragging to bypass">
                      <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.currentTarget.checked)} />
                      <span>Snap to grid and edges</span>
                    </label>
                  </>
                )}
              </Menu>

              <span className="dz-floatbar-sep" />

              <label className="dz-floatbar-swatch" title="The colour behind the zones">
                <input
                  type="color"
                  className="dz-color"
                  value={/^#[0-9a-f]{6}$/i.test(layout.bgColor) ? layout.bgColor : '#000000'}
                  onChange={(event) => {
                    const nextColor = event.target.value;
                    setLayout(
                      (current) => ({ ...current, bgColor: nextColor }),
                      { coalesceKey: 'bgColor' },
                    );
                  }}
                />
                <span>Stage</span>
              </label>
              </div>
            </div>
          </div>

          <DesignerCanvas
            layout={layout}
            stageState={canvasStage}
            programState={previewProgram}
            assetBaseUrl={feeds.assetBaseUrl}
            selection={selection}
            onSelectionChange={selectZones}
            onChange={setZones}
            onBegin={beginInteraction}
            onEnd={history.end}
            grid={grid}
            showGrid={showGrid}
            snapEnabled={snapEnabled}
            zoom={zoom}
            onZoomChange={setZoom}
            hiddenTypes={hiddenTypes}
          />

          {/* Bottom-centre sleek zoom pill bar matching Image 1 */}
          <div className="dz-zoombar">
            <div className="zoombar-pill">
              <button
                type="button"
                onClick={() => setZoom((z) => clamp(z - 0.1, ZOOM_MIN, ZOOM_MAX))}
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
                onChange={(event) => setZoom(Number(event.currentTarget.value))}
                title="Canvas zoom"
              />
              <button
                type="button"
                onClick={() => setZoom((z) => clamp(z + 0.1, ZOOM_MIN, ZOOM_MAX))}
                title="Zoom in"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="7" y1="11" x2="15" y2="11"/><line x1="11" y1="7" x2="11" y2="15"/></svg>
              </button>
              <span className="zoombar-val">{Math.round(zoom * 100)}%</span>
              <div className="zoombar-divider" />
              <button
                type="button"
                className="zoombar-fit"
                data-active={zoom === 1 || undefined}
                onClick={() => setZoom(1)}
                title="Fit the stage to the window"
              >
                Fit
              </button>
            </div>
          </div>

          <footer className="dz-statusbar">
            <span className={status?.tone === 'warn' ? 'dz-status dz-warn' : 'dz-status'}>
              {status?.text || (selectedZone
                ? `${selectedZone.label || ZONE_LABELS[selectedZone.type as ZoneType]} · ${fmt(selectedZone.x)}, ${fmt(selectedZone.y)} · ${fmt(selectedZone.w)} × ${fmt(selectedZone.h)}`
                : plural(layout.zones.length, 'zone'))}
            </span>
            <span className="dz-hints">
              Drag to move · Alt bypasses snap · Shift constrains · arrows nudge · Cmd+D duplicate · Cmd+Z undo
            </span>
          </footer>
        </main>

        <aside className="dz-rail dz-rail-right">
          <Inspector
            zone={selectedZone}
            selectionCount={selection.length}
            onChange={(patch, coalesceKey) => {
              if (selection.length === 1) patchZone(selection[0], patch, coalesceKey);
            }}
            onDuplicate={duplicateSelection}
            onDelete={deleteSelection}
            onAlign={align}
            onDistribute={distribute}
            onFill={fillStage}
          />
        </aside>
      </div>
    </div>
  );
}

function fmt(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** "Default copy", then "Default copy 2" — never a library with three items
    that all read the same. */
function nextCopyName(base: string, existing: StageLayout[]): string {
  const taken = new Set(existing.map((item) => item.name));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 999; n += 1) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return base;
}

export default StageDesigner;
