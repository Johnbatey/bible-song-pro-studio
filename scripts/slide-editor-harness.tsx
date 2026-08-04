/* =========================================================================
   Slide editor harness  (dev only — never bundled)
   -------------------------------------------------------------------------
   Opens one of the parity fixture decks in the real editor, in a plain
   browser tab, so the chrome around the board — the rail, the Design and
   Layer tabs, the toolbar — can be driven without packaging Electron and
   picking a file through a dialog.

   The only thing stubbed is the one piece that genuinely needs the desktop
   app: `window.BSP.deck.read`, which normally hands back the package's bytes
   over IPC. Here it fetches the fixture from /__parity/. Everything past that
   point is the same import pipeline, the same components and the same store.

   Vite serves this in dev at /scripts/slide-editor-harness.tsx. It is outside
   src/ and imported by nothing, so it never reaches a production build.

   Usage from the console:
     const h = await import('/scripts/slide-editor-harness.tsx');
     await h.open('feature-test.pptx');
   ========================================================================= */
import { useAppStore } from '../src/renderer/stores/appStore';
import type { PresentationDeck } from '../src/renderer/types';

declare global {
  interface Window { BSP?: any }
}

/** Serve the fixture bytes where the desktop app's IPC would. */
function stubDeckRead() {
  const bsp = (window.BSP = window.BSP || {});
  bsp.deck = bsp.deck || {};
  if (bsp.deck.__harness) return;
  bsp.deck.read = async (path: string) => {
    const res = await fetch(path);
    if (!res.ok) return { ok: false, error: res.status === 404 ? 'ENOENT' : String(res.status) };
    const buf = await res.arrayBuffer();
    return { ok: true, data: new Uint8Array(buf), name: path.split('/').pop() };
  };
  bsp.deck.__harness = true;
}

/**
 * Open a fixture deck in the editor.
 *
 * The deck record is the minimum the editor reads before the package is
 * reopened: an id, a title and the source path. Slide titles and bodies are
 * the library grid's business, and are filled in from the package on save.
 */
export async function open(fixture = 'feature-test.pptx', slideCount = 12): Promise<PresentationDeck> {
  stubDeckRead();

  const id = `harness-${Date.now()}`;
  const deck: PresentationDeck = {
    id,
    title: fixture,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sourceType: 'pptx',
    sourcePath: `/__parity/${encodeURIComponent(fixture)}`,
    aspectRatio: '16:9',
    slides: Array.from({ length: slideCount }, (_, i) => ({
      id: `slide-${i + 1}`,
      title: `Slide ${i + 1}`,
      body: '',
      label: `Slide ${i + 1}`,
      notes: '',
      transition: 'fade' as const,
      durationMs: 3000,
      hidden: false,
      buildCount: 1,
      buildStep: 1,
    })),
  };

  const store = useAppStore.getState();
  store.addPresentationDeck(deck);
  store.openSlideEditor(id);
  return deck;
}

/** Open the editor on a native deck instead, for the other half of the chrome. */
export function openNative(): void {
  useAppStore.getState().openSlideEditor(`native-${Date.now()}`);
}

export function close(): void {
  useAppStore.getState().closeSlideEditor();
}
