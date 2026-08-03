import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { importSongFiles, SONG_FILE_ACCEPT } from '../utils/song-import';
import type { Scene, Song } from '../types';
import { type, fontWeight } from '../styles/type';
import { Block, BlockButton, BlockSegment } from './Block';
import { AppleToggle } from './AppleToggle';

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
  const triggerAlert = useAppStore((s) => s.triggerAlert);

  const [search, setSearch] = useState('');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [linesPerSlide, setLinesPerSlide] = useState<number | 'auto'>('auto');
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  /** The lyric a search sent us to, so the right block can point at it. */
  const [lyricTarget, setLyricTarget] = useState<string | null>(null);
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

  /* Resolved against the *formatted* slides rather than stored at click time,
     so the mark follows the lyric when Lines per slide re-chunks the song. */
  const targetSlideId = lyricTarget
    ? formattedSlides.find((s) => s.text.toLowerCase().includes(lyricTarget))?.id
    : undefined;
  const targetSlideRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (targetSlideId) targetSlideRef.current?.scrollIntoView({ block: 'nearest' });
  }, [targetSlideId]);

  const songSceneId = (song: Song, slide: FormattedSlide) =>
    `song-${song.id}-${slide.id}`.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9:._/-]/g, '');

  /** Live wins over staged — the same rule the row highlight follows. */
  const activeSceneId = currentScene?.type === 'song'
    ? currentScene.id
    : previewScene?.type === 'song'
      ? previewScene.id
      : '';

  /* Prev/Next and the arrow keys can walk the song past the visible slides, so
     the one that just went out has to be pulled back into view. */
  useEffect(() => {
    if (!activeSceneId) return;
    slideRefs.current[activeSceneId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeSceneId, formattedSlides.length, selectedSong?.id]);

  const buildSongScene = (song: Song, slide: FormattedSlide): Scene => {
    const includeCredits = showSongCredits && linesPerSlide === 'auto';
    return {
      id: songSceneId(song, slide),
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
  };

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
    const scene = buildSongScene(song, slide);
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
        style={{ flex: '0 0 300px', minWidth: 220 }}
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
      </Block>

      {/* Right block: song details & lyric slides */}
      <Block
        className="blk-fill"
        title={selectedSong ? selectedSong.title : 'Lyrics'}
        subtitle={selectedSong
          ? `${selectedSong.artist || 'Unknown Artist'}${selectedSong.key ? ` · Key: ${selectedSong.key}` : ''}`
          : undefined}
        tools={selectedSong ? (
          <>
            <BlockButton disabled={!formattedSlides.length} onClick={() => sendAdjacentSlide(-1)}>Prev</BlockButton>
            <BlockButton disabled={!formattedSlides.length} onClick={() => sendAdjacentSlide(1)}>Next</BlockButton>
          </>
        ) : undefined}
        footer={selectedSong ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ ...type.caption, color: 'var(--text-dim)' }}>Lines per slide</span>
              <BlockSegment>
                {(['auto', 1, 2, 4, 6] as const).map((val) => (
                  <BlockButton
                    key={String(val)}
                    active={linesPerSlide === val}
                    onClick={() => setLinesPerSlide(val)}
                  >
                    {val === 'auto' ? 'Auto' : String(val)}
                  </BlockButton>
                ))}
              </BlockSegment>
            </div>

            <AppleToggle
              label="Display credits"
              checked={showSongCredits}
              onChange={setShowSongCredits}
            />
          </>
        ) : undefined}
      >
        {selectedSong ? (
          <>
            {/* Clickable Lyric Buttons Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                {formattedSlides.map((slide) => {
                  const sceneId = songSceneId(selectedSong, slide);
                  const isLive = currentScene?.type === 'song' && currentScene.id === sceneId;
                  const isPreview = previewScene?.type === 'song' && previewScene.id === sceneId;

                  const isTarget = slide.id === targetSlideId;

                  const borderStyle = isLive
                    ? '2px solid #FF5500'
                    : isPreview
                    ? '2px solid #3b82f6'
                    : isTarget
                    ? '1px solid var(--chrome-control-active)'
                    : '1px solid var(--border-primary)';

                  const backgroundStyle = isLive
                    ? '#3d1403'
                    : isPreview
                    ? 'rgba(59, 130, 246, 0.08)'
                    : isTarget
                    ? 'var(--chrome-control-active)'
                    : 'var(--bg-surface)';

                  return (
                    <div
                      key={slide.id}
                      className="row-hover"
                      ref={(el) => {
                        slideRefs.current[sceneId] = el;
                        if (isTarget) targetSlideRef.current = el;
                      }}
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                        <span style={{ ...type.label, color: 'var(--accent)', fontWeight: fontWeight.bold }}>
                          {slide.label}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isLive && <span style={{ ...type.label, fontWeight: fontWeight.bold, padding: '2px 5px', borderRadius: 4, background: '#FF5500', color: '#fff' }}>LIVE</span>}
                          {isPreview && !isLive && <span style={{ ...type.label, fontWeight: fontWeight.bold, padding: '2px 5px', borderRadius: 4, background: '#3b82f6', color: '#fff' }}>PREVIEW</span>}
                          {/* Queue Plus (+) — revealed on hover */}
                          <button
                            type="button"
                            className="row-action"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToQueue({
                                reference: `${selectedSong.title} · ${slide.label}`,
                                text: slide.text,
                                type: 'song',
                                source: 'Manual',
                                scene: buildSongScene(selectedSong, slide),
                              });
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ffffff',
                              fontSize: 16,
                              cursor: 'pointer',
                              padding: '0 4px',
                              lineHeight: 1,
                            }}
                            title="Add slide to Queue"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <span style={{ ...type.secondary, lineHeight: 1.45, whiteSpace: 'pre-line', color: 'var(--text-secondary)' }}>
                        {slide.text}
                      </span>
                    </div>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', ...type.body }}>
            Select a song from the left list to view lyrics & button mode controls.
          </div>
        )}
      </Block>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  matchHeading: {
    ...type.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-dim)',
    padding: '8px 2px 2px',
  },
};
