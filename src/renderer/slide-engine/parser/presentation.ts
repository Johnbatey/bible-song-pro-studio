/* =========================================================================
   Slide engine — presentation-level parsing (style context + slide assembly)
   -------------------------------------------------------------------------
   resolveSlideStyleContext walks slide -> layout -> master to build the
   inherited style/geometry context a slide is parsed against (background,
   default/title/other run styles, placeholder maps, master/layout docs). It
   also merges the master color map into the theme alias map.

   parseModifierSlide turns one slide part into a normalized record, and
   ensureModifierSlideParsed lazily parses a slide on demand (slides are parsed
   progressively after import — see io/import.ts for the scheduling).

   Ported from the reference editor's parser/presentation.js.
   ========================================================================= */
import { getRelationshipEntriesForPart, loadXmlDocFromZip } from '../core/zip-io';
import {
  parseSlideBackgroundColor,
  getDefaultRunStyle,
  getTxStyleSetFromDoc,
  parseRunStyleFromProperties,
} from './shape-style';
import { resetPptxThemeAliasMap, applyThemeForMasterPath, updatePptxThemeAliasMapFromDoc } from './theme';
import {
  extractPlaceholderGeometryMapFromDoc,
  extractPlaceholderParagraphLayoutMapFromDoc,
  extractPlaceholderTextBodyLayoutMapFromDoc,
  extractPlaceholderStyleMapFromLayoutDoc,
  extractPlaceholderListStyleMapFromDoc,
  type StyleContext,
} from './placeholders';
import { parsePptxSlideXmlDoc } from './slide-parser';
import { state, type ParsedSlide } from '../state';

export async function resolveSlideStyleContext(zip: any, slideFilename: string, slideXmlDoc: Document): Promise<StyleContext> {
  const context: StyleContext = {
    backgroundColor: parseSlideBackgroundColor(slideXmlDoc),
    defaultRunStyle: getDefaultRunStyle(),
    titleRunStyle: getDefaultRunStyle(),
    otherRunStyle: getDefaultRunStyle(),
    placeholderStyleMap: new Map(),
    placeholderGeometryMap: new Map(),
    placeholderParagraphLayoutMap: new Map(),
    placeholderTextBodyLayoutMap: new Map(),
    placeholderLstStyleMaps: { layout: new Map(), master: new Map() },
    layoutDoc: null,
    layoutPath: null,
    masterDoc: null,
    masterPath: null,
    layoutShowMasterSp: true,
  };

  const slideRels = await getRelationshipEntriesForPart(zip, slideFilename);
  const layoutRel = slideRels.find((rel) => rel.type.includes('/slideLayout'));
  if (!layoutRel) {
    return context;
  }

  const layoutRels = await getRelationshipEntriesForPart(zip, layoutRel.target);
  const masterRel = layoutRels.find((rel) => rel.type.includes('/slideMaster'));
  if (masterRel) {
    const masterDoc = await loadXmlDocFromZip(zip, masterRel.target);
    context.masterDoc = masterDoc;
    context.masterPath = masterRel.target;
    // Activate THIS master's theme + color map before any color below
    // is resolved (multi-master decks have different themes per master).
    resetPptxThemeAliasMap();
    await applyThemeForMasterPath(zip, masterRel.target);
    updatePptxThemeAliasMapFromDoc(masterDoc);
    context.backgroundColor = parseSlideBackgroundColor(masterDoc, context.backgroundColor as string);

    const masterSet = getTxStyleSetFromDoc(masterDoc);
    context.defaultRunStyle = parseRunStyleFromProperties(masterSet.body, context.defaultRunStyle!);
    context.titleRunStyle = parseRunStyleFromProperties(masterSet.title, context.defaultRunStyle);
    context.otherRunStyle = parseRunStyleFromProperties(masterSet.other, context.defaultRunStyle);
    context.placeholderGeometryMap = extractPlaceholderGeometryMapFromDoc(masterDoc);
    context.placeholderLstStyleMaps!.master = extractPlaceholderListStyleMapFromDoc(masterDoc);

    const masterParagraphMap = extractPlaceholderParagraphLayoutMapFromDoc(masterDoc);
    masterParagraphMap.forEach((value, key) => {
      context.placeholderParagraphLayoutMap!.set(key, value);
    });

    const masterTextBodyMap = extractPlaceholderTextBodyLayoutMapFromDoc(masterDoc);
    masterTextBodyMap.forEach((value, key) => {
      context.placeholderTextBodyLayoutMap!.set(key, value);
    });
  }

  const layoutDoc = await loadXmlDocFromZip(zip, layoutRel.target);
  context.layoutDoc = layoutDoc;
  context.layoutPath = layoutRel.target;
  const layoutRoot = layoutDoc ? layoutDoc.getElementsByTagNameNS('*', 'sldLayout')[0] : null;
  const showMasterSpAttr = layoutRoot ? layoutRoot.getAttribute('showMasterSp') : null;
  context.layoutShowMasterSp = showMasterSpAttr === null ? true : showMasterSpAttr !== '0';
  context.backgroundColor = parseSlideBackgroundColor(layoutDoc, context.backgroundColor as string);

  const layoutSet = getTxStyleSetFromDoc(layoutDoc);
  context.defaultRunStyle = parseRunStyleFromProperties(layoutSet.body, context.defaultRunStyle);
  context.titleRunStyle = parseRunStyleFromProperties(layoutSet.title, context.titleRunStyle);
  context.otherRunStyle = parseRunStyleFromProperties(layoutSet.other, context.otherRunStyle);
  context.placeholderStyleMap = extractPlaceholderStyleMapFromLayoutDoc(layoutDoc, context);
  context.placeholderLstStyleMaps!.layout = extractPlaceholderListStyleMapFromDoc(layoutDoc);

  const layoutGeomMap = extractPlaceholderGeometryMapFromDoc(layoutDoc);
  layoutGeomMap.forEach((value, key) => {
    context.placeholderGeometryMap!.set(key, value);
  });

  // Pass the master-populated maps as the base so layout placeholders with
  // empty bodyPr inherit master values (autofit, insets, vAlign) rather than
  // overwriting them with defaults — yielding slide <- layout <- master.
  const layoutParagraphMap = extractPlaceholderParagraphLayoutMapFromDoc(layoutDoc, context.placeholderParagraphLayoutMap!);
  layoutParagraphMap.forEach((value, key) => {
    context.placeholderParagraphLayoutMap!.set(key, value);
  });

  const layoutTextBodyMap = extractPlaceholderTextBodyLayoutMapFromDoc(layoutDoc, context.placeholderTextBodyLayoutMap!);
  layoutTextBodyMap.forEach((value, key) => {
    context.placeholderTextBodyLayoutMap!.set(key, value);
  });

  context.backgroundColor = parseSlideBackgroundColor(slideXmlDoc, context.backgroundColor as string);
  return context;
}

export async function parseModifierSlide(zip: any, filename: string, slideId: number | string): Promise<ParsedSlide> {
  const slideFile = zip.file(filename);
  if (!slideFile) {
    throw new Error(`Slide XML missing inside package: ${filename}`);
  }

  const xmlText = await slideFile.async('text');
  const xmlDoc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    throw new Error(`Slide XML parse failed: ${filename}`);
  }

  const styleContext = await resolveSlideStyleContext(zip, filename, xmlDoc);

  return {
    id: slideId,
    kind: 'pptx',
    filename,
    backgroundColor: styleContext.backgroundColor as string,
    shapes: await parsePptxSlideXmlDoc(xmlDoc, slideId, zip, filename, styleContext),
    xmlDoc,
    parsed: true,
  };
}

/* Fields the HOST owns, not the parser: they come from the app's library record
   and have no source in the .pptx. Parsing replaces the whole slide object, so
   without carrying these across, every slide except the first — the only one
   parsed synchronously at open — silently loses its hi-fi background and
   metadata as background parsing catches up. */
const HOST_OWNED_SLIDE_FIELDS = [
  'bspSlideId',
  'previewDataUrl',
  'thumbDataUrl',
  'title',
  'notes',
  'label',
  'transition',
  'hidden',
  'body',
  'pptxDirty',
];

export function carryHostFields(fromSlide: ParsedSlide | null, toSlide: ParsedSlide | null): ParsedSlide | null {
  if (!fromSlide || !toSlide) return toSlide;
  HOST_OWNED_SLIDE_FIELDS.forEach((key) => {
    if (fromSlide[key] !== undefined && toSlide[key] === undefined) {
      toSlide[key] = fromSlide[key];
    }
  });
  return toSlide;
}

export async function ensureModifierSlideParsed(idx: number): Promise<ParsedSlide | undefined> {
  const slide = state.slides[idx];
  if (!slide || slide.parsed) return slide;
  if (!state.loadedPptxZip) throw new Error('No PPTX package loaded.');

  const parsed = await parseModifierSlide(state.loadedPptxZip, slide.filename as string, slide.id);
  carryHostFields(slide, parsed);
  state.slides[idx] = parsed;
  return parsed;
}
