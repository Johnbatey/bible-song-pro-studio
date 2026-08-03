import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useAppStore } from './stores/appStore';
// Ahead of global.css so the .bsp-dock theme block can override dockview's own
// variable defaults rather than fighting import order.
import 'dockview/dist/styles/dockview.css';
import './styles/global.css';

/**
 * Test seam for the scripts/verify-*.cjs harnesses, which drive the real built
 * app in Electron and otherwise have no way to seed operator state. Read/write
 * access to the store only — no behaviour of its own.
 */
declare global {
  interface Window { __BSP_TEST__?: { store: typeof useAppStore } }
}
window.__BSP_TEST__ = { store: useAppStore };

function SplashOverlay() {
  useEffect(() => {
    const splashEl = document.getElementById('splash-screen');
    if (!splashEl) return;

    // Smoothly fade out inline loading screen once React has mounted App
    const timer = setTimeout(() => {
      splashEl.style.opacity = '0';
      splashEl.style.pointerEvents = 'none';
      setTimeout(() => {
        splashEl.remove();
      }, 400);
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  return null;
}

function Root() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <React.StrictMode>
      <SplashOverlay />
      {ready && <App />}
    </React.StrictMode>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<Root />);
