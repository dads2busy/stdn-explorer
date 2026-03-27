# STDN Explorer — Measurement Definitions and Methodology

This document provides formal definitions, formulas, and classification thresholds for all analytical measures used in the STDN Explorer dashboard.

---

## 1. Shallow Technology Dependency Network (STDN)

A **Shallow Technology Dependency Network** is a 4-layer directed acyclic graph (DAG) that maps the supply chain structure of a technology:

```
Technology → Components → Materials → Countries
```

### Node Types

| Layer | Definition | Example |
|---|---|---|
| **Technology** | The end product being analyzed | Smartphone |
| **Component** | A procurable subassembly of the technology | Display Module, Lithium-Ion Battery |
| **Material** | A raw material or processed input required by a component | Indium, Cobalt, Silicon |
| **Country** | A nation that produces a material | China, United States, Australia |

### Edge Types

| Edge | Notation | Definition |
|---|---|---|
| **HAS_COMPONENT** | T → C | Technology T contains component C |
| **USES_MATERIAL** | C → M | Component C requires constituent material M (physically incorporated into the product) |
| **CONSUMES_PROCESS_MATERIAL** | T → M or C → M | Technology T or component C consumes process material M during manufacturing (not present in final product) |
| **PRODUCED_IN** | M → P | Material M is produced in country P, with production share s as an edge attribute |

### Material Dependency Types

| Type | Definition | Visual Indicator |
|---|---|---|
| **Constituent** | Material that physically becomes part of the product | Amber node, solid edge |
| **Process Consumable** | Material consumed during manufacturing but not present in the final product (e.g., Helium for leak testing, photoresists, etch chemicals, cleaning solvents) | Purple node, dashed edge |

### Data Sources

- **USGS-sourced**: Country production shares from the U.S. Geological Survey Minerals Yearbook and Commodity Summaries (2022–2025). Marked with provenance tag "USGS" and non-zero production amounts.
- **LLM-estimated**: Production shares estimated by multi-agent LLM consensus where USGS data is unavailable. Marked with provenance tag "LLM" and zero production amounts.

---

## 2. Herfindahl-Hirschman Index (HHI) — Concentration

### Definition

The **Herfindahl-Hirschman Index** quantifies how concentrated a material's production is among producing countries. A higher HHI indicates greater concentration risk — fewer countries control supply.

### Formula

For a material M used by technology T, let s₁, s₂, ..., sₙ be the production shares (as percentages, 0–100) of the N producing countries:

```
HHI(M, T) = Σᵢ₌₁ᴺ sᵢ²
```

**De-duplication rule**: When the same material is used by multiple components within a single technology, the maximum production share per country is used (not the sum) to avoid double-counting.

### Interpretation

| HHI Score | Example Scenario |
|---|---|
| 10,000 | Single-country monopoly (one country produces 100%) |
| 5,000 | Two countries with ~70/30 split |
| 2,500 | Two countries with ~50/50 split |
| 2,000 | Five countries with roughly equal shares |
| ≈ 0 | Production is highly fragmented across many countries |

### Classification Thresholds

| Level | HHI Range | Interpretation |
|---|---|---|
| **Extreme** | ≥ 5,000 | Near-monopoly; critical supply risk |
| **High** | ≥ 2,500 | Highly concentrated; significant risk |
| **Medium** | ≥ 1,500 | Moderately concentrated |
| **Low** | < 1,500 | Diversified supply base |

**Note**: The Extreme tier (≥ 5,000) extends beyond the standard DOJ/FTC Horizontal Merger Guidelines (2010, §5.3) to flag near-monopoly conditions common in critical mineral markets (e.g., rare earths, cobalt, gallium).

---

## 3. Country Dominance

### Definitions

**Top Producer**: For a given material, the country with the highest production share across all technologies in the dataset. The "Other Countries" aggregate is excluded from this determination.

**Dominated Material**: A material for which a specific country is the top producer. For example, if China produces 60% of Gallium and no other single country exceeds this share, then Gallium is a "dominated material" for China.

**Dominance Count**: The number of distinct materials a country dominates (i.e., is the top producer for).

### Formula

For country P and the set of all materials {M₁, M₂, ..., Mₖ} in the dataset:

```
DominanceCount(P) = |{ Mⱼ : share(P, Mⱼ) = max over all countries Q of share(Q, Mⱼ) }|
```

### Additional Metrics

| Metric | Definition |
|---|---|
| **Technologies Affected** | Number of distinct technologies whose supply chains include materials produced by this country |
| **Materials Produced** | Total number of distinct materials this country supplies (not just dominates) |
| **Average Share** | Mean production share across all material-technology pairs involving this country |
| **Max Share** | Highest single production share held by this country for any material |

### Classification Thresholds

| Level | Dominance Count | Interpretation |
|---|---|---|
| **Critical** | ≥ 10 materials | Extreme systemic leverage; disruption affects many material supply chains simultaneously |
| **High** | ≥ 5 materials | Significant chokepoint |
| **Moderate** | ≥ 2 materials | Notable presence as top producer |
| **Low** | < 2 materials | Limited dominance |

---

## 4. Cross-Technology Overlap

### Definitions

**Material Overlap**: A material that appears in the supply chains of 2 or more technologies. The **overlap count** is the number of distinct technologies that depend on the material.

**Country Overlap**: A country that supplies materials to 2 or more technologies. The overlap count is the number of distinct technologies the country's production supports.

**Systemic Risk Multiplier**: A material or country with high overlap count — disruption to a single supply source cascades across many technologies simultaneously.

### Metrics per Shared Material

| Metric | Definition |
|---|---|
| **Technologies** | Number and list of technologies sharing this material dependency |
| **HHI** | Concentration score for this material (same formula as §2) |
| **Top Producers** | Countries with the largest production shares |
| **Dependency Type** | Constituent or process consumable |

### Metrics per Shared Country

| Metric | Definition |
|---|---|
| **Technologies** | Number and list of technologies this country supplies |
| **Materials** | Number and list of materials this country produces |
| **Average Share** | Mean production share across all supply relationships |

### Classification Thresholds

| Level | Overlap Count | Interpretation |
|---|---|---|
| **High** | ≥ 6 technologies | Critical systemic dependency |
| **Moderate** | ≥ 4 technologies | Significant cross-technology exposure |
| **Low** | ≥ 3 technologies | Notable shared dependency |
| **Minimal** | 2 technologies | Limited overlap |

---

## 5. Disruption Simulation

### Definition

The disruption simulator models a hypothetical scenario in which a selected country's entire production capacity becomes unavailable. It computes the cascading impact across all technologies in the dataset.

### Computed Metrics per Technology

| Metric | Formula / Definition |
|---|---|
| **Materials Affected** | Count of materials where the disrupted country is a producer |
| **Components Affected** | Count of components that depend on affected materials |
| **Max Share Lost** | max over all materials M of share(disrupted country, M) — the highest single production share the disrupted country holds |
| **Top Producer Count** | Number of materials for which the disrupted country is the #1 global producer |

### Severity Classification

Severity is computed per technology based on the disrupted country's role in that technology's supply chain:

| Severity | Condition | Interpretation |
|---|---|---|
| **Critical** | Max share lost ≥ 50% **OR** top producer for ≥ 3 materials | Severe manufacturing disruption; no readily available alternative supply |
| **High** | Max share lost ≥ 25% **OR** top producer for ≥ 1 material | Significant impact requiring supply chain adjustments |
| **Moderate** | Max share lost ≥ 10% | Noticeable but manageable with existing alternative suppliers |
| **Low** | Max share lost < 10% | Minimal direct impact |

### Drill-Down Levels

The simulator provides a three-level hierarchical breakdown:

1. **Technology level**: severity, total materials/components affected, max share lost
2. **Component level**: which components use affected materials, per-component share loss
3. **Material level**: specific material name, share percentage, whether disrupted country is top producer, dependency type (constituent or process consumable)

**Note**: Both constituent materials and process consumables are included in severity calculations. A manufacturing line can be shut down equally by loss of a constituent material (e.g., Indium for display manufacturing) or a critical process consumable (e.g., Helium for leak testing).

---

## 6. Policy Analysis Templates

The Analyst tab provides 6 structured report templates that combine the above measures:

| Template | Input | Data Sources | Output |
|---|---|---|---|
| Supply chain risks for [technology] | Technology name | Concentration (HHI), STDN table | Risk assessment with critical materials, HHI scores, top producers |
| Disruption impact of [country] | Country name | Disruption simulation, country exposure | Affected technologies by severity, materials at risk |
| Highest concentration risks | None | Concentration (HHI), overlap | Cross-technology HHI analysis, systemic chokepoints |
| Country dominance of [country] | Country name | Country exposure, disruption simulation | Dominated materials, technologies affected, market share analysis |
| Cross-technology shared materials | None | Overlap, concentration | Shared materials with HHI scores, systemic risk assessment |
| Disruption impact of [material] | Material name | Concentration, overlap, country exposure | Affected technologies, producing countries, concentration risk, recommendations |

All structured reports are generated deterministically from the STDN dataset — no LLM is used at runtime.

---

## Data Provenance

All country production share data flows from two sources:

| Source | Coverage | Reliability |
|---|---|---|
| **USGS Minerals Yearbook (2022–2025)** | ~55 constituent minerals with global production data | Authoritative; U.S. government statistical publication |
| **LLM Multi-Agent Consensus** | Process consumables and materials not in USGS database | Estimated; 3-agent debate with convergence threshold |

The `provenance` field on each data row distinguishes these sources. USGS-sourced rows include non-zero production amounts in physical units; LLM-estimated rows have zero amounts and percentage-only estimates.
