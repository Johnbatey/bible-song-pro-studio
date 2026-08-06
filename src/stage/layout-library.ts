/* =========================================================================
   Stage layouts — the operator's library, from the renderer's side
   -------------------------------------------------------------------------
   A thin wrapper over the stage-layouts IPC, plus the hook both windows use to
   read it. The designer writes to this library and the operator panel lists
   from it, so they subscribe to the same change broadcast rather than each
   polling a file neither of them owns.

   Outside the desktop app there is no window.BSP at all — the browser display
   builds run the same bundle — so every call degrades to an empty library
   rather than throwing. A missing library means "no custom layouts", which is
   a state the app already knows how to be in.
   ========================================================================= */
import { useCallback, useEffect, useState } from 'react';
import { normalizeLayout } from './layout-model';
import type { StageLayout } from './layouts';

export interface LayoutLibrary {
  layouts: StageLayout[];
  activeId: string | null;
  /** Insert or replace by id, then refresh. */
  save: (layout: StageLayout) => Promise<{ ok: boolean; error?: string }>;
  remove: (id: string) => Promise<void>;
  setActive: (id: string | null) => Promise<void>;
  reload: () => Promise<void>;
  /** False until the first read lands, so a picker can avoid flashing "no
      saved layouts" at an operator who has twelve. */
  loaded: boolean;
}

export async function readLayoutLibrary(): Promise<{ layouts: StageLayout[]; activeId: string | null }> {
  const api = window.BSP?.stageLayouts;
  if (!api) return { layouts: [], activeId: null };
  try {
    const result = await api.list();
    const layouts = Array.isArray(result?.layouts) ? result.layouts.map(normalizeLayout) : [];
    return { layouts, activeId: result?.activeId ?? null };
  } catch {
    return { layouts: [], activeId: null };
  }
}

export function useLayoutLibrary(): LayoutLibrary {
  const [layouts, setLayouts] = useState<StageLayout[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const next = await readLayoutLibrary();
    setLayouts(next.layouts);
    setActiveId(next.activeId);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void reload();
    /* The main process tells every window when the file changes, so a layout
       saved in the designer appears in the panel's picker without the operator
       having to reopen anything. */
    return window.BSP?.stageLayouts?.onChanged?.((payload) => {
      setLayouts(Array.isArray(payload?.layouts) ? payload.layouts.map(normalizeLayout) : []);
      setActiveId(payload?.activeId ?? null);
      setLoaded(true);
    });
  }, [reload]);

  const save = useCallback(async (layout: StageLayout) => {
    const api = window.BSP?.stageLayouts;
    if (!api) return { ok: false, error: 'Saving needs the desktop app' };
    const result = await api.save(layout);
    // The broadcast will refresh every other window; refresh this one now so
    // the caller can rely on the library being current the moment it resolves.
    await reload();
    return { ok: !!result?.ok, error: result?.error };
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    await window.BSP?.stageLayouts?.delete(id);
    await reload();
  }, [reload]);

  const setActive = useCallback(async (id: string | null) => {
    await window.BSP?.stageLayouts?.setActive(id);
    setActiveId(id);
  }, []);

  return { layouts, activeId, save, remove, setActive, reload, loaded };
}
