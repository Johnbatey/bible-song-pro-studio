/**
 * Turns a lyric sheet into labelled sections plus a play order.
 *
 * This lives in main rather than the renderer for two reasons. The defect it
 * exists to fix is main's: `importText`'s plain-text fallback put an entire
 * pasted sheet into one verse named `v1`, so a song someone pasted arrived as
 * a single unprojectable slab. And the heuristic below is the part most worth
 * pinning with fixtures — `scripts/verify-*.cjs` require `src/electron/*.cjs`
 * directly, which is a path a renderer TypeScript util does not have.
 *
 * Nothing here touches fs, Electron, or any state. It is a pure function set
 * so the verifier can exercise the real code rather than a copy of it.
 */

/* tokenize/ngrams are deliberately duplicated from
   src/renderer/utils/song-detection.ts rather than shared. That file is
   renderer TypeScript and these twelve lines cannot be required from a .cjs
   without a build step. The algorithm is the same on purpose: both are asking
   "are these two pieces of lyric the same words". */
function tokenize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function ngrams(tokens, n) {
  const out = new Set();
  for (let i = 0; i + n <= tokens.length; i++) out.add(tokens.slice(i, i + n).join(' '));
  return out;
}

/* One lexicon, shared by the plain-text header detector and the OpenLyrics
   <verseOrder> resolver, so that a file whose order says `c` and whose verse
   is named `chorus` still lines up. */
const SECTION_LEXICON = new Map([
  ['verse', 'verse'], ['v', 'verse'],
  ['chorus', 'chorus'], ['c', 'chorus'], ['refrain', 'chorus'],
  ['prechorus', 'prechorus'], ['pc', 'prechorus'], ['p', 'prechorus'],
  ['bridge', 'bridge'], ['b', 'bridge'],
  ['intro', 'intro'],
  ['outro', 'outro'], ['ending', 'outro'], ['end', 'outro'],
  ['tag', 'tag'],
  ['vamp', 'vamp'],
  ['interlude', 'interlude'], ['instrumental', 'interlude'],
  ['coda', 'coda'],
  ['hook', 'hook'],
  ['rap', 'rap'],
  ['channel', 'channel'],
]);

const PRETTY = {
  verse: 'Verse',
  chorus: 'Chorus',
  prechorus: 'Pre-Chorus',
  bridge: 'Bridge',
  intro: 'Intro',
  outro: 'Outro',
  tag: 'Tag',
  vamp: 'Vamp',
  interlude: 'Interlude',
  coda: 'Coda',
  hook: 'Hook',
  rap: 'Rap',
  channel: 'Channel',
};

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8 };

/** Blocks above this skip the O(n²) repetition pass — a pathological paste
    should degrade to "no repeats found", not hang the IPC round trip. */
const MAX_BLOCKS_FOR_REPEATS = 200;

/** Two blocks are the same section at or above this similarity. */
const REPEAT_THRESHOLD = 0.6;

/**
 * "Verse 1", "V1", "PRE-CHORUS 2", "Chorus:" -> { key, number }.
 * Returns null for anything not in the lexicon, which is what makes
 * `[G]Amazing grace` a lyric line and `[Chorus]` a header.
 */
function canonicalSectionKey(raw) {
  const norm = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[:.\-–—]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!norm) return null;

  let word = norm;
  let number = null;

  const digit = norm.match(/^(.*?)[\s-]*(\d{1,2})$/);
  if (digit) {
    word = digit[1].trim();
    number = Number(digit[2]);
  } else {
    const roman = norm.match(/^(.+?)\s+([ivx]{1,4})$/);
    if (roman && ROMAN[roman[2]]) {
      word = roman[1].trim();
      number = ROMAN[roman[2]];
    }
  }

  const key = SECTION_LEXICON.get(word) || SECTION_LEXICON.get(word.replace(/[\s-]/g, ''));
  if (!key) return null;
  return { key, number };
}

function prettyLabel(section) {
  if (!section) return '';
  const base = PRETTY[section.key] || section.key;
  return section.number ? `${base} ${section.number}` : base;
}

/* A line of nothing but chords. "Chords above lyrics" is the most common shape
   a worship leader pastes, and every one of those lines used to become a lyric. */
const CHORD_TOKEN = /^[A-G](#|b)?(maj|min|sus|dim|aug|add|m|M)?\d{0,2}(\/[A-G](#|b)?)?$/;

function isChordLine(line) {
  const tokens = String(line || '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((token) => CHORD_TOKEN.test(token));
}

const CREDIT_LINE = /^(ccli|©|\(c\)\s|copyright|words and music|music and words|used by permission|all rights reserved)/i;

/** ChordPro environment directives. `{soc}` and friends were dropped entirely
    before this — the old parser skipped every line starting with `{`. */
function environmentFor(line) {
  const m = String(line).trim().match(/^\{\s*(start_of_|end_of_|so|eo)([a-z]+)\s*(?::\s*([^}]*))?\}$/i);
  if (!m) return null;
  const closing = /^(end_of_|eo)$/i.test(m[1]);
  // {soc} leaves "c" in m[2]; {start_of_chorus} leaves "chorus". The lexicon
  // takes either, so both forms resolve without special-casing.
  const section = canonicalSectionKey(m[3] || m[2]);
  if (!section) return null;
  return { closing, section };
}

/** `{comment: Bridge}` / `{c: Verse 2}` used as a header, which is how a lot of
    real ChordPro in the wild marks sections. */
function commentHeaderFor(line) {
  const m = String(line).trim().match(/^\{\s*(?:comment|c|ci|comment_italic)\s*:\s*([^}]+)\}$/i);
  if (!m) return null;
  return canonicalSectionKey(m[1]);
}

/**
 * A header line, or null. Whole-line only: the old parser matched `^\[...\]` as
 * a prefix, so the chord in `[G]Amazing grace` opened a new section, and
 * `tag.startsWith('v')` meant `[Vamp]` and the chord `[V/G]` did too.
 */
function headerFor(line) {
  const trimmed = String(line).trim();

  const bracket = trimmed.match(/^\[([^\]]+)\]$/);
  if (bracket) {
    const section = canonicalSectionKey(bracket[1]);
    return section ? { section, literal: bracket[1].trim() } : null;
  }

  const comment = commentHeaderFor(trimmed);
  if (comment) return { section: comment, literal: null };

  // Bare word header: "Chorus", "Verse 2:", "PC1". Requires the whole line.
  const bare = trimmed.match(/^([A-Za-z][A-Za-z \-]*?[ \-]*\d{0,2})\s*:?\s*$/);
  if (bare) {
    const section = canonicalSectionKey(bare[1]);
    if (section) return { section, literal: trimmed.replace(/:\s*$/, '').trim(), bare: true };
  }

  return null;
}

/**
 * Rules 1-5: split into blocks, naming the ones the sheet named itself.
 * Returns blocks plus which rule fired, because the caller turns that into a
 * confidence the UI shows the operator.
 */
function splitSections(text) {
  const rawLines = String(text || '').split('\n');

  // Pass 0 — drop what is not lyric.
  const lines = [];
  rawLines.forEach((line) => {
    const trimmed = line.trim();
    if (CREDIT_LINE.test(trimmed)) return;
    if (isChordLine(trimmed)) return;
    lines.push(trimmed);
  });

  const blocks = [];
  let current = null;
  let sawHeader = false;
  let inEnvironment = false;

  function open(name, explicit) {
    if (current && current.lines.length === 0) blocks.pop();
    current = { name: name || null, lines: [], explicit: Boolean(explicit) };
    blocks.push(current);
  }

  lines.forEach((line) => {
    if (!line) return;

    const env = environmentFor(line);
    if (env) {
      sawHeader = true;
      if (env.closing) {
        inEnvironment = false;
        current = null;
      } else {
        inEnvironment = true;
        open(prettyLabel(env.section), true);
      }
      return;
    }

    const header = headerFor(line);
    if (header && !inEnvironment) {
      sawHeader = true;
      /* Keep the sheet's own wording when it gave one — an operator who typed
         "Chorus 2" should not find it renamed to "Chorus". */
      open(header.literal ? header.literal : prettyLabel(header.section), true);
      return;
    }

    if (line.startsWith('{')) return; // any other directive: not lyric

    /* Lyrics before the first header used to vanish, because the old parser
       had no open section to put them in. */
    if (!current) open(null, false);
    current.lines.push(stripInlineChords(line));
  });

  const named = blocks.filter((b) => b.lines.length > 0);
  if (sawHeader && named.length > 0) return { blocks: named, rule: 'headers' };

  // Rule 4 — blank-line blocks.
  const byBlank = [];
  let block = null;
  lines.forEach((line) => {
    if (!line) { block = null; return; }
    if (line.startsWith('{')) return;
    if (!block) { block = { name: null, lines: [], explicit: false }; byBlank.push(block); }
    block.lines.push(stripInlineChords(line));
  });
  if (byBlank.length >= 2) return { blocks: byBlank, rule: 'blank-lines' };

  // Rule 5 — no structure at all. Quatrains, and say so.
  const all = lines.filter(Boolean).map(stripInlineChords);
  if (all.length === 0) return { blocks: [], rule: 'empty' };
  if (byBlank.length === 1 && all.length <= 4) return { blocks: byBlank, rule: 'blank-lines' };

  const chunks = [];
  for (let i = 0; i < all.length; i += 4) {
    chunks.push({ name: null, lines: all.slice(i, i + 4), explicit: false });
  }
  return { blocks: chunks, rule: 'chunked' };
}

/* Inline chords are stripped only after header detection has run, so that
   `[Chorus]` is still a whole-line bracket when it is tested. */
function stripInlineChords(line) {
  const cleaned = String(line).replace(/\[[^\]]*\]/g, '').trim();
  return cleaned || String(line).trim();
}

function signatureFor(lines) {
  const tokens = tokenize(lines.join(' '));
  return { grams: ngrams(tokens, 4), tokens };
}

function similarity(a, b) {
  /* min() rather than a union denominator, deliberately. A chorus sung the
     second time with an extra "oh oh" tail is the same chorus, and scores ~1.0
     here where Jaccard would score ~0.7 — and a threshold loose enough to
     catch it under Jaccard would also merge two different verses that share a
     refrain line. */
  if (a.grams.size === 0 || b.grams.size === 0) {
    return a.tokens.join(' ') === b.tokens.join(' ') ? 1 : 0;
  }
  let intersection = 0;
  a.grams.forEach((gram) => { if (b.grams.has(gram)) intersection += 1; });
  return intersection / Math.min(a.grams.size, b.grams.size);
}

const GENERIC_NAME = /^(slide\s*\d*|untitled|v\d*|verse\s*\d*|section\s*\d*)$/i;

function isGeneric(name) {
  return !name || GENERIC_NAME.test(String(name).trim());
}

/**
 * Rule 6. Collapses repeated blocks into one section and turns their document
 * positions into a play order, then names what it can.
 *
 * The collapse is the whole point: a sheet with the chorus typed out three
 * times becomes four slides and a seven-entry order, rather than seven slides
 * where fixing a typo in the chorus means fixing it three times.
 */
function inferRepeats(blocks) {
  const warnings = [];
  if (blocks.length === 0) return { sections: [], order: [], warnings };

  const signatures = blocks.map((b) => signatureFor(b.lines));
  const clusterOf = blocks.map(() => -1);
  const clusters = [];

  if (blocks.length > MAX_BLOCKS_FOR_REPEATS) {
    warnings.push(`Too many sections (${blocks.length}) to check for repeats — left as written.`);
    blocks.forEach((_, i) => { clusterOf[i] = i; clusters.push([i]); });
  } else {
    blocks.forEach((block, i) => {
      for (let c = 0; c < clusters.length; c++) {
        const head = clusters[c][0];
        /* Two blocks the sheet named differently stay apart even when the text
           matches — the operator said they were different. */
        const namesAgree = (isGeneric(block.name) && isGeneric(blocks[head].name))
          || String(block.name).toLowerCase() === String(blocks[head].name).toLowerCase();
        if (namesAgree && similarity(signatures[i], signatures[head]) >= REPEAT_THRESHOLD) {
          clusters[c].push(i);
          clusterOf[i] = c;
          return;
        }
      }
      clusterOf[i] = clusters.length;
      clusters.push([i]);
    });
  }

  const names = clusters.map((members) => blocks[members[0]].name);

  // The chorus: the biggest thing that repeats and is not how the song opens.
  let chorusCluster = -1;
  clusters.forEach((members, c) => {
    if (members.length < 2 || members.includes(0)) return;
    if (!isGeneric(names[c])) return;
    if (chorusCluster === -1 || members.length > clusters[chorusCluster].length) chorusCluster = c;
  });
  if (chorusCluster !== -1) names[chorusCluster] = 'Chorus';

  if (chorusCluster !== -1) {
    const chorusAt = new Set(clusters[chorusCluster]);

    // Always sits immediately before a chorus -> pre-chorus.
    clusters.forEach((members, c) => {
      if (c === chorusCluster || members.length < 2 || !isGeneric(names[c])) return;
      if (members.every((i) => chorusAt.has(i + 1))) names[c] = 'Pre-Chorus';
    });

    /* One block that never repeats, arriving after the song has already been
       round the chorus twice, is a bridge. V-C-V-C-B-C is common enough to
       infer; anything less certain keeps its number. */
    if (chorusAt.size >= 2) {
      const verseLengths = clusters
        .filter((m, c) => c !== chorusCluster && isGeneric(names[c]))
        .map((m) => blocks[m[0]].lines.length);
      const meanVerse = verseLengths.length
        ? verseLengths.reduce((a, b) => a + b, 0) / verseLengths.length
        : 0;
      const secondChorus = clusters[chorusCluster][1];
      clusters.forEach((members, c) => {
        if (c === chorusCluster || members.length !== 1 || !isGeneric(names[c])) return;
        if (members[0] > secondChorus && blocks[members[0]].lines.length < meanVerse) {
          names[c] = 'Bridge';
        }
      });
    }
  }

  // Everything still generic numbers as a verse, in first-appearance order.
  let verseNumber = 0;
  clusters.forEach((members, c) => {
    if (!isGeneric(names[c])) return;
    verseNumber += 1;
    names[c] = `Verse ${verseNumber}`;
  });

  // Names index the order, so they have to be unique.
  const seen = new Map();
  names.forEach((name, c) => {
    const count = (seen.get(name) || 0) + 1;
    seen.set(name, count);
    if (count > 1) names[c] = `${name} (${count})`;
  });

  const sections = clusters.map((members, c) => ({
    name: names[c],
    lines: blocks[members[0]].lines.slice(),
  }));
  const order = clusterOf.map((c) => names[c]);

  return { sections, order, warnings };
}

const RULE_CONFIDENCE = {
  headers: 1,
  'blank-lines': 0.5,
  chunked: 0.25,
  empty: 0,
};

/**
 * The entry point. `verseOrder` carries section *names* rather than ids
 * because ids do not exist yet — `toSong` in the renderer mints them and
 * translates the order in the same pass.
 */
function arrangeLyrics(text) {
  const { blocks, rule } = splitSections(text);
  if (blocks.length === 0) {
    return { sections: [], verseOrder: [], confidence: 0, warnings: [] };
  }

  const { sections, order, warnings } = inferRepeats(blocks);

  let confidence = RULE_CONFIDENCE[rule] ?? 0.5;
  // A chorus found by repetition is corroboration that the split was right.
  if (rule === 'blank-lines' && order.length > sections.length) confidence = 0.7;

  /* An order that is just each section once, in order, is what happens with no
     arrangement at all. Storing it adds something to break for no behaviour. */
  const redundant = order.length === sections.length
    && order.every((name, i) => name === sections[i].name);

  return {
    sections,
    verseOrder: redundant ? [] : order,
    confidence,
    warnings,
  };
}

module.exports = {
  arrangeLyrics,
  canonicalSectionKey,
  prettyLabel,
  splitSections,
  inferRepeats,
  isChordLine,
  tokenize,
  ngrams,
};
