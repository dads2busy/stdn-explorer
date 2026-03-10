import { useState } from "react";
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
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <h1>STDN Explorer</h1>
          <nav className="view-tabs">
            <button
              className={`tab ${view === "explore" ? "active" : ""}`}
              onClick={() => { setView("explore"); setHighlightMaterial(null); setHighlightCountry(null); setHighlightTechnology(null); }}
            >
              Network
            </button>
            <button
              className={`tab ${view === "concentration" ? "active" : ""}`}
              onClick={() => { setView("concentration"); setHighlightMaterial(null); setHighlightCountry(null); setHighlightTechnology(null); }}
            >
              Concentration
            </button>
            <button
              className={`tab ${view === "exposure" ? "active" : ""}`}
              onClick={() => { setView("exposure"); setHighlightMaterial(null); setHighlightCountry(null); setHighlightTechnology(null); }}
            >
              Dominance
            </button>
            <button
              className={`tab ${view === "overlap" ? "active" : ""}`}
              onClick={() => { setView("overlap"); setHighlightMaterial(null); setHighlightCountry(null); setHighlightTechnology(null); }}
            >
              Overlap
            </button>
            <button
              className={`tab ${view === "disruption" ? "active" : ""}`}
              onClick={() => { setView("disruption"); setHighlightMaterial(null); setHighlightCountry(null); setHighlightTechnology(null); }}
            >
              Disruption
            </button>
            <button
              className={`tab ${view === "analyst" ? "active" : ""}`}
              onClick={() => { setView("analyst"); setHighlightMaterial(null); setHighlightCountry(null); setHighlightTechnology(null); }}
            >
              Analyst
            </button>
          </nav>
        </div>
        <p className="subtitle">
          Shallow Technology Dependency Networks — Supply Chain Risk Analysis
        </p>
        {view === "explore" && (
          <TechSelector selected={technology} onSelect={setTechnology} />
        )}
      </header>
      <main className="app-main">
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
      </main>
    </div>
  );
}

export default App;
