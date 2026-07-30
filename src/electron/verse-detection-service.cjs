const bibleService = require('./bible-service.cjs');
const refParser = require('./scripture-reference.cjs');
const { createVerseIndexService } = require('./verse-index-service.cjs');

function createVerseDetectionService() {
  const verseIndex = createVerseIndexService();

  function detect(text, options = {}) {
    const versionId = options.versionId || 'KJV';
    const modes = options.modes || ['direct', 'contextual', 'verbatim'];
    const limit = options.limit || 10;
    const minConfidence = options.minConfidence || 0.3;
    const bibleData = bibleService.getData().versions[versionId] || bibleService.getData().versions.KJV || {};

    if (!text || typeof text !== 'string') {
      return { ok: true, detections: [], text: '' };
    }

    const detections = [];
    const seen = new Set();

    // Mode 1: Direct scripture references
    if (modes.includes('direct')) {
      const refs = refParser.extractReferences(text);
      refs.forEach((ref) => {
        const chapter = bibleData[ref.book]?.[String(ref.chapter)];
        if (!chapter) return;
        const verses = [];
        const endV = ref.verseEnd || ref.verseStart;
        for (let v = ref.verseStart; v <= endV && v < 200; v++) {
          const vt = chapter[String(v)];
          if (vt) verses.push({ verse: v, text: vt });
        }
        if (verses.length === 0) return;
        const key = `${ref.book}|${ref.chapter}|${ref.verseStart}`;
        if (seen.has(key)) return;
        seen.add(key);
        detections.push({
          mode: 'direct',
          book: ref.book,
          chapter: ref.chapter,
          verseStart: ref.verseStart,
          verseEnd: ref.verseEnd || ref.verseStart,
          displayRef: ref.displayRef,
          text: verses.map((v) => v.text).join(' '),
          verses,
          confidence: ref.confidence,
        });
      });
    }

    // Mode 2: Contextual hints ("in the book of John", "as Paul wrote")
    if (modes.includes('contextual') && detections.length < limit) {
      const hints = refParser.extractContextualHints(text);
      hints.forEach((hint) => {
        // Contextual hints need more text to pin down a chapter
        // Try to find a nearby chapter reference
        const chMatch = text.slice(Math.max(0, hint.matchStart - 50), hint.matchEnd + 50).match(/\bchapter\s+(\d+)\b/i);
        const chapter = chMatch ? parseInt(chMatch[1], 10) : 1;
        const maxCh = refParser.ALL_BOOKS.find((b) => b.name === hint.book)?.chapters || 150;
        if (chapter > maxCh) return;
        const firstVerse = bibleData[hint.book]?.[String(chapter)]?.['1'];
        if (!firstVerse) return;
        const key = `ctx|${hint.book}|${chapter}`;
        if (seen.has(key)) return;
        seen.add(key);
        detections.push({
          mode: 'contextual',
          book: hint.book,
          chapter,
          verseStart: 1,
          verseEnd: null,
          displayRef: `${hint.book} ${chapter}`,
          text: firstVerse,
          verses: [{ verse: 1, text: firstVerse }],
          confidence: 0.55,
          hintText: hint.hintText,
        });
      });
    }

    // Mode 3: Verbatim quote matching, scored over BM25 candidates rather than the
    // whole corpus — same answers, ~100x less work per call.
    if (modes.includes('verbatim') && detections.length < limit) {
      const candidates = verseIndex.search(text, { versionId, limit: 60 }).map((hit) => {
        const cleaned = hit.text.replace(/[^\w\s']/g, '').toLowerCase();
        const words = cleaned.split(/\s+/);
        return {
          book: hit.book, chapter: hit.chapter, verse: hit.verse,
          text: cleaned, original: hit.text, words, wordSet: new Set(words),
        };
      });
      const verbatim = refParser.findVerbatimQuotes(text, bibleData, versionId, candidates);
      verbatim.forEach((v) => {
        const key = `vb|${v.book}|${v.chapter}|${v.verse}`;
        if (seen.has(key)) return;
        seen.add(key);
        detections.push({
          mode: 'verbatim',
          book: v.book,
          chapter: v.chapter,
          verseStart: v.verse,
          verseEnd: v.verse,
          displayRef: v.reference,
          text: v.text,
          verses: [{ verse: v.verse, text: v.text }],
          confidence: v.confidence,
          wordOverlap: v.wordOverlap,
        });
      });
    }

    // Mode 4: Semantic — BM25 over the verse index, for paraphrases and loose quotes.
    // Previously a full 30k-verse rescan per call with no IDF, which was both slow
    // (~180ms) and wrong (common-word overlap ranked genealogies above the quoted verse).
    if (modes.includes('semantic') && detections.length < limit) {
      const results = verseIndex.search(text, { versionId, limit: Math.max(5, limit) });
      results
        .filter((hit) => hit.score >= 0.12)
        .slice(0, Math.min(5, limit - detections.length))
        .forEach((hit) => {
          const key = `sem|${hit.book}|${hit.chapter}|${hit.verse}`;
          if (seen.has(key)) return;
          seen.add(key);
          detections.push({
            mode: 'semantic',
            book: hit.book,
            chapter: hit.chapter,
            verseStart: hit.verse,
            verseEnd: hit.verse,
            displayRef: hit.reference,
            text: hit.text,
            verses: [{ verse: hit.verse, text: hit.text }],
            // Held below the verbatim/direct band: a strong lexical match is still a
            // weaker signal than an explicit reference or an exact quote.
            confidence: Math.min(0.85, 0.3 + hit.score * 0.6),
            semanticScore: hit.score,
          });
        });
    }

    // Sort by confidence descending, limit
    detections.sort((a, b) => b.confidence - a.confidence);
    const filtered = detections.filter((d) => d.confidence >= minConfidence).slice(0, limit);

    return {
      ok: true,
      text,
      detections: filtered,
      totalFound: detections.length,
      modes: modes,
    };
  }

  return {
    detect,
    warmIndex: (versionId) => verseIndex.warm(versionId),
    indexStatus: () => verseIndex.status(),
  };
}

module.exports = { createVerseDetectionService };
