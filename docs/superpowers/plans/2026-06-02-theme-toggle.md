# Dark/Light Theme Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a header button that switches the STDN Explorer between the existing dark theme and a new light theme, with the two network graphs rendering legibly on a white background, defaulting to dark and remembering the user's choice.

**Architecture:** A single `theme` state in `App.tsx` drives a `data-theme` attribute on `<html>` and is persisted to `localStorage`. CSS variables provide the light palette via a `:root[data-theme="light"]` block (chrome). The two Cytoscape graphs receive `theme` as a prop and pick theme-aware color literals for their JS-defined node/edge styles, rebuilding when the theme flips.

**Tech Stack:** React 19 + TypeScript + Vite, Cytoscape.js, plain CSS variables. No test runner exists in this project; verification is `npm run build` (tsc typecheck) + `npm run lint` + visual confirmation in `npm run dev`. Do NOT add a test framework — it is out of scope (YAGNI) and against the project's established patterns.

---

## Verification note (read once)

Every task's verification runs from `/Users/ads7fg/git/stdn-explorer/frontend`:

```bash
npm run build   # tsc -b typecheck + vite build
npm run lint    # eslint
```

**Baseline:** On a fresh `feature/theme-toggle` branch the project did NOT build cleanly.
Task 0 fixes the TypeScript errors so `npm run build` passes green; from Task 1 onward
the gate is **`npm run build` must succeed**.

`npm run lint` is NOT part of `npm run build` and has **20 pre-existing eslint errors + 1
warning** (mostly `react-hooks/set-state-in-effect`, `react-hooks/refs`, `no-explicit-any`
across unrelated components). These are intentionally left alone (out of scope, regression
risk). The lint gate is therefore **"introduces no NEW eslint errors beyond the 20-error
baseline"**, not "lint is clean". To check for new lint errors, compare the error count and
the listed files against the baseline.

Visual checks use `npm run dev` (http://localhost:5173). When a step says "visually confirm",
start the dev server if not already running and observe in a browser.

---

## Task 0: Fix pre-existing TypeScript build errors (baseline)

The committed code fails `tsc -b` with ~16 errors unrelated to theming. Fix them with
**minimal, behavior-preserving** changes so `npm run build` passes. Do NOT refactor logic,
rename things, or touch eslint-only issues. Prefer deleting genuinely-unused declarations and
adding narrow type annotations/casts over rewriting code.

**Files & exact fixes:**

- `src/App.tsx:120` — `onNavigate={handleNavigate}` type mismatch (`handleNavigate` first
  param is `View`, prop expects `string`). Fix: change `handleNavigate`'s first parameter from
  `target: View` to `target: string`, and inside its body use `setView(target as View)` where
  it calls `setView(target)`. (Localized to `App.tsx`; do not widen `StdnGraph`'s prop type.)

- `src/components/analyst/analysisGenerators.ts`:
  - Lines 18 (`hhiLevel`), 25 (`severityLevel`), 541 (`concentrationData`), 678 (`avgHhi`):
    unused declarations — delete each declaration (verify each is truly unreferenced first).
  - Line 689: `Property 'dependency_type' does not exist on type 'ConcentrationEntry'` — add
    an optional `dependency_type?: string` field to the `ConcentrationEntry` type/interface
    (find its definition; it represents a concentration row that does carry this field in data).
  - Lines 709, 787: `Type '"metric"' is not assignable to '"text" | "table" | "bullet" | "stat"'`
    — find that block-`type` union and add `"metric"` to it.

- `src/components/ConcentrationHeatmap.tsx:235` — `(p, i)` implicit `any` in
  `selected.top_producers.map((p, i) => ...)`. Fix: annotate the callback params, e.g.
  `.map((p: { country: string; share: number }, i: number) => ...)` (match the actual shape of
  `top_producers` items; widen if the real type has more fields).

- `src/components/StdnGraph.tsx`:
  - Line 36: `hhiBin` is declared but never used — delete the entire `hhiBin` function
    (lines ~36-41). Confirm no references before deleting.
  - Line 205: layout `positions` callback type mismatch. Fix: change the param type from
    `(node: { id: () => string })` to `(node: cytoscape.NodeSingular)`. `cytoscape` is already
    imported at the top of the file.

- `src/components/MaterialGraph.tsx`:
  - Line 535: same layout `positions` fix — change `(node: { id: () => string })` to
    `(node: cytoscape.NodeSingular)`.
  - Line 710: `Type 'unknown' is not assignable to type 'ReactNode'` at
    `{selectedNode.dependency_types && ( ... )}`. Fix: guard with `Boolean(...)` —
    `{Boolean(selectedNode.dependency_types) && ( ... )}`.

- [ ] **Step 1: Apply the fixes above**

- [ ] **Step 2: Verify the build is green**

```bash
npm run build
```
Expected: completes successfully (tsc + vite build), exit 0, no TS errors.

- [ ] **Step 3: Verify no NEW lint errors**

```bash
npm run lint
```
Expected: still 20 errors + 1 warning (the documented baseline) — Task 0 should not increase
the count. (Deleting unused vars may *reduce* it, which is fine.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: resolve pre-existing TypeScript build errors"
```

---

## Task 1: Theme state, persistence, and the toggle button

**Files:**
- Modify: `frontend/src/App.tsx` (imports/state near lines 17-29; header at lines 63-77)
- Modify: `frontend/src/App.css` (add button styles near the `.header-top` rules)

- [ ] **Step 1: Add theme state initialized from localStorage**

In `frontend/src/App.tsx`, inside `function App()` (after the existing `const [domain, setDomain] = useState("microelectronics");` line ~28), add:

```tsx
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("stdn-theme");
    return saved === "light" ? "light" : "dark";
  });
```

- [ ] **Step 2: Persist theme and reflect it on the <html> element**

In `frontend/src/App.tsx`, add this effect immediately after the state declarations (near the existing `useEffect` at line ~30). `useEffect` is already imported on line 1:

```tsx
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("stdn-theme", theme);
  }, [theme]);
```

- [ ] **Step 3: Add the toggle button to the header top-right**

In `frontend/src/App.tsx`, change the `header-top` block (lines 64-77). Wrap the existing `<h1>` and `<nav>` and add the button as the last child of `.header-top`:

```tsx
        <div className="header-top">
          <h1>STDN Explorer</h1>
          <nav className="view-tabs">
            {/* ...all existing <button className={`tab ...`}> entries unchanged... */}
          </nav>
          <button
            className="theme-toggle"
            onClick={() => setTheme(t => (t === "dark" ? "light" : "dark"))}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? (
              // sun — click to go light
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              // moon — click to go dark
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              </svg>
            )}
          </button>
        </div>
```

Keep every existing `<button className={`tab ...`}>` line inside `<nav>` exactly as-is; only the surrounding structure and the new `<button className="theme-toggle">` are added.

- [ ] **Step 4: Style the button**

In `frontend/src/App.css`, add after the existing `.header-top` rule (search for `.header-top {`):

```css
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.theme-toggle:hover {
  color: var(--accent);
  border-color: var(--accent);
}
```

- [ ] **Step 5: Verify build, lint, and behavior**

Run from `frontend/`:

```bash
npm run build
npm run lint
```

Expected: both succeed. Then `npm run dev` and visually confirm: the button appears top-right of the header; clicking it flips the `<html data-theme>` attribute between `dark` and `light` (check DevTools Elements panel); reloading the page preserves the last choice. The page still looks dark in both states for now (light palette comes in Task 2).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/App.css
git commit -m "feat: add theme toggle button with localStorage persistence"
```

---

## Task 2: Light-mode CSS palette (chrome)

**Files:**
- Modify: `frontend/src/App.css` (the `:root` block at lines 1-14; targeted hardcoded dark fills elsewhere)

- [ ] **Step 1: Add the light palette override block**

In `frontend/src/App.css`, immediately after the closing `}` of the existing `:root { ... }` block (line 14), add:

```css
:root[data-theme="light"] {
  --bg: #f8fafc;
  --surface: #ffffff;
  --border: #d8dee9;
  --text: #1e293b;
  --text-muted: #64748b;
  --accent: #d97706;
  --accent-glow: rgba(217, 119, 6, 0.15);
  --accent-subtle: rgba(217, 119, 6, 0.08);
  --teal: #0d9488;
}
```

Note: font variables are inherited from `:root` and are not redefined. `--accent` is darkened slightly (`#d97706` vs `#f59e0b`) so amber text/borders stay readable on white.

- [ ] **Step 2: Find hardcoded dark fills that break on white**

Run from repo root to list candidate hardcoded dark backgrounds:

```bash
grep -nE "background[^;]*#(0a0e1a|111827|1e293b|1e1e2e|0f)" frontend/src/App.css
```

Expected: a short list (e.g. tooltip/panel/code backgrounds). For each match whose role is a panel/surface/background fill, replace the hardcoded dark hex with the variable that fits its role: a base background → `var(--bg)`, a raised panel/card → `var(--surface)`, a border → `var(--border)`. Do **not** touch the `:root` definitions themselves, the `data-theme="light"` block, layer/accent colors, or decorative gradient stops — those are intentionally fixed. Goal is legibility, not full repaint.

- [ ] **Step 3: Verify build and lint**

```bash
npm run build
npm run lint
```

Expected: both succeed.

- [ ] **Step 4: Visually confirm light chrome and white graph background**

`npm run dev`, toggle to light. Confirm: header, panels, tables, and text are legible (dark text on light surfaces, no dark-on-dark or light-on-light). Open the **Technology Network** and **Material Network** tabs — the graph canvas background is now **white** (the graph node/edge colors are still tuned for dark and may look muddy; that is fixed in Tasks 3-4). Toggle back to dark and confirm the original appearance is unchanged.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.css
git commit -m "feat: add light theme palette for chrome"
```

---

## Task 3: Make StdnGraph theme-aware

**Files:**
- Modify: `frontend/src/components/StdnGraph.tsx` (Props at lines 13-19; signature line 43; style block lines 95-201; effect dep array line 354)
- Modify: `frontend/src/App.tsx` (the `<StdnGraph .../>` usage at line 120)

- [ ] **Step 1: Add an optional `theme` prop**

In `frontend/src/components/StdnGraph.tsx`, add to the `Props` interface (lines 13-19):

```tsx
  theme?: "dark" | "light";
```

Update the function signature (line 43) to destructure it with a default:

```tsx
export function StdnGraph({ technology, domain, includePC, onNavigate, onNavigateToMaterial, theme = "dark" }: Props) {
```

- [ ] **Step 2: Define a theme-driven neutral palette inside the build effect**

In `frontend/src/components/StdnGraph.tsx`, inside the `useEffect` that builds the graph (starts line 60), just before `const cy = cytoscape({` (line 92), add:

```tsx
    const g = theme === "light"
      ? { label: "#1e293b", outline: "#ffffff", edge: "#94a3b8", node: "#94a3b8", otherNode: "#cbd5e1", otherBorder: "#94a3b8", selected: "#1e293b" }
      : { label: "#ffffff", outline: "#333333",  edge: "#666666", node: "#888888", otherNode: "#555555",   otherBorder: "#888888", selected: "#ffffff" };
```

- [ ] **Step 3: Replace the theme-coupled literals with palette references**

In `frontend/src/components/StdnGraph.tsx`, in the `style` array, make these exact replacements (line numbers approximate):

- Default `node` style (lines 107-109): `"background-color": "#888"` → `"background-color": g.node`; `color: "#fff"` → `color: g.label`; `"text-outline-color": "#333"` → `"text-outline-color": g.outline`.
- `node[label="Other Countries"]` (lines 147, 150): `"background-color": "#555"` → `"background-color": g.otherNode`; `"border-color": "#888"` → `"border-color": g.otherBorder`.
- `edge` (lines 158-159): `"line-color": "#666"` → `"line-color": g.edge`; `"target-arrow-color": "#666"` → `"target-arrow-color": g.edge`.
- `node:selected` (line 178): `"border-color": "#fff"` → `"border-color": g.selected`.

Leave `LAYER_COLORS.*`, the purple `#a855f7` process-consumable colors, and the `#818cf8` highlight colors unchanged — they read on both backgrounds.

- [ ] **Step 4: Rebuild the graph when the theme changes**

In `frontend/src/components/StdnGraph.tsx`, change the build effect's dependency array (line 354) from:

```tsx
  }, [data]);
```

to:

```tsx
  }, [data, theme]);
```

- [ ] **Step 5: Pass `theme` from App**

In `frontend/src/App.tsx`, update the `<StdnGraph .../>` usage (line 120) to add `theme={theme}` to its props:

```tsx
                <StdnGraph technology={technology} domain={domain} includePC={includePC} theme={theme} onNavigate={handleNavigate} onNavigateToMaterial={(mat) => {
```

(Leave the rest of that JSX, including the `onNavigateToMaterial` body, unchanged.)

- [ ] **Step 6: Verify build and lint**

```bash
npm run build
npm run lint
```

Expected: both succeed.

- [ ] **Step 7: Visually confirm the technology graph in light mode**

`npm run dev`, select a technology on the **Technology Network** tab, toggle to light. Confirm: node labels are dark and readable, edges are visible mid-gray (not washed out), the default/"Other Countries" nodes are visible, and a selected node's border is dark/visible. Toggle to dark and confirm the graph looks exactly as before.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/StdnGraph.tsx frontend/src/App.tsx
git commit -m "feat: make StdnGraph theme-aware for light mode"
```

---

## Task 4: Make MaterialGraph theme-aware

**Files:**
- Modify: `frontend/src/components/MaterialGraph.tsx` (Props at lines 11-15; signature line 236; style block lines 427-504; effect dep array line 661)
- Modify: `frontend/src/App.tsx` (the `<MaterialGraph .../>` usage at line 138)

- [ ] **Step 1: Add an optional `theme` prop**

In `frontend/src/components/MaterialGraph.tsx`, add to the `Props` interface (lines 11-15):

```tsx
  theme?: "dark" | "light";
```

Update the function signature (line 236) to destructure it with a default:

```tsx
export function MaterialGraph({ material, includePC, onNavigateToTechnology, theme = "dark" }: Props) {
```

- [ ] **Step 2: Define the theme-driven neutral palette inside the build effect**

In `frontend/src/components/MaterialGraph.tsx`, inside the build `useEffect` (starts line 397), just before the `const cy = cytoscape({` call (search for it within that effect, before the `style:` array near line 415), add:

```tsx
    const g = theme === "light"
      ? { label: "#1e293b", outline: "#ffffff", edge: "#94a3b8", node: "#94a3b8", selected: "#1e293b" }
      : { label: "#ffffff", outline: "#333333",  edge: "#555555", node: "#888888", selected: "#ffffff" };
```

- [ ] **Step 3: Replace the theme-coupled literals with palette references**

In `frontend/src/components/MaterialGraph.tsx`, in the `style` array, make these exact replacements (line numbers approximate):

- Default `node` style (lines 427-429): `"background-color": "#888"` → `"background-color": g.node`; `color: "#fff"` → `color: g.label`; `"text-outline-color": "#333"` → `"text-outline-color": g.outline`.
- `edge` (lines 475-476): `"line-color": "#555"` → `"line-color": g.edge`; `"target-arrow-color": "#555"` → `"target-arrow-color": g.edge`.
- `node:selected` (line 504): `"border-color": "#fff"` → `"border-color": g.selected`.

Leave `LAYER_COLORS.*` (and the edges that use them: `USED_IN_DOMAIN`, `HAS_SUBDOMAIN`) and the `#818cf8` highlight colors unchanged.

- [ ] **Step 4: Rebuild the graph when the theme changes**

In `frontend/src/components/MaterialGraph.tsx`, change the build effect's dependency array (line 661) from:

```tsx
  }, [data]);
```

to:

```tsx
  }, [data, theme]);
```

- [ ] **Step 5: Pass `theme` from App**

In `frontend/src/App.tsx`, update the `<MaterialGraph .../>` usage (line 138) to add `theme={theme}`:

```tsx
                <MaterialGraph material={selectedMaterial} includePC={includePC} theme={theme} onNavigateToTechnology={(d, t) => {
```

(Leave the rest of that JSX unchanged.)

- [ ] **Step 6: Verify build and lint**

```bash
npm run build
npm run lint
```

Expected: both succeed.

- [ ] **Step 7: Visually confirm the material graph in light mode**

`npm run dev`, open the **Material Network** tab, select a material, toggle to light. Confirm: labels dark and readable, edges visible, selected-node border visible. Toggle to dark and confirm unchanged appearance.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/MaterialGraph.tsx frontend/src/App.tsx
git commit -m "feat: make MaterialGraph theme-aware for light mode"
```

---

## Final verification

- [ ] **Step 1: Full build and lint**

```bash
cd frontend && npm run build && npm run lint
```

Expected: both succeed with no errors.

- [ ] **Step 2: End-to-end visual pass**

`npm run dev`. With theme dark (default on a fresh load / cleared `localStorage`):
- Toggle to light; click through all tabs (Technology Network, Material Network, Concentration, Dominance, Overlap, Supply Disruption, Trade Disruption, Analyst, Methodology). Confirm each is legible — no dark-on-dark or light-on-light text.
- Confirm both network graphs render on a white background with readable labels and edges.
- Reload the page; confirm it stays in light mode (persistence).
- Toggle back to dark; confirm the app matches its original appearance.

- [ ] **Step 3: Note any tab that is illegible (not just unpolished)**

If a tab has genuinely unreadable contrast (not merely "less pretty"), fix it by pointing the offending hardcoded color at the appropriate variable (`var(--bg)` / `var(--surface)` / `var(--text)` / `var(--border)`), then re-run build + lint and commit with message `fix: light-mode legibility for <tab>`. Per scope, polish beyond legibility is out of scope.
```
