import { useRef, useEffect, useMemo, useState } from "react";
import cytoscape from "cytoscape";
import type { Core, EventObject } from "cytoscape";
import { useApi } from "../hooks/useApi";
import { NodeDetail } from "./NodeDetail";
import type { ConnectedEdge } from "./NodeDetail";

interface GraphData {
  nodes: { data: Record<string, unknown> }[];
  edges: { data: Record<string, unknown> }[];
}

interface Props {
  technology: string;
  includePC: boolean;
  onNavigate?: (view: string, material: string) => void;
}

const LAYER_COLORS: Record<string, string> = {
  technology: "#6366f1",
  component: "#22c55e",
  material: "#f59e0b",
  country: "#ef4444",
};

// Concentric ring radii per layer
const LAYER_RADIUS: Record<string, number> = {
  technology: 0,
  component: 135,
  material: 270,
  country: 390,
};

function hhiBin(hhi: number): string {
  if (hhi >= 5000) return "#ef4444"; // extreme
  if (hhi >= 2500) return "#f97316"; // high
  if (hhi >= 1500) return "#f59e0b"; // medium
  return "#22c55e"; // low
}

export function StdnGraph({ technology, includePC, onNavigate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [selectedNode, setSelectedNode] = useState<Record<string, unknown> | null>(null);
  const [connectedEdges, setConnectedEdges] = useState<ConnectedEdge[]>([]);

  const pcParam = includePC ? "" : "?include_process_consumables=false";
  const { data, loading, error } = useApi<GraphData>(
    `/api/stdn/${encodeURIComponent(technology)}${pcParam}`
  );
  const { data: overlapData } = useApi<{ material_overlap: { material: string }[] }>(`/api/overlap${pcParam}`);
  const overlapMaterials = useMemo(() => {
    if (!overlapData) return new Set<string>();
    return new Set(overlapData.material_overlap.map((m) => m.material));
  }, [overlapData]);

  useEffect(() => {
    if (!containerRef.current || !data || data.nodes.length === 0) return;

    // Group nodes by layer for concentric positioning
    const layerNodes: Record<string, { data: Record<string, unknown> }[]> = {};
    for (const n of data.nodes) {
      const layer = n.data.layer as string;
      if (!layerNodes[layer]) layerNodes[layer] = [];
      layerNodes[layer].push(n);
    }

    // Place nodes in concentric rings
    const positions: Record<string, { x: number; y: number }> = {};
    for (const [layer, nodes] of Object.entries(layerNodes)) {
      const r = LAYER_RADIUS[layer] ?? 400;
      if (r === 0) {
        // Center node
        positions[nodes[0].data.id as string] = { x: 0, y: 0 };
      } else {
        const count = nodes.length;
        const angleStep = (2 * Math.PI) / count;
        // Start at top (-PI/2) so first node is at 12 o'clock
        nodes.forEach((n, i) => {
          const angle = -Math.PI / 2 + i * angleStep;
          positions[n.data.id as string] = {
            x: r * Math.cos(angle),
            y: r * Math.sin(angle),
          };
        });
      }
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: [...data.nodes, ...data.edges],
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "text-wrap": "wrap" as const,
            "text-max-width": "140px",
            "font-size": "12px",
            "text-valign": "center",
            "text-halign": "center",
            width: 40,
            height: 40,
            "background-color": "#888",
            color: "#fff",
            "text-outline-color": "#333",
            "text-outline-width": 1,
          },
        },
        {
          selector: 'node[layer="technology"]',
          style: {
            "background-color": LAYER_COLORS.technology,
            width: 60,
            height: 60,
            "font-size": "15px",
            "font-weight": "bold" as const,
          },
        },
        {
          selector: 'node[layer="component"]',
          style: { "background-color": LAYER_COLORS.component },
        },
        {
          selector: 'node[layer="material"]',
          style: { "background-color": LAYER_COLORS.material },
        },
        // Process consumable material nodes — purple
        {
          selector: 'node[layer="material"][dependency_type="process_consumable"]',
          style: {
            "background-color": "#a855f7",
            width: 35,
            height: 35,
          },
        },
        // Synthetic [Assembly] component node — dashed border
        {
          selector: 'node[?synthetic]',
          style: {
            "border-width": 2,
            "border-style": "dashed" as const,
            "border-color": "#22c55e",
            "font-style": "italic" as const,
          },
        },
        {
          selector: 'node[layer="country"]',
          style: { "background-color": LAYER_COLORS.country },
        },
        {
          selector: 'node[label="Other Countries"]',
          style: {
            "background-color": "#555",
            "border-width": 2,
            "border-style": "dashed" as const,
            "border-color": "#888",
            "font-style": "italic" as const,
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": "#666",
            "target-arrow-color": "#666",
            "target-arrow-shape": "triangle" as const,
            "curve-style": "bezier" as const,
            opacity: 0.6,
          },
        },
        // CONSUMES_PROCESS_MATERIAL edges — dashed purple
        {
          selector: 'edge[edge_type="CONSUMES_PROCESS_MATERIAL"]',
          style: {
            "line-style": "dashed" as const,
            "line-color": "#a855f7",
            "target-arrow-color": "#a855f7",
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 3,
            "border-color": "#fff",
          },
        },
        {
          selector: ".dimmed",
          style: {
            opacity: 0.35,
          },
        },
        {
          selector: "edge.highlighted",
          style: {
            "line-color": "#818cf8",
            "target-arrow-color": "#818cf8",
            width: 3,
            opacity: 1,
          },
        },
        {
          selector: "node.highlighted",
          style: {
            "border-width": 2,
            "border-color": "#818cf8",
            opacity: 1,
          },
        },
      ],
      layout: {
        name: "preset",
        positions: (node: { id: () => string }) => positions[node.id()] ?? { x: 0, y: 0 },
      },
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });

    cy.on("tap", "node", (evt: EventObject) => {
      const node = evt.target;
      // Clear previous highlights
      cy.elements().removeClass("highlighted dimmed");
      // Dim everything
      cy.elements().addClass("dimmed");
      // Highlight the tapped node and its connected edges + neighbors
      const connected = node.connectedEdges();
      const neighbors = connected.connectedNodes();
      node.removeClass("dimmed").addClass("highlighted");
      connected.removeClass("dimmed").addClass("highlighted");
      neighbors.removeClass("dimmed").addClass("highlighted");
      // Extract connected edge data based on node layer
      const nodeData = node.data();
      type CyEdge = { data: (key: string) => unknown; source: () => { data: (key: string) => unknown }; target: () => { data: (key: string) => unknown } };

      if (nodeData.layer === "country") {
        const edges: ConnectedEdge[] = [];
        node.incomers("edge").forEach((edge: CyEdge) => {
          edges.push({
            label: edge.source().data("label") as string,
            percentage: (edge.data("percentage") as number) ?? 0,
            amount: (edge.data("amount") as number) ?? 0,
            meas_unit: (edge.data("meas_unit") as string) ?? "",
            provenance: (edge.data("provenance") as string) ?? "Unknown",
            confidence: (edge.data("confidence") as number) ?? 0,
          });
        });
        edges.sort((a, b) => b.percentage - a.percentage);
        setConnectedEdges(edges);
      } else if (nodeData.layer === "material") {
        const edges: ConnectedEdge[] = [];
        node.outgoers("edge").forEach((edge: CyEdge) => {
          edges.push({
            label: edge.target().data("label") as string,
            percentage: (edge.data("percentage") as number) ?? 0,
            amount: (edge.data("amount") as number) ?? 0,
            meas_unit: (edge.data("meas_unit") as string) ?? "",
            provenance: (edge.data("provenance") as string) ?? "Unknown",
            confidence: (edge.data("confidence") as number) ?? 0,
          });
        });
        edges.sort((a, b) => b.percentage - a.percentage);
        setConnectedEdges(edges);
      } else if (nodeData.layer === "component") {
        const edges: ConnectedEdge[] = [];
        node.outgoers("edge").forEach((edge: CyEdge) => {
          edges.push({
            label: edge.target().data("label") as string,
            percentage: 0,
            amount: 0,
            meas_unit: "",
            provenance: "",
            confidence: (edge.data("confidence") as number) ?? 0,
          });
        });
        setConnectedEdges(edges);
      } else {
        setConnectedEdges([]);
      }
      // Update detail panel
      setSelectedNode(nodeData);
    });
    cy.on("tap", (evt: EventObject) => {
      if (evt.target === cy) {
        cy.elements().removeClass("highlighted dimmed");
        setSelectedNode(null);
        setConnectedEdges([]);
      }
    });

    cy.fit(undefined, 40);
    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [data]);

  // Reset selection when technology changes
  useEffect(() => {
    setSelectedNode(null);
    setConnectedEdges([]);
  }, [technology]);

  if (loading) return <div className="graph-status">Loading graph...</div>;
  if (error) return <div className="graph-status error">Error: {error}</div>;
  if (!data || data.nodes.length === 0)
    return <div className="graph-status">No data for {technology}</div>;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <h3 className="graph-title">{technology}</h3>
      <div className="graph-body">
        <div className="graph-canvas" ref={containerRef} />
        <div className="graph-sidebar">
          <NodeDetail node={selectedNode as Record<string, unknown> & { id: string; label: string; layer: string } | null} connectedEdges={connectedEdges} technology={technology} overlapMaterials={overlapMaterials} onNavigate={onNavigate} />
          <div className="graph-legend">
            <h4>Layers</h4>
            {Object.entries(LAYER_COLORS).map(([layer, color]) => (
              <div key={layer} className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: color }} />
                {layer}
              </div>
            ))}
            <h4 style={{ marginTop: "0.75rem" }}>Process Consumables</h4>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: "#a855f7" }} />
              process consumable
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: "#22c55e", border: "2px dashed #22c55e", background: "transparent" }} />
              technology-level consumable
            </div>
            <div className="legend-item">
              <span className="legend-line dashed" style={{ borderColor: "#a855f7" }} />
              consumes (process)
            </div>
          </div>
          <div className="graph-stats">
            <h4>Stats</h4>
            <div className="detail-row">
              <span className="detail-label">Nodes</span>
              <span className="detail-value">{data.nodes.length}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Edges</span>
              <span className="detail-value">{data.edges.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
