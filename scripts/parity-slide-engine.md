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

## What this does not yet cover

`slide-parser.ts` is the module that matters most and is not ported yet. When it
lands, compare `parsePptxSlideXmlDoc` shape-by-shape: `left/top/width/height`,
`rotationDeg`, `flipH/flipV`, `fillColor`, `fillGradientCss`, `strokeColor`,
`shapeType`, and each paragraph's runs (text, colour, size, bold/italic).
