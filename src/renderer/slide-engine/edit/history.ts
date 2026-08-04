/* =========================================================================
   Slide engine — undo / redo for imported slides
   -------------------------------------------------------------------------
   Parsed records cannot be cloned: they hold live references into the slide's
   xmlDoc (nodeRef, srcNode, groupNode). So the source of truth for history is
   the XML document itself.

   A snapshot is the serialized slide part. Undo writes it back into the
   package and re-parses the slide, which rebuilds the records with fresh node
   references — the same path a reopened deck takes, so an undone slide is
   never a special case for anything downstream.

   History is per slide, because that is the unit the operator is editing, and
   because XML snapshots are heavy enough that a deck-wide stack would be
   wasteful. A trailing debounce coalesces bursts (typing is one undo step, not
   one per keystroke) and identical states are dropped.

   Ported from the reference editor's edit/modifier-history.js. The reference
   also snapshots a small overlay of record-only facts — user-made group ids
   and per-layer hidden flags. Neither exists in this port yet (grouping and
   the layers panel are not ported), and everything else already lives in the
   XML, so the overlay is left out rather than carried as dead structure. It
   goes back the moment records-level state does.
   ========================================================================= */
import { ensureModifierSlideParsed } from '../parser/presentation';
import { state } from '../state';

/** Max undo depth per slide. XML snapshots are heavy. */
const CAP = 30;
const DEBOUNCE_MS = 240;

interface SlideStack {
  undo: string[];
  redo: string[];
  present: string;
}

export interface HistoryCounts { undo: number; redo: number }

export interface SlideHistory {
  /** Capture a slide's starting state, so its first edit is undoable. */
  ensureBaseline: (index: number) => void;
  /** Note that something changed. Debounced; safe to call per keystroke. */
  record: (index: number) => void;
  /** Commit any pending debounce immediately. */
  flush: () => void;
  undo: (index: number) => Promise<boolean>;
  redo: (index: number) => Promise<boolean>;
  counts: (index: number) => HistoryCounts;
  reset: () => void;
}

function snapshot(index: number): string | null {
  const slide = state.slides[index];
  if (!slide || !slide.xmlDoc) return null;
  return new XMLSerializer().serializeToString(slide.xmlDoc);
}

/**
 * @param onChanged  called after the stacks move or a restore completes, so
 *                   the UI can re-read counts and repaint.
 */
export function createSlideHistory(onChanged: () => void): SlideHistory {
  const stacks = new Map<number, SlideStack>();
  let timer: number | null = null;
  let pendingIndex: number | null = null;
  let restoring = false;
  /* Serialized so a held ⌘Z cannot overlap two async restores of the same
     slide and interleave their re-parses. */
  let chain: Promise<unknown> = Promise.resolve();

  const commit = () => {
    timer = null;
    const index = pendingIndex;
    pendingIndex = null;
    if (index == null) return;

    const stack = stacks.get(index);
    if (!stack) return;
    const cur = snapshot(index);
    if (cur == null || cur === stack.present) return; // nothing actually changed

    stack.undo.push(stack.present);
    if (stack.undo.length > CAP) stack.undo.shift();
    stack.present = cur;
    stack.redo = [];
    onChanged();
  };

  const flush = () => {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
      commit();
    }
  };

  const restore = async (index: number, xml: string) => {
    const slide = state.slides[index];
    if (!slide || !state.loadedPptxZip) return;
    restoring = true;
    try {
      (state.loadedPptxZip as any).file(slide.filename, xml);
      slide.parsed = false;
      state.xmlDocCache.delete(slide.filename as string);
      await ensureModifierSlideParsed(index);
      // The slide's XML in the package now differs from the imported file.
      state.slides[index].pptxDirty = true;
    } finally {
      restoring = false;
    }
  };

  return {
    ensureBaseline(index) {
      if (stacks.has(index)) return;
      const snap = snapshot(index);
      if (snap == null) return;
      stacks.set(index, { undo: [], redo: [], present: snap });
      onChanged();
    },

    record(index) {
      if (restoring) return;
      pendingIndex = index;
      if (timer != null) clearTimeout(timer);
      timer = window.setTimeout(commit, DEBOUNCE_MS);
    },

    flush,

    undo(index) {
      chain = chain.then(async () => {
        flush();
        const stack = stacks.get(index);
        if (!stack || stack.undo.length === 0) return false;
        stack.redo.push(stack.present);
        const target = stack.undo.pop() as string;
        stack.present = target;
        await restore(index, target);
        onChanged();
        return true;
      }).catch((err) => { console.error(err); return false; });
      return chain as Promise<boolean>;
    },

    redo(index) {
      chain = chain.then(async () => {
        flush();
        const stack = stacks.get(index);
        if (!stack || stack.redo.length === 0) return false;
        stack.undo.push(stack.present);
        const target = stack.redo.pop() as string;
        stack.present = target;
        await restore(index, target);
        onChanged();
        return true;
      }).catch((err) => { console.error(err); return false; });
      return chain as Promise<boolean>;
    },

    counts(index) {
      const stack = stacks.get(index);
      return stack ? { undo: stack.undo.length, redo: stack.redo.length } : { undo: 0, redo: 0 };
    },

    reset() {
      stacks.clear();
      if (timer != null) { clearTimeout(timer); timer = null; }
      pendingIndex = null;
      onChanged();
    },
  };
}
