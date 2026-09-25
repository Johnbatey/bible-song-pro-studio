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

/* backward.end.fill — the bar-and-triangle that means "back to the start" */
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

function RewindGlyph() {
  return (
    <svg width="11" height="12" viewBox="0 0 12 12" aria-hidden focusable="false" fill="currentColor">
      <path d="M5.8 2.2a.5.5 0 0 0-.8-.4L.7 5.4a.7.7 0 0 0 0 1.2l4.3 3.6a.5.5 0 0 0 .8-.4V7.5l4.3 3.6a.5.5 0 0 0 .8-.4V1.3a.5.5 0 0 0-.8-.4L6 4.5V2.2Z" />
    </svg>
  );
}

function ForwardGlyph() {
  return (
    <svg width="11" height="12" viewBox="0 0 12 12" aria-hidden focusable="false" fill="currentColor">
      <path d="M6.2 2.2a.5.5 0 0 1 .8-.4l4.3 3.6a.7.7 0 0 1 0 1.2l-4.3 3.6a.5.5 0 0 1-.8-.4V7.5L2 11.1a.5.5 0 0 1-.8-.4V1.3a.5.5 0 0 1 .8-.4L6 4.5V2.2Z" />
    </svg>
  );
}

function StopGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden focusable="false" fill="currentColor">
      <rect x="1" y="1" width="8" height="8" rx="1.2" />
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

function MuteOffGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden focusable="false"
         fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function MuteOnGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden focusable="false"
         fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
      <line x1="22" y1="2" x2="2" y2="22" stroke="#EF4444" strokeWidth="2.5" />
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
  const restartVideo = useAppStore((s) => s.restartVideo);
  const stepVideo = useAppStore((s) => s.stepVideo);
  const stopVideo = useAppStore((s) => s.stopVideo);
  const setVideoSpeed = useAppStore((s) => s.setVideoSpeed);
  const setVideoLoop = useAppStore((s) => s.setVideoLoop);
  const setVideoMuted = useAppStore((s) => s.setVideoMuted);

  const isMuted = useAppStore((s) => {
    if (s.display.videoTransport.muted !== undefined) return s.display.videoTransport.muted;
    const scene = s.display.videoTransport.target === 'program'
      ? s.display.currentScene
      : s.display.previewScene;
    return Boolean(scene?.background?.muted);
  });
  const looping = useAppStore((s) => {
    const scene = s.display.videoTransport.target === 'program'
      ? s.display.currentScene
      : s.display.previewScene;
    return scene?.background?.loop !== false;
  });

  const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  const currentSpeed = transport.speed || 1.0;
  const cycleSpeed = () => {
    const idx = SPEEDS.indexOf(currentSpeed);
    const nextIdx = idx >= 0 && idx < SPEEDS.length - 1 ? idx + 1 : 0;
    setVideoSpeed(SPEEDS[nextIdx]);
  };

  const trackRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const fillRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [railHot, setRailHot] = useState(false);
  const [stripWidth, setStripWidth] = useState(330);

  useEffect(() => {
    const el = stripRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setStripWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const showLoop = stripWidth >= 280;
  const showRestart = stripWidth >= 160;
  const showStep = stripWidth >= 320;
  const showSpeed = stripWidth >= 360;

  const duration = clock.duration;
  const isScrubbing = scrubTime !== null;
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

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 1 : 5;
    if (e.key === ' ') { e.preventDefault(); setVideoPlaying(!transport.playing); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); stepVideo(-step); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); stepVideo(step); }
    else if (e.key === 'Home' || e.key === 'r' || e.key === 'R') { e.preventDefault(); restartVideo(); }
    else if (e.key === 's' || e.key === 'S') { e.preventDefault(); stopVideo(); }
    else if (e.key === 'End') { e.preventDefault(); seekVideo(Math.max(0, duration - 0.1)); }
  };

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
    if (duration <= 0 || isScrubbing || !transport.playing) {
      paint(progressRef.current);
      return;
    }
    let frame = 0;
    const tick = () => {
      const { time, at } = anchorRef.current;
      paint(Math.min(duration, time + ((performance.now() - at) / 1000) * (currentSpeed || 1.0)) / duration);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, isScrubbing, transport.playing, currentSpeed, paint]);

  useEffect(() => {
    if (isScrubbing) paint(progress);
  }, [isScrubbing, progress, paint]);

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
        gap: 6,
        height: 26,
        flex: '0 1 420px',
        minWidth: 140,
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
          onClick={() => restartVideo()}
          title="Restart media from beginning  (Home / R)"
          aria-label="Restart media"
          style={{ ...glyphButton, color: 'var(--text-dim)' }}
        >
          <RestartGlyph />
        </button>
      )}

      {showStep && (
        <button
          type="button"
          onClick={() => stepVideo(-5)}
          title="Rewind 5s  (Left Arrow)"
          aria-label="Rewind 5s"
          style={{ ...glyphButton, color: 'var(--text-dim)' }}
        >
          <RewindGlyph />
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

      <button
        type="button"
        onClick={() => stopVideo()}
        title="Stop media  (S)"
        aria-label="Stop media"
        style={{ ...glyphButton, color: 'var(--text-dim)' }}
      >
        <StopGlyph />
      </button>

      {showStep && (
        <button
          type="button"
          onClick={() => stepVideo(5)}
          title="Fast Forward 5s  (Right Arrow)"
          aria-label="Fast Forward 5s"
          style={{ ...glyphButton, color: 'var(--text-dim)' }}
        >
          <ForwardGlyph />
        </button>
      )}

      {showLoop && (
        <>
          <button
            type="button"
            onClick={() => setVideoLoop(!looping)}
            title={looping ? 'Looping — click to play once' : 'Play once — click to loop'}
            aria-label="Loop"
            aria-pressed={looping}
            style={{
              ...glyphButton,
              color: looping ? 'var(--text-primary)' : 'var(--text-mute)',
            }}
          >
            <LoopGlyph />
          </button>
          <button
            type="button"
            onClick={() => setVideoMuted(!isMuted)}
            title={isMuted ? 'Muted — click to unmute audio' : 'Audio On — click to mute audio'}
            aria-label="Mute Audio"
            aria-pressed={isMuted}
            style={{
              ...glyphButton,
              color: isMuted ? '#EF4444' : 'var(--text-primary)',
            }}
          >
            {isMuted ? <MuteOnGlyph /> : <MuteOffGlyph />}
          </button>
        </>
      )}

      {showSpeed && (
        <button
          type="button"
          onClick={cycleSpeed}
          title={`Speed: ${currentSpeed}x — click to cycle speed`}
          aria-label={`Playback speed ${currentSpeed}x`}
          style={{
            ...glyphButton,
            width: 'auto',
            padding: '0 4px',
            fontSize: '10px',
            fontWeight: 700,
            fontFamily: 'var(--font-signal)',
            color: currentSpeed !== 1.0 ? 'var(--bsp-signal)' : 'var(--text-dim)',
          }}
        >
          {currentSpeed}x
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
          minWidth: 54,
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
              borderRadius: 1,
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
