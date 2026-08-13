/* =========================================================================
   useMediaLibrary — the imported media library, shared by every picker
   -------------------------------------------------------------------------
   The Media panel owned this list privately for as long as it was the only
   thing that needed it. It is not any more: the theme editor and the Songs
   panel both offer a background chosen from the library, and three components
   each holding their own copy is three answers to "what is imported" that
   drift the moment one of them imports something.

   So the list lives here, once, and a refresh reaches everyone holding it —
   import a clip in the Media panel and the picker open in the Themes panel
   already has it. Cached at module scope like useAssetBaseUrl, for the same
   reason: every pane asking separately would be a round trip each.
   ========================================================================= */
import { useEffect, useState } from 'react';
import type { MediaItem } from '../types';

let cached: MediaItem[] | null = null;
let inFlight: Promise<MediaItem[]> | null = null;
const listeners = new Set<(items: MediaItem[]) => void>();

async function load(): Promise<MediaItem[]> {
  const result = await window.BSP?.media?.list().catch(() => null);
  /* A failed list is not an empty library — the library is simply unknown, and
     replacing it with [] would blank out pickers that were showing the truth a
     moment ago. Keep whatever we last knew. */
  if (!result?.ok) return cached ?? [];
  return result.items;
}

/** Re-read the library and push it to every mounted consumer. */
export async function refreshMediaLibrary(): Promise<MediaItem[]> {
  inFlight = load();
  const items = await inFlight;
  inFlight = null;
  cached = items;
  listeners.forEach((notify) => notify(items));
  return items;
}

export function useMediaLibrary(): { items: MediaItem[]; refresh: () => Promise<MediaItem[]> } {
  const [items, setItems] = useState<MediaItem[]>(cached ?? []);

  useEffect(() => {
    listeners.add(setItems);
    /* First mount anywhere fetches; later mounts ride the cache, and join any
       fetch already in flight rather than starting a second one. */
    if (cached === null) {
      if (inFlight) inFlight.then(setItems);
      else void refreshMediaLibrary();
    }
    return () => { listeners.delete(setItems); };
  }, []);

  return { items, refresh: refreshMediaLibrary };
}
