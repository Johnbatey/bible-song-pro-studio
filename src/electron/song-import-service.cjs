const fs = require('fs');
const path = require('path');

const NUL = String.fromCharCode(0);
const REPLACEMENT = String.fromCharCode(0xfffd);

const BINARY_ERROR = 'This looks like a binary file. ProPresenter .pro documents are not supported yet — '
  + 'supported formats are OpenLyrics (.xml), ChordPro (.chordpro, .chopro) and plain lyrics (.txt).';

// ProPresenter also uses the .pro extension, but its files are protobuf binaries. Without
// this check the ChordPro parser happily turns binary junk into a one-verse "song".
function looksBinary(text) {
  const sample = String(text || '').slice(0, 4096);
  if (!sample) return false;
  if (sample.indexOf(NUL) !== -1 || sample.indexOf(REPLACEMENT) !== -1) return true;
  let control = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code < 9 || (code > 13 && code < 32)) control++;
  }
  return control / sample.length > 0.05;
}

function createSongImportService() {

  function parseOpenLyrics(xml) {
    const songs = [];
    const songRe = /<song[^>]*>([\s\S]*?)<\/song>/gi;
    let match;
    while ((match = songRe.exec(xml)) !== null) {
      const body = match[1];
      const title = (body.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || 'Untitled';
      // OpenLyrics carries licensing metadata natively — keep it so the display can
      // show the credit footer CCLI requires.
      const authors = [];
      const authorRe = /<author[^>]*>([^<]+)<\/author>/gi;
      let aMatch;
      while ((aMatch = authorRe.exec(body)) !== null) authors.push(aMatch[1].trim());
      const copyright = (body.match(/<copyright[^>]*>([^<]+)<\/copyright>/i) || [])[1] || '';
      const ccli = (body.match(/<ccliNo[^>]*>([^<]+)<\/ccliNo>/i) || [])[1] || '';
      const verses = [];
      const verseRe = /<verse[^>]*name=["']([^"']*)["'][^>]*>([\s\S]*?)<\/verse>/gi;
      let vMatch;
      while ((vMatch = verseRe.exec(body)) !== null) {
        const lines = vMatch[2].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
        verses.push({ name: vMatch[1], lines: lines.split('\n').map((l) => l.trim()).filter(Boolean) });
      }
      songs.push({
        title,
        verses,
        format: 'openlyrics',
        author: authors.join(', '),
        copyright: copyright.trim(),
        ccli: ccli.trim(),
      });
    }
    return songs;
  }

  function parseChordPro(text) {
    const songs = [];
    const lines = text.split('\n');
    let title = 'Untitled';
    let currentVerse = null;
    const verses = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      const dirMatch = trimmed.match(/\{title:\s*([^}]+)\}/i);
      if (dirMatch) { title = dirMatch[1]; return; }
      const tagMatch = trimmed.match(/^\[([^\]]+)\]/);
      if (tagMatch) {
        const tag = tagMatch[1].toLowerCase();
        if (['verse', 'v', 'chorus', 'c', 'bridge', 'b', 'intro', 'outro', 'tag', 'pre-chorus', 'pc', 'interlude'].includes(tag) || tag.startsWith('verse') || tag.startsWith('v')) {
          if (currentVerse) verses.push(currentVerse);
          currentVerse = { name: tagMatch[1], lines: [] };
          return;
        }
      }
      if (currentVerse && trimmed && !trimmed.startsWith('{')) {
        // Strip chord annotations (words in brackets or above)
        const cleaned = trimmed.replace(/\[[^\]]+\]/g, '').trim();
        if (cleaned) currentVerse.lines.push(cleaned);
      }
    });
    if (currentVerse) verses.push(currentVerse);

    if (verses.length > 0 || title !== 'Untitled') {
      songs.push({ title, verses, format: 'chordpro' });
    }
    return songs;
  }

  function importFile(filePath) {
    if (!fs.existsSync(filePath)) return { ok: false, error: 'File not found: ' + filePath };
    const ext = path.extname(filePath).toLowerCase();
    const content = fs.readFileSync(filePath, 'utf8');
    if (looksBinary(content)) return { ok: false, error: BINARY_ERROR };

    if (ext === '.xml' || content.trim().startsWith('<?xml') || content.trim().startsWith('<song')) {
      return { ok: true, songs: parseOpenLyrics(content), format: 'openlyrics' };
    }
    if (ext === '.chordpro' || ext === '.chopro' || ext === '.pro' || ext === '.txt') {
      const songs = parseChordPro(content);
      if (songs.length > 0) return { ok: true, songs, format: 'chordpro' };
    }
    // Try chordpro format as fallback for .txt
    const songs = parseChordPro(content);
    if (songs.length > 0) return { ok: true, songs, format: 'chordpro' };

    return { ok: false, error: 'Unrecognized format. Supported: OpenLyrics (.xml), ChordPro (.chordpro, .chopro), plain lyrics (.txt)' };
  }

  function importText(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return { ok: false, error: 'File is empty' };
    if (looksBinary(trimmed)) return { ok: false, error: BINARY_ERROR };

    // OpenLyrics arrives as XML whether it came from a file or a paste
    if (trimmed.startsWith('<?xml') || trimmed.startsWith('<song')) {
      const parsed = parseOpenLyrics(trimmed);
      if (parsed.length > 0) return { ok: true, songs: parsed, format: 'openlyrics' };
      return { ok: false, error: 'XML file contained no <song> elements (expected OpenLyrics format)' };
    }

    // Try chordpro
    const songs = parseChordPro(text);
    if (songs.length > 0) return { ok: true, songs, format: 'chordpro' };
    // Treat as plain lyrics — one song, one verse
    return {
      ok: true,
      songs: [{ title: 'Imported Song', verses: [{ name: 'v1', lines: text.split('\n').filter(Boolean) }], format: 'plain' }],
      format: 'plain',
    };
  }

  return { importFile, importText, parseOpenLyrics, parseChordPro, looksBinary };
}

module.exports = { createSongImportService };
