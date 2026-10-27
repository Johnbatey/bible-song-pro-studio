/**
 * Resolves a scene's stored media path against the origin serving it.
 *
 * Server-relative paths (/media/, /assets/, /themes/, /lowerthirds/, /fixtures/, /fonts/)
 * resolve against the HTTP assetBaseUrl. Absolute local filesystem paths (/Users/..., C:\...)
 * resolve using the file:// protocol so Chromium can stream the media directly.
 */
export function assetUrl(value: string | undefined, assetBaseUrl = '') {
  if (!value) return '';
  if (/^(https?:|file:|data:|blob:)/i.test(value)) return value;

  // Server-relative static endpoints
  if (
    value.startsWith('/media/') ||
    value.startsWith('/assets/') ||
    value.startsWith('/themes/') ||
    value.startsWith('/lowerthirds/') ||
    value.startsWith('/fixtures/') ||
    value.startsWith('/fonts/')
  ) {
    const base = assetBaseUrl || '';
    if (!base) return value;
    return `${base}${value}`;
  }

  // Absolute local filesystem paths
  if (value.startsWith('/') || /^[a-zA-Z]:[/\\]/.test(value)) {
    return `file://${value}`;
  }

  const base = assetBaseUrl || '';
  if (!base) return value;
  return `${base}/${value}`;
}

export function parseYouTubeId(url?: string | null): string | null {
  if (!url) return null;
  const str = url.trim();
  const match = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  if (match) return match[1];
  if (/^[\w-]{11}$/.test(str)) return str;
  return null;
}

