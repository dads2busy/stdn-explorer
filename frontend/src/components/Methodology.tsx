export function Methodology() {
  return (
    <div className="methodology-container">
      <h2 className="heatmap-title">Measurement Definitions and Methodology</h2>
      <p className="methodology-intro">
        This page provides formal definitions, formulas, and classification thresholds for all analytical measures used in the STDN Explorer dashboard.
      </p>

      <section className="methodology-section">
        <h3>1. Shallow Technology Dependency Network (STDN)</h3>
        <p>
          A <strong>Shallow Technology Dependency Network</strong> is a 4-layer directed acyclic graph (DAG) that maps the supply chain structure of a technology:
        </p>
        <pre className="methodology-formula">Technology &rarr; Components &rarr; Materials &rarr; Countries</pre>

        <h4>Node Types</h4>
        <table className="methodology-table">
          <thead>
            <tr><th>Layer</th><th>Definition</th><th>Example</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Technology</strong></td><td>The end product being analyzed</td><td>Smartphone</td></tr>
            <tr><td><strong>Component</strong></td><td>A procurable subassembly of the technology</td><td>Display Module, Lithium-Ion Battery</td></tr>
            <tr><td><strong>Material</strong></td><td>A raw material or processed input required by a component</td><td>Indium, Cobalt, Silicon</td></tr>
            <tr><td><strong>Country</strong></td><td>A nation that produces a material</td><td>China, United States, Australia</td></tr>
          </tbody>
        </table>

        <h4>Edge Types</h4>
        <table className="methodology-table">
          <thead>
            <tr><th>Edge</th><th>Notation</th><th>Definition</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>HAS_COMPONENT</strong></td><td>T &rarr; C</td><td>Technology T contains component C</td></tr>
            <tr><td><strong>USES_MATERIAL</strong></td><td>C &rarr; M</td><td>Component C requires constituent material M (physically incorporated into the product)</td></tr>
            <tr><td><strong>CONSUMES_PROCESS_MATERIAL</strong></td><td>T &rarr; M or C &rarr; M</td><td>Technology T or component C consumes process material M during manufacturing (not present in final product)</td></tr>
            <tr><td><strong>PRODUCED_IN</strong></td><td>M &rarr; P</td><td>Material M is produced in country P, with production share s as an edge attribute</td></tr>
          </tbody>
        </table>

        <h4>Material Dependency Types</h4>
        <table className="methodology-table">
          <thead>
            <tr><th>Type</th><th>Definition</th><th>Visual Indicator</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Constituent</strong></td><td>Material that physically becomes part of the product</td><td>Amber node, solid edge</td></tr>
            <tr><td><strong>Process Consumable</strong></td><td>Material consumed during manufacturing but not present in the final product (e.g., Helium for leak testing, photoresists, etch chemicals, cleaning solvents)</td><td>Purple node, dashed edge</td></tr>
          </tbody>
        </table>

        <h4>Data Sources</h4>
        <ul>
          <li><strong>USGS-sourced</strong>: Country production shares from the U.S. Geological Survey Minerals Yearbook and Commodity Summaries (2022–2025). Marked with provenance tag "USGS" and non-zero production amounts.</li>
          <li><strong>LLM-estimated</strong>: Production shares estimated by multi-agent LLM consensus where USGS data is unavailable. Marked with provenance tag "LLM" and zero production amounts.</li>
        </ul>
      </section>

      <section className="methodology-section">
        <h3>2. Herfindahl-Hirschman Index (HHI) — Concentration</h3>

        <h4>Definition</h4>
        <p>
          The <strong>Herfindahl-Hirschman Index</strong> quantifies how concentrated a material's production is among producing countries. A higher HHI indicates greater concentration risk — fewer countries control supply.
        </p>

        <h4>Formula</h4>
        <p>
          For a material M used by technology T, let s₁, s₂, ..., sₙ be the production shares (as percentages, 0–100) of the N producing countries:
        </p>
        <pre className="methodology-formula">HHI(M, T) = Σᵢ₌₁ᴺ sᵢ²</pre>
        <p>
          <strong>De-duplication rule</strong>: When the same material is used by multiple components within a single technology, the maximum production share per country is used (not the sum) to avoid double-counting.
        </p>

        <h4>Interpretation</h4>
        <table className="methodology-table">
          <thead>
            <tr><th>HHI Score</th><th>Example Scenario</th></tr>
          </thead>
          <tbody>
            <tr><td>10,000</td><td>Single-country monopoly (one country produces 100%)</td></tr>
            <tr><td>5,000</td><td>Two countries with ~70/30 split</td></tr>
            <tr><td>2,500</td><td>Two countries with ~50/50 split</td></tr>
            <tr><td>2,000</td><td>Five countries with roughly equal shares</td></tr>
            <tr><td>&asymp; 0</td><td>Production is highly fragmented across many countries</td></tr>
          </tbody>
        </table>

        <h4>Classification Thresholds</h4>
        <table className="methodology-table">
          <thead>
            <tr><th>Level</th><th>HHI Range</th><th>Interpretation</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Extreme</strong></td><td>&ge; 5,000</td><td>Near-monopoly; critical supply risk</td></tr>
            <tr><td><strong>High</strong></td><td>&ge; 2,500</td><td>Highly concentrated; significant risk</td></tr>
            <tr><td><strong>Medium</strong></td><td>&ge; 1,500</td><td>Moderately concentrated</td></tr>
            <tr><td><strong>Low</strong></td><td>&lt; 1,500</td><td>Diversified supply base</td></tr>
          </tbody>
        </table>
        <p className="methodology-rationale">
          <strong>Threshold rationale</strong>: The Medium (&ge; 1,500) and High (&ge; 2,500) thresholds are from the U.S. Department of Justice and Federal Trade Commission Horizontal Merger Guidelines (2010, &sect;5.3), which define these as boundaries between "unconcentrated," "moderately concentrated," and "highly concentrated" markets. The Extreme tier (&ge; 5,000) is our addition — it extends beyond the DOJ/FTC guidelines to flag near-monopoly conditions common in critical mineral markets (e.g., rare earths, cobalt, gallium) where HHI routinely exceeds 5,000.
        </p>
      </section>

      <section className="methodology-section">
        <h3>3. Country Dominance</h3>

        <h4>Definitions</h4>
        <p><strong>Top Producer</strong>: For a given material, the country with the highest production share across all technologies in the dataset. The "Other Countries" aggregate is excluded from this determination.</p>
        <p><strong>Dominated Material</strong>: A material for which a specific country is the top producer. For example, if China produces 60% of Gallium and no other single country exceeds this share, then Gallium is a "dominated material" for China.</p>
        <p><strong>Dominance Count</strong>: The number of distinct materials a country dominates (i.e., is the top producer for).</p>

        <h4>Formula</h4>
        <p>For country P and the set of all materials &#123;M₁, M₂, ..., Mₖ&#125; in the dataset:</p>
        <pre className="methodology-formula">DominanceCount(P) = |&#123; Mⱼ : share(P, Mⱼ) = max over all countries Q of share(Q, Mⱼ) &#125;|</pre>

        <h4>Additional Metrics</h4>
        <table className="methodology-table">
          <thead>
            <tr><th>Metric</th><th>Definition</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Technologies Affected</strong></td><td>Number of distinct technologies whose supply chains include materials produced by this country</td></tr>
            <tr><td><strong>Materials Produced</strong></td><td>Total number of distinct materials this country supplies (not just dominates)</td></tr>
            <tr><td><strong>Average Share</strong></td><td>Mean production share across all material-technology pairs involving this country</td></tr>
            <tr><td><strong>Max Share</strong></td><td>Highest single production share held by this country for any material</td></tr>
          </tbody>
        </table>

        <h4>Classification Thresholds</h4>
        <table className="methodology-table">
          <thead>
            <tr><th>Level</th><th>Dominance Count</th><th>Interpretation</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Critical</strong></td><td>&ge; 10 materials</td><td>Extreme systemic leverage; disruption affects many material supply chains simultaneously</td></tr>
            <tr><td><strong>High</strong></td><td>&ge; 5 materials</td><td>Significant chokepoint</td></tr>
            <tr><td><strong>Moderate</strong></td><td>&ge; 2 materials</td><td>Notable presence as top producer</td></tr>
            <tr><td><strong>Low</strong></td><td>&lt; 2 materials</td><td>Limited dominance</td></tr>
          </tbody>
        </table>
        <p className="methodology-rationale">
          <strong>Threshold rationale</strong>: These thresholds are defined for this tool to provide actionable risk tiers. There is no published standard for "how many dominated materials constitutes a supply chain chokepoint." A country dominating 10+ materials represents outsized systemic leverage, while dominance over 1 material is common and lower risk. These thresholds are independent of portfolio size since dominance is determined by global production share, not the number of technologies analyzed.
        </p>
      </section>

      <section className="methodology-section">
        <h3>4. Cross-Technology Overlap</h3>

        <h4>Definitions</h4>
        <p><strong>Material Overlap</strong>: A material that appears in the supply chains of 2 or more technologies. The <strong>overlap count</strong> is the number of distinct technologies that depend on the material.</p>
        <p><strong>Country Overlap</strong>: A country that supplies materials to 2 or more technologies. The overlap count is the number of distinct technologies the country's production supports.</p>
        <p><strong>Systemic Risk Multiplier</strong>: A material or country with high overlap count — disruption to a single supply source cascades across many technologies simultaneously.</p>

        <h4>Metrics per Shared Material</h4>
        <table className="methodology-table">
          <thead>
            <tr><th>Metric</th><th>Definition</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Technologies</strong></td><td>Number and list of technologies sharing this material dependency</td></tr>
            <tr><td><strong>HHI</strong></td><td>Concentration score for this material (same formula as &sect;2)</td></tr>
            <tr><td><strong>Top Producers</strong></td><td>Countries with the largest production shares</td></tr>
            <tr><td><strong>Dependency Type</strong></td><td>Constituent or process consumable</td></tr>
          </tbody>
        </table>

        <h4>Metrics per Shared Country</h4>
        <table className="methodology-table">
          <thead>
            <tr><th>Metric</th><th>Definition</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Technologies</strong></td><td>Number and list of technologies this country supplies</td></tr>
            <tr><td><strong>Materials</strong></td><td>Number and list of materials this country produces</td></tr>
            <tr><td><strong>Average Share</strong></td><td>Mean production share across all supply relationships</td></tr>
          </tbody>
        </table>

        <h4>Classification Thresholds</h4>
        <table className="methodology-table">
          <thead>
            <tr><th>Level</th><th>Overlap (% of portfolio)</th><th>Interpretation</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>High</strong></td><td>&ge; 10% of technologies</td><td>Critical systemic dependency</td></tr>
            <tr><td><strong>Moderate</strong></td><td>&ge; 6.7% of technologies</td><td>Significant cross-technology exposure</td></tr>
            <tr><td><strong>Low</strong></td><td>&ge; 5% of technologies</td><td>Notable shared dependency</td></tr>
            <tr><td><strong>Minimal</strong></td><td>&lt; 5% (2+ technologies)</td><td>Limited overlap</td></tr>
          </tbody>
        </table>
        <p className="methodology-rationale">
          <strong>Threshold rationale</strong>: These thresholds are defined for this tool as percentages of the technology portfolio, so they scale automatically regardless of whether the portfolio contains 60 or 180 technologies. There is no published standard for classifying cross-technology material overlap as a risk measure. A material shared by 10%+ of the portfolio represents a significant systemic dependency, while overlap across only 2 technologies is common and expected.
        </p>
      </section>

      <section className="methodology-section">
        <h3>5. Disruption Simulation</h3>

        <h4>Definition</h4>
        <p>
          The supply disruption analysis models a hypothetical scenario in which a selected country's entire production capacity becomes unavailable. It computes the cascading impact across all technologies in the dataset.
        </p>

        <h4>Computed Metrics per Technology</h4>
        <table className="methodology-table">
          <thead>
            <tr><th>Metric</th><th>Formula / Definition</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Materials Affected</strong></td><td>Count of materials where the disrupted country is a producer</td></tr>
            <tr><td><strong>Components Affected</strong></td><td>Count of components that depend on affected materials</td></tr>
            <tr><td><strong>Max Share Lost</strong></td><td>max over all materials M of share(disrupted country, M) — the highest single production share the disrupted country holds ("What's the single biggest hole in this technology's supply chain if this country goes offline?")</td></tr>
            <tr><td><strong>Top Producer Count</strong></td><td>Number of materials for which the disrupted country is the #1 global producer</td></tr>
          </tbody>
        </table>

        <h4>Severity Classification</h4>
        <p>Severity is computed per technology based on the disrupted country's role in that technology's supply chain:</p>
        <table className="methodology-table">
          <thead>
            <tr><th>Severity</th><th>Condition</th><th>Interpretation</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Critical</strong></td><td>Max share lost &ge; 50% <strong>OR</strong> top producer for &ge; 3 materials</td><td>Severe manufacturing disruption; no readily available alternative supply</td></tr>
            <tr><td><strong>High</strong></td><td>Max share lost &ge; 30% <strong>OR</strong> top producer for &ge; 1 material</td><td>Significant impact requiring supply chain adjustments</td></tr>
            <tr><td><strong>Moderate</strong></td><td>Max share lost &ge; 10%</td><td>Noticeable but manageable with existing alternative suppliers</td></tr>
            <tr><td><strong>Low</strong></td><td>Max share lost &lt; 10%</td><td>Minimal direct impact</td></tr>
          </tbody>
        </table>
        <p className="methodology-rationale">
          <strong>Threshold rationale</strong>: There is no universally adopted standard for classifying supply chain disruption severity. These thresholds are informed by several institutional benchmarks:
        </p>
        <ul>
          <li>The <strong>European Commission's Critical Raw Materials methodology</strong> uses a 30% single-country supply share as an indicator of supply risk in its criticality assessments (EC, 2023). Our High threshold (&ge; 30%) is aligned with this benchmark.</li>
          <li>The <strong>U.S. Department of Energy Critical Minerals Strategy</strong> and <strong>OECD supply chain resilience frameworks</strong> treat single-country supply shares above 40–50% as indicators of high import dependency and critical vulnerability.</li>
          <li>The &ge; 50% Critical threshold reflects the widely recognized principle that majority dependence on a single source represents a critical single point of failure.</li>
        </ul>
        <p className="methodology-rationale">
          Full multi-factor criticality methodologies (e.g., Graedel et al., 2012; Achzet &amp; Helbig, 2013; EU CRM) additionally incorporate substitutability, recycling rates, economic importance, and strategic stockpile levels. Our dataset does not include these factors, so our severity classification relies solely on production concentration — the dimension for which we have authoritative data.
        </p>

        <h4>Drill-Down Levels</h4>
        <p>The simulator provides a three-level hierarchical breakdown:</p>
        <ol>
          <li><strong>Technology level</strong>: severity, total materials/components affected, max share lost</li>
          <li><strong>Component level</strong>: which components use affected materials, per-component share loss</li>
          <li><strong>Material level</strong>: specific material name, share percentage, whether disrupted country is top producer, dependency type (constituent or process consumable)</li>
        </ol>
        <p>
          <strong>Note</strong>: Both constituent materials and process consumables are included in severity calculations. A manufacturing line can be shut down equally by loss of a constituent material (e.g., Indium for display manufacturing) or a critical process consumable (e.g., Helium for leak testing).
        </p>
      </section>

      <section className="methodology-section">
        <h3>6. Policy Analysis Templates</h3>
        <p>The Analyst tab provides 6 structured report templates that combine the above measures:</p>
        <table className="methodology-table">
          <thead>
            <tr><th>Template</th><th>Input</th><th>Data Sources</th><th>Output</th></tr>
          </thead>
          <tbody>
            <tr><td>Supply chain risks for [technology]</td><td>Technology name</td><td>Concentration (HHI), STDN table</td><td>Risk assessment with critical materials, HHI scores, top producers</td></tr>
            <tr><td>Disruption impact of [country]</td><td>Country name</td><td>Disruption simulation, country exposure</td><td>Affected technologies by severity, materials at risk</td></tr>
            <tr><td>Highest concentration risks</td><td>None</td><td>Concentration (HHI), overlap</td><td>Cross-technology HHI analysis, systemic chokepoints</td></tr>
            <tr><td>Country dominance of [country]</td><td>Country name</td><td>Country exposure, disruption simulation</td><td>Dominated materials, technologies affected, market share analysis</td></tr>
            <tr><td>Cross-technology shared materials</td><td>None</td><td>Overlap, concentration</td><td>Shared materials with HHI scores, systemic risk assessment</td></tr>
            <tr><td>Disruption impact of [material]</td><td>Material name</td><td>Concentration, overlap, country exposure</td><td>Affected technologies, producing countries, concentration risk, recommendations</td></tr>
          </tbody>
        </table>
        <p>All structured reports are generated deterministically from the STDN dataset — no LLM is used at runtime.</p>
      </section>

      <section className="methodology-section">
        <h3>Data Provenance</h3>
        <p>All country production share data flows from two sources:</p>
        <table className="methodology-table">
          <thead>
            <tr><th>Source</th><th>Coverage</th><th>Reliability</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>USGS Minerals Yearbook (2022–2025)</strong></td><td>~55 constituent minerals with global production data</td><td>Authoritative; U.S. government statistical publication</td></tr>
            <tr><td><strong>LLM Multi-Agent Consensus</strong></td><td>Process consumables and materials not in USGS database</td><td>Estimated; 3-agent debate with convergence threshold</td></tr>
          </tbody>
        </table>
        <p>
          The <code>provenance</code> field on each data row distinguishes these sources. USGS-sourced rows include non-zero production amounts in physical units; LLM-estimated rows have zero amounts and percentage-only estimates.
        </p>
      </section>
    </div>
  );
}
