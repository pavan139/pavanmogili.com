# Architecture

A static site: one HTML page, rendered at build time from `src/content.ts`, plus a 3D
tabletop that loads on demand. No server, no trackers, no third-party requests.

## The two views

- **Classic** (`src/classic/`): complete HTML for crawlers, no-JS visitors, reduced motion,
  and devices without WebGL 2. `render.ts` runs inside the Vite build and writes the page,
  its metadata and JSON-LD. `search/` is a small in-browser search over the project READMEs.
- **Tabletop** (`src/run/`): the request run. `src/main.ts` picks the view, and imports
  `src/app.ts` (and with it three.js) only when the tabletop is chosen.

## The request run (`src/run/`)

One marble, a request, follows a fixed lane across the table. Its position is a single
number `s`, the distance along the lane. Everything else is a function of `s`:

| File | What it does |
|---|---|
| `track.ts` | The lane: four rows joined by half-circle turns. `at(s)` gives position and heading; `S(row, x)` converts a point on a row to `s`. |
| `beats.ts` | The 23 stops: where the marble rests, what the panel says, how the camera frames it. Figures and caveats come from `src/content.ts`. |
| `stations/a.ts` to `d.ts` | The mechanisms, one per project. Each returns `update(s, t, marble)` and poses its parts from `s`, so scrubbing backwards plays them in reverse. |
| `stage.ts` | Renderer, light, the shadow frustum that follows the view, the camera rig, and one post pass (tilt-shift, vignette, grain, Khronos Neutral tone map). |
| `ui.ts`, `run.css` | The panel (HTML text, 16px or larger), the labels pinned to parts of the model, Back and Next, the district list. |
| `kit.ts` | Palette, materials, the static-geometry batcher, canvas text. |
| `index.ts` | Boot, input (stops, wheel and drag scrubbing, keys), the frame loop, and resolution scaling. |

### Why it stays smooth

- No physics and no WebAssembly. The marble eases to its target with a critically damped
  spring and a speed limit of 11 table units a second.
- All static geometry is merged into one mesh per material. Moving parts are a few dozen
  small meshes; the 128 pins and the 1,151 pegs are instanced.
- The camera only ever sees one stop, so the shadow map covers just that area and stays
  sharp at 2048 pixels (1536 on low tiers). It snaps to whole texels so edges do not crawl.
- Programs are compiled before the reveal. Labels write a style only when they move.
- `src/perf/` picks a pixel budget per device tier before anything 3D loads; the loop then
  trades resolution for frame time and gives it back when there is room.
- Reduced motion: no rolling, no camera moves, no idle loops. Each stop is a still.

### The look

An architect's model: white card, balsa, soft shadows, and one accent colour. The accent
means "the request touched this": the marble, the retrieved pages, the kept tokens, the
caught faults.

## Adding or changing a stop

1. Put the words in `beats.ts` (and any figure in `src/content.ts`).
2. Build the mechanism in the matching `stations/*.ts` file: static boxes through
   `ctx.batch`, moving parts through `part(...)`, pinned labels through `ctx.tag(...)`.
3. Drive it from `s` inside `update`. Use `S(row, x)` so timings follow the marble.

## Checks

`npm run check` builds, validates the HTML, checks byte budgets and the copy rules
(`tests/lint/`), and runs browser tests (`tests/e2e/`) on desktop and phone sizes, in the
classic view, the tabletop, and a sandboxed frame like the Claude artifact viewer.
