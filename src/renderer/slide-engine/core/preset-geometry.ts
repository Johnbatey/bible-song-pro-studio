/* =========================================================================
   Slide engine — preset geometry path synthesis
   -------------------------------------------------------------------------
   Generates SVG path data (board-pixel space, 1280x720) for the common
   ECMA-376 preset shapes so triangles, chevrons, arrows, stars etc. stop
   rendering as rectangles. Rect/roundRect/ellipse are intentionally NOT here —
   the renderer draws those with plain CSS (border-radius), which keeps borders
   and shadows exact.

   presetGeometrySvgPath(shape, boardW, boardH) -> { d, w, h } or null when the
   preset has no generator (caller falls back to the CSS rectangle). Adjust
   values (avLst) are respected where they matter most.

   Ported from the reference editor's core/preset-geometry.js.
   ========================================================================= */

export interface PresetShapeInput {
  shapeType?: string | null;
  width: number;
  height: number;
  adjustments?: Record<string, number> | null;
}

export type PathCommand = (string | number)[];

export interface CustomSubpath {
  fill: string;
  strokeOk: boolean;
  cmds: PathCommand[];
}

export interface CustomGeometry {
  paths: CustomSubpath[];
}

const adjOf = (shape: PresetShapeInput, name: string, defVal: number): number => {
  const v = shape.adjustments ? shape.adjustments[name] : null;
  return v == null || !Number.isFinite(v) ? defVal : v;
};

/** Star: outer radius rx/ry, inner radius fraction f. */
const starPath = (points: number, w: number, h: number, f: number): string => {
  const cx = w / 2;
  const cy = h / 2;
  const step = Math.PI / points;
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const ang = -Math.PI / 2 + i * step;
    const rMulX = i % 2 === 0 ? 1 : f;
    const rMulY = i % 2 === 0 ? 1 : f;
    const x = cx + Math.cos(ang) * cx * rMulX;
    const y = cy + Math.sin(ang) * cy * rMulY;
    d += (i === 0 ? 'M' : 'L') + ` ${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d + 'Z';
};

export function presetGeometrySvgPath(
  shape: PresetShapeInput,
  boardW: number,
  boardH: number,
): { d: string; w: number; h: number } | null {
  const prst = String(shape.shapeType || '');
  const w = Math.max(1, (shape.width / 100) * (boardW || 1280));
  const h = Math.max(1, (shape.height / 100) * (boardH || 720));
  const ss = Math.min(w, h);
  const A = (name: string, def: number) => adjOf(shape, name, def) / 100000;

  let d: string | undefined;

  switch (prst) {
    case 'triangle': {
      const apex = A('adj', 50000) * w;
      d = `M ${apex} 0 L ${w} ${h} L 0 ${h} Z`;
      break;
    }
    case 'rtTriangle':
      d = `M 0 0 L 0 ${h} L ${w} ${h} Z`;
      break;
    case 'diamond':
      d = `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`;
      break;
    case 'parallelogram': {
      const o = Math.min(w, A('adj', 25000) * ss);
      d = `M ${o} 0 L ${w} 0 L ${w - o} ${h} L 0 ${h} Z`;
      break;
    }
    case 'trapezoid': {
      const o = Math.min(w / 2, A('adj', 25000) * ss);
      d = `M ${o} 0 L ${w - o} 0 L ${w} ${h} L 0 ${h} Z`;
      break;
    }
    case 'pentagon':
      d = `M ${w / 2} 0 L ${w} ${h * 0.38} L ${w * 0.81} ${h} L ${w * 0.19} ${h} L 0 ${h * 0.38} Z`;
      break;
    case 'hexagon': {
      const o = Math.min(w / 2, A('adj', 25000) * ss);
      d = `M ${o} 0 L ${w - o} 0 L ${w} ${h / 2} L ${w - o} ${h} L ${o} ${h} L 0 ${h / 2} Z`;
      break;
    }
    case 'octagon': {
      const o = Math.min(w / 2, h / 2, A('adj', 29289) * ss);
      d = `M ${o} 0 L ${w - o} 0 L ${w} ${o} L ${w} ${h - o} L ${w - o} ${h} L ${o} ${h} L 0 ${h - o} L 0 ${o} Z`;
      break;
    }
    case 'chevron': {
      const o = Math.min(w, A('adj', 50000) * ss);
      d = `M 0 0 L ${w - o} 0 L ${w} ${h / 2} L ${w - o} ${h} L 0 ${h} L ${o} ${h / 2} Z`;
      break;
    }
    case 'homePlate': {
      const o = Math.min(w, A('adj', 50000) * ss);
      d = `M 0 0 L ${w - o} 0 L ${w} ${h / 2} L ${w - o} ${h} L 0 ${h} Z`;
      break;
    }
    case 'rightArrow': {
      const bodyHalf = (Math.min(1, A('adj1', 50000)) * h) / 2;
      const headLen = Math.min(w, A('adj2', 50000) * ss);
      const ty = h / 2 - bodyHalf;
      d = `M 0 ${ty} L ${w - headLen} ${ty} L ${w - headLen} 0 L ${w} ${h / 2} L ${w - headLen} ${h} L ${w - headLen} ${h - ty} L 0 ${h - ty} Z`;
      break;
    }
    case 'leftArrow': {
      const bodyHalf = (Math.min(1, A('adj1', 50000)) * h) / 2;
      const headLen = Math.min(w, A('adj2', 50000) * ss);
      const ty = h / 2 - bodyHalf;
      d = `M ${w} ${ty} L ${headLen} ${ty} L ${headLen} 0 L 0 ${h / 2} L ${headLen} ${h} L ${headLen} ${h - ty} L ${w} ${h - ty} Z`;
      break;
    }
    case 'upArrow': {
      const bodyHalf = (Math.min(1, A('adj1', 50000)) * w) / 2;
      const headLen = Math.min(h, A('adj2', 50000) * ss);
      const tx = w / 2 - bodyHalf;
      d = `M ${tx} ${h} L ${tx} ${headLen} L 0 ${headLen} L ${w / 2} 0 L ${w} ${headLen} L ${w - tx} ${headLen} L ${w - tx} ${h} Z`;
      break;
    }
    case 'downArrow': {
      const bodyHalf = (Math.min(1, A('adj1', 50000)) * w) / 2;
      const headLen = Math.min(h, A('adj2', 50000) * ss);
      const tx = w / 2 - bodyHalf;
      d = `M ${tx} 0 L ${tx} ${h - headLen} L 0 ${h - headLen} L ${w / 2} ${h} L ${w} ${h - headLen} L ${w - tx} ${h - headLen} L ${w - tx} 0 Z`;
      break;
    }
    case 'leftRightArrow': {
      const bodyHalf = (Math.min(1, A('adj1', 50000)) * h) / 2;
      const headLen = Math.min(w / 2, A('adj2', 50000) * ss);
      const ty = h / 2 - bodyHalf;
      d = `M 0 ${h / 2} L ${headLen} 0 L ${headLen} ${ty} L ${w - headLen} ${ty} L ${w - headLen} 0 L ${w} ${h / 2} L ${w - headLen} ${h} L ${w - headLen} ${h - ty} L ${headLen} ${h - ty} L ${headLen} ${h} Z`;
      break;
    }
    case 'plus': {
      const o = Math.min(w / 2, h / 2, A('adj', 25000) * ss);
      d = `M ${o} 0 L ${w - o} 0 L ${w - o} ${o} L ${w} ${o} L ${w} ${h - o} L ${w - o} ${h - o} L ${w - o} ${h} L ${o} ${h} L ${o} ${h - o} L 0 ${h - o} L 0 ${o} L ${o} ${o} Z`;
      break;
    }
    case 'star4':
      d = starPath(4, w, h, 0.4);
      break;
    case 'star5':
      d = starPath(5, w, h, 0.5);
      break;
    case 'star6':
      d = starPath(6, w, h, 0.58);
      break;
    case 'star8':
      d = starPath(8, w, h, 0.7);
      break;
    default:
      return null;
  }

  return d ? { d, w, h } : null;
}

/* ---- custom geometry (<a:custGeom>) ----------------------------------
   Freeform vector art (Slidesgo/Freepik decks are built almost entirely from
   these). Each <a:path> declares its own coordinate space (w/h) and
   fill/stroke participation; points are normalised to 0..1 fractions at parse
   time so the renderer can scale to any pixel size. */

const getByLocal = (parent: Element | null, name: string): Element | null => {
  if (!parent) return null;
  const list = parent.getElementsByTagNameNS('*', name);
  return list && list.length ? list[0] : null;
};

export function parseCustomGeometry(custGeomNode: Element | null): CustomGeometry | null {
  const pathLst = getByLocal(custGeomNode, 'pathLst');
  if (!pathLst) return null;

  const readPt = (node: Element) => ({
    x: parseFloat(node.getAttribute('x') || '0') || 0,
    y: parseFloat(node.getAttribute('y') || '0') || 0,
  });

  const paths: CustomSubpath[] = [];
  const pathNodes = pathLst.getElementsByTagNameNS('*', 'path');

  for (let i = 0; i < pathNodes.length; i++) {
    const pathNode = pathNodes[i];
    let w = parseFloat(pathNode.getAttribute('w') || '0') || 0;
    let h = parseFloat(pathNode.getAttribute('h') || '0') || 0;
    const fillAttr = (pathNode.getAttribute('fill') || 'norm').toLowerCase();
    const strokeOk = pathNode.getAttribute('stroke') !== '0';

    const rawCmds: PathCommand[] = [];
    let cur = { x: 0, y: 0 };
    let subStart: { x: number; y: number } | null = null;
    let maxX = 1;
    let maxY = 1;
    const track = (p: { x: number; y: number }) => {
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    };

    for (let c = 0; c < pathNode.childNodes.length; c++) {
      const child = pathNode.childNodes[c] as Element;
      if (!child || child.nodeType !== 1) continue;
      const pts = Array.from(child.childNodes)
        .filter((n) => n && n.nodeType === 1 && (n as Element).localName === 'pt')
        .map((n) => readPt(n as Element));
      pts.forEach(track);

      switch (child.localName) {
        case 'moveTo':
          if (pts[0]) {
            rawCmds.push(['M', pts[0].x, pts[0].y]);
            cur = pts[0];
            subStart = pts[0];
          }
          break;
        case 'lnTo':
          if (pts[0]) {
            rawCmds.push(['L', pts[0].x, pts[0].y]);
            cur = pts[0];
          }
          break;
        case 'cubicBezTo':
          if (pts.length >= 3) {
            rawCmds.push(['C', pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[2].x, pts[2].y]);
            cur = pts[2];
          }
          break;
        case 'quadBezTo':
          if (pts.length >= 2) {
            rawCmds.push(['Q', pts[0].x, pts[0].y, pts[1].x, pts[1].y]);
            cur = pts[1];
          }
          break;
        case 'arcTo': {
          // Ellipse arc from the current point: radii wR/hR, start angle
          // stAng, sweep swAng (60000ths of a degree, clockwise with y-down —
          // same sense as SVG sweep=1).
          const wR = parseFloat(child.getAttribute('wR') || '0') || 0;
          const hR = parseFloat(child.getAttribute('hR') || '0') || 0;
          const stAng = (parseFloat(child.getAttribute('stAng') || '0') || 0) / 60000;
          const swAng = (parseFloat(child.getAttribute('swAng') || '0') || 0) / 60000;
          const rad = (dg: number) => (dg * Math.PI) / 180;
          const cx = cur.x - Math.cos(rad(stAng)) * wR;
          const cy = cur.y - Math.sin(rad(stAng)) * hR;
          const end = {
            x: cx + Math.cos(rad(stAng + swAng)) * wR,
            y: cy + Math.sin(rad(stAng + swAng)) * hR,
          };
          track(end);
          rawCmds.push([
            'A',
            wR,
            hR,
            Math.abs(swAng) > 180 ? 1 : 0,
            swAng > 0 ? 1 : 0,
            end.x,
            end.y,
          ]);
          cur = end;
          break;
        }
        case 'close':
          rawCmds.push(['Z']);
          if (subStart) cur = subStart;
          break;
      }
    }

    if (rawCmds.length === 0) continue;
    // Paths without a declared space fall back to their own bounds.
    if (w <= 0) w = maxX;
    if (h <= 0) h = maxY;

    const nx = (v: number) => Math.round((v / w) * 100000) / 100000;
    const ny = (v: number) => Math.round((v / h) * 100000) / 100000;
    const cmds: PathCommand[] = rawCmds.map((cmd) => {
      const op = cmd[0];
      if (op === 'Z') return ['Z'];
      if (op === 'A') {
        return ['A', nx(cmd[1] as number), ny(cmd[2] as number), cmd[3], cmd[4], nx(cmd[5] as number), ny(cmd[6] as number)];
      }
      const out: PathCommand = [op];
      for (let k = 1; k < cmd.length; k += 2) {
        out.push(nx(cmd[k] as number), ny(cmd[k + 1] as number));
      }
      return out;
    });

    paths.push({ fill: fillAttr, strokeOk, cmds });
  }

  return paths.length ? { paths } : null;
}

/** Emit SVG path data for one normalised subpath scaled to wPx x hPx. */
export function customGeometryPathD(subpath: CustomSubpath, wPx: number, hPx: number): string {
  const X = (v: number) => Math.round(v * wPx * 100) / 100;
  const Y = (v: number) => Math.round(v * hPx * 100) / 100;
  return subpath.cmds
    .map((cmd) => {
      const op = cmd[0];
      if (op === 'Z') return 'Z';
      if (op === 'A') {
        return `A ${X(cmd[1] as number)} ${Y(cmd[2] as number)} 0 ${cmd[3]} ${cmd[4]} ${X(cmd[5] as number)} ${Y(cmd[6] as number)}`;
      }
      const nums: string[] = [];
      for (let k = 1; k < cmd.length; k += 2) {
        nums.push(`${X(cmd[k] as number)} ${Y(cmd[k + 1] as number)}`);
      }
      return `${op} ${nums.join(', ')}`;
    })
    .join(' ');
}
