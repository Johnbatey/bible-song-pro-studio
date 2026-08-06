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

   It also *receives*, since the Stage Layout Designer opened as a second
   window and became a second author of the same state. The main process is the
   bus and never echoes a message back to whoever sent it, so an incoming
   message is always someone else's and folds in exactly like a local one.
   ========================================================================= */
import { useSyncExternalStore } from 'react';
import { initialStageState, reduceStage, type StageState } from '../../stage/stage-state';
import { persistLayoutId, persistTheme } from '../../stage/theme';
import { isPresetId } from '../../stage/layout-model';
import { readLayoutLibrary } from '../../stage/layout-library';

let state: StageState = initialStageState();
const listeners = new Set<() => void>();

export function getStageState(): StageState {
  return state;
}

export function subscribeStage(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** Fold a message in and wake the components. Shared by the local publish path
    and the one that arrives over IPC, because the whole point of moving a
    message rather than a state object is that both ends apply it the same. */
function applyStageMessage(message: unknown): void {
  const previous = state;
  state = reduceStage(state, message);

  // The operator's window is where these are set, so it is where they persist.
  if (state.theme !== previous.theme) persistTheme(state.theme);
  /* Only preset ids go to localStorage. An operator-authored layout is a whole
     document, not an id the stage can look up on its own, so its restoration
     is the library's job — see restoreStageSession below. */
  if (state.layout !== previous.layout && isPresetId(state.layout.id)) persistLayoutId(state.layout.id);

  if (state !== previous) listeners.forEach((fn) => fn());
}

/**
 * Apply an operator message and send it on to every stage window.
 *
 * The message travels, not the resulting state: the stage's reducer is the
 * same one used here, so replaying the message reproduces the state exactly,
 * and a command like "start the timer" keeps meaning what it said.
 */
export function publishStage(message: Record<string, unknown>): void {
  applyStageMessage(message);

  window.BSP?.stage?.sendState?.(message).catch(() => {
    /* not the desktop app — the dock preview still updates */
  });
}

/* Subscribed once at module load rather than from a hook: the bus is a module
   singleton and there is no point at which the operator window wants to stop
   tracking the stage. A hook would also mean the first component to mount owns
   the subscription, and the state would go stale the moment it unmounted. */
window.BSP?.stage?.onMessage?.((message) => applyStageMessage(message));

/**
 * Catch up on the stage, then restore the operator's chosen layout.
 *
 * Two separate jobs that have to happen in this order. The snapshot first:
 * reloading the operator window mid-service used to leave the dock preview
 * showing an idle stage while the actual screen carried the service, because
 * this module started from scratch and nothing ever told it otherwise.
 *
 * Then the layout, but only if this session has not already chosen one. A
 * fresh launch has no layout in the snapshot and should come back to whatever
 * the operator last used; a renderer reload halfway through a service must not
 * undo a preset they picked ten minutes ago.
 */
async function restoreStageSession(): Promise<void> {
  const api = window.BSP?.stage;
  if (!api) return;

  let snapshot: Record<string, unknown> | undefined;
  try {
    snapshot = await api.getState();
  } catch {
    return;
  }
  if (snapshot && Object.keys(snapshot).length > 0) applyStageMessage(snapshot);
  if (snapshot && (snapshot.layout || snapshot.customLayout)) return;

  const { layouts, activeId } = await readLayoutLibrary();
  const active = layouts.find((item) => item.id === activeId);
  if (!active) return;
  publishStage({
    customLayout: { id: active.id, name: active.name, bgColor: active.bgColor, zones: active.zones },
  });
}

void restoreStageSession();

/** The stage state, for rendering. */
export function useStageState(): StageState {
  return useSyncExternalStore(subscribeStage, getStageState, getStageState);
}
