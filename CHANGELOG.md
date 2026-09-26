# Changelog

All notable changes to Bible Song Pro Studio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.4.0] - 2026-09-26

### Added
- **Interactive Drag-Scrubbing Controls**: Numerical controls across Theme Studio, Stage Designer Inspector (X, Y Position, Width, Height), and Studio Sliders now support mouse drag-scrubbing. Drag left/right to adjust values smoothly (hold Shift for 5x speed) or click to type exact values.
- **Enhanced Queue & Service Schedule Engine**: Comprehensive queue management supporting drag-and-drop reordering, quick queueing of Bibles, songs, media assets, notes, announcements, and alerts directly into live production queue.
- **Automatic Online Song & Bible Recovery**: Smart setlist resolution that detects missing songs or Bible translations when loading setlists from other computers and automatically queries online providers or allows 1-click fallback assignment.
- **Cross-Platform Audio Output Routing & Fallbacks**: Advanced Web Audio API and HTML5 `<audio>` device routing (`setSinkId`) with automatic graceful fallbacks to default audio output whenever hardware devices disconnect or reject routing.
- **Comprehensive Vitest Unit Test Suite**: Integrated Vitest unit testing framework covering IPC protocol registry, scripture detection algorithms, audio routing, display surface utilities, and component UI states.
- **GitHub Actions CI Integration**: Automated CI pipeline (`.github/workflows/ci.yml`) for linting, TypeScript typechecking, licensing compliance, and test suite execution on every push.

### Changed
- **Redesigned Settings Console Layout**: Overhauled Settings modal with clean tabbed section navigation, polished contrast, responsive input layouts, and zero text clipping.
- **Modular Main Process IPC Architecture**: Refactored Electron IPC handlers into decoupled modules (`bible-ipc.cjs`, `display-ipc.cjs`, `media-ipc.cjs`, `window-ipc.cjs`) backed by a safe IPC registry wrapper and structured error envelopes.
- **Multilingual Localization Update**: Fully updated translations across English (`en`), Spanish (`es`), French (`fr`), and Portuguese (`pt`) for all new 3.4.0 features and controls.
- **Enhanced Theme Studio & Display Surface Parity**: Optimized Program Surface and Audience Display rendering with full backdrop blur, shadow controls, shape layer positioning, and smooth transitions.

### Fixed
- **Fixed Text & Song Importing Issues**: Resolved issue where imported text files appeared as "untitled" or failed to index for hymn number searches.
- **Fixed Song & Bible Setlist Missing Asset Crashes**: Prevented setlist load failures when referenced Bibles or songs are missing from local library.
- **Fixed Audio Device Sink Disconnection Edge Cases**: Ensured audio playback automatically resumes on default output if a custom audio device target becomes unavailable.
- **Fixed Input Field Dragging & Focus Errors**: Corrected mouse drag handling on numerical input labels in Stage Designer and Theme Studio to prevent unwanted text selection or focus traps.

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
