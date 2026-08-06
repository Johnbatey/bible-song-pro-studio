import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import type { SlideElement, Song, BibleVerse } from '../../types';

export type ActiveTool = 'select' | 'text' | 'box' | 'circle' | 'image' | 'pencil' | 'bezier' | 'eraser';

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
  pptx?: PptxToolbarActions | null;
  onAddElements?: (elements: SlideElement[]) => void;
}

export function SlideEditorQuickToolbar({
  activeTool,
  onSelectTool,
  smartSnap,
  onToggleSmartSnap,
  pptx = null,
  onAddElements,
}: SlideEditorQuickToolbarProps) {
  const songs = useAppStore((s) => s.songs);

  /* Popover dropdown states */
  const [activeDropdown, setActiveDropdown] = useState<'shapes' | 'draw' | 'scripture' | 'song' | null>(null);

  /* Scripture Tool states */
  const [scriptureQuery, setScriptureQuery] = useState('John 3:16');
  const [scriptureVerses, setScriptureVerses] = useState<BibleVerse[]>([]);
  const [selectedVerse, setSelectedVerse] = useState<BibleVerse | null>(null);
  const [verseColor, setVerseColor] = useState('#ffffff');
  const [refColor, setRefColor] = useState('#f4621f');
  const [scriptureLoading, setScriptureLoading] = useState(false);

  /* Song Tool states */
  const [songQuery, setSongQuery] = useState('');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [selectedSection, setSelectedSection] = useState<string>('Chorus');
  const [lyricsColor, setLyricsColor] = useState('#ffffff');

  /* Trigger Scripture search */
  async function searchScripture(query: string) {
    setScriptureQuery(query);
    if (!query.trim()) { setScriptureVerses([]); return; }
    setScriptureLoading(true);
    if (window.BSP?.bible) {
      const res = await window.BSP.bible.search({ versionId: 'KJV', query: query.trim(), limit: 15 }).catch(() => []);
      setScriptureVerses(res);
      if (res.length > 0) setSelectedVerse(res[0]);
    } else {
      /* Fallback sample verse */
      const sample: BibleVerse = {
        book: 'John',
        chapter: 3,
        verse: 16,
        reference: 'John 3:16',
        text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
        version: 'KJV',
      };
      setScriptureVerses([sample]);
      setSelectedVerse(sample);
    }
    setScriptureLoading(false);
  }

  /* Insert Scripture Elements onto Canvas */
  function handleInsertScripture() {
    if (!selectedVerse || !onAddElements) return;
    const verseEl: SlideElement = {
      id: `text-${Date.now()}-verse`,
      type: 'text',
      content: `"${selectedVerse.text}"`,
      x: 140,
      y: 220,
      width: 1000,
      height: 220,
      fontSize: 34,
      color: verseColor,
      fontWeight: 700,
      textAlign: 'center',
    };
    const refEl: SlideElement = {
      id: `text-${Date.now()}-ref`,
      type: 'text',
      content: `${selectedVerse.reference} (${selectedVerse.version || 'KJV'})`,
      x: 340,
      y: 470,
      width: 600,
      height: 60,
      fontSize: 24,
      color: refColor,
      fontWeight: 700,
      textAlign: 'center',
    };
    onAddElements([verseEl, refEl]);
    setActiveDropdown(null);
  }

  /* Insert Song Lyrics onto Canvas */
  function handleInsertSong() {
    if (!selectedSong || !onAddElements) return;
    let textToInsert = '';
    if (!selectedSong.slides || selectedSong.slides.length === 0) {
      textToInsert = selectedSong.title;
    } else if (selectedSection === 'All') {
      textToInsert = selectedSong.slides.map((s) => s.text).join('\n\n');
    } else {
      const match = selectedSong.slides.find((s) => s.label.toLowerCase().includes(selectedSection.toLowerCase()));
      textToInsert = match ? match.text : selectedSong.slides.map((s) => s.text).join('\n\n');
    }

    const lyricsEl: SlideElement = {
      id: `text-${Date.now()}-lyrics`,
      type: 'text',
      content: textToInsert || selectedSong.title,
      x: 140,
      y: 220,
      width: 1000,
      height: 380,
      fontSize: 32,
      color: lyricsColor,
      fontWeight: 700,
      textAlign: 'center',
    };
    onAddElements([lyricsEl]);
    setActiveDropdown(null);
  }

  /* Filter songs for song tool */
  const filteredSongs = songs.filter(
    (s) => s.title.toLowerCase().includes(songQuery.toLowerCase()) || s.author?.toLowerCase().includes(songQuery.toLowerCase()),
  );

  const renderToolButton = (id: ActiveTool, title: string, icon: React.ReactNode) => {
    const isActive = activeTool === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => {
          onSelectTool(id);
          setActiveDropdown(null);
        }}
        style={{
          width: 34,
          height: 34,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isActive ? 'var(--accent, #f4621f)' : 'transparent',
          border: 'none',
          borderRadius: 8,
          color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
          cursor: 'pointer',
          boxShadow: isActive ? '0 2px 8px rgba(255, 85, 0, 0.4)' : undefined,
          transition: 'all 0.15s ease',
        }}
        title={title}
      >
        {icon}
      </button>
    );
  };

  const renderActionButton = (b: { id: string; title: string; enabled: boolean; danger?: boolean; onClick: () => void; icon: React.ReactNode }) => (
    <button
      key={b.id}
      type="button"
      onClick={b.enabled ? b.onClick : undefined}
      disabled={!b.enabled}
      style={{
        width: 34,
        height: 34,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        borderRadius: 8,
        color: !b.enabled
          ? 'rgba(255, 255, 255, 0.22)'
          : b.danger
          ? '#f87171'
          : 'rgba(255, 255, 255, 0.75)',
        cursor: b.enabled ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
      }}
      title={b.title}
    >
      {b.icon}
    </button>
  );

  const isShapeActive = activeTool === 'box' || activeTool === 'circle';
  const isDrawActive = activeTool === 'pencil' || activeTool === 'bezier' || activeTool === 'eraser';

  return (
    <div style={SHELL}>
      {/* 1. Selection Tool (Standalone) */}
      {renderToolButton('select', 'Selection Tool', (
        <svg viewBox="0 0 24 24" style={ICON}>
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
          <path d="M13 13l6 6" />
        </svg>
      ))}

      <div style={DIVIDER} />

      {/* 2. Text Tool (Standalone) */}
      {renderToolButton('text', 'Add Text Box', (
        <svg viewBox="0 0 24 24" style={ICON}>
          <path d="M4 7V4h16v3M9 20h6M12 4v16" />
        </svg>
      ))}

      {/* 3. Shapes Dropdown Group (Box / Circle) */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setActiveDropdown(activeDropdown === 'shapes' ? null : 'shapes')}
          style={{
            height: 34,
            padding: '0 6px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            background: isShapeActive || activeDropdown === 'shapes' ? 'rgba(244, 98, 31, 0.25)' : 'transparent',
            border: isShapeActive ? '1px solid #f4621f' : '1px solid transparent',
            borderRadius: 8,
            color: isShapeActive ? '#f4621f' : 'rgba(255, 255, 255, 0.75)',
            cursor: 'pointer',
          }}
          title="Shapes Menu (Box / Circle)"
        >
          <svg viewBox="0 0 24 24" style={ICON}>
            <rect x="3" y="3" width="18" height="18" rx="4" />
          </svg>
          <span style={{ fontSize: 9 }}>▼</span>
        </button>

        {activeDropdown === 'shapes' && (
          <div style={POPOVER_SHELL}>
            <div style={POPOVER_TITLE}>Insert Shapes</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => { onSelectTool('box'); setActiveDropdown(null); }}
                style={POPOVER_ITEM_BTN}
              >
                <svg viewBox="0 0 24 24" style={ICON}><rect x="3" y="3" width="18" height="18" rx="4" /></svg>
                <span>Rectangle</span>
              </button>
              <button
                type="button"
                onClick={() => { onSelectTool('circle'); setActiveDropdown(null); }}
                style={POPOVER_ITEM_BTN}
              >
                <svg viewBox="0 0 24 24" style={ICON}><circle cx="12" cy="12" r="9" /></svg>
                <span>Circle</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Image Tool (Standalone) */}
      {renderToolButton('image', 'Add Image Asset', (
        <svg viewBox="0 0 24 24" style={ICON}>
          <rect x="3" y="3" width="18" height="18" rx="3.5" />
          <circle cx="9" cy="9" r="2" />
          <path d="M21 15l-3.086-3.086a2 2 0 00-2.828 0L6 21" />
        </svg>
      ))}

      <div style={DIVIDER} />

      {/* 5. Drawing Tools Dropdown Group (Pencil / Bezier / Eraser) */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setActiveDropdown(activeDropdown === 'draw' ? null : 'draw')}
          style={{
            height: 34,
            padding: '0 6px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            background: isDrawActive || activeDropdown === 'draw' ? 'rgba(244, 98, 31, 0.25)' : 'transparent',
            border: isDrawActive ? '1px solid #f4621f' : '1px solid transparent',
            borderRadius: 8,
            color: isDrawActive ? '#f4621f' : 'rgba(255, 255, 255, 0.75)',
            cursor: 'pointer',
          }}
          title="Freehand & Drawing Tools"
        >
          <svg viewBox="0 0 24 24" style={ICON}>
            <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4Z" />
          </svg>
          <span style={{ fontSize: 9 }}>▼</span>
        </button>

        {activeDropdown === 'draw' && (
          <div style={POPOVER_SHELL}>
            <div style={POPOVER_TITLE}>Drawing Tools</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => { onSelectTool('pencil'); setActiveDropdown(null); }}
                style={POPOVER_ITEM_BTN}
              >
                <svg viewBox="0 0 24 24" style={ICON}><path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4Z" /></svg>
                <span>Pencil</span>
              </button>
              <button
                type="button"
                onClick={() => { onSelectTool('bezier'); setActiveDropdown(null); }}
                style={POPOVER_ITEM_BTN}
              >
                <svg viewBox="0 0 24 24" style={ICON}><path d="M3 21l6.6-2.2L20.2 8.2a2.4 2.4 0 0 0 0-3.4l-1-1a2.4 2.4 0 0 0-3.4 0L5.2 14.4 3 21z" /></svg>
                <span>Bezier Pen</span>
              </button>
              <button
                type="button"
                onClick={() => { onSelectTool('eraser'); setActiveDropdown(null); }}
                style={POPOVER_ITEM_BTN}
              >
                <svg viewBox="0 0 24 24" style={ICON}><path d="M20 20H7L3 16c-.5-.5-.5-1.4 0-2l8-8c.5-.5 1.4-.5 2 0l7 7c.5.5.5 1.4 0 2l-2 2" /></svg>
                <span>Eraser</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={DIVIDER} />

      {/* 6. Scripture Tool Button & Modal Popover */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => {
            setActiveDropdown(activeDropdown === 'scripture' ? null : 'scripture');
            if (scriptureVerses.length === 0) searchScripture('John 3:16');
          }}
          style={{
            height: 34,
            padding: '0 8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: activeDropdown === 'scripture' ? 'var(--accent, #f4621f)' : 'transparent',
            border: 'none',
            borderRadius: 8,
            color: activeDropdown === 'scripture' ? '#ffffff' : 'rgba(255, 255, 255, 0.85)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Scripture Tool (Search Bible & Customize Verse Colors)"
        >
          <svg viewBox="0 0 24 24" style={ICON}>
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15z" />
          </svg>
          <span>Scripture</span>
        </button>

        {activeDropdown === 'scripture' && (
          <div style={{ ...POPOVER_SHELL, width: 360 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={POPOVER_TITLE}>📖 Scripture Tool</div>
              <button type="button" onClick={() => setActiveDropdown(null)} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Bible Verse Search */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input
                type="text"
                value={scriptureQuery}
                onChange={(e) => searchScripture(e.target.value)}
                placeholder="Search verse (e.g. John 3:16, Psalm 23)"
                style={POPOVER_INPUT}
              />
            </div>

            {/* Verses Selection list */}
            <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              {scriptureLoading ? (
                <div style={{ fontSize: 11, color: '#a1a1aa', padding: 4 }}>Searching Bible...</div>
              ) : scriptureVerses.length === 0 ? (
                <div style={{ fontSize: 11, color: '#a1a1aa', padding: 4 }}>No verses found</div>
              ) : (
                scriptureVerses.map((v) => (
                  <div
                    key={`${v.book}-${v.chapter}-${v.verse}`}
                    onClick={() => setSelectedVerse(v)}
                    style={{
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: selectedVerse?.reference === v.reference ? 'rgba(244, 98, 31, 0.2)' : 'rgba(255,255,255,0.04)',
                      border: selectedVerse?.reference === v.reference ? '1px solid #f4621f' : '1px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#f4621f' }}>{v.reference}</div>
                    <div style={{ fontSize: 11, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.text}</div>
                  </div>
                ))
              )}
            </div>

            {/* Independent Color Customizers */}
            <div style={{ display: 'flex', gap: 12, marginTop: 10, borderTop: '1px solid var(--block-line)', paddingTop: 10 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Verse Text Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="color" value={verseColor} onChange={(e) => setVerseColor(e.target.value)} style={{ width: 26, height: 26, border: 'none', cursor: 'pointer', background: 'none' }} />
                  <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{verseColor}</span>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Reference Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="color" value={refColor} onChange={(e) => setRefColor(e.target.value)} style={{ width: 26, height: 26, border: 'none', cursor: 'pointer', background: 'none' }} />
                  <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{refColor}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleInsertScripture}
              disabled={!selectedVerse}
              style={{
                marginTop: 12,
                width: '100%',
                padding: '8px 12px',
                background: 'var(--accent, #f4621f)',
                border: 'none',
                borderRadius: 6,
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 12,
                cursor: selectedVerse ? 'pointer' : 'default',
                opacity: selectedVerse ? 1 : 0.4,
              }}
            >
              Insert Scripture to Slide
            </button>
          </div>
        )}
      </div>

      {/* 7. Song Tool Button & Modal Popover */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setActiveDropdown(activeDropdown === 'song' ? null : 'song')}
          style={{
            height: 34,
            padding: '0 8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: activeDropdown === 'song' ? 'var(--accent, #f4621f)' : 'transparent',
            border: 'none',
            borderRadius: 8,
            color: activeDropdown === 'song' ? '#ffffff' : 'rgba(255, 255, 255, 0.85)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Song Tool (Insert Worship Lyrics by Section)"
        >
          <svg viewBox="0 0 24 24" style={ICON}>
            <path d="M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12 0a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Song</span>
        </button>

        {activeDropdown === 'song' && (
          <div style={{ ...POPOVER_SHELL, width: 360 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={POPOVER_TITLE}>🎵 Worship Song Tool</div>
              <button type="button" onClick={() => setActiveDropdown(null)} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Song Search */}
            <input
              type="text"
              value={songQuery}
              onChange={(e) => setSongQuery(e.target.value)}
              placeholder="Search worship songs..."
              style={{ ...POPOVER_INPUT, marginTop: 8 }}
            />

            {/* Songs list */}
            <div style={{ maxHeight: 110, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              {filteredSongs.length === 0 ? (
                <div style={{ fontSize: 11, color: '#a1a1aa', padding: 4 }}>No songs in library</div>
              ) : (
                filteredSongs.slice(0, 10).map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSong(s)}
                    style={{
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: selectedSong?.id === s.id ? 'rgba(244, 98, 31, 0.2)' : 'rgba(255,255,255,0.04)',
                      border: selectedSong?.id === s.id ? '1px solid #f4621f' : '1px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#ffffff' }}>{s.title}</div>
                    {s.author && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{s.author}</div>}
                  </div>
                ))
              )}
            </div>

            {/* Section Pills Selector */}
            {selectedSong && (
              <div style={{ marginTop: 10, borderTop: '1px solid var(--block-line)', paddingTop: 8 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginBottom: 4 }}>Select Section:</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {['Chorus', 'Verse 1', 'Verse 2', 'Bridge', 'Tag', 'All'].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setSelectedSection(sec)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        border: 'none',
                        background: selectedSection === sec ? '#f4621f' : 'rgba(255,255,255,0.08)',
                        color: '#ffffff',
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {sec}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Lyrics Color */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Lyrics Text Color:</label>
              <input type="color" value={lyricsColor} onChange={(e) => setLyricsColor(e.target.value)} style={{ width: 24, height: 24, border: 'none', cursor: 'pointer', background: 'none' }} />
            </div>

            <button
              type="button"
              onClick={handleInsertSong}
              disabled={!selectedSong}
              style={{
                marginTop: 12,
                width: '100%',
                padding: '8px 12px',
                background: 'var(--accent, #f4621f)',
                border: 'none',
                borderRadius: 6,
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 12,
                cursor: selectedSong ? 'pointer' : 'default',
                opacity: selectedSong ? 1 : 0.4,
              }}
            >
              Insert Song Lyrics to Slide
            </button>
          </div>
        )}
      </div>

      {pptx && (
        <>
          <div style={DIVIDER} />

          {/* Grouping Actions */}
          {renderActionButton({
            id: 'group',
            title: 'Group selection',
            enabled: pptx.canGroup,
            onClick: pptx.onGroup,
            icon: (
              <svg viewBox="0 0 24 24" style={ICON}>
                <rect x="3" y="3" width="9" height="9" rx="1.5" />
                <rect x="12" y="12" width="9" height="9" rx="1.5" />
              </svg>
            ),
          })}
          {renderActionButton({
            id: 'ungroup',
            title: 'Ungroup selection',
            enabled: pptx.canUngroup,
            onClick: pptx.onUngroup,
            icon: (
              <svg viewBox="0 0 24 24" style={ICON}>
                <rect x="3" y="3" width="8" height="8" rx="1.5" />
                <rect x="13" y="13" width="8" height="8" rx="1.5" strokeDasharray="3 2.5" />
              </svg>
            ),
          })}

          <div style={DIVIDER} />

          {/* Layer Order Actions */}
          {renderActionButton({
            id: 'front',
            title: 'Bring to front',
            enabled: pptx.hasSelection,
            onClick: () => pptx.onReorder(true),
            icon: (
              <svg viewBox="0 0 24 24" style={ICON}>
                <rect x="3" y="3" width="12" height="12" rx="1.5" strokeDasharray="3 2.5" />
                <rect x="9" y="9" width="12" height="12" rx="1.5" fill="currentColor" fillOpacity="0.25" />
              </svg>
            ),
          })}
          {renderActionButton({
            id: 'back',
            title: 'Send to back',
            enabled: pptx.hasSelection,
            onClick: () => pptx.onReorder(false),
            icon: (
              <svg viewBox="0 0 24 24" style={ICON}>
                <rect x="9" y="9" width="12" height="12" rx="1.5" strokeDasharray="3 2.5" />
                <rect x="3" y="3" width="12" height="12" rx="1.5" fill="currentColor" fillOpacity="0.25" />
              </svg>
            ),
          })}
        </>
      )}

      <div style={DIVIDER} />

      {/* Smart Snap Toggle Button */}
      <button
        type="button"
        onClick={onToggleSmartSnap}
        style={{
          width: 34,
          height: 34,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: smartSnap ? 'rgba(244, 98, 31, 0.2)' : 'transparent',
          border: smartSnap ? '1px solid #f4621f' : '1px solid transparent',
          borderRadius: 8,
          color: smartSnap ? '#f4621f' : 'rgba(255, 255, 255, 0.75)',
          cursor: 'pointer',
        }}
        title="Smart Snap (snap to center & edges)"
      >
        <svg viewBox="0 0 24 24" style={ICON}>
          <path d="M12 3v18M3 12h18" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      </button>

      {pptx && (
        <>
          <div style={DIVIDER} />
          {/* Delete Action */}
          {renderActionButton({
            id: 'delete',
            title: 'Delete Selected Layer / Element',
            enabled: pptx.hasSelection,
            danger: true,
            onClick: pptx.onDelete,
            icon: (
              <svg viewBox="0 0 24 24" style={ICON}>
                <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
              </svg>
            ),
          })}
        </>
      )}
    </div>
  );
}

const SHELL: React.CSSProperties = {
  position: 'absolute',
  bottom: 24,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 50,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '5px 12px',
  background: 'rgba(22, 20, 20, 0.94)',
  border: '1px solid var(--block-line, #262628)',
  borderRadius: 30,
  boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(16px)',
  userSelect: 'none',
};

const DIVIDER: React.CSSProperties = {
  width: 1,
  height: 18,
  background: 'var(--block-line, #262628)',
  margin: '0 4px',
  flexShrink: 0,
};

const ICON: React.CSSProperties = {
  width: 16,
  height: 16,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const POPOVER_SHELL: React.CSSProperties = {
  position: 'absolute',
  bottom: 48,
  left: '50%',
  transform: 'translateX(-50%)',
  background: '#161414',
  border: '1px solid var(--block-line, #262628)',
  borderRadius: 12,
  padding: 12,
  boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
  backdropFilter: 'blur(20px)',
  zIndex: 100,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const POPOVER_TITLE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#ffffff',
  marginBottom: 2,
};

const POPOVER_ITEM_BTN: React.CSSProperties = {
  flex: 1,
  padding: '8px 10px',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid var(--block-line, #262628)',
  borderRadius: 8,
  color: '#ffffff',
  fontSize: 11,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
};

const POPOVER_INPUT: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  background: '#111010',
  border: '1px solid var(--block-line, #262628)',
  borderRadius: 6,
  color: '#ffffff',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
};
