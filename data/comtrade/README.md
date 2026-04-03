# Comtrade Trade Flow Data

Place CSV files produced by `lia stdn-export` in this directory.

Expected schema (one row per material x HS code x year x exporter):

| Column | Type | Description |
|--------|------|-------------|
| material | str | Material bucket name (e.g., "Cobalt") |
| hs_bucket | str | HS-6 code (e.g., "260500") |
| hs_bucket_quality | str | "clean" or "shared" |
| year | int | Trade year (e.g., 2023) |
| exporter | str | Country name |
| exporter_iso3 | str | ISO-3 country code |
| import_value_usd | float | US import value in USD |
| import_share_pct | float | Exporter's share of US imports for this HS code (0-100) |
| exporter_rank | int | Rank by import value for this HS code + year |

Generate with: `lia stdn-export --materials "cobalt,gallium,..." --years 2017-2025 --output data/comtrade/trade_flows.csv`
