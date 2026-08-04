/* =========================================================================
   Slide engine — units & low-level OOXML helpers
   -------------------------------------------------------------------------
   Pure functions with no dependency on theme state: XML node lookup, colour
   math (hex/rgb, luminance transforms, scRGB, alpha), unit conversion
   (EMU -> px, pt -> css px), and small string utilities.

   Theme-aware colour resolution (schemeClr, solidFill, gradients, fills, line,
   effects) lives in core/color.ts, which builds on these primitives.

   Ported from the reference editor's core/units.js. Function names and
   behaviour are kept identical so the two can be diffed directly; only the
   module wrapper changed (IIFE on a global -> ES module).
   ========================================================================= */

export function getElementByLocalName(parent: Element | Document | null, localName: string): Element | null {
  if (!parent) return null;
  const list = parent.getElementsByTagNameNS('*', localName);
  return list && list.length ? list[0] : null;
}

export function getXmlAttrByLocalName(node: Element | null, localName: string): string | null {
  if (!node || !node.attributes) return null;
  const direct = node.getAttribute(localName);
  if (direct) return direct;

  for (let i = 0; i < node.attributes.length; i++) {
    const attr = node.attributes[i];
    if (attr.localName === localName) {
      return attr.value;
    }
  }
  return null;
}

export function toHexColor(raw: string | null | undefined, fallback = '#f8fafc'): string {
  if (!raw) return fallback;
  const normalized = String(raw).replace(/[^0-9a-f]/gi, '').toUpperCase();
  if (normalized.length === 6) return `#${normalized}`;
  return fallback;
}

export function hexToRgb(hex: string | null | undefined): { r: number; g: number; b: number } | null {
  const normalized = String(hex || '').replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const to2 = (v: number) => clamp(v).toString(16).padStart(2, '0').toUpperCase();
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

export function resolvePresetColorValue(presetName: string | null | undefined, fallback = '#f8fafc'): string {
  const key = String(presetName || '').toLowerCase();
  const map: Record<string, string> = {
    black: '#000000', white: '#FFFFFF', red: '#FF0000', green: '#008000',
    blue: '#0000FF', yellow: '#FFFF00', cyan: '#00FFFF', magenta: '#FF00FF',
    dkblue: '#000080', dkred: '#800000', dkgreen: '#006400', dkteal: '#008080',
    dkyellow: '#808000', dkgray: '#404040', ltgray: '#C0C0C0', ltblue: '#ADD8E6',
    orange: '#FFA500', brown: '#A52A2A', gray: '#808080',
  };
  return map[key] || fallback;
}

export function applyColorTransforms(baseHex: string, colorNode: Element | null): string {
  const rgb = hexToRgb(baseHex);
  if (!rgb || !colorNode) return baseHex;

  const getInt = (name: string): number | null => {
    const n = getElementByLocalName(colorNode, name);
    if (!n) return null;
    const v = parseInt(n.getAttribute('val') || '', 10);
    return Number.isFinite(v) ? v : null;
  };

  const lumMod = getInt('lumMod');
  const lumOff = getInt('lumOff');
  const tint = getInt('tint');
  const shade = getInt('shade');

  const applyLum = (channel: number) => {
    let v = channel / 255;
    if (lumMod !== null) v *= (lumMod / 100000);
    if (lumOff !== null) v += (lumOff / 100000);
    if (tint !== null) {
      const t = tint / 100000;
      v = v + (1 - v) * t;
    }
    if (shade !== null) {
      const s = shade / 100000;
      v *= s;
    }
    return Math.max(0, Math.min(1, v)) * 255;
  };

  return rgbToHex(applyLum(rgb.r), applyLum(rgb.g), applyLum(rgb.b));
}

export function parseScRgbColorNode(node: Element | null, fallback = '#f8fafc'): string {
  if (!node) return fallback;
  const parseChan = (name: string) => {
    const raw = parseInt(node.getAttribute(name) || '0', 10);
    if (!Number.isFinite(raw)) return 0;
    const clamped = Math.max(0, Math.min(100000, raw));
    return Math.round((clamped / 100000) * 255);
  };
  return rgbToHex(parseChan('r'), parseChan('g'), parseChan('b'));
}

export function parseColorChildForAlpha(colorNode: Element | null): Element | null {
  if (!colorNode) return null;
  return getElementByLocalName(colorNode, 'srgbClr')
    || getElementByLocalName(colorNode, 'scrgbClr')
    || getElementByLocalName(colorNode, 'schemeClr')
    || getElementByLocalName(colorNode, 'prstClr')
    || getElementByLocalName(colorNode, 'sysClr');
}

export function parseAlphaFromColorNode(colorNode: Element | null): number {
  if (!colorNode) return 1;
  const target = parseColorChildForAlpha(colorNode);
  if (!target) return 1;

  const alpha = getElementByLocalName(target, 'alpha');
  if (!alpha) return 1;

  const raw = parseInt(alpha.getAttribute('val') || '100000', 10);
  if (!Number.isFinite(raw)) return 1;
  return Math.max(0, Math.min(1, raw / 100000));
}

export function toRgbaColor(hexColor: string, alpha = 1): string {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return hexColor;
  const a = Math.max(0, Math.min(1, alpha));
  if (a >= 0.999) return hexColor;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a.toFixed(3)})`;
}

export function runFontSizeToCssPx(fontSizePt: number | string | null | undefined): number | null {
  const v = Number(fontSizePt);
  if (!Number.isFinite(v) || v <= 0) return null;
  const px = (v * 96) / 72;
  return Math.max(8, Math.round(px * 100) / 100);
}

/**
 * The slide board renders at 96dpi (1280px for a 13.33in slide), so
 * 1 CSS px = 9525 EMU. Two-decimal precision keeps insets/indents from
 * drifting when several rounded values stack.
 */
export function emuToPx(emu: string | number | null | undefined): number {
  const v = parseInt(String(emu || '0'), 10);
  if (!Number.isFinite(v)) return 0;
  return Math.round((v / 9525) * 100) / 100;
}

export function escapeHtmlAttribute(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function extractSlideNumberFromPath(path: string): number {
  const match = path.match(/slide(\d+)\.xml$/i);
  return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}
