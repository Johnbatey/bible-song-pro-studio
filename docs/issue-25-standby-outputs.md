# Issue #25 — standby branding reaches the NDI/OBS feed

Not a defect: the console cannot currently express "logo on the projector, nothing on
the stream". This note records why, and two ways out, for a decision before any code
changes.

## What happens today

- `standbyMedia` is a single value in the renderer store (`src/renderer/stores/appStore.ts`,
  `showStandbyBrand` and `standbyMedia`), not per output.
- `App.tsx` sends it in one state payload (`showStandbyBrand`, `standbyMedia`) with the
  rest of the display state; main broadcasts that same payload to the projector window,
  the stage displays and every NDI feed.
- `ProgramSurface.tsx` (~1164) paints `standbyMedia` full-bleed whenever no scene is live.
  That component is what both the audience display and the NDI output render, so any
  standby treatment is, by construction, the same on both.
- `showStandbyBrand: false` gives black rather than the logo — still opaque, so an OBS
  browser source sees a black rectangle over any video it is layered onto.
- The seam that already exists: `transformDisplayStateForFeed()` in `main.cjs` rewrites
  the display state per NDI feed (it is how `contentFilter` works), so a per-feed answer
  has somewhere to live without forking the renderer.

## Design 1 — per-output standby state

Give standby branding its own small state model with one entry per output class:

```ts
standbyBranding: { audience: boolean; ndi: boolean }   // or per feed id
```

- `ProgramSurface` takes the flag for the output it is rendering (a prop, or an output
  kind already present in state).
- `App.tsx` keeps sending both flags; `transformDisplayStateForFeed()` resolves the feed's
  value — feed override first, then the global setting — before the feed window paints.
- Settings gains two switches where the single "standby branding" switch is today: what
  the room sees, and what the stream sees.

**Pros.** Says exactly what operators ask for: brand the room, leave the stream clean. The
projector keeps its card, OBS keeps only its own lower thirds. Survives independent of
whether the browser source is transparent. The per-feed transform already exists.

**Cons.** A real state-model change: store shape, the sendState payload, the state type in
`ProgramSurface`, the feed transform, and the settings UI all move together. Feed-level
overrides invite a precedence question (feed overrides global, or replaces it?). More
settings for something most churches set once. NDI output itself is a captured surface, so
"the NDI feed is clean" still needs the feed's renderer to paint nothing — the flag has to
reach the window, not just the state.

## Design 2 — transparent when idle

Render nothing (no card, no black fill) when no scene is live, relying on the display
window's existing `transparent: true`.

- `ProgramSurface` drops the idle background entirely when `showStandbyBrand` is off.
- The audience display's own `body`/root background must become transparent for the window,
  and `backgroundColor` in the display `BrowserWindow` options must allow alpha.

**Pros.** Tiny: one component and one stylesheet, no state-model change, no new settings,
no per-output precedence to explain. Gives OBS a genuinely keyable source — anything under
the browser source shows through between items, which is what a "no branding on stream"
user actually wants.

**Cons.** The projector is the same window type, so the room also loses its black — on a
window with alpha, "nothing" can mean the desktop showing through the projector, which is
worse than black. It changes behaviour for everyone currently relying on the idle card, and
it only helps outputs that can composite alpha; an NDI feed without alpha support would
still be black on the receiving side. It also conflates two settings ("show the logo" and
"be transparent") that operators may want independently.

## What to decide

1. Is the request "the stream should carry no branding" (Design 1) or "the stream should be
   see-through between items" (Design 2)? They are different features and a church may want
   both.
2. If Design 1: is the choice global (audience vs NDI) or per feed? Global is much less code
   and covers the reported case.
3. If Design 2: what should the projector show when the browser source is transparent — a
   forced black fill for the projector window only, or the same transparency (and therefore
   the desktop)?

Either way the change lands in the renderer plus the display state payload, not in the NDI
capture path, so it can be tested on a normal projector window before touching a real OBS
session.
