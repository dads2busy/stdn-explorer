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
