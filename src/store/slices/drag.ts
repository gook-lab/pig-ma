import type { CanvasStoreActions } from "@/types";
import type { SliceCreator } from "../types";

// ============================================================================
// Drag Slice Types
// ============================================================================

export interface DragState {
  draggingIds: string[];
  /** @deprecated Use draggingIds.length > 0 instead */
  isDragging: boolean;
}

export interface DragActions {
  addDraggingIds: CanvasStoreActions["addDraggingIds"];
  removeDraggingIds: CanvasStoreActions["removeDraggingIds"];
  clearDraggingIds: CanvasStoreActions["clearDraggingIds"];
  /** @deprecated Use addDraggingIds/removeDraggingIds instead */
  setDragging: CanvasStoreActions["setDragging"];
}

export type DragSlice = DragState & DragActions;

// ============================================================================
// Initial State
// ============================================================================

export const dragInitialState: DragState = {
  draggingIds: [],
  isDragging: false,
};

// ============================================================================
// Slice Creator
// ============================================================================

export const createDragSlice: SliceCreator<DragSlice> = (set) => ({
  ...dragInitialState,

  addDraggingIds: (ids) =>
    set((state) => {
      const newIds = [...new Set([...state.draggingIds, ...ids])];
      return { draggingIds: newIds, isDragging: newIds.length > 0 };
    }),

  removeDraggingIds: (ids) =>
    set((state) => {
      const newIds = state.draggingIds.filter((id) => !ids.includes(id));
      return { draggingIds: newIds, isDragging: newIds.length > 0 };
    }),

  clearDraggingIds: () => set({ draggingIds: [], isDragging: false }),

  /** @deprecated */
  setDragging: (dragging) =>
    set({ isDragging: dragging, draggingIds: dragging ? [] : [] }),
});
