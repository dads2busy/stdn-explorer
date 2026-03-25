# Domain Selector — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a domain selector to STDN-Explorer so users can switch between Microelectronics, Biotechnology, Pharmaceuticals, and All Domains.

**Architecture:** Backend loads three CSVs and builds per-domain DataFrames/graphs. All endpoints accept a `domain` param. Frontend adds a domain dropdown in the header. `useApi` hook is rewritten to inject domain into paths. Static export generates per-domain directories.

**Tech Stack:** Python/FastAPI/Pandas/NetworkX (backend), React/TypeScript (frontend)

**Spec:** `docs/superpowers/specs/2026-03-25-domain-selector-design.md`

**Code repo:** `~/git/stdn-explorer`

---

## File Map

### New files

| File | Purpose |
|---|---|
| `data/microelectronics.csv` | Microelectronics domain data (replaces stdn_seed.csv) |
| `data/biotechnology.csv` | Biotechnology domain data |
| `data/pharmaceuticals.csv` | Pharmaceuticals domain data |

### Modified files

| File | What changes |
|---|---|
| `backend/main.py` | Multi-domain loading, `domain` param on all endpoints, per-domain graphs/metrics |
| `frontend/src/hooks/useApi.ts` | Rewrite to accept `domain` and `includePC` params, handle both live and static URL building |
| `frontend/src/App.tsx` | Add `domain` state, domain selector UI, pass `domain` to all components |
| `frontend/src/App.css` | Domain selector styling |
| `frontend/src/components/TechSelector.tsx` | Accept `domain` prop, pass to `useApi` |
| `frontend/src/components/StdnGraph.tsx` | Accept `domain` prop, pass to `useApi` |
| `frontend/src/components/ConcentrationHeatmap.tsx` | Accept `domain` prop, pass to `useApi` |
| `frontend/src/components/CountryExposure.tsx` | Accept `domain` prop, pass to `useApi` |
| `frontend/src/components/CrossTechOverlap.tsx` | Accept `domain` prop, pass to `useApi` |
| `frontend/src/components/DisruptionSimulator.tsx` | Accept `domain` prop, pass to `useApi` and `apiUrl` |
| `frontend/src/components/PolicyAnalyst.tsx` | Accept `domain` prop, thread through all `apiUrl`/`useApi` calls |
| `scripts/export_static.py` | Per-domain export loop |

### Removed files

| File | Reason |
|---|---|
| `data/stdn_seed.csv` | Replaced by three domain-specific CSVs |

---

## Task 1: Replace Seed Data with Domain CSVs

**Files:**
- Create: `data/microelectronics.csv`, `data/biotechnology.csv`, `data/pharmaceuticals.csv`
- Remove: `data/stdn_seed.csv`

- [ ] **Step 1: Copy domain CSVs**

```bash
cp ~/git/dpi_stdn_agentic/data/explorer/microelectronics_60techs.csv data/microelectronics.csv
cp ~/git/dpi_stdn_agentic/data/explorer/biotechnology_60techs.csv data/biotechnology.csv
cp ~/git/dpi_stdn_agentic/data/explorer/pharmaceuticals_60techs.csv data/pharmaceuticals.csv
```

- [ ] **Step 2: Remove old seed data**

```bash
rm data/stdn_seed.csv
```

- [ ] **Step 3: Commit**

```bash
git add data/microelectronics.csv data/biotechnology.csv data/pharmaceuticals.csv
git rm data/stdn_seed.csv
git commit -m "feat: replace stdn_seed.csv with three domain-specific CSVs"
```

---

## Task 2: Update Backend for Multi-Domain Loading

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Update `_load_data()` to accept a file path**

Change the function signature from `_load_data() -> pd.DataFrame` to `_load_data(csv_path: Path) -> pd.DataFrame`. Replace the hardcoded `DATA_DIR / "stdn_seed.csv"` with the `csv_path` parameter. The rest of the function stays the same.

- [ ] **Step 2: Replace single-DataFrame loading with multi-domain loading**

Replace the current initialization block:

```python
DF = _load_data()
DF_ALL = DF
DF_CONSTITUENT = DF[DF["dependency_type"] == "constituent"].copy()
```

With:

```python
DOMAIN_FILES = {
    "microelectronics": DATA_DIR / "microelectronics.csv",
    "biotechnology": DATA_DIR / "biotechnology.csv",
    "pharmaceuticals": DATA_DIR / "pharmaceuticals.csv",
}

DF_DOMAINS: dict[str, pd.DataFrame] = {}
for name, path in DOMAIN_FILES.items():
    DF_DOMAINS[name] = _load_data(path)

DF_DOMAINS["all"] = pd.concat(DF_DOMAINS.values(), ignore_index=True)
```

- [ ] **Step 3: Update `_get_df()` to accept domain**

Replace:

```python
def _get_df(include_process_consumables: bool = True) -> pd.DataFrame:
    return DF_ALL if include_process_consumables else DF_CONSTITUENT
```

With:

```python
def _get_df(domain: str = "microelectronics", include_process_consumables: bool = True) -> pd.DataFrame:
    df = DF_DOMAINS.get(domain, DF_DOMAINS["microelectronics"])
    if not include_process_consumables:
        df = df[df["dependency_type"] == "constituent"]
    return df
```

- [ ] **Step 4: Update graph building for multi-domain**

Replace the current graph initialization:

```python
G_ALL = _build_graph(DF_ALL)
METRICS_ALL = { ... }
G_CONSTITUENT = _build_graph(DF_CONSTITUENT)
METRICS_CONSTITUENT = { ... }
G = G_ALL
GRAPH_METRICS = METRICS_ALL

def _get_graph(include_process_consumables: bool = True):
    ...
```

With:

```python
G_DOMAINS: dict[str, nx.DiGraph] = {}
METRICS_DOMAINS: dict[str, dict] = {}
for name, df in DF_DOMAINS.items():
    G_DOMAINS[name] = _build_graph(df)
    METRICS_DOMAINS[name] = {
        "pagerank": nx.pagerank(G_DOMAINS[name]),
        "in_degree": dict(G_DOMAINS[name].in_degree()),
    }

# Default references for graph-context endpoint (always uses full graph)
G = G_DOMAINS["all"]
GRAPH_METRICS = METRICS_DOMAINS["all"]


def _get_graph(domain: str = "microelectronics", include_process_consumables: bool = True):
    g = G_DOMAINS.get(domain, G_DOMAINS["microelectronics"])
    m = METRICS_DOMAINS.get(domain, METRICS_DOMAINS["microelectronics"])
    if not include_process_consumables:
        # Build constituent-only subgraph on the fly (or pre-cache if perf matters)
        df = _get_df(domain, include_process_consumables=False)
        g = _build_graph(df)
        m = {"pagerank": nx.pagerank(g), "in_degree": dict(g.in_degree())}
    return g, m
```

Note: For simplicity, the constituent-only graph is built on-the-fly when requested. This is only used in live mode (the PC toggle is hidden in static mode). If performance is an issue, pre-cache constituent graphs per domain later.

- [ ] **Step 5: Update all endpoints to accept `domain` param**

Add `domain: str = "microelectronics"` parameter to every endpoint. Update `_get_df()` calls to pass `domain`. Example for `/api/technologies`:

```python
@app.get("/api/technologies")
def list_technologies(domain: str = "microelectronics", include_process_consumables: bool = True):
    df = _get_df(domain, include_process_consumables)
    techs = sorted(df["technology"].unique().tolist())
    return {"technologies": techs}
```

Apply the same pattern to: `/api/stdn/{technology}`, `/api/stdn/{technology}/table`, `/api/concentration`, `/api/country/{country}`, `/api/countries`, `/api/country-exposure`, `/api/overlap`, `/api/disruption/{country}`.

Leave `/api/graph-context` unchanged (always uses `G` which is `G_DOMAINS["all"]`).

- [ ] **Step 6: Verify backend starts**

```bash
cd backend && source .venv/bin/activate && timeout 15 uvicorn main:app --port 8080 2>&1 || true
```

Test:
```bash
curl -s "http://localhost:8080/api/technologies?domain=microelectronics" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['technologies']), 'techs')"
curl -s "http://localhost:8080/api/technologies?domain=biotechnology" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['technologies']), 'techs')"
curl -s "http://localhost:8080/api/technologies?domain=all" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['technologies']), 'techs')"
```

Expected: 60, 60, 180 (or close to 180 if some tech names overlap).

- [ ] **Step 7: Commit**

```bash
git add backend/main.py
git commit -m "feat: multi-domain backend with per-domain DataFrames and graphs"
```

---

## Task 3: Rewrite `useApi` Hook for Domain Support

**Files:**
- Modify: `frontend/src/hooks/useApi.ts`

- [ ] **Step 1: Rewrite `staticPath()` to accept domain**

```typescript
function staticPath(path: string, domain: string): string {
  let p = path.startsWith("/") ? path.slice(1) : path;
  // Strip query params (not used in static mode)
  p = p.replace(/\?.*$/, "");
  // Handle /table suffix
  p = p.replace(/\/table$/, "_table");
  // Insert domain after "api/"
  p = p.replace(/^api\//, `api/${domain}/`);
  return `${p}.json`;
}
```

- [ ] **Step 2: Rewrite `useApi` to accept domain and includePC**

```typescript
export function useApi<T>(
  path: string | null,
  domain: string = "microelectronics",
  includePC: boolean = true,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setData(null);
      return;
    }
    let url: string;
    if (IS_STATIC) {
      url = `${API_BASE}${staticPath(path, domain)}`;
    } else {
      // Build live URL: append domain and includePC as query params
      const sep = path.includes("?") ? "&" : "?";
      let fullPath = `${path}${sep}domain=${domain}`;
      if (!includePC) {
        fullPath += "&include_process_consumables=false";
      }
      url = `${API_BASE}${fullPath}`;
    }
    setLoading(true);
    setError(null);
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => setData(json))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [path, domain, includePC]);

  return { data, loading, error };
}
```

- [ ] **Step 3: Rewrite `apiUrl` to accept domain and includePC**

```typescript
export function apiUrl(
  path: string,
  domain: string = "microelectronics",
  includePC: boolean = true,
): string {
  if (IS_STATIC) {
    return `${API_BASE}${staticPath(path, domain)}`;
  }
  const sep = path.includes("?") ? "&" : "?";
  let fullPath = `${path}${sep}domain=${domain}`;
  if (!includePC) {
    fullPath += "&include_process_consumables=false";
  }
  return `${API_BASE}${fullPath}`;
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useApi.ts
git commit -m "feat: rewrite useApi hook with domain and includePC support"
```

---

## Task 4: Add Domain Selector to App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css`

- [ ] **Step 1: Add domain state**

After the existing `includePC` state (line 21), add:

```typescript
const [domain, setDomain] = useState("microelectronics");
```

- [ ] **Step 2: Reset technology when domain changes**

```typescript
useEffect(() => {
  setTechnology(null);
}, [domain]);
```

- [ ] **Step 3: Add domain selector UI in header**

Before the subtitle paragraph (line 61), add:

```tsx
<div className="domain-selector">
  <select value={domain} onChange={(e) => setDomain(e.target.value)}>
    <option value="microelectronics">Microelectronics</option>
    <option value="biotechnology">Biotechnology</option>
    <option value="pharmaceuticals">Pharmaceuticals</option>
    <option value="all">All Domains</option>
  </select>
</div>
```

- [ ] **Step 4: Pass `domain` to all view components**

Update every component to include `domain={domain}`. Remove the `pcParam` construction from components since `useApi` now handles it.

```tsx
<TechSelector selected={technology} onSelect={setTechnology} domain={domain} includePC={includePC} />
<StdnGraph technology={technology} domain={domain} includePC={includePC} onNavigate={handleNavigate} />
<ConcentrationHeatmap domain={domain} includePC={includePC} ... />
<CountryExposure domain={domain} includePC={includePC} ... />
<CrossTechOverlap domain={domain} includePC={includePC} ... />
<DisruptionSimulator domain={domain} includePC={includePC} />
<PolicyAnalyst domain={domain} />
```

- [ ] **Step 5: Add CSS for domain selector**

In `App.css`:

```css
.domain-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.domain-selector select {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.35rem 0.75rem;
  font-family: var(--font-body);
  font-size: 0.85rem;
  cursor: pointer;
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/App.css
git commit -m "feat: add domain selector dropdown in header"
```

---

## Task 5: Update All Frontend Components for Domain

**Files:**
- Modify: All components in `frontend/src/components/`

All components need the same two changes:
1. Accept `domain: string` prop
2. Pass `domain` and `includePC` to `useApi()` / `apiUrl()` calls instead of building `pcParam`

- [ ] **Step 1: Update TechSelector**

Add `domain: string` to Props. Change:
```typescript
const { data } = useApi<{ technologies: string[] }>(`/api/technologies${pcParam}`);
```
To:
```typescript
const { data } = useApi<{ technologies: string[] }>("/api/technologies", domain, includePC);
```

Remove `pcParam` construction.

- [ ] **Step 2: Update StdnGraph**

Add `domain: string` to Props. Change useApi calls:
```typescript
const { data } = useApi<GraphData>(`/api/stdn/${encodeURIComponent(technology)}`, domain, includePC);
const { data: overlapData } = useApi<...>("/api/overlap", domain, includePC);
```

Remove `pcParam` construction.

- [ ] **Step 3: Update ConcentrationHeatmap**

Add `domain: string` to props interface. Change useApi call:
```typescript
const { data } = useApi<ApiResponse>("/api/concentration", domain, includePC);
```

Remove `pcParam` construction.

- [ ] **Step 4: Update CountryExposure**

Same pattern — add `domain`, pass to `useApi`, remove `pcParam`.

- [ ] **Step 5: Update CrossTechOverlap**

Same pattern.

- [ ] **Step 6: Update DisruptionSimulator**

Add `domain` to props. Three changes:

1. Change the `useApi` call for countries from `` `/api/countries${pcParam}` `` to `"/api/countries"` and pass `domain, includePC` as args:
   ```typescript
   const { data: countriesData } = useApi<CountryListResponse>("/api/countries", domain, includePC);
   ```

2. Change the manual `fetch` in `runSimulation` to use domain-aware `apiUrl`:
   ```typescript
   const res = await fetch(apiUrl(`/api/disruption/${encodeURIComponent(country)}`, domain, includePC));
   ```

3. Remove the `pcParam` variable declaration entirely.

- [ ] **Step 7: Update PolicyAnalyst**

Add `domain` to props. The `PolicyAnalyst` uses `apiUrl(p)` inside `handleSubmitTemplate` where `p` comes from query templates. Update the `apiUrl` call to pass domain:

```typescript
const res = await fetch(apiUrl(p, domain));
```

Also update any `useApi` calls in the component to pass `domain`. PolicyAnalyst doesn't use `includePC` (always full data), so pass `true` for includePC where needed.

Also check `frontend/src/components/analyst/` subdirectory for any `apiUrl` or `useApi` calls that need domain threading — the query templates in `queryTemplates.ts` return path strings, and the domain is injected at the `apiUrl` call site, not in the templates themselves.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/TechSelector.tsx \
        frontend/src/components/StdnGraph.tsx \
        frontend/src/components/ConcentrationHeatmap.tsx \
        frontend/src/components/CountryExposure.tsx \
        frontend/src/components/CrossTechOverlap.tsx \
        frontend/src/components/DisruptionSimulator.tsx \
        frontend/src/components/PolicyAnalyst.tsx
git commit -m "feat: thread domain prop through all frontend components"
```

---

## Task 6: Update Static Export for Per-Domain Directories

**Files:**
- Modify: `scripts/export_static.py`

- [ ] **Step 1: Rewrite export to loop over domains**

Replace the current `main()` function with a per-domain export loop:

```python
EXPORT_DOMAINS = ["microelectronics", "biotechnology", "pharmaceuticals", "all"]

def main():
    print("Exporting static API data...")

    for domain in EXPORT_DOMAINS:
        print(f"\n--- Domain: {domain} ---")
        domain_out = OUT / domain

        # Simple endpoints
        write_json(domain_out / "technologies.json",
                   list_technologies(domain=domain, include_process_consumables=True))
        write_json(domain_out / "concentration.json",
                   get_concentration(domain=domain, include_process_consumables=True))
        write_json(domain_out / "country-exposure.json",
                   get_country_exposure_summary(domain=domain, include_process_consumables=True))
        write_json(domain_out / "overlap.json",
                   get_cross_tech_overlap(domain=domain, include_process_consumables=True))
        write_json(domain_out / "countries.json",
                   list_countries(domain=domain, include_process_consumables=True))

        # Graph context uses the full cross-domain graph regardless of domain.
        # Export under every domain directory so staticPath() resolves correctly.
        write_json(domain_out / "graph_context.json", export_full_graph())

        # Per-technology endpoints
        techs = list_technologies(domain=domain, include_process_consumables=True)["technologies"]
        for tech in techs:
            write_json(domain_out / "stdn" / f"{tech}.json",
                       get_stdn(tech, domain=domain, include_process_consumables=True))
            write_json(domain_out / "stdn" / f"{tech}_table.json",
                       get_stdn_table(tech, domain=domain, include_process_consumables=True))

        # Per-country endpoints
        countries = list_countries(domain=domain, include_process_consumables=True)["countries"]
        for c in countries:
            name = c["country"]
            write_json(domain_out / "country" / f"{name}.json",
                       get_country_exposure(name, domain=domain, include_process_consumables=True))
            write_json(domain_out / "disruption" / f"{name}.json",
                       simulate_disruption(name, domain=domain, include_process_consumables=True))

        print(f"  {len(techs)} technologies, {len(countries)} countries exported for {domain}")

    print("\nDone.")
```

- [ ] **Step 2: Update imports**

The import from `main` needs to match the updated function signatures (all now accept `domain` param).

- [ ] **Step 3: Test export**

```bash
cd ~/git/stdn-explorer
python scripts/export_static.py
ls frontend/public/api/microelectronics/
ls frontend/public/api/biotechnology/
ls frontend/public/api/all/
```

Expected: Each domain directory contains technologies.json, concentration.json, stdn/*.json, etc.

- [ ] **Step 4: Commit**

```bash
git add scripts/export_static.py
git commit -m "feat: per-domain static export"
```

---

## Task 7: Smoke Test

- [ ] **Step 1: Start backend**

```bash
cd backend && source .venv/bin/activate && uvicorn main:app --port 8080
```

- [ ] **Step 2: Start frontend**

```bash
cd frontend && npm run dev
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:5173`. Check:
- [ ] Domain selector shows in header with Microelectronics selected
- [ ] Switching to Biotechnology loads different technologies
- [ ] Switching to Pharmaceuticals loads different technologies
- [ ] Switching to All Domains shows all 180 technologies
- [ ] Technology selection resets when switching domains
- [ ] Process consumables toggle still works within each domain
- [ ] All tabs (Concentration, Dominance, Overlap, Disruption, Analyst) work per domain
- [ ] Graph view shows correct data for selected domain

- [ ] **Step 4: Commit any fixes**

```bash
git add -p
git commit -m "fix: smoke test fixes for domain selector"
```
