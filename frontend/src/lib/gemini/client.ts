import {
  GoogleGenerativeAI,
  type GenerativeModel,
  type ChatSession,
} from "@google/generative-ai";
import type { GeminiChatMessage } from "./types";

const SYSTEM_PROMPT = `You are a supply chain intelligence analyst specializing in critical technology supply chains. You have access to STDN (Supply-Technology Dependency Network) data that maps the dependency chain: Technology → Component → Material → Country.

Use the data context provided below to answer questions about:
- Supply chain risks and concentration (HHI scores, single-source dependencies)
- Country disruption impacts (which technologies are affected if a country's supply is cut)
- Material criticality and cross-technology overlap
- Country dominance in material production
- Component-level dependencies

Be concise (2-4 sentences unless more detail is needed). Use specific numbers from the context when available. Don't fabricate statistics not in the context. If the user has run structured analyses, you can see their results and provide deeper interpretation.`;

const MAX_HISTORY = 20;

let genai: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

function getModel(): GenerativeModel | null {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genai) {
    genai = new GoogleGenerativeAI(apiKey);
  }
  if (!model) {
    model = genai.getGenerativeModel({ model: "gemini-2.5-flash" });
  }
  return model;
}

export function isGeminiAvailable(): boolean {
  return !!import.meta.env.VITE_GEMINI_API_KEY;
}

export async function sendMessage(
  userMessage: string,
  context: string,
  history: GeminiChatMessage[]
): Promise<string> {
  const m = getModel();
  if (!m) throw new Error("Gemini API key not configured");

  const chatHistory = history.slice(-MAX_HISTORY).map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.text }],
  }));

  const chat: ChatSession = m.startChat({
    history: chatHistory,
    systemInstruction: {
      role: "user" as const,
      parts: [{ text: `${SYSTEM_PROMPT}\n\n--- STDN DATA CONTEXT ---\n${context}` }],
    },
  });

  const result = await chat.sendMessage(userMessage);
  return result.response.text().trim();
}
