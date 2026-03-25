# Domain Selector — Design Spec

## Problem

STDN-Explorer currently loads a single CSV dataset. We now have three domains — Microelectronics (60 technologies), Biotechnology (60 technologies), and Pharmaceuticals (60 technologies) — and need a way to switch between them in the explorer.

## Decision Summary

| Decision | Choice | Rationale |
|---|---|---|
| Data storage | Three separate CSVs in `data/` | Clean separation, each domain independently updatable |
| Backend filtering | `domain` query parameter on all endpoints | Consistent pattern, supports local dev |
| Static export | Per-domain directories under `api/` | Frontend switches by path prefix |
| Default domain | Microelectronics | Existing primary use case |
| "All Domains" option | Yes, but not default | Useful for cross-domain analysis |

## Data Layer

### CSV Files

Replace `data/stdn_seed.csv` with three files:
- `data/microelectronics.csv`
- `data/biotechnology.csv`
- `data/pharmaceuticals.csv`

Source: `dpi_stdn_agentic/data/explorer/`.

### Backend Loading

At startup, load all three CSVs and add a `domain` column to each:

```python
DOMAINS = {
    "microelectronics": "data/microelectronics.csv",
    "biotechnology": "data/biotechnology.csv",
    "pharmaceuticals": "data/pharmaceuticals.csv",
}
```

Run `_load_data()` on each, concatenate into `DF_ALL` with the domain column. Build per-domain and combined DataFrames/graphs:

```python
DF_DOMAINS = {name: _load_data(path, domain=name) for name, path in DOMAINS.items()}
DF_DOMAINS["all"] = pd.concat(DF_DOMAINS.values(), ignore_index=True)
```

Same pattern for graphs: `G_DOMAINS`, `METRICS_DOMAINS` — one per domain plus "all". The existing `include_process_consumables` toggle applies within each domain.

### Backend Endpoints

All endpoints gain a `domain: str = "microelectronics"` query parameter. Each endpoint selects the appropriate DataFrame/graph based on domain, then applies the existing `include_process_consumables` filter within that.

Helper:

```python
def _get_df(domain: str = "microelectronics", include_process_consumables: bool = True) -> pd.DataFrame:
    df = DF_DOMAINS.get(domain, DF_DOMAINS["microelectronics"])
    if not include_process_consumables:
        df = df[df["dependency_type"] == "constituent"]
    return df
```

The `/api/graph-context` endpoint always uses the "all" domain (full graph for LLM context).

## Static Export

### Directory Structure

`export_static.py` exports each domain separately:

```
frontend/public/api/
  microelectronics/
    technologies.json
    concentration.json
    country-exposure.json
    overlap.json
    countries.json
    graph_context.json
    stdn/{technology}.json
    stdn/{technology}_table.json
    country/{country}.json
    disruption/{country}.json
  biotechnology/
    ... (same structure)
  pharmaceuticals/
    ... (same structure)
  all/
    ... (same structure)
```

The script iterates over all four domain keys and exports each.

## Frontend

### Domain Selector UI

A dropdown in the header, above the tab navigation:

```tsx
<select value={domain} onChange={(e) => setDomain(e.target.value)}>
  <option value="microelectronics">Microelectronics</option>
  <option value="biotechnology">Biotechnology</option>
  <option value="pharmaceuticals">Pharmaceuticals</option>
  <option value="all">All Domains</option>
</select>
```

Default: `"microelectronics"`.

### API Path Routing

Rewrite `useApi.ts` to handle domain-aware paths. The current `staticPath()` function is replaced by a domain-aware version. Components pass the domain to useApi, which builds the correct URL for both modes.

**Approach**: Modify `staticPath()` to accept a domain and insert it as a path prefix. Modify `useApi` and `apiUrl` to accept an optional domain parameter. This avoids changing every component's path construction — components continue building paths like `/api/technologies` and the domain is injected by the hook.

```typescript
function staticPath(path: string, domain: string): string {
  // /api/stdn/Smartphone -> api/{domain}/stdn/Smartphone.json
  let p = path.startsWith("/") ? path.slice(1) : path;
  // Strip query params (not used in static mode)
  p = p.replace(/\?.*$/, "");
  p = p.replace(/\/table$/, "_table");
  // Insert domain after "api/"
  p = p.replace(/^api\//, `api/${domain}/`);
  return `${p}.json`;
}

export function useApi<T>(path: string | null, domain: string = "microelectronics") {
  // ... existing logic, but:
  // Live mode: append ?domain={domain} (and any existing query params)
  // Static mode: use staticPath(path, domain)
}

export function apiUrl(path: string, domain: string = "microelectronics"): string {
  // Same domain-aware logic for manual fetches (used by DisruptionSimulator, PolicyAnalyst)
}
```

**Merging `domain` with existing query params**: In live mode, components currently append `?include_process_consumables=false` via `pcParam`. With domain, the hook appends `domain=X` as an additional query param. Components continue building `pcParam` as before; the hook adds `domain`.

Alternatively, components can pass both `domain` and `includePC` and let `useApi` build the full query string:

```typescript
export function useApi<T>(
  path: string | null,
  domain: string = "microelectronics",
  includePC: boolean = true,
) {
  // Build URL with both params in live mode
  // In static mode, ignore includePC (always full data)
}
```

This is cleaner — removes the `pcParam` construction from every component. The hook handles it.

### Graph Context Endpoint

The `/api/graph-context` endpoint always uses the full cross-domain graph. The existing module-level `G` and `GRAPH_METRICS` globals are re-aliased to `G_DOMAINS["all"]` and `METRICS_DOMAINS["all"]` after multi-domain loading. The `_extract_entities()` and `_extract_subgraph()` functions continue using these globals unchanged.

### Static Export Policy

Static mode always exports with `include_process_consumables=True` (full data). The PC toggle is hidden in static mode (existing behavior). No per-domain `includePC=false` variants are needed — this matches the current single-domain behavior.

### State Management

`domain` state lives in `App.tsx` alongside `includePC`. Passed to all view components (including `PolicyAnalyst`, which makes multiple API calls via `apiUrl()` and needs domain threading). When domain changes, all views refetch and technology selection resets to null (technologies differ per domain).

### CSS

Style the domain selector to be visually prominent but not cluttered. Place it in the header area, left-aligned, before the subtitle.

## Files Modified

| File | Change |
|---|---|
| `data/microelectronics.csv` | New file (replaces stdn_seed.csv) |
| `data/biotechnology.csv` | New file |
| `data/pharmaceuticals.csv` | New file |
| `data/stdn_seed.csv` | Removed |
| `backend/main.py` | Multi-domain loading, `domain` param on all endpoints, per-domain graphs/metrics, `G`/`GRAPH_METRICS` aliased to "all" domain |
| `frontend/src/App.tsx` | `domain` state, selector UI, pass domain to all components including PolicyAnalyst |
| `frontend/src/App.css` | Domain selector styling |
| `frontend/src/hooks/useApi.ts` | Rewrite `staticPath()`, `useApi`, and `apiUrl` to accept domain param; optionally absorb `includePC` param construction |
| `frontend/src/components/StdnGraph.tsx` | Accept `domain` prop, pass to useApi |
| `frontend/src/components/TechSelector.tsx` | Accept `domain` prop, pass to useApi |
| `frontend/src/components/ConcentrationHeatmap.tsx` | Accept `domain` prop, pass to useApi |
| `frontend/src/components/CountryExposure.tsx` | Accept `domain` prop, pass to useApi |
| `frontend/src/components/CrossTechOverlap.tsx` | Accept `domain` prop, pass to useApi |
| `frontend/src/components/DisruptionSimulator.tsx` | Accept `domain` prop, pass to useApi and apiUrl |
| `frontend/src/components/PolicyAnalyst.tsx` | Accept `domain` prop, thread through all apiUrl/useApi calls |
| `scripts/export_static.py` | Per-domain export loop across all four domain keys |
