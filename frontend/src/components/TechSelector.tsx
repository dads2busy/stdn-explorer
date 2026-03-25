import { useEffect } from "react";
import { useApi } from "../hooks/useApi";

interface Props {
  selected: string | null;
  onSelect: (tech: string | null) => void;
  domain: string;
  includePC: boolean;
  allowAll?: boolean;
}

export function TechSelector({ selected, onSelect, domain, includePC, allowAll }: Props) {
  const { data } = useApi<{ technologies: string[] }>("/api/technologies", domain, includePC);

  useEffect(() => {
    if (data?.technologies.length) {
      if (allowAll) {
        // Default to "all" when allowAll is enabled and selection is invalid
        if (selected !== null && selected !== "" && !data.technologies.includes(selected)) {
          onSelect(null);
        }
      } else {
        if (!selected || !data.technologies.includes(selected)) {
          onSelect(data.technologies[0]);
        }
      }
    }
  }, [data, selected, onSelect, allowAll]);

  if (!data) return null;

  return (
    <div className="tech-selector">
      <label htmlFor="tech-select">Technology</label>
      <select
        id="tech-select"
        value={selected ?? ""}
        onChange={(e) => onSelect(e.target.value || null)}
      >
        {allowAll ? (
          <option value="">All Technologies ({data.technologies.length})</option>
        ) : (
          <option value="" disabled>
            Select a technology...
          </option>
        )}
        {data.technologies.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}
