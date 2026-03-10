import { useApi } from "../hooks/useApi";

interface Props {
  selected: string | null;
  onSelect: (tech: string) => void;
}

export function TechSelector({ selected, onSelect }: Props) {
  const { data } = useApi<{ technologies: string[] }>("/api/technologies");

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
