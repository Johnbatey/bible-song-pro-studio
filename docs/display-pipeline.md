# Display Pipeline

The internal audience display uses the bundled Electron display entry, not the legacy `display.html` transport.

## Runtime Paths

- Operator Preview and Program panes render through `ProgramSurface`.
- The bundled audience window loads `audience-display.html`, then `src/display/main.tsx`.
- `src/display/main.tsx` receives `display:update` and `display:getState` through `window.BSP.display`.
- Legacy `display.html` remains only for optional browser output and remote/network compatibility.
- Imported image/video media still resolves through the local HTTP media server in this phase.

## Verification

Use the full display check before changing output rendering:

```sh
npm run verify:display-all
```

For a broader pre-merge pass that also covers live scripture parsing:

```sh
npm run verify:all
```

`verify:all` also runs `verify:remote-architecture`, which guards the mobile remote/local HTTP server path that intentionally remains outside the internal IPC audience display.

That runs:

- `typecheck`
- `verify:display-architecture`
- `verify:display-stack`
- `verify:dist-audience-display`

The architecture guard checks that the internal display window loads `audience-display.html`, the preload bridge exposes `display.onMessage` and `display.getState`, and the bundled audience entry does not use WebSocket.

The dev-stack verifier starts Vite, checks the direct `ProgramSurface` harness, checks the audience IPC fixture, and compares direct vs audience pixels across all current fixtures.

The dist verifier builds the renderer and loads the bundled audience fixture through `file://`, matching the production loading path.

Screenshots and JSON reports are written under `artifacts/`, which is ignored by git.

## Current Fixture Coverage

- Bible fullscreen
- Compare view
- Lower third
- Song credit
- Alert and transcription overlays
- Solid background
- Transparent background
- Image background
- Video background

## Notes

- Pixel parity uses average drift as the primary gate because text antialiasing can create high single-pixel differences while the rendered layout still matches.
- Production verification needs enough disk space to rebuild `dist/`; if the system is nearly full, `verify:dist-audience-display` may fail during asset copying before Electron launches.
