"""Export all API responses as static JSON files for GitHub Pages deployment."""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from main import (
    G,
    GRAPH_METRICS,
    _clean,
    get_concentration,
    get_country_exposure,
    get_country_exposure_summary,
    get_cross_tech_overlap,
    get_stdn,
    get_stdn_table,
    list_countries,
    list_technologies,
    simulate_disruption,
)

OUT = Path(__file__).resolve().parent.parent / "frontend" / "public" / "api"


def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False))
    print(f"  {path.relative_to(OUT.parent.parent)}")


def export_full_graph():
    """Export the full knowledge graph as nodes + edges for client-side queries."""
    nodes = {}
    for node_id, attrs in G.nodes(data=True):
        nodes[node_id] = {
            **{k: v for k, v in attrs.items()},
            "pagerank": round(GRAPH_METRICS["pagerank"].get(node_id, 0.0), 6),
            "in_degree": GRAPH_METRICS["in_degree"].get(node_id, 0),
        }
    edges = []
    for src, tgt, edge_attrs in G.edges(data=True):
        edges.append({"source": src, "target": tgt, **edge_attrs})
    return _clean({"nodes": nodes, "edges": edges})


def main():
    print("Exporting static API data...")

    # Simple endpoints
    write_json(OUT / "technologies.json", list_technologies())
    write_json(OUT / "concentration.json", get_concentration())
    write_json(OUT / "country-exposure.json", get_country_exposure_summary())
    write_json(OUT / "overlap.json", get_cross_tech_overlap())
    write_json(OUT / "countries.json", list_countries())
    write_json(OUT / "graph_context.json", export_full_graph())

    # Per-technology endpoints
    techs = list_technologies()["technologies"]
    for tech in techs:
        write_json(OUT / "stdn" / f"{tech}.json", get_stdn(tech))
        write_json(OUT / "stdn" / f"{tech}_table.json", get_stdn_table(tech))

    # Per-country endpoints
    countries = list_countries()["countries"]
    for c in countries:
        name = c["country"]
        write_json(OUT / "country" / f"{name}.json", get_country_exposure(name))
        write_json(OUT / "disruption" / f"{name}.json", simulate_disruption(name))

    print(f"\nDone. {len(techs)} technologies, {len(countries)} countries exported.")


if __name__ == "__main__":
    main()
