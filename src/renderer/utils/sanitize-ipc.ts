/**
 * Drop oversized data URLs before they cross Electron IPC.
 *
 * A 33 MB JPEG becomes a ~44 MB string; structured clone of that abort()s the
 * main process in ValueDeserializer. Anything already this large is unusable
 * on a slide anyway — the import path now stores a resized `/media/<id>` copy.
 */
const MAX_DATA_URL_CHARS = 2 * 1024 * 1024;

export function sanitizeForIpc<T>(value: T): T {
  return walk(value) as T;
}

function walk(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.startsWith('data:') && value.length > MAX_DATA_URL_CHARS) return '';
    return value;
  }
  if (Array.isArray(value)) return value.map(walk);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = walk(entry);
    }
    return out;
  }
  return value;
}
