import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { importSongFiles, pickAndImportSongs, SONG_FILE_ACCEPT } from '../utils/song-import';
import type { Scene, Song, Background } from '../types';
import { type, fontWeight } from '../styles/type';
import { Block, BlockButton, BlockSegment } from './Block';
import { AppleToggle } from './AppleToggle';
import { PanelSplitter } from './PanelSplitter';
import { SongDeck } from './song/SongDeck';
import { BackgroundPicker, BackgroundPopover, getBackgroundFromTheme } from './BackgroundPicker';
import { backgroundSwatchCss } from '../utils/background';
import { useMediaLibrary } from '../hooks/useMediaLibrary';
import { isFocusedDock } from './dock/dockFocus';
import { arrangeExistingSong, describeArrangement, shortLabel, type ArrangeProposal } from '../utils/song-arrange';
import { getFormattedSlides, buildSongScene } from '../utils/song-slides';
import { ImportConflictModal, type ConflictResolution, type ImportConflict } from './ImportConflictModal';
import { OnlineLyricsModal } from './song/OnlineLyricsModal';
import { FxAnimationPopover } from './FxAnimationPopover';
import { ArrangementPopover } from './ArrangementPopover';
import { useI18n } from '../../i18n/useI18n';

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
  const { t } = useI18n();
  const songs = useAppStore((s) => s.songs);
  const setSongs = useAppStore((s) => s.setSongs);
  const addSong = useAppStore((s) => s.addSong);
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
  const linesPerSlide = useAppStore((s) => s.songLinesPerSlide);
  const setSongLinesPerSlide = useAppStore((s) => s.setSongLinesPerSlide);
  const doubleClickToGoLive = useAppStore((s) => s.doubleClickToGoLive);
  const addToQueue = useAppStore((s) => s.addToQueue);
  const pushNotice = useAppStore((s) => s.notify);
  const fxSettings = useAppStore((s) => s.fxSettings);
  const activeTheme = useAppStore((s) => s.activeTheme);
  const isThemeFsLtLinked = useAppStore((s) => s.isThemeFsLtLinked);
  const toggleThemeFsLtLinked = useAppStore((s) => s.toggleThemeFsLtLinked);
  const setThemeBackground = useAppStore((s) => s.setThemeBackground);
  const songOutputMode = useAppStore((s) => s.display.songOutputMode || 'fullscreen');
  const setSongOutputMode = useAppStore((s) => s.setSongOutputMode);
  const openThemeStudio = useAppStore((s) => s.openThemeStudio);
  const isThemeStudioOpen = useAppStore((s) => s.isThemeStudioOpen);

  const currentSongEffectiveBackground = useMemo(() => {
    return getBackgroundFromTheme(activeTheme, songOutputMode);
  }, [activeTheme, songOutputMode]);

  const [bgOpen, setBgOpen] = useState(false);
  const bgButtonRef = useRef<HTMLButtonElement>(null);
  const [arrOpen, setArrOpen] = useState(false);
  const arrButtonRef = useRef<HTMLButtonElement>(null);
  const [isFxPopoverOpen, setIsFxPopoverOpen] = useState(false);
  const fxButtonRef = useRef<HTMLButtonElement>(null);
  const [search, setSearch] = useState('');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const songItemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const handleSyncSong = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const targetSong = (detail.songId && songs.find((s) => s.id === detail.songId)) ||
        (detail.songTitle && songs.find((s) => s.title.trim().toLowerCase() === detail.songTitle.trim().toLowerCase())) ||
        (detail.text && songs.find((s) => s.slides.some((sl) => sl.text.includes(detail.text))));

      if (targetSong) {
        setSelectedSong(targetSong);
        if (detail.text) setLyricTarget(detail.text);
        setTimeout(() => {
          songItemRefs.current[targetSong.id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 60);
      }
      if (detail.linesPerSlide !== undefined && (typeof detail.linesPerSlide === 'number' || detail.linesPerSlide === 'auto')) {
        setSongLinesPerSlide(detail.linesPerSlide);
      }
    };

    window.addEventListener('bsp:sync-song', handleSyncSong);
    return () => window.removeEventListener('bsp:sync-song', handleSyncSong);
  }, [songs, setSongLinesPerSlide]);
  /** Multi-select: ids of songs the operator has checked for bulk delete. */
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  /** Selection mode toggle: enables checkboxes and batch operations. */
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [hoveredSongId, setHoveredSongId] = useState<string | null>(null);
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
  const [onlineSearchOpen, setOnlineSearchOpen] = useState(false);
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

  const handleCreateNewSong = () => {
    const newSong: Song = {
      id: `song-${Date.now()}`,
      title: 'New Song',
      author: '',
      key: '',
      slides: [
        { id: `slide-${Date.now()}-1`, label: 'Verse 1', text: '' },
      ],
      categories: ['Custom'],
    };
    addSong(newSong);
    setSelectedSong(newSong);
    notify('Created new song. Edit title and lyrics in the editor.');
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
      if (next.size === 0) setIsSelectMode(false);
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

  const [sortAsc, setSortAsc] = useState(true);

  const searchQuery = search.trim().toLowerCase();

  const filteredSongs = songs.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery) ||
      (s.artist && s.artist.toLowerCase().includes(searchQuery))
  );

  const sortedSongs = useMemo(() => {
    return [...filteredSongs].sort((a, b) => {
      const cmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      return sortAsc ? cmp : -cmp;
    });
  }, [filteredSongs, sortAsc]);

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

      {/* Online lyrics search engine modal */}
      {onlineSearchOpen && (
        <OnlineLyricsModal
          isOpen={onlineSearchOpen}
          onClose={() => setOnlineSearchOpen(false)}
          onSongImported={(song) => setSelectedSong(song)}
        />
      )}

      {/* Left block: search & song list */}
      <Block
        title={t('songs.title')}
        subtitle={`${songs.length}`}
        style={{ flex: `0 0 ${listWidth}px`, minWidth: 180 }}
        tools={(
          <>
            <BlockButton
              onClick={() => setOnlineSearchOpen(true)}
              title="Search online worship songs and hymns"
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <span>Online</span>
              </span>
            </BlockButton>
            <BlockButton onClick={handleCreateNewSong} title="Create a new song manually">
              + New
            </BlockButton>
            {songs.length > 0 && (
              <BlockButton
                active={isSelectMode}
                onClick={() => {
                  if (isSelectMode) {
                    setIsSelectMode(false);
                    setCheckedIds(new Set());
                  } else {
                    setIsSelectMode(true);
                  }
                }}
                title={isSelectMode ? t('songs.exitSelect') : t('songs.selectHint')}
              >
                {isSelectMode ? t('panel.done') : t('panel.select')}
              </BlockButton>
            )}
            {songs.length === 0 && (
              <BlockButton onClick={handleAddDemoSongs}>{t('panel.demo')}</BlockButton>
            )}
            <BlockButton onClick={handlePickImport} disabled={importing}>
              {importing ? t('panel.importing') : t('panel.import')}
            </BlockButton>
          </>
        )}
        bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 4, height: '100%', minHeight: 0, padding: '4px 6px' }}
        footer={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
            {/* Background SVG Icon Button */}
            <button
              ref={bgButtonRef}
              type="button"
              onClick={() => {
                setBgOpen((v) => !v);
                if (!bgOpen) setArrOpen(false);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                padding: 0,
                borderRadius: 4,
                border: 'none',
                background: bgOpen ? 'rgba(255, 85, 0, 0.18)' : 'transparent',
                color: bgOpen ? 'var(--accent, #FF5500)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title={bgOpen ? 'Close background options' : `Song Background (${songOutputMode === 'lowerThird' ? 'LT' : 'FS'})`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </button>

            <BackgroundPopover
              isOpen={bgOpen}
              onClose={() => setBgOpen(false)}
              anchorRef={bgButtonRef}
              value={currentSongEffectiveBackground}
              onChange={(bg) => {
                if (bg) {
                  setThemeBackground(bg, songOutputMode);
                  if (selectedSong?.background) {
                    patchSelectedSong({ background: undefined });
                  }
                }
              }}
              workspaceLabel="Songs"
              outputMode={songOutputMode === 'lowerThird' ? 'LT' : 'FS'}
              isLinked={isThemeFsLtLinked}
            />

            {/* Arrangement SVG Icon Button (Icon Only with tooltip) */}
            <button
              ref={arrButtonRef}
              type="button"
              onClick={() => {
                if (!selectedSong) return;
                setArrOpen((v) => !v);
                if (!arrOpen) setBgOpen(false);
              }}
              disabled={!selectedSong}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                padding: 0,
                borderRadius: 4,
                border: 'none',
                background: arrOpen ? 'rgba(255, 85, 0, 0.18)' : 'transparent',
                color: arrOpen ? 'var(--accent, #FF5500)' : 'var(--text-secondary)',
                cursor: selectedSong ? 'pointer' : 'not-allowed',
                opacity: selectedSong ? 1 : 0.45,
                transition: 'all 0.15s ease',
              }}
              title={selectedSong ? (arrOpen ? 'Close arrangement' : `Song Arrangement (${describeArrangement(selectedSong)})`) : 'Select a song to edit arrangement'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>

            {selectedSong && (
              <ArrangementPopover
                isOpen={arrOpen}
                onClose={() => setArrOpen(false)}
                anchorRef={arrButtonRef}
                song={selectedSong}
                effectiveOrder={effectiveOrder}
                setOrder={setOrder}
                proposal={proposal}
                applyProposal={applyProposal}
                setProposal={setProposal}
                runAutoArrange={runAutoArrange}
                arranging={arranging}
                undoSnapshot={undoSnapshot}
                undoArrange={undoArrange}
                patchSelectedSong={patchSelectedSong}
              />
            )}

            {/* FX Animation Button */}
            <button
              type="button"
              ref={fxButtonRef}
              onClick={() => setIsFxPopoverOpen((v) => !v)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                padding: 0,
                borderRadius: 4,
                border: 'none',
                background: isFxPopoverOpen ? 'rgba(255, 85, 0, 0.18)' : 'transparent',
                color: isFxPopoverOpen ? 'var(--accent, #FF5500)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Animation FX"
            >
              <span style={{ fontFamily: "'Georgia', serif", fontStyle: 'italic', fontSize: 13, fontWeight: 900, lineHeight: 1 }}>
                fx
              </span>
            </button>

            <FxAnimationPopover
              isOpen={isFxPopoverOpen}
              onClose={() => setIsFxPopoverOpen(false)}
              anchorRef={fxButtonRef}
              workspaceLabel="Songs"
            />

            {/* Theme Studio SVG Icon Button */}
            <button
              type="button"
              onClick={() =>
                openThemeStudio({
                  contentMode: 'song',
                  surfaceTab: songOutputMode === 'lowerThird' ? 'lt' : 'full',
                })
              }
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                padding: 0,
                borderRadius: 4,
                border: 'none',
                background: isThemeStudioOpen ? 'rgba(255, 85, 0, 0.18)' : 'transparent',
                color: isThemeStudioOpen ? 'var(--accent, #FF5500)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Theme Studio"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
                <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
                <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
                <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
              </svg>
            </button>
          </div>
        )}
      >
        <input
          className="input"
          placeholder={t('songs.searchPlaceholder')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setLyricTarget(null); }}
          style={{
            height: 26,
            padding: '3px 8px',
            fontSize: 12,
            borderRadius: 4,
            flexShrink: 0,
          }}
        />

        {/* Multi-Select Action Bar */}
        {isSelectMode && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 8px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 4,
              fontSize: 11,
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              className="btn btn-xs"
              onClick={() => {
                const allSelected = sortedSongs.length > 0 && sortedSongs.every((s) => checkedIds.has(s.id));
                if (allSelected) {
                  setCheckedIds((prev) => {
                    const next = new Set(prev);
                    sortedSongs.forEach((s) => next.delete(s.id));
                    return next;
                  });
                } else {
                  setCheckedIds((prev) => {
                    const next = new Set(prev);
                    sortedSongs.forEach((s) => next.add(s.id));
                    return next;
                  });
                }
              }}
              style={{
                background: 'var(--chrome-control)',
                border: '1px solid var(--border-primary)',
                color: 'var(--text-primary)',
                padding: '1px 6px',
                borderRadius: 3,
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: 11,
              }}
            >
              {sortedSongs.length > 0 && sortedSongs.every((s) => checkedIds.has(s.id))
                ? 'Deselect All'
                : 'Select All'}
            </button>

            <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
              {checkedIds.size} of {sortedSongs.length} selected
            </span>

            <button
              type="button"
              className="btn btn-xs"
              disabled={checkedIds.size === 0}
              onClick={() => handleDeleteSongs(Array.from(checkedIds))}
              style={{
                background: checkedIds.size > 0 ? 'var(--tally-fault, #ff6b6b)' : 'var(--chrome-control)',
                color: checkedIds.size > 0 ? '#fff' : 'var(--text-dim)',
                border: '1px solid var(--border-primary)',
                padding: '1px 6px',
                borderRadius: 3,
                cursor: checkedIds.size > 0 ? 'pointer' : 'default',
                fontWeight: 600,
                fontSize: 11,
                opacity: checkedIds.size > 0 ? 1 : 0.5,
              }}
            >
              Delete ({checkedIds.size})
            </button>
          </div>
        )}

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
            borderRadius: 4,
            padding: '3px 6px',
            fontSize: 10.5,
            lineHeight: 1.25,
            color: 'var(--text-dim)',
            textAlign: 'center',
            transition: 'background 0.15s, border-color 0.15s',
            flexShrink: 0,
            cursor: 'pointer',
          }}
        >
          Drop OpenLyrics (.xml), ChordPro (.pro) or .txt files
        </div>

        {/* Title Header Bar with Sort Chevron */}
        <div
          onClick={() => setSortAsc((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '2px 6px',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-secondary, #9ca3af)',
            borderBottom: '1px solid var(--border-primary)',
            cursor: 'pointer',
            userSelect: 'none',
            flexShrink: 0,
            marginTop: 1,
          }}
          title="Click to toggle sort order"
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span>Title</span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: sortAsc ? 'none' : 'rotate(180deg)', transition: 'transform 0.15s ease' }}
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </span>
          <span style={{ fontSize: 10, opacity: 0.7 }}>{sortedSongs.length}</span>
        </div>

        {/* Scrollable Song List */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, paddingRight: 2 }}>
          {sortedSongs.map((song) => {
            const isSelected = selectedSong?.id === song.id;
            const isChecked = checkedIds.has(song.id);
            return (
              <div
                key={song.id}
                ref={(el) => { songItemRefs.current[song.id] = el; }}
                draggable={!isSelectMode}
                onDragStart={(e) => {
                  if (isSelectMode) return;
                  const formatted = song.slides && song.slides.length > 0 ? getFormattedSlides(song, linesPerSlide) : [];
                  const firstSlide = formatted[0] || song.slides?.[0];
                  const firstSlideText = (typeof firstSlide === 'object' && firstSlide ? firstSlide.text : (typeof firstSlide === 'string' ? firstSlide : '')) || '';
                  const firstSlideLabel = (typeof firstSlide === 'object' && firstSlide ? firstSlide.label : 'Verse 1') || 'Verse 1';
                  const scene = buildSongScene(song, firstSlide || firstSlideText, {
                    includeCredits: showSongCredits && linesPerSlide === 'auto',
                    target: song.isBilingual ? 'bilingual' : 'primary',
                    transition: {
                      type: fxSettings.transitionType,
                      duration: fxSettings.duration,
                      animateBackground: fxSettings.animateBackground,
                    },
                    animateBackground: fxSettings.animateBackground,
                  });
                  const queuePayload = {
                    type: 'song',
                    songId: song.id,
                    slideId: song.slides?.[0]?.id,
                    linesPerSlide,
                    reference: `${song.title} · ${firstSlideLabel}`,
                    text: firstSlideText,
                    scene,
                  };
                  e.dataTransfer.setData('application/bsp-queue-item', JSON.stringify(queuePayload));
                  e.dataTransfer.setData('text/plain', song.title);
                  e.dataTransfer.effectAllowed = 'copyMove';
                }}
                onMouseEnter={() => setHoveredSongId(song.id)}
                onMouseLeave={() => setHoveredSongId(null)}
                style={{
                  cursor: 'pointer',
                  background: isSelected
                    ? 'var(--accent, #2563eb)'
                    : isChecked
                      ? 'rgba(255, 107, 107, 0.15)'
                      : hoveredSongId === song.id
                        ? 'var(--bg-hover, rgba(127, 127, 127, 0.08))'
                        : 'transparent',
                  color: isSelected ? '#ffffff' : 'var(--text-primary)',
                  padding: '4px 8px',
                  minHeight: 24,
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'background 0.1s ease',
                  userSelect: 'none',
                }}
                onClick={(e) => {
                  if (isSelectMode) {
                    toggleChecked(song.id);
                  } else {
                    if ((e.target as HTMLElement).closest('[data-song-check]')) return;
                    setSelectedSong(song);
                  }
                }}
                onDoubleClick={() => {
                  if (isSelectMode) return;
                  if (song.slides && song.slides.length > 0) {
                    const formatted = getFormattedSlides(song, linesPerSlide);
                    if (formatted.length > 0) {
                      projectScene(
                        buildSongScene(song, formatted[0], {
                          includeCredits: showSongCredits && linesPerSlide === 'auto',
                          target: song.isBilingual ? 'bilingual' : 'primary',
                          transition: {
                            type: fxSettings.transitionType,
                            duration: fxSettings.duration,
                            animateBackground: fxSettings.animateBackground,
                          },
                          animateBackground: fxSettings.animateBackground,
                        }),
                        { direct: true }
                      );
                    }
                  }
                }}
              >
                {/* Multi-select checkbox: only shown during Select Mode */}
                {isSelectMode && (
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
                      margin: 0,
                      flexShrink: 0,
                      width: 13,
                      height: 13,
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? '#ffffff' : 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.3,
                    }}
                  >
                    {song.title}
                  </div>
                  {/* Single-song delete button: revealed only on row hover */}
                  {!isSelectMode && (
                    <button
                      type="button"
                      title={`Delete ${song.title}`}
                      onClick={(e) => { e.stopPropagation(); handleDeleteSongs([song.id]); }}
                      style={{
                        ...songDeleteBtnStyle,
                        opacity: hoveredSongId === song.id ? (isSelected ? 0.9 : 0.7) : 0,
                        pointerEvents: hoveredSongId === song.id ? 'auto' : 'none',
                        color: isSelected ? '#ffffff' : 'var(--text-dim)',
                        width: 18,
                        height: 18,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--tally-fault, #ef4444)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = isSelected ? '#ffffff' : 'var(--text-dim)'; }}
                    >
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                        <path d="M2.5 4.5h11" />
                        <path d="M5.5 4.5V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" />
                        <path d="M3.5 4.5l.7 9a1 1 0 0 0 1 .9h5.6a1 1 0 0 0 1-.9l.7-9" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {/* Lyric hits — clicking one opens the song at that section */}
          {lyricMatches.length > 0 && (
            <>
              <div style={styles.matchHeading}>{t('songs.inLyrics')}</div>
              {lyricMatches.map((match, i) => (
                <div
                  key={`${match.song.id}-${match.label}-${i}`}
                  style={{
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: 3,
                    background: hoveredSongId === `${match.song.id}-${i}` ? 'var(--bg-hover, rgba(127, 127, 127, 0.08))' : 'transparent',
                    border: '1px solid var(--border-primary)',
                    marginBottom: 2,
                  }}
                  onMouseEnter={() => setHoveredSongId(`${match.song.id}-${i}`)}
                  onMouseLeave={() => setHoveredSongId(null)}
                  onClick={() => {
                    setSelectedSong(match.song);
                    setLyricTarget(searchQuery);
                  }}
                  title={`Open ${match.song.title} at ${match.label}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>
                      {match.label}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {match.song.title}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.3 }}>
                    {match.line}
                  </div>
                </div>
              ))}
            </>
          )}

          {filteredSongs.length === 0 && lyricMatches.length === 0 && (
            <div style={{ ...type.secondary, color: 'var(--text-dim)', textAlign: 'center', padding: 16 }}>
              {songs.length === 0
                ? 'No songs yet. Import a file or load demo songs.'
                : `No songs match "${search}".`}
            </div>
          )}
        </div>
      </Block>

      <PanelSplitter
        width={listWidth}
        onChange={setListWidthPersisted}
        min={180}
        max={560}
        title={t('songs.resizeList')}
      />

      {/* Right block: the shared lyric deck, also used by Live song mode */}
      <SongDeck
        song={selectedSong}
        targetText={lyricTarget || undefined}
        onUpdateSong={patchSelectedSong}
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
    fontFamily: 'var(--font-ui)',
    fontSize: 11,
    lineHeight: '14px',
    fontWeight: fontWeight.semibold,
    letterSpacing: 0,
    textTransform: 'none',
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
