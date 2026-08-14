/* =========================================================================
   Slide engine — slide content parser
   -------------------------------------------------------------------------
   parsePptxSlideXmlDoc walks a slide's DrawingML shape tree in DOCUMENT
   ORDER (paint order) and produces the normalized shape list the renderer
   draws. Each <p:sp> yields a single record that carries BOTH its geometry
   styling (fill, stroke, effects, preset shape, rotation/flip) and — when it
   has real text — its paragraphs, so filled shapes with labels keep their
   look. Connectors (<p:cxnSp>), pictures, tables and chart text are emitted
   in the same pass. Master -> layout -> slide stacking is preserved by parsing
   the inherited docs first.

   Depends on core (units/color/preset-geometry), parser/shape-style,
   parser/placeholders, and core/zip-io (image + chart reads).

   Ported from the reference editor's parser/slide-parser.js.
   ========================================================================= */
import { getElementByLocalName, getXmlAttrByLocalName } from '../core/units';
import {
  parseBlipFillFromNode,
  parseLineStyle,
  parseShapeEffects,
  parseFillPaint,
  parseShapeStyleRef,
  resolveThemeColor,
} from '../core/color';
import { parseCustomGeometry, type CustomGeometry } from '../core/preset-geometry';
import { readImageDataUrlFromPartRelationship, readChartTextFromRelationship } from '../core/zip-io';
import {
  getDefaultRunStyle,
  parseParagraphLayout,
  getParagraphDefaultRunStyle,
  parseRunStyleFromProperties,
  parseTextBodyLayout,
  type RunStyle,
  type ParagraphLayout,
} from './shape-style';
import {
  getShapePlaceholderInfo,
  getPicturePlaceholderInfo,
  getGraphicFramePlaceholderInfo,
  getPlaceholderGeometry,
  getPlaceholderParagraphLayout,
  getPlaceholderTextBodyLayout,
  getPlaceholderLevelChain,
  selectBaseStyleForPlaceholder,
  type PlaceholderInfo,
  type PlaceholderGeometry,
  type StyleContext,
} from './placeholders';
import { state } from '../state';

export interface ParsedRun {
  nodeRef: Element | null;
  text: string;
  color?: string | null;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontFace?: string | null;
  fontFamily?: string | null;
  fontSize?: number | null;
  fontWeight?: number | null;
  align?: string;
  paragraphStyle?: ParagraphLayout;
}

export interface ParsedShape {
  id: string;
  kind: 'text' | 'shape' | 'image' | 'imagefill' | 'connector' | 'table';
  paragraphs: ParsedRun[][];
  left: number;
  top: number;
  width: number;
  height: number;
  [key: string]: unknown;
}

/** Presets that are stroked paths between two points rather than filled
    boxes. Rendered as SVG lines so zero-height/width extents work. */
const CONNECTOR_PRESET = /^(line$|straightConnector|bentConnector|curvedConnector)/;

interface WalkOpts {
  source: 'slide' | 'layout' | 'master';
  partPath: string;
  tag: string;
  out: ParsedShape[];
  nextId: () => number;
  groupNode?: Element | null;
}

// Parse text, shapes, and images from OpenXML with relative fidelity to PowerPoint layout.
export async function parsePptxSlideXmlDoc(
  xmlDoc: Document,
  slideNum: number | string,
  zip: any,
  slideFilename: string,
  styleContext: StyleContext | null = null,
): Promise<ParsedShape[]> {
  const slideWidthEMU = state.pptxSlideSizeEmu.cx || 12192000;
  const slideHeightEMU = state.pptxSlideSizeEmu.cy || 6858000;
  const slideDefaultRunStyle = styleContext?.defaultRunStyle || getDefaultRunStyle();

  // Offsets may legitimately be negative (art bleeding off-slide); only
  // sizes are clamped.
  const emuToPctX = (v: number) => ((v || 0) / slideWidthEMU) * 100;
  const emuToPctY = (v: number) => ((v || 0) / slideHeightEMU) * 100;
  const emuToPctW = (v: number) => (Math.max(0, v || 0) / slideWidthEMU) * 100;
  const emuToPctH = (v: number) => (Math.max(0, v || 0) / slideHeightEMU) * 100;

  const parseTransform = (node: Element | null, placeholderGeom: PlaceholderGeometry | null = null) => {
    const xfrm = getElementByLocalName(node, 'xfrm');
    const off = getElementByLocalName(xfrm, 'off');
    const ext = getElementByLocalName(xfrm, 'ext');

    const x = off ? parseInt(off.getAttribute('x') || '0', 10) : 0;
    const y = off ? parseInt(off.getAttribute('y') || '0', 10) : 0;
    const cx = ext ? parseInt(ext.getAttribute('cx') || '0', 10) : 0;
    const cy = ext ? parseInt(ext.getAttribute('cy') || '0', 10) : 0;

    const hasOwnOff = !!off;
    const fx = (!hasOwnOff && placeholderGeom) ? placeholderGeom.x : x;
    const fy = (!hasOwnOff && placeholderGeom) ? placeholderGeom.y : y;
    const fcx = (cx <= 0 && placeholderGeom) ? placeholderGeom.cx : cx;
    const fcy = (cy <= 0 && placeholderGeom) ? placeholderGeom.cy : cy;

    const rotRaw = xfrm ? parseInt(xfrm.getAttribute('rot') || '0', 10) : 0;
    const flipH = !!(xfrm && xfrm.getAttribute('flipH') === '1');
    const flipV = !!(xfrm && xfrm.getAttribute('flipV') === '1');

    const applyParentGroupTransforms = (sourceNode: Element, geom: PlaceholderGeometry) => {
      let g = { ...geom };
      let cursor: Node | null = sourceNode;

      while (cursor && cursor.parentNode) {
        const parent = cursor.parentNode as Element;
        if (parent.localName === 'grpSp') {
          const grpSpPr = getElementByLocalName(parent, 'grpSpPr');
          const gxfrm = getElementByLocalName(grpSpPr, 'xfrm');
          const goff = getElementByLocalName(gxfrm, 'off');
          const gext = getElementByLocalName(gxfrm, 'ext');
          const gchOff = getElementByLocalName(gxfrm, 'chOff');
          const gchExt = getElementByLocalName(gxfrm, 'chExt');

          const offX = goff ? parseInt(goff.getAttribute('x') || '0', 10) : 0;
          const offY = goff ? parseInt(goff.getAttribute('y') || '0', 10) : 0;
          const extX = gext ? parseInt(gext.getAttribute('cx') || '0', 10) : 0;
          const extY = gext ? parseInt(gext.getAttribute('cy') || '0', 10) : 0;
          const chOffX = gchOff ? parseInt(gchOff.getAttribute('x') || '0', 10) : 0;
          const chOffY = gchOff ? parseInt(gchOff.getAttribute('y') || '0', 10) : 0;
          const chExtX = gchExt ? parseInt(gchExt.getAttribute('cx') || '0', 10) : 0;
          const chExtY = gchExt ? parseInt(gchExt.getAttribute('cy') || '0', 10) : 0;

          const sx = (chExtX > 0 && extX > 0) ? (extX / chExtX) : 1;
          const sy = (chExtY > 0 && extY > 0) ? (extY / chExtY) : 1;

          g = {
            x: offX + Math.round((g.x - chOffX) * sx),
            y: offY + Math.round((g.y - chOffY) * sy),
            cx: Math.round(g.cx * sx),
            cy: Math.round(g.cy * sy),
          };
          // Group-level rotation is not propagated (rare; would
          // need per-child pivot math around the group center).
        }
        cursor = parent;
      }

      return g;
    };

    const mapped = applyParentGroupTransforms(node as Element, { x: fx, y: fy, cx: fcx, cy: fcy });

    return {
      left: emuToPctX(mapped.x),
      top: emuToPctY(mapped.y),
      width: emuToPctW(mapped.cx),
      height: emuToPctH(mapped.cy),
      rotationDeg: Number.isFinite(rotRaw) ? rotRaw / 60000 : 0,
      flipH,
      flipV,
    };
  };

  const parseAdjustments = (geomNode: Element | null): Record<string, number> | null => {
    const avLst = getElementByLocalName(geomNode, 'avLst');
    if (!avLst) return null;
    const out: Record<string, number> = {};
    const gds = avLst.getElementsByTagNameNS('*', 'gd');
    for (let i = 0; i < gds.length; i++) {
      const name = gds[i].getAttribute('name');
      const fmla = gds[i].getAttribute('fmla') || '';
      const m = fmla.match(/^val\s+(-?\d+)$/);
      if (name && m) out[name] = parseInt(m[1], 10);
    }
    return Object.keys(out).length ? out : null;
  };

  // Fill/stroke/effects for an sp or cxnSp, falling back to the shape's
  // <p:style> refs the way PowerPoint does for default-styled shapes.
  const computeShapeVisual = (shapeNode: Element, spPr: Element | null) => {
    const paint = parseFillPaint(spPr, null);
    const lineStyle = parseLineStyle(spPr);
    const effectStyle = parseShapeEffects(spPr);

    let fillColor: string | null = null;
    let fillGradientCss: string | null = null;
    if (paint.explicit) {
      fillColor = paint.color;
      fillGradientCss = paint.gradientCss;
    } else {
      const fillRef = parseShapeStyleRef(shapeNode, 'fillRef');
      if (fillRef && fillRef.idx > 0 && fillRef.color) fillColor = fillRef.color;
    }

    let strokeColor = lineStyle.strokeColor;
    let strokeWidthPx = lineStyle.strokeWidthPx;
    if (!lineStyle.explicit) {
      const lnRef = parseShapeStyleRef(shapeNode, 'lnRef');
      if (lnRef && lnRef.idx > 0 && lnRef.color) {
        strokeColor = lnRef.color;
        strokeWidthPx = 1;
      }
    } else if (lineStyle.needsThemeColor) {
      const lnRef = parseShapeStyleRef(shapeNode, 'lnRef');
      if (lnRef && lnRef.color) strokeColor = lnRef.color;
    }

    return {
      fillColor,
      fillGradientCss,
      strokeColor,
      strokeWidthPx,
      boxShadowCss: effectStyle.boxShadowCss,
      headArrow: lineStyle.headArrow,
      tailArrow: lineStyle.tailArrow,
      strokeDash: lineStyle.dash,
    };
  };

  const parseTextParagraphs = (
    txBody: Element,
    placeholderInfo: PlaceholderInfo | null,
    isSlideSource: boolean,
    baseStyleOverride: RunStyle | null = null,
  ): { textRuns: ParsedRun[][]; hasRealRun: boolean } => {
    const inheritedParagraphLayout = isSlideSource ? getPlaceholderParagraphLayout(styleContext, placeholderInfo) : null;
    const shapeBaseStyle = baseStyleOverride || (isSlideSource ? selectBaseStyleForPlaceholder(styleContext, placeholderInfo) : null);

    const textRuns: ParsedRun[][] = [];
    let hasRealRun = false;
    const paragraphs = txBody.getElementsByTagNameNS('*', 'p');
    for (let p = 0; p < paragraphs.length; p++) {
      const pRuns: ParsedRun[] = [];
      const pPrNode = getElementByLocalName(paragraphs[p], 'pPr');
      const lvl = Math.max(0, parseInt((pPrNode && pPrNode.getAttribute('lvl')) || '0', 10) || 0);
      const levelChain = isSlideSource ? getPlaceholderLevelChain(styleContext, placeholderInfo, lvl) : [];
      const paragraphLayout = parseParagraphLayout(paragraphs[p], txBody, inheritedParagraphLayout, levelChain);
      const paragraphDefaultStyle = getParagraphDefaultRunStyle(paragraphs[p], txBody, shapeBaseStyle || slideDefaultRunStyle, levelChain);

      for (let n = 0; n < paragraphs[p].childNodes.length; n++) {
        const node = paragraphs[p].childNodes[n] as Element;
        if (!node || !node.localName) continue;
        const local = node.localName;

        if (local === 'r' || local === 'fld') {
          const textNode = getElementByLocalName(node, 't');
          if (!textNode) continue;
          const rPr = getElementByLocalName(node, 'rPr');
          const style = parseRunStyleFromProperties(rPr, paragraphDefaultStyle);

          pRuns.push({
            nodeRef: textNode,
            text: textNode.textContent || '',
            color: style.color,
            bold: style.bold,
            italic: style.italic,
            underline: style.underline,
            fontFace: style.fontFace,
            fontSize: style.fontSizePt,
            align: paragraphLayout.align,
            paragraphStyle: paragraphLayout,
          });
        } else if (local === 'br') {
          pRuns.push({
            nodeRef: null,
            text: '\n',
            color: paragraphDefaultStyle.color,
            align: paragraphLayout.align,
            paragraphStyle: paragraphLayout,
          });
        }
      }

      if (pRuns.length > 0) {
        hasRealRun = true;
      } else {
        // Empty <a:p> = deliberate blank line. Emit a zero-width
        // space run at the paragraph's default size so the line
        // box gets PowerPoint's blank-line height.
        pRuns.push({
          nodeRef: null,
          text: '\u200B',
          color: paragraphDefaultStyle.color,
          fontFace: paragraphDefaultStyle.fontFace,
          fontSize: paragraphDefaultStyle.fontSizePt,
          align: paragraphLayout.align,
          paragraphStyle: paragraphLayout,
        });
      }
      textRuns.push(pRuns);
    }

    return { textRuns, hasRealRun };
  };

  // Editing provenance: slide-sourced shapes carry their source XML node
  // (and their top-level group, PowerPoint's click-selection unit) so
  // canvas edits can write straight back into the slide document.
  // Layout/master shapes are not editable — same as PowerPoint.
  let groupSeq = 0;
  const provenance = (node: Element, opts: WalkOpts) => {
    if (opts.source !== 'slide') return { editable: false, srcNode: null, groupNode: null, groupId: null };
    const g = (opts.groupNode || null) as (Element & { __bspGroupId?: string }) | null;
    if (g && !g.__bspGroupId) g.__bspGroupId = `grp_${slideNum}_${++groupSeq}`;
    return { editable: true, srcNode: node, groupNode: g, groupId: g ? g.__bspGroupId! : null };
  };

  const handleSp = async (sp: Element, opts: WalkOpts) => {
    const isSlideSource = opts.source === 'slide';
    const placeholderInfo = getShapePlaceholderInfo(sp);
    if (!isSlideSource && placeholderInfo && placeholderInfo.type) return; // placeholders only render on the slide

    const spPr = getElementByLocalName(sp, 'spPr');
    const txBody = getElementByLocalName(sp, 'txBody');
    const geom = getElementByLocalName(spPr, 'prstGeom');
    const custGeomNode = geom ? null : getElementByLocalName(spPr, 'custGeom');
    const prst = geom ? (geom.getAttribute('prst') || 'rect') : (custGeomNode ? 'custom' : 'rect');
    const customGeometry: CustomGeometry | null = custGeomNode ? parseCustomGeometry(custGeomNode) : null;
    const blipFillInfo = parseBlipFillFromNode(spPr);
    const placeholderGeom = isSlideSource ? getPlaceholderGeometry(styleContext, placeholderInfo) : null;
    const inheritedTextBodyLayout = isSlideSource ? getPlaceholderTextBodyLayout(styleContext, placeholderInfo) : null;
    const transform = parseTransform(spPr || sp, placeholderGeom);
    const visual = computeShapeVisual(sp, spPr);
    const adjustments = geom ? parseAdjustments(geom) : null;
    const isConnectorPrst = CONNECTOR_PRESET.test(prst);

    if (!isConnectorPrst && (transform.width <= 0 || transform.height <= 0)) return;

    const { textRuns, hasRealRun } = txBody
      ? parseTextParagraphs(txBody, placeholderInfo, isSlideSource)
      : { textRuns: [] as ParsedRun[][], hasRealRun: false };

    const imageSrc = blipFillInfo
      ? await readImageDataUrlFromPartRelationship(zip, opts.partPath, blipFillInfo.relId)
      : null;

    const nvCNvPr = sp.getElementsByTagNameNS('*', 'cNvPr')[0];
    const base = {
      ...provenance(sp, opts),
      name: nvCNvPr ? (nvCNvPr.getAttribute('name') || '') : '',
      // Kept on the record (not just used during style resolution) so
      // deck import can tell a title placeholder from body copy and
      // build a real title/body pair — see io/deck-import.ts.
      placeholder: placeholderInfo && placeholderInfo.type
        ? { type: String(placeholderInfo.type), idx: String(placeholderInfo.idx || '') }
        : null,
      left: transform.left,
      top: transform.top,
      width: transform.width,
      height: transform.height,
      rotationDeg: transform.rotationDeg,
      flipH: transform.flipH,
      flipV: transform.flipV,
      shapeType: prst,
      adjustments,
      customGeometry,
      fillColor: visual.fillColor,
      fillGradientCss: visual.fillGradientCss,
      strokeColor: visual.strokeColor,
      strokeWidthPx: visual.strokeWidthPx,
      boxShadowCss: visual.boxShadowCss,
    };

    if (hasRealRun) {
      opts.out.push({
        id: `shape_${slideNum}_${opts.tag}${opts.nextId()}`,
        kind: 'text',
        ...base,
        imageFillSrc: imageSrc,
        imageFillMode: blipFillInfo ? blipFillInfo.mode : null,
        textBoxLayout: parseTextBodyLayout(txBody, inheritedTextBodyLayout),
        paragraphs: textRuns,
      });
      return;
    }

    if (isConnectorPrst) {
      if (!visual.strokeColor) return;
      opts.out.push({
        id: `shape_${slideNum}_${opts.tag}cxn${opts.nextId()}`,
        kind: 'connector',
        ...base,
        headArrow: visual.headArrow,
        tailArrow: visual.tailArrow,
        strokeDash: visual.strokeDash,
        paragraphs: [],
      });
      return;
    }

    if (imageSrc) {
      opts.out.push({
        id: `shape_${slideNum}_${opts.tag}imgfill${opts.nextId()}`,
        kind: 'imagefill',
        ...base,
        src: imageSrc,
        fillMode: blipFillInfo!.mode,
        tileSizeX: blipFillInfo!.tileSizeX,
        tileSizeY: blipFillInfo!.tileSizeY,
        tileAlign: blipFillInfo!.tileAlign,
        srcRect: blipFillInfo!.srcRect,
        paragraphs: [],
      });
      return;
    }

    // Inherited (layout/master) decorative geometry only renders when
    // it actually paints something, so empty containers stay invisible.
    if (!isSlideSource && !visual.fillColor && !visual.fillGradientCss && !visual.strokeColor) return;

    opts.out.push({
      id: `shape_${slideNum}_${opts.tag}geom${opts.nextId()}`,
      kind: 'shape',
      ...base,
      paragraphs: [],
    });
  };

  const handleCxnSp = (cxn: Element, opts: WalkOpts) => {
    const spPr = getElementByLocalName(cxn, 'spPr');
    const geom = getElementByLocalName(spPr, 'prstGeom');
    const prst = geom ? (geom.getAttribute('prst') || 'line') : 'line';
    const transform = parseTransform(spPr || cxn, null);
    const visual = computeShapeVisual(cxn, spPr);
    if (!visual.strokeColor) return;

    opts.out.push({
      id: `shape_${slideNum}_${opts.tag}cxn${opts.nextId()}`,
      kind: 'connector',
      ...provenance(cxn, opts),
      left: transform.left,
      top: transform.top,
      width: transform.width,
      height: transform.height,
      rotationDeg: transform.rotationDeg,
      flipH: transform.flipH,
      flipV: transform.flipV,
      shapeType: prst,
      strokeColor: visual.strokeColor,
      strokeWidthPx: visual.strokeWidthPx,
      boxShadowCss: visual.boxShadowCss,
      headArrow: visual.headArrow,
      tailArrow: visual.tailArrow,
      strokeDash: visual.strokeDash,
      paragraphs: [],
    });
  };

  const handlePic = async (pic: Element, opts: WalkOpts) => {
    const isSlideSource = opts.source === 'slide';
    const placeholderInfo = getPicturePlaceholderInfo(pic);
    if (!isSlideSource && placeholderInfo && placeholderInfo.type) return;

    const spPr = getElementByLocalName(pic, 'spPr');
    const placeholderGeom = isSlideSource ? getPlaceholderGeometry(styleContext, placeholderInfo) : null;
    const transform = parseTransform(spPr || pic, placeholderGeom);
    if (transform.width <= 0 || transform.height <= 0) return;

    const blipFillInfo = parseBlipFillFromNode(pic);
    const blip = getElementByLocalName(pic, 'blip');
    const relId = getXmlAttrByLocalName(blip, 'embed') || getXmlAttrByLocalName(blip, 'link');
    const imageSrc = await readImageDataUrlFromPartRelationship(zip, opts.partPath, relId);
    if (!imageSrc && !isSlideSource) return;

    const geom = getElementByLocalName(spPr, 'prstGeom');
    const visual = computeShapeVisual(pic, spPr);
    opts.out.push({
      id: `shape_${slideNum}_${opts.tag}img${opts.nextId()}`,
      kind: 'image',
      ...provenance(pic, opts),
      left: transform.left,
      top: transform.top,
      width: transform.width,
      height: transform.height,
      rotationDeg: transform.rotationDeg,
      flipH: transform.flipH,
      flipV: transform.flipV,
      shapeType: geom ? (geom.getAttribute('prst') || 'rect') : 'rect',
      src: imageSrc,
      srcRect: blipFillInfo ? blipFillInfo.srcRect : null,
      strokeColor: visual.strokeColor,
      strokeWidthPx: visual.strokeWidthPx,
      boxShadowCss: visual.boxShadowCss,
      paragraphs: [],
    });
  };

  const handleGraphicFrame = async (frame: Element, opts: WalkOpts) => {
    const isSlideSource = opts.source === 'slide';
    const placeholderInfo = getGraphicFramePlaceholderInfo(frame);
    if (!isSlideSource && placeholderInfo && placeholderInfo.type) return;

    const placeholderGeom = isSlideSource ? getPlaceholderGeometry(styleContext, placeholderInfo) : null;
    const transform = parseTransform(frame, placeholderGeom);
    if (transform.width <= 0 || transform.height <= 0) return;

    const tbl = getElementByLocalName(frame, 'tbl');
    if (tbl) {
      // Column widths / row heights become fr ratios in the renderer.
      const tblGrid = getElementByLocalName(tbl, 'tblGrid');
      const colWidths = tblGrid
        ? Array.from(tblGrid.getElementsByTagNameNS('*', 'gridCol'))
          .map((g) => Math.max(1, parseInt(g.getAttribute('w') || '0', 10) || 1))
        : [];

      const tableBaseStyle: RunStyle = {
        ...getDefaultRunStyle(),
        color: resolveThemeColor('tx1', '#000000'),
        fontSizePt: 18,
      };

      const parseCellBorder = (tcPr: Element | null, name: string) => {
        const ln = getElementByLocalName(tcPr, name);
        if (!ln) return null;
        const paint = parseFillPaint(ln, null);
        if (!paint.explicit || !paint.color) return null;
        const wEmu = parseInt(ln.getAttribute('w') || '12700', 10);
        return {
          color: paint.color,
          widthPx: Math.max(1, Math.round((Number.isFinite(wEmu) ? wEmu : 12700) / 9525)),
        };
      };

      const rowNodes = Array.from(tbl.getElementsByTagNameNS('*', 'tr'));
      const rows = rowNodes.map((row) => {
        const heightEmu = Math.max(1, parseInt(row.getAttribute('h') || '0', 10) || 1);
        const cells = Array.from(row.getElementsByTagNameNS('*', 'tc')).map((cell) => {
          const tcPr = getElementByLocalName(cell, 'tcPr');
          const cellTxBody = getElementByLocalName(cell, 'txBody');
          const parsedText = cellTxBody
            ? parseTextParagraphs(cellTxBody, { type: '', idx: '' }, false, tableBaseStyle)
            : { textRuns: [] as ParsedRun[][] };
          const fillPaint = tcPr ? parseFillPaint(tcPr, null) : { color: null, explicit: false };
          const anchor = tcPr ? (tcPr.getAttribute('anchor') || 't') : 't';
          const inset = (name: string, defEmu: number) => {
            const raw = tcPr ? tcPr.getAttribute(name) : null;
            const v = parseInt(raw || `${defEmu}`, 10);
            return Math.round(((Number.isFinite(v) ? v : defEmu) / 9525) * 100) / 100;
          };
          return {
            paragraphs: parsedText.textRuns,
            fillColor: fillPaint.explicit ? fillPaint.color : null,
            gridSpan: Math.max(1, parseInt(cell.getAttribute('gridSpan') || '1', 10) || 1),
            rowSpan: Math.max(1, parseInt(cell.getAttribute('rowSpan') || '1', 10) || 1),
            hMerge: cell.getAttribute('hMerge') === '1',
            vMerge: cell.getAttribute('vMerge') === '1',
            anchor,
            insets: {
              l: inset('marL', 91440),
              r: inset('marR', 91440),
              t: inset('marT', 45720),
              b: inset('marB', 45720),
            },
            borders: tcPr ? {
              l: parseCellBorder(tcPr, 'lnL'),
              r: parseCellBorder(tcPr, 'lnR'),
              t: parseCellBorder(tcPr, 'lnT'),
              b: parseCellBorder(tcPr, 'lnB'),
            } : { l: null, r: null, t: null, b: null },
          };
        });
        return { heightEmu, cells };
      }).filter((row) => row.cells.length > 0);

      if (rows.length > 0) {
        opts.out.push({
          id: `shape_${slideNum}_${opts.tag}tbl${opts.nextId()}`,
          kind: 'table',
          ...provenance(frame, opts),
          left: transform.left,
          top: transform.top,
          width: transform.width,
          height: transform.height,
          colWidths,
          hasTableStyle: !!getElementByLocalName(tbl, 'tableStyleId'),
          rows,
          paragraphs: [],
        });
      }
      return;
    }

    if (!isSlideSource) return;
    const chart = getElementByLocalName(frame, 'chart');
    const chartRelId = getXmlAttrByLocalName(chart, 'id');
    if (chartRelId) {
      const chartTexts = await readChartTextFromRelationship(zip, opts.partPath, chartRelId);
      if (chartTexts.length > 0) {
        opts.out.push({
          id: `shape_${slideNum}_${opts.tag}chart${opts.nextId()}`,
          kind: 'text',
          ...provenance(frame, opts),
          left: transform.left,
          top: transform.top,
          width: transform.width,
          height: transform.height,
          paragraphs: chartTexts.map((text) => ([{
            nodeRef: null,
            text,
            color: resolveThemeColor('tx1', '#f8fafc'),
            align: 'left',
            bold: false,
            italic: false,
            underline: false,
            fontFace: null,
            fontSize: 14,
          }])),
        });
      }
    }
  };

  // Walk direct children in document order so stacking survives.
  const walkShapeTree = async (parentNode: Element | null, opts: WalkOpts) => {
    if (!parentNode) return;
    for (let i = 0; i < parentNode.childNodes.length; i++) {
      const child = parentNode.childNodes[i] as Element;
      if (!child || child.nodeType !== 1) continue;
      const local = child.localName;
      if (local === 'sp') await handleSp(child, opts);
      else if (local === 'pic') await handlePic(child, opts);
      else if (local === 'graphicFrame') await handleGraphicFrame(child, opts);
      else if (local === 'cxnSp') handleCxnSp(child, opts);
      // Descending into a group keeps the OUTERMOST group as the
      // selection unit (PowerPoint's first-click selects that).
      else if (local === 'grpSp') await walkShapeTree(child, opts.groupNode ? opts : { ...opts, groupNode: child });
    }
  };

  const makeOpts = (source: WalkOpts['source'], partPath: string, tag: string, out: ParsedShape[]): WalkOpts => {
    let counter = 0;
    return { source, partPath, tag, out, nextId: () => counter++ };
  };

  const getSpTree = (doc: Document | null) => {
    const cSld = doc ? doc.getElementsByTagNameNS('*', 'cSld')[0] : null;
    return cSld ? getElementByLocalName(cSld, 'spTree') : null;
  };

  // Paint order: master shapes at the bottom, then layout, then slide.
  const masterShapes: ParsedShape[] = [];
  if (styleContext?.masterDoc && styleContext?.layoutShowMasterSp !== false) {
    await walkShapeTree(getSpTree(styleContext.masterDoc), makeOpts('master', styleContext.masterPath as string, 'master_', masterShapes));
  }

  const layoutShapes: ParsedShape[] = [];
  if (styleContext?.layoutDoc) {
    await walkShapeTree(getSpTree(styleContext.layoutDoc), makeOpts('layout', styleContext.layoutPath as string, 'layout_', layoutShapes));
  }

  const slideShapes: ParsedShape[] = [];
  await walkShapeTree(getSpTree(xmlDoc), makeOpts('slide', slideFilename, '', slideShapes));

  const shapes = [...masterShapes, ...layoutShapes, ...slideShapes];

  // Fallback: some decks store text in structures not covered by p:sp parsing.
  if (shapes.filter((s) => s.kind === 'text' || s.kind === 'table').length === 0) {
    const textNodes = Array.from(xmlDoc.getElementsByTagNameNS('*', 't'))
      .filter((node) => node && typeof node.textContent === 'string' && node.textContent.trim().length > 0);

    if (textNodes.length > 0) {
      const fallbackParagraphs = textNodes.slice(0, 240).map((node) => ([{
        nodeRef: node,
        text: node.textContent as string,
        color: resolveThemeColor('tx1', '#f8fafc'),
        align: 'left',
      }]));

      shapes.push({
        id: `shape_${slideNum}_fallback`,
        kind: 'text',
        left: 6,
        top: 8,
        width: 88,
        height: 82,
        paragraphs: fallbackParagraphs,
      });
    }
  }

  return shapes;
}
