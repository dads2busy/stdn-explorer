import { useState, useRef, useEffect } from "react";
import { isGeminiAvailable, sendMessage } from "../../lib/gemini/client";
import { buildStdnContext, type StdnData } from "../../lib/gemini/context";
import { fetchGraphContext } from "../../lib/gemini/graphContext";
import type { GeminiChatMessage } from "../../lib/gemini/types";
import type { ChatMessage } from "./types";

interface Props {
  analysisMessages: ChatMessage[];
  technologies: string[];
  countries: string[];
  stdnData?: StdnData;
}

export function GeminiChatPanel({ analysisMessages, technologies, countries, stdnData }: Props) {
  const [messages, setMessages] = useState<GeminiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const available = isGeminiAvailable();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setError(null);
    const userMsg: GeminiChatMessage = { role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // Fetch graph context (graceful degradation if it fails)
      const graphResult = await Promise.allSettled([fetchGraphContext(text)]);
      const graphContext =
        graphResult[0].status === "fulfilled" ? graphResult[0].value : undefined;

      const context = buildStdnContext(
        analysisMessages, technologies, countries, stdnData, graphContext
      );
      const response = await sendMessage(text, context, [...messages, userMsg]);
      setMessages((prev) => [...prev, { role: "model", text: response }]);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Failed to get response";
      setError(errMsg.includes("429") ? "Rate limit reached. Please wait a moment." : errMsg);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!available) {
    return (
      <div className="gemini-panel">
        <div className="gemini-header">
          <span className="gemini-title">Ask Gemini</span>
        </div>
        <div className="gemini-unavailable">
          <p>Gemini API key not configured.</p>
          <p>Add <code>VITE_GEMINI_API_KEY</code> to <code>.env.local</code></p>
        </div>
      </div>
    );
  }

  return (
    <div className="gemini-panel">
      <div className="gemini-header">
        <span className="gemini-title">Ask Gemini</span>
        {messages.length > 0 && (
          <button
            className="gemini-clear"
            onClick={() => { setMessages([]); setError(null); }}
          >
            Clear
          </button>
        )}
      </div>

      <div className="gemini-messages">
        {messages.length === 0 && !loading && (
          <div className="gemini-msg gemini-msg-model">
            <div className="gemini-msg-bubble">
              Hello! I'm ready to analyze your STDN data. I can help you understand supply chain risks, country disruption impacts, material criticality, and component dependencies across the 24 technologies and 43 countries in our dataset. What would you like to know?
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`gemini-msg gemini-msg-${msg.role}`}>
            <div className="gemini-msg-bubble">
              {msg.text.split("\n").map((line, j) => (
                <span key={j}>
                  {line}
                  {j < msg.text.split("\n").length - 1 && <br />}
                </span>
              ))}
            </div>
          </div>
        ))}
        {loading && (
          <div className="gemini-msg gemini-msg-model">
            <div className="gemini-msg-bubble gemini-loading">
              <span className="gemini-dot" />
              <span className="gemini-dot" />
              <span className="gemini-dot" />
            </div>
          </div>
        )}
        {error && <div className="gemini-error">{error}</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="gemini-input-bar">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={loading ? "Please wait..." : "Ask about supply chains..."}
          disabled={loading}
          className="gemini-input"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="gemini-send"
        >
          Send
        </button>
      </div>
    </div>
  );
}
