import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { QueueItem } from '../../types';

export interface SavedSetlist {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  items: QueueItem[];
}

interface SetlistManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedSetlists: SavedSetlist[];
  activeQueue: QueueItem[];
  onSaveSetlist: (name: string) => void;
  onLoadSetlist: (setlist: SavedSetlist, mode: 'replace' | 'append') => void;
  onDeleteSetlist: (id: string, name: string) => void;
  onExportSetlist: (setlist: SavedSetlist | { name: string; items: QueueItem[] }) => void;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function SetlistManagerModal({
  isOpen,
  onClose,
  savedSetlists,
  activeQueue,
  onSaveSetlist,
  onLoadSetlist,
  onDeleteSetlist,
  onExportSetlist,
  onImportFile,
}: SetlistManagerModalProps) {
  const [newSetName, setNewSetName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSetName.trim() || `Service Schedule ${new Date().toLocaleDateString()}`;
    onSaveSetlist(name);
    setNewSetName('');
  };

  const filteredSetlists = savedSetlists.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 620,
          maxHeight: '85vh',
          backgroundColor: 'var(--bsp-surface, #161619)',
          border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.14))',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--text-primary, #ffffff)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-primary, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bsp-raised, #1a1a1e)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'rgba(255, 85, 0, 0.15)',
                color: 'var(--accent, #FF5500)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
                Service Setlists & Schedules
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim, #888)' }}>
                Organize, save, and recall complete worship service orders
              </div>
            </div>
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
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.backgroundColor = 'var(--chrome-control)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim, #888)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Action Bar: Save current queue & Import/Export */}
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: 'var(--bsp-ground, #121214)',
            borderBottom: '1px solid var(--border-primary, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <form onSubmit={handleSave} style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="Name this service setlist (e.g. Sunday Morning Worship - Sep 8)..."
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
              style={{
                flex: 1,
                height: 36,
                padding: '0 12px',
                fontSize: 13,
                backgroundColor: 'var(--bsp-surface, #1f1f24)',
                border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.12))',
                borderRadius: 6,
                color: 'var(--text-primary, #fff)',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={activeQueue.length === 0}
              style={{
                height: 36,
                padding: '0 16px',
                fontSize: 13,
                fontWeight: 600,
                backgroundColor: activeQueue.length > 0 ? 'var(--accent, #FF5500)' : 'var(--chrome-control, #2a2a30)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: activeQueue.length > 0 ? 'pointer' : 'default',
                opacity: activeQueue.length > 0 ? 1 : 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
              }}
              title="Save active queue as a new setlist"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              <span>Save Queue ({activeQueue.length})</span>
            </button>
          </form>

          {/* Secondary actions & Search */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  height: 28,
                  padding: '0 10px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  backgroundColor: 'var(--chrome-control, #24242a)',
                  border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.12))',
                  borderRadius: 5,
                  color: 'var(--text-primary, #fff)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
                title="Import .bspsetlist file from disk"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Import .bspsetlist</span>
              </button>

              <button
                type="button"
                disabled={activeQueue.length === 0}
                onClick={() => onExportSetlist({ name: newSetName.trim() || 'Service_Setlist', items: activeQueue })}
                style={{
                  height: 28,
                  padding: '0 10px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  backgroundColor: 'var(--chrome-control, #24242a)',
                  border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.12))',
                  borderRadius: 5,
                  color: activeQueue.length > 0 ? 'var(--text-primary, #fff)' : 'var(--text-dim, #666)',
                  cursor: activeQueue.length > 0 ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  opacity: activeQueue.length > 0 ? 1 : 0.5,
                }}
                title="Export active queue directly as a .bspsetlist file"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Export Active Queue</span>
              </button>
            </div>

            {savedSetlists.length > 3 && (
              <input
                type="text"
                placeholder="Search setlists..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: 150,
                  height: 28,
                  padding: '0 8px',
                  fontSize: 11,
                  backgroundColor: 'var(--bsp-surface, #1f1f24)',
                  border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.1))',
                  borderRadius: 5,
                  color: 'var(--text-primary, #fff)',
                }}
              />
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".bspsetlist,.json"
            style={{ display: 'none' }}
            onChange={onImportFile}
          />
        </div>

        {/* Setlists Content List */}
        <div
          style={{
            flex: 1,
            padding: '14px 20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            maxHeight: 380,
          }}
        >
          {filteredSetlists.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                color: 'var(--text-dim, #777)',
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: 'var(--chrome-control, rgba(255, 255, 255, 0.04))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-dim, #666)',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #ccc)' }}>
                {savedSetlists.length === 0 ? 'No Saved Setlists Yet' : 'No Setlists Match Search'}
              </div>
              <div style={{ fontSize: 12, maxWidth: 360, lineHeight: 1.5, color: 'var(--text-dim)' }}>
                {savedSetlists.length === 0
                  ? 'Add your hymns, scriptures, media clips, and sermon points to the Queue, then type a name above to save your service schedule.'
                  : 'Try searching with a different name or clear the search query.'}
              </div>
            </div>
          ) : (
            filteredSetlists.map((setlist) => (
              <div
                key={setlist.id}
                style={{
                  padding: '12px 14px',
                  backgroundColor: 'var(--bsp-raised, #1c1c21)',
                  border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.1))',
                  borderRadius: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  transition: 'border-color 0.15s ease',
                }}
              >
                {/* Card Header & Controls */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #fff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {setlist.name}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          backgroundColor: 'rgba(255, 85, 0, 0.15)',
                          color: 'var(--accent, #FF5500)',
                          padding: '2px 6px',
                          borderRadius: 4,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {setlist.items.length} {setlist.items.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim, #777)', marginTop: 2 }}>
                      Saved {new Date(setlist.updatedAt || setlist.createdAt).toLocaleString()}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => onLoadSetlist(setlist, 'replace')}
                      style={{
                        height: 28,
                        padding: '0 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        backgroundColor: 'var(--accent, #FF5500)',
                        border: 'none',
                        borderRadius: 5,
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                      title="Replace current queue with this setlist"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      <span>Load Setlist</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onLoadSetlist(setlist, 'append')}
                      style={{
                        height: 28,
                        padding: '0 10px',
                        fontSize: 11.5,
                        fontWeight: 600,
                        backgroundColor: 'var(--chrome-control, #282830)',
                        border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.12))',
                        borderRadius: 5,
                        color: 'var(--text-primary, #ddd)',
                        cursor: 'pointer',
                      }}
                      title="Append items to bottom of active queue"
                    >
                      + Append
                    </button>

                    <button
                      type="button"
                      onClick={() => onExportSetlist(setlist)}
                      style={{
                        height: 28,
                        width: 28,
                        padding: 0,
                        backgroundColor: 'var(--chrome-control, #282830)',
                        border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.12))',
                        borderRadius: 5,
                        color: 'var(--text-dim, #aaa)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Export as .bspsetlist file"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteSetlist(setlist.id, setlist.name)}
                      style={{
                        height: 28,
                        width: 28,
                        padding: 0,
                        backgroundColor: 'var(--chrome-control, #282830)',
                        border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.12))',
                        borderRadius: 5,
                        color: 'var(--text-dim, #888)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--tally-fault, #ef4444)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim, #888)'; }}
                      title="Delete setlist"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Items Chips Preview */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', overflow: 'hidden' }}>
                  {setlist.items.slice(0, 6).map((item, idx) => (
                    <span
                      key={item.id || idx}
                      style={{
                        fontSize: 10.5,
                        backgroundColor: 'var(--bsp-surface, rgba(255, 255, 255, 0.06))',
                        border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.08))',
                        borderRadius: 4,
                        padding: '2px 6px',
                        color: 'var(--text-secondary, #ccc)',
                        maxWidth: 160,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.type === 'bible' ? '📖 ' : item.type === 'song' ? '🎵 ' : item.type === 'media' ? '🖼 ' : '📢 '}
                      {item.reference || item.scene?.name || item.text || 'Item'}
                    </span>
                  ))}
                  {setlist.items.length > 6 && (
                    <span style={{ fontSize: 10.5, color: 'var(--text-dim, #777)', fontStyle: 'italic' }}>
                      +{setlist.items.length - 6} more
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-primary, rgba(255, 255, 255, 0.08))',
            backgroundColor: 'var(--bsp-raised, #1a1a1e)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--text-dim, #777)' }}>
            Tip: Setlists can be shared and imported across computers using the .bspsetlist format.
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 32,
              padding: '0 16px',
              fontSize: 12,
              fontWeight: 600,
              backgroundColor: 'var(--chrome-control, #2a2a30)',
              border: '1px solid var(--border-primary, rgba(255, 255, 255, 0.14))',
              borderRadius: 6,
              color: 'var(--text-primary, #fff)',
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
