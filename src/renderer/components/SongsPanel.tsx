import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { importSongFiles, SONG_FILE_ACCEPT } from '../utils/song-import';
import type { Scene, Song } from '../types';
import { type, fontWeight } from '../styles/type';
import { Block, BlockButton, BlockSegment } from './Block';
import { AppleToggle } from './AppleToggle';
import { PanelSplitter } from './PanelSplitter';
import { SongDeck } from './song/SongDeck';
import { BackgroundPicker } from './BackgroundPicker';
import { useMediaLibrary } from '../hooks/useMediaLibrary';
import { backgroundSwatchCss, describeBackground } from '../utils/background';
import { isFocusedDock } from './dock/dockFocus';

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
  const currentScene = useAppStore((s) => s.display.currentScene);
  const previewScene = useAppStore((s) => s.display.previewScene);
  const setCurrentScene = useAppStore((s) => s.setCurrentScene);
  const setPreviewScene = useAppStore((s) => s.setPreviewScene);
  const operatingMode = useAppStore((s) => s.display.mode);
  const showSongCredits = useAppStore((s) => s.showSongCredits);
  const setShowSongCredits = useAppStore((s) => s.setShowSongCredits);
  const addToQueue = useAppStore((s) => s.addToQueue);
  const pushNotice = useAppStore((s) => s.notify);

  const [search, setSearch] = useState('');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [bgOpen, setBgOpen] = useState(false);
  const { items: mediaItems } = useMediaLibrary();
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  /** The lyric a search sent us to, so the right block can point at it. */
  const [lyricTarget, setLyricTarget] = useState<string | null>(null);
  const [listWidth, setListWidth] = useState<number>(() => {
    const saved = localStorage.getItem('bsp_songsListWidth');
    return saved ? parseInt(saved, 10) : 300;
  });

  const setListWidthPersisted = (next: number) => {
    setListWidth(next);
    localStorage.setItem('bsp_songsListWidth', String(next));
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddDemoSongs = () => {
    setSongs(DEMO_SONGS);
  };

  /* Import feedback is for the operator only. */
  const notify = (text: string, type: 'info' | 'warning' = 'info') => {
    pushNotice({ id: `import-${Date.now()}`, text, type, duration: 4, animation: 'slideDown' });
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

  const searchQuery = search.trim().toLowerCase();

  const filteredSongs = songs.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery) ||
      (s.artist && s.artist.toLowerCase().includes(searchQuery))
  );

  /**
   * Lyric hits are listed separately from title/author hits: the operator is
   * usually searching a half-remembered line, and what they want back is the
   * song *plus* the point in it where that line sits.
   */
  const lyricMatches = searchQuery.length < 3 ? [] : songs.flatMap((song) => {
    const titleHit = song.title.toLowerCase().includes(searchQuery)
      || (song.artist || '').toLowerCase().includes(searchQuery);
    const hits: Array<{ song: Song; label: string; line: string }> = [];
    for (const slide of song.slides) {
      const line = (slide.text || '')
        .split('\n')
        .find((l) => l.toLowerCase().includes(searchQuery));
      // A title hit already lists the song above; only add it here if the
      // lyric points at somewhere specific to start from.
      if (line) hits.push({ song, label: slide.label, line: line.trim() });
      if (hits.length >= 4) break;
    }
    return titleHit && hits.length === 0 ? [] : hits;
  }).slice(0, 20);

  /** Edits the selected song in place; persisted with the rest of the library. */
  const patchSelectedSong = (patch: Partial<Song>) => {
    if (!selectedSong) return;
    const updated = { ...selectedSong, ...patch };
    setSelectedSong(updated);
    setSongs(songs.map((s) => (s.id === updated.id ? updated : s)));
  };

  /* Name the chosen clip in the summary row rather than its url — a background
     reading `/media/a1b2c3.mp4` tells the operator nothing about which one. */
  const mediaNameFor = (url: string | undefined) =>
    url ? mediaItems.find((item) => item.url === url)?.name : undefined;

  const containerRef = useRef<HTMLDivElement>(null);


  return (
    <div ref={containerRef} className="blk-row" style={{ height: '100%', minHeight: 0 }}>
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

      {/* Left block: search & song list */}
      <Block
        title="Songs"
        subtitle={`${songs.length}`}
        style={{ flex: `0 0 ${listWidth}px`, minWidth: 180 }}
        tools={(
          <>
            {songs.length === 0 && (
              <BlockButton onClick={handleAddDemoSongs}>Demo</BlockButton>
            )}
            <BlockButton onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? 'Importing…' : 'Import'}
            </BlockButton>
          </>
        )}
        bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <input
          className="input"
          placeholder="Search title, author, or a line of lyrics..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setLyricTarget(null); }}
          style={{ flexShrink: 0 }}
        />

        {/* Dropzone */}
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
              padding: '8px 10px',
              ...type.caption,
              color: 'var(--text-dim)',
              textAlign: 'center',
              transition: 'background 0.15s, border-color 0.15s',
              flexShrink: 0,
            }}
          >
          Drop OpenLyrics (.xml), ChordPro (.pro) or .txt files
        </div>

        {/* Scrollable Song List */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 2 }}>
            {filteredSongs.map((song) => {
              const isSelected = selectedSong?.id === song.id;
              return (
                <div
                  key={song.id}
                  className={`card card-hover`}
                  style={{
                    cursor: 'pointer',
                    borderColor: isSelected ? 'var(--chrome-control-active)' : 'rgba(255, 255, 255, 0.08)',
                    background: isSelected ? 'var(--chrome-control-active)' : 'var(--bg-secondary)',
                    padding: 10,
                  }}
                  onClick={() => setSelectedSong(song)}
                >
                  <div style={{ ...type.heading, fontWeight: isSelected ? fontWeight.semibold : fontWeight.medium, color: 'var(--text-primary)' }}>
                    {song.title}
                  </div>
                  <div style={{ ...type.caption, color: 'var(--text-dim)', marginTop: 2 }}>
                    {song.artist || 'Unknown Artist'} {song.key ? `· Key: ${song.key}` : ''}
                  </div>
                  <div style={{ ...type.caption, color: 'var(--text-dim)', marginTop: 2 }}>
                    {song.slides.length} slides
                  </div>
                </div>
              );
            })}
          {/* Lyric hits — clicking one opens the song at that section */}
          {lyricMatches.length > 0 && (
            <>
              <div style={styles.matchHeading}>In lyrics</div>
              {lyricMatches.map((match, i) => (
                <div
                  key={`${match.song.id}-${match.label}-${i}`}
                  className="card card-hover"
                  style={{ cursor: 'pointer', padding: 10, borderColor: 'rgba(255, 255, 255, 0.08)', background: 'var(--bg-secondary)' }}
                  onClick={() => {
                    setSelectedSong(match.song);
                    setLyricTarget(searchQuery);
                  }}
                  title={`Open ${match.song.title} at ${match.label}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{ ...type.label, color: 'var(--accent)', fontWeight: fontWeight.bold, flexShrink: 0 }}>
                      {match.label}
                    </span>
                    <span style={{ ...type.caption, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {match.song.title}
                    </span>
                  </div>
                  <div style={{ ...type.caption, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.4 }}>
                    {match.line}
                  </div>
                </div>
              ))}
            </>
          )}

          {filteredSongs.length === 0 && lyricMatches.length === 0 && (
            <div style={{ ...type.secondary, color: 'var(--text-dim)', textAlign: 'center', padding: 24 }}>
              {songs.length === 0
                ? 'No songs yet. Import a file or load demo songs.'
                : `No songs match "${search}".`}
            </div>
          )}
        </div>

        {/* The selected song's ground. Below the list rather than in the deck,
            because it belongs to the song and not to any one slide — and it is
            set while planning a set, not while running one. */}
        {selectedSong && (
          <div style={styles.bgSection}>
            <button
              type="button"
              onClick={() => setBgOpen((open) => !open)}
              style={styles.bgHeader}
              title={bgOpen ? 'Hide background options' : 'Set what this song sits on'}
            >
              <span>Background</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  aria-hidden
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: backgroundSwatchCss(selectedSong.background),
                  }}
                />
                <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>
                  {describeBackground(
                    selectedSong.background,
                    mediaNameFor(selectedSong.background?.mediaUrl),
                  )}
                </span>
                <span style={{ color: 'var(--text-dim)' }}>{bgOpen ? '▾' : '▸'}</span>
              </span>
            </button>
            {bgOpen && (
              <div style={{ paddingTop: 8 }}>
                <BackgroundPicker
                  value={selectedSong.background}
                  onChange={(background) => patchSelectedSong({ background })}
                />
              </div>
            )}
          </div>
        )}
      </Block>

      <PanelSplitter
        width={listWidth}
        onChange={setListWidthPersisted}
        min={180}
        max={560}
        title="Drag to resize the song list"
      />

      {/* Right block: the shared lyric deck, also used by Live song mode */}
      <SongDeck
        song={selectedSong}
        targetText={lyricTarget || undefined}
        emptyLabel="Select a song from the left list to view its lyrics."
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bgSection: {
    flexShrink: 0,
    marginTop: 8,
    paddingTop: 8,
    borderTop: '1px solid var(--border-primary)',
  },
  bgHeader: {
    ...type.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    width: '100%',
    padding: '2px 0',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
  },
  matchHeading: {
    ...type.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-dim)',
    padding: '8px 2px 2px',
  },
};
