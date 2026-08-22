import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { importSongFiles, pickAndImportSongs, SONG_FILE_ACCEPT } from '../utils/song-import';
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
import { arrangeExistingSong, describeArrangement, shortLabel, type ArrangeProposal } from '../utils/song-arrange';
import { ImportConflictModal, type ConflictResolution, type ImportConflict } from './ImportConflictModal';

const DEMO_SONGS: Song[] = [
  {
    id: 'song-1',
    title: 'Amazing Grace',
    artist: 'John Newton',
    key: 'G',
    slides: [
      { id: 's1', label: 'Verse 1', text: 'Amazing grace! How sweet the sound\nThat saved a wretch like me.\nI once was lost, but now am found;\nWas blind, but now I see.' },
      { id: 's2', label: 'Verse 2', text: 'Twas grace that taught my heart to fear,\nAnd grace my fears relieved;\nHow precious did that grace appear\nThe hour I first believed.' },
      { id: 's3', label: 'Chorus', text: 'Amazing grace! How sweet the sound\nThat saved a wretch like me.\nI once was lost, but now am found;\nWas blind, but now I see.' },
    ],
  },
  {
    id: 'song-2',
    title: 'How Great Thou Art',
    artist: 'Carl Boberg',
    key: 'Eb',
    slides: [
      { id: 's4', label: 'Verse 1', text: 'O Lord my God! When I in awesome wonder\nConsider all the worlds Thy hands have made.\nI see the stars, I hear the rolling thunder,\nThy power throughout the universe displayed.' },
      { id: 's5', label: 'Chorus', text: 'Then sings my soul, my Savior God, to Thee:\nHow great Thou art! How great Thou art!' },
    ],
  },
  {
    id: 'song-3',
    title: 'What a Beautiful Name',
    artist: 'Hillsong Worship',
    key: 'D',
    slides: [
      { id: 's6', label: 'Verse 1', text: 'You were the Word at the beginning\nOne with God the Lord Most High\nYour hidden glory in creation\nNow revealed in You the Christ' },
      { id: 's7', label: 'Chorus', text: 'What a beautiful Name it is\nWhat a beautiful Name it is\nThe Name of Jesus Christ my King' },
    ],
  },
];

/** Pending import data held while the conflict modal is up. */
interface PendingImport {
  fresh: Song[];
  conflicts: ImportConflict[];
  errors: string[];
}

export function SongsPanel() {
  const songs = useAppStore((s) => s.songs);
  const setSongs = useAppStore((s) => s.setSongs);
  const updateSong = useAppStore((s) => s.updateSong);
  const removeSongs = useAppStore((s) => s.removeSongs);
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
  /** Multi-select: ids of songs the operator has checked for bulk delete. */
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bgOpen, setBgOpen] = useState(false);
  const [arrOpen, setArrOpen] = useState(false);
  const [arranging, setArranging] = useState(false);
  /** A proposal is shown and waited on — auto-arrange never restructures a song
      someone has already built a service around without being told to. */
  const [proposal, setProposal] = useState<ArrangeProposal | null>(null);
  /** One level of undo, in local state on purpose: it covers the "that wasn't
      what I meant" moment, and Clear arrangement covers everything after. */
  const [undoSnapshot, setUndoSnapshot] = useState<Song | null>(null);
  const { items: mediaItems } = useMediaLibrary();
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  /** The lyric a search sent us to, so the right block can point at it. */
  const [lyricTarget, setLyricTarget] = useState<string | null>(null);
  /** Pending import held while the conflict modal is up. */
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
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

  /* ── Delete songs ── */
  const handleDeleteSongs = (ids: string[]) => {
    if (ids.length === 0) return;
    const label = ids.length === 1
      ? songs.find((s) => s.id === ids[0])?.title ?? 'this song'
      : `${ids.length} songs`;
    const ok = window.confirm(`Delete ${label}? This cannot be undone.`);
    if (!ok) return;
    removeSongs(ids);
    /* Clear selection state for any deleted songs. */
    if (selectedSong && ids.includes(selectedSong.id)) setSelectedSong(null);
    setCheckedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    notify(`Deleted ${ids.length} song${ids.length === 1 ? '' : 's'}.`);
  };

  const toggleChecked = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  /* ── Import with duplicate detection ── */

  /** Shared logic: given a list of parsed songs, split them into fresh vs
      duplicate, show the conflict modal if needed, else import silently. */
  const processImported = (imported: Song[], errors: string[]) => {
    if (imported.length === 0) {
      if (errors.length > 0) notify(errors[0], 'warning');
      return;
    }

    const existingByTitle = new Map(
      songs.map((s) => [s.title.toLowerCase(), s]),
    );
    const fresh: Song[] = [];
    const conflicts: ImportConflict[] = [];

    for (const incoming of imported) {
      const existing = existingByTitle.get(incoming.title.toLowerCase());
      if (existing) {
        conflicts.push({ incoming, existing });
      } else {
        fresh.push(incoming);
      }
    }

    if (conflicts.length > 0) {
      /* Show the modal and wait for the operator's decision. */
      setPendingImport({ fresh, conflicts, errors });
    } else {
      /* No conflicts — import silently as before. */
      setSongs([...songs, ...fresh]);
      notify(`Imported ${fresh.length} song${fresh.length === 1 ? '' : 's'}.`);
      if (errors.length > 0) notify(errors[0], 'warning');
    }
  };

  const handleImport = async (files: File[]) => {
    if (files.length === 0) return;
    setImporting(true);
    try {
      const { songs: imported, errors } = await importSongFiles(files);
      processImported(imported, errors);
    } finally {
      setImporting(false);
    }
  };

  const handlePickImport = async () => {
    setImporting(true);
    try {
      const { songs: imported, errors } = await pickAndImportSongs();
      processImported(imported, errors);
    } finally {
      setImporting(false);
    }
  };

  /** Called by ImportConflictModal when the operator makes their choice. */
  const resolveImportConflict = useCallback((resolution: ConflictResolution) => {
    if (!pendingImport) { setPendingImport(null); return; }
    const { fresh, conflicts, errors } = pendingImport;
    setPendingImport(null);

    if (resolution === 'cancel') {
      notify('Import cancelled.');
      return;
    }

    if (resolution === 'skip') {
      /* Add only the new songs. */
      if (fresh.length > 0) {
        setSongs([...songs, ...fresh]);
        notify(
          `Imported ${fresh.length} song${fresh.length === 1 ? '' : 's'}` +
            ` · skipped ${conflicts.length} existing`,
        );
      } else {
        notify(`Skipped ${conflicts.length} existing song${conflicts.length === 1 ? '' : 's'} — nothing new to import.`);
      }
    } else if (resolution === 'overwrite') {
      /* Replace existing songs with the incoming versions (keep the existing id
         so any queue or scene references survive). */
      const overwritten = conflicts.map((c) => ({ ...c.incoming, id: c.existing.id }));
      const updatedSongs = songs.map((s) => {
        const replacement = overwritten.find((o) => o.id === s.id);
        return replacement ?? s;
      });
      setSongs([...updatedSongs, ...fresh]);
      const total = fresh.length + conflicts.length;
      notify(
        `Imported ${total} song${total === 1 ? '' : 's'}` +
          ` (${conflicts.length} overwritten)`,
      );
    }

    if (errors.length > 0) notify(errors[0], 'warning');
  }, [pendingImport, songs, setSongs, notify]);

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

  /** Edits the selected song in place; persisted with the rest of the library.
      The local copy has to be updated too — this panel holds `selectedSong` as
      its own object, not an id, so a store-only write leaves the deck stale. */
  const patchSelectedSong = (patch: Partial<Song>) => {
    if (!selectedSong) return;
    const updated = { ...selectedSong, ...patch };
    setSelectedSong(updated);
    updateSong(updated.id, patch);
  };

  /* The order as the deck will play it. An absent arrangement means the slide
     list, which is what the editor starts from when the operator first opens it. */
  const effectiveOrder = selectedSong
    ? (Array.isArray(selectedSong.arrangement) && selectedSong.arrangement.length > 0
        ? selectedSong.arrangement.filter((id) => selectedSong.slides.some((s) => s.id === id))
        : selectedSong.slides.map((s) => s.id))
    : [];

  /** Writing back the natural order clears the field rather than storing it —
      an arrangement that changes nothing is a thing that can break for nothing. */
  const setOrder = (next: string[]) => {
    if (!selectedSong) return;
    const natural = selectedSong.slides.map((s) => s.id);
    const redundant = next.length === natural.length && next.every((id, i) => id === natural[i]);
    patchSelectedSong({ arrangement: redundant ? undefined : next });
  };

  const runAutoArrange = async () => {
    if (!selectedSong) return;
    setArranging(true);
    try {
      const result = await arrangeExistingSong(selectedSong);
      if ('error' in result) { notify(result.error, 'warning'); return; }
      if (!result.changed) { notify('Already arranged — nothing to change.'); return; }
      setProposal(result);
    } finally {
      setArranging(false);
    }
  };

  const applyProposal = () => {
    if (!proposal || !selectedSong) return;
    setUndoSnapshot(selectedSong);
    setSelectedSong(proposal.song);
    updateSong(proposal.song.id, proposal.song);
    setProposal(null);
    notify(`Arranged into ${proposal.song.slides.length} sections.`);
  };

  const undoArrange = () => {
    if (!undoSnapshot) return;
    setSelectedSong(undoSnapshot);
    updateSong(undoSnapshot.id, undoSnapshot);
    setUndoSnapshot(null);
    notify('Arrangement undone.');
  };

  /* Name the chosen clip in the summary row rather than its url — a background
     reading `/media/a1b2c3.mp4` tells the operator nothing about which one. */
  const mediaNameFor = (url: string | undefined) =>
    url ? mediaItems.find((item) => item.url === url)?.name : undefined;

  /* A pending proposal belongs to the song it was computed from, and an undo
     stash to the song it was taken from. Switching songs drops both. */
  useEffect(() => {
    setProposal(null);
    setUndoSnapshot(null);
  }, [selectedSong?.id]);

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

      {/* Import conflict modal — rendered outside the layout blocks. */}
      {pendingImport && (
        <ImportConflictModal
          freshCount={pendingImport.fresh.length}
          conflicts={pendingImport.conflicts}
          onResolve={resolveImportConflict}
        />
      )}

      {/* Left block: search & song list */}
      <Block
        title="Songs"
        subtitle={`${songs.length}`}
        style={{ flex: `0 0 ${listWidth}px`, minWidth: 180 }}
        tools={(
          <>
            {checkedIds.size > 0 && (
              <BlockButton
                onClick={() => handleDeleteSongs(Array.from(checkedIds))}
                title={`Delete ${checkedIds.size} selected song${checkedIds.size === 1 ? '' : 's'}`}
              >
                Delete ({checkedIds.size})
              </BlockButton>
            )}
            {songs.length === 0 && (
              <BlockButton onClick={handleAddDemoSongs}>Demo</BlockButton>
            )}
            <BlockButton onClick={handlePickImport} disabled={importing}>
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
              const isChecked = checkedIds.has(song.id);
              return (
                <div
                  key={song.id}
                  className={`card card-hover`}
                  style={{
                    cursor: 'pointer',
                    borderColor: isSelected
                      ? 'var(--chrome-control-active)'
                      : isChecked
                        ? 'var(--tally-fault, #ff6b6b)'
                        : 'rgba(255, 255, 255, 0.08)',
                    background: isSelected ? 'var(--chrome-control-active)' : 'var(--bg-secondary)',
                    padding: 10,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                  }}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('[data-song-check]')) return;
                    setSelectedSong(song);
                  }}
                >
                  {/* Multi-select checkbox */}
                  <input
                    type="checkbox"
                    data-song-check
                    checked={isChecked}
                    onChange={() => toggleChecked(song.id)}
                    onClick={(e) => e.stopPropagation()}
                    title="Select for bulk delete"
                    style={{
                      accentColor: 'var(--tally-fault, #ff6b6b)',
                      cursor: 'pointer',
                      marginTop: 3,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                      <div style={{ ...type.heading, fontWeight: isSelected ? fontWeight.semibold : fontWeight.medium, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {song.title}
                      </div>
                      {/* Single-song delete button */}
                      <button
                        type="button"
                        title={`Delete ${song.title}`}
                        onClick={(e) => { e.stopPropagation(); handleDeleteSongs([song.id]); }}
                        style={songDeleteBtnStyle}
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                          <path d="M2.5 4.5h11" />
                          <path d="M5.5 4.5V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" />
                          <path d="M3.5 4.5l.7 9a1 1 0 0 0 1 .9h5.6a1 1 0 0 0 1-.9l.7-9" />
                        </svg>
                      </button>
                    </div>
                    <div style={{ ...type.caption, color: 'var(--text-dim)', marginTop: 2 }}>
                      {song.artist || 'Unknown Artist'} {song.key ? `· Key: ${song.key}` : ''}
                    </div>
                    <div style={{ ...type.caption, color: 'var(--text-dim)', marginTop: 2 }}>
                      {song.slides.length} slides
                    </div>
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

        {/* Play order. Lives here rather than in the deck's toolbar because it
            restructures the song, and the deck's tools are also Live's — those
            are for running a service, not rebuilding one mid-service. */}
        {selectedSong && (
          <div style={styles.bgSection}>
            <button
              type="button"
              onClick={() => setArrOpen((open) => !open)}
              style={styles.bgHeader}
              title={arrOpen ? 'Hide play order' : 'Set the order sections are sung in'}
            >
              <span>Arrangement</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--text-dim)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                  {describeArrangement(selectedSong)}
                </span>
                <span style={{ color: 'var(--text-dim)' }}>{arrOpen ? '▾' : '▸'}</span>
              </span>
            </button>

            {arrOpen && (
              <div style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* The order itself, editable. Repeating a chorus is the weekly
                    job and wants no detector at all. */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {effectiveOrder.map((id, index) => {
                    const slide = selectedSong.slides.find((s) => s.id === id);
                    return (
                      <span key={`${id}-${index}`} style={styles.chip}>
                        <button
                          type="button"
                          style={styles.chipArrow}
                          disabled={index === 0}
                          title="Move earlier"
                          onClick={() => {
                            const next = [...effectiveOrder];
                            [next[index - 1], next[index]] = [next[index], next[index - 1]];
                            setOrder(next);
                          }}
                        >‹</button>
                        <span title={slide?.label}>{shortLabel(slide?.label || '?')}</span>
                        <button
                          type="button"
                          style={styles.chipArrow}
                          disabled={index === effectiveOrder.length - 1}
                          title="Move later"
                          onClick={() => {
                            const next = [...effectiveOrder];
                            [next[index], next[index + 1]] = [next[index + 1], next[index]];
                            setOrder(next);
                          }}
                        >›</button>
                        <button
                          type="button"
                          style={{ ...styles.chipArrow, color: 'var(--tally-fault)' }}
                          title="Remove from the order"
                          onClick={() => setOrder(effectiveOrder.filter((_, i) => i !== index))}
                        >×</button>
                      </span>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                  <span style={{ ...type.caption, color: 'var(--text-dim)' }}>Add</span>
                  {selectedSong.slides.map((slide) => (
                    <BlockButton
                      key={slide.id}
                      onClick={() => setOrder([...effectiveOrder, slide.id])}
                      title={`Add ${slide.label} to the end of the order`}
                    >
                      + {shortLabel(slide.label)}
                    </BlockButton>
                  ))}
                </div>

                {proposal ? (
                  <div style={styles.proposal}>
                    <div style={{ ...type.caption, color: 'var(--text-secondary)' }}>
                      {proposal.confidence < 0.6
                        ? 'Guessed from the line breaks — check the sections before applying.'
                        : 'Proposed sections and play order:'}
                    </div>
                    <div style={{ ...type.secondary, color: 'var(--text-primary)' }}>
                      {proposal.song.slides.map((s) => s.label).join(' · ')}
                    </div>
                    <div style={{ ...type.caption, color: 'var(--text-dim)' }}>
                      Order:{' '}
                      {(proposal.song.arrangement || proposal.song.slides.map((s) => s.id))
                        .map((id) => shortLabel(proposal.song.slides.find((s) => s.id === id)?.label || '?'))
                        .join(' ')}
                    </div>
                    {proposal.warnings.map((w) => (
                      <div key={w} style={{ ...type.caption, color: 'var(--tally-fault)' }}>{w}</div>
                    ))}
                    <div style={{ display: 'flex', gap: 4 }}>
                      <BlockButton onClick={applyProposal}>Apply</BlockButton>
                      <BlockButton onClick={() => setProposal(null)}>Cancel</BlockButton>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <BlockButton
                      onClick={runAutoArrange}
                      disabled={arranging}
                      title="Re-read the lyrics, split them into sections and work out the play order"
                    >
                      {arranging ? 'Reading…' : 'Auto-arrange'}
                    </BlockButton>
                    {undoSnapshot && (
                      <BlockButton onClick={undoArrange}>Undo arrange</BlockButton>
                    )}
                    {selectedSong.arrangement && selectedSong.arrangement.length > 0 && (
                      <BlockButton onClick={() => patchSelectedSong({ arrangement: undefined })}>
                        Clear order
                      </BlockButton>
                    )}
                  </div>
                )}
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

/** Trash icon on each song row — visible on hover via CSS, but we use opacity
    since the layout is inline-style. Always visible by default so keyboard and
    touch users can reach it; the hover dimming is a visual nicety only. */
const songDeleteBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  borderRadius: 4,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-dim)',
  cursor: 'pointer',
  padding: 0,
  opacity: 0.5,
  transition: 'opacity 0.1s, color 0.1s',
  flexShrink: 0,
};

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
  chip: {
    ...type.caption,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
    padding: '1px 2px 1px 6px',
    borderRadius: 4,
    border: '1px solid var(--border-primary)',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-ui)',
  },
  chipArrow: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-dim)',
    cursor: 'pointer',
    padding: '0 3px',
    lineHeight: 1,
    fontSize: 12,
  },
  proposal: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: 8,
    borderRadius: 6,
    border: '1px solid var(--chrome-control-active)',
    background: 'var(--bg-surface)',
  },
};
