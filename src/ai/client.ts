import { GoogleGenAI } from "@google/genai";
import type {
  AIGenerateResponse,
  AIShapeDefinition,
  AIProvider,
} from "@/types";

// ============================================================================
// Provider Config
// ============================================================================

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-20250514";

const GEMINI_MODEL = "gemini-2.5-flash";

let geminiClient: GoogleGenAI | null = null;
let geminiClientKey: string | null = null;

// ============================================================================
// API Key Management
// ============================================================================

export function getStoredApiKey(): string | null {
  try {
    return localStorage.getItem("pig-ma-ai-api-key");
  } catch {
    return null;
  }
}

export function storeApiKey(key: string): void {
  localStorage.setItem("pig-ma-ai-api-key", key);
}

export function removeApiKey(): void {
  localStorage.removeItem("pig-ma-ai-api-key");
}

export function getStoredProvider(): AIProvider {
  try {
    const v = localStorage.getItem("pig-ma-ai-provider");
    if (v === "claude" || v === "gemini") return v;
  } catch {
    /* ignore */
  }
  return "gemini"; // default: free
}

export function storeProvider(provider: AIProvider): void {
  localStorage.setItem("pig-ma-ai-provider", provider);
}

// ============================================================================
// Unified API — Diagram Generation
// ============================================================================

export async function callAIForDiagram(
  provider: AIProvider,
  apiKey: string,
  prompt: string,
): Promise<AIGenerateResponse> {
  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(prompt);

  const content =
    provider === "claude"
      ? await callClaude(apiKey, systemPrompt, userMessage, 4096)
      : await callGemini(apiKey, systemPrompt, userMessage);

  return parseAIResponse(content);
}

// ============================================================================
// Unified API — Selection Analysis
// ============================================================================

export async function callAIForAnalysis(
  provider: AIProvider,
  apiKey: string,
  shapesDescription: string,
): Promise<{
  category: string;
  label: string;
  confidence: number;
  reasoning: string;
}> {
  const systemPrompt = `You analyze canvas objects and identify their semantic intent.
Respond with JSON only: { "category": string, "label": string, "confidence": number (0-1), "reasoning": string }
Categories: flowchart, org-chart, er-diagram, mind-map, sequence, form, layout, generic`;

  const userMessage = `Analyze these canvas objects and identify what they represent:\n\n${shapesDescription}`;

  const content =
    provider === "claude"
      ? await callClaude(apiKey, systemPrompt, userMessage, 1024)
      : await callGemini(apiKey, systemPrompt, userMessage);

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse analysis response.");
  }

  return JSON.parse(jsonMatch[0]);
}

// ============================================================================
// Claude API
// ============================================================================

async function callClaude(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    if (response.status === 401) {
      throw new Error("Invalid API key. Please check your Anthropic API key.");
    }
    if (response.status === 429) {
      throw new Error("Rate limited. Please wait a moment and try again.");
    }
    throw new Error(
      `Claude API error (${response.status}): ${errorBody || response.statusText}`,
    );
  }

  const data = await response.json();
  const content = data.content?.[0]?.text;
  if (!content) {
    throw new Error("Empty response from Claude API.");
  }
  return content;
}

// ============================================================================
// Gemini API (via @google/genai SDK)
// ============================================================================

function getGeminiClient(apiKey: string): GoogleGenAI {
  if (!geminiClient || geminiClientKey !== apiKey) {
    geminiClient = new GoogleGenAI({ apiKey });
    geminiClientKey = apiKey;
  }
  return geminiClient;
}

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const ai = getGeminiClient(apiKey);

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user" as const,
          parts: [{ text: systemPrompt }],
        },
        {
          role: "model" as const,
          parts: [{ text: "Understood. I will respond with valid JSON only." }],
        },
        {
          role: "user" as const,
          parts: [{ text: userMessage }],
        },
      ],
      config: {
        maxOutputTokens: 8192,
        temperature: 0.7,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const content = response.text;
    if (!content) {
      throw new Error("Empty response from Gemini API.");
    }
    return content;
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes("429") ||
        error.message.includes("RESOURCE_EXHAUSTED")
      ) {
        const retryMatch = error.message.match(/retry in (\d+(?:\.\d+)?)/i);
        const retrySeconds = retryMatch
          ? Math.ceil(parseFloat(retryMatch[1]))
          : 30;
        throw new Error(
          `Gemini rate limited. Retry in ${retrySeconds}s. Try a new API key from aistudio.google.com/apikey`,
        );
      }
      if (
        error.message.includes("API_KEY_INVALID") ||
        error.message.includes("PERMISSION_DENIED")
      ) {
        throw new Error(
          "Invalid Gemini API key. Get a free key at aistudio.google.com/apikey",
        );
      }
    }
    throw error;
  }
}

// ============================================================================
// Shared Prompts
// ============================================================================

function buildSystemPrompt(): string {
  return `You are a diagram generation AI for pig-ma canvas app.

RESPOND WITH VALID JSON ONLY.

Format:
{
  "shapes": [
    {
      "type": "shape",
      "text": "Label",
      "x": 0, "y": 0,
      "width": 160, "height": 80,
      "fill": "#bfdbfe",
      "shapeVariant": "flowProcess",
      "connections": [{ "targetIndex": 1, "label": "Yes" }]
    }
  ],
  "layout": "dag"
}

CRITICAL RULES:
1. DO NOT create separate connector objects. Instead, put "connections" array ON EACH NODE that has outgoing arrows.
2. "connections" uses targetIndex = the index of the target shape in the shapes array.
3. Every node MUST have "connections" if it leads to another node. Only terminal/end nodes have no connections.
4. shapeVariant options: flowProcess, flowDecision, flowTerminal, flowDatabase, flowDocument, rectangle, roundedRect, circle, diamond
5. Use "stickyNote" type for org charts or brainstorming.
6. Colors: #bfdbfe (blue), #bbf7d0 (green), #fef08a (yellow), #fecaca (red), #e9d5ff (purple), #fed7aa (orange)
7. Width 120-200px, height 60-100px.
8. x/y positions don't matter (auto-layout will reposition), but set them anyway.
9. layout: "dag" for flowcharts/hierarchies, "grid" for flat lists, "radial" for mind maps.

Example — 3-step flow:
{
  "shapes": [
    { "type": "shape", "text": "Start", "x": 0, "y": 0, "width": 120, "height": 60, "fill": "#bbf7d0", "shapeVariant": "flowTerminal", "connections": [{ "targetIndex": 1 }] },
    { "type": "shape", "text": "Process", "x": 0, "y": 150, "width": 160, "height": 80, "fill": "#bfdbfe", "shapeVariant": "flowProcess", "connections": [{ "targetIndex": 2 }] },
    { "type": "shape", "text": "End", "x": 0, "y": 300, "width": 120, "height": 60, "fill": "#bbf7d0", "shapeVariant": "flowTerminal" }
  ],
  "layout": "dag"
}`;
}

function buildUserMessage(prompt: string): string {
  return `Generate a diagram for: "${prompt}"

Respond with the JSON object only.`;
}

// ============================================================================
// Response Parsing (shared between providers)
// ============================================================================

function parseAIResponse(content: string): AIGenerateResponse {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      "Could not find JSON in response. Please try a simpler prompt.",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error("Invalid JSON in response. Please try again.");
  }

  const obj = parsed as Record<string, unknown>;

  if (!Array.isArray(obj.shapes) || obj.shapes.length === 0) {
    throw new Error(
      "No shapes in response. Please try a more specific prompt.",
    );
  }

  const shapes: AIShapeDefinition[] = obj.shapes.map(
    (s: Record<string, unknown>) => ({
      type: validateType(s.type as string),
      text: typeof s.text === "string" ? s.text : undefined,
      x: typeof s.x === "number" ? s.x : 100,
      y: typeof s.y === "number" ? s.y : 100,
      width: typeof s.width === "number" ? Math.max(s.width, 40) : 150,
      height: typeof s.height === "number" ? Math.max(s.height, 30) : 80,
      fill: typeof s.fill === "string" ? s.fill : undefined,
      shapeVariant:
        typeof s.shapeVariant === "string"
          ? (s.shapeVariant as AIShapeDefinition["shapeVariant"])
          : undefined,
      connections: Array.isArray(s.connections) ? s.connections : undefined,
    }),
  );

  const layout = ["dag", "grid", "radial"].includes(obj.layout as string)
    ? (obj.layout as AIGenerateResponse["layout"])
    : "dag";

  return { shapes, layout };
}

function validateType(type: string): AIShapeDefinition["type"] {
  const validTypes = [
    "shape",
    "stickyNote",
    "textBox",
    "connector",
    "image",
    "line",
    "connectorLabel",
    "table",
    "chart",
    "codeBlock",
    "embed",
  ];
  return validTypes.includes(type)
    ? (type as AIShapeDefinition["type"])
    : "shape";
}
