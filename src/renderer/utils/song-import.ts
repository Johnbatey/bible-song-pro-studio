import { v4 as uuid } from 'uuid';
import type { ImportedSong, Song } from '../types';

export const SONG_FILE_ACCEPT = '.xml,.pro,.chordpro,.chopro,.txt';

/** Map the import service's `{ title, verses[] }` shape onto the app's Song type. */
export function toSong(imported: ImportedSong): Song {
  const slides = imported.verses
    .filter((verse) => verse.lines.length > 0)
    .map((verse, index) => ({
      id: uuid(),
      label: verse.name || `Slide ${index + 1}`,
      text: verse.lines.join('\n'),
    }));

  /* The parser hands back a play order in verse *names*, because ids do not
     exist until this function mints them. Translating here keeps the whole
     name-to-id question in one place. A name with no slide is dropped rather
     than guessed at — the same rule the parser applies to `<verseOrder>`. */
  const byLabel = new Map(slides.map((slide) => [slide.label, slide.id]));
  const arrangement = (imported.verseOrder || [])
    .map((name) => byLabel.get(name))
    .filter((id): id is string => Boolean(id));

  return {
    id: uuid(),
    title: imported.title || 'Untitled',
    author: imported.author || undefined,
    copyright: imported.copyright || undefined,
    ccli: imported.ccli || undefined,
    slides,
    arrangement: arrangement.length > 0 ? arrangement : undefined,
    categories: ['Imported'],
  };
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsText(file);
  });
}

/**
 * Parse dropped/selected song files through the main-process parsers
 * (OpenLyrics, ChordPro, plain lyrics). Files are sent as text rather than
 * paths — Electron 32+ removed `File.path`.
 */
export async function importSongFiles(files: File[]): Promise<{ songs: Song[]; errors: string[] }> {
  const songs: Song[] = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      const text = await readAsText(file);
      const result = await window.BSP?.song?.importText({ text });
      if (!result?.ok || !result.songs?.length) {
        errors.push(`${file.name}: ${result?.error || 'no songs found'}`);
        continue;
      }
      result.songs.forEach((imported) => {
        const song = toSong(imported);
        // A ChordPro file with no {title} directive falls back to the filename
        if (song.title === 'Untitled') song.title = file.name.replace(/\.[^.]+$/, '');
        if (song.slides.length > 0) songs.push(song);
        else errors.push(`${file.name}: parsed but contained no lyrics`);
      });
    } catch (err) {
      errors.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { songs, errors };
}
