import type { Scene, Song, SongSlide } from '../types';

export interface FormattedSlide {
  /** Unique within the returned array — this is position identity, not slide
   *  identity, because an arrangement can play the same slide more than once
   *  and `songSceneId` is built from it. See `expandArrangement`. */
  id: string;
  label: string;
  text: string;
  /** The SongSlide this came from. Several entries can share one. */
  slideId: string;
}

/**
 * Walks the song's arrangement, or its slide list when it has none.
 *
 * An arrangement is a list of slide ids with repeats allowed, so this is where
 * "V1 C V2 C B C" becomes six entries over four slides. Ids that no longer name
 * a slide are dropped rather than defended against upstream: this is the only
 * reader, so filtering here is what makes a deleted slide — or a hand-edited
 * state file holding a string where an array belongs — unable to leave a song
 * unprojectable.
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
 *
 * Lives here rather than in SongsPanel because the Live Scripture panel
 * projects the same slides — two copies would drift.
 *
 * Expansion happens before chunking, and every id it emits is unique. It has to
 * be: `songSceneId` is built from this id, and SongDeck decides which card
 * reads LIVE, which element Next moves to, which ref to scroll and what React
 * key to use all by comparing it. A chorus played three times under one id lit
 * all three cards at once and made Next jump backwards.
 *
 * The *first* occurrence deliberately keeps the bare slide id. Scenes persist
 * whole, keyed by `song-<songId>-<slideId>`, so numbering every position would
 * invalidate every stored scene in every operator's library. As written, a song
 * with no arrangement emits exactly the ids it always has.
 */
export function getFormattedSlides(song: Song, lineCount: number | 'auto'): FormattedSlide[] {
  const played = expandArrangement(song);
  const seen = new Map<string, number>();

  const expanded: FormattedSlide[] = played.map((slide) => {
    const repeat = seen.get(slide.id) ?? 0;
    seen.set(slide.id, repeat + 1);
    return {
      id: repeat === 0 ? slide.id : `${slide.id}-r${repeat + 1}`,
      // "·" rather than "(2)" so a repeat never reads like the chunker's (2/3).
      label: repeat === 0 ? slide.label : `${slide.label} · ${repeat + 1}`,
      text: slide.text,
      slideId: slide.id,
    };
  });

  if (lineCount === 'auto') return expanded;

  const result: FormattedSlide[] = [];
  expanded.forEach((slide) => {
    const rawLines = slide.text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (rawLines.length <= lineCount) {
      result.push(slide);
      return;
    }
    const chunkCount = Math.ceil(rawLines.length / lineCount);
    for (let i = 0; i < chunkCount; i++) {
      const chunk = rawLines.slice(i * lineCount, (i + 1) * lineCount);
      result.push({
        id: `${slide.id}-p${i + 1}`,
        label: `${slide.label} (${i + 1}/${chunkCount})`,
        text: chunk.join('\n'),
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
  opts: { includeCredits?: boolean } = {}
): Scene {
  return {
    id: songSceneId(song, slide),
    name: `${song.title} - ${slide.label}`,
    type: 'song',
    content: {
      text: slide.text,
      songCredit: (opts.includeCredits && (song.author || song.copyright || song.ccli))
        ? { title: song.title, author: song.author || song.artist, copyright: song.copyright, ccli: song.ccli }
        : undefined,
    },
    /* The song's own ground, or none at all.
       ProgramSurface treats a scene's background as the operator having picked
       one and skips the theme for it — which is exactly right when they set one
       on this song, and exactly wrong otherwise. A hardcoded gradient used to
       sit here unconditionally, which is why every song ignored the theme while
       Scripture obeyed it. Undefined is the default and has to stay undefined:
       an empty object here would read as a background and swallow the theme.

       The same object on every slide of a song, so the url the surface sees
       does not change as the operator advances lyrics and the <video> keeps
       playing rather than cutting back to its first frame. */
    background: song.background,
  };
}
