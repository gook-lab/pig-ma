import type { CanvasStoreActions } from "@/types";
import type { SliceCreator } from "../types";

// ============================================================================
// Lock Slice Types
// ============================================================================

export interface LockState {
  isLocked: boolean;
}

export interface LockActions {
  setLocked: CanvasStoreActions["setLocked"];
  toggleLock: CanvasStoreActions["toggleLock"];
}

export type LockSlice = LockState & LockActions;

// ============================================================================
// Initial State
// ============================================================================

export const lockInitialState: LockState = {
  isLocked: false,
};

// ============================================================================
// Slice Creator
// ============================================================================

// Note: setLocked and toggleLock need access to useCanvasStore.temporal
// which is only available after store creation. These will be implemented
// in the main store file to access temporal middleware.
export const createLockSlice: SliceCreator<LockSlice> = (set) => ({
  ...lockInitialState,

  // Placeholder - will be overridden in main store
  setLocked: (locked) =>
    set({
      isLocked: locked,
      selectedIds: [],
      editingTextId: null,
      tool: locked ? "hand" : "select",
    }),

  // Placeholder - will be overridden in main store
  toggleLock: () =>
    set((state) => ({
      isLocked: !state.isLocked,
      selectedIds: [],
      editingTextId: null,
      tool: !state.isLocked ? "hand" : "select",
    })),
});
