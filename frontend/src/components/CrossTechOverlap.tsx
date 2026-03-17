import { useEffect, useMemo, useRef, useState } from "react";
import { useApi } from "../hooks/useApi";
import { MeasureDescription } from "./MeasureDescription";

interface TopProducer {
  country: string;
  share: number;
}

interface MaterialOverlap {
  material: string;
  num_technologies: number;
  technologies: string[];
  top_producers: TopProducer[];
  hhi: number;
}

interface CountryOverlap {
  country: string;
  num_technologies: number;
  technologies: string[];
  num_materials: number;
  materials: string[];
  avg_share: number;
}

interface ApiResponse {
  material_overlap: MaterialOverlap[];
  country_overlap: CountryOverlap[];
}

type Tab = "materials" | "countries";
type SortMode = "overlap" | "hhi" | "name";

function hhiColor(hhi: number): string {
  if (hhi >= 5000) return "rgba(239, 68, 68, 0.85)";
  if (hhi >= 2500) return "rgba(249, 115, 22, 0.7)";
  if (hhi >= 1500) return "rgba(245, 158, 11, 0.55)";
  return "rgba(34, 197, 94, 0.3)";
}

function overlapColor(num: number): string {
  if (num >= 6) return "rgba(239, 68, 68, 0.85)";
  if (num >= 4) return "rgba(249, 115, 22, 0.7)";
  if (num >= 3) return "rgba(245, 158, 11, 0.55)";
  return "rgba(34, 197, 94, 0.3)";
}

interface OverlapProps {
  highlightMaterial?: string | null;
  onHighlightClear?: () => void;
}

export function CrossTechOverlap({ highlightMaterial, onHighlightClear }: OverlapProps = {}) {
  const { data, loading, error } = useApi<ApiResponse>("/api/overlap");
  const [tab, setTab] = useState<Tab>("materials");
  const [sortMode, setSortMode] = useState<SortMode>("overlap");
  const [selectedMat, setSelectedMat] = useState<MaterialOverlap | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<CountryOverlap | null>(null);
  const highlightRowRef = useRef<HTMLTableRowElement>(null);

  // Auto-select material when navigated from Network tab
  useEffect(() => {
    if (highlightMaterial && data) {
      setTab("materials");
      const match = data.material_overlap.find((m) => m.material === highlightMaterial);
      if (match) {
        setSelectedMat(match);
      }
    }
  }, [highlightMaterial, data]);

  // Scroll to highlighted row
  useEffect(() => {
    if (highlightRowRef.current) {
      highlightRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedMat]);

  const sortedMaterials = useMemo(() => {
    if (!data) return [];
    const items = [...data.material_overlap];
    switch (sortMode) {
      case "overlap":
        items.sort((a, b) => b.num_technologies - a.num_technologies);
        break;
      case "hhi":
        items.sort((a, b) => b.hhi - a.hhi);
        break;
      case "name":
        items.sort((a, b) => a.material.localeCompare(b.material));
        break;
    }
    return items;
  }, [data, sortMode]);

  const sortedCountries = useMemo(() => {
    if (!data) return [];
    const items = [...data.country_overlap];
    switch (sortMode) {
      case "overlap":
        items.sort((a, b) => b.num_technologies - a.num_technologies);
        break;
      case "hhi":
        items.sort((a, b) => b.avg_share - a.avg_share);
        break;
      case "name":
        items.sort((a, b) => a.country.localeCompare(b.country));
        break;
    }
    return items;
  }, [data, sortMode]);

  if (loading) return <div className="graph-status">Loading overlap data...</div>;
  if (error) return <div className="graph-status error">Error: {error}</div>;
  if (!data) return null;

  return (
    <div className="exposure-container">
      <h2 className="heatmap-title">Cross-Technology Overlap: Systemic Risk</h2>
      <MeasureDescription measure="overlap" />
      <div className="heatmap-controls">
        <div className="overlap-tabs">
          <button
            className={`overlap-tab ${tab === "materials" ? "active" : ""}`}
            onClick={() => { setTab("materials"); setSelectedCountry(null); }}
          >
            Shared Materials ({data.material_overlap.length})
          </button>
          <button
            className={`overlap-tab ${tab === "countries" ? "active" : ""}`}
            onClick={() => { setTab("countries"); setSelectedMat(null); }}
          >
            Shared Countries ({data.country_overlap.length})
          </button>
        </div>
        <div className="heatmap-filter">
          <label htmlFor="overlap-sort">Sort by</label>
          <select
            id="overlap-sort"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
          >
            <option value="overlap">Technologies shared (most first)</option>
            <option value="hhi">{tab === "materials" ? "Concentration (HHI)" : "Avg. share"}</option>
            <option value="name">Name (A-Z)</option>
          </select>
        </div>
      </div>

      <div className="heatmap-body">
        <div className="heatmap-scroll">
          {tab === "materials" ? (
            <table className="exposure-table">
              <thead>
                <tr>
                  <th className="exposure-th sticky-col">Material</th>
                  <th className="exposure-th">Technologies</th>
                  <th className="exposure-th">Concentration</th>
                  <th className="exposure-th">Top Producer</th>
                  <th className="exposure-th">Share</th>
                </tr>
              </thead>
              <tbody>
                {sortedMaterials.map((entry) => {
                  const isSelected = selectedMat?.material === entry.material;
                  return (
                    <tr
                      key={entry.material}
                      ref={isSelected ? highlightRowRef : undefined}
                      className={`exposure-row ${isSelected ? "selected" : ""}`}
                      onClick={() => { setSelectedMat(isSelected ? null : entry); onHighlightClear?.(); }}
                    >
                      <td className="exposure-td sticky-col country-name">{entry.material}</td>
                      <td className="exposure-td">
                        <span className="risk-badge" style={{ background: overlapColor(entry.num_technologies) }}>
                          {entry.num_technologies}
                        </span>
                      </td>
                      <td className="exposure-td num">
                        <span className="risk-badge" style={{ background: hhiColor(entry.hhi) }}>
                          {Math.round(entry.hhi)}
                        </span>
                      </td>
                      <td className="exposure-td">{entry.top_producers[0]?.country ?? "—"}</td>
                      <td className="exposure-td num">{entry.top_producers[0]?.share ?? 0}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="exposure-table">
              <thead>
                <tr>
                  <th className="exposure-th sticky-col">Country</th>
                  <th className="exposure-th">Technologies</th>
                  <th className="exposure-th">Materials</th>
                  <th className="exposure-th">Avg Share</th>
                </tr>
              </thead>
              <tbody>
                {sortedCountries.map((entry) => {
                  const isSelected = selectedCountry?.country === entry.country;
                  return (
                    <tr
                      key={entry.country}
                      className={`exposure-row ${isSelected ? "selected" : ""}`}
                      onClick={() => setSelectedCountry(isSelected ? null : entry)}
                    >
                      <td className="exposure-td sticky-col country-name">{entry.country}</td>
                      <td className="exposure-td">
                        <span className="risk-badge" style={{ background: overlapColor(entry.num_technologies) }}>
                          {entry.num_technologies}
                        </span>
                      </td>
                      <td className="exposure-td num">{entry.num_materials}</td>
                      <td className="exposure-td num">{entry.avg_share}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="heatmap-sidebar">
          {tab === "materials" && selectedMat ? (
            <div className="heatmap-detail-panel">
              <h3>{selectedMat.material}</h3>
              <p className="heatmap-detail-tech">Shared across {selectedMat.num_technologies} technologies</p>
              <div className="detail-row">
                <span className="detail-label">Concentration (HHI)</span>
                <span className="detail-value">{selectedMat.hhi.toFixed(0)}</span>
              </div>
              <div className="detail-section">
                <span className="detail-label">Technologies</span>
                <div className="dominated-list">
                  {selectedMat.technologies.map((t) => (
                    <span key={t} className="overlap-tag tech">{t}</span>
                  ))}
                </div>
              </div>
              <div className="detail-section">
                <span className="detail-label">Top Producers</span>
                {selectedMat.top_producers.map((p, i) => (
                  <div key={i} className="detail-row">
                    <span className="detail-value">{p.country}</span>
                    <span className="detail-value">{p.share}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : tab === "countries" && selectedCountry ? (
            <div className="heatmap-detail-panel">
              <h3>{selectedCountry.country}</h3>
              <p className="heatmap-detail-tech">Supplies {selectedCountry.num_technologies} technologies</p>
              <div className="detail-row">
                <span className="detail-label">Materials Supplied</span>
                <span className="detail-value">{selectedCountry.num_materials}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Avg. Market Share</span>
                <span className="detail-value">{selectedCountry.avg_share}%</span>
              </div>
              <div className="detail-section">
                <span className="detail-label">Technologies</span>
                <div className="dominated-list">
                  {selectedCountry.technologies.map((t) => (
                    <span key={t} className="overlap-tag tech">{t}</span>
                  ))}
                </div>
              </div>
              <div className="detail-section">
                <span className="detail-label">Materials</span>
                <div className="dominated-list">
                  {selectedCountry.materials.map((m) => (
                    <span key={m} className="overlap-tag mat">{m}</span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="heatmap-sidebar-empty">
              <p>Click a row to see details</p>
            </div>
          )}
        </div>
      </div>

      <div className="heatmap-summary">
        {tab === "materials"
          ? `${sortedMaterials.length} materials shared across multiple technologies`
          : `${sortedCountries.length} countries supplying multiple technologies`}
      </div>
    </div>
  );
}
