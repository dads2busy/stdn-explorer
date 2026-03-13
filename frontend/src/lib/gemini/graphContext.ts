import { apiUrl } from "../../hooks/useApi";

const IS_STATIC = import.meta.env.VITE_STATIC === "true";

export interface Triple {
  subject: string;
  subject_type: string;
  rel: string;
  object: string;
  object_type: string;
  properties: Record<string, unknown>;
}

export interface GraphContextResult {
  matched_entities: string[];
  triples: Triple[];
  node_metrics: Record<
    string,
    {
      label: string;
      node_type: string;
      pagerank: number;
      in_degree: number;
      hhi?: number;
      confidence?: number;
    }
  >;
  fallback: boolean;
}

// Cache the full static graph once loaded
let staticGraphCache: {
  nodes: Record<string, Record<string, unknown>>;
  edges: Array<{ source: string; target: string; rel?: string; [k: string]: unknown }>;
} | null = null;

async function loadStaticGraph() {
  if (staticGraphCache) return staticGraphCache;
  const url = apiUrl("/api/graph_context");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load graph: HTTP ${res.status}`);
  staticGraphCache = await res.json();
  return staticGraphCache!;
}

function extractEntitiesClient(
  query: string,
  nodes: Record<string, Record<string, unknown>>
): string[] {
  const q = query.toLowerCase();
  const hits: string[] = [];
  for (const [nodeId, attrs] of Object.entries(nodes)) {
    const label = String(attrs.label ?? "").toLowerCase();
    if (label.length > 0 && q.includes(label)) {
      hits.push(nodeId);
    }
  }
  return hits;
}

function extractSubgraphClient(
  seedNodes: string[],
  edges: Array<{ source: string; target: string; [k: string]: unknown }>,
  hops: number = 2
): { subNodes: Set<string>; subEdges: typeof edges } {
  // Build adjacency for both directions
  const fwd = new Map<string, string[]>();
  const rev = new Map<string, string[]>();
  for (const e of edges) {
    if (!fwd.has(e.source)) fwd.set(e.source, []);
    fwd.get(e.source)!.push(e.target);
    if (!rev.has(e.target)) rev.set(e.target, []);
    rev.get(e.target)!.push(e.source);
  }

  const visited = new Set(seedNodes);
  let frontier = new Set(seedNodes);

  for (let h = 0; h < hops; h++) {
    const next = new Set<string>();
    for (const n of frontier) {
      for (const nb of [...(fwd.get(n) ?? []), ...(rev.get(n) ?? [])]) {
        if (!visited.has(nb)) next.add(nb);
      }
    }
    next.forEach((n) => visited.add(n));
    frontier = next;
  }

  const subEdges = edges.filter((e) => visited.has(e.source) && visited.has(e.target));
  return { subNodes: visited, subEdges };
}

export async function fetchGraphContext(query: string): Promise<GraphContextResult> {
  if (!IS_STATIC) {
    // Live backend: POST query, get back triples
    const res = await fetch(apiUrl("/api/graph-context"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, hops: 2 }),
    });
    if (!res.ok) throw new Error(`Graph context fetch failed: HTTP ${res.status}`);
    return res.json();
  }

  // Static mode: load full graph JSON, do entity+subgraph extraction client-side
  const graph = await loadStaticGraph();
  const seedNodes = extractEntitiesClient(query, graph.nodes);
  if (seedNodes.length === 0) {
    return { matched_entities: [], triples: [], node_metrics: {}, fallback: true };
  }

  const { subNodes, subEdges } = extractSubgraphClient(seedNodes, graph.edges);

  const triples: Triple[] = subEdges.map((e) => ({
    subject: String(graph.nodes[e.source]?.label ?? e.source),
    subject_type: String(graph.nodes[e.source]?.node_type ?? ""),
    rel: String(e.rel ?? "RELATED_TO"),
    object: String(graph.nodes[e.target]?.label ?? e.target),
    object_type: String(graph.nodes[e.target]?.node_type ?? ""),
    properties: Object.fromEntries(
      Object.entries(e).filter(([k]) => !["source", "target", "rel"].includes(k))
    ),
  }));

  const node_metrics: GraphContextResult["node_metrics"] = {};
  for (const nodeId of subNodes) {
    const attrs = graph.nodes[nodeId];
    if (attrs) {
      node_metrics[nodeId] = {
        label: String(attrs.label ?? ""),
        node_type: String(attrs.node_type ?? ""),
        pagerank: Number(attrs.pagerank ?? 0),
        in_degree: Number(attrs.in_degree ?? 0),
        hhi: attrs.hhi != null ? Number(attrs.hhi) : undefined,
        confidence: attrs.confidence != null ? Number(attrs.confidence) : undefined,
      };
    }
  }

  return {
    matched_entities: seedNodes.map((n) => String(graph.nodes[n]?.label ?? n)),
    triples,
    node_metrics,
    fallback: false,
  };
}
