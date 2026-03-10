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
