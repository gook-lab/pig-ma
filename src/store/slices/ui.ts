import type Konva from "konva";
import type { Tool, CanvasStoreActions } from "@/types";
import type { SliceCreator } from "../types";

// ============================================================================
// UI Slice Types
// ============================================================================

export type Theme = "light" | "dark";

export interface UIState {
  hideCaptions: boolean;
  hideUI: boolean;
  isFileDialogOpen: boolean;
  stageRef: React.RefObject<Konva.Stage | null> | null;
  theme: Theme;
}

export interface UIActions {
  toggleHideCaptions: CanvasStoreActions["toggleHideCaptions"];
  toggleHideUI: CanvasStoreActions["toggleHideUI"];
  setFileDialogOpen: CanvasStoreActions["setFileDialogOpen"];
  setStageRef: (ref: React.RefObject<Konva.Stage | null>) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export type UISlice = UIState & UIActions;

// ============================================================================
// Helper: Apply theme to document
// ============================================================================

const applyTheme = (theme: Theme) => {
  if (typeof document !== "undefined") {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }
};

// ============================================================================
// Initial State
// ============================================================================

// 시스템 설정 또는 저장된 값 확인
const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("pig-theme") as Theme | null;
  if (stored) return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

export const uiInitialState: UIState = {
  hideCaptions: false,
  hideUI: false,
  isFileDialogOpen: false,
  stageRef: null,
  theme: "light", // 실제 초기화는 store에서 수행
};

// ============================================================================
// Slice Creator
// ============================================================================

export const createUISlice: SliceCreator<UISlice> = (set) => {
  // 초기 테마 적용
  const initialTheme = getInitialTheme();
  applyTheme(initialTheme);

  return {
    ...uiInitialState,
    theme: initialTheme,

    toggleHideCaptions: () =>
      set((state) => ({ hideCaptions: !state.hideCaptions })),

    toggleHideUI: () =>
      set((state) => {
        const willHide = !state.hideUI;
        return {
          hideUI: willHide,
          // In Hide UI mode, switch to Hand tool and clear selection
          ...(willHide ? { tool: "hand" as Tool, selectedIds: [] } : {}),
        };
      }),

    setFileDialogOpen: (open) => set({ isFileDialogOpen: open }),

    setStageRef: (ref) => set({ stageRef: ref }),

    setTheme: (theme) => {
      applyTheme(theme);
      localStorage.setItem("pig-theme", theme);
      set({ theme });
    },

    toggleTheme: () =>
      set((state) => {
        const newTheme = state.theme === "light" ? "dark" : "light";
        applyTheme(newTheme);
        localStorage.setItem("pig-theme", newTheme);
        return { theme: newTheme };
      }),
  };
};
