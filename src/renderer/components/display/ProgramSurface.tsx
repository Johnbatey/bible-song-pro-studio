import type { Alert, Scene, FullScreenTheme, Theme, VideoTransport, AppSettings } from '../../types';
import { memo, useEffect, useRef } from 'react';
import type React from 'react';
import { SlideStage } from './SlideStage';
import { attachAudioOutputSink } from '../../utils/audio-output';
import './ProgramSurface.css';

export interface ProgramSurfaceState {
  scene?: Scene | null;
  outputMode?: 'fullscreen' | 'lowerThird';
  theme?: Theme | null;
  activeAlert?: Alert | null;
  transcription?: string;
  blackout?: boolean;
  settings?: Partial<AppSettings>;
  /**
   * Whether an idle screen shows the "Bible Song Pro / Waiting for signal"
   * card. Defaults on, so a caller that knows nothing about it behaves as
   * before; Settings → Displays & Output turns it off for a room where a
   * branded holding card between items is a distraction.
   */
  showStandbyBrand?: boolean;
  mode?: 'fullscreen' | 'lowerThird';
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  fontColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  referenceColor?: string;
  referenceFontSize?: number;
  showTranslation?: boolean;
  showReference?: boolean;
  dualVersionTextAlign?: 'left' | 'center' | 'right';
  bgVideo?: string;
  bgCustomImage?: string;
  bgFill?: string;
  bgFit?: 'cover' | 'contain' | 'fill';
  bgOpacity?: number;
  bgVideoLoop?: boolean;
  /** The operator's transport for this surface's video background. */
  videoTransport?: VideoTransport | null;
}

interface ProgramSurfaceProps {
  state: ProgramSurfaceState;
  preview?: boolean;
  assetBaseUrl?: string;
  className?: string;
  /** Reports this surface's video clock back to whoever is driving it. Only
      the one pane the transport is pointed at should pass this — every
      surface playing its own copy would otherwise fight over the readout. */
  onVideoClock?: (clock: { currentTime: number; duration: number }) => void;
  /** The element's real play state. The transport holds intent, the element
      holds truth, and this is how they reconcile — without it a video that
      stops for any reason the transport did not ask for leaves the button
      showing Pause over a still frame. */
  onVideoPlayState?: (playing: boolean) => void;
}

const defaultTheme: Pick<ProgramSurfaceState, 'fontFamily' | 'fontSize' | 'fontWeight' | 'fontColor' | 'textAlign' | 'referenceColor' | 'referenceFontSize'> = {
  fontFamily: 'Poppins',
  fontSize: 0,
  fontWeight: 700,
  fontColor: '#ffffff',
  textAlign: 'center',
  referenceColor: '#e8541a',
  referenceFontSize: 0,
};

/**
 * Resolves a scene's stored media path against the origin serving it.
 *
 * Scenes hold server-relative paths on purpose — an absolute URL would pin a
 * saved service to whatever port the display server happened to hold that day
 * — so every surface that loads one has to supply the origin. Exported because
 * the stage now loads the same media into its own zones and must resolve it the
 * identical way; two spellings of this would be two ways to get a broken image.
 */
export function assetUrl(value: string | undefined, assetBaseUrl = '') {
  if (!value) return '';
  if (/^(https?:|file:|data:|blob:)/i.test(value)) return value;
  const base = assetBaseUrl || '';
  if (!base) return value;
  if (value.startsWith('/')) return `${base}${value}`;
  return `${base}/${value}`;
}

function displayFontSize(state: ProgramSurfaceState, preview: boolean) {
  if (state.fontSize && state.fontSize > 0) return `${state.fontSize}px`;
  return state.outputMode === 'lowerThird' || state.mode === 'lowerThird'
    ? '44px'
    : '76px';
}

function referenceFontSize(state: ProgramSurfaceState, preview: boolean) {
  if (state.referenceFontSize && state.referenceFontSize > 0) {
    return `${state.referenceFontSize}px`;
  }
  return '28px';
}

function backgroundStyle(state: ProgramSurfaceState, mode: 'fullscreen' | 'lowerThird', assetBaseUrl?: string): React.CSSProperties {
  if (mode === 'lowerThird') {
    return { backgroundColor: 'transparent', backgroundImage: 'none' };
  }
  const fit = state.bgFit === 'fill' ? '100% 100%' : state.bgFit || 'cover';
  const opacity = typeof state.bgOpacity === 'number' ? state.bgOpacity : 1;
  const style: React.CSSProperties = {
    backgroundColor: '#000',
    backgroundSize: fit,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    opacity,
  };

  if (state.bgCustomImage) {
    style.backgroundImage = `url("${assetUrl(state.bgCustomImage, assetBaseUrl).replace(/"/g, '%22')}")`;
  } else if (state.bgFill) {
    if (state.bgFill === 'transparent') style.backgroundColor = 'transparent';
    else if (state.bgFill.includes('gradient')) style.backgroundImage = state.bgFill;
    else style.backgroundColor = state.bgFill;
  } else {
    /* The scene's own background wins over the theme's.
     *
     * These were the other way round, and because a theme always carries a
     * fullScreen.backgroundColor, the scene branch below was unreachable: send
     * an image from the media library and the surface painted the theme's flat
     * colour instead. The screen appeared to clear to a colour nobody had
     * picked. Video escaped it only because videoSource() reads the scene
     * directly and never consults the theme — which is why video played and
     * images did not.
     *
     * The theme is the ground a scene sits on when it brings none of its own.
     * A scene that names a background has been given one by the operator, on
     * purpose, and that is the more specific instruction.
     */
    const bg = state.scene?.background;
    const sceneImage = bg?.type === 'image' && bg.mediaUrl;
    const sceneGradient = bg?.type === 'gradient' && bg.gradient;
    const sceneSolid = bg?.type === 'solid' && bg.color;
    const sceneTransparent = bg?.type === 'transparent';
    const themeFs = state.theme?.fullScreen;

    if (sceneImage) {
      style.backgroundImage = `url("${assetUrl(bg.mediaUrl as string, assetBaseUrl).replace(/"/g, '%22')}")`;
    } else if (sceneGradient) {
      style.backgroundImage = bg.gradient as string;
    } else if (sceneSolid) {
      style.backgroundColor = bg.color as string;
    } else if (sceneTransparent) {
      style.backgroundColor = 'transparent';
      /* A video scene paints no colour here — videoSource() supplies the frame
         and a fill underneath it would only show during the load. */
    } else if (bg?.type === 'video' && bg.mediaUrl) {
      style.backgroundColor = '#000';
      /* No scene background, so the theme's is the ground. Its media outranks
         its colour for the same reason a scene's does: a still or a clip is the
         more specific thing the operator chose, and a theme carries a
         backgroundColor whether or not anybody picked one. */
    } else if (themeFs?.backgroundMediaType === 'image' && themeFs.backgroundMediaUrl) {
      style.backgroundImage = `url("${assetUrl(themeFs.backgroundMediaUrl, assetBaseUrl).replace(/"/g, '%22')}")`;
      if (themeFs.backgroundFit) {
        style.backgroundSize = themeFs.backgroundFit === 'fill' ? '100% 100%' : themeFs.backgroundFit;
      }
    } else if (themeFs?.backgroundMediaType === 'video' && themeFs.backgroundMediaUrl) {
      /* videoSource() supplies the frame; a fill under it would only show
         during the load. */
      style.backgroundColor = '#000';
    } else if (themeFs?.background) {
      if (themeFs.background === 'transparent') style.backgroundColor = 'transparent';
      else if (themeFs.background.includes('gradient')) style.backgroundImage = themeFs.background;
      else style.backgroundColor = themeFs.background;
    } else if (themeFs?.backgroundColor) {
      style.backgroundColor = themeFs.backgroundColor;
    }
  }

  return style;
}

function fullscreenJustify(value: FullScreenTheme['verticalAlign'] | undefined) {
  if (value === 'top') return 'flex-start';
  if (value === 'bottom') return 'flex-end';
  return 'center';
}

function alignmentJustify(value: ProgramSurfaceState['textAlign'] | undefined) {
  if (value === 'left') return 'flex-start';
  if (value === 'right') return 'flex-end';
  return 'center';
}

function videoSource(state: ProgramSurfaceState, assetBaseUrl?: string) {
  if (state.bgVideo) return assetUrl(state.bgVideo, assetBaseUrl);
  const bg = state.scene?.background;
  if (bg?.type === 'video' && bg.mediaUrl) return assetUrl(bg.mediaUrl, assetBaseUrl);
  /* A scene that brings any background of its own has answered this — falling
     through to the theme's clip here would run it underneath a still the
     operator deliberately put on screen. Only a scene with no background at all
     takes the theme's.

     Because this src is the theme's, it does not change as scenes do, and the
     <video> below keeps its DOM node: the loop plays unbroken across takes and
     slide advances for as long as the theme holds. */
  if (!bg) {
    const themeFs = state.theme?.fullScreen;
    if (themeFs?.backgroundMediaType === 'video' && themeFs.backgroundMediaUrl) {
      return assetUrl(themeFs.backgroundMediaUrl, assetBaseUrl);
    }
  }
  return '';
}

function songCredit(scene: Scene) {
  const credit = scene.content?.songCredit;
  if (!credit) return '';
  return [credit.title, credit.author, credit.copyright, credit.ccli ? `CCLI ${credit.ccli}` : ''].filter(Boolean).join(' · ');
}

function contentFromScene(scene: Scene | null | undefined) {
  if (!scene) return null;
  return scene.content || null;
}

/**
 * Memoised because the operator's zoom and pan live in PreviewProgramView's
 * state: without this, dragging the scale slider re-rendered both surfaces on
 * every tick even though only the wrapper's transform had changed. Callers must
 * pass a stable `state` object for this to bite.
 */
export const ProgramSurface = memo(function ProgramSurface({ state, preview = false, assetBaseUrl = '', className = '', onVideoClock, onVideoPlayState }: ProgramSurfaceProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const transport = state.videoTransport;

  /* Play state follows the operator. Chromium rejects play() if the element is
     not ready yet; the rejection is expected and carries no information the
     operator could act on, so it is swallowed rather than surfaced. */
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !transport) return;
    if (transport.playing) void el.play().catch(() => {});
    else el.pause();
  }, [transport?.playing, transport?.target]);

  /* Seeks fire on the nonce, not the value: dropping the playhead on the same
     second twice has to move the video twice. */
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !transport || transport.seekTo === null) return;
    if (Number.isFinite(transport.seekTo)) el.currentTime = transport.seekTo;
  }, [transport?.seekNonce]);

  const scene = state.scene || null;

  /* Audio output device routing, mute state & master volume */
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const isMuted = Boolean(
      scene?.background?.muted ?? transport?.muted ?? (preview && !state.settings?.audioCueDeviceId)
    );
    el.muted = isMuted;

    const targetDeviceId = preview
      ? state.settings?.audioCueDeviceId
      : state.settings?.audioOutputDeviceId;
    attachAudioOutputSink(el, targetDeviceId);

    const masterVol = (state.settings?.audioMasterVolume ?? 100) / 100;
    el.volume = Math.max(0, Math.min(1, masterVol));
  }, [
    preview,
    scene?.background?.muted,
    transport?.muted,
    state.settings?.audioOutputDeviceId,
    state.settings?.audioCueDeviceId,
    state.settings?.audioMasterVolume,
  ]);

  const mode = state.outputMode || state.mode || 'fullscreen';
  const themeSection = mode === 'lowerThird' ? state.theme?.lowerThird : state.theme?.fullScreen;
  const content = contentFromScene(scene);
  const secondaryVerse = content?.secondaryVerse;
  const isCompare = Boolean(secondaryVerse?.text);
  const baseRef = (content?.reference || '').replace(/\s*\([^)]*\/[^)]*\)\s*$/, '').trim();
  const primaryVersionTag = content?.version ? content.version.split('/')[0] : '';
  const secondaryVersionTag = secondaryVerse?.version || (content?.version && content.version.includes('/') ? content.version.split('/')[1] : '');

  const hasVersionInRef = Boolean(
    content?.reference &&
      primaryVersionTag &&
      (content.reference.toLowerCase().includes(`(${primaryVersionTag.toLowerCase()})`) ||
        content.reference.toLowerCase().includes(` ${primaryVersionTag.toLowerCase()}`))
  );

  const formattedRef = content?.reference
    ? hasVersionInRef || !primaryVersionTag
      ? content.reference
      : `${content.reference} (${primaryVersionTag})`
    : '';

  const primaryRef = isCompare && primaryVersionTag && !content?.reference?.includes(`(${primaryVersionTag})`)
    ? `${baseRef} (${primaryVersionTag})`
    : formattedRef;

  const secondaryRef = isCompare && secondaryVersionTag && !secondaryVerse?.reference?.includes(`(${secondaryVersionTag})`)
    ? `${(secondaryVerse?.reference || baseRef).replace(/\s*\([^)]*\/[^)]*\)\s*$/, '').trim()} (${secondaryVersionTag})`
    : secondaryVerse?.reference;
  const video = videoSource(state, assetBaseUrl);
  const fontFamily = state.fontFamily || themeSection?.fontFamily || defaultTheme.fontFamily;
  const fontWeight = state.fontWeight || themeSection?.fontWeight || defaultTheme.fontWeight;
  const fontColor = state.fontColor || themeSection?.fontColor || defaultTheme.fontColor;
  const textAlign = state.textAlign || themeSection?.textAlign || defaultTheme.textAlign;
  
  const syncRefColor = themeSection?.syncRefColor;
  const referenceColor = syncRefColor
    ? fontColor
    : (state.referenceColor || themeSection?.referenceColor || state.theme?.lowerThird?.accentColor || defaultTheme.referenceColor);

  const shadowEnabled = themeSection?.textShadowEnabled;
  const shadowLevel = themeSection?.textShadowLevel || 'medium';
  const shadowColor = themeSection?.textShadowColor || 'rgba(0,0,0,0.85)';
  const shadowBlur = typeof themeSection?.textShadowBlur === 'number' ? themeSection.textShadowBlur : (shadowLevel === 'heavy' ? 12 : shadowLevel === 'subtle' ? 3 : 6);
  const shadowCss = shadowEnabled ? `0px 2px ${shadowBlur}px ${shadowColor}` : undefined;

  const showReference = state.showReference !== false && scene?.type !== 'presentation';
  const showStageBackground = !scene || mode === 'fullscreen';

  const textStyle: React.CSSProperties = {
    fontFamily,
    fontSize: displayFontSize({ ...state, fontSize: state.fontSize ?? themeSection?.fontSize ?? 0, outputMode: mode }, preview),
    fontWeight,
    color: fontColor,
    textAlign,
    textShadow: shadowCss,
    lineHeight: mode === 'fullscreen' ? state.theme?.fullScreen?.lineHeight : undefined,
  };
  const themeRefFontSize = mode === 'lowerThird' ? state.theme?.lowerThird?.referenceFontSize : state.theme?.fullScreen?.referenceFontSize;
  const refStyle: React.CSSProperties = {
    fontFamily,
    fontSize: referenceFontSize({ ...state, referenceFontSize: state.referenceFontSize ?? themeRefFontSize ?? 0 }, preview),
    color: referenceColor,
    fontWeight,
    textShadow: shadowCss,
  };
  const fsOffsetX = state.theme?.fullScreen?.offsetX || 0;
  const fsOffsetY = state.theme?.fullScreen?.offsetY || 0;
  const fullscreenStyle: React.CSSProperties = {
    justifyContent: fullscreenJustify(state.theme?.fullScreen?.verticalAlign),
    textAlign,
    transform: [
      fsOffsetX ? `translateX(${fsOffsetX}px)` : '',
      fsOffsetY ? `translateY(${fsOffsetY}px)` : '',
    ].filter(Boolean).join(' ') || undefined,
  };
  const refRowStyle: React.CSSProperties = {
    justifyContent: alignmentJustify(textAlign),
    textAlign,
    width: '100%',
  };

  const ltOffsetX = state.theme?.lowerThird?.offsetX || 0;
  const ltOffsetY = state.theme?.lowerThird?.offsetY || 0;
  const ltWidth = state.theme?.lowerThird?.width ?? 75;
  const ltTransform = [
    ltWidth ? 'translateX(-50%)' : '',
    ltOffsetX ? `translateX(${ltOffsetX}px)` : '',
    ltOffsetY ? `translateY(${ltOffsetY}px)` : '',
  ].filter(Boolean).join(' ') || undefined;

  const dualTextAlign = state.dualVersionTextAlign || 'left';

  return (
    <div className={`program-surface ${mode === 'lowerThird' ? 'program-surface-lt' : 'program-surface-full'} ${preview ? 'program-surface-preview' : ''} ${className}`}>
      {mode === 'fullscreen' && showStageBackground && <div className="program-surface-bg" style={backgroundStyle(state, mode, assetBaseUrl)} />}
      {mode === 'fullscreen' && showStageBackground && video && (
        <video
          ref={videoRef}
          className="program-surface-video"
          src={video}
          autoPlay
          loop={state.bgVideoLoop !== false}
          playsInline
          onPlay={() => onVideoPlayState?.(true)}
          onPause={(e) => {
            const el = e.currentTarget;
            const ranOut = el.ended
              || (Number.isFinite(el.duration) && el.duration > 0 && el.currentTime >= el.duration - 0.25);
            if (ranOut || !transport?.playing) {
              onVideoPlayState?.(false);
              return;
            }
            void el.play().catch(() => {});
          }}
          onLoadedMetadata={(e) => onVideoClock?.({
            currentTime: e.currentTarget.currentTime,
            duration: Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0,
          })}
          onTimeUpdate={(e) => onVideoClock?.({
            currentTime: e.currentTarget.currentTime,
            duration: Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0,
          })}
          style={{ objectFit: state.bgFit === 'contain' ? 'contain' : state.bgFit === 'fill' ? 'fill' : 'cover' }}
        />
      )}

      {!scene && state.showStandbyBrand !== false && (
        <div className="program-surface-standby">
          <div className="program-surface-standby-title">Bible Song Pro<sup>STUDIO</sup></div>
          <div className="program-surface-standby-sub">Waiting for signal...</div>
        </div>
      )}

      {scene && mode === 'lowerThird' && !content?.wordStudy && (
        <div
          className="program-lower-third"
          style={{
            background: state.theme?.lowerThird?.background || undefined,
            borderRadius: state.theme?.lowerThird?.borderRadius,
            width: ltWidth ? `${ltWidth}%` : undefined,
            left: ltWidth ? '50%' : undefined,
            right: ltWidth ? 'auto' : undefined,
            transform: ltTransform,
            textAlign: isCompare ? dualTextAlign : textAlign,
          }}
        >
          {isCompare ? (
            <div
              className="program-compare-lt"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '2cqw',
                width: '100%',
                alignItems: 'start',
                textAlign: dualTextAlign,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4cqw', borderRight: '1px solid rgba(255,255,255,0.18)', paddingRight: '1.5cqw' }}>
                {showReference && primaryRef && (
                  <div className="program-lt-ref" style={{ color: referenceColor, fontSize: refStyle.fontSize, textAlign: dualTextAlign }}>
                    {primaryRef}
                  </div>
                )}
                <div className="program-lt-text" style={{ ...textStyle, textAlign: dualTextAlign }}>{content?.text || ''}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4cqw', paddingLeft: '0.5cqw' }}>
                {showReference && secondaryRef && (
                  <div className="program-lt-ref" style={{ color: referenceColor, fontSize: refStyle.fontSize, textAlign: dualTextAlign }}>
                    {secondaryRef}
                  </div>
                )}
                <div className="program-lt-text" style={{ ...textStyle, textAlign: dualTextAlign }}>{secondaryVerse?.text || ''}</div>
              </div>
            </div>
          ) : (
            <>
              <div className="program-lt-text" style={textStyle}>{content?.text || ''}</div>
              {showReference && formattedRef && (
                <div className="program-lt-ref" style={{ color: referenceColor, fontSize: refStyle.fontSize, textAlign }}>
                  {formattedRef}
                </div>
              )}
              {songCredit(scene) && <div className="program-song-credit" style={{ textAlign }}>{songCredit(scene)}</div>}
            </>
          )}
        </div>
      )}

      {scene && content?.wordStudy && (
        <div
          className="program-wordstudy-layout"
          style={{
            position: 'absolute',
            inset: mode === 'lowerThird' ? 'auto 0 0 0' : '0',
            width: '100%',
            height: mode === 'lowerThird' ? 'auto' : '100%',
            maxHeight: mode === 'lowerThird' ? '85%' : '100%',
            background: 'linear-gradient(135deg, rgba(14, 14, 18, 0.98) 0%, rgba(26, 18, 14, 0.98) 100%)',
            borderTop: mode === 'lowerThird' ? '2px solid rgba(255, 85, 0, 0.5)' : 'none',
            padding: mode === 'lowerThird' ? '3cqw 5cqw' : '4cqw 5.5cqw',
            boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(30px)',
            color: '#ffffff',
            display: 'grid',
            gridTemplateColumns: mode === 'lowerThird' ? '1fr 1.6fr' : '1fr 1.35fr',
            gap: mode === 'lowerThird' ? '3cqw' : '4.5cqw',
            alignItems: 'center',
            zIndex: 30,
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          {/* LEFT COLUMN: Main Focused Word & Translation Usage Panel */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: mode === 'lowerThird' ? '1cqw' : '1.4cqw',
              alignItems: 'flex-start',
              borderRight: '1px solid rgba(255, 255, 255, 0.14)',
              paddingRight: mode === 'lowerThird' ? '3cqw' : '4.5cqw',
              height: '100%',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                fontSize: mode === 'lowerThird' ? 'clamp(32px, 5cqw, 64px)' : 'clamp(54px, 7.5cqw, 120px)',
                fontWeight: 900,
                color: '#FF5500',
                fontFamily: content.wordStudy.language === 'Hebrew' ? 'serif' : 'inherit',
                lineHeight: 1.02,
                textShadow: '0 4px 30px rgba(255, 85, 0, 0.5)',
              }}
            >
              {content.wordStudy.lemma}
            </span>
            <span
              style={{
                fontSize: mode === 'lowerThird' ? 'clamp(16px, 2.5cqw, 28px)' : 'clamp(24px, 3.2cqw, 42px)',
                fontWeight: 500,
                color: '#f4f4f5',
                fontStyle: 'italic',
              }}
            >
              / {content.wordStudy.transliteration.toLowerCase()} /
            </span>
            <span
              style={{
                fontSize: mode === 'lowerThird' ? 'clamp(13px, 1.8cqw, 22px)' : 'clamp(18px, 2.4cqw, 30px)',
                fontWeight: 800,
                padding: '0.5cqw 1.4cqw',
                borderRadius: '0.6cqw',
                background: 'rgba(255, 85, 0, 0.25)',
                color: '#FF5500',
                border: '1px solid rgba(255, 85, 0, 0.5)',
                letterSpacing: '0.04em',
              }}
            >
              {content.wordStudy.strongs} ({content.wordStudy.language})
            </span>
            <div
              style={{
                fontSize: mode === 'lowerThird' ? 'clamp(16px, 2.5cqw, 28px)' : 'clamp(24px, 3.2cqw, 42px)',
                fontWeight: 800,
                color: '#ffffff',
                lineHeight: 1.2,
              }}
            >
              {content.wordStudy.gloss}
            </div>

            {/* KJV Translation Usage Box on Left Column */}
            {content.wordStudy.kjvUsage && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4cqw', width: '100%', marginTop: '0.8cqw' }}>
                <div style={{ fontSize: mode === 'lowerThird' ? 'clamp(11px, 1.4cqw, 16px)' : 'clamp(14px, 1.8cqw, 24px)', fontWeight: 800, letterSpacing: '0.08em', color: '#FF5500' }}>
                  🏷️ KJV TRANSLATION USAGE
                </div>
                <div
                  style={{
                    background: 'rgba(255, 85, 0, 0.12)',
                    border: '1px solid rgba(255, 85, 0, 0.35)',
                    borderRadius: '0.8cqw',
                    padding: mode === 'lowerThird' ? '0.8cqw 1.4cqw' : '1.2cqw 1.8cqw',
                    fontSize: mode === 'lowerThird' ? 'clamp(14px, 2cqw, 24px)' : 'clamp(18px, 2.6cqw, 34px)',
                    color: '#ffffff',
                    fontWeight: 600,
                    lineHeight: 1.35,
                  }}
                >
                  {content.wordStudy.kjvUsage}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Derivation & Exhaustive Strong's Concordance Definition */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: mode === 'lowerThird' ? '1.5cqw' : '2.5cqw',
              justifyContent: 'center',
              overflowY: 'auto',
              maxHeight: '100%',
              paddingRight: '0.5cqw',
            }}
          >
            {/* Derivation & Etymology */}
            {content.wordStudy.etymology && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5cqw' }}>
                <div style={{ fontSize: mode === 'lowerThird' ? 'clamp(12px, 1.8cqw, 20px)' : 'clamp(16px, 2.4cqw, 30px)', fontWeight: 800, letterSpacing: '0.1em', color: '#a1a1aa' }}>
                  🔗 DERIVATION & ETYMOLOGY
                </div>
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.07)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '0.8cqw',
                    padding: mode === 'lowerThird' ? '1cqw 1.8cqw' : '1.4cqw 2.2cqw',
                    fontSize: mode === 'lowerThird' ? 'clamp(16px, 2.5cqw, 28px)' : 'clamp(20px, 3cqw, 38px)',
                    fontStyle: 'italic',
                    color: '#ffffff',
                  }}
                >
                  {content.wordStudy.etymology}
                </div>
              </div>
            )}

            {/* Strong's Definition */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5cqw' }}>
              <div style={{ fontSize: mode === 'lowerThird' ? 'clamp(12px, 1.8cqw, 20px)' : 'clamp(16px, 2.4cqw, 30px)', fontWeight: 800, letterSpacing: '0.1em', color: '#a1a1aa' }}>
                📖 STRONGS DEFINITION
              </div>
              <div
                style={{
                  fontSize: mode === 'lowerThird' ? 'clamp(16px, 2.8cqw, 32px)' : 'clamp(24px, 3.8cqw, 48px)',
                  lineHeight: 1.45,
                  color: '#ffffff',
                  fontFamily: 'serif',
                  fontWeight: 500,
                }}
              >
                {content.wordStudy.definition}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* A designed slide is the whole picture: it carries its own background,
          type and layout, so it goes edge to edge and the theme's text styling
          sits this one out. Lower third keeps the text — a whole slide crammed
          into a strap across the bottom is nobody's intent. */}
      {scene && mode === 'fullscreen' && content?.slide && !content?.wordStudy && (
        <SlideStage projection={content.slide} className="program-slide-stage" />
      )}

      {scene && mode === 'fullscreen' && !content?.slide && !content?.wordStudy && (
        <div className="program-fullscreen-content" style={fullscreenStyle}>
          {content?.html ? (
            <div className="program-slide-html" dangerouslySetInnerHTML={{ __html: content.html }} />
          ) : isCompare ? (
            <div className="program-compare" style={{ textAlign: dualTextAlign }}>
              <div className="program-compare-pane" style={{ textAlign: dualTextAlign }}>
                <div className="program-ref-row" style={{ ...refRowStyle, justifyContent: alignmentJustify(dualTextAlign), textAlign: dualTextAlign }}>
                  {showReference && primaryRef && <span style={{ ...refStyle, textAlign: dualTextAlign }}>{primaryRef}</span>}
                </div>
                <div className="program-main-text" style={{ ...textStyle, textAlign: dualTextAlign }}>{content?.text || ''}</div>
              </div>
              <div className="program-compare-divider" />
              <div className="program-compare-pane" style={{ textAlign: dualTextAlign }}>
                <div className="program-ref-row" style={{ ...refRowStyle, justifyContent: alignmentJustify(dualTextAlign), textAlign: dualTextAlign }}>
                  {showReference && secondaryRef && <span style={{ ...refStyle, textAlign: dualTextAlign }}>{secondaryRef}</span>}
                </div>
                <div className="program-main-text" style={{ ...textStyle, textAlign: dualTextAlign }}>{secondaryVerse?.text || ''}</div>
              </div>
            </div>
          ) : (
            <>
              {showReference && formattedRef && (
                <div className="program-ref-row" style={refRowStyle}>
                  <span style={refStyle}>{formattedRef}</span>
                </div>
              )}
              <div className="program-main-text" style={textStyle}>{content?.text || ''}</div>
              {songCredit(scene) && <div className="program-song-credit">{songCredit(scene)}</div>}
            </>
          )}
        </div>
      )}

      {state.activeAlert && (
        <div className={`program-alert program-alert-${state.activeAlert.type} program-alert-${state.activeAlert.position || 'bottom'}`}>
          <div className="program-alert-track">
            <span
              className="program-alert-text"
              style={{
                animationDuration: `${16 / (state.activeAlert.speed || 1)}s`,
              }}
            >
              {state.activeAlert.text}
            </span>
          </div>
        </div>
      )}
      {state.blackout && <div className="program-blackout" />}
    </div>
  );
});
