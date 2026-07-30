/* global window, document, setInterval, clearInterval, setTimeout, clearTimeout, localStorage */
'use strict';

(function createStageDisplayRenderer() {
  const PROGRAM_READY_TIMEOUT_MS = 5000;
  const EMBEDDED_PREVIEW = new URLSearchParams(window.location.search).get('embeddedPreview') === '1';

  // ══ Layout library (EasyVerse-style percentage-grid stage layouts) ══
  // Each zone is positioned on a 100x100 grid and can be themed per operator.
  const LAYOUTS = {
    default: {
      id: 'default',
      name: 'Default',
      bgColor: '#000000',
      zones: [
        { id: 'z-playlist', type: 'playlist', x: 2, y: 1, w: 50, h: 6, fontSize: 16, fontWeight: 700, color: 'accent', textAlign: 'left', visible: true },
        { id: 'z-clock', type: 'clock', x: 80, y: 1, w: 18, h: 6, fontSize: 20, fontWeight: 600, color: 'faint', textAlign: 'right', visible: true },
        { id: 'z-current', type: 'current-text', x: 2, y: 8, w: 96, h: 60, fontSize: 48, fontWeight: 600, color: 'text', textAlign: 'center', visible: true },
        { id: 'z-next', type: 'next-item', x: 2, y: 72, w: 60, h: 8, fontSize: 18, fontWeight: 500, color: 'muted', textAlign: 'left', visible: true },
        { id: 'z-timer', type: 'timer', x: 64, y: 72, w: 34, h: 8, fontSize: 28, fontWeight: 800, color: 'accent', textAlign: 'right', visible: true },
        { id: 'z-messages', type: 'messages', x: 60, y: 1, w: 38, h: 30, fontSize: 22, fontWeight: 700, color: '#ffffff', bgColor: 'rgba(239,68,68,0.9)', textAlign: 'left', borderRadius: 12, padding: 12, visible: true },
      ],
    },
    band: {
      id: 'band',
      name: 'Band / Lyrics',
      bgColor: '#0a0a0a',
      zones: [
        { id: 'z-playlist', type: 'playlist', x: 5, y: 1, w: 50, h: 6, fontSize: 16, fontWeight: 700, color: 'accent', textAlign: 'left', visible: true },
        { id: 'z-clock', type: 'clock', x: 75, y: 78, w: 20, h: 8, fontSize: 18, fontWeight: 600, color: 'faint', textAlign: 'right', visible: true },
        { id: 'z-current', type: 'current-text', x: 5, y: 5, w: 90, h: 70, fontSize: 56, fontWeight: 700, color: 'text', textAlign: 'center', visible: true },
        { id: 'z-next', type: 'next-item', x: 5, y: 78, w: 60, h: 8, fontSize: 16, fontWeight: 500, color: 'muted', textAlign: 'left', visible: true },
      ],
    },
    sermon: {
      id: 'sermon',
      name: 'Sermon Notes',
      bgColor: '#05070d',
      zones: [
        { id: 'z-playlist', type: 'playlist', x: 3, y: 2, w: 60, h: 6, fontSize: 15, fontWeight: 700, color: 'accent', textAlign: 'left', visible: true },
        { id: 'z-clock', type: 'clock', x: 82, y: 2, w: 15, h: 6, fontSize: 18, fontWeight: 600, color: 'faint', textAlign: 'right', visible: true },
        { id: 'z-current', type: 'current-text', x: 3, y: 9, w: 94, h: 38, fontSize: 40, fontWeight: 600, color: 'text', textAlign: 'left', visible: true },
        { id: 'z-next', type: 'next-item', x: 3, y: 50, w: 94, h: 16, fontSize: 20, fontWeight: 500, color: 'muted', textAlign: 'left', visible: true },
        { id: 'z-timer', type: 'timer', x: 3, y: 88, w: 40, h: 8, fontSize: 26, fontWeight: 800, color: 'accent', textAlign: 'left', visible: true },
      ],
    },
    minimal: {
      id: 'minimal',
      name: 'Minimal',
      bgColor: '#000000',
      zones: [
        { id: 'z-current', type: 'current-text', x: 6, y: 18, w: 88, h: 64, fontSize: 72, fontWeight: 800, color: 'text', textAlign: 'center', visible: true },
        { id: 'z-timer', type: 'timer', x: 70, y: 4, w: 26, h: 8, fontSize: 30, fontWeight: 800, color: 'accent', textAlign: 'right', visible: true },
      ],
    },
  };

  // ══ Operator theme (persisted in localStorage) ══
  const THEME_KEY = 'bsp-stage-theme';
  const LAYOUT_KEY = 'bsp-stage-layout';

  function loadTheme() {
    try {
      const raw = safeStorage().getItem(THEME_KEY);
      if (raw) return Object.assign(defaultTheme(), JSON.parse(raw));
    } catch {
      /* ignore corrupt/unavailable storage */
    }
    return defaultTheme();
  }

  function defaultTheme() {
    return {
      accent: '#fbbf24',
      background: '#000000',
      text: '#ffffff',
      fontScale: 1,
      showClock: true,
      showTimer: true,
      showLabels: true,
    };
  }

  // Resolve a semantic color token ("accent"|"text"|"muted"|"faint") to a concrete value.
  function resolveColor(token, theme) {
    switch (token) {
      case 'accent':
        return theme.accent;
      case 'text':
        return theme.text;
      case 'muted':
        return applyAlpha(theme.text, 0.42);
      case 'faint':
        return applyAlpha(theme.text, 0.28);
      default:
        return token;
    }
  }

  function applyAlpha(hex, alpha) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return `rgba(255,255,255,${alpha})`;
    const int = parseInt(m[1], 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  const state = {
    requestedMode: 'confidence',
    current: null,
    next: null,
    timerVisible: true,
    clockVisible: true,
    backgroundColor: '#000000',
    timer: { running: false, startedAtMs: null, accumulatedSeconds: 0 },
    songTitle: '',
    songSubtitle: '',
    programReady: false,
    programFailure: '',
    messages: new Map(),
    theme: loadTheme(),
    layout: LAYOUTS[safeStorage().getItem(LAYOUT_KEY)] || LAYOUTS.default,
    savedLayouts: [],
  };
  const programMessages = new Map();
  let timerInterval = null;
  let programReadyTimer = null;
  let pickerOpen = false;

  const ui = {
    display: document.getElementById('stage-display'),
    zones: document.getElementById('stage-zones'),
    bg: document.getElementById('stage-bg'),
    programFrame: document.getElementById('stage-program-frame'),
    programLoading: document.getElementById('stage-program-loading'),
    fallback: document.getElementById('stage-fallback'),
    watermarkLeft: document.getElementById('stage-watermark-left'),
    settingsBtn: document.getElementById('stage-settings-btn'),
    picker: document.getElementById('stage-picker'),
  };

  // ══ Theme application ══
  function applyTheme() {
    const t = state.theme;
    const root = ui.display;
    root.style.setProperty('--stage-accent', t.accent);
    root.style.setProperty('--stage-text', t.text);
    root.style.setProperty('--stage-font-scale', String(t.fontScale));
    state.backgroundColor = t.background;
    root.style.setProperty('--stage-bg', t.background);
    if (ui.bg) ui.bg.style.background = t.background;
    state.clockVisible = t.showClock;
    state.timerVisible = t.showTimer;
    root.classList.toggle('hide-clock', !t.showClock);
    root.classList.toggle('hide-timer', !t.showTimer);
    root.classList.toggle('hide-labels', !t.showLabels);
  }

  function persistTheme() {
    try {
      safeStorage().setItem(THEME_KEY, JSON.stringify(state.theme));
    } catch {
      /* storage may be unavailable */
    }
  }

  function persistLayout() {
    try {
      safeStorage().setItem(LAYOUT_KEY, state.layout.id);
    } catch {
      /* storage may be unavailable */
    }
  }

  // localStorage can throw for opaque origins (e.g. file:// in some sandboxes).
  function safeStorage() {
    try {
      if (typeof localStorage !== 'undefined') {
        const probe = '__bsp_probe__';
        localStorage.setItem(probe, '1');
        localStorage.removeItem(probe);
        return localStorage;
      }
    } catch {
      /* fall through */
    }
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  }

  // ── reduced motion: expose a flag the CSS reads ──
  function syncReducedMotion() {
    const reduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ui.display.classList.toggle('reduced-motion', !!reduced);
  }

  function formatTime(totalSeconds) {
    const secondsValue = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hours = Math.floor(secondsValue / 3600);
    const minutes = Math.floor((secondsValue % 3600) / 60);
    const seconds = secondsValue % 60;
    return hours > 0
      ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function timerSeconds(nowMs = Date.now()) {
    const elapsed =
      state.timer.running && Number.isFinite(state.timer.startedAtMs)
        ? Math.max(0, nowMs - state.timer.startedAtMs) / 1000
        : 0;
    return (Number(state.timer.accumulatedSeconds) || 0) + elapsed;
  }

  function updateTimer() {
    const value = formatTime(timerSeconds());
    const el = ui.zones.querySelector('[data-zone="timer"] .zone-value');
    if (el) el.textContent = value;
  }

  function updateClock() {
    const now = new Date();
    const value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const el = ui.zones.querySelector('[data-zone="clock"] .zone-value');
    if (el) el.textContent = value;
  }

  function renderMessages() {
    const zone = ui.zones.querySelector('[data-zone="messages"]');
    const container = zone && zone.querySelector('.zone-inner');
    if (!container) return;
    const messages = Array.from(state.messages.values()).slice(-3);
    zone.style.display = messages.length > 0 ? 'flex' : 'none';
    container.innerHTML = '';
    for (const message of messages) {
      const el = document.createElement('div');
      el.className = 'stage-message';
      el.textContent = message.text || '';
      container.appendChild(el);
    }
  }

  function buildZone(zone) {
    const wrap = document.createElement('div');
    wrap.className = `zone zone-${zone.type}`;
    wrap.dataset.zone = zone.type;
    wrap.style.left = `${zone.x}%`;
    wrap.style.top = `${zone.y}%`;
    wrap.style.width = `${zone.w}%`;
    wrap.style.height = `${zone.h}%`;
    if (zone.bgColor) wrap.style.background = zone.bgColor;
    if (zone.borderRadius) wrap.style.borderRadius = `${zone.borderRadius}px`;
    if (zone.padding) wrap.style.padding = `${zone.padding}px`;
    // Operator-chosen font family for this zone (e.g. the Bible current-text zone);
    // cascades to the title/body/value elements built below.
    if (zone.fontFamily) wrap.style.fontFamily = zone.fontFamily;

    const inner = document.createElement('div');
    inner.className = 'zone-inner';

    if (zone.type === 'current-text') {
      const title = document.createElement('div');
      title.className = 'zone-title zone-reference';
      // The current-text title carries the scripture reference (e.g. "Genesis 1:28"); render it
      // as an accent line sitting directly above the verse body. Its size is a percentage of the
      // verse font size (referenceFontScale, default 42), so 100 = same size as the verse.
      const refScale = Number.isFinite(Number(zone.referenceFontScale))
        ? Number(zone.referenceFontScale)
        : 42;
      title.style.fontSize = `${Math.max(16, Math.round((zone.fontSize || 48) * (refScale / 100) * state.theme.fontScale))}px`;
      title.style.fontWeight = 700;
      title.style.textAlign = zone.textAlign || 'center';
      title.style.color = resolveColor('accent', state.theme);
      const body = document.createElement('div');
      body.className = 'zone-body';
      // For scripture/lyrics the projected text lives in the body (the title is empty),
      // so the body honours the zone's full font size/weight/colour — this is what the
      // Stage Layout font controls tune for the Bible text.
      body.style.fontSize = `${Math.round((zone.fontSize || 48) * state.theme.fontScale)}px`;
      body.style.fontWeight = zone.fontWeight || 600;
      body.style.textAlign = zone.textAlign || 'center';
      body.style.color = resolveColor(zone.color || 'text', state.theme);
      const notes = document.createElement('div');
      notes.className = 'zone-notes';
      inner.append(title, body, notes);
      wrap._refs = { title, body, notes };
    } else if (zone.type === 'next-item') {
      const label = document.createElement('div');
      label.className = 'section-label';
      label.textContent = 'Next';
      const title = document.createElement('div');
      title.className = 'zone-title';
      title.style.fontSize = `${Math.round((zone.fontSize || 18) * state.theme.fontScale)}px`;
      title.style.fontWeight = zone.fontWeight || 500;
      title.style.textAlign = zone.textAlign || 'left';
      title.style.color = resolveColor(zone.color || 'muted', state.theme);
      const body = document.createElement('div');
      body.className = 'zone-body';
      body.style.fontSize = `${Math.round((zone.fontSize || 18) * 0.85 * state.theme.fontScale)}px`;
      body.style.textAlign = zone.textAlign || 'left';
      body.style.color = resolveColor(zone.color || 'muted', state.theme);
      inner.append(label, title, body);
      wrap._refs = { title, body };
    } else if (zone.type === 'clock' || zone.type === 'timer') {
      const value = document.createElement('div');
      value.className = 'zone-value';
      value.style.fontSize = `${Math.round((zone.fontSize || 20) * state.theme.fontScale)}px`;
      value.style.color = resolveColor(zone.color || (zone.type === 'timer' ? 'accent' : 'faint'), state.theme);
      inner.appendChild(value);
      wrap._refs = { value };
    } else if (zone.type === 'playlist') {
      const cue = document.createElement('div');
      cue.className = 'zone-cue';
      cue.style.fontSize = `${Math.round((zone.fontSize || 16) * state.theme.fontScale)}px`;
      cue.style.color = resolveColor(zone.color || 'accent', state.theme);
      inner.appendChild(cue);
      wrap._refs = { cue };
    } else if (zone.type === 'messages') {
      // messages injected dynamically
    } else {
      const label = document.createElement('div');
      label.className = 'section-label';
      label.textContent = zone.label || zone.type;
      inner.appendChild(label);
    }

    wrap.appendChild(inner);
    return wrap;
  }

  function renderZones() {
    ui.zones.innerHTML = '';
    for (const zone of state.layout.zones) {
      if (zone.visible === false) continue;
      ui.zones.appendChild(buildZone(zone));
    }
    updateClock();
    updateTimer();
    renderMessages();
    syncContent();
  }

  // Only our own generated verse-number superscripts are allowed through as markup; any other
  // angle bracket means the string was not produced by _stageMarkupFromPage, so fall back to
  // plain text. Verse/lyric body text is HTML-escaped upstream, so this can only ever contain
  // <sup class="stage-verse-num">…</sup>.
  function isSafeVerseMarkup(html) {
    const stripped = String(html || '')
      .replace(/<sup class="stage-verse-num">/g, '')
      .replace(/<\/sup>/g, '');
    return stripped.indexOf('<') === -1 && stripped.indexOf('>') === -1;
  }

  function setBodyContent(el, content) {
    if (!el) return;
    const html = content && typeof content.bodyHtml === 'string' ? content.bodyHtml : '';
    if (html && isSafeVerseMarkup(html)) {
      el.innerHTML = html;
    } else {
      el.textContent = (content && content.body) || '';
    }
  }

  function syncContent() {
    const current = state.current || {};
    const next = state.next || {};
    const currentZone = ui.zones.querySelector('[data-zone="current-text"]');
    const nextZone = ui.zones.querySelector('[data-zone="next-item"]');
    const playlistZone = ui.zones.querySelector('[data-zone="playlist"]');

    let hasContent = false;

    if (currentZone && currentZone._refs) {
      currentZone._refs.title.textContent = current.title || '';
      currentZone._refs.title.style.display = current.title ? '' : 'none';
      setBodyContent(currentZone._refs.body, current);
      currentZone._refs.notes.textContent = current.notes || '';
      if (current.title || current.body) hasContent = true;
    }
    if (nextZone && nextZone._refs) {
      nextZone._refs.title.textContent = next.title || '';
      nextZone._refs.title.style.display = next.title ? '' : 'none';
      setBodyContent(nextZone._refs.body, next);
      if (next.title || next.body) hasContent = true;
    }
    if (playlistZone && playlistZone._refs) {
      const cue = [state.songTitle, state.songSubtitle].filter(Boolean).join(' — ');
      playlistZone._refs.cue.textContent = cue;
      if (cue) hasContent = true;
    }

    ui.display.classList.toggle('has-content', hasContent);
  }

  function render() {
    const fallbackActive =
      (state.requestedMode === 'program' || state.requestedMode === 'hybrid') &&
      !!state.programFailure;
    const effectiveMode = fallbackActive ? 'confidence' : state.requestedMode;

    ui.display.classList.remove('mode-confidence', 'mode-program', 'mode-hybrid', 'program-ready');
    ui.display.classList.add(`mode-${effectiveMode}`);
    ui.display.classList.toggle('program-ready', state.programReady);
    ui.display.style.setProperty('--stage-bg', state.backgroundColor || '#000000');
    if (ui.bg) ui.bg.style.background = state.backgroundColor || '#000000';

    ui.fallback.hidden = !fallbackActive;
    if (fallbackActive) {
      ui.fallback.textContent = `Program preview unavailable: ${state.programFailure}. Confidence view remains active.`;
    }
    ui.programLoading.textContent = state.programFailure
      ? `Program preview failed: ${state.programFailure}`
      : 'Connecting to program preview…';
    updateTimer();
  }

  function postProgramMessage(message) {
    if (!state.programReady || !ui.programFrame.contentWindow) return false;
    ui.programFrame.contentWindow.postMessage(message, '*');
    return true;
  }

  function rememberProgramMessage(message) {
    if (!message || typeof message !== 'object') return;
    const key = String(message.type || `message-${programMessages.size}`);
    programMessages.set(key, message);
    if (message.type === 'stage-message') {
      const msgKey = String(message.id != null ? message.id : key);
      if (message.clear) state.messages.delete(msgKey);
      else state.messages.set(msgKey, { text: String(message.text || '') });
      renderMessages();
    }
    postProgramMessage(message);
  }

  function replayProgramMessages() {
    for (const message of programMessages.values()) postProgramMessage(message);
  }

  function failProgramPreview(reason) {
    state.programReady = false;
    state.programFailure = String(reason || 'embedded renderer did not become ready');
    render();
  }

  function armProgramReadyTimeout() {
    if (programReadyTimer) clearTimeout(programReadyTimer);
    programReadyTimer = setTimeout(() => {
      if (!state.programReady) failProgramPreview('renderer readiness timed out');
    }, PROGRAM_READY_TIMEOUT_MS);
  }

  function handleProgramWindowMessage(event) {
    if (!ui.programFrame.contentWindow || event.source !== ui.programFrame.contentWindow)
      return false;
    const message = event.data && typeof event.data === 'object' ? event.data : {};
    if (message.type !== 'STANDALONE_READY') return false;
    if (programReadyTimer) clearTimeout(programReadyTimer);
    state.programReady = true;
    state.programFailure = '';
    replayProgramMessages();
    render();
    return true;
  }

  function startTimer(atMs = Date.now()) {
    if (!state.timer.running) {
      state.timer.running = true;
      state.timer.startedAtMs = Number(atMs) || Date.now();
    } else if (!Number.isFinite(state.timer.startedAtMs)) {
      state.timer.startedAtMs = Number(atMs) || Date.now();
    }
    if (!timerInterval) timerInterval = setInterval(updateTimer, 250);
    updateTimer();
  }

  function stopTimer(atMs = Date.now()) {
    if (state.timer.running && Number.isFinite(state.timer.startedAtMs)) {
      state.timer.accumulatedSeconds = timerSeconds(Number(atMs) || Date.now());
    }
    state.timer.running = false;
    state.timer.startedAtMs = null;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    updateTimer();
  }

  function handleTimerCommand(payload) {
    if (payload.command === 'start') startTimer(payload.atMs);
    else if (payload.command === 'stop') stopTimer(payload.atMs);
    else if (payload.command === 'reset') {
      stopTimer(payload.atMs);
      state.timer = { running: false, startedAtMs: null, accumulatedSeconds: 0 };
    } else if (payload.command === 'set') {
      state.timer.accumulatedSeconds = Math.max(0, Number(payload.seconds) || 0);
      state.timer.startedAtMs = state.timer.running ? Number(payload.atMs) || Date.now() : null;
    }
    updateTimer();
  }

  // ══ Layout switching (cycles through the library) ══
  function switchLayout(direction = 1) {
    const ids = Object.keys(LAYOUTS);
    const idx = ids.indexOf(state.layout.id);
    const nextIdx = (idx + direction + ids.length) % ids.length;
    state.layout = LAYOUTS[ids[nextIdx]];
    if (ui.bg) ui.bg.style.background = state.layout.bgColor;
    persistLayout();
    renderZones();
    if (ui.watermarkLeft) {
      ui.watermarkLeft.textContent = `Bible Song Pro · ${state.layout.name}`;
    }
    syncPickerSelection();
  }

  function setLayout(id) {
    if (!LAYOUTS[id]) return;
    state.layout = LAYOUTS[id];
    if (ui.bg) ui.bg.style.background = state.layout.bgColor;
    persistLayout();
    renderZones();
    if (ui.watermarkLeft) {
      ui.watermarkLeft.textContent = `Bible Song Pro · ${state.layout.name}`;
    }
    syncPickerSelection();
  }

  // Apply an operator-saved custom layout (from the Stage Layout Editor store) chosen in the
  // footer settings picker. Mirrors setLayout for a non-preset layout object.
  function applyCustomLayout(layout) {
    if (!layout || !Array.isArray(layout.zones)) return;
    state.layout = {
      id: `saved:${layout.id}`,
      name: layout.name || 'Custom',
      bgColor: layout.bgColor || '#000000',
      zones: layout.zones,
    };
    state.backgroundColor = state.layout.bgColor;
    if (ui.bg) ui.bg.style.background = state.layout.bgColor;
    renderZones();
    if (ui.watermarkLeft) {
      ui.watermarkLeft.textContent = `Bible Song Pro · ${state.layout.name}`;
    }
    syncPickerSelection();
  }

  // Pull the operator's saved stage layouts from the store so they appear in the footer picker
  // alongside the built-in presets. Rebuilds the picker once they arrive.
  function fetchSavedStageLayouts() {
    if (!(window.BSPDesktop && typeof window.BSPDesktop.listStageLayouts === 'function')) return;
    Promise.resolve(window.BSPDesktop.listStageLayouts())
      .then((res) => {
        const layouts = res && Array.isArray(res.layouts)
          ? res.layouts
          : Array.isArray(res)
            ? res
            : [];
        state.savedLayouts = layouts.filter((l) => l && Array.isArray(l.zones));
        buildPicker();
        syncPickerSelection();
      })
      .catch(() => {});
  }

  // ══ Picker overlay (visible, operator-friendly) ══
  const ACCENTS = ['#fbbf24', '#0a84ff', '#30d158', '#ff453a', '#bf5af2', '#ff9f0a'];
  const BACKGROUNDS = ['#000000', '#05070d', '#0a0a0a', '#0d1b2a', '#1a1a1a'];

  function applyAccentColor(color) {
    state.theme.accent = color;
    applyTheme();
    persistTheme();
    renderZones();
    syncPickerSelection();
    emitControlState();
  }

  function applyBackgroundColor(color) {
    state.theme.background = color;
    state.backgroundColor = color;
    applyTheme();
    persistTheme();
    syncPickerSelection();
    emitControlState();
  }

  function isValidHex(str) {
    return /^#[0-9a-f]{6}$/i.test(str);
  }

  // Controller → external propagation. In the embedded controller-side preview, any change
  // the operator makes in the Settings picker is posted up to the host panel, which relays it
  // to the main process so the EXTERNAL audience display updates to match. The audience
  // window is a pure output and never originates these (its picker is hidden). Guarded to
  // EMBEDDED_PREVIEW and only fired from local picker actions, so there is no echo loop when
  // the relayed state comes back down.
  function emitControlState() {
    if (!EMBEDDED_PREVIEW) return;
    try {
      const layoutId = state.layout && typeof state.layout.id === 'string' ? state.layout.id : '';
      const isCustom = layoutId.startsWith('saved:') || layoutId === 'custom';
      const config = {
        layout: state.layout.id,
        theme: Object.assign({}, state.theme),
      };
      // A saved/custom layout has no preset id the audience window can look up, so relay the
      // full layout (and its background) rather than just an id.
      if (isCustom) {
        config.customLayout = {
          id: state.layout.id,
          name: state.layout.name,
          bgColor: state.layout.bgColor,
          zones: state.layout.zones,
        };
        config.backgroundColor = state.layout.bgColor;
      }
      window.parent.postMessage(
        {
          __bspStageControl: true,
          payload: { kind: 'config', config },
        },
        '*',
      );
    } catch (_e) {
      /* cross-frame post failed; preview still updates locally */
    }
  }

  function buildPicker() {
    if (!ui.picker) return;
    ui.picker.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'picker-panel';

    const title = document.createElement('div');
    title.className = 'picker-title';
    title.textContent = 'Stage Display';
    panel.appendChild(title);

    const layoutSection = document.createElement('div');
    layoutSection.className = 'picker-section';
    const layoutLabel = document.createElement('div');
    layoutLabel.className = 'picker-label';
    layoutLabel.textContent = 'Layout';
    layoutSection.appendChild(layoutLabel);
    const layoutRow = document.createElement('div');
    layoutRow.className = 'picker-row';
    for (const id of Object.keys(LAYOUTS)) {
      const btn = document.createElement('button');
      btn.className = 'picker-chip';
      btn.dataset.layout = id;
      btn.textContent = LAYOUTS[id].name;
      btn.addEventListener('click', () => {
        setLayout(id);
        emitControlState();
      });
      layoutRow.appendChild(btn);
    }
    // Operator-saved layouts from the Stage Layout Editor store.
    for (const layout of state.savedLayouts || []) {
      const btn = document.createElement('button');
      btn.className = 'picker-chip';
      btn.dataset.layout = `saved:${layout.id}`;
      btn.textContent = layout.name || 'Custom';
      btn.addEventListener('click', () => {
        applyCustomLayout(layout);
        emitControlState();
      });
      layoutRow.appendChild(btn);
    }
    layoutSection.appendChild(layoutRow);
    panel.appendChild(layoutSection);

    const accentSection = document.createElement('div');
    accentSection.className = 'picker-section';
    const accentLabel = document.createElement('div');
    accentLabel.className = 'picker-label';
    accentLabel.textContent = 'Accent';
    accentSection.appendChild(accentLabel);
    const accentRow = document.createElement('div');
    accentRow.className = 'picker-row';
    for (const color of ACCENTS) {
      const sw = document.createElement('button');
      sw.className = 'picker-swatch';
      sw.dataset.accent = color;
      sw.style.background = color;
      sw.setAttribute('aria-label', `Accent ${color}`);
      sw.addEventListener('click', () => {
        applyAccentColor(color);
      });
      accentRow.appendChild(sw);
    }
    accentSection.appendChild(accentRow);

    const accentCustomRow = document.createElement('div');
    accentCustomRow.className = 'picker-custom-row';
    const accentHexInput = document.createElement('input');
    accentHexInput.type = 'text';
    accentHexInput.className = 'picker-hex-input';
    accentHexInput.dataset.colorRole = 'accent';
    accentHexInput.placeholder = '#hex';
    accentHexInput.maxLength = 7;
    accentHexInput.value = state.theme.accent;
    const accentNativePicker = document.createElement('input');
    accentNativePicker.type = 'color';
    accentNativePicker.className = 'picker-native-input';
    accentNativePicker.dataset.colorRole = 'accent';
    accentNativePicker.value = state.theme.accent;
    accentNativePicker.addEventListener('input', () => {
      accentHexInput.value = accentNativePicker.value;
      applyAccentColor(accentNativePicker.value);
    });
    accentHexInput.addEventListener('change', () => {
      let val = accentHexInput.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (isValidHex(val)) {
        accentNativePicker.value = val;
        applyAccentColor(val);
      } else {
        accentHexInput.value = state.theme.accent;
      }
    });
    accentHexInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') accentHexInput.dispatchEvent(new Event('change'));
    });
    accentCustomRow.appendChild(accentNativePicker);
    accentCustomRow.appendChild(accentHexInput);
    accentSection.appendChild(accentCustomRow);
    panel.appendChild(accentSection);

    const bgSection = document.createElement('div');
    bgSection.className = 'picker-section';
    const bgLabel = document.createElement('div');
    bgLabel.className = 'picker-label';
    bgLabel.textContent = 'Background';
    bgSection.appendChild(bgLabel);
    const bgRow = document.createElement('div');
    bgRow.className = 'picker-row';
    for (const color of BACKGROUNDS) {
      const sw = document.createElement('button');
      sw.className = 'picker-swatch picker-swatch-wide';
      sw.dataset.background = color;
      sw.style.background = color;
      sw.setAttribute('aria-label', `Background ${color}`);
      sw.addEventListener('click', () => {
        applyBackgroundColor(color);
      });
      bgRow.appendChild(sw);
    }
    bgSection.appendChild(bgRow);

    const bgCustomRow = document.createElement('div');
    bgCustomRow.className = 'picker-custom-row';
    const bgHexInput = document.createElement('input');
    bgHexInput.type = 'text';
    bgHexInput.className = 'picker-hex-input';
    bgHexInput.dataset.colorRole = 'background';
    bgHexInput.placeholder = '#hex';
    bgHexInput.maxLength = 7;
    bgHexInput.value = state.theme.background;
    const bgNativePicker = document.createElement('input');
    bgNativePicker.type = 'color';
    bgNativePicker.className = 'picker-native-input';
    bgNativePicker.dataset.colorRole = 'background';
    bgNativePicker.value = state.theme.background;
    bgNativePicker.addEventListener('input', () => {
      bgHexInput.value = bgNativePicker.value;
      applyBackgroundColor(bgNativePicker.value);
    });
    bgHexInput.addEventListener('change', () => {
      let val = bgHexInput.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (isValidHex(val)) {
        bgNativePicker.value = val;
        applyBackgroundColor(val);
      } else {
        bgHexInput.value = state.theme.background;
      }
    });
    bgHexInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') bgHexInput.dispatchEvent(new Event('change'));
    });
    bgCustomRow.appendChild(bgNativePicker);
    bgCustomRow.appendChild(bgHexInput);
    bgSection.appendChild(bgCustomRow);
    panel.appendChild(bgSection);

    const toggleSection = document.createElement('div');
    toggleSection.className = 'picker-section';
    const toggleLabel = document.createElement('div');
    toggleLabel.className = 'picker-label';
    toggleLabel.textContent = 'Show';
    toggleSection.appendChild(toggleLabel);
    const toggleRow = document.createElement('div');
    toggleRow.className = 'picker-row';
    const toggles = [
      { key: 'showClock', label: 'Clock' },
      { key: 'showTimer', label: 'Timer' },
      { key: 'showLabels', label: 'Labels' },
    ];
    for (const t of toggles) {
      const btn = document.createElement('button');
      btn.className = 'picker-chip';
      btn.dataset.toggle = t.key;
      btn.textContent = t.label;
      btn.addEventListener('click', () => {
        state.theme[t.key] = !state.theme[t.key];
        applyTheme();
        persistTheme();
        syncPickerSelection();
        emitControlState();
      });
      toggleRow.appendChild(btn);
    }
    toggleSection.appendChild(toggleRow);
    panel.appendChild(toggleSection);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'picker-reset';
    resetBtn.textContent = 'Reset to defaults';
    resetBtn.addEventListener('click', () => {
      state.theme = defaultTheme();
      applyTheme();
      persistTheme();
      renderZones();
      syncPickerSelection();
      emitControlState();
    });
    panel.appendChild(resetBtn);

    ui.picker.appendChild(panel);
    syncPickerSelection();
  }

  function syncPickerSelection() {
    if (!ui.picker) return;
    ui.picker.querySelectorAll('.picker-chip[data-layout]').forEach((el) => {
      el.classList.toggle('active', el.dataset.layout === state.layout.id);
    });
    ui.picker.querySelectorAll('.picker-swatch[data-accent]').forEach((el) => {
      el.classList.toggle('active', el.dataset.accent === state.theme.accent);
    });
    ui.picker.querySelectorAll('.picker-swatch[data-background]').forEach((el) => {
      el.classList.toggle('active', el.dataset.background === state.theme.background);
    });
    ui.picker.querySelectorAll('.picker-chip[data-toggle]').forEach((el) => {
      el.classList.toggle('active', state.theme[el.dataset.toggle] === true);
    });
    ui.picker.querySelectorAll('.picker-hex-input[data-color-role="accent"]').forEach((el) => {
      if (document.activeElement !== el) el.value = state.theme.accent;
    });
    ui.picker.querySelectorAll('.picker-hex-input[data-color-role="background"]').forEach((el) => {
      if (document.activeElement !== el) el.value = state.theme.background;
    });
    ui.picker.querySelectorAll('.picker-native-input[data-color-role="accent"]').forEach((el) => {
      el.value = state.theme.accent;
    });
    ui.picker.querySelectorAll('.picker-native-input[data-color-role="background"]').forEach((el) => {
      el.value = state.theme.background;
    });
  }

  function togglePicker(force) {
    if (!ui.picker) return;
    pickerOpen = typeof force === 'boolean' ? force : !pickerOpen;
    ui.picker.classList.toggle('open', pickerOpen);
    if (pickerOpen) {
      // Refresh saved layouts each time the picker opens so ones saved since launch appear.
      fetchSavedStageLayouts();
      syncPickerSelection();
    }
  }

  function handleStateUpdate(payload) {
    if (!payload || typeof payload !== 'object') return false;
    if (payload.kind === 'program-output') {
      rememberProgramMessage(payload.message || {});
      return true;
    }
    if (payload.kind === 'timer-command') {
      handleTimerCommand(payload);
      return true;
    }
    if (payload.kind === 'timer') {
      state.timer = Object.assign({}, state.timer, payload.timer || {});
      if (state.timer.running) startTimer(state.timer.startedAtMs);
      else stopTimer();
      return true;
    }
    if (payload.kind === 'message') {
      const msgKey = String(payload.id != null ? payload.id : `msg-${state.messages.size}`);
      if (payload.clear) state.messages.delete(msgKey);
      else state.messages.set(msgKey, { text: String(payload.text || '') });
      renderMessages();
      return true;
    }

    const value = payload.kind === 'config' ? payload.config || {} : payload;

    // Remote layout/theme control (EasyVerse-style targetOutputs parity)
    if (value.layout && LAYOUTS[value.layout]) {
      setLayout(value.layout);
    }
    // Operator-authored layout from the Stage Layout Editor: draw these zones in place of
    // the built-in preset. The zones reuse the renderer's zone `type` vocabulary.
    if (value.customLayout && Array.isArray(value.customLayout.zones)) {
      state.layout = {
        id: 'custom',
        name: value.customLayout.name || 'Custom',
        bgColor: value.customLayout.bgColor || '#000000',
        zones: value.customLayout.zones,
      };
      // Keep the painted background in sync with the layout's chosen bgColor so the later
      // render() (which paints from state.backgroundColor) does not revert it.
      state.backgroundColor = state.layout.bgColor;
      if (ui.bg) ui.bg.style.background = state.layout.bgColor;
      if (ui.watermarkLeft) ui.watermarkLeft.textContent = `Bible Song Pro · ${state.layout.name}`;
      renderZones();
    }
    if (value.theme && typeof value.theme === 'object') {
      Object.assign(state.theme, value.theme);
      applyTheme();
      persistTheme();
      renderZones();
    }

    if (payload.kind === 'content' || 'current' in value) state.current = value.current || null;
    if (payload.kind === 'content' || 'next' in value) state.next = value.next || null;
    if ('songTitle' in value) state.songTitle = String(value.songTitle || '');
    if ('songSubtitle' in value) state.songSubtitle = String(value.songSubtitle || '');
    if ('mode' in value || 'contentMode' in value) {
      const requested = String(value.mode || value.contentMode || 'confidence');
      state.requestedMode =
        requested === 'program' || requested === 'hybrid' ? requested : 'confidence';
    }
    if ('timerVisible' in value) state.timerVisible = value.timerVisible !== false;
    if ('clockVisible' in value) state.clockVisible = value.clockVisible !== false;
    if ('backgroundColor' in value) state.backgroundColor = String(value.backgroundColor || '#000000');
    if (payload.type && !payload.kind) rememberProgramMessage(payload);
    syncContent();
    render();
    return true;
  }

  // Keyboard shortcuts (EasyVerse: L = layout, Esc = clear/close).
  // Note: "P" is intentionally NOT bound here — it clashes with the panel-wide
  // "P" (clear/enable program display) shortcut. Settings are opened by clicking
  // the footer "Settings" button instead (see ui.settingsBtn below).
  window.addEventListener('keydown', (event) => {
    if (event.key === 'l' || event.key === 'L') switchLayout(1);
    else if (event.key === 'Escape') {
      if (pickerOpen) togglePicker(false);
      else {
        state.messages.clear();
        renderMessages();
      }
    }
  });

  // Footer "Settings" button opens the layout/theme picker (replaces the old P shortcut).
  // It belongs ONLY to the controller-side embedded preview — the external audience display
  // is a pure output, so the picker is hidden there (operators must never surface settings on
  // the screen the congregation sees). Changes made here propagate outward via emitControlState.
  if (ui.settingsBtn) {
    if (EMBEDDED_PREVIEW) {
      ui.settingsBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        togglePicker();
      });
    } else {
      // Audience display: hide the whole operator hint group (Settings button + L/Esc hints),
      // leaving just the "Bible Song Pro · <layout>" watermark on the left.
      const hintGroup = document.getElementById('stage-watermark-right');
      if (hintGroup) hintGroup.hidden = true;
      else ui.settingsBtn.hidden = true;
    }
  }

  // ── Right-click context menu (controller-side only) ──
  const ctxMenu = document.getElementById('stage-context-menu');
  if (EMBEDDED_PREVIEW && ctxMenu) {
    const ctxItems = [
      { label: 'Settings', action: () => togglePicker(true) },
    ];
    function buildCtxMenu() {
      ctxMenu.innerHTML = '';
      for (const item of ctxItems) {
        const btn = document.createElement('button');
        btn.className = 'stage-context-menu__item';
        btn.textContent = item.label;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          hideCtxMenu();
          item.action();
        });
        ctxMenu.appendChild(btn);
      }
    }
    function showCtxMenu(x, y) {
      buildCtxMenu();
      ctxMenu.hidden = false;
      const rect = ctxMenu.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width - 4;
      const maxY = window.innerHeight - rect.height - 4;
      ctxMenu.style.left = `${Math.min(x, maxX)}px`;
      ctxMenu.style.top = `${Math.min(y, maxY)}px`;
    }
    function hideCtxMenu() {
      ctxMenu.hidden = true;
    }
    ui.display.addEventListener('contextmenu', (e) => {
      if (pickerOpen) return;
      e.preventDefault();
      showCtxMenu(e.clientX, e.clientY);
    });
    window.addEventListener('click', hideCtxMenu);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !ctxMenu.hidden) hideCtxMenu();
    });
  } else if (ctxMenu) {
    ctxMenu.hidden = true;
  }

  ui.programFrame.addEventListener('load', () => {
    state.programReady = false;
    state.programFailure = '';
    armProgramReadyTimeout();
    render();
  });
  ui.programFrame.addEventListener('error', () =>
    failProgramPreview('embedded renderer failed to load'),
  );
  window.addEventListener('message', (event) => {
    if (
      EMBEDDED_PREVIEW &&
      event.source === window.parent &&
      event.data &&
      event.data.__bspStageDisplayState === true
    ) {
      handleStateUpdate(event.data.payload);
      return;
    }
    handleProgramWindowMessage(event);
  });
  if (window.matchMedia) {
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', syncReducedMotion);
  }

  // ── Boot ──
  applyTheme();
  syncReducedMotion();
  if (ui.watermarkLeft) {
    ui.watermarkLeft.textContent = `Bible Song Pro · ${state.layout.name}`;
  }
  buildPicker();
  fetchSavedStageLayouts();
  updateClock();
  setInterval(updateClock, 10000);
  armProgramReadyTimeout();
  renderZones();
  render();

  if (!EMBEDDED_PREVIEW && window.BSPDesktop && typeof window.BSPDesktop.onStageDisplayState === 'function') {
    window.BSPDesktop.onStageDisplayState(handleStateUpdate);
    if (typeof window.BSPDesktop.sendStageDisplayState === 'function') {
      window.BSPDesktop.sendStageDisplayState({ kind: 'renderer-ready', atMs: Date.now() });
    }
  }

  window.__BSP_STAGE_DISPLAY_TEST__ = {
    handleStateUpdate,
    handleProgramWindowMessage,
    failProgramPreview,
    timerSeconds,
    renderMessages,
    switchLayout,
    setLayout,
    togglePicker,
    applyTheme,
    syncReducedMotion,
    getSnapshot: () => ({
      requestedMode: state.requestedMode,
      programReady: state.programReady,
      programFailure: state.programFailure,
      cachedProgramMessages: programMessages.size,
      activeMessages: state.messages.size,
      layoutId: state.layout.id,
      theme: Object.assign({}, state.theme),
    }),
  };
})();
