from __future__ import annotations

import math
from pathlib import Path

import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="STDN Explorer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _load_data() -> pd.DataFrame:
    df = pd.read_csv(DATA_DIR / "stdn_seed.csv")
    # Normalize country names to title case
    df["country"] = df["country"].str.strip().str.title()
    df["country"] = df["country"].replace({"Other": "Other Countries"})
    # Fill NaN percentages/amounts with 0
    df["percentage"] = df["percentage"].fillna(0.0)
    df["amount"] = df["amount"].fillna(0.0)
    return df


DF = _load_data()


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
def list_technologies():
    """Return list of all technologies."""
    techs = sorted(DF["technology"].unique().tolist())
    return {"technologies": techs}


@app.get("/api/stdn/{technology}")
def get_stdn(technology: str):
    """Return full STDN graph data for a technology.

    Returns nodes and edges suitable for Cytoscape.js rendering.
    """
    subset = DF[DF["technology"] == technology]
    if subset.empty:
        return {"nodes": [], "edges": []}

    nodes = []
    edges = []
    seen_nodes: set[str] = set()

    def add_node(id: str, label: str, layer: str, **extra):
        if id not in seen_nodes:
            seen_nodes.add(id)
            nodes.append({"data": {"id": id, "label": label, "layer": layer, **extra}})

    # Technology node
    tech_id = f"tech:{technology}"
    add_node(tech_id, technology, "technology")

    for _, row in subset.iterrows():
        comp = row["component"]
        mat = row["material"]
        country = row["country"]

        comp_id = f"comp:{comp}"
        mat_id = f"mat:{mat}"
        country_id = f"country:{country}"

        add_node(comp_id, comp, "component", confidence=row["component_confidence"])
        add_node(mat_id, mat, "material", confidence=row["material_confidence"],
                 hs_code=row.get("hs_code"))
        add_node(country_id, country, "country")

        # Edges
        tc_id = f"{tech_id}->{comp_id}"
        if tc_id not in seen_nodes:
            seen_nodes.add(tc_id)
            edges.append({"data": {
                "id": tc_id, "source": tech_id, "target": comp_id,
                "confidence": row["component_confidence"],
            }})

        cm_id = f"{comp_id}->{mat_id}"
        if cm_id not in seen_nodes:
            seen_nodes.add(cm_id)
            edges.append({"data": {
                "id": cm_id, "source": comp_id, "target": mat_id,
                "confidence": row["material_confidence"],
            }})

        mp_id = f"{mat_id}->{country_id}"
        if mp_id not in seen_nodes:
            seen_nodes.add(mp_id)
            edges.append({"data": {
                "id": mp_id, "source": mat_id, "target": country_id,
                "percentage": row["percentage"],
                "amount": row["amount"],
                "meas_unit": row.get("meas_unit", ""),
                "confidence": row["country_confidence"],
                "provenance": "USGS" if row["amount"] > 0 else "LLM",
            }})

    return _clean({"nodes": nodes, "edges": edges})


@app.get("/api/stdn/{technology}/table")
def get_stdn_table(technology: str):
    """Return flat table data for a technology."""
    subset = DF[DF["technology"] == technology]
    records = subset.to_dict(orient="records")
    return _clean({"rows": records, "count": len(records)})


@app.get("/api/concentration")
def get_concentration():
    """Return HHI concentration scores per technology x material."""
    results = []
    for (tech, mat), group in DF.groupby(["technology", "material"]):
        shares = group["percentage"].values
        hhi = float(sum(s * s for s in shares))
        top3 = group.nlargest(3, "percentage")
        top_producers = [
            {"country": row["country"], "share": round(float(row["percentage"]), 1)}
            for _, row in top3.iterrows()
        ]
        results.append({
            "technology": tech,
            "material": mat,
            "hhi": round(hhi, 1),
            "top_producers": top_producers,
            "num_countries": len(group),
        })
    results.sort(key=lambda x: x["hhi"], reverse=True)
    return {"concentration": results}


@app.get("/api/country/{country}")
def get_country_exposure(country: str):
    """Return all technologies/materials that depend on a given country."""
    subset = DF[DF["country"].str.lower() == country.lower()]
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
        })
    exposures.sort(key=lambda x: x["percentage"], reverse=True)
    return _clean({"country": country, "exposures": exposures})


@app.get("/api/countries")
def list_countries():
    """Return all countries with total exposure count."""
    counts = DF.groupby("country").size().reset_index(name="count")
    counts = counts.sort_values("count", ascending=False)
    return {"countries": counts.to_dict(orient="records")}


@app.get("/api/country-exposure")
def get_country_exposure_summary():
    """Return country-level supply chain exposure summary.

    For each country: how many technologies depend on it, how many materials
    it produces, which materials it dominates (top producer), and avg share.
    """
    # Exclude "Other Countries" aggregate
    df = DF[DF["country"] != "Other Countries"].copy()

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
                dominated.append(mat)

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
def get_cross_tech_overlap():
    """Return materials and countries shared across multiple technologies.

    Identifies systemic risk: materials/countries that many technologies depend on.
    """
    df = DF[DF["country"] != "Other Countries"].copy()

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

        mat_results.append({
            "material": mat,
            "num_technologies": len(techs),
            "technologies": techs,
            "top_producers": top_prods,
            "hhi": hhi,
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
def simulate_disruption(country: str):
    """Simulate disrupting supply from a given country.

    Returns affected technologies, materials, and severity scoring.
    """
    df = DF[DF["country"] != "Other Countries"].copy()
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
