import { useRef, useEffect, useState, useCallback } from "react";
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
  onNavigateToTechnology?: (domain: string, technology: string) => void;
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

// Larger radii when zoomed into a single domain (no domain ring)
const FOCUSED_RADIUS: Record<string, number> = {
  material: 0,
  subdomain: 180,
  technology: 380,
};

type ParentMap = Record<string, string>;
type NodeGroup = { data: Record<string, unknown> }[];
type GroupMap = Record<string, NodeGroup>;

/** Compute all-domains positions (concentric rings with angular clustering). */
function computeAllPositions(
  data: GraphData,
  parentOf: ParentMap,
): { positions: Record<string, { x: number; y: number }>; domainAngles: Record<string, number>; subdomainAngles: Record<string, number>; subsByDomain: GroupMap } {
  const layerNodes: Record<string, NodeGroup> = {};
  for (const n of data.nodes) {
    const layer = n.data.layer as string;
    if (!layerNodes[layer]) layerNodes[layer] = [];
    layerNodes[layer].push(n);
  }

  const positions: Record<string, { x: number; y: number }> = {};

  // Center: material
  const matNodes = layerNodes["material"] ?? [];
  if (matNodes.length) {
    positions[matNodes[0].data.id as string] = { x: 0, y: 0 };
  }

  // Ring 1: domains
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

  // Group subdomains by parent domain
  const subdomainNodes = layerNodes["subdomain"] ?? [];
  const subsByDomain: GroupMap = {};
  for (const n of subdomainNodes) {
    const parent = parentOf[n.data.id as string] ?? "";
    if (!subsByDomain[parent]) subsByDomain[parent] = [];
    subsByDomain[parent].push(n);
  }

  // Ring 2: subdomains
  const subdomainAngles: Record<string, number> = {};
  const domainSectorSize = domainNodes.length > 0 ? (2 * Math.PI) / domainNodes.length : 2 * Math.PI;
  for (const [domainId, subs] of Object.entries(subsByDomain)) {
    const centerAngle = domainAngles[domainId] ?? 0;
    const spread = domainSectorSize * 0.85;
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

  // Ring 3: technologies
  const techNodes = layerNodes["technology"] ?? [];
  const techsBySub: GroupMap = {};
  for (const n of techNodes) {
    const parent = parentOf[n.data.id as string] ?? "";
    if (!techsBySub[parent]) techsBySub[parent] = [];
    techsBySub[parent].push(n);
  }
  for (const [subId, techs] of Object.entries(techsBySub)) {
    const centerAngle = subdomainAngles[subId] ?? 0;
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

  return { positions, domainAngles, subdomainAngles, subsByDomain };
}

/** Compute focused positions for a single domain — subdomains and techs use full 360°. */
function computeFocusedPositions(
  domainId: string,
  data: GraphData,
  parentOf: ParentMap,
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};

  // Material stays center
  for (const n of data.nodes) {
    if ((n.data.layer as string) === "material") {
      positions[n.data.id as string] = { x: 0, y: 0 };
    }
  }

  // Domain node stacks above material (material r=30, domain r=22.5)
  positions[domainId] = { x: 0, y: -55 };

  // Collect this domain's subdomains
  const subs: NodeGroup = [];
  for (const n of data.nodes) {
    if ((n.data.layer as string) === "subdomain" && parentOf[n.data.id as string] === domainId) {
      subs.push(n);
    }
  }

  // Subdomains spread across full 360°
  const subAngles: Record<string, number> = {};
  subs.forEach((n, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / subs.length;
    const id = n.data.id as string;
    subAngles[id] = angle;
    positions[id] = {
      x: FOCUSED_RADIUS.subdomain * Math.cos(angle),
      y: FOCUSED_RADIUS.subdomain * Math.sin(angle),
    };
  });

  // Technologies clustered around their subdomain
  const techsBySub: GroupMap = {};
  for (const n of data.nodes) {
    if ((n.data.layer as string) === "technology") {
      const parent = parentOf[n.data.id as string] ?? "";
      if (subAngles[parent] !== undefined) {
        if (!techsBySub[parent]) techsBySub[parent] = [];
        techsBySub[parent].push(n);
      }
    }
  }

  const subSectorSize = subs.length > 0 ? (2 * Math.PI) / subs.length : 2 * Math.PI;
  for (const [subId, techs] of Object.entries(techsBySub)) {
    const centerAngle = subAngles[subId] ?? 0;
    const spread = subSectorSize * 0.75;
    techs.forEach((n, i) => {
      const offset = techs.length === 1 ? 0 : -spread / 2 + (i * spread) / (techs.length - 1);
      const angle = centerAngle + offset;
      positions[n.data.id as string] = {
        x: FOCUSED_RADIUS.technology * Math.cos(angle),
        y: FOCUSED_RADIUS.technology * Math.sin(angle),
      };
    });
  }

  return positions;
}

/** Compute positions for subdomain focus — subdomain at center, techs in an arc. */
function computeSubdomainFocusPositions(
  subdomainId: string,
  domainId: string,
  data: GraphData,
  parentOf: ParentMap,
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};

  // Snowman stack: material (bottom, r=30), domain (middle, r=22.5), subdomain (top, r=17.5)
  for (const n of data.nodes) {
    if ((n.data.layer as string) === "material") {
      positions[n.data.id as string] = { x: 0, y: 0 };
    }
  }
  positions[domainId] = { x: 0, y: -55 };
  positions[subdomainId] = { x: 0, y: -100 };

  // Collect this subdomain's technologies
  const techs: NodeGroup = [];
  for (const n of data.nodes) {
    if ((n.data.layer as string) === "technology" && parentOf[n.data.id as string] === subdomainId) {
      techs.push(n);
    }
  }

  // Spread techs in a ~180° arc (top half) at a comfortable radius
  const radius = 220;
  const totalArc = Math.PI; // 180 degrees
  techs.forEach((n, i) => {
    const angle = -Math.PI + (techs.length === 1 ? 0 : (i * totalArc) / (techs.length - 1));
    positions[n.data.id as string] = {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    };
  });

  return positions;
}

export function MaterialGraph({ material, includePC, onNavigateToTechnology }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [selectedNode, setSelectedNode] = useState<Record<string, unknown> | null>(null);
  const [focusedDomain, setFocusedDomain] = useState<string | null>(null);
  const [focusedSubdomain, setFocusedSubdomain] = useState<string | null>(null);
  const focusedDomainRef = useRef<string | null>(null);
  const focusedSubdomainRef = useRef<string | null>(null);
  const applyFocusRef = useRef<(domainId: string | null, subdomainId?: string | null) => void>(() => {});
  const onNavigateRef = useRef(onNavigateToTechnology);
  onNavigateRef.current = onNavigateToTechnology;
  const parentOfRef = useRef<ParentMap>({});

  const { data, loading, error } = useApi<GraphData>(
    `/api/material-stdn/${encodeURIComponent(material)}`,
    "all",
    includePC,
  );

  /** Collect all node IDs that belong to a domain's subtree. */
  const getDomainSubtree = useCallback((domainId: string): Set<string> => {
    const ids = new Set<string>();
    const cy = cyRef.current;
    if (!cy) return ids;
    // BFS from domain node downstream
    const queue = [domainId];
    ids.add(domainId);
    while (queue.length > 0) {
      const current = queue.shift()!;
      const node = cy.getElementById(current);
      node.outgoers("edge").forEach((edge: { target: () => { id: () => string } }) => {
        const tgtId = edge.target().id();
        if (!ids.has(tgtId)) {
          ids.add(tgtId);
          queue.push(tgtId);
        }
      });
    }
    return ids;
  }, []);

  type CyNode = { id: () => string; hasClass: (c: string) => boolean; animate: (target: Record<string, unknown>, opts: Record<string, unknown>) => void; stop: () => void; addClass: (c: string) => void; removeClass: (c: string) => void; style: (prop: string, val: unknown) => void };
  type CyEle = CyNode & { isNode: () => boolean; source: () => { id: () => string }; target: () => { id: () => string } };

  /** Helper: hide/show elements based on a keep set, then animate visible nodes.
   *  Optional nodeStyles map provides per-node style targets to animate alongside position. */
  const animateToPositions = useCallback((
    keepIds: Set<string>,
    positions: Record<string, { x: number; y: number }>,
    nodeStyles?: Record<string, Record<string, unknown>>,
  ) => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.nodes().forEach((node: CyNode) => node.stop());

    cy.elements().forEach((ele: CyEle) => {
      if (ele.isNode()) {
        if (!keepIds.has(ele.id())) {
          ele.addClass("hidden");
        } else {
          ele.removeClass("hidden");
        }
      } else {
        const srcId = ele.source().id();
        const tgtId = ele.target().id();
        if (!keepIds.has(srcId) || !keepIds.has(tgtId)) {
          ele.addClass("hidden");
        } else {
          ele.removeClass("hidden");
        }
      }
    });

    cy.nodes().forEach((node: CyNode) => {
      if (node.hasClass("hidden")) return;
      const pos = positions[node.id()];
      if (pos) {
        const styleTarget = nodeStyles?.[node.id()];
        if (styleTarget) {
          node.animate(
            { position: pos, style: styleTarget },
            { duration: 400, easing: "ease-in-out-cubic" },
          );
        } else {
          node.animate(
            { position: pos },
            { duration: 400, easing: "ease-in-out-cubic" },
          );
        }
      }
    });
    setTimeout(() => cy.fit(cy.elements(":visible"), 40), 420);
  }, []);

  /** Animate to the appropriate focus level. */
  const applyFocus = useCallback((domainId: string | null, subdomainId?: string | null) => {
    const cy = cyRef.current;
    if (!cy || !data) return;

    focusedDomainRef.current = domainId;
    focusedSubdomainRef.current = subdomainId ?? null;
    setFocusedDomain(domainId);
    setFocusedSubdomain(subdomainId ?? null);

    // Build style targets to animate tech nodes back to default size
    const defaultTechStyle: Record<string, unknown> = { width: 25, height: 25, "font-size": 9 };
    const focusedTechStyle: Record<string, unknown> = { width: 50, height: 50, "font-size": 12 };

    if (!domainId) {
      // Level 0: all domains
      const { positions } = computeAllPositions(data, parentOfRef.current);
      const allIds = new Set(data.nodes.map(n => n.data.id as string));
      const styles: Record<string, Record<string, unknown>> = {};
      for (const n of data.nodes) {
        if ((n.data.layer as string) === "technology") {
          styles[n.data.id as string] = defaultTechStyle;
        }
      }
      animateToPositions(allIds, positions, styles);
      return;
    }

    if (!subdomainId) {
      // Level 1: single domain — subdomains + techs visible
      const keepIds = getDomainSubtree(domainId);
      for (const n of data.nodes) {
        if ((n.data.layer as string) === "material") keepIds.add(n.data.id as string);
      }
      const positions = computeFocusedPositions(domainId, data, parentOfRef.current);
      const styles: Record<string, Record<string, unknown>> = {};
      for (const n of data.nodes) {
        if ((n.data.layer as string) === "technology") {
          styles[n.data.id as string] = defaultTechStyle;
        }
      }
      animateToPositions(keepIds, positions, styles);
      return;
    }

    // Level 2: single subdomain — only its technologies visible
    const keepIds = new Set<string>();
    for (const n of data.nodes) {
      if ((n.data.layer as string) === "material") keepIds.add(n.data.id as string);
    }
    keepIds.add(domainId);
    keepIds.add(subdomainId);
    const styles: Record<string, Record<string, unknown>> = {};
    for (const n of data.nodes) {
      if ((n.data.layer as string) === "technology" && parentOfRef.current[n.data.id as string] === subdomainId) {
        keepIds.add(n.data.id as string);
        styles[n.data.id as string] = focusedTechStyle;
      }
    }

    const positions = computeSubdomainFocusPositions(subdomainId, domainId, data, parentOfRef.current);
    animateToPositions(keepIds, positions, styles);
  }, [data, getDomainSubtree, animateToPositions]);

  applyFocusRef.current = applyFocus;

  useEffect(() => {
    if (!containerRef.current || !data || data.nodes.length === 0) return;

    // Build parent map
    const parentOf: ParentMap = {};
    for (const e of data.edges) {
      const edgeType = e.data.edge_type as string;
      if (edgeType === "HAS_SUBDOMAIN" || edgeType === "HAS_TECHNOLOGY" || edgeType === "USED_IN_DOMAIN") {
        parentOf[e.data.target as string] = e.data.source as string;
      }
    }
    parentOfRef.current = parentOf;

    const { positions } = computeAllPositions(data, parentOf);

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
          selector: ".hidden",
          style: {
            display: "none" as const,
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

    cy.on("tap", "node", (evt: EventObject) => {
      const node = evt.target;
      const nodeData = node.data();
      const layer = nodeData.layer as string;

      // Domain click: toggle domain focus
      if (layer === "domain") {
        cy.elements().removeClass("highlighted dimmed");
        setSelectedNode(nodeData);
        if (focusedDomainRef.current === node.id()) {
          // Already focused on this domain — go back to all
          applyFocusRef.current(null);
        } else {
          applyFocusRef.current(node.id());
        }
        return;
      }

      // Subdomain click: drill into subdomain focus
      if (layer === "subdomain") {
        cy.elements().removeClass("highlighted dimmed");
        setSelectedNode(nodeData);
        if (focusedSubdomainRef.current === node.id()) {
          // Already focused — go back to domain level
          const domId = parentOfRef.current[node.id()];
          applyFocusRef.current(domId ?? null, null);
        } else {
          // Resolve parent domain and jump straight to subdomain focus
          const domId = parentOfRef.current[node.id()];
          applyFocusRef.current(domId ?? null, node.id());
        }
        return;
      }

      // Material click: reset to all-domains view
      if (layer === "material") {
        cy.elements().removeClass("highlighted dimmed");
        setSelectedNode(nodeData);
        applyFocusRef.current(null);
        return;
      }

      // Technology click: focus its subdomain (and parent domain)
      if (layer === "technology") {
        cy.elements().removeClass("highlighted dimmed");
        setSelectedNode(nodeData);
        const subId = parentOfRef.current[node.id()];
        const domId = subId ? parentOfRef.current[subId] : null;
        applyFocusRef.current(domId ?? null, subId ?? null);
        return;
      }

      setSelectedNode(nodeData);
    });

    cy.on("tap", (evt: EventObject) => {
      if (evt.target === cy) {
        cy.elements().removeClass("highlighted dimmed");
        setSelectedNode(null);
        // Step back one level
        if (focusedSubdomainRef.current) {
          applyFocusRef.current(focusedDomainRef.current, null);
        } else if (focusedDomainRef.current) {
          applyFocusRef.current(null);
        }
      }
    });

    // Hover: grow node on mouseover, shrink on mouseout
    const matBaseSize: Record<string, [number, number]> = {
      material: [60, 15], domain: [45, 12], subdomain: [35, 10], technology: [25, 9],
    };
    cy.on("mouseover", "node", (evt: EventObject) => {
      const node = evt.target;
      const layer = node.data("layer") as string;
      const [baseW, baseFont] = matBaseSize[layer] ?? [30, 10];
      // Use current rendered size as base if it's larger (e.g. subdomain-focused techs)
      const curW = parseFloat(node.style("width"));
      const effectiveW = Math.max(baseW, curW);
      const effectiveFont = Math.max(baseFont, parseFloat(node.style("font-size")));
      node.stop();
      node.animate({ style: { width: effectiveW * 1.3, height: effectiveW * 1.3, "font-size": effectiveFont * 1.2 } }, { duration: 150 });
    });
    cy.on("mouseout", "node", (evt: EventObject) => {
      const node = evt.target;
      if (node.hasClass("highlighted")) return;
      const layer = node.data("layer") as string;
      const [baseW, baseFont] = matBaseSize[layer] ?? [30, 10];
      // If in subdomain focus, techs should restore to focused size, not default
      const isFocusedTech = layer === "technology" && focusedSubdomainRef.current;
      const restoreW = isFocusedTech ? 50 : baseW;
      const restoreFont = isFocusedTech ? 12 : baseFont;
      node.stop();
      node.animate({ style: { width: restoreW, height: restoreW, "font-size": restoreFont } }, { duration: 150 });
    });

    // Double-click technology: navigate to Dependency Network tab
    cy.on("dbltap", "node", (evt: EventObject) => {
      const node = evt.target;
      const nodeData = node.data();
      if (nodeData.layer !== "technology") return;
      const techName = nodeData.label as string;
      const subId = parentOf[node.id()];
      const domId = subId ? parentOf[subId] : undefined;
      const domainName = domId ? (domId as string).replace("domain:", "") : "";
      if (domainName && onNavigateRef.current) {
        onNavigateRef.current(domainName, techName);
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
    setFocusedDomain(null);
    setFocusedSubdomain(null);
    focusedDomainRef.current = null;
    focusedSubdomainRef.current = null;
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
      <h3 className="graph-title">
        {material}
        {focusedDomain && (
          <span style={{ fontSize: "0.75em", opacity: 0.7, marginLeft: "0.5em" }}>
            — {focusedDomain.replace("domain:", "").replace(/^\w/, c => c.toUpperCase())}
            {focusedSubdomain && ` › ${focusedSubdomain.replace(/^subdomain:[^:]+:/, "")}`}
          </span>
        )}
      </h3>
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
              {(selectedNode.layer as string) === "domain" && (
                <p style={{ fontSize: "0.75rem", opacity: 0.6, marginTop: "0.5rem" }}>
                  Click domain to focus / click again to reset
                </p>
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
