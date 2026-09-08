import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import { Block } from './Block';
import { type } from '../styles/type';
import type { Alert, Scene } from '../types';

const STORAGE_KEY_RECENT = 'bsp_recent_announcements';
const STORAGE_KEY_SAVED_NOTES = 'bsp_announce_saved_notes_list';
const STORAGE_KEY_ACTIVE_NOTE_ID = 'bsp_announce_active_note_id';

interface SavedNote {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
}

export function MessagePanel() {
  const isStudio = useAppStore((s) => s.display.mode === 'studio');
  const projectScene = useAppStore((s) => s.projectScene);
  const triggerAlert = useAppStore((s) => s.triggerAlert);
  const dismissAlert = useAppStore((s) => s.dismissAlert);
  const activeAlert = useAppStore((s) => s.activeAlert);
  const currentScene = useAppStore((s) => s.display.currentScene);
  const clearProgram = useAppStore((s) => s.clearProgram);
  const addToQueue = useAppStore((s) => s.addToQueue);
  const pushNotice = useAppStore((s) => s.notify);

  // Top Nav Tab: 'broadcast' | 'notes' | 'history'
  const [viewTab, setViewTab] = useState<'broadcast' | 'notes' | 'history'>('broadcast');

  // Broadcast state
  const [mode, setMode] = useState<'overlay' | 'slide' | 'nursery'>('overlay');
  const [titleText, setTitleText] = useState('ANNOUNCEMENT');
  const [messageText, setMessageText] = useState('');
  const [alertType, setAlertType] = useState<Alert['type']>('announcement');
  const [position, setPosition] = useState<'top' | 'bottom'>('bottom');
  const [durationSec, setDurationSec] = useState<number>(15);
  const [speed, setSpeed] = useState<number>(1);
  const [cycles, setCycles] = useState<number>(2);

  // Saved Notes state
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SAVED_NOTES);
      if (saved) return JSON.parse(saved);
      // Legacy fallback
      const oldNotes = localStorage.getItem('bsp_announce_service_notes');
      if (oldNotes) {
        return [{ id: 'default', title: 'Service Notes', content: oldNotes, updatedAt: Date.now() }];
      }
      return [{ id: 'default', title: 'Service Notes', content: '', updatedAt: Date.now() }];
    } catch {
      return [{ id: 'default', title: 'Service Notes', content: '', updatedAt: Date.now() }];
    }
  });

  const [activeNoteId, setActiveNoteId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_NOTE_ID) || 'default';
  });

  const activeNote = savedNotes.find((n) => n.id === activeNoteId) || savedNotes[0] || { id: 'default', title: 'Service Notes', content: '', updatedAt: Date.now() };
  const [noteTitle, setNoteTitle] = useState(activeNote.title);
  const [noteContent, setNoteContent] = useState(activeNote.content);
  const [copiedNote, setCopiedNote] = useState(false);
  const [isSavedFlash, setIsSavedFlash] = useState(false);
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);

  // History state
  const [recentList, setRecentList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RECENT);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isHistorySelectMode, setIsHistorySelectMode] = useState(false);
  const [selectedHistoryIndices, setSelectedHistoryIndices] = useState<Set<number>>(new Set());
  const [hoveredHistoryIndex, setHoveredHistoryIndex] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep noteTitle and noteContent synced when active note changes
  useEffect(() => {
    const current = savedNotes.find((n) => n.id === activeNoteId);
    if (current) {
      setNoteTitle(current.title);
      setNoteContent(current.content);
    }
  }, [activeNoteId]);

  // Persist notes list
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SAVED_NOTES, JSON.stringify(savedNotes));
      localStorage.setItem(STORAGE_KEY_ACTIVE_NOTE_ID, activeNoteId);
    } catch {}
  }, [savedNotes, activeNoteId]);

  useEffect(() => {
    const handleSyncMessage = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      setViewTab('broadcast');
      if (detail.text) {
        if (detail.type === 'nursery') {
          setMode('nursery');
          setMessageText(detail.text);
        } else if (detail.type === 'ticker') {
          setMode('overlay');
          setMessageText(detail.text);
        } else {
          setMode('slide');
          setMessageText(detail.text);
        }
      }
      if (detail.title) setTitleText(detail.title);
    };

    window.addEventListener('bsp:sync-message', handleSyncMessage);
    return () => window.removeEventListener('bsp:sync-message', handleSyncMessage);
  }, []);

  const saveToRecent = (text: string) => {
    if (!text.trim()) return;
    setRecentList((prev) => {
      const updated = [text.trim(), ...prev.filter((t) => t !== text.trim())].slice(0, 30);
      try {
        localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleSendOverlay = () => {
    if (!messageText.trim()) {
      pushNotice({ id: `msg-err-${Date.now()}`, text: 'Please enter message text to broadcast', type: 'warning', duration: 3, animation: 'slideDown' });
      return;
    }
    saveToRecent(messageText);

    triggerAlert({
      id: `alert-${Date.now()}`,
      text: mode === 'nursery' ? `${titleText ? `${titleText}: ` : ''}${messageText.trim()}` : messageText.trim(),
      type: alertType,
      position: mode === 'nursery' ? 'top' : position,
      speed: speed,
      cycles: cycles,
      duration: durationSec,
      animation: mode === 'nursery' ? 'slideDown' : 'crawl',
    });

    pushNotice({
      id: `msg-sent-${Date.now()}`,
      text: `Broadcast alert sent to output screens`,
      type: 'info',
      duration: 3,
      animation: 'slideDown',
    });
  };

  const handleSendSlide = (direct: boolean = true) => {
    if (!messageText.trim()) {
      pushNotice({ id: `msg-err-${Date.now()}`, text: 'Please enter message text to project', type: 'warning', duration: 3, animation: 'slideDown' });
      return;
    }
    saveToRecent(messageText);

    const fullText = titleText.trim()
      ? `${titleText.trim()}\n\n${messageText.trim()}`
      : messageText.trim();

    const scene: Scene = {
      id: `announcement-${Date.now()}`,
      name: titleText.trim() || 'Announcement',
      type: 'presentation',
      content: {
        text: fullText,
      },
    };

    projectScene(scene, { direct });
    pushNotice({
      id: `slide-sent-${Date.now()}`,
      text: direct ? `Announcement slide projected Live` : `Announcement slide cued in Preview`,
      type: 'info',
      duration: 3,
      animation: 'slideDown',
    });
  };

  const handleTakeDownSlide = () => {
    clearProgram();
    pushNotice({
      id: `slide-clear-${Date.now()}`,
      text: 'Slide taken down from Program',
      type: 'info',
      duration: 2,
      animation: 'slideDown',
    });
  };

  const handleClearAlert = () => {
    dismissAlert();
    pushNotice({
      id: `alert-clear-${Date.now()}`,
      text: 'Broadcast overlay stopped and cleared',
      type: 'info',
      duration: 2,
      animation: 'slideDown',
    });
  };

  const handleAddToQueue = () => {
    if (!messageText.trim()) return;
    const fullText = titleText.trim()
      ? `${titleText.trim()}\n\n${messageText.trim()}`
      : messageText.trim();

    const alertConfig: Alert | undefined = mode === 'slide' ? undefined : {
      id: `alert-${Date.now()}`,
      text: mode === 'nursery' ? `${titleText ? `${titleText}: ` : ''}${messageText.trim()}` : messageText.trim(),
      type: alertType,
      position: mode === 'nursery' ? 'top' : position,
      speed: speed,
      cycles: cycles,
      duration: durationSec,
      animation: mode === 'nursery' ? 'slideDown' : 'crawl',
    };

    addToQueue({
      reference: titleText.trim() || (mode === 'nursery' ? 'Nursery Alert' : 'Announcement'),
      text: fullText,
      type: mode === 'overlay' ? 'ticker' : mode === 'nursery' ? 'nursery' : 'slide',
      source: 'Manual',
      alertConfig,
      scene: {
        id: `announcement-${Date.now()}`,
        name: titleText.trim() || 'Announcement',
        type: 'presentation',
        content: { text: fullText },
      },
    });

    pushNotice({
      id: `q-add-${Date.now()}`,
      text: 'Added to service queue',
      type: 'info',
      duration: 3,
      animation: 'slideDown',
    });
  };

  // Notes actions
  const handleSaveNote = () => {
    const finalTitle = noteTitle.trim() || 'Service Note';
    setSavedNotes((prev) => {
      const exists = prev.some((n) => n.id === activeNoteId);
      if (exists) {
        return prev.map((n) => n.id === activeNoteId ? { ...n, title: finalTitle, content: noteContent, updatedAt: Date.now() } : n);
      }
      return [...prev, { id: activeNoteId, title: finalTitle, content: noteContent, updatedAt: Date.now() }];
    });
    setIsSavedFlash(true);
    setTimeout(() => setIsSavedFlash(false), 1800);
    pushNotice({ id: `note-save-${Date.now()}`, text: `Saved note "${finalTitle}"`, type: 'info', duration: 2, animation: 'slideDown' });
  };

  const handleCreateNewNote = () => {
    const newId = `note-${Date.now()}`;
    const newNote: SavedNote = {
      id: newId,
      title: `Note ${savedNotes.length + 1}`,
      content: '',
      updatedAt: Date.now(),
    };
    setSavedNotes((prev) => [...prev, newNote]);
    setActiveNoteId(newId);
    setNoteTitle(newNote.title);
    setNoteContent('');
    pushNotice({ id: `note-new-${Date.now()}`, text: 'Created new note', type: 'info', duration: 2, animation: 'slideDown' });
  };

  const handleDeleteNote = (noteId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (savedNotes.length <= 1) {
      setSavedNotes([{ id: 'default', title: 'Service Notes', content: '', updatedAt: Date.now() }]);
      setActiveNoteId('default');
      setNoteTitle('Service Notes');
      setNoteContent('');
      return;
    }
    const filtered = savedNotes.filter((n) => n.id !== noteId);
    setSavedNotes(filtered);
    if (activeNoteId === noteId) {
      const next = filtered[0];
      setActiveNoteId(next.id);
      setNoteTitle(next.title);
      setNoteContent(next.content);
    }
  };

  const handleCopyNotes = async () => {
    if (!noteContent) return;
    try {
      await navigator.clipboard.writeText(noteContent);
      setCopiedNote(true);
      pushNotice({ id: `note-copy-${Date.now()}`, text: 'Copied note text to clipboard', type: 'info', duration: 2, animation: 'slideDown' });
      setTimeout(() => setCopiedNote(false), 2000);
    } catch {
      pushNotice({ id: `note-err-${Date.now()}`, text: 'Failed to copy notes', type: 'warning', duration: 2, animation: 'slideDown' });
    }
  };

  const handleSendNotesToBroadcast = () => {
    if (!noteContent.trim()) return;
    setMessageText(noteContent.trim());
    if (noteTitle.trim()) setTitleText(noteTitle.trim());
    setViewTab('broadcast');
    pushNotice({ id: `note-to-bcast-${Date.now()}`, text: 'Transferred note into broadcast editor', type: 'info', duration: 2, animation: 'slideDown' });
  };

  // History delete actions
  const handleDeleteHistorySingle = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentList((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      try {
        localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setSelectedHistoryIndices((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  const handleDeleteSelectedHistory = () => {
    if (selectedHistoryIndices.size === 0) return;
    setRecentList((prev) => {
      const updated = prev.filter((_, i) => !selectedHistoryIndices.has(i));
      try {
        localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setSelectedHistoryIndices(new Set());
    setIsHistorySelectMode(false);
    pushNotice({ id: `hist-del-${Date.now()}`, text: 'Deleted selected history items', type: 'info', duration: 2, animation: 'slideDown' });
  };

  const toggleHistoryCheck = (index: number) => {
    setSelectedHistoryIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleSelectAllHistory = () => {
    if (selectedHistoryIndices.size === recentList.length) {
      setSelectedHistoryIndices(new Set());
    } else {
      setSelectedHistoryIndices(new Set(recentList.map((_, i) => i)));
    }
  };

  return (
    <Block
      className="blk-fill"
      title="Announce"
      subtitle={activeAlert?.text ? "On Air" : undefined}
      tools={
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Tab 1: Broadcast */}
          <button
            type="button"
            onClick={() => setViewTab('broadcast')}
            title="Broadcast Live Announcements & Overlays"
            style={{
              height: 24,
              padding: '0 5px',
              fontSize: 11,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'transparent',
              border: 'none',
              borderRadius: 4,
              color: viewTab === 'broadcast' ? 'var(--tally-preview)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'color 0.15s ease',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
            <span>Live</span>
          </button>

          {/* Tab 2: Service Notes */}
          <button
            type="button"
            onClick={() => setViewTab('notes')}
            title="Type, name and save private service notes or media team instructions"
            style={{
              height: 24,
              padding: '0 5px',
              fontSize: 11,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'transparent',
              border: 'none',
              borderRadius: 4,
              color: viewTab === 'notes' ? 'var(--tally-preview)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'color 0.15s ease',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span>Notes</span>
          </button>

          {/* Tab 3: History */}
          <button
            type="button"
            onClick={() => setViewTab('history')}
            title="Recent announcements history"
            style={{
              height: 24,
              padding: '0 5px',
              fontSize: 11,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'transparent',
              border: 'none',
              borderRadius: 4,
              color: viewTab === 'history' ? 'var(--tally-preview)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'color 0.15s ease',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>History ({recentList.length})</span>
          </button>

          {/* Save Button for Notes View in top chrome */}
          {viewTab === 'notes' && (
            <button
              type="button"
              onClick={handleSaveNote}
              title="Save current note"
              style={{
                height: 22,
                padding: '0 6px',
                fontSize: 10.5,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: isSavedFlash ? 'var(--tally-preview, #22c55e)' : 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                borderRadius: 4,
                color: isSavedFlash ? '#000000' : 'var(--tally-preview, #22c55e)',
                cursor: 'pointer',
                marginLeft: 2,
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              <span>{isSavedFlash ? 'Saved' : 'Save'}</span>
            </button>
          )}

          {/* Clear active overlay if currently on air */}
          {activeAlert?.text && (
            <button
              type="button"
              onClick={handleClearAlert}
              title="Stop live overlay from screens"
              style={{
                height: 22,
                padding: '0 5px',
                fontSize: 10,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                background: 'rgba(239, 68, 68, 0.18)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 4,
                color: '#ff6b6b',
                cursor: 'pointer',
                marginLeft: 4,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span>Stop</span>
            </button>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        
        {/* ========================================================= */}
        {/* VIEW 1: LIVE BROADCAST TAB                                */}
        {/* ========================================================= */}
        {viewTab === 'broadcast' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', minHeight: 0 }}>
            {/* Top Mode Segment Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'var(--bg-secondary)', padding: 3, borderRadius: 'var(--radius-sm)' }}>
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  flex: 1,
                  fontSize: 11,
                  fontWeight: 600,
                  gap: 5,
                  background: mode === 'overlay' ? 'var(--chrome-control-active)' : 'transparent',
                  color: mode === 'overlay' ? 'var(--text-primary)' : 'var(--text-dim)',
                  border: 'none',
                  borderRadius: 4,
                  boxShadow: mode === 'overlay' ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
                }}
                onClick={() => setMode('overlay')}
                title="Broadcast lower-third or top crawling ticker over worship/video"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="18" rx="2" />
                  <line x1="2" y1="16" x2="22" y2="16" stroke="var(--accent, #FF5500)" strokeWidth="2.5" />
                </svg>
                <span>Ticker / Banner</span>
              </button>

              <button
                type="button"
                className="btn btn-sm"
                style={{
                  flex: 1,
                  fontSize: 11,
                  fontWeight: 600,
                  gap: 5,
                  background: mode === 'slide' ? 'var(--chrome-control-active)' : 'transparent',
                  color: mode === 'slide' ? 'var(--text-primary)' : 'var(--text-dim)',
                  border: 'none',
                  borderRadius: 4,
                  boxShadow: mode === 'slide' ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
                }}
                onClick={() => setMode('slide')}
                title="Project as a clean full-screen slide"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                <span>Fullscreen Slide</span>
              </button>

              <button
                type="button"
                className="btn btn-sm"
                style={{
                  flex: 1,
                  fontSize: 11,
                  fontWeight: 600,
                  gap: 5,
                  background: mode === 'nursery' ? 'var(--chrome-control-active)' : 'transparent',
                  color: mode === 'nursery' ? 'var(--text-primary)' : 'var(--text-dim)',
                  border: 'none',
                  borderRadius: 4,
                  boxShadow: mode === 'nursery' ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
                }}
                onClick={() => {
                  setMode('nursery');
                  if (titleText === 'ANNOUNCEMENT') setTitleText('NURSERY ALERT');
                }}
                title="Discreet nursery or parking lot alert badge"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span>Nursery Code</span>
              </button>
            </div>

            {/* Title / Header Input */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  className="input"
                  value={titleText}
                  onChange={(e) => setTitleText(e.target.value)}
                  placeholder="Header / Tag (e.g. ANNOUNCEMENT, NOTICE, NURSERY)"
                  style={{
                    width: '100%',
                    height: 28,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                    paddingLeft: 26,
                  }}
                />
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-dim)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                >
                  <polyline points="4 7 4 4 20 4 20 7" />
                  <line x1="9" y1="20" x2="15" y2="20" />
                  <line x1="12" y1="4" x2="12" y2="20" />
                </svg>
              </div>

              {messageText && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => { setMessageText(''); setTitleText('ANNOUNCEMENT'); textareaRef.current?.focus(); }}
                  title="Clear text"
                  style={{ height: 28, padding: '0 8px', fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Message Textarea */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 110 }}>
              <textarea
                ref={textareaRef}
                className="input"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={
                  mode === 'nursery'
                    ? "Enter child code or vehicle tag (e.g. Baby #402, Green Toyota AB123)..."
                    : mode === 'overlay'
                    ? "Enter message to scroll across the screen (e.g. Welcome to Sunday Service • Next prayer meeting Wednesday 7PM)..."
                    : "Type announcement text to project full screen..."
                }
                style={{
                  flex: 1,
                  width: '100%',
                  fontSize: 13,
                  lineHeight: 1.45,
                  resize: 'none',
                  fontFamily: 'inherit',
                  padding: '8px 10px',
                }}
              />
            </div>

            {/* Overlay Parameters (Only visible in Ticker/Overlay Mode) */}
            {mode === 'overlay' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <label style={{ ...type.caption, fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Style</label>
                  <select
                    className="input"
                    value={alertType}
                    onChange={(e) => setAlertType(e.target.value as Alert['type'])}
                    style={{ height: 24, fontSize: 11, padding: '0 4px', width: '100%' }}
                  >
                    <option value="announcement">Announcement</option>
                    <option value="info">Information</option>
                    <option value="warning">Urgent / Alert</option>
                  </select>
                </div>

                <div>
                  <label style={{ ...type.caption, fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Position</label>
                  <select
                    className="input"
                    value={position}
                    onChange={(e) => setPosition(e.target.value as 'top' | 'bottom')}
                    style={{ height: 24, fontSize: 11, padding: '0 4px', width: '100%' }}
                  >
                    <option value="bottom">Lower Third</option>
                    <option value="top">Top Banner</option>
                  </select>
                </div>

                <div>
                  <label style={{ ...type.caption, fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Speed</label>
                  <select
                    className="input"
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    style={{ height: 24, fontSize: 11, padding: '0 4px', width: '100%' }}
                  >
                    <option value={0.7}>Slow</option>
                    <option value={1}>Normal</option>
                    <option value={1.4}>Fast</option>
                  </select>
                </div>

                <div>
                  <label style={{ ...type.caption, fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Duration</label>
                  <select
                    className="input"
                    value={durationSec}
                    onChange={(e) => setDurationSec(Number(e.target.value))}
                    style={{ height: 24, fontSize: 11, padding: '0 4px', width: '100%' }}
                  >
                    <option value={10}>10s</option>
                    <option value={15}>15s</option>
                    <option value={20}>20s</option>
                    <option value={30}>30s</option>
                    <option value={60}>60s</option>
                  </select>
                </div>
              </div>
            )}

            {/* Main Action Bar */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingTop: 2 }}>
              {mode === 'slide' ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleSendSlide(true)}
                    style={{
                      flex: 1.3,
                      background: '#FF5500',
                      borderColor: '#FF5500',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      fontWeight: 600,
                      height: 30,
                      fontSize: 12,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <span>Project Live</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleTakeDownSlide}
                    title="Take down slide from Live Program"
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      height: 30,
                      fontSize: 12,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                    <span>Take Down</span>
                  </button>

                  {isStudio && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleSendSlide(false)}
                      title="Stage in Preview"
                      style={{
                        height: 30,
                        padding: '0 10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        fontSize: 12,
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      <span>Preview</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSendOverlay}
                    style={{
                      flex: 1.4,
                      background: alertType === 'warning' ? '#ef4444' : '#FF5500',
                      borderColor: 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      fontWeight: 600,
                      height: 30,
                      fontSize: 12,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <span>{activeAlert?.text ? 'Update Live' : 'Broadcast Live'}</span>
                  </button>

                  {activeAlert?.text && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleClearAlert}
                      title="Take down active overlay ticker"
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        height: 30,
                        fontSize: 12,
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                      </svg>
                      <span>Take Down</span>
                    </button>
                  )}
                </>
              )}

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAddToQueue}
                title="Add announcement to the service schedule / queue"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  padding: '0 10px',
                  height: 30,
                  fontSize: 12,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Queue</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: SERVICE NOTES TAB WITH SAVED NOTES LIST & NAMING   */}
        {/* ========================================================= */}
        {viewTab === 'notes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%', minHeight: 0 }}>
            {/* Notes Selector Bar with + New Note button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, overflowX: 'auto' }}>
                {savedNotes.map((note) => {
                  const isCur = note.id === activeNoteId;
                  const isHovered = hoveredNoteId === note.id;
                  return (
                    <div
                      key={note.id}
                      onClick={() => {
                        handleSaveNote();
                        setActiveNoteId(note.id);
                      }}
                      onMouseEnter={() => setHoveredNoteId(note.id)}
                      onMouseLeave={() => setHoveredNoteId(null)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        background: isCur ? 'rgba(34, 197, 94, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                        border: `1px solid ${isCur ? 'var(--tally-preview, #22c55e)' : 'rgba(255, 255, 255, 0.08)'}`,
                        color: isCur ? 'var(--tally-preview, #22c55e)' : 'var(--text-secondary)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      <span>{note.title || 'Untitled'}</span>
                      {savedNotes.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteNote(note.id, e)}
                          title="Delete this note"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: 'inherit',
                            cursor: 'pointer',
                            padding: '0 2px',
                            fontSize: 10,
                            opacity: isHovered || isCur ? 0.7 : 0,
                            pointerEvents: isHovered || isCur ? 'auto' : 'none',
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleCreateNewNote}
                title="Create a new service note"
                style={{
                  height: 22,
                  padding: '0 6px',
                  fontSize: 10.5,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 4,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <span>+ New</span>
              </button>
            </div>

            {/* Note Title Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  className="input"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Note Title / Subject..."
                  style={{
                    width: '100%',
                    height: 26,
                    fontSize: 11.5,
                    fontWeight: 600,
                    paddingLeft: 24,
                  }}
                />
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-dim)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>

              <span style={{ ...type.caption, color: 'var(--text-dim)', fontSize: 10, flexShrink: 0 }}>
                {noteContent.length} chars
              </span>
            </div>

            {/* Note Content Textarea */}
            <textarea
              className="input"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Type rundown notes, announcement details, pastor's instructions, or prayer points to keep for this service..."
              style={{
                flex: 1,
                width: '100%',
                fontSize: 12.5,
                lineHeight: 1.45,
                resize: 'none',
                fontFamily: 'inherit',
                padding: '8px 10px',
                minHeight: 110,
              }}
            />

            {/* Note Bottom Action Bar */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveNote}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  height: 30,
                  fontSize: 12,
                  background: isSavedFlash ? 'var(--tally-preview, #22c55e)' : '#FF5500',
                  borderColor: 'transparent',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                <span>{isSavedFlash ? 'Saved!' : 'Save Note'}</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCopyNotes}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  height: 30,
                  fontSize: 12,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>{copiedNote ? 'Copied!' : 'Copy'}</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSendNotesToBroadcast}
                title="Send note text to broadcast editor for projection"
                style={{
                  flex: 1.1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  height: 30,
                  fontSize: 12,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
                <span>Load to Live</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 3: RECENT HISTORY TAB WITH MULTI-DELETE & HOVER DEL  */}
        {/* ========================================================= */}
        {viewTab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%', minHeight: 0 }}>
            {/* History Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ ...type.caption, color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>
                  Recent Messages ({recentList.length})
                </span>
                {recentList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsHistorySelectMode(!isHistorySelectMode);
                      setSelectedHistoryIndices(new Set());
                    }}
                    style={{
                      height: 20,
                      padding: '0 6px',
                      fontSize: 10,
                      fontWeight: 600,
                      background: isHistorySelectMode ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                      border: `1px solid ${isHistorySelectMode ? 'var(--tally-preview)' : 'rgba(255, 255, 255, 0.12)'}`,
                      borderRadius: 3,
                      color: isHistorySelectMode ? 'var(--tally-preview)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {isHistorySelectMode ? 'Cancel' : 'Select'}
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              {isHistorySelectMode ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    onClick={toggleSelectAllHistory}
                    style={{
                      padding: '2px 6px',
                      fontSize: 10,
                      background: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: 3,
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {selectedHistoryIndices.size === recentList.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <button
                    type="button"
                    disabled={selectedHistoryIndices.size === 0}
                    onClick={handleDeleteSelectedHistory}
                    style={{
                      padding: '2px 8px',
                      fontSize: 10,
                      fontWeight: 700,
                      background: selectedHistoryIndices.size > 0 ? 'var(--tally-fault, #ef4444)' : 'rgba(255, 255, 255, 0.05)',
                      border: 'none',
                      borderRadius: 3,
                      color: '#ffffff',
                      cursor: selectedHistoryIndices.size > 0 ? 'pointer' : 'default',
                      opacity: selectedHistoryIndices.size > 0 ? 1 : 0.4,
                    }}
                  >
                    Delete ({selectedHistoryIndices.size})
                  </button>
                </div>
              ) : (
                recentList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setRecentList([]);
                      localStorage.removeItem(STORAGE_KEY_RECENT);
                    }}
                    style={{
                      fontSize: 10,
                      padding: '1px 5px',
                      color: 'var(--text-dim)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    title="Clear all recent history"
                  >
                    Clear All
                  </button>
                )
              )}
            </div>

            {recentList.length === 0 ? (
              <div style={{ color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', padding: '30px 16px' }}>
                No recent announcement messages stored yet.
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 2 }}>
                {recentList.map((item, idx) => {
                  const isChecked = selectedHistoryIndices.has(idx);
                  const isHovered = hoveredHistoryIndex === idx;
                  return (
                    <div
                      key={idx}
                      onMouseEnter={() => setHoveredHistoryIndex(idx)}
                      onMouseLeave={() => setHoveredHistoryIndex(null)}
                      onClick={() => {
                        if (isHistorySelectMode) {
                          toggleHistoryCheck(idx);
                        } else {
                          setMessageText(item);
                          setViewTab('broadcast');
                          textareaRef.current?.focus();
                        }
                      }}
                      style={{
                        padding: '6px 8px',
                        borderRadius: 4,
                        background: isChecked ? 'rgba(239, 68, 68, 0.08)' : isHovered ? 'var(--bg-hover)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isChecked ? 'var(--tally-fault, #ef4444)' : 'rgba(255,255,255,0.06)'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                        transition: 'all 0.15s ease',
                      }}
                      title={isHistorySelectMode ? 'Click to select' : 'Click to load into broadcast editor'}
                    >
                      {isHistorySelectMode && (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleHistoryCheck(idx)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ accentColor: 'var(--tally-fault, #ef4444)', cursor: 'pointer', margin: 0, flexShrink: 0 }}
                        />
                      )}

                      <div
                        style={{
                          flex: 1,
                          fontSize: 11.5,
                          color: 'var(--text-primary)',
                          lineHeight: 1.35,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item}
                      </div>

                      {!isHistorySelectMode && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteHistorySingle(idx, e)}
                          title="Delete from history"
                          style={{
                            padding: '1px 5px',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: 3,
                            color: 'var(--text-dim)',
                            cursor: isHovered ? 'pointer' : 'default',
                            opacity: isHovered ? 0.8 : 0,
                            pointerEvents: isHovered ? 'auto' : 'none',
                            transition: 'opacity 0.15s ease, color 0.15s ease',
                            fontSize: 11,
                            flexShrink: 0,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--tally-fault, #ef4444)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </Block>
  );
}
