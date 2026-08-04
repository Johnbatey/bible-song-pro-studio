/* =========================================================================
   Slide engine — theme colour scheme parsing
   -------------------------------------------------------------------------
   Loads the presentation theme (ppt/theme/theme1.xml) into
   state.pptxThemeColorMap, and the slide-master colour map (<a:clrMap>) into
   pptxThemeAliasMap so schemeClr references like "tx1" resolve to the right
   theme slot. core/color.ts reads both maps.

   Ported from the reference editor's parser/theme.js.
   ========================================================================= */
import { getElementByLocalName, toHexColor } from '../core/units';
import { state, freshAliasMap, type ThemeData } from '../state';
import { getRelationshipEntriesForPart } from '../core/zip-io';

export function resetPptxThemeAliasMap(): void {
  state.pptxThemeAliasMap = freshAliasMap();
}

export function updatePptxThemeAliasMapFromDoc(doc: Document | null): void {
  if (!doc) return;

  const clrMap = doc.getElementsByTagNameNS('*', 'clrMap')[0];
  if (!clrMap) return;

  const keys = ['bg1', 'tx1', 'bg2', 'tx2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
  keys.forEach((key) => {
    const mapped = clrMap.getAttribute(key);
    if (mapped) {
      state.pptxThemeAliasMap.set(key, mapped);
    }
  });
}

/**
 * Parse one theme part into a reusable bundle: colour scheme, fonts, and the
 * format-scheme fill lists (fillStyleLst / bgFillStyleLst) that back <p:bgRef>
 * and style refs. Cached per path so multi-master decks resolve each slide
 * against ITS master's theme.
 */
export async function loadThemeData(zip: any, themePath: string): Promise<ThemeData | null> {
  if (!state.pptxThemeCache) state.pptxThemeCache = new Map();
  if (state.pptxThemeCache.has(themePath)) {
    return state.pptxThemeCache.get(themePath) ?? null;
  }

  const themeFile = zip.file(themePath);
  if (!themeFile) {
    state.pptxThemeCache.set(themePath, null);
    return null;
  }

  const data: ThemeData = {
    colorMap: new Map(),
    fonts: { major: null, minor: null },
    fillStyles: [],
    bgFillStyles: [],
  };

  try {
    const xml = await themeFile.async('text');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');

    const fontScheme = doc.getElementsByTagNameNS('*', 'fontScheme')[0];
    if (fontScheme) {
      const major = getElementByLocalName(fontScheme, 'majorFont');
      const minor = getElementByLocalName(fontScheme, 'minorFont');
      const majLatin = major && getElementByLocalName(major, 'latin');
      const minLatin = minor && getElementByLocalName(minor, 'latin');
      const majName = majLatin && (majLatin.getAttribute('typeface') || '').trim();
      const minName = minLatin && (minLatin.getAttribute('typeface') || '').trim();
      if (majName) data.fonts.major = majName;
      if (minName) data.fonts.minor = minName;
    }

    const clrScheme = doc.getElementsByTagNameNS('*', 'clrScheme')[0];
    if (clrScheme) {
      for (let i = 0; i < clrScheme.children.length; i++) {
        const entry = clrScheme.children[i];
        const name = entry.localName;
        if (!name) continue;

        const srgb = getElementByLocalName(entry, 'srgbClr');
        if (srgb && srgb.getAttribute('val')) {
          data.colorMap.set(name, toHexColor(srgb.getAttribute('val'), '#f8fafc'));
          continue;
        }

        const sys = getElementByLocalName(entry, 'sysClr');
        if (sys) {
          const lastClr = sys.getAttribute('lastClr') || sys.getAttribute('val');
          data.colorMap.set(name, toHexColor(lastClr, '#f8fafc'));
        }
      }
    }

    const collectFillNodes = (containerName: string): Element[] => {
      const container = doc.getElementsByTagNameNS('*', containerName)[0];
      if (!container) return [];
      const out: Element[] = [];
      for (let i = 0; i < container.children.length; i++) {
        if (container.children[i].localName) out.push(container.children[i]);
      }
      return out;
    };
    data.fillStyles = collectFillNodes('fillStyleLst');
    data.bgFillStyles = collectFillNodes('bgFillStyleLst');
  } catch {
    // Partial data is fine; missing parts fall back downstream.
  }

  state.pptxThemeCache.set(themePath, data);
  return data;
}

export function applyThemeData(data: ThemeData | null): void {
  state.pptxThemeColorMap = data ? data.colorMap : new Map();
  state.pptxThemeFonts = data ? data.fonts : { major: null, minor: null };
  state.pptxThemeFmtScheme = data
    ? { fillStyles: data.fillStyles, bgFillStyles: data.bgFillStyles }
    : { fillStyles: [], bgFillStyles: [] };
}

/**
 * Initial load at import time (theme1 as the default before any slide's master
 * is known). Resets the per-deck theme cache.
 */
export async function updatePptxThemeFromZip(zip: any): Promise<void> {
  state.pptxThemeCache = new Map();
  resetPptxThemeAliasMap();
  applyThemeData(await loadThemeData(zip, 'ppt/theme/theme1.xml'));
}

/**
 * Activate the theme belonging to a specific slide master (multi-master decks
 * reference theme2.xml etc.). Called per slide parse.
 */
export async function applyThemeForMasterPath(zip: any, masterPath: string): Promise<void> {
  try {
    const rels = await getRelationshipEntriesForPart(zip, masterPath);
    const themeRel = rels.find((rel) => rel.type.includes('/theme'));
    if (!themeRel) return;
    const data = await loadThemeData(zip, themeRel.target);
    if (data) applyThemeData(data);
  } catch {
    // Keep the currently active theme on failure.
  }
}
