✨ New features:
- Illustrator-grade Bézier Pen tool with live rubberband preview and loop closing
- Multi-layer dragging when multi-selecting layers on canvas
- Shift & Alt transform modifiers for aspect-ratio locking and center-origin scaling
- Graphic design keyboard shortcuts (V, T, P, B, R, O/C, L, H, Esc, Cmd/Ctrl+A, Cmd/Ctrl+D)
- Individual Bézier node selection, repositioning, and deletion
- Spoken verse navigation (next/previous verse, jump to verse, chapter traversal)
- Multi-accent phonetic speech dictionary and sound-alike book name mappings
- Biblical lemmatization (KJV archaic terms mapped to modern root words)
- Flexible spoken translation requests and real-time paraphrase toggle
- Multi-tab Song workspace (Primary and Translation projection across Text & Button modes)
- Detachable dock pop-out windows for multi-monitor workspaces
- Full Pro Slides OBS / browser output parity at /display.html

🔧 Tweaks:
- Cleaned up top header bar buttons with crisp, high-resolution SVG icons
- True 1:1 shape geometry for circles, triangles, and stars on 16:9 canvas
- Clean AI speech model dropdown with glowing download status indicators
- Bidirectional mode synchronization between Local and Cloud models
- Dynamic OS-specific GPU acceleration reporting (DirectX, Metal, Vulkan)
- Multi-accent speech parsing with church canon prompt and anti-hallucination guardrails
- Switch between open curves and closed shapes in inspector sidebar

🐞 Bugfixes:
- Fixed NDI 6 native runtime missing on Windows and Linux by bundling cross-platform libraries
- Fixed external audience and stage displays not rendering borderless fullscreen
- Fixed presentation slides showing as partial text in lower-third mode by auto-switching display to full screen when slides are active
- Fixed Bézier nodes snapping back to initial position after dragging
- Fixed closed path fill color not applying immediately upon loop completion
- Fixed delete key removing entire element instead of selected vector node
- Fixed splash screen freeze and startup hang on Windows
- Fixed Revelation 1:20 and compound chapter-verse number parsing
- Fixed theme Image/Video fill selection in media library
- Fixed song header subtitle scrolling and author/key overflow
