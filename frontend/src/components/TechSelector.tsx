import { useEffect } from "react";
import { useApi } from "../hooks/useApi";

interface Props {
  selected: string | null;
  onSelect: (tech: string) => void;
  domain: string;
  includePC: boolean;
}

export function TechSelector({ selected, onSelect, domain, includePC }: Props) {
  const { data } = useApi<{ technologies: string[] }>("/api/technologies", domain, includePC);

  useEffect(() => {
    if (!selected && data?.technologies.length) {
      onSelect(data.technologies[0]);
    }
  }, [data, selected, onSelect]);

  if (!data) return null;

  return (
    <div className="tech-selector">
      <label htmlFor="tech-select">Technology</label>
      <select
        id="tech-select"
        value={selected ?? ""}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="" disabled>
          Select a technology...
        </option>
        {data.technologies.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}
