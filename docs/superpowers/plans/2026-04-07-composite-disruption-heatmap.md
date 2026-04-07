# Composite Disruption Risk Heatmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the frequency-only disruption heatmap with a composite risk score combining frequency and magnitude.

**Architecture:** Frontend-only change. Compute composite scores from existing API response data (`cells` for per-year scores, `country_scores` for year counts). Single file modification.

**Tech Stack:** React, TypeScript

---

### Task 1: Simplify `scoreColor` to accept composite directly

**Files:**
- Modify: `frontend/src/components/TradeDisruption.tsx:51-58`

- [ ] **Step 1: Update `scoreColor` signature and body**

Change from two parameters (score + totalYears) to one (composite). The composite value is already a 0-1 ratio, so no division needed.

```typescript
function scoreColor(composite: number): string {
  if (composite === 0) return "transparent";
  if (composite >= 0.75) return "rgba(239, 68, 68, 0.85)";
  if (composite >= 0.5) return "rgba(249, 115, 22, 0.7)";
  if (composite >= 0.25) return "rgba(245, 158, 11, 0.55)";
  return "rgba(34, 197, 94, 0.3)";
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: Errors about `scoreColor` call sites (they still pass two args). This is expected — Task 3 fixes them.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/TradeDisruption.tsx
git commit -m "refactor: simplify scoreColor to accept composite value directly"
```

---

### Task 2: Compute composite scores in heatmap data processing

**Files:**
- Modify: `frontend/src/components/TradeDisruption.tsx:119-145`

- [ ] **Step 1: Replace the heatmap data processing block**

Replace the entire block (lines 119-145) with logic that:
1. Iterates over `cells` to build a map of `(country, material) → score[]`
2. Computes composite per pair: `mean(scores) × (scores.length / totalYears)`
3. Stores composite floats in `scoreMap` (replacing integer year counts)
4. Sorts countries by total composite score

```typescript
  // --- Heatmap data processing ---
  const heatmapCountries: string[] = [];
  const heatmapMaterials = disruptionData?.materials ?? [];
  const scoreMap = new Map<string, number>();

  if (disruptionData) {
    const totalYears = disruptionData.years.length;
    // Collect per-year disruption scores by (country, material)
    const cellScores = new Map<string, number[]>();
    for (const cell of disruptionData.cells) {
      if (cell.score === 0 || cell.countries.length === 0) continue;
      for (const country of cell.countries) {
        const key = `${country}||${cell.material}`;
        if (!cellScores.has(key)) cellScores.set(key, []);
        cellScores.get(key)!.push(cell.score);
      }
    }

    // Compute composite: avg_score × (years_in_set / total_years)
    const countrySet = new Set<string>();
    const countryTotals = new Map<string, number>();
    for (const [key, scores] of cellScores) {
      const [country] = key.split("||");
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const composite = avgScore * (scores.length / totalYears);
      scoreMap.set(key, composite);
      countrySet.add(country);
      countryTotals.set(
        country,
        (countryTotals.get(country) ?? 0) + composite,
      );
    }

    heatmapCountries.push(
      ...Array.from(countrySet).sort(
        (a, b) => (countryTotals.get(b) ?? 0) - (countryTotals.get(a) ?? 0),
      ),
    );
  }
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/TradeDisruption.tsx
git commit -m "feat: compute composite disruption risk scores from frequency and magnitude"
```

---

### Task 3: Update cell rendering and footer

**Files:**
- Modify: `frontend/src/components/TradeDisruption.tsx:230-256`

- [ ] **Step 1: Update cell rendering**

In the `<td>` for each heatmap cell (~line 234-248), change:
- `scoreColor` call: pass `score` directly (one arg, no `disruptionData.years.length`)
- Cell text: display `${(score * 100).toFixed(0)}%` instead of raw count
- Title attribute: update to show composite percentage

```typescript
                        {heatmapMaterials.map((mat) => {
                          const score =
                            scoreMap.get(`${country}||${mat}`) ?? 0;
                          return (
                            <td
                              key={mat}
                              style={{
                                background: scoreColor(score),
                                textAlign: "center",
                                fontSize: "0.75rem",
                                minWidth: "2.5rem",
                                cursor: "pointer",
                              }}
                              onClick={() => setSelectedMaterial(mat)}
                              title={`${country} → ${mat}: ${(score * 100).toFixed(0)}% composite risk`}
                            >
                              {score > 0 ? `${(score * 100).toFixed(0)}%` : ""}
                            </td>
                          );
                        })}
```

- [ ] **Step 2: Update footer text**

Replace the existing footer `<p>` (~line 254-256) with:

```typescript
                <p style={{ fontSize: "0.75rem", opacity: 0.5, marginTop: "0.5rem" }}>
                  Cell = composite risk (avg disruption score × frequency ratio) for k={k}.
                  Countries sorted by total composite risk.
                </p>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Verify build succeeds**

Run: `cd frontend && npm run build`
Expected: Build completes without errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TradeDisruption.tsx
git commit -m "feat: display composite risk percentages in disruption heatmap cells"
```

---

### Task 4: Remove unused `maxAggScore` variable

**Files:**
- Modify: `frontend/src/components/TradeDisruption.tsx:123`

- [ ] **Step 1: Remove `maxAggScore`**

The variable `let maxAggScore = 0;` and its update inside the old processing loop are no longer used after Task 2's rewrite. Verify it was removed in Task 2. If it somehow survived, delete the declaration and any references.

- [ ] **Step 2: Final build verification**

Run: `cd frontend && npm run build`
Expected: Build completes without errors.

- [ ] **Step 3: Manual smoke test**

Run: `cd frontend && npm run dev`
Verify:
- Heatmap cells show percentages (e.g., "47%") instead of integer counts
- Colors correspond to composite values (red >= 75%, orange >= 50%, amber >= 25%, green < 25%)
- Clicking a material column still shows year-by-year detail in the sidebar
- k selector (1, 2, 3) still works and updates the heatmap
- Countries are sorted by total composite score

- [ ] **Step 4: Commit (if any cleanup was needed)**

```bash
git add frontend/src/components/TradeDisruption.tsx
git commit -m "chore: remove unused maxAggScore variable"
```
