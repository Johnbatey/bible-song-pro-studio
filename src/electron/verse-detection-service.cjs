const bibleService = require('./bible-service.cjs');
const refParser = require('./scripture-reference.cjs');
const { createVerseIndexService } = require('./verse-index-service.cjs');
const { createLiveScriptureParser } = require('./live-scripture-parser.cjs');

function createVerseDetectionService() {
  const verseIndex = createVerseIndexService();
  const liveParser = createLiveScriptureParser({ verseIndex });

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
      const parsed = liveParser.parseDirect(text, versionId);
      if (parsed && !parsed.contextOnly) {
        const chapter = bibleData[parsed.book]?.[String(parsed.chapter)] || {};
        const verses = [];
        for (let v = parsed.verseStart; v <= parsed.verseEnd; v++) {
          if (chapter[String(v)]) verses.push({ verse: v, text: chapter[String(v)] });
        }
        if (verses.length) {
          const key = `${parsed.book}|${parsed.chapter}|${parsed.verseStart}`;
          seen.add(key);
          detections.push({
            mode: parsed.reason || 'direct', book: parsed.book, chapter: parsed.chapter,
            verseStart: parsed.verseStart, verseEnd: parsed.verseEnd,
            displayRef: `${parsed.book} ${parsed.chapter}:${parsed.verseStart}${parsed.verseEnd > parsed.verseStart ? `-${parsed.verseEnd}` : ''}`,
            text: verses.map((verse) => verse.text).join(' '), verses, confidence: parsed.confidence || 0.95,
          });
        }
      }
      // A book/chapter-only phrase establishes context for a following "verse …".
      // Do not turn it into verse 1 as the legacy stateless parser did.
      const refs = parsed?.contextOnly ? [] : refParser.extractReferences(text);
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
      liveParser.quoteCandidates(text, versionId, { interim: options.isFinal === false, limit }).forEach((v) => {
        const key = `vb|${v.book}|${v.chapter}|${v.verseStart}`;
        if (seen.has(key)) return;
        seen.add(key);
        detections.push({
          mode: v.reason, book: v.book, chapter: v.chapter, verseStart: v.verseStart,
          verseEnd: v.verseEnd, displayRef: `${v.book} ${v.chapter}:${v.verseStart}`,
          text: v.excerpt, verses: [{ verse: v.verseStart, text: v.excerpt }],
          confidence: v.confidence, wordOverlap: v.score,
        });
      });
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

    // Mode 4: Semantic — BM25 over the verse index, for genuine paraphrases.
    // Strictly gated to prevent conversational fluff or numbers from hallucinating random verses.
    if (modes.includes('semantic') && detections.length < limit && detections.length === 0) {
      const cleaned = liveParser.cleanSermonUtterance ? liveParser.cleanSermonUtterance(text) : text;
      const searchTarget = cleaned.length >= 8 ? cleaned : text;
      // Strip number words and citation markers from semantic tokens so citation fragments never trigger random OT verses
      const rawTokens = verseIndex.tokenize(searchTarget);
      const numberAndCitationWords = new Set([
        'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
        'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
        'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred',
        'chapter', 'chapters', 'verse', 'verses', 'book', 'read', 'open', 'turn', 'bible', 'scripture',
        'tight', 'tightest', 'title', 'leave', 'ronald'
      ]);
      const contentTokens = rawTokens.filter((t) => !numberAndCitationWords.has(t));

      // Require at least 3 distinct non-number content tokens for semantic search
      if (contentTokens.length >= 3) {
        const results = verseIndex.search(contentTokens.join(' '), { versionId, limit: Math.max(5, limit) });
        const minSemanticScore = options.isFinal === false ? 0.55 : 0.48;
        results
          .filter((hit) => hit.score >= minSemanticScore)
          .slice(0, Math.min(4, limit - detections.length))
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
              confidence: Math.min(0.80, 0.45 + hit.score * 0.35),
              semanticScore: hit.score,
            });
          });
      }
    }

    // Sort by confidence descending, limit
    detections.sort((a, b) => b.confidence - a.confidence);
    const uniqueDetections = [];
    const uniqueKeys = new Set();
    detections.forEach((d) => {
      const key = `${d.book}|${d.chapter}|${d.verseStart}|${d.verseEnd || d.verseStart}`;
      if (uniqueKeys.has(key)) return;
      uniqueKeys.add(key);
      uniqueDetections.push(d);
    });
    const filtered = uniqueDetections
      .filter((d) => d.confidence >= minConfidence)
      .slice(0, limit)
      .map((detection) => {
        if (String(detection.text || '').trim()) return detection;
        const chapter = bibleData[detection.book]?.[String(detection.chapter)] || {};
        const end = detection.verseEnd || detection.verseStart;
        const verses = [];
        for (let verse = detection.verseStart; verse <= end; verse++) {
          const verseText = chapter[String(verse)];
          if (verseText) verses.push({ verse, text: verseText });
        }
        return {
          ...detection,
          text: verses.map((verse) => verse.text).join(' '),
          verses: verses.length ? verses : detection.verses,
        };
      });

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
