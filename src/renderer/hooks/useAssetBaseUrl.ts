/* =========================================================================
   useAssetBaseUrl — the origin imported media and fonts resolve against
   -------------------------------------------------------------------------
   Scenes store media server-relative (`/media/<file>`), because the port is not
   knowable when a scene is saved and is not guaranteed to be the same next
   time — a conflict moves it. Whoever renders a scene supplies the origin.

   The projector and stage windows resolve this for themselves at boot; this is
   for the surfaces inside the operator window, which would otherwise render a
   relative path against the renderer's own origin and show nothing.

   Resolved once per session and shared: the port is fixed by the time any of
   this mounts, and every pane asking separately would be a round trip each.
   ========================================================================= */
import { useEffect, useState } from 'react';

let cached: string | null = null;
let inFlight: Promise<string> | null = null;

function resolveBaseUrl(): Promise<string> {
  if (cached !== null) return Promise.resolve(cached);
  if (!inFlight) {
    inFlight = (window.BSP?.media?.baseUrl?.() ?? Promise.resolve(''))
      .then((url) => {
        cached = url || '';
        return cached;
      })
      .catch(() => {
        // Not the desktop app, or the server never bound. Relative paths will
        // not resolve, which is correct — there is nothing serving them.
        inFlight = null;
        return '';
      });
  }
  return inFlight;
}

export function useAssetBaseUrl(): string {
  const [baseUrl, setBaseUrl] = useState(cached ?? '');

  useEffect(() => {
    if (cached !== null) return;
    let mounted = true;
    resolveBaseUrl().then((url) => { if (mounted) setBaseUrl(url); });
    return () => { mounted = false; };
  }, []);

  return baseUrl;
}
