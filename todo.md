# Bible Song Pro — Build Plan

Status audited 2026-07-30 against the actual codebase and against a reference app
product. Overall completion: **~50%**. Legend: `[x]` done · `[~]` partial · `[ ]` not started ·
`[!]` present but broken/mocked.

## Phase 1: Foundation & Core Infrastructure — ~70%
- [x] Analyze existing BSP codebase
- [x] Initialize project with Electron + Vite + React + TypeScript (`tsc --noEmit` passes clean)
- [~] Set up anime.js integration — used in `splash.html` only; `AnimatedLowerThird.tsx` hand-rolls its spring easings
- [~] Set up transcription pipelines — ONNX Whisper real (file/buffer only); Deepgram and Speechmatics never integrated (two `enabled: false` rows in `appStore.ts`)
- [x] Configure cross-platform build (mac arm64/x64/universal, win nsis/portable, linux AppImage/deb, entitlements + notarize)

## Phase 2: Show-Stopping Splash Screen — ~90%
- [x] anime.js-powered startup animation
- [x] Animated logo reveal (gear split)
- [x] Text animations with spring easings

## Phase 3: Preview/Program Display System — ~85%
- [x] Preview and Program display screens (`PreviewProgramView.tsx`)
- [x] **Studio / Basic operating modes** — the old Program/Preview/Simple buttons were dead
      (`setMode` only changed a status label and a transition delay; `PreviewProgramView` even had
      `mode === 'simple' ? currentScene : currentScene`). They now drive a real workflow:
      - **Studio** — both panes. A click stages content in Preview; the audience sees nothing until
        **Take** (with transition) or **Cut**. Double-click anything to bypass preview and go
        straight to Program
      - **Basic** — Program only, with a LIVE badge. Anything you send goes out immediately
      Mode is persisted, and old `simple` values migrate to Basic
- [x] **Fixed: nothing ever reached Program automatically.** Every panel called `setPreviewScene`,
      so content only went live via the Cut button. All panels now route through one
      `projectScene(scene, { direct })` action that honours the current mode
- [x] External display/projector output (multi-display picker, fullscreen display window)
- [x] **NDI support — now genuinely works.** Verified against the real SDK at
      `/usr/local/lib/libndi.dylib`: library loads, `NDIlib_initialize` succeeds, sender created,
      30/30 BGRA frames accepted, connection count queried, clean teardown. **Confirmed on the
      wire** — `dns-sd -B _ndi._tcp` lists the source across three interfaces, so any NDI receiver
      (OBS, vMix) will see it. Three separate bugs were fixed:
      1. bindings were called as `lib.func.NDIlib_initialize()`; koffi returns the handle *from*
         `lib.func(...)`, so no NDI call had ever executed
      2. the video frame struct omitted `timecode` (int64), shifting every field after it —
         `p_data`, stride and metadata all landed at the wrong offsets
      3. BGRA→RGBA was converted in a 2-million-iteration JS loop per frame at 15fps; Electron's
         `toBitmap()` is already BGRA and NDI accepts it directly, so the loop is gone entirely
      Capture now also skips frames while a previous one is in flight, and idles completely when
      no receiver is connected
- [x] **macOS local-network entitlements** — added `NSLocalNetworkUsageDescription` and
      `NSBonjourServices` (`_ndi._tcp`, `_ndi._udp`) to the build config. Without these, NDI
      discovery silently fails for users on macOS 14+ even with a working sender
- [x] URL/network output support (HTTP + WebSocket on :8942 serving `display.html` and `remote.html`)
- [x] **Fixed: WebSocket relay sent binary frames.** Client-to-client messages were forwarded as raw
      Buffers, so browsers received a Blob, `JSON.parse` threw, and `display.html` silently dropped
      them — the mobile remote could never drive the display. Relay now re-sends as text

## Phase 4: Presentation Engine — ~80%
- [x] Slide system (`SlideEditor.tsx` + `public/slide-editor` bundle, localStorage-backed)
- [x] **Media import** — real image/video library (`media-service.cjs`): native picker + drag-and-drop
      (`webUtils.getPathForFile`), files copied into `userData/media`, served from `/media/` with HTTP
      Range support so video seeks and loops, path traversal refused, orphaned entries self-prune
- [x] PPTX and PDF text extraction (`utils/parsers.ts`)
- [x] Theme designer for lower thirds and full screen (`ThemePanel.tsx`)
- [x] **Scene backgrounds actually reach the display** — `backgroundFieldsFor()` in `App.tsx` maps
      `Scene.background` onto the flat `bgVideo`/`bgCustomImage`/`bgFill` fields `display.html` reads.
      Previously nothing connected the two, so scene backgrounds never rendered
- [x] Font customization (family, weight, size, colour)

## Phase 5: Bible Integration — ~70%
- [~] 6 Bible versions — 4 ship (KJV, NKJV, NASB, NLT). **ESV and NIV are a licensing task before an engineering one**; add public-domain ASV/WEB/YLT meanwhile. Register in `VERSION_META` in `bible-service.cjs`
- [x] Auto-detect Bible references (`scripture-reference.cjs`, `verse-detection-service.cjs`)
- [x] **Spoken references** — "John chapter 3 verse 16", "first Corinthians chapter 13 verse 4",
      "Romans chapter 8 verses 28 to 29". Only written forms (`John 3:16`) matched before, so live
      transcripts produced no direct hits at all — the single most common pulpit phrasing was missed
- [x] **BM25 verse index** (`verse-index-service.cjs`) — inverted index with IDF weighting and a
      light Early-Modern-English stemmer (`loveth`/`loved`/`love`). Builds in ~450ms for 29,812
      verses / 10,133 terms, warmed off the critical path at startup
- [x] Auto-search verses
- [x] Bible library with search (IPC + REST)

### Detection: measured before/after
| | before | after |
|---|---|---|
| Full detection (all 4 modes) | 218 ms | **0.6 ms** |
| Semantic-only | 180 ms | 1.8 ms |
| Top-1 accuracy on 10 known quotes | 0/10 | **10/10** |
| "for God so loved the world…" | 1 Chronicles 6:34 | John 3:16 |

Two root causes: semantic scoring had **no IDF**, so common words counted as much as rare
ones and short genealogies outranked the verse actually being quoted; and both the semantic
and verbatim modes rescanned all ~30k verses per call, with verbatim re-cleaning every verse
string each time. Verbatim now scores only the top-60 BM25 candidates — any verse sharing
60%+ of its words is certain to rank there, so the answers are the same.

**Chose BM25 over ONNX sentence embeddings** (which the plan called for): it is ~100x faster,
needs no model download or 48 MB index build on first run, works offline immediately, and
scores 10/10 on quote-matching — the actual job here. Embeddings would only add value for
conceptual queries ("verses about anxiety"), which is a different feature and can layer on
top of these candidates later.

## Phase 6: Lyrics System — ~45%
- [x] Song library — persists across restarts
- [x] **Song import** — OpenLyrics (.xml), ChordPro (.chordpro/.chopro) and plain lyrics (.txt) via
      the Import button or drag-and-drop in `SongsPanel.tsx` → `song:importText` → `song-import-service.cjs`.
      Binary files (incl. ProPresenter .pro protobufs) are rejected with a clear message rather than
      parsed into junk
- [ ] Auto-arrange lyrics — button present, disabled and labelled "Coming soon"
- [ ] Auto-search lyrics online — the fake `alert()` search is gone; the field now filters the local
      library. Real CCLI SongSelect / OpenLyrics catalogue search is still unbuilt
- [~] Song packs — three bundled packs install locally (no network, and no longer pretends to download)
- [x] **CCLI credit footer** — `author`/`copyright`/`ccli` on `Song`, parsed from OpenLyrics
      (`<author>`, `<copyright>`, `<ccliNo>`) or entered in the Songs panel, rendered as a legible
      footer while the song projects. Song scenes no longer inherit the Bible translation badge
- [ ] ProPresenter (.pro) import — would need a protobuf decoder

## Phase 7: AI Transcription — ~70%
- [x] **Deepgram streaming integration** (`deepgram-service.cjs`) — live websocket, interim + final
      results, exponential backoff, a handshake-failure cap that stops retrying a bad key, a
      handshake timeout (the SDK can raise `Error` with no `Close`, which otherwise hangs in
      `connecting` forever), and stall detection that pauses when audio flows but nothing returns
- [x] **Real microphone pipeline** (`services/audio-capture.ts`) — AudioWorklet at a native 16 kHz
      context (browser resampler, no aliasing from hand-rolled decimation), 64 ms chunks, PCM16 for
      Deepgram / Float32 for local Whisper. Replaces `webkitSpeechRecognition`, which never worked
      in Electron
- [x] API key storage (`settings-service.cjs`) — userData, 0600, write-only from the renderer's
      point of view: the UI is told *whether* a key is set, never its value
- [x] Local Whisper as an offline path — same capture feeds ~5 s batches to the ONNX engine
- [ ] Speechmatics API integration
- [ ] MLX Whisper — still the passthrough stub; the engine picker no longer implies otherwise
- [ ] **Untested:** the Deepgram success path has not been exercised against the live service (no
      API key available). Failure paths are covered

## Phase 8: Animated Lower Thirds & Alerts — ~80%
- [x] anime.js-powered lower thirds (`AnimatedLowerThird.tsx`, 6 SVG designs)
- [x] Alert system with animations (`AnimatedAlert.tsx`, `AlertOverlay.tsx`)
- [x] Spring easings

## Phase 9: Streaming & Output — ~45%
- [x] **OBS integration** (`obs-service.cjs`) — obs-websocket v5 spoken directly over the existing
      `ws` dependency (no extra client library). SHA256 challenge/salt auth, scene list + switching,
      stream/record toggles, live event subscription, bounded reconnect. Scene list is reversed
      because OBS reports bottom-up. UI under **Settings → Streaming**
- [ ] vMix integration
- [ ] RTMP/SRT streaming — needs ffmpeg; **v2 target**
- [ ] Recording via the app itself — OBS recording is controllable today; native capture is **v2**
- [x] External display output
- [x] NDI output (see Phase 3)

## Phase 10: Polish & UX — ~45%
- [~] Theme system
- [~] Professional UI/UX
- [x] **Persistence** — Zustand `persist` → `store:*` IPC → `app-store-service.cjs`, writing
      `userData/app-state.json` with debounced, atomic (tmp+rename) writes and a flush on quit.
      Persists scenes, songs, themes, active theme, verse history, sidebar, output mode and live
      scripture prefs; live display state stays transient. Falls back to localStorage in `npm run dev`
- [x] Gate `openDevTools()` behind `isDev` (main, stage display, slide editor windows)
- [ ] Performance optimization
- [ ] Cross-platform testing / any tests at all

---

## Gap vs. a reference app

| Area | Reference | Us |
|---|---|---|
| Bible data | 13 translations (kjv, nkjv, niv, esv, nasb, nlt, amp, msg, gnb, erv, es, fr) | 4 |
| Verse detection | Rust + ONNX semantic embeddings over an indexed verse corpus | JS string/regex matching |
| Live STT | Deepgram streaming (reconnect/backoff/stall detection) + offline whisper.cpp large-v3-turbo w/ CoreML + silero VAD | Web Speech API (non-functional) |
| Display | Dual translation (`secondaryVerse`), lyric mode w/ author + copyright + key, autofit | ✅ both now supported |
| Assets | MP4 motion backgrounds, JPG themes, PNG lower thirds | HTML/SVG equivalents |
| Remote | Token-authed (`/api/ws-token`) | No auth |

**Where we are ahead:** slide editor with PPTX/PDF import, stage display, a real theme *designer*
(it ships fixed themes), scene list, session history with export.

⚠️ Do not copy assets or Bible data out of any other app. NIV/ESV/NASB/MSG/AMP are copyrighted
and require redistribution licences.

## Completed this pass
1. ✅ Persistence — Zustand `persist` → userData JSON
2. ✅ Song import wired up; fake online search removed
3. ✅ Real media import + `/media/` route with Range support
4. ✅ Deepgram streaming STT + real AudioWorklet mic pipeline
5. ✅ BM25 verse index — 0.6 ms detections, 10/10 accuracy (chose this over embeddings)
6. ✅ Dual translation + CCLI credit footer
7. ✅ NDI fixed and verified on the wire
8. ✅ OBS Studio integration

## Next up
1. **Get a Deepgram key and exercise the live success path** — the only major piece not verified
   against a real service
2. Bible licensing (ESV/NIV) — commercial, not engineering. Ship public-domain ASV/WEB/YLT now
3. MLX Whisper — implement properly or drop the engine option
4. Auto-arrange lyrics; online song catalogue search
5. vMix, RTMP/SRT, native recording
6. Automated tests — there are still none; the services added here were verified with one-off
   scripts, which should be turned into a real suite
