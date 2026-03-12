import type { ChatMessage } from "../../components/analyst/types";

/**
 * Build a text context string from the current analyst state
 * to send alongside Gemini messages.
 */
export function buildStdnContext(
  analysisMessages: ChatMessage[],
  technologies: string[],
  countries: string[]
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

  // Include recent analysis results for context
  const analystResponses = analysisMessages.filter(
    (m) => m.role === "analyst" && m.response
  );

  if (analystResponses.length > 0) {
    parts.push("\n--- RECENT ANALYSES ---");
    // Include last 3 analyses to keep context manageable
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
