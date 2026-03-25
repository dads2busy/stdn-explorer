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


if __name__ == "__main__":
    main()
