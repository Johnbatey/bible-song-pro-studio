/* =========================================================================
   <NativeSlideBoard> — paints a slide built in the editor
   -------------------------------------------------------------------------
   The peer of <SlideCanvas>: that one paints a parsed PowerPoint slide, this
   one paints a slide made of the editor's own elements. Both work in the same
   board space — 1280 CSS px wide, geometry in percent, type in board pixels —
   so both scale the same way and a caller can hand either one a width.

   Read-only on purpose. The editor's canvas keeps its selection HUD, drag
   handles and contentEditable text; what is shared with it is the element
   geometry and the default layer set below, so a slide that has never been
   touched projects as the same two lines the editor shows.
   ========================================================================= */
import type { CSSProperties } from 'react';
import type { PresentationSlide, SlideBackground, SlideElement } from '../types';

/** Board logical size. Matches <SlideCanvas>'s BOARD_W so the two agree. */
export const NATIVE_BOARD_W = 1280;
export const NATIVE_BOARD_H = 720;

export function hexToRgba(color: string | undefined, opacity: number = 1): string {
  if (!color || color === 'transparent') return 'transparent';
  if (opacity >= 1 && (color.startsWith('#') || color.startsWith('rgb('))) return color;

  const rgbaMatch = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\)/i);
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${opacity})`;
  }

  const hex = color.trim().replace(/^#/, '');
  let r = 255, g = 85, b = 0;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length >= 6) {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }
  if (isNaN(r) || isNaN(g) || isNaN(b)) return color;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function computeTextShadow(el: SlideElement): string | undefined {
  if (el.shadowEnabled) {
    const col = el.shadowColor || '#000000';
    const blur = el.shadowBlur ?? 8;
    const x = el.shadowOffsetX ?? 0;
    const y = el.shadowOffsetY ?? 4;
    const opacity = el.shadowOpacity ?? 0.5;
    return `${x}px ${y}px ${blur}px ${hexToRgba(col, opacity)}`;
  }
  if (el.shadowEnabled === false) return undefined;
  return el.textShadow || undefined;
}

export function computeBoxShadow(el: SlideElement): string | undefined {
  if (el.boxShadowEnabled) {
    const col = el.boxShadowColor || '#000000';
    const blur = el.boxShadowBlur ?? 12;
    const x = el.boxShadowOffsetX ?? 0;
    const y = el.boxShadowOffsetY ?? 6;
    const opacity = el.boxShadowOpacity ?? 0.4;
    return `${x}px ${y}px ${blur}px ${hexToRgba(col, opacity)}`;
  }
  if (el.boxShadowEnabled === false) return undefined;
  return el.boxShadow || undefined;
}

/**
 * What a slide with no layers of its own looks like: a title and a body, the
 * pair the editor drops onto a fresh slide. The editor renders these when
 * `elements` is empty, so anything else showing the slide has to render the
 * same two, or a deck straight out of "+ Add Slide" would project blank.
 */
export function defaultSlideElements(slide: Pick<PresentationSlide, 'title' | 'body'>): SlideElement[] {
  return [
    {
      id: 'title-el',
      type: 'text',
      x: 10,
      y: 20,
      width: 80,
      height: 25,
      content: slide.title || 'Click to edit Title',
      fontSize: 54,
      fontFamily: 'Inter',
      fontWeight: 700,
      color: '#ffffff',
      textAlign: 'center',
      zIndex: 1,
    },
    {
      id: 'body-el',
      type: 'text',
      x: 15,
      y: 50,
      width: 70,
      height: 35,
      content: slide.body || 'Click to edit Body content',
      fontSize: 32,
      fontFamily: 'Inter',
      fontWeight: 500,
      color: 'rgba(255, 255, 255, 0.85)',
      textAlign: 'center',
      zIndex: 2,
    },
  ];
}

/** The elements a slide actually paints with. */
export function slideElementsFor(slide: Pick<PresentationSlide, 'title' | 'body' | 'elements'>): SlideElement[] {
  if (Array.isArray(slide.elements)) {
    return slide.elements;
  }
  return defaultSlideElements(slide);
}

/** The board's own fill, before any element is drawn over it. */
export function slideBoardBackground(background: SlideBackground | undefined): string {
  const type = background?.type || 'color';
  const value = background?.value;
  if (!value) return '#18181b';
  return type === 'gradient' || type === 'color' ? value : '#18181b';
}

function textJustify(align: SlideElement['textAlign']) {
  if (align === 'left') return 'flex-start';
  if (align === 'right') return 'flex-end';
  return 'center';
}

function vJustify(vAlign?: SlideElement['vAlign']) {
  if (vAlign === 'top') return 'flex-start';
  if (vAlign === 'bottom') return 'flex-end';
  return 'center';
}

function ElementBox({ el }: { el: SlideElement }) {
  const isLocked = Boolean(el.locked);
  const outer: CSSProperties = {
    position: 'absolute',
    left: `${el.x}%`,
    top: `${el.y}%`,
    width: `${el.width}%`,
    height: `${el.height}%`,
    zIndex: el.zIndex || 1,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    opacity: el.opacity ?? 1,
    pointerEvents: isLocked ? 'none' : 'auto',
  };

  if (el.type === 'image') {
    return (
      <div style={outer}>
        <img
          src={el.content}
          alt=""
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: el.borderRadius !== undefined ? `${el.borderRadius}px` : '0px',
            borderColor: el.borderColor || 'transparent',
            borderWidth: el.borderWidth !== undefined ? `${el.borderWidth}px` : '0px',
            borderStyle: (el.borderWidth ?? 0) > 0 ? 'solid' : 'none',
            boxShadow: computeBoxShadow(el),
            boxSizing: 'border-box',
            pointerEvents: 'none',
            WebkitUserDrag: 'none' as any,
            userSelect: 'none',
          }}
        />
      </div>
    );
  }

  if (el.type === 'shape') {
    const computedRadius =
      el.content === 'circle'
        ? '50%'
        : el.borderRadius !== undefined
        ? `${el.borderRadius}px`
        : el.content === 'rectangle'
        ? '0px'
        : '12px';

    const borderWidth = el.borderWidth !== undefined ? el.borderWidth : 3;
    const rawBg = el.backgroundColor !== undefined ? el.backgroundColor : '#FF5500';
    const rawBorder = el.borderColor || '#FF5500';

    return (
      <div style={outer}>
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: hexToRgba(rawBg, el.fillOpacity ?? 1),
            borderColor: hexToRgba(rawBorder, el.strokeOpacity ?? 1),
            borderWidth: `${borderWidth}px`,
            borderStyle: borderWidth > 0 ? 'solid' : 'none',
            borderRadius: computedRadius,
            boxShadow: computeBoxShadow(el),
            clipPath:
              el.content === 'triangle'
                ? 'polygon(50% 0%, 0% 100%, 100% 100%)'
                : el.content === 'star'
                ? 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'
                : undefined,
            boxSizing: 'border-box',
          }}
        />
      </div>
    );
  }

  const borderWidth = el.borderWidth ?? 0;

  return (
    <div style={outer}>
      <div
        style={{
          width: '100%',
          height: '100%',
          color: el.color || '#ffffff',
          fontFamily: el.fontFamily || 'Inter',
          fontSize: el.fontSize || 36,
          fontWeight: el.fontWeight || 500,
          fontStyle: el.fontStyle || 'normal',
          textAlign: el.textAlign || 'center',
          lineHeight: el.lineHeight || 1.3,
          letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : undefined,
          textTransform: el.textTransform || 'none',
          textDecoration: el.textDecoration || 'none',
          textShadow: computeTextShadow(el),
          boxShadow: computeBoxShadow(el),
          backgroundColor: el.backgroundColor || 'transparent',
          borderColor: el.borderColor || 'transparent',
          borderWidth: `${borderWidth}px`,
          borderStyle: borderWidth > 0 ? 'solid' : 'none',
          borderRadius: el.borderRadius !== undefined ? `${el.borderRadius}px` : '0px',
          display: 'flex',
          alignItems: vJustify(el.vAlign),
          justifyContent: textJustify(el.textAlign),
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          boxSizing: 'border-box',
        }}
      >
        {el.content}
      </div>
    </div>
  );
}

export interface NativeSlideBoardProps {
  elements: SlideElement[];
  background?: SlideBackground;
  /** Board width in CSS px. The board scales as a whole; 1280 is 1:1. */
  width?: number;
  /** Board height in CSS px at 1:1. Defaults to 16:9. */
  boardHeight?: number;
  className?: string;
  style?: CSSProperties;
}

export function NativeSlideBoard({
  elements,
  background,
  width,
  boardHeight = NATIVE_BOARD_H,
  className,
  style,
}: NativeSlideBoardProps) {
  const scale = (width ?? NATIVE_BOARD_W) / NATIVE_BOARD_W;
  const isImage = background?.type === 'image' && background.value;
  const isVideo = background?.type === 'video' && background.value;

  const board = (
    <div
      className={scale === 1 ? className : undefined}
      style={{
        position: 'relative',
        width: `${NATIVE_BOARD_W}px`,
        height: `${boardHeight}px`,
        transform: scale === 1 ? undefined : `scale(${scale})`,
        transformOrigin: 'top left',
        overflow: 'hidden',
        background: slideBoardBackground(background),
        ...(scale === 1 ? style : null),
      }}
    >
      {isImage && (
        <img
          src={background!.value}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      {isVideo && (
        <video
          src={background!.value}
          autoPlay
          muted
          loop
          playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      {background?.overlayColor && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: background.overlayColor,
            opacity: background.overlayOpacity ?? 1,
          }}
        />
      )}
      {elements.map((el) => <ElementBox key={el.id} el={el} />)}
    </div>
  );

  if (scale === 1) return board;

  /* A scaled board still lays out at 1280 wide — transform does not affect
     flow — so it sits in a wrapper of its true visual size. Same reason
     <SlideCanvas> does it: without this the board shoves its centring parent
     hundreds of pixels sideways. */
  return (
    <div
      className={className}
      style={{
        width: `${NATIVE_BOARD_W * scale}px`,
        height: `${boardHeight * scale}px`,
        overflow: 'hidden',
        flexShrink: 0,
        ...style,
      }}
    >
      {board}
    </div>
  );
}

export default NativeSlideBoard;
