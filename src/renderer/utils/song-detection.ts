import type { Song } from '../types';

export interface SongDetection {
  song: Song;
  /** 0–1. Comparable to the verse detector's confidence so the UI can share a scale. */
  confidence: number;
  /** The section the matched words fell in, so Live can jump straight to it. */
  slideId?: string;
  slideLabel?: string;
  /** The matched run itself, for showing the operator why it ranked. */
  excerpt?: string;
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'to', 'of', 'in', 'on', 'at', 'is', 'it',
  'for', 'with', 'as', 'that', 'this', 'be', 'are', 'was', 'we', 'you', 'i',
]);

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Consecutive n-word runs — a shared phrase is far stronger evidence than shared words. */
function ngrams(tokens: string[], n: number): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + n <= tokens.length; i++) out.add(tokens.slice(i, i + n).join(' '));
  return out;
}

/**
 * Ranks the song library against what the speaker is singing.
 *
 * Songs live in the renderer store rather than behind an index service, so this
 * runs client-side. Scoring is phrase-based: a 4-word run in common counts for
 * much more than scattered vocabulary, because worship lyrics share a small,
 * highly repetitive vocabulary ("Lord", "praise", "holy") and word-overlap
 * alone ranks almost every song alike.
 */
export function detectSongs(transcript: string, songs: Song[], limit = 8): SongDetection[] {
  const heard = tokenize(transcript);
  // Only weigh the recent tail; a whole service's transcript matches everything.
  const recent = heard.slice(-60);
  if (recent.length < 4 || songs.length === 0) return [];

  const heardPhrases = [4, 3].map((n) => ngrams(recent, n));
  const heardWords = new Set(recent.filter((w) => !STOP_WORDS.has(w)));

  const scored = songs.map((song) => {
    let bestSlideScore = -1;
    let slideId: string | undefined;
    let slideLabel: string | undefined;
    let excerpt: string | undefined;
    let songScore = 0;

    for (const slide of song.slides) {
      const slideTokens = tokenize(slide.text);
      if (slideTokens.length === 0) continue;

      const quads = ngrams(slideTokens, 4);
      const triples = ngrams(slideTokens, 3);

      let phraseHits = 0;
      let longestRun = '';
      for (const phrase of quads) {
        if (heardPhrases[0].has(phrase)) {
          phraseHits += 3;
          if (phrase.length > longestRun.length) longestRun = phrase;
        }
      }
      for (const phrase of triples) {
        if (heardPhrases[1].has(phrase)) phraseHits += 1;
      }

      const contentWords = slideTokens.filter((w) => !STOP_WORDS.has(w));
      const wordHits = contentWords.filter((w) => heardWords.has(w)).length;
      const wordRatio = contentWords.length ? wordHits / contentWords.length : 0;

      // Phrases dominate; word overlap only breaks ties.
      const slideScore = phraseHits * 4 + wordRatio * 3;
      songScore = Math.max(songScore, slideScore);

      if (slideScore > bestSlideScore) {
        bestSlideScore = slideScore;
        slideId = slide.id;
        slideLabel = slide.label;
        excerpt = longestRun || undefined;
      }
    }

    // A title said aloud is a strong, deliberate cue.
    const titleTokens = tokenize(song.title).filter((w) => !STOP_WORDS.has(w));
    const titleHit = titleTokens.length > 0 && titleTokens.every((w) => heardWords.has(w));
    if (titleHit) songScore += 6;

    return { song, rawScore: songScore, slideId, slideLabel, excerpt };
  });

  const ranked = scored.filter((s) => s.rawScore > 1.2).sort((a, b) => b.rawScore - a.rawScore);
  if (ranked.length === 0) return [];

  // Normalise against the leader so the top match reads near-certain when it is
  // well clear of the field, and merely likely when the field is bunched.
  const top = ranked[0].rawScore;
  return ranked.slice(0, limit).map((entry) => ({
    song: entry.song,
    confidence: Math.max(0.3, Math.min(0.99, (entry.rawScore / top) * (top >= 12 ? 0.99 : 0.75))),
    slideId: entry.slideId,
    slideLabel: entry.slideLabel,
    excerpt: entry.excerpt,
  }));
}
