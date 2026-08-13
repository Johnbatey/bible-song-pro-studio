import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { useAppStore } from '../stores/appStore';

/**
 * Transport for a video background, sized to live in a block's chrome bar
 * beside Import Media rather than taking a bar of its own. The whole strip is
 * one control the height of a chrome button — the media panel's job is the
 * library, and the transport earns a sliver of the toolbar, not a storey.
 *
 * Two things it does that a consumer player does not:
 *
 *  1. **The rail carries tally.** Signal when the clip is on air, preview
 *     green when it is only cued. Same rule as every other surface: if it is
 *     orange, the room is seeing it.
 *  2. **A playhead, not a bubble.** A 2px bar on a hairline rail, square ends.
 *     Nothing inflates when touched.
 *
 * Scrubbing works while playing: the pointer is captured, incoming clock
 * updates are ignored for the length of the drag so the thumb cannot be pulled
 * out from under the finger, and the seek commits on release.
 */

/** mm:ss, or h:mm:ss past the hour. */
function timecode(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const whole = Math.floor(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/* SF Symbols' play.fill and pause.fill: a triangle and two bars, both with the
   small corner radius Apple uses so the shapes read as drawn rather than
   clipped. Sized on an 11px box to sit on the chrome bar's baseline. */
function PlayGlyph() {
  return (
    <svg width="11" height="12" viewBox="0 0 11 12" aria-hidden focusable="false">
      <path
        d="M1.6 1.05 9.4 5.5a.58.58 0 0 1 0 1L1.6 10.95A.58.58 0 0 1 .75 10.45V1.55a.58.58 0 0 1 .85-.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

/* backward.end.fill — the bar-and-triangle that means "back to the start",
   not a generic rewind arrow: there is no previous clip to step to. */
function RestartGlyph() {
  return (
    <svg width="11" height="12" viewBox="0 0 11 12" aria-hidden focusable="false">
      <rect x="0.9" y="1.4" width="1.9" height="9.2" rx="0.85" fill="currentColor" />
      <path
        d="M10.1 1.9v8.2a.6.6 0 0 1-.92.5L4.1 7.1a.72.72 0 0 1 0-1.2l5.08-3.5a.6.6 0 0 1 .92.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

/* repeat — the rounded circuit with two arrowheads. */
function LoopGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden focusable="false"
         fill="none" stroke="currentColor" strokeWidth="1.35"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.1 4.55a2.1 2.1 0 0 1 2.1-2.1h4.3" />
      <polyline points="7.2,1.05 8.85,2.45 7.2,3.85" />
      <path d="M9.9 7.45a2.1 2.1 0 0 1-2.1 2.1H3.5" />
      <polyline points="4.8,10.95 3.15,9.55 4.8,8.15" />
    </svg>
  );
}

function PauseGlyph() {
  return (
    <svg width="11" height="12" viewBox="0 0 11 12" aria-hidden focusable="false">
      <rect x="1" y="1" width="3.2" height="10" rx="1.1" fill="currentColor" />
      <rect x="6.8" y="1" width="3.2" height="10" rx="1.1" fill="currentColor" />
    </svg>
  );
}

const glyphButton: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 20, height: 20, flexShrink: 0, padding: 0,
  background: 'transparent', border: 'none',
  borderRadius: 'var(--radius-hair, 2px)',
  cursor: 'pointer',
  transition: 'color var(--d-state) var(--ease)',
};

export function MediaTransport() {
  const transport = useAppStore((s) => s.display.videoTransport);
  const clock = useAppStore((s) => s.display.videoClock);
  const setVideoPlaying = useAppStore((s) => s.setVideoPlaying);
  const seekVideo = useAppStore((s) => s.seekVideo);
  const setVideoLoop = useAppStore((s) => s.setVideoLoop);
  const looping = useAppStore((s) => {
    const scene = s.display.videoTransport.target === 'program'
      ? s.display.currentScene
      : s.display.previewScene;
    return scene?.background?.loop !== false;
  });

  const trackRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const fillRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [railHot, setRailHot] = useState(false);
  /* The strip gives up its readout before it gives up its rail, and the rail
     before the play button, so a narrow dock still leaves something usable
     rather than a row of clipped stubs. Measured rather than guessed at from
     the window: this sits in a dock the operator can drag to any width. */
  const [stripWidth, setStripWidth] = useState(268);

  useEffect(() => {
    const el = stripRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setStripWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* The clock keeps both figures at every width — a duration you cannot see is
     the complaint this replaced. The two secondary buttons go first instead. */
  const showLoop = stripWidth >= 232;
  const showRestart = stripWidth >= 196;

  const duration = clock.duration;
  const isScrubbing = scrubTime !== null;
  /* While dragging, the thumb answers to the pointer and nothing else. */
  const shownTime = isScrubbing ? scrubTime : clock.currentTime;
  const progress = duration > 0 ? Math.min(1, Math.max(0, shownTime / duration)) : 0;
  const remaining = Math.max(0, duration - shownTime);
  const onAir = transport.target === 'program';
  const tally = onAir ? 'var(--tally-program)' : 'var(--tally-preview)';

  const timeAtClientX = useCallback((clientX: number) => {
    const rail = trackRef.current;
    if (!rail || duration <= 0) return 0;
    const rect = rail.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * duration;
  }, [duration]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    /* A synthetic pointer has no capture to take; the drag still works from
       the move handler, so a refusal here must not kill the interaction. */
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* no capture */ }
    setScrubTime(timeAtClientX(e.clientX));
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isScrubbing) setScrubTime(timeAtClientX(e.clientX));
  };

  const commitScrub = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    const t = timeAtClientX(e.clientX);
    setScrubTime(null);
    seekVideo(t);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch { /* nothing held */ }
  };

  const nudge = useCallback((delta: number) => {
    if (duration <= 0) return;
    seekVideo(Math.min(duration, Math.max(0, clock.currentTime + delta)));
  }, [clock.currentTime, duration, seekVideo]);

  /* Bound to the strip, not the document — this is one control among many and
     must not eat the console's keys when it does not have focus. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 1 : 5;
    if (e.key === ' ') { e.preventDefault(); setVideoPlaying(!transport.playing); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-step); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); nudge(step); }
    else if (e.key === 'Home') { e.preventDefault(); seekVideo(0); }
    else if (e.key === 'End') { e.preventDefault(); seekVideo(Math.max(0, duration - 0.1)); }
  };

  /* The playhead runs on wall clock, not on reports.
   *
   * A video only fires timeupdate about four times a second, so a head driven
   * straight off it steps in visible ~250ms jumps. Between reports the elapsed
   * real time is a better estimate of where the clip is than the last report
   * is, so the position is interpolated from the most recent report and
   * re-anchored whenever a new one lands — the head never drifts, it just
   * stops waiting.
   *
   * Painted through refs rather than state: this runs every frame, and the
   * timecode beside it only changes once a second. Re-rendering the whole
   * strip at 60fps to move one bar would be the expensive way to do it.
   */
  const anchorRef = useRef({ time: 0, at: 0 });
  const progressRef = useRef(0);
  progressRef.current = progress;

  useEffect(() => {
    anchorRef.current = { time: clock.currentTime, at: performance.now() };
  }, [clock.currentTime]);

  const paint = useCallback((ratio: number) => {
    const pct = `${Math.min(1, Math.max(0, ratio)) * 100}%`;
    if (fillRef.current) fillRef.current.style.width = pct;
    if (headRef.current) headRef.current.style.left = pct;
  }, []);

  useEffect(() => {
    /* Scrubbing follows the pointer and a paused clip does not move — both are
       exact, and neither wants a frame loop. */
    if (duration <= 0 || isScrubbing || !transport.playing) {
      paint(progressRef.current);
      return;
    }
    let frame = 0;
    const tick = () => {
      const { time, at } = anchorRef.current;
      /* Clamped so a loop wrap parks at the end for the frame or two before
         the next report brings it back to zero, rather than running past. */
      paint(Math.min(duration, time + (performance.now() - at) / 1000) / duration);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, isScrubbing, transport.playing, paint]);

  /* While scrubbing, React is not re-rendering the bar for us — paint it. */
  useEffect(() => {
    if (isScrubbing) paint(progress);
  }, [isScrubbing, progress, paint]);

  /* A clip swapped underneath the strip leaves a stale drag behind. */
  useEffect(() => { setScrubTime(null); }, [transport.target]);

  return (
    <div
      tabIndex={0}
      onKeyDown={onKeyDown}
      title={`${onAir ? 'On air' : 'Cued'} · ${timecode(remaining)} remaining`}
      ref={stripRef}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        height: 26,
        /* Takes what the chrome bar can spare and gives it back first: the
           panel title and Import Media come before the transport when the
           dock is dragged narrow. */
        flex: '0 1 330px',
        minWidth: 118,
        padding: '0 9px 0 5px',
        background: 'var(--chrome-control)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-sm)',
        outline: 'none',
      }}
    >
      {showRestart && (
        <button
          type="button"
          onClick={() => seekVideo(0)}
          title="Back to start  (Home)"
          aria-label="Back to start"
          style={{ ...glyphButton, color: 'var(--text-dim)' }}
        >
          <RestartGlyph />
        </button>
      )}

      <button
        type="button"
        onClick={() => setVideoPlaying(!transport.playing)}
        title={transport.playing ? 'Pause  (Space)' : 'Play  (Space)'}
        aria-label={transport.playing ? 'Pause' : 'Play'}
        style={{ ...glyphButton, color: 'var(--text-primary)' }}
      >
        {transport.playing ? <PauseGlyph /> : <PlayGlyph />}
      </button>

      {showLoop && (
        <button
          type="button"
          onClick={() => setVideoLoop(!looping)}
          title={looping ? 'Looping — click to play once' : 'Play once — click to loop'}
          aria-label="Loop"
          aria-pressed={looping}
          style={{
            ...glyphButton,
            /* Loop is not an on-air state, so it never wears Signal. On is
               white, off is muted — the same weight every other toggle uses. */
            color: looping ? 'var(--text-primary)' : 'var(--text-mute)',
          }}
        >
          <LoopGlyph />
        </button>
      )}

      {/* Rail */}
      <div
        ref={trackRef}
        role="slider"
        aria-label="Video position"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, Math.round(duration))}
        aria-valuenow={Math.round(shownTime)}
        aria-valuetext={`${timecode(shownTime)} of ${timecode(duration)}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={commitScrub}
        onPointerCancel={commitScrub}
        onPointerEnter={() => setRailHot(true)}
        onPointerLeave={() => setRailHot(false)}
        style={{
          position: 'relative',
          flex: '1 1 auto',
          minWidth: 64,
          height: 20,
          display: 'flex',
          alignItems: 'center',
          cursor: duration > 0 ? 'pointer' : 'default',
          touchAction: 'none',
        }}
      >
        <div
          style={{
            position: 'relative', width: '100%',
            height: railHot || isScrubbing ? 4 : 2,
            background: 'var(--bsp-active)',
            borderRadius: 1,
            transition: 'height var(--d-state) var(--ease)',
          }}
        >
          <div
            ref={fillRef}
            style={{
              position: 'absolute', inset: 0, right: 'auto',
              width: `${progress * 100}%`,
              background: tally,
              borderRadius: 'inherit',
            }}
          />
          <div
            ref={headRef}
            style={{
              position: 'absolute', top: -4, bottom: -4,
              left: `${progress * 100}%`,
              width: 2, marginLeft: -1,
              background: 'var(--text-primary)',
              boxShadow: isScrubbing
                ? `0 0 0 3px ${onAir ? 'var(--bsp-signal-glow)' : 'rgba(34,197,94,0.28)'}`
                : undefined,
              transition: 'box-shadow var(--d-state) var(--ease)',
            }}
          />
        </div>
      </div>

      <span
        style={{
          flexShrink: 0,
          fontFamily: 'var(--font-signal)', fontVariantNumeric: 'tabular-nums',
          fontSize: 10, letterSpacing: '0.04em',
          color: 'var(--text-secondary)', whiteSpace: 'nowrap',
        }}
      >
        {timecode(shownTime)}
        <span style={{ color: 'var(--text-mute)' }}> / {timecode(duration)}</span>
      </span>
    </div>
  );
}
