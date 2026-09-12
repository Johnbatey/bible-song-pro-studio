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
  const doubleClickToGoLive = useAppStore((s) => s.doubleClickToGoLive);

  // Workspace Mode: 'buttons' (slide grid) or 'text' (lyrics editor)
  const [workspaceMode, setWorkspaceMode] = useState<'buttons' | 'text'>('buttons');
  // Multi-Tab Selection: 'primary' (main lyrics) or 'translation' (translated lyrics)
  const [lyricTab, setLyricTab] = useState<'primary' | 'translation'>('primary');
  
  // Metadata drafts
  const [titleDraft, setTitleDraft] = useState('');
  const [artistDraft, setArtistDraft] = useState('');
  const [keyDraft, setKeyDraft] = useState('');
  const [ccliDraft, setCcliDraft] = useState('');
  const [copyrightDraft, setCopyrightDraft] = useState('');

  // Text Editor state for primary and translated lyrics
  const [primaryTextDraft, setPrimaryTextDraft] = useState('');
  const [translationTextDraft, setTranslationTextDraft] = useState('');
  const [selectedLang, setSelectedLang] = useState('es');

  const currentSongIdRef = useRef<string | undefined>(song?.id);
  const isTypingPrimaryRef = useRef(false);
  const isTypingTransRef = useRef(false);
  const primaryDebounceTimer = useRef<any>(null);
  const transDebounceTimer = useRef<any>(null);
  const metaDebounceTimer = useRef<any>(null);

  // Initialize and sync state when a different song is loaded
  useEffect(() => {
    if (!song) {
      setTitleDraft('');
      setArtistDraft('');
      setKeyDraft('');
      setCcliDraft('');
      setCopyrightDraft('');
      setPrimaryTextDraft('');
      setTranslationTextDraft('');
      currentSongIdRef.current = undefined;
      return;
    }

    const isDifferentSong = song.id !== currentSongIdRef.current;
    currentSongIdRef.current = song.id;

    if (isDifferentSong) {
      setWorkspaceMode('buttons');
      setTitleDraft(song.title || '');
      setArtistDraft(song.author || song.artist || '');
      setKeyDraft(song.key || '');
      setCcliDraft(song.ccli || '');
      setCopyrightDraft(song.copyright || '');
      setSelectedLang(song.translationLang || 'es');

      const primaryStr = song.slides.map((s) => `[${s.label || 'Verse'}]\n${s.text || ''}`).join('\n\n');
      setPrimaryTextDraft(primaryStr);

      const transStr = song.slides.map((s) => `[${s.label || 'Verse'}]\n${s.translation || ''}`).join('\n\n');
      setTranslationTextDraft(transStr);
    } else {
      // Same song: only sync if not actively typing
      if (!isTypingPrimaryRef.current) {
        const primaryStr = song.slides.map((s) => `[${s.label || 'Verse'}]\n${s.text || ''}`).join('\n\n');
        setPrimaryTextDraft(primaryStr);
      }
      if (!isTypingTransRef.current) {
        const transStr = song.slides.map((s) => `[${s.label || 'Verse'}]\n${s.translation || ''}`).join('\n\n');
        setTranslationTextDraft(transStr);
      }
    }
  }, [song?.id, song?.slides, song?.title, song?.author, song?.artist, song?.key, song?.ccli, song?.copyright]);

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

  function handleLinesPerSlideChange(val: number | 'auto') {
    setLinesPerSlide(val);
    if (!song) return;

    const newSlides = getFormattedSlides(song, val);
    if (!newSlides.length) return;

    const withCredits = showSongCredits && val === 'auto';
    const sceneTarget = lyricTab === 'translation' ? 'translation' : (song.isBilingual ? 'bilingual' : 'primary');

    const curSongPrefix = `song-${song.id}-`;
    const isCurrentActive = Boolean(currentScene?.type === 'song' && currentScene.id.startsWith(curSongPrefix));
    const isPreviewActive = Boolean(previewScene?.type === 'song' && previewScene.id.startsWith(curSongPrefix));

    if (operatingMode === 'basic') {
      if (isCurrentActive) {
        const curText = currentScene?.content?.text?.trim() || '';
        const matched = newSlides.find((s) => s.text.trim() === curText)
          || newSlides.find((s) => curText.includes(s.text.trim()) || s.text.trim().includes(curText))
          || newSlides[0];
        if (matched) {
          projectScene(buildSongScene(song, matched, { includeCredits: withCredits, target: sceneTarget }), { direct: true });
        }
      }
    } else {
      // Studio mode: land in Preview window so operator can inspect before committing live
      if (isPreviewActive || isCurrentActive) {
        const refText = (previewScene?.content?.text || currentScene?.content?.text || '').trim();
        const matched = newSlides.find((s) => s.text.trim() === refText)
          || newSlides.find((s) => refText.includes(s.text.trim()) || s.text.trim().includes(refText))
          || newSlides[0];
        if (matched) {
          projectScene(buildSongScene(song, matched, { includeCredits: withCredits, target: sceneTarget }), { direct: false });
        }
      }
    }
  }

  function handleCreditsToggle(checked: boolean) {
    setShowSongCredits(checked);
    if (!song) return;

    const curSongPrefix = `song-${song.id}-`;
    const isCurrentActive = Boolean(currentScene?.type === 'song' && currentScene.id.startsWith(curSongPrefix));
    const isPreviewActive = Boolean(previewScene?.type === 'song' && previewScene.id.startsWith(curSongPrefix));

    const withCredits = checked && linesPerSlide === 'auto';
    const sceneTarget = lyricTab === 'translation' ? 'translation' : (song.isBilingual ? 'bilingual' : 'primary');

    if (operatingMode === 'basic') {
      if (isCurrentActive && currentScene) {
        const activeSlide = slides.find((s) => songSceneId(song, s) === currentScene.id) || slides[0];
        if (activeSlide) {
          projectScene(buildSongScene(song, activeSlide, { includeCredits: withCredits, target: sceneTarget }), { direct: true });
        }
      }
    } else {
      if ((isPreviewActive || isCurrentActive) && (previewScene || currentScene)) {
        const activeId = previewScene?.id || currentScene?.id;
        const activeSlide = slides.find((s) => songSceneId(song, s) === activeId) || slides[0];
        if (activeSlide) {
          projectScene(buildSongScene(song, activeSlide, { includeCredits: withCredits, target: sceneTarget }), { direct: false });
        }
      }
    }
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

  function commitPrimaryText(text: string) {
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

  function handleSavePrimaryText(text: string) {
    setPrimaryTextDraft(text);
    isTypingPrimaryRef.current = true;
    if (primaryDebounceTimer.current) clearTimeout(primaryDebounceTimer.current);
    primaryDebounceTimer.current = setTimeout(() => {
      isTypingPrimaryRef.current = false;
      commitPrimaryText(text);
    }, 450);
  }

  function commitTranslationText(text: string) {
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

  function handleSaveTranslationText(text: string) {
    setTranslationTextDraft(text);
    isTypingTransRef.current = true;
    if (transDebounceTimer.current) clearTimeout(transDebounceTimer.current);
    transDebounceTimer.current = setTimeout(() => {
      isTypingTransRef.current = false;
      commitTranslationText(text);
    }, 450);
  }

  function handleSaveMetadata(patch: Partial<Song>) {
    if (!song || !onUpdateSong) return;
    if (metaDebounceTimer.current) clearTimeout(metaDebounceTimer.current);
    metaDebounceTimer.current = setTimeout(() => {
      onUpdateSong(patch);
    }, 350);
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
          <span style={{ fontWeight: fontWeight.bold, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title ?? (song ? song.title : 'Songs Workspace')}
          </span>
        }
        tools={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {/* Mode Switcher: Text vs Buttons (comes first) */}
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

            {/* Multi-Tab Lyric Switcher: Primary vs Translation (comes after Text/Buttons) */}
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

            {song && workspaceMode === 'buttons' && (
              <>
                <BlockButton
                  icon
                  disabled={!slides.length}
                  onClick={() => step(-1)}
                  title="Previous slide (←)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </BlockButton>
                <BlockButton
                  icon
                  disabled={!slides.length}
                  onClick={() => step(1)}
                  title="Next slide (→)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </BlockButton>
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
                    onClick={() => handleLinesPerSlideChange(val)}
                  >
                    {val === 'auto' ? 'Auto' : String(val)}
                  </BlockButton>
                ))}
              </BlockSegment>
            </div>
            <AppleToggle
              label="Display credits"
              checked={showSongCredits}
              onChange={handleCreditsToggle}
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
            {/* Song Metadata Editor (Title & Artist / Author) */}
            <div style={deckStyles.metadataBar}>
              <div style={{ display: 'flex', flexDirection: 'column', flex: '2 1 200px', minWidth: 140 }}>
                <label style={deckStyles.fieldLabel}>Song Title</label>
                <input
                  type="text"
                  className="input"
                  value={titleDraft}
                  onChange={(e) => {
                    setTitleDraft(e.target.value);
                    handleSaveMetadata({ title: e.target.value });
                  }}
                  onBlur={() => onUpdateSong?.({ title: titleDraft })}
                  placeholder="Song Title"
                  style={deckStyles.metaInput}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 140px', minWidth: 120 }}>
                <label style={deckStyles.fieldLabel}>Artist / Author</label>
                <input
                  type="text"
                  className="input"
                  value={artistDraft}
                  onChange={(e) => {
                    setArtistDraft(e.target.value);
                    handleSaveMetadata({ author: e.target.value, artist: e.target.value });
                  }}
                  onBlur={() => onUpdateSong?.({ author: artistDraft, artist: artistDraft })}
                  placeholder="Artist / Author"
                  style={deckStyles.metaInput}
                />
              </div>
            </div>

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
                  onBlur={() => {
                    isTypingPrimaryRef.current = false;
                    commitPrimaryText(primaryTextDraft);
                  }}
                  placeholder="[Verse 1]&#10;Enter primary lyrics here..."
                  style={deckStyles.lyricsTextarea}
                  spellCheck={false}
                />
              </div>
            ) : (
              /* TRANSLATION LYRICS TEXT VIEW */
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 8 }}>
                {/* Compact Unified Translation Toolbar */}
                <div style={deckStyles.translationBar}>
                  {/* Left: Language Select & Inline Toggles */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)' }}>Language</span>
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

                    <span style={{ width: 1, height: 16, background: 'var(--border-primary, rgba(255,255,255,0.1))' }} />

                    {/* Bilingual Toggle */}
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(song.isBilingual)}
                        onChange={(e) => onUpdateSong?.({ isBilingual: e.target.checked })}
                        style={{ accentColor: 'var(--accent, #FF5500)', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 11, color: song.isBilingual ? 'var(--text-primary)' : 'var(--text-dim)', fontWeight: song.isBilingual ? 600 : 400 }}>
                        Bilingual
                      </span>
                    </label>

                    {/* Lock Toggle */}
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(song.lockTranslation)}
                        onChange={(e) => onUpdateSong?.({ lockTranslation: e.target.checked })}
                        style={{ accentColor: 'var(--accent, #FF5500)', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 11, color: song.lockTranslation ? 'var(--text-primary)' : 'var(--text-dim)', fontWeight: song.lockTranslation ? 600 : 400 }}>
                        Lock
                      </span>
                    </label>
                  </div>

                  {/* Right: Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      style={deckStyles.primaryActionBtn}
                      onClick={() => handleSaveTranslationText(translationTextDraft)}
                      title="Save / Update translated lyrics"
                    >
                      Update
                    </button>
                    <button
                      type="button"
                      style={deckStyles.secondaryActionBtn}
                      onClick={handleRemoveTranslation}
                      title="Remove translation from song"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Translation Textarea */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  <textarea
                    value={translationTextDraft}
                    onChange={(e) => handleSaveTranslationText(e.target.value)}
                    onBlur={() => {
                      isTypingTransRef.current = false;
                      commitTranslationText(translationTextDraft);
                    }}
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
                      ? 'var(--accent-dim)'
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
                  onClick={() => {
                    if (doubleClickToGoLive && operatingMode === 'studio') {
                      send(slide, { direct: false });
                    } else {
                      send(slide);
                    }
                  }}
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
                            songId: song.id,
                            slideId: slide.id,
                            linesPerSlide: linesPerSlide,
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
  metadataBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 6,
    border: '1px solid var(--border-primary)',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--text-dim)',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  metaInput: {
    height: 28,
    fontSize: 12,
    padding: '3px 8px',
    background: 'var(--bg-secondary)',
    borderColor: 'var(--border-primary)',
    color: 'var(--text-primary)',
    borderRadius: 4,
  },
  tabSegmentContainer: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'transparent',
    border: '1px solid var(--block-line)',
    borderRadius: 'var(--radius-md)',
    padding: 2,
    gap: 2,
  },
  tabBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 'var(--fs-secondary)',
    fontWeight: 500,
    height: 24,
    padding: '0 8px',
    borderRadius: 'var(--radius-sm)',
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
    gap: 8,
    flexWrap: 'wrap',
    padding: '4px 8px',
    background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
    borderRadius: 6,
    border: '1px solid var(--border-primary, rgba(255,255,255,0.08))',
    minHeight: 32,
  },
  langSelect: {
    background: 'var(--bg-primary, #16191f)',
    border: '1px solid var(--border-primary, rgba(255,255,255,0.15))',
    borderRadius: 4,
    color: 'var(--text-primary, #ffffff)',
    fontSize: 11,
    height: 24,
    padding: '0 6px',
    outline: 'none',
  },
  primaryActionBtn: {
    background: 'var(--accent, #ff5500)',
    border: 'none',
    borderRadius: 4,
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 600,
    height: 24,
    padding: '0 10px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionBtn: {
    background: 'var(--chrome-control, rgba(255,255,255,0.08))',
    border: '1px solid var(--border-primary, rgba(255,255,255,0.12))',
    borderRadius: 4,
    color: 'var(--text-secondary, #cccccc)',
    fontSize: 11,
    fontWeight: 500,
    height: 24,
    padding: '0 8px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
