# PR notes — Operator UI internationalization & live/queue UX

**Branch:** `feat/i18n-operator-ui`  
**Locales:** English (source), French, Spanish, Portuguese  
**Status:** Ready for review / PR drafting  
**Related commits (on this line of history):**

| Commit | Summary |
|--------|---------|
| `5f36a3f` | Core i18n infra + chrome / panels localization |
| `e7881aa` | Native Electron menu localization + more UI wiring |
| `4b31fde` | Slide Editor + Presentation creation i18n; emoji → SVG |
| `d251170` | Live take-down toggle (Presentation + Queue) + queue dedupe |

**Suggested PR title:**  
`feat(i18n): localize operator UI (en/fr/es/pt) and improve live/queue controls`

---

## Summary

This work adds a full operator-facing internationalization system for Bible Song Pro Studio and completes localization across Settings, docks, Pro Slides creation, the React Slide Editor, backup/restore, and related chrome. It also replaces emoji-as-icons with stroke SVG icons in Settings / word-study / slide editor surfaces, and improves live output UX: re-clicking a live presentation slide or queue item takes Program down; queue play becomes pause while live; the same scripture/song passage cannot be queued twice.

**Out of scope (intentionally):** projected congregation content (verse text, lyrics), brand/jargon tokens (NDI, Deepgram, Pro Slides, Preview, Program, TAKE, LIVE), and the legacy HTML slide editor at `public/slide-editor/` (the in-app React `SlideEditorModal` is the primary path).

---

## Motivation

- Operators work in EN / FR / ES / PT; the console was largely hard-coded English.
- Settings body, backup, empty states, and the Slide Editor remained English after category labels were localized.
- Emoji used as UI icons were inconsistent with the product chrome and hard to theme.
- Live control lacked a clear “take down” gesture; queue allowed duplicate passages.

---

## What’s included

### 1. i18n infrastructure

| Piece | Path / role |
|-------|-------------|
| Catalog types | `src/i18n/types.ts` — `UiLocale`, exhaustive `MessageKey` |
| Runtime | `src/i18n/index.ts` — `t()`, `setUiLocale()`, `detectUiLocale()`, dock key helpers |
| Hook | `src/i18n/useI18n.ts` — React subscription to locale changes |
| Catalogs | `src/i18n/locales/{en,fr,es,pt}.ts` |
| Electron menu strings | `src/i18n/menu-messages.cjs` — CJS catalog for main process |
| Persist + first-run detect | `uiLocale` in `appStore` (+ `onRehydrateStorage`) |
| Sync to native menu | `BSP.i18n.setLocale` (preload) → `ui:setLocale` → rebuild `Menu` |

**Settings → Language** keeps **UI locale** separate from **sermon / STT language**.

### 2. Surfaces localized

- **Chrome:** TitleBar, StatusBar, dock titles / groups, Dock empty state, Workspace prompts, Update banner, Import conflict modal
- **Panels:** Bible, Songs, Live Scripture, Media, Presentation (library + project), Stage, Queue, Themes, Scenes, Transcript
- **Settings:** All category bodies (system, bible options, scripture AI, songs, audio, output, fullscreen, lower third, language, hotkeys, help, feedback, support) + **BackupSystem**
- **Pro Slides:** Create/rename modals, context menus, zoom, empty states, tooltips, defaults
- **Slide Editor (React):** Header, left rail, quick toolbar, canvas chrome, right sidebar (Design / Layer / AI Studio), LayerList, ShapeInspector, SlideTextPanel (~272 `slideEditor.*` keys)
- **Native app menu:** Dock labels, Workspace verbs, Edit / View / Window, slide-editor window title

Helper for slide-editor string generation (optional tooling): `scripts/slideEditor-i18n-data.mjs`.

### 3. Icons: emoji → SVG

Emoji prefixes/buttons replaced with Lucide-style stroke SVGs in:

- Settings (feedback / help / support actions)
- Word study UI (`WordStudyCard`, `ProgramSurface`, `StageZones`)
- Slide editor (`SlideEditorIcons.tsx` + left rail / toolbar / sidebar leftovers)

### 4. Live / queue UX

| Behavior | Detail |
|----------|--------|
| Presentation take-down | Re-projecting an already-live slide (card go-live / Go Live → **Take Down**) calls `clearProgram()` |
| Queue play/pause | Play sends direct LIVE; while live, icon is pause and click clears Program |
| Queue row click | If row is live, clears Program; otherwise stages/projects as before |
| Queue dedupe | `addToQueue` no-ops when the same `scene.id` (or same type+reference+text) is already queued |
| Store API | New `clearProgram()` — clears `currentScene` and matching `previewScene` |

---

## Key files touched (high level)

```
src/i18n/**                         # new module
src/electron/main.cjs               # menu + window titles via mt()
src/electron/preload.cjs            # BSP.i18n.setLocale
src/renderer/stores/appStore.ts     # uiLocale, clearProgram, queue dedupe
src/renderer/components/SettingsModal.tsx
src/renderer/components/settings/BackupSystem.tsx
src/renderer/components/PresentationPanel.tsx
src/renderer/components/QueuePanel.tsx
src/renderer/components/slide-editor/**
src/renderer/components/SlideEditorModal.tsx
… + panels / dock / TitleBar / StatusBar / modals listed above
```

Approx. scale vs pre-i18n baseline (`ed30187..HEAD`): **~50 files**, **~6.6k insertions**.

---

## How to test

### Localization

1. Launch with Vite + Electron (`pnpm dev` then `env -u ELECTRON_RUN_AS_NODE pnpm exec electron .` on Windows if needed).
2. **Settings → Language** → switch UI to Français / Español / Português.
3. Confirm: sidebar categories, Settings bodies, docks, menus, Presentation empty states, Slide Editor chrome, Backup section.
4. Confirm sermon language control does **not** change UI locale by itself.
5. Restart app: UI locale persists.

### Icons

1. Settings → Feedback / Support / Help: no emoji icons; SVG + text.
2. Slide Editor rail/toolbar: save/import/export/trash use SVG.
3. Word-study section headers on program/stage: SVG, not emoji.

### Live / queue

1. **Pro Slides:** Go Live on a slide → Program shows it → Go Live / re-click becomes Take Down → Program returns to standby.
2. **Queue:** Add a verse → Play → pause icon → click again → standby.
3. **Dedupe:** Add the same verse to the queue twice via `+` → only one row.
4. Studio mode: Stage vs Go Live still respected; take-down only clears live output as designed.

### Regression

- NDI / output / Bible browse / song projection still work.
- Brand strings (NDI, Deepgram, Pro Slides, TAKE) unchanged where intended.
- `pnpm exec tsc --noEmit` passes.

---

## Test plan checklist (for PR)

- [ ] UI locale EN / FR / ES / PT across Settings + docks + menus
- [ ] UI locale persists after relaunch
- [ ] Sermon language independent of UI locale
- [ ] Presentation create/rename/empty states localized
- [ ] Slide Editor header / rail / toolbar / sidebar localized
- [ ] Backup export/import/reset strings localized
- [ ] No emoji icons in Settings feedback/support or Slide Editor rail actions
- [ ] Presentation live toggle (take-down) works in Basic and Studio Go Live
- [ ] Queue play ↔ pause take-down works
- [ ] Queue rejects duplicate passage
- [ ] `tsc --noEmit` clean

---

## Follow-ups (not in this PR)

- Localize remaining SongPacks internals / other empty states (Media grid, Session History) if still English.
- Migrate or retire legacy `public/slide-editor/index.html` (still English if opened as Electron window content).
- Optional: toast when queue add is ignored as duplicate.
- Performance plan items (NDI poll unification, `useStoreSync` debounce, `requestSingleInstanceLock`) remain separate.

---

## Suggested PR body (paste-ready)

```markdown
## Summary
- Add operator UI i18n (en/fr/es/pt) across chrome, Settings, panels, Pro Slides, React Slide Editor, backup, and native Electron menus.
- Replace emoji UI icons with SVG in Settings, word-study, and Slide Editor.
- Presentation + Queue: re-click live output to take down; queue play becomes pause; prevent duplicate queue entries.

## Test plan
- [ ] Switch UI language in Settings; verify docks, Settings bodies, menus, Slide Editor
- [ ] Confirm UI locale persists; sermon language stays independent
- [ ] Go Live → Take Down on a Pro Slides card; queue play/pause take-down
- [ ] Attempt to queue the same verse twice — only one row
- [ ] `pnpm exec tsc --noEmit`
```

---

## Notes for reviewers

- English catalog is the source of truth; missing keys fall back to `en`.
- Main-process menu strings are duplicated in `menu-messages.cjs` (cannot import TS catalogs in CJS main). Keep in sync when adding Dock/menu keys.
- `MessageCatalog` is a full `Record<MessageKey, string>` — all four locale files must define every key (enforced by `tsc`).
