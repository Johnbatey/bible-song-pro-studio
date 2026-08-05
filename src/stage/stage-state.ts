/* =========================================================================
   Stage display — state and the operator message vocabulary
   -------------------------------------------------------------------------
   One pure reducer over the messages the operator side sends. The old page
   applied each message by poking the DOM from inside the handler, which is why
   its update function was 60 lines of `if` mixed with `querySelector`. Here the
   messages only produce state and the components render it, so the vocabulary
   can be read in one place and tested without a document.

   Ported from handleStateUpdate/handleTimerCommand in the old
   public/stage-display/stage-display.js.
   ========================================================================= */
import { LAYOUTS, type StageLayout } from './layouts';
import { defaultTheme, loadLayoutId, loadTheme, type StageTheme } from './theme';

export interface StageContent {
  title?: string;
  body?: string;
  /** Verse-number superscripts only — see isSafeVerseMarkup in StageZones. */
  bodyHtml?: string;
  notes?: string;
}

export interface StageMessage {
  id: string;
  text: string;
}

export interface StageTimer {
  running: boolean;
  startedAtMs: number | null;
  accumulatedSeconds: number;
}

/** confidence = zones only, program = output only, hybrid = zones over output. */
export type StageMode = 'confidence' | 'program' | 'hybrid';

export interface StageState {
  mode: StageMode;
  current: StageContent | null;
  next: StageContent | null;
  timerVisible: boolean;
  clockVisible: boolean;
  backgroundColor: string;
  timer: StageTimer;
  songTitle: string;
  songSubtitle: string;
  messages: StageMessage[];
  theme: StageTheme;
  layout: StageLayout;
}

export function initialStageState(): StageState {
  const theme = loadTheme();
  const layout = LAYOUTS[loadLayoutId() || ''] || LAYOUTS.default;
  return {
    mode: 'confidence',
    current: null,
    next: null,
    // The theme's toggles are the source of truth at boot; a later message can
    // still override either independently.
    timerVisible: theme.showTimer,
    clockVisible: theme.showClock,
    backgroundColor: theme.background,
    timer: { running: false, startedAtMs: null, accumulatedSeconds: 0 },
    songTitle: '',
    songSubtitle: '',
    messages: [],
    theme,
    layout,
  };
}

/* ---- timer --------------------------------------------------------------- */

/** Elapsed seconds, counting the in-flight run when the timer is going. */
export function timerSeconds(timer: StageTimer, nowMs: number = Date.now()): number {
  const elapsed = timer.running && Number.isFinite(timer.startedAtMs)
    ? Math.max(0, nowMs - (timer.startedAtMs as number)) / 1000
    : 0;
  return (Number(timer.accumulatedSeconds) || 0) + elapsed;
}

export function formatTime(totalSeconds: number): string {
  const value = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = value % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function applyTimerCommand(timer: StageTimer, payload: Record<string, unknown>): StageTimer {
  const atMs = Number(payload.atMs) || Date.now();
  switch (payload.command) {
    case 'start':
      // Re-starting a running timer must not restart its clock; it only
      // repairs a startedAtMs that was never set.
      if (timer.running) {
        return Number.isFinite(timer.startedAtMs) ? timer : { ...timer, startedAtMs: atMs };
      }
      return { ...timer, running: true, startedAtMs: atMs };
    case 'stop':
      return {
        running: false,
        startedAtMs: null,
        accumulatedSeconds: timer.running && Number.isFinite(timer.startedAtMs)
          ? timerSeconds(timer, atMs)
          : timer.accumulatedSeconds,
      };
    case 'reset':
      return { running: false, startedAtMs: null, accumulatedSeconds: 0 };
    case 'set':
      return {
        ...timer,
        accumulatedSeconds: Math.max(0, Number(payload.seconds) || 0),
        startedAtMs: timer.running ? atMs : null,
      };
    default:
      return timer;
  }
}

/* ---- messages ------------------------------------------------------------ */

/** Replace in place when the id is already posted, so a re-sent message does
    not jump to the bottom of the stack while the reader is mid-sentence. */
function upsertMessage(messages: StageMessage[], id: string, text: string): StageMessage[] {
  const index = messages.findIndex((m) => m.id === id);
  if (index === -1) return [...messages, { id, text }];
  const next = [...messages];
  next[index] = { id, text };
  return next;
}

/* ---- the reducer --------------------------------------------------------- */

type Payload = Record<string, unknown>;

/**
 * Fold one operator message into the stage state.
 *
 * Returns the same object when a message changes nothing, so React can skip
 * the render — the operator side re-sends state freely.
 */
export function reduceStage(state: StageState, payload: unknown): StageState {
  if (!payload || typeof payload !== 'object') return state;
  const msg = payload as Payload;

  if (msg.kind === 'timer-command') {
    return { ...state, timer: applyTimerCommand(state.timer, msg) };
  }

  if (msg.kind === 'timer') {
    return { ...state, timer: { ...state.timer, ...(msg.timer as Partial<StageTimer> || {}) } };
  }

  if (msg.kind === 'message') {
    const id = String(msg.id != null ? msg.id : `msg-${state.messages.length}`);
    return {
      ...state,
      messages: msg.clear
        ? state.messages.filter((m) => m.id !== id)
        : upsertMessage(state.messages, id, String(msg.text || '')),
    };
  }

  /* A program-output envelope carries the operator's own display messages. The
     old page relayed these into its <iframe>; the only one that ever meant
     anything to the stage itself is stage-message, and the relay is gone with
     the iframe. */
  if (msg.kind === 'program-output' || (msg.type && !msg.kind)) {
    const inner = (msg.kind === 'program-output' ? (msg.message as Payload) : msg) || {};
    if (inner.type !== 'stage-message') return state;
    const id = String(inner.id != null ? inner.id : 'stage-message');
    return {
      ...state,
      messages: inner.clear
        ? state.messages.filter((m) => m.id !== id)
        : upsertMessage(state.messages, id, String(inner.text || '')),
    };
  }

  const value = (msg.kind === 'config' ? (msg.config as Payload) : msg) || {};
  let next = state;
  const set = (patch: Partial<StageState>) => { next = { ...next, ...patch }; };

  if (typeof value.layout === 'string' && LAYOUTS[value.layout]) {
    set({ layout: LAYOUTS[value.layout], backgroundColor: LAYOUTS[value.layout].bgColor });
  }

  /* An operator-authored layout from the Stage Layout editor draws in place of
     the preset, reusing the same zone vocabulary. Its bgColor also becomes the
     painted background, or the next render would revert it. */
  const custom = value.customLayout as Payload | undefined;
  if (custom && Array.isArray(custom.zones)) {
    const layout: StageLayout = {
      id: 'custom',
      name: String(custom.name || 'Custom'),
      bgColor: String(custom.bgColor || '#000000'),
      zones: custom.zones as StageLayout['zones'],
    };
    set({ layout, backgroundColor: layout.bgColor });
  }

  if (value.theme && typeof value.theme === 'object') {
    const theme = { ...next.theme, ...(value.theme as Partial<StageTheme>) };
    set({
      theme,
      backgroundColor: theme.background,
      clockVisible: theme.showClock,
      timerVisible: theme.showTimer,
    });
  }

  /* Also reachable bare, not only as {kind:'timer'}: the main process replays a
     late-opening window one accumulated value object, and the timer has to
     survive that trip like everything else. */
  if ('timer' in value) set({ timer: { ...next.timer, ...(value.timer as Partial<StageTimer> || {}) } });
  if (msg.kind === 'content' || 'current' in value) set({ current: (value.current as StageContent) || null });
  if (msg.kind === 'content' || 'next' in value) set({ next: (value.next as StageContent) || null });
  if ('songTitle' in value) set({ songTitle: String(value.songTitle || '') });
  if ('songSubtitle' in value) set({ songSubtitle: String(value.songSubtitle || '') });
  if ('mode' in value || 'contentMode' in value) {
    const requested = String(value.mode || value.contentMode || 'confidence');
    set({ mode: requested === 'program' || requested === 'hybrid' ? requested : 'confidence' });
  }
  if ('timerVisible' in value) set({ timerVisible: value.timerVisible !== false });
  if ('clockVisible' in value) set({ clockVisible: value.clockVisible !== false });
  if ('backgroundColor' in value) set({ backgroundColor: String(value.backgroundColor || '#000000') });

  return next;
}

/** Reset content without disturbing the operator's theme or layout — what Esc
    does on the stage window. */
export function clearStageContent(state: StageState): StageState {
  return { ...state, current: null, next: null, messages: [], songTitle: '', songSubtitle: '' };
}

export { defaultTheme };
