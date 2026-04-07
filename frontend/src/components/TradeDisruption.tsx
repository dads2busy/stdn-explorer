import { useState, useEffect } from "react";
import { useApi, apiUrl, isStatic } from "../hooks/useApi";
import { MeasureDescription } from "./MeasureDescription";

// --- Type definitions ---

interface DisruptionCell {
  material: string;
  year: number;
  countries: string[];
  score: number;
  worst_hs: string;
}

interface CountryScore {
  country: string;
  material: string;
  aggregate_score: number;
}

interface DisruptionResponse {
  materials: string[];
  years: number[];
  cells: DisruptionCell[];
  country_scores: CountryScore[];
}

interface SubEntry {
  material: string;
  k: number;
  distinct_countries: number;
  countries: string[];
  max_possible: number;
}

interface SubstitutabilityResponse {
  materials: string[];
  years: number[];
  num_years: number;
  entries: SubEntry[];
}

interface ComtradeOverview {
  available: boolean;
  materials: string[];
  years: number[];
}

// --- Helpers ---

function scoreColor(composite: number): string {
  if (composite === 0) return "transparent";
  if (composite >= 0.75) return "rgba(239, 68, 68, 0.85)";
  if (composite >= 0.5) return "rgba(249, 115, 22, 0.7)";
  if (composite >= 0.25) return "rgba(245, 158, 11, 0.55)";
  return "rgba(34, 197, 94, 0.3)";
}

type SubView = "heatmap" | "substitutability";

// --- Component ---

export function TradeDisruption({
  domain,
  includePC,
}: {
  domain: string;
  includePC: boolean;
}) {
  const [subView, setSubView] = useState<SubView>("heatmap");
  const [k, setK] = useState(1);
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);

  // Check if Comtrade data is available
  const { data: overview } = useApi<ComtradeOverview>(
    "/api/comtrade/overview",
    domain,
    includePC,
  );

  // Fetch disruption data (heatmap view)
  const [disruptionData, setDisruptionData] = useState<DisruptionResponse | null>(null);
  const [disruptionLoading, setDisruptionLoading] = useState(false);

  useEffect(() => {
    if (!overview?.available) return;
    setDisruptionLoading(true);
    const path = isStatic
      ? `/api/comtrade/disruption_k${k}`
      : `/api/comtrade/disruption?k=${k}`;
    fetch(apiUrl(path, domain, includePC))
      .then((r) => r.json())
      .then((d) => setDisruptionData(d))
      .catch(() => setDisruptionData(null))
      .finally(() => setDisruptionLoading(false));
  }, [k, overview?.available, domain, includePC]);

  // Fetch substitutability data
  const { data: subData } = useApi<SubstitutabilityResponse>(
    overview?.available ? "/api/comtrade/substitutability" : null,
    domain,
    includePC,
  );

  if (!overview?.available) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2 className="heatmap-title">Trade Disruption Analysis — What if US imports from these countries are blocked?</h2>
        <p style={{ opacity: 0.6 }}>
          No Comtrade trade flow data available. Generate data with{" "}
          <code>lia stdn-export</code> and place the CSV in{" "}
          <code>data/comtrade/</code>.
        </p>
      </div>
    );
  }

  // --- Heatmap data processing ---
  const heatmapCountries: string[] = [];
  const heatmapMaterials = disruptionData?.materials ?? [];
  const scoreMap = new Map<string, number>();

  if (disruptionData) {
    const totalYears = disruptionData.years.length;
    // Collect per-year disruption scores by (country, material)
    const cellScores = new Map<string, number[]>();
    for (const cell of disruptionData.cells) {
      if (cell.score === 0 || cell.countries.length === 0) continue;
      for (const country of cell.countries) {
        const key = `${country}||${cell.material}`;
        if (!cellScores.has(key)) cellScores.set(key, []);
        cellScores.get(key)!.push(cell.score);
      }
    }

    // Compute composite: avg_score × (years_in_set / total_years)
    const countrySet = new Set<string>();
    const countryTotals = new Map<string, number>();
    for (const [key, scores] of cellScores) {
      const [country] = key.split("||");
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const composite = avgScore * (scores.length / totalYears);
      scoreMap.set(key, composite);
      countrySet.add(country);
      countryTotals.set(
        country,
        (countryTotals.get(country) ?? 0) + composite,
      );
    }

    heatmapCountries.push(
      ...Array.from(countrySet).sort(
        (a, b) => (countryTotals.get(b) ?? 0) - (countryTotals.get(a) ?? 0),
      ),
    );
  }

  // --- Material detail: yearly disruption sets ---
  const materialCells = selectedMaterial
    ? (disruptionData?.cells ?? []).filter((c) => c.material === selectedMaterial)
    : [];

  return (
    <div className="heatmap-container">
      <h2 className="heatmap-title">Trade Disruption Analysis — What if US imports from these countries are blocked?</h2>
      <MeasureDescription measure="trade_disruption" />

      {/* Sub-view tabs */}
      <div style={{ display: "flex", gap: "0.5rem", margin: "1rem 0" }}>
        <button
          className={`tab ${subView === "heatmap" ? "active" : ""}`}
          onClick={() => setSubView("heatmap")}
        >
          Disruption Heatmap
        </button>
        <button
          className={`tab ${subView === "substitutability" ? "active" : ""}`}
          onClick={() => setSubView("substitutability")}
        >
          Substitutability
        </button>
      </div>

      {subView === "heatmap" && (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          {/* k selector */}
          <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
            <label style={{ fontSize: "0.85rem", opacity: 0.7 }}>
              Disruption set size (k):
            </label>
            {[1, 2, 3].map((kVal) => (
              <button
                key={kVal}
                className={`tab ${k === kVal ? "active" : ""}`}
                onClick={() => setK(kVal)}
                style={{ minWidth: "2.5rem" }}
              >
                {kVal}
              </button>
            ))}
          </div>

          {disruptionLoading ? (
            <p style={{ opacity: 0.5 }}>Computing disruption sets...</p>
          ) : disruptionData ? (
            <div className="heatmap-body">
              {/* Heatmap grid */}
              <div className="heatmap-scroll">
                <table className="heatmap-table">
                  <thead>
                    <tr>
                      <th style={{ position: "sticky", left: 0, zIndex: 2 }}>
                        Country \ Material
                      </th>
                      {heatmapMaterials.map((mat) => (
                        <th
                          key={mat}
                          onClick={() => setSelectedMaterial(mat)}
                          style={{ cursor: "pointer", writingMode: "vertical-rl" }}
                          className={selectedMaterial === mat ? "focused" : ""}
                        >
                          {mat}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmapCountries.map((country) => (
                      <tr key={country}>
                        <td
                          style={{
                            position: "sticky",
                            left: 0,
                            zIndex: 1,
                            fontWeight: 500,
                            fontSize: "0.8rem",
                          }}
                        >
                          {country}
                        </td>
                        {heatmapMaterials.map((mat) => {
                          const score =
                            scoreMap.get(`${country}||${mat}`) ?? 0;
                          return (
                            <td
                              key={mat}
                              style={{
                                background: scoreColor(score),
                                textAlign: "center",
                                fontSize: "0.75rem",
                                minWidth: "2.5rem",
                                cursor: "pointer",
                              }}
                              onClick={() => setSelectedMaterial(mat)}
                              title={`${country} → ${mat}: ${(score * 100).toFixed(0)}% composite risk`}
                            >
                              {score > 0 ? `${(score * 100).toFixed(0)}%` : ""}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ fontSize: "0.75rem", opacity: 0.5, marginTop: "0.5rem" }}>
                  Cell = composite risk (avg disruption score × frequency ratio) for k={k}.
                  Countries sorted by total composite risk.
                </p>
              </div>

              {/* Detail panel */}
              <div className="heatmap-sidebar">
                {selectedMaterial ? (
                  <div className="sidebar-panel">
                    <h3>{selectedMaterial}</h3>
                    <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                      Year-by-year max disruption sets (k={k})
                    </p>
                    <table style={{ width: "100%", fontSize: "0.8rem" }}>
                      <thead>
                        <tr>
                          <th>Year</th>
                          <th>Countries</th>
                          <th>Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materialCells
                          .sort((a, b) => a.year - b.year)
                          .map((cell) => (
                            <tr key={cell.year}>
                              <td>{cell.year}</td>
                              <td>{cell.countries.join(", ")}</td>
                              <td>{(cell.score * 100).toFixed(1)}%</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="sidebar-panel empty">
                    <p>Click a material column to see year-by-year disruption details.</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {subView === "substitutability" && subData && (
        <div>
          <p style={{ fontSize: "0.85rem", opacity: 0.7, marginBottom: "1rem" }}>
            Number of distinct countries in the top-k supplier set across {subData.num_years} years
            ({subData.years[0]}–{subData.years[subData.years.length - 1]}).
            Fewer countries = higher lock-in. Three bars per material for k = 1, 2, 3.
          </p>

          <div style={{ display: "flex", gap: "1.5rem" }}>
            <div style={{ flex: 1, overflow: "auto", maxHeight: "75vh" }}>
              <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "0.4rem" }}>Material</th>
                    <th style={{ textAlign: "center", padding: "0.4rem" }}>k=1</th>
                    <th style={{ textAlign: "center", padding: "0.4rem" }}>k=2</th>
                    <th style={{ textAlign: "center", padding: "0.4rem" }}>k=3</th>
                  </tr>
                </thead>
                <tbody>
                  {subData.materials.map((mat) => {
                    const getEntry = (kVal: number) =>
                      subData.entries.find(
                        (e) => e.material === mat && e.k === kVal,
                      );
                    return (
                      <tr
                        key={mat}
                        onClick={() => setSelectedMaterial(mat)}
                        style={{
                          cursor: "pointer",
                          background:
                            selectedMaterial === mat
                              ? "rgba(99, 102, 241, 0.15)"
                              : undefined,
                        }}
                      >
                        <td style={{ padding: "0.4rem", fontWeight: 500 }}>
                          {mat}
                        </td>
                        {[1, 2, 3].map((kVal) => {
                          const entry = getEntry(kVal);
                          if (!entry) return <td key={kVal}>-</td>;
                          const ratio =
                            entry.distinct_countries / entry.max_possible;
                          return (
                            <td
                              key={kVal}
                              style={{ textAlign: "center", padding: "0.4rem" }}
                            >
                              <div
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.3rem",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${Math.max(ratio * 80, 8)}px`,
                                    height: "14px",
                                    background:
                                      ratio <= 0.3
                                        ? "rgba(239, 68, 68, 0.7)"
                                        : ratio <= 0.6
                                          ? "rgba(245, 158, 11, 0.7)"
                                          : "rgba(34, 197, 94, 0.5)",
                                    borderRadius: "2px",
                                  }}
                                />
                                <span>{entry.distinct_countries}</span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p style={{ fontSize: "0.75rem", opacity: 0.5, marginTop: "0.5rem" }}>
                Red bars = low substitutability (few distinct suppliers). Green = high substitutability.
              </p>
            </div>

            {/* Detail panel */}
            <div style={{ width: "320px", flexShrink: 0 }}>
              {selectedMaterial ? (
                <div className="sidebar-panel">
                  <h3>{selectedMaterial}</h3>
                  {[1, 2, 3].map((kVal) => {
                    const entry = subData.entries.find(
                      (e) =>
                        e.material === selectedMaterial && e.k === kVal,
                    );
                    if (!entry) return null;
                    return (
                      <div key={kVal} style={{ marginBottom: "0.8rem" }}>
                        <strong style={{ fontSize: "0.8rem" }}>
                          k={kVal}: {entry.distinct_countries} distinct
                          countries
                        </strong>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            opacity: 0.5,
                            marginLeft: "0.5rem",
                          }}
                        >
                          (max possible: {entry.max_possible})
                        </span>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            marginTop: "0.2rem",
                            opacity: 0.8,
                          }}
                        >
                          {entry.countries.join(", ")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="sidebar-panel empty">
                  <p>Click a material row to see supplier details.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
