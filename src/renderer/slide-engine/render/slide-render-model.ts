/* =========================================================================
   Slide engine — render model
   -------------------------------------------------------------------------
   The reference's render/slide-renderer.js paints a parsed slide by mutating
   DOM nodes: it sets div.style.* and appends SVG children as it walks the shape
   list. React owns our DOM, so the same rules live here as PURE FUNCTIONS that
   return style objects and SVG descriptors, and <SlideCanvas> renders them.

   Every resolution rule is carried across unchanged — board pixel space, text
   inset clamping, counter-flipped text, preset and custom geometry, connector
   paths, table grids, image srcRect cropping, bullets. Only the delivery
   mechanism differs.

   Not here: the editing chrome the reference interleaves with painting
   (contentEditable runs, selection HUD, sidebar text cards, history snapshots).
   That is the editor, not the renderer.

   Ported from the reference editor's render/slide-renderer.js.
   ========================================================================= */
import type { CSSProperties } from 'react';
import { runFontSizeToCssPx } from '../core/units';
import { fontFamilyFor } from './fonts';
import { presetGeometrySvgPath, customGeometryPathD, type CustomSubpath } from '../core/preset-geometry';
import type { ParsedShape, ParsedRun } from '../parser/slide-parser';
import type { ParagraphLayout, TextBodyLayout } from '../parser/shape-style';
import type { SlideSizeEmu } from '../state';

/** Local stand-in for a missing/broken image. Inline SVG data URI rather than
    a remote placeholder service — the app must work offline. */
export const IMAGE_PLACEHOLDER = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='400'%3E%3Crect width='600' height='400' fill='%23e9e9ee'/%3E%3Cpath d='M240 250l45-55 35 42 28-32 52 65z' fill='%23b9b9c2'/%3E%3Ccircle cx='250' cy='165' r='20' fill='%23b9b9c2'/%3E%3C/svg%3E";

/* ---- board geometry ---- */

/** Board logical size: 1 CSS px inside the slide canvas = 1/96 in. Width is
    fixed at 1280; height follows the deck's slide size so 4:3 decks render 4:3
    instead of stretching. */
export const BOARD_W = 1280;

export function boardHeight(emu: SlideSizeEmu | null | undefined): number {
  if (emu && emu.cx > 0 && emu.cy > 0) {
    return Math.round(BOARD_W * (emu.cy / emu.cx));
  }
  return 720;
}

/* ---- paragraph styling ---- */

export function paragraphStyleToCss(paragraphStyle: Partial<ParagraphLayout> | null | undefined): CSSProperties {
  const out: CSSProperties = {};
  if (!paragraphStyle) return out;

  if (paragraphStyle.align) out.textAlign = paragraphStyle.align as CSSProperties['textAlign'];
  if (paragraphStyle.textAlignLast) out.textAlignLast = paragraphStyle.textAlignLast as CSSProperties['textAlignLast'];
  if (paragraphStyle.direction) {
    out.direction = paragraphStyle.direction as CSSProperties['direction'];
    out.unicodeBidi = 'plaintext';
  }
  if (Number.isFinite(paragraphStyle.marginLeftPx) && paragraphStyle.marginLeftPx !== 0) {
    out.marginLeft = `${paragraphStyle.marginLeftPx}px`;
  }
  if (Number.isFinite(paragraphStyle.textIndentPx) && paragraphStyle.textIndentPx !== 0) {
    out.textIndent = `${paragraphStyle.textIndentPx}px`;
  }
  if (Number.isFinite(paragraphStyle.marginTopPx) && (paragraphStyle.marginTopPx as number) > 0) {
    out.marginTop = `${paragraphStyle.marginTopPx}px`;
  }
  if (Number.isFinite(paragraphStyle.marginBottomPx) && (paragraphStyle.marginBottomPx as number) > 0) {
    out.marginBottom = `${paragraphStyle.marginBottomPx}px`;
  }
  if (Number.isFinite(paragraphStyle.lineHeightPx) && (paragraphStyle.lineHeightPx as number) > 0) {
    out.lineHeight = `${paragraphStyle.lineHeightPx}px`;
  } else if (Number.isFinite(paragraphStyle.lineHeightMult) && (paragraphStyle.lineHeightMult as number) > 0) {
    // lnSpc percent: 100% = PowerPoint single spacing ≈ 1.2 × font size.
    out.lineHeight = String(Math.round((paragraphStyle.lineHeightMult as number) * 1.2 * 1000) / 1000);
  }
  return out;
}

/* ---- bullets ---- */

/** Common Wingdings/Symbol bullet codepoints mapped to Unicode so bullets
    render without those fonts installed. */
const SYMBOL_BULLET_MAP: Record<string, string> = {
  l: '\u25CF', n: '\u25A0', s: '\u25AA', t: '\u25C6', u: '\u25C6', v: '\u2756',
  q: '\u2751', w: '\u25C6', '\u00D8': '\u27A2', '\u00FC': '\u2713', '\u00A7': '\u25A0', '\u00B7': '\u2022',
  o: '\u25CB', '\uF0B7': '\u2022', '\uF06C': '\u25CF', '\uF06E': '\u25A0',
  '\uF075': '\u25C6', '\uF071': '\u2751', '\uF0D8': '\u27A2', '\uF0FC': '\u2713',
  '\uF0A7': '\u25AA', '\uF0A8': '\u25A1',
};

const toAlpha = (n: number): string => {
  let s = '';
  let v = Math.max(1, n);
  while (v > 0) { v -= 1; s = String.fromCharCode(65 + (v % 26)) + s; v = Math.floor(v / 26); }
  return s;
};

const ROMAN: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];

const toRoman = (n: number): string => {
  let s = '';
  let v = Math.max(1, n);
  for (const [val, sym] of ROMAN) { while (v >= val) { s += sym; v -= val; } }
  return s;
};

export function formatAutoNum(n: number, scheme: string | null | undefined): string {
  const s = String(scheme || '');
  let body: string;
  if (s.startsWith('alphaLc')) body = toAlpha(n).toLowerCase();
  else if (s.startsWith('alphaUc')) body = toAlpha(n);
  else if (s.startsWith('romanLc')) body = toRoman(n).toLowerCase();
  else if (s.startsWith('romanUc')) body = toRoman(n);
  else body = String(n);
  if (s.endsWith('ParenBoth')) return `(${body})`;
  if (s.endsWith('ParenR')) return `${body})`;
  if (s.endsWith('Plain')) return body;
  return `${body}.`;
}

export interface BulletRender {
  glyph: string;
  style: CSSProperties;
}

/**
 * The paragraph's bullet (char or auto-number), or null. The hanging indent is
 * already set up by marL/indent (negative text-indent), so the bullet span
 * fills the outdent slot and body text starts exactly at marL.
 *
 * `counters` is mutated, exactly as in the reference: a level's counter resets
 * whenever a shallower level is seen.
 */
export function paragraphBullet(
  pRuns: ParsedRun[],
  paragraphStyle: ParagraphLayout | null | undefined,
  counters: Record<number, number>,
): BulletRender | null {
  const b = paragraphStyle && paragraphStyle.bullet;
  if (!b || b.type === 'none') return null;

  const contentRun = pRuns.find((r) => r && r.text && r.text !== '\n' && r.text !== '\u200B');
  if (!contentRun) return null;

  const lvl = paragraphStyle!.level || 0;
  Object.keys(counters).forEach((k) => { if (Number(k) > lvl) delete counters[Number(k)]; });

  let glyph = '•';
  if (b.type === 'char') {
    glyph = b.char || '•';
    const f = String(b.font || '').toLowerCase();
    if (f.startsWith('wingdings') || f === 'symbol' || f === 'webdings') {
      glyph = SYMBOL_BULLET_MAP[glyph] || '•';
    }
  } else if (b.type === 'auto') {
    counters[lvl] = counters[lvl] == null ? (b.startAt || 1) : counters[lvl] + 1;
    glyph = formatAutoNum(counters[lvl], b.scheme);
  }

  const style: CSSProperties = {};
  const baseSize = runFontSizeToCssPx(contentRun.fontSize) || 18.66;
  const szPct = b.sizePct != null ? b.sizePct : 1;
  style.fontSize = `${Math.round(baseSize * szPct * 100) / 100}px`;
  style.color = b.colorHex || contentRun.color || undefined;

  const outdent = (Number.isFinite(paragraphStyle!.textIndentPx) && (paragraphStyle!.textIndentPx as number) < 0)
    ? -(paragraphStyle!.textIndentPx as number)
    : null;
  if (outdent) {
    style.display = 'inline-block';
    style.minWidth = `${outdent}px`;
  } else {
    style.marginRight = '0.35em';
  }

  return { glyph, style };
}

/* ---- shape visuals ---- */

/** Text insets are layout margins for the text only — in PowerPoint they never
    inflate the shape box. CSS padding floors a border-box at the padding sum,
    so tiny shapes (3px decoration dots with an empty text body) would balloon
    to 19px unless each side is clamped to fit. */
export function textInsetStyle(shape: ParsedShape, box: Partial<TextBodyLayout>, boardH: number): CSSProperties {
  const wPx = (shape.width / 100) * BOARD_W;
  const hPx = (shape.height / 100) * boardH;
  const side = (v: number | undefined, max: number) => Math.max(0, Math.min(v || 0, max / 2));
  return {
    paddingLeft: `${side(box.paddingLeftPx, wPx)}px`,
    paddingRight: `${side(box.paddingRightPx, wPx)}px`,
    paddingTop: `${side(box.paddingTopPx, hPx)}px`,
    paddingBottom: `${side(box.paddingBottomPx, hPx)}px`,
  };
}

export function shapeTransform(shape: ParsedShape): string | undefined {
  const t: string[] = [];
  if (shape.rotationDeg) t.push(`rotate(${shape.rotationDeg}deg)`);
  if (shape.flipH) t.push('scaleX(-1)');
  if (shape.flipV) t.push('scaleY(-1)');
  return t.length ? t.join(' ') : undefined;
}

/** PowerPoint mirrors a shape's geometry/fill on flipH/flipV but draws its TEXT
    upright and readable (a flipped label like "January" is not shown
    backwards). Since the whole shape div is flipped, counter-flip each text
    paragraph on the same axes to cancel the mirror for the glyphs only. */
export function textCounterFlip(shape: ParsedShape): string | undefined {
  const t: string[] = [];
  if (shape.flipH) t.push('scaleX(-1)');
  if (shape.flipV) t.push('scaleY(-1)');
  return t.length ? t.join(' ') : undefined;
}

/** Corner shape from the preset geometry. roundRect radius follows the adj
    value (fraction of the shorter side, default 16.667%); ellipse is 50%. */
export function shapeCornerRadius(shape: ParsedShape, boardH: number): string | undefined {
  const st = String(shape.shapeType || '').toLowerCase();
  if (st === 'ellipse' || st === 'oval' || st === 'circle') return '50%';
  if (st === 'roundrect' || st === 'round1rect' || st === 'round2samerect' || st === 'round2diagrect') {
    const adj = shape.adjustments as Record<string, number> | null;
    const adjRaw = adj ? (adj.adj ?? adj.adj1 ?? null) : null;
    const frac = adjRaw != null ? Math.max(0, Math.min(0.5, adjRaw / 100000)) : 0.16667;
    const wPx = (shape.width / 100) * BOARD_W;
    const hPx = (shape.height / 100) * boardH;
    return `${Math.max(1, Math.round(frac * Math.min(wPx, hPx)))}px`;
  }
  return undefined;
}

export interface SvgPathSpec {
  d: string;
  fill: string;
  stroke?: string;
  strokeWidth?: string;
  strokeLinejoin?: 'round';
}

export interface ShapeSvgSpec {
  viewBox: string;
  paths: SvgPathSpec[];
  filter?: string;
  overflowVisible?: boolean;
}

export interface ShapeVisual {
  style: CSSProperties;
  svg: ShapeSvgSpec | null;
}

/** box-shadow syntax ≈ drop-shadow minus the spread value. */
function dropShadowFrom(boxShadowCss: unknown): string | undefined {
  const m = String(boxShadowCss).match(/^(-?\d+px) (-?\d+px) (\d+px)(?: -?\d+px)? (.+?)(?:,|$)/);
  return m ? `drop-shadow(${m[1]} ${m[2]} ${m[3]} ${m[4]})` : undefined;
}

function backgroundImageFill(shape: ParsedShape, style: CSSProperties, src: string): void {
  style.backgroundImage = `url('${src}')`;
  style.backgroundRepeat = shape.imageFillMode === 'tile' ? 'repeat' : 'no-repeat';
  style.backgroundSize = shape.imageFillMode === 'tile' ? 'auto' : '100% 100%';
}

/** Freeform <a:custGeom> vector shapes (the bulk of Slidesgo/Freepik art): each
    subpath scales to the shape box; fill="none" subpaths only stroke.
    Gradient/image fills fall back to clipping the CSS background to the
    combined silhouette. */
function customGeometryVisual(shape: ParsedShape, boardH: number): ShapeVisual {
  const style: CSSProperties = {};
  const wPx = Math.max(1, (shape.width / 100) * BOARD_W);
  const hPx = Math.max(1, (shape.height / 100) * boardH);
  const paths = ((shape.customGeometry as { paths?: CustomSubpath[] }).paths || []);
  const pathD = (p: CustomSubpath) => customGeometryPathD(p, wPx, hPx);

  if (shape.fillGradientCss || shape.imageFillSrc) {
    const clipD = paths.filter((p) => p.fill !== 'none').map(pathD).join(' ');
    if (clipD) style.clipPath = `path('${clipD}')`;
    if (shape.fillColor) style.backgroundColor = shape.fillColor as string;
    if (shape.fillGradientCss) style.backgroundImage = shape.fillGradientCss as string;
    if (shape.imageFillSrc) backgroundImageFill(shape, style, shape.imageFillSrc as string);
    return { style, svg: null };
  }

  const specs: SvgPathSpec[] = paths.map((p) => {
    const spec: SvgPathSpec = {
      d: pathD(p),
      fill: p.fill !== 'none' ? ((shape.fillColor as string) || 'none') : 'none',
    };
    if (p.strokeOk && shape.strokeColor) {
      spec.stroke = shape.strokeColor as string;
      spec.strokeWidth = String(Math.max(1, (shape.strokeWidthPx as number) || 1));
      spec.strokeLinejoin = 'round';
    }
    return spec;
  });

  return {
    style,
    svg: {
      viewBox: `0 0 ${wPx} ${hPx}`,
      paths: specs,
      filter: shape.boxShadowCss ? dropShadowFrom(shape.boxShadowCss) : undefined,
      overflowVisible: true,
    },
  };
}

/** Fill / image-fill / stroke / shadow / corners for any sp-derived record
    (kind "shape" and text-bearing shapes alike). Presets with a path generator
    render their silhouette as SVG (solid fill) or clip the div (gradient/image
    fill, where CSS paints the background). */
export function shapeVisual(shape: ParsedShape, boardH: number): ShapeVisual {
  if (shape.customGeometry) return customGeometryVisual(shape, boardH);

  const style: CSSProperties = {};
  const geo = presetGeometrySvgPath(shape as never, BOARD_W, boardH);
  const imgFill = (shape.imageFillSrc as string) || null;

  if (geo && (shape.fillGradientCss || imgFill)) {
    // CSS background clipped to the preset silhouette (no border — clip-path
    // removes it anyway).
    style.clipPath = `path('${geo.d}')`;
    if (shape.fillColor) style.backgroundColor = shape.fillColor as string;
    if (shape.fillGradientCss) style.backgroundImage = shape.fillGradientCss as string;
    if (imgFill) backgroundImageFill(shape, style, imgFill);
    return { style, svg: null };
  }

  if (geo) {
    const spec: SvgPathSpec = { d: geo.d, fill: (shape.fillColor as string) || 'none' };
    if (shape.strokeColor) {
      spec.stroke = shape.strokeColor as string;
      spec.strokeWidth = String(Math.max(1, (shape.strokeWidthPx as number) || 1));
      spec.strokeLinejoin = 'round';
    }
    return {
      style,
      svg: {
        viewBox: `0 0 ${geo.w} ${geo.h}`,
        paths: [spec],
        filter: shape.boxShadowCss ? dropShadowFrom(shape.boxShadowCss) : undefined,
      },
    };
  }

  if (shape.fillColor) style.backgroundColor = shape.fillColor as string;
  if (shape.fillGradientCss) style.backgroundImage = shape.fillGradientCss as string;
  if (imgFill) backgroundImageFill(shape, style, imgFill);
  if (shape.strokeColor) {
    style.border = `${Math.max(1, (shape.strokeWidthPx as number) || 1)}px solid ${shape.strokeColor}`;
  }
  if (shape.boxShadowCss) style.boxShadow = shape.boxShadowCss as string;
  const radius = shapeCornerRadius(shape, boardH);
  if (radius) style.borderRadius = radius;
  return { style, svg: null };
}

/** Clip an image-filled div to its custGeom silhouette (used by the
    kind:"imagefill" branch, which paints via CSS background). */
export function customClipPath(shape: ParsedShape, boardH: number): string | undefined {
  if (!shape.customGeometry) return undefined;
  const wPx = Math.max(1, (shape.width / 100) * BOARD_W);
  const hPx = Math.max(1, (shape.height / 100) * boardH);
  const clipD = (((shape.customGeometry as { paths?: CustomSubpath[] }).paths) || [])
    .filter((p) => p.fill !== 'none')
    .map((p) => customGeometryPathD(p, wPx, hPx))
    .join(' ');
  return clipD ? `path('${clipD}')` : undefined;
}

/** The kind:"imagefill" CSS background rules. */
export function imageFillStyle(shape: ParsedShape, boardH: number): CSSProperties {
  const style: CSSProperties = {
    backgroundImage: `url('${(shape.src as string) || IMAGE_PLACEHOLDER}')`,
    backgroundPosition: (shape.tileAlign as string) || 'center center',
  };
  const clip = customClipPath(shape, boardH);
  if (clip) style.clipPath = clip;
  const radius = shapeCornerRadius(shape, boardH);
  if (radius) style.borderRadius = radius;
  if (shape.strokeColor) {
    style.border = `${Math.max(1, (shape.strokeWidthPx as number) || 1)}px solid ${shape.strokeColor}`;
  }
  if (shape.boxShadowCss) style.boxShadow = shape.boxShadowCss as string;

  if (shape.fillMode === 'tile') {
    style.backgroundRepeat = 'repeat';
    style.backgroundSize = `${Math.max(1, (shape.tileSizeX as number) || 100)}% ${Math.max(1, (shape.tileSizeY as number) || 100)}%`;
  } else if (shape.fillMode === 'stretch') {
    style.backgroundRepeat = 'no-repeat';
    style.backgroundSize = '100% 100%';
  } else {
    style.backgroundRepeat = 'no-repeat';
    style.backgroundSize = 'cover';
  }
  return style;
}

/* ---- connectors ---- */

const DASH_ARRAYS: Record<string, string> = {
  dash: '8 6', dashDot: '8 6 2 6', dot: '2 4', lgDash: '12 6',
  lgDashDot: '12 6 2 6', lgDashDotDot: '12 6 2 6 2 6', sysDash: '6 4',
  sysDashDot: '6 4 2 4', sysDashDotDot: '6 4 2 4 2 4', sysDot: '2 3',
};

export interface ConnectorSpec {
  viewBox: string;
  widthPx: number;
  heightPx: number;
  d: string;
  stroke: string;
  strokeWidth: number;
  dashArray?: string;
  markerId: string;
  head: boolean;
  tail: boolean;
  markerSize: number;
}

/** Connectors render as real SVG paths in board-pixel space so zero-height
    horizontal lines and diagonal lines keep an even stroke. */
export function connectorSpec(shape: ParsedShape, boardH: number): ConnectorSpec {
  const wPx = Math.max((shape.width / 100) * BOARD_W, 0);
  const hPx = Math.max((shape.height / 100) * boardH, 0);
  const vw = Math.max(wPx, 1);
  const vh = Math.max(hPx, 1);
  const stroke = (shape.strokeColor as string) || '#64748b';
  const sw = Math.max(1, (shape.strokeWidthPx as number) || 1);

  const prst = String(shape.shapeType || 'line');
  let d: string;
  if (prst.startsWith('bentConnector')) {
    d = `M 0 0 L ${vw / 2} 0 L ${vw / 2} ${vh} L ${vw} ${vh}`;
  } else if (prst.startsWith('curvedConnector')) {
    d = `M 0 0 C ${vw * 0.6} 0, ${vw * 0.4} ${vh}, ${vw} ${vh}`;
  } else {
    d = `M 0 0 L ${vw} ${vh}`;
  }

  const arrowFor = (type: unknown) => !!type && type !== 'none';
  const dash = shape.strokeDash as string | undefined;

  return {
    viewBox: `0 0 ${vw} ${vh}`,
    widthPx: vw,
    heightPx: vh,
    d,
    stroke,
    strokeWidth: sw,
    dashArray: dash && DASH_ARRAYS[dash] ? DASH_ARRAYS[dash] : undefined,
    markerId: `arr_${shape.id}`,
    head: arrowFor(shape.headArrow),
    tail: arrowFor(shape.tailArrow),
    markerSize: Math.max(4, sw * 3),
  };
}

/* ---- images ---- */

export interface ImageRender {
  src: string;
  divStyle: CSSProperties;
  imgStyle: CSSProperties;
}

/** Pictures stretch to the shape extent like PowerPoint; srcRect crops by
    oversizing the img inside an overflow-hidden box. */
export function imageRender(shape: ParsedShape): ImageRender {
  const divStyle: CSSProperties = {};
  const imgStyle: CSSProperties = { display: 'block' };

  const c = shape.srcRect as { l: number; t: number; r: number; b: number } | null;
  if (c && (c.l || c.t || c.r || c.b)) {
    divStyle.overflow = 'hidden';
    const fw = Math.max(0.01, 1 - c.l - c.r);
    const fh = Math.max(0.01, 1 - c.t - c.b);
    imgStyle.position = 'absolute';
    imgStyle.maxWidth = 'none';
    imgStyle.width = `${100 / fw}%`;
    imgStyle.height = `${100 / fh}%`;
    imgStyle.left = `${(-c.l / fw) * 100}%`;
    imgStyle.top = `${(-c.t / fh) * 100}%`;
  } else {
    imgStyle.width = '100%';
    imgStyle.height = '100%';
    imgStyle.objectFit = 'fill';
  }

  if (shape.strokeColor) {
    divStyle.border = `${Math.max(1, (shape.strokeWidthPx as number) || 1)}px solid ${shape.strokeColor}`;
  }
  if (shape.boxShadowCss) divStyle.boxShadow = shape.boxShadowCss as string;

  return { src: (shape.src as string) || IMAGE_PLACEHOLDER, divStyle, imgStyle };
}

/* ---- background ---- */

export function slideBackgroundStyle(backgroundValue: string | null | undefined): CSSProperties {
  const val = backgroundValue || '#0b0f19';
  if (typeof val === 'string' && val.includes('gradient(')) {
    return { backgroundImage: val, backgroundColor: '#0b0f19' };
  }
  return { backgroundImage: 'none', backgroundColor: val };
}

/* ---- text body ---- */

export function textBodyStyle(shape: ParsedShape, box: Partial<TextBodyLayout>, boardH: number): CSSProperties {
  const style: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: box.vAlign === 'bottom' ? 'flex-end' : (box.vAlign === 'middle' ? 'center' : 'flex-start'),
    ...textInsetStyle(shape, box, boardH),
  };
  // wrap="none": auto-width boxes never wrap; let text overflow.
  if (box.wrap === 'none') style.overflow = 'visible';
  return style;
}

export function runStyle(run: ParsedRun, fallbackColor: string): CSSProperties {
  const style: CSSProperties = { color: run.color || fallbackColor };
  if (run.bold) style.fontWeight = 700;
  if (run.italic) style.fontStyle = 'italic';
  if (run.underline) style.textDecoration = 'underline';
  if (run.fontFace) style.fontFamily = fontFamilyFor(run.fontFace);
  const sizePx = runFontSizeToCssPx(run.fontSize);
  if (sizePx) style.fontSize = `${sizePx}px`;
  return style;
}

/* ---- tables ---- */

export interface TableCellRender {
  key: string;
  style: CSSProperties;
  paragraphs: ParsedRun[][];
}

export interface TableRender {
  style: CSSProperties;
  cells: TableCellRender[];
}

/** Tables: real column-width/row-height ratios, merges, per-run cell text.
    PowerPoint writes a tc for every grid position (merge continuations carry
    hMerge/vMerge), so the column cursor advances by exactly 1 per tc. */
export function tableRender(shape: ParsedShape): TableRender {
  const rows = (shape.rows as any[]) || [];
  const cols = (shape.colWidths as number[] | undefined);
  const hasCols = !!(cols && cols.length);
  const colCount = hasCols ? cols!.length : Math.max(1, ...rows.map((r) => r.cells.length));

  const style: CSSProperties = {
    display: 'grid',
    overflow: 'hidden',
    gridTemplateColumns: hasCols ? cols!.map((w) => `${w}fr`).join(' ') : `repeat(${colCount}, minmax(0, 1fr))`,
    gridTemplateRows: rows.map((r) => `${Math.max(1, r.heightEmu || 1)}fr`).join(' '),
  };

  const fallbackBorder = shape.hasTableStyle ? '1px solid rgba(0,0,0,0.15)' : null;
  const cells: TableCellRender[] = [];

  rows.forEach((row, rIdx) => {
    let cIdx = 0;
    row.cells.forEach((cell: any, i: number) => {
      const c = cIdx;
      cIdx += 1;
      if (cell.hMerge || cell.vMerge) return;

      const cellStyle: CSSProperties = {
        gridColumn: `${c + 1} / span ${cell.gridSpan || 1}`,
        gridRow: `${rIdx + 1} / span ${cell.rowSpan || 1}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: cell.anchor === 'b' ? 'flex-end' : (cell.anchor === 'ctr' ? 'center' : 'flex-start'),
      };
      if (cell.fillColor) cellStyle.backgroundColor = cell.fillColor;
      const ins = cell.insets || {};
      cellStyle.padding = `${ins.t ?? 4.8}px ${ins.r ?? 9.6}px ${ins.b ?? 4.8}px ${ins.l ?? 9.6}px`;

      const side = (name: string, prop: 'borderLeft' | 'borderRight' | 'borderTop' | 'borderBottom') => {
        const b = cell.borders ? cell.borders[name] : null;
        if (b) cellStyle[prop] = `${b.widthPx}px solid ${b.color}`;
        else if (fallbackBorder) cellStyle[prop] = fallbackBorder;
      };
      side('l', 'borderLeft');
      side('r', 'borderRight');
      side('t', 'borderTop');
      side('b', 'borderBottom');

      cells.push({ key: `${rIdx}_${i}`, style: cellStyle, paragraphs: cell.paragraphs || [] });
    });
  });

  return { style, cells };
}
