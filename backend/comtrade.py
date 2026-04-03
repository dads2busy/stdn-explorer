"""Comtrade trade flow metrics from lia stdn-export data.

Implements three metrics from Vullikanti et al. (2026):
- Disruption score g_i(S): fraction of trade flow lost when country set S is removed
- Maximum disruption sets S*_k: countries whose removal causes max flow loss (k=1,2,3)
- Substitutability: number of distinct countries in top-k supplier sets across years
"""

from pathlib import Path
from itertools import combinations
import pandas as pd

COMTRADE_DIR = Path(__file__).parent.parent / "data" / "comtrade"

_df: pd.DataFrame | None = None


def load_comtrade() -> pd.DataFrame | None:
    """Load all CSV files from data/comtrade/ into a single DataFrame.

    Returns None if no CSV files are found.
    """
    global _df
    if _df is not None:
        return _df

    csv_files = list(COMTRADE_DIR.glob("*.csv"))
    if not csv_files:
        return None

    frames = [pd.read_csv(f) for f in csv_files]
    _df = pd.concat(frames, ignore_index=True)

    # Normalize types
    _df["year"] = _df["year"].astype(int)
    _df["import_value_usd"] = _df["import_value_usd"].astype(float)
    _df["import_share_pct"] = _df["import_share_pct"].astype(float)
    _df["exporter_rank"] = _df["exporter_rank"].astype(int)

    return _df


def get_materials() -> list[str]:
    """Return sorted list of unique material names in the dataset."""
    df = load_comtrade()
    if df is None:
        return []
    return sorted(df["material"].unique().tolist())


def get_years() -> list[int]:
    """Return sorted list of unique years in the dataset."""
    df = load_comtrade()
    if df is None:
        return []
    return sorted(df["year"].unique().tolist())


def disruption_score(
    df_commodity: pd.DataFrame,
    removed_countries: set[str],
) -> float:
    """Compute g_i(S): fraction of import value lost for one HS code when
    countries in removed_countries are blocked.

    Args:
        df_commodity: Rows for a single HS code in a single year.
        removed_countries: Set of exporter country names to remove.

    Returns:
        Float in [0, 1]. The fraction of total import value attributable
        to the removed countries.
    """
    total = df_commodity["import_value_usd"].sum()
    if total == 0:
        return 0.0
    lost = df_commodity[
        df_commodity["exporter"].isin(removed_countries)
    ]["import_value_usd"].sum()
    return lost / total


def max_disruption_set(
    df_bucket: pd.DataFrame,
    year: int,
    k: int,
) -> dict:
    """Find the set of k countries whose removal causes maximum disruption
    to a material bucket in a given year.

    The bucket-level disruption g(S) is the max disruption across all
    HS codes in the bucket (per the paper's multiplex definition).

    Args:
        df_bucket: Rows for all HS codes of one material bucket.
        year: The year to analyze.
        k: Size of the disruption set (1, 2, or 3).

    Returns:
        {"countries": [...], "score": float, "worst_hs": str}
    """
    df_year = df_bucket[df_bucket["year"] == year]
    if df_year.empty:
        return {"countries": [], "score": 0.0, "worst_hs": ""}

    hs_codes = df_year["hs_bucket"].unique().tolist()
    all_countries = df_year["exporter"].unique().tolist()

    best_score = 0.0
    best_set: list[str] = []
    best_hs = ""

    for combo in combinations(all_countries, min(k, len(all_countries))):
        removed = set(combo)
        for hs in hs_codes:
            df_hs = df_year[df_year["hs_bucket"] == hs]
            score = disruption_score(df_hs, removed)
            if score > best_score:
                best_score = score
                best_set = list(combo)
                best_hs = hs

    return {
        "countries": sorted(best_set),
        "score": round(best_score, 4),
        "worst_hs": best_hs,
    }


def disruption_heatmap(k: int = 1) -> dict:
    """Build disruption heatmap data: for each material bucket and year,
    find the top-k disruptor countries and their scores.

    Produces the data behind the paper's Figure 3.

    Args:
        k: Disruption set size (1, 2, or 3).

    Returns:
        {
            "materials": [...],
            "years": [...],
            "cells": [
                {
                    "material": str,
                    "year": int,
                    "countries": [...],
                    "score": float,
                    "worst_hs": str
                }, ...
            ],
            "country_scores": [
                {
                    "country": str,
                    "material": str,
                    "aggregate_score": int
                }, ...
            ]
        }
    """
    df = load_comtrade()
    if df is None:
        return {"materials": [], "years": [], "cells": [], "country_scores": []}

    materials = sorted(df["material"].unique().tolist())
    years = sorted(df["year"].unique().tolist())

    cells = []
    country_year_counts: dict[tuple[str, str], int] = {}

    for mat in materials:
        df_mat = df[df["material"] == mat]
        for year in years:
            result = max_disruption_set(df_mat, year, k)
            cells.append({
                "material": mat,
                "year": year,
                "countries": result["countries"],
                "score": result["score"],
                "worst_hs": result["worst_hs"],
            })
            for country in result["countries"]:
                key = (country, mat)
                country_year_counts[key] = country_year_counts.get(key, 0) + 1

    country_scores = [
        {
            "country": country,
            "material": mat,
            "aggregate_score": count,
        }
        for (country, mat), count in country_year_counts.items()
    ]
    country_scores.sort(key=lambda x: -x["aggregate_score"])

    return {
        "materials": materials,
        "years": years,
        "cells": cells,
        "country_scores": country_scores,
    }


def substitutability(k_values: list[int] | None = None) -> dict:
    """Compute substitutability/lock-in per material bucket.

    For each material and each k (1, 2, 3), count the number of distinct
    countries that appear in the top-k supplier set across all years.

    Fewer distinct countries = higher lock-in (same countries dominate).
    More distinct countries = higher substitutability (countries rotate).

    Produces the data behind the paper's Figure 4 (tornado plot).

    Args:
        k_values: List of k values to compute. Defaults to [1, 2, 3].

    Returns:
        {
            "materials": [...],
            "years": [...],
            "num_years": int,
            "entries": [
                {
                    "material": str,
                    "k": int,
                    "distinct_countries": int,
                    "countries": [...],
                    "max_possible": int
                }, ...
            ]
        }
    """
    if k_values is None:
        k_values = [1, 2, 3]

    df = load_comtrade()
    if df is None:
        return {"materials": [], "years": [], "num_years": 0, "entries": []}

    materials = sorted(df["material"].unique().tolist())
    years = sorted(df["year"].unique().tolist())
    num_years = len(years)

    entries = []
    for mat in materials:
        df_mat = df[df["material"] == mat]
        for k in k_values:
            top_k_countries: set[str] = set()
            for year in years:
                df_year = df_mat[df_mat["year"] == year]
                if df_year.empty:
                    continue
                country_totals = (
                    df_year.groupby("exporter")["import_value_usd"]
                    .sum()
                    .nlargest(k)
                )
                top_k_countries.update(country_totals.index.tolist())

            entries.append({
                "material": mat,
                "k": k,
                "distinct_countries": len(top_k_countries),
                "countries": sorted(top_k_countries),
                "max_possible": k * num_years,
            })

    return {
        "materials": materials,
        "years": years,
        "num_years": num_years,
        "entries": entries,
    }
