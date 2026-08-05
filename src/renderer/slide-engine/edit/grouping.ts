/* =========================================================================
   Slide engine — grouping, ungrouping and the slide's layer stack
   -------------------------------------------------------------------------
   Two related things live here because they are the same question asked twice:
   which shapes move as one unit?

   Grouping is records-level, as in the reference editor: members share a
   `groupId` and no XML is restructured, so an export stays byte-faithful and
   the operation is fully reversible. It is an editing convenience for the
   session, not something written into the .pptx — PowerPoint's own <p:grpSp>
   groups already come in from the parser and are honoured alongside it.

   The layer stack is the same grouping seen from the side: a slide's top-level
   paint order, where a PowerPoint group is one entry rather than a scattering
   of children. Reordering there moves both the records and their XML siblings,
   because document order is paint order for both and a saved file that stacks
   differently from what the operator saw is a bug, not a rounding error.

   Ported from groupSelection/ungroupSelection in the reference editor's
   edit/modifier-shapes.js; the layer stack is new.
   ========================================================================= */
import type { ParsedShape } from '../parser/slide-parser';
import { ancestorAffineEmu, type SelectionState } from './geometry';

/** Distinguishes a records-level group from a parsed <p:grpSp> (`grp_*`). */
let recordsGroupSeq = 0;

/**
 * Make the current multi-selection move, restyle and reorder as one unit.
 *
 * Returns the selection to adopt, or null when there is nothing to group —
 * fewer than two editable shapes.
 */
export function groupShapes(shapes: ParsedShape[], ids: string[]): SelectionState | null {
  const idset = new Set(ids);
  const members = shapes.filter((s) => idset.has(s.id) && s.editable !== false);
  if (members.length < 2) return null;

  const groupId = `bspgrp_${Date.now()}_${++recordsGroupSeq}`;
  members.forEach((s) => {
    s.groupId = groupId;
    /* Deliberately dropped even for a shape that came out of a <p:grpSp>: this
       record is now part of a different unit, and geometry commits read the
       real XML ancestors from the node itself rather than from here. */
    s.groupNode = null;
  });

  return { ids: members.map((s) => s.id), groupId, groupNode: null };
}

function byLocal(parent: Element | null, name: string): Element | null {
  if (!parent) return null;
  for (let i = 0; i < parent.childNodes.length; i++) {
    const child = parent.childNodes[i];
    if (child.nodeType === 1 && (child as Element).localName === name) {
      return child as Element;
    }
  }
  return null;
}

/**
 * Break every group the selection touches (both records-level `groupId`s and
 * DrawingML `<p:grpSp>` XML groups), so each piece becomes independently
 * selectable, movable and re-colourable as its own individual layer.
 *
 * Returns how many shapes were released, which is what the caller reports.
 */
export function ungroupShapes(shapes: ParsedShape[], ids: string[]): number {
  const idset = new Set(ids);
  const selectedShapes = shapes.filter((s) => idset.has(s.id));
  if (selectedShapes.length === 0) return 0;

  // 1. Collect records-level groupIds
  const recordGroupIds = new Set(
    selectedShapes.map((s) => s.groupId).filter(Boolean) as string[],
  );

  // 2. Collect XML <p:grpSp> container nodes touching the selection
  const xmlGroupNodes = new Set<Element>();
  selectedShapes.forEach((s) => {
    const srcNode = (s.srcNode as Element | null) || null;
    if (srcNode) {
      let cursor: Element | null = srcNode.parentNode as Element | null;
      while (cursor && cursor.nodeType === 1 && cursor.localName !== 'spTree') {
        if (cursor.localName === 'grpSp') {
          xmlGroupNodes.add(cursor);
        }
        cursor = cursor.parentNode as Element | null;
      }
    }
  });

  if (recordGroupIds.size === 0 && xmlGroupNodes.size === 0) return 0;

  let released = 0;

  // Release records-level groups
  if (recordGroupIds.size > 0) {
    shapes.forEach((s) => {
      if (s.groupId && recordGroupIds.has(String(s.groupId))) {
        s.groupId = null;
        s.groupNode = null;
        released++;
      }
    });
  }

  // Release XML <p:grpSp> groups
  xmlGroupNodes.forEach((grpNode) => {
    const spTree = grpNode.parentNode;
    if (!spTree) return;

    // All shapes in the slide that are inside this grpNode
    const memberShapes = shapes.filter((s) => {
      const srcNode = (s.srcNode as Element | null) || null;
      if (!srcNode) return false;
      let p: Node | null = srcNode.parentNode;
      while (p) {
        if (p === grpNode) return true;
        p = p.parentNode;
      }
      return false;
    });

    memberShapes.forEach((s) => {
      const srcNode = (s.srcNode as Element | null) || null;
      if (!srcNode) return;

      // Compute absolute transform before un-parenting
      const affine = ancestorAffineEmu(srcNode);

      const spPr = byLocal(srcNode, 'spPr') || byLocal(srcNode, 'grpSpPr');
      if (spPr) {
        const xfrm = byLocal(spPr, 'xfrm');
        if (xfrm) {
          const off = byLocal(xfrm, 'off');
          const ext = byLocal(xfrm, 'ext');
          if (off && ext) {
            const curOx = +(off.getAttribute('x') || 0);
            const curOy = +(off.getAttribute('y') || 0);
            const curCx = +(ext.getAttribute('cx') || 0);
            const curCy = +(ext.getAttribute('cy') || 0);

            const absOx = Math.round(curOx * affine.sx + affine.tx);
            const absOy = Math.round(curOy * affine.sy + affine.ty);
            const absCx = Math.round(curCx * affine.sx);
            const absCy = Math.round(curCy * affine.sy);

            off.setAttribute('x', `${absOx}`);
            off.setAttribute('y', `${absOy}`);
            ext.setAttribute('cx', `${absCx}`);
            ext.setAttribute('cy', `${absCy}`);
          }
        }
      }

      // Move node directly into spTree before grpNode
      spTree.insertBefore(srcNode, grpNode);

      s.groupNode = null;
      s.groupId = null;
      released++;
    });

    // Remove empty grpNode from spTree
    try {
      spTree.removeChild(grpNode);
    } catch {
      /* Safe if already unparented */
    }
  });

  return released;
}

/** Is any of this selection part of a group, so Ungroup would do something? */
export function selectionHasGroup(members: ParsedShape[]): boolean {
  return members.some((s) => {
    if (s.groupId) return true;
    const srcNode = (s.srcNode as Element | null) || null;
    if (!srcNode) return false;
    const top = topLevelNodeOf(srcNode);
    return top !== srcNode || top.localName === 'grpSp' || (srcNode.parentNode && (srcNode.parentNode as Element).localName === 'grpSp');
  });
}

/* ---- the layer stack --------------------------------------------------- */

export interface LayerUnit {
  /** Stable across re-renders for a given slide: the first member's id. */
  key: string;
  ids: string[];
  /** The spTree children this unit owns, in document order. */
  nodes: Element[];
  label: string;
  /** 'group' for a group, else the single shape's kind. */
  kind: string;
}

/**
 * The node that actually sits in the slide's <p:spTree> — a shape inside one or
 * more <p:grpSp> is represented there by its outermost group, which is exactly
 * what PowerPoint's own layer list shows.
 */
function topLevelNodeOf(node: Element): Element {
  let cursor = node;
  for (;;) {
    const parent = cursor.parentNode as Element | null;
    if (!parent || parent.nodeType !== 1 || parent.localName === 'spTree') return cursor;
    cursor = parent;
  }
}

function labelFor(shape: ParsedShape): string {
  const text = (shape.paragraphs || [])
    .map((p) => p.map((r) => r.text).join(''))
    .join(' ')
    // Blank paragraphs come through as zero-width spaces, which would
    // otherwise render as a label of invisible characters.
    .replace(/[\s\u200B]+/g, ' ')
    .trim();
  if (text) return text.length > 34 ? `${text.slice(0, 33)}…` : text;
  const name = String(shape.name || '').trim();
  if (name) return name;
  return String(shape.kind);
}

/**
 * The slide's editable stack, bottom entry first — the same order the records
 * are painted in.
 *
 * Layout and master decoration is left out: it is not selectable on the canvas
 * either, and listing rows that cannot be moved or deleted is the kind of
 * control that silently does nothing.
 */
export function layerUnits(shapes: ParsedShape[]): LayerUnit[] {
  const units: LayerUnit[] = [];
  /* Two ways shapes merge into one entry: a shared records-level groupId, or a
     shared outermost <p:grpSp>. Both are keyed here so either kind of group
     lands in a single row at the position of its lowest member. */
  const byGroupId = new Map<string, LayerUnit>();
  const byNode = new Map<Element, LayerUnit>();

  shapes.forEach((shape) => {
    if (shape.editable === false) return;
    const srcNode = (shape.srcNode as Element | null) || null;
    if (!srcNode) return;

    const top = topLevelNodeOf(srcNode);
    const groupId = shape.groupId ? String(shape.groupId) : null;
    const existing = (groupId && byGroupId.get(groupId)) || byNode.get(top) || null;

    if (existing) {
      existing.ids.push(shape.id);
      if (!existing.nodes.includes(top)) existing.nodes.push(top);
      existing.kind = 'group';
      existing.label = `Group · ${existing.ids.length} shapes`;
      if (groupId) byGroupId.set(groupId, existing);
      byNode.set(top, existing);
      return;
    }

    const unit: LayerUnit = {
      key: shape.id,
      ids: [shape.id],
      nodes: [top],
      // A <p:grpSp> with one child is still a group as far as the file goes.
      kind: top.localName === 'grpSp' ? 'group' : String(shape.kind),
      label: top.localName === 'grpSp' ? 'Group' : labelFor(shape),
    };
    units.push(unit);
    if (groupId) byGroupId.set(groupId, unit);
    byNode.set(top, unit);
  });

  return units;
}

/**
 * Move one layer entry to another slot in the stack, records and XML together.
 *
 * Indices are into the `units` array, bottom entry first. Returns the reordered
 * shape list; the XML nodes are moved in place, so a save round-trips the new
 * stacking.
 */
export function moveLayerUnit(
  shapes: ParsedShape[],
  units: LayerUnit[],
  fromIndex: number,
  toIndex: number,
): ParsedShape[] {
  const moved = units[fromIndex];
  if (!moved || fromIndex === toIndex) return shapes;

  const rest = units.filter((_, i) => i !== fromIndex);
  const target = Math.max(0, Math.min(rest.length, toIndex));
  const anchor = target < rest.length ? rest[target] : null;

  /* Records first. The anchor is located in the list with the moved shapes
     already taken out, so the insertion point is valid whichever direction the
     entry travelled. */
  const movedIds = new Set(moved.ids);
  const kept = shapes.filter((s) => !movedIds.has(s.id));
  const movedShapes = shapes.filter((s) => movedIds.has(s.id));
  let at = anchor ? kept.findIndex((s) => anchor.ids.includes(s.id)) : -1;
  if (at < 0) at = kept.length;
  const next = [...kept.slice(0, at), ...movedShapes, ...kept.slice(at)];

  /* Then the XML. Every unit's nodes are children of the same <p:spTree>, so
     this is a sibling reorder — no reparenting, nothing to invalidate. The
     same-parent check is a guard, not an expectation. */
  const anchorNode = anchor ? anchor.nodes[0] : null;
  moved.nodes.forEach((node) => {
    const parent = node.parentNode;
    if (!parent) return;
    if (anchorNode && anchorNode.parentNode === parent) parent.insertBefore(node, anchorNode);
    else parent.appendChild(node);
  });

  return next;
}
