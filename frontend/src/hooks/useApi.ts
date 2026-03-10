import { useState, useEffect } from "react";

const IS_STATIC = import.meta.env.VITE_STATIC === "true";
const API_BASE = IS_STATIC ? import.meta.env.BASE_URL : "http://localhost:8080";

/** Convert an API path like /api/stdn/Smartphone to a static JSON path. */
function staticPath(path: string): string {
  // /api/stdn/Smartphone/table -> api/stdn/Smartphone_table.json
  // /api/stdn/Smartphone -> api/stdn/Smartphone.json
  // /api/concentration -> api/concentration.json
  // /api/disruption/China -> api/disruption/China.json
  let p = path.startsWith("/") ? path.slice(1) : path;
  // Handle /table suffix
  p = p.replace(/\/table$/, "_table");
  return `${p}.json`;
}

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    const url = IS_STATIC
      ? `${API_BASE}${staticPath(path)}`
      : `${API_BASE}${path}`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => setData(json))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [path]);

  return { data, loading, error };
}

/** Get the fetch URL for a given API path (for manual fetches). */
export function apiUrl(path: string): string {
  if (IS_STATIC) {
    return `${API_BASE}${staticPath(path)}`;
  }
  return `${API_BASE}${path}`;
}
