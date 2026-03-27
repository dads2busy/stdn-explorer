import { useEffect } from "react";
import { useApi } from "../hooks/useApi";

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

  return (
    <div className="tech-selector">
      <label htmlFor="material-select">Material</label>
      <select
        id="material-select"
        value={selected ?? ""}
        onChange={(e) => onSelect(e.target.value || null)}
      >
        <option value="" disabled>
          Select a material...
        </option>
        {data.materials.map((m) => (
          <option key={m.material} value={m.material}>
            {m.material} ({m.num_technologies})
          </option>
        ))}
      </select>
    </div>
  );
}
