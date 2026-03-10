# STDN Explorer

Interactive dashboard for exploring **Shallow Technology Dependency Networks** (STDNs) — 4-layer directed acyclic graphs that map how technologies depend on components, raw materials, and producing countries.

Built as a companion tool for the research paper: *"From Technologies to Vulnerabilities: Multi-Agent Construction of Shallow Technology Dependency Networks for Supply Chain Risk Analysis"* (SIGIR 2026).

## What is an STDN?

An STDN captures the supply chain structure of a technology as a 4-layer DAG:

```
Technology → Components → Materials → Countries
```

For example, a **Smartphone** depends on a *Display Module*, which requires *Indium* (for ITO transparent conductors), which is primarily produced by *China* (57%), *South Korea* (15%), and *Japan* (10%).

The dataset covers **24 technologies**, **72 components**, **51 materials**, and **55 countries** across 3,560 supply chain links — spanning consumer electronics, defense systems, medical devices, pharmaceutical equipment, and renewable energy.

## Dashboard Views

### Explore
Interactive graph visualization (Cytoscape.js) showing the full 4-layer dependency network for a selected technology. Click nodes to inspect connected edges, material shares, and data provenance (USGS vs. LLM-estimated).

### Concentration
Heatmap of Herfindahl-Hirschman Index (HHI) scores for each material-technology pair. Higher HHI means production is concentrated in fewer countries — a supply chain risk signal. Click rows/columns to cross-highlight.

### Dominance
Country-level analysis showing which nations dominate material production. Ranks countries by number of materials where they are the top global producer, with detail panels showing dominated materials and market shares.

### Overlap
Cross-technology systemic risk view. Identifies materials and countries shared across multiple technologies — single points of failure that could cascade across sectors if disrupted.

### Disruption
"What if" simulator. Select a country to disrupt and see per-technology severity assessments (Critical/High/Moderate/Low), affected materials, and maximum share lost.

## Getting Started

### Prerequisites

- Python 3.11+ with [uv](https://docs.astral.sh/uv/)
- Node.js 18+

### Backend

```bash
cd backend
uv sync
uv run uvicorn main:app --port 8000
```

The API serves at `http://localhost:8000`. Key endpoints:

| Endpoint | Description |
|---|---|
| `GET /api/technologies` | List all technologies |
| `GET /api/stdn/{technology}` | Graph data (nodes + edges) for Cytoscape.js |
| `GET /api/concentration` | HHI scores per material-technology pair |
| `GET /api/country-exposure` | Country dominance summary |
| `GET /api/overlap` | Cross-technology material/country overlap |
| `GET /api/disruption/{country}` | Disruption simulation for a country |

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens at `http://localhost:5173`.

## Project Structure

```
stdn-explorer/
├── backend/
│   ├── main.py              # FastAPI app with all endpoints
│   └── pyproject.toml
├── frontend/
│   └── src/
│       ├── App.tsx           # Tab navigation (5 views)
│       ├── App.css           # Dark theme styles
│       ├── components/
│       │   ├── StdnGraph.tsx           # Cytoscape.js graph view
│       │   ├── ConcentrationHeatmap.tsx # HHI heatmap
│       │   ├── CountryExposure.tsx      # Country dominance table
│       │   ├── CrossTechOverlap.tsx     # Systemic risk overlap
│       │   ├── DisruptionSimulator.tsx  # What-if simulator
│       │   ├── NodeDetail.tsx           # Graph node detail panel
│       │   └── TechSelector.tsx         # Technology dropdown
│       └── hooks/
│           └── useApi.ts     # Generic fetch hook
└── data/
    └── stdn_seed.csv         # 3,560 supply chain links
```

## Data

The seed dataset (`data/stdn_seed.csv`) was constructed by a multi-agent AI pipeline that:

1. **Decomposes** technologies into procurable components (with confidence scores)
2. **Identifies** raw materials required by each component (with HS codes)
3. **Maps** materials to producing countries using USGS Mineral Commodity Summaries where available, falling back to LLM estimation

Each row includes confidence scores and reasoning chains for auditability. The `provenance` field distinguishes USGS-grounded data from LLM estimates.

## Tech Stack

- **Backend**: FastAPI + Pandas
- **Frontend**: React 19 + TypeScript + Vite
- **Visualization**: Cytoscape.js (graph), custom CSS (heatmap/tables)
- **Theme**: Dark mode with indigo accent

## License

MIT
