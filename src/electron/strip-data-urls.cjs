/** A 33 MB JPEG as a data URL is ~44 MB and abort()s JSON.stringify / IPC. */
const MAX_DATA_URL_CHARS = 2 * 1024 * 1024;

function stripHugeDataUrls(value) {
  if (typeof value === 'string') {
    return value.startsWith('data:') && value.length > MAX_DATA_URL_CHARS ? '' : value;
  }
  if (Array.isArray(value)) return value.map(stripHugeDataUrls);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, entry] of Object.entries(value)) out[key] = stripHugeDataUrls(entry);
    return out;
  }
  return value;
}

function stripHugeDataUrlsFromJson(raw) {
  try {
    return JSON.stringify(stripHugeDataUrls(JSON.parse(raw)));
  } catch {
    return raw;
  }
}

module.exports = { MAX_DATA_URL_CHARS, stripHugeDataUrls, stripHugeDataUrlsFromJson };
