/* =========================================================================
   Designer — undo and redo
   -------------------------------------------------------------------------
   A design tool without undo is a design tool people are afraid to use, and
   fear shows up as layouts nobody dared improve. So: past, present, future.

   Two things make this more than a stack. A drag produces sixty states a
   second and only one of them is worth remembering, so an interaction opens
   with `begin()` and every frame after it is silent. And holding the up arrow
   on a font-size field should be one undo, not forty, so discrete edits pass a
   coalesce key and fold into the previous entry while they keep arriving.
   ========================================================================= */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { StageLayout } from '../stage/layouts';
import { layoutsEqual } from '../stage/layout-model';

/** Deep enough for a whole design session, shallow enough not to hold a
    hundred copies of a layout with an embedded font stack in every zone. */
const MAX_DEPTH = 120;

/** How long a coalescing edit stays open. Long enough to cover key repeat,
    short enough that a pause reads as "that was a separate change". */
const COALESCE_MS = 700;

interface HistoryState {
  past: StageLayout[];
  present: StageLayout;
  future: StageLayout[];
}

export interface SetOptions {
  /** Part of an open interaction — change the present, remember nothing. */
  silent?: boolean;
  /** Fold into the previous entry when the same key arrives in quick
      succession. Use the field being edited, e.g. `fontSize:zone-3`. */
  coalesceKey?: string;
}

export interface LayoutHistory {
  layout: StageLayout;
  setLayout: (next: StageLayout | ((current: StageLayout) => StageLayout), options?: SetOptions) => void;
  /** Open an interaction: remember where we are, then go silent. */
  begin: () => void;
  /** Close it, discarding the entry if nothing actually moved. */
  end: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Load a different layout and forget everything — opening a preset is not
      an edit you can undo your way back out of. */
  reset: (layout: StageLayout) => void;
}

export function useLayoutHistory(initial: StageLayout): LayoutHistory {
  const [state, setState] = useState<HistoryState>({ past: [], present: initial, future: [] });
  const coalesce = useRef<{ key: string; at: number } | null>(null);

  const setLayout = useCallback(
    (next: StageLayout | ((current: StageLayout) => StageLayout), options: SetOptions = {}) => {
      setState((current) => {
        const value = typeof next === 'function' ? next(current.present) : next;
        if (value === current.present) return current;

        if (options.silent) return { ...current, present: value };

        const now = Date.now();
        const open = coalesce.current;
        const folds = !!options.coalesceKey
          && !!open
          && open.key === options.coalesceKey
          && now - open.at < COALESCE_MS;
        coalesce.current = options.coalesceKey ? { key: options.coalesceKey, at: now } : null;

        // Folding replaces the present without deepening the stack, so undo
        // still lands on whatever the value was before the run of edits began.
        if (folds) return { ...current, present: value, future: [] };

        return {
          past: [...current.past, current.present].slice(-MAX_DEPTH),
          present: value,
          future: [],
        };
      });
    },
    [],
  );

  const begin = useCallback(() => {
    coalesce.current = null;
    setState((current) => ({
      past: [...current.past, current.present].slice(-MAX_DEPTH),
      present: current.present,
      future: [],
    }));
  }, []);

  const end = useCallback(() => {
    setState((current) => {
      const previous = current.past[current.past.length - 1];
      // A click that selects without moving still opened an interaction. Undo
      // must not be a no-op the operator has to press twice.
      if (previous && layoutsEqual(previous, current.present)) {
        return { ...current, past: current.past.slice(0, -1) };
      }
      return current;
    });
  }, []);

  const undo = useCallback(() => {
    coalesce.current = null;
    setState((current) => {
      if (current.past.length === 0) return current;
      const previous = current.past[current.past.length - 1];
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future].slice(0, MAX_DEPTH),
      };
    });
  }, []);

  const redo = useCallback(() => {
    coalesce.current = null;
    setState((current) => {
      if (current.future.length === 0) return current;
      const [next, ...rest] = current.future;
      return {
        past: [...current.past, current.present].slice(-MAX_DEPTH),
        present: next,
        future: rest,
      };
    });
  }, []);

  const reset = useCallback((layout: StageLayout) => {
    coalesce.current = null;
    setState({ past: [], present: layout, future: [] });
  }, []);

  return useMemo(
    () => ({
      layout: state.present,
      setLayout,
      begin,
      end,
      undo,
      redo,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      reset,
    }),
    [state, setLayout, begin, end, undo, redo, reset],
  );
}
