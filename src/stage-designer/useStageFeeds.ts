/* =========================================================================
   Designer — the two live feeds
   -------------------------------------------------------------------------
   The same subscriptions the stage window makes in src/stage/main.tsx, for the
   same reason: the designer draws the real stage, so it needs the real state.
   `stage:message` carries the theme, the live text and the timer;
   `display:message` carries the program output the hybrid view sits on and the
   slide the Slide zone draws.

   The designer never sends anything back through these on its own — a window
   whose job is to lay out the stage should not be able to change what is on it
   by accident. The one thing it does publish is the layout, and only when the
   operator asks for it.
   ========================================================================= */
import { useEffect, useState } from 'react';
import { initialStageState, reduceStage, type StageState } from '../stage/stage-state';
import type { ProgramSurfaceState } from '../renderer/components/display/ProgramSurface';
import { installFontFaces } from '../shared/display-fonts';

const DEFAULT_ASSET_BASE = 'http://localhost:8942';

export interface StageFeeds {
  stage: StageState;
  program: ProgramSurfaceState;
  assetBaseUrl: string;
}

export function useStageFeeds(): StageFeeds {
  const [stage, setStage] = useState<StageState>(initialStageState);
  const [program, setProgram] = useState<ProgramSurfaceState>({});
  const [assetBaseUrl, setAssetBaseUrl] = useState(DEFAULT_ASSET_BASE);

  // Fonts twice on purpose, as the stage window does: once against the
  // fallback origin so nothing renders unstyled, once when the real one lands.
  useEffect(() => {
    installFontFaces(DEFAULT_ASSET_BASE);
    let mounted = true;
    window.BSP?.media?.baseUrl?.()
      .then((url) => {
        if (!mounted || !url) return;
        setAssetBaseUrl(url);
        installFontFaces(url);
      })
      .catch(() => { /* the fallback is already installed */ });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const api = window.BSP?.stage;
    const unsubscribe = api?.onMessage?.((message) => setStage((current) => reduceStage(current, message)));
    api?.getState?.()
      .then((snapshot) => {
        if (snapshot && Object.keys(snapshot).length > 0) {
          setStage((current) => reduceStage(current, snapshot));
        }
      })
      .catch(() => {});
    return () => { unsubscribe?.(); };
  }, []);

  useEffect(() => {
    const api = window.BSP?.display;
    const unsubscribe = api?.onMessage?.((msg: { type?: string; state?: ProgramSurfaceState }) => {
      const next = msg?.type === 'display:update' ? msg.state : (msg as ProgramSurfaceState);
      if (next) setProgram(next);
    });
    api?.getState?.().then((initial) => { if (initial) setProgram(initial); }).catch(() => {});
    return () => { unsubscribe?.(); };
  }, []);

  return { stage, program, assetBaseUrl };
}
