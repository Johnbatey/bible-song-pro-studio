/* =========================================================================
   Slide engine — font resolution
   -------------------------------------------------------------------------
   Maps a run's fontFace to a CSS font-family stack with a sensible generic
   fallback. Font names that aren't web-loaded still work if the viewer has
   them installed; otherwise they fall back to the generic family.

   Ported from the reference editor's core/fonts.js. loadInstalledFonts is not
   ported here — it populates a <select> by element id and belongs with the
   editor UI, not the renderer.
   ========================================================================= */

const SYSTEM_STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const SERIF = new Set(['Georgia', 'Times New Roman', 'Garamond', 'Merriweather', 'Playfair Display', 'Crimson Pro', 'Cambria', 'Book Antiqua', 'Palatino Linotype']);
const MONO = new Set(['Courier New', 'Courier Prime', 'DM Mono', 'Consolas', 'Monaco']);
const SCRIPT = new Set(['Dancing Script', 'Pacifico', 'Lobster']);

/* Metric-compatible substitutes for Office fonts that are often missing on
   non-Windows machines. Same glyph widths, so text wraps like PowerPoint. */
const METRIC_FALLBACKS = new Map<string, string[]>([
  ['calibri', ['Carlito']],
  ['calibri light', ['Carlito']],
  ['cambria', ['Caladea']],
  ['arial', ['Liberation Sans', 'Helvetica']],
  ['times new roman', ['Liberation Serif']],
  ['courier new', ['Liberation Mono']],
]);

export function fontFamilyFor(name: string | null | undefined): string {
  const n = String(name || '').trim();
  if (!n || n === 'System Default') return SYSTEM_STACK;

  let generic = 'sans-serif';
  if (MONO.has(n)) generic = 'monospace';
  else if (SERIF.has(n)) generic = 'serif';
  else if (SCRIPT.has(n)) generic = 'cursive';

  const quote = (f: string) => (/\s/.test(f) ? `'${f}'` : f);
  const stack = [quote(n)];
  (METRIC_FALLBACKS.get(n.toLowerCase()) || []).forEach((f) => stack.push(quote(f)));
  stack.push(generic);
  return stack.join(', ');
}

/** The curated picker list (also drives dynamic loading later). */
export const SYSTEM_FONTS = ['System Default', 'Arial', 'Helvetica', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Calibri', 'Segoe UI', 'Georgia', 'Times New Roman', 'Garamond', 'Courier New', 'Impact'];
export const GOOGLE_FONTS = ['Inter', 'Poppins', 'Montserrat', 'Roboto', 'Open Sans', 'Lato', 'Nunito', 'Oswald', 'Raleway', 'Merriweather', 'Playfair Display', 'Crimson Pro', 'Syne', 'Bebas Neue', 'Anton', 'Luckiest Guy', 'Lobster', 'Dancing Script', 'Pacifico', 'DM Mono', 'Courier Prime'];
