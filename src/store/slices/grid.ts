import type { GridType, CanvasStoreActions } from "@/types";
import type { SliceCreator } from "../types";

// ============================================================================
// Grid Slice Types
// ============================================================================

export interface GridState {
  gridType: GridType;
  gridColor: string;
}

export interface GridActions {
  setGridType: CanvasStoreActions["setGridType"];
  setGridColor: CanvasStoreActions["setGridColor"];
}

export type GridSlice = GridState & GridActions;

// ============================================================================
// Initial State
// ============================================================================

export const gridInitialState: GridState = {
  gridType: "dots",
  gridColor: "#d4d4d4",
};

// ============================================================================
// Slice Creator
// ============================================================================

export const createGridSlice: SliceCreator<GridSlice> = (set) => ({
  ...gridInitialState,

  setGridType: (type) => set({ gridType: type }),

  setGridColor: (color) => set({ gridColor: color }),
});
