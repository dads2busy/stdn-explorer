import type { QueryType, QueryParams } from "./types";

export interface QueryTemplate {
  id: QueryType;
  label: string;
  description: string;
  paramType: "technology" | "country" | "none";
  formatQuestion: (params: QueryParams) => string;
  getApiPaths: (params: QueryParams) => string[];
}

export const QUERY_TEMPLATES: QueryTemplate[] = [
  {
    id: "tech-risk",
    label: "Supply chain risks for a technology",
    description: "Concentration data, critical materials, top producers",
    paramType: "technology",
    formatQuestion: (p) =>
      `What are the critical supply chain risks for ${p.technology}?`,
    getApiPaths: (p) => ["/api/concentration", `/api/stdn/${p.technology}/table`],
  },
  {
    id: "country-disruption",
    label: "Disruption impact of a country",
    description: "Technologies and materials affected by supply disruption",
    paramType: "country",
    formatQuestion: (p) =>
      `What happens if ${p.country}'s supply is disrupted?`,
    getApiPaths: (p) => [
      `/api/disruption/${encodeURIComponent(p.country!)}`,
      "/api/country-exposure",
    ],
  },
  {
    id: "concentration-risk",
    label: "Highest concentration risks",
    description: "Cross-technology HHI analysis, systemic chokepoints",
    paramType: "none",
    formatQuestion: () =>
      "Which materials pose the highest concentration risk?",
    getApiPaths: () => ["/api/concentration", "/api/overlap"],
  },
  {
    id: "country-dominance",
    label: "Country dominance assessment",
    description: "Dominated materials, technologies affected",
    paramType: "country",
    formatQuestion: (p) =>
      `How dominant is ${p.country} in global supply chains?`,
    getApiPaths: (p) => [
      "/api/country-exposure",
      `/api/disruption/${encodeURIComponent(p.country!)}`,
    ],
  },
  {
    id: "shared-materials",
    label: "Cross-technology shared materials",
    description: "Overlap data, systemic risk assessment",
    paramType: "none",
    formatQuestion: () =>
      "What materials are shared across multiple technologies?",
    getApiPaths: () => ["/api/overlap", "/api/concentration"],
  },
];
