import { useState } from "react";
import { TechSelector } from "./components/TechSelector";
import { StdnGraph } from "./components/StdnGraph";
import { ConcentrationHeatmap } from "./components/ConcentrationHeatmap";
import { CountryExposure } from "./components/CountryExposure";
import { CrossTechOverlap } from "./components/CrossTechOverlap";
import { DisruptionSimulator } from "./components/DisruptionSimulator";
import "./App.css";

type View = "explore" | "concentration" | "exposure" | "overlap" | "disruption";

function App() {
  const [view, setView] = useState<View>("explore");
  const [technology, setTechnology] = useState<string | null>(null);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <h1>STDN Explorer</h1>
          <nav className="view-tabs">
            <button
              className={`tab ${view === "explore" ? "active" : ""}`}
              onClick={() => setView("explore")}
            >
              Network
            </button>
            <button
              className={`tab ${view === "concentration" ? "active" : ""}`}
              onClick={() => setView("concentration")}
            >
              Concentration
            </button>
            <button
              className={`tab ${view === "exposure" ? "active" : ""}`}
              onClick={() => setView("exposure")}
            >
              Dominance
            </button>
            <button
              className={`tab ${view === "overlap" ? "active" : ""}`}
              onClick={() => setView("overlap")}
            >
              Overlap
            </button>
            <button
              className={`tab ${view === "disruption" ? "active" : ""}`}
              onClick={() => setView("disruption")}
            >
              Disruption
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
            <StdnGraph technology={technology} />
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
        {view === "concentration" && <ConcentrationHeatmap />}
        {view === "exposure" && <CountryExposure />}
        {view === "overlap" && <CrossTechOverlap />}
        {view === "disruption" && <DisruptionSimulator />}
      </main>
    </div>
  );
}

export default App;
