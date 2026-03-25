export type QueryType =
  | "tech-risk"
  | "country-disruption"
  | "concentration-risk"
  | "country-dominance"
  | "shared-materials"
  | "material-disruption";

export interface QueryParams {
  technology?: string;
  country?: string;
  material?: string;
}

export interface AnalysisSection {
  title: string;
  level: "critical" | "high" | "moderate" | "low" | "info";
  content: AnalysisContent[];
}

export type AnalysisContent =
  | { type: "text"; value: string }
  | { type: "bullet"; items: string[] }
  | { type: "table"; headers: string[]; rows: (string | number)[][] }
  | { type: "stat"; label: string; value: string | number };

export interface AnalysisResponse {
  title: string;
  summary: string;
  sections: AnalysisSection[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "analyst";
  displayText: string;
  response?: AnalysisResponse;
  loading?: boolean;
  error?: string;
}

// API response types used by generators
export interface ConcentrationEntry {
  technology: string;
  material: string;
  hhi: number;
  top_producers: { country: string; share: number }[];
  num_countries: number;
}

export interface DisruptionResult {
  country: string;
  affected_technologies: {
    technology: string;
    num_materials_affected: number;
    num_components_affected?: number;
    max_share_lost: number;
    top_producer_count: number;
    severity: string;
    materials: {
      material: string;
      share: number;
      is_top_producer: boolean;
    }[];
    components?: {
      component: string;
      materials: {
        material: string;
        share: number;
        is_top_producer: boolean;
      }[];
    }[];
  }[];
  summary: {
    total_technologies_affected: number;
    total_materials_affected: number;
    total_components_affected?: number;
    critical_count: number;
    high_count: number;
  };
}

export interface CountryExposureEntry {
  country: string;
  num_technologies: number;
  num_materials: number;
  num_dominated: number;
  dominated_materials: { material: string; dependency_type: string }[];
  avg_share: number;
  max_share: number;
  top_materials: { material: string; share: number }[];
}

export interface OverlapData {
  material_overlap: {
    material: string;
    num_technologies: number;
    technologies: string[];
    top_producers: { country: string; share: number }[];
    hhi: number;
  }[];
  country_overlap: {
    country: string;
    num_technologies: number;
    technologies: string[];
    num_materials: number;
    materials: string[];
    avg_share: number;
  }[];
}
