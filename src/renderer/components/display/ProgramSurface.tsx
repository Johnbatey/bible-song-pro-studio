import type { Alert, Scene, FullScreenTheme, Theme } from '../../types';
import { memo } from 'react';
import type React from 'react';
import { SlideStage } from './SlideStage';
import './ProgramSurface.css';

export interface ProgramSurfaceState {
  scene?: Scene | null;
  outputMode?: 'fullscreen' | 'lowerThird';
  theme?: Theme | null;
  activeAlert?: Alert | null;
  transcription?: string;
  blackout?: boolean;
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
  bgVideo?: string;
  bgCustomImage?: string;
  bgFill?: string;
  bgFit?: 'cover' | 'contain' | 'fill';
  bgOpacity?: number;
  bgVideoLoop?: boolean;
}

interface ProgramSurfaceProps {
  state: ProgramSurfaceState;
  preview?: boolean;
  assetBaseUrl?: string;
  className?: string;
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

function assetUrl(value: string | undefined, assetBaseUrl = '') {
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
    const themeFs = state.theme?.fullScreen;
    if (themeFs?.background) {
      if (themeFs.background === 'transparent') style.backgroundColor = 'transparent';
      else if (themeFs.background.includes('gradient')) style.backgroundImage = themeFs.background;
      else style.backgroundColor = themeFs.background;
    } else if (themeFs?.backgroundColor) {
      style.backgroundColor = themeFs.backgroundColor;
    } else {
      const bg = state.scene?.background;
      if (bg?.type === 'image' && bg.mediaUrl) style.backgroundImage = `url("${assetUrl(bg.mediaUrl, assetBaseUrl).replace(/"/g, '%22')}")`;
      else if (bg?.type === 'gradient' && bg.gradient) style.backgroundImage = bg.gradient;
      else if (bg?.type === 'solid' && bg.color) style.backgroundColor = bg.color;
      else if (bg?.type === 'transparent') style.backgroundColor = 'transparent';
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
export const ProgramSurface = memo(function ProgramSurface({ state, preview = false, assetBaseUrl = '', className = '' }: ProgramSurfaceProps) {
  const mode = state.outputMode || state.mode || 'fullscreen';
  const themeSection = mode === 'lowerThird' ? state.theme?.lowerThird : state.theme?.fullScreen;
  const scene = state.scene || null;
  const content = contentFromScene(scene);
  const secondaryVerse = content?.secondaryVerse;
  const isCompare = Boolean(secondaryVerse?.text);
  const baseRef = (content?.reference || '').replace(/\s*\([^)]*\/[^)]*\)\s*$/, '').trim();
  const primaryVersionTag = content?.version ? content.version.split('/')[0] : '';
  const secondaryVersionTag = secondaryVerse?.version || (content?.version ? content.version.split('/')[1] : '');

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
  const ltWidth = state.theme?.lowerThird?.width;
  const ltTransform = [
    ltWidth ? 'translateX(-50%)' : '',
    ltOffsetX ? `translateX(${ltOffsetX}px)` : '',
    ltOffsetY ? `translateY(${ltOffsetY}px)` : '',
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`program-surface ${mode === 'lowerThird' ? 'program-surface-lt' : 'program-surface-full'} ${className}`}>
      {showStageBackground && <div className="program-surface-bg" style={backgroundStyle(state, mode, assetBaseUrl)} />}
      {showStageBackground && video && (
        <video
          className="program-surface-video"
          src={video}
          autoPlay
          muted
          loop={state.bgVideoLoop !== false}
          playsInline
          style={{ objectFit: state.bgFit === 'contain' ? 'contain' : state.bgFit === 'fill' ? 'fill' : 'cover' }}
        />
      )}

      {!scene && (
        <div className="program-surface-standby">
          <div className="program-surface-standby-title">Bible Song Pro</div>
          <div className="program-surface-standby-sub">Waiting for signal...</div>
        </div>
      )}

      {scene && mode === 'lowerThird' && (
        <div
          className="program-lower-third"
          style={{
            background: state.theme?.lowerThird?.background || undefined,
            borderRadius: state.theme?.lowerThird?.borderRadius,
            width: ltWidth ? `${ltWidth}%` : undefined,
            left: ltWidth ? '50%' : undefined,
            right: ltWidth ? 'auto' : undefined,
            transform: ltTransform,
            textAlign,
          }}
        >
          <div className="program-lt-text" style={textStyle}>{content?.text || ''}</div>
          {showReference && formattedRef && (
            <div className="program-lt-ref" style={{ color: referenceColor, fontSize: refStyle.fontSize, textAlign }}>
              {formattedRef}
            </div>
          )}
          {songCredit(scene) && <div className="program-song-credit" style={{ textAlign }}>{songCredit(scene)}</div>}
        </div>
      )}

      {/* A designed slide is the whole picture: it carries its own background,
          type and layout, so it goes edge to edge and the theme's text styling
          sits this one out. Lower third keeps the text — a whole slide crammed
          into a strap across the bottom is nobody's intent. */}
      {scene && mode === 'fullscreen' && content?.slide && (
        <SlideStage projection={content.slide} className="program-slide-stage" />
      )}

      {scene && mode === 'fullscreen' && !content?.slide && (
        <div className="program-fullscreen-content" style={fullscreenStyle}>
          {content?.html ? (
            <div className="program-slide-html" dangerouslySetInnerHTML={{ __html: content.html }} />
          ) : isCompare ? (
            <div className="program-compare">
              <div className="program-compare-pane">
                <div className="program-ref-row" style={refRowStyle}>
                  {showReference && primaryRef && <span style={refStyle}>{primaryRef}</span>}
                </div>
                <div className="program-main-text" style={textStyle}>{content?.text || ''}</div>
              </div>
              <div className="program-compare-divider" />
              <div className="program-compare-pane">
                <div className="program-ref-row" style={refRowStyle}>
                  {showReference && secondaryRef && <span style={refStyle}>{secondaryRef}</span>}
                </div>
                <div className="program-main-text" style={textStyle}>{secondaryVerse?.text || ''}</div>
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

      {state.activeAlert && <div className={`program-alert program-alert-${state.activeAlert.type}`}>{state.activeAlert.text}</div>}
      {state.blackout && <div className="program-blackout" />}
    </div>
  );
});
