import type { AISliceState, AISliceActions, ShapeIntent } from "@/types";
import type { SliceCreator } from "../types";
import {
  callAIForDiagram,
  callAIForAnalysis,
  convertAIShapesToObjects,
  getStoredApiKey,
  getStoredProvider,
  storeApiKey,
  storeProvider,
} from "@/ai";

export const aiInitialState: AISliceState = {
  aiProvider: getStoredProvider(),
  aiApiKey: getStoredApiKey(),
  aiLoading: false,
  aiError: null,
  shapeIntents: new Map(),
  aiUsageCount: 0,
};

export const createAISlice: SliceCreator<AISliceActions> = (set, get) => ({
  setAIProvider: (provider) => {
    storeProvider(provider);
    set({ aiProvider: provider });
  },

  setAIApiKey: (key) => {
    if (key) {
      storeApiKey(key);
    }
    set({ aiApiKey: key });
  },

  generateDiagram: async (prompt) => {
    const { aiProvider, aiApiKey } = get();
    if (!aiApiKey) {
      const keyName = aiProvider === "gemini" ? "Gemini" : "Claude";
      set({
        aiError: `Please set your ${keyName} API key first.`,
      });
      return;
    }

    set({ aiLoading: true, aiError: null });

    try {
      const response = await callAIForDiagram(aiProvider, aiApiKey, prompt);

      // 뷰포트 중앙 계산
      const { viewport } = get();
      const stageRef = get().stageRef;
      const stageWidth = stageRef?.current?.width() ?? window.innerWidth;
      const stageHeight = stageRef?.current?.height() ?? window.innerHeight;

      const centerX = (-viewport.x + stageWidth / 2) / viewport.zoom;
      const centerY = (-viewport.y + stageHeight / 2) / viewport.zoom;

      const objects = convertAIShapesToObjects(response, {
        x: centerX,
        y: centerY,
      });

      // 캔버스에 objects 추가
      for (const obj of objects) {
        get().addObject(obj);
      }

      // 생성된 객체 선택
      const newIds = objects
        .filter((o) => o.type !== "connector")
        .map((o) => o.id);
      if (newIds.length > 0) {
        set({ selectedIds: newIds });
      }

      set({
        aiLoading: false,
        aiUsageCount: get().aiUsageCount + 1,
      });
    } catch (error) {
      set({
        aiLoading: false,
        aiError:
          error instanceof Error ? error.message : "Unknown error occurred.",
      });
    }
  },

  analyzeSelection: async () => {
    const { aiProvider, aiApiKey } = get();
    if (!aiApiKey) {
      const keyName = aiProvider === "gemini" ? "Gemini" : "Claude";
      set({ aiError: `Please set your ${keyName} API key first.` });
      return;
    }

    const { selectedIds, objects } = get();
    if (selectedIds.length === 0) {
      set({ aiError: "Select objects to analyze." });
      return;
    }

    const selectedObjects = objects.filter((o) => selectedIds.includes(o.id));
    if (selectedObjects.length === 0) return;

    const description = selectedObjects
      .map(
        (o) =>
          `- ${o.type}${o.shapeVariant ? ` (${o.shapeVariant})` : ""}: "${o.text || ""}" at (${Math.round(o.x)}, ${Math.round(o.y)}) size ${o.width ?? 0}x${o.height ?? 0}`,
      )
      .join("\n");

    set({ aiLoading: true, aiError: null });

    try {
      const result = await callAIForAnalysis(aiProvider, aiApiKey, description);

      const intent: ShapeIntent = {
        objectIds: selectedIds,
        category: result.category as ShapeIntent["category"],
        label: result.label,
        confidence: result.confidence,
        reasoning: result.reasoning,
      };

      const key = selectedIds.sort().join(",");
      const newIntents = new Map(get().shapeIntents);
      newIntents.set(key, intent);

      set({
        shapeIntents: newIntents,
        aiLoading: false,
        aiUsageCount: get().aiUsageCount + 1,
      });
    } catch (error) {
      set({
        aiLoading: false,
        aiError: error instanceof Error ? error.message : "Analysis failed.",
      });
    }
  },

  clearAIError: () => set({ aiError: null }),

  clearShapeIntents: () => set({ shapeIntents: new Map() }),
});
