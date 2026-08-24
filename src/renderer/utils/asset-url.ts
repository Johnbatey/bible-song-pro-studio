/**
 * Resolves a scene's stored media path against the origin serving it.
 *
 * Scenes hold server-relative paths on purpose — an absolute URL would pin a
 * saved service to whatever port the display server happened to hold that day
 * — so every surface that loads one has to supply the origin.
 */
export function assetUrl(value: string | undefined, assetBaseUrl = '') {
  if (!value) return '';
  if (/^(https?:|file:|data:|blob:)/i.test(value)) return value;
  const base = assetBaseUrl || '';
  if (!base) return value;
  if (value.startsWith('/')) return `${base}${value}`;
  return `${base}/${value}`;
}
