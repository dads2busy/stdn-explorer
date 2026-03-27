import { useEffect, useMemo, useRef, useState } from "react";
import { useApi } from "../hooks/useApi";
import { MeasureDescription } from "./MeasureDescription";

interface TopMaterial {
  material: string;
  share: number;
}

interface CountryExposureEntry {
  country: string;
  num_technologies: number;
  num_materials: number;
  num_dominated: number;
  dominated_materials: { material: string; dependency_type: string }[];
  avg_share: number;
  max_share: number;
  top_materials: TopMaterial[];
}

interface ApiResponse {
  exposures: CountryExposureEntry[];
}

type SortField = "dominated" | "technologies" | "materials" | "avg_share" | "max_share" | "country";

function riskColor(dominated: number): string {
  if (dominated >= 10) return "rgba(239, 68, 68, 0.85)";  // extreme
  if (dominated >= 5) return "rgba(249, 115, 22, 0.7)";   // high
  if (dominated >= 2) return "rgba(245, 158, 11, 0.55)";  // medium
  return "rgba(34, 197, 94, 0.3)";                         // low
}

function dominanceLabel(dominated: number): string {
  if (dominated >= 10) return "Critical";
  if (dominated >= 5) return "High";
  if (dominated >= 2) return "Moderate";
  return "Low";
}

interface ExposureProps {
  domain: string;
  includePC: boolean;
  highlightCountry?: string | null;
  onHighlightClear?: () => void;
}

export function CountryExposure({ domain, includePC, highlightCountry, onHighlightClear }: ExposureProps) {
  const { data, loading, error } = useApi<ApiResponse>("/api/country-exposure", domain, includePC);
  const [selected, setSelected] = useState<CountryExposureEntry | null>(null);
  const [sortField, setSortField] = useState<SortField>("dominated");
  const [filterRisk, setFilterRisk] = useState<string>("");
  const highlightRowRef = useRef<HTMLTableRowElement>(null);

  // Auto-select country when navigated from Network tab
  useEffect(() => {
    if (highlightCountry && data) {
      setFilterRisk(""); // Clear filter so the country is visible
      const match = data.exposures.find((e) => e.country === highlightCountry);
      if (match) {
        setSelected(match);
      }
    }
  }, [highlightCountry, data]);

  // Scroll to highlighted row
  useEffect(() => {
    if (highlightRowRef.current) {
      highlightRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selected]);

  const sorted = useMemo(() => {
    if (!data) return [];
    let items = [...data.exposures];

    if (filterRisk) {
      items = items.filter((e) => dominanceLabel(e.num_dominated) === filterRisk);
    }

    switch (sortField) {
      case "dominated":
        items.sort((a, b) => b.num_dominated - a.num_dominated);
        break;
      case "technologies":
        items.sort((a, b) => b.num_technologies - a.num_technologies);
        break;
      case "materials":
        items.sort((a, b) => b.num_materials - a.num_materials);
        break;
      case "avg_share":
        items.sort((a, b) => b.avg_share - a.avg_share);
        break;
      case "max_share":
        items.sort((a, b) => b.max_share - a.max_share);
        break;
      case "country":
        items.sort((a, b) => a.country.localeCompare(b.country));
        break;
    }
    return items;
  }, [data, sortField, filterRisk]);

  if (loading) return <div className="graph-status">Loading country dominance data...</div>;
  if (error) return <div className="graph-status error">Error: {error}</div>;
  if (!data) return null;

  return (
    <div className="exposure-container">
      <h2 className="heatmap-title">Country Supply Chain (Material) Dominance</h2>
      <MeasureDescription measure="dominance" />
      <div className="heatmap-controls">
        <div className="heatmap-filter">
          <label htmlFor="risk-filter">Filter by dominance</label>
          <select
            id="risk-filter"
            value={filterRisk}
            onChange={(e) => { setFilterRisk(e.target.value); setSelected(null); }}
          >
            <option value="">All ({data.exposures.length} countries)</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Moderate">Moderate</option>
            <option value="Low">Low</option>
          </select>
        </div>
        <div className="heatmap-filter">
          <label htmlFor="sort-field">Sort by</label>
          <select
            id="sort-field"
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
          >
            <option value="dominated">Dominated materials</option>
            <option value="technologies">Technologies affected</option>
            <option value="materials">Total materials</option>
            <option value="avg_share">Avg. market share</option>
            <option value="max_share">Max market share</option>
            <option value="country">Country (A-Z)</option>
          </select>
        </div>
        <div className="heatmap-legend-inline">
          <span className="heatmap-legend-item" style={{ background: riskColor(10) }}>Critical (&ge;10)</span>
          <span className="heatmap-legend-item" style={{ background: riskColor(5) }}>High (&ge;5)</span>
          <span className="heatmap-legend-item" style={{ background: riskColor(2) }}>Moderate (&ge;2)</span>
          <span className="heatmap-legend-item" style={{ background: riskColor(0) }}>Low (&lt;2)</span>
        </div>
      </div>

      <div className="heatmap-body">
        <div className="heatmap-scroll">
          <table className="exposure-table">
            <thead>
              <tr>
                <th className="exposure-th sticky-col">Country</th>
                <th className="exposure-th">Dominance</th>
                <th className="exposure-th">Top Producer Count</th>
                <th className="exposure-th">Technologies</th>
                <th className="exposure-th">Materials</th>
                <th className="exposure-th">Avg Share</th>
                <th className="exposure-th">Max Share</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry) => {
                const isSelected = selected === entry;
                return (
                  <tr
                    key={entry.country}
                    ref={isSelected ? highlightRowRef : undefined}
                    className={`exposure-row ${isSelected ? "selected" : ""}`}
                    onClick={() => { setSelected(isSelected ? null : entry); onHighlightClear?.(); }}
                  >
                    <td className="exposure-td sticky-col country-name">{entry.country}</td>
                    <td className="exposure-td">
                      <span className="risk-badge" style={{ background: riskColor(entry.num_dominated) }}>
                        {dominanceLabel(entry.num_dominated)}
                      </span>
                    </td>
                    <td className="exposure-td num">{entry.num_dominated}</td>
                    <td className="exposure-td num">{entry.num_technologies}</td>
                    <td className="exposure-td num">{entry.num_materials}</td>
                    <td className="exposure-td num">{entry.avg_share}%</td>
                    <td className="exposure-td num">{entry.max_share}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="heatmap-sidebar">
          {selected ? (
            <div className="heatmap-detail-panel">
              <h3>{selected.country}</h3>
              <p className="heatmap-detail-tech">{dominanceLabel(selected.num_dominated)} supply chain dominance</p>
              <div className="detail-row">
                <span className="detail-label">Technologies Affected</span>
                <span className="detail-value">{selected.num_technologies}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Materials Produced</span>
                <span className="detail-value">{selected.num_materials}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Materials Dominated</span>
                <span className="detail-value">{selected.num_dominated}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Avg. Market Share</span>
                <span className="detail-value">{selected.avg_share}%</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Max Market Share</span>
                <span className="detail-value">{selected.max_share}%</span>
              </div>

              {selected.top_materials.length > 0 && (
                <div className="detail-section">
                  <span className="detail-label">Top Materials by Share</span>
                  {selected.top_materials.map((m, i) => (
                    <div key={i} className="detail-row">
                      <span className="detail-value">{m.material}</span>
                      <span className="detail-value">{m.share}%</span>
                    </div>
                  ))}
                </div>
              )}

              {selected.dominated_materials.length > 0 && (
                <div className="detail-section">
                  <span className="detail-label">Dominated Materials</span>
                  <div className="dominated-list">
                    {selected.dominated_materials.map((m) => (
                      <span key={m.material} className="dominated-tag">
                        {m.material}
                        {m.dependency_type === "process_consumable" && (
                          <span className="badge-pc-small" title="Process Consumable">PC</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="heatmap-sidebar-empty">
              <p>Click a country to see details</p>
            </div>
          )}
        </div>
      </div>

      <div className="heatmap-summary">
        Showing {sorted.length} countries
      </div>
    </div>
  );
}
