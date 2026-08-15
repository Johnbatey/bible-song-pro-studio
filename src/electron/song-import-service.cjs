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

  let _SQL = null;
  async function getSqlInstance() {
    if (_SQL) return _SQL;
    const initSqlJs = require('sql.js');
    _SQL = await initSqlJs();
    return _SQL;
  }

  async function readSqliteTables(filePath) {
    const SQL = await getSqlInstance();
    const fileBuffer = fs.readFileSync(filePath);
    const db = new SQL.Database(fileBuffer);
    try {
      const res = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
      if (!res || !res.length || !res[0].values) return {};
      const tableNames = res[0].values.map((row) => String(row[0] || '').trim()).filter(Boolean);
      const tables = {};
      tableNames.forEach((tableName) => {
        const safeName = tableName.replace(/"/g, '""');
        const tableRes = db.exec(`SELECT rowid, * FROM "${safeName}"`);
        if (tableRes && tableRes.length && tableRes[0]) {
          const columns = tableRes[0].columns;
          const values = tableRes[0].values;
          tables[tableName] = values.map((rowValues) => {
            const obj = {};
            columns.forEach((col, idx) => {
              obj[col] = rowValues[idx];
            });
            return obj;
          });
        } else {
          tables[tableName] = [];
        }
      });
      return tables;
    } finally {
      db.close();
    }
  }

  function findTable(tables, ...names) {
    if (!tables) return [];
    const keys = Object.keys(tables);
    for (const name of names) {
      const lower = name.toLowerCase();
      const match = keys.find((k) => k.toLowerCase() === lower);
      if (match && Array.isArray(tables[match])) return tables[match];
    }
    return [];
  }

  function decodeRtfUnicode(value) {
    let text = String(value || '');
    text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
    return text.replace(/\\u(-?\d+)\??/g, (_match, rawCode) => {
      let code = Number(rawCode);
      if (!Number.isFinite(code)) return '';
      if (code < 0) code = 65536 + code;
      try {
        return String.fromCodePoint(code);
      } catch (_) {
        return '';
      }
    });
  }

  function rtfToPlainText(rtfValue) {
    const rtf = decodeRtfUnicode(rtfValue);
    let output = '';
    const stack = [];
    let ignorable = false;
    const destinationControls = new Set([
      'fonttbl', 'colortbl', 'stylesheet', 'info', 'pict',
      'object', 'datastore', 'themedata', 'generator', 'pnseclvl',
      'listtable', 'listoverridetable',
    ]);

    for (let i = 0; i < rtf.length; i += 1) {
      const ch = rtf[i];
      if (ch === '{') {
        stack.push(ignorable);
        continue;
      }
      if (ch === '}') {
        ignorable = stack.length ? stack.pop() : false;
        continue;
      }
      if (ch === '\r' || ch === '\n') {
        continue;
      }
      if (ch !== '\\') {
        if (!ignorable) output += ch;
        continue;
      }

      const next = rtf[i + 1] || '';
      if (next === '*') {
        ignorable = true;
        i += 1;
        continue;
      }
      if (next === '\\' || next === '{' || next === '}') {
        if (!ignorable) output += next;
        i += 1;
        continue;
      }
      if (next === '~') {
        if (!ignorable) output += ' ';
        i += 1;
        continue;
      }
      if (next === '-') {
        i += 1;
        continue;
      }

      const controlMatch = rtf.slice(i + 1).match(/^([a-zA-Z]+)(-?\d+)? ?/);
      if (!controlMatch) {
        i += 1;
        continue;
      }
      const control = controlMatch[1].toLowerCase();
      if (destinationControls.has(control)) ignorable = true;
      if (!ignorable) {
        if (control === 'par' || control === 'line') output += '\n';
        else if (control === 'tab') output += '\t';
      }
      i += controlMatch[0].length;
    }

    return output
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .trim();
  }

  function parseOpenLpLyrics(xml) {
    const verses = [...String(xml || '').matchAll(/<verse\b[^>]*name=["']([^"']*)["'][^>]*>([\s\S]*?)<\/verse>/gi)]
      .map((m) => {
        const verseName = m[1] || 'v1';
        const cdata = m[2].match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
        let text = cdata ? cdata[1] : m[2].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
        text = text.replace(/\{[^}]*\}/g, '');
        text = text.replace(/\[[A-G][#b♯♭]?(?:maj|min|sus|dim|aug|add|m|M)?\d{0,2}(?:\/[A-G][#b♯♭]?)?\]/g, '');
        const lines = text.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
        return { name: verseName, lines };
      })
      .filter((v) => v.lines.length > 0);
    return verses;
  }

  function importEasyWorshipDatabase(tables) {
    const titleRows = findTable(tables, 'song', 'songs', 'songwords');
    const wordRows = findTable(tables, 'word', 'words', 'songwords');

    const rowsToUse = wordRows.length ? wordRows : titleRows;

    if (!rowsToUse.length) {
      throw new Error('No song words or songs found in EasyWorship database.');
    }

    const titlesByRowId = new Map();
    titleRows.forEach((row) => {
      const rowId = Number(row && (row.rowid || row.id || row.song_id));
      if (Number.isFinite(rowId)) titlesByRowId.set(rowId, row);
    });

    const songs = rowsToUse.map((wordsRow, index) => {
      const songId = Number(wordsRow && (wordsRow.song_id || wordsRow.rowid || wordsRow.id));
      const songRow = Number.isFinite(songId) ? titlesByRowId.get(songId) : wordsRow;
      const rawText = rtfToPlainText(wordsRow && (wordsRow.words || wordsRow.words_text || wordsRow.word || wordsRow.text || ''));
      const title = (songRow && (songRow.title || songRow.song_title)) ? String(songRow.title || songRow.song_title).trim() : `EasyWorship Song ${index + 1}`;
      const author = (songRow && (songRow.author || songRow.writer)) ? String(songRow.author || songRow.writer).trim() : '';

      const { sections, verseOrder } = arrangeLyrics(rawText);
      return {
        title: title || 'Untitled EasyWorship Song',
        author,
        verses: sections.map((sec) => ({ name: sec.name, lines: sec.lines })),
        format: 'easyworship',
        verseOrder,
      };
    }).filter((s) => s.verses.length > 0);

    return songs;
  }

  function importOpenLpDatabase(tables) {
    const songsRows = findTable(tables, 'songs', 'song');

    if (!songsRows.length) {
      throw new Error('No songs table found in OpenLP database.');
    }

    const songs = songsRows.map((row, index) => {
      const title = row.title ? String(row.title).trim() : `OpenLP Song ${index + 1}`;
      const author = row.authors || row.search_title || '';
      const ccli = row.ccli_number ? String(row.ccli_number) : '';
      const copyright = row.copyright ? String(row.copyright) : '';
      const xmlLyrics = row.lyrics ? String(row.lyrics) : '';

      const verses = parseOpenLpLyrics(xmlLyrics);
      const labels = labelsFor(verses.map((v) => v.name));
      const formattedVerses = verses.map((v, i) => ({ name: labels[i] || v.name, lines: v.lines }));

      return {
        title: title || 'Untitled OpenLP Song',
        author,
        ccli,
        copyright,
        verses: formattedVerses,
        format: 'openlp',
        verseOrder: [],
      };
    }).filter((s) => s.verses.length > 0);

    return songs;
  }

  async function importFile(filePath) {
    if (!fs.existsSync(filePath)) return { ok: false, error: 'File not found: ' + filePath };
    const ext = path.extname(filePath).toLowerCase();

    // Check for SQLite database formats (EasyWorship & OpenLP)
    if (ext === '.db' || ext === '.ddb' || ext === '.sqlite' || ext === '.sqlite3') {
      try {
        const tables = await readSqliteTables(filePath);
        const hasWord = findTable(tables, 'word', 'words', 'songwords').length > 0;
        const hasSong = findTable(tables, 'song', 'songs').length > 0;

        if (hasWord || hasSong) {
          const songs = importEasyWorshipDatabase(tables);
          if (songs.length > 0) return { ok: true, songs, format: 'easyworship' };
          const openLpSongs = importOpenLpDatabase(tables);
          if (openLpSongs.length > 0) return { ok: true, songs: openLpSongs, format: 'openlp' };
        }
        return { ok: false, error: 'Unsupported SQLite database structure. EasyWorship and OpenLP databases are supported.' };
      } catch (err) {
        return { ok: false, error: 'Failed to parse database file: ' + (err.message || String(err)) };
      }
    }

    const content = fs.readFileSync(filePath, 'utf8');
    if (looksBinary(content)) return { ok: false, error: BINARY_ERROR };

    if (ext === '.xml' || content.trim().startsWith('<?xml') || content.trim().startsWith('<song')) {
      return { ok: true, songs: parseOpenLyrics(content), format: 'openlyrics' };
    }

    const songs = parseLyricSheet(content);
    if (songs.length > 0) return { ok: true, songs, format: songs[0].format };

    return { ok: false, error: 'Unrecognized format. Supported: EasyWorship (.db, .ddb), OpenLP (.sqlite, .sqlite3), OpenLyrics (.xml), ChordPro (.chordpro, .chopro), plain lyrics (.txt)' };
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
