import type { ShapeVariant, ChartVariant, CanvasStoreActions } from "@/types";
import type { SliceCreator } from "../types";

// Default favorites that are always shown in toolbar
export const DEFAULT_FAVORITE_SHAPES: ShapeVariant[] = ["triangle", "diamond"];

// ============================================================================
// Shapes Panel Slice Types
// ============================================================================

export interface ShapesState {
  showShapesPanel: boolean;
  selectedShapeVariant: ShapeVariant;
  recentShapes: ShapeVariant[];
  favoriteShapes: ShapeVariant[];
  selectedChartVariant: ChartVariant;
}

export interface ShapesActions {
  setShowShapesPanel: CanvasStoreActions["setShowShapesPanel"];
  setSelectedShapeVariant: CanvasStoreActions["setSelectedShapeVariant"];
  addRecentShape: CanvasStoreActions["addRecentShape"];
  toggleFavoriteShape: CanvasStoreActions["toggleFavoriteShape"];
  setSelectedChartVariant: CanvasStoreActions["setSelectedChartVariant"];
}

export type ShapesSlice = ShapesState & ShapesActions;

// ============================================================================
// Initial State
// ============================================================================

export const shapesInitialState: ShapesState = {
  showShapesPanel: false,
  selectedShapeVariant: "rectangle",
  recentShapes: [],
  favoriteShapes: [...DEFAULT_FAVORITE_SHAPES],
  selectedChartVariant: "bar",
};

// ============================================================================
// Slice Creator
// ============================================================================

export const createShapesSlice: SliceCreator<ShapesSlice> = (set) => ({
  ...shapesInitialState,

  setShowShapesPanel: (show) => set({ showShapesPanel: show }),

  setSelectedShapeVariant: (variant) => set({ selectedShapeVariant: variant }),

  addRecentShape: (variant) =>
    set((state) => {
      const filtered = state.recentShapes.filter((v) => v !== variant);
      return { recentShapes: [variant, ...filtered].slice(0, 4) };
    }),

  toggleFavoriteShape: (variant) =>
    set((state) => {
      // Cannot remove default favorites
      if (
        DEFAULT_FAVORITE_SHAPES.includes(variant) &&
        state.favoriteShapes.includes(variant)
      ) {
        return state;
      }
      // If already in favorites, remove it
      if (state.favoriteShapes.includes(variant)) {
        return {
          favoriteShapes: state.favoriteShapes.filter((v) => v !== variant),
        };
      }
      // Max 3 favorites
      if (state.favoriteShapes.length >= 3) {
        return state;
      }
      return {
        favoriteShapes: [...state.favoriteShapes, variant],
      };
    }),

  setSelectedChartVariant: (variant) => set({ selectedChartVariant: variant }),
});
