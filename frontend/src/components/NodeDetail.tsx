interface NodeData {
  id: string;
  label: string;
  layer: string;
  confidence?: number;
  hs_code?: number;
}

export interface ConnectedEdge {
  label: string;
  percentage: number;
  amount: number;
  meas_unit: string;
  provenance: string;
  confidence: number;
}

function formatUnit(unit: string): string {
  const u = unit.toLowerCase().trim();
  if (u.includes("thousand") && u.includes("metric ton")) return "k MT";
  if (u.includes("metric ton")) return "MT";
  if (u.includes("kilogram")) return "kg";
  if (u.includes("thousand") && u.includes("carat")) return "k ct";
  if (u.includes("carat")) return "ct";
  if (u.includes("liter") || u.includes("litre")) return "L";
  if (!u) return "";
  return unit.trim();
}

interface Props {
  node: NodeData | null;
  connectedEdges?: ConnectedEdge[];
}

export function NodeDetail({ node, connectedEdges }: Props) {
  if (!node) {
    return (
      <div className="node-detail empty">
        <p>Click a node to see details</p>
      </div>
    );
  }

  const layerColors: Record<string, string> = {
    technology: "#6366f1",
    component: "#22c55e",
    material: "#f59e0b",
    country: "#ef4444",
  };

  return (
    <div className="node-detail">
      <div
        className="node-detail-badge"
        style={{ backgroundColor: layerColors[node.layer] ?? "#888" }}
      >
        {node.layer}
      </div>
      <h3>{node.label}</h3>
      {node.confidence != null && (
        <div className="detail-row">
          <span className="detail-label">Confidence</span>
          <span className="detail-value">
            {(node.confidence * 100).toFixed(0)}%
          </span>
        </div>
      )}
      {node.hs_code != null && (
        <div className="detail-row">
          <span className="detail-label">HS Code</span>
          <span className="detail-value">{node.hs_code}</span>
        </div>
      )}

      {/* Component detail: list materials */}
      {node.layer === "component" && connectedEdges && connectedEdges.length > 0 && (
        <div className="country-materials">
          <h4>Materials</h4>
          <table className="materials-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {connectedEdges.map((e, i) => (
                <tr key={i}>
                  <td>{e.label}</td>
                  <td>{(e.confidence * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Material detail: list producing countries */}
      {node.layer === "material" && connectedEdges && connectedEdges.length > 0 && (
        <div className="country-materials">
          <h4>Producing Countries</h4>
          <table className="materials-table">
            <thead>
              <tr>
                <th>Country</th>
                <th>Share</th>
                <th>Amount</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {connectedEdges.map((e, i) => (
                <tr key={i}>
                  <td>{e.label}</td>
                  <td>{e.percentage > 0 ? `${e.percentage.toFixed(1)}%` : "—"}</td>
                  <td>{e.amount > 0 ? `${e.amount.toLocaleString()} ${formatUnit(e.meas_unit)}` : "—"}</td>
                  <td>
                    <span className={`provenance-badge ${e.provenance.toLowerCase()}`}>
                      {e.provenance}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Country detail: list materials this country produces */}
      {node.layer === "country" && connectedEdges && connectedEdges.length > 0 && (
        <div className="country-materials">
          <h4>Production for this technology</h4>
          <table className="materials-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Share</th>
                <th>Amount</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {connectedEdges.map((e, i) => (
                <tr key={i}>
                  <td>{e.label}</td>
                  <td>{e.percentage > 0 ? `${e.percentage.toFixed(1)}%` : "—"}</td>
                  <td>{e.amount > 0 ? `${e.amount.toLocaleString()} ${formatUnit(e.meas_unit)}` : "—"}</td>
                  <td>
                    <span className={`provenance-badge ${e.provenance.toLowerCase()}`}>
                      {e.provenance}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
