✨ New Features:
- **Bible Grid Picker / Quick Navigation Matrix**: Fast 3-step scripture selection matrix (Books → Chapters → Verses) with comprehensive book abbreviations across English, French, Spanish, and Portuguese.
- **Old Testament & New Testament Distinct Styling**: Eye-friendly warm parchment/amber palette for the Old Testament and cool lavender/indigo palette for the New Testament.
- **Dynamic Light & Dark Theme Adaptations**: Automatic, high-contrast palette adaptations for light theme ("Paper Surface"), ensuring crisp abbreviations, visible borders, and readable chapter/verse grids.
- **Live Scripture Auto-Sync**: Automatically syncs speech-detected scripture into the Bible panel with focus on the live verse, controllable via a new toggle switch in Scripture Settings.
- **Media Library Toggle-to-Clear**: Clicking an already active media item in the Media Library clears it from the live display surface.
- **Top-Level App Error Boundary & Self-Recovery**: Protects against unexpected startup crashes, providing one-click "Reload App" and "Reset Cache & Recover" options.

🔧 Tweaks:
- Reordered Bible toolbar buttons so Strong's Concordance Lexicon precedes Previous/Next navigation for streamlined workflow.
- Cleaned up Bible Chrome Bar: Removed redundant "Version" wording on Single/Dual version buttons to maximize search bar width.
- Enhanced abbreviations styling: Replaced high-glare orange abbreviation tags with soft, non-distracting off-white tags.
- Added comprehensive multilingual translations for newly added features in English, French, Spanish, and Portuguese.

🐞 Bugfixes:
- **Fixed Windows Startup Blank White Screen**: Added resilient Zustand store hydration and merge fallbacks to prevent corrupted AppData cache crashes on Windows.
- **Fixed Settings UI Input Layouts**: Fixed crushed text boxes and broken styling on Hotkeys, Send Feedback, Deepgram API key, and NDI Source Name inputs.
- **Fixed Dark Window Creation**: Ensured main window background color consistently initializes with `#0C0B0B` dark booth palette to eliminate any white flashes during startup.
