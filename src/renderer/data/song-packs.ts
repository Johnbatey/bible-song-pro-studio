import { v4 as uuid } from 'uuid';
import type { Song } from '../types';

/**
 * Bundled song packs. Nothing here touches the network — "downloading" a pack
 * just copies its songs into the library, so the packs live beside the code.
 */
export interface PackSong {
  title: string;
  artist: string;
  key: string;
  slides: Array<{ text: string; label?: string }>;
}

export interface SongPack {
  id: string;
  name: string;
  songs: PackSong[];
}

export const SONG_PACKS: SongPack[] = [
  {
    id: 'pack-worship',
    name: 'Worship Essentials',
    songs: [
      { title: 'Way Maker', artist: 'Sinach', key: 'C', slides: [
        { text: 'Way Maker, Miracle Worker\nPromise Keeper, Light in the darkness\nMy God, that is who You are', label: 'Chorus' },
        { text: 'You are here, moving in our midst\nI worship You, I worship You', label: 'Verse 1' },
      ]},
      { title: 'Goodness of God', artist: 'Bethel Music', key: 'G', slides: [
        { text: 'I love You, Lord\nFor Your mercy never failed me\nAll my days, I\'ve been held in Your hands', label: 'Verse 1' },
        { text: 'Your goodness is running after me\nYour goodness is running after me', label: 'Chorus' },
      ]},
      { title: 'Graves Into Gardens', artist: 'Elevation Worship', key: 'A', slides: [
        { text: 'I searched the world\nBut it couldn\'t fill me\nMan\'s empty praise\nAnd treasures that fade', label: 'Verse 1' },
        { text: 'You turn mourning to dancing\nYou give beauty for ashes\nYou turn graves into gardens', label: 'Chorus' },
      ]},
    ],
  },
  {
    id: 'pack-hymns',
    name: 'Classic Hymns',
    songs: [
      { title: 'Great Is Thy Faithfulness', artist: 'Thomas Chisholm', key: 'Eb', slides: [
        { text: 'Great is Thy faithfulness, O God my Father\nThere is no shadow of turning with Thee\nThou changest not, Thy compassions, they fail not\nAs Thou hast been, Thou forever wilt be', label: 'Verse 1' },
        { text: 'Great is Thy faithfulness!\nGreat is Thy faithfulness!\nMorning by morning new mercies I see', label: 'Chorus' },
      ]},
    ],
  },
  {
    id: 'pack-modern',
    name: 'Modern Worship',
    songs: [
      { title: 'Jireh', artist: 'Elevation Worship', key: 'A', slides: [
        { text: 'Jireh, You are enough\nJireh, You are enough\nI will be content in every circumstance', label: 'Chorus' },
      ]},
      { title: 'Build My Life', artist: 'Pat Barrett', key: 'D', slides: [
        { text: 'Worthy of every song we could sing\nWorthy of all the praise we could bring\nWorthy of every breath we could take\nWe live for You', label: 'Verse 1' },
        { text: 'Holy, there is no one like You\nThere is none beside You\nJesus, the Way, the Truth, the Life', label: 'Chorus' },
      ]},
    ],
  },
];

/** Turns a pack entry into a library Song. */
export function songFromPack(entry: PackSong, packName: string): Song {
  return {
    id: uuid(),
    title: entry.title,
    artist: entry.artist,
    key: entry.key,
    slides: entry.slides.map((slide, i) => ({
      id: uuid(),
      label: slide.label || `Slide ${i + 1}`,
      text: slide.text,
      order: i,
    })),
    categories: [packName],
  };
}

/** True when the library already holds a song with this title. */
export function isInstalled(songs: Song[], title: string) {
  return songs.some((song) => song.title.toLowerCase() === title.toLowerCase());
}
