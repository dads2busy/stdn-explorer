import type { ChatMessage } from "../../components/analyst/types";

interface ConcentrationEntry {
  technology: string;
  material: string;
  hhi: number;
  top_producers: { country: string; share: number }[];
  num_countries: number;
}

interface ExposureEntry {
  country: string;
  num_technologies: number;
  num_materials: number;
  num_dominated: number;
  dominated_materials: string[];
  avg_share: number;
  max_share: number;
  top_materials: { material: string; share: number }[];
}

interface OverlapEntry {
  material: string;
  num_technologies: number;
  technologies: string[];
  top_producers: { country: string; share: number }[];
  hhi: number;
}

export interface StdnData {
  concentration?: ConcentrationEntry[];
  exposure?: ExposureEntry[];
  overlap?: OverlapEntry[];
}

/**
 * Build a text context string from the current analyst state
 * to send alongside Gemini messages.
 */
export function buildStdnContext(
  analysisMessages: ChatMessage[],
  technologies: string[],
  countries: string[],
  data?: StdnData
): string {
  const parts: string[] = [];

  // Available technologies
  if (technologies.length > 0) {
    parts.push(`Available technologies (${technologies.length}): ${technologies.join(", ")}`);
  }

  // Available countries
  if (countries.length > 0) {
    parts.push(`Available countries (${countries.length}): ${countries.join(", ")}`);
  }

  // Concentration data (HHI scores)
  if (data?.concentration && data.concentration.length > 0) {
    parts.push("\n--- MATERIAL CONCENTRATION (HHI scores, top 30 most concentrated) ---");
    parts.push("Technology | Material | HHI | Top Producer (share%)");
    const sorted = [...data.concentration].sort((a, b) => b.hhi - a.hhi);
    for (const entry of sorted.slice(0, 30)) {
      const top = entry.top_producers[0];
      parts.push(`${entry.technology} | ${entry.material} | ${entry.hhi.toFixed(0)} | ${top?.country} (${top?.share}%)`);
    }
    parts.push(`... ${data.concentration.length} total tech-material pairs`);
  }

  // Country exposure data
  if (data?.exposure && data.exposure.length > 0) {
    parts.push("\n--- COUNTRY EXPOSURE (supply chain dominance) ---");
    parts.push("Country | Technologies | Materials | Dominated Materials | Avg Share | Max Share");
    for (const entry of data.exposure.slice(0, 20)) {
      parts.push(`${entry.country} | ${entry.num_technologies} | ${entry.num_materials} | ${entry.num_dominated} | ${entry.avg_share}% | ${entry.max_share}%`);
      if (entry.top_materials.length > 0) {
        parts.push(`  Top materials: ${entry.top_materials.map((m) => `${m.material} (${m.share}%)`).join(", ")}`);
      }
    }
  }

  // Cross-technology material overlap
  if (data?.overlap && data.overlap.length > 0) {
    parts.push("\n--- CROSS-TECHNOLOGY MATERIAL OVERLAP ---");
    parts.push("Material | # Technologies | HHI | Top Producer (share%)");
    for (const entry of data.overlap.slice(0, 20)) {
      const top = entry.top_producers[0];
      parts.push(`${entry.material} | ${entry.num_technologies} | ${entry.hhi.toFixed(0)} | ${top?.country} (${top?.share}%)`);
    }
  }

  // Include recent analysis results for context
  const analystResponses = analysisMessages.filter(
    (m) => m.role === "analyst" && m.response
  );

  if (analystResponses.length > 0) {
    parts.push("\n--- RECENT ANALYSES ---");
    for (const msg of analystResponses.slice(-3)) {
      const r = msg.response!;
      parts.push(`\nAnalysis: ${r.title}`);
      parts.push(`Summary: ${r.summary}`);
      for (const section of r.sections) {
        parts.push(`\n[${section.level.toUpperCase()}] ${section.title}`);
        for (const block of section.content) {
          if (block.type === "text") {
            parts.push(block.value);
          } else if (block.type === "bullet") {
            parts.push(block.items.map((item) => `  • ${item}`).join("\n"));
          } else if (block.type === "stat") {
            parts.push(`  ${block.label}: ${block.value}`);
          } else if (block.type === "table") {
            parts.push(`  ${block.headers.join(" | ")}`);
            for (const row of block.rows.slice(0, 10)) {
              parts.push(`  ${row.join(" | ")}`);
            }
            if (block.rows.length > 10) {
              parts.push(`  ... and ${block.rows.length - 10} more rows`);
            }
          }
        }
      }
    }
  }

  return parts.join("\n");
}
