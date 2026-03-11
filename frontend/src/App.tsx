import { useState, useCallback, useRef, useEffect } from "react";
import { TechSelector } from "./components/TechSelector";
import { StdnGraph } from "./components/StdnGraph";
import { ConcentrationHeatmap } from "./components/ConcentrationHeatmap";
import { CountryExposure } from "./components/CountryExposure";
import { CrossTechOverlap } from "./components/CrossTechOverlap";
import { DisruptionSimulator } from "./components/DisruptionSimulator";
import { PolicyAnalyst } from "./components/PolicyAnalyst";
import "./App.css";

type View = "explore" | "concentration" | "exposure" | "overlap" | "disruption" | "analyst";

function App() {
  const [view, setView] = useState<View>("explore");
  const [technology, setTechnology] = useState<string | null>(null);
  const [highlightMaterial, setHighlightMaterial] = useState<string | null>(null);
  const [highlightCountry, setHighlightCountry] = useState<string | null>(null);
  const [highlightTechnology, setHighlightTechnology] = useState<string | null>(null);
  const [viewKey, setViewKey] = useState(0);
  const mainRef = useRef<HTMLElement>(null);

  const switchView = useCallback((newView: View) => {
    setView(newView);
    setViewKey(k => k + 1);
    setHighlightMaterial(null);
    setHighlightCountry(null);
    setHighlightTechnology(null);
  }, []);

  const handleNavigate = (target: View, value: string, tech?: string) => {
    if (target === "exposure") {
      setHighlightCountry(value);
      setHighlightMaterial(null);
      setHighlightTechnology(null);
    } else {
      setHighlightMaterial(value);
      setHighlightCountry(null);
      setHighlightTechnology(tech ?? null);
    }
    setView(target);
    setViewKey(k => k + 1);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <h1>STDN Explorer</h1>
          <nav className="view-tabs">
            <button className={`tab ${view === "explore" ? "active" : ""}`} onClick={() => switchView("explore")}>Network</button>
            <button className={`tab ${view === "concentration" ? "active" : ""}`} onClick={() => switchView("concentration")}>Concentration</button>
            <button className={`tab ${view === "exposure" ? "active" : ""}`} onClick={() => switchView("exposure")}>Dominance</button>
            <button className={`tab ${view === "overlap" ? "active" : ""}`} onClick={() => switchView("overlap")}>Overlap</button>
            <button className={`tab ${view === "disruption" ? "active" : ""}`} onClick={() => switchView("disruption")}>Disruption</button>
            <button className={`tab ${view === "analyst" ? "active" : ""}`} onClick={() => switchView("analyst")}>Analyst</button>
          </nav>
        </div>
        <p className="subtitle">
          Shallow Technology Dependency Networks — Supply Chain Risk Analysis
        </p>
        {view === "explore" && (
          <TechSelector selected={technology} onSelect={setTechnology} />
        )}
      </header>
      <main className="app-main" ref={mainRef} key={viewKey}>
        <div className="view-enter" style={{ display: 'contents' }}>
          {view === "explore" && (
            technology ? (
              <StdnGraph technology={technology} onNavigate={handleNavigate} />
            ) : (
              <div className="placeholder">
                <h2>Select a technology to explore its supply chain dependencies</h2>
                <p>
                  Each technology is broken down into components, raw materials, and
                  producing countries — forming a 4-layer dependency network.
                </p>
              </div>
            )
          )}
          {view === "concentration" && <ConcentrationHeatmap highlightMaterial={highlightMaterial} highlightTechnology={highlightTechnology} onHighlightClear={() => { setHighlightMaterial(null); setHighlightTechnology(null); }} />}
          {view === "exposure" && <CountryExposure highlightCountry={highlightCountry} onHighlightClear={() => setHighlightCountry(null)} />}
          {view === "overlap" && <CrossTechOverlap highlightMaterial={highlightMaterial} onHighlightClear={() => setHighlightMaterial(null)} />}
          {view === "disruption" && <DisruptionSimulator />}
          {view === "analyst" && <PolicyAnalyst />}
        </div>
      </main>
    </div>
  );
}

export default App;
