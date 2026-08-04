/* =========================================================================
   Slide engine — placeholder identity, geometry & style inheritance
   -------------------------------------------------------------------------
   PPTX shapes inherit position, run style, paragraph layout and text-body
   layout from their slide layout and master via the placeholder system
   (<p:ph type=".." idx="..">). This module:
     - reads a shape/picture/graphicFrame's placeholder identity, and
     - builds the type/idx-keyed lookup maps from a layout or master doc, then
     - resolves a concrete shape against those maps (with type-only fallback).

   Maps are stored on a slide's styleContext (see parser/presentation.ts).

   Ported from the reference editor's parser/placeholders.js.
   ========================================================================= */
import { getElementByLocalName } from '../core/units';
import {
  getDefaultRunStyle,
  getParagraphDefaultRunStyle,
  parseParagraphLayout,
  parseTextBodyLayout,
  getLvlNode,
  type RunStyle,
  type ParagraphLayout,
  type TextBodyLayout,
} from './shape-style';
import { state } from '../state';

export interface PlaceholderInfo {
  type: string;
  idx: string;
}

export interface PlaceholderGeometry {
  x: number;
  y: number;
  cx: number;
  cy: number;
}

export interface StyleContext {
  masterDoc?: Document | null;
  layoutDoc?: Document | null;
  defaultRunStyle?: RunStyle | null;
  titleRunStyle?: RunStyle | null;
  otherRunStyle?: RunStyle | null;
  placeholderStyleMap?: Map<string, RunStyle> | null;
  placeholderGeometryMap?: Map<string, PlaceholderGeometry> | null;
  placeholderParagraphLayoutMap?: Map<string, ParagraphLayout> | null;
  placeholderTextBodyLayoutMap?: Map<string, TextBodyLayout> | null;
  placeholderLstStyleMaps?: { layout?: Map<string, Element> | null; master?: Map<string, Element> | null } | null;
  [key: string]: unknown;
}

export function getPlaceholderInfoFromNvPr(nvPr: Element | null): PlaceholderInfo {
  const ph = getElementByLocalName(nvPr, 'ph');
  if (!ph) {
    // Not a placeholder shape at all (kept empty so it renders as a normal shape).
    return { type: '', idx: '' };
  }

  /* Per ECMA-376 the <p:ph> `type` defaults to "body" when omitted. Content
     placeholders are written as <p:ph idx="1"/> with no type; without this
     default they fail to match the master/layout "body" placeholder and get
     dropped (zero geometry). idx links slide->layout; type links to the master. */
  const typeAttr = ph.getAttribute('type');
  const type = (typeAttr && typeAttr.trim()) ? typeAttr.toLowerCase() : 'body';
  const idx = ph.getAttribute('idx') || '';
  return {
    type,
    idx: String(idx || ''),
  };
}

export function getShapePlaceholderInfo(spNode: Element | null): PlaceholderInfo {
  const nvSpPr = getElementByLocalName(spNode, 'nvSpPr');
  const nvPr = getElementByLocalName(nvSpPr, 'nvPr');
  return getPlaceholderInfoFromNvPr(nvPr);
}

export function getPicturePlaceholderInfo(picNode: Element | null): PlaceholderInfo {
  const nvPicPr = getElementByLocalName(picNode, 'nvPicPr');
  const nvPr = getElementByLocalName(nvPicPr, 'nvPr');
  return getPlaceholderInfoFromNvPr(nvPr);
}

export function getGraphicFramePlaceholderInfo(frameNode: Element | null): PlaceholderInfo {
  const nvGraphicFramePr = getElementByLocalName(frameNode, 'nvGraphicFramePr');
  const nvPr = getElementByLocalName(nvGraphicFramePr, 'nvPr');
  return getPlaceholderInfoFromNvPr(nvPr);
}

export function getShapePlaceholderType(spNode: Element | null): string {
  return getShapePlaceholderInfo(spNode).type;
}

export function extractPlaceholderStyleMapFromLayoutDoc(layoutDoc: Document | null, styleContext: StyleContext | null): Map<string, RunStyle> {
  const map = new Map<string, RunStyle>();
  if (!layoutDoc) return map;

  const baseStyleForType = (type: string): RunStyle => {
    const t = String(type || '').toLowerCase();
    if (t === 'title' || t === 'ctrtitle' || t === 'subtitle') {
      return styleContext?.titleRunStyle || styleContext?.defaultRunStyle || getDefaultRunStyle();
    }
    if (t === 'obj' || t === 'body' || t === 'sldnum' || t === 'dt' || t === 'ftr') {
      return styleContext?.defaultRunStyle || getDefaultRunStyle();
    }
    return styleContext?.otherRunStyle || styleContext?.defaultRunStyle || getDefaultRunStyle();
  };

  const shapeNodes = layoutDoc.getElementsByTagNameNS('*', 'sp');
  for (let i = 0; i < shapeNodes.length; i++) {
    const sp = shapeNodes[i];
    const info = getShapePlaceholderInfo(sp);
    const type = info.type;
    const key = `${type}:${info.idx}`;
    const fallbackKey = `${type}:`;
    if (!type || (map.has(key) && map.has(fallbackKey))) continue;

    const txBody = getElementByLocalName(sp, 'txBody');
    if (!txBody) continue;
    const paragraphs = txBody.getElementsByTagNameNS('*', 'p');
    if (!paragraphs || paragraphs.length === 0) continue;

    const style = getParagraphDefaultRunStyle(paragraphs[0], txBody, baseStyleForType(type));
    if (!map.has(key)) map.set(key, style);
    if (!map.has(fallbackKey)) map.set(fallbackKey, style);
  }

  return map;
}

export function extractPlaceholderGeometryMapFromDoc(doc: Document | null): Map<string, PlaceholderGeometry> {
  const map = new Map<string, PlaceholderGeometry>();
  if (!doc) return map;

  const putGeom = (info: PlaceholderInfo, xfrmContainer: Element | null) => {
    const type = info.type;
    const key = `${type}:${info.idx}`;
    const fallbackKey = `${type}:`;

    const xfrm = getElementByLocalName(xfrmContainer, 'xfrm');
    const off = getElementByLocalName(xfrm, 'off');
    const ext = getElementByLocalName(xfrm, 'ext');

    const x = off ? parseInt(off.getAttribute('x') || '0', 10) : null;
    const y = off ? parseInt(off.getAttribute('y') || '0', 10) : null;
    const cx = ext ? parseInt(ext.getAttribute('cx') || '0', 10) : null;
    const cy = ext ? parseInt(ext.getAttribute('cy') || '0', 10) : null;

    if (!Number.isFinite(x as number) || !Number.isFinite(y as number) || !Number.isFinite(cx as number) || !Number.isFinite(cy as number)) {
      return;
    }

    const geom = { x: x as number, y: y as number, cx: cx as number, cy: cy as number };
    if (!map.has(key)) map.set(key, geom);
    if (!map.has(fallbackKey)) map.set(fallbackKey, geom);
  };

  const shapeNodes = doc.getElementsByTagNameNS('*', 'sp');
  for (let i = 0; i < shapeNodes.length; i++) {
    const sp = shapeNodes[i];
    const info = getShapePlaceholderInfo(sp);
    const spPr = getElementByLocalName(sp, 'spPr');
    putGeom(info, spPr || sp);
  }

  const picNodes = doc.getElementsByTagNameNS('*', 'pic');
  for (let i = 0; i < picNodes.length; i++) {
    const pic = picNodes[i];
    const info = getPicturePlaceholderInfo(pic);
    const spPr = getElementByLocalName(pic, 'spPr');
    putGeom(info, spPr || pic);
  }

  const frameNodes = doc.getElementsByTagNameNS('*', 'graphicFrame');
  for (let i = 0; i < frameNodes.length; i++) {
    const frame = frameNodes[i];
    const info = getGraphicFramePlaceholderInfo(frame);
    putGeom(info, frame);
  }

  return map;
}

/**
 * baseMap (optional): a lower-priority map (e.g. master) to inherit from, so a
 * layout placeholder with an empty bodyPr keeps the master's values instead of
 * clobbering them with defaults. This makes inheritance slide<-layout<-master.
 */
export function extractPlaceholderParagraphLayoutMapFromDoc(doc: Document | null, baseMap: Map<string, ParagraphLayout> | null = null): Map<string, ParagraphLayout> {
  const map = new Map<string, ParagraphLayout>();
  if (!doc) return map;

  const shapeNodes = doc.getElementsByTagNameNS('*', 'sp');
  for (let i = 0; i < shapeNodes.length; i++) {
    const sp = shapeNodes[i];
    const info = getShapePlaceholderInfo(sp);
    const type = info.type;
    if (!type) continue;

    const key = `${type}:${info.idx}`;
    const fallbackKey = `${type}:`;
    const txBody = getElementByLocalName(sp, 'txBody');
    if (!txBody) continue;

    const paragraphs = txBody.getElementsByTagNameNS('*', 'p');
    if (!paragraphs || paragraphs.length === 0) continue;

    const inherited = baseMap ? (baseMap.get(key) || baseMap.get(fallbackKey) || null) : null;
    const parsed = parseParagraphLayout(paragraphs[0], txBody, inherited);
    if (!map.has(key)) map.set(key, parsed);
    if (!map.has(fallbackKey)) map.set(fallbackKey, parsed);
  }

  return map;
}

export function extractPlaceholderTextBodyLayoutMapFromDoc(doc: Document | null, baseMap: Map<string, TextBodyLayout> | null = null): Map<string, TextBodyLayout> {
  const map = new Map<string, TextBodyLayout>();
  if (!doc) return map;

  const shapeNodes = doc.getElementsByTagNameNS('*', 'sp');
  for (let i = 0; i < shapeNodes.length; i++) {
    const sp = shapeNodes[i];
    const info = getShapePlaceholderInfo(sp);
    const type = info.type;
    if (!type) continue;

    const key = `${type}:${info.idx}`;
    const fallbackKey = `${type}:`;
    const txBody = getElementByLocalName(sp, 'txBody');
    if (!txBody) continue;

    const inherited = baseMap ? (baseMap.get(key) || baseMap.get(fallbackKey) || null) : null;
    const parsed = parseTextBodyLayout(txBody, inherited);
    if (!map.has(key)) map.set(key, parsed);
    if (!map.has(fallbackKey)) map.set(fallbackKey, parsed);
  }

  return map;
}

/**
 * key -> the placeholder shape's <a:lstStyle> element, for per-level paragraph
 * property chains.
 */
export function extractPlaceholderListStyleMapFromDoc(doc: Document | null): Map<string, Element> {
  const map = new Map<string, Element>();
  if (!doc) return map;

  const shapeNodes = doc.getElementsByTagNameNS('*', 'sp');
  for (let i = 0; i < shapeNodes.length; i++) {
    const sp = shapeNodes[i];
    const info = getShapePlaceholderInfo(sp);
    if (!info.type) continue;

    const txBody = getElementByLocalName(sp, 'txBody');
    const lstStyle = getElementByLocalName(txBody, 'lstStyle');
    if (!lstStyle) continue;

    const key = `${info.type}:${info.idx}`;
    const fallbackKey = `${info.type}:`;
    if (!map.has(key)) map.set(key, lstStyle);
    if (!map.has(fallbackKey)) map.set(fallbackKey, lstStyle);
  }

  return map;
}

/**
 * Master <p:txStyles> level node for a placeholder type. title/ctrTitle use
 * titleStyle; body-like types bodyStyle; the rest otherStyle.
 */
export function getTxStyleLevelNode(masterDoc: Document | null, phType: string | null, lvl: number): Element | null {
  if (!masterDoc) return null;
  const txStyles = masterDoc.getElementsByTagNameNS('*', 'txStyles')[0];
  if (!txStyles) return null;

  const t = String(phType || '').toLowerCase();
  let styleNode: Element | null;
  if (t === 'title' || t === 'ctrtitle') {
    styleNode = getElementByLocalName(txStyles, 'titleStyle');
  } else if (t === 'body' || t === 'obj' || t === 'subtitle') {
    styleNode = getElementByLocalName(txStyles, 'bodyStyle');
  } else {
    styleNode = getElementByLocalName(txStyles, 'otherStyle');
  }
  return getLvlNode(styleNode, lvl);
}

/**
 * The pPr-node chain (nearest first) for a paragraph at `lvl` inside a shape
 * with `placeholderInfo`: layout ph lstStyle -> master ph lstStyle -> master
 * txStyles; plain text boxes use presentation.xml defaultTextStyle.
 */
export function getPlaceholderLevelChain(styleContext: StyleContext | null, placeholderInfo: PlaceholderInfo | null, lvl: number): Element[] {
  const t = String(placeholderInfo?.type || '').toLowerCase();
  const idx = String(placeholderInfo?.idx || '');
  const key = `${t}:${idx}`;
  const fallbackKey = `${t}:`;
  const chain: (Element | null | undefined)[] = [];

  if (t) {
    const maps = styleContext?.placeholderLstStyleMaps;
    const layoutLst = maps?.layout ? (maps.layout.get(key) || maps.layout.get(fallbackKey)) : null;
    const masterLst = maps?.master ? (maps.master.get(key) || maps.master.get(fallbackKey)) : null;
    if (layoutLst) chain.push(getLvlNode(layoutLst, lvl));
    if (masterLst) chain.push(getLvlNode(masterLst, lvl));
    chain.push(getTxStyleLevelNode(styleContext?.masterDoc ?? null, t, lvl));
  } else {
    const defNodes = state.presentationDefaultTextStyleNodes;
    if (defNodes && defNodes[lvl]) chain.push(defNodes[lvl]);
  }

  return chain.filter(Boolean) as Element[];
}

export function getPlaceholderGeometry(styleContext: StyleContext | null, placeholderInfo: PlaceholderInfo | null): PlaceholderGeometry | null {
  const t = String(placeholderInfo?.type || '').toLowerCase();
  const idx = String(placeholderInfo?.idx || '');
  const key = `${t}:${idx}`;
  const fallbackKey = `${t}:`;

  const map = styleContext?.placeholderGeometryMap;
  if (!map) return null;
  return map.get(key) || map.get(fallbackKey) || null;
}

export function getPlaceholderParagraphLayout(styleContext: StyleContext | null, placeholderInfo: PlaceholderInfo | null): ParagraphLayout | null {
  const t = String(placeholderInfo?.type || '').toLowerCase();
  const idx = String(placeholderInfo?.idx || '');
  const key = `${t}:${idx}`;
  const fallbackKey = `${t}:`;

  const map = styleContext?.placeholderParagraphLayoutMap;
  if (!map) return null;
  return map.get(key) || map.get(fallbackKey) || null;
}

export function getPlaceholderTextBodyLayout(styleContext: StyleContext | null, placeholderInfo: PlaceholderInfo | null): TextBodyLayout | null {
  const t = String(placeholderInfo?.type || '').toLowerCase();
  const idx = String(placeholderInfo?.idx || '');
  const key = `${t}:${idx}`;
  const fallbackKey = `${t}:`;

  const map = styleContext?.placeholderTextBodyLayoutMap;
  if (!map) return null;
  return map.get(key) || map.get(fallbackKey) || null;
}

export function selectBaseStyleForPlaceholder(styleContext: StyleContext | null, placeholderInfo: PlaceholderInfo | null): RunStyle {
  const t = String(placeholderInfo?.type || '').toLowerCase();
  const idx = String(placeholderInfo?.idx || '');

  if (styleContext?.placeholderStyleMap) {
    const keyed = styleContext.placeholderStyleMap.get(`${t}:${idx}`);
    if (keyed) return keyed;

    const byType = styleContext.placeholderStyleMap.get(`${t}:`);
    if (byType) return byType;
  }

  if (t === 'title' || t === 'ctrtitle' || t === 'subtitle') {
    return styleContext?.titleRunStyle || styleContext?.defaultRunStyle || getDefaultRunStyle();
  }
  if (t === 'obj' || t === 'body' || t === 'sldnum' || t === 'dt' || t === 'ftr') {
    return styleContext?.defaultRunStyle || getDefaultRunStyle();
  }
  return styleContext?.otherRunStyle || styleContext?.defaultRunStyle || getDefaultRunStyle();
}
