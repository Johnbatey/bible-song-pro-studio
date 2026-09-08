import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { Block, BlockButton } from './Block';
import { useI18n } from '../../i18n/useI18n';
import type { QueueItem } from '../types';

const STORAGE_KEY_SETLISTS = 'bsp_saved_setlists';

export interface SavedSetlist {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  items: QueueItem[];
}

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
  const [showSetlistMenu, setShowSetlistMenu] = useState(false);
  const [newSetlistName, setNewSetlistName] = useState('');
  const [hoveredSetlistId, setHoveredSetlistId] = useState<string | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  // Drag & drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const setlistMenuRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Persist setlists
  const persistSetlists = (updated: SavedSetlist[]) => {
    setSavedSetlists(updated);
    try {
      localStorage.setItem(STORAGE_KEY_SETLISTS, JSON.stringify(updated));
    } catch {}
  };

  // Close setlist menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (setlistMenuRef.current && !setlistMenuRef.current.contains(e.target as Node)) {
        setShowSetlistMenu(false);
      }
    };
    if (showSetlistMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSetlistMenu]);

  /** Live wins over staged, matching how the rows colour themselves. */
  const activeSceneId = queue.some((q) => q.scene.id === currentScene?.id)
    ? currentScene?.id
    : previewScene?.id;

  /* A long queue scrolls the running item out of sight as it advances. */
  useEffect(() => {
    if (!activeSceneId) return;
    rowRefs.current[activeSceneId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeSceneId, queue.length]);

  const handleSaveSetlist = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newSetlistName.trim() || `Service Setlist ${new Date().toLocaleDateString()}`;
    if (queue.length === 0) {
      pushNotice({ id: `setlist-err-${Date.now()}`, text: 'Queue is empty. Add items before saving setlist.', type: 'warning', duration: 3, animation: 'slideDown' });
      return;
    }

    const newSetlist: SavedSetlist = {
      id: `setlist-${Date.now()}`,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      items: [...queue],
    };

    const updated = [newSetlist, ...savedSetlists.filter((s) => s.name.toLowerCase() !== name.toLowerCase())];
    persistSetlists(updated);
    setNewSetlistName('');
    pushNotice({ id: `setlist-save-${Date.now()}`, text: `Saved setlist "${name}" (${queue.length} items)`, type: 'info', duration: 4, animation: 'slideDown' });
  };

  const handleLoadSetlist = (setlist: SavedSetlist, mode: 'replace' | 'append' = 'replace') => {
    if (mode === 'replace') {
      setQueue(setlist.items);
      pushNotice({ id: `setlist-load-${Date.now()}`, text: `Loaded setlist "${setlist.name}" (${setlist.items.length} items)`, type: 'info', duration: 4, animation: 'slideDown' });
    } else {
      setQueue([...queue, ...setlist.items]);
      pushNotice({ id: `setlist-append-${Date.now()}`, text: `Appended setlist "${setlist.name}" (+${setlist.items.length} items)`, type: 'info', duration: 4, animation: 'slideDown' });
    }
    setShowSetlistMenu(false);
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
          setShowSetlistMenu(false);
        } else {
          pushNotice({ id: `setlist-err-${Date.now()}`, text: 'Invalid setlist file: no valid items found.', type: 'warning', duration: 4, animation: 'slideDown' });
        }
      } catch {
        pushNotice({ id: `setlist-err-${Date.now()}`, text: 'Failed to parse setlist file.', type: 'warning', duration: 4, animation: 'slideDown' });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
      subtitle={queue.length > 0 ? `${queue.length}` : undefined}
      tools={
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }} ref={setlistMenuRef}>
          {/* Setlists Dropdown Trigger */}
          <BlockButton
            active={showSetlistMenu}
            onClick={() => setShowSetlistMenu((v) => !v)}
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

          {/* Setlists Popover Menu */}
          {showSetlistMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                width: 280,
                backgroundColor: '#18181b',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                borderRadius: 8,
                boxShadow: '0 12px 28px rgba(0, 0, 0, 0.6)',
                zIndex: 1000,
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                color: '#fff',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim, #888)' }}>
                  Service Setlists
                </span>
                <span style={{ fontSize: 10, color: 'var(--accent, #FF5500)' }}>
                  {queue.length} items in active queue
                </span>
              </div>

              {/* Save Active Queue */}
              <form onSubmit={handleSaveSetlist} style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  placeholder="Setlist name (e.g. Sunday Service)..."
                  value={newSetlistName}
                  onChange={(e) => setNewSetlistName(e.target.value)}
                  style={{
                    flex: 1,
                    height: 26,
                    padding: '0 6px',
                    fontSize: 11,
                    backgroundColor: '#121214',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 4,
                    color: '#fff',
                  }}
                />
                <button
                  type="submit"
                  disabled={queue.length === 0}
                  style={{
                    height: 26,
                    padding: '0 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    backgroundColor: queue.length > 0 ? 'var(--accent, #FF5500)' : '#333',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: queue.length > 0 ? 'pointer' : 'default',
                    opacity: queue.length > 0 ? 1 : 0.5,
                  }}
                  title="Save current queue as a named setlist"
                >
                  Save
                </button>
              </form>

              {/* Saved Setlists List */}
              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {savedSetlists.length === 0 ? (
                  <div style={{ padding: '12px 8px', textAlign: 'center', color: '#666', fontSize: 11 }}>
                    No saved setlists yet. Save your service queue above or import a .bspsetlist file.
                  </div>
                ) : (
                  savedSetlists.map((sl) => (
                    <div
                      key={sl.id}
                      onMouseEnter={() => setHoveredSetlistId(sl.id)}
                      onMouseLeave={() => setHoveredSetlistId(null)}
                      style={{
                        padding: '6px 8px',
                        backgroundColor: '#141416',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                      }}
                    >
                      <div
                        onClick={() => handleLoadSetlist(sl, 'replace')}
                        style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                        title={`Click to load "${sl.name}" (${sl.items.length} items)`}
                      >
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sl.name}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim, #888)' }}>
                          {sl.items.length} item{sl.items.length === 1 ? '' : 's'} · {new Date(sl.updatedAt || sl.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      {/* Setlist Row Action Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          type="button"
                          onClick={() => handleExportSetlist(sl)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-dim, #888)',
                            cursor: 'pointer',
                            padding: 2,
                          }}
                          title="Export as .bspsetlist file"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteSetlist(sl.id, sl.name)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: hoveredSetlistId === sl.id ? 'var(--tally-fault, #ef4444)' : 'var(--text-dim, #888)',
                            cursor: 'pointer',
                            padding: 2,
                            opacity: hoveredSetlistId === sl.id ? 1 : 0.6,
                          }}
                          title="Delete setlist"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer File Actions */}
              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    flex: 1,
                    height: 24,
                    fontSize: 10,
                    fontWeight: 600,
                    backgroundColor: '#27272a',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 4,
                    color: '#ddd',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                  title="Import .bspsetlist or .json setlist file"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>Import Setlist</span>
                </button>

                <button
                  type="button"
                  disabled={queue.length === 0}
                  onClick={() => handleExportSetlist({ name: newSetlistName.trim() || 'Service_Setlist', items: queue })}
                  style={{
                    flex: 1,
                    height: 24,
                    fontSize: 10,
                    fontWeight: 600,
                    backgroundColor: '#27272a',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 4,
                    color: queue.length > 0 ? '#ddd' : '#666',
                    cursor: queue.length > 0 ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                  title="Export active queue to .bspsetlist"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Export Active</span>
                </button>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".bspsetlist,.json"
                style={{ display: 'none' }}
                onChange={handleImportFile}
              />
            </div>
          )}
        </div>
      }
    >
      {queue.length === 0 ? (
        <div style={{ color: 'var(--text-dim)', fontSize: 12, padding: '24px 16px', textAlign: 'center' }}>
          {emptyParts[0]}
          <strong style={{ color: '#FF5500' }}>+</strong>
          {emptyParts[1] || ''}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 0' }}>
          {queue.map((item, index) => {
            const isAlertItem = item.type === 'ticker' || item.type === 'nursery' || Boolean(item.alertConfig);
            const isLive = isAlertItem
              ? Boolean(activeAlert?.text && (activeAlert.text === item.text || activeAlert.text === item.alertConfig?.text || activeAlert.text.includes(item.reference)))
              : currentScene?.id === item.scene.id;
            const isPreview = !isAlertItem && previewScene?.id === item.scene.id;
            const isHovered = hoveredItemId === item.id;
            const isDragOver = dragOverIndex === index;

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

            return (
              <div
                key={item.id}
                ref={(el) => { rowRefs.current[item.scene.id] = el; }}
                draggable
                onDragStart={(e) => {
                  setDraggedIndex(index);
                  e.dataTransfer.setData('text/plain', String(index));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverIndex !== index) setDragOverIndex(index);
                }}
                onDragLeave={() => {
                  if (dragOverIndex === index) setDragOverIndex(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = draggedIndex ?? Number(e.dataTransfer.getData('text/plain'));
                  if (from !== null && from !== undefined && from !== index) {
                    reorderQueue(from, index);
                  }
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                onMouseEnter={() => setHoveredItemId(item.id)}
                onMouseLeave={() => setHoveredItemId(null)}
                onClick={() => {
                  if (isAlertItem) {
                    handleTakeLive();
                  } else {
                    if (isLive) {
                      clearProgram();
                      return;
                    }
                    // In Studio Mode, clicking row sends to Preview first
                    projectScene(item.scene);
                    syncQueueItemToPanel(item);
                  }
                }}
                onDoubleClick={() => {
                  handleTakeLive();
                }}
                style={{
                  padding: '10px 14px',
                  background: isLive ? '#3d1403' : isPreview ? '#232221' : '#141416',
                  border: isDragOver
                    ? '1px solid var(--accent, #FF5500)'
                    : isLive
                    ? '1px solid #FF5500'
                    : '1px solid #262628',
                  borderTop: isDragOver ? '2px solid var(--accent, #FF5500)' : undefined,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'grab',
                  transition: 'all 0.15s ease',
                  userSelect: 'none',
                  opacity: draggedIndex === index ? 0.4 : 1,
                }}
              >
                {/* Drag Handle Icon */}
                <div
                  style={{
                    color: 'var(--text-dim, #555)',
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'grab',
                    opacity: isHovered ? 0.8 : 0.3,
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

                {/* Left Meta Group */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 100, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ color: isLive ? '#FF5500' : 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center' }}>
                      {renderTypeIcon(item.type)}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isLive ? '#FF5500' : '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.reference}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'capitalize' }}>
                    {item.type} {item.source ? `· ${item.source}` : ''}
                  </div>
                </div>

                {/* Content Snippet */}
                <div
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: '#ffffff',
                    lineHeight: 1.35,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {item.text}
                </div>

                {/* Right Action Icons & Up/Down Reorder */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
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
                      color: index === 0 ? '#333' : 'var(--text-dim, #888)',
                      cursor: index === 0 ? 'default' : 'pointer',
                      padding: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 3,
                      opacity: isHovered ? (index === 0 ? 0.3 : 0.8) : 0,
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
                      color: index === queue.length - 1 ? '#333' : 'var(--text-dim, #888)',
                      cursor: index === queue.length - 1 ? 'default' : 'pointer',
                      padding: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 3,
                      opacity: isHovered ? (index === queue.length - 1 ? 0.3 : 0.8) : 0,
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
                      color: isLive ? '#FF5500' : '#ffffff',
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

                  {/* Delete (✕) Button */}
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
                    }}
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
