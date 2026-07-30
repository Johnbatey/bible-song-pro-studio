const bibleService = require('./bible-service.cjs');

// BM25 parameters. k1 controls term-frequency saturation, b the length normalisation;
// these are the standard defaults and behave well on short documents like verses.
const K1 = 1.2;
const B = 0.75;

// Terms appearing in more than this share of verses carry almost no signal and cost
// the most to score (["the"] alone hits most of the corpus).
const STOPWORD_DF_RATIO = 0.12;

const HARD_STOPWORDS = new Set([
  'the', 'and', 'that', 'unto', 'for', 'they', 'shall', 'with', 'you', 'not', 'but', 'his',
  'her', 'him', 'them', 'their', 'was', 'were', 'are', 'is', 'be', 'have', 'hath', 'had',
  'this', 'which', 'from', 'all', 'thou', 'thee', 'thy', 'ye', 'it', 'of', 'in', 'to', 'a',
]);

/**
 * Light stemmer for Early Modern English. Collapses the KJV's archaic inflections so
 * "loved"/"loveth"/"love" and "strengtheneth"/"strengthen" match a modern paraphrase.
 */
function stem(word) {
  let w = word;
  if (w.length > 5 && w.endsWith('eth')) w = w.slice(0, -3);
  else if (w.length > 5 && w.endsWith('est')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith('i')) w = w.slice(0, -1) + 'y';
  return w;
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !HARD_STOPWORDS.has(w))
    .map(stem);
}

/**
 * BM25 index over a Bible version, built lazily and kept in memory.
 *
 * Replaces a full 30k-verse rescan per query. The previous approach also had no IDF, so
 * a genealogy sharing a few common words outranked the actual verse being quoted.
 */
function createVerseIndexService() {
  const indexes = new Map(); // versionId -> index

  function build(versionId) {
    const started = Date.now();
    const bible = bibleService.getData().versions[versionId] || bibleService.getData().versions.KJV || {};

    const docs = [];          // { book, chapter, verse, text, len }
    const postings = new Map(); // stem -> [ [docId, tf], ... ]
    let totalLen = 0;

    for (const [book, chapters] of Object.entries(bible)) {
      for (const [chapter, verses] of Object.entries(chapters || {})) {
        for (const [verse, text] of Object.entries(verses || {})) {
          const tokens = tokenize(text);
          if (tokens.length === 0) continue;
          const docId = docs.length;
          docs.push({ book, chapter: Number(chapter), verse: Number(verse), text, len: tokens.length });
          totalLen += tokens.length;

          const tf = new Map();
          tokens.forEach((token) => tf.set(token, (tf.get(token) || 0) + 1));
          tf.forEach((count, token) => {
            let list = postings.get(token);
            if (!list) { list = []; postings.set(token, list); }
            list.push([docId, count]);
          });
        }
      }
    }

    const index = {
      versionId,
      docs,
      postings,
      avgLen: docs.length ? totalLen / docs.length : 0,
      docCount: docs.length,
      buildMs: Date.now() - started,
    };
    indexes.set(versionId, index);
    return index;
  }

  function getIndex(versionId = 'KJV') {
    return indexes.get(versionId) || build(versionId);
  }

  /**
   * Returns verses ranked by BM25, with `score` normalised to roughly 0..1 against the
   * best possible score for this query so callers can apply a stable threshold.
   */
  function search(text, options = {}) {
    const versionId = options.versionId || 'KJV';
    const limit = options.limit || 10;
    const index = getIndex(versionId);
    if (index.docCount === 0) return [];

    const queryTokens = tokenize(text);
    if (queryTokens.length === 0) return [];

    const queryTf = new Map();
    queryTokens.forEach((token) => queryTf.set(token, (queryTf.get(token) || 0) + 1));

    const maxDf = index.docCount * STOPWORD_DF_RATIO;
    const scores = new Map();
    let idealScore = 0;

    queryTf.forEach((_, token) => {
      const list = index.postings.get(token);
      if (!list || list.length > maxDf) return;

      const idf = Math.log(1 + (index.docCount - list.length + 0.5) / (list.length + 0.5));
      // Best this term could contribute to any single verse — used for normalisation
      idealScore += idf * ((K1 + 1) / 1);

      for (let i = 0; i < list.length; i++) {
        const docId = list[i][0];
        const tf = list[i][1];
        const len = index.docs[docId].len;
        const denom = tf + K1 * (1 - B + B * (len / index.avgLen));
        scores.set(docId, (scores.get(docId) || 0) + idf * ((tf * (K1 + 1)) / denom));
      }
    });

    if (scores.size === 0) return [];

    const ranked = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([docId, score]) => {
        const doc = index.docs[docId];
        return {
          book: doc.book,
          chapter: doc.chapter,
          verse: doc.verse,
          text: doc.text,
          reference: `${doc.book} ${doc.chapter}:${doc.verse}`,
          version: versionId,
          rawScore: score,
          score: idealScore > 0 ? Math.min(1, score / idealScore) : 0,
        };
      });

    return ranked;
  }

  function status() {
    return {
      ok: true,
      versions: [...indexes.values()].map((index) => ({
        versionId: index.versionId,
        verses: index.docCount,
        terms: index.postings.size,
        avgLen: Number(index.avgLen.toFixed(1)),
        buildMs: index.buildMs,
      })),
    };
  }

  function warm(versionId = 'KJV') {
    const index = getIndex(versionId);
    return { ok: true, versionId, verses: index.docCount, terms: index.postings.size, buildMs: index.buildMs };
  }

  return { search, warm, status, getIndex, tokenize, stem };
}

module.exports = { createVerseIndexService, tokenize, stem };
