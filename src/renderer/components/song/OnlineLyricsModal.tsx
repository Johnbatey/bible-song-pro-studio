import React, { useEffect, useState, useRef } from 'react';
import type { Song, SongSlide } from '../../types';
import { useAppStore } from '../../stores/appStore';
import { buildSongScene, getFormattedSlides } from '../../utils/song-slides';

interface OnlineSongResult {
  id: number | string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  plainLyrics?: string;
  syncedLyrics?: string;
}

interface OnlineLyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSongImported?: (song: Song) => void;
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function OnlineLyricsModal({ isOpen, onClose, onSongImported }: OnlineLyricsModalProps) {
  const songs = useAppStore((s) => s.songs);
  const setSongs = useAppStore((s) => s.setSongs);
  const addSong = useAppStore((s) => s.addSong);
  const addToQueue = useAppStore((s) => s.addToQueue);
  const linesPerSlide = useAppStore((s) => s.songLinesPerSlide);
  const showSongCredits = useAppStore((s) => s.showSongCredits);
  const pushNotice = useAppStore((s) => s.notify);

  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<OnlineSongResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<OnlineSongResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Editable fields for the selected song
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editLyrics, setEditLyrics] = useState('');
  const [parsedSlides, setParsedSlides] = useState<SongSlide[]>([]);
  const [isArranging, setIsArranging] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 80);
    } else {
      setQuery('');
      setResults([]);
      setSelectedResult(null);
      setSearchError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // When selected result changes, populate edit state and arrange lyrics
  useEffect(() => {
    if (!selectedResult) {
      setEditTitle('');
      setEditArtist('');
      setEditLyrics('');
      setParsedSlides([]);
      return;
    }

    setEditTitle(selectedResult.title);
    setEditArtist(selectedResult.artist);
    const lyrics = selectedResult.plainLyrics || '';
    setEditLyrics(lyrics);

    // Arrange lyrics into slides
    let isCancelled = false;
    setIsArranging(true);

    const parseLyrics = async () => {
      if (!lyrics.trim()) {
        setParsedSlides([]);
        setIsArranging(false);
        return;
      }

      try {
        const arrangeRes = await window.BSP?.song?.arrangeText({ text: lyrics });
        if (!isCancelled && arrangeRes?.ok && arrangeRes.sections?.length) {
          const slides: SongSlide[] = arrangeRes.sections.map((sec, idx) => ({
            id: `slide-${Date.now()}-${idx + 1}`,
            label: sec.name || `Verse ${idx + 1}`,
            text: sec.lines.join('\n'),
          }));
          setParsedSlides(slides);
          setIsArranging(false);
          return;
        }
      } catch (_) {}

      if (!isCancelled) {
        // Fallback local splitter by double line break or paragraphs
        const paragraphs = lyrics.split(/\n\s*\n/).filter((p) => p.trim());
        const fallbackSlides: SongSlide[] = paragraphs.map((para, idx) => {
          const lines = para.trim().split('\n');
          let label = `Verse ${idx + 1}`;
          let text = para.trim();
          const firstLine = lines[0].trim();
          if (/^\[(.*?)\]$/.test(firstLine)) {
            label = firstLine.replace(/^\[|\]$/g, '').trim();
            text = lines.slice(1).join('\n').trim();
          }
          return {
            id: `slide-${Date.now()}-${idx + 1}`,
            label,
            text,
          };
        });
        setParsedSlides(fallbackSlides.length > 0 ? fallbackSlides : [{
          id: `slide-${Date.now()}-1`,
          label: 'Verse 1',
          text: lyrics.trim(),
        }]);
        setIsArranging(false);
      }
    };

    parseLyrics();

    return () => {
      isCancelled = true;
    };
  }, [selectedResult]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setIsSearching(true);
    setSearchError(null);
    setSelectedResult(null);

    try {
      const res = await window.BSP?.song?.searchOnline({ query: q });
      if (res?.ok && res.results) {
        setResults(res.results);
        if (res.results.length === 0) {
          setSearchError(`No online lyrics found for "${q}". Try another song title or artist.`);
        } else {
          setSelectedResult(res.results[0]);
        }
      } else {
        setSearchError(res?.error || 'Failed to search online lyrics. Check internet connection.');
      }
    } catch (err: any) {
      setSearchError(err?.message || 'Error occurred while searching online.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleReArrangeLyrics = async (customLyrics: string) => {
    setEditLyrics(customLyrics);
    if (!customLyrics.trim()) {
      setParsedSlides([]);
      return;
    }
    try {
      const arrangeRes = await window.BSP?.song?.arrangeText({ text: customLyrics });
      if (arrangeRes?.ok && arrangeRes.sections?.length) {
        const slides: SongSlide[] = arrangeRes.sections.map((sec, idx) => ({
          id: `slide-${Date.now()}-${idx + 1}`,
          label: sec.name || `Verse ${idx + 1}`,
          text: sec.lines.join('\n'),
        }));
        setParsedSlides(slides);
        return;
      }
    } catch (_) {}

    // Fallback
    const paragraphs = customLyrics.split(/\n\s*\n/).filter((p) => p.trim());
    setParsedSlides(paragraphs.map((para, idx) => ({
      id: `slide-${Date.now()}-${idx + 1}`,
      label: `Verse ${idx + 1}`,
      text: para.trim(),
    })));
  };

  const createSongObject = (): Song => {
    const title = editTitle.trim() || 'Untitled Song';
    const artist = editArtist.trim();
    const finalSlides: SongSlide[] = parsedSlides.length > 0
      ? parsedSlides
      : [{ id: `slide-${Date.now()}-1`, label: 'Verse 1', text: editLyrics.trim() }];

    return {
      id: `song-${Date.now()}`,
      title,
      artist,
      author: artist,
      slides: finalSlides,
      categories: ['Worship', 'Online Import'],
    };
  };

  const handleImportOnly = () => {
    const newSong = createSongObject();
    // Check if song already exists with same title
    const existingIndex = songs.findIndex((s) => s.title.toLowerCase() === newSong.title.toLowerCase());
    if (existingIndex >= 0) {
      const updated = [...songs];
      updated[existingIndex] = { ...newSong, id: songs[existingIndex].id };
      setSongs(updated);
      pushNotice({ id: `song-import-${Date.now()}`, text: `Updated "${newSong.title}" in song library`, type: 'info', duration: 4, animation: 'slideDown' });
    } else {
      addSong(newSong);
      pushNotice({ id: `song-import-${Date.now()}`, text: `Imported "${newSong.title}" to song library`, type: 'info', duration: 4, animation: 'slideDown' });
    }

    if (onSongImported) onSongImported(newSong);
    onClose();
  };

  const handleImportAndQueue = () => {
    const newSong = createSongObject();
    addSong(newSong);
    const formatted = getFormattedSlides(newSong, linesPerSlide);
    if (formatted.length > 0) {
      formatted.forEach((slide) => {
        const scene = buildSongScene(newSong, slide, {
          includeCredits: showSongCredits && linesPerSlide === 'auto',
          target: newSong.isBilingual ? 'bilingual' : 'primary',
        });
        addToQueue({
          reference: `${newSong.title} · ${slide.label}`,
          text: slide.text,
          type: 'song',
          source: 'Manual',
          scene,
          songId: newSong.id,
          slideId: slide.id,
          linesPerSlide,
        });
      });
    }
    pushNotice({ id: `song-queue-${Date.now()}`, text: `Imported "${newSong.title}" and added to queue`, type: 'info', duration: 4, animation: 'slideDown' });
    if (onSongImported) onSongImported(newSong);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '920px',
          maxWidth: '96vw',
          height: '620px',
          maxHeight: '90vh',
          backgroundColor: '#121214',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 10,
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#ffffff',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            height: 48,
            padding: '0 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#18181b',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--accent, #FF5500)', display: 'flex', alignItems: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.01em' }}>
              Online Song Lyrics Search Engine
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: 4,
                backgroundColor: 'rgba(255, 85, 0, 0.15)',
                color: 'var(--accent, #FF5500)',
                textTransform: 'uppercase',
              }}
            >
              Public Lyrics API
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim, #888)',
              cursor: 'pointer',
              padding: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
              transition: 'color 0.15s ease',
            }}
            title="Close (Esc)"
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim, #888)')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Search Bar */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: '#141416',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}
        >
          <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 10, color: '#666', pointerEvents: 'none', display: 'flex' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search song title, hymn, artist (e.g. 10,000 Reasons, Reckless Love, How Great Thou Art)..."
                style={{
                  width: '100%',
                  height: 36,
                  paddingLeft: 34,
                  paddingRight: 32,
                  backgroundColor: '#1f1f23',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 6,
                  color: '#ffffff',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); searchInputRef.current?.focus(); }}
                  style={{
                    position: 'absolute',
                    right: 8,
                    background: 'transparent',
                    border: 'none',
                    color: '#888',
                    cursor: 'pointer',
                    padding: 4,
                  }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSearching || !query.trim()}
              style={{
                height: 36,
                padding: '0 18px',
                backgroundColor: isSearching ? '#333' : 'var(--accent, #FF5500)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: isSearching || !query.trim() ? 'default' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0,
                opacity: isSearching || !query.trim() ? 0.6 : 1,
              }}
            >
              {isSearching ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" strokeDasharray="30" strokeDashoffset="10" />
                  </svg>
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span>Search</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Modal Main Content Pane (Split: Results list + Preview & Formatting) */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          {/* Left Column: Search Results */}
          <div
            style={{
              width: 320,
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#111113',
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--text-dim, #888)',
                letterSpacing: '0.04em',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Results ({results.length})</span>
              {results.length > 0 && <span style={{ fontSize: 10, color: 'var(--accent, #FF5500)' }}>Select to preview</span>}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {isSearching && (
                <div style={{ padding: 24, textAlign: 'center', color: '#888', fontSize: 12 }}>
                  Searching online worship lyrics database...
                </div>
              )}

              {!isSearching && searchError && (
                <div style={{ padding: 16, color: '#f87171', fontSize: 12, lineHeight: 1.4, textAlign: 'center' }}>
                  {searchError}
                </div>
              )}

              {!isSearching && !searchError && results.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: '#666', fontSize: 12, lineHeight: 1.5 }}>
                  Type a song title or artist name above and click <strong>Search</strong> to query thousands of worship songs and hymn lyrics online.
                </div>
              )}

              {!isSearching && results.map((item) => {
                const isSelected = selectedResult?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedResult(item)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 6,
                      backgroundColor: isSelected ? 'var(--chrome-control-active, #2c221e)' : '#18181c',
                      border: isSelected ? '1px solid var(--accent, #FF5500)' : '1px solid rgba(255, 255, 255, 0.06)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? 'var(--accent, #FF5500)' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary, #aaa)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.artist} {item.album ? `· ${item.album}` : ''}
                      </span>
                      {item.duration ? (
                        <span style={{ color: '#777', fontSize: 10, flexShrink: 0 }}>
                          {formatDuration(item.duration)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Song Preview, Auto-Sectioning & Import */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#141417', minWidth: 0 }}>
            {selectedResult ? (
              <>
                {/* Meta Edit Bar */}
                <div
                  style={{
                    padding: '10px 16px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    backgroundColor: '#19191d',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <label style={{ fontSize: 10, color: 'var(--text-dim, #888)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Song Title
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      style={{
                        height: 28,
                        padding: '0 8px',
                        backgroundColor: '#222228',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 4,
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    />
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <label style={{ fontSize: 10, color: 'var(--text-dim, #888)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Artist / Author
                    </label>
                    <input
                      type="text"
                      value={editArtist}
                      onChange={(e) => setEditArtist(e.target.value)}
                      style={{
                        height: 28,
                        padding: '0 8px',
                        backgroundColor: '#222228',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 4,
                        color: '#fff',
                        fontSize: 12,
                      }}
                    />
                  </div>
                </div>

                {/* Slides Section Breakdown Preview */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim, #888)', letterSpacing: '0.04em' }}>
                      Auto-Formatted Sections ({parsedSlides.length} Slide{parsedSlides.length === 1 ? '' : 's'})
                    </span>
                    {isArranging && (
                      <span style={{ fontSize: 11, color: 'var(--accent, #FF5500)' }}>
                        Detecting Verses & Chorus...
                      </span>
                    )}
                  </div>

                  {parsedSlides.map((slide, sIdx) => (
                    <div
                      key={slide.id || sIdx}
                      style={{
                        padding: '12px 14px',
                        backgroundColor: '#1b1b1f',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 6,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 4,
                            backgroundColor: slide.label.toLowerCase().includes('chorus')
                              ? 'rgba(255, 85, 0, 0.2)'
                              : slide.label.toLowerCase().includes('bridge')
                              ? 'rgba(168, 85, 247, 0.2)'
                              : 'rgba(255, 255, 255, 0.1)',
                            color: slide.label.toLowerCase().includes('chorus')
                              ? '#ff7733'
                              : slide.label.toLowerCase().includes('bridge')
                              ? '#c084fc'
                              : '#ffffff',
                          }}
                        >
                          {slide.label}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-dim, #666)' }}>
                          Slide {sIdx + 1}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: '#e4e4e7',
                          lineHeight: 1.45,
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'inherit',
                        }}
                      >
                        {slide.text}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Import Bottom Action Footer */}
                <div
                  style={{
                    padding: '10px 16px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    backgroundColor: '#17171a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexShrink: 0,
                  }}
                >
                  {/* Left: Compact Slide Count Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--text-secondary, #aaa)',
                        backgroundColor: '#222226',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        padding: '4px 8px',
                        borderRadius: 5,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                      </svg>
                      <span>{parsedSlides.length} {parsedSlides.length === 1 ? 'Slide' : 'Slides'}</span>
                    </span>
                  </div>

                  {/* Right: Perfectly Aligned Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={handleImportAndQueue}
                      style={{
                        height: 34,
                        padding: '0 14px',
                        backgroundColor: '#27272a',
                        border: '1px solid rgba(255, 255, 255, 0.14)',
                        borderRadius: 6,
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap',
                        transition: 'background 0.15s ease, border-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#323238'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#27272a'; }}
                      title="Import to song library and add to active queue"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      <span>Import & Add to Queue</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleImportOnly}
                      style={{
                        height: 34,
                        padding: '0 16px',
                        backgroundColor: 'var(--accent, #FF5500)',
                        border: '1px solid transparent',
                        borderRadius: 6,
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 6px rgba(255, 85, 0, 0.3)',
                        transition: 'opacity 0.15s ease, transform 0.1s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.92'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                      title="Save to Song Library"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      <span>Import to Song Library</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: 12,
                  color: '#666',
                  padding: 24,
                }}
              >
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
                <div style={{ fontSize: 13, textAlign: 'center', maxWidth: 320, lineHeight: 1.4 }}>
                  Select a song from search results to preview structured slides and import directly into your library.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
