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

/** family, file, weight — every face shipped in public/fonts. */
const FONTS: Array<[string, string, number]> = [
  ['Poppins', 'Poppins-Regular.ttf', 400],
  ['Poppins', 'Poppins-Medium.ttf', 500],
  ['Poppins', 'Poppins-Bold.ttf', 700],
  ['Inter', 'Inter-Regular.ttf', 400],
  ['Inter', 'Inter-Bold.ttf', 700],
  ['Montserrat', 'Montserrat-Regular.ttf', 400],
  ['Montserrat', 'Montserrat-Bold.ttf', 700],
  ['Roboto', 'Roboto-Regular.ttf', 400],
  ['Roboto', 'Roboto-Bold.ttf', 700],
  ['Oswald', 'Oswald-Regular.ttf', 400],
  ['Oswald', 'Oswald-Bold.ttf', 700],
  ['Crimson Pro', 'CrimsonPro-Regular.ttf', 400],
  ['Crimson Pro', 'CrimsonPro-Bold.ttf', 700],
  ['Playfair Display', 'PlayfairDisplay-Regular.ttf', 400],
  ['Playfair Display', 'PlayfairDisplay-Bold.ttf', 700],
  ['Lora', 'Lora-Regular.ttf', 400],
  ['Lora', 'Lora-Bold.ttf', 700],
  ['Cinzel', 'Cinzel-Regular.ttf', 400],
  ['Cinzel', 'Cinzel-Bold.ttf', 700],
  ['Bebas Neue', 'BebasNeue-Regular.ttf', 400],
];

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
    `@font-face{font-family:${family};src:url("${assetBaseUrl}/fonts/${file}") format("truetype");font-weight:${weight}}`
  )).join('\n');
  if (!existing) document.head.appendChild(style);
}
