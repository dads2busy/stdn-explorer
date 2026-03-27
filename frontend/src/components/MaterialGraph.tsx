import { useRef, useEffect, useState } from "react";
import cytoscape from "cytoscape";
import type { Core, EventObject } from "cytoscape";
import { useApi } from "../hooks/useApi";

interface GraphData {
  nodes: { data: Record<string, unknown> }[];
  edges: { data: Record<string, unknown> }[];
}

interface Props {
  material: string;
  includePC: boolean;
}

const LAYER_COLORS: Record<string, string> = {
  material: "#f59e0b",
  domain: "#6366f1",
  subdomain: "#22c55e",
  technology: "#ef4444",
};

const LAYER_RADIUS: Record<string, number> = {
  material: 0,
  domain: 120,
  subdomain: 280,
  technology: 440,
};

export function MaterialGraph({ material, includePC }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [selectedNode, setSelectedNode] = useState<Record<string, unknown> | null>(null);

  // material-stdn endpoint always uses all domains, domain param is ignored by backend
  const { data, loading, error } = useApi<GraphData>(
    `/api/material-stdn/${encodeURIComponent(material)}`,
    "all",
    includePC,
  );

  useEffect(() => {
    if (!containerRef.current || !data || data.nodes.length === 0) return;

    // Group nodes by layer
    const layerNodes: Record<string, { data: Record<string, unknown> }[]> = {};
    for (const n of data.nodes) {
      const layer = n.data.layer as string;
      if (!layerNodes[layer]) layerNodes[layer] = [];
      layerNodes[layer].push(n);
    }

    // Build parent-child map for angular clustering:
    // subdomains cluster around their parent domain, technologies around their subdomain
    const parentOf: Record<string, string> = {};
    for (const e of data.edges) {
      const edgeType = e.data.edge_type as string;
      if (edgeType === "HAS_SUBDOMAIN" || edgeType === "HAS_TECHNOLOGY") {
        parentOf[e.data.target as string] = e.data.source as string;
      }
    }

    // Place nodes in concentric rings with angular clustering
    const positions: Record<string, { x: number; y: number }> = {};

    // Center: material
    const matNodes = layerNodes["material"] ?? [];
    if (matNodes.length) {
      positions[matNodes[0].data.id as string] = { x: 0, y: 0 };
    }

    // Ring 1: domains — evenly spaced
    const domainNodes = layerNodes["domain"] ?? [];
    const domainAngles: Record<string, number> = {};
    domainNodes.forEach((n, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / domainNodes.length;
      const id = n.data.id as string;
      domainAngles[id] = angle;
      positions[id] = {
        x: LAYER_RADIUS.domain * Math.cos(angle),
        y: LAYER_RADIUS.domain * Math.sin(angle),
      };
    });

    // Ring 2: subdomains — clustered around parent domain angle
    const subdomainNodes = layerNodes["subdomain"] ?? [];
    // Group subdomains by parent domain
    const subsByDomain: Record<string, { data: Record<string, unknown> }[]> = {};
    for (const n of subdomainNodes) {
      const parent = parentOf[n.data.id as string] ?? "";
      if (!subsByDomain[parent]) subsByDomain[parent] = [];
      subsByDomain[parent].push(n);
    }
    const subdomainAngles: Record<string, number> = {};
    const domainSectorSize = domainNodes.length > 0 ? (2 * Math.PI) / domainNodes.length : 2 * Math.PI;
    for (const [domainId, subs] of Object.entries(subsByDomain)) {
      const centerAngle = domainAngles[domainId] ?? 0;
      const spread = domainSectorSize * 0.85; // use 85% of sector to leave gaps
      subs.forEach((n, i) => {
        const offset = subs.length === 1 ? 0 : -spread / 2 + (i * spread) / (subs.length - 1);
        const angle = centerAngle + offset;
        const id = n.data.id as string;
        subdomainAngles[id] = angle;
        positions[id] = {
          x: LAYER_RADIUS.subdomain * Math.cos(angle),
          y: LAYER_RADIUS.subdomain * Math.sin(angle),
        };
      });
    }

    // Ring 3: technologies — clustered around parent subdomain angle
    const techNodes = layerNodes["technology"] ?? [];
    const techsBySub: Record<string, { data: Record<string, unknown> }[]> = {};
    for (const n of techNodes) {
      const parent = parentOf[n.data.id as string] ?? "";
      if (!techsBySub[parent]) techsBySub[parent] = [];
      techsBySub[parent].push(n);
    }
    // Compute angular budget per subdomain proportional to tech count
    for (const [subId, techs] of Object.entries(techsBySub)) {
      const centerAngle = subdomainAngles[subId] ?? 0;
      // Each subdomain has at most 5 techs, spread within a small arc
      const parentDomain = parentOf[subId] ?? "";
      const numSubs = subsByDomain[parentDomain]?.length ?? 1;
      const subSectorSize = domainSectorSize / numSubs;
      const spread = subSectorSize * 0.8;
      techs.forEach((n, i) => {
        const offset = techs.length === 1 ? 0 : -spread / 2 + (i * spread) / (techs.length - 1);
        const angle = centerAngle + offset;
        positions[n.data.id as string] = {
          x: LAYER_RADIUS.technology * Math.cos(angle),
          y: LAYER_RADIUS.technology * Math.sin(angle),
        };
      });
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
            "text-max-width": "120px",
            "font-size": "10px",
            "text-valign": "center",
            "text-halign": "center",
            width: 30,
            height: 30,
            "background-color": "#888",
            color: "#fff",
            "text-outline-color": "#333",
            "text-outline-width": 1,
          },
        },
        {
          selector: 'node[layer="material"]',
          style: {
            "background-color": LAYER_COLORS.material,
            width: 60,
            height: 60,
            "font-size": "15px",
            "font-weight": "bold" as const,
          },
        },
        {
          selector: 'node[layer="domain"]',
          style: {
            "background-color": LAYER_COLORS.domain,
            width: 45,
            height: 45,
            "font-size": "12px",
            "font-weight": "bold" as const,
          },
        },
        {
          selector: 'node[layer="subdomain"]',
          style: {
            "background-color": LAYER_COLORS.subdomain,
            width: 35,
            height: 35,
            "font-size": "10px",
          },
        },
        {
          selector: 'node[layer="technology"]',
          style: {
            "background-color": LAYER_COLORS.technology,
            width: 25,
            height: 25,
            "font-size": "9px",
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": "#555",
            "target-arrow-color": "#555",
            "target-arrow-shape": "triangle" as const,
            "curve-style": "bezier" as const,
            opacity: 0.4,
          },
        },
        {
          selector: 'edge[edge_type="USED_IN_DOMAIN"]',
          style: {
            "line-color": LAYER_COLORS.domain,
            "target-arrow-color": LAYER_COLORS.domain,
            width: 2.5,
            opacity: 0.7,
          },
        },
        {
          selector: 'edge[edge_type="HAS_SUBDOMAIN"]',
          style: {
            "line-color": LAYER_COLORS.subdomain,
            "target-arrow-color": LAYER_COLORS.subdomain,
            width: 2,
            opacity: 0.5,
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
          style: { opacity: 0.15 },
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

    // Click: highlight subtree
    cy.on("tap", "node", (evt: EventObject) => {
      const node = evt.target;
      cy.elements().removeClass("highlighted dimmed");
      cy.elements().addClass("dimmed");

      // Walk downstream (successors) to highlight the full subtree
      const toVisit = [node];
      const visited = new Set<string>([node.id()]);
      while (toVisit.length > 0) {
        const current = toVisit.pop()!;
        current.removeClass("dimmed").addClass("highlighted");
        current.connectedEdges().forEach((edge: { target: () => { id: () => string }; removeClass: (c: string) => void; addClass: (c: string) => void }) => {
          const tgt = edge.target();
          if (!visited.has(tgt.id())) {
            edge.removeClass("dimmed").addClass("highlighted");
            tgt.removeClass("dimmed").addClass("highlighted");
            visited.add(tgt.id());
            toVisit.push(tgt as unknown as typeof node);
          }
        });
      }

      // Also walk upstream (predecessors) to highlight path back to material
      const toVisitUp = [node];
      const visitedUp = new Set<string>([node.id()]);
      while (toVisitUp.length > 0) {
        const current = toVisitUp.pop()!;
        current.removeClass("dimmed").addClass("highlighted");
        current.connectedEdges().forEach((edge: { source: () => { id: () => string }; removeClass: (c: string) => void; addClass: (c: string) => void }) => {
          const src = edge.source();
          if (!visitedUp.has(src.id())) {
            edge.removeClass("dimmed").addClass("highlighted");
            src.removeClass("dimmed").addClass("highlighted");
            visitedUp.add(src.id());
            toVisitUp.push(src as unknown as typeof node);
          }
        });
      }

      setSelectedNode(node.data());
    });

    cy.on("tap", (evt: EventObject) => {
      if (evt.target === cy) {
        cy.elements().removeClass("highlighted dimmed");
        setSelectedNode(null);
      }
    });

    cy.fit(undefined, 40);
    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [data]);

  useEffect(() => {
    setSelectedNode(null);
  }, [material]);

  if (loading) return <div className="graph-status">Loading graph...</div>;
  if (error) return <div className="graph-status error">Error: {error}</div>;
  if (!data || data.nodes.length === 0)
    return <div className="graph-status">No data for {material}</div>;

  // Count by layer
  const counts: Record<string, number> = {};
  for (const n of data.nodes) {
    const layer = n.data.layer as string;
    counts[layer] = (counts[layer] ?? 0) + 1;
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <h3 className="graph-title">{material}</h3>
      <div className="graph-body">
        <div className="graph-canvas" ref={containerRef} />
        <div className="graph-sidebar">
          {selectedNode && (
            <div className="node-detail">
              <h4>{selectedNode.label as string}</h4>
              <div className="detail-row">
                <span className="detail-label">Layer</span>
                <span className="detail-value">{selectedNode.layer as string}</span>
              </div>
              {selectedNode.num_components !== undefined && (
                <div className="detail-row">
                  <span className="detail-label">Components using {material}</span>
                  <span className="detail-value">{selectedNode.num_components as number}</span>
                </div>
              )}
              {selectedNode.dependency_types && (
                <div className="detail-row">
                  <span className="detail-label">Dependency type</span>
                  <span className="detail-value">{(selectedNode.dependency_types as string[]).join(", ")}</span>
                </div>
              )}
            </div>
          )}
          <div className="graph-legend">
            <h4>Layers</h4>
            {Object.entries(LAYER_COLORS).map(([layer, color]) => (
              <div key={layer} className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: color }} />
                {layer}
              </div>
            ))}
          </div>
          <div className="graph-stats">
            <h4>Stats</h4>
            <div className="detail-row">
              <span className="detail-label">Domains</span>
              <span className="detail-value">{counts.domain ?? 0}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Subdomains</span>
              <span className="detail-value">{counts.subdomain ?? 0}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Technologies</span>
              <span className="detail-value">{counts.technology ?? 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
