/* =========================================================================
   Slide projection — packing a slide for the wire
   -------------------------------------------------------------------------
   A parsed PowerPoint slide is full of live DOM: `xmlDoc` is a Document, and
   every run keeps a `nodeRef` back to the element it came from so the editor
   can write text into the package. Structured clone refuses all of it, so
   putting a parsed slide straight onto a scene throws the moment the scene is
   sent to the display window.

   Everything the renderer actually paints with is already plain data —
   geometry in percent, colours resolved to hex, images inlined as data URLs by
   the import — so a projection is the same slide with the DOM pruned out.
   ========================================================================= */
import { resolveThemeColor } from '../slide-engine/core/color';
import type { ParsedSlide, SlideSizeEmu } from '../slide-engine/state';
import type { PresentationDeck, PresentationSlide, SlideProjection } from '../types';
import { slideElementsFor } from '../components/NativeSlideBoard';

/** Deep copy with every DOM node and function dropped. Cycles are cut. */
function stripDom(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'function' ? undefined : value;
  }
  if (typeof Node !== 'undefined' && value instanceof Node) return undefined;
  if (seen.has(value as object)) return undefined;
  seen.add(value as object);

  if (Array.isArray(value)) {
    /* Entries keep their slots: paragraphs are indexed, and a run that came
       back undefined would shift every run after it. */
    return value.map((entry) => stripDom(entry, seen) ?? null);
  }

  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const cleaned = stripDom(entry, seen);
    if (cleaned !== undefined) out[key] = cleaned;
  }
  return out;
}

/** A parsed PowerPoint slide, ready to travel. */
export function projectParsedSlide(slide: ParsedSlide, sizeEmu: SlideSizeEmu | null): SlideProjection {
  const { xmlDoc: _xmlDoc, previewDataUrl, ...rest } = slide;
  const parsed = stripDom(rest, new WeakSet()) as Record<string, unknown>;

  return {
    kind: 'pptx',
    sizeEmu: sizeEmu && sizeEmu.cx > 0 ? { cx: sizeEmu.cx, cy: sizeEmu.cy } : undefined,
    parsed,
    /* Read while the package is still open — the display has no theme map. */
    textFallbackColor: resolveThemeColor('tx1', '#f8fafc'),
    previewDataUrl: !slide.parsed && previewDataUrl ? previewDataUrl : undefined,
  };
}

/**
 * A slide built in the editor. Its layers are already plain data.
 *
 * The board is 16:9 whatever the slide's `aspectRatio` says, because that is
 * the board the editor draws: SlideEditorCanvasBoard is a fixed 1280x720, and
 * the element geometry the operator dragged into place is a percentage of
 * that. Projecting a 4:3 board would move every layer somewhere the operator
 * never put it. If the editor ever honours the setting, this follows it.
 */
export function projectNativeSlide(slide: PresentationSlide, _deck?: PresentationDeck | null): SlideProjection {
  return {
    kind: 'native',
    sizeEmu: { cx: 12192000, cy: 6858000 },
    elements: slideElementsFor(slide),
    background: slide.background,
  };
}
