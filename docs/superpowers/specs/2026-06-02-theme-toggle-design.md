# Dark/Light Theme Toggle — Design Spec

**Date:** 2026-06-02
**Status:** Approved (pending implementation plan)

## Goal

Add a button to switch the STDN Explorer between the current dark theme and a new
light theme. The **must-have** is that the two network graphs (`StdnGraph`,
`MaterialGraph`) render correctly on a **white background**. Other tabs need to be
*legible* in light mode, not fully polished.

## Decisions (settled during brainstorming)

- **Scope:** Graphs are the priority (white background + legible elements). All
  other tabs only need to be "not broken" in light mode — no per-tab polish.
- **Default & persistence:** Default to **dark**; remember the user's choice via
  `localStorage` so it survives reloads. No OS `prefers-color-scheme` detection.
- **Button:** Icon button (sun/moon), pinned **top-right of `header-top`**, always
  visible regardless of active tab.

## Current-state findings

- `frontend/src/App.css` (1835 lines) has a `:root` block with ~9 color variables,
  but also ~60 hardcoded `rgba()` and ~20 hardcoded hex colors that bypass them.
- `.graph-canvas` has **no background color of its own** — it is transparent and
  shows the app's `--bg` behind it. Flipping `--bg` to white turns the graph
  background white automatically.
- The graphs draw their node/edge colors from **JavaScript literals** inside
  `StdnGraph.tsx` / `MaterialGraph.tsx`, chosen for a dark canvas. These do not
  follow CSS variables and must be made theme-aware for legibility on white.
- The graph Cytoscape build runs in a `useEffect` keyed on `[data]` only, so a theme
  change must be added to its dependencies to trigger a restyle.
- No `localStorage` usage exists in the codebase yet.

## Design

### 1. Theme state & persistence
- Single source of truth in `App.tsx`:
  `const [theme, setTheme] = useState<'dark'|'light'>(...)`, initialized from
  `localStorage.getItem('stdn-theme')`, falling back to `'dark'`.
- An effect on `theme`:
  - writes `localStorage.setItem('stdn-theme', theme)`
  - sets `document.documentElement.setAttribute('data-theme', theme)`

### 2. CSS — chrome (the bulk, low-risk)
- Keep the existing `:root` block as the **dark** palette.
- Add a `:root[data-theme="light"]` block overriding the same variables with light
  values: `--bg` (near-white), `--surface`, `--border`, `--text`, `--text-muted`.
  Accent colors (`--accent`, `--teal`) stay the same.
- Convert **only** the hardcoded colors that would look broken in light mode (dark
  panel fills such as `#0a0e1a`/`#111827`-style backgrounds). Leave the rest — goal
  is legible, not polished.
- `.graph-canvas` transparency yields a white graph background for free.
- Optionally add a light CSS `transition` on `background`/`color` for a smooth flip.

### 3. The two graphs (must-have)
In `StdnGraph.tsx` and `MaterialGraph.tsx`:
- Accept a `theme: 'dark' | 'light'` prop from `App.tsx`.
- Choose the theme-coupled color literals by theme:
  - label `color`: `#fff` (dark) → `#1e293b` (light)
  - `text-outline-color`: `#333` (dark) → `#fff` (light)
  - edge `line-color` / `target-arrow-color`: `#666` / `#555` (dark) →
    a darker gray such as `#94a3b8` (light)
  - default node `#888` and highlight `border-color: "#fff"` → light-mode equivalents
  - `LAYER_COLORS` (indigo/green/amber/red) and the `#818cf8` / `#a855f7` accents
    are unchanged — they read on both backgrounds.
- Add `theme` to the build `useEffect` dependency array so the graph restyles on flip.

### 4. The button
- Icon button (sun glyph when dark / moon glyph when light), inline SVG or unicode —
  no new icon dependency.
- Pinned top-right of `header-top`, always visible.
- Styled minimally to match existing header controls; includes an `aria-label`.

## Out of scope (YAGNI)
- OS `prefers-color-scheme` detection.
- Wholesale conversion of every hardcoded color in `App.css`.
- Per-tab visual polish beyond legibility.
- New icon/UI libraries.
