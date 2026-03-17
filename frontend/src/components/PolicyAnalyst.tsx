import { useState } from "react";
import { useApi, apiUrl } from "../hooks/useApi";
import { MeasureDescription } from "./MeasureDescription";
import type { ChatMessage, QueryParams, QueryType } from "./analyst/types";
import { QUERY_TEMPLATES } from "./analyst/queryTemplates";
import { routeToGenerator } from "./analyst/analysisGenerators";
import { AnalystChat } from "./analyst/AnalystChat";
import { GeminiChatPanel } from "./analyst/GeminiChatPanel";

export function PolicyAnalyst() {
  const { data: techData } = useApi<{ technologies: string[] }>(
    "/api/technologies",
  );
  const { data: countryData } = useApi<{
    countries: { country: string; count: number }[];
  }>("/api/countries");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<QueryType | null>(
    null,
  );
  const [paramValue, setParamValue] = useState("");

  const currentTemplate = QUERY_TEMPLATES.find(
    (t) => t.id === selectedTemplate,
  );

  const handleSubmitTemplate = async (
    template: (typeof QUERY_TEMPLATES)[number],
    paramOverride?: string,
  ) => {
    const pv = paramOverride ?? paramValue;
    const params: QueryParams =
      template.paramType === "technology"
        ? { technology: pv }
        : template.paramType === "country"
          ? { country: pv }
          : {};

    const questionText = template.formatQuestion(params);
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      displayText: questionText,
    };
    const analystId = crypto.randomUUID();
    const analystMsg: ChatMessage = {
      id: analystId,
      role: "analyst",
      displayText: "",
      loading: true,
    };

    setMessages([userMsg, analystMsg]);

    try {
      const paths = template.getApiPaths(params);
      const responses = await Promise.all(
        paths.map((p) =>
          fetch(apiUrl(p)).then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
          }),
        ),
      );

      const analysis = routeToGenerator(template.id, params, responses);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === analystId ? { ...m, loading: false, response: analysis } : m,
        ),
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === analystId
            ? { ...m, loading: false, error: (err as Error).message }
            : m,
        ),
      );
    }
  };

  const needsParam = currentTemplate && currentTemplate.paramType !== "none";
  const canSubmit = currentTemplate && (!needsParam || paramValue);

  const { data: concData } = useApi<{ concentration: any[] }>("/api/concentration");
  const { data: expData } = useApi<{ exposures: any[] }>("/api/country-exposure");
  const { data: overlapData } = useApi<{ material_overlap: any[] }>("/api/overlap");

  const techList = techData?.technologies ?? [];
  const countryList = countryData?.countries.map((c) => c.country) ?? [];

  const stdnData = {
    concentration: concData?.concentration,
    exposure: expData?.exposures,
    overlap: overlapData?.material_overlap,
  };

  return (
    <div className="analyst-container">
      <h2 className="heatmap-title">Policy Analyst</h2>
      <MeasureDescription measure="analyst" />

      <div className="analyst-body">
        <div className="analyst-main">
          <div className="analyst-controls">
            <div className="analyst-template-picker">
              {QUERY_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  className={`analyst-template-chip ${selectedTemplate === t.id ? "active" : ""}`}
                  onClick={() => {
                    setSelectedTemplate(t.id);
                    setParamValue("");
                    if (t.paramType === "none") {
                      handleSubmitTemplate(t);
                    }
                  }}
                  title={t.description}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {selectedTemplate && needsParam && (
              <div className="analyst-param-bar">
                {currentTemplate.paramType === "technology" && (
                  <select
                    value={paramValue}
                    onChange={(e) => setParamValue(e.target.value)}
                  >
                    <option value="">Select technology...</option>
                    {techData?.technologies.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                )}
                {currentTemplate.paramType === "country" && (
                  <select
                    value={paramValue}
                    onChange={(e) => setParamValue(e.target.value)}
                  >
                    <option value="">Select country...</option>
                    {countryData?.countries.map((c) => (
                      <option key={c.country} value={c.country}>
                        {c.country}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  className="analyst-submit-btn"
                  onClick={() => handleSubmitTemplate(currentTemplate)}
                  disabled={!canSubmit}
                >
                  Analyze
                </button>
              </div>
            )}
          </div>

          <div className="analyst-chat-area">
            {messages.length === 0 ? (
              <div className="analyst-welcome">
                <h3>Supply Chain Policy Analysis</h3>
                <p>
                  Select an analysis type above to get a structured policy report
                  based on the STDN data.
                </p>
              </div>
            ) : (
              <AnalystChat messages={messages} />
            )}
          </div>
        </div>

        <GeminiChatPanel
          analysisMessages={messages}
          technologies={techList}
          countries={countryList}
          stdnData={stdnData}
        />
      </div>
    </div>
  );
}
