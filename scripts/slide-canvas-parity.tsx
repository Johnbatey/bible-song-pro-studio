/* =========================================================================
   Visual parity harness for <SlideCanvas>  (dev only — never bundled)
   -------------------------------------------------------------------------
   Renders the same parsed slide twice into two 1280-wide boards:

     A — the reference's own renderer (renderMiniSlide from the prebuilt
         slide-editor bundle), driving the DOM imperatively.
     B — our <SlideCanvas>.

   Then walks both trees in parallel and compares each shape's rendered
   geometry and computed style. The DOM shapes differ by construction (React
   vs. imperative), so what is compared is what a viewer would see: box
   rectangles relative to the board, plus the paint-relevant computed
   properties.

   Vite serves this in dev at /scripts/slide-canvas-parity.tsx. It is outside
   src/ and imported by nothing, so it never reaches a production build.

   Usage from the console (see scripts/parity-slide-engine.md):
     const h = await import('/scripts/slide-canvas-parity.tsx');
     await h.run('feature-test.pptx', 0);
   ========================================================================= */
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import JSZip from 'jszip';
import { SlideCanvas } from '../src/renderer/components/SlideCanvas';
import { parseModifierSlide } from '../src/renderer/slide-engine/parser/presentation';
import { updatePptxSlideSizeFromZip, getSlideKeysInPresentationOrder } from '../src/renderer/slide-engine/core/zip-io';
import { updatePptxThemeFromZip } from '../src/renderer/slide-engine/parser/theme';
import { state, resetDeckCaches } from '../src/renderer/slide-engine/state';
import { BOARD_W, boardHeight } from '../src/renderer/slide-engine/render/slide-render-model';

declare global {
  interface Window { BSPSlideEditor: any }
}

/* The reference renderer relies on two CSS classes the editor stylesheet
   provides. Injected here so the oracle paints exactly as it does at home. */
const ORACLE_CSS = `
.se-wrap { overflow-wrap: break-word; white-space: pre-wrap; }
.se-clip { overflow: hidden; }
.se-noevents { pointer-events: none; }
.se-fill { width: 100%; height: 100%; }
.se-img { width: 100%; height: 100%; object-fit: contain; }
`;

let root: Root | null = null;

function ensureHost() {
  let host = document.getElementById('__parity-host');
  if (host) return host;

  const style = document.createElement('style');
  style.textContent = ORACLE_CSS;
  document.head.appendChild(style);

  host = document.createElement('div');
  host.id = '__parity-host';
  host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#111;overflow:auto;padding:8px;display:flex;gap:8px;flex-direction:column;';
  host.innerHTML = `
    <div style="color:#eee;font:12px system-ui">A — reference renderer</div>
    <div id="__parity-a" style="position:relative;overflow:hidden;flex:none"></div>
    <div style="color:#eee;font:12px system-ui">B — SlideCanvas</div>
    <div id="__parity-b" style="position:relative;overflow:hidden;flex:none"></div>`;
  document.body.appendChild(host);
  return host;
}

export function teardown() {
  root?.unmount();
  root = null;
  document.getElementById('__parity-host')?.remove();
}

/** Paint-relevant computed properties. Anything a viewer could see. */
const PROPS = [
  'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundRepeat', 'backgroundPosition',
  'borderTopWidth', 'borderTopColor', 'borderTopStyle', 'borderRadius',
  'boxShadow', 'clipPath', 'transform', 'opacity', 'overflow',
  'color', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle', 'textDecorationLine',
  'textAlign', 'lineHeight', 'direction', 'textIndent',
  'marginLeft', 'marginTop', 'marginBottom',
  'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom',
  'display', 'flexDirection', 'justifyContent', 'whiteSpace',
  'gridTemplateColumns', 'gridTemplateRows',
];

function styleSnapshot(el: Element) {
  const cs = getComputedStyle(el);
  const out: Record<string, string> = {};
  PROPS.forEach((p) => { out[p] = (cs as any)[p]; });
  return out;
}

function rectOf(el: Element, board: Element) {
  const a = el.getBoundingClientRect();
  const b = board.getBoundingClientRect();
  const r = (n: number) => Math.round(n * 100) / 100;
  return { x: r(a.left - b.left), y: r(a.top - b.top), w: r(a.width), h: r(a.height) };
}

/** Every text run, in document order, with the text and how it is painted. */
function runSnapshots(board: Element) {
  return Array.from(board.querySelectorAll('span')).map((s) => ({
    text: s.textContent || '',
    rect: rectOf(s, board),
    style: styleSnapshot(s),
  }));
}

/** Top-level shape boxes, in paint order. */
function shapeSnapshots(board: Element) {
  return Array.from(board.children).map((el) => ({
    rect: rectOf(el, board),
    style: styleSnapshot(el),
    svgPaths: Array.from(el.querySelectorAll('path')).map((p) => ({
      d: p.getAttribute('d'),
      fill: p.getAttribute('fill'),
      stroke: p.getAttribute('stroke'),
      strokeWidth: p.getAttribute('stroke-width'),
      dash: p.getAttribute('stroke-dasharray'),
    })),
    imgs: Array.from(el.querySelectorAll('img')).map((i) => ({
      srcLen: (i.getAttribute('src') || '').length,
      rect: rectOf(i, board),
    })),
  }));
}

export interface ParityDiff {
  where: string;
  prop: string;
  a: unknown;
  b: unknown;
}

function compare(label: string, a: any, b: any, out: ParityDiff[], path = '') {
  if (a === b) return;
  if (typeof a !== 'object' || typeof b !== 'object' || a == null || b == null) {
    if (String(a) !== String(b)) out.push({ where: label, prop: path, a, b });
    return;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.forEach((k) => compare(label, a[k], b[k], out, path ? `${path}.${k}` : k));
}

export async function run(deckName: string, slideIndex = 0, opts: { keepOpen?: boolean } = {}) {
  const O = window.BSPSlideEditor;
  if (!O) throw new Error('Load /slide-editor/slide-editor.bundle.js first.');

  ensureHost();
  const boardA = document.getElementById('__parity-a')!;
  const boardB = document.getElementById('__parity-b')!;

  const buf = await (await fetch('/__parity/' + encodeURIComponent(deckName))).arrayBuffer();
  const zip = await JSZip.loadAsync(buf, { checkCRC32: false, createFolders: false });

  resetDeckCaches();
  await updatePptxSlideSizeFromZip(zip);
  await updatePptxThemeFromZip(zip);
  const keys = await getSlideKeysInPresentationOrder(zip);
  const slide = await parseModifierSlide(zip, keys[slideIndex], slideIndex + 1);

  const h = boardHeight(state.pptxSlideSizeEmu);
  [boardA, boardB].forEach((el) => {
    (el as HTMLElement).style.width = `${BOARD_W}px`;
    (el as HTMLElement).style.height = `${h}px`;
  });

  // Oracle: same state singleton values, its own slide-size + theme, and a
  // pptx activeKind so boardH() takes the deck's aspect rather than 720.
  O.state.pptxSlideSizeEmu = { ...state.pptxSlideSizeEmu };
  O.state.slides = [slide];
  O.state.activeSlideIndex = 0;
  O.state.activeKind = () => 'pptx';
  O.parser.updatePptxThemeFromZip && (O.state.pptxThemeColorMap = new Map(state.pptxThemeColorMap));
  O.render.renderMiniSlide(slide, boardA, false);

  // Ours. renderMiniSlide uses non-dynamic autofit, so match it.
  root?.unmount();
  root = createRoot(boardB);
  root.render(createElement(SlideCanvas, {
    slide,
    slideSizeEmu: state.pptxSlideSizeEmu,
    dynamicAutofit: false,
  }));
  // setTimeout, not requestAnimationFrame: a backgrounded tab pauses rAF and
  // the harness would hang forever waiting for a frame that never comes.
  await new Promise((r) => setTimeout(r, 60));

  // <SlideCanvas> renders its own board div inside the mount node.
  const innerB = boardB.firstElementChild!;

  const diffs: ParityDiff[] = [];
  const shapesA = shapeSnapshots(boardA);
  const shapesB = shapeSnapshots(innerB);

  if (shapesA.length !== shapesB.length) {
    diffs.push({ where: 'shape count', prop: 'length', a: shapesA.length, b: shapesB.length });
  } else {
    shapesA.forEach((sa, i) => compare(`shape#${i}`, sa, shapesB[i], diffs));
  }

  const runsA = runSnapshots(boardA);
  const runsB = runSnapshots(innerB);
  if (runsA.length !== runsB.length) {
    diffs.push({ where: 'run count', prop: 'length', a: runsA.length, b: runsB.length });
  } else {
    runsA.forEach((ra, i) => compare(`run#${i}`, ra, runsB[i], diffs));
  }

  if (!opts.keepOpen) teardown();

  return {
    deck: deckName,
    slide: slideIndex,
    shapes: shapesA.length,
    runs: runsA.length,
    diffs: diffs.length,
    detail: diffs.slice(0, 12),
  };
}

export async function runDeck(deckName: string, limit = 6) {
  const results = [];
  for (let i = 0; i < limit; i++) {
    try {
      results.push(await run(deckName, i));
    } catch (e) {
      results.push({ deck: deckName, slide: i, error: String(e) });
      break;
    }
  }
  return results;
}
