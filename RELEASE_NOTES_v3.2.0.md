# Bible Song Pro Studio v3.2.0

We are thrilled to announce **Bible Song Pro Studio v3.2.0**! This release brings major upgrades to the Slide Designer, Illustrator-grade vector tools, professional keyboard shortcuts, and AI speech model controls.

---

## 🚀 New Features

* **Illustrator-Grade Bézier Pen**: Click-and-drag curves with live tangent handles, a real-time rubberband guide, proximity loop snapping, and instant fill and stroke color application upon closing.
* **Pro Scale & Resize Modifiers**:
  * Hold <kbd>Shift</kbd> to lock exact aspect ratio during transform.
  * Hold <kbd>Alt</kbd> / <kbd>Option</kbd> to scale symmetrically from the center point.
  * Hold <kbd>Shift</kbd> + <kbd>Alt</kbd> to scale uniformly outward from center.
* **Multi-Layer Dragging**: <kbd>Shift</kbd>-select multiple layers and drag any layer to move all selected layers together in unison.
* **Industry-Standard Design Shortcuts**:
  * <kbd>V</kbd> Selection Tool • <kbd>T</kbd> Text Tool • <kbd>P</kbd> Pen Tool • <kbd>B</kbd> Brush / Pencil
  * <kbd>R</kbd> Rectangle • <kbd>O</kbd> / <kbd>C</kbd> Circle • <kbd>L</kbd> Line • <kbd>H</kbd> Hand / Pan
  * <kbd>Esc</kbd> Deselect All • <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>A</kbd> Select All • <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>D</kbd> Duplicate
* **Individual Node Editing & Deletion**: Click any Bézier anchor node to highlight it in blue, move it freely without snapping back, or press <kbd>Delete</kbd> / <kbd>Backspace</kbd> to delete that specific node.

---

## ⚡ Tweaks & Enhancements

* **True 1:1 Circle & Shape Geometry**: Circles, triangles, and stars now generate with perfect 1:1 proportions on 16:9 canvas instead of stretching into ovals.
* **Clean AI Model Dropdown**: Removed bulky download size badges in the Live Scripture Config popover in favor of sleek status dots (🟢 downloaded, 🔴 not downloaded).
* **Bidirectional STT Mode Sync**: Switching between Local and Deepgram Cloud in the live config window or Settings Modal synchronizes immediately and remembers your last active local model.
* **Path Mode Toggle**: Switch between Open Curves and Closed Shapes directly from the right sidebar inspector at any time.

---

## 🐛 Bug Fixes

* **Fixed Node Snapping Reversion**: Fixed anchor nodes snapping back to initial positions on mouse release during editing.
* **Fixed Path Fill Color Trigger**: Closed Bézier loops now immediately apply active fill and stroke colors upon closing without requiring color picker re-selection.
* **Fixed Delete Key Isolation**: Deleting a selected vector node no longer accidentally removes the parent element.
* **Fixed Windows GPU & Startup Hang**: Resolved startup freeze on certain Windows configurations by eliminating problematic GPU flags.
* **Fixed Song Header Subtitle Scrolling**: Removed extraneous author/key labels from the header and enabled horizontal scrolling.
