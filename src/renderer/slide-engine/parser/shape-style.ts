/* =========================================================================
   Slide engine — run, paragraph, text-body & background style parsing
   -------------------------------------------------------------------------
   Turns DrawingML run properties (<a:rPr>), paragraph properties (<a:pPr>),
   text-body properties (<a:bodyPr>) and slide/master backgrounds into the
   normalised style objects the renderer consumes. Handles level/list-style
   inheritance (lvlNpPr) and txStyles (title/body/other) resolution.

   Depends on core (colour resolution, units). Placeholder geometry/style
   inheritance built on top of these lives in parser/placeholders.ts.

   Ported from the reference editor's parser/shape-style.js.
   ========================================================================= */
import { getElementByLocalName, emuToPx, applyColorTransforms } from '../core/units';
import {
  resolveThemeColor,
  parseRunColorFromProperties,
  parseColorFromColorNode,
  parseFillPaint,
  parseGradientFillCss,
} from '../core/color';
import { state } from '../state';

export interface RunStyle {
  color: string | null;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  fontFace: string | null;
  fontSizePt: number;
}

export interface Bullet {
  type: 'none' | 'char' | 'auto';
  char?: string;
  scheme?: string;
  startAt?: number;
  font?: string | null;
  sizePct?: number | null;
  colorHex?: string | null;
}

export interface ParagraphLayout {
  align: string;
  level: number;
  bullet: Bullet | null;
  marginLeftPx: number;
  textIndentPx: number;
  marginTopPx: number;
  marginBottomPx: number;
  lineHeightPx: number | null;
  lineHeightMult: number | null;
  direction: string;
  textAlignLast: string | null;
}

export interface TextBodyLayout {
  paddingLeftPx: number;
  paddingRightPx: number;
  paddingTopPx: number;
  paddingBottomPx: number;
  vAlign: string;
  wrap: string;
  autofit: string | null;
  fontScalePct: number | null;
  lnSpcReductionPct: number | null;
}

/**
 * Resolve DrawingML theme font references (+mj-lt major, +mn-lt minor, and the
 * -ea / -cs variants) to the concrete typeface from the theme fontScheme. Real
 * typefaces (e.g. "Arial") pass through unchanged.
 */
function resolveThemeFontRef(typeface: string | null): string | null {
  if (!typeface) return typeface;
  const t = String(typeface).trim();
  const fonts = state.pptxThemeFonts || {};
  if (t.startsWith('+mj') || t.startsWith('+major')) return fonts.major || t;
  if (t.startsWith('+mn') || t.startsWith('+minor')) return fonts.minor || t;
  return t;
}

export function getDefaultRunStyle(): RunStyle {
  return {
    color: resolveThemeColor('tx1', '#f8fafc'),
    bold: false,
    italic: false,
    underline: false,
    fontFace: null,
    fontSizePt: 18,
  };
}

export function parseRunStyleFromProperties(rPr: Element | null, inheritedStyle: RunStyle | null = null): RunStyle {
  const base: RunStyle = {
    ...(inheritedStyle || getDefaultRunStyle()),
  };

  if (!rPr) {
    return base;
  }

  const sizeRaw = parseInt(rPr.getAttribute('sz') || '', 10);
  const latin = rPr.getElementsByTagNameNS('*', 'latin')[0];

  const hasBold = rPr.getAttribute('b');
  const hasItalic = rPr.getAttribute('i');
  const underlineAttr = rPr.getAttribute('u');

  const runColor = parseRunColorFromProperties(rPr);

  const style: RunStyle = {
    ...base,
    color: runColor === null ? base.color : runColor,
    bold: hasBold === null ? base.bold : hasBold === '1',
    italic: hasItalic === null ? base.italic : hasItalic === '1',
    underline: underlineAttr === null ? base.underline : (underlineAttr !== 'none'),
    fontFace: latin ? (resolveThemeFontRef(latin.getAttribute('typeface')) || base.fontFace) : base.fontFace,
    fontSizePt: Number.isFinite(sizeRaw) ? (sizeRaw / 100) : base.fontSizePt,
  };

  return style;
}

/** lvl1pPr..lvl9pPr child of a lstStyle / txStyle / defaultTextStyle node. */
export function getLvlNode(container: Element | null, lvl: number): Element | null {
  if (!container) return null;
  return getElementByLocalName(container, `lvl${Math.min(9, Math.max(0, lvl) + 1)}pPr`);
}

/** First non-empty attribute walking a chain of pPr-like nodes, nearest first. */
export function chainAttr(chain: (Element | null)[], attrName: string): string | null {
  for (let i = 0; i < chain.length; i++) {
    const node = chain[i];
    if (!node) continue;
    const v = node.getAttribute(attrName);
    if (v !== null && v !== '') return v;
  }
  return null;
}

export function chainChild(chain: (Element | null)[], localName: string): Element | null {
  for (let i = 0; i < chain.length; i++) {
    const node = chain[i];
    if (!node) continue;
    const c = getElementByLocalName(node, localName);
    if (c) return c;
  }
  return null;
}

/**
 * Nearest node that declares ANY bullet element wins (a buNone close to the
 * paragraph must beat a buChar further out).
 */
function chainBulletNode(chain: (Element | null)[]): Element | null {
  for (let i = 0; i < chain.length; i++) {
    const node = chain[i];
    if (!node) continue;
    const bu = getElementByLocalName(node, 'buNone')
      || getElementByLocalName(node, 'buChar')
      || getElementByLocalName(node, 'buAutoNum');
    if (bu) return bu;
  }
  return null;
}

/**
 * Effective run style for a paragraph: master txStyles / master+layout
 * placeholder lstStyles (levelChain, outermost applied first), then the shape's
 * own lstStyle level, then the paragraph's own defRPr.
 */
export function getParagraphDefaultRunStyle(
  paragraphNode: Element | null,
  txBody: Element | null,
  inheritedBaseStyle: RunStyle | null = null,
  levelChain: (Element | null)[] | null = null,
): RunStyle {
  let style: RunStyle = {
    ...(inheritedBaseStyle || getDefaultRunStyle()),
  };
  const pPr = getElementByLocalName(paragraphNode, 'pPr');
  const lvl = Math.max(0, parseInt((pPr && pPr.getAttribute('lvl')) || '0', 10) || 0);

  if (levelChain && levelChain.length) {
    for (let i = levelChain.length - 1; i >= 0; i--) {
      const defRpr = getElementByLocalName(levelChain[i], 'defRPr');
      if (defRpr) style = parseRunStyleFromProperties(defRpr, style);
    }
  }

  const lstStyle = getElementByLocalName(txBody, 'lstStyle');
  const lvlPr = getLvlNode(lstStyle, lvl);
  const lvlDefRpr = getElementByLocalName(lvlPr, 'defRPr');
  style = parseRunStyleFromProperties(lvlDefRpr, style);

  const pDefRpr = getElementByLocalName(pPr, 'defRPr');
  style = parseRunStyleFromProperties(pDefRpr, style);
  return style;
}

export function parseBackgroundColorFromDoc(xmlDoc: Document | null): string | null {
  if (!xmlDoc) return null;

  const bgNode = xmlDoc.getElementsByTagNameNS('*', 'bg')[0];
  if (!bgNode) {
    return null;
  }

  const bgPr = getElementByLocalName(bgNode, 'bgPr');
  if (bgPr) {
    const fill = parseFillPaint(bgPr, resolveThemeColor('bg1', '#0b0f19'));
    return fill.gradientCss || fill.color;
  }

  const bgRef = getElementByLocalName(bgNode, 'bgRef');
  if (bgRef) {
    // The bgRef colour fills every <a:schemeClr val="phClr"> inside the
    // referenced theme fill style.
    const schemeClr = getElementByLocalName(bgRef, 'schemeClr');
    const phClr = schemeClr
      ? applyColorTransforms(resolveThemeColor(schemeClr.getAttribute('val'), resolveThemeColor('bg1', '#FFFFFF')), schemeClr)
      : null;

    // idx 1-999 indexes fillStyleLst; 1001+ indexes bgFillStyleLst.
    const idxRaw = parseInt(bgRef.getAttribute('idx') || '0', 10);
    const lists = state.pptxThemeFmtScheme;
    let fillNode: Element | null = null;
    if (Number.isFinite(idxRaw) && lists) {
      if (idxRaw >= 1001 && lists.bgFillStyles) fillNode = lists.bgFillStyles[idxRaw - 1001] || null;
      else if (idxRaw >= 1 && idxRaw <= 999 && lists.fillStyles) fillNode = lists.fillStyles[idxRaw - 1] || null;
    }

    if (fillNode) {
      if (fillNode.localName === 'gradFill') {
        const css = parseGradientFillCss(fillNode, null, phClr);
        if (css) return css;
      }
      if (fillNode.localName === 'solidFill') {
        return parseColorFromColorNode(fillNode, phClr || resolveThemeColor('bg1', '#FFFFFF'), phClr);
      }
      // blipFill background styles unsupported — fall through to phClr.
    }

    if (phClr) return phClr;
  }

  return null;
}

export function parseSlideBackgroundColor(xmlDoc: Document | null, inheritedColor: string | null = null): string {
  const explicit = parseBackgroundColorFromDoc(xmlDoc);
  return explicit || inheritedColor || resolveThemeColor('bg1', '#0b0f19');
}

export function getBodyStyleDefRprFromDoc(xmlDoc: Document | null): Element | null {
  if (!xmlDoc) return null;
  const txStyles = xmlDoc.getElementsByTagNameNS('*', 'txStyles')[0];
  if (!txStyles) return null;

  const bodyStyle = getElementByLocalName(txStyles, 'bodyStyle');
  if (!bodyStyle) return null;

  const lvl1 = getElementByLocalName(bodyStyle, 'lvl1pPr');
  const lvl1Def = getElementByLocalName(lvl1, 'defRPr');
  if (lvl1Def) return lvl1Def;

  return getElementByLocalName(bodyStyle, 'defRPr');
}

export function getDefRprFromStyleNode(styleNode: Element | null): Element | null {
  if (!styleNode) return null;
  const lvl1 = getElementByLocalName(styleNode, 'lvl1pPr');
  const lvl1Def = getElementByLocalName(lvl1, 'defRPr');
  if (lvl1Def) return lvl1Def;
  return getElementByLocalName(styleNode, 'defRPr');
}

export function getTxStyleSetFromDoc(xmlDoc: Document | null): { title: Element | null; body: Element | null; other: Element | null } {
  const empty = { title: null, body: null, other: null };
  if (!xmlDoc) return empty;

  const txStyles = xmlDoc.getElementsByTagNameNS('*', 'txStyles')[0];
  if (!txStyles) return empty;

  const titleStyle = getElementByLocalName(txStyles, 'titleStyle');
  const bodyStyle = getElementByLocalName(txStyles, 'bodyStyle');
  const otherStyle = getElementByLocalName(txStyles, 'otherStyle');

  return {
    title: getDefRprFromStyleNode(titleStyle),
    body: getDefRprFromStyleNode(bodyStyle),
    other: getDefRprFromStyleNode(otherStyle),
  };
}

/**
 * Paragraph spacing (spcBef/spcAft) in px. spcPts is exact (hundredths of a
 * point -> px at 96dpi). spcPct is a percentage of the line height, which we
 * can't know here without the resolved font size; approximate against a
 * nominal 18pt single-spaced line (18pt * 1.2 = 28.8px).
 */
export function parseSpacingNodeToPx(node: Element | null): number {
  if (!node) return 0;
  const spcPts = getElementByLocalName(node, 'spcPts');
  if (spcPts) {
    const val = parseInt(spcPts.getAttribute('val') || '0', 10);
    if (Number.isFinite(val)) {
      return Math.round((val / 100) * (96 / 72) * 100) / 100;
    }
  }

  const spcPct = getElementByLocalName(node, 'spcPct');
  if (spcPct) {
    const val = parseInt(spcPct.getAttribute('val') || '0', 10);
    if (Number.isFinite(val)) {
      return Math.round((val / 100000) * 28.8 * 100) / 100;
    }
  }

  return 0;
}

/**
 * Line spacing (lnSpc). Returns { px, mult } where exactly one is set:
 * spcPts -> fixed px; spcPct -> multiplier of the font's normal line box
 * (100% = single spacing; the renderer maps this to line-height mult*1.2).
 */
function parseLineSpacing(node: Element | null): { px: number | null; mult: number | null } {
  if (!node) return { px: null, mult: null };
  const spcPts = getElementByLocalName(node, 'spcPts');
  if (spcPts) {
    const val = parseInt(spcPts.getAttribute('val') || '0', 10);
    if (Number.isFinite(val) && val > 0) {
      return { px: Math.round((val / 100) * (96 / 72) * 100) / 100, mult: null };
    }
  }

  const spcPct = getElementByLocalName(node, 'spcPct');
  if (spcPct) {
    const val = parseInt(spcPct.getAttribute('val') || '0', 10);
    if (Number.isFinite(val) && val > 0) {
      return { px: null, mult: val / 100000 };
    }
  }

  return { px: null, mult: null };
}

export function getParagraphPropertyWithLevelFallback(paragraphNode: Element | null, txBody: Element | null, attrName: string): string | null {
  const pPr = getElementByLocalName(paragraphNode, 'pPr');
  const direct = pPr ? pPr.getAttribute(attrName) : null;
  if (direct !== null && direct !== '') return direct;

  if (!txBody) return null;
  const lvl = Math.max(0, parseInt((pPr && pPr.getAttribute('lvl')) || '0', 10) || 0);
  const lstStyle = getElementByLocalName(txBody, 'lstStyle');
  const lvlPr = lstStyle ? getElementByLocalName(lstStyle, `lvl${Math.min(9, lvl + 1)}pPr`) : null;
  if (!lvlPr) return null;

  const fromLvl = lvlPr.getAttribute(attrName);
  return (fromLvl === null || fromLvl === '') ? null : fromLvl;
}

export function parseParagraphAlign(paragraphNode: Element | null, txBody: Element | null = null, fallbackAlign = 'left'): string {
  const algn = (getParagraphPropertyWithLevelFallback(paragraphNode, txBody, 'algn') || '').toLowerCase();
  if (!algn) return fallbackAlign;

  if (algn === 'l') return 'left';
  if (algn === 'ctr') return 'center';
  if (algn === 'r') return 'right';
  if (algn === 'just') return 'justify';
  if (algn === 'justlow') return 'justify';
  if (algn === 'dist') return 'justify';
  if (algn === 'thaidist') return 'justify';
  return fallbackAlign;
}

/**
 * levelChain: pPr-like nodes from the placeholder inheritance chain for this
 * paragraph's level (layout ph lstStyle -> master ph lstStyle -> master
 * txStyles / presentation defaultTextStyle), nearest first. The paragraph's own
 * pPr and the shape's own lstStyle level are prepended here.
 */
export function parseParagraphLayout(
  paragraphNode: Element | null,
  txBody: Element | null = null,
  inheritedLayout: ParagraphLayout | null = null,
  levelChain: (Element | null)[] | null = null,
): ParagraphLayout {
  const pPr = getElementByLocalName(paragraphNode, 'pPr');
  const lvl = Math.max(0, parseInt((pPr && pPr.getAttribute('lvl')) || '0', 10) || 0);
  const ownLst = txBody ? getLvlNode(getElementByLocalName(txBody, 'lstStyle'), lvl) : null;
  const chain = ([pPr, ownLst] as (Element | null)[]).concat(levelChain || []).filter(Boolean);

  const algnRaw = (chainAttr(chain, 'algn') || '').toLowerCase();
  let align = inheritedLayout?.align || 'left';
  if (algnRaw === 'l') align = 'left';
  else if (algnRaw === 'ctr') align = 'center';
  else if (algnRaw === 'r') align = 'right';
  else if (algnRaw === 'just' || algnRaw === 'justlow' || algnRaw === 'dist' || algnRaw === 'thaidist') align = 'justify';

  const marLRaw = chainAttr(chain, 'marL');
  const indentRaw = chainAttr(chain, 'indent');
  const marL = marLRaw !== null ? emuToPx(marLRaw) : 0;
  const indent = indentRaw !== null ? emuToPx(indentRaw) : 0;
  const spcBef = parseSpacingNodeToPx(chainChild(chain, 'spcBef'));
  const spcAft = parseSpacingNodeToPx(chainChild(chain, 'spcAft'));
  const lnSpc = parseLineSpacing(chainChild(chain, 'lnSpc'));
  const hasLnSpc = lnSpc.px != null || lnSpc.mult != null;
  const rtlAttr = chainAttr(chain, 'rtl');
  const fontAlgn = (chainAttr(chain, 'fontAlgn') || '').toLowerCase();

  // Bullet: nearest declaration wins; font/size/colour resolve independently.
  let bullet: Bullet | null = null;
  const buNode = chainBulletNode(chain);
  if (buNode) {
    if (buNode.localName === 'buNone') {
      bullet = { type: 'none' };
    } else {
      const buFontNode = chainChild(chain, 'buFont');
      const buSzPctNode = chainChild(chain, 'buSzPct');
      const buClrNode = chainChild(chain, 'buClr');
      const szRaw = buSzPctNode ? parseInt(buSzPctNode.getAttribute('val') || '', 10) : NaN;
      const common = {
        font: buFontNode ? (buFontNode.getAttribute('typeface') || null) : null,
        sizePct: Number.isFinite(szRaw) ? szRaw / 100000 : null,
        colorHex: buClrNode ? parseColorFromColorNode(buClrNode, null) : null,
      };
      if (buNode.localName === 'buChar') {
        bullet = { type: 'char', char: buNode.getAttribute('char') || '•', ...common };
      } else {
        const startRaw = parseInt(buNode.getAttribute('startAt') || '1', 10);
        bullet = {
          type: 'auto',
          scheme: buNode.getAttribute('type') || 'arabicPeriod',
          startAt: Number.isFinite(startRaw) ? startRaw : 1,
          ...common,
        };
      }
    }
  }

  return {
    align,
    level: lvl,
    bullet,
    marginLeftPx: marL,
    textIndentPx: indent,
    marginTopPx: spcBef,
    marginBottomPx: spcAft,
    lineHeightPx: hasLnSpc ? lnSpc.px : (inheritedLayout?.lineHeightPx ?? null),
    lineHeightMult: hasLnSpc ? lnSpc.mult : (inheritedLayout?.lineHeightMult ?? null),
    direction: rtlAttr ? (rtlAttr === '1' ? 'rtl' : 'ltr') : (inheritedLayout?.direction || 'ltr'),
    textAlignLast: fontAlgn
      ? (fontAlgn === 'ctr' ? 'center' : (fontAlgn === 'r' ? 'right' : (fontAlgn === 'l' ? 'left' : null)))
      : (inheritedLayout?.textAlignLast || null),
  };
}

/**
 * ECMA-376 default bodyPr insets: lIns/rIns 91440 EMU (0.1in = 9.6px at 96dpi),
 * tIns/bIns 45720 EMU (0.05in = 4.8px). PowerPoint applies these whenever the
 * attribute is absent — 0 makes text hug the box edges.
 */
const DEFAULT_INSET_LR_PX = 9.6;
const DEFAULT_INSET_TB_PX = 4.8;

export function parseTextBodyLayout(txBody: Element | null, inheritedLayout: TextBodyLayout | null = null): TextBodyLayout {
  const bodyPr = getElementByLocalName(txBody, 'bodyPr');
  if (!bodyPr) {
    return inheritedLayout || {
      paddingLeftPx: DEFAULT_INSET_LR_PX,
      paddingRightPx: DEFAULT_INSET_LR_PX,
      paddingTopPx: DEFAULT_INSET_TB_PX,
      paddingBottomPx: DEFAULT_INSET_TB_PX,
      vAlign: 'top',
      wrap: 'square',
      autofit: null,
      fontScalePct: null,
      lnSpcReductionPct: null,
    };
  }

  const anchorAttr = bodyPr.getAttribute('anchor');
  const anchor = (anchorAttr || 't').toLowerCase();
  let vAlign = 'top';
  if (anchor === 'ctr') vAlign = 'middle';
  else if (anchor === 'b') vAlign = 'bottom';

  const parseInset = (name: string, fallback = 0) => {
    const raw = bodyPr.getAttribute(name);
    if (raw === null || raw === '') return fallback;
    return emuToPx(raw);
  };

  /* Auto-fit: <a:normAutofit fontScale=".." lnSpcReduction=".."> shrinks text to
     fit; <a:spAutoFit> grows the shape; <a:noAutofit> clips. Scale attrs are in
     1000ths of a percent (62500 = 62.5%). When normAutofit has no fontScale, the
     fit is computed dynamically at render time. Inherit from layout/master when
     the slide bodyPr declares no autofit of its own. */
  let autofit = inheritedLayout?.autofit || null;
  let fontScalePct = inheritedLayout?.fontScalePct ?? null;
  let lnSpcReductionPct = inheritedLayout?.lnSpcReductionPct ?? null;

  const normAutofit = getElementByLocalName(bodyPr, 'normAutofit');
  const spAutoFit = getElementByLocalName(bodyPr, 'spAutoFit');
  const noAutofit = getElementByLocalName(bodyPr, 'noAutofit');
  if (normAutofit) {
    autofit = 'norm';
    const fs = normAutofit.getAttribute('fontScale');
    const ls = normAutofit.getAttribute('lnSpcReduction');
    fontScalePct = (fs !== null && fs !== '') ? parseInt(fs, 10) / 1000 : null;
    lnSpcReductionPct = (ls !== null && ls !== '') ? parseInt(ls, 10) / 1000 : null;
  } else if (spAutoFit) {
    autofit = 'shape';
  } else if (noAutofit) {
    autofit = 'none';
  }

  return {
    paddingLeftPx: parseInset('lIns', inheritedLayout?.paddingLeftPx ?? DEFAULT_INSET_LR_PX),
    paddingRightPx: parseInset('rIns', inheritedLayout?.paddingRightPx ?? DEFAULT_INSET_LR_PX),
    paddingTopPx: parseInset('tIns', inheritedLayout?.paddingTopPx ?? DEFAULT_INSET_TB_PX),
    paddingBottomPx: parseInset('bIns', inheritedLayout?.paddingBottomPx ?? DEFAULT_INSET_TB_PX),
    vAlign: anchorAttr ? vAlign : (inheritedLayout?.vAlign || vAlign),
    wrap: bodyPr.getAttribute('wrap') || inheritedLayout?.wrap || 'square',
    autofit,
    fontScalePct,
    lnSpcReductionPct,
  };
}
