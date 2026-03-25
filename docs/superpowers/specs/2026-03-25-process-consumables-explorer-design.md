# Process Consumables Support in STDN-Explorer — Design Spec

## Problem

STDN-Explorer currently only displays constituent materials (materials that physically become part of the product). The STDN-GEN pipeline now produces process consumables (materials consumed during manufacturing but not present in the final product, e.g., Helium, photoresist, etchants) at both the assembly level and component level. The explorer needs to display and analyze these alongside constituent materials.

## Decision Summary

| Decision | Choice | Rationale |
|---|---|---|
| Backward compatibility | Break it — 16-column CSV only | Simpler; old 14-column format is deprecated |
| Graph visualization | Same material layer, distinct styling + toggle | Keeps 4-layer layout readable; toggle for clean default |
| Analytical views | Unified with global filter toggle | Process consumables contribute to vulnerability analysis; toggle to isolate |
| API changes | Extend existing endpoints, no new endpoints | Less surface area; `include_process_consumables` query param for filtering |
| Assembly-level topology | Synthetic "[Assembly]" component node | Preserves strict 4-layer graph; avoids cross-ring edges |

## Data Layer

### CSV Schema (16 columns)

The backend accepts the new pipeline output with two additional columns:
- `dependency_type`: `"constituent"` or `"process_consumable"`
- `extraction_provenance`: `"extractor"`, `"judge_addition"`, or empty string (constituent rows)

In `_load_data()`:
- Fill missing `dependency_type` with `"constituent"` for robustness
- Fill missing `extraction_provenance` with empty string
- Validate that `dependency_type` contains only allowed values; log a warning for unexpected values
- Empty `component` fields on process consumable rows indicate assembly-level consumables

The seed data file (`data/stdn_seed.csv`) is replaced with the latest 16-column pipeline output.

## Graph Construction

### Assembly-Level Consumables: Synthetic Component Node

The existing graph assumes a strict 4-layer chain: `Technology → Component → Material → Country`. Assembly-level process consumables have no component, which would break this topology.

**Solution:** For assembly-level consumables (empty `component` field), create a synthetic component node `comp:[Assembly]` per technology. This node:
- Has `label: "[Assembly]"`, `node_type: "component"`, `confidence: null`
- Connects: `Technology → [Assembly] → Process Consumable Material → Country`
- Appears in the component ring with a distinct dashed border to indicate it's synthetic
- Is excluded from component counts in analytical views

This preserves the strict 4-layer layout and avoids cross-ring edges. The frontend can style `[Assembly]` differently (e.g., italic label, dashed border).

### Edge Types

Current: `HAS_COMPONENT`, `USES_MATERIAL`, `PRODUCED_IN`

Add: `CONSUMES_PROCESS_MATERIAL` — used for process consumable edges:
- Assembly-level: `[Assembly]` component → Process Consumable Material
- Component-level: Component → Process Consumable Material

### Edge Data Shape

Edges in the `/api/stdn/{tech}` response include an `edge_type` field:
```json
{
  "data": {
    "id": "comp:Die->mat:Helium",
    "source": "comp:Die",
    "target": "mat:Helium",
    "edge_type": "CONSUMES_PROCESS_MATERIAL",
    "confidence": 0.95
  }
}
```
Existing edges get `edge_type: "HAS_COMPONENT"`, `"USES_MATERIAL"`, or `"PRODUCED_IN"`.

### Node Attributes

**`dependency_type` is per-edge, not per-node**, because a material could be a constituent in one technology and a process consumable in another. The authoritative `dependency_type` is always on the edge (`USES_MATERIAL` vs `CONSUMES_PROCESS_MATERIAL`). Material nodes in the global graph do NOT carry `dependency_type` — this avoids nondeterministic "first-seen" behavior. In the per-technology subgraph returned by `/api/stdn/{tech}`, each material node does get a `dependency_type` attribute since its role is unambiguous within a single technology.

### HHI Computation

Unchanged — includes all materials regardless of dependency type. Supply chain concentration matters for both constituent and process consumable materials.

### Country Edges

Process consumable materials connect to country nodes via the same `PRODUCED_IN` edges as constituent materials. No change to country-layer handling.

## Filtering: Global Toggle Implementation

### Backend: Two Cached DataFrames

The backend pre-computes two DataFrames at startup:
- `DF_ALL`: Full dataset (all rows)
- `DF_CONSTITUENT`: Filtered to `dependency_type == "constituent"` only

And two corresponding graphs:
- `G_ALL` / `METRICS_ALL`: Full graph with all materials
- `G_CONSTITUENT` / `METRICS_CONSTITUENT`: Constituent-only graph

Each endpoint receives `include_process_consumables: bool = True` as a query parameter and selects the appropriate DataFrame/graph. No per-request graph rebuilding.

### Frontend: Toggle via Path Suffix

The `useApi` hook does not need a new query-parameter mechanism. Instead, the global toggle state is managed in `App.tsx` and passed down. Callers append the query string to the path:

```typescript
const path = `/api/stdn/${tech}${includePC ? "" : "?include_process_consumables=false"}`;
```

Since the path string changes, `useApi`'s `useEffect` dependency triggers a refetch automatically.

### Static Export

`scripts/export_static.py` exports **one set of files** with all data (process consumables included). In static mode, the toggle is hidden or disabled — the full dataset is always shown. This avoids doubling the number of exported JSON files.

## API Changes

No new endpoints. All existing endpoints are extended to include process consumable data.

### Per-Endpoint Changes

| Endpoint | Change |
|---|---|
| `/api/stdn/{tech}` | Nodes include `dependency_type`. Edges include `edge_type`. Synthetic `[Assembly]` component node for assembly-level consumables. |
| `/api/stdn/{tech}/table` | Rows include `dependency_type` and `extraction_provenance` columns. |
| `/api/concentration` | Entries include `dependency_type` field. |
| `/api/country-exposure` | Counts include both types. `dominated_materials` entries carry `dependency_type`. |
| `/api/overlap` | `material_overlap` entries carry `dependency_type`. |
| `/api/disruption/{country}` | Affected materials carry `dependency_type`. Severity includes both types. |
| `/api/graph-context` | Triples include dependency type context. Exempt from toggle (always uses full graph for LLM context). |

## Frontend Changes

### Global Toggle

A switch in the App header: "Include Process Consumables" (default: on). Modifies API paths to append `?include_process_consumables=false` when off. When toggled, all views refetch via path change.

In static mode (`VITE_STATIC=true`), the toggle is hidden — full data always shown.

### StdnGraph

- Process consumable material nodes: **purple** color (`#a855f7`) vs amber for constituent, slightly smaller size
- `CONSUMES_PROCESS_MATERIAL` edges: **dashed** line style
- `[Assembly]` synthetic component node: italic label, dashed border
- Component-level consumables connect from their Component node; assembly-level connect from `[Assembly]`
- NodeDetail panel: "Process Consumable" badge, shows `extraction_provenance` when applicable

### ConcentrationHeatmap

- Process consumable materials show a small "PC" badge to distinguish from constituent
- Same HHI coloring, sorting, and interaction behavior

### DisruptionSimulator

- Affected materials list shows `dependency_type` badge per material
- Severity calculation includes both types equally

### CrossTechOverlap

- `dependency_type` badge on materials in overlap table

### CountryExposure

- `dependency_type` badge on dominated materials list

### PolicyAnalyst

- Analysis generators receive richer data (both material types) — no structural change to templates

## Data Replacement

Replace `data/stdn_seed.csv` with the latest 16-column normalized pipeline output.

In static mode, `scripts/export_static.py` generates one set of JSON files from the full dataset (process consumables always included).
