/* =========================================================================
   Browser / OBS display — same ProgramSurface as the Electron audience window
   -------------------------------------------------------------------------
   display.html only ever painted flat verse text. A projected Pro Slide travels
   as `scene.content.slide`; that page ignored it and showed `content.text`
   instead — usually the slide title ("Slide 1"). Operators saw the design in
   Program and the name on the projector.

   This entry is what http://127.0.0.1:<port>/display.html now serves: WebSocket
   + HTTP poll for state (OBS-friendly), ProgramSurface for paint.
   ========================================================================= */
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ProgramSurface, type ProgramSurfaceState } from '../renderer/components/display/ProgramSurface';
import { installFontFaces } from '../shared/display-fonts';
import './style.css';

function assetOrigin(): string {
  /* Vite redirect (dev without dist) lives on :5173; media/API stay on the
     Electron HTTP port. Same-origin production serves both from one port. */
  if (location.port === '5173') {
    return `${location.protocol}//${location.hostname === 'localhost' ? '127.0.0.1' : location.hostname}:8942`;
  }
  return location.origin;
}

function applyPayload(raw: unknown, setDisplayState: (s: ProgramSurfaceState) => void) {
  let msg: any = raw;
  if (typeof raw === 'string') {
    try { msg = JSON.parse(raw); } catch { return; }
  }
  if (!msg) return;
  const next = msg.type === 'display:update' ? msg.state : (msg.state || msg);
  if (next && typeof next === 'object') setDisplayState(next);
}

function BrowserDisplayHost() {
  const [displayState, setDisplayState] = useState<ProgramSurfaceState>({});
  const [scale, setScale] = useState(1);
  const [baseUrl] = useState(() => assetOrigin());

  useEffect(() => {
    installFontFaces(baseUrl);
  }, [baseUrl]);

  useEffect(() => {
    function updateScale() {
      setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    }
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  useEffect(() => {
    let disposed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const apiBase = baseUrl;

    function pollState() {
      fetch(`${apiBase}/api/display/state`, { cache: 'no-store' })
        .then((res) => res.json())
        .then((data) => {
          if (!disposed && data?.state) setDisplayState(data.state);
        })
        .catch(() => { /* next tick */ });
    }

    function socketUrls(): string[] {
      try {
        const u = new URL(apiBase);
        const protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = u.hostname || '127.0.0.1';
        const port = u.port ? `:${u.port}` : '';
        const urls = [`${protocol}//${host}${port}`];
        if (host === 'localhost') urls.push(`${protocol}//127.0.0.1${port}`);
        else if (host === '127.0.0.1') urls.push(`${protocol}//localhost${port}`);
        return urls;
      } catch {
        return ['ws://127.0.0.1:8942'];
      }
    }

    function connectSocket(urlIndex = 0) {
      if (disposed) return;
      const urls = socketUrls();
      const url = urls[urlIndex];
      if (!url) {
        reconnectTimer = setTimeout(() => connectSocket(0), 2000);
        return;
      }
      try {
        ws = new WebSocket(url);
      } catch {
        connectSocket(urlIndex + 1);
        return;
      }
      ws.onmessage = (event) => {
        const data = event.data;
        if (typeof Blob !== 'undefined' && data instanceof Blob) {
          data.text().then((text) => {
            if (!disposed) applyPayload(text, setDisplayState);
          });
          return;
        }
        applyPayload(typeof data === 'string' ? data : String(data), setDisplayState);
      };
      ws.onclose = () => {
        if (disposed) return;
        if (urlIndex + 1 < urls.length) connectSocket(urlIndex + 1);
        else reconnectTimer = setTimeout(() => connectSocket(0), 1000);
      };
      ws.onerror = () => {
        try { ws?.close(); } catch { /* already closed */ }
      };
    }

    pollState();
    pollTimer = setInterval(pollState, 150);
    connectSocket(0);

    return () => {
      disposed = true;
      if (pollTimer) clearInterval(pollTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { ws?.close(); } catch { /* ignore */ }
    };
  }, [baseUrl]);

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
        background: (displayState.outputMode || displayState.mode) === 'lowerThird' ? 'transparent' : '#000',
      }}
    >
      <ProgramSurface
        className="audience-program-surface"
        state={displayState}
        assetBaseUrl={baseUrl}
      />
    </div>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Browser display root missing');
createRoot(root).render(<BrowserDisplayHost />);
