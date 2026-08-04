/* =========================================================================
   Slide engine — theme-aware colour, fill, line & effect parsing
   -------------------------------------------------------------------------
   Builds on core/units.ts. Resolves DrawingML colour references (schemeClr via
   the active theme, srgbClr, scrgbClr, sysClr, prstClr) and higher-level visual
   properties: solid/gradient fills, blip (picture) fills, line strokes, and
   effect lists (shadows, glow, reflection, soft edge) into CSS.

   Theme lookups read state.pptxThemeColorMap / pptxThemeAliasMap, which
   parser/theme.ts populates per presentation.

   Ported from the reference editor's core/color.js.
   ========================================================================= */
import {
  getElementByLocalName,
  getXmlAttrByLocalName,
  toHexColor,
  applyColorTransforms,
  parseScRgbColorNode,
  resolvePresetColorValue,
  parseAlphaFromColorNode,
  toRgbaColor,
  emuToPx,
} from './units';
import { state } from '../state';

export interface FillPaint {
  color: string | null;
  gradientCss: string | null;
  explicit: boolean;
}

export interface LineStyle {
  strokeColor: string | null;
  strokeWidthPx: number;
  explicit: boolean;
  needsThemeColor: boolean;
  headArrow: string | null;
  tailArrow: string | null;
  dash: string | null;
}

export interface BlipFill {
  relId: string;
  mode: 'tile' | 'stretch' | 'cover';
  tileSizeX: number;
  tileSizeY: number;
  tileAlign: string;
  srcRect: { l: number; t: number; r: number; b: number } | null;
  hasSrcRect: boolean;
}

export function resolveThemeColor(schemeName: string | null, fallback = '#f8fafc'): string {
  if (!schemeName) return fallback;
  const key = String(schemeName).trim();
  const mappedKey = state.pptxThemeAliasMap.get(key) || key;
  return state.pptxThemeColorMap.get(mappedKey)
    || state.pptxThemeColorMap.get(key)
    || fallback;
}

/**
 * phClrHex: substitution colour for <a:schemeClr val="phClr"> — the theme
 * format-scheme "placeholder colour" filled in by a style/bg reference.
 */
export function parseColorFromColorNode(colorNode: Element | null, fallback: string | null = '#f8fafc', phClrHex: string | null = null): string | null {
  if (!colorNode) return fallback;
  const srgb = getElementByLocalName(colorNode, 'srgbClr');
  if (srgb) {
    return toHexColor(srgb.getAttribute('val'), fallback as string);
  }

  const scrgb = getElementByLocalName(colorNode, 'scrgbClr');
  if (scrgb) {
    return parseScRgbColorNode(scrgb, fallback as string);
  }

  const sysClr = getElementByLocalName(colorNode, 'sysClr');
  if (sysClr) {
    const raw = sysClr.getAttribute('lastClr') || sysClr.getAttribute('val');
    return toHexColor(raw, fallback as string);
  }

  const prst = getElementByLocalName(colorNode, 'prstClr');
  if (prst) {
    const base = resolvePresetColorValue(prst.getAttribute('val'), fallback as string);
    return applyColorTransforms(base, prst);
  }

  const scheme = getElementByLocalName(colorNode, 'schemeClr');
  if (scheme) {
    const val = scheme.getAttribute('val');
    const base = (val === 'phClr' && phClrHex)
      ? phClrHex
      : resolveThemeColor(val, fallback as string);
    return applyColorTransforms(base, scheme);
  }

  return fallback;
}

export function parseRunColorFromProperties(rPr: Element | null): string | null {
  if (!rPr) return null;
  const solidFill = rPr.getElementsByTagNameNS('*', 'solidFill')[0];
  if (!solidFill) return null;
  return parseColorFromColorNode(solidFill, null);
}

export function parseSolidFillColor(node: Element | null, fallback = '#f8fafc'): string | null {
  const solidFill = getElementByLocalName(node, 'solidFill');
  if (!solidFill) return fallback;
  return parseColorFromColorNode(solidFill, fallback);
}

export function parseGradientFillCss(node: Element | null, fallback: string | null = null, phClrHex: string | null = null): string | null {
  const gradFill = (node && node.localName === 'gradFill')
    ? node
    : getElementByLocalName(node, 'gradFill');
  if (!gradFill) return fallback;

  const gsLst = getElementByLocalName(gradFill, 'gsLst');
  if (!gsLst) return fallback;

  const stops = Array.from(gsLst.getElementsByTagNameNS('*', 'gs'))
    .map((gs) => {
      const posRaw = parseInt(gs.getAttribute('pos') || '0', 10);
      const pct = Number.isFinite(posRaw) ? Math.max(0, Math.min(100, posRaw / 1000)) : 0;
      const color = parseColorFromColorNode(gs, '#0b0f19', phClrHex) as string;
      return { pct, color };
    })
    .sort((a, b) => a.pct - b.pct);

  if (stops.length === 0) return fallback;

  const normalizedStops = [...stops];
  if (normalizedStops[0].pct > 0) {
    normalizedStops.unshift({ pct: 0, color: normalizedStops[0].color });
  }
  if (normalizedStops[normalizedStops.length - 1].pct < 100) {
    normalizedStops.push({ pct: 100, color: normalizedStops[normalizedStops.length - 1].color });
  }

  const stopCss = normalizedStops.map((s) => `${s.color} ${s.pct}%`).join(', ');

  const parseFocusRect = (rectNode: Element | null) => {
    const pct = (val: string | null, def = 0) => {
      const n = parseInt(val || `${def}`, 10);
      if (!Number.isFinite(n)) return def;
      return Math.max(-100, Math.min(200, n / 1000));
    };

    const l = rectNode ? pct(rectNode.getAttribute('l'), 0) : 0;
    const t = rectNode ? pct(rectNode.getAttribute('t'), 0) : 0;
    const r = rectNode ? pct(rectNode.getAttribute('r'), 0) : 0;
    const b = rectNode ? pct(rectNode.getAttribute('b'), 0) : 0;
    const width = Math.max(1, 100 - l - r);
    const height = Math.max(1, 100 - t - b);
    const cx = l + width / 2;
    const cy = t + height / 2;
    return { cx, cy, width, height };
  };

  const lin = getElementByLocalName(gradFill, 'lin');
  if (lin) {
    const angRaw = parseInt(lin.getAttribute('ang') || '10800000', 10);
    const officeDeg = Number.isFinite(angRaw) ? (angRaw / 60000) : 180;
    // OOXML measures the gradient direction clockwise from east; CSS measures
    // clockwise from north. Same rotation sense, so the map is +90, not
    // 90-minus (which flips vertical gradients upside down).
    const cssDeg = ((officeDeg + 90) % 360 + 360) % 360;
    return `linear-gradient(${cssDeg}deg, ${stopCss})`;
  }

  const path = getElementByLocalName(gradFill, 'path');
  if (path) {
    const pathType = (path.getAttribute('path') || 'circle').toLowerCase();
    const fillToRect = getElementByLocalName(path, 'fillToRect') || getElementByLocalName(gradFill, 'tileRect');
    const focus = parseFocusRect(fillToRect);

    if (pathType === 'rect') {
      const rx = Math.max(1, Math.round(Math.abs(focus.width) / 2));
      const ry = Math.max(1, Math.round(Math.abs(focus.height) / 2));
      return `radial-gradient(ellipse ${rx}% ${ry}% at ${Math.round(focus.cx)}% ${Math.round(focus.cy)}%, ${stopCss})`;
    }

    if (pathType === 'shape') {
      return `radial-gradient(ellipse at ${Math.round(focus.cx)}% ${Math.round(focus.cy)}%, ${stopCss})`;
    }

    return `radial-gradient(circle at ${Math.round(focus.cx)}% ${Math.round(focus.cy)}%, ${stopCss})`;
  }

  return `linear-gradient(180deg, ${stopCss})`;
}

const FILL_LOCAL_NAMES = ['noFill', 'solidFill', 'gradFill', 'blipFill', 'pattFill', 'grpFill'];

/**
 * First *direct-child* element of `parent` whose localName is in `names`.
 * Critical for fills: a shape's fill is a direct child of spPr, and a line's
 * fill a direct child of <a:ln>. A deep search (getElementByLocalName) would
 * wrongly pick up the line's solidFill as the shape fill (e.g. a noFill oval
 * with a white outline would render as a solid white disk).
 */
function getDirectChildByLocalName(parent: Element | null, names: string[]): Element | null {
  if (!parent || !parent.childNodes) return null;
  for (let i = 0; i < parent.childNodes.length; i++) {
    const c = parent.childNodes[i] as Element;
    if (c && c.nodeType === 1 && names.indexOf(c.localName) !== -1) return c;
  }
  return null;
}

/**
 * Resolve the fill declared directly on a container (spPr / bgPr / ln).
 * Returns { color, gradientCss, explicit }. color null + explicit true means a
 * declared noFill; explicit false means nothing was declared (caller may fall
 * back to the shape's <p:style> fillRef).
 */
export function parseFillPaint(node: Element | null, fallbackColor: string | null = '#334155'): FillPaint {
  const fill = getDirectChildByLocalName(node, FILL_LOCAL_NAMES);
  if (fill) {
    const kind = fill.localName;
    if (kind === 'noFill') return { color: null, gradientCss: null, explicit: true };
    if (kind === 'solidFill') return { color: parseColorFromColorNode(fill, fallbackColor), gradientCss: null, explicit: true };
    if (kind === 'gradFill') return { color: fallbackColor, gradientCss: parseGradientFillCss(node, null), explicit: true };
    // blipFill is handled separately (parseBlipFillFromNode); pattFill/grpFill unsupported.
    return { color: fallbackColor, gradientCss: null, explicit: true };
  }
  return { color: fallbackColor, gradientCss: null, explicit: false };
}

/**
 * <p:style> reference (fillRef / lnRef / fontRef / effectRef): the theme
 * format-scheme index plus the placeholder colour the scheme is tinted with.
 * We approximate the referenced style as a solid of that colour, which is how
 * most default PowerPoint shapes get their accent fill and outline.
 */
export function parseShapeStyleRef(shapeNode: Element | null, refLocalName: string): { idx: number; color: string | null } | null {
  if (!shapeNode) return null;
  let styleNode: Element | null = null;
  for (let i = 0; i < shapeNode.childNodes.length; i++) {
    const c = shapeNode.childNodes[i] as Element;
    if (c && c.nodeType === 1 && c.localName === 'style') { styleNode = c; break; }
  }
  if (!styleNode) return null;
  const ref = getElementByLocalName(styleNode, refLocalName);
  if (!ref) return null;
  const idx = parseInt(ref.getAttribute('idx') || '0', 10);
  return {
    idx: Number.isFinite(idx) ? idx : 0,
    color: parseColorFromColorNode(ref, null),
  };
}

export function parseShapeFillColor(spPr: Element | null): string | null {
  return parseFillPaint(spPr, '#334155').color;
}

export function parseLineStyle(spPr: Element | null): LineStyle {
  const ln = getDirectChildByLocalName(spPr, ['ln']);
  if (!ln) {
    // No <a:ln> declared at all — caller may fall back to the shape's
    // <p:style> lnRef (explicit false signals that).
    return { strokeColor: null, strokeWidthPx: 0, explicit: false, needsThemeColor: false, headArrow: null, tailArrow: null, dash: null };
  }

  const widthEmu = parseInt(ln.getAttribute('w') || '0', 10);
  const strokeWidthPx = Number.isFinite(widthEmu) && widthEmu > 0 ? Math.max(1, Math.round(widthEmu / 9525)) : 1;

  const headEnd = getElementByLocalName(ln, 'headEnd');
  const tailEnd = getElementByLocalName(ln, 'tailEnd');
  const headArrow = headEnd ? (headEnd.getAttribute('type') || null) : null;
  const tailArrow = tailEnd ? (tailEnd.getAttribute('type') || null) : null;
  const prstDash = getElementByLocalName(ln, 'prstDash');
  const dash = prstDash ? (prstDash.getAttribute('val') || null) : null;

  const lnFill = getDirectChildByLocalName(ln, FILL_LOCAL_NAMES);
  if (lnFill && lnFill.localName === 'noFill') {
    return { strokeColor: null, strokeWidthPx: 0, explicit: true, needsThemeColor: false, headArrow, tailArrow, dash };
  }
  if (lnFill && lnFill.localName === 'solidFill') {
    return { strokeColor: parseColorFromColorNode(lnFill, '#64748b'), strokeWidthPx, explicit: true, needsThemeColor: false, headArrow, tailArrow, dash };
  }
  // Line present without an explicit fill — colour comes from the style lnRef.
  return { strokeColor: '#64748b', strokeWidthPx, explicit: true, needsThemeColor: true, headArrow, tailArrow, dash };
}

export function parseShapeEffects(spPr: Element | null): { boxShadowCss: string | null } {
  const effectLst = getElementByLocalName(spPr, 'effectLst') || getElementByLocalName(spPr, 'effectDag');
  if (!effectLst) {
    return { boxShadowCss: null };
  }

  const shadowEntries: string[] = [];
  const acceptedEffects = new Set(['outerShdw', 'innerShdw', 'prstShdw', 'glow', 'reflection', 'softEdge']);

  const parseDirectionOffsets = (effectNode: Element, defaultDistPx = 0, defaultDir = 0) => {
    const distPx = emuToPx(effectNode.getAttribute('dist')) || defaultDistPx;
    const dir = parseInt(effectNode.getAttribute('dir') || `${defaultDir}`, 10) / 60000;
    const dx = Math.round(Math.cos((dir * Math.PI) / 180) * distPx);
    const dy = Math.round(Math.sin((dir * Math.PI) / 180) * distPx);
    return { dx, dy, distPx };
  };

  const parseShadowEntry = (effectNode: Element): string | null => {
    if (!effectNode || !effectNode.localName) return null;

    const name = effectNode.localName;
    if (name === 'outerShdw' || name === 'innerShdw') {
      const blurPx = emuToPx(effectNode.getAttribute('blurRad')) || 0;
      const { dx, dy } = parseDirectionOffsets(effectNode, 0, 0);
      const sx = parseInt(effectNode.getAttribute('sx') || '100000', 10);
      const sy = parseInt(effectNode.getAttribute('sy') || '100000', 10);
      const spread = Number.isFinite(sx) && Number.isFinite(sy)
        ? Math.max(0, Math.round(((sx + sy) / 200000 - 1) * 10))
        : 0;
      const colorHex = parseColorFromColorNode(effectNode, '#000000') as string;
      const color = toRgbaColor(colorHex, parseAlphaFromColorNode(effectNode));
      return `${name === 'innerShdw' ? 'inset ' : ''}${dx}px ${dy}px ${Math.max(0, blurPx)}px ${spread}px ${color}`;
    }

    if (name === 'prstShdw') {
      const { dx, dy } = parseDirectionOffsets(effectNode, 4, 5400000);
      const colorHex = parseColorFromColorNode(effectNode, '#000000') as string;
      const color = toRgbaColor(colorHex, parseAlphaFromColorNode(effectNode));
      return `${dx}px ${dy}px 0 ${color}`;
    }

    if (name === 'glow') {
      const radius = emuToPx(effectNode.getAttribute('rad')) || 0;
      const colorHex = parseColorFromColorNode(effectNode, '#94a3b8') as string;
      const alpha = Math.max(0.05, Math.min(0.85, parseAlphaFromColorNode(effectNode)));
      const color = toRgbaColor(colorHex, alpha);
      return `0 0 ${Math.max(1, radius)}px ${color}`;
    }

    if (name === 'reflection') {
      const blurPx = emuToPx(effectNode.getAttribute('blurRad')) || 6;
      const { dx, dy } = parseDirectionOffsets(effectNode, 2, 5400000);
      const colorHex = parseColorFromColorNode(effectNode, '#000000') as string;
      const rawAlpha = parseAlphaFromColorNode(effectNode);
      const alpha = Math.max(0.05, Math.min(0.45, rawAlpha * 0.35));
      const color = toRgbaColor(colorHex, alpha);
      return `${dx}px ${dy + Math.max(2, Math.round(blurPx / 2))}px ${Math.max(4, blurPx)}px ${color}`;
    }

    if (name === 'softEdge') {
      const radius = emuToPx(effectNode.getAttribute('rad')) || 4;
      const colorHex = parseColorFromColorNode(effectNode, '#000000') as string;
      const alpha = Math.max(0.04, Math.min(0.30, parseAlphaFromColorNode(effectNode) * 0.25));
      const color = toRgbaColor(colorHex, alpha);
      return `0 0 ${Math.max(2, radius)}px ${color}`;
    }

    return null;
  };

  const collectEffectsInOrder = (root: Element): Element[] => {
    const out: Element[] = [];
    const walk = (node: Element) => {
      if (!node || !node.childNodes) return;
      for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes[i] as Element;
        if (!child || !child.localName) continue;
        if (acceptedEffects.has(child.localName)) {
          out.push(child);
        }
        walk(child);
      }
    };
    walk(root);
    return out;
  };

  const effectNodes = collectEffectsInOrder(effectLst);
  for (let i = 0; i < effectNodes.length; i++) {
    const entry = parseShadowEntry(effectNodes[i]);
    if (entry) shadowEntries.push(entry);
  }

  return {
    boxShadowCss: shadowEntries.length > 0 ? shadowEntries.join(', ') : null,
  };
}

export function mapTileAlignToCss(algn: string | null): string {
  const key = String(algn || '').toLowerCase();
  if (key === 'tl') return 'left top';
  if (key === 't') return 'center top';
  if (key === 'tr') return 'right top';
  if (key === 'l') return 'left center';
  if (key === 'r') return 'right center';
  if (key === 'bl') return 'left bottom';
  if (key === 'b') return 'center bottom';
  if (key === 'br') return 'right bottom';
  return 'center center';
}

export function parseBlipFillFromNode(node: Element | null): BlipFill | null {
  const blipFill = getElementByLocalName(node, 'blipFill');
  if (!blipFill) return null;

  const blip = getElementByLocalName(blipFill, 'blip');
  const relId = getXmlAttrByLocalName(blip, 'embed') || getXmlAttrByLocalName(blip, 'link');
  if (!relId) return null;

  const tile = getElementByLocalName(blipFill, 'tile');
  const stretch = getElementByLocalName(blipFill, 'stretch');
  const srcRectNode = getElementByLocalName(blipFill, 'srcRect');

  const toPct = (v: string | null, def = 100) => {
    const n = parseInt(v || `${def * 1000}`, 10);
    if (!Number.isFinite(n)) return def;
    return Math.max(1, Math.min(400, n / 1000));
  };

  // srcRect crop insets as fractions of the source bitmap (attr values are
  // thousandths of a percent: 25000 = 25% = 0.25).
  const cropFrac = (v: string | null) => {
    const n = parseInt(v || '0', 10);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(0.99, n / 100000));
  };
  const srcRect = srcRectNode ? {
    l: cropFrac(srcRectNode.getAttribute('l')),
    t: cropFrac(srcRectNode.getAttribute('t')),
    r: cropFrac(srcRectNode.getAttribute('r')),
    b: cropFrac(srcRectNode.getAttribute('b')),
  } : null;

  return {
    relId,
    mode: tile ? 'tile' : (stretch ? 'stretch' : 'cover'),
    tileSizeX: tile ? toPct(tile.getAttribute('sx'), 100) : 100,
    tileSizeY: tile ? toPct(tile.getAttribute('sy'), 100) : 100,
    tileAlign: tile ? mapTileAlignToCss(tile.getAttribute('algn')) : 'center center',
    srcRect,
    hasSrcRect: !!srcRectNode,
  };
}
