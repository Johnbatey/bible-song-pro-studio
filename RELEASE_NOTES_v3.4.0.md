✨ Major Features & Highlights:

🎨 1. Theme Studio & Pro Theme Engine Upgrade
- Complete Visual Redesign: Overhauled Theme Studio console with real-time live preview rendering and instant program surface updates.
- Advanced Typography & Glassmorphism: Rich typography controls (font family, size, line height, letter spacing, uppercase/lowercase transform, text alignment) and glassmorphism backdrop-blur, card background opacity, and gradient fills.
- Precision Border & Shadow Controls: Full stroke customization, zero-width borders, corner radii, drop shadow offsets, and glow effects.
- Interactive Drag-Scrubbing Controls: Drag left/right on input labels and sliders to scrub numerical values smoothly in real time (hold Shift for 5x speed) or click to type exact values up to 5000px.

🖼️ 2. Pro Slide Editor & Stage Designer Enhancements
- Interactive Canvas Board: Enhanced visual slide designer with precision grid snapping, multi-element alignment guides, and visual element transformation.
- Custom Shape Layers & Vectors: Full shape engine supporting rectangles, rounded cards, circles, ellipses, stars, and triangles with custom fills, strokes, and opacity.
- Multi-Zone Stage Layout Designer: Custom stage confidence monitor layout editor with real-time clock, speaker countdown timers, next slide/verse previews, live scripture cards, chord notes, and stage alert banners.
- Dockable Popout Windows: Pop out the Slide Editor and Stage Designer into standalone windows for multi-monitor booth workflows.

🎛️ 3. DAW-Grade Audio DSP & Studio FX Engine
- Real-Time Adaptive Spectral Noise Suppression: Built-in Zoom/Meet-grade noise filter nodes and Web Audio DSP pipeline.
- Live VAD & Dual L/R Stereo VU Metering: Real-time Voice Activity Detection (VAD) indicator badge and dual stereo VU meter.
- Headphone Post-DSP Monitoring: Real-time headphone monitoring with DAW-grade de-zippering automation, mic hot-swapping, gain preamp controls, and bypass mode.
- Sleek Apple-Grade Audio Controls: React Portal DSP popover with slender controls eliminating toolbar clipping.

📡 4. Multi-Feed NDI Broadcast Output & Media Engine
- Multi-Feed NDI Streaming: Multi-stream NDI engine supporting dedicated Lower-Third isolation feeds and Full-Screen program feeds for OBS Studio, vMix, and Tricaster.
- Media Aspect Ratio Transforms: Instant Fit to Screen, Fill, Stretch to Fit, and Center Crop transforms for videos and graphics.
- Custom Standby Screen Cover: Set custom images or video loops as standby media when clearing presentation displays.

📅 5. Service Setlist Manager, Online Lyrics & Fluid Queue
- Service Setlist Manager: Create, save, load, import, and export service schedules with one click.
- Online Lyrics Search Engine: Built-in online lyrics search modal supporting instant lyric fetching and importing into local song library.
- Automatic Online Song & Bible Recovery: Smart setlist resolution that detects missing songs or Bibles from imported setlists and automatically queries online providers or offers 1-click local replacements.
- Fluid 120fps Animated Queue: Smooth drag-and-drop reordering, title truncation, hover action buttons, and direct queueing of Bibles, songs, media, announcements, and notes.

⚡ 6. Program Chrome Bar, Keyboard Shortcuts & UX Refinements
- Smooth Crossfade & Cut Transitions: Transition controls moved directly onto the Program display chrome bar before Full Screen / Lower Third triggers for instantaneous operator access.
- Global Keyboard Navigation & Hotkeys: Complete keyboard navigation shortcuts (`Space`, `Esc`, `F5`, `Ctrl+F`) for live production playback and modal control.
- Reordered Song Toolbar: Compact single-row translation headers and chevron-based song navigation.

🧪 7. Automated Testing Suite & CI/CD Pipeline
- Comprehensive Vitest Unit Test Suite: 61 tests across 11 test suites validating IPC registry protocol, scripture detection, audio routing fallbacks, queue state, and display surface fields.
- GitHub Actions CI/CD (`ci.yml`): Continuous integration workflow running typechecking, linting, Bibles licensing checks, and test suites on every commit.

🐞 Bugfixes & Stability Enhancements:
- Fixed Text & Song Importing: Resolved issue where imported text/lyric files appeared as "untitled" or failed to index for hymn number searches.
- Fixed Missing Asset Setlist Crashes: Prevented crashes when loading setlists containing missing Bibles or songs.
- Fixed Audio Sink Disconnection: Guaranteed clean fallback to default output if a target audio device disconnects or rejects routing.
- Fixed Startup Blank Window: Added resilient Zustand hydration fallbacks to prevent corrupted AppData cache crashes.
- Fixed Window Taskbar Focus: Ensured single instance process lock and multi-tick window display focus handoff across macOS, Windows, and Linux.
