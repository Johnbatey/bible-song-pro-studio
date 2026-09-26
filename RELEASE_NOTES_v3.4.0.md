✨ New Features:
- **Interactive Drag-Scrubbing Controls**: Numerical controls across Theme Studio, Stage Designer Inspector (X, Y Position, Width, Height), and Studio Sliders now support intuitive mouse drag-scrubbing. Drag left/right to scrub values smoothly (hold Shift for 5x speed) or click to type exact values up to 5000px.
- **Enhanced Queue & Service Schedule Engine**: Comprehensive queue management supporting drag-and-drop reordering, quick queueing of Bibles, songs, media assets, notes, announcements, and alerts directly into live production queue.
- **Automatic Online Song & Bible Recovery**: Smart setlist resolution that detects missing songs or Bible translations when loading setlists from other computers and automatically queries online providers or allows 1-click fallback assignment.
- **Cross-Platform Audio Output Routing & Fallbacks**: Advanced Web Audio API and HTML5 `<audio>` device routing (`setSinkId`) with automatic graceful fallbacks to default audio output whenever hardware devices disconnect or reject routing.
- **Comprehensive Vitest Unit Test Suite**: Integrated Vitest unit testing framework covering IPC protocol registry, scripture detection algorithms, audio routing, display surface utilities, and component UI states.
- **GitHub Actions CI/CD Integration**: Automated CI pipeline (`.github/workflows/ci.yml`) for automated linting, TypeScript typechecking, licensing compliance, and test suite execution on every push.

🔧 Tweaks:
- **Redesigned Settings Console Layout**: Overhauled Settings modal with clean tabbed section navigation, polished contrast, responsive input layouts, and zero text clipping.
- **Modular Main Process IPC Architecture**: Refactored Electron IPC handlers into decoupled modules (`bible-ipc.cjs`, `display-ipc.cjs`, `media-ipc.cjs`, `window-ipc.cjs`) backed by a safe IPC registry wrapper and structured error envelopes.
- **Multilingual Localization Update**: Fully updated translations across English (`en`), Spanish (`es`), French (`fr`), and Portuguese (`pt`) for all new 3.4.0 features and controls.
- **Enhanced Theme Studio & Display Surface Parity**: Optimized Program Surface and Audience Display rendering with full backdrop blur, shadow controls, shape layer positioning, and smooth transitions.

🐞 Bugfixes:
- **Fixed Text & Song Importing Issues**: Resolved issue where imported text files appeared as "untitled" or failed to index for hymn number searches.
- **Fixed Song & Bible Setlist Missing Asset Crashes**: Prevented setlist load failures when referenced Bibles or songs are missing from local library.
- **Fixed Audio Device Sink Disconnection Edge Cases**: Ensured audio playback automatically resumes on default output if a custom audio device target becomes unavailable.
- **Fixed Input Field Dragging & Focus Errors**: Corrected mouse drag handling on numerical input labels in Stage Designer and Theme Studio to prevent unwanted text selection or focus traps.
