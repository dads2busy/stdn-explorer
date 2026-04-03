# Comtrade Disruption Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three metrics from the Vullikanti et al. paper ("Supply Chain Disruptions in Microelectronic Inputs") to the stdn-explorer dashboard, computed from Comtrade trade flow data produced by `lia stdn-export`.

**Architecture:** The stdn-export CSV (material, HS code, year, exporter, import_value_usd, import_share_pct, exporter_rank) is loaded as a new data source in the backend. A new `comtrade.py` module builds per-bucket multiplex trade networks and computes three metrics: disruption scores with max-k disruption sets, substitutability/lock-in counts, and disruption heatmap data. Three new API endpoints serve these to a new "Trade Disruption" frontend tab with three sub-views.

**Tech Stack:** Python/FastAPI/pandas (backend), React/TypeScript (frontend). No new dependencies needed.

**Paper reference:** `docs/Disruption_analysis_of_shipping_networks.pdf` — Sections 2.1, 4.2.3

---

## File Structure

### Backend (new files)
- `backend/comtrade.py` — Data loading, metric computation (disruption scores, max-k sets, substitutability)
- `data/comtrade/` — Directory for stdn-export CSV files (one per material or one combined)

### Backend (modified files)
- `backend/main.py` — Import comtrade module, add 3 new API endpoints, load Comtrade data at startup

### Frontend (new files)
- `frontend/src/components/TradeDisruption.tsx` — Main tab component with three sub-views (disruption heatmap, substitutability, per-bucket detail)

### Frontend (modified files)
- `frontend/src/App.tsx` — Add "Trade Disruption" tab to View type and nav

---

## Task 1: Comtrade Data Loading

**Files:**
- Create: `data/comtrade/README.md`
- Create: `backend/comtrade.py`

This task loads the stdn-export CSV into a pandas DataFrame and provides accessor functions used by all subsequent metric computations.

- [ ] **Step 1.1: Create the comtrade data directory with a README**

Create `data/comtrade/README.md`:

```markdown
# Comtrade Trade Flow Data

Place CSV files produced by `lia stdn-export` in this directory.

Expected schema (one row per material x HS code x year x exporter):

| Column | Type | Description |
|--------|------|-------------|
| material | str | Material bucket name (e.g., "Cobalt") |
| hs_bucket | str | HS-6 code (e.g., "260500") |
| hs_bucket_quality | str | "clean" or "shared" |
| year | int | Trade year (e.g., 2023) |
| exporter | str | Country name |
| exporter_iso3 | str | ISO-3 country code |
| import_value_usd | float | US import value in USD |
| import_share_pct | float | Exporter's share of US imports for this HS code (0-100) |
| exporter_rank | int | Rank by import value for this HS code + year |

Generate with: `lia stdn-export --materials "cobalt,gallium,..." --years 2017-2025 --output data/comtrade/trade_flows.csv`
```

- [ ] **Step 1.2: Write the data loading function in comtrade.py**

Create `backend/comtrade.py`:

```python
"""Comtrade trade flow metrics from lia stdn-export data.

Implements three metrics from Vullikanti et al. (2026):
- Disruption score g_i(S): fraction of trade flow lost when country set S is removed
- Maximum disruption sets S*_k: countries whose removal causes max flow loss (k=1,2,3)
- Substitutability: number of distinct countries in top-k supplier sets across years
"""

from pathlib import Path
from itertools import combinations
import pandas as pd

COMTRADE_DIR = Path(__file__).parent.parent / "data" / "comtrade"

_df: pd.DataFrame | None = None


def load_comtrade() -> pd.DataFrame | None:
    """Load all CSV files from data/comtrade/ into a single DataFrame.

    Returns None if no CSV files are found.
    """
    global _df
    if _df is not None:
        return _df

    csv_files = list(COMTRADE_DIR.glob("*.csv"))
    if not csv_files:
        return None

    frames = [pd.read_csv(f) for f in csv_files]
    _df = pd.concat(frames, ignore_index=True)

    # Normalize types
    _df["year"] = _df["year"].astype(int)
    _df["import_value_usd"] = _df["import_value_usd"].astype(float)
    _df["import_share_pct"] = _df["import_share_pct"].astype(float)
    _df["exporter_rank"] = _df["exporter_rank"].astype(int)

    return _df


def get_materials() -> list[str]:
    """Return sorted list of unique material names in the dataset."""
    df = load_comtrade()
    if df is None:
        return []
    return sorted(df["material"].unique().tolist())


def get_years() -> list[int]:
    """Return sorted list of unique years in the dataset."""
    df = load_comtrade()
    if df is None:
        return []
    return sorted(df["year"].unique().tolist())
```

- [ ] **Step 1.3: Commit**

```bash
git add data/comtrade/README.md backend/comtrade.py
git commit -m "feat(comtrade): add data directory and CSV loading module"
```

---

## Task 2: Disruption Score Computation

**Files:**
- Modify: `backend/comtrade.py`

The disruption score `g_i(S)` for a commodity `i` and country set `S` is the fraction of total US import value lost when all countries in `S` are removed. For a material bucket, `g(S)` is the max disruption across all HS codes in the bucket. The maximum disruption set `S*_k` is the set of `k` countries whose removal maximizes `g(S)`.

- [ ] **Step 2.1: Add the single-commodity disruption score function**

Append to `backend/comtrade.py`:

```python
def disruption_score(
    df_commodity: pd.DataFrame,
    removed_countries: set[str],
) -> float:
    """Compute g_i(S): fraction of import value lost for one HS code when
    countries in removed_countries are blocked.

    Args:
        df_commodity: Rows for a single HS code in a single year.
        removed_countries: Set of exporter country names to remove.

    Returns:
        Float in [0, 1]. The fraction of total import value attributable
        to the removed countries.
    """
    total = df_commodity["import_value_usd"].sum()
    if total == 0:
        return 0.0
    lost = df_commodity[
        df_commodity["exporter"].isin(removed_countries)
    ]["import_value_usd"].sum()
    return lost / total
```

- [ ] **Step 2.2: Add the max-k disruption set finder**

Append to `backend/comtrade.py`:

```python
def max_disruption_set(
    df_bucket: pd.DataFrame,
    year: int,
    k: int,
) -> dict:
    """Find the set of k countries whose removal causes maximum disruption
    to a material bucket in a given year.

    The bucket-level disruption g(S) is the max disruption across all
    HS codes in the bucket (per the paper's multiplex definition).

    Args:
        df_bucket: Rows for all HS codes of one material bucket.
        year: The year to analyze.
        k: Size of the disruption set (1, 2, or 3).

    Returns:
        {"countries": [...], "score": float, "worst_hs": str}
    """
    df_year = df_bucket[df_bucket["year"] == year]
    if df_year.empty:
        return {"countries": [], "score": 0.0, "worst_hs": ""}

    hs_codes = df_year["hs_bucket"].unique().tolist()
    all_countries = df_year["exporter"].unique().tolist()

    # For small k values and typical country counts (<30), brute force is fine
    best_score = 0.0
    best_set: list[str] = []
    best_hs = ""

    for combo in combinations(all_countries, min(k, len(all_countries))):
        removed = set(combo)
        # Bucket-level: max across all HS codes
        for hs in hs_codes:
            df_hs = df_year[df_year["hs_bucket"] == hs]
            score = disruption_score(df_hs, removed)
            if score > best_score:
                best_score = score
                best_set = list(combo)
                best_hs = hs

    return {
        "countries": sorted(best_set),
        "score": round(best_score, 4),
        "worst_hs": best_hs,
    }
```

- [ ] **Step 2.3: Add the multi-year disruption heatmap builder**

This produces the data for Figure 3 in the paper: a country x bucket scoring grid.

Append to `backend/comtrade.py`:

```python
def disruption_heatmap(k: int = 1) -> dict:
    """Build disruption heatmap data: for each material bucket and year,
    find the top-k disruptor countries and their scores.

    Produces the data behind the paper's Figure 3.

    Args:
        k: Disruption set size (1, 2, or 3).

    Returns:
        {
            "materials": [...],
            "years": [...],
            "cells": [
                {
                    "material": str,
                    "year": int,
                    "countries": [...],
                    "score": float,
                    "worst_hs": str
                }, ...
            ],
            "country_scores": [
                {
                    "country": str,
                    "material": str,
                    "aggregate_score": int  # num years in top-k set
                }, ...
            ]
        }
    """
    df = load_comtrade()
    if df is None:
        return {"materials": [], "years": [], "cells": [], "country_scores": []}

    materials = sorted(df["material"].unique().tolist())
    years = sorted(df["year"].unique().tolist())

    cells = []
    # Track how many years each country appears in the top-k set per material
    country_year_counts: dict[tuple[str, str], int] = {}

    for mat in materials:
        df_mat = df[df["material"] == mat]
        for year in years:
            result = max_disruption_set(df_mat, year, k)
            cells.append({
                "material": mat,
                "year": year,
                "countries": result["countries"],
                "score": result["score"],
                "worst_hs": result["worst_hs"],
            })
            for country in result["countries"]:
                key = (country, mat)
                country_year_counts[key] = country_year_counts.get(key, 0) + 1

    # Build aggregate country scores (paper's heatmap cell values)
    country_scores = [
        {
            "country": country,
            "material": mat,
            "aggregate_score": count,
        }
        for (country, mat), count in country_year_counts.items()
    ]
    # Sort by aggregate score descending
    country_scores.sort(key=lambda x: -x["aggregate_score"])

    return {
        "materials": materials,
        "years": years,
        "cells": cells,
        "country_scores": country_scores,
    }
```

- [ ] **Step 2.4: Commit**

```bash
git add backend/comtrade.py
git commit -m "feat(comtrade): add disruption score and max-k disruption set computation"
```

---

## Task 3: Substitutability / Lock-in Computation

**Files:**
- Modify: `backend/comtrade.py`

Substitutability is measured by counting the number of distinct countries that appear in the top-k supplier set across all years. Low count ~ lock-in; high count ~ substitutability.

- [ ] **Step 3.1: Add the substitutability computation**

Append to `backend/comtrade.py`:

```python
def substitutability(k_values: list[int] | None = None) -> dict:
    """Compute substitutability/lock-in per material bucket.

    For each material and each k (1, 2, 3), count the number of distinct
    countries that appear in the top-k supplier set across all years.

    Fewer distinct countries = higher lock-in (same countries dominate).
    More distinct countries = higher substitutability (countries rotate).

    Produces the data behind the paper's Figure 4 (tornado plot).

    Args:
        k_values: List of k values to compute. Defaults to [1, 2, 3].

    Returns:
        {
            "materials": [...],
            "years": [...],
            "num_years": int,
            "entries": [
                {
                    "material": str,
                    "k": int,
                    "distinct_countries": int,
                    "countries": [...],
                    "max_possible": int  # k * num_years
                }, ...
            ]
        }
    """
    if k_values is None:
        k_values = [1, 2, 3]

    df = load_comtrade()
    if df is None:
        return {"materials": [], "years": [], "num_years": 0, "entries": []}

    materials = sorted(df["material"].unique().tolist())
    years = sorted(df["year"].unique().tolist())
    num_years = len(years)

    entries = []
    for mat in materials:
        df_mat = df[df["material"] == mat]
        for k in k_values:
            # Collect all countries that appear in the top-k for any year
            top_k_countries: set[str] = set()
            for year in years:
                df_year = df_mat[df_mat["year"] == year]
                if df_year.empty:
                    continue
                # Top-k by total import value across all HS codes in bucket
                country_totals = (
                    df_year.groupby("exporter")["import_value_usd"]
                    .sum()
                    .nlargest(k)
                )
                top_k_countries.update(country_totals.index.tolist())

            entries.append({
                "material": mat,
                "k": k,
                "distinct_countries": len(top_k_countries),
                "countries": sorted(top_k_countries),
                "max_possible": k * num_years,
            })

    return {
        "materials": materials,
        "years": years,
        "num_years": num_years,
        "entries": entries,
    }
```

- [ ] **Step 3.2: Commit**

```bash
git add backend/comtrade.py
git commit -m "feat(comtrade): add substitutability/lock-in computation"
```

---

## Task 4: Backend API Endpoints

**Files:**
- Modify: `backend/main.py`

Wire up three new endpoints that serve the Comtrade metrics to the frontend.

- [ ] **Step 4.1: Add the comtrade import and availability check**

At the top of `backend/main.py`, after the existing imports (around line 5), add:

```python
from comtrade import load_comtrade, get_materials, get_years, disruption_heatmap, substitutability
```

After the existing domain data loading block (after line 173 where `DF_DOMAINS` is populated), add:

```python
# --- Comtrade trade flow data (from lia stdn-export) ---
_comtrade_df = load_comtrade()
COMTRADE_AVAILABLE = _comtrade_df is not None
```

- [ ] **Step 4.2: Add the /api/comtrade/overview endpoint**

Append before the `if __name__` block at the bottom of `main.py`:

```python
# --- Comtrade Trade Flow Endpoints ---


@app.get("/api/comtrade/overview")
def comtrade_overview():
    """Return available materials, years, and whether Comtrade data is loaded."""
    return {
        "available": COMTRADE_AVAILABLE,
        "materials": get_materials(),
        "years": get_years(),
    }


@app.get("/api/comtrade/disruption")
def comtrade_disruption(k: int = 1):
    """Return disruption heatmap data for the given k value.

    Query params:
        k: Disruption set size (1, 2, or 3). Default 1.
    """
    if not COMTRADE_AVAILABLE:
        return {"error": "No Comtrade data loaded. Place stdn-export CSVs in data/comtrade/"}
    if k not in (1, 2, 3):
        return {"error": "k must be 1, 2, or 3"}
    return disruption_heatmap(k)


@app.get("/api/comtrade/substitutability")
def comtrade_substitutability():
    """Return substitutability/lock-in data for all materials, k=1,2,3."""
    if not COMTRADE_AVAILABLE:
        return {"error": "No Comtrade data loaded. Place stdn-export CSVs in data/comtrade/"}
    return substitutability()
```

- [ ] **Step 4.3: Verify the backend starts**

Run: `cd /Users/ads7fg/git/stdn-explorer && python -m uvicorn backend.main:app --port 8080`

Expected: Server starts without import errors. If no CSV data in `data/comtrade/`, the overview endpoint should return `{"available": false, "materials": [], "years": []}`.

- [ ] **Step 4.4: Commit**

```bash
git add backend/main.py
git commit -m "feat(api): add Comtrade disruption and substitutability endpoints"
```

---

## Task 5: Frontend — Trade Disruption Tab (Disruption Heatmap Sub-view)

**Files:**
- Create: `frontend/src/components/TradeDisruption.tsx`
- Modify: `frontend/src/App.tsx`

This is the main new tab. It has three sections:
1. A disruption heatmap (country x material grid, like Figure 3)
2. A substitutability tornado-style chart (like Figure 4)
3. A material detail panel

- [ ] **Step 5.1: Create the TradeDisruption component**

Create `frontend/src/components/TradeDisruption.tsx`:

```typescript
import { useState, useEffect } from "react";
import { useApi, apiUrl } from "../hooks/useApi";
import { MeasureDescription } from "./MeasureDescription";

// --- Type definitions ---

interface DisruptionCell {
  material: string;
  year: number;
  countries: string[];
  score: number;
  worst_hs: string;
}

interface CountryScore {
  country: string;
  material: string;
  aggregate_score: number;
}

interface DisruptionResponse {
  materials: string[];
  years: number[];
  cells: DisruptionCell[];
  country_scores: CountryScore[];
}

interface SubEntry {
  material: string;
  k: number;
  distinct_countries: number;
  countries: string[];
  max_possible: number;
}

interface SubstitutabilityResponse {
  materials: string[];
  years: number[];
  num_years: number;
  entries: SubEntry[];
}

interface ComtradeOverview {
  available: boolean;
  materials: string[];
  years: number[];
}

// --- Helpers ---

function scoreColor(score: number, maxScore: number): string {
  if (maxScore === 0) return "transparent";
  const ratio = score / maxScore;
  if (ratio >= 0.9) return "rgba(239, 68, 68, 0.85)";
  if (ratio >= 0.6) return "rgba(249, 115, 22, 0.7)";
  if (ratio >= 0.3) return "rgba(245, 158, 11, 0.55)";
  if (ratio > 0) return "rgba(34, 197, 94, 0.3)";
  return "transparent";
}

type SubView = "heatmap" | "substitutability";

// --- Component ---

export function TradeDisruption({
  domain,
  includePC,
}: {
  domain: string;
  includePC: boolean;
}) {
  const [subView, setSubView] = useState<SubView>("heatmap");
  const [k, setK] = useState(1);
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);

  // Check if Comtrade data is available
  const { data: overview } = useApi<ComtradeOverview>(
    "/api/comtrade/overview",
    domain,
    includePC,
  );

  // Fetch disruption data (heatmap view)
  const [disruptionData, setDisruptionData] = useState<DisruptionResponse | null>(null);
  const [disruptionLoading, setDisruptionLoading] = useState(false);

  useEffect(() => {
    if (!overview?.available) return;
    setDisruptionLoading(true);
    fetch(apiUrl(`/api/comtrade/disruption?k=${k}`, domain, includePC))
      .then((r) => r.json())
      .then((d) => setDisruptionData(d))
      .catch(() => setDisruptionData(null))
      .finally(() => setDisruptionLoading(false));
  }, [k, overview?.available, domain, includePC]);

  // Fetch substitutability data
  const { data: subData } = useApi<SubstitutabilityResponse>(
    overview?.available ? "/api/comtrade/substitutability" : null,
    domain,
    includePC,
  );

  if (!overview?.available) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2 className="heatmap-title">Trade Disruption Analysis</h2>
        <p style={{ opacity: 0.6 }}>
          No Comtrade trade flow data available. Generate data with{" "}
          <code>lia stdn-export</code> and place the CSV in{" "}
          <code>data/comtrade/</code>.
        </p>
      </div>
    );
  }

  // --- Heatmap data processing ---
  // Build country x material grid from country_scores
  const heatmapCountries: string[] = [];
  const heatmapMaterials = disruptionData?.materials ?? [];
  const scoreMap = new Map<string, number>();
  let maxAggScore = 0;

  if (disruptionData) {
    const countrySet = new Set<string>();
    for (const cs of disruptionData.country_scores) {
      countrySet.add(cs.country);
      const key = `${cs.country}||${cs.material}`;
      scoreMap.set(key, cs.aggregate_score);
      if (cs.aggregate_score > maxAggScore) maxAggScore = cs.aggregate_score;
    }
    // Sort countries by total aggregate score descending
    const countryTotals = new Map<string, number>();
    for (const cs of disruptionData.country_scores) {
      countryTotals.set(
        cs.country,
        (countryTotals.get(cs.country) ?? 0) + cs.aggregate_score,
      );
    }
    heatmapCountries.push(
      ...Array.from(countrySet).sort(
        (a, b) => (countryTotals.get(b) ?? 0) - (countryTotals.get(a) ?? 0),
      ),
    );
  }

  // --- Material detail: yearly disruption sets ---
  const materialCells = selectedMaterial
    ? (disruptionData?.cells ?? []).filter((c) => c.material === selectedMaterial)
    : [];

  return (
    <div style={{ padding: "0 1.5rem" }}>
      <h2 className="heatmap-title">Trade Disruption Analysis</h2>
      <MeasureDescription measure="trade_disruption" />

      {/* Sub-view tabs */}
      <div style={{ display: "flex", gap: "0.5rem", margin: "1rem 0" }}>
        <button
          className={`tab ${subView === "heatmap" ? "active" : ""}`}
          onClick={() => setSubView("heatmap")}
        >
          Disruption Heatmap
        </button>
        <button
          className={`tab ${subView === "substitutability" ? "active" : ""}`}
          onClick={() => setSubView("substitutability")}
        >
          Substitutability
        </button>
      </div>

      {subView === "heatmap" && (
        <div>
          {/* k selector */}
          <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
            <label style={{ fontSize: "0.85rem", opacity: 0.7 }}>
              Disruption set size (k):
            </label>
            {[1, 2, 3].map((kVal) => (
              <button
                key={kVal}
                className={`tab ${k === kVal ? "active" : ""}`}
                onClick={() => setK(kVal)}
                style={{ minWidth: "2.5rem" }}
              >
                {kVal}
              </button>
            ))}
          </div>

          {disruptionLoading ? (
            <p style={{ opacity: 0.5 }}>Computing disruption sets...</p>
          ) : disruptionData ? (
            <div style={{ display: "flex", gap: "1.5rem" }}>
              {/* Heatmap grid */}
              <div style={{ flex: 1, overflowX: "auto" }}>
                <table className="heatmap-table">
                  <thead>
                    <tr>
                      <th style={{ position: "sticky", left: 0, zIndex: 2 }}>
                        Country \ Material
                      </th>
                      {heatmapMaterials.map((mat) => (
                        <th
                          key={mat}
                          onClick={() => setSelectedMaterial(mat)}
                          style={{ cursor: "pointer", writingMode: "vertical-rl" }}
                          className={selectedMaterial === mat ? "focused" : ""}
                        >
                          {mat}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmapCountries.slice(0, 20).map((country) => (
                      <tr key={country}>
                        <td
                          style={{
                            position: "sticky",
                            left: 0,
                            zIndex: 1,
                            fontWeight: 500,
                            fontSize: "0.8rem",
                          }}
                        >
                          {country}
                        </td>
                        {heatmapMaterials.map((mat) => {
                          const score =
                            scoreMap.get(`${country}||${mat}`) ?? 0;
                          return (
                            <td
                              key={mat}
                              style={{
                                background: scoreColor(score, maxAggScore),
                                textAlign: "center",
                                fontSize: "0.75rem",
                                minWidth: "2.5rem",
                                cursor: "pointer",
                              }}
                              onClick={() => setSelectedMaterial(mat)}
                              title={`${country} → ${mat}: ${score} years in top-${k} set`}
                            >
                              {score > 0 ? score : ""}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ fontSize: "0.75rem", opacity: 0.5, marginTop: "0.5rem" }}>
                  Cell value = number of years (out of {disruptionData.years.length}) country appears in k={k} max disruption set.
                  Top 20 countries shown by total score.
                </p>
              </div>

              {/* Detail panel */}
              <div style={{ width: "320px", flexShrink: 0 }}>
                {selectedMaterial ? (
                  <div className="sidebar-panel">
                    <h3>{selectedMaterial}</h3>
                    <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                      Year-by-year max disruption sets (k={k})
                    </p>
                    <table style={{ width: "100%", fontSize: "0.8rem" }}>
                      <thead>
                        <tr>
                          <th>Year</th>
                          <th>Countries</th>
                          <th>Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materialCells
                          .sort((a, b) => a.year - b.year)
                          .map((cell) => (
                            <tr key={cell.year}>
                              <td>{cell.year}</td>
                              <td>{cell.countries.join(", ")}</td>
                              <td>{(cell.score * 100).toFixed(1)}%</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="sidebar-panel empty">
                    <p>Click a material column to see year-by-year disruption details.</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {subView === "substitutability" && subData && (
        <div>
          <p style={{ fontSize: "0.85rem", opacity: 0.7, marginBottom: "1rem" }}>
            Number of distinct countries in the top-k supplier set across {subData.num_years} years
            ({subData.years[0]}–{subData.years[subData.years.length - 1]}).
            Fewer countries = higher lock-in. Three bars per material for k = 1, 2, 3.
          </p>

          <div style={{ display: "flex", gap: "1.5rem" }}>
            <div style={{ flex: 1 }}>
              <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "0.4rem" }}>Material</th>
                    <th style={{ textAlign: "center", padding: "0.4rem" }}>k=1</th>
                    <th style={{ textAlign: "center", padding: "0.4rem" }}>k=2</th>
                    <th style={{ textAlign: "center", padding: "0.4rem" }}>k=3</th>
                  </tr>
                </thead>
                <tbody>
                  {subData.materials.map((mat) => {
                    const getEntry = (kVal: number) =>
                      subData.entries.find(
                        (e) => e.material === mat && e.k === kVal,
                      );
                    return (
                      <tr
                        key={mat}
                        onClick={() => setSelectedMaterial(mat)}
                        style={{
                          cursor: "pointer",
                          background:
                            selectedMaterial === mat
                              ? "rgba(99, 102, 241, 0.15)"
                              : undefined,
                        }}
                      >
                        <td style={{ padding: "0.4rem", fontWeight: 500 }}>
                          {mat}
                        </td>
                        {[1, 2, 3].map((kVal) => {
                          const entry = getEntry(kVal);
                          if (!entry) return <td key={kVal}>-</td>;
                          const ratio =
                            entry.distinct_countries / entry.max_possible;
                          return (
                            <td
                              key={kVal}
                              style={{ textAlign: "center", padding: "0.4rem" }}
                            >
                              <div
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.3rem",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${Math.max(ratio * 80, 8)}px`,
                                    height: "14px",
                                    background:
                                      ratio <= 0.3
                                        ? "rgba(239, 68, 68, 0.7)"
                                        : ratio <= 0.6
                                          ? "rgba(245, 158, 11, 0.7)"
                                          : "rgba(34, 197, 94, 0.5)",
                                    borderRadius: "2px",
                                  }}
                                />
                                <span>{entry.distinct_countries}</span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p style={{ fontSize: "0.75rem", opacity: 0.5, marginTop: "0.5rem" }}>
                Red bars = low substitutability (few distinct suppliers). Green = high substitutability.
              </p>
            </div>

            {/* Detail panel */}
            <div style={{ width: "320px", flexShrink: 0 }}>
              {selectedMaterial ? (
                <div className="sidebar-panel">
                  <h3>{selectedMaterial}</h3>
                  {[1, 2, 3].map((kVal) => {
                    const entry = subData.entries.find(
                      (e) =>
                        e.material === selectedMaterial && e.k === kVal,
                    );
                    if (!entry) return null;
                    return (
                      <div key={kVal} style={{ marginBottom: "0.8rem" }}>
                        <strong style={{ fontSize: "0.8rem" }}>
                          k={kVal}: {entry.distinct_countries} distinct
                          countries
                        </strong>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            opacity: 0.5,
                            marginLeft: "0.5rem",
                          }}
                        >
                          (max possible: {entry.max_possible})
                        </span>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            marginTop: "0.2rem",
                            opacity: 0.8,
                          }}
                        >
                          {entry.countries.join(", ")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="sidebar-panel empty">
                  <p>Click a material row to see supplier details.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5.2: Register the tab in App.tsx**

In `frontend/src/App.tsx`, make these changes:

1. Add the import (after line 12):

```typescript
import { TradeDisruption } from "./components/TradeDisruption";
```

2. Update the View type (line 15):

```typescript
type View = "explore" | "material" | "concentration" | "exposure" | "overlap" | "disruption" | "trade" | "analyst" | "methodology";
```

3. Add the tab button (after the existing "Disruption" button, line 71):

```typescript
<button className={`tab ${view === "trade" ? "active" : ""}`} onClick={() => switchView("trade")}>Trade Disruption</button>
```

4. Add the view rendering (after line 153, the existing disruption line):

```typescript
{view === "trade" && <TradeDisruption domain={domain} includePC={includePC} />}
```

- [ ] **Step 5.3: Verify the frontend compiles**

Run: `cd /Users/ads7fg/git/stdn-explorer/frontend && npx tsc --noEmit`

Expected: No type errors.

- [ ] **Step 5.4: Commit**

```bash
git add frontend/src/components/TradeDisruption.tsx frontend/src/App.tsx
git commit -m "feat(ui): add Trade Disruption tab with heatmap and substitutability views"
```

---

## Task 6: Add MeasureDescription for the New Tab

**Files:**
- Modify: `frontend/src/components/MeasureDescription.tsx`

The MeasureDescription component provides contextual descriptions for each measure. Add an entry for `trade_disruption`.

- [ ] **Step 6.1: Read MeasureDescription.tsx to find the descriptions object**

Read the file to find where measure descriptions are defined and add a new entry.

- [ ] **Step 6.2: Add the trade_disruption description**

Add a new entry to the descriptions object in `MeasureDescription.tsx`:

```typescript
trade_disruption: "Disruption analysis based on actual UN Comtrade trade flows (US imports by value). " +
  "The disruption heatmap shows which countries, if removed from trade, cause the greatest loss of import value " +
  "for each material bucket. Cell values indicate how many years a country appears in the maximum disruption set. " +
  "Substitutability measures how many distinct countries rotate through the top-k supplier positions over time — " +
  "fewer countries indicates higher lock-in. Based on Vullikanti et al. (2026).",
```

- [ ] **Step 6.3: Commit**

```bash
git add frontend/src/components/MeasureDescription.tsx
git commit -m "feat(ui): add measure description for trade disruption tab"
```

---

## Task 7: End-to-End Verification

**Files:** None (testing only)

- [ ] **Step 7.1: Generate test data with lia stdn-export**

Run stdn-export for a small set of materials to produce test data:

```bash
cd /Users/ads7fg/git/lia
python -m lia stdn-export \
  --materials "cobalt,gallium" \
  --years 2022-2024 \
  --output /Users/ads7fg/git/stdn-explorer/data/comtrade/trade_flows.csv
```

If lia stdn-export requires Comtrade data files that aren't available, create a minimal synthetic CSV for testing:

```bash
cat > /Users/ads7fg/git/stdn-explorer/data/comtrade/test_flows.csv << 'CSVEOF'
material,hs_bucket,hs_bucket_quality,year,exporter,exporter_iso3,import_value_usd,import_share_pct,exporter_rank
Cobalt,260500,clean,2022,Congo,COD,450000000,42.5,1
Cobalt,260500,clean,2022,Canada,CAN,180000000,17.0,2
Cobalt,260500,clean,2022,Australia,AUS,120000000,11.3,3
Cobalt,260500,clean,2022,Philippines,PHL,95000000,9.0,4
Cobalt,260500,clean,2022,Other,OTH,214000000,20.2,5
Cobalt,260500,clean,2023,Congo,COD,480000000,44.0,1
Cobalt,260500,clean,2023,Canada,CAN,160000000,14.7,2
Cobalt,260500,clean,2023,Norway,NOR,130000000,11.9,3
Cobalt,260500,clean,2023,Australia,AUS,100000000,9.2,4
Cobalt,260500,clean,2023,Other,OTH,220000000,20.2,5
Cobalt,260500,clean,2024,Congo,COD,500000000,45.5,1
Cobalt,260500,clean,2024,Canada,CAN,170000000,15.5,2
Cobalt,260500,clean,2024,Finland,FIN,110000000,10.0,3
Cobalt,260500,clean,2024,Australia,AUS,90000000,8.2,4
Cobalt,260500,clean,2024,Other,OTH,229000000,20.8,5
Gallium,260600,clean,2022,China,CHN,280000000,68.0,1
Gallium,260600,clean,2022,Germany,DEU,55000000,13.4,2
Gallium,260600,clean,2022,Japan,JPN,35000000,8.5,3
Gallium,260600,clean,2022,Other,OTH,41000000,10.1,4
Gallium,260600,clean,2023,China,CHN,300000000,70.0,1
Gallium,260600,clean,2023,Germany,DEU,50000000,11.6,2
Gallium,260600,clean,2023,South Korea,KOR,38000000,8.8,3
Gallium,260600,clean,2023,Other,OTH,41000000,9.6,4
Gallium,260600,clean,2024,China,CHN,310000000,71.0,1
Gallium,260600,clean,2024,Germany,DEU,48000000,11.0,2
Gallium,260600,clean,2024,Japan,JPN,32000000,7.3,3
Gallium,260600,clean,2024,Other,OTH,47000000,10.7,4
CSVEOF
```

- [ ] **Step 7.2: Start the backend and verify endpoints**

```bash
cd /Users/ads7fg/git/stdn-explorer
python -m uvicorn backend.main:app --port 8080
```

In another terminal, test the endpoints:

```bash
# Should show available: true with 2 materials and 3 years
curl -s http://localhost:8080/api/comtrade/overview | python -m json.tool

# Should return disruption heatmap with Congo dominating Cobalt, China dominating Gallium
curl -s "http://localhost:8080/api/comtrade/disruption?k=1" | python -m json.tool

# Should show Gallium has fewer distinct countries (higher lock-in) than Cobalt
curl -s http://localhost:8080/api/comtrade/substitutability | python -m json.tool
```

- [ ] **Step 7.3: Start the frontend and verify the tab**

```bash
cd /Users/ads7fg/git/stdn-explorer/frontend
npm run dev
```

Open `http://localhost:5173` and:

1. Click the "Trade Disruption" tab
2. Verify the heatmap shows a country x material grid with Congo/Cobalt and China/Gallium scoring high
3. Toggle k=1, k=2, k=3 and verify the heatmap updates
4. Click a material column and verify the detail panel shows year-by-year disruption sets
5. Switch to the "Substitutability" sub-view
6. Verify Gallium shows fewer distinct countries than Cobalt for each k value
7. Click a material row and verify the detail panel shows country lists

- [ ] **Step 7.4: Commit test data (if using synthetic CSV)**

```bash
git add data/comtrade/test_flows.csv
git commit -m "test: add synthetic Comtrade trade flow data for development"
```

---

## Summary of What This Implements

| Paper Metric | Section | Implementation |
|---|---|---|
| Disruption score g_i(S) | 4.2.3 | `comtrade.disruption_score()` — fraction of import value lost |
| Max disruption sets S*_k | 4.2.3 | `comtrade.max_disruption_set()` — brute-force over country combos |
| Disruption heatmap | Fig. 3 | `comtrade.disruption_heatmap()` — country x material aggregate scores |
| Substitutability / lock-in | Sec. 2.1, Fig. 4 | `comtrade.substitutability()` — distinct country counts in top-k sets |

### Not Yet Implemented (future work, needs data expansion)

| Paper Metric | Blocker |
|---|---|
| Leverage ratio | Needs quantity data + export flows (stdn-export currently value-only, US-import-only) |
| Coalition leverage | Needs bidirectional trade data |
| Reachability / shortest paths | Needs full directed trade graph (all country pairs) |
