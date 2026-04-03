import { useEffect, useState } from "react";
import { useApi, apiUrl } from "../hooks/useApi";
import { MeasureDescription } from "./MeasureDescription";
import { SearchableSelect } from "./SearchableSelect";

interface MaterialImpact {
  material: string;
  share: number;
  is_top_producer: boolean;
  dependency_type?: string;
}

interface ComponentImpact {
  component: string;
  materials: MaterialImpact[];
}

interface TechImpact {
  technology: string;
  num_materials_affected: number;
  num_components_affected: number;
  max_share_lost: number;
  top_producer_count: number;
  severity: string;
  materials: MaterialImpact[];
  components: ComponentImpact[];
}

interface DisruptionSummary {
  country: string;
  total_technologies_affected: number;
  total_materials_affected: number;
  total_components_affected: number;
  critical_count: number;
  high_count: number;
}

interface DisruptionResponse {
  country: string;
  affected_technologies: TechImpact[];
  summary: DisruptionSummary;
}

interface CountryListResponse {
  countries: { country: string; count: number }[];
}

function severityColor(severity: string): string {
  switch (severity) {
    case "Critical": return "rgba(239, 68, 68, 0.85)";
    case "High": return "rgba(249, 115, 22, 0.7)";
    case "Moderate": return "rgba(245, 158, 11, 0.55)";
    default: return "rgba(34, 197, 94, 0.3)";
  }
}

interface DisruptionProps {
  domain: string;
  includePC: boolean;
}

export function DisruptionSimulator({ domain, includePC }: DisruptionProps) {
  const { data: countriesData } = useApi<CountryListResponse>("/api/countries", domain, includePC);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [result, setResult] = useState<DisruptionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTech, setExpandedTech] = useState<string | null>(null);
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!selectedCountry && countriesData?.countries.length) {
      runSimulation(countriesData.countries[0].country);
    }
  }, [countriesData]);

  const runSimulation = async (country: string) => {
    if (!country) return;
    setSelectedCountry(country);
    setLoading(true);
    setError(null);
    setExpandedTech(null);
    setExpandedComponents(new Set());
    try {
      const res = await fetch(apiUrl(`/api/disruption/${encodeURIComponent(country)}`, domain, includePC));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to simulate");
    } finally {
      setLoading(false);
    }
  };

  const toggleTech = (tech: string) => {
    if (expandedTech === tech) {
      setExpandedTech(null);
      setExpandedComponents(new Set());
    } else {
      setExpandedTech(tech);
      setExpandedComponents(new Set());
    }
  };

  const toggleComponent = (key: string) => {
    setExpandedComponents((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="exposure-container">
      <h2 className="heatmap-title">Supply Disruption Analysis — What if this country stops producing?</h2>
      <MeasureDescription measure="disruption" />
      <div className="heatmap-controls">
        <div className="heatmap-filter">
          <label htmlFor="disrupt-country">Disrupt supply from</label>
          <SearchableSelect
            id="disrupt-country"
            options={
              countriesData?.countries.map((c) => ({
                value: c.country,
                label: `${c.country} (${c.count} supply links)`,
              })) ?? []
            }
            value={selectedCountry}
            onChange={(v) => runSimulation(v)}
            placeholder="Search countries..."
          />
        </div>
        {result && result.summary && (
          <div className="disruption-summary-badges">
            <span className="risk-badge" style={{ background: severityColor("Critical") }}>
              {result.summary.critical_count} Critical
            </span>
            <span className="risk-badge" style={{ background: severityColor("High") }}>
              {result.summary.high_count} High
            </span>
            <span className="disruption-stat">
              {result.summary.total_technologies_affected} technologies affected
            </span>
            <span className="disruption-stat">
              {result.summary.total_components_affected} components affected
            </span>
            <span className="disruption-stat">
              {result.summary.total_materials_affected} materials affected
            </span>
          </div>
        )}
      </div>

      <div className="heatmap-body">
        <div className="heatmap-scroll">
          {loading && <div className="graph-status">Simulating disruption...</div>}
          {error && <div className="graph-status error">Error: {error}</div>}
          {!selectedCountry && !loading && (
            <div className="disruption-placeholder">
              <h3>Select a country to simulate supply chain disruption</h3>
              <p>See which technologies and materials would be affected if a country's supply were disrupted.</p>
            </div>
          )}
          {result && result.affected_technologies.length > 0 && (
            <table className="exposure-table">
              <thead>
                <tr>
                  <th className="exposure-th sticky-col">Technology / Component / Material</th>
                  <th className="exposure-th">Severity</th>
                  <th className="exposure-th">Components</th>
                  <th className="exposure-th">Materials</th>
                  <th className="exposure-th">Max Share Lost</th>
                  <th className="exposure-th">Top Producer For</th>
                </tr>
              </thead>
              <tbody>
                {result.affected_technologies.map((tech) => {
                  const isTechExpanded = expandedTech === tech.technology;
                  return (
                    <>
                      <tr
                        key={tech.technology}
                        className={`exposure-row ${isTechExpanded ? "selected" : ""}`}
                        onClick={() => toggleTech(tech.technology)}
                      >
                        <td className="exposure-td sticky-col country-name">{tech.technology}</td>
                        <td className="exposure-td">
                          <span className="risk-badge" style={{ background: severityColor(tech.severity) }}>
                            {tech.severity}
                          </span>
                        </td>
                        <td className="exposure-td num">{tech.num_components_affected}</td>
                        <td className="exposure-td num">{tech.num_materials_affected}</td>
                        <td className="exposure-td num">{tech.max_share_lost}%</td>
                        <td className="exposure-td num">{tech.top_producer_count}</td>
                      </tr>
                      {isTechExpanded && tech.components.map((comp) => {
                        const compKey = `${tech.technology}::${comp.component}`;
                        const isCompExpanded = expandedComponents.has(compKey);
                        return (
                          <>
                            <tr
                              key={compKey}
                              className={`disruption-component-row ${isCompExpanded ? "selected" : ""}`}
                              onClick={(e) => { e.stopPropagation(); toggleComponent(compKey); }}
                            >
                              <td className="exposure-td sticky-col disruption-component-name">
                                {comp.component}
                              </td>
                              <td className="exposure-td" />
                              <td className="exposure-td" />
                              <td className="exposure-td num">{comp.materials.length}</td>
                              <td className="exposure-td num">
                                {Math.max(...comp.materials.map((m) => m.share))}%
                              </td>
                              <td className="exposure-td num">
                                {comp.materials.filter((m) => m.is_top_producer).length}
                              </td>
                            </tr>
                            {isCompExpanded && comp.materials.map((mat) => (
                              <tr key={`${compKey}::${mat.material}`} className="disruption-detail-row">
                                <td className="exposure-td sticky-col disruption-material-name">
                                  {mat.material}
                                  {mat.dependency_type === "process_consumable" && (
                                    <span className="badge-pc-small" title="Process Consumable">PC</span>
                                  )}
                                </td>
                                <td className="exposure-td">
                                  {mat.is_top_producer && (
                                    <span className="risk-badge" style={{ background: "rgba(239, 68, 68, 0.6)" }}>
                                      Top Producer
                                    </span>
                                  )}
                                </td>
                                <td className="exposure-td" />
                                <td className="exposure-td" />
                                <td className="exposure-td num">{mat.share}%</td>
                                <td className="exposure-td" />
                              </tr>
                            ))}
                          </>
                        );
                      })}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
          {result && result.affected_technologies.length === 0 && (
            <div className="disruption-placeholder">
              <h3>No affected technologies found</h3>
              <p>This country does not appear as a significant supplier in the dataset.</p>
            </div>
          )}
        </div>

        <div className="heatmap-sidebar">
          {result && expandedTech ? (() => {
            const tech = result.affected_technologies.find((t) => t.technology === expandedTech);
            if (!tech) return null;
            return (
              <div className="heatmap-detail-panel">
                <h3>{tech.technology}</h3>
                <p className="heatmap-detail-tech">
                  Impact from {result.country} disruption
                </p>
                <div className="detail-row">
                  <span className="detail-label">Severity</span>
                  <span className="detail-value" style={{ color: severityColor(tech.severity).replace(/[\d.]+\)$/, "1)") }}>
                    {tech.severity}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Components Affected</span>
                  <span className="detail-value">{tech.num_components_affected}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Materials Affected</span>
                  <span className="detail-value">{tech.num_materials_affected}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Max Share Lost</span>
                  <span className="detail-value">{tech.max_share_lost}%</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Top Producer For</span>
                  <span className="detail-value">{tech.top_producer_count} materials</span>
                </div>
                {tech.components.map((comp) => (
                  <div key={comp.component} className="detail-section">
                    <span className="detail-label">{comp.component}</span>
                    {comp.materials.map((m, i) => (
                      <div key={i} className="detail-row">
                        <span className="detail-value">
                          {m.material}
                          {m.is_top_producer && " ★"}
                          {m.dependency_type === "process_consumable" && (
                            <span className="badge-pc-small" title="Process Consumable">PC</span>
                          )}
                        </span>
                        <span className="detail-value">{m.share}%</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })() : (
            <div className="heatmap-sidebar-empty">
              <p>{result ? "Click a technology to see details" : "Run a simulation to see results"}</p>
            </div>
          )}
        </div>
      </div>

      {result && (
        <div className="heatmap-summary">
          Disrupting {result.country}: {result.affected_technologies.length} technologies affected
        </div>
      )}
    </div>
  );
}
