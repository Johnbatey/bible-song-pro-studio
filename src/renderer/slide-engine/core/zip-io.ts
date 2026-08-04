/* =========================================================================
   Slide engine — ZIP & XML part IO
   -------------------------------------------------------------------------
   A .pptx is a ZIP (OPC) package. This module reads parts out of a JSZip
   instance: XML docs, relationship (.rels) tables, embedded image media as data
   URLs, chart text, plus presentation-level helpers (slide ordering, slide
   size). Parsing of the slide *content* lives in parser/.

   Caches (xmlDocCache, slideRelsCache, slideRelsDetailCache) and the slide size
   live in state.ts and are reset per import by io/import.ts.

   Ported from the reference editor's core/zip-io.js.
   ========================================================================= */
import { extractSlideNumberFromPath, getElementByLocalName } from './units';
import { state } from '../state';

export interface RelationshipEntry {
  id: string;
  target: string;
  type: string;
}

export function resolveZipPath(basePath: string, targetPath: string | null): string | null {
  if (!targetPath) return null;
  const normalizedTarget = targetPath.replace(/\\/g, '/');
  if (normalizedTarget.startsWith('/')) return normalizedTarget.slice(1);
  if (/^[a-z]+:\/\//i.test(normalizedTarget)) return null;

  const baseParts = (basePath || '').split('/').filter(Boolean);
  if (baseParts.length > 0) baseParts.pop();

  normalizedTarget.split('/').forEach((part) => {
    if (!part || part === '.') return;
    if (part === '..') {
      if (baseParts.length > 0) baseParts.pop();
    } else {
      baseParts.push(part);
    }
  });

  return baseParts.join('/');
}

export function mimeTypeFromPath(path: string): string {
  const ext = (path.split('.').pop() || '').toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'bmp') return 'image/bmp';
  if (ext === 'svg') return 'image/svg+xml';
  if (ext === 'webp') return 'image/webp';
  return 'application/octet-stream';
}

export async function loadXmlDocFromZip(zip: any, filePath: string | null): Promise<Document | null> {
  if (!filePath) return null;
  if (state.xmlDocCache.has(filePath)) {
    return state.xmlDocCache.get(filePath) ?? null;
  }

  const f = zip.file(filePath);
  if (!f) return null;

  const xmlText = await f.async('text');
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return null;
  }

  state.xmlDocCache.set(filePath, doc);
  return doc;
}

export async function getRelationshipEntriesForPart(zip: any, partPath: string): Promise<RelationshipEntry[]> {
  if (state.slideRelsDetailCache.has(partPath)) {
    return state.slideRelsDetailCache.get(partPath) ?? [];
  }

  const relPath = partPath.replace(/\/([^/]+)$/, '/_rels/$1.rels');
  const relFile = zip.file(relPath);
  if (!relFile) {
    state.slideRelsDetailCache.set(partPath, []);
    return [];
  }

  const relText = await relFile.async('text');
  const relDoc = new DOMParser().parseFromString(relText, 'application/xml');
  const relNodes = relDoc.getElementsByTagName('Relationship');
  const entries: RelationshipEntry[] = [];

  for (let i = 0; i < relNodes.length; i++) {
    const rel = relNodes[i];
    const relId = rel.getAttribute('Id');
    const target = resolveZipPath(partPath, rel.getAttribute('Target'));
    const type = rel.getAttribute('Type') || '';
    if (relId && target) {
      entries.push({ id: relId, target, type });
    }
  }

  state.slideRelsDetailCache.set(partPath, entries);
  return entries;
}

export async function getSlideRelationshipsMap(zip: any, slideFilename: string): Promise<Map<string, string>> {
  if (state.slideRelsCache.has(slideFilename)) {
    return state.slideRelsCache.get(slideFilename) ?? new Map();
  }

  const relPath = slideFilename.replace(/\/([^/]+)$/, '/_rels/$1.rels');
  const relFile = zip.file(relPath);
  const relMap = new Map<string, string>();

  if (!relFile) {
    state.slideRelsCache.set(slideFilename, relMap);
    return relMap;
  }

  const relText = await relFile.async('text');
  const relDoc = new DOMParser().parseFromString(relText, 'application/xml');
  const relNodes = relDoc.getElementsByTagName('Relationship');

  for (let i = 0; i < relNodes.length; i++) {
    const rel = relNodes[i];
    const relId = rel.getAttribute('Id');
    const target = resolveZipPath(slideFilename, rel.getAttribute('Target'));
    if (relId && target) {
      relMap.set(relId, target);
    }
  }

  state.slideRelsCache.set(slideFilename, relMap);
  return relMap;
}

export async function readImageDataUrlFromPartRelationship(zip: any, partFilename: string, relId: string | null): Promise<string | null> {
  if (!relId) return null;
  const rels = await getSlideRelationshipsMap(zip, partFilename);
  const mediaPath = rels.get(relId);
  if (!mediaPath) return null;

  const mediaFile = zip.file(mediaPath);
  if (!mediaFile) return null;

  const base64 = await mediaFile.async('base64');
  return `data:${mimeTypeFromPath(mediaPath)};base64,${base64}`;
}

export async function readImageDataUrlFromRelationship(zip: any, slideFilename: string, relId: string | null): Promise<string | null> {
  return readImageDataUrlFromPartRelationship(zip, slideFilename, relId);
}

export async function readChartTextFromRelationship(zip: any, slideFilename: string, relId: string | null): Promise<string[]> {
  if (!relId) return [];

  const rels = await getSlideRelationshipsMap(zip, slideFilename);
  const chartPath = rels.get(relId);
  if (!chartPath) return [];

  const chartFile = zip.file(chartPath);
  if (!chartFile) return [];

  try {
    const xml = await chartFile.async('text');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const textNodes = Array.from(doc.getElementsByTagNameNS('*', 't'))
      .map((n) => (n.textContent || '').trim())
      .filter(Boolean);

    const unique: string[] = [];
    const seen = new Set<string>();
    textNodes.forEach((text) => {
      if (seen.has(text)) return;
      seen.add(text);
      unique.push(text);
    });
    return unique.slice(0, 40);
  } catch {
    return [];
  }
}

export async function updatePptxSlideSizeFromZip(zip: any): Promise<void> {
  state.pptxSlideSizeEmu = { cx: 12192000, cy: 6858000 };
  state.pptxDefaultTextStyle = null;

  const presentationFile = zip.file('ppt/presentation.xml');
  if (!presentationFile) return;

  try {
    const xml = await presentationFile.async('text');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');

    // defaultTextStyle lvl1..9 back the paragraph-property chain for plain
    // (non-placeholder) text boxes.
    const defaultTextStyle = doc.getElementsByTagNameNS('*', 'defaultTextStyle')[0];
    if (defaultTextStyle) {
      const levels: Record<string, Element | null> = {};
      for (let l = 0; l < 9; l++) {
        levels[`lvl${l + 1}pPr`] = getElementByLocalName(defaultTextStyle, `lvl${l + 1}pPr`);
      }
      state.pptxDefaultTextStyle = levels;
    }

    const sldSz = doc.getElementsByTagNameNS('*', 'sldSz')[0];
    if (!sldSz) return;

    const cx = parseInt(sldSz.getAttribute('cx') || '', 10);
    const cy = parseInt(sldSz.getAttribute('cy') || '', 10);
    if (Number.isFinite(cx) && cx > 0 && Number.isFinite(cy) && cy > 0) {
      state.pptxSlideSizeEmu = { cx, cy };
    }
  } catch {
    // Keep default 16:9 if metadata parsing fails.
  }
}

export function normalizeSlideTargetPath(targetPath: string | null): string | null {
  if (!targetPath) return null;
  const trimmed = targetPath.replace(/^\s+|\s+$/g, '').replace(/\\/g, '/');
  const withoutPrefix = trimmed.replace(/^\.?\//, '').replace(/^\.{2}\//, '');
  return withoutPrefix.startsWith('ppt/') ? withoutPrefix : `ppt/${withoutPrefix}`;
}

export async function getSlideKeysInPresentationOrder(zip: any): Promise<string[]> {
  const fallback = Object.keys(zip.files)
    .filter((name: string) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a: string, b: string) => extractSlideNumberFromPath(a) - extractSlideNumberFromPath(b));

  const presentationFile = zip.file('ppt/presentation.xml');
  const relsFile = zip.file('ppt/_rels/presentation.xml.rels');
  if (!presentationFile || !relsFile) {
    return fallback;
  }

  try {
    const parser = new DOMParser();
    const presentationText = await presentationFile.async('text');
    const relsText = await relsFile.async('text');
    const presentationXml = parser.parseFromString(presentationText, 'application/xml');
    const relsXml = parser.parseFromString(relsText, 'application/xml');

    if (
      presentationXml.getElementsByTagName('parsererror').length > 0 ||
      relsXml.getElementsByTagName('parsererror').length > 0
    ) {
      return fallback;
    }

    const relMap = new Map<string, string>();
    const relationships = relsXml.getElementsByTagName('Relationship');
    for (let i = 0; i < relationships.length; i++) {
      const rel = relationships[i];
      const relId = rel.getAttribute('Id');
      const target = normalizeSlideTargetPath(rel.getAttribute('Target'));
      if (relId && target) {
        relMap.set(relId, target);
      }
    }

    const ordered: string[] = [];
    const seen = new Set<string>();
    const sldIds = presentationXml.getElementsByTagName('p:sldId');
    for (let i = 0; i < sldIds.length; i++) {
      const relId = sldIds[i].getAttribute('r:id');
      const filePath = relId ? relMap.get(relId) : undefined;
      if (filePath && zip.file(filePath) && !seen.has(filePath)) {
        ordered.push(filePath);
        seen.add(filePath);
      }
    }

    fallback.forEach((path: string) => {
      if (!seen.has(path)) ordered.push(path);
    });

    return ordered.length > 0 ? ordered : fallback;
  } catch {
    return fallback;
  }
}
