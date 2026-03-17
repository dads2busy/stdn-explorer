import { useEffect, useMemo, useRef, useState } from "react";
import { useApi } from "../hooks/useApi";
import { MeasureDescription } from "./MeasureDescription";

interface TopProducer {
  country: string;
  share: number;
}

interface ConcentrationEntry {
  technology: string;
  material: string;
  hhi: number;
  top_producers: TopProducer[];
  num_countries: number;
}

interface ApiResponse {
  concentration: ConcentrationEntry[];
}

function hhiColor(hhi: number): string {
  if (hhi >= 5000) return "rgba(239, 68, 68, 0.85)";   // extreme — red
  if (hhi >= 2500) return "rgba(249, 115, 22, 0.7)";   // high — orange
  if (hhi >= 1500) return "rgba(245, 158, 11, 0.55)";  // medium — amber
  return "rgba(34, 197, 94, 0.3)";                      // low — green
}

function hhiLabel(hhi: number): string {
  if (hhi >= 5000) return "Extreme";
  if (hhi >= 2500) return "High";
  if (hhi >= 1500) return "Medium";
  return "Low";
}

type SortMode = "hhi-desc" | "hhi-asc" | "material" | "technology";

interface HeatmapProps {
  highlightMaterial?: string | null;
  highlightTechnology?: string | null;
  onHighlightClear?: () => void;
}

export function ConcentrationHeatmap({ highlightMaterial, highlightTechnology, onHighlightClear }: HeatmapProps = {}) {
  const { data, loading, error } = useApi<ApiResponse>("/api/concentration");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [filterTech, setFilterTech] = useState<string>("");
  const [sortMode, setSortMode] = useState<SortMode>("hhi-desc");
  const [focusedTech, setFocusedTech] = useState<string | null>(null);
  const [focusedMat, setFocusedMat] = useState<string | null>(null);
  const highlightRowRef = useRef<HTMLTableRowElement>(null);

  // Auto-focus material (and select cell) when navigated from Network tab
  useEffect(() => {
    if (highlightMaterial && data) {
      setFilterTech(""); // Show all technologies so the material row is visible
      setFocusedMat(highlightMaterial);
      if (highlightTechnology) {
        setFocusedTech(highlightTechnology);
        setSelectedKey(`${highlightTechnology}||${highlightMaterial}`);
      }
    }
  }, [highlightMaterial, highlightTechnology, data]);

  // Scroll to highlighted row
  useEffect(() => {
    if (highlightRowRef.current) {
      highlightRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusedMat]);

  const { technologies, materials, grid, filtered } = useMemo(() => {
    if (!data) return { technologies: [], materials: [], grid: new Map(), filtered: [] };

    let items = data.concentration;
    if (filterTech) {
      items = items.filter((e) => e.technology === filterTech);
    }

    const techs = [...new Set(items.map((e) => e.technology))].sort();
    const mats = [...new Set(items.map((e) => e.material))].sort();

    // Build lookup grid
    const g = new Map<string, ConcentrationEntry>();
    for (const e of items) {
      g.set(`${e.technology}||${e.material}`, e);
    }

    // Sort materials by max HHI across shown technologies
    const matMaxHhi = new Map<string, number>();
    for (const m of mats) {
      let max = 0;
      for (const t of techs) {
        const entry = g.get(`${t}||${m}`);
        if (entry && entry.hhi > max) max = entry.hhi;
      }
      matMaxHhi.set(m, max);
    }

    let sortedMats: string[];
    if (sortMode === "hhi-desc") {
      sortedMats = [...mats].sort((a, b) => (matMaxHhi.get(b) ?? 0) - (matMaxHhi.get(a) ?? 0));
    } else if (sortMode === "hhi-asc") {
      sortedMats = [...mats].sort((a, b) => (matMaxHhi.get(a) ?? 0) - (matMaxHhi.get(b) ?? 0));
    } else {
      sortedMats = mats;
    }

    return { technologies: techs, materials: sortedMats, grid: g, filtered: items };
  }, [data, filterTech, sortMode]);

  if (loading) return <div className="graph-status">Loading concentration data...</div>;
  if (error) return <div className="graph-status error">Error: {error}</div>;
  if (!data) return null;

  const allTechs = [...new Set(data.concentration.map((e) => e.technology))].sort();

  return (
    <div className="heatmap-container">
      <h2 className="heatmap-title">Material Country Concentration: Herfindahl-Hirschman Index (HHI) Score</h2>
      <MeasureDescription measure="concentration" />
      <div className="heatmap-controls">
        <div className="heatmap-filter">
          <label htmlFor="tech-filter">Filter by technology</label>
          <select
            id="tech-filter"
            value={filterTech}
            onChange={(e) => { setFilterTech(e.target.value); setSelectedKey(null); }}
          >
            <option value="">All technologies ({allTechs.length})</option>
            {allTechs.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="heatmap-filter">
          <label htmlFor="sort-mode">Sort materials by</label>
          <select
            id="sort-mode"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
          >
            <option value="hhi-desc">Concentration (highest first)</option>
            <option value="hhi-asc">Concentration (lowest first)</option>
            <option value="material">Name (A-Z)</option>
          </select>
        </div>
        <div className="heatmap-legend-inline">
          <span className="heatmap-legend-item" style={{ background: hhiColor(6000) }}>Extreme (&ge;5000)</span>
          <span className="heatmap-legend-item" style={{ background: hhiColor(3000) }}>High (&ge;2500)</span>
          <span className="heatmap-legend-item" style={{ background: hhiColor(2000) }}>Medium (&ge;1500)</span>
          <span className="heatmap-legend-item" style={{ background: hhiColor(500) }}>Low (&lt;1500)</span>
        </div>
      </div>

      <div className="heatmap-body">
        <div className="heatmap-scroll">
          <table className="heatmap-table">
            <thead>
              <tr>
                <th className="heatmap-corner">Material \ Technology</th>
                {technologies.map((t) => (
                  <th
                    key={t}
                    className={`heatmap-tech-header ${focusedTech === t ? "focused" : ""} ${focusedTech && focusedTech !== t ? "dimmed" : ""}`}
                    onClick={() => setFocusedTech(focusedTech === t ? null : t)}
                  >
                    <div className="heatmap-tech-label">{t}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {materials.map((mat) => {
                const rowFocused = focusedMat === mat;
                const rowLabelDimmed = focusedMat && !rowFocused;
                return (
                <tr key={mat} ref={rowFocused ? highlightRowRef : undefined}>
                  <td
                    className={`heatmap-row-label ${rowFocused ? "focused" : ""} ${rowLabelDimmed ? "dimmed" : ""}`}
                    onClick={() => { setFocusedMat(focusedMat === mat ? null : mat); onHighlightClear?.(); }}
                  >
                    {mat}
                  </td>
                  {technologies.map((tech) => {
                    const cellKey = `${tech}||${mat}`;
                    const entry = grid.get(cellKey);
                    const colFocused = focusedTech === tech;
                    const inFocusedRow = rowFocused;
                    const inFocusedCol = colFocused;
                    const hasFocus = focusedTech || focusedMat;
                    const cellHighlighted = inFocusedRow || inFocusedCol;
                    const cellDimmed = hasFocus && !cellHighlighted;
                    if (!entry) return <td key={tech} className={`heatmap-cell empty ${cellHighlighted ? "focused" : ""} ${cellDimmed ? "dimmed" : ""}`} />;
                    const isSelected = selectedKey === cellKey;
                    return (
                      <td
                        key={tech}
                        className={`heatmap-cell ${isSelected ? "selected" : ""} ${cellHighlighted ? "focused" : ""} ${cellDimmed ? "dimmed" : ""}`}
                        style={{ background: hhiColor(entry.hhi) }}
                        onClick={() => { setSelectedKey(isSelected ? null : cellKey); setFocusedTech(isSelected ? null : tech); setFocusedMat(isSelected ? null : mat); }}
                        title={`${tech} / ${mat}: Concentration ${entry.hhi.toFixed(0)}`}
                      >
                        <span className="heatmap-cell-value">{Math.round(entry.hhi)}</span>
                      </td>
                    );
                  })}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="heatmap-sidebar">
          {selectedKey && grid.get(selectedKey) ? (() => {
            const selected = grid.get(selectedKey)!;
            return (
            <div className="heatmap-detail-panel">
              <h3>{selected.material}</h3>
              <p className="heatmap-detail-tech">{selected.technology}</p>
              <div className="detail-row">
                <span className="detail-label">Concentration Score</span>
                <span className="detail-value">{selected.hhi.toFixed(1)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Concentration</span>
                <span className="detail-value">{hhiLabel(selected.hhi)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Producing Countries</span>
                <span className="detail-value">{selected.num_countries}</span>
              </div>
              <div className="detail-section">
                <span className="detail-label">Top Producers</span>
                {selected.top_producers.map((p, i) => (
                  <div key={i} className="detail-row">
                    <span className="detail-value">{p.country}</span>
                    <span className="detail-value">{p.share}%</span>
                  </div>
                ))}
              </div>
            </div>
            );
          })() : (
            <div className="heatmap-sidebar-empty">
              <p>Click a cell to see details</p>
            </div>
          )}
        </div>
      </div>

      <div className="heatmap-summary">
        Showing {filtered.length} material-technology pairs across {technologies.length} technologies and {materials.length} materials
      </div>
    </div>
  );
}
