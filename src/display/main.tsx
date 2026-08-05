import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ProgramSurface, type ProgramSurfaceState } from '../renderer/components/display/ProgramSurface';
import { installFontFaces } from '../shared/display-fonts';
import './style.css';

let assetBaseUrl = 'http://localhost:8942';

function DisplayHost() {
  const [displayState, setDisplayState] = useState<ProgramSurfaceState>({});

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let mounted = true;

    async function init() {
      const baseUrl = await window.BSP?.media?.baseUrl?.().catch(() => null);
      if (baseUrl) assetBaseUrl = baseUrl;
      installFontFaces(assetBaseUrl);

      const displayApi = window.BSP?.display;
      cleanup = displayApi?.onMessage?.((msg: any) => {
        const next = msg?.type === 'display:update' ? msg.state : msg;
        if (next) setDisplayState(next);
      });

      const initialState = await displayApi?.getState?.().catch(() => null);
      if (mounted && initialState) setDisplayState(initialState);
    }

    init();
    return () => {
      mounted = false;
      cleanup?.();
    };
  }, []);

  return (
    <ProgramSurface
      className="audience-program-surface"
      state={displayState}
      assetBaseUrl={assetBaseUrl}
    />
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Display root missing');
createRoot(root).render(<DisplayHost />);
