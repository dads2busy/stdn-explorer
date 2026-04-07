# Composite Disruption Risk Heatmap

## Problem

The disruption heatmap currently encodes only **frequency** — how many years a country appears in the top-k disruption set. Both the cell number (year count) and cell color (year count / total years) convey the same dimension. The disruption **magnitude** (fraction of trade value lost) is computed by the backend and returned in the API response but is not used in the heatmap visualization. Users cannot distinguish "frequent but mild" from "frequent and severe" without clicking into the sidebar.

## Solution

Replace the frequency-only encoding with a single **composite risk score** that combines frequency and magnitude:

```
composite = avg_disruption_score × (years_in_set / total_years)
```

- `avg_disruption_score`: mean of `cell.score` across years where the country appears in that material's disruption set
- `years_in_set / total_years`: the frequency ratio

This produces a value between 0 and 1.

## Cell Display

- **Number:** composite rendered as a percentage, e.g., "47%"
- **Color:** same 4-tier scale, driven by composite value:
  - `>= 0.75` — red `rgba(239, 68, 68, 0.85)`
  - `>= 0.50` — orange `rgba(249, 115, 22, 0.7)`
  - `>= 0.25` — amber `rgba(245, 158, 11, 0.55)`
  - `< 0.25` — green `rgba(34, 197, 94, 0.3)`
  - `0` — transparent
- **Tooltip:** `"{country} → {material}: {composite}% composite risk"`

## Computation Location

Frontend only. The backend already returns `cells` (with per-year `score`) and `country_scores` (with year counts). The frontend computes composite scores from these during the existing heatmap data processing block.

## Implementation

### File: `frontend/src/components/TradeDisruption.tsx`

1. **Simplify `scoreColor`**: Change signature to `scoreColor(composite: number)`. Remove the `totalYears` parameter and internal ratio calculation — the composite value is used directly against the color thresholds.

2. **Compute composite scores** (heatmap data processing block, ~lines 119-145):
   - Build a map of `(country, material) → list of scores` by iterating over `disruptionData.cells`
   - For each country-material pair, compute `avg(scores) × (count / totalYears)`
   - Store composite in `scoreMap` (replacing the integer year count)

3. **Update country sort order**: Sort by total composite score across materials instead of total year count.

4. **Update cell rendering** (~lines 230-249):
   - Pass composite directly to `scoreColor()` (no `totalYears` argument)
   - Display `${(composite * 100).toFixed(0)}%` instead of raw count
   - Update `title` attribute to show composite percentage

5. **Update footer text** (~line 254-256): Explain composite score formula.

## What Does Not Change

- k selector behavior
- Material column click → sidebar detail panel
- Sidebar detail panel content (still shows year-by-year countries and individual scores)
- Substitutability sub-view
- Backend API
