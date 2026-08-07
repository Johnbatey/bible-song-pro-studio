import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ProgramSurface, type ProgramSurfaceState } from '../renderer/components/display/ProgramSurface';
import { installFontFaces } from '../shared/display-fonts';
import './style.css';

let assetBaseUrl = 'http://localhost:8942';

function DisplayHost() {
  const [displayState, setDisplayState] = useState<ProgramSurfaceState>({});
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function updateScale() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const s = Math.min(w / 1920, h / 1080);
      setScale(s);
    }
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

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
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: 1920,
        height: 1080,
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: 'center center',
        overflow: 'hidden',
        background: '#000',
      }}
    >
      <ProgramSurface
        className="audience-program-surface"
        state={displayState}
        assetBaseUrl={assetBaseUrl}
      />
    </div>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Display root missing');
createRoot(root).render(<DisplayHost />);
