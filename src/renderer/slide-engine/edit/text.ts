/* =========================================================================
   Slide engine — editing an imported slide's text
   -------------------------------------------------------------------------
   Text edits are written straight back into the slide's XML document through
   each run's `nodeRef`, so a later save round-trips them into the .pptx. The
   parsed run record is updated alongside, which is what the canvas renders
   from.

   Ported from the text functions of the reference editor's
   edit/modifier-shapes.js. The reference also pokes the rendered <span>s
   directly, because it owns the DOM imperatively; React re-renders from the
   updated records instead, so that part is not carried across.
   ========================================================================= */
import type { ParsedShape, ParsedRun } from '../parser/slide-parser';

/** Full text of a shape, one line per paragraph (runs concatenated). */
export function shapeFullText(shape: ParsedShape): string {
  return (shape.paragraphs || []).map((p) => p.map((r) => r.text).join('')).join('\n');
}

/**
 * Does this shape hold real, user-visible text? Decorative custGeom art often
 * carries a throwaway/whitespace txBody — those are not text boxes, and
 * listing them is what floods an editor with hundreds of empty fields.
 *
 * Two conditions, both needed: at least one run must be backed by an XML node
 * (so it is editable at all), and the visible characters must not be entirely
 * whitespace or zero-width spaces.
 */
export function shapeHasVisibleText(shape: ParsedShape): boolean {
  if (!shape.paragraphs || !shape.paragraphs.some((p) => p.some((r) => r.nodeRef))) return false;
  return shapeFullText(shape).replace(/[\s\u200B]/g, '').length > 0;
}

/**
 * Write edited text back into a text box.
 *
 * One field per box is PowerPoint's own unit, so the value is split by line and
 * distributed one line per paragraph; each paragraph's text lands in its first
 * editable run and the rest are cleared. That is exactly right for the
 * split-run sentences Google Slides exports, and lossless for the single-run
 * paragraphs everything else writes.
 *
 * Extra lines beyond the paragraph count are appended to the last paragraph
 * rather than dropped.
 */
export function setShapeText(shape: ParsedShape, value: string): void {
  const lines = value.split('\n');
  const lastP = shape.paragraphs.length - 1;

  shape.paragraphs.forEach((pRuns, pIdx) => {
    const line = pIdx < lastP
      ? (lines[pIdx] != null ? lines[pIdx] : '')
      : lines.slice(pIdx).join('\n');

    let firstIdx = pRuns.findIndex((r) => r.nodeRef);
    if (firstIdx === -1) firstIdx = 0;

    pRuns.forEach((run, rIdx) => {
      const next = rIdx === firstIdx ? line : '';
      if (run.text === next) return;
      run.text = next;
      if (run.nodeRef) run.nodeRef.textContent = next;
    });
  });
}

/** Write one run's text back, for in-place caret editing on the canvas. */
export function setRunText(run: ParsedRun, value: string): void {
  if (run.text === value) return;
  run.text = value;
  if (run.nodeRef) run.nodeRef.textContent = value;
}

/** Every shape on a slide that a user could type into, in paint order. */
export function editableTextShapes(shapes: ParsedShape[]): ParsedShape[] {
  return (shapes || []).filter((s) => s.editable !== false && shapeHasVisibleText(s));
}
