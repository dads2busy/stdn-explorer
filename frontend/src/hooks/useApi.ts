import { useState, useEffect } from "react";

const IS_STATIC = import.meta.env.VITE_STATIC === "true";
const API_BASE = IS_STATIC ? import.meta.env.BASE_URL : "http://localhost:8080";

/** Convert an API path to a static JSON path with domain prefix. */
function staticPath(path: string, domain: string, includePC: boolean = true): string {
  let p = path.startsWith("/") ? path.slice(1) : path;
  // Strip query params (not used in static mode)
  p = p.replace(/\?.*$/, "");
  // Handle /table suffix
  p = p.replace(/\/table$/, "_table");
  // Insert domain (and no-pc prefix when needed) after "api/"
  const pcPrefix = includePC ? "" : "no-pc/";
  p = p.replace(/^api\//, `api/${domain}/${pcPrefix}`);
  return `${p}.json`;
}

export function useApi<T>(
  path: string | null,
  domain: string = "microelectronics",
  includePC: boolean = true,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setData(null);
      return;
    }
    let url: string;
    if (IS_STATIC) {
      url = `${API_BASE}${staticPath(path, domain, includePC)}`;
    } else {
      const sep = path.includes("?") ? "&" : "?";
      let fullPath = `${path}${sep}domain=${domain}`;
      if (!includePC) {
        fullPath += "&include_process_consumables=false";
      }
      url = `${API_BASE}${fullPath}`;
    }
    setLoading(true);
    setError(null);
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => setData(json))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [path, domain, includePC]);

  return { data, loading, error };
}

/** Get the fetch URL for a given API path (for manual fetches). */
export function apiUrl(
  path: string,
  domain: string = "microelectronics",
  includePC: boolean = true,
): string {
  if (IS_STATIC) {
    return `${API_BASE}${staticPath(path, domain, includePC)}`;
  }
  const sep = path.includes("?") ? "&" : "?";
  let fullPath = `${path}${sep}domain=${domain}`;
  if (!includePC) {
    fullPath += "&include_process_consumables=false";
  }
  return `${API_BASE}${fullPath}`;
}
