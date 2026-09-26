# Changelog

All notable changes to Bible Song Pro Studio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.4.0] - 2026-09-26

### Added
- **Theme Studio & Pro Theme Engine Upgrade**: Complete visual redesign of Theme Studio console with real-time live preview rendering, typography controls (font family, line height, letter spacing, transform, alignment), glassmorphism backdrop blur, opacity, stroke customization, zero-width borders, corner radii, and shadow/glow effects.
- **Interactive Drag-Scrubbing Controls**: Drag left/right on numerical input labels and sliders across Theme Studio, Stage Designer Inspector (X, Y Position, Width, Height), and Studio Sliders to scrub values smoothly in real time (hold Shift for 5x speed) or click to type exact values up to 5000px.
- **Pro Slide Editor & Stage Designer Enhancements**: Visual slide designer with precision grid snapping, dynamic alignment guides, vector shape layers (rectangles, rounded cards, circles, ellipses, stars, triangles), multi-zone stage layout designer (clock, speaker timers, next slide preview, chord notes, message banners), and dockable popout windows.
- **DAW-Grade Audio DSP & Studio FX Engine**: Real-time Zoom/Meet-grade adaptive spectral noise suppression, Web Audio DSP filter nodes, real-time Voice Activity Detection (VAD) badge, dual L/R stereo VU meters, post-DSP headphone monitoring with de-zippering automation, mic hot-swapping, preamp gain controls, and bypass mode.
- **Multi-Feed NDI Broadcast Output & Media Engine**: Multi-feed NDI engine supporting dedicated Lower-Third isolation feeds and Full-Screen program feeds for OBS Studio, vMix, and Tricaster. Added media aspect ratio transforms (Fit to Screen, Fill, Stretch to Fit, Center Crop) and custom Standby Screen Cover media loops.
- **Service Setlist Manager & Online Lyrics Search Engine**: Built-in setlist creation, saving, loading, importing, and exporting. Integrated online lyrics search modal supporting instant lyric fetching and library import. Added automatic online song & Bible recovery for missing setlist assets.
- **Fluid 120fps Animated Queue**: Smooth drag-and-drop reordering, title truncation, hover action buttons, and direct queueing of Bibles, songs, media, announcements, and notes.
- **Program Surface Chrome Bar & Shortcuts**: Moved Cut & Fade transition buttons directly onto Program display chrome bar for instantaneous operator access. Added smooth 60fps crossfades and global hotkeys (`Space`, `Esc`, `F5`, `Ctrl+F`).
- **Comprehensive Vitest Unit Test Suite**: 61 tests across 11 test suites validating IPC protocol registry, scripture detection, audio routing fallbacks, queue state, and display surface fields.
- **GitHub Actions CI/CD Integration**: Automated CI pipeline (`.github/workflows/ci.yml`) for automated linting, TypeScript typechecking, licensing compliance, and test suite execution on every push.

### Changed
- **Redesigned Settings Console Layout**: Overhauled Settings modal with clean tabbed section navigation, polished contrast, responsive input layouts, and zero text clipping.
- **Modular Main Process IPC Architecture**: Refactored Electron IPC handlers into decoupled modules (`bible-ipc.cjs`, `display-ipc.cjs`, `media-ipc.cjs`, `window-ipc.cjs`) backed by a safe IPC registry wrapper and structured error envelopes.
- **Multilingual Localization Update**: Fully updated translations across English (`en`), Spanish (`es`), French (`fr`), and Portuguese (`pt`) for all new 3.4.0 features and controls.

### Fixed
- **Fixed Text & Song Importing Issues**: Resolved issue where imported text files appeared as "untitled" or failed to index for hymn number searches.
- **Fixed Song & Bible Setlist Missing Asset Crashes**: Prevented setlist load failures when referenced Bibles or songs are missing from local library.
- **Fixed Audio Device Sink Disconnection Edge Cases**: Ensured audio playback automatically resumes on default output if a custom audio device target becomes unavailable.
- **Fixed Input Field Dragging & Focus Errors**: Corrected mouse drag handling on numerical input labels in Stage Designer and Theme Studio to prevent unwanted text selection or focus traps.
- **Fixed Startup Blank Window & Taskbar Focus**: Added resilient Zustand hydration fallbacks and multi-tick focus handoff across macOS, Windows, and Linux.

---

## [3.3.0] - 2026-09-05

### Added
- **Bible Grid Picker / Quick Navigation Matrix**: Fast 3-step scripture selection matrix (Books → Chapters → Verses) with comprehensive book abbreviations across English, French, Spanish, and Portuguese.
- **Old Testament & New Testament Distinct Styling**: Warm parchment/amber palette for Old Testament and cool lavender/indigo palette for New Testament.
- **Dynamic Light & Dark Theme Adaptations**: Automatic, high-contrast palette adaptations for light theme.
- **Live Scripture Auto-Sync**: Automatically syncs speech-detected scripture into the Bible panel with focus on live verse.
- **Top-Level App Error Boundary & Self-Recovery**: Protects against unexpected startup crashes with 1-click reload and recovery options.

### Fixed
- **Windows Startup Blank White Screen**: Added resilient Zustand store hydration and merge fallbacks to prevent corrupted AppData cache crashes.
- **Settings UI Input Layouts**: Fixed crushed text boxes and broken styling on Hotkeys, Send Feedback, Deepgram API key, and NDI Source Name inputs.
- **Dark Window Creation**: Ensured main window background color consistently initializes with `#0C0B0B` dark booth palette to eliminate white flashes.
