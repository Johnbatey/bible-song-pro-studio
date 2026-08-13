/* =========================================================================
   Bundled display fonts
   -------------------------------------------------------------------------
   The audience window and the stage window both render themed text, and both
   load from file:// where a bare font-family name resolves to nothing. Each
   installs the same @font-face set pointing at the local media server's
   /fonts/ directory.

   It lives here rather than in either entry because the two must not drift: a
   face added for the projector that the stage does not have would show up as
   the operator picking a font and the musicians' monitor quietly substituting
   another.
   ========================================================================= */

/** family, file, weight — every face shipped in public/fonts.
 *
 *  Eight of these were a Regular/Bold pair until the files behind them turned
 *  out to be GitHub 404 pages. Google ships those families as variable fonts
 *  now — which is why the static URLs a fetch went looking for did not exist —
 *  so they are one file each with a weight *range*, interpolated rather than
 *  picked from two cuts. Each range is what the file's own fvar table reports;
 *  a range wider than the font's would be silently clamped, narrower and the
 *  browser synthesises a fake bold.
 *
 *  Inter reuses the brand's InterVariable.woff2 rather than shipping a second
 *  copy of the same typeface. Poppins and Bebas Neue stay as static cuts —
 *  they are genuine files and there is nothing to fix. */
const FONTS: Array<[string, string, string]> = [
  ['Poppins', 'Poppins-Regular.ttf', '400'],
  ['Poppins', 'Poppins-Medium.ttf', '500'],
  ['Poppins', 'Poppins-Bold.ttf', '700'],
  ['Bebas Neue', 'BebasNeue-Regular.ttf', '400'],
  ['Inter', 'InterVariable.woff2', '100 900'],
  ['Montserrat', 'Montserrat-Variable.ttf', '100 900'],
  ['Roboto', 'Roboto-Variable.ttf', '100 900'],
  ['Oswald', 'Oswald-Variable.ttf', '200 700'],
  ['Crimson Pro', 'CrimsonPro-Variable.ttf', '200 900'],
  ['Playfair Display', 'PlayfairDisplay-Variable.ttf', '400 900'],
  ['Lora', 'Lora-Variable.ttf', '400 700'],
  ['Cinzel', 'Cinzel-Variable.ttf', '400 900'],
];

const formatFor = (file: string) => (file.endsWith('.woff2') ? 'woff2' : 'truetype');

const STYLE_ID = 'bsp-display-fonts';

/**
 * Install the face set, resolving files against `assetBaseUrl`.
 *
 * Re-callable: the base URL is only known after an async IPC round trip, so an
 * entry may install a fallback origin first and the real one a tick later.
 */
export function installFontFaces(assetBaseUrl: string): void {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(STYLE_ID);
  const style = existing instanceof HTMLStyleElement ? existing : document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = FONTS.map(([family, file, weight]) => (
    `@font-face{font-family:"${family}";src:url("${assetBaseUrl}/fonts/${file}") format("${formatFor(file)}");`
    + `font-weight:${weight};font-display:swap}`
  )).join('\n');
  if (!existing) document.head.appendChild(style);
}
