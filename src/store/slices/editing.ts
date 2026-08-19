import type { Editor } from "@tiptap/core";
import type { EditingCursorState, CanvasStoreActions } from "@/types";
import type { SliceCreator } from "../types";

// ============================================================================
// Editing Slice Types
// ============================================================================

export interface EditingState {
  editingTextId: string | null;
  editingChartTitleId: string | null;
  pendingTextInput: string | null;
  editingCursor: EditingCursorState | null;
  activeEditor: Editor | null;
}

export interface EditingActions {
  setEditingTextId: CanvasStoreActions["setEditingTextId"];
  setEditingChartTitleId: (id: string | null) => void;
  setPendingTextInput: CanvasStoreActions["setPendingTextInput"];
  setEditingCursor: CanvasStoreActions["setEditingCursor"];
  setActiveEditor: CanvasStoreActions["setActiveEditor"];
}

export type EditingSlice = EditingState & EditingActions;

// ============================================================================
// Initial State
// ============================================================================

export const editingInitialState: EditingState = {
  editingTextId: null,
  editingChartTitleId: null,
  pendingTextInput: null,
  editingCursor: null,
  activeEditor: null,
};

// ============================================================================
// Slice Creator
// ============================================================================

export const createEditingSlice: SliceCreator<EditingSlice> = (set) => ({
  ...editingInitialState,

  setEditingTextId: (id) =>
    set({ editingTextId: id, editingCursor: null, activeEditor: null }),

  setEditingChartTitleId: (id) => set({ editingChartTitleId: id }),

  setPendingTextInput: (text) => set({ pendingTextInput: text }),

  setEditingCursor: (cursor) => set({ editingCursor: cursor }),

  setActiveEditor: (editor) => set({ activeEditor: editor }),
});
