import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../stores/appStore';
import { Block, BlockButton } from './Block';
import { useI18n } from '../../i18n/useI18n';
import type { QueueItem, Song, Scene } from '../types';
import { SetlistManagerModal, type SavedSetlist } from './setlist/SetlistManagerModal';

const STORAGE_KEY_SETLISTS = 'bsp_saved_setlists';

function syncQueueItemToPanel(item: QueueItem) {
  if (!item) return;

  if (item.type === 'bible' || item.scene?.type === 'bible') {
    const cleanRef = (item.reference || item.scene?.name || item.scene?.content?.reference || '')
      .replace(/\s*\([^)]*\)\s*$/, '')
      .trim();
    const match = cleanRef.match(/^((?:[1-3]\s+)?[A-Za-z\s]+?)\s+(\d+)[:.](\d+)/);
    if (match) {
      const book = match[1].trim();
      const chapter = parseInt(match[2], 10);
      const verse = parseInt(match[3], 10);
      const version = item.scene?.content?.version || (item.reference.match(/\(([A-Z0-9_-]+)\)/)?.[1]);
      window.dispatchEvent(
        new CustomEvent('bsp:sync-bible', {
          detail: { book, chapter, verse, version },
        })
      );
    }
  } else if (item.type === 'song' || item.scene?.type === 'song') {
    const rawSongId = item.songId || (item.scene?.id?.startsWith('song-') ? item.scene.id.split('-')[1] : undefined);
    const songTitle = item.scene?.name?.split(' - ')[0] || item.reference?.split(' · ')[0] || '';
    window.dispatchEvent(
      new CustomEvent('bsp:sync-song', {
        detail: {
          songId: rawSongId,
          slideId: item.slideId,
          linesPerSlide: item.linesPerSlide,
          songTitle,
          text: item.text,
        },
      })
    );
  } else if (item.type === 'ticker' || item.type === 'nursery' || item.type === 'slide' || item.alertConfig) {
    window.dispatchEvent(
      new CustomEvent('bsp:sync-message', {
        detail: {
          title: item.reference,
          text: item.text,
          type: item.type,
          alertConfig: item.alertConfig,
        },
      })
    );
  }
}

export function QueuePanel() {
  const { t } = useI18n();
  const queue = useAppStore((s) => s.queue);
  const songs = useAppStore((s) => s.songs);
  const setSongs = useAppStore((s) => s.setSongs);
  const addSong = useAppStore((s) => s.addSong);
  const updateQueueItem = useAppStore((s) => s.updateQueueItem);
  const removeFromQueue = useAppStore((s) => s.removeFromQueue);
  const clearQueue = useAppStore((s) => s.clearQueue);
  const setQueue = useAppStore((s) => s.setQueue);
  const insertIntoQueue = useAppStore((s) => s.insertIntoQueue);
  const reorderQueue = useAppStore((s) => s.reorderQueue);
  const projectScene = useAppStore((s) => s.projectScene);
  const clearProgram = useAppStore((s) => s.clearProgram);
  const currentScene = useAppStore((s) => s.display.currentScene);
  const previewScene = useAppStore((s) => s.display.previewScene);
  const activeAlert = useAppStore((s) => s.activeAlert);
  const triggerAlert = useAppStore((s) => s.triggerAlert);
  const dismissAlert = useAppStore((s) => s.dismissAlert);
  const pushNotice = useAppStore((s) => s.notify);

  // Installed Bibles cache for translation matching
  const [installedBibles, setInstalledBibles] = useState<{ id: string; name: string; abbreviation?: string }[]>([]);

  useEffect(() => {
    window.BSP?.bible?.getVersions?.().then((versions: any) => {
      if (Array.isArray(versions) && versions.length > 0) {
        setInstalledBibles(versions);
      }
    }).catch(() => {});
  }, []);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: QueueItem;
    index: number;
  } | null>(null);

  const [activeSubmenu, setActiveSubmenu] = useState<'bible' | null>(null);
  const relinkMediaInputRef = useRef<HTMLInputElement>(null);

  // Close context menu on outside click or escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleGlobalClick = () => {
      setContextMenu(null);
      setActiveSubmenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setActiveSubmenu(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  // Setlist Management State
  const [savedSetlists, setSavedSetlists] = useState<SavedSetlist[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SETLISTS);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showSetlistModal, setShowSetlistModal] = useState(false);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const emptyParts = t('queue.empty', { plus: '+' }).split('+');

  // External HTML5 drag-and-drop state
  const [externalDropIndex, setExternalDropIndex] = useState<number | null>(null);
  const [isExternalDragActive, setIsExternalDragActive] = useState(false);

  // Pointer-based fluid drag state
  const [dragState, setDragState] = useState<{
    draggedIndex: number;
    overIndex: number;
    deltaY: number;
    itemHeight: number;
  } | null>(null);

  const listContainerRef = useRef<HTMLDivElement>(null);
  const dragInfoRef = useRef<{
    startIndex: number;
    startY: number;
    rects: { center: number; height: number }[];
    itemHeight: number;
    hasMoved: boolean;
  } | null>(null);

  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Helper to check if a bible translation is installed
  const isBibleVersionInstalled = (versionStr?: string) => {
    if (!versionStr || installedBibles.length === 0) return true;
    const v = versionStr.trim().toLowerCase();
    return installedBibles.some(
      (b) => b.id.toLowerCase() === v || (b.abbreviation && b.abbreviation.toLowerCase() === v)
    );
  };

  // Auto-heal missing Bible versions across setlist imports
  const autoHealMissingBibles = async (items: QueueItem[], availableBibles = installedBibles): Promise<QueueItem[]> => {
    if (!availableBibles || availableBibles.length === 0) return items;
    const fallbackVersion = availableBibles[0];
    let healedCount = 0;
    const updatedItems = [...items];

    for (let i = 0; i < updatedItems.length; i++) {
      const it = updatedItems[i];
      if (it.type === 'bible' || it.scene?.type === 'bible') {
        const ver = it.scene?.content?.version || it.reference?.match(/\(([A-Za-z0-9_-]+)\)/)?.[1];
        const isInstalled = isBibleVersionInstalled(ver);
        if (!isInstalled && fallbackVersion) {
          const cleanRef = (it.reference || it.scene?.name || it.scene?.content?.reference || '')
            .replace(/\s*\([^)]*\)\s*$/, '')
            .trim();
          const versionLabel = fallbackVersion.abbreviation || fallbackVersion.id.toUpperCase();
          try {
            const res = await window.BSP?.bible?.search({
              versionId: fallbackVersion.id,
              query: cleanRef,
              limit: 1,
            });
            if (res && res.length > 0) {
              const newVerse = res[0];
              const updatedRef = `${newVerse.reference} (${versionLabel})`;
              const newSceneId = `bible-${fallbackVersion.id}-${newVerse.reference}`.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9:._/-]/g, '');
              const updatedScene: Scene = {
                ...it.scene,
                id: newSceneId,
                name: updatedRef,
                content: {
                  ...it.scene?.content,
                  reference: newVerse.reference,
                  version: versionLabel,
                  text: newVerse.text,
                },
              };
              updatedItems[i] = {
                ...it,
                reference: updatedRef,
                text: newVerse.text,
                scene: updatedScene,
              };
              healedCount++;
            }
          } catch (_) {}
        }
      }
    }

    if (healedCount > 0) {
      pushNotice({
        id: `bible-autoheal-${Date.now()}`,
        text: `Auto-healed ${healedCount} verse(s) to installed translation (${fallbackVersion.abbreviation || fallbackVersion.name})`,
        type: 'info',
        duration: 4,
        animation: 'slideDown',
      });
    }
    return updatedItems;
  };

  // Persist setlists
  const persistSetlists = (updated: SavedSetlist[]) => {
    setSavedSetlists(updated);
    try {
      localStorage.setItem(STORAGE_KEY_SETLISTS, JSON.stringify(updated));
    } catch {}
  };

  // Listen to global open-setlists events (e.g. from TitleBar, Shortcuts)
  useEffect(() => {
    const handleOpenSetlists = () => setShowSetlistModal(true);
    window.addEventListener('bsp:open-setlists', handleOpenSetlists);
    return () => window.removeEventListener('bsp:open-setlists', handleOpenSetlists);
  }, []);

  /** Live wins over staged, matching how the rows colour themselves. */
  const activeSceneId = queue.some((q) => q.scene?.id === currentScene?.id)
    ? currentScene?.id
    : previewScene?.id;

  /* A long queue scrolls the running item out of sight as it advances. */
  useEffect(() => {
    if (!activeSceneId) return;
    rowRefs.current[activeSceneId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeSceneId, queue.length]);

  const handleSaveSetlist = (name: string) => {
    const cleanName = name.trim() || `Service Setlist ${new Date().toLocaleDateString()}`;
    if (queue.length === 0) {
      pushNotice({ id: `setlist-err-${Date.now()}`, text: 'Queue is empty. Add items before saving setlist.', type: 'warning', duration: 3, animation: 'slideDown' });
      return;
    }

    // Collect bundled songs
    const songIds = new Set<string>();
    const bundledSongs: Song[] = [];
    queue.forEach((it) => {
      if (it.type === 'song' || it.scene?.type === 'song') {
        const rawSongId = it.songId || (it.scene?.id?.startsWith('song-') ? it.scene.id.split('-')[1] : undefined);
        const title = it.scene?.name?.split(' - ')[0] || it.reference?.split(' · ')[0] || '';
        const match = (rawSongId && songs.find((s) => s.id === rawSongId || s.id === `song-${rawSongId}`)) ||
                      (title && songs.find((s) => s.title.trim().toLowerCase() === title.trim().toLowerCase()));
        if (match && !songIds.has(match.id)) {
          songIds.add(match.id);
          bundledSongs.push(match);
        }
      }
    });

    const newSetlist: SavedSetlist = {
      id: `setlist-${Date.now()}`,
      name: cleanName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      items: [...queue],
      bundledSongs: bundledSongs.length > 0 ? bundledSongs : undefined,
    };

    const updated = [newSetlist, ...savedSetlists.filter((s) => s.name.toLowerCase() !== cleanName.toLowerCase())];
    persistSetlists(updated);
    pushNotice({ id: `setlist-save-${Date.now()}`, text: `Saved setlist "${cleanName}" (${queue.length} items)`, type: 'info', duration: 4, animation: 'slideDown' });
  };

  const handleLoadSetlist = async (setlist: SavedSetlist, mode: 'replace' | 'append' = 'replace') => {
    // Auto-restore bundled songs into song library if missing
    if (setlist.bundledSongs && Array.isArray(setlist.bundledSongs) && setlist.bundledSongs.length > 0) {
      const currentSongs = useAppStore.getState().songs;
      const toAdd: Song[] = [];
      setlist.bundledSongs.forEach((bs) => {
        if (bs && bs.title && !currentSongs.some((s) => s.id === bs.id || s.title.trim().toLowerCase() === bs.title.trim().toLowerCase())) {
          toAdd.push(bs);
        }
      });
      if (toAdd.length > 0) {
        setSongs([...currentSongs, ...toAdd]);
      }
    }

    const healedItems = await autoHealMissingBibles(setlist.items);

    if (mode === 'replace') {
      setQueue(healedItems);
      pushNotice({ id: `setlist-load-${Date.now()}`, text: `Loaded setlist "${setlist.name}" (${healedItems.length} items)`, type: 'info', duration: 4, animation: 'slideDown' });
    } else {
      setQueue([...queue, ...healedItems]);
      pushNotice({ id: `setlist-append-${Date.now()}`, text: `Appended setlist "${setlist.name}" (+${healedItems.length} items)`, type: 'info', duration: 4, animation: 'slideDown' });
    }
    setShowSetlistModal(false);
  };

  const handleDeleteSetlist = (id: string, name: string) => {
    const updated = savedSetlists.filter((s) => s.id !== id);
    persistSetlists(updated);
    pushNotice({ id: `setlist-del-${Date.now()}`, text: `Deleted setlist "${name}"`, type: 'info', duration: 3, animation: 'slideDown' });
  };

  const handleExportSetlist = (setlist: SavedSetlist | { name: string; items: QueueItem[]; bundledSongs?: Song[] }) => {
    const allSongs = useAppStore.getState().songs;
    const songIds = new Set<string>();
    const bundledSongs: Song[] = (setlist as any).bundledSongs ? [...(setlist as any).bundledSongs] : [];

    (setlist.items || []).forEach((it) => {
      if (it.type === 'song' || it.scene?.type === 'song') {
        const rawSongId = it.songId || (it.scene?.id?.startsWith('song-') ? it.scene.id.split('-')[1] : undefined);
        const title = it.scene?.name?.split(' - ')[0] || it.reference?.split(' · ')[0] || '';
        const match = (rawSongId && allSongs.find((s) => s.id === rawSongId || s.id === `song-${rawSongId}`)) ||
                      (title && allSongs.find((s) => s.title.trim().toLowerCase() === title.trim().toLowerCase()));
        if (match && !songIds.has(match.id)) {
          songIds.add(match.id);
          if (!bundledSongs.some((b) => b.id === match.id)) {
            bundledSongs.push(match);
          }
        }
      }
    });

    const exportData = {
      version: '1.1',
      type: 'bspsetlist',
      name: setlist.name,
      exportedAt: new Date().toISOString(),
      itemsCount: setlist.items.length,
      items: setlist.items,
      bundledSongs: bundledSongs.length > 0 ? bundledSongs : undefined,
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${setlist.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.bspsetlist`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    pushNotice({ id: `setlist-exp-${Date.now()}`, text: `Exported "${setlist.name}.bspsetlist" (with bundled songs & assets)`, type: 'info', duration: 4, animation: 'slideDown' });
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);
        if (data && Array.isArray(data.items) && data.items.length > 0) {
          const rawItems: QueueItem[] = data.items.map((it: any) => ({
            ...it,
            id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: Date.now(),
          }));

          // 1. Auto-restore bundled songs into destination library
          if (Array.isArray(data.bundledSongs) && data.bundledSongs.length > 0) {
            const existingSongs = useAppStore.getState().songs;
            const toAdd: Song[] = [];
            data.bundledSongs.forEach((bs: Song) => {
              if (bs && bs.title && !existingSongs.some((s) => s.id === bs.id || s.title.trim().toLowerCase() === bs.title.trim().toLowerCase())) {
                toAdd.push(bs);
              }
            });
            if (toAdd.length > 0) {
              setSongs([...existingSongs, ...toAdd]);
            }
          }

          // 2. Auto-heal any missing Bible versions dynamically
          const healedItems = await autoHealMissingBibles(rawItems);

          // 3. Auto-pull any missing songs from Online Lyrics
          healedItems.forEach((item) => {
            if (item.type === 'song' || item.scene?.type === 'song') {
              const currentSongs = useAppStore.getState().songs;
              const rawSongId = item.songId || (item.scene?.id?.startsWith('song-') ? item.scene.id.split('-')[1] : undefined);
              const songTitle = item.scene?.name?.split(' - ')[0] || item.reference?.split(' · ')[0] || '';
              const exists = (rawSongId && currentSongs.some((s) => s.id === rawSongId || s.id === `song-${rawSongId}`)) ||
                             (songTitle && currentSongs.some((s) => s.title.trim().toLowerCase() === songTitle.trim().toLowerCase()));

              if (!exists && songTitle) {
                window.BSP?.song?.searchOnline?.({ query: songTitle }).then(async (res: any) => {
                  if (res?.ok && res.results && res.results.length > 0) {
                    const match = res.results[0];
                    const lyrics = match.plainLyrics || item.text || '';
                    let slides: any[] = [];
                    try {
                      const arrRes = await window.BSP?.song?.arrangeText?.({ text: lyrics });
                      if (arrRes?.ok && arrRes.sections?.length) {
                        slides = arrRes.sections.map((sec: any, idx: number) => ({
                          id: `slide-${Date.now()}-${idx + 1}`,
                          label: sec.name || `Verse ${idx + 1}`,
                          text: sec.lines.join('\n'),
                        }));
                      }
                    } catch (_) {}
                    if (slides.length === 0 && lyrics.trim()) {
                      const paras = lyrics.split(/\n\s*\n/).filter((p: string) => p.trim());
                      slides = paras.map((p: string, idx: number) => ({
                        id: `slide-${Date.now()}-${idx + 1}`,
                        label: `Verse ${idx + 1}`,
                        text: p.trim(),
                      }));
                    }
                    if (slides.length === 0) {
                      slides = [{ id: `slide-${Date.now()}-1`, label: 'Verse 1', text: item.text || lyrics }];
                    }
                    const newSong: Song = {
                      id: item.songId || `song-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                      title: match.title || songTitle,
                      artist: match.artist || '',
                      slides,
                    };
                    addSong(newSong);
                    pushNotice({
                      id: `song-autofetch-${Date.now()}`,
                      text: `Auto-pulled "${newSong.title}" from Online Library into Songs`,
                      type: 'info',
                      duration: 4,
                      animation: 'slideDown',
                    });
                  } else if (item.text) {
                    const fallbackSong: Song = {
                      id: item.songId || `song-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                      title: songTitle,
                      artist: '',
                      slides: [{ id: `slide-${Date.now()}-1`, label: 'Verse 1', text: item.text }],
                    };
                    addSong(fallbackSong);
                  }
                }).catch(() => {
                  if (item.text) {
                    const fallbackSong: Song = {
                      id: item.songId || `song-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                      title: songTitle,
                      artist: '',
                      slides: [{ id: `slide-${Date.now()}-1`, label: 'Verse 1', text: item.text }],
                    };
                    addSong(fallbackSong);
                  }
                });
              }
            }
          });

          const name = data.name || file.name.replace(/\.(bspsetlist|json)$/i, '');
          const newSetlist: SavedSetlist = {
            id: `setlist-${Date.now()}`,
            name,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            items: healedItems,
            bundledSongs: data.bundledSongs,
          };

          persistSetlists([newSetlist, ...savedSetlists]);
          setQueue(healedItems);
          pushNotice({ id: `setlist-imp-${Date.now()}`, text: `Imported setlist "${name}" (${healedItems.length} items)`, type: 'info', duration: 4, animation: 'slideDown' });
          setShowSetlistModal(false);
        } else {
          pushNotice({ id: `setlist-err-${Date.now()}`, text: 'Invalid setlist file: no valid items found.', type: 'warning', duration: 4, animation: 'slideDown' });
        }
      } catch {
        pushNotice({ id: `setlist-err-${Date.now()}`, text: 'Failed to parse setlist file.', type: 'warning', duration: 4, animation: 'slideDown' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Bible translation switcher for single queue item
  const handleSwitchBibleVersion = async (targetItem: QueueItem, targetVersion: { id: string; name: string; abbreviation?: string }) => {
    const cleanRef = (targetItem.reference || targetItem.scene?.name || targetItem.scene?.content?.reference || '')
      .replace(/\s*\([^)]*\)\s*$/, '')
      .trim();
    const versionLabel = targetVersion.abbreviation || targetVersion.id.toUpperCase();

    try {
      const res = await window.BSP?.bible?.search({
        versionId: targetVersion.id,
        query: cleanRef,
        limit: 1,
      });

      if (res && res.length > 0) {
        const newVerse = res[0];
        const updatedRef = `${newVerse.reference} (${versionLabel})`;
        const newSceneId = `bible-${targetVersion.id}-${newVerse.reference}`.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9:._/-]/g, '');

        const updatedScene: Scene = {
          ...targetItem.scene,
          id: newSceneId,
          name: updatedRef,
          content: {
            ...targetItem.scene.content,
            reference: newVerse.reference,
            version: versionLabel,
            text: newVerse.text,
          },
        };

        updateQueueItem(targetItem.id, {
          reference: updatedRef,
          text: newVerse.text,
          scene: updatedScene,
        });

        pushNotice({
          id: `bible-upd-${Date.now()}`,
          text: `Updated "${newVerse.reference}" to ${targetVersion.name || versionLabel}`,
          type: 'info',
          duration: 3,
          animation: 'slideDown',
        });
      } else {
        pushNotice({
          id: `bible-err-${Date.now()}`,
          text: `Could not find verse "${cleanRef}" in ${versionLabel}`,
          type: 'warning',
          duration: 4,
          animation: 'slideDown',
        });
      }
    } catch (err: any) {
      pushNotice({
        id: `bible-err-${Date.now()}`,
        text: `Error updating Bible translation: ${err?.message || 'Unknown error'}`,
        type: 'warning',
        duration: 4,
        animation: 'slideDown',
      });
    }
    setContextMenu(null);
    setActiveSubmenu(null);
  };

  // Bible batch switcher for all missing verses in queue
  const handleSwitchAllMissingBibles = async (targetVersion: { id: string; name: string; abbreviation?: string }) => {
    const missingItems = queue.filter(
      (q) => q.type === 'bible' && !isBibleVersionInstalled(q.scene?.content?.version || q.reference.match(/\(([A-Za-z0-9_-]+)\)/)?.[1])
    );
    if (missingItems.length === 0) return;

    let updatedCount = 0;
    for (const it of missingItems) {
      const cleanRef = (it.reference || it.scene?.name || it.scene?.content?.reference || '')
        .replace(/\s*\([^)]*\)\s*$/, '')
        .trim();
      const versionLabel = targetVersion.abbreviation || targetVersion.id.toUpperCase();
      try {
        const res = await window.BSP?.bible?.search({
          versionId: targetVersion.id,
          query: cleanRef,
          limit: 1,
        });
        if (res && res.length > 0) {
          const newVerse = res[0];
          const updatedRef = `${newVerse.reference} (${versionLabel})`;
          const newSceneId = `bible-${targetVersion.id}-${newVerse.reference}`.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9:._/-]/g, '');
          const updatedScene: Scene = {
            ...it.scene,
            id: newSceneId,
            name: updatedRef,
            content: {
              ...it.scene.content,
              reference: newVerse.reference,
              version: versionLabel,
              text: newVerse.text,
            },
          };
          updateQueueItem(it.id, {
            reference: updatedRef,
            text: newVerse.text,
            scene: updatedScene,
          });
          updatedCount++;
        }
      } catch (_) {}
    }

    pushNotice({
      id: `bible-batch-${Date.now()}`,
      text: `Updated ${updatedCount} missing verse(s) to ${targetVersion.name || targetVersion.abbreviation || targetVersion.id}`,
      type: 'info',
      duration: 4,
      animation: 'slideDown',
    });
    setContextMenu(null);
    setActiveSubmenu(null);
  };

  // Fetch / re-sync single song from online lyrics
  const handleFetchOnlineSong = async (item: QueueItem) => {
    const songTitle = (item.scene?.name || item.reference || '').split(' - ')[0].split(' · ')[0].trim();
    if (!songTitle) return;

    pushNotice({
      id: `song-searching-${Date.now()}`,
      text: `Searching online lyrics for "${songTitle}"...`,
      type: 'info',
      duration: 3,
      animation: 'slideDown',
    });

    try {
      const res = await window.BSP?.song?.searchOnline({ query: songTitle });
      if (res?.ok && res.results && res.results.length > 0) {
        const match = res.results[0];
        const lyrics = match.plainLyrics || item.text || '';
        let slides: any[] = [];
        try {
          const arrRes = await window.BSP?.song?.arrangeText({ text: lyrics });
          if (arrRes?.ok && arrRes.sections?.length) {
            slides = arrRes.sections.map((sec: any, idx: number) => ({
              id: `slide-${Date.now()}-${idx + 1}`,
              label: sec.name || `Verse ${idx + 1}`,
              text: sec.lines.join('\n'),
            }));
          }
        } catch (_) {}
        if (slides.length === 0 && lyrics.trim()) {
          const paras = lyrics.split(/\n\s*\n/).filter((p: string) => p.trim());
          slides = paras.map((p: string, idx: number) => ({
            id: `slide-${Date.now()}-${idx + 1}`,
            label: `Verse ${idx + 1}`,
            text: p.trim(),
          }));
        }
        if (slides.length === 0) {
          slides = [{ id: `slide-${Date.now()}-1`, label: 'Verse 1', text: item.text || lyrics }];
        }

        const newSong: Song = {
          id: item.songId || `song-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          title: match.title || songTitle,
          artist: match.artist || '',
          slides,
        };

        addSong(newSong);
        pushNotice({
          id: `song-saved-${Date.now()}`,
          text: `Saved "${newSong.title}" (${slides.length} slides) into Song Library`,
          type: 'info',
          duration: 4,
          animation: 'slideDown',
        });
      } else {
        if (item.text) {
          const fallbackSong: Song = {
            id: item.songId || `song-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            title: songTitle,
            artist: '',
            slides: [{ id: `slide-${Date.now()}-1`, label: 'Verse 1', text: item.text }],
          };
          addSong(fallbackSong);
          pushNotice({
            id: `song-saved-${Date.now()}`,
            text: `Restored "${songTitle}" into Song Library from Queue text`,
            type: 'info',
            duration: 4,
            animation: 'slideDown',
          });
        } else {
          pushNotice({
            id: `song-err-${Date.now()}`,
            text: `No online lyrics found for "${songTitle}"`,
            type: 'warning',
            duration: 4,
            animation: 'slideDown',
          });
        }
      }
    } catch (err: any) {
      pushNotice({
        id: `song-err-${Date.now()}`,
        text: `Error fetching song: ${err?.message || 'Unknown error'}`,
        type: 'warning',
        duration: 4,
        animation: 'slideDown',
      });
    }
    setContextMenu(null);
    setActiveSubmenu(null);
  };

  // Relink media handler
  const handleRelinkMediaFile = (file: File) => {
    if (!contextMenu?.item) return;
    const newUrl = URL.createObjectURL(file);
    const updatedScene: Scene = {
      ...contextMenu.item.scene,
      background: {
        ...contextMenu.item.scene.background,
        type: file.type.startsWith('video') ? 'video' : 'image',
        mediaUrl: newUrl,
        fit: contextMenu.item.scene.background?.fit || 'cover',
      },
      content: {
        ...contextMenu.item.scene.content,
        mediaUrl: newUrl,
        mediaType: file.type.startsWith('video') ? 'video' : 'image',
      },
    };
    updateQueueItem(contextMenu.item.id, {
      scene: updatedScene,
    });
    pushNotice({
      id: `media-relink-${Date.now()}`,
      text: `Relinked media to "${file.name}"`,
      type: 'info',
      duration: 3,
      animation: 'slideDown',
    });
    setContextMenu(null);
    setActiveSubmenu(null);
  };

  const renderTypeIcon = (type: string) => {
    switch (type) {
      case 'bible':
        return (
          <span title="Scripture Verse" style={{ display: 'inline-flex' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </span>
        );
      case 'song':
        return (
          <span title="Song Lyric" style={{ display: 'inline-flex' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </span>
        );
      case 'media':
        return (
          <span title="Media Background" style={{ display: 'inline-flex' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
              <line x1="7" y1="2" x2="7" y2="22" />
              <line x1="17" y1="2" x2="17" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
            </svg>
          </span>
        );
      case 'ticker':
        return (
          <span title="Broadcast Ticker Overlay" style={{ display: 'inline-flex' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="18" rx="2" />
              <line x1="2" y1="16" x2="22" y2="16" stroke="var(--accent, #FF5500)" strokeWidth="2.5" />
            </svg>
          </span>
        );
      case 'nursery':
        return (
          <span title="Nursery / Parent Alert" style={{ display: 'inline-flex' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </span>
        );
      default:
        return (
          <span title="Presentation Slide" style={{ display: 'inline-flex' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </span>
        );
    }
  };

  // HTML5 Drag-and-Drop handlers for external items (Songs, Bible, Media, Slides)
  const handleExternalDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/bsp-queue-item') && !e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsExternalDragActive(true);

    const container = listContainerRef.current;
    if (!container || queue.length === 0) {
      setExternalDropIndex(0);
      return;
    }

    const rows = Array.from(container.querySelectorAll('[data-queue-row]')) as HTMLElement[];
    const clientY = e.clientY;
    let newDropIndex = queue.length;

    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (clientY < midY) {
        newDropIndex = i;
        break;
      }
    }
    setExternalDropIndex(newDropIndex);
  };

  const handleExternalDragEnter = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/bsp-queue-item') || e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setIsExternalDragActive(true);
    }
  };

  const handleExternalDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsExternalDragActive(false);
    setExternalDropIndex(null);
  };

  const handleExternalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropIdx = externalDropIndex !== null ? externalDropIndex : queue.length;
    setIsExternalDragActive(false);
    setExternalDropIndex(null);

    const rawJson = e.dataTransfer.getData('application/bsp-queue-item');
    if (rawJson) {
      try {
        const payload = JSON.parse(rawJson);
        if (payload && payload.scene) {
          insertIntoQueue(payload, dropIdx);
          pushNotice({
            id: `queue-add-${Date.now()}`,
            text: `Added "${payload.reference || payload.scene.name || 'Item'}" to Queue`,
            type: 'info',
            duration: 3,
            animation: 'slideDown',
          });
        }
      } catch (err) {
        console.error('Failed to parse dropped queue item:', err);
      }
    }
  };

  const renderDropIndicator = () => (
    <div
      style={{
        height: 3,
        margin: '2px 0',
        borderRadius: 2,
        background: 'var(--accent, #FF5500)',
        boxShadow: '0 0 10px var(--accent, #FF5500)',
        transition: 'all 0.15s ease',
      }}
    />
  );

  return (
    <Block
      className="blk-fill"
      title={t('queue.title')}
      subtitle={queue.length > 0 ? `${queue.length}` : undefined}
      tools={
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Setlists Modal Trigger Button */}
          <BlockButton
            active={showSetlistModal}
            onClick={() => setShowSetlistModal(true)}
            title="Service Setlists & Schedules"
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span>Setlists</span>
              {savedSetlists.length > 0 && (
                <span
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    padding: '0 4px',
                    borderRadius: 3,
                    fontSize: 9,
                  }}
                >
                  {savedSetlists.length}
                </span>
              )}
            </span>
          </BlockButton>

          {/* Clear All */}
          {queue.length > 0 && (
            <BlockButton onClick={clearQueue} title={t('queue.clear')}>
              {t('queue.clearAll')}
            </BlockButton>
          )}
        </div>
      }
    >
      {/* Service Setlists & Schedules Modal Dialog (Portaled to root) */}
      <SetlistManagerModal
        isOpen={showSetlistModal}
        onClose={() => setShowSetlistModal(false)}
        savedSetlists={savedSetlists}
        activeQueue={queue}
        onSaveSetlist={handleSaveSetlist}
        onLoadSetlist={handleLoadSetlist}
        onDeleteSetlist={handleDeleteSetlist}
        onExportSetlist={handleExportSetlist}
        onImportFile={handleImportFile}
      />
      {queue.length === 0 ? (
        <div
          onDragOver={handleExternalDragOver}
          onDragEnter={handleExternalDragEnter}
          onDragLeave={handleExternalDragLeave}
          onDrop={handleExternalDrop}
          style={{
            color: 'var(--text-dim)',
            fontSize: 12,
            padding: '28px 16px',
            textAlign: 'center',
            border: isExternalDragActive ? '2px dashed var(--accent, #FF5500)' : '2px dashed transparent',
            background: isExternalDragActive ? 'rgba(255, 85, 0, 0.08)' : 'transparent',
            borderRadius: 8,
            transition: 'all 0.15s ease',
          }}
        >
          {isExternalDragActive ? (
            <span style={{ color: 'var(--accent, #FF5500)', fontWeight: 600 }}>Drop item here to add to Queue</span>
          ) : (
            <>
              {emptyParts[0]}
              <strong style={{ color: 'var(--accent, #FF5500)' }}>+</strong>
              {emptyParts[1] || ''}
            </>
          )}
        </div>
      ) : (
        <div
          ref={listContainerRef}
          onDragOver={handleExternalDragOver}
          onDragEnter={handleExternalDragEnter}
          onDragLeave={handleExternalDragLeave}
          onDrop={handleExternalDrop}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: '2px 0',
            minHeight: '100%',
          }}
        >
          {queue.map((item, index) => {
            const isAlertItem = item.type === 'ticker' || item.type === 'nursery' || Boolean(item.alertConfig);
            const isLive = isAlertItem
              ? Boolean(
                  activeAlert &&
                  (
                    (activeAlert.id && item.alertConfig?.id && activeAlert.id === item.alertConfig.id) ||
                    (activeAlert.id && item.id && activeAlert.id === item.id) ||
                    (!item.alertConfig?.id && (activeAlert.text === item.text || activeAlert.text === item.alertConfig?.text))
                  )
                )
              : currentScene?.id === item.scene.id;
            const isPreview = !isAlertItem && previewScene?.id === item.scene.id;
            const isHovered = hoveredItemId === item.id;
            const isThisDragged = dragState?.draggedIndex === index;

            const projectQueueItem = (direct?: boolean) => {
              const fx = useAppStore.getState().fxSettings;
              const sceneToProject = {
                ...item.scene,
                transition: item.scene.transition || {
                  type: fx.transitionType || 'fade',
                  duration: fx.duration || 0.4,
                  easing: 'ease',
                  animateBackground: fx.animateBackground ?? false,
                },
                animateBackground: item.scene.animateBackground ?? fx.animateBackground ?? false,
              };
              if (direct !== undefined) {
                projectScene(sceneToProject, { direct });
              } else {
                projectScene(sceneToProject);
              }
              syncQueueItemToPanel(item);
            };

            const handleTakeLive = () => {
              if (isAlertItem) {
                if (isLive) {
                  dismissAlert();
                } else if (item.alertConfig) {
                  triggerAlert({ ...item.alertConfig, id: item.alertConfig.id || item.id });
                  syncQueueItemToPanel(item);
                }
              } else {
                if (isLive) {
                  clearProgram();
                } else {
                  projectQueueItem(true);
                }
              }
            };

            // Fluid animated displacement calculation
            let transform = 'none';
            if (dragState) {
              const { draggedIndex, overIndex, deltaY, itemHeight } = dragState;
              const shift = itemHeight + 6;
              if (isThisDragged) {
                transform = `translateY(${deltaY}px) scale(1.015)`;
              } else if (draggedIndex < overIndex && index > draggedIndex && index <= overIndex) {
                transform = `translateY(-${shift}px)`;
              } else if (draggedIndex > overIndex && index < draggedIndex && index >= overIndex) {
                transform = `translateY(${shift}px)`;
              }
            }

            const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
              if (e.button !== 0) return;
              const target = e.target as HTMLElement;
              if (target.closest('button, input, textarea, a, select')) return;

              const container = listContainerRef.current;
              if (!container) return;

              const children = Array.from(container.children) as HTMLElement[];
              const rects = children.map((el) => {
                const r = el.getBoundingClientRect();
                return {
                  height: r.height,
                  center: r.top + r.height / 2,
                };
              });

              const itemHeight = rects[index]?.height || 36;
              dragInfoRef.current = {
                startIndex: index,
                startY: e.clientY,
                rects,
                itemHeight,
                hasMoved: false,
              };

              const handlePointerMove = (moveEv: PointerEvent) => {
                if (!dragInfoRef.current) return;
                const { startIndex, startY, rects: itemRects, itemHeight: h } = dragInfoRef.current;
                const deltaY = moveEv.clientY - startY;

                if (!dragInfoRef.current.hasMoved && Math.abs(deltaY) > 3) {
                  dragInfoRef.current.hasMoved = true;
                }

                if (dragInfoRef.current.hasMoved) {
                  const currentCenter = (itemRects[startIndex]?.center || 0) + deltaY;
                  let newOver = startIndex;
                  let minDiff = Infinity;

                  for (let i = 0; i < itemRects.length; i++) {
                    const diff = Math.abs(itemRects[i].center - currentCenter);
                    if (diff < minDiff) {
                      minDiff = diff;
                      newOver = i;
                    }
                  }

                  setDragState({
                    draggedIndex: startIndex,
                    overIndex: newOver,
                    deltaY,
                    itemHeight: h,
                  });
                }
              };

              const handlePointerUp = () => {
                window.removeEventListener('pointermove', handlePointerMove);
                window.removeEventListener('pointerup', handlePointerUp);

                const info = dragInfoRef.current;
                dragInfoRef.current = null;

                if (info && info.hasMoved) {
                  setDragState((prev) => {
                    if (prev && prev.draggedIndex !== prev.overIndex) {
                      reorderQueue(prev.draggedIndex, prev.overIndex);
                    }
                    return null;
                  });
                } else {
                  setDragState(null);
                  if (isAlertItem) {
                    handleTakeLive();
                  } else {
                    if (isLive) {
                      clearProgram();
                    } else {
                      projectQueueItem();
                    }
                  }
                }
              };

              window.addEventListener('pointermove', handlePointerMove, { passive: false });
              window.addEventListener('pointerup', handlePointerUp);
            };

            const itemBibleVersion = item.type === 'bible'
              ? (item.scene?.content?.version || item.reference.match(/\(([A-Za-z0-9_-]+)\)/)?.[1] || 'KJV')
              : undefined;
            const isMissingBibleVersion = item.type === 'bible' && !isBibleVersionInstalled(itemBibleVersion);

            return (
              <React.Fragment key={item.id}>
                {externalDropIndex === index && renderDropIndicator()}
                <div
                  data-queue-row
                  ref={(el) => { rowRefs.current[item.scene.id] = el; }}
                  onPointerDown={handlePointerDown}
                  onMouseEnter={() => setHoveredItemId(item.id)}
                  onMouseLeave={() => setHoveredItemId(null)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const menuWidth = 230;
                    const menuHeight = 280;
                    const x = Math.max(10, Math.min(e.clientX, window.innerWidth - menuWidth - 10));
                    const y = Math.max(10, Math.min(e.clientY, window.innerHeight - menuHeight - 10));
                    setContextMenu({
                      x,
                      y,
                      item,
                      index,
                    });
                    setActiveSubmenu(null);
                  }}
                  onDoubleClick={() => {
                    handleTakeLive();
                  }}
                style={{
                  padding: '6px 10px',
                  minHeight: 34,
                  background: isLive
                    ? 'var(--accent-dim, rgba(255, 85, 0, 0.12))'
                    : isPreview
                    ? 'var(--chrome-control-active, var(--bg-hover))'
                    : 'var(--bg-secondary)',
                  border: isLive
                    ? '1px solid var(--accent, #FF5500)'
                    : isPreview
                    ? '1px solid var(--border-accent, rgba(255, 85, 0, 0.4))'
                    : isThisDragged
                    ? '1px solid var(--accent, #FF5500)'
                    : '1px solid var(--border-primary)',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'default',
                  userSelect: 'none',
                  position: 'relative',
                  zIndex: isThisDragged ? 50 : 1,
                  opacity: isThisDragged ? 0.95 : 1,
                  transform,
                  boxShadow: isThisDragged ? '0 12px 32px rgba(0, 0, 0, 0.5)' : 'none',
                  transition: isThisDragged
                    ? 'box-shadow 0.15s ease, opacity 0.15s ease'
                    : 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1), background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease',
                  minWidth: 0,
                  overflow: 'hidden',
                }}
              >
                {/* Drag Handle Icon (Clean subtle dots, default cursor) */}
                <div
                  style={{
                    color: 'var(--text-dim)',
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'default',
                    opacity: isHovered ? 0.85 : 0.35,
                    transition: 'opacity 0.15s ease',
                    flexShrink: 0,
                  }}
                  title="Drag to reorder queue"
                >
                  <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                    <circle cx="2" cy="2" r="1.5" />
                    <circle cx="8" cy="2" r="1.5" />
                    <circle cx="2" cy="7" r="1.5" />
                    <circle cx="8" cy="7" r="1.5" />
                    <circle cx="2" cy="12" r="1.5" />
                    <circle cx="8" cy="12" r="1.5" />
                  </svg>
                </div>

                {/* Left Meta Group (Type Icon + Reference Title + Missing Version Badge) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1, overflow: 'hidden' }}>
                  <span style={{ color: isLive ? 'var(--accent, #FF5500)' : 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                    {renderTypeIcon(item.type)}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: isLive ? 'var(--accent, #FF5500)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
                    {item.reference}
                  </span>
                  {isMissingBibleVersion && (
                    <span
                      title={`Translation "${itemBibleVersion}" is not installed on this PC. Right-click to switch to an installed Bible version.`}
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 4,
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                        color: '#ff6b6b',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>{itemBibleVersion} missing</span>
                    </span>
                  )}
                </div>

                {/* Right Action Icons & Up/Down Reorder */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 'auto' }}>
                  {/* Reorder Up */}
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      reorderQueue(index, index - 1);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: index === 0 ? 'var(--text-dim)' : 'var(--text-secondary)',
                      cursor: index === 0 ? 'default' : 'pointer',
                      padding: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 3,
                      opacity: isHovered ? (index === 0 ? 0.2 : 0.8) : 0,
                      pointerEvents: isHovered && index > 0 ? 'auto' : 'none',
                      transition: 'opacity 0.12s ease',
                    }}
                    title="Move item up (▲)"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </button>

                  {/* Reorder Down */}
                  <button
                    type="button"
                    disabled={index === queue.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      reorderQueue(index, index + 1);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: index === queue.length - 1 ? 'var(--text-dim)' : 'var(--text-secondary)',
                      cursor: index === queue.length - 1 ? 'default' : 'pointer',
                      padding: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 3,
                      opacity: isHovered ? (index === queue.length - 1 ? 0.2 : 0.8) : 0,
                      pointerEvents: isHovered && index < queue.length - 1 ? 'auto' : 'none',
                      transition: 'opacity 0.12s ease',
                    }}
                    title="Move item down (▼)"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {/* Play → LIVE / Pause → take down */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTakeLive();
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: isLive ? 'var(--accent, #FF5500)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 4,
                      transition: 'transform 0.1s ease',
                    }}
                    title={isLive ? t('queue.takeDown') : t('queue.sendLive')}
                  >
                    {isLive ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    )}
                  </button>

                  {/* Delete (✕) Button - Only visible on hover */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromQueue(item.id);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 4,
                      opacity: isHovered ? 1 : 0,
                      pointerEvents: isHovered ? 'auto' : 'none',
                      transition: 'opacity 0.15s ease, color 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--tally-fault, #ef4444)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; }}
                    title={t('queue.remove')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            </React.Fragment>
          );
        })}
          {externalDropIndex === queue.length && renderDropIndicator()}
        </div>
      )}

      {/* Invisible file input for media relinking */}
      <input
        ref={relinkMediaInputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleRelinkMediaFile(file);
          e.target.value = '';
        }}
      />

      {/* Right-Click Context Menu for Queue Items */}
      {contextMenu && (() => {
        const isNearRightEdge = contextMenu.x + 230 + 210 > window.innerWidth;
        const isNearBottomEdge = contextMenu.y + 300 > window.innerHeight;

        return createPortal(
          <div
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              zIndex: 999999,
              minWidth: 230,
              backgroundColor: 'var(--bsp-surface, #1e1e24)',
              border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.16))',
              borderRadius: 8,
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55)',
              padding: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              color: 'var(--text-primary, #ffffff)',
              fontSize: 12,
              backdropFilter: 'blur(12px)',
              animation: 'fadeIn 0.1s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Reference */}
            <div
              style={{
                padding: '6px 10px',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-dim, #888)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                marginBottom: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {contextMenu.item.reference || contextMenu.item.scene?.name || 'Queue Item'}
            </div>

            {/* Bible-Specific Actions */}
            {contextMenu.item.type === 'bible' && (
              <>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSubmenu(activeSubmenu === 'bible' ? null : 'bible');
                    }}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: 12,
                      fontWeight: 500,
                      backgroundColor: activeSubmenu === 'bible' ? 'var(--chrome-control, #2c2c34)' : 'transparent',
                      border: 'none',
                      borderRadius: 5,
                      color: 'var(--text-primary, #fff)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--chrome-control, #2c2c34)'; }}
                    onMouseLeave={(e) => { if (activeSubmenu !== 'bible') e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                      </svg>
                      <span>Change Bible Version</span>
                    </div>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      {isNearRightEdge ? (
                        <polyline points="15 18 9 12 15 6" />
                      ) : (
                        <polyline points="9 18 15 12 9 6" />
                      )}
                    </svg>
                  </button>

                  {/* Submenu for installed translations (Edge-aware: opens to the left when near right edge) */}
                  {activeSubmenu === 'bible' && (
                    <div
                      style={{
                        position: 'absolute',
                        top: isNearBottomEdge ? 'auto' : 0,
                        bottom: isNearBottomEdge ? 0 : 'auto',
                        left: isNearRightEdge ? 'auto' : '100%',
                        right: isNearRightEdge ? '100%' : 'auto',
                        marginLeft: isNearRightEdge ? 0 : 4,
                        marginRight: isNearRightEdge ? 4 : 0,
                        minWidth: 210,
                        maxWidth: 260,
                        maxHeight: 280,
                        overflowY: 'auto',
                        backgroundColor: 'var(--bsp-surface, #1e1e24)',
                        border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.16))',
                        borderRadius: 8,
                        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55)',
                        padding: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        zIndex: 1000000,
                      }}
                    >
                      <div style={{ padding: '4px 8px', fontSize: 10, fontWeight: 700, color: 'var(--text-dim, #777)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Installed Translations ({installedBibles.length})
                      </div>
                      {installedBibles.length === 0 ? (
                        <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-dim)' }}>
                          No installed Bibles found
                        </div>
                      ) : (
                        installedBibles.map((ver) => {
                          const currentVer = contextMenu.item.scene?.content?.version || contextMenu.item.reference.match(/\(([A-Za-z0-9_-]+)\)/)?.[1];
                          const isCurrent = currentVer && (currentVer.toLowerCase() === ver.id.toLowerCase() || (ver.abbreviation && currentVer.toLowerCase() === ver.abbreviation.toLowerCase()));
                          return (
                            <button
                              key={ver.id}
                              type="button"
                              onClick={() => handleSwitchBibleVersion(contextMenu.item, ver)}
                              style={{
                                width: '100%',
                                padding: '6px 10px',
                                fontSize: 12,
                                backgroundColor: isCurrent ? 'rgba(255, 85, 0, 0.15)' : 'transparent',
                                border: 'none',
                                borderRadius: 5,
                                color: isCurrent ? 'var(--accent, #FF5500)' : 'var(--text-primary, #fff)',
                                fontWeight: isCurrent ? 700 : 500,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                textAlign: 'left',
                                gap: 6,
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isCurrent ? 'rgba(255, 85, 0, 0.25)' : 'var(--chrome-control, #2c2c34)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isCurrent ? 'rgba(255, 85, 0, 0.15)' : 'transparent'; }}
                            >
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {ver.name || ver.id} {ver.abbreviation ? `(${ver.abbreviation})` : ''}
                              </span>
                              {isCurrent && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Batch update missing verses if any */}
                {installedBibles.length > 0 && queue.some((q) => q.type === 'bible' && !isBibleVersionInstalled(q.scene?.content?.version || q.reference.match(/\(([A-Za-z0-9_-]+)\)/)?.[1])) && (
                  <button
                    type="button"
                    onClick={() => handleSwitchAllMissingBibles(installedBibles[0])}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: 12,
                      fontWeight: 500,
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: 5,
                      color: '#ffaa44',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--chrome-control, #2c2c34)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                    <span>Update All Missing to {installedBibles[0].abbreviation || installedBibles[0].name}</span>
                  </button>
                )}
              </>
            )}

            {/* Song-Specific Actions */}
            {contextMenu.item.type === 'song' && (
              <>
                <button
                  type="button"
                  onClick={() => handleFetchOnlineSong(contextMenu.item)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: 12,
                    fontWeight: 500,
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: 5,
                    color: 'var(--text-primary, #fff)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--chrome-control, #2c2c34)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <span>Pull / Update from Online Lyrics</span>
                </button>
              </>
            )}

            {/* Media-Specific Actions */}
            {contextMenu.item.type === 'media' && (
              <>
                <button
                  type="button"
                  onClick={() => relinkMediaInputRef.current?.click()}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: 12,
                    fontWeight: 500,
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: 5,
                    color: 'var(--text-primary, #fff)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--chrome-control, #2c2c34)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  <span>Relink / Replace Media File...</span>
                </button>
              </>
            )}

            <div style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)', margin: '3px 0' }} />

            {/* Send to Preview / Take Live */}
            <button
              type="button"
              onClick={() => {
                const fx = useAppStore.getState().fxSettings;
                const sceneToProject = {
                  ...contextMenu.item.scene,
                  transition: contextMenu.item.scene.transition || {
                    type: fx.transitionType || 'fade',
                    duration: fx.duration || 0.4,
                    easing: 'ease',
                    animateBackground: fx.animateBackground ?? false,
                  },
                  animateBackground: contextMenu.item.scene.animateBackground ?? fx.animateBackground ?? false,
                };
                projectScene(sceneToProject);
                syncQueueItemToPanel(contextMenu.item);
                setContextMenu(null);
              }}
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: 12,
                fontWeight: 500,
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: 5,
                color: 'var(--text-primary, #fff)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--chrome-control, #2c2c34)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>Send to Preview</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const fx = useAppStore.getState().fxSettings;
                const sceneToProject = {
                  ...contextMenu.item.scene,
                  transition: contextMenu.item.scene.transition || {
                    type: fx.transitionType || 'fade',
                    duration: fx.duration || 0.4,
                    easing: 'ease',
                    animateBackground: fx.animateBackground ?? false,
                  },
                  animateBackground: contextMenu.item.scene.animateBackground ?? fx.animateBackground ?? false,
                };
                projectScene(sceneToProject, { direct: true });
                syncQueueItemToPanel(contextMenu.item);
                setContextMenu(null);
              }}
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: 12,
                fontWeight: 500,
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: 5,
                color: 'var(--accent, #FF5500)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 85, 0, 0.15)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>Take Live Directly</span>
            </button>

            <div style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)', margin: '3px 0' }} />

            {/* Remove from Queue */}
            <button
              type="button"
              onClick={() => {
                removeFromQueue(contextMenu.item.id);
                setContextMenu(null);
              }}
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: 12,
                fontWeight: 500,
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: 5,
                color: 'var(--tally-fault, #ef4444)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span>Remove from Queue</span>
            </button>
          </div>,
          document.body
        );
      })()}
    </Block>
  );
}
