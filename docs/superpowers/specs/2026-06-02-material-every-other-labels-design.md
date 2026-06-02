# Material Network: every-other technology labels — Design Spec

**Date:** 2026-06-02
**Status:** Implemented (commit `3f9cde0`)

## Goal

In the Material Dependency Network's zoomed-out views, technology-node labels (the
small outer ring) overlap and are hard to read. Reduce clutter by hiding every other
technology label by default, revealing a hidden label on hover.

## Decisions

- **Scope:** technology-layer nodes only, and only at their small default size (the
  full-network view and the single-domain view). Material/domain/subdomain labels are
  unaffected; the StdnGraph (Technology Network) is unaffected.
- **"Every other":** alternate by index *within each subdomain's* technology list, so
  each subdomain shows roughly half its labels, evenly spread. (Odd-sized subdomains
  keep the extra label shown.)
- **Reveal:** hovering a hidden technology node shows its label (alongside the existing
  hover grow animation); moving off hides it again.
- **Drill-in:** focusing a single subdomain (its techs enlarge) shows *all* of that
  subdomain's technology labels; returning to a zoomed-out view restores the
  every-other pattern.

## Implementation (all in `frontend/src/components/MaterialGraph.tsx`)

1. **Two Cytoscape style rules** (added after `node.highlighted`, so they win on
   `text-opacity`): `node.label-dim { text-opacity: 0 }` and, after it,
   `node.label-reveal { text-opacity: 1 }`. Hiding only the *text* leaves the node dot,
   color, size, and label data intact (detail panel and navigation still work).
2. **Assign `label-dim`** after the graph builds: group technology nodes by parent
   subdomain (`parentOf`) and add `label-dim` to every other one.
3. **Hover** (`mouseover`/`mouseout`): `mouseover` adds `label-reveal` to a `label-dim`
   node; `mouseout` removes `label-reveal` — suppressed while a subdomain is focused so
   it doesn't fight the focus state.
4. **Focus** (`applyFocus`): the single-subdomain branch adds `label-reveal` to the
   focused technologies; the zoomed-out branches (no subdomain focused) clear
   `label-reveal` from all technology nodes, restoring the every-other pattern.

## Verification

Empirically confirmed against the live graph (static-mode dev server + Playwright,
introspecting the Cytoscape instance):
- Default full view: 175 technologies → 72 labels hidden (`text-opacity 0`), 103 shown.
- Hover: a hidden node's `text-opacity` goes 0 → 1 on hover and back to 0 on mouse-out.
- Drill into a subdomain: all visible technologies revealed (5 visible, 5 shown).
- Zoom back out: pattern restores exactly (103 shown).
- `npm run build` passes; `npm run lint` introduces no new errors (`MaterialGraph.tsx`
  is lint-clean).

## Out of scope

Material/domain/subdomain labels, the StdnGraph technology view, zoom-level-based
auto-reveal (reveal is hover-driven only, per request).
