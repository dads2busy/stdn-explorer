# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

STDN Explorer is a supply chain dependency network (STDN) visualization and analysis dashboard. It maps technology → component → material → country supply chains across three domains (microelectronics, biotechnology, pharmaceuticals) using graph-based risk metrics.

## Commands

### Frontend (from `/frontend`)
```bash
npm run dev          # Vite dev server (localhost:5173)
npm run build        # TypeScript check + Vite production build
npm run lint         # ESLint
```

### Backend (from `/backend`)
```bash
uvicorn main:app --port 8080   # FastAPI dev server
```

### Static Export & Deploy
```bash
python scripts/export_static.py   # Pre-render all API endpoints as JSON to frontend/public/api/
# Deploy runs automatically via .github/workflows/deploy.yml on push to main
```

## Architecture

### Dual-mode API
The app runs in two modes controlled by `VITE_STATIC`:
- **Live mode** (dev): Frontend calls FastAPI backend at localhost:8080
- **Static mode** (GitHub Pages): `useApi` hook in `frontend/src/hooks/useApi.ts` rewrites API paths to pre-rendered JSON files under `frontend/public/api/`

The static export script (`scripts/export_static.py`) generates JSON for every combination of domain × process-consumables × endpoint.

### Backend (`/backend/main.py`)
Single-file FastAPI app (~900 lines). Data pipeline:
1. Load domain CSVs from `/data` into Pandas DataFrames
2. Normalize country names against VALID_COUNTRIES whitelist, normalize component/material casing
3. Build NetworkX directed graphs (4-layer: technology → component → material → country)
4. All API endpoints derive from graph queries + Pandas aggregations

Key query parameter pattern: most endpoints accept `domain` (microelectronics|biotechnology|pharmaceuticals|all) and `include_process_consumables` (bool).

### Frontend (`/frontend/src/`)
- **App.tsx**: Global state (view, domain, technology, highlighting), renders 9 tab views
- **components/**: One component per tab (StdnGraph, ConcentrationHeatmap, CountryExposure, CrossTechOverlap, DisruptionSimulator, TradeDisruption, PolicyAnalyst, etc.)
- **components/analyst/**: Template-based policy analysis with optional Gemini chat integration
- **hooks/useApi.ts**: Fetch wrapper handling live vs static mode
- **App.css**: Dark theme (~32KB), layer-specific color system (indigo=tech, green=component, amber=material, red=country)

### Graph Visualization
Uses Cytoscape.js via react-cytoscape. Nodes positioned in concentric rings by layer depth. Process consumables rendered as purple nodes with dashed edges.

### Risk Metrics
- **HHI (Herfindahl-Hirschman Index)**: Market concentration per material-technology pair. Thresholds: Low <1500, Medium ≥1500, High ≥2500, Extreme ≥5000
- **Disruption simulation**: Models country removal impact on supply chains
- **Comtrade metrics**: Trade flow disruption scores, substitutability (in `/data/comtrade/`)

## Data

CSV files in `/data/` with columns: technology, component, material, country, percentage, amount, dependency_type (constituent|process_consumable), extraction_provenance, hs_code, subdomain, confidence scores.

Process consumables at assembly level skip the component layer (technology → material directly).

## Key Patterns

- Cross-tab navigation: Components accept `onNavigate` callbacks to jump between views with context (e.g., click a material → open Concentration tab highlighting it)
- Domain changes reset technology selection
- Gemini API key is base64-encoded at build time via vite.config.ts to avoid secret scanning
- No test suite exists yet

## Supply Chain Knowledge Base

For broader context on supply chain intelligence work — materials, technologies, countries, policies, and how this project connects to related work — read the wiki index at:

~/git/personal-ai-wiki/index.md

Then read relevant wiki pages based on the current task. The wiki is maintained following the schema in ~/git/personal-ai-wiki/CLAUDE.md.
