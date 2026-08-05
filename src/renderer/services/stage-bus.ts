/* =========================================================================
   Stage bus — the operator's copy of the stage state
   -------------------------------------------------------------------------
   One owner in the renderer. Every stage message goes through `publishStage`,
   which folds it into the local state, tells the dock panel, and forwards it
   to the main process for the stage windows.

   The panel cannot simply listen on the BroadcastChannel the stage window uses:
   a channel never delivers to the context that posted, and the operator window
   is the one posting. So the panel reads from here instead — the same reducer,
   the same message, one step earlier in the same flow. That is what lets the
   dock preview and the stage screen be the same component showing the same
   state rather than two renderings hoping to agree.
   ========================================================================= */
import { useSyncExternalStore } from 'react';
import { initialStageState, reduceStage, type StageState } from '../../stage/stage-state';
import { persistLayoutId, persistTheme } from '../../stage/theme';

let state: StageState = initialStageState();
const listeners = new Set<() => void>();

export function getStageState(): StageState {
  return state;
}

export function subscribeStage(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/**
 * Apply an operator message and send it on to every stage window.
 *
 * The message travels, not the resulting state: the stage's reducer is the
 * same one used here, so replaying the message reproduces the state exactly,
 * and a command like "start the timer" keeps meaning what it said.
 */
export function publishStage(message: Record<string, unknown>): void {
  const previous = state;
  state = reduceStage(state, message);

  // The operator's window is where these are set, so it is where they persist.
  if (state.theme !== previous.theme) persistTheme(state.theme);
  if (state.layout !== previous.layout && state.layout.id !== 'custom') persistLayoutId(state.layout.id);

  if (state !== previous) listeners.forEach((fn) => fn());

  window.BSP?.stage?.sendState?.(message).catch(() => {
    /* not the desktop app — the dock preview still updates */
  });
}

/** The stage state, for rendering. */
export function useStageState(): StageState {
  return useSyncExternalStore(subscribeStage, getStageState, getStageState);
}
