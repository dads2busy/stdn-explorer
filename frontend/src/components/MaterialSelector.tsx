import { useEffect } from "react";
import { useApi } from "../hooks/useApi";
import { SearchableSelect } from "./SearchableSelect";

interface MaterialEntry {
  material: string;
  num_technologies: number;
}

interface Props {
  selected: string | null;
  onSelect: (material: string | null) => void;
  includePC: boolean;
}

export function MaterialSelector({ selected, onSelect, includePC }: Props) {
  const { data } = useApi<{ materials: MaterialEntry[] }>("/api/materials", "all", includePC);

  useEffect(() => {
    if (data?.materials.length) {
      if (!selected || !data.materials.some((m) => m.material === selected)) {
        onSelect(data.materials[0].material);
      }
    }
  }, [data, selected, onSelect]);

  if (!data) return null;

  const options = data.materials.map((m) => ({
    value: m.material,
    label: `${m.material} (${m.num_technologies})`,
  }));

  return (
    <div className="tech-selector">
      <label htmlFor="material-select">Material</label>
      <SearchableSelect
        id="material-select"
        options={options}
        value={selected ?? ""}
        onChange={(v) => onSelect(v || null)}
        placeholder="Search materials..."
      />
    </div>
  );
}
