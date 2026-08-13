/* =========================================================================
   <NoticeStack> — the app's one notification surface
   -------------------------------------------------------------------------
   Everything the operator needs told, told the same way: imports, stream
   state, workspace saves, and the fact that an announcement has gone to the
   projector. One surface rather than two, because an app that reports the
   same class of thing in two different shapes teaches nobody where to look.
   ========================================================================= */
import { useEffect, useRef, useState } from 'react';
import type { Alert } from '../types';
import { useAppStore } from '../stores/appStore';
import './NoticeStack.css';

/** Milliseconds a notice stays up. Shared with the old alert contract. */
function durationMs(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 4000;
  /* Callers disagree about the unit — some pass 4 meaning seconds, some 6000
     meaning milliseconds. Nothing wants a 100-second notice, so a value that
     large is read as the milliseconds it plainly is. */
  return duration > 100 ? duration : duration * 1000;
}

type Tone = 'info' | 'warning' | 'onscreen';

function toneFor(alert: Alert, onScreen: boolean): Tone {
  if (onScreen) return 'onscreen';
  return alert.type === 'warning' ? 'warning' : 'info';
}

function NoticeIcon({ tone }: { tone: Tone }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (tone === 'warning') {
    return (
      <svg {...common}>
        <path d="M8 2.2 1.6 13.4h12.8L8 2.2Z" />
        <path d="M8 6.6v3" />
        <path d="M8 11.6h.01" />
      </svg>
    );
  }

  if (tone === 'onscreen') {
    // A screen, because that is literally where this one went.
    return (
      <svg {...common}>
        <rect x="1.6" y="2.6" width="12.8" height="8.8" rx="1.4" />
        <path d="M5.6 14h4.8" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M2.6 8.4 6.2 12l7.2-8" />
    </svg>
  );
}

interface NoticeItem {
  alert: Alert;
  onScreen: boolean;
}

function Notice({ item, onDismiss }: { item: NoticeItem; onDismiss: () => void }) {
  const total = durationMs(item.alert.duration);
  const tone = toneFor(item.alert, item.onScreen);
  const [leaving, setLeaving] = useState(false);

  /* The timer is held rather than fired-and-forgotten so hovering can pause
     it. `remaining` survives across pauses; `startedAt` is when the current
     run began. */
  const remaining = useRef(total);
  const startedAt = useRef(Date.now());
  const timer = useRef<number | undefined>(undefined);

  const close = () => {
    window.clearTimeout(timer.current);
    setLeaving(true);
    // Matches --d-state; the row collapses before it is unmounted so the
    // notices above it settle instead of snapping down.
    window.setTimeout(onDismiss, 140);
  };

  const run = () => {
    startedAt.current = Date.now();
    timer.current = window.setTimeout(close, remaining.current);
  };

  const pause = () => {
    window.clearTimeout(timer.current);
    remaining.current = Math.max(300, remaining.current - (Date.now() - startedAt.current));
  };

  useEffect(() => {
    run();
    return () => window.clearTimeout(timer.current);
    // Deliberately once: a notice's clock starts when it appears and is not
    // restarted by anything except the operator's pointer leaving it.
  }, []);

  return (
    <div
      className={`notice notice--${tone} ${leaving ? 'notice--leaving' : 'notice--entering'}`}
      role="status"
      aria-live="polite"
      onMouseEnter={pause}
      onMouseLeave={run}
    >
      <span className="notice__icon"><NoticeIcon tone={tone} /></span>
      <div className="notice__text">
        {item.onScreen && <span className="notice__tag">On screen</span>}
        {item.alert.text}
      </div>
      <button type="button" className="notice__close" onClick={close} title="Dismiss" aria-label="Dismiss">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" />
        </svg>
      </button>
      <span
        className="notice__timer"
        style={{ animationDuration: `${total}ms` }}
      />
    </div>
  );
}

export function NoticeStack() {
  const notices = useAppStore((s) => s.notices);
  const dismissNotice = useAppStore((s) => s.dismissNotice);
  const activeAlert = useAppStore((s) => s.activeAlert);
  const dismissAlert = useAppStore((s) => s.dismissAlert);

  /* The room announcement is reported here too, tagged, rather than getting a
     banner of its own. The operator triggered it and can see it on the Program
     pane — what they need from this surface is confirmation it left, which is
     the same job every other notice does. */
  const items: NoticeItem[] = [
    ...notices.map((alert) => ({ alert, onScreen: false })),
    ...(activeAlert ? [{ alert: activeAlert, onScreen: true }] : []),
  ];

  if (items.length === 0) return null;

  return (
    <div className="notice-stack">
      {items.map((item) => (
        <Notice
          key={item.alert.id}
          item={item}
          onDismiss={() => (item.onScreen ? dismissAlert() : dismissNotice(item.alert.id))}
        />
      ))}
    </div>
  );
}
