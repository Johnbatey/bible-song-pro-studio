import type { Alert, Scene, SourceDocument, FullScreenTheme, LowerThirdTheme, Theme, VideoTransport, AppSettings, Background } from '../../types';
import type { SceneTransitionType } from '../../types/transition';
import { memo, useEffect, useRef, useState, useMemo, Fragment } from 'react';
import type React from 'react';
import { SlideStage } from './SlideStage';
import { attachAudioOutputSink } from '../../utils/audio-output';
import { formatBibleReference } from '../../utils/bible-abbreviations';
import { assetUrl } from '../../utils/asset-url';
import './ProgramSurface.css';

export { assetUrl };

export interface TypedWordTextProps {
  text: string;
  duration: number; // in seconds
  style?: React.CSSProperties;
  className?: string;
  textAlign?: 'left' | 'center' | 'right';
}

export function TypedWordText({ text, duration, style, className, textAlign }: TypedWordTextProps) {
  const [visibleCount, setVisibleCount] = useState(0);

  const lines = useMemo(() => {
    if (!text) return [];
    return text.replace(/<br\s*\/?>/gi, '\n').split('\n').map((line) => {
      const parts = line.split(/(\s+)/);
      return parts.map((part) => ({
        text: part,
        isSpace: /^\s+$/.test(part),
      }));
    });
  }, [text]);

  const totalWords = useMemo(() => {
    let count = 0;
    lines.forEach((line) => {
      line.forEach((part) => {
        if (!part.isSpace && part.text.length > 0) count++;
      });
    });
    return count;
  }, [lines]);

  useEffect(() => {
    if (totalWords === 0) {
      setVisibleCount(0);
      return;
    }
    const durationMs = Math.max(100, (duration || 0.8) * 1000);
    const startTime = performance.now();
    let rafId: number;

    const tick = (now: number) => {
      const elapsed = Math.max(0, now - startTime);
      const progress = Math.min(1, elapsed / durationMs);
      const count = Math.ceil(progress * totalWords);
      setVisibleCount(count);
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [text, duration, totalWords]);

  let currentWordIdx = 0;

  return (
    <div className={`typed-words-wrapper ${className || ''}`} style={{ width: '100%', textAlign, ...style }}>
      {lines.map((line, lineIdx) => (
        <div key={lineIdx} className="type-line" style={{ display: 'block', margin: 0, lineHeight: 'inherit', textAlign }}>
          {line.map((part, partIdx) => {
            if (part.isSpace) {
              return <Fragment key={partIdx}>{part.text}</Fragment>;
            }
            const wordIdx = currentWordIdx++;
            const isRevealed = wordIdx < visibleCount;
            return (
              <span
                key={partIdx}
                className={`type-word ${isRevealed ? 'revealed-word' : 'hidden-word'}`}
                style={{
                  display: 'inline-block',
                  whiteSpace: 'pre',
                  opacity: isRevealed ? 1 : 0,
                  visibility: isRevealed ? 'visible' : 'hidden',
                  transition: 'opacity 0.22s ease',
                }}
              >
                {part.text}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export interface SlideTransitionContainerProps {
  currentSlide: any;
  sceneId: string;
  transition?: { type?: string; duration?: number; animateBackground?: boolean } | null;
  defaultDuration?: number;
}

export function SlideTransitionContainer({
  currentSlide,
  sceneId,
  transition,
  defaultDuration = 0.5,
}: SlideTransitionContainerProps) {
  const [activeSlide, setActiveSlide] = useState<{ id: string; projection: any }>({
    id: sceneId,
    projection: currentSlide,
  });
  const [outgoingSlide, setOutgoingSlide] = useState<{
    id: string;
    projection: any;
    transitionType: string;
    durationSec: number;
  } | null>(null);

  const prevSceneIdRef = useRef<string | null>(sceneId);
  const prevSlideRef = useRef<any>(currentSlide);

  useEffect(() => {
    if (sceneId !== prevSceneIdRef.current) {
      const type = transition?.type || "fade";
      const durationSec =
        typeof transition?.duration === "number" && transition.duration > 0
          ? transition.duration
          : defaultDuration;

      if (type === "cut" || !prevSlideRef.current) {
        setActiveSlide({ id: sceneId, projection: currentSlide });
        setOutgoingSlide(null);
      } else {
        setOutgoingSlide({
          id: prevSceneIdRef.current || "prev-slide",
          projection: prevSlideRef.current,
          transitionType: type,
          durationSec,
        });
        setActiveSlide({ id: sceneId, projection: currentSlide });

        const timer = setTimeout(() => {
          setOutgoingSlide(null);
        }, Math.max(100, Math.round(durationSec * 1000) + 40));

        prevSceneIdRef.current = sceneId;
        prevSlideRef.current = currentSlide;
        return () => clearTimeout(timer);
      }

      prevSceneIdRef.current = sceneId;
      prevSlideRef.current = currentSlide;
    } else {
      setActiveSlide({ id: sceneId, projection: currentSlide });
      prevSlideRef.current = currentSlide;
    }
  }, [sceneId, currentSlide, transition, defaultDuration]);

  const transType = outgoingSlide ? outgoingSlide.transitionType : (transition?.type || "fade");
  const durSec = outgoingSlide ? outgoingSlide.durationSec : (typeof transition?.duration === "number" ? transition.duration : defaultDuration);
  const timing = `${durSec}s cubic-bezier(0.16, 1, 0.3, 1) both`;

  let incomingAnim = "none";
  let outgoingAnim = "none";

  if (outgoingSlide) {
    switch (transType) {
      case "fade":
        incomingAnim = `bsp-slide-fade-in ${durSec}s ease-in-out both`;
        outgoingAnim = "none";
        break;
      case "slide-left":
      case "push-left":
        incomingAnim = `bsp-slide-push-in-left ${timing}`;
        outgoingAnim = `bsp-slide-push-out-left ${timing}`;
        break;
      case "slide-right":
      case "push-right":
        incomingAnim = `bsp-slide-push-in-right ${timing}`;
        outgoingAnim = `bsp-slide-push-out-right ${timing}`;
        break;
      case "slide-up":
      case "push-up":
        incomingAnim = `bsp-slide-push-in-up ${timing}`;
        outgoingAnim = `bsp-slide-push-out-up ${timing}`;
        break;
      case "slide-down":
      case "push-down":
        incomingAnim = `bsp-slide-push-in-down ${timing}`;
        outgoingAnim = `bsp-slide-push-out-down ${timing}`;
        break;
      case "zoom":
        incomingAnim = `bsp-slide-zoom-in ${timing}`;
        outgoingAnim = "none";
        break;
      default:
        incomingAnim = `bsp-slide-fade-in ${durSec}s ease-in-out both`;
        outgoingAnim = "none";
        break;
    }
  }

  return (
    <div className="program-slide-transition-container">
      {outgoingSlide && (
        <div
          key={`out-${outgoingSlide.id}`}
          className="program-slide-layer outgoing"
          style={{ animation: outgoingAnim }}
        >
          <SlideStage projection={outgoingSlide.projection} className="program-slide-stage" />
        </div>
      )}

      <div
        key={`in-${activeSlide.id}`}
        className="program-slide-layer incoming"
        style={{ animation: outgoingSlide ? incomingAnim : "none" }}
      >
        <SlideStage projection={activeSlide.projection} className="program-slide-stage" />
      </div>
    </div>
  );
}


function getTransitionStyle(
  type: SceneTransitionType | string,
  progress: number,
): { incoming: React.CSSProperties; outgoing?: React.CSSProperties } {
  switch (type) {
    case 'cut':
      return {
        incoming: { opacity: 1 },
        outgoing: { opacity: 0 },
      };
    case 'fade':
    case 'crossfade':
      return {
        incoming: { opacity: progress },
        outgoing: { opacity: 1 - progress },
      };
    case 'slide-left':
      return {
        incoming: { transform: `translateX(${(1 - progress) * 100}%)` },
        outgoing: { transform: `translateX(${-progress * 100}%)` },
      };
    case 'slide-right':
      return {
        incoming: { transform: `translateX(${-(1 - progress) * 100}%)` },
        outgoing: { transform: `translateX(${progress * 100}%)` },
      };
    case 'slide-up':
      return {
        incoming: { transform: `translateY(${(1 - progress) * 100}%)` },
        outgoing: { transform: `translateY(${progress * -100}%)` },
      };
    case 'slide-down':
      return {
        incoming: { transform: `translateY(${(1 - progress) * -100}%)` },
        outgoing: { transform: `translateY(${progress * 100}%)` },
      };
    case 'push-left':
      return {
        incoming: { transform: `translateX(${(1 - progress) * 100}%)` },
        outgoing: { transform: `translateX(${progress * -100}%)` },
      };
    case 'push-right':
      return {
        incoming: { transform: `translateX(${(1 - progress) * -100}%)` },
        outgoing: { transform: `translateX(${progress * 100}%)` },
      };
    case 'zoom-in':
      return {
        incoming: {
          transform: `scale(${0.8 + progress * 0.2})`,
          opacity: progress,
        },
        outgoing: {
          transform: `scale(${1 + progress * 0.2})`,
          opacity: 1 - progress,
        },
      };
    case 'zoom-out':
      return {
        incoming: {
          opacity: progress,
          transform: `scale(${1.5 - progress * 0.5})`,
          transformOrigin: 'center center',
          mixBlendMode: 'plus-lighter',
        },
        outgoing: {
          opacity: 1 - progress,
        },
      };
    case 'luma-wipe':
      return {
        incoming: {
          opacity: progress,
          mixBlendMode: 'plus-lighter',
        },
        outgoing: {
          opacity: 1 - progress,
        },
      };
    default:
      return {
        incoming: {
          opacity: progress,
          mixBlendMode: 'plus-lighter',
        },
        outgoing: {
          opacity: 1 - progress,
        },
      };
  }
}

export function resolveFxAnimation(
  transition?: { type?: string; duration?: number; animateBackground?: boolean } | null,
  sceneAnimateBg?: boolean,
  stateAnimateBg?: boolean
) {
  const type = transition?.type || 'fade';
  const durationSec = typeof transition?.duration === 'number' && transition.duration > 0 ? transition.duration : 0.4;
  const animateBg = transition?.animateBackground ?? sceneAnimateBg ?? stateAnimateBg ?? false;

  if (type === 'cut') {
    return {
      name: 'none',
      durationSec: 0,
      duration: '0s',
      css: 'none',
      animateBg: false,
      isWordType: false,
    };
  }

  if (type === 'type-words') {
    return {
      name: 'type-words',
      durationSec,
      duration: `${durationSec}s`,
      css: 'none',
      animateBg,
      isWordType: true,
    };
  }

  if (type === 'zoom-type-words') {
    return {
      name: 'zoom-type-words',
      durationSec,
      duration: `${durationSec}s`,
      css: `bsp-anim-zoom ${durationSec}s cubic-bezier(0.16, 1, 0.3, 1) both`,
      animateBg,
      isWordType: true,
    };
  }

  let animName = 'bsp-anim-fade';
  if (type === 'zoom') animName = 'bsp-anim-zoom';
  else if (type === 'slide-up') animName = 'bsp-anim-slide-up';
  else if (type === 'slide-down') animName = 'bsp-anim-slide-down';
  else if (type === 'slide-left') animName = 'bsp-anim-slide-left';
  else if (type === 'slide-right') animName = 'bsp-anim-slide-right';
  else if (type === 'type') animName = 'bsp-anim-type';
  else if (type === 'zoom-type') animName = 'bsp-anim-zoom-type';

  return {
    name: animName,
    durationSec,
    duration: `${durationSec}s`,
    css: `${animName} ${durationSec}s cubic-bezier(0.16, 1, 0.3, 1) both`,
    animateBg,
    isWordType: false,
  };
}

export interface ProgramSurfaceState {
  scene?: Scene | null;
    sources?: Record<string, SourceDocument>;
  transition?: { active: boolean; type: string; progress: number } | null;
  animateBackground?: boolean;
  fxAnimation?: { transitionType: string; duration: number; animateBackground: boolean; stageDisplayFxEnabled?: boolean; };
    outputMode?: 'fullscreen' | 'lowerThird';
  theme?: Theme | null;
  activeAlert?: Alert | null;
  transcription?: string;
  blackout?: boolean;
  settings?: Partial<AppSettings>;
  /**
   * Whether an idle screen shows standby media. Turn off to leave screens black between items.
   */
  showStandbyBrand?: boolean;
  standbyMedia?: { url: string; type: 'image' | 'video'; name?: string } | null;
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
  isExternalDisplay?: boolean;
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

export function resolveEffectiveTheme(theme: Theme | null | undefined, sceneType?: string): Theme | undefined {
  if (!theme) return undefined;
  if (theme.linkBibleSong === false) {
    if (sceneType === 'song') {
      return {
        ...theme,
        fullScreen: theme.songFullScreen || theme.fullScreen,
        lowerThird: theme.songLowerThird || theme.lowerThird,
      };
    }
    if (sceneType === 'bible') {
      return {
        ...theme,
        fullScreen: theme.bibleFullScreen || theme.fullScreen,
        lowerThird: theme.bibleLowerThird || theme.lowerThird,
      };
    }
  }
  return theme;
}

function backgroundStyle(state: ProgramSurfaceState, mode: 'fullscreen' | 'lowerThird', assetBaseUrl?: string): React.CSSProperties {
  if (mode === 'lowerThird') {
    return { backgroundColor: 'transparent', backgroundImage: 'none' };
  }
  // When cleared or taken down (no active scene), keep background completely transparent/blank
  if (!state.scene && !state.bgCustomImage && (!state.bgFill || state.bgFill === 'transparent')) {
    return { backgroundColor: 'transparent', backgroundImage: 'none' };
  }
  const activeTheme = resolveEffectiveTheme(state.theme, state.scene?.type);
  if (!state.scene && !activeTheme) {
    return { backgroundColor: 'transparent', backgroundImage: 'none' };
  }
  const rawFit = state.bgFit || state.scene?.background?.fit || (state.scene?.type === 'media' ? 'contain' : 'cover');
  const fit = rawFit === 'fill' ? '100% 100%' : rawFit;
  const opacity = typeof state.bgOpacity === 'number' ? state.bgOpacity : 1;
  const style: React.CSSProperties = {
    backgroundColor: 'transparent',
    backgroundSize: fit,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    opacity,
  };

  if (state.bgCustomImage) {
    style.backgroundImage = `url("${assetUrl(state.bgCustomImage, assetBaseUrl).replace(/"/g, '%22')}")`;
  } else if (state.bgFill) {
    if (state.bgFill === 'transparent') {
      style.backgroundColor = 'transparent';
      style.backgroundImage = 'none';
    } else if (state.bgFill.includes('gradient')) {
      style.backgroundImage = state.bgFill;
    } else {
      style.backgroundColor = state.bgFill;
    }
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
    const sceneSolid = (bg?.type === 'solid' || (bg?.type as string) === 'color') && bg?.color;
    const sceneTransparent = bg?.type === 'transparent';
    const themeFs = activeTheme?.fullScreen;

    if (sceneImage && bg?.mediaUrl) {
      style.backgroundImage = `url("${assetUrl(bg.mediaUrl as string, assetBaseUrl).replace(/"/g, '%22')}")`;
      if (typeof bg.opacity === 'number') {
        style.opacity = bg.opacity;
      }
    } else if (sceneGradient && bg?.gradient) {
      style.backgroundImage = bg.gradient as string;
      if (typeof bg.opacity === 'number') {
        style.opacity = bg.opacity;
      }
    } else if (sceneSolid && bg?.color) {
      style.backgroundColor = bg.color as string;
      if (typeof bg.opacity === 'number') {
        style.opacity = bg.opacity;
      }
    } else if (sceneTransparent) {
      style.backgroundColor = 'transparent';
      style.backgroundImage = 'none';
      /* A video scene paints no colour here — videoSource() supplies the frame
         and a fill underneath it would only show during the load. */
    } else if (bg?.type === 'video' && bg?.mediaUrl) {
      style.backgroundColor = '#000';
    } else if (themeFs?.backgroundMediaType === 'image' && themeFs.backgroundMediaUrl) {
      style.backgroundImage = `url("${assetUrl(themeFs.backgroundMediaUrl, assetBaseUrl).replace(/"/g, '%22')}")`;
      if (themeFs.backgroundFit) {
        style.backgroundSize = themeFs.backgroundFit === 'fill' ? '100% 100%' : themeFs.backgroundFit;
      }
      if (typeof themeFs.backgroundOpacity === 'number') {
        style.opacity = themeFs.backgroundOpacity;
      }
    } else if (themeFs?.backgroundMediaType === 'video' && themeFs.backgroundMediaUrl) {
      style.backgroundColor = '#000';
      if (typeof themeFs.backgroundOpacity === 'number') {
        style.opacity = themeFs.backgroundOpacity;
      }
    } else if (themeFs?.backgroundType === 'transparent' || themeFs?.background === 'transparent' || themeFs?.backgroundColor === 'transparent') {
      style.backgroundColor = 'transparent';
      style.backgroundImage = 'none';
      if (typeof themeFs?.backgroundOpacity === 'number') {
        style.opacity = themeFs.backgroundOpacity;
      }
    } else if (themeFs?.background) {
      if (themeFs.background.includes('gradient')) style.backgroundImage = themeFs.background;
      else style.backgroundColor = themeFs.background;
      if (typeof themeFs.backgroundOpacity === 'number') {
        style.opacity = themeFs.backgroundOpacity;
      }
    } else if (themeFs?.backgroundColor) {
      style.backgroundColor = themeFs.backgroundColor;
      if (typeof themeFs.backgroundOpacity === 'number') {
        style.opacity = themeFs.backgroundOpacity;
      }
    } else {
      style.backgroundColor = '#000000';
    }
  }

  return style;
}

function lowerThirdBandStyle(lt: LowerThirdTheme | undefined, sceneBg?: Background, assetBaseUrl?: string): React.CSSProperties {
  let style: React.CSSProperties = {};
  if (sceneBg && sceneBg.type && (sceneBg.type as string) !== 'theme') {
    if (sceneBg.type === 'solid' || (sceneBg.type as string) === 'color') {
      style = {
        backgroundColor: sceneBg.color || '#000000',
        backgroundImage: 'none',
      };
    } else if (sceneBg.type === 'gradient' && sceneBg.gradient) {
      style = {
        backgroundImage: sceneBg.gradient,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    } else if (sceneBg.type === 'image' && sceneBg.mediaUrl) {
      const mediaUrl = assetUrl(sceneBg.mediaUrl, assetBaseUrl);
      const fit = sceneBg.fit === 'fill' ? '100% 100%' : (sceneBg.fit || 'cover');
      style = {
        backgroundColor: '#000000',
        backgroundImage: `url("${mediaUrl.replace(/"/g, '%22')}")`,
        backgroundSize: fit,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      };
    } else if (sceneBg.type === 'video' && sceneBg.mediaUrl) {
      style = {
        backgroundColor: '#000000',
        backgroundImage: 'none',
      };
    } else if (sceneBg.type === 'transparent') {
      style = { background: 'transparent', backgroundColor: 'transparent', backgroundImage: 'none' };
    }
    if (typeof sceneBg.opacity === 'number') {
      style.opacity = sceneBg.opacity;
    }
    return style;
  }

  const mediaUrl = lt?.backgroundMediaUrl ? assetUrl(lt.backgroundMediaUrl, assetBaseUrl) : '';
  const hasImage = Boolean(mediaUrl && lt?.backgroundMediaType === 'image');
  const hasVideo = Boolean(mediaUrl && lt?.backgroundMediaType === 'video');
  const fit = lt?.backgroundFit === 'fill' ? '100% 100%' : (lt?.backgroundFit || 'cover');

  if (hasImage) {
    style = {
      backgroundColor: '#000000',
      backgroundImage: `url("${mediaUrl.replace(/"/g, '%22')}")`,
      backgroundSize: fit,
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    };
  } else if (hasVideo) {
    style = { backgroundColor: '#000000', backgroundImage: 'none' };
  } else if (lt?.backgroundType === 'transparent' || lt?.background === 'transparent' || lt?.backgroundColor === 'transparent') {
    style = { background: 'transparent', backgroundColor: 'transparent', backgroundImage: 'none' };
  } else if (lt?.background) {
    if (lt.background.includes('gradient')) style = { backgroundImage: lt.background, backgroundSize: 'cover', backgroundPosition: 'center' };
    else style = { backgroundColor: lt.background };
  } else if (lt?.backgroundColor) {
    style = { backgroundColor: lt.backgroundColor };
  } else {
    style = { background: 'linear-gradient(135deg, rgba(10, 18, 32, .94), rgba(37, 52, 78, .94))' };
  }

  if (typeof lt?.backgroundOpacity === 'number') {
    style.opacity = lt.backgroundOpacity;
  }

  return style;
}

function lowerThirdBandMedia(
  lt: LowerThirdTheme | undefined,
  sceneBg?: Background,
  assetBaseUrl?: string,
  animateBg?: boolean,
  animCss?: string
) {
  const animStyle = animateBg ? { animation: animCss } : { animation: 'none' };
  if (sceneBg && sceneBg.type === 'video' && sceneBg.mediaUrl) {
    const mediaUrl = assetUrl(sceneBg.mediaUrl, assetBaseUrl);
    const fit = sceneBg.fit === 'contain' ? 'contain' : sceneBg.fit === 'fill' ? 'fill' : 'cover';
    return (
      <video
        key={animateBg ? `${sceneBg.mediaUrl}-lt-video` : 'static-lt-video'}
        className="program-lt-media"
        src={mediaUrl}
        autoPlay
        muted
        loop={sceneBg.loop !== false}
        playsInline
        style={{ objectFit: fit, opacity: typeof sceneBg.opacity === 'number' ? sceneBg.opacity : 1, ...animStyle }}
      />
    );
  }

  if (sceneBg && sceneBg.type && (sceneBg.type as string) !== 'theme') {
    return null;
  }

  const mediaUrl = lt?.backgroundMediaUrl ? assetUrl(lt.backgroundMediaUrl, assetBaseUrl) : '';
  if (!mediaUrl || lt?.backgroundMediaType !== 'video') return null;
  const fit = lt.backgroundFit === 'contain' ? 'contain' : lt.backgroundFit === 'fill' ? 'fill' : 'cover';
  return (
    <video
      key={animateBg ? `${mediaUrl}-lt-video` : 'static-lt-video'}
      className="program-lt-media"
      src={mediaUrl}
      autoPlay
      muted
      loop={lt.backgroundLoop !== false}
      playsInline
      style={{ objectFit: fit, opacity: typeof lt?.backgroundOpacity === 'number' ? lt.backgroundOpacity : 1, ...animStyle }}
    />
  );
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
    const activeTheme = resolveEffectiveTheme(state.theme, state.scene?.type);
    const themeFs = activeTheme?.fullScreen;
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
  const [videoLoadError, setVideoLoadError] = useState(false);
  const video = videoSource(state, assetBaseUrl);

  useEffect(() => {
    setVideoLoadError(false);
  }, [video]);
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
  const activeTheme = resolveEffectiveTheme(state.theme, scene?.type);
  const themeSection = mode === 'lowerThird' ? activeTheme?.lowerThird : activeTheme?.fullScreen;
  const content = contentFromScene(scene);
  const secondaryVerse = content?.secondaryVerse;
  const isCompare = Boolean(secondaryVerse?.text);
  const baseRef = (content?.reference || '').replace(/\s*\([^)]*\/[^)]*\)\s*$/, '').trim();
  const primaryVersionTag = content?.version ? content.version.split('/')[0] : '';
  const secondaryVersionTag = secondaryVerse?.version || (content?.version && content.version.includes('/') ? content.version.split('/')[1] : '');

  const bibleOptions = activeTheme?.bibleOptions;
  const showVersion = state.showTranslation !== undefined ? state.showTranslation : (bibleOptions?.showVersion !== false);
  const refOptions = {
    showVersion,
    shortenVersions: bibleOptions?.shortenVersions !== false,
    shortenBooks: Boolean(bibleOptions?.shortenBooks),
  };

  const formattedRef = content?.reference
    ? formatBibleReference(content.reference, primaryVersionTag, refOptions)
    : '';

  const primaryRef = isCompare
    ? formatBibleReference(content?.reference || baseRef, primaryVersionTag, refOptions)
    : formattedRef;

  const secondaryRef = isCompare
    ? formatBibleReference(secondaryVerse?.reference || baseRef, secondaryVersionTag, refOptions)
    : (secondaryVerse?.reference ? formatBibleReference(secondaryVerse.reference, secondaryVersionTag, refOptions) : undefined);
  const fontFamily = state.fontFamily || themeSection?.fontFamily || defaultTheme.fontFamily;
  const fontWeight = state.fontWeight || themeSection?.fontWeight || defaultTheme.fontWeight;
  const fontColor = state.fontColor || themeSection?.fontColor || defaultTheme.fontColor;
  const textAlign = state.textAlign || themeSection?.textAlign || defaultTheme.textAlign;
  
  const syncRefColor = themeSection?.syncRefColor;
  const referenceColor = syncRefColor
    ? fontColor
    : (state.referenceColor || themeSection?.referenceColor || activeTheme?.lowerThird?.accentColor || defaultTheme.referenceColor);

  const shadowEnabled = themeSection?.textShadowEnabled;
  const shadowLevel = themeSection?.textShadowLevel || 'medium';
  const shadowColor = themeSection?.textShadowColor || 'rgba(0,0,0,0.85)';
  const shadowBlur = typeof themeSection?.textShadowBlur === 'number' ? themeSection.textShadowBlur : (shadowLevel === 'heavy' ? 12 : shadowLevel === 'subtle' ? 3 : 6);
  const shadowCss = shadowEnabled ? `0px 2px ${shadowBlur}px ${shadowColor}` : undefined;

  const showReference = state.showReference !== false && scene?.type !== 'presentation' && scene?.type !== 'song';
  const showStageBackground = !scene || mode === 'fullscreen';

  const textStyle: React.CSSProperties = {
    fontFamily,
    fontSize: displayFontSize({ ...state, fontSize: state.fontSize ?? themeSection?.fontSize ?? 0, outputMode: mode }, preview),
    fontWeight,
    color: fontColor,
    textAlign,
    textShadow: shadowCss,
    lineHeight: mode === 'fullscreen' ? activeTheme?.fullScreen?.lineHeight : undefined,
  };
  const themeRefFontSize = mode === 'lowerThird' ? activeTheme?.lowerThird?.referenceFontSize : activeTheme?.fullScreen?.referenceFontSize;
  const refStyle: React.CSSProperties = {
    fontFamily,
    fontSize: referenceFontSize({ ...state, referenceFontSize: state.referenceFontSize ?? themeRefFontSize ?? 0 }, preview),
    color: referenceColor,
    fontWeight,
    textShadow: shadowCss,
  };
  const fxAnim = resolveFxAnimation(
    scene?.transition || state.fxAnimation || (state as any).transitionConfig,
    scene?.animateBackground,
    state.animateBackground
  );

  const fsOffsetX = activeTheme?.fullScreen?.offsetX || 0;
  const fsOffsetY = activeTheme?.fullScreen?.offsetY || 0;
  const fullscreenStyle: React.CSSProperties = {
    justifyContent: fullscreenJustify(activeTheme?.fullScreen?.verticalAlign),
    textAlign,
    transform: [
      fsOffsetX ? `translateX(${fsOffsetX}px)` : '',
      fsOffsetY ? `translateY(${fsOffsetY}px)` : '',
    ].filter(Boolean).join(' ') || undefined,
    animation: fxAnim.css,
  };
  const refRowStyle: React.CSSProperties = {
    justifyContent: alignmentJustify(textAlign),
    textAlign,
    width: '100%',
  };

  const ltPos = activeTheme?.lowerThird?.position || 'bottom-center';
  const isTop = ltPos.startsWith('top') || activeTheme?.lowerThird?.anchor === 'top';
  const isLeft = ltPos.includes('left');
  const isRight = ltPos.includes('right');
  const isCentered = !isLeft && !isRight;

  const ltOffsetX = activeTheme?.lowerThird?.offsetX ?? 0;
  const ltOffsetY = activeTheme?.lowerThird?.offsetY ?? 0;
  const ltWidth = activeTheme?.lowerThird?.width ?? 75;

  let ltLeft: string | undefined = undefined;
  let ltRight: string | undefined = undefined;
  let baseTranslateX = '';

  if (isCentered) {
    ltLeft = '50%';
    baseTranslateX = 'translateX(-50%)';
  } else if (isLeft) {
    ltLeft = '4%';
    ltRight = 'auto';
  } else if (isRight) {
    ltRight = '4%';
    ltLeft = 'auto';
  }

  const ltTransform = [
    baseTranslateX,
    ltOffsetX ? `translateX(${ltOffsetX}px)` : '',
    ltOffsetY ? `translateY(${ltOffsetY}px)` : '',
  ].filter(Boolean).join(' ') || undefined;

  const dualTextAlign = state.dualVersionTextAlign || 'left';
  const transStyle = state.transition?.active
    ? getTransitionStyle(state.transition.type, state.transition.progress)
    : null;

  return (
    <div className={`program-surface ${mode === 'lowerThird' ? 'program-surface-lt' : 'program-surface-full'} ${preview ? 'program-surface-preview' : ''} ${className}`}>
      {mode === 'fullscreen' && showStageBackground && (
        <div
          key={fxAnim.animateBg ? (scene?.id ? `${scene.id}-fs-bg` : 'fs-bg') : 'static-fs-bg'}
          className="program-surface-bg"
          style={{
            ...backgroundStyle(state, mode, assetBaseUrl),
            ...(fxAnim.animateBg ? { animation: fxAnim.css } : { animation: 'none' }),
          }}
        />
      )}
      {mode === 'fullscreen' && showStageBackground && video && !videoLoadError && (
        <video
          key={fxAnim.animateBg ? (scene?.id ? `${scene.id}-fs-video` : 'fs-video') : 'static-fs-video'}
          ref={videoRef}
          className="program-surface-video"
          src={video}
          autoPlay
          loop={state.bgVideoLoop !== false}
          playsInline
          onError={(e) => {
            console.warn('[ProgramSurface] Failed to load background video source, gracefully falling back to theme ground:', video, e);
            setVideoLoadError(true);
          }}
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
          style={{
            objectFit: (state.bgFit || state.scene?.background?.fit || (state.scene?.type === 'media' ? 'contain' : 'cover')) === 'contain'
              ? 'contain'
              : (state.bgFit || state.scene?.background?.fit || (state.scene?.type === 'media' ? 'contain' : 'cover')) === 'fill'
              ? 'fill'
              : 'cover',
            ...(fxAnim.animateBg ? { animation: fxAnim.css } : { animation: 'none' }),
          }}
        />
      )}

      {!scene && Boolean(state.standbyMedia?.url) && (
        state.standbyMedia!.type === 'video' ? (
          <video
            src={assetUrl(state.standbyMedia!.url, assetBaseUrl)}
            autoPlay
            loop
            muted
            playsInline
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              zIndex: 2,
            }}
          />
        ) : (
          <img
            src={assetUrl(state.standbyMedia!.url, assetBaseUrl)}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              zIndex: 2,
            }}
          />
        )
      )}

      {scene && mode === 'lowerThird' && !content?.wordStudy && (
        <div
          className="program-lower-third"
          style={{
            borderRadius: typeof activeTheme?.lowerThird?.borderRadius === 'number' ? `${activeTheme.lowerThird.borderRadius}px` : undefined,
            width: ltWidth ? `${ltWidth}%` : undefined,
            left: ltLeft,
            right: ltRight,
            top: isTop ? '5%' : undefined,
            bottom: isTop ? 'auto' : '5%',
            transform: ltTransform,
            textAlign: isCompare ? dualTextAlign : textAlign,
            background: 'transparent',
            padding: typeof activeTheme?.lowerThird?.padding === 'number' ? `${activeTheme.lowerThird.padding}px` : undefined,
          }}
        >
          <div
            key={fxAnim.animateBg ? (scene?.id ? `${scene.id}-lt-bg` : 'lt-bg') : 'static-lt-bg'}
            className="program-lt-bg-layer"
            style={{
              borderRadius: typeof activeTheme?.lowerThird?.borderRadius === 'number' ? `${activeTheme.lowerThird.borderRadius}px` : undefined,
              ...lowerThirdBandStyle(activeTheme?.lowerThird, scene?.background, assetBaseUrl),
              ...(fxAnim.animateBg ? { animation: fxAnim.css } : { animation: 'none' }),
            }}
          />
          {lowerThirdBandMedia(activeTheme?.lowerThird, scene?.background, assetBaseUrl, fxAnim.animateBg, fxAnim.css)}
          <div
            key={scene?.id ? `${scene.id}-lt-content` : 'lt-content'}
            className="program-lt-content"
            style={{
              animation: fxAnim.css,
              width: '100%',
              position: 'relative',
              zIndex: 1,
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
                  {fxAnim.isWordType ? (
                    <TypedWordText text={content?.text || ''} duration={fxAnim.durationSec} style={{ ...textStyle, textAlign: dualTextAlign }} textAlign={dualTextAlign} />
                  ) : (
                    <div className="program-lt-text" style={{ ...textStyle, textAlign: dualTextAlign }}>{content?.text || ''}</div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4cqw', paddingLeft: '0.5cqw' }}>
                  {showReference && secondaryRef && (
                    <div className="program-lt-ref" style={{ color: referenceColor, fontSize: refStyle.fontSize, textAlign: dualTextAlign }}>
                      {secondaryRef}
                    </div>
                  )}
                  {fxAnim.isWordType ? (
                    <TypedWordText text={secondaryVerse?.text || ''} duration={fxAnim.durationSec} style={{ ...textStyle, textAlign: dualTextAlign }} textAlign={dualTextAlign} />
                  ) : (
                    <div className="program-lt-text" style={{ ...textStyle, textAlign: dualTextAlign }}>{secondaryVerse?.text || ''}</div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {fxAnim.isWordType ? (
                  <TypedWordText text={content?.text || ''} duration={fxAnim.durationSec} style={textStyle} textAlign={textAlign} />
                ) : (
                  <div className="program-lt-text" style={textStyle}>
                    {content?.text?.includes('\n\n') ? (
                      content.text.split(/\n\n+/).map((para, i) => (
                        <div key={i} className="program-text-paragraph">{para}</div>
                      ))
                    ) : (
                      content?.text || ''
                    )}
                  </div>
                )}
                {showReference && formattedRef && (
                  <div className="program-lt-ref" style={{ color: referenceColor, fontSize: refStyle.fontSize, textAlign }}>
                    {formattedRef}
                  </div>
                )}
                {songCredit(scene) && <div className="program-song-credit" style={{ textAlign }}>{songCredit(scene)}</div>}
              </>
            )}
          </div>
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
                <div style={{ fontSize: mode === 'lowerThird' ? 'clamp(11px, 1.4cqw, 16px)' : 'clamp(14px, 1.8cqw, 24px)', fontWeight: 800, letterSpacing: '0.08em', color: '#FF5500', display: 'flex', alignItems: 'center', gap: '0.5cqw' }}>
                  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                  KJV TRANSLATION USAGE
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
                <div style={{ fontSize: mode === 'lowerThird' ? 'clamp(12px, 1.8cqw, 20px)' : 'clamp(16px, 2.4cqw, 30px)', fontWeight: 800, letterSpacing: '0.1em', color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '0.5cqw' }}>
                  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  DERIVATION & ETYMOLOGY
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
              <div style={{ fontSize: mode === 'lowerThird' ? 'clamp(12px, 1.8cqw, 20px)' : 'clamp(16px, 2.4cqw, 30px)', fontWeight: 800, letterSpacing: '0.1em', color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '0.5cqw' }}>
                <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                STRONGS DEFINITION
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
        <SlideTransitionContainer
          currentSlide={content.slide}
          sceneId={scene?.id || 'slide'}
          transition={scene?.transition || state.fxAnimation}
        />
      )}

      {scene && mode === 'fullscreen' && !content?.slide && !content?.wordStudy && (
        <div key={scene?.id ? `${scene.id}-fs-content` : 'fs-content'} className="program-fullscreen-content" style={fullscreenStyle}>
          {content?.html ? (
            <div className="program-slide-html" dangerouslySetInnerHTML={{ __html: content.html }} />
          ) : isCompare ? (
            <div className="program-compare" style={{ textAlign: dualTextAlign }}>
              <div className="program-compare-pane" style={{ textAlign: dualTextAlign }}>
                <div className="program-ref-row" style={{ ...refRowStyle, justifyContent: alignmentJustify(dualTextAlign), textAlign: dualTextAlign }}>
                  {showReference && primaryRef && <span style={{ ...refStyle, textAlign: dualTextAlign }}>{primaryRef}</span>}
                </div>
                {fxAnim.isWordType ? (
                  <TypedWordText text={content?.text || ''} duration={fxAnim.durationSec} style={{ ...textStyle, textAlign: dualTextAlign }} textAlign={dualTextAlign} />
                ) : (
                  <div className="program-main-text" style={{ ...textStyle, textAlign: dualTextAlign }}>{content?.text || ''}</div>
                )}
              </div>
              <div className="program-compare-divider" />
              <div className="program-compare-pane" style={{ textAlign: dualTextAlign }}>
                <div className="program-ref-row" style={{ ...refRowStyle, justifyContent: alignmentJustify(dualTextAlign), textAlign: dualTextAlign }}>
                  {showReference && secondaryRef && <span style={{ ...refStyle, textAlign: dualTextAlign }}>{secondaryRef}</span>}
                </div>
                {fxAnim.isWordType ? (
                  <TypedWordText text={secondaryVerse?.text || ''} duration={fxAnim.durationSec} style={{ ...textStyle, textAlign: dualTextAlign }} textAlign={dualTextAlign} />
                ) : (
                  <div className="program-main-text" style={{ ...textStyle, textAlign: dualTextAlign }}>{secondaryVerse?.text || ''}</div>
                )}
              </div>
            </div>
          ) : (
            <>
              {showReference && formattedRef && (
                <div className="program-ref-row" style={refRowStyle}>
                  <span style={refStyle}>{formattedRef}</span>
                </div>
              )}
              {fxAnim.isWordType ? (
                <TypedWordText text={content?.text || ''} duration={fxAnim.durationSec} style={textStyle} textAlign={textAlign} />
              ) : (
                <div className="program-main-text" style={textStyle}>
                  {content?.text?.includes('\n\n') ? (
                    content.text.split(/\n\n+/).map((para, i) => (
                      <div key={i} className="program-text-paragraph">
                        {para}
                      </div>
                    ))
                  ) : (
                    content?.text || ''
                  )}
                </div>
              )}
              {songCredit(scene) && <div className="program-song-credit">{songCredit(scene)}</div>}
            </>
          )}
        </div>
      )}

      {state.activeAlert && (
        state.activeAlert.animation === 'crawl' ? (
          <div className={`program-alert program-alert-ticker program-alert-${state.activeAlert.type} program-alert-${state.activeAlert.position || 'bottom'}`}>
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
        ) : (
          <div className={`program-alert-badge program-alert-badge-${state.activeAlert.type} program-alert-badge-${state.activeAlert.position || 'top'}`}>
            <div className="program-alert-badge-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <div className="program-alert-badge-content">
              <div className="program-alert-badge-tag">
                {state.activeAlert.type === 'warning' ? 'URGENT ALERT' : state.activeAlert.type === 'info' ? 'NOTICE' : 'ALERT'}
              </div>
              <div className="program-alert-badge-text">
                {state.activeAlert.text}
              </div>
            </div>
          </div>
        )
      )}
      {state.blackout && <div className="program-blackout" />}
    </div>
  );
});
