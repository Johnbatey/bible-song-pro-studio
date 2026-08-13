import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import type { SlideElement, Song, BibleVerse } from '../../types';

export type ActiveTool =
  | 'select'
  | 'text'
  | 'box'
  | 'rectangle'
  | 'rounded'
  | 'circle'
  | 'triangle'
  | 'star'
  | 'line'
  | 'image'
  | 'pencil'
  | 'bezier'
  | 'eraser';

export interface PptxToolbarActions {
  canGroup: boolean;
  canUngroup: boolean;
  hasSelection: boolean;
  onGroup: () => void;
  onUngroup: () => void;
  onReorder: (toFront: boolean) => void;
  onDelete: () => void;
}

interface SlideEditorQuickToolbarProps {
  activeTool: ActiveTool;
  onSelectTool: (tool: ActiveTool) => void;
  smartSnap: boolean;
  onToggleSmartSnap: () => void;
  selectedElementId?: string | null;
  onUpdateElement?: (id: string, updates: Partial<SlideElement>) => void;
  pptx?: PptxToolbarActions | null;
  onAddElements?: (elements: SlideElement[]) => void;
}

export function SlideEditorQuickToolbar({
  activeTool,
  onSelectTool,
  smartSnap,
  onToggleSmartSnap,
  selectedElementId,
  onUpdateElement,
  pptx = null,
  onAddElements,
}: SlideEditorQuickToolbarProps) {
  const songs = useAppStore((s) => s.songs);

  /* Popover dropdown states */
  const [activeDropdown, setActiveDropdown] = useState<'shapes' | 'image' | 'scripture' | 'song' | null>(null);

  /* Scripture Tool states */
  const [bibleVersion, setBibleVersion] = useState('KJV');
  const [scriptureQuery, setScriptureQuery] = useState('Genesis 1:1');
  const [scriptureVerses, setScriptureVerses] = useState<BibleVerse[]>([]);
  const [scriptureLoading, setScriptureLoading] = useState(false);
  const [verseColor, setVerseColor] = useState('#ffffff');
  const [refColor, setRefColor] = useState('#FF5500');

  /* Song Tool states */
  const [songQuery, setSongQuery] = useState('');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [selectedSection, setSelectedSection] = useState<string>('Chorus');
  const [showSectionDetail, setShowSectionDetail] = useState(false);
  const [lyricsColor, setLyricsColor] = useState('#ffffff');

  /* Trigger Scripture search */
  async function searchScripture(query: string, version: string = bibleVersion) {
    setScriptureQuery(query);
    if (!query.trim()) {
      setScriptureVerses([]);
      return;
    }
    setScriptureLoading(true);
    if (window.BSP?.bible) {
      const res = await window.BSP.bible.search({ versionId: version, query: query.trim(), limit: 20 }).catch(() => []);
      setScriptureVerses(res);
    } else {
      /* Fallback sample verses matching screenshot */
      const samples: BibleVerse[] = [
        {
          book: 'Genesis',
          chapter: 1,
          verse: 1,
          reference: 'Genesis 1:1',
          text: 'In the beginning God created the heaven and the earth.',
          version,
        },
        {
          book: 'Genesis',
          chapter: 1,
          verse: 2,
          reference: 'Genesis 1:2',
          text: 'And the earth was without form, and void; and darkness was upon the face of the deep.',
          version,
        },
        {
          book: 'Genesis',
          chapter: 1,
          verse: 3,
          reference: 'Genesis 1:3',
          text: 'And God said, Let there be light: and there was light.',
          version,
        },
        {
          book: 'Genesis',
          chapter: 1,
          verse: 4,
          reference: 'Genesis 1:4',
          text: 'And God saw the light, that it was good: and God divided the light from the darkness.',
          version,
        },
        {
          book: 'Genesis',
          chapter: 1,
          verse: 5,
          reference: 'Genesis 1:5',
          text: 'And God called the light Day, and the darkness he called Night.',
          version,
        },
        {
          book: 'Genesis',
          chapter: 1,
          verse: 6,
          reference: 'Genesis 1:6',
          text: 'And God said, Let there be a firmament in the midst of the waters.',
          version,
        },
      ];
      setScriptureVerses(samples);
    }
    setScriptureLoading(false);
  }

  useEffect(() => {
    if (activeDropdown === 'scripture' && scriptureVerses.length === 0) {
      searchScripture('Genesis 1:1', bibleVersion);
    }
  }, [activeDropdown]);

  /* Direct 1-Click Scripture Insertion or Layer Update */
  function handleSelectVerse(verse: BibleVerse) {
    if (selectedElementId && onUpdateElement) {
      /* Update currently selected text element on canvas */
      onUpdateElement(selectedElementId, {
        content: `"${verse.text}"\n\n— ${verse.reference} (${verse.version || bibleVersion})`,
        color: verseColor,
      });
    } else if (onAddElements) {
      /* Create new Scripture elements */
      const verseEl: SlideElement = {
        id: `text-${Date.now()}-verse`,
        type: 'text',
        content: `"${verse.text}"`,
        x: 10,
        y: 25,
        width: 80,
        height: 40,
        fontSize: 34,
        color: verseColor,
        fontWeight: 700,
        textAlign: 'center',
      };
      const refEl: SlideElement = {
        id: `text-${Date.now()}-ref`,
        type: 'text',
        content: `${verse.reference} (${verse.version || bibleVersion})`,
        x: 25,
        y: 70,
        width: 50,
        height: 12,
        fontSize: 24,
        color: refColor,
        fontWeight: 700,
        textAlign: 'center',
      };
      onAddElements([verseEl, refEl]);
    }
    setActiveDropdown(null);
  }

  /* Insert Song Lyrics onto Canvas */
  function handleInsertSongSection(song: Song, sectionLabel?: string) {
    if (!onAddElements) return;
    let textToInsert = '';
    const label = sectionLabel || selectedSection;

    if (!song.slides || song.slides.length === 0) {
      textToInsert = song.title;
    } else if (label === 'All') {
      textToInsert = song.slides.map((s) => s.text).join('\n\n');
    } else {
      const match = song.slides.find((s) => s.label.toLowerCase().includes(label.toLowerCase()));
      textToInsert = match ? match.text : song.slides.map((s) => s.text).join('\n\n');
    }

    const lyricsEl: SlideElement = {
      id: `text-${Date.now()}-lyrics`,
      type: 'text',
      content: textToInsert || song.title,
      x: 10,
      y: 25,
      width: 80,
      height: 50,
      fontSize: 34,
      color: lyricsColor,
      fontWeight: 700,
      textAlign: 'center',
    };
    onAddElements([lyricsEl]);
    setActiveDropdown(null);
    setShowSectionDetail(false);
  }

  /* Filter songs for song tool */
  const filteredSongs = songs.filter(
    (s) => s.title.toLowerCase().includes(songQuery.toLowerCase()) || s.author?.toLowerCase().includes(songQuery.toLowerCase()),
  );

  /* Movable / Draggable Toolbar State */
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
  const dragStartRef = React.useRef<{ x: number; y: number; initialX: number; initialY: number }>({ x: 0, y: 0, initialX: 0, initialY: 0 });

  const handlePointerDownHeader = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDraggingToolbar(true);
    const currentX = toolbarPos ? toolbarPos.x : window.innerWidth / 2;
    const currentY = toolbarPos ? toolbarPos.y : 54;
    dragStartRef.current = { x: e.clientX, y: e.clientY, initialX: currentX, initialY: currentY };
  };

  useEffect(() => {
    if (!isDraggingToolbar) return;
    const onPointerMove = (e: PointerEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setToolbarPos({
        x: dragStartRef.current.initialX + dx,
        y: Math.max(10, dragStartRef.current.initialY + dy),
      });
    };
    const onPointerUp = () => setIsDraggingToolbar(false);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [isDraggingToolbar]);

  const isShapeActive = ['box', 'rectangle', 'rounded', 'circle', 'triangle', 'star', 'line'].includes(activeTool);

  return (
    <div
      style={{
        ...CONTAINER,
        ...(toolbarPos
          ? { left: toolbarPos.x, top: toolbarPos.y, transform: 'translateX(-50%)' }
          : { top: 54 }),
      }}
    >
      {/* Unified Toolbar Card Block (Matching Reference Image 2) */}
      <div style={TOOLBAR_CARD}>
        {/* Integrated Top Drag Handle & Label */}
        <div
          onPointerDown={handlePointerDownHeader}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: isDraggingToolbar ? 'grabbing' : 'grab',
            paddingBottom: 6,
            width: '100%',
          }}
          title="Drag to move toolbar"
        >
          <div style={{ width: 28, height: 3, background: 'rgba(255, 255, 255, 0.25)', borderRadius: 2, marginBottom: 3 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255, 255, 255, 0.55)', letterSpacing: '0.01em' }}>Add content</span>
        </div>

        {/* Floating Toolbar Buttons Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* 1. Text Tool */}
          <button
            type="button"
            onClick={() => {
              onSelectTool('text');
              setActiveDropdown(null);
            }}
            style={activeTool === 'text' ? PILL_BTN_ACTIVE : PILL_BTN}
            title="Add Text Box"
          >
            <svg viewBox="0 0 24 24" style={ICON}>
              <path d="M4 7V4h16v3M9 20h6M12 4v16" />
            </svg>
            <span>Text</span>
          </button>

          {/* 2. Bible Tool Button (Proper SVG Bible Icon) */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'scripture' ? null : 'scripture')}
              style={activeDropdown === 'scripture' ? PILL_BTN_ACTIVE : PILL_BTN}
              title="Bible Tool"
            >
              <svg viewBox="0 0 24 24" style={ICON}>
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <path d="M12 6v6M9 9h6" />
              </svg>
              <span>Bible</span>
            </button>

            {/* Scripture Popover */}
            {activeDropdown === 'scripture' && (
              <div style={{ ...POPOVER_SHELL, width: 380 }}>
                {/* Top Row: Version Dropdown & Reference Input */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    value={bibleVersion}
                    onChange={(e) => {
                      setBibleVersion(e.target.value);
                      searchScripture(scriptureQuery, e.target.value);
                    }}
                    style={{
                      padding: '8px 10px',
                      background: '#1a1a1c',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 6,
                      color: '#ffffff',
                      fontSize: 13,
                      fontWeight: 700,
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="KJV">KJV</option>
                    <option value="ASV">ASV</option>
                    <option value="Darby">Darby</option>
                    <option value="YLT">YLT</option>
                    <option value="LSG">LSG</option>
                  </select>

                  <input
                    type="text"
                    value={scriptureQuery}
                    onChange={(e) => searchScripture(e.target.value)}
                    placeholder="Genesis 1:1, John 3:16..."
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      background: '#1a1a1c',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 6,
                      color: '#ffffff',
                      fontSize: 13,
                      fontWeight: 600,
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Verses List Header */}
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.5)', marginTop: 10, letterSpacing: '0.05em' }}>
                  {scriptureQuery.toUpperCase() || 'SEARCH RESULTS'}
                </div>

                {/* Verses Selection list */}
                <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, paddingRight: 4 }}>
                  {scriptureLoading ? (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', padding: 12, textAlign: 'center' }}>Searching Bible...</div>
                  ) : scriptureVerses.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', padding: 12, textAlign: 'center' }}>No verses found</div>
                  ) : (
                    scriptureVerses.map((v) => (
                      <button
                        key={`${v.book}-${v.chapter}-${v.verse}`}
                        type="button"
                        onClick={() => handleSelectVerse(v)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 6,
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          color: '#ffffff',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          gap: 10,
                          alignItems: 'flex-start',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(244, 98, 31, 0.15)';
                          e.currentTarget.style.borderColor = 'rgba(244, 98, 31, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#FF5500', marginTop: 1, minWidth: 16 }}>{v.verse}</span>
                        <span style={{ fontSize: 13, color: '#ffffff', lineHeight: 1.4, flex: 1 }}>{v.text}</span>
                      </button>
                    ))
                  )}
                </div>

                {/* Color Customizers Footer */}
                <div style={{ display: 'flex', gap: 12, marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10 }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="color" value={verseColor} onChange={(e) => setVerseColor(e.target.value)} style={COLOR_DOT} />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Verse Color</span>
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="color" value={refColor} onChange={(e) => setRefColor(e.target.value)} style={COLOR_DOT} />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Ref Color</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. Shape Tool Dropdown (Clean Row List matching Reference Image 2) */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'shapes' ? null : 'shapes')}
              style={isShapeActive || activeDropdown === 'shapes' ? PILL_BTN_ACTIVE : PILL_BTN}
              title="Insert Shapes"
            >
              <svg viewBox="0 0 24 24" style={ICON}>
                <rect x="3" y="3" width="18" height="18" rx="4" />
              </svg>
              <span>Shape</span>
              <span style={{ fontSize: 9, opacity: 0.7 }}>▼</span>
            </button>

            {activeDropdown === 'shapes' && (
              <div style={{ ...POPOVER_SHELL, width: 170, padding: 6, gap: 2 }}>
                {/* 1. Rectangle */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectTool('rectangle');
                    setActiveDropdown(null);
                  }}
                  style={DROPDOWN_ITEM_CLEAN}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg viewBox="0 0 24 24" style={ICON}>
                    <rect x="4" y="4" width="16" height="16" rx="0" />
                  </svg>
                  <span>Rectangle</span>
                </button>

                {/* 2. Rounded */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectTool('rounded');
                    setActiveDropdown(null);
                  }}
                  style={DROPDOWN_ITEM_CLEAN}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg viewBox="0 0 24 24" style={ICON}>
                    <rect x="4" y="4" width="16" height="16" rx="5" />
                  </svg>
                  <span>Rounded</span>
                </button>

                {/* 3. Circle */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectTool('circle');
                    setActiveDropdown(null);
                  }}
                  style={DROPDOWN_ITEM_CLEAN}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg viewBox="0 0 24 24" style={ICON}>
                    <circle cx="12" cy="12" r="8" />
                  </svg>
                  <span>Circle</span>
                </button>

                {/* 4. Triangle */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectTool('triangle');
                    setActiveDropdown(null);
                  }}
                  style={DROPDOWN_ITEM_CLEAN}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg viewBox="0 0 24 24" style={ICON}>
                    <polygon points="12,4 4,20 20,20" />
                  </svg>
                  <span>Triangle</span>
                </button>

                {/* 5. Star */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectTool('star');
                    setActiveDropdown(null);
                  }}
                  style={DROPDOWN_ITEM_CLEAN}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg viewBox="0 0 24 24" style={ICON}>
                    <polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9" />
                  </svg>
                  <span>Star</span>
                </button>

                {/* 6. Line */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectTool('line');
                    setActiveDropdown(null);
                  }}
                  style={DROPDOWN_ITEM_CLEAN}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg viewBox="0 0 24 24" style={ICON}>
                    <line x1="4" y1="12" x2="20" y2="12" strokeWidth="2.5" />
                  </svg>
                  <span>Line</span>
                </button>
              </div>
            )}
          </div>

          {/* 4. Image Tool (Triggers File Picker Upload) */}
          <button
            type="button"
            onClick={() => {
              onSelectTool('image');
              setActiveDropdown(null);
            }}
            style={activeTool === 'image' ? PILL_BTN_ACTIVE : PILL_BTN}
            title="Upload / Add Image Asset"
          >
            <svg viewBox="0 0 24 24" style={ICON}>
              <rect x="3" y="3" width="18" height="18" rx="3.5" />
              <circle cx="9" cy="9" r="2" />
              <path d="M21 15l-3.086-3.086a2 2 0 00-2.828 0L6 21" />
            </svg>
            <span>Image</span>
          </button>

        {/* 5. Song Tool Button (Worship Songs with 2nd-level Section Selector) */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => {
              setActiveDropdown(activeDropdown === 'song' ? null : 'song');
              setShowSectionDetail(false);
            }}
            style={activeDropdown === 'song' ? PILL_BTN_ACTIVE : PILL_BTN}
            title="Song Tool"
          >
            <svg viewBox="0 0 24 24" style={ICON}>
              <path d="M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12 0a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Song</span>
            <span style={{ fontSize: 9, opacity: 0.7 }}>▼</span>
          </button>

          {activeDropdown === 'song' && (
            <div style={{ ...POPOVER_SHELL, width: 360 }}>
              {!showSectionDetail || !selectedSong ? (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>🎵 Worship Song Library</div>
                  <input
                    type="text"
                    value={songQuery}
                    onChange={(e) => setSongQuery(e.target.value)}
                    placeholder="Search songs in library..."
                    style={{
                      padding: '8px 12px',
                      background: '#1a1a1c',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 6,
                      color: '#ffffff',
                      fontSize: 13,
                      outline: 'none',
                      marginTop: 6,
                    }}
                  />
                  <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                    {filteredSongs.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', padding: 12, textAlign: 'center' }}>No songs found</div>
                    ) : (
                      filteredSongs.slice(0, 10).map((s) => (
                        <div
                          key={s.id}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 6,
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div
                            onClick={() => handleInsertSongSection(s, 'All')}
                            style={{ cursor: 'pointer', flex: 1 }}
                          >
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>{s.title}</div>
                            {s.author && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{s.author}</div>}
                          </div>

                          {/* Arrow > button opening 2nd level section window */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSong(s);
                              setShowSectionDetail(true);
                            }}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              border: 'none',
                              background: 'rgba(255, 255, 255, 0.08)',
                              color: '#ffffff',
                              fontSize: 16,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title="Browse Sections & Lyrics"
                          >
                            ›
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                /* 2nd Level Section Browser Window */
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8 }}>
                    <button
                      type="button"
                      onClick={() => setShowSectionDetail(false)}
                      style={{ background: 'none', border: 'none', color: '#FF5500', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}
                    >
                      ‹ Back
                    </button>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedSong.title}
                    </div>
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>Select Song Section to Insert:</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {['Chorus', 'Verse 1', 'Verse 2', 'Bridge', 'Tag', 'All'].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => handleInsertSongSection(selectedSong, sec)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: 'none',
                          background: selectedSection === sec ? '#FF5500' : 'rgba(255, 255, 255, 0.08)',
                          color: '#ffffff',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {sec}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div style={DIVIDER} />

        {/* 6. Smart Snap Toggle */}
        <button
          type="button"
          onClick={onToggleSmartSnap}
          style={smartSnap ? PILL_BTN_ACTIVE : PILL_BTN}
          title="Toggle Smart Alignment Snapping"
        >
          <svg viewBox="0 0 24 24" style={ICON}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v10M7 12h10" />
          </svg>
        </button>

        {/* 7. Delete Layer Button */}
        {pptx && (
          <button
            type="button"
            onClick={pptx.onDelete}
            disabled={!pptx.hasSelection}
            style={pptx.hasSelection ? DANGER_BTN : DISABLED_BTN}
            title="Delete Selected Layer"
          >
            <svg viewBox="0 0 24 24" style={ICON}>
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  </div>
  );
}

/* CSS Styles matching Reference UI (Screenshots 3, 4, 5) */
const CONTAINER: React.CSSProperties = {
  position: 'absolute',
  top: 14,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 50,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  userSelect: 'none',
};

const TOOLBAR_CARD: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '4px 8px 6px',
  background: 'rgba(20, 20, 22, 0.95)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 6,
  boxShadow: '0 16px 40px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(20px)',
};

const HEADER_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: 'rgba(255, 255, 255, 0.45)',
  letterSpacing: '0.02em',
  marginBottom: 3,
};

const TOOLBAR_PILL: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  padding: '3px 6px',
  background: 'rgba(20, 20, 22, 0.92)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 6,
  boxShadow: '0 16px 40px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(16px)',
};

const PILL_BTN: React.CSSProperties = {
  height: 28,
  padding: '0 9px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 6,
  color: 'rgba(255, 255, 255, 0.9)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

const PILL_BTN_ACTIVE: React.CSSProperties = {
  ...PILL_BTN,
  background: 'rgba(255, 255, 255, 0.15)',
  borderColor: 'rgba(255, 255, 255, 0.3)',
  color: '#ffffff',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
};

const DANGER_BTN: React.CSSProperties = {
  ...PILL_BTN,
  background: 'rgba(239, 68, 68, 0.15)',
  borderColor: 'rgba(239, 68, 68, 0.3)',
  color: '#f87171',
};

const DISABLED_BTN: React.CSSProperties = {
  ...PILL_BTN,
  opacity: 0.3,
  cursor: 'default',
};

const DIVIDER: React.CSSProperties = {
  width: 1,
  height: 16,
  background: 'rgba(255, 255, 255, 0.12)',
  margin: '0 2px',
};

const ICON: React.CSSProperties = {
  width: 13,
  height: 13,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const POPOVER_SHELL: React.CSSProperties = {
  position: 'absolute',
  top: 36,
  left: '50%',
  transform: 'translateX(-50%)',
  background: '#161618',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: 6,
  padding: 10,
  boxShadow: '0 24px 48px rgba(0, 0, 0, 0.85)',
  backdropFilter: 'blur(20px)',
  zIndex: 100,
  display: 'flex',
  flexDirection: 'column',
};

const DROPDOWN_ITEM: React.CSSProperties = {
  padding: '10px 12px',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 6,
  color: '#ffffff',
  fontSize: 13,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
};

const DROPDOWN_ITEM_CLEAN: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: 'transparent',
  border: 'none',
  borderRadius: 6,
  color: '#ffffff',
  fontSize: 13,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background 0.12s ease',
};

const COLOR_DOT: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  background: 'none',
};
