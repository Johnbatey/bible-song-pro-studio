import { useEffect, useRef } from 'react';
import type { LowerThirdTheme } from '../types';

interface AnimatedLowerThirdProps {
  text: string;
  theme: LowerThirdTheme;
  visible: boolean;
}

// Broadcast motion has one rule the software world forgets: nothing
// overshoots. A lower third that bounces reads as amateur on air, so every
// curve here lands and stops. These were spring easings — the two strongest
// carried the graphic past its resting position and settled back into it.
//
// EASE is the house curve; EASE_OUT is the symmetrical one, used on exits.
// D_AIR is the brand's to-air duration: 400ms in, and out a step under it.
const EASE = 'cubic-bezier(0.16, 1, 0.30, 1)';
const EASE_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)';
const D_AIR = '0.4s';
const D_OUT = '0.24s';

const getAnimationStyles = (animation: string) => {
  const easing = EASE;

  switch (animation) {
    case 'slideInLeft':
      return {
        initial: { transform: 'translateX(-100%)', opacity: 0 },
        enter: { transform: 'translateX(0)', opacity: 1, transition: `all ${D_AIR} ${easing}` },
        exit: { transform: 'translateX(-100%)', opacity: 0, transition: `all ${D_OUT} ${EASE_OUT}` },
      };
    case 'slideInRight':
      return {
        initial: { transform: 'translateX(100%)', opacity: 0 },
        enter: { transform: 'translateX(0)', opacity: 1, transition: `all ${D_AIR} ${easing}` },
        exit: { transform: 'translateX(100%)', opacity: 0, transition: `all ${D_OUT} ${EASE_OUT}` },
      };
    case 'slideInUp':
      return {
        initial: { transform: 'translateY(100%)', opacity: 0 },
        enter: { transform: 'translateY(0)', opacity: 1, transition: `all ${D_AIR} ${easing}` },
        exit: { transform: 'translateY(100%)', opacity: 0, transition: `all ${D_OUT} ${EASE_OUT}` },
      };
    case 'slideInDown':
      return {
        initial: { transform: 'translateY(-100%)', opacity: 0 },
        enter: { transform: 'translateY(0)', opacity: 1, transition: `all ${D_AIR} ${easing}` },
        exit: { transform: 'translateY(-100%)', opacity: 0, transition: `all ${D_OUT} ${EASE_OUT}` },
      };
    case 'zoomIn':
      return {
        initial: { transform: 'scale(0.8)', opacity: 0 },
        enter: { transform: 'scale(1)', opacity: 1, transition: `all ${D_AIR} ${easing}` },
        exit: { transform: 'scale(0.8)', opacity: 0, transition: `all ${D_OUT} ${EASE_OUT}` },
      };
    case 'scaleIn':
      return {
        initial: { transform: 'scale(1.1)', opacity: 0 },
        enter: { transform: 'scale(1)', opacity: 1, transition: `all ${D_AIR} ${easing}` },
        exit: { transform: 'scale(1.1)', opacity: 0, transition: `all ${D_OUT} ${EASE_OUT}` },
      };
    case 'flipIn':
      return {
        initial: { transform: 'rotateX(90deg)', opacity: 0 },
        enter: { transform: 'rotateX(0deg)', opacity: 1, transition: `all ${D_AIR} ${easing}` },
        exit: { transform: 'rotateX(90deg)', opacity: 0, transition: `all ${D_OUT} ${EASE_OUT}` },
      };
    case 'bounceIn':
      return {
        initial: { transform: 'scale(0.3)', opacity: 0 },
        enter: { transform: 'scale(1)', opacity: 1, transition: `all ${D_AIR} ${easing}` },
        exit: { transform: 'scale(0.3)', opacity: 0, transition: `all ${D_OUT} ${EASE_OUT}` },
      };
    case 'elasticIn':
      return {
        initial: { transform: 'scale(0.5) translateY(20px)', opacity: 0 },
        enter: { transform: 'scale(1) translateY(0)', opacity: 1, transition: `all ${D_AIR} ${easing}` },
        exit: { transform: 'scale(0.5) translateY(20px)', opacity: 0, transition: `all ${D_OUT} ${EASE_OUT}` },
      };
    default: // fadeIn
      return {
        initial: { opacity: 0 },
        enter: { opacity: 1, transition: `all ${D_AIR} ${easing}` },
        exit: { opacity: 0, transition: `all ${D_OUT} ${EASE_OUT}` },
      };
  }
};

const getPositionStyle = (position: string) => {
  switch (position) {
    case 'bottom-left':
      return { bottom: 0, left: 0, alignItems: 'flex-start' as const };
    case 'bottom-center':
      return { bottom: 0, left: '50%', transform: 'translateX(-50%)', alignItems: 'center' as const };
    case 'bottom-right':
      return { bottom: 0, right: 0, alignItems: 'flex-end' as const };
    case 'top-left':
      return { top: 0, left: 0, alignItems: 'flex-start' as const };
    case 'top-center':
      return { top: 0, left: '50%', transform: 'translateX(-50%)', alignItems: 'center' as const };
    case 'top-right':
      return { top: 0, right: 0, alignItems: 'flex-end' as const };
    default:
      return { bottom: 0, left: 0, alignItems: 'flex-start' as const };
  }
};

export function AnimatedLowerThird({ text, theme, visible }: AnimatedLowerThirdProps) {
  const ref = useRef<HTMLDivElement>(null);
  const animStyles = getAnimationStyles(theme.animation);
  const pos = getPositionStyle(theme.position);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    if (visible) {
      Object.assign(el.style, animStyles.enter);
    } else {
      Object.assign(el.style, animStyles.exit);
    }
  }, [visible, theme.animation]);

  if (!text && !visible) return null;

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        zIndex: 10,
        pointerEvents: 'none',
        padding: `${theme.padding || 20}px ${(theme.padding || 20) * 2}px`,
        background: theme.background || 'linear-gradient(135deg, rgba(0,65,28,0.95), rgba(23,142,76,0.95))',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTopLeftRadius: theme.borderRadius || 0,
        borderTopRightRadius: theme.borderRadius || 0,
        fontFamily: theme.fontFamily || '-apple-system, SF Pro Display, sans-serif',
        fontSize: theme.fontSize || 32,
        fontWeight: theme.fontWeight || 700,
        color: theme.fontColor || '#ffffff',
        textAlign: theme.textAlign || 'left',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)',
        maxWidth: '90%',
        minWidth: 200,
        transformOrigin: pos.alignItems === 'center' ? 'center bottom' : pos.left === 0 ? 'left bottom' : 'right bottom',
        ...animStyles.initial as any,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {theme.accentColor && (
          <div
            style={{
              width: 4,
              height: theme.fontSize || 32,
              background: theme.accentColor,
              borderRadius: 2,
              flexShrink: 0,
            }}
          />
        )}
        <div>{text}</div>
      </div>
    </div>
  );
}
