import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/**
 * The phone remote's link, as something a phone can open by pointing at it.
 *
 * The link is not something anyone should have to type: it is a LAN address
 * plus a 36-character session key, and the key changes on every launch. A QR
 * turns "read the token off the Settings panel and key it into a phone" into
 * one click of a camera.
 *
 * The matrix is drawn as `<rect>` elements rather than an `<img>` from a data
 * URL or an SVG string handed to `dangerouslySetInnerHTML`. That keeps the URL
 * out of a markup path entirely — whatever ends up in the string can only ever
 * decide which squares are black — and keeps the code crisp at any size,
 * because the SVG scales by `viewBox` instead of being resampled.
 */
export function RemoteQrCode({ url, size = 132 }: { url: string; size?: number }) {
  const matrix = useMemo(() => {
    try {
      /* 0 = the smallest version that fits this URL. Error correction M is the
         usual balance for a screen-to-phone scan: enough redundancy for a
         slightly soft photo of a monitor, without inflating the grid. */
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      const count = qr.getModuleCount();
      const rows: boolean[][] = [];
      for (let row = 0; row < count; row++) {
        const cells: boolean[] = [];
        for (let col = 0; col < count; col++) cells.push(qr.isDark(row, col));
        rows.push(cells);
      }
      return { count, rows };
    } catch {
      /* A URL too long for any version renders nothing rather than a square
         that looks like a code and does not scan. */
      return null;
    }
  }, [url]);

  if (!matrix) return null;

  /* The quiet zone is part of the spec, not decoration: scanners need the
     white border to find the code's edges. 2 modules is the floor; the rest of
     the border comes from the surrounding panel. */
  const quietZone = 2;
  const span = matrix.count + quietZone * 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${span} ${span}`}
      role="img"
      aria-label="QR code for the phone remote"
      data-testid="remote-qr"
      shapeRendering="crispEdges"
      style={{ display: 'block', flex: 'none', borderRadius: 8, background: '#fff' }}
    >
      <rect width={span} height={span} fill="#fff" />
      <g fill="#000">
        {matrix.rows.map((row, r) => row.map((dark, c) => (dark ? (
          <rect key={`${r}-${c}`} x={c + quietZone} y={r + quietZone} width={1} height={1} />
        ) : null)))}
      </g>
    </svg>
  );
}
