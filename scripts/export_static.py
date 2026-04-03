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
    get_material_stdn,
    get_stdn,
    get_stdn_table,
    list_countries,
    list_materials,
    list_technologies,
    simulate_disruption,
)
from comtrade import load_comtrade, disruption_heatmap, substitutability

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


def export_domain(domain: str, include_pc: bool):
    """Export all endpoints for a domain with the given PC setting."""
    pc_label = "with PC" if include_pc else "without PC"
    print(f"\n--- Domain: {domain} ({pc_label}) ---")
    domain_out = OUT / domain
    if not include_pc:
        domain_out = domain_out / "no-pc"

    # Simple endpoints
    write_json(domain_out / "technologies.json",
               list_technologies(domain=domain, include_process_consumables=include_pc))
    write_json(domain_out / "concentration.json",
               get_concentration(domain=domain, include_process_consumables=include_pc))
    write_json(domain_out / "country-exposure.json",
               get_country_exposure_summary(domain=domain, include_process_consumables=include_pc))
    write_json(domain_out / "overlap.json",
               get_cross_tech_overlap(domain=domain, include_process_consumables=include_pc))
    write_json(domain_out / "countries.json",
               list_countries(domain=domain, include_process_consumables=include_pc))

    # Graph context uses the full cross-domain graph regardless of domain.
    # Export under every domain directory so staticPath() resolves correctly.
    write_json(domain_out / "graph_context.json", export_full_graph())

    # Per-technology endpoints
    techs = list_technologies(domain=domain, include_process_consumables=include_pc)["technologies"]
    for tech in techs:
        write_json(domain_out / "stdn" / f"{tech}.json",
                   get_stdn(tech, domain=domain, include_process_consumables=include_pc))
        write_json(domain_out / "stdn" / f"{tech}_table.json",
                   get_stdn_table(tech, domain=domain, include_process_consumables=include_pc))

    # Per-country endpoints
    countries = list_countries(domain=domain, include_process_consumables=include_pc)["countries"]
    for c in countries:
        name = c["country"]
        write_json(domain_out / "country" / f"{name}.json",
                   get_country_exposure(name, domain=domain, include_process_consumables=include_pc))
        write_json(domain_out / "disruption" / f"{name}.json",
                   simulate_disruption(name, domain=domain, include_process_consumables=include_pc))

    print(f"  {len(techs)} technologies, {len(countries)} countries exported for {domain} ({pc_label})")


def export_materials(include_pc: bool):
    """Export material-centric endpoints (always cross-domain)."""
    pc_label = "with PC" if include_pc else "without PC"
    print(f"\n--- Materials ({pc_label}) ---")
    domain_out = OUT / "all"
    if not include_pc:
        domain_out = domain_out / "no-pc"

    mats = list_materials(domain="all", include_process_consumables=include_pc)
    write_json(domain_out / "materials.json", mats)

    for m in mats["materials"]:
        name = m["material"]
        write_json(domain_out / "material-stdn" / f"{name}.json",
                   get_material_stdn(name, include_process_consumables=include_pc))

    print(f"  {len(mats['materials'])} materials exported ({pc_label})")


def export_comtrade():
    """Export Comtrade endpoints as static JSON.

    Comtrade data is domain-independent, but staticPath() inserts the domain,
    so we write the same files under every domain directory.
    """
    df = load_comtrade()
    if df is None:
        print("\n--- Comtrade: no data, skipping ---")
        return

    print("\n--- Comtrade ---")

    materials = sorted(df["material"].unique().tolist())
    years = sorted(df["year"].unique().tolist())
    overview = {"available": True, "materials": materials, "years": years}

    # Pre-compute disruption for all k values into a combined dict
    disruption_all = {}
    for k in [1, 2, 3]:
        disruption_all[k] = disruption_heatmap(k)

    sub_data = substitutability()

    # Write under every domain + PC combination so staticPath resolves
    for domain in EXPORT_DOMAINS:
        for include_pc in [True, False]:
            domain_out = OUT / domain
            if not include_pc:
                domain_out = domain_out / "no-pc"
            ct = domain_out / "comtrade"
            write_json(ct / "overview.json", overview)
            write_json(ct / "substitutability.json", sub_data)
            # One file per k value
            for k in [1, 2, 3]:
                write_json(ct / f"disruption_k{k}.json", disruption_all[k])


def main():
    print("Exporting static API data...")

    for include_pc in [True, False]:
        for domain in EXPORT_DOMAINS:
            export_domain(domain, include_pc)
        export_materials(include_pc)

    export_comtrade()

    print("\nDone.")


if __name__ == "__main__":
    main()
