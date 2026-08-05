/* =========================================================================
   Stage display — window entry
   -------------------------------------------------------------------------
   The standalone stage window. Mirrors src/display/main.tsx, which is the
   point: the projector and the stage now boot the same way, render the same
   ProgramSurface, and resolve media against the same origin.

   Two feeds arrive here. The program output comes from the main process over
   IPC, the same `display:message` the audience window listens to. The stage's
   own state — layout, theme, current and next, timer, messages — still arrives
   on the BroadcastChannel the operator already publishes to; moving that onto
   IPC as well is the next step, and is deliberately not mixed into this one.
   ========================================================================= */
import { useCallback, useEffect, useReducer, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ProgramSurfaceState } from '../renderer/components/display/ProgramSurface';
import { installFontFaces } from '../shared/display-fonts';
import { StageSurface } from './StageSurface';
import { cycleLayoutId, LAYOUTS } from './layouts';
import { persistLayoutId } from './theme';
import { clearStageContent, initialStageState, reduceStage, type StageState } from './stage-state';
import './stage-page.css';

const CHANNEL_NAME = 'bsp-display-sync';
const DEFAULT_ASSET_BASE = 'http://localhost:8942';

/** The operator publishes stage messages wrapped in one of these envelopes. */
interface SyncEnvelope {
  __bspDisplayState?: boolean;
  __bspStageDisplayState?: boolean;
  payload?: unknown;
}

type StageAction =
  | { type: 'message'; payload: unknown }
  | { type: 'layout'; id: string }
  | { type: 'clear' };

function stageReducer(state: StageState, action: StageAction): StageState {
  switch (action.type) {
    case 'message':
      return reduceStage(state, action.payload);
    case 'layout': {
      const layout = LAYOUTS[action.id];
      if (!layout) return state;
      persistLayoutId(layout.id);
      return { ...state, layout, backgroundColor: layout.bgColor };
    }
    case 'clear':
      return clearStageContent(state);
    default:
      return state;
  }
}

function StageHost() {
  const [state, dispatch] = useReducer(stageReducer, undefined, initialStageState);
  const [program, setProgram] = useState<ProgramSurfaceState>({});
  const [assetBaseUrl, setAssetBaseUrl] = useState(DEFAULT_ASSET_BASE);

  // Media and fonts resolve against the local server, as they do for the
  // audience window. Installed twice on purpose — once against the fallback so
  // text is never unstyled, once when the real origin comes back.
  useEffect(() => {
    installFontFaces(DEFAULT_ASSET_BASE);
    let mounted = true;
    window.BSP?.media?.baseUrl?.()
      .then((url) => {
        if (!mounted || !url) return;
        setAssetBaseUrl(url);
        installFontFaces(url);
      })
      .catch(() => { /* the fallback origin is already installed */ });
    return () => { mounted = false; };
  }, []);

  // Program output, straight from the main process.
  useEffect(() => {
    const api = window.BSP?.display;
    const unsubscribe = api?.onMessage?.((msg: { type?: string; state?: ProgramSurfaceState }) => {
      const next = msg?.type === 'display:update' ? msg.state : (msg as ProgramSurfaceState);
      if (next) setProgram(next);
    });
    api?.getState?.().then((initial) => { if (initial) setProgram(initial); }).catch(() => {});
    return () => { unsubscribe?.(); };
  }, []);

  // Stage state over IPC — the feed that works for a window on another screen,
  // where BroadcastChannel's same-origin scoping does not reach.
  useEffect(() => {
    const api = window.BSP?.stage;
    const unsubscribe = api?.onMessage?.((message) => dispatch({ type: 'message', payload: message }));
    api?.getState?.()
      .then((snapshot) => {
        if (snapshot && Object.keys(snapshot).length > 0) dispatch({ type: 'message', payload: snapshot });
      })
      .catch(() => {});
    return () => { unsubscribe?.(); };
  }, []);

  /* Stage state from the operator's BroadcastChannel. Still here because the
     operator publishes on both while the old page is being retired; it is a
     no-op in a window that only ever receives the IPC feed. */
  useEffect(() => {
    let channel: BroadcastChannel;
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      return; // no channel in this context; the stage still renders the program
    }
    const onMessage = (event: MessageEvent<SyncEnvelope>) => {
      const data = event.data;
      if (!data || (!data.__bspDisplayState && !data.__bspStageDisplayState)) return;
      dispatch({ type: 'message', payload: data.payload });
    };
    channel.addEventListener('message', onMessage);
    return () => {
      channel.removeEventListener('message', onMessage);
      channel.close();
    };
  }, []);

  /* L cycles the layout, Esc clears content. P is deliberately unbound — it
     collides with the operator panel's own clear/enable-program shortcut. */
  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'l' || event.key === 'L') {
      dispatch({ type: 'layout', id: cycleLayoutId(state.layout.id, 1) });
    } else if (event.key === 'Escape') {
      dispatch({ type: 'clear' });
    }
  }, [state.layout.id]);

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  return <StageSurface state={state} program={program} assetBaseUrl={assetBaseUrl} />;
}

const root = document.getElementById('root');
if (!root) throw new Error('Stage root missing');
createRoot(root).render(<StageHost />);
