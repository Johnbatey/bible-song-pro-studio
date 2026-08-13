# Bible Song Pro Studio

The Electron desktop console for church presentation, live scripture detection and streaming
output. One operator machine drives an audience projector, an on-stage confidence monitor, and
an NDI or OBS feed for the stream — from a single service plan.

> Studio is the shipped desktop app. Version 3.0.0, GPL-3.0-or-later.

## What it runs

| Window | Entry | Purpose |
|---|---|---|
| Operator console | `index.html` → `src/renderer` | Service plan, songs, Bible, slides, themes, settings |
| Audience display | `audience-display.html` → `src/display` | What the congregation sees, driven over IPC |
| Stage display | `stage-display.html` → `src/stage` | Confidence monitor: next verse, clock, notes |
| Stage designer | `stage-designer.html` → `src/stage-designer` | Lays out the stage zones |
| Browser / remote | `display.html`, HTTP + WebSocket on `:8942` | Optional network output and the phone remote |

The audience path is IPC, not WebSocket — `display.html` survives only for browser output and
remote compatibility. [docs/display-pipeline.md](docs/display-pipeline.md) explains the split and
the guards that keep it that way.

Main-process services live in [src/electron](src/electron), one file per concern: Bible lookup and
verse indexing, deck (PPTX/PDF) reading, media library, transcription (Deepgram and local Whisper),
NDI, OBS, settings and persistence.

## Requirements

- Node.js 18, 20, or 22+ — Vite 6's supported range — and npm
- macOS, Windows, or Linux — Electron 33
- Optional, only for the features that need them:
  - **NDI output** — the NDI SDK/runtime installed. `src/electron/ndi-service.cjs` probes
    `/usr/local/lib/libndi.dylib`, the macOS SDK path, `libndi.so`, and the Windows v5 runtime DLL;
    set `NDI_RUNTIME_DIR_V5` to point somewhere else.
  - **Deepgram streaming transcription** — an API key, entered in Settings. Keys are written to
    `userData/settings.json` with mode `0600` and are never readable from the renderer; the UI is
    told only *whether* a key is set.

## Getting started

```bash
npm install
```

Then install the git hooks — the pre-commit hook refuses to commit an unvetted Bible translation:

```bash
node scripts/install-hooks.cjs
```

Run the app:

```bash
npm start
```

`npm start` builds the renderer and launches Electron. While iterating on the renderer alone,
`npm run dev` serves Vite on its own; `npm run start:quick` relaunches Electron against the last
build without rebuilding.

## Building installers

```bash
npm run build:mac
```

`build:mac:intel` and `build:mac:universal` cover the other Mac targets; `build:win` produces NSIS
and portable builds, `build:linux` an AppImage and a `.deb`. Output lands in `release/`. The
`dist:*` variants add `--publish always`.

Mac builds run with `CSC_IDENTITY_AUTO_DISCOVERY=false`, so they are unsigned unless you set up
signing yourself. The hardened-runtime entitlements are in `assets/entitlements.mac.plist`, and the
usage strings — microphone, camera, screen capture, local network for NDI Bonjour — are in the
`build.mac.extendInfo` block of `package.json`.

## Verification

There is no unit-test suite yet. What exists instead is a set of end-to-end verifier scripts under
`scripts/`, run through npm:

```bash
npm run verify:all
```

| Command | Covers |
|---|---|
| `npm run typecheck` | `tsc --noEmit` across the whole project |
| `npm run verify:bibles` | 66-book canon for every bundled translation, plus licensing |
| `npm run verify:display-all` | Typecheck, display architecture, dev stack, and production `file://` load |
| `npm run verify:media` | Media library and the `/media/` Range-request route |
| `npm run verify:slide-parity` | Slide element rendering against the reference engine |
| `npm run test:live-scripture` | Spoken and written scripture reference parsing |

Screenshots and JSON reports are written to `artifacts/`, which is not tracked.

The slide-engine parity checks need real PowerPoint decks staged in `public/__parity/`. Those decks
are not committed — see [scripts/parity-slide-engine.md](scripts/parity-slide-engine.md) for how to
place them. The verifiers skip that portion cleanly when they are absent.

## Scripture

Studio bundles **public-domain scripture only**, in the 66-book Protestant canon: KJV, ASV, Darby,
YLT, Louis Segond, Ostervald and Reina-Valera 1909. Copyrighted translations are not shipped and
are not linked to — users import their own licensed copy instead.

[BIBLES.md](BIBLES.md) is the authority here: what ships and why, which translations were
deliberately rejected, the guards that keep an unvetted one out, and the procedure for adding a new
one.

## Status

Actively in development, and honestly short of finished — [todo.md](todo.md) tracks completion
phase by phase, including what is mocked or unbuilt. Notable gaps as of the last audit: no
automated test suite, Speechmatics and MLX Whisper unimplemented, vMix and RTMP/SRT not started,
and the Deepgram live success path not yet exercised against the real service.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).

Bundled scripture texts are public domain, sourced from [eBible.org](https://ebible.org).
