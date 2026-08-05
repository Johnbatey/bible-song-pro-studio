/* =========================================================================
   <StageSurface> — the whole stage screen
   -------------------------------------------------------------------------
   The program output and the confidence zones, in the three modes the operator
   can ask for: zones only, output only, or zones floating over the output.

   The program pane renders <ProgramSurface> — the same component the projector
   and the operator's Program pane use. The old page could not do that: it was
   vanilla JS with no access to the React tree, so it embedded
   http://localhost:8942/display.html in an <iframe>, which is the *legacy*
   WebSocket renderer. That meant the musicians' confidence monitor and the
   screen behind them were two different renderers fed by two different
   transports, free to disagree with nobody watching.

   Rendering the real component in-process also deletes everything that existed
   only to babysit that iframe: the readiness handshake, the five-second
   timeout, the "Program preview unavailable" banner, and the message replay
   queue. There is no longer a load that can fail.
   ========================================================================= */
import type { CSSProperties } from 'react';
import { ProgramSurface, type ProgramSurfaceState } from '../renderer/components/display/ProgramSurface';
import { StageZones } from './StageZones';
import type { StageState } from './stage-state';
import './stage.css';

export interface StageSurfaceProps {
  state: StageState;
  /** What the projector is showing, for the program pane. */
  program: ProgramSurfaceState;
  /** Origin for imported media and fonts, passed through to ProgramSurface. */
  assetBaseUrl?: string;
  /** The standalone stage window shows the watermark footer; the dock panel
      has its own chrome bar and passes false. */
  chrome?: boolean;
  className?: string;
}

export function StageSurface({
  state,
  program,
  assetBaseUrl,
  chrome = true,
  className,
}: StageSurfaceProps) {
  const { theme, layout } = state;
  const cue = [state.songTitle, state.songSubtitle].filter(Boolean).join(' — ');
  const hasContent = !!(
    state.current?.title || state.current?.body ||
    state.next?.title || state.next?.body ||
    cue
  );

  const rootStyle = {
    '--stage-accent': theme.accent,
    '--stage-text': theme.text,
    '--stage-bg': state.backgroundColor || '#000000',
    '--stage-font-scale': String(theme.fontScale),
  } as CSSProperties;

  const classes = [
    'stage-display',
    `mode-${state.mode}`,
    hasContent ? 'has-content' : '',
    state.clockVisible && theme.showClock ? '' : 'hide-clock',
    state.timerVisible && theme.showTimer ? '' : 'hide-timer',
    theme.showLabels ? '' : 'hide-labels',
    className || '',
  ].filter(Boolean).join(' ');

  return (
    <main className={classes} style={rootStyle}>
      {/* Rendered in every mode but hidden by CSS in confidence, so switching
          modes does not remount the output and restart a background video. */}
      {/* Named stage-program, not program-surface: ProgramSurface's own root
          already carries that class, and a descendant selector here would then
          restyle the component's internals from the outside. */}
      <section className="stage-program" aria-label="Program output">
        <ProgramSurface state={program} preview assetBaseUrl={assetBaseUrl} />
      </section>

      <section className="stage-stage" aria-label="Confidence content">
        <div className="stage-bg" style={{ background: state.backgroundColor || '#000000' }} />
        <StageZones
          layout={layout}
          theme={theme}
          current={state.current}
          next={state.next}
          songTitle={state.songTitle}
          songSubtitle={state.songSubtitle}
          timer={state.timer}
          messages={state.messages}
        />
        <div className="stage-idle">
          <div className="idle-ring"><div className="idle-dot" /></div>
          <p className="idle-label">Stage Ready</p>
        </div>
        {chrome && (
          <footer className="stage-watermark">
            <span className="watermark-left">Bible Song Pro · {layout.name}</span>
            <span className="watermark-right">L = layout · Esc = clear</span>
          </footer>
        )}
      </section>
    </main>
  );
}

export default StageSurface;
