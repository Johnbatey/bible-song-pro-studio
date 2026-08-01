import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ProgramSurface, type ProgramSurfaceState } from '../renderer/components/display/ProgramSurface';
import './style.css';

let assetBaseUrl = 'http://localhost:8942';

function installFontFaces() {
  const fonts: Array<[string, string, number]> = [
    ['Poppins', 'Poppins-Regular.ttf', 400],
    ['Poppins', 'Poppins-Medium.ttf', 500],
    ['Poppins', 'Poppins-Bold.ttf', 700],
    ['Inter', 'Inter-Regular.ttf', 400],
    ['Inter', 'Inter-Bold.ttf', 700],
    ['Montserrat', 'Montserrat-Regular.ttf', 400],
    ['Montserrat', 'Montserrat-Bold.ttf', 700],
    ['Roboto', 'Roboto-Regular.ttf', 400],
    ['Roboto', 'Roboto-Bold.ttf', 700],
    ['Oswald', 'Oswald-Regular.ttf', 400],
    ['Oswald', 'Oswald-Bold.ttf', 700],
    ['Crimson Pro', 'CrimsonPro-Regular.ttf', 400],
    ['Crimson Pro', 'CrimsonPro-Bold.ttf', 700],
    ['Playfair Display', 'PlayfairDisplay-Regular.ttf', 400],
    ['Playfair Display', 'PlayfairDisplay-Bold.ttf', 700],
    ['Lora', 'Lora-Regular.ttf', 400],
    ['Lora', 'Lora-Bold.ttf', 700],
    ['Cinzel', 'Cinzel-Regular.ttf', 400],
    ['Cinzel', 'Cinzel-Bold.ttf', 700],
    ['Bebas Neue', 'BebasNeue-Regular.ttf', 400],
  ];
  const style = document.createElement('style');
  style.textContent = fonts.map(([family, file, weight]) => (
    `@font-face{font-family:${family};src:url("${assetBaseUrl}/fonts/${file}") format("truetype");font-weight:${weight}}`
  )).join('\n');
  document.head.appendChild(style);
}

function DisplayHost() {
  const [displayState, setDisplayState] = useState<ProgramSurfaceState>({});

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let mounted = true;

    async function init() {
      const baseUrl = await window.BSP?.media?.baseUrl?.().catch(() => null);
      if (baseUrl) assetBaseUrl = baseUrl;
      installFontFaces();

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
