from __future__ import annotations

import logging
import math
from pathlib import Path

import networkx as nx
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="STDN Explorer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _load_data(csv_path: Path) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    # Normalize country names to title case
    df["country"] = df["country"].str.strip().str.title()
    df["country"] = df["country"].replace({
        "Other": "Other Countries",
        "Us": "United States",
        "Usa": "United States",
        "Korea, Republic Of": "South Korea",
        "Burma": "Myanmar",
        "Congo": "Congo (Kinshasa)",
    })
    # Keep only valid country names — filter out LLM hallucinations
    VALID_COUNTRIES = {
        "Afghanistan", "Albania", "Algeria", "Angola", "Argentina", "Armenia",
        "Australia", "Austria", "Azerbaijan", "Bahrain", "Bangladesh", "Belarus",
        "Belgium", "Bolivia", "Bosnia And Herzegovina", "Botswana", "Brazil",
        "Brunei", "Bulgaria", "Burkina Faso", "Cambodia", "Cameroon", "Canada",
        "Central African Republic", "Chad", "Chile", "China", "Colombia",
        "Congo (Kinshasa)", "Costa Rica", "Croatia", "Cuba", "Cyprus",
        "Czech Republic", "Denmark", "Dominican Republic", "Ecuador", "Egypt",
        "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Ethiopia",
        "European Union", "Fiji", "Finland", "France", "Gabon", "Georgia",
        "Germany", "Ghana", "Greece", "Guatemala", "Guinea", "Guyana", "Haiti",
        "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq",
        "Ireland", "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan",
        "Jordan", "Kazakhstan", "Kenya", "Korea, North", "Kuwait", "Kyrgyzstan",
        "Laos", "Latvia", "Lebanon", "Libya", "Lithuania", "Luxembourg",
        "Madagascar", "Malawi", "Malaysia", "Mali", "Mauritania", "Mexico",
        "Moldova", "Mongolia", "Morocco", "Mozambique", "Myanmar",
        "Namibia", "Nepal", "Netherlands", "New Caledonia", "New Zealand",
        "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia",
        "Norway", "Oman", "Other Countries", "Pakistan", "Panama",
        "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland",
        "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saudi Arabia",
        "Senegal", "Serbia", "Sierra Leone", "Singapore", "Slovakia",
        "Slovenia", "South Africa", "South Korea", "Spain", "Sri Lanka",
        "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan",
        "Tajikistan", "Tanzania", "Thailand", "Trinidad And Tobago", "Tunisia",
        "Turkey", "Turkmenistan", "Uganda", "Ukraine", "United Arab Emirates",
        "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Venezuela",
        "Vietnam", "Yemen", "Zambia", "Zimbabwe",
    }
    df = df[df["country"].isin(VALID_COUNTRIES)]
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
        logging.warning(f"Unexpected dependency_type values: {invalid.tolist()}")
    # For assembly-level process consumables, fill empty component
    df["component"] = df["component"].fillna("")
    # Normalize component name casing (e.g. "Lithium-Ion Battery" vs "Lithium-ion Battery")
    df["component"] = df["component"].str.strip()
    comp_canonical: dict[str, str] = {}
    for comp in df["component"].unique():
        key = comp.lower()
        if key not in comp_canonical:
            comp_canonical[key] = comp
    df["component"] = df["component"].str.lower().map(comp_canonical)
    # Normalize process consumable material names: strip parenthetical qualifiers
    # e.g. "Helium (for leak testing)" and "Helium (purge gas)" → "Helium"
    pc_mask = df["dependency_type"] == "process_consumable"
    df.loc[pc_mask, "material"] = (
        df.loc[pc_mask, "material"]
        .str.replace(r"\s*\(.*\)\s*$", "", regex=True)
        .str.strip()
    )
    # Abbreviate long material names (> 50 chars) to their core material
    long_name_mappings = {
        "Clean dry air or nitrogen gas for environment purging": "Nitrogen",
        "Clean dry nitrogen or argon gas for winding environment control": "Nitrogen",
        "Process gases like silane, ammonia, phosphine, boron trifluoride": "Process gases",
        "Silane, Boron Trifluoride, Phosphine, Arsine, NF3, SF6": "Dopant gases",
        "Thermal Interface Materials (TIM) - Thermal grease or pads": "Thermal interface materials",
        "Thermal interface materials (TIMs) like thermal grease": "Thermal interface materials",
        "Thermal interface materials or heat transfer fluids": "Thermal interface materials",
        "Silicone-based grease or thermal interface material": "Thermal interface materials",
        "Thermal interface materials (greases, gels) consumed during assembly": "Thermal interface materials",
        "Added: Medical-grade tubing extruder dies maintenance lubricants": "Lubricants",
        "Added: Protective gloves and solvent-resistant wipes": "Protective consumables",
        "Aluminum or stainless steel surface treatment chemicals": "Surface treatment chemicals",
        "Grinding and polishing abrasives and cooling fluids": "Abrasives",
        "Painters' solvents and surface preparation chemicals": "Cleaning solvents",
        "Photomultiplier Tube (PMT) assembly solvents and cleaning agents": "Cleaning solvents",
        "Plastic injection molding lubricants and release agents": "Lubricants",
        "Added: Anti-static agents or ionized air consumables": "Anti-static agents",
        "Additional assembly-level consumable: Adhesives or epoxy used in assembly and encapsulation": "Adhesives",
        "Adhesives and tapes for electrical insulation and wiring harnesses": "Adhesives",
        "Compressed air or nitrogen gas for cleaning and dust removal": "Nitrogen",
        "Deionized water and steam for final system flushing and sterilization": "Deionized water",
        "Electric heating element lubricants or thermal pastes": "Thermal interface materials",
        "Filtered air or nitrogen for purge or sterile environment": "Nitrogen",
        "Isopropyl alcohol (IPA) and other cleaning solvents": "Cleaning solvents",
        "Process gases (Nitrogen, Argon) for welding and brazing": "Process gases",
        "Protective coatings and buffers application chemicals": "Protective coatings",
        "Rubber or polymer materials consumption during glove molding": "Rubber",
        "Sterilants such as ethylene oxide or peracetic acid": "Sterilants",
        "Sterile air or nitrogen for purge and environment control": "Nitrogen",
    }
    df["material"] = df["material"].replace(long_name_mappings)
    # Drop rows with missing material names
    df = df.dropna(subset=["material"])
    # Also normalize material casing across all rows
    mat_canonical: dict[str, str] = {}
    for mat in df["material"].unique():
        key = str(mat).lower()
        if key not in mat_canonical:
            mat_canonical[key] = mat
    df["material"] = df["material"].str.lower().map(mat_canonical)
    return df


DOMAIN_FILES = {
    "microelectronics": DATA_DIR / "microelectronics.csv",
    "biotechnology": DATA_DIR / "biotechnology.csv",
    "pharmaceuticals": DATA_DIR / "pharmaceuticals.csv",
}

DF_DOMAINS: dict[str, pd.DataFrame] = {}
for name, path in DOMAIN_FILES.items():
    DF_DOMAINS[name] = _load_data(path)

DF_DOMAINS["all"] = pd.concat(list(DF_DOMAINS.values()), ignore_index=True)


def _get_df(domain: str = "microelectronics", include_process_consumables: bool = True) -> pd.DataFrame:
    df = DF_DOMAINS.get(domain, DF_DOMAINS["microelectronics"])
    if not include_process_consumables:
        df = df[df["dependency_type"] == "constituent"]
    return df


# ---------------------------------------------------------------------------
# Knowledge graph
# ---------------------------------------------------------------------------


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
        mat_id = f"mat:{mat}"
        country_id = f"country:{country}"

        # Assembly-level process consumables: Tech → Material directly
        is_assembly_pc = dep_type == "process_consumable" and (not comp or comp.strip() == "")

        g.add_node(tech_id, label=tech, node_type="technology")
        g.add_node(mat_id, label=mat, node_type="material",
                   confidence=row["material_confidence"],
                   hhi=round(mat_hhi.get(mat, 0), 1))
        g.add_node(country_id, label=country, node_type="country")

        if is_assembly_pc:
            # Direct Tech -> Material edge (no component)
            if not g.has_edge(tech_id, mat_id):
                g.add_edge(tech_id, mat_id, rel="CONSUMES_PROCESS_MATERIAL",
                           edge_type="CONSUMES_PROCESS_MATERIAL",
                           confidence=row["material_confidence"])
        else:
            comp_id = f"comp:{comp}"
            g.add_node(comp_id, label=comp, node_type="component",
                       confidence=row["component_confidence"])

            # Tech -> Component edge
            if not g.has_edge(tech_id, comp_id):
                g.add_edge(tech_id, comp_id, rel="HAS_COMPONENT",
                           edge_type="HAS_COMPONENT",
                           confidence=row["component_confidence"])

            # Component -> Material edge
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


G_DOMAINS: dict[str, nx.DiGraph] = {}
METRICS_DOMAINS: dict[str, dict] = {}
for name, df in DF_DOMAINS.items():
    G_DOMAINS[name] = _build_graph(df)
    METRICS_DOMAINS[name] = {
        "pagerank": nx.pagerank(G_DOMAINS[name]),
        "in_degree": dict(G_DOMAINS[name].in_degree()),
    }

# Default references for graph-context endpoint (always uses full cross-domain graph)
G = G_DOMAINS["all"]
GRAPH_METRICS = METRICS_DOMAINS["all"]


def _get_graph(domain: str = "microelectronics", include_process_consumables: bool = True):
    g = G_DOMAINS.get(domain, G_DOMAINS["microelectronics"])
    m = METRICS_DOMAINS.get(domain, METRICS_DOMAINS["microelectronics"])
    if not include_process_consumables:
        df = _get_df(domain, include_process_consumables=False)
        g = _build_graph(df)
        m = {"pagerank": nx.pagerank(g), "in_degree": dict(g.in_degree())}
    return g, m


def _extract_entities(query_text: str) -> list[str]:
    """Find graph nodes whose label appears in the query (case-insensitive)."""
    q = query_text.lower()
    hits = []
    for node_id, attrs in G.nodes(data=True):
        label = attrs.get("label", "")
        if label and label.lower() in q:
            hits.append(node_id)
    return hits


def _extract_subgraph(seed_nodes: list[str], hops: int = 2) -> nx.DiGraph:
    """BFS both directions from seed nodes, returning the induced subgraph."""
    visited = set(seed_nodes)
    frontier = set(seed_nodes)
    for _ in range(hops):
        next_frontier: set[str] = set()
        for n in frontier:
            next_frontier.update(G.successors(n))
            next_frontier.update(G.predecessors(n))
        next_frontier -= visited
        visited.update(next_frontier)
        frontier = next_frontier
    return G.subgraph(visited).copy()


def _serialize_triples(subgraph: nx.DiGraph) -> list[dict]:
    """Serialize subgraph edges as (subject, rel, object, properties) triples."""
    triples = []
    for src, tgt, attrs in subgraph.edges(data=True):
        triples.append({
            "subject": subgraph.nodes[src].get("label", src),
            "subject_type": subgraph.nodes[src].get("node_type"),
            "rel": attrs.get("rel"),
            "object": subgraph.nodes[tgt].get("label", tgt),
            "object_type": subgraph.nodes[tgt].get("node_type"),
            "properties": {k: v for k, v in attrs.items() if k != "rel"},
        })
    return triples


def _clean(obj):
    """Replace NaN/inf with None for JSON serialization."""
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_clean(v) for v in obj]
    return obj


@app.get("/api/technologies")
def list_technologies(domain: str = "microelectronics", include_process_consumables: bool = True):
    df = _get_df(domain, include_process_consumables)
    techs = sorted(df["technology"].unique().tolist())
    return {"technologies": techs}


@app.get("/api/stdn/{technology}")
def get_stdn(technology: str, domain: str = "microelectronics", include_process_consumables: bool = True):
    """Return full STDN graph data for a technology."""
    df = _get_df(domain, include_process_consumables)
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

        is_assembly_pc = dep_type == "process_consumable" and (not comp or comp.strip() == "")

        mat_id = f"mat:{mat}"
        country_id = f"country:{country}"

        add_node(mat_id, mat, "material",
                 confidence=row["material_confidence"],
                 hs_code=row.get("hs_code"),
                 dependency_type=dep_type,
                 extraction_provenance=row.get("extraction_provenance", ""))
        add_node(country_id, country, "country")

        if is_assembly_pc:
            # Tech -> Material directly (no component)
            tm_id = f"{tech_id}->{mat_id}"
            if tm_id not in seen_nodes:
                seen_nodes.add(tm_id)
                edges.append({"data": {
                    "id": tm_id, "source": tech_id, "target": mat_id,
                    "edge_type": "CONSUMES_PROCESS_MATERIAL",
                    "confidence": row["material_confidence"],
                }})
        else:
            comp_id = f"comp:{comp}"
            add_node(comp_id, comp, "component",
                     confidence=row["component_confidence"])

            # Tech -> Component
            tc_id = f"{tech_id}->{comp_id}"
            if tc_id not in seen_nodes:
                seen_nodes.add(tc_id)
                edges.append({"data": {
                    "id": tc_id, "source": tech_id, "target": comp_id,
                    "edge_type": "HAS_COMPONENT",
                    "confidence": row["component_confidence"],
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


@app.get("/api/stdn/{technology}/table")
def get_stdn_table(technology: str, domain: str = "microelectronics", include_process_consumables: bool = True):
    df = _get_df(domain, include_process_consumables)
    subset = df[df["technology"] == technology]
    records = subset.to_dict(orient="records")
    return _clean({"rows": records, "count": len(records)})


@app.get("/api/concentration")
def get_concentration(domain: str = "microelectronics", include_process_consumables: bool = True):
    df = _get_df(domain, include_process_consumables)
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


@app.get("/api/country/{country}")
def get_country_exposure(country: str, domain: str = "microelectronics", include_process_consumables: bool = True):
    """Return all technologies/materials that depend on a given country."""
    df = _get_df(domain, include_process_consumables)
    subset = df[df["country"].str.lower() == country.lower()]
    if subset.empty:
        return {"country": country, "exposures": []}

    exposures = []
    for _, row in subset.iterrows():
        exposures.append({
            "technology": row["technology"],
            "component": row["component"],
            "material": row["material"],
            "percentage": row["percentage"],
            "provenance": "USGS" if row["amount"] > 0 else "LLM",
            "dependency_type": row.get("dependency_type", "constituent"),
        })
    exposures.sort(key=lambda x: x["percentage"], reverse=True)
    return _clean({"country": country, "exposures": exposures})


@app.get("/api/countries")
def list_countries(domain: str = "microelectronics", include_process_consumables: bool = True):
    """Return all countries with total exposure count."""
    df = _get_df(domain, include_process_consumables)
    counts = df.groupby("country").size().reset_index(name="count")
    counts = counts.sort_values("count", ascending=False)
    return {"countries": counts.to_dict(orient="records")}


@app.get("/api/country-exposure")
def get_country_exposure_summary(domain: str = "microelectronics", include_process_consumables: bool = True):
    """Return country-level supply chain exposure summary.

    For each country: how many technologies depend on it, how many materials
    it produces, which materials it dominates (top producer), and avg share.
    """
    # Exclude "Other Countries" aggregate
    df = _get_df(domain, include_process_consumables)
    df = df[df["country"] != "Other Countries"].copy()

    results = []
    for country, group in df.groupby("country"):
        techs = group["technology"].nunique()
        materials = group["material"].unique().tolist()
        avg_share = round(float(group["percentage"].mean()), 1)
        max_share = round(float(group["percentage"].max()), 1)

        # Materials where this country is the top producer
        dominated = []
        for mat, mat_group in group.groupby("material"):
            # Check across all technologies for this material
            all_producers = df[df["material"] == mat]
            top = all_producers.loc[all_producers["percentage"].idxmax()]
            if top["country"] == country:
                dep_type = df[df["material"] == mat].iloc[0].get("dependency_type", "constituent")
                dominated.append({"material": mat, "dependency_type": dep_type})

        # Top materials by share for this country
        top_materials = (
            group.groupby("material")["percentage"]
            .max()
            .sort_values(ascending=False)
            .head(5)
        )
        top_mats = [
            {"material": m, "share": round(float(s), 1)}
            for m, s in top_materials.items()
        ]

        results.append({
            "country": country,
            "num_technologies": techs,
            "num_materials": len(materials),
            "num_dominated": len(dominated),
            "dominated_materials": dominated,
            "avg_share": avg_share,
            "max_share": max_share,
            "top_materials": top_mats,
        })

    # Sort by number of dominated materials, then by num_technologies
    results.sort(key=lambda x: (x["num_dominated"], x["num_technologies"]), reverse=True)
    return _clean({"exposures": results})


@app.get("/api/overlap")
def get_cross_tech_overlap(domain: str = "microelectronics", include_process_consumables: bool = True):
    """Return materials and countries shared across multiple technologies.

    Identifies systemic risk: materials/countries that many technologies depend on.
    """
    df = _get_df(domain, include_process_consumables)
    df = df[df["country"] != "Other Countries"].copy()

    # Material overlap: which materials appear in multiple technologies
    mat_techs = df.groupby("material")["technology"].apply(lambda x: sorted(x.unique().tolist()))
    mat_results = []
    for mat, techs in mat_techs.items():
        if len(techs) < 2:
            continue
        # Get top producing countries for this material
        mat_rows = df[df["material"] == mat]
        top_countries = (
            mat_rows.groupby("country")["percentage"]
            .max()
            .sort_values(ascending=False)
            .head(3)
        )
        top_prods = [
            {"country": c, "share": round(float(s), 1)}
            for c, s in top_countries.items()
        ]
        # HHI across all entries for this material
        shares = mat_rows.groupby("country")["percentage"].max().values
        hhi = round(float(sum(s * s for s in shares)), 1)
        dep_type = df[df["material"] == mat].iloc[0].get("dependency_type", "constituent")

        mat_results.append({
            "material": mat,
            "num_technologies": len(techs),
            "technologies": techs,
            "top_producers": top_prods,
            "hhi": hhi,
            "dependency_type": dep_type,
        })
    mat_results.sort(key=lambda x: x["num_technologies"], reverse=True)

    # Country overlap: which countries appear in multiple technologies
    country_techs = df.groupby("country")["technology"].apply(lambda x: sorted(x.unique().tolist()))
    country_results = []
    for country, techs in country_techs.items():
        if len(techs) < 2:
            continue
        country_rows = df[df["country"] == country]
        mats = sorted(country_rows["material"].unique().tolist())
        avg_share = round(float(country_rows["percentage"].mean()), 1)
        country_results.append({
            "country": country,
            "num_technologies": len(techs),
            "technologies": techs,
            "num_materials": len(mats),
            "materials": mats[:10],  # top 10
            "avg_share": avg_share,
        })
    country_results.sort(key=lambda x: x["num_technologies"], reverse=True)

    return _clean({
        "material_overlap": mat_results,
        "country_overlap": country_results,
    })


@app.get("/api/disruption/{country}")
def simulate_disruption(country: str, domain: str = "microelectronics", include_process_consumables: bool = True):
    """Simulate disrupting supply from a given country.

    Returns affected technologies, materials, and severity scoring.
    """
    df = _get_df(domain, include_process_consumables)
    df = df[df["country"] != "Other Countries"].copy()
    country_rows = df[df["country"].str.lower() == country.lower()]
    if country_rows.empty:
        return {"country": country, "affected_technologies": [], "summary": {}}

    actual_country = country_rows.iloc[0]["country"]

    # Group by (technology, component, material), keeping max share per combo.
    # Structure: {tech: {component: {material: {...}}}}
    affected: dict[str, dict[str, dict[str, dict]]] = {}
    for _, row in country_rows.iterrows():
        tech = row["technology"]
        comp = row["component"]
        mat = row["material"]
        share = round(float(row["percentage"]), 1)
        affected.setdefault(tech, {}).setdefault(comp, {})
        existing = affected[tech][comp].get(mat)
        if not existing or share > existing["share"]:
            affected[tech][comp][mat] = {
                "material": mat,
                "share": share,
                "is_top_producer": False,
                "dependency_type": row.get("dependency_type", "constituent"),
            }

    # Check if this country is the top producer for each material
    for tech_comps in affected.values():
        for comp_mats in tech_comps.values():
            for mat_entry in comp_mats.values():
                mat_name = mat_entry["material"]
                all_for_mat = df[df["material"] == mat_name]
                if not all_for_mat.empty:
                    top = all_for_mat.loc[all_for_mat["percentage"].idxmax()]
                    mat_entry["is_top_producer"] = top["country"] == actual_country

    # Build per-technology impact summary
    tech_impacts = []
    for tech, comp_dict in affected.items():
        # Flat materials list (deduplicated across components, keep max share)
        flat_mats: dict[str, dict] = {}
        for comp_mats in comp_dict.values():
            for mat_name, mat_entry in comp_mats.items():
                if mat_name not in flat_mats or mat_entry["share"] > flat_mats[mat_name]["share"]:
                    flat_mats[mat_name] = mat_entry
        materials = sorted(flat_mats.values(), key=lambda x: x["share"], reverse=True)
        max_share = max(m["share"] for m in materials)
        top_producer_count = sum(1 for m in materials if m["is_top_producer"])

        # Component-level grouping
        components = []
        for comp_name, comp_mats in sorted(comp_dict.items()):
            comp_materials = sorted(comp_mats.values(), key=lambda x: x["share"], reverse=True)
            components.append({
                "component": comp_name,
                "materials": comp_materials,
            })

        if max_share >= 50 or top_producer_count >= 3:
            severity = "Critical"
        elif max_share >= 25 or top_producer_count >= 1:
            severity = "High"
        elif max_share >= 10:
            severity = "Moderate"
        else:
            severity = "Low"

        tech_impacts.append({
            "technology": tech,
            "num_materials_affected": len(materials),
            "num_components_affected": len(components),
            "max_share_lost": max_share,
            "top_producer_count": top_producer_count,
            "severity": severity,
            "materials": materials,
            "components": components,
        })

    tech_impacts.sort(key=lambda x: x["max_share_lost"], reverse=True)

    total_components = len(set(
        comp for comp_dict in affected.values() for comp in comp_dict
    ))
    summary = {
        "country": actual_country,
        "total_technologies_affected": len(tech_impacts),
        "total_materials_affected": len(set(m for comp_dict in affected.values() for comp_mats in comp_dict.values() for m in comp_mats)),
        "total_components_affected": total_components,
        "critical_count": sum(1 for t in tech_impacts if t["severity"] == "Critical"),
        "high_count": sum(1 for t in tech_impacts if t["severity"] == "High"),
    }

    return _clean({
        "country": actual_country,
        "affected_technologies": tech_impacts,
        "summary": summary,
    })


# ---------------------------------------------------------------------------
# Knowledge graph context endpoint
# ---------------------------------------------------------------------------


class GraphContextRequest(BaseModel):
    query: str
    hops: int = 2


@app.post("/api/graph-context")
def get_graph_context(req: GraphContextRequest):
    """Extract a relevant subgraph based on entities mentioned in the query."""
    seed_nodes = _extract_entities(req.query)

    if not seed_nodes:
        return _clean({
            "query": req.query,
            "matched_entities": [],
            "num_nodes": 0,
            "num_edges": 0,
            "triples": [],
            "node_metrics": {},
            "fallback": True,
        })

    subgraph = _extract_subgraph(seed_nodes, hops=req.hops)
    triples = _serialize_triples(subgraph)

    node_metrics = {}
    for node_id in subgraph.nodes:
        attrs = dict(subgraph.nodes[node_id])
        attrs["pagerank"] = round(GRAPH_METRICS["pagerank"].get(node_id, 0), 6)
        attrs["in_degree"] = GRAPH_METRICS["in_degree"].get(node_id, 0)
        node_metrics[node_id] = attrs

    matched_labels = [
        G.nodes[n].get("label", n) for n in seed_nodes if n in G.nodes
    ]

    return _clean({
        "query": req.query,
        "matched_entities": matched_labels,
        "num_nodes": subgraph.number_of_nodes(),
        "num_edges": subgraph.number_of_edges(),
        "triples": triples,
        "node_metrics": node_metrics,
        "fallback": False,
    })
