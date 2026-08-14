/* =========================================================================
   Slide engine — restyling and reordering an imported slide's shapes
   -------------------------------------------------------------------------
   Fill, stroke, run colour, z-order and deletion, each written into the
   slide's XML alongside the parsed record so a save round-trips it.

   The element ordering here is not cosmetic. DrawingML's schema is a sequence,
   not a bag: <a:solidFill> has to precede <a:ln> inside <p:spPr>, and <a:rPr>
   has to precede <a:t> inside a run. PowerPoint rejects a file that gets this
   wrong, so every insert below is positional rather than an append.

   Ported from the styling half of the reference editor's
   edit/modifier-shapes.js.
   ========================================================================= */
import type { ParsedShape, ParsedRun } from '../parser/slide-parser';

const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';

/** Every fill flavour DrawingML allows, so setting one clears the others —
    leaving a <a:noFill> next to a new <a:solidFill> makes the shape's
    appearance depend on which the renderer happens to read first. */
const FILL_TAGS = ['noFill', 'solidFill', 'gradFill', 'blipFill', 'pattFill', 'grpFill'];

/** Kinds whose record carries a fill the user can set. */
const FILL_KINDS: Record<string, boolean> = { shape: true, text: true };
/** Kinds that can carry an outline. */
const STROKE_KINDS: Record<string, boolean> = { shape: true, text: true, connector: true, imagefill: true };

function byLocal(parent: Element | null, name: string): Element | null {
  if (!parent) return null;
  for (let i = 0; i < parent.childNodes.length; i++) {
    const c = parent.childNodes[i] as Element;
    if (c && c.nodeType === 1 && c.localName === name) return c;
  }
  return null;
}

function srgb(doc: Document, hex: string): Element {
  const fill = doc.createElementNS(A_NS, 'a:solidFill');
  const clr = doc.createElementNS(A_NS, 'a:srgbClr');
  clr.setAttribute('val', hex.replace('#', '').toUpperCase());
  fill.appendChild(clr);
  return fill;
}

export function writeSolidFill(spPr: Element | null, hex: string): void {
  const doc = spPr?.ownerDocument;
  if (!spPr || !doc) return;
  FILL_TAGS.forEach((t) => {
    const n = byLocal(spPr, t);
    if (n) spPr.removeChild(n);
  });
  const ln = byLocal(spPr, 'ln');
  spPr.insertBefore(srgb(doc, hex), ln || null); // fill precedes ln
}

export function writeStroke(spPr: Element | null, hex: string, widthPx?: number | null): void {
  const doc = spPr?.ownerDocument;
  if (!spPr || !doc) return;

  let ln = byLocal(spPr, 'ln');
  if (!ln) {
    ln = doc.createElementNS(A_NS, 'a:ln');
    const effect = byLocal(spPr, 'effectLst');
    spPr.insertBefore(ln, effect || null); // ln precedes effectLst
  }
  if (widthPx != null) ln.setAttribute('w', `${Math.max(0, Math.round(widthPx * 9525))}`);

  FILL_TAGS.forEach((t) => {
    const n = byLocal(ln as Element, t);
    if (n) (ln as Element).removeChild(n);
  });
  ln.insertBefore(srgb(doc, hex), ln.firstChild);
}

/** Colour one run, creating its <a:rPr> if the run has none. */
export function writeRunColor(textNode: Element | null, hex: string): void {
  const rNode = textNode ? (textNode.parentNode as Element) : null;
  const doc = rNode?.ownerDocument;
  if (!rNode || !doc) return;

  let rPr = byLocal(rNode, 'rPr');
  if (!rPr) {
    rPr = doc.createElementNS(A_NS, 'a:rPr');
    rNode.insertBefore(rPr, rNode.firstChild); // rPr precedes <a:t>
  }
  FILL_TAGS.forEach((t) => {
    const n = byLocal(rPr as Element, t);
    if (n) (rPr as Element).removeChild(n);
  });
  const ln = byLocal(rPr, 'ln');
  rPr.insertBefore(srgb(doc, hex), ln ? ln.nextSibling : rPr.firstChild);
}

/* ---- record + XML together -------------------------------------------- */

export function setShapesFill(shapes: ParsedShape[], hex: string): void {
  shapes.forEach((s) => {
    if (!FILL_KINDS[s.kind]) return;
    s.fillColor = hex;
    // A solid fill replaces a gradient; leaving the CSS gradient on the record
    // would keep painting it over the new colour.
    s.fillGradientCss = null;
    if (s.srcNode) writeSolidFill(byLocal(s.srcNode as Element, 'spPr'), hex);
  });
}

export function setShapesStroke(shapes: ParsedShape[], hex: string, widthPx?: number | null): void {
  shapes.forEach((s) => {
    if (!STROKE_KINDS[s.kind]) return;
    s.strokeColor = hex;
    if (widthPx != null) s.strokeWidthPx = widthPx;
    if (s.srcNode) {
      writeStroke(
        byLocal(s.srcNode as Element, 'spPr'),
        hex,
        widthPx != null ? widthPx : ((s.strokeWidthPx as number) || 1),
      );
    }
  });
}

export function setShapesTextColor(shapes: ParsedShape[], hex: string): void {
  shapes.forEach((s) => {
    if (s.kind !== 'text' || !s.paragraphs) return;
    s.paragraphs.forEach((p: ParsedRun[]) => p.forEach((run) => {
      run.color = hex;
      if (run.nodeRef) writeRunColor(run.nodeRef, hex);
    }));
  });
}

export function setShapesFontFamily(shapes: ParsedShape[], font: string): void {
  shapes.forEach((s) => {
    if (s.kind !== 'text' || !s.paragraphs) return;
    s.paragraphs.forEach((p: ParsedRun[]) => p.forEach((run) => {
      run.fontFace = font;
      run.fontFamily = font;
    }));
  });
}

export function setShapesFontWeight(shapes: ParsedShape[], weight: number): void {
  shapes.forEach((s) => {
    if (s.kind !== 'text' || !s.paragraphs) return;
    s.paragraphs.forEach((p: ParsedRun[]) => p.forEach((run) => {
      run.bold = weight >= 700;
      run.fontWeight = weight;
    }));
  });
}

export function setShapesFontSize(shapes: ParsedShape[], size: number): void {
  shapes.forEach((s) => {
    if (s.kind !== 'text' || !s.paragraphs) return;
    s.paragraphs.forEach((p: ParsedRun[]) => p.forEach((run) => {
      run.fontSize = size;
    }));
  });
}

export function setShapesLineHeight(shapes: ParsedShape[], lh: number): void {
  shapes.forEach((s) => {
    if (s.kind !== 'text') return;
    s.lineHeight = lh;
  });
}

export function setShapesLetterSpacing(shapes: ParsedShape[], ls: number): void {
  shapes.forEach((s) => {
    if (s.kind !== 'text') return;
    s.letterSpacing = ls;
  });
}

export function setShapesTextAlign(shapes: ParsedShape[], align: string): void {
  shapes.forEach((s) => {
    if (s.kind !== 'text') return;
    s.textAlign = align as any;
  });
}

/* ---- z-order ----------------------------------------------------------- */

const SHAPE_TAGS: Record<string, boolean> = { sp: true, pic: true, graphicFrame: true, cxnSp: true, grpSp: true };

function moveNodeToEnd(node: Element): void {
  node.parentNode?.appendChild(node);
}

function moveNodeToFront(node: Element): void {
  const p = node.parentNode;
  if (!p) return;
  // Before the first SHAPE sibling, not the first child — spTree starts with
  // <p:nvGrpSpPr> and <p:grpSpPr>, and a shape inserted before those would be
  // schema-invalid.
  let first: Element | null = null;
  for (let i = 0; i < p.childNodes.length; i++) {
    const c = p.childNodes[i] as Element;
    if (c.nodeType === 1 && SHAPE_TAGS[c.localName]) { first = c; break; }
  }
  if (first && first !== node) p.insertBefore(node, first);
}

/**
 * Move the given shapes to the front or the back of the slide.
 *
 * Returns the reordered shape list. Document order is paint order for both the
 * records and the XML, so both have to move or the saved file would stack
 * differently from what the operator saw.
 */
export function reorderShapes(shapes: ParsedShape[], selectedIds: string[], toFront: boolean): ParsedShape[] {
  const idset = new Set(selectedIds);
  const picked = shapes.filter((s) => idset.has(s.id));
  const rest = shapes.filter((s) => !idset.has(s.id));

  (toFront ? picked : [...picked].reverse()).forEach((s) => {
    if (s.srcNode) (toFront ? moveNodeToEnd : moveNodeToFront)(s.srcNode as Element);
  });

  return toFront ? [...rest, ...picked] : [...picked, ...rest];
}

/* ---- deletion ---------------------------------------------------------- */

/**
 * Remove the selection from the slide, XML included.
 *
 * When the selection is a whole PowerPoint group, the <p:grpSp> goes as one
 * node rather than each child being unhooked, which keeps the document tidy
 * and is what an ungroup-then-delete would otherwise leave behind.
 */
export function deleteShapes(shapes: ParsedShape[], selectedIds: string[], groupNode: Element | null): ParsedShape[] {
  const idset = new Set(selectedIds);

  if (groupNode && groupNode.parentNode) {
    groupNode.parentNode.removeChild(groupNode);
  } else {
    shapes.forEach((s) => {
      if (!idset.has(s.id)) return;
      const node = s.srcNode as Element | null;
      if (node && node.parentNode) node.parentNode.removeChild(node);
    });
  }

  return shapes.filter((s) => !idset.has(s.id));
}
