import type {
  PenSettings,
  ShapeSettings,
  EraserSize,
  PathStyle,
  ElbowCornerStyle,
  MarkerStyle,
  CanvasStoreActions,
} from "@/types";
import type { SliceCreator } from "../types";

// ============================================================================
// Drawing Slice Types
// ============================================================================

export interface DrawingState {
  penSettings: PenSettings;
  shapeSettings: ShapeSettings;
  eraserSize: EraserSize;
  connectorPathStyle: PathStyle;
  connectorElbowCornerStyle: ElbowCornerStyle;
  connectorDefaultEndMarker: MarkerStyle;
  stickyNoteColor: string;
}

export interface DrawingActions {
  setPenSettings: CanvasStoreActions["setPenSettings"];
  setShapeSettings: CanvasStoreActions["setShapeSettings"];
  setEraserSize: CanvasStoreActions["setEraserSize"];
  setConnectorPathStyle: CanvasStoreActions["setConnectorPathStyle"];
  setConnectorElbowCornerStyle: (style: ElbowCornerStyle) => void;
  setConnectorDefaultEndMarker: (marker: MarkerStyle) => void;
  setStickyNoteColor: CanvasStoreActions["setStickyNoteColor"];
}

export type DrawingSlice = DrawingState & DrawingActions;

// ============================================================================
// Initial State
// ============================================================================

export const drawingInitialState: DrawingState = {
  penSettings: { penType: "pen", strokeColor: "#000000", strokeWidth: 2 },
  shapeSettings: {
    fillColor: "#ffffff",
    strokeColor: "#374151",
    strokeWidth: 2,
  },
  eraserSize: "medium",
  connectorPathStyle: "straight",
  connectorElbowCornerStyle: "sharp",
  connectorDefaultEndMarker: "none", // "straight" pathStyle defaults to no markers
  stickyNoteColor: "#fef08a",
};

// ============================================================================
// Slice Creator
// ============================================================================

export const createDrawingSlice: SliceCreator<DrawingSlice> = (set) => ({
  ...drawingInitialState,

  setPenSettings: (settings) =>
    set((state) => ({
      penSettings: { ...state.penSettings, ...settings },
    })),

  setShapeSettings: (settings) =>
    set((state) => ({
      shapeSettings: { ...state.shapeSettings, ...settings },
    })),

  setEraserSize: (size) => set({ eraserSize: size }),

  setConnectorPathStyle: (style) => set({ connectorPathStyle: style }),

  setConnectorElbowCornerStyle: (style) =>
    set({ connectorElbowCornerStyle: style }),

  setConnectorDefaultEndMarker: (marker) =>
    set({ connectorDefaultEndMarker: marker }),

  setStickyNoteColor: (color) => set({ stickyNoteColor: color }),
});
