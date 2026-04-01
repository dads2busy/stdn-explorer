import { useEffect } from "react";
import { useApi } from "../hooks/useApi";
import { SearchableSelect } from "./SearchableSelect";

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

  const options = allowAll
    ? [{ value: "", label: `All Technologies (${data.technologies.length})` }, ...data.technologies.map((t) => ({ value: t, label: t }))]
    : data.technologies.map((t) => ({ value: t, label: t }));

  return (
    <div className="tech-selector">
      <label htmlFor="tech-select">Technology</label>
      <SearchableSelect
        id="tech-select"
        options={options}
        value={selected ?? ""}
        onChange={(v) => onSelect(v || null)}
        placeholder="Search technologies..."
      />
    </div>
  );
}
