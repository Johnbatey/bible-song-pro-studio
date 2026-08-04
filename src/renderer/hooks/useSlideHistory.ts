/* =========================================================================
   useSlideHistory — undo/redo for the slide being edited
   -------------------------------------------------------------------------
   Wraps the engine's per-slide XML history and exposes it as React state, so
   the editor's Undo/Redo buttons can be enabled from real stack depths rather
   than a guess.
   ========================================================================= */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSlideHistory, type HistoryCounts } from '../slide-engine/edit/history';

export interface UseSlideHistory {
  canUndo: boolean;
  canRedo: boolean;
  /** Note an edit. Debounced by the engine, so per-keystroke is fine. */
  record: () => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  /** Capture the active slide's starting state so its first edit is undoable. */
  ensureBaseline: () => void;
}

/**
 * @param activeIndex  the slide being edited; history is per slide
 * @param onRestored   called after an undo/redo rebuilt the slide, so the
 *                     canvas can repaint from the fresh records
 * @param enabled      false for decks with no package open
 */
export function useSlideHistory(activeIndex: number, onRestored: () => void, enabled: boolean): UseSlideHistory {
  const [counts, setCounts] = useState<HistoryCounts>({ undo: 0, redo: 0 });

  /* Kept in a ref so the history's onChanged callback never goes stale — it is
     created once and would otherwise close over the first render's callback. */
  const restoredRef = useRef(onRestored);
  restoredRef.current = onRestored;
  const indexRef = useRef(activeIndex);
  indexRef.current = activeIndex;

  const history = useMemo(() => createSlideHistory(() => {
    // Reading counts here would capture a stale index; read on the next tick.
    queueMicrotask(() => restoredRef.current());
  }), []);

  // Stack depths belong to the active slide, so they change with it too.
  useEffect(() => {
    setCounts(history.counts(activeIndex));
  }, [history, activeIndex, enabled]);

  const refresh = useCallback(() => {
    setCounts(history.counts(indexRef.current));
  }, [history]);

  const record = useCallback(() => {
    history.record(indexRef.current);
    // The commit is debounced; re-read once it can have landed.
    window.setTimeout(refresh, 300);
  }, [history, refresh]);

  const ensureBaseline = useCallback(() => {
    history.ensureBaseline(indexRef.current);
    refresh();
  }, [history, refresh]);

  const undo = useCallback(() => {
    history.undo(indexRef.current).then(() => refresh());
  }, [history, refresh]);

  const redo = useCallback(() => {
    history.redo(indexRef.current).then(() => refresh());
  }, [history, refresh]);

  const reset = useCallback(() => {
    history.reset();
    refresh();
  }, [history, refresh]);

  return {
    canUndo: enabled && counts.undo > 0,
    canRedo: enabled && counts.redo > 0,
    record,
    undo,
    redo,
    reset,
    ensureBaseline,
  };
}
