import { useEffect, useRef } from 'react';
import { useAppStore } from '../../stores/appStore';
import type { Song } from '../../types';
import { type, fontWeight } from '../../styles/type';
import { Block, BlockButton, BlockSegment } from '../Block';
import { AppleToggle } from '../AppleToggle';
import { getFormattedSlides, songSceneId, buildSongScene, type FormattedSlide } from '../../utils/song-slides';
import { isFocusedDock } from '../dock/dockFocus';

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
}

/**
 * The projectable lyric deck: slides, prev/next, lines-per-slide and the
 * credits toggle.
 *
 * Both the Songs panel and Live Scripture's song mode render this rather than
 * each drawing their own, so a control added to the footer shows up in both
 * places automatically — which is the point. It owns a whole Block (not just
 * the body) precisely so the tools and footer cannot diverge.
 */
export function SongDeck({ song, title, emptyLabel, targetText }: SongDeckProps) {
  const projectScene = useAppStore((s) => s.projectScene);
  const currentScene = useAppStore((s) => s.display.currentScene);
  const previewScene = useAppStore((s) => s.display.previewScene);
  const setCurrentScene = useAppStore((s) => s.setCurrentScene);
  const setPreviewScene = useAppStore((s) => s.setPreviewScene);
  const operatingMode = useAppStore((s) => s.display.mode);
  const showSongCredits = useAppStore((s) => s.showSongCredits);
  const setShowSongCredits = useAppStore((s) => s.setShowSongCredits);
  const addToQueue = useAppStore((s) => s.addToQueue);
  // Shared so re-chunking in one panel is reflected in the other.
  const linesPerSlide = useAppStore((s) => s.songLinesPerSlide);
  const setLinesPerSlide = useAppStore((s) => s.setSongLinesPerSlide);

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
    // Clicking what is already showing clears it, matching the verse rows.
    if (active?.id === sceneId) {
      if (goesLive) setCurrentScene(null);
      setPreviewScene(null);
      return;
    }
    projectScene(buildSongScene(song, slide, { includeCredits }), { direct: opts.direct });
  }

  function step(direction: 1 | -1) {
    if (!song || slides.length === 0) return;
    const index = slides.findIndex((s) => songSceneId(song, s) === activeSceneId);
    if (index === -1) {
      // Nothing of this song is showing — start from whichever end we came at.
      send(slides[direction > 0 ? 0 : slides.length - 1], { direct: true });
      return;
    }
    /* Wrap rather than clamp. Clamping re-sent the slide already showing, which
       send() treats as "clicked what is live" and clears the output — so the
       end of a song went blank, and only the press after that came back to the
       start. */
    const next = (index + direction + slides.length) % slides.length;
    send(slides[next], { direct: true });
  }

  // Arrow keys step slides, gated to the focused dock so the Bible list and a
  // song deck on screen together do not both respond.
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
    <div ref={rootRef} className="blk-fill" style={{ display: 'flex', minWidth: 0, minHeight: 0 }}>
    <Block
      className="blk-fill"
      title={title ?? (song ? song.title : 'Lyrics')}
      subtitle={song
        ? `${song.artist || 'Unknown Artist'}${song.key ? ` · Key: ${song.key}` : ''}`
        : undefined}
      tools={song ? (
        <>
          <BlockButton disabled={!slides.length} onClick={() => step(-1)}>Prev</BlockButton>
          <BlockButton disabled={!slides.length} onClick={() => step(1)}>Next</BlockButton>
        </>
      ) : undefined}
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
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
          {slides.map((slide) => {
            const sceneId = songSceneId(song, slide);
            const isLive = currentScene?.type === 'song' && currentScene.id === sceneId;
            const isPreview = previewScene?.type === 'song' && previewScene.id === sceneId;
            const isTarget = slide.id === targetSlideId;

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
                  <span style={{ ...type.label, color: 'var(--accent)', fontWeight: fontWeight.bold }}>
                    {slide.label}
                  </span>
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
                          text: slide.text,
                          type: 'song',
                          source: 'Manual',
                          scene: buildSongScene(song, slide, { includeCredits }),
                        });
                      }}
                      style={{ background: 'transparent', border: 'none', color: '#ffffff', fontSize: 16, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
                      title="Add slide to Queue"
                    >
                      +
                    </button>
                  </div>
                </div>
                <span style={{ ...type.secondary, lineHeight: 1.45, whiteSpace: 'pre-line', color: 'var(--text-secondary)' }}>
                  {slide.text}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Block>
    </div>
  );
}
