import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';

export function ThemeTransitionOverlay() {
  const isTransitioning = useAppStore((s) => s.isThemeTransitioning);
  const targetTheme = useAppStore((s) => s.themeTransitionTarget);
  const [phase, setPhase] = useState<'idle' | 'wipe-in' | 'go-live' | 'wipe-out'>('idle');

  useEffect(() => {
    if (isTransitioning) {
      setPhase('wipe-in');

      // 180ms: Live verse bar turns signal orange & cue set
      const liveTimer = setTimeout(() => {
        setPhase('go-live');
      }, 180);

      // 260ms: DOM theme flips under peak cover, then start wipe-out
      const wipeOutTimer = setTimeout(() => {
        setPhase('wipe-out');
        const endTimer = setTimeout(() => {
          setPhase('idle');
          useAppStore.setState({ isThemeTransitioning: false });
        }, 340);
        return () => clearTimeout(endTimer);
      }, 260);

      return () => {
        clearTimeout(liveTimer);
        clearTimeout(wipeOutTimer);
      };
    }
  }, [isTransitioning]);

  if (!isTransitioning && phase === 'idle') return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: phase === 'wipe-out' ? 'transparent' : '#0C0B0B',
        transition: 'background 320ms ease',
      }}
    >
      {/* Signature Cue Wipe Bar Across Viewport */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: '#FF5500',
          transformOrigin: phase === 'wipe-out' ? 'right center' : 'left center',
          transform: phase === 'wipe-in' ? 'scaleX(1)' : phase === 'go-live' ? 'scaleX(1)' : 'scaleX(0)',
          opacity: phase === 'wipe-out' ? 0 : 1,
          transition: 'transform 300ms cubic-bezier(0.65, 0, 0.35, 1), opacity 300ms ease',
          zIndex: 10,
        }}
      />

      {/* Centered Brand Mark & Wordmark */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          zIndex: 20,
          opacity: phase === 'wipe-out' ? 0 : 1,
          transform: phase === 'wipe-out' ? 'translateY(-16px)' : 'translateY(0)',
          transition: 'all 300ms cubic-bezier(0.16, 1, 0.30, 1)',
        }}
      >
        {/* SVG Verse Mark */}
        <svg
          width="78"
          height="78"
          viewBox="0 0 32 32"
          role="img"
          style={{ overflow: 'visible' }}
        >
          {/* Utterance 3 Bars */}
          <rect x="4" y="11" width="2.5" height="10" fill="#FFFFFF" rx="0.5" />
          <rect x="8.5" y="5" width="2.5" height="22" fill="#FFFFFF" rx="0.5" />
          <rect x="13" y="9.5" width="2.5" height="13" fill="#FFFFFF" rx="0.5" />

          {/* Scripture 3 Lines */}
          <rect x="17.5" y="8.5" width="10.5" height="2.5" fill="#FFFFFF" rx="0.5" />
          <rect
            x="17.5"
            y="14.75"
            width="10.5"
            height="2.5"
            rx="0.5"
            fill={phase === 'go-live' || phase === 'wipe-out' ? '#FF5500' : '#FFFFFF'}
            style={{
              transition: 'fill 200ms ease',
              filter: phase === 'go-live' || phase === 'wipe-out' ? 'drop-shadow(0 0 10px rgba(255,85,0,0.85))' : 'none',
            }}
          />
          <rect x="17.5" y="21" width="6.5" height="2.5" fill="#FFFFFF" rx="0.5" />
        </svg>

        {/* Wordmark */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div
            style={{
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: '#FFFFFF',
            }}
          >
            Bible Song Pro
            <sup
              style={{
                fontFamily: "'Geist Mono', ui-monospace, monospace",
                fontSize: '0.40em',
                fontWeight: 400,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginLeft: '0.42em',
                verticalAlign: '1.2em',
                color: '#A8A2A0',
              }}
            >
              STUDIO
            </sup>
          </div>

          <div
            style={{
              fontFamily: "'Geist Mono', ui-monospace, monospace",
              fontSize: 11,
              fontWeight: 400,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#FF5500',
              marginTop: 4,
            }}
          >
            {targetTheme === 'light' ? 'Switching to Light' : 'Switching to Dark'}
          </div>
        </div>
      </div>
    </div>
  );
}
