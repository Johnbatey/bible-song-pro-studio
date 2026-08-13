const fs = require('fs');
const path = require('path');
const { arrangeLyrics, canonicalSectionKey, prettyLabel } = require('./lyric-sections.cjs');

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

/**
 * Verse names as the operator will see them. OpenLyrics stores `v1` and `c`,
 * which used to reach the deck verbatim — a freshly imported song showed cards
 * labelled "v1" and "c" rather than "Verse 1" and "Chorus".
 *
 * Labels have to come out unique because `verseOrder` indexes by them.
 */
function labelsFor(rawNames) {
  const used = new Map();
  return rawNames.map((raw, index) => {
    const key = canonicalSectionKey(raw);
    const base = key ? prettyLabel(key) : (String(raw || '').trim() || `Slide ${index + 1}`);
    const count = (used.get(base) || 0) + 1;
    used.set(base, count);
    return count > 1 ? `${base} (${count})` : base;
  });
}

/**
 * Resolves one `<verseOrder>` token onto a parsed verse, by cascade. Real files
 * write `V1` against `<verse name="v1">`, split a long verse into `v1a`/`v1b`,
 * and suffix translations as `c_en` — so an exact match alone drops most of the
 * order it was given.
 *
 * Returns null rather than guessing. A phantom entry would surface as a missing
 * slide mid-service, which is worse than a shorter arrangement.
 */
function resolveOrderToken(token, rawNames) {
  const raw = String(token || '').trim();
  if (!raw) return -1;

  let index = rawNames.indexOf(raw);
  if (index !== -1) return index;

  const lower = raw.toLowerCase();
  index = rawNames.findIndex((name) => String(name).toLowerCase() === lower);
  if (index !== -1) return index;

  // v1a -> v1, c_en -> c
  const stripped = lower.replace(/[_-][a-z]{2,}$/, '').replace(/([a-z]+\d+)[a-z]$/, '$1');
  index = rawNames.findIndex((name) => String(name).toLowerCase() === stripped);
  if (index !== -1) return index;

  const wanted = canonicalSectionKey(stripped);
  if (!wanted) return -1;
  return rawNames.findIndex((name) => {
    const got = canonicalSectionKey(name);
    return got && got.key === wanted.key && (got.number || null) === (wanted.number || null);
  });
}

/** An order that is each verse once, in order, is what no arrangement already
    does. Storing it adds a thing to break for no change in behaviour. */
function suppressRedundant(order, labels) {
  if (order.length !== labels.length) return order;
  return order.every((name, i) => name === labels[i]) ? [] : order;
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

      const rawNames = [];
      const verseLines = [];
      const verseRe = /<verse[^>]*name=["']([^"']*)["'][^>]*>([\s\S]*?)<\/verse>/gi;
      let vMatch;
      while ((vMatch = verseRe.exec(body)) !== null) {
        const lines = vMatch[2].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
        rawNames.push(vMatch[1]);
        verseLines.push(lines.split('\n').map((l) => l.trim()).filter(Boolean));
      }

      const labels = labelsFor(rawNames);
      const verses = labels.map((name, i) => ({ name, lines: verseLines[i] }));

      /* <verseOrder> is the arrangement the format already carries, and it was
         being thrown away — so an OpenLyrics song that repeats its chorus
         imported as a straight run through the verses. */
      const orderRaw = (body.match(/<verseOrder[^>]*>([^<]+)<\/verseOrder>/i) || [])[1] || '';
      const verseOrder = [];
      const warnings = [];
      orderRaw.trim().split(/\s+/).filter(Boolean).forEach((token) => {
        const index = resolveOrderToken(token, rawNames);
        if (index !== -1) verseOrder.push(labels[index]);
        else warnings.push(`Play order names "${token}", which this song has no verse for — skipped.`);
      });

      songs.push({
        title,
        verses,
        format: 'openlyrics',
        author: authors.join(', '),
        copyright: copyright.trim(),
        ccli: ccli.trim(),
        verseOrder: suppressRedundant(verseOrder, labels),
        warnings,
      });
    }
    return songs;
  }

  /* A sheet is ChordPro if it says so. Everything past that — bracket headers,
     colon headers, chord lines, repeated choruses — is handled identically for
     both formats by lyric-sections, so the only thing this decides is what the
     result is called. */
  function looksLikeChordPro(text) {
    return /\{\s*(title|t|soc|eoc|sov|eov|sob|eob|start_of_|end_of_|comment|c)\s*[:}]/i.test(text)
      || /^\s*\[[^\]]+\]\s*$/m.test(text);
  }

  /**
   * ChordPro and plain lyrics both come through here.
   *
   * This used to be a hand-rolled loop that recognised only `^[Tag]` prefixes,
   * dropped every `{...}` directive, discarded any lyrics appearing before the
   * first tag, and treated a leading `[G]` chord as a section header. Plain text
   * with no tags at all fell through to a branch that made the whole file one
   * verse called `v1` — which is what an operator pasting a lyric sheet hit.
   */
  function parseLyricSheet(text) {
    const titleMatch = String(text).match(/\{\s*(?:title|t)\s*:\s*([^}]+)\}/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

    const { sections, verseOrder } = arrangeLyrics(text);
    if (sections.length === 0) return [];

    return [{
      title,
      verses: sections.map((section) => ({ name: section.name, lines: section.lines })),
      format: looksLikeChordPro(text) ? 'chordpro' : 'plain',
      verseOrder,
    }];
  }

  function importFile(filePath) {
    if (!fs.existsSync(filePath)) return { ok: false, error: 'File not found: ' + filePath };
    const ext = path.extname(filePath).toLowerCase();
    const content = fs.readFileSync(filePath, 'utf8');
    if (looksBinary(content)) return { ok: false, error: BINARY_ERROR };

    if (ext === '.xml' || content.trim().startsWith('<?xml') || content.trim().startsWith('<song')) {
      return { ok: true, songs: parseOpenLyrics(content), format: 'openlyrics' };
    }

    const songs = parseLyricSheet(content);
    if (songs.length > 0) return { ok: true, songs, format: songs[0].format };

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

    const songs = parseLyricSheet(text);
    if (songs.length === 0) return { ok: false, error: 'No lyrics found' };
    return { ok: true, songs, format: songs[0].format };
  }

  /** Sections a lyric sheet without importing it, for re-arranging a song that
      is already in the library. */
  function arrangeText(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return { ok: false, error: 'Nothing to arrange' };
    if (looksBinary(trimmed)) return { ok: false, error: BINARY_ERROR };
    const result = arrangeLyrics(text);
    if (result.sections.length === 0) return { ok: false, error: 'No lyrics found' };
    return { ok: true, ...result };
  }

  return { importFile, importText, arrangeText, parseOpenLyrics, parseLyricSheet, looksBinary };
}

module.exports = { createSongImportService };
