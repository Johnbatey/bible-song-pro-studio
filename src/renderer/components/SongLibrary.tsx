import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import type { Song } from '../types';
import { v4 as uuid } from 'uuid';
import { type, fontWeight } from '../styles/type';

// CCLI-like song database
const SONG_PACKS = [
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

export function SongLibrary() {
  const songs = useAppStore((s) => s.songs);
  const setSongs = useAppStore((s) => s.setSongs);
  const [search, setSearch] = useState('');
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const needle = search.trim().toLowerCase();
  const filteredSongs = needle
    ? songs.filter((s) => s.title.toLowerCase().includes(needle) || (s.artist || '').toLowerCase().includes(needle))
    : songs;

  const handleDownloadPack = (packId: string) => {
    const pack = SONG_PACKS.find((p) => p.id === packId);
    if (!pack) return;

    setDownloading(true);
    // Packs are bundled locally — no network involved. Kept synchronous-with-a-tick
    // only so the button state visibly changes.
    setTimeout(() => {
      const newSongs: Song[] = pack.songs.map((s) => ({
        id: uuid(),
        title: s.title,
        artist: s.artist,
        key: s.key,
        slides: s.slides.map((sl, i) => ({
          id: uuid(),
          label: sl.label || `Slide ${i + 1}`,
          text: sl.text,
          order: i,
        })),
        categories: [pack.name],
      }));

      const existingTitles = new Set(songs.map((s) => s.title));
      const uniqueNewSongs = newSongs.filter((s) => !existingTitles.has(s.title));

      setSongs([...songs, ...uniqueNewSongs]);
      setDownloading(false);
      setSelectedPack(packId);
    }, 300);
  };

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ ...type.title, marginBottom: 16 }}>Song Library</h2>

      {/* Library filter. Online catalogue search (CCLI SongSelect etc.) is not built yet. */}
      <div className="glass" style={{ padding: 12, borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
        <div className="section-title">Filter Library</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <input
            className="input"
            placeholder="Filter songs in your library..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ ...type.caption, color: 'var(--text-dim)', marginTop: 6 }}>
          Online catalogue search is not available yet — use <strong>Songs → Import Songs</strong> for
          OpenLyrics and ChordPro files.
        </div>
      </div>

      {/* Song Packs */}
      <div className="section-title" style={{ marginBottom: 8 }}>Song Packs</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {SONG_PACKS.map((pack) => {
          const installed = songs.some((s) => s.categories?.includes(pack.name));
          return (
            <div key={pack.id} className="card card-hover">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ ...type.title }}>{pack.name}</div>
                  <div style={{ ...type.secondary, color: 'var(--text-dim)', marginTop: 2 }}>
                    {pack.songs.length} songs
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    {pack.songs.map((s) => (
                      <span key={s.title} style={{
                        ...type.caption,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: 'var(--bg-elevated)',
                        color: 'var(--text-secondary)',
                      }}>
                        {s.title}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  className={`btn btn-sm ${installed ? 'btn-ghost' : 'btn-primary'}`}
                  onClick={() => handleDownloadPack(pack.id)}
                  disabled={installed || (downloading && selectedPack === pack.id)}
                >
                  {installed ? 'Installed' : downloading && selectedPack === pack.id ? 'Downloading...' : 'Download'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* My Songs */}
      <div className="section-title" style={{ marginBottom: 8 }}>My Songs ({filteredSongs.length}/{songs.length})</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filteredSongs.map((song) => (
          <div key={song.id} className="card card-hover" style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ ...type.heading, fontWeight: fontWeight.medium }}>{song.title}</div>
                <div style={{ ...type.caption, color: 'var(--text-dim)' }}>
                  {song.artist} {song.key ? `· ${song.key}` : ''} · {song.slides.length} slides
                </div>
              </div>
              <span style={{ ...type.caption, padding: '2px 6px', borderRadius: 4, background: 'var(--green-dim)', color: 'var(--green)' }}>
                Ready
              </span>
            </div>
          </div>
        ))}
        {filteredSongs.length === 0 && (
          <div style={{ ...type.body, color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>
            {songs.length === 0
              ? 'No songs yet. Install a song pack above, or import your own from the Songs panel.'
              : `No songs match "${search}".`}
          </div>
        )}
      </div>
    </div>
  );
}
