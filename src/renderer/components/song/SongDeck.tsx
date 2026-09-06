import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import type { Song, SongSlide } from '../../types';
import { type, fontWeight } from '../../styles/type';
import { Block, BlockButton, BlockSegment } from '../Block';
import { AppleToggle } from '../AppleToggle';
import { getFormattedSlides, songSceneId, buildSongScene, type FormattedSlide } from '../../utils/song-slides';
import { isFocusedDock } from '../dock/dockFocus';

const SUPPORTED_TRANSLATION_LANGS = [
  { code: 'es', label: 'Spanish (Español)' },
  { code: 'fr', label: 'French (Français)' },
  { code: 'pt', label: 'Portuguese (Português)' },
  { code: 'yo', label: 'Yoruba (Èdè Yorùbá)' },
  { code: 'ig', label: 'Igbo (Asụsụ Igbo)' },
  { code: 'ha', label: 'Hausa (Harshen Hausa)' },
  { code: 'de', label: 'German (Deutsch)' },
  { code: 'it', label: 'Italian (Italiano)' },
  { code: 'ru', label: 'Russian (Русский)' },
  { code: 'zh', label: 'Chinese (中文)' },
  { code: 'tl', label: 'Tagalog (Filipino)' },
  { code: 'sw', label: 'Swahili (Kiswahili)' },
  { code: 'ko', label: 'Korean (한국어)' },
  { code: 'ja', label: 'Japanese (日本語)' },
  { code: 'ar', label: 'Arabic (العربية)' },
];

interface SongDeckProps {
  song: Song | null;
  /** Block title. Songs calls it by the song's name; Live calls it "Lyrics". */
  title?: string;
  /** Shown when nothing is selected — the two panels get there differently. */
  emptyLabel?: string;
  /**
   * Ring and scroll to the slide holding this text. Songs passes a lyric search
   * phrase, Live passes the section the detector matched.
   */
  targetText?: string;
  /** Callback to persist song updates back to library. */
  onUpdateSong?: (patch: Partial<Song>) => void;
}

export function SongDeck({ song, title, emptyLabel, targetText, onUpdateSong }: SongDeckProps) {
  const projectScene = useAppStore((s) => s.projectScene);
  const currentScene = useAppStore((s) => s.display.currentScene);
  const previewScene = useAppStore((s) => s.display.previewScene);
  const setCurrentScene = useAppStore((s) => s.setCurrentScene);
  const setPreviewScene = useAppStore((s) => s.setPreviewScene);
  const operatingMode = useAppStore((s) => s.display.mode);
  const showSongCredits = useAppStore((s) => s.showSongCredits);
  const setShowSongCredits = useAppStore((s) => s.setShowSongCredits);
  const addToQueue = useAppStore((s) => s.addToQueue);
  const linesPerSlide = useAppStore((s) => s.songLinesPerSlide);
  const setLinesPerSlide = useAppStore((s) => s.setSongLinesPerSlide);

  // Workspace Mode: 'buttons' (slide grid) or 'text' (lyrics editor)
  const [workspaceMode, setWorkspaceMode] = useState<'buttons' | 'text'>('buttons');
  // Multi-Tab Selection: 'primary' (main lyrics) or 'translation' (translated lyrics)
  const [lyricTab, setLyricTab] = useState<'primary' | 'translation'>('primary');
  // Text Editor state for primary and translated lyrics
  const [primaryTextDraft, setPrimaryTextDraft] = useState('');
  const [translationTextDraft, setTranslationTextDraft] = useState('');
  const [selectedLang, setSelectedLang] = useState('es');

  useEffect(() => {
    if (!song) {
      setPrimaryTextDraft('');
      setTranslationTextDraft('');
      return;
    }
    setSelectedLang(song.translationLang || 'es');
    // Format primary slides to text
    const primaryStr = song.slides.map((s) => `[${s.label || 'Verse'}]\n${s.text || ''}`).join('\n\n');
    setPrimaryTextDraft(primaryStr);

    // Format translated slides to text
    const transStr = song.slides.map((s) => `[${s.label || 'Verse'}]\n${s.translation || ''}`).join('\n\n');
    setTranslationTextDraft(transStr);
  }, [song?.id, song?.slides]);

  const slides = song ? getFormattedSlides(song, linesPerSlide) : [];
  const includeCredits = showSongCredits && linesPerSlide === 'auto';

  const activeSceneId = currentScene?.type === 'song'
    ? currentScene.id
    : previewScene?.type === 'song'
      ? previewScene.id
      : '';

  const target = targetText?.trim().toLowerCase();
  const targetSlideId = target
    ? slides.find((s) => s.text.toLowerCase().includes(target))?.id
    : undefined;

  const slideRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (targetSlideId) targetRef.current?.scrollIntoView({ block: 'nearest' });
  }, [targetSlideId]);

  useEffect(() => {
    if (!activeSceneId) return;
    slideRefs.current[activeSceneId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeSceneId, slides.length, song?.id]);

  function send(slide: FormattedSlide, opts: { direct?: boolean } = {}) {
    if (!song) return;
    const sceneId = songSceneId(song, slide);
    const goesLive = opts.direct || operatingMode === 'basic';
    const active = goesLive ? currentScene : previewScene;
    if (active?.id === sceneId) {
      if (goesLive) setCurrentScene(null);
      setPreviewScene(null);
      return;
    }
    const sceneTarget = lyricTab === 'translation' ? 'translation' : (song.isBilingual ? 'bilingual' : 'primary');
    projectScene(buildSongScene(song, slide, { includeCredits, target: sceneTarget }), { direct: opts.direct });
  }

  function step(direction: 1 | -1) {
    if (!song || slides.length === 0) return;
    const index = slides.findIndex((s) => songSceneId(song, s) === activeSceneId);
    if (index === -1) {
      send(slides[direction > 0 ? 0 : slides.length - 1], { direct: true });
      return;
    }
    const next = (index + direction + slides.length) % slides.length;
    send(slides[next], { direct: true });
  }

  // Parse structured text ([Verse 1]\n...) into SongSlides
  function parseSectionsFromText(rawText: string): Array<{ label: string; text: string }> {
    const lines = rawText.split('\n');
    const sections: Array<{ label: string; text: string }> = [];
    let currentLabel = 'Verse 1';
    let currentLines: string[] = [];

    for (const line of lines) {
      const match = line.trim().match(/^\[([^\]]+)\]$/);
      if (match) {
        if (currentLines.length > 0 || sections.length > 0) {
          sections.push({ label: currentLabel, text: currentLines.join('\n').trim() });
          currentLines = [];
        }
        currentLabel = match[1].trim();
      } else {
        currentLines.push(line);
      }
    }
    if (currentLines.length > 0 || sections.length === 0) {
      sections.push({ label: currentLabel, text: currentLines.join('\n').trim() });
    }
    return sections;
  }

  function handleSavePrimaryText(text: string) {
    setPrimaryTextDraft(text);
    if (!song || !onUpdateSong) return;
    const sections = parseSectionsFromText(text);
    const updatedSlides: SongSlide[] = sections.map((sec, idx) => {
      const existing = song.slides[idx];
      return {
        id: existing?.id || `slide-${Date.now()}-${idx}`,
        label: sec.label || existing?.label || `Section ${idx + 1}`,
        text: sec.text,
        translation: existing?.translation,
      };
    });
    onUpdateSong({ slides: updatedSlides });
  }

  function handleSaveTranslationText(text: string) {
    setTranslationTextDraft(text);
    if (!song || !onUpdateSong) return;
    const sections = parseSectionsFromText(text);
    const updatedSlides: SongSlide[] = song.slides.map((slide, idx) => {
      const matchingSection = sections[idx] || sections.find((s) => s.label.toLowerCase() === slide.label.toLowerCase());
      return {
        ...slide,
        translation: matchingSection ? matchingSection.text : slide.translation,
      };
    });
    onUpdateSong({ slides: updatedSlides, translationLang: selectedLang });
  }

  function handleRemoveTranslation() {
    if (!song || !onUpdateSong) return;
    const updatedSlides: SongSlide[] = song.slides.map((slide) => ({
      ...slide,
      translation: undefined,
    }));
    onUpdateSong({
      slides: updatedSlides,
      translationLang: undefined,
      translationTitle: undefined,
      isBilingual: false,
    });
    setTranslationTextDraft(song.slides.map((s) => `[${s.label || 'Verse'}]\n`).join('\n\n'));
  }

  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || !song) return;
      if (!isFocusedDock(rootRef.current)) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        step(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        step(-1);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div ref={rootRef} className="blk-fill" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
      <Block
        className="blk-fill"
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'nowrap', minWidth: 0 }}>
            <span style={{ fontWeight: fontWeight.bold, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {title ?? (song ? song.title : 'Songs Workspace')}
            </span>
            {song && (
              <div style={deckStyles.tabSegmentContainer}>
                <button
                  type="button"
                  style={{
                    ...deckStyles.tabBtn,
                    ...(lyricTab === 'primary' ? deckStyles.tabBtnActive : {}),
                  }}
                  onClick={() => setLyricTab('primary')}
                >
                  Primary
                </button>
                <button
                  type="button"
                  style={{
                    ...deckStyles.tabBtn,
                    ...(lyricTab === 'translation' ? deckStyles.tabBtnActive : {}),
                  }}
                  onClick={() => setLyricTab('translation')}
                >
                  Translation
                </button>
              </div>
            )}
          </div>
        }
        tools={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {/* Mode Switcher: Text vs Buttons */}
            <BlockSegment>
              <BlockButton
                active={workspaceMode === 'text'}
                onClick={() => setWorkspaceMode('text')}
                title="Switch to full text editor view"
              >
                Text
              </BlockButton>
              <BlockButton
                active={workspaceMode === 'buttons'}
                onClick={() => setWorkspaceMode('buttons')}
                title="Switch to slide cards button view"
              >
                Buttons
              </BlockButton>
            </BlockSegment>

            {song && workspaceMode === 'buttons' && (
              <>
                <BlockButton disabled={!slides.length} onClick={() => step(-1)}>Prev</BlockButton>
                <BlockButton disabled={!slides.length} onClick={() => step(1)}>Next</BlockButton>
              </>
            )}
          </div>
        }
        footer={song ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ ...type.caption, color: 'var(--text-dim)' }}>Lines per slide</span>
              <BlockSegment>
                {(['auto', 1, 2, 4, 6] as const).map((val) => (
                  <BlockButton
                    key={String(val)}
                    active={linesPerSlide === val}
                    onClick={() => setLinesPerSlide(val)}
                  >
                    {val === 'auto' ? 'Auto' : String(val)}
                  </BlockButton>
                ))}
              </BlockSegment>
            </div>
            <AppleToggle
              label="Display credits"
              checked={showSongCredits}
              onChange={setShowSongCredits}
            />
          </>
        ) : undefined}
      >
        {!song ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', ...type.body, textAlign: 'center', padding: 16 }}>
            {emptyLabel || 'Select a song to view its lyrics.'}
          </div>
        ) : workspaceMode === 'text' ? (
          /* TEXT MODE */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
            {lyricTab === 'primary' ? (
              /* PRIMARY LYRICS TEXT VIEW */
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ ...type.caption, color: 'var(--text-secondary)' }}>
                    Primary Lyrics • Edit song sections using <code>[Verse 1]</code>, <code>[Chorus]</code>, etc.
                  </span>
                </div>
                <textarea
                  value={primaryTextDraft}
                  onChange={(e) => handleSavePrimaryText(e.target.value)}
                  placeholder="[Verse 1]&#10;Enter primary lyrics here..."
                  style={deckStyles.lyricsTextarea}
                  spellCheck={false}
                />
              </div>
            ) : (
              /* TRANSLATION LYRICS TEXT VIEW */
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 10 }}>
                {/* Translation Controls Bar */}
                <div style={deckStyles.translationBar}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ ...type.caption, color: 'var(--text-primary)', fontWeight: fontWeight.bold }}>
                      Translation <span style={{ color: 'var(--accent)', fontWeight: fontWeight.regular }}>Ready ({selectedLang})</span>
                    </span>
                    <select
                      value={selectedLang}
                      onChange={(e) => {
                        setSelectedLang(e.target.value);
                        onUpdateSong?.({ translationLang: e.target.value });
                      }}
                      style={deckStyles.langSelect}
                    >
                      {SUPPORTED_TRANSLATION_LANGS.map((l) => (
                        <option key={l.code} value={l.code}>{l.label}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      style={deckStyles.primaryActionBtn}
                      onClick={() => handleSaveTranslationText(translationTextDraft)}
                    >
                      Update Translation
                    </button>
                    <button
                      type="button"
                      style={deckStyles.secondaryActionBtn}
                      onClick={handleRemoveTranslation}
                    >
                      Remove Translation
                    </button>
                  </div>
                </div>

                {/* Translation Toggles Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ ...type.caption, color: 'var(--text-secondary)' }}>Show bilingual globally</span>
                  <AppleToggle
                    checked={Boolean(song.isBilingual)}
                    onChange={(checked) => onUpdateSong?.({ isBilingual: checked })}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ ...type.caption, color: 'var(--text-secondary)' }}>Lock translation</span>
                  <AppleToggle
                    checked={Boolean(song.lockTranslation)}
                    onChange={(checked) => onUpdateSong?.({ lockTranslation: checked })}
                  />
                </div>

                {/* Translation Textarea */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  <textarea
                    value={translationTextDraft}
                    onChange={(e) => handleSaveTranslationText(e.target.value)}
                    placeholder="PLEASE SELECT TWO DISTINCT LANGUAGES OR ENTER TRANSLATED LYRICS"
                    style={deckStyles.lyricsTextarea}
                    spellCheck={false}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          /* BUTTONS (SLIDES) MODE */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {slides.map((slide) => {
              const sceneId = songSceneId(song, slide);
              const isLive = currentScene?.type === 'song' && currentScene.id === sceneId;
              const isPreview = previewScene?.type === 'song' && previewScene.id === sceneId;
              const isTarget = slide.id === targetSlideId;
              const hasTranslation = Boolean(slide.translation && slide.translation.trim());
              const displayText = lyricTab === 'translation'
                ? (slide.translation || slide.text)
                : slide.text;

              return (
                <div
                  key={slide.id}
                  className="row-hover"
                  ref={(el) => {
                    slideRefs.current[sceneId] = el;
                    if (isTarget) targetRef.current = el;
                  }}
                  style={{
                    border: isLive
                      ? '2px solid #FF5500'
                      : isPreview
                      ? '2px solid var(--tally-preview)'
                      : isTarget
                      ? '1px solid var(--chrome-control-active)'
                      : '1px solid var(--border-primary)',
                    background: isLive
                      ? '#3d1403'
                      : isPreview
                      ? 'rgba(59, 130, 246, 0.08)'
                      : isTarget
                      ? 'var(--chrome-control-active)'
                      : 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    borderRadius: 6,
                    padding: 12,
                    textAlign: 'left',
                    cursor: 'pointer',
                    minHeight: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    fontFamily: 'var(--font-ui)',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => send(slide)}
                  onDoubleClick={() => send(slide, { direct: true })}
                  title={operatingMode === 'studio'
                    ? 'Click to stage in Preview · double-click to go straight to Program'
                    : 'Click to go live'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ ...type.label, color: 'var(--accent)', fontWeight: fontWeight.bold }}>
                        {slide.label}
                      </span>
                      {lyricTab === 'translation' && (
                        <span style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.08)', color: 'var(--text-dim)' }}>
                          {selectedLang.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isLive && <span style={{ ...type.label, fontWeight: fontWeight.bold, padding: '2px 5px', borderRadius: 4, background: '#FF5500', color: '#fff' }}>LIVE</span>}
                      {isPreview && !isLive && <span style={{ ...type.label, fontWeight: fontWeight.bold, padding: '2px 5px', borderRadius: 4, background: 'var(--tally-preview)', color: '#fff' }}>PREVIEW</span>}
                      <button
                        type="button"
                        className="row-action"
                        onClick={(e) => {
                          e.stopPropagation();
                          addToQueue({
                            reference: `${song.title} · ${slide.label}`,
                            text: displayText,
                            type: 'song',
                            source: 'Manual',
                            scene: buildSongScene(song, slide, { includeCredits, target: lyricTab === 'translation' ? 'translation' : 'primary' }),
                          });
                        }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 16, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
                        title="Add slide to Queue"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <span style={{ ...type.secondary, lineHeight: 1.45, whiteSpace: 'pre-line', color: 'var(--text-secondary)' }}>
                    {displayText}
                  </span>
                  {song.isBilingual && lyricTab === 'primary' && hasTranslation && (
                    <span style={{ ...type.caption, color: 'var(--text-dim)', fontStyle: 'italic', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 4 }}>
                      {slide.translation}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Block>
    </div>
  );
}

const deckStyles: Record<string, React.CSSProperties> = {
  tabSegmentContainer: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 6,
    padding: 2,
    gap: 2,
  },
  tabBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-dim)',
    fontSize: 12,
    fontWeight: 500,
    padding: '3px 10px',
    borderRadius: 4,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    background: 'var(--accent, #ff5500)',
    color: '#ffffff',
    fontWeight: 600,
  },
  lyricsTextarea: {
    flex: 1,
    width: '100%',
    minHeight: 220,
    background: '#090a0d',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 1.6,
    padding: 12,
    fontFamily: 'inherit',
    resize: 'none',
    outline: 'none',
  },
  translationBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.06)',
  },
  langSelect: {
    background: '#16191f',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 4,
    color: '#ffffff',
    fontSize: 12,
    padding: '3px 8px',
    outline: 'none',
  },
  primaryActionBtn: {
    background: '#ff5500',
    border: 'none',
    borderRadius: 4,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 600,
    padding: '5px 12px',
    cursor: 'pointer',
  },
  secondaryActionBtn: {
    background: '#ff5500',
    border: 'none',
    borderRadius: 4,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 600,
    padding: '5px 12px',
    cursor: 'pointer',
  },
};
