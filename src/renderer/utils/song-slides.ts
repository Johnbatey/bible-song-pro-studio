import type { Scene, Song } from '../types';

export interface FormattedSlide {
  id: string;
  label: string;
  text: string;
}

/**
 * Splits a song into projectable slides. `'auto'` keeps the song's own sections
 * intact; a number re-chunks each section to that many lines, labelling the
 * pieces so the operator can still tell Verse 1 (2/3) from Verse 2.
 *
 * Lives here rather than in SongsPanel because the Live Scripture panel
 * projects the same slides — two copies would drift.
 */
export function getFormattedSlides(song: Song, lineCount: number | 'auto'): FormattedSlide[] {
  if (lineCount === 'auto') {
    return song.slides.map((slide) => ({ id: slide.id, label: slide.label, text: slide.text }));
  }

  const result: FormattedSlide[] = [];
  song.slides.forEach((slide) => {
    const rawLines = slide.text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (rawLines.length <= lineCount) {
      result.push({ id: slide.id, label: slide.label, text: slide.text });
      return;
    }
    const chunkCount = Math.ceil(rawLines.length / lineCount);
    for (let i = 0; i < chunkCount; i++) {
      const chunk = rawLines.slice(i * lineCount, (i + 1) * lineCount);
      result.push({
        id: `${slide.id}-p${i + 1}`,
        label: `${slide.label} (${i + 1}/${chunkCount})`,
        text: chunk.join('\n'),
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
      reference: `${song.title} (${song.key || ''})`,
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
