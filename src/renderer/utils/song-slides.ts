import type { Scene, Song, SongSlide } from '../types';

export interface FormattedSlide {
  /** Unique within the returned array — this is position identity, not slide
   *  identity, because an arrangement can play the same slide more than once
   *  and `songSceneId` is built from it. See `expandArrangement`. */
  id: string;
  label: string;
  text: string;
  translation?: string;
  /** The SongSlide this came from. Several entries can share one. */
  slideId: string;
}

/**
 * Walks the song's arrangement, or its slide list when it has none.
 */
export function expandArrangement(song: Song): SongSlide[] {
  const bySlideId = new Map(song.slides.map((slide) => [slide.id, slide]));
  const order = Array.isArray(song.arrangement)
    ? song.arrangement.filter((id): id is string => typeof id === 'string' && bySlideId.has(id))
    : [];
  if (order.length === 0) return song.slides;
  return order.map((id) => bySlideId.get(id)!);
}

/**
 * Splits a song into projectable slides. `'auto'` keeps the song's own sections
 * intact; a number re-chunks each section to that many lines, labelling the
 * pieces so the operator can still tell Verse 1 (2/3) from Verse 2.
 */
export function getFormattedSlides(song: Song, lineCount: number | 'auto'): FormattedSlide[] {
  const played = expandArrangement(song);
  const seen = new Map<string, number>();

  const expanded: FormattedSlide[] = played.map((slide) => {
    const repeat = seen.get(slide.id) ?? 0;
    seen.set(slide.id, repeat + 1);
    return {
      id: repeat === 0 ? slide.id : `${slide.id}-r${repeat + 1}`,
      label: repeat === 0 ? slide.label : `${slide.label} · ${repeat + 1}`,
      text: slide.text,
      translation: slide.translation,
      slideId: slide.id,
    };
  });

  if (lineCount === 'auto') return expanded;

  const result: FormattedSlide[] = [];
  expanded.forEach((slide) => {
    const rawLines = slide.text.split('\n').map((l) => l.trim()).filter(Boolean);
    const transLines = (slide.translation || '').split('\n').map((l) => l.trim()).filter(Boolean);
    if (rawLines.length <= lineCount) {
      result.push(slide);
      return;
    }
    const chunkCount = Math.ceil(rawLines.length / lineCount);
    for (let i = 0; i < chunkCount; i++) {
      const chunk = rawLines.slice(i * lineCount, (i + 1) * lineCount);
      const transChunk = transLines.slice(i * lineCount, (i + 1) * lineCount);
      result.push({
        id: `${slide.id}-p${i + 1}`,
        label: `${slide.label} (${i + 1}/${chunkCount})`,
        text: chunk.join('\n'),
        translation: transChunk.length ? transChunk.join('\n') : undefined,
        slideId: slide.slideId,
      });
    }
  });
  return result;
}

/** Stable across panels, so a slide projected from Live matches one from Songs. */
export function songSceneId(song: Song, slide: FormattedSlide) {
  return `song-${song.id}-${slide.id}`.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9:._/-]/g, '');
}

export function buildSongScene(
  song: Song,
  slide: FormattedSlide,
  opts: { includeCredits?: boolean; target?: 'primary' | 'translation' | 'bilingual' } = {}
): Scene {
  let projectedText = slide.text;
  const hasTrans = Boolean(slide.translation && slide.translation.trim());

  if (opts.target === 'translation' && hasTrans) {
    projectedText = slide.translation!.trim();
  } else if (opts.target === 'bilingual' || song.isBilingual) {
    if (hasTrans) {
      projectedText = `${slide.text.trim()}\n\n${slide.translation!.trim()}`;
    }
  }

  return {
    id: songSceneId(song, slide),
    name: `${song.title} - ${slide.label}`,
    type: 'song',
    content: {
      text: projectedText,
      songCredit: (opts.includeCredits && (song.author || song.copyright || song.ccli))
        ? { title: song.title, author: song.author || song.artist, copyright: song.copyright, ccli: song.ccli }
        : undefined,
    },
    background: song.background,
  };
}
