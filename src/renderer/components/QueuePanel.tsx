import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { Block, BlockButton } from './Block';
import { useI18n } from '../../i18n/useI18n';
import type { QueueItem } from '../types';
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
  const removeFromQueue = useAppStore((s) => s.removeFromQueue);
  const clearQueue = useAppStore((s) => s.clearQueue);
  const setQueue = useAppStore((s) => s.setQueue);
  const reorderQueue = useAppStore((s) => s.reorderQueue);
  const projectScene = useAppStore((s) => s.projectScene);
  const clearProgram = useAppStore((s) => s.clearProgram);
  const currentScene = useAppStore((s) => s.display.currentScene);
  const previewScene = useAppStore((s) => s.display.previewScene);
  const activeAlert = useAppStore((s) => s.activeAlert);
  const triggerAlert = useAppStore((s) => s.triggerAlert);
  const dismissAlert = useAppStore((s) => s.dismissAlert);
  const pushNotice = useAppStore((s) => s.notify);

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
  const activeSceneId = queue.some((q) => q.scene.id === currentScene?.id)
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

    const newSetlist: SavedSetlist = {
      id: `setlist-${Date.now()}`,
      name: cleanName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      items: [...queue],
    };

    const updated = [newSetlist, ...savedSetlists.filter((s) => s.name.toLowerCase() !== cleanName.toLowerCase())];
    persistSetlists(updated);
    pushNotice({ id: `setlist-save-${Date.now()}`, text: `Saved setlist "${cleanName}" (${queue.length} items)`, type: 'info', duration: 4, animation: 'slideDown' });
  };

  const handleLoadSetlist = (setlist: SavedSetlist, mode: 'replace' | 'append' = 'replace') => {
    if (mode === 'replace') {
      setQueue(setlist.items);
      pushNotice({ id: `setlist-load-${Date.now()}`, text: `Loaded setlist "${setlist.name}" (${setlist.items.length} items)`, type: 'info', duration: 4, animation: 'slideDown' });
    } else {
      setQueue([...queue, ...setlist.items]);
      pushNotice({ id: `setlist-append-${Date.now()}`, text: `Appended setlist "${setlist.name}" (+${setlist.items.length} items)`, type: 'info', duration: 4, animation: 'slideDown' });
    }
    setShowSetlistModal(false);
  };

  const handleDeleteSetlist = (id: string, name: string) => {
    const updated = savedSetlists.filter((s) => s.id !== id);
    persistSetlists(updated);
    pushNotice({ id: `setlist-del-${Date.now()}`, text: `Deleted setlist "${name}"`, type: 'info', duration: 3, animation: 'slideDown' });
  };

  const handleExportSetlist = (setlist: SavedSetlist | { name: string; items: QueueItem[] }) => {
    const exportData = {
      version: '1.0',
      type: 'bspsetlist',
      name: setlist.name,
      exportedAt: new Date().toISOString(),
      itemsCount: setlist.items.length,
      items: setlist.items,
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
    pushNotice({ id: `setlist-exp-${Date.now()}`, text: `Exported "${setlist.name}.bspsetlist"`, type: 'info', duration: 4, animation: 'slideDown' });
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);
        if (data && Array.isArray(data.items) && data.items.length > 0) {
          const importedItems: QueueItem[] = data.items.map((it: any) => ({
            ...it,
            id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: Date.now(),
          }));

          const name = data.name || file.name.replace(/\.(bspsetlist|json)$/i, '');
          const newSetlist: SavedSetlist = {
            id: `setlist-${Date.now()}`,
            name,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            items: importedItems,
          };

          persistSetlists([newSetlist, ...savedSetlists]);
          setQueue(importedItems);
          pushNotice({ id: `setlist-imp-${Date.now()}`, text: `Imported setlist "${name}" (${importedItems.length} items)`, type: 'info', duration: 4, animation: 'slideDown' });
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

  const emptyParts = t('queue.empty').split('{plus}');

  return (
    <Block
      className="blk-fill"
      title={t('queue.title')}
      subtitle={queue.length > 0 ? `${queue.length}` : undefined}      tools={
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
        <div style={{ color: 'var(--text-dim)', fontSize: 12, padding: '24px 16px', textAlign: 'center' }}>
          {emptyParts[0]}
          <strong style={{ color: 'var(--accent, #FF5500)' }}>+</strong>
          {emptyParts[1] || ''}
        </div>
      ) : (
        <div ref={listContainerRef} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 0' }}>
          {queue.map((item, index) => {
            const isAlertItem = item.type === 'ticker' || item.type === 'nursery' || Boolean(item.alertConfig);
            const isLive = isAlertItem
              ? Boolean(activeAlert?.text && (activeAlert.text === item.text || activeAlert.text === item.alertConfig?.text || activeAlert.text.includes(item.reference)))
              : currentScene?.id === item.scene.id;
            const isPreview = !isAlertItem && previewScene?.id === item.scene.id;
            const isHovered = hoveredItemId === item.id;
            const isThisDragged = dragState?.draggedIndex === index;

            const handleTakeLive = () => {
              if (isAlertItem) {
                if (isLive) {
                  dismissAlert();
                } else if (item.alertConfig) {
                  triggerAlert(item.alertConfig);
                  syncQueueItemToPanel(item);
                }
              } else {
                if (isLive) {
                  clearProgram();
                } else {
                  projectScene(item.scene, { direct: true });
                  syncQueueItemToPanel(item);
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

              const itemHeight = rects[index]?.height || 54;
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
                      projectScene(item.scene);
                      syncQueueItemToPanel(item);
                    }
                  }
                }
              };

              window.addEventListener('pointermove', handlePointerMove, { passive: false });
              window.addEventListener('pointerup', handlePointerUp);
            };

            return (
              <div
                key={item.id}
                ref={(el) => { rowRefs.current[item.scene.id] = el; }}
                onPointerDown={handlePointerDown}
                onMouseEnter={() => setHoveredItemId(item.id)}
                onMouseLeave={() => setHoveredItemId(null)}
                onDoubleClick={() => {
                  handleTakeLive();
                }}
                style={{
                  padding: '9px 12px',
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
                  gap: 10,
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

                {/* Left Meta Group (Title + Subtitle Snippet on 2 lines) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                    <span style={{ color: isLive ? 'var(--accent, #FF5500)' : 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                      {renderTypeIcon(item.type)}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isLive ? 'var(--accent, #FF5500)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
                      {item.reference}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ textTransform: 'capitalize', flexShrink: 0 }}>
                      {item.type} {item.source ? `· ${item.source}` : ''}
                    </span>
                    {item.text && (
                      <>
                        <span style={{ opacity: 0.4 }}>·</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                          {item.text.replace(/\s+/g, ' ').trim()}
                        </span>
                      </>
                    )}
                  </div>
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
            );
          })}
        </div>
      )}
    </Block>
  );
}
