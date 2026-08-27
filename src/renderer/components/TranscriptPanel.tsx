import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../stores/appStore';
import { Block, BlockButton } from './Block';
import { useI18n } from '../../i18n/useI18n';
import {
  TranscriptExportPayload,
  TranscriptScriptureQuote,
  buildTranscriptDocxBlob,
  buildTranscriptPdfBlob,
  buildTranscriptJson,
  formatTranscriptMarkdown,
  downloadTranscriptFile,
  copyTranscriptMarkdown,
} from '../utils/transcript-exporter';

interface TranscriptPanelProps {
  onOpenLiveScripture?: () => void;
}

export interface TranscriptSessionItem {
  id: string;
  title: string;
  speaker: string;
  churchName: string;
  dateTime: string;
  text: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_SESSIONS_KEY = 'bsp_transcript_sessions_v2';

function loadStoredSessions(): TranscriptSessionItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_SESSIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback below
  }
  const defaultDate = new Date();
  return [
    {
      id: `session-${defaultDate.getTime()}`,
      title: `Sermon - ${defaultDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`,
      speaker: localStorage.getItem('bsp_transcript_speaker') || '',
      churchName: localStorage.getItem('bsp_transcript_church_name') || 'Church',
      dateTime: defaultDate.toLocaleString(),
      text: '',
      createdAt: defaultDate.getTime(),
      updatedAt: defaultDate.getTime(),
    },
  ];
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function TranscriptPanel({ onOpenLiveScripture }: TranscriptPanelProps) {
  const { t } = useI18n();
  const transcription = useAppStore((s) => s.transcription);
  const setTranscription = useAppStore((s) => s.setTranscription);
  const aiProviders = useAppStore((s) => s.aiProviders);
  const enabledProvider = aiProviders.find((p) => p.enabled);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const followRef = useRef(true);

  // Tabs / Views: 'live' | 'sessions' | 'edit'
  const [viewMode, setViewMode] = useState<'live' | 'sessions' | 'edit'>('live');

  // Sessions state
  const [sessions, setSessions] = useState<TranscriptSessionItem[]>(() => loadStoredSessions());
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const loaded = loadStoredSessions();
    return loaded[0]?.id || `session-${Date.now()}`;
  });
  const liveSessionIdRef = useRef<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionRenameText, setSessionRenameText] = useState('');
  const [sessionToDeleteId, setSessionToDeleteId] = useState<string | null>(null);

  // Merge Selection state
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [selectedMergeIds, setSelectedMergeIds] = useState<string[]>([]);

  // Start Resume Prompt state
  const [showResumePrompt, setShowResumePrompt] = useState(false);

  // Active Session & Edit Mode state
  const [editText, setEditText] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tags / Metadata state
  const [showTags, setShowTags] = useState(false);
  const [churchName, setChurchName] = useState(() => localStorage.getItem('bsp_transcript_church_name') || 'Church');
  const [sermonTitle, setSermonTitle] = useState(() => `Sermon - ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`);
  const [speaker, setSpeaker] = useState(() => localStorage.getItem('bsp_transcript_speaker') || '');
  const [dateTime, setDateTime] = useState(() => new Date().toLocaleString());
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Export Menu state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number; flip: boolean } | null>(null);
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Save sessions to localStorage
  const saveSessions = useCallback((items: TranscriptSessionItem[]) => {
    setSessions(items);
    try {
      localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(items));
    } catch {
      // quota or storage disabled
    }
  }, []);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  // Protect against overwriting: auto-create new session when live transcription activates if current session already has text
  useEffect(() => {
    if (transcription.isActive) {
      if (!liveSessionIdRef.current) {
        const cur = sessions.find((s) => s.id === activeSessionId);
        if (!activeSessionId || (cur && cur.text.trim().length > 0)) {
          const now = new Date();
          const newSession: TranscriptSessionItem = {
            id: `session-${now.getTime()}`,
            title: `Transcript - ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            speaker: localStorage.getItem('bsp_transcript_speaker') || '',
            churchName: localStorage.getItem('bsp_transcript_church_name') || 'Church',
            dateTime: now.toLocaleString(),
            text: transcription.text || '',
            createdAt: now.getTime(),
            updatedAt: now.getTime(),
          };
          const updated = [newSession, ...sessions];
          saveSessions(updated);
          setActiveSessionId(newSession.id);
          liveSessionIdRef.current = newSession.id;
        } else {
          liveSessionIdRef.current = activeSessionId;
        }
      }
    } else {
      liveSessionIdRef.current = null;
    }
  }, [transcription.isActive, activeSessionId, sessions, saveSessions]);

  // Sync incoming transcription text ONLY into the dedicated live session
  useEffect(() => {
    if (transcription.text) {
      const targetId = liveSessionIdRef.current || activeSessionId;
      if (!targetId) return;

      setSessions((prev) => {
        const next = prev.map((s) => {
          if (s.id === targetId) {
            return { ...s, text: transcription.text, updatedAt: Date.now() };
          }
          return s;
        });
        try {
          localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });

      if (activeSessionId === targetId && viewMode !== 'edit') {
        setEditText(transcription.text);
      }
    }
  }, [transcription.text, activeSessionId, viewMode]);

  // Sync metadata tags when switching active session
  useEffect(() => {
    if (activeSession) {
      setSermonTitle(activeSession.title);
      setSpeaker(activeSession.speaker);
      setChurchName(activeSession.churchName);
      setDateTime(activeSession.dateTime);
      if (viewMode !== 'edit') {
        setEditText(activeSession.text);
      }
    }
  }, [activeSessionId]);

  const onUserScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    followRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !followRef.current || viewMode === 'edit') return;
    el.scrollTop = el.scrollHeight;
  }, [transcription.text, transcription.interimText, viewMode, activeSessionId]);

  const showToast = (msg: string) => {
    setFeedbackNotice(msg);
    window.setTimeout(() => setFeedbackNotice(null), 3000);
  };

  const handleChurchChange = (val: string) => {
    setChurchName(val);
    localStorage.setItem('bsp_transcript_church_name', val);
    if (activeSessionId) {
      saveSessions(sessions.map((s) => (s.id === activeSessionId ? { ...s, churchName: val, updatedAt: Date.now() } : s)));
    }
  };

  const handleSpeakerChange = (val: string) => {
    setSpeaker(val);
    localStorage.setItem('bsp_transcript_speaker', val);
    if (activeSessionId) {
      saveSessions(sessions.map((s) => (s.id === activeSessionId ? { ...s, speaker: val, updatedAt: Date.now() } : s)));
    }
  };

  const handleTitleChange = (val: string) => {
    setSermonTitle(val);
    if (activeSessionId) {
      saveSessions(sessions.map((s) => (s.id === activeSessionId ? { ...s, title: val, updatedAt: Date.now() } : s)));
    }
  };

  const handleDateTimeChange = (val: string) => {
    setDateTime(val);
    if (activeSessionId) {
      saveSessions(sessions.map((s) => (s.id === activeSessionId ? { ...s, dateTime: val, updatedAt: Date.now() } : s)));
    }
  };

  // Undo / Redo management
  const pushHistory = useCallback((newText: string, immediate = false) => {
    const update = () => {
      if (historyIndexRef.current >= 0 && historyRef.current[historyIndexRef.current] === newText) {
        return;
      }
      const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1);
      trimmed.push(newText);
      if (trimmed.length > 100) trimmed.shift();
      historyRef.current = trimmed;
      historyIndexRef.current = trimmed.length - 1;
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(false);
    };

    if (immediate) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      update();
    } else {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(update, 250);
    }
  }, []);

  const handleUndo = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const prev = historyRef.current[historyIndexRef.current];
      setEditText(prev);
      if (activeSessionId) {
        setSessions((sList) =>
          sList.map((s) => (s.id === activeSessionId ? { ...s, text: prev, updatedAt: Date.now() } : s))
        );
      }
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    }
  }, [activeSessionId]);

  const handleRedo = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const next = historyRef.current[historyIndexRef.current];
      setEditText(next);
      if (activeSessionId) {
        setSessions((sList) =>
          sList.map((s) => (s.id === activeSessionId ? { ...s, text: next, updatedAt: Date.now() } : s))
        );
      }
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    }
  }, [activeSessionId]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setEditText(val);
    pushHistory(val, false);
    if (activeSessionId) {
      saveSessions(sessions.map((s) => (s.id === activeSessionId ? { ...s, text: val, updatedAt: Date.now() } : s)));
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isCmdOrCtrl = e.metaKey || e.ctrlKey;

    if (isCmdOrCtrl && e.key.toLowerCase() === 'z') {
      if (e.shiftKey) {
        e.preventDefault();
        handleRedo();
      } else {
        e.preventDefault();
        handleUndo();
      }
    } else if (isCmdOrCtrl && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      handleRedo();
    }
  };

  const toggleEditMode = () => {
    if (viewMode === 'edit') {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (activeSessionId) {
        saveSessions(sessions.map((s) => (s.id === activeSessionId ? { ...s, text: editText, updatedAt: Date.now() } : s)));
      }
      if (activeSessionId === liveSessionIdRef.current || !transcription.isActive) {
        setTranscription({ text: editText });
      }
      setViewMode('live');
      showToast(t('transcript.toast.updated'));
    } else {
      const current = activeSession?.text || '';
      setEditText(current);
      historyRef.current = [current];
      historyIndexRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);
      setViewMode('edit');
      window.setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  };

  // Session list operations
  const handleCreateNewSession = () => {
    const now = new Date();
    const newSession: TranscriptSessionItem = {
      id: `session-${now.getTime()}`,
      title: `Session ${sessions.length + 1} - ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      speaker: speaker || '',
      churchName: churchName || 'Church',
      dateTime: now.toLocaleString(),
      text: '',
      createdAt: now.getTime(),
      updatedAt: now.getTime(),
    };
    const updated = [newSession, ...sessions];
    saveSessions(updated);
    setActiveSessionId(newSession.id);
    if (!transcription.isActive) {
      setTranscription({ text: '', interimText: '' });
    }
    setEditText('');
    setViewMode('live');
    showToast(t('transcript.toast.sessionCreated'));
  };

  const handleSelectSession = (session: TranscriptSessionItem) => {
    if (isMergeMode) {
      // Toggle selection in merge mode
      setSelectedMergeIds((prev) =>
        prev.includes(session.id) ? prev.filter((id) => id !== session.id) : [...prev, session.id]
      );
      return;
    }
    setActiveSessionId(session.id);
    setEditText(session.text);
    if (!transcription.isActive) {
      setTranscription({ text: session.text, interimText: '' });
    }
    setViewMode('live');
    showToast(t('transcript.toast.loaded', { title: session.title }));
  };

  const handleStartRename = (session: TranscriptSessionItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setSessionRenameText(session.title);
  };

  const handleSaveRename = (id: string) => {
    if (sessionRenameText.trim()) {
      saveSessions(sessions.map((s) => (s.id === id ? { ...s, title: sessionRenameText.trim(), updatedAt: Date.now() } : s)));
      if (id === activeSessionId) setSermonTitle(sessionRenameText.trim());
      showToast(t('transcript.toast.renamed'));
    }
    setEditingSessionId(null);
  };

  const handleDeleteClick = (session: TranscriptSessionItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (transcription.isActive && session.id === liveSessionIdRef.current) {
      showToast(t('transcript.toast.stopBeforeDelete'));
      return;
    }
    setSessionToDeleteId(session.id);
  };

  const confirmDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessionToDeleteId(null);
    const filtered = sessions.filter((s) => s.id !== id);
    if (filtered.length === 0) {
      const now = new Date();
      const blankSession: TranscriptSessionItem = {
        id: `session-${now.getTime()}`,
        title: `Transcript - ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        speaker: speaker || localStorage.getItem('bsp_transcript_speaker') || '',
        churchName: churchName || localStorage.getItem('bsp_transcript_church_name') || 'Church',
        dateTime: now.toLocaleString(),
        text: '',
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
      };
      saveSessions([blankSession]);
      setActiveSessionId(blankSession.id);
      setEditText('');
    } else {
      saveSessions(filtered);
      if (id === activeSessionId) {
        setActiveSessionId(filtered[0].id);
        setEditText(filtered[0].text);
        if (!transcription.isActive) {
          setTranscription({ text: filtered[0].text, interimText: '' });
        }
      }
    }
    showToast(t('transcript.toast.sessionRemoved'));
  };

  // Merge selected sessions into a unified transcript
  const handleExecuteMerge = () => {
    if (selectedMergeIds.length < 2) return;

    // Filter and sort chronologically by createdAt (oldest first)
    const toMerge = sessions
      .filter((s) => selectedMergeIds.includes(s.id))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    if (toMerge.length < 2) return;

    const baseSession = toMerge[0];
    const combinedText = toMerge
      .map((s) => s.text.trim())
      .filter(Boolean)
      .join('\n\n');

    const firstNamedSpeaker = toMerge.find((s) => s.speaker.trim())?.speaker || baseSession.speaker;
    const firstNamedChurch = toMerge.find((s) => s.churchName.trim())?.churchName || baseSession.churchName;

    const mergedSession: TranscriptSessionItem = {
      id: `session-${Date.now()}`,
      title: baseSession.title.includes('(') ? baseSession.title : `${baseSession.title} (Merged)`,
      speaker: firstNamedSpeaker,
      churchName: firstNamedChurch,
      dateTime: baseSession.dateTime,
      text: combinedText,
      createdAt: baseSession.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    // Replace the merged fragments with the single unified session
    const remaining = sessions.filter((s) => !selectedMergeIds.includes(s.id));
    const nextSessions = [mergedSession, ...remaining];

    saveSessions(nextSessions);
    setActiveSessionId(mergedSession.id);
    setEditText(mergedSession.text);
    if (!transcription.isActive) {
      setTranscription({ text: mergedSession.text, interimText: '' });
    }

    setIsMergeMode(false);
    setSelectedMergeIds([]);
    showToast(t('transcript.toast.merged', { count: toMerge.length }));
  };

  // Position export menu under the export button
  const measureExportMenu = useCallback(() => {
    const button = exportBtnRef.current?.getBoundingClientRect();
    if (!button) return;
    const estimatedHeight = 240;
    const flip = button.bottom + estimatedHeight + 8 > window.innerHeight;
    setMenuRect({
      top: flip ? button.top - 4 : button.bottom + 4,
      left: Math.max(8, button.right - 220),
      width: 220,
      flip,
    });
  }, []);

  useEffect(() => {
    if (!isExportOpen) return;
    measureExportMenu();
    const handleScrollResize = () => measureExportMenu();
    window.addEventListener('scroll', handleScrollResize, true);
    window.addEventListener('resize', handleScrollResize);
    return () => {
      window.removeEventListener('scroll', handleScrollResize, true);
      window.removeEventListener('resize', handleScrollResize);
    };
  }, [isExportOpen, measureExportMenu]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (exportBtnRef.current?.contains(target) || exportMenuRef.current?.contains(target)) return;
      setIsExportOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsExportOpen(false);
    }
    if (isExportOpen) {
      window.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isExportOpen]);

  async function getExportScriptures(): Promise<TranscriptScriptureQuote[]> {
    const quotes: TranscriptScriptureQuote[] = [];
    try {
      const list = await window.BSP?.session?.list().catch(() => null);
      if (list?.sessions && list.sessions.length > 0) {
        const latestSession = list.sessions[0];
        const data = await window.BSP?.session?.get(latestSession.id).catch(() => null);
        if (data?.session?.entries) {
          data.session.entries.forEach((e: any) => {
            if (e.reference) {
              quotes.push({
                reference: e.reference,
                text: e.text || undefined,
                version: e.version || undefined,
              });
            }
          });
        }
      }
    } catch {
      // session service unavailable
    }
    return quotes;
  }

  async function handleExport(format: string) {
    setIsExportOpen(false);
    const currentTranscript = viewMode === 'edit' ? editText : (activeSession?.text || transcription.text);
    if (!currentTranscript.trim()) {
      showToast(t('transcript.toast.noTextToExport'));
      return;
    }

    const scriptures = await getExportScriptures();
    const payload: TranscriptExportPayload = {
      churchName: (churchName || activeSession?.churchName || 'Church').trim(),
      title: (sermonTitle || activeSession?.title || 'Sermon Transcript').trim(),
      speaker: (speaker || activeSession?.speaker || '').trim(),
      dateTime: (dateTime || activeSession?.dateTime || new Date().toLocaleString()).trim(),
      transcript: currentTranscript,
      scriptures,
    };

    const sanitizedBase = (payload.title || 'Sermon-Transcript')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const dateStr = new Date().toISOString().slice(0, 10);
    const baseFilename = `${dateStr}-${sanitizedBase || 'transcript'}`;

    try {
      if (format === 'md') {
        const md = formatTranscriptMarkdown(payload);
        downloadTranscriptFile(`${baseFilename}.md`, md, 'text/markdown;charset=utf-8');
        showToast(t('transcript.toast.exportedMd'));
      } else if (format === 'docx') {
        const docxBlob = buildTranscriptDocxBlob(payload);
        downloadTranscriptFile(`${baseFilename}.docx`, docxBlob, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        showToast(t('transcript.toast.exportedDocx'));
      } else if (format === 'pdf') {
        const pdfBlob = buildTranscriptPdfBlob(payload);
        downloadTranscriptFile(`${baseFilename}.pdf`, pdfBlob, 'application/pdf');
        showToast(t('transcript.toast.exportedPdf'));
      } else if (format === 'json') {
        const jsonStr = buildTranscriptJson(payload);
        downloadTranscriptFile(`${baseFilename}.json`, jsonStr, 'application/json;charset=utf-8');
        showToast(t('transcript.toast.exportedJson'));
      } else if (format === 'copy') {
        const ok = await copyTranscriptMarkdown(payload);
        if (ok) {
          showToast(t('transcript.toast.copiedClipboard'));
        } else {
          showToast(t('transcript.toast.copyFailed'));
        }
      }
    } catch {
      showToast(t('transcript.toast.exportFailed'));
    }
  }

  // Handle Start Transcribing Click (Checks if we should ask Resume vs New)
  function handleStartClick() {
    const cur = sessions.find((s) => s.id === activeSessionId);
    if (cur && cur.text.trim().length > 0) {
      setShowResumePrompt(true);
    } else {
      executeStart(activeSessionId, false);
    }
  }

  function executeStart(targetId: string | null, isResume: boolean) {
    setShowResumePrompt(false);
    let finalId = targetId;

    if (!isResume) {
      const now = new Date();
      const newSession: TranscriptSessionItem = {
        id: `session-${now.getTime()}`,
        title: `Transcript - ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        speaker: speaker || localStorage.getItem('bsp_transcript_speaker') || '',
        churchName: churchName || localStorage.getItem('bsp_transcript_church_name') || 'Church',
        dateTime: now.toLocaleString(),
        text: '',
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
      };
      const updated = [newSession, ...sessions];
      saveSessions(updated);
      finalId = newSession.id;
      setActiveSessionId(newSession.id);
      setTranscription({ text: '', interimText: '' });
      setEditText('');
    } else {
      const targetSession = sessions.find((s) => s.id === targetId);
      if (targetSession) {
        setTranscription({ text: targetSession.text, interimText: '' });
        setEditText(targetSession.text);
      }
    }

    liveSessionIdRef.current = finalId;
    setViewMode('live');

    onOpenLiveScripture?.();
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('bsp:live-transcription-start'));
    }, 100);
  }

  function stopTranscription() {
    window.dispatchEvent(new CustomEvent('bsp:live-transcription-stop'));
    liveSessionIdRef.current = null;
  }

  const exportActions = [
    {
      id: 'md',
      label: t('transcript.export.md'),
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
      ),
    },
    {
      id: 'docx',
      label: t('transcript.export.docx'),
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M8 13l2 4 2-4 2 4" />
        </svg>
      ),
    },
    {
      id: 'pdf',
      label: t('transcript.export.pdf'),
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
      ),
    },
    {
      id: 'json',
      label: t('transcript.export.json'),
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      ),
    },
    {
      id: 'copy',
      label: t('transcript.export.copyMarkdown'),
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      ),
    },
  ];

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const shortcutCards = [
    {
      label: t('transcript.shortcut.undo'),
      shortcut: isMac ? '⌘Z' : 'Ctrl+Z',
      icon: (
        <svg width="12.5" height="12.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
        </svg>
      ),
    },
    {
      label: t('transcript.shortcut.redo'),
      shortcut: isMac ? '⇧⌘Z' : 'Ctrl+Y',
      icon: (
        <svg width="12.5" height="12.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 7v6h-6" />
          <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
        </svg>
      ),
    },
    {
      label: t('transcript.shortcut.copy'),
      shortcut: isMac ? '⌘C' : 'Ctrl+C',
      icon: (
        <svg width="12.5" height="12.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      ),
    },
    {
      label: t('transcript.shortcut.paste'),
      shortcut: isMac ? '⌘V' : 'Ctrl+V',
      icon: (
        <svg width="12.5" height="12.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        </svg>
      ),
    },
  ];

  return (
    <Block
      className="transcript-panel"
      title={t('transcript.title')}
      tools={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Live Stream View Button */}
          <button
            type="button"
            onClick={() => setViewMode('live')}
            title={t('transcript.viewLiveTitle')}
            style={{
              height: 24,
              padding: '0 4px',
              fontSize: 11,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'transparent',
              border: 'none',
              borderRadius: 4,
              color: viewMode === 'live' ? 'var(--tally-preview)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              transition: 'color 0.15s ease',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12h2" />
              <path d="M6 8v8" />
              <path d="M10 4v16" />
              <path d="M14 8v8" />
              <path d="M18 10v4" />
              <path d="M22 12h-2" />
            </svg>
            <span>{t('transcript.live')}</span>
          </button>

          {/* Sessions List Tab Button */}
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'sessions' ? 'live' : 'sessions')}
            title={t('transcript.viewSessionsTitle')}
            style={{
              height: 24,
              padding: '0 4px',
              fontSize: 11,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'transparent',
              border: 'none',
              borderRadius: 4,
              color: viewMode === 'sessions' ? 'var(--tally-preview)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              transition: 'color 0.15s ease',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            <span>{t('transcript.list', { count: sessions.length })}</span>
          </button>

          {/* Edit Mode Toggle */}
          <button
            type="button"
            onClick={toggleEditMode}
            title={viewMode === 'edit' ? t('transcript.doneTitle') : t('transcript.editTitle')}
            style={{
              height: 24,
              padding: '0 4px',
              fontSize: 11,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'transparent',
              border: 'none',
              borderRadius: 4,
              color: viewMode === 'edit' ? 'var(--tally-preview)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              transition: 'color 0.15s ease',
            }}
          >
            {viewMode === 'edit' ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{t('transcript.done')}</span>
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
                <span>{t('transcript.edit')}</span>
              </>
            )}
          </button>

          {/* Tags Drawer Toggle */}
          <button
            type="button"
            onClick={() => setShowTags((prev) => !prev)}
            title={t('transcript.tagsTitle')}
            style={{
              height: 24,
              padding: '0 4px',
              fontSize: 11,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'transparent',
              border: 'none',
              borderRadius: 4,
              color: showTags ? 'var(--tally-preview)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              transition: 'color 0.15s ease',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
            <span>{t('transcript.tags')}</span>
          </button>

          {/* Export Dropdown */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              ref={exportBtnRef}
              type="button"
              onClick={() => setIsExportOpen((prev) => !prev)}
              title={t('transcript.exportTitle')}
              style={{
                height: 24,
                padding: '0 4px',
                fontSize: 11,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'transparent',
                border: 'none',
                borderRadius: 4,
                color: isExportOpen ? 'var(--tally-preview)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
                transition: 'color 0.15s ease',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>{t('transcript.export')}</span>
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                style={{
                  transform: isExportOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s ease',
                  color: isExportOpen ? 'var(--tally-preview)' : 'var(--text-dim)',
                }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {/* Portalled Pro Style Dropdown Menu */}
            {isExportOpen && menuRect && createPortal(
              <div
                ref={exportMenuRef}
                style={{
                  position: 'fixed',
                  top: menuRect.top,
                  left: menuRect.left,
                  transform: menuRect.flip ? 'translateY(-100%)' : undefined,
                  zIndex: 100010,
                  width: menuRect.width,
                  background: 'var(--bg-secondary, #161414)',
                  border: '1px solid var(--border-primary, #262628)',
                  borderRadius: 6,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
                  padding: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  fontFamily: 'var(--font-ui)',
                }}
              >
                {/* Header item */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '6px 10px',
                    background: 'rgba(34, 197, 94, 0.12)',
                    borderRadius: 4,
                    color: 'var(--tally-preview)',
                    fontSize: 11.5,
                    fontWeight: 700,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>{t('transcript.exportTranscript')}</span>
                  </div>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--tally-preview)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>

                {/* Export Options */}
                {exportActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleExport(action.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '6px 10px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 4,
                      color: 'var(--text-primary)',
                      fontSize: 11.5,
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      fontFamily: 'var(--font-ui)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-hover, rgba(255, 255, 255, 0.08))';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}>
                      {action.icon}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {action.label}
                    </span>
                  </button>
                ))}
              </div>,
              document.body
            )}
          </div>

          {/* Open Live Scripture button */}
          <BlockButton icon onClick={onOpenLiveScripture} title={t('transcript.openLive')} style={{ width: 22, height: 22 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </BlockButton>
        </div>
      )}
      flush
      bodyStyle={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}
      footer={(
        <>
          {transcription.isActive ? (
            <button style={styles.stopBtn} onClick={stopTranscription}>
              <span style={styles.stopDot} />
              {t('transcript.stop')}
            </button>
          ) : (
            <button
              style={{ ...styles.startBtn, opacity: enabledProvider ? 1 : 0.6 }}
              onClick={handleStartClick}
              disabled={!enabledProvider}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--tally-preview)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
              <span style={styles.startLabel}>{t('transcript.start')}</span>
            </button>
          )}
          <span
            style={{
              ...styles.recDot,
              background: transcription.isActive ? 'var(--tally-fault)' : 'var(--tally-hold)',
            }}
            title={transcription.isActive ? t('transcript.recording') : t('transcript.idle')}
          />
        </>
      )}
    >
      {/* Feedback Toast Notification */}
      {feedbackNotice && (
        <div style={styles.toast}>
          {feedbackNotice}
        </div>
      )}

      {/* Smart Resume vs. Fresh Session Prompt Dialog */}
      {showResumePrompt && (
        <div style={styles.resumePromptOverlay}>
          <div style={styles.resumePromptCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--tally-preview)', fontWeight: 700, fontSize: 12 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
              <span>{t('transcript.resumePromptTitle')}</span>
            </div>

            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {t('transcript.resumePromptBody', {
                title: activeSession?.title ?? '',
                words: activeSession?.text.trim().split(/\s+/).length ?? 0,
              })}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => executeStart(activeSessionId, true)}
                style={styles.resumePrimaryBtn}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>{t('transcript.resumeAppend', { title: activeSession?.title ?? '' })}</span>
              </button>

              <button
                type="button"
                onClick={() => executeStart(null, false)}
                style={styles.resumeSecondaryBtn}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>{t('transcript.startFresh')}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowResumePrompt(false)}
                style={styles.resumeCancelBtn}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expandable Tags / Metadata Drawer */}
      {showTags && (
        <div style={styles.tagsDrawer}>
          <div style={styles.tagsGrid}>
            <label style={styles.tagLabel}>
              <span style={styles.tagSpan}>{t('transcript.sermonTitle')}</span>
              <input
                type="text"
                style={styles.tagInput}
                value={sermonTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder={t('transcript.placeholder.title')}
              />
            </label>
            <label style={styles.tagLabel}>
              <span style={styles.tagSpan}>{t('transcript.speaker')}</span>
              <input
                type="text"
                style={styles.tagInput}
                value={speaker}
                onChange={(e) => handleSpeakerChange(e.target.value)}
                placeholder={t('transcript.placeholder.speaker')}
              />
            </label>
            <label style={styles.tagLabel}>
              <span style={styles.tagSpan}>{t('transcript.church')}</span>
              <input
                type="text"
                style={styles.tagInput}
                value={churchName}
                onChange={(e) => handleChurchChange(e.target.value)}
                placeholder={t('transcript.placeholder.church')}
              />
            </label>
            <label style={styles.tagLabel}>
              <span style={styles.tagSpan}>{t('transcript.dateTime')}</span>
              <input
                type="text"
                style={styles.tagInput}
                value={dateTime}
                onChange={(e) => handleDateTimeChange(e.target.value)}
                placeholder={t('transcript.placeholder.dateTime')}
              />
            </label>
          </div>
        </div>
      )}

      {/* VIEW 1: SESSIONS LIST VIEW */}
      {viewMode === 'sessions' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 10px', overflow: 'hidden' }}>
          {/* Header & Controls in Sessions View */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 8 }}>
            <input
              type="text"
              placeholder={t('transcript.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />

            {/* Merge Mode Toggle Button */}
            <button
              type="button"
              onClick={() => {
                setIsMergeMode((prev) => !prev);
                setSelectedMergeIds([]);
              }}
              style={{
                ...styles.mergeModeBtn,
                background: isMergeMode ? 'rgba(34, 197, 94, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                borderColor: isMergeMode ? 'var(--tally-preview)' : 'var(--border-primary, rgba(255,255,255,0.12))',
                color: isMergeMode ? 'var(--tally-preview)' : 'var(--text-secondary)',
              }}
              title={t('transcript.mergeTitle')}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 3 21 3 21 8" />
                <line x1="4" y1="20" x2="21" y2="3" />
                <polyline points="21 16 21 21 16 21" />
                <line x1="15" y1="15" x2="21" y2="21" />
                <line x1="4" y1="4" x2="9" y2="9" />
              </svg>
              <span>{isMergeMode ? t('transcript.mergeCancel') : t('transcript.merge')}</span>
            </button>

            <button
              type="button"
              onClick={handleCreateNewSession}
              style={styles.newSessionBtn}
              title={t('transcript.newSessionTitle')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>{t('transcript.new')}</span>
            </button>
          </div>

          {/* Merge Floating Action Header Banner */}
          {isMergeMode && (
            <div style={styles.mergeBanner}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-primary)' }}>
                <span style={{ fontWeight: 600 }}>{selectedMergeIds.length}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{t('transcript.selectedToMerge')}</span>
              </div>
              <button
                type="button"
                disabled={selectedMergeIds.length < 2}
                onClick={handleExecuteMerge}
                style={{
                  ...styles.executeMergeBtn,
                  opacity: selectedMergeIds.length >= 2 ? 1 : 0.45,
                  cursor: selectedMergeIds.length >= 2 ? 'pointer' : 'default',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>
                <span>{t('transcript.mergeSelected', { count: selectedMergeIds.length })}</span>
              </button>
            </div>
          )}

          {/* Scrollable list of transcript sessions */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 2 }}>
            {filteredSessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const isRenaming = editingSessionId === session.id;
              const isConfirmingDelete = sessionToDeleteId === session.id;
              const isLiveRecordingThis = transcription.isActive && session.id === liveSessionIdRef.current;
              const isSelectedForMerge = selectedMergeIds.includes(session.id);
              const wordCount = session.text.trim() ? session.text.trim().split(/\s+/).length : 0;

              return (
                <div
                  key={session.id}
                  onClick={() => handleSelectSession(session)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: isSelectedForMerge
                      ? '1px solid var(--tally-preview)'
                      : isActive
                      ? '1px solid rgba(34, 197, 94, 0.6)'
                      : '1px solid var(--border-primary, rgba(255,255,255,0.08))',
                    background: isSelectedForMerge
                      ? 'rgba(34, 197, 94, 0.12)'
                      : isActive
                      ? 'rgba(34, 197, 94, 0.05)'
                      : 'var(--chrome-control, rgba(255,255,255,0.02))',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    {isRenaming ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={sessionRenameText}
                          onChange={(e) => setSessionRenameText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(session.id);
                            if (e.key === 'Escape') setEditingSessionId(null);
                          }}
                          autoFocus
                          style={styles.renameInput}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRename(session.id)}
                          style={styles.renameSaveBtn}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                        {isMergeMode && (
                          <div
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: 3,
                              border: isSelectedForMerge ? '1px solid var(--tally-preview)' : '1px solid rgba(255,255,255,0.3)',
                              background: isSelectedForMerge ? 'var(--tally-preview)' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {isSelectedForMerge && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                        )}
                        <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? 'var(--tally-preview)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {session.title}
                        </span>
                        {isActive && (
                          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(34, 197, 94, 0.2)', color: 'var(--tally-preview)', fontWeight: 600 }}>
                            ACTIVE
                          </span>
                        )}
                        {isLiveRecordingThis && (
                          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(239, 68, 68, 0.2)', color: 'var(--tally-fault)', fontWeight: 600 }}>
                            {t('transcript.recordingBadge')}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Action buttons on card (hidden in merge mode) */}
                    {!isMergeMode && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => handleStartRename(session, e)}
                          title={t('transcript.rename')}
                          style={styles.cardActionBtn}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteClick(session, e)}
                          title={isLiveRecordingThis ? t('transcript.deleteStopRecording') : t('transcript.delete')}
                          style={{ ...styles.cardActionBtn, color: 'var(--tally-fault, #ef4444)', opacity: isLiveRecordingThis ? 0.35 : 1 }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Inline Delete Confirmation Popover/Banner */}
                  {isConfirmingDelete && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        borderRadius: 4,
                        padding: '4px 8px',
                        gap: 8,
                        marginTop: 2,
                      }}
                    >
                      <span style={{ fontSize: 11, color: '#fca5a5', fontWeight: 600 }}>
                        {t('transcript.deleteConfirm')}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSessionToDeleteId(null);
                          }}
                          style={{
                            padding: '2px 7px',
                            fontSize: 10.5,
                            fontWeight: 500,
                            background: 'transparent',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: 3,
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                          }}
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => confirmDeleteSession(session.id, e)}
                          style={{
                            padding: '2px 8px',
                            fontSize: 10.5,
                            fontWeight: 700,
                            background: 'var(--tally-fault, #ef4444)',
                            border: 'none',
                            borderRadius: 3,
                            color: '#ffffff',
                            cursor: 'pointer',
                          }}
                        >
                          {t('transcript.delete')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Snippet / Metadata */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)' }}>
                    <span>{session.speaker ? `${session.speaker} • ` : ''}{new Date(session.updatedAt || session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span>{t('transcript.wordCount', { count: wordCount })}</span>
                  </div>

                  {session.text && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {session.text}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredSessions.length === 0 && (
              <div style={{ color: 'var(--text-dim)', fontSize: 11, textAlign: 'center', padding: '20px 0' }}>
                {t('transcript.noSearchResults', { query: searchQuery })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: EDIT MODE */}
      {viewMode === 'edit' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '6px 8px', overflow: 'hidden', gap: 6 }}>
          {/* Edit Toolbar with Undo, Redo, Copy */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {/* Undo Button */}
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                title={isMac ? t('transcript.undoTitleMac') : t('transcript.undoTitleWin')}
                style={{
                  ...styles.editToolBtn,
                  opacity: canUndo ? 1 : 0.4,
                  cursor: canUndo ? 'pointer' : 'default',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7v6h6" />
                  <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                </svg>
                <span>{t('transcript.shortcut.undo')}</span>
              </button>

              {/* Redo Button */}
              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                title={isMac ? t('transcript.redoTitleMac') : t('transcript.redoTitleWin')}
                style={{
                  ...styles.editToolBtn,
                  opacity: canRedo ? 1 : 0.4,
                  cursor: canRedo ? 'pointer' : 'default',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 7v6h-6" />
                  <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
                </svg>
                <span>{t('transcript.shortcut.redo')}</span>
              </button>

              {/* Copy Current Edit Text Button with Animated Checkmark */}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(editText);
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 1800);
                }}
                title={isMac ? t('transcript.copyTitleMac') : t('transcript.copyTitleWin')}
                style={{
                  ...styles.editToolBtn,
                  color: isCopied ? 'var(--tally-preview)' : 'var(--text-primary)',
                  transition: 'all 0.15s ease',
                }}
              >
                {isCopied ? (
                  <>
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--tally-preview)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ animation: 'checkmarkPop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span style={{ color: 'var(--tally-preview)' }}>{t('transcript.copied')}</span>
                  </>
                ) : (
                  <>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    <span>{t('transcript.shortcut.copy')}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div style={{ flex: 1, position: 'relative', display: 'flex', minHeight: 0 }}>
            <textarea
              ref={textareaRef}
              style={styles.editTextarea}
              value={editText}
              onChange={handleTextChange}
              onKeyDown={handleTextareaKeyDown}
              placeholder=""
              autoFocus
            />
            {!editText.trim() && (
              <div
                onClick={() => textareaRef.current?.focus()}
                style={styles.editEmptyOverlay}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Type or edit transcript text here
                </div>
                <div style={styles.chessGrid}>
                  {shortcutCards.map((item) => (
                    <div key={item.label} style={styles.chessCard}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', color: 'var(--tally-preview)' }}>
                          {item.icon}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {item.label}
                        </span>
                      </div>
                      <kbd style={styles.kbd}>{item.shortcut}</kbd>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: LIVE TRANSCRIPT VIEW */}
      {viewMode === 'live' && (
        <div
          ref={scrollRef}
          className="transcript-panel__scroll"
          onWheel={onUserScroll}
          onTouchMove={onUserScroll}
        >
          {activeSessionId === liveSessionIdRef.current && transcription.isActive ? (
            <p className="transcript-panel__flow">
              {transcription.text}
              {transcription.interimText && (
                <>
                  {transcription.text ? ' ' : ''}
                  <span className="transcript-panel__interim">{transcription.interimText}</span>
                </>
              )}
              <span className="transcript-cursor" aria-hidden="true">
                <i /><i /><i />
              </span>
            </p>
          ) : (activeSession?.text || (activeSessionId === liveSessionIdRef.current && transcription.text)) ? (
            <p className="transcript-panel__flow">
              {activeSession?.text || transcription.text}
            </p>
          ) : (
            <p className="transcript-panel__idle">
              {transcription.isActive ? t('transcript.listening') : t('transcript.empty')}
            </p>
          )}
        </div>
      )}
    </Block>
  );
}

const styles: Record<string, React.CSSProperties> = {
  startBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 10px',
    background: 'transparent',
    border: '1px solid var(--block-line)',
    borderRadius: 6,
    cursor: 'pointer',
  },
  startLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  recDot: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    flexShrink: 0,
    border: '1px solid var(--block-line)',
    boxShadow: 'inset 0 0 0 5px var(--block-active)',
  },
  stopBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 10px',
    background: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: 6,
    color: 'var(--tally-fault)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  stopDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--tally-fault)',
  },
  toast: {
    position: 'absolute',
    top: 8,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
    background: 'var(--bg-elevated, #24272e)',
    color: 'var(--text-primary, #ffffff)',
    border: '1px solid var(--tally-preview)',
    borderRadius: 4,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 600,
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    pointerEvents: 'none',
    fontFamily: 'var(--font-ui)',
  },
  resumePromptOverlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 20,
    background: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    fontFamily: 'var(--font-ui)',
  },
  resumePromptCard: {
    width: '100%',
    maxWidth: 320,
    background: 'var(--bg-secondary, #1a1a1c)',
    border: '1px solid var(--border-primary, rgba(255,255,255,0.15))',
    borderRadius: 8,
    padding: '12px 14px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  resumePrimaryBtn: {
    padding: '7px 10px',
    fontSize: 11.5,
    fontWeight: 700,
    borderRadius: 5,
    background: 'var(--tally-preview, #22c55e)',
    border: 'none',
    color: '#000000',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    textAlign: 'center',
  },
  resumeSecondaryBtn: {
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 5,
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    textAlign: 'center',
  },
  resumeCancelBtn: {
    padding: '4px 10px',
    fontSize: 10.5,
    fontWeight: 500,
    background: 'transparent',
    border: 'none',
    color: 'var(--text-dim)',
    cursor: 'pointer',
    textAlign: 'center',
  },
  tagsDrawer: {
    padding: '8px 10px',
    background: 'rgba(34, 197, 94, 0.03)',
    borderBottom: '1px solid rgba(34, 197, 94, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flexShrink: 0,
  },
  tagsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 6,
  },
  tagLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  tagSpan: {
    fontSize: 9.5,
    fontWeight: 600,
    color: 'var(--tally-preview)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'var(--font-ui)',
  },
  tagInput: {
    height: 24,
    padding: '0 6px',
    fontSize: 11,
    borderRadius: 4,
    border: '1px solid var(--border-primary, rgba(255,255,255,0.12))',
    background: 'var(--bg-surface, #1e1e1e)',
    color: 'var(--text-primary, #ffffff)',
    outline: 'none',
    fontFamily: 'var(--font-ui)',
    transition: 'border-color 0.15s ease',
  },
  editToolBtn: {
    height: 20,
    padding: '0 6px',
    fontSize: 10.5,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    background: 'transparent',
    border: 'none',
    borderRadius: 3,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-ui)',
    transition: 'all 0.15s ease',
  },
  editTextarea: {
    flex: 1,
    width: '100%',
    padding: 8,
    borderRadius: 4,
    border: '1px solid var(--border-primary, rgba(255,255,255,0.15))',
    background: 'var(--bg-surface, #181818)',
    color: 'var(--text-primary, #ffffff)',
    fontSize: 12,
    lineHeight: 1.45,
    fontFamily: 'var(--font-ui)',
    resize: 'none',
    outline: 'none',
  },
  searchInput: {
    flex: 1,
    height: 24,
    padding: '0 8px',
    fontSize: 11,
    borderRadius: 4,
    border: '1px solid var(--border-primary, rgba(255,255,255,0.12))',
    background: 'var(--bg-surface, #1e1e1e)',
    color: 'var(--text-primary, #ffffff)',
    outline: 'none',
    fontFamily: 'var(--font-ui)',
  },
  mergeModeBtn: {
    height: 24,
    padding: '0 7px',
    fontSize: 11,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    border: '1px solid',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
    transition: 'all 0.15s ease',
  },
  mergeBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(34, 197, 94, 0.08)',
    border: '1px solid rgba(34, 197, 94, 0.25)',
    borderRadius: 5,
    padding: '4px 8px',
    marginBottom: 6,
  },
  executeMergeBtn: {
    height: 22,
    padding: '0 8px',
    fontSize: 10.5,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: 'var(--tally-preview, #22c55e)',
    border: 'none',
    borderRadius: 4,
    color: '#000000',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
  },
  newSessionBtn: {
    height: 24,
    padding: '0 8px',
    fontSize: 11,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: 'rgba(34, 197, 94, 0.12)',
    border: '1px solid var(--tally-preview)',
    borderRadius: 4,
    color: 'var(--tally-preview)',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
  },
  cardActionBtn: {
    width: 22,
    height: 22,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    borderRadius: 3,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  renameInput: {
    flex: 1,
    height: 22,
    padding: '0 6px',
    fontSize: 11,
    borderRadius: 3,
    border: '1px solid var(--tally-preview)',
    background: 'var(--bg-surface, #141414)',
    color: 'var(--text-primary)',
    outline: 'none',
  },
  renameSaveBtn: {
    height: 22,
    padding: '0 6px',
    fontSize: 10,
    fontWeight: 700,
    borderRadius: 3,
    background: 'var(--tally-preview)',
    border: 'none',
    color: '#000000',
    cursor: 'pointer',
  },
  editEmptyOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    gap: 10,
    padding: 16,
    textAlign: 'center',
    userSelect: 'none',
  },
  chessGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(130px, 155px))',
    gap: 8,
    marginTop: 4,
  },
  chessCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '6px 10px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    borderRadius: 6,
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
  },
  kbd: {
    padding: '2px 6px',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 700,
    fontFamily: 'var(--font-mono, monospace)',
    color: 'var(--text-primary)',
    letterSpacing: 0.2,
  },
};
