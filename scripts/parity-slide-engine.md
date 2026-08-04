# Slide-engine parity harness

The reference editor's own parser is checked into this repo as a prebuilt bundle
at `public/slide-editor/slide-editor.bundle.js`. That makes "is our port an exact
copy?" a test rather than a judgement call: load both in one page and compare
outputs over the same `.pptx`.

## Running it

1. Stage the test decks (they are not committed — `public/__parity/` is in
   `.git/info/exclude`):

```bash
mkdir -p public/__parity
cp "/Users/explorer02/Downloads/For OBS/Extract Code 3/feature-test.pptx" public/__parity/
cp "/Users/explorer02/Downloads/For OBS/Extract Code 3/test presentation 1.pptx" public/__parity/
cp "/Users/explorer02/Downloads/For OBS/Extract Code 3/Presentation test.pptx" public/__parity/
cp "/Users/explorer02/Downloads/For OBS/Extract Code 3/Technology Consulting | by Slidesgo.pptx" public/__parity/slidesgo.pptx
```

2. `npm run dev`, open `http://localhost:5173/`, then in the console:

```js
// Oracle: the reference parser.
await new Promise((r, j) => { const s = document.createElement('script');
  s.src = '/slide-editor/slide-editor.bundle.js'; s.onload = r; s.onerror = j;
  document.head.appendChild(s); });

// JSZip as a UMD global (the bare specifier is not resolvable from the console).
await new Promise((r, j) => { const s = document.createElement('script');
  s.src = '/node_modules/jszip/dist/jszip.min.js'; s.onload = r; s.onerror = j;
  document.head.appendChild(s); });

// Ours — Vite serves TS sources directly in dev.
const zipio = await import('/src/renderer/slide-engine/core/zip-io.ts');
```

Then run the comparisons: for each deck, load it into two separate JSZip
instances, run ours and `window.BSPSlideEditor.*` over each, and deep-compare.

## Why two zip instances

Both sides mutate module-scoped caches keyed by zip path. Sharing one instance
lets whichever ran first populate the other's cache and mask a divergence.
Reset ours with `resetDeckCaches()` and the oracle's by replacing
`BSPSlideEditor.state.slideRelsCache` / `slideRelsDetailCache` / `xmlDocCache`.

## Results so far

Roughly 40 differential checks on pure helpers — hex/rgb, `lumMod`/`lumOff`,
`tint`/`shade`, scRGB, alpha, linear and radial gradients, line styles, effect
lists, `blipFill` with `srcRect`, zip path resolution — plus, over all four real
decks: slide order, slide size, the full 12-entry theme colour map, major/minor
fonts, and slide 1's relationship table.

**0 failures**, including the 48-slide Slidesgo deck and the `noFill` shape with
a white outline that the reference calls out as the trap a naive deep search
falls into.

### Geometry (core/preset-geometry.ts)

- 72 preset checks — all 20 generators plus rect/roundRect/ellipse/unknown,
  each with no adjustments, a single `adj`, and an `adj1`/`adj2` pair.
- **800 real `<a:custGeom>` nodes** pulled from Slidesgo slides 1, 5, 12, 23 and
  40, covering **6,318 cubic bezier commands** — parsed geometry and the emitted
  path `d` string both compared.
- Those decks contain no `arcTo`, so that branch was exercised synthetically: a
  90-degree clockwise arc, a 270-degree sweep (the large-arc flag), a negative
  sweep with unequal radii, plus a quadratic path with no declared `w`/`h`
  (bounds fallback), a two-subpath shape with `fill="none" stroke="0"`, an empty
  `pathLst`, and a missing `pathLst`.

All 0 failures.

### Style resolution (parser/shape-style.ts)

Run over slides **and** slideLayouts/slideMasters from all four decks — the
layouts and masters matter most, since that is where the inheritance chain
lives. Both sides had the same theme loaded first, because run colour resolves
through it.

| Checked | Count |
|---|---|
| `<a:rPr>` run properties | 340 |
| Paragraphs (layout + align + default run style each) | 1,453 |
| `<a:bodyPr>` text-body layouts | 1,354 |
| Backgrounds (`bg` + slide-background fallback) | 51 |
| `txStyles` sets (node identity, not just shape) | 51 |

Roughly 7,500 assertions, **0 failures**.

### Placeholder inheritance (parser/placeholders.ts)

Run over slideLayouts, slideMasters and slides from all four decks — 60 parts in
total. The lookup maps are compared entry-by-entry after sorting, and the
`lstStyle` map is compared by **node identity**, since a structurally equal but
different `<a:lstStyle>` element would resolve the wrong level chain later.

| Checked | Count |
|---|---|
| `<p:ph>` identities (`sp` / `pic` / `graphicFrame`) | 1,211 |
| Geometry map entries | 215 |
| Run-style map entries | 395 |
| `lstStyle` map entries (node identity) | 395 |
| Level chains (10 types x 3 idx x 3 levels) | 360 |
| Paragraph- and text-body-layout maps, master-chained | 120 maps |

The paragraph and text-body maps were built the way `presentation.ts` will use
them — master first, then layout passing the master map as `baseMap` — so the
inheritance path itself is under test, not just the extraction.

**0 failures.**

This also caught a divergence introduced earlier: the reference stores
`presentationDefaultTextStyleNodes` as an array indexed by level, and
`getPlaceholderLevelChain` reads `defNodes[lvl]`. It had been ported as a record
keyed `lvl1pPr`…`lvl9pPr`, which would have silently never matched — plain text
boxes would have lost their presentation-level defaults with no error anywhere.
Fixed in `state.ts` and `zip-io.ts`.

### Whole-slide parity (parser/slide-parser.ts + parser/presentation.ts)

The one that matters. `parseModifierSlide` is run end to end on **every slide of
all four decks** — 55 slides — and the resulting shape lists are compared
element by element, in order, with every field on every record.

Comparison notes that make this a real test rather than a tautology:

- **Each side gets its own JSZip *and* its own parsed Documents.** Beyond the
  caches, the parser stamps `__bspGroupId` onto group nodes; sharing a document
  would let whichever ran first hand the other its group ids.
- **DOM references are compared by structural path**, not identity — `srcNode`,
  `groupNode` and each run's `nodeRef` are replaced by their child-index chain
  from the document root. A shape pointing at the *wrong* node fails; pointing at
  the equivalent node in the other side's document passes.
- **`slideNum` varies per slide**, so the `grp_<slideNum>_<n>` id counter and the
  `shape_<slideNum>_<tag><n>` ids are under test too, not just their shape.
- Image data URLs are compared by length plus their last 24 bytes, so a 3 MB
  JPEG doesn't have to be diffed in full to catch the wrong image.

| Compared | Count |
|---|---|
| Slides parsed end to end | 55 |
| Shape records (every field) | 13,685 |
| Paragraphs | 13,456 |
| Runs | 13,646 |
| Shapes inside groups (group transform chain) | 11,917 |
| `custGeom` shapes | 12,394 |
| Rotated / flipped shapes | 186 / 216 |
| Connectors | 265 |
| Tables (cells, spans, insets, borders) | 7 |
| Images / image-fills | 13 / 4 |

**0 failures.**

### Import pipeline (io/import.ts)

`openDeckFromBytes` run end to end on each deck, then compared against a fresh
oracle parse of every slide it produced.

| Deck | Slides | Open | Sync-parsed at open | Background | Shapes checked | Mismatched |
|---|---|---|---|---|---|---|
| feature-test | 4 | 65 ms | 1 | 3, in order | 16 | 0 |
| test presentation 1 | 2 | 38 ms | 1 | 1 | 4 | 0 |
| Presentation test | 1 | 109 ms | 1 | — | 7 | 0 |
| slidesgo | 48 | — | 1 (223 shapes, matches) | in order, no gaps | — | 0 |

Also asserted per deck: shell records built for every slide before any parsing,
in `getSlideKeysInPresentationOrder` order; `activeSlideIndex` 0 and
`selectedElementId` null after open; the import job cleared and the running flag
back to false; history reset fired exactly once; and the status messages emitted
in the reference's order (unzipping → parsing slide 1 of N → opened).

Background parsing is deliberately `requestIdleCallback`-scheduled, as in the
reference. With the browser pane hidden the browser throttles that to roughly
one slide every 25 seconds, so the 48-slide deck's queue was not drained here —
all 48 of its slides are already compared shape-by-shape in the whole-slide
sweep above, and the queue was confirmed to fill strictly in order with no gaps.

**A note on running these in the console.** Vite appends an HMR timestamp query
to a module's imports after that file is edited, so
`import('/src/renderer/slide-engine/state.ts')` from the console can resolve to a
*different instance* than the one the pipeline writes to — the import reports
success while `state.slides` reads as empty. Restart the dev server before an
end-to-end run.

### Headless deck import (io/deck-import.ts)

`importDeckStructure` compared field for field against the oracle's, over all
four decks — every slide, including the 48-slide one (this path parses
synchronously, so nothing is idle-scheduled).

| Deck | Slides | Aspect | Title chars | Body chars | Max text boxes | Max shapes |
|---|---|---|---|---|---|---|
| feature-test | 4 | 16:9 | 96 | 158 | 3 | 9 |
| test presentation 1 | 2 | 16:9 | 21 | 125 | 2 | 2 |
| Presentation test | 1 | 16:9 | 5 | 23 | 2 | 7 |
| slidesgo | 48 | 16:9 | 765 | 7,290 | 19 | 6,232 |

**0 failures**, and the scoped-state contract holds: after each import the slide
size, theme map, alias map, zip handle and XML cache are the exact objects they
were before, so importing never disturbs an open deck.

That last row is the point of the module. A slide with **6,232 shapes** yields
**19 text boxes** — the decorative `custGeom` art each carries a throwaway
`txBody` whose runs are empty or zero-width, and it is filtered on visible
characters rather than on being a text shape at all. A regex over `<a:t>` returns
the noise.

To run the oracle side, its vendor bridge has to be handed JSZip:
`BSPSlideEditor.bridge.vendor.resolve = (k) => k === 'jszip' ? window.JSZip : …`.

## What this does not yet cover

Two shape-level branches these four decks never take: no shape resolves to a
`fillGradientCss`, and none carries a `boxShadowCss`. Both parsers agree on every
slide, but that agreement is vacuous for those two fields here — the gradient and
effect code itself was covered directly in the `core/color.ts` checks above
(linear and radial gradients, effect lists), just not through a whole slide.

`io/import.ts` and the renderer are still to come.
