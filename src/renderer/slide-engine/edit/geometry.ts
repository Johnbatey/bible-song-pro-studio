/* =========================================================================
   Slide engine — moving and resizing an imported slide's shapes
   -------------------------------------------------------------------------
   Records carry percent geometry; PowerPoint stores EMU in each shape's
   <a:xfrm>. Committing an edit means writing the record's absolute position
   back into that element — and doing it correctly for shapes that live inside
   one or more <p:grpSp>, whose coordinates are in their group's child space,
   not the slide's.

   Ported from the geometry half of the reference editor's
   edit/modifier-shapes.js. The reference reads the document off its global
   state; here it comes from the node's own ownerDocument, which is the same
   document and one less thing to keep in sync.
   ========================================================================= */
import { state } from '../state';
import type { ParsedShape } from '../parser/slide-parser';

const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';

export interface BBox { x: number; y: number; w: number; h: number }

function byLocal(parent: Element | null, name: string): Element | null {
  if (!parent) return null;
  for (let i = 0; i < parent.childNodes.length; i++) {
    const c = parent.childNodes[i] as Element;
    if (c && c.nodeType === 1 && c.localName === name) return c;
  }
  return null;
}

export function selectionBBox(members: ParsedShape[]): BBox {
  let l = Infinity;
  let t = Infinity;
  let r = -Infinity;
  let b = -Infinity;
  members.forEach((s) => {
    l = Math.min(l, s.left);
    t = Math.min(t, s.top);
    r = Math.max(r, s.left + s.width);
    b = Math.max(b, s.top + s.height);
  });
  return { x: l, y: t, w: Math.max(0.01, r - l), h: Math.max(0.01, b - t) };
}

/** The shape ids that form one selection unit: the whole group if the shape
    belongs to one, else just itself. PowerPoint's first click selects the
    group; a second click drills in. */
export function unitIdsFor(shape: ParsedShape, shapes: ParsedShape[]): string[] {
  if (shape.groupId) {
    return shapes.filter((s) => s.groupId === shape.groupId).map((s) => s.id);
  }
  return [shape.id];
}

function xfrmContainerFor(node: Element | null): Element | null {
  if (!node) return null;
  if (node.localName === 'graphicFrame') return node;
  if (node.localName === 'grpSp') return byLocal(node, 'grpSpPr');
  return byLocal(node, 'spPr');
}

interface XfrmParts { xfrm: Element; off: Element; ext: Element }

/**
 * The node's <a:xfrm>/<a:off>/<a:ext>, created if absent.
 *
 * `seedPct` matters for placeholder-inherited shapes: those have no xfrm of
 * their own (they take the layout's), so a freshly created one is empty and
 * would write a shape to 0,0 at zero size. Seeding it with the record's
 * current geometry makes the first drag start from where the shape actually is.
 */
export function ensureXfrm(node: Element | null, seedPct: ParsedShape | null): XfrmParts | null {
  const holder = xfrmContainerFor(node);
  if (!holder) return null;
  const doc = node!.ownerDocument;

  let xfrm = byLocal(holder, 'xfrm');
  if (!xfrm && doc) {
    xfrm = doc.createElementNS(A_NS, 'a:xfrm');
    holder.insertBefore(xfrm, holder.firstChild); // schema: xfrm first
  }
  if (!xfrm) return null;

  let off = byLocal(xfrm, 'off');
  let ext = byLocal(xfrm, 'ext');
  if (!off && doc) {
    off = doc.createElementNS(A_NS, 'a:off');
    xfrm.insertBefore(off, xfrm.firstChild);
  }
  if (!ext && doc) {
    ext = doc.createElementNS(A_NS, 'a:ext');
    xfrm.insertBefore(ext, off ? off.nextSibling : null);
  }
  if (!off || !ext) return null;

  if (seedPct && !off.getAttribute('x')) {
    const emu = state.pptxSlideSizeEmu;
    off.setAttribute('x', `${Math.round((seedPct.left / 100) * emu.cx)}`);
    off.setAttribute('y', `${Math.round((seedPct.top / 100) * emu.cy)}`);
    ext.setAttribute('cx', `${Math.round((seedPct.width / 100) * emu.cx)}`);
    ext.setAttribute('cy', `${Math.round((seedPct.height / 100) * emu.cy)}`);
  }

  return { xfrm, off, ext };
}

/** Affine map from the drag-start bbox to the current one, applied in EMU. */
export function mapXfrmThroughBBox(nodes: XfrmParts[], origBB: BBox, newBB: BBox): void {
  const emu = state.pptxSlideSizeEmu;
  const kx = newBB.w / origBB.w;
  const ky = newBB.h / origBB.h;
  const origXEmu = (origBB.x / 100) * emu.cx;
  const origYEmu = (origBB.y / 100) * emu.cy;
  const newXEmu = (newBB.x / 100) * emu.cx;
  const newYEmu = (newBB.y / 100) * emu.cy;

  nodes.forEach(({ off, ext }) => {
    const x = parseInt(off.getAttribute('x') || '0', 10);
    const y = parseInt(off.getAttribute('y') || '0', 10);
    const cx = parseInt(ext.getAttribute('cx') || '0', 10);
    const cy = parseInt(ext.getAttribute('cy') || '0', 10);
    off.setAttribute('x', `${Math.round(newXEmu + (x - origXEmu) * kx)}`);
    off.setAttribute('y', `${Math.round(newYEmu + (y - origYEmu) * ky)}`);
    ext.setAttribute('cx', `${Math.round(cx * kx)}`);
    ext.setAttribute('cy', `${Math.round(cy * ky)}`);
  });
}

/**
 * Cumulative affine (EMU) mapping a shape node's OWN coordinate space to
 * absolute slide space, composed through every ancestor <p:grpSp>.
 *
 * Each group maps child to parent as `parent = child*scale + (off - chOff*scale)`,
 * so `abs = local*S + T` with S the product of the scales and T composed
 * outward. Inverting it lets a shape's own off/ext be written from its absolute
 * geometry even when it sits inside several groups. Rotation is not composed.
 */
export function ancestorAffineEmu(node: Element): { sx: number; sy: number; tx: number; ty: number } {
  let sx = 1;
  let sy = 1;
  let tx = 0;
  let ty = 0;
  let cursor: Node | null = node;

  while (cursor && cursor.parentNode) {
    const parent = cursor.parentNode as Element;
    if (parent.localName === 'grpSp') {
      const gx = byLocal(byLocal(parent, 'grpSpPr'), 'xfrm');
      const off = byLocal(gx, 'off');
      const ext = byLocal(gx, 'ext');
      const chOff = byLocal(gx, 'chOff');
      const chExt = byLocal(gx, 'chExt');
      if (off && ext && chOff && chExt) {
        const ox = +(off.getAttribute('x') || 0);
        const oy = +(off.getAttribute('y') || 0);
        const ecx = +(ext.getAttribute('cx') || 0);
        const ecy = +(ext.getAttribute('cy') || 0);
        const cox = +(chOff.getAttribute('x') || 0);
        const coy = +(chOff.getAttribute('y') || 0);
        const ccx = +(chExt.getAttribute('cx') || 0);
        const ccy = +(chExt.getAttribute('cy') || 0);
        const gsx = ccx ? ecx / ccx : 1;
        const gsy = ccy ? ecy / ccy : 1;
        const gtx = ox - cox * gsx;
        const gty = oy - coy * gsy;
        // Compose this group outward: X' = X*gs + gt.
        sx *= gsx;
        sy *= gsy;
        tx = tx * gsx + gtx;
        ty = ty * gsy + gty;
      }
    }
    cursor = parent;
  }

  return { sx, sy, tx, ty };
}

/** Write one shape's absolute (record %) geometry into its OWN <a:xfrm>,
    inverting the ancestor-group affine so grouped children land correctly. */
export function writeShapeAbsoluteGeometry(shape: ParsedShape): void {
  const srcNode = shape.srcNode as Element | null;
  if (!srcNode) return;
  const g = ensureXfrm(srcNode, shape);
  if (!g) return;

  const emu = state.pptxSlideSizeEmu;
  const absX = (shape.left / 100) * emu.cx;
  const absY = (shape.top / 100) * emu.cy;
  const absW = (shape.width / 100) * emu.cx;
  const absH = (shape.height / 100) * emu.cy;
  const a = ancestorAffineEmu(srcNode);

  g.off.setAttribute('x', `${Math.round((absX - a.tx) / a.sx)}`);
  g.off.setAttribute('y', `${Math.round((absY - a.ty) / a.sy)}`);
  g.ext.setAttribute('cx', `${Math.round(absW / a.sx)}`);
  g.ext.setAttribute('cy', `${Math.round(absH / a.sy)}`);
}

export interface SelectionState {
  ids: string[];
  groupId: string | null;
  groupNode: Element | null;
}

/**
 * Push committed geometry into the slide XML.
 *
 * When the selection is exactly one real PowerPoint group, remap the group's
 * own <a:xfrm> and the children follow for free — which also keeps the file
 * closer to what PowerPoint would have written. Otherwise write each member's
 * own xfrm through the inverse of its ancestor-group affine, which is correct
 * for drilled-into children, multi-selections and records-level groups alike.
 */
export function commitGeometryToXml(
  selection: SelectionState | null,
  members: ParsedShape[],
  origBB: BBox,
): void {
  if (!selection || members.length === 0) return;

  if (selection.groupNode && selection.ids.length === members.length) {
    const g = ensureXfrm(selection.groupNode, null);
    if (g) mapXfrmThroughBBox([g], origBB, selectionBBox(members));
    return;
  }

  members.forEach((s) => writeShapeAbsoluteGeometry(s));
}
