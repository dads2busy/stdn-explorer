import { useState, useCallback, useRef, useEffect } from "react";
import { TechSelector } from "./components/TechSelector";
import { StdnGraph } from "./components/StdnGraph";
import { ConcentrationHeatmap } from "./components/ConcentrationHeatmap";
import { CountryExposure } from "./components/CountryExposure";
import { CrossTechOverlap } from "./components/CrossTechOverlap";
import { DisruptionSimulator } from "./components/DisruptionSimulator";
import { TradeDisruption } from "./components/TradeDisruption";
import { PolicyAnalyst } from "./components/PolicyAnalyst";
import { Methodology } from "./components/Methodology";
import { MeasureDescription } from "./components/MeasureDescription";
import { MaterialGraph } from "./components/MaterialGraph";
import { MaterialSelector } from "./components/MaterialSelector";
import "./App.css";

type View = "explore" | "material" | "concentration" | "exposure" | "overlap" | "disruption" | "trade" | "analyst" | "methodology";

function App() {
  const [view, setView] = useState<View>("explore");
  const [technology, setTechnology] = useState<string | null>(null);
  const [highlightMaterial, setHighlightMaterial] = useState<string | null>(null);
  const [highlightCountry, setHighlightCountry] = useState<string | null>(null);
  const [highlightTechnology, setHighlightTechnology] = useState<string | null>(null);
  const [viewKey, setViewKey] = useState(0);
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const [includePC, setIncludePC] = useState(true);
  const [domain, setDomain] = useState("microelectronics");
  const mainRef = useRef<HTMLElement>(null);
  const skipDomainResetRef = useRef(false);

  useEffect(() => {
    if (skipDomainResetRef.current) {
      skipDomainResetRef.current = false;
      return;
    }
    setTechnology(null);
  }, [domain]);

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
            <button className={`tab ${view === "explore" ? "active" : ""}`} onClick={() => switchView("explore")}>Technology Network</button>
            <button className={`tab ${view === "material" ? "active" : ""}`} onClick={() => switchView("material")}>Material Network</button>
            <button className={`tab ${view === "concentration" ? "active" : ""}`} onClick={() => switchView("concentration")}>Concentration</button>
            <button className={`tab ${view === "exposure" ? "active" : ""}`} onClick={() => switchView("exposure")}>Dominance</button>
            <button className={`tab ${view === "overlap" ? "active" : ""}`} onClick={() => switchView("overlap")}>Overlap</button>
            <button className={`tab ${view === "disruption" ? "active" : ""}`} onClick={() => switchView("disruption")}>Supply Disruption</button>
            <button className={`tab ${view === "trade" ? "active" : ""}`} onClick={() => switchView("trade")}>Trade Disruption</button>
            <button className={`tab ${view === "analyst" ? "active" : ""}`} onClick={() => switchView("analyst")}>Analyst</button>
            <button className={`tab ${view === "methodology" ? "active" : ""}`} onClick={() => switchView("methodology")}>Methodology</button>
          </nav>
        </div>
        <p className="subtitle">
          Shallow Technology Dependency Networks — Supply Chain Risk Analysis
        </p>
        <div className="header-controls">
          {view !== "material" && (
            <div className="domain-selector">
              <label htmlFor="domain-select">Domain</label>
              <select id="domain-select" value={domain} onChange={(e) => setDomain(e.target.value)}>
                <option value="microelectronics">Microelectronics</option>
                <option value="biotechnology">Biotechnology</option>
                <option value="pharmaceuticals">Pharmaceuticals</option>
                <option value="all">All Domains</option>
              </select>
            </div>
          )}
          {(view === "explore" || view === "concentration") && (
            <TechSelector selected={technology} onSelect={setTechnology} domain={domain} includePC={includePC} allowAll={view === "concentration"} />
          )}
          {view === "material" && (
            <MaterialSelector selected={selectedMaterial} onSelect={setSelectedMaterial} includePC={includePC} />
          )}
          <div className="pc-toggle">
            <label>
              <input
                type="checkbox"
                checked={includePC}
                onChange={(e) => setIncludePC(e.target.checked)}
              />
              Include Process Consumables
            </label>
          </div>
        </div>
      </header>
      <main className="app-main" ref={mainRef} key={viewKey}>
        <div className="view-enter" style={{ display: 'contents' }}>
          {view === "explore" && (
            <div className="graph-container">
              <div style={{ padding: "0 1.5rem" }}>
                <h2 className="heatmap-title">Technology Dependency Network</h2>
                <MeasureDescription measure="network" />
              </div>
              {technology ? (
                <StdnGraph technology={technology} domain={domain} includePC={includePC} onNavigate={handleNavigate} onNavigateToMaterial={(mat) => {
                  setSelectedMaterial(mat);
                  switchView("material");
                }} />
              ) : (
                <p style={{ padding: "1rem 1.5rem", opacity: 0.6, fontSize: "0.85rem" }}>
                  Select a technology above to explore its supply chain dependencies.
                </p>
              )}
            </div>
          )}
          {view === "material" && (
            <div className="graph-container">
              <div style={{ padding: "0 1.5rem" }}>
                <h2 className="heatmap-title">Material Dependency Network</h2>
                <MeasureDescription measure="material_network" />
              </div>
              {selectedMaterial ? (
                <MaterialGraph material={selectedMaterial} includePC={includePC} onNavigateToTechnology={(d, t) => {
                  skipDomainResetRef.current = true;
                  setDomain(d);
                  setTechnology(t);
                  setView("explore");
                  setViewKey(k => k + 1);
                }} />
              ) : (
                <p style={{ padding: "1rem 1.5rem", opacity: 0.6, fontSize: "0.85rem" }}>
                  Select a material above to explore which technologies depend on it.
                </p>
              )}
            </div>
          )}
          {view === "concentration" && <ConcentrationHeatmap domain={domain} includePC={includePC} technology={technology} highlightMaterial={highlightMaterial} highlightTechnology={highlightTechnology} onHighlightClear={() => { setHighlightMaterial(null); setHighlightTechnology(null); }} />}
          {view === "exposure" && <CountryExposure domain={domain} includePC={includePC} highlightCountry={highlightCountry} onHighlightClear={() => setHighlightCountry(null)} />}
          {view === "overlap" && <CrossTechOverlap domain={domain} includePC={includePC} highlightMaterial={highlightMaterial} onHighlightClear={() => setHighlightMaterial(null)} />}
          {view === "disruption" && <DisruptionSimulator domain={domain} includePC={includePC} />}
          {view === "trade" && <TradeDisruption domain={domain} includePC={includePC} />}
          {view === "analyst" && <PolicyAnalyst domain={domain} />}
          {view === "methodology" && <Methodology />}
        </div>
      </main>
    </div>
  );
}

export default App;
