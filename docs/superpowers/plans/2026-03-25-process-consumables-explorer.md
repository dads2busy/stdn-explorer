# Process Consumables Explorer Support — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add process consumables visualization and analysis to STDN-Explorer, supporting the new 16-column CSV format with `dependency_type` and `extraction_provenance` columns.

**Architecture:** Backend extends the existing FastAPI server — `_load_data()` handles 16 columns, `_build_graph()` creates synthetic `[Assembly]` nodes and `CONSUMES_PROCESS_MATERIAL` edges, two pre-cached DataFrame/graph pairs support the toggle. Frontend adds a global toggle in the header, purple styling for process consumable nodes, dashed edges, and `dependency_type` badges across all analytical views.

**Tech Stack:** Python/FastAPI/Pandas/NetworkX (backend), React/TypeScript/Cytoscape.js (frontend)

**Spec:** `docs/superpowers/specs/2026-03-25-process-consumables-explorer-design.md`

**Code repo:** `~/git/stdn-explorer`

---

## File Map

### Modified files

| File | What changes |
|---|---|
| `backend/main.py` | `_load_data()` handles 16 columns; `_build_graph()` adds synthetic `[Assembly]` nodes, `CONSUMES_PROCESS_MATERIAL` edges, `edge_type` on all edges; dual DF/graph caching; all endpoints accept `include_process_consumables` param and return `dependency_type` |
| `frontend/src/App.tsx` | Add `includePC` state, global toggle switch in header, pass toggle to all view components |
| `frontend/src/components/StdnGraph.tsx` | Purple nodes for process consumables, dashed edges for `CONSUMES_PROCESS_MATERIAL`, `[Assembly]` node styling, `dependency_type` in NodeDetail |
| `frontend/src/components/ConcentrationHeatmap.tsx` | "PC" badge on process consumable materials |
| `frontend/src/components/CountryExposure.tsx` | `dependency_type` badge on dominated materials |
| `frontend/src/components/CrossTechOverlap.tsx` | `dependency_type` badge on overlap materials |
| `frontend/src/components/DisruptionSimulator.tsx` | `dependency_type` badge on affected materials |
| `frontend/src/components/NodeDetail.tsx` | "Process Consumable" badge, `extraction_provenance` display |
| `data/stdn_seed.csv` | Replace with 16-column pipeline output (source: `~/git/dpi_stdn_agentic/output/normalized/stdns_output_d3d3v3_20260324_152538.csv`) |
| `scripts/export_static.py` | Update imports: `G` → `G_ALL`, `GRAPH_METRICS` → `METRICS_ALL`; ensure endpoint calls pass `include_process_consumables=True` |

---

## Part 1: Backend

### Task 1: Update Data Loading for 16-Column CSV

**Files:**
- Modify: `~/git/stdn-explorer/backend/main.py:24-35`

- [ ] **Step 1: Replace seed data**

Copy the latest normalized pipeline output to `data/stdn_seed.csv`. Ensure it has 16 columns including `dependency_type` and `extraction_provenance`.

- [ ] **Step 2: Update `_load_data()`**

Replace the current `_load_data()` function (lines 24-32) with:

```python
def _load_data() -> pd.DataFrame:
    df = pd.read_csv(DATA_DIR / "stdn_seed.csv")
    # Normalize country names to title case
    df["country"] = df["country"].str.strip().str.title()
    df["country"] = df["country"].replace({"Other": "Other Countries"})
    # Fill NaN percentages/amounts with 0
    df["percentage"] = df["percentage"].fillna(0.0)
    df["amount"] = df["amount"].fillna(0.0)
    # New columns: fill defaults for robustness
    if "dependency_type" not in df.columns:
        df["dependency_type"] = "constituent"
    else:
        df["dependency_type"] = df["dependency_type"].fillna("constituent")
    if "extraction_provenance" not in df.columns:
        df["extraction_provenance"] = ""
    else:
        df["extraction_provenance"] = df["extraction_provenance"].fillna("")
    # Validate dependency_type values
    valid_types = {"constituent", "process_consumable"}
    invalid = df[~df["dependency_type"].isin(valid_types)]["dependency_type"].unique()
    if len(invalid) > 0:
        import logging
        logging.warning(f"Unexpected dependency_type values: {invalid.tolist()}")
    # For assembly-level process consumables, fill empty component
    df["component"] = df["component"].fillna("")
    return df
```

- [ ] **Step 3: Add dual DataFrame caching**

After `DF = _load_data()`, add:

```python
DF_ALL = DF
DF_CONSTITUENT = DF[DF["dependency_type"] == "constituent"].copy()
```

- [ ] **Step 4: Add helper to select the right DataFrame**

```python
def _get_df(include_process_consumables: bool = True) -> pd.DataFrame:
    return DF_ALL if include_process_consumables else DF_CONSTITUENT
```

- [ ] **Step 5: Verify the backend starts**

Run: `cd ~/git/stdn-explorer/backend && uvicorn main:app --port 8080`
Expected: Server starts without errors.

- [ ] **Step 6: Commit**

```bash
cd ~/git/stdn-explorer
git add backend/main.py data/stdn_seed.csv
git commit -m "feat: update data loading for 16-column CSV with dependency_type"
```

---

### Task 2: Update Graph Construction

**Files:**
- Modify: `~/git/stdn-explorer/backend/main.py:43-99`

- [ ] **Step 1: Update `_build_graph()` to handle process consumables**

Replace the current `_build_graph()` function (lines 43-92) with:

```python
def _build_graph(df: pd.DataFrame) -> nx.DiGraph:
    """Build a directed graph: Technology → Component → Material → Country.

    Process consumables use CONSUMES_PROCESS_MATERIAL edges.
    Assembly-level consumables route through a synthetic [Assembly] component node.
    """
    g = nx.DiGraph()

    # Pre-compute HHI per material (across all technologies)
    mat_hhi: dict[str, float] = {}
    for mat, group in df.groupby("material"):
        shares = group.groupby("country")["percentage"].max().values
        mat_hhi[mat] = float(sum(s * s for s in shares))

    for _, row in df.iterrows():
        tech = row["technology"]
        comp = row["component"]
        mat = row["material"]
        country = row["country"]
        dep_type = row.get("dependency_type", "constituent")

        tech_id = f"tech:{tech}"

        # For assembly-level process consumables, use synthetic [Assembly] node
        if dep_type == "process_consumable" and (not comp or comp.strip() == ""):
            comp = f"[Assembly] ({tech})"

        comp_id = f"comp:{comp}"
        mat_id = f"mat:{mat}"
        country_id = f"country:{country}"

        # Add nodes
        g.add_node(tech_id, label=tech, node_type="technology")

        is_synthetic = (comp == "[Assembly]")
        g.add_node(comp_id, label=comp, node_type="component",
                   confidence=None if is_synthetic else row["component_confidence"],
                   synthetic=is_synthetic)

        g.add_node(mat_id, label=mat, node_type="material",
                   confidence=row["material_confidence"],
                   hhi=round(mat_hhi.get(mat, 0), 1))
        g.add_node(country_id, label=country, node_type="country")

        # Tech -> Component edge
        if not g.has_edge(tech_id, comp_id):
            g.add_edge(tech_id, comp_id, rel="HAS_COMPONENT",
                       edge_type="HAS_COMPONENT",
                       confidence=None if is_synthetic else row["component_confidence"])

        # Component -> Material edge (type depends on dependency_type)
        if dep_type == "process_consumable":
            edge_rel = "CONSUMES_PROCESS_MATERIAL"
        else:
            edge_rel = "USES_MATERIAL"

        if not g.has_edge(comp_id, mat_id):
            g.add_edge(comp_id, mat_id, rel=edge_rel,
                       edge_type=edge_rel,
                       confidence=row["material_confidence"])

        # Material -> Country edge
        if not g.has_edge(mat_id, country_id):
            g.add_edge(mat_id, country_id, rel="PRODUCED_IN",
                       edge_type="PRODUCED_IN",
                       percentage=row["percentage"],
                       provenance="USGS" if row["amount"] > 0 else "LLM",
                       confidence=row["country_confidence"])
        else:
            existing = g[mat_id][country_id]
            if row["percentage"] > existing.get("percentage", 0):
                existing["percentage"] = row["percentage"]

    return g
```

- [ ] **Step 2: Add dual graph caching**

Replace the current graph initialization (lines 95-99) with:

```python
G_ALL = _build_graph(DF_ALL)
METRICS_ALL = {
    "pagerank": nx.pagerank(G_ALL),
    "in_degree": dict(G_ALL.in_degree()),
}

G_CONSTITUENT = _build_graph(DF_CONSTITUENT)
METRICS_CONSTITUENT = {
    "pagerank": nx.pagerank(G_CONSTITUENT),
    "in_degree": dict(G_CONSTITUENT.in_degree()),
}

# Default references for graph-context endpoint (always uses full graph)
G = G_ALL
GRAPH_METRICS = METRICS_ALL


def _get_graph(include_process_consumables: bool = True):
    if include_process_consumables:
        return G_ALL, METRICS_ALL
    return G_CONSTITUENT, METRICS_CONSTITUENT
```

- [ ] **Step 3: Verify the backend starts and builds both graphs**

Run: `cd ~/git/stdn-explorer/backend && uvicorn main:app --port 8080`
Expected: Server starts. Test: `curl http://localhost:8080/api/technologies` returns technology list.

- [ ] **Step 4: Commit**

```bash
cd ~/git/stdn-explorer
git add backend/main.py
git commit -m "feat: update graph construction for process consumables and dual caching"
```

---

### Task 3: Update API Endpoints

**Files:**
- Modify: `~/git/stdn-explorer/backend/main.py:154-563`

All endpoints gain `include_process_consumables: bool = True` query parameter and use `_get_df()` / `_get_graph()`.

- [ ] **Step 1: Update `/api/technologies`**

```python
@app.get("/api/technologies")
def list_technologies(include_process_consumables: bool = True):
    df = _get_df(include_process_consumables)
    techs = sorted(df["technology"].unique().tolist())
    return {"technologies": techs}
```

- [ ] **Step 2: Update `/api/stdn/{technology}`**

Add `include_process_consumables: bool = True` parameter. Use `_get_df()`. Add `dependency_type` to material nodes and `edge_type` to all edges. Handle `[Assembly]` synthetic nodes:

```python
@app.get("/api/stdn/{technology}")
def get_stdn(technology: str, include_process_consumables: bool = True):
    df = _get_df(include_process_consumables)
    subset = df[df["technology"] == technology]
    if subset.empty:
        return {"nodes": [], "edges": []}

    nodes = []
    edges = []
    seen_nodes: set[str] = set()

    def add_node(id: str, label: str, layer: str, **extra):
        if id not in seen_nodes:
            seen_nodes.add(id)
            nodes.append({"data": {"id": id, "label": label, "layer": layer, **extra}})

    tech_id = f"tech:{technology}"
    add_node(tech_id, technology, "technology")

    for _, row in subset.iterrows():
        comp = row["component"]
        mat = row["material"]
        country = row["country"]
        dep_type = row.get("dependency_type", "constituent")

        # Assembly-level process consumables get synthetic component
        is_assembly = dep_type == "process_consumable" and (not comp or comp.strip() == "")
        if is_assembly:
            comp = f"[Assembly] ({tech})"

        comp_id = f"comp:{comp}"
        mat_id = f"mat:{mat}"
        country_id = f"country:{country}"

        add_node(comp_id, comp, "component",
                 confidence=None if is_assembly else row["component_confidence"],
                 synthetic=is_assembly)
        add_node(mat_id, mat, "material",
                 confidence=row["material_confidence"],
                 hs_code=row.get("hs_code"),
                 dependency_type=dep_type,
                 extraction_provenance=row.get("extraction_provenance", ""))
        add_node(country_id, country, "country")

        # Tech -> Component
        tc_id = f"{tech_id}->{comp_id}"
        if tc_id not in seen_nodes:
            seen_nodes.add(tc_id)
            edges.append({"data": {
                "id": tc_id, "source": tech_id, "target": comp_id,
                "edge_type": "HAS_COMPONENT",
                "confidence": None if is_assembly else row["component_confidence"],
            }})

        # Component -> Material
        edge_type = "CONSUMES_PROCESS_MATERIAL" if dep_type == "process_consumable" else "USES_MATERIAL"
        cm_id = f"{comp_id}->{mat_id}"
        if cm_id not in seen_nodes:
            seen_nodes.add(cm_id)
            edges.append({"data": {
                "id": cm_id, "source": comp_id, "target": mat_id,
                "edge_type": edge_type,
                "confidence": row["material_confidence"],
            }})

        # Material -> Country
        mp_id = f"{mat_id}->{country_id}"
        if mp_id not in seen_nodes:
            seen_nodes.add(mp_id)
            edges.append({"data": {
                "id": mp_id, "source": mat_id, "target": country_id,
                "edge_type": "PRODUCED_IN",
                "percentage": row["percentage"],
                "amount": row["amount"],
                "meas_unit": row.get("meas_unit", ""),
                "confidence": row["country_confidence"],
                "provenance": "USGS" if row["amount"] > 0 else "LLM",
            }})

    return _clean({"nodes": nodes, "edges": edges})
```

- [ ] **Step 3: Update `/api/stdn/{technology}/table`**

```python
@app.get("/api/stdn/{technology}/table")
def get_stdn_table(technology: str, include_process_consumables: bool = True):
    df = _get_df(include_process_consumables)
    subset = df[df["technology"] == technology]
    records = subset.to_dict(orient="records")
    return _clean({"rows": records, "count": len(records)})
```

- [ ] **Step 4: Update `/api/concentration`**

Add `include_process_consumables` param and `dependency_type` to results:

```python
@app.get("/api/concentration")
def get_concentration(include_process_consumables: bool = True):
    df = _get_df(include_process_consumables)
    results = []
    for (tech, mat), group in df.groupby(["technology", "material"]):
        country_shares = group.groupby("country")["percentage"].max().reset_index()
        shares = country_shares["percentage"].values
        hhi = float(sum(s * s for s in shares))
        top3 = country_shares.nlargest(3, "percentage")
        top_producers = [
            {"country": row["country"], "share": round(float(row["percentage"]), 1)}
            for _, row in top3.iterrows()
        ]
        # Use the dependency_type from the first row (consistent within a tech-mat pair)
        dep_type = group.iloc[0].get("dependency_type", "constituent")
        results.append({
            "technology": tech,
            "material": mat,
            "hhi": round(hhi, 1),
            "top_producers": top_producers,
            "num_countries": len(country_shares),
            "dependency_type": dep_type,
        })
    results.sort(key=lambda x: x["hhi"], reverse=True)
    return {"concentration": results}
```

- [ ] **Step 5a: Update `/api/country-exposure`**

Add `include_process_consumables: bool = True` param. Replace `DF` with `_get_df(...)`. Add `dependency_type` to each `dominated_materials` entry — change from `dominated.append(mat)` to `dominated.append({"material": mat, "dependency_type": dep_type})`. Get `dep_type` from the material's rows in the DataFrame.

- [ ] **Step 5b: Update `/api/overlap`**

Add param. Replace `DF` with `_get_df(...)`. Add `dependency_type` to each `mat_results` entry — look up from DataFrame: `dep_type = df[df["material"] == mat].iloc[0].get("dependency_type", "constituent")`.

- [ ] **Step 5c: Update `/api/disruption/{country}`**

Add param. Replace `DF` with `_get_df(...)`. Add `dependency_type` to each material in `affected[tech][comp][mat]` dict — add `"dependency_type": row.get("dependency_type", "constituent")` alongside `"material"`, `"share"`, `"is_top_producer"`.

- [ ] **Step 5d: Update `/api/countries` and `/api/country/{country}`**

Add param to both. Replace `DF` with `_get_df(...)`. For `/api/country/{country}`, add `dependency_type` to each exposure entry.

- [ ] **Step 5e: Update `scripts/export_static.py`**

Update imports: replace `G` with `G_ALL`, `GRAPH_METRICS` with `METRICS_ALL`. If the script calls endpoint functions directly, ensure it passes `include_process_consumables=True` to each. If it imports `DF` directly, replace with `DF_ALL`.

Leave `/api/graph-context` unchanged (always uses `G_ALL`).

- [ ] **Step 6: Test all endpoints**

```bash
curl http://localhost:8080/api/technologies
curl "http://localhost:8080/api/stdn/Smartphone"
curl "http://localhost:8080/api/stdn/Smartphone?include_process_consumables=false"
curl http://localhost:8080/api/concentration
curl "http://localhost:8080/api/concentration?include_process_consumables=false"
curl http://localhost:8080/api/disruption/China
```

Verify: with `include_process_consumables=true` (default), process consumable materials appear. With `false`, they don't.

- [ ] **Step 7: Commit**

```bash
cd ~/git/stdn-explorer
git add backend/main.py
git commit -m "feat: add include_process_consumables param to all API endpoints"
```

---

## Part 2: Frontend

### Task 4: Global Toggle State

**Files:**
- Modify: `~/git/stdn-explorer/frontend/src/App.tsx`

- [ ] **Step 1: Add toggle state and UI**

Add state:
```typescript
const [includePC, setIncludePC] = useState(true);
const IS_STATIC = import.meta.env.VITE_STATIC === "true";
```

Add toggle switch in the header (after the subtitle paragraph, before `</header>`):
```tsx
{!IS_STATIC && (
  <div className="pc-toggle">
    <label>
      <input
        type="checkbox"
        checked={includePC}
        onChange={(e) => setIncludePC(e.target.checked)}
      />
      Include Process Consumables
    </label>
  </div>
)}
```

- [ ] **Step 2: Pass `includePC` to all view components**

Add `includePC` prop to each view component in the render section. Each component will use it to build API paths. For example:
```tsx
<StdnGraph technology={technology} includePC={includePC} onNavigate={handleNavigate} />
<ConcentrationHeatmap includePC={includePC} ... />
```

- [ ] **Step 3: Add CSS for toggle**

In `App.css`, add:
```css
.pc-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  font-size: 0.8rem;
  color: #a0a0b0;
}
.pc-toggle input[type="checkbox"] {
  accent-color: #a855f7;
}
```

- [ ] **Step 4: Commit**

```bash
cd ~/git/stdn-explorer
git add frontend/src/App.tsx frontend/src/App.css
git commit -m "feat: add global process consumables toggle in header"
```

---

### Task 5: Update StdnGraph for Process Consumable Styling

**Files:**
- Modify: `~/git/stdn-explorer/frontend/src/components/StdnGraph.tsx`

- [ ] **Step 1: Accept `includePC` prop and use in API path**

Add prop and build path:
```typescript
interface Props {
  technology: string | null;
  includePC: boolean;
  onNavigate: (...) => void;
}

const pcParam = includePC ? "" : "?include_process_consumables=false";
const { data } = useApi<StdnData>(
  technology ? `/api/stdn/${technology}${pcParam}` : null
);
```

- [ ] **Step 2: Add Cytoscape styling for process consumables**

Add to the Cytoscape stylesheet:
```typescript
// Process consumable material nodes — purple
{
  selector: 'node[layer="material"][dependency_type="process_consumable"]',
  style: {
    "background-color": "#a855f7",
    width: 35,
    height: 35,
  },
},
// Synthetic [Assembly] component node — dashed border
{
  selector: 'node[synthetic="true"]',
  style: {
    "border-style": "dashed",
    "font-style": "italic",
  },
},
// CONSUMES_PROCESS_MATERIAL edges — dashed
{
  selector: 'edge[edge_type="CONSUMES_PROCESS_MATERIAL"]',
  style: {
    "line-style": "dashed",
    "line-color": "#a855f7",
    "target-arrow-color": "#a855f7",
  },
},
```

- [ ] **Step 3: Update NodeDetail to show dependency type**

In the NodeDetail panel (or wherever material details are shown), add a badge:
```tsx
{node.dependency_type === "process_consumable" && (
  <span className="badge badge-pc">Process Consumable</span>
)}
{node.extraction_provenance === "judge_addition" && (
  <span className="badge badge-judge">Judge Addition</span>
)}
```

- [ ] **Step 4: Commit**

```bash
cd ~/git/stdn-explorer
git add frontend/src/components/StdnGraph.tsx frontend/src/components/NodeDetail.tsx
git commit -m "feat: purple nodes and dashed edges for process consumables in graph"
```

---

### Task 6: Update Analytical Views

**Files:**
- Modify: `~/git/stdn-explorer/frontend/src/components/ConcentrationHeatmap.tsx`
- Modify: `~/git/stdn-explorer/frontend/src/components/CountryExposure.tsx`
- Modify: `~/git/stdn-explorer/frontend/src/components/CrossTechOverlap.tsx`
- Modify: `~/git/stdn-explorer/frontend/src/components/DisruptionSimulator.tsx`

All four views need the same two changes:
1. Accept `includePC` prop and append `?include_process_consumables=false` to API path when off
2. Show a "PC" badge next to process consumable materials in tables

- [ ] **Step 1: Update ConcentrationHeatmap**

Add `includePC` prop. Build API path with toggle param. In the cell/row render, add:
```tsx
{entry.dependency_type === "process_consumable" && (
  <span className="badge-pc-small" title="Process Consumable">PC</span>
)}
```

- [ ] **Step 2: Update CountryExposure**

Same pattern — `includePC` prop, API path, "PC" badge on `dominated_materials` entries.

- [ ] **Step 3: Update CrossTechOverlap**

Same pattern — `includePC` prop, API path, "PC" badge on material overlap entries.

- [ ] **Step 4: Update DisruptionSimulator**

Same pattern — `includePC` prop, API path, "PC" badge on affected materials.

- [ ] **Step 5: Add shared CSS for PC badge**

In `App.css`:
```css
.badge-pc-small {
  display: inline-block;
  background: #a855f7;
  color: white;
  font-size: 0.6rem;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  margin-left: 0.3rem;
  vertical-align: middle;
  font-weight: 600;
}
.badge-pc {
  display: inline-block;
  background: #a855f7;
  color: white;
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  margin-left: 0.4rem;
  font-weight: 600;
}
.badge-judge {
  display: inline-block;
  background: #6366f1;
  color: white;
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  margin-left: 0.4rem;
  font-weight: 600;
}
```

- [ ] **Step 6: Commit**

```bash
cd ~/git/stdn-explorer
git add frontend/src/components/ConcentrationHeatmap.tsx \
        frontend/src/components/CountryExposure.tsx \
        frontend/src/components/CrossTechOverlap.tsx \
        frontend/src/components/DisruptionSimulator.tsx \
        frontend/src/App.css
git commit -m "feat: add dependency_type badges to all analytical views"
```

---

### Task 7: Smoke Test

- [ ] **Step 1: Start backend**

```bash
cd ~/git/stdn-explorer/backend && uvicorn main:app --port 8080
```

- [ ] **Step 2: Start frontend**

```bash
cd ~/git/stdn-explorer/frontend && npm run dev
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:5173`. Check:
- [ ] Graph view shows purple nodes for process consumables, dashed edges
- [ ] `[Assembly]` synthetic node appears with dashed border
- [ ] Toggle hides/shows process consumables across all views
- [ ] Concentration heatmap shows "PC" badges
- [ ] Disruption simulator includes process consumable materials in severity
- [ ] Node detail shows "Process Consumable" badge

- [ ] **Step 4: Commit any fixes**

```bash
cd ~/git/stdn-explorer
git add -A
git commit -m "fix: smoke test fixes for process consumables"
```
