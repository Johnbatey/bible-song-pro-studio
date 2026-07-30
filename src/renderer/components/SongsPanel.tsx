import { useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { importSongFiles, SONG_FILE_ACCEPT } from '../utils/song-import';
import type { Scene, Song } from '../types';

const DEMO_SONGS: Song[] = [
  {
    id: 'song-1',
    title: 'Amazing Grace',
    artist: 'John Newton',
    key: 'G',
    slides: [
      { id: 's1', label: 'Verse 1', text: 'Amazing grace! How sweet the sound\nThat saved a wretch like me.\nI once was lost, but now am found;\nWas blind, but now I see.', order: 0 },
      { id: 's2', label: 'Verse 2', text: 'Twas grace that taught my heart to fear,\nAnd grace my fears relieved;\nHow precious did that grace appear\nThe hour I first believed.', order: 1 },
      { id: 's3', label: 'Chorus', text: 'Amazing grace! How sweet the sound\nThat saved a wretch like me.\nI once was lost, but now am found;\nWas blind, but now I see.', order: 2 },
    ],
  },
  {
    id: 'song-2',
    title: 'How Great Thou Art',
    artist: 'Carl Boberg',
    key: 'Eb',
    slides: [
      { id: 's4', label: 'Verse 1', text: 'O Lord my God! When I in awesome wonder\nConsider all the worlds Thy hands have made.\nI see the stars, I hear the rolling thunder,\nThy power throughout the universe displayed.', order: 0 },
      { id: 's5', label: 'Chorus', text: 'Then sings my soul, my Savior God, to Thee:\nHow great Thou art! How great Thou art!', order: 1 },
    ],
  },
  {
    id: 'song-3',
    title: 'What a Beautiful Name',
    artist: 'Hillsong Worship',
    key: 'D',
    slides: [
      { id: 's6', label: 'Verse 1', text: 'You were the Word at the beginning\nOne with God the Lord Most High\nYour hidden glory in creation\nNow revealed in You the Christ', order: 0 },
      { id: 's7', label: 'Chorus', text: 'What a beautiful Name it is\nWhat a beautiful Name it is\nThe Name of Jesus Christ my King', order: 1 },
    ],
  },
];

export function SongsPanel() {
  const songs = useAppStore((s) => s.songs);
  const setSongs = useAppStore((s) => s.setSongs);
  const projectScene = useAppStore((s) => s.projectScene);
  const operatingMode = useAppStore((s) => s.display.mode);
  const triggerAlert = useAppStore((s) => s.triggerAlert);

  const [search, setSearch] = useState('');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddDemoSongs = () => {
    setSongs(DEMO_SONGS);
  };

  const notify = (text: string, type: 'info' | 'warning' = 'info') => {
    triggerAlert({ id: `import-${Date.now()}`, text, type, duration: 4, animation: 'slideDown' });
  };

  const handleImport = async (files: File[]) => {
    if (files.length === 0) return;
    setImporting(true);
    try {
      const { songs: imported, errors } = await importSongFiles(files);
      if (imported.length > 0) {
        const existingTitles = new Set(songs.map((s) => s.title.toLowerCase()));
        const fresh = imported.filter((s) => !existingTitles.has(s.title.toLowerCase()));
        setSongs([...songs, ...fresh]);
        const skipped = imported.length - fresh.length;
        notify(
          `Imported ${fresh.length} song${fresh.length === 1 ? '' : 's'}` +
            (skipped > 0 ? ` · ${skipped} already in library` : '')
        );
      }
      if (errors.length > 0) notify(errors[0], 'warning');
    } finally {
      setImporting(false);
    }
  };

  const filteredSongs = songs.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      (s.artist && s.artist.toLowerCase().includes(search.toLowerCase()))
  );

  /** Edits the selected song in place; persisted with the rest of the library. */
  const patchSelectedSong = (patch: Partial<Song>) => {
    if (!selectedSong) return;
    const updated = { ...selectedSong, ...patch };
    setSelectedSong(updated);
    setSongs(songs.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleSendSlideToDisplay = (song: Song, slide: Song['slides'][0], opts: { direct?: boolean } = {}) => {
    const scene: Scene = {
      id: `song-${Date.now()}`,
      name: `${song.title} - ${slide.label}`,
      type: 'song',
      content: {
        text: slide.text,
        reference: `${song.title} (${song.key || ''})`,
        // Credit footer stays on screen for the whole song — CCLI licences require it
        songCredit: (song.author || song.copyright || song.ccli)
          ? { title: song.title, author: song.author || song.artist, copyright: song.copyright, ccli: song.ccli }
          : undefined,
      },
      background: {
        type: 'gradient',
        gradient: 'linear-gradient(135deg, #1a0a2e, #16213e, #0f3460)',
      },
    };
    projectScene(scene, { direct: opts.direct });
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Songs</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {songs.length === 0 && (
            <button className="btn btn-sm btn-secondary" onClick={handleAddDemoSongs}>
              Load Demo Songs
            </button>
          )}
          <button
            className="btn btn-sm btn-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? 'Importing…' : 'Import Songs'}
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={SONG_FILE_ACCEPT}
        style={{ display: 'none' }}
        onChange={(e) => {
          handleImport(Array.from(e.target.files || []));
          e.target.value = '';
        }}
      />

      <input
        className="input"
        placeholder="Search songs..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      {/* Drop target — OpenLyrics (.xml), ChordPro (.pro/.chordpro), plain lyrics (.txt) */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleImport(Array.from(e.dataTransfer.files || []));
        }}
        style={{
          border: `1px dashed ${isDragging ? 'var(--border-accent)' : 'var(--border-primary)'}`,
          background: isDragging ? 'var(--accent-dim)' : 'transparent',
          borderRadius: 'var(--radius-md)',
          padding: '10px 12px',
          marginBottom: 12,
          fontSize: 11,
          color: 'var(--text-dim)',
          textAlign: 'center',
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        Drop OpenLyrics (.xml), ChordPro (.pro, .chordpro) or lyric (.txt) files here
      </div>

      {/* Auto-arrange lyrics button */}
      <div className="glass" style={{ padding: 10, borderRadius: 'var(--radius-md)', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>AI Auto-arrange Lyrics</span>
          <button className="btn btn-sm btn-secondary" style={{ marginLeft: 'auto' }} disabled title="Not implemented yet">
            Coming soon
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        {/* Song list */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filteredSongs.map((song) => (
            <div
              key={song.id}
              className={`card card-hover`}
              style={{
                cursor: 'pointer',
                borderColor: selectedSong?.id === song.id ? 'var(--border-accent)' : undefined,
              }}
              onClick={() => setSelectedSong(song)}
            >
              <div style={{ fontSize: 13, fontWeight: 500 }}>{song.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                {song.artist} {song.key ? `· Key: ${song.key}` : ''}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {song.slides.length} slides
              </div>
            </div>
          ))}
          {filteredSongs.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', padding: 24 }}>
              {songs.length === 0
                ? 'No songs yet. Import a file or load the demo songs.'
                : `No songs match "${search}".`}
            </div>
          )}
        </div>

        {/* Slide view */}
        {selectedSong && (
          <div style={{ flex: 1.5 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              {selectedSong.title}
            </div>

            {/* Credit metadata — rendered as a footer on the output while this song projects */}
            <div className="glass" style={{ padding: 10, borderRadius: 'var(--radius-md)', marginBottom: 8 }}>
              <div className="section-title" style={{ marginBottom: 6 }}>Credits (shown on output)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <input
                  className="input"
                  placeholder="Author / writer"
                  value={selectedSong.author ?? selectedSong.artist ?? ''}
                  onChange={(e) => patchSelectedSong({ author: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="CCLI number"
                  value={selectedSong.ccli ?? ''}
                  onChange={(e) => patchSelectedSong({ ccli: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Copyright"
                  value={selectedSong.copyright ?? ''}
                  onChange={(e) => patchSelectedSong({ copyright: e.target.value })}
                  style={{ gridColumn: '1 / -1' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selectedSong.slides.map((slide) => (
                <div
                  key={slide.id}
                  className="card card-hover"
                  onClick={() => handleSendSlideToDisplay(selectedSong, slide)}
                  onDoubleClick={() => handleSendSlideToDisplay(selectedSong, slide, { direct: true })}
                  style={{ cursor: 'pointer' }}
                  title={operatingMode === 'studio'
                    ? 'Click to stage in Preview · double-click to go straight to Program'
                    : 'Click to go live'}
                >
                  <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {slide.label}
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-line', color: 'var(--text-secondary)' }}>
                    {slide.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
