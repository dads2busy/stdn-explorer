import type { AnalysisResponse, AnalysisContent } from "./types";

function renderBlock(block: AnalysisContent, key: number) {
  switch (block.type) {
    case "text":
      return (
        <p key={key} className="analyst-text">
          {block.value}
        </p>
      );
    case "bullet":
      return (
        <ul key={key} className="analyst-bullets">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case "table":
      return (
        <table key={key} className="analyst-table">
          <thead>
            <tr>
              {block.headers.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "stat":
      return (
        <div key={key} className="analyst-stat">
          <span className="analyst-stat-label">{block.label}</span>
          <span className="analyst-stat-value">{block.value}</span>
        </div>
      );
  }
}

interface Props {
  response: AnalysisResponse;
}

export function AnalystResponseRenderer({ response }: Props) {
  return (
    <div className="analyst-response">
      <h3 className="analyst-response-title">{response.title}</h3>
      <p className="analyst-response-summary">{response.summary}</p>
      {response.sections.map((section, i) => (
        <div
          key={i}
          className={`analyst-section analyst-section-${section.level}`}
        >
          <h4 className="analyst-section-title">
            <span className={`analyst-level-dot level-${section.level}`} />
            {section.title}
          </h4>
          {section.content.map((block, j) => renderBlock(block, j))}
        </div>
      ))}
    </div>
  );
}
