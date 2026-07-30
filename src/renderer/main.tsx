import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/global.css';

function SplashOverlay() {
  useEffect(() => {
    const splashEl = document.getElementById('splash-screen');
    if (splashEl) {
      splashEl.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;background:#030308;">
          <div style="text-align:center;">
            <div style="width:40px;height:40px;border:2px solid rgba(201,169,110,0.3);border-top-color:#C9A96E;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto;"></div>
            <div style="margin-top:16px;font-family:-apple-system,sans-serif;font-size:12px;letter-spacing:0.15em;color:rgba(255,255,255,0.3);text-transform:uppercase;">Loading Sanctuary</div>
          </div>
          <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
        </div>
      `;
    }

    const hideSplash = () => {
      splashEl?.remove();
    };

    // Listen for splash complete from splash.html
    const handleSplash = () => hideSplash();
    document.addEventListener('splash-complete', handleSplash);

    // Fallback in case no splash-complete event is emitted.
    const timer = setTimeout(hideSplash, 4000);

    return () => {
      document.removeEventListener('splash-complete', handleSplash);
      clearTimeout(timer);
    };
  }, []);

  return null;
}

function Root() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    document.dispatchEvent(new Event('splash-complete'));
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
