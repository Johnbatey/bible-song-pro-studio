# Bible Song Pro Studio v3.1.0

We are thrilled to announce **Bible Song Pro Studio v3.1.0**! This major update introduces a brand-new Vector Drawing Engine, a Photoshop/Figma-style Bezier Pen tool, GPU-accelerated smooth canvas panning, a glassmorphic toolbar redesign, and an overhauled Windows Setup Installer Wizard.

---

## 🎨 Vector Drawing & Pen Engine
* **Freehand Pencil Tool**: Draw custom shapes and signatures with automatic loop detection and tight bounding box transform mapping.
* **Photoshop-Style Bezier Pen Tool**: Place anchor nodes, drag control handles (`h1x`, `h1y`, `h2x`, `h2y`) to craft smooth bezier curves, auto-close paths by clicking start anchor, and edit/delete nodes with `Backspace` or `Delete`.
* **Pen Stroke Thickness Selector**: Quick presets (*Fine 2px, Med 4px, Bold 8px, Thick 14px*) and a 1px–32px range slider in the toolbar popover and Right Sidebar Inspector.

## 🚀 Canvas Board & Quick Toolbar Overhaul
* **GPU-Accelerated Smooth Canvas Panning**: Integrated HTML5 Pointer Capture API for 60fps canvas dragging with zero mouse stutter.
* **Floating Glassmorphic Dock**: Quick toolbar sits inside a dark glass container card (`rgba(24, 24, 27, 0.92)`) matching Stage Designer.
* **Select Pointer Tool**: Added **Select** button at position 0 (`Esc` key shortcut) with a clean mouse arrow pointer icon.
* **Refined Mouse Cursors**: 4-way `move` cursor on element hover/drag, crosshair for drawing tools, and standard arrow on canvas background.

## 📦 Windows NSIS Setup Installer Wizard
* **Standard Multi-Step Windows Setup Wizard**: Replaced portable build with a traditional NSIS Setup Installer (`Setup.exe`).
* **Desktop & Start Menu Shortcuts**: Guarantees Desktop icon creation, Start Menu shortcut, custom installation folder selection (`C:\Program Files\Bible Song Pro Studio`), Windows Control Panel uninstall registration, and post-installation launch option.

## 📺 Multi-Projection Parity
* **SVG Vector Path Rendering**: Full support for `pencil` and `bezier` vector elements across Slide Board, Stage Panel, Program Surface, Audience Display, and Stage Display.

---

### Verification
- **TypeScript**: 0 errors (`tsc --noEmit`).
- **Build**: Vite renderer & Electron packages verified clean.
