import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { importSongFiles, SONG_FILE_ACCEPT } from '../utils/song-import';
import type { Scene, Song } from '../types';
import { type, fontWeight } from '../styles/type';

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
  const triggerAlert = useAppStore((s) => s.triggerAlert);

  const [search, setSearch] = useState('');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [linesPerSlide, setLinesPerSlide] = useState<number | 'auto'>('auto');
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

  interface FormattedSlide {
    id: string;
    label: string;
    text: string;
  }

  const getFormattedSlides = (song: Song, lineCount: number | 'auto'): FormattedSlide[] => {
    if (lineCount === 'auto') {
      return song.slides.map((slide) => ({
        id: slide.id,
        label: slide.label,
        text: slide.text,
      }));
    }

    const result: FormattedSlide[] = [];
    song.slides.forEach((slide) => {
      const rawLines = slide.text.split('\n').map((l) => l.trim()).filter(Boolean);
      if (rawLines.length <= lineCount) {
        result.push({ id: slide.id, label: slide.label, text: slide.text });
      } else {
        const chunkCount = Math.ceil(rawLines.length / lineCount);
        for (let i = 0; i < chunkCount; i++) {
          const chunk = rawLines.slice(i * lineCount, (i + 1) * lineCount);
          result.push({
            id: `${slide.id}-p${i + 1}`,
            label: `${slide.label} (${i + 1}/${chunkCount})`,
            text: chunk.join('\n'),
          });
        }
      }
    });
    return result;
  };

  const formattedSlides = selectedSong ? getFormattedSlides(selectedSong, linesPerSlide) : [];

  const songSceneId = (song: Song, slide: FormattedSlide) =>
    `song-${song.id}-${slide.id}`.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9:._/-]/g, '');

  const handleSendSlideToDisplay = (song: Song, slide: FormattedSlide, opts: { direct?: boolean } = {}) => {
    const sceneId = songSceneId(song, slide);
    const goesLive = opts.direct || operatingMode === 'basic';
    const activeScene = goesLive ? currentScene : previewScene;
    if (activeScene?.id === sceneId) {
      if (goesLive) {
        setCurrentScene(null);
        setPreviewScene(null);
      } else {
        setPreviewScene(null);
      }
      return;
    }
    const includeCredits = showSongCredits && linesPerSlide === 'auto';
    const scene: Scene = {
      id: sceneId,
      name: `${song.title} - ${slide.label}`,
      type: 'song',
      content: {
        text: slide.text,
        reference: `${song.title} (${song.key || ''})`,
        songCredit: (includeCredits && (song.author || song.copyright || song.ccli))
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

  const sendAdjacentSlide = (direction: 1 | -1) => {
    if (!selectedSong || !formattedSlides.length) return;
    const activeId = currentScene?.type === 'song'
      ? currentScene.id
      : previewScene?.type === 'song'
        ? previewScene.id
        : '';
    const currentIndex = formattedSlides.findIndex((slide) => songSceneId(selectedSong, slide) === activeId);
    const fallbackIndex = direction > 0 ? -1 : formattedSlides.length;
    const nextIndex = Math.max(0, Math.min(formattedSlides.length - 1, (currentIndex === -1 ? fallbackIndex : currentIndex) + direction));
    const slide = formattedSlides[nextIndex];
    if (slide) handleSendSlideToDisplay(selectedSong, slide, { direct: true });
  };

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (!containerRef.current || containerRef.current.offsetParent === null) return;
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target?.isContentEditable) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        sendAdjacentSlide(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        sendAdjacentSlide(-1);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSong, linesPerSlide, currentScene, previewScene, operatingMode]);

  return (
    <div ref={containerRef} style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
        <h2 style={{ ...type.title }}>Songs</h2>
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

      {/* Main Two-Column View */}
      <div style={{ display: 'flex', gap: 14, flex: 1, minHeight: 0 }}>
        {/* Left Column: Search & Songs List */}
        <div style={{ flex: '0 0 280px', minWidth: 220, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          <input
            className="input"
            placeholder="Search songs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
                    borderColor: isSelected ? '#FF5500' : 'rgba(255, 255, 255, 0.08)',
                    background: isSelected ? 'rgba(255, 85, 0, 0.12)' : '#161618',
                    padding: 10,
                  }}
                  onClick={() => setSelectedSong(song)}
                >
                  <div style={{ ...type.heading, fontWeight: isSelected ? fontWeight.semibold : fontWeight.medium, color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>
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
            {filteredSongs.length === 0 && (
              <div style={{ ...type.secondary, color: 'var(--text-dim)', textAlign: 'center', padding: 24 }}>
                {songs.length === 0
                  ? 'No songs yet. Import a file or load demo songs.'
                  : `No songs match "${search}".`}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Song Details & Lyrics Button Mode Grid */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingRight: 4 }}>
          {selectedSong ? (
            <>
              {/* Header & Controls Bar */}
              <div className="glass" style={{ padding: 12, borderRadius: 'var(--radius-md)', marginBottom: 10, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                  <div>
                    <h3 style={{ ...type.title, fontWeight: fontWeight.bold, margin: 0, color: 'var(--text-primary)' }}>{selectedSong.title}</h3>
                    <div style={{ ...type.caption, color: 'var(--text-dim)', marginTop: 2 }}>
                      {selectedSong.artist || 'Unknown Artist'} {selectedSong.key ? `· Key: ${selectedSong.key}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button className="btn btn-secondary btn-sm" disabled={!formattedSlides.length} onClick={() => sendAdjacentSlide(-1)}>Prev</button>
                    <button className="btn btn-secondary btn-sm" disabled={!formattedSlides.length} onClick={() => sendAdjacentSlide(1)}>Next</button>
                  </div>
                </div>

                {/* Line Selection Option Bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap', paddingTop: 6, borderTop: '1px solid var(--border-primary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ ...type.caption, color: 'var(--text-secondary)', fontWeight: fontWeight.medium }}>Lines per slide:</span>
                    {(['auto', 1, 2, 4, 6] as const).map((val) => (
                      <button
                        key={String(val)}
                        className={`btn btn-sm ${linesPerSlide === val ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '2px 8px', ...type.caption }}
                        onClick={() => setLinesPerSlide(val)}
                      >
                        {val === 'auto' ? 'Auto (Section)' : `${val} ${val === 1 ? 'line' : 'lines'}`}
                      </button>
                    ))}
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', ...type.caption, color: 'var(--text-secondary)' }} title="Show song title, author, and copyright credits at the bottom of output (only when Auto (Section) mode is active)">
                    <input
                      type="checkbox"
                      checked={showSongCredits}
                      onChange={(e) => setShowSongCredits(e.target.checked)}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    Display Credits (Disabled by default)
                  </label>
                </div>
              </div>


              {/* Clickable Lyric Buttons Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                {formattedSlides.map((slide) => {
                  const sceneId = songSceneId(selectedSong, slide);
                  const isLive = currentScene?.type === 'song' && currentScene.id === sceneId;
                  const isPreview = previewScene?.type === 'song' && previewScene.id === sceneId;

                  const borderStyle = isLive
                    ? '2px solid #ef4444'
                    : isPreview
                    ? '2px solid #3b82f6'
                    : '1px solid var(--border-primary)';

                  const backgroundStyle = isLive
                    ? 'rgba(239, 68, 68, 0.08)'
                    : isPreview
                    ? 'rgba(59, 130, 246, 0.08)'
                    : 'var(--bg-surface)';

                  return (
                    <button
                      key={slide.id}
                      style={{
                        border: borderStyle,
                        background: backgroundStyle,
                        color: 'var(--text-primary)',
                        borderRadius: 8,
                        padding: 12,
                        textAlign: 'left',
                        cursor: 'pointer',
                        minHeight: 100,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        fontFamily: 'var(--font-ui)',
                        transition: 'all 0.15s ease',
                      }}
                      onClick={() => handleSendSlideToDisplay(selectedSong, slide)}
                      onDoubleClick={() => handleSendSlideToDisplay(selectedSong, slide, { direct: true })}
                      title={operatingMode === 'studio'
                        ? 'Click to stage in Preview · double-click to go straight to Program'
                        : 'Click to go live'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ ...type.label, color: 'var(--accent)', fontWeight: fontWeight.bold }}>
                          {slide.label}
                        </span>
                        {isLive && <span style={{ ...type.label, fontWeight: fontWeight.bold, padding: '2px 5px', borderRadius: 4, background: '#ef4444', color: '#fff' }}>LIVE</span>}
                        {isPreview && !isLive && <span style={{ ...type.label, fontWeight: fontWeight.bold, padding: '2px 5px', borderRadius: 4, background: '#3b82f6', color: '#fff' }}>PREVIEW</span>}
                      </div>
                      <span style={{ ...type.secondary, lineHeight: 1.45, whiteSpace: 'pre-line', color: 'var(--text-secondary)' }}>
                        {slide.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', ...type.body }}>
              Select a song from the left list to view lyrics & button mode controls.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
