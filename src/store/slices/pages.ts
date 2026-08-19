import type { PageData, CanvasStoreActions } from "@/types";
import { generateUUID } from "@/utils/uuid";
import type { SliceCreator } from "../types";
import { getInitialCanvasBounds } from "./core";

// ============================================================================
// Helper Functions
// ============================================================================

const createDefaultPage = (): PageData => {
  const now = new Date().toISOString();
  return {
    id: generateUUID(),
    name: "페이지 1",
    objects: [],
    groups: [],
    captions: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    canvasBounds: getInitialCanvasBounds(),
    createdAt: now,
    updatedAt: now,
  };
};

// ============================================================================
// Pages Slice Types
// ============================================================================

export interface PagesState {
  projectId: string;
  projectName: string;
  pages: PageData[];
  currentPageId: string;
}

export interface PagesActions {
  createPage: CanvasStoreActions["createPage"];
  deletePage: CanvasStoreActions["deletePage"];
  renamePage: CanvasStoreActions["renamePage"];
  switchPage: CanvasStoreActions["switchPage"];
  renameProject: CanvasStoreActions["renameProject"];
}

export type PagesSlice = PagesState & PagesActions;

// ============================================================================
// Initial State
// ============================================================================

const defaultPage = createDefaultPage();

export const pagesInitialState: PagesState = {
  projectId: generateUUID(),
  projectName: "새 프로젝트",
  pages: [defaultPage],
  currentPageId: defaultPage.id,
};

// ============================================================================
// Slice Creator
// ============================================================================

// Note: These actions need access to useCanvasStore.temporal which is only
// available after store creation. They will be implemented in the main store
// file to access temporal middleware.
export const createPagesSlice: SliceCreator<PagesSlice> = (set) => ({
  ...pagesInitialState,

  // Placeholder - will be overridden in main store
  createPage: (name?: string): string => {
    const now = new Date().toISOString();
    const newPage: PageData = {
      id: generateUUID(),
      name: name ?? "새 페이지",
      objects: [],
      groups: [],
      captions: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      canvasBounds: getInitialCanvasBounds(),
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      pages: [...state.pages, newPage],
      currentPageId: newPage.id,
      objects: newPage.objects,
      groups: newPage.groups,
      captions: newPage.captions,
      viewport: newPage.viewport,
      canvasBounds: newPage.canvasBounds,
      selectedIds: [],
      editingTextId: null,
    }));
    return newPage.id;
  },

  // Placeholder - will be overridden in main store
  deletePage: (pageId: string): void => {
    set((state) => {
      if (state.pages.length <= 1) return state;

      const pageIndex = state.pages.findIndex((p) => p.id === pageId);
      if (pageIndex === -1) return state;

      const newPages = state.pages.filter((p) => p.id !== pageId);

      if (state.currentPageId === pageId) {
        const newCurrentIndex = Math.min(pageIndex, newPages.length - 1);
        const newCurrentPage = newPages[newCurrentIndex];
        if (!newCurrentPage) return { pages: newPages };

        return {
          pages: newPages,
          currentPageId: newCurrentPage.id,
          objects: newCurrentPage.objects,
          groups: newCurrentPage.groups,
          captions: newCurrentPage.captions,
          viewport: newCurrentPage.viewport,
          canvasBounds: newCurrentPage.canvasBounds,
          selectedIds: [],
          editingTextId: null,
        };
      }

      return { pages: newPages };
    });
  },

  renamePage: (pageId: string, name: string): void => {
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId
          ? { ...p, name, updatedAt: new Date().toISOString() }
          : p,
      ),
    }));
  },

  // Placeholder - will be overridden in main store
  switchPage: (pageId: string): void => {
    set((state) => {
      if (state.currentPageId === pageId) return state;

      const targetPage = state.pages.find((p) => p.id === pageId);
      if (!targetPage) return state;

      const now = new Date().toISOString();

      // Save current page state
      const updatedPages = state.pages.map((p) => {
        if (p.id === state.currentPageId) {
          return {
            ...p,
            objects: state.objects,
            groups: state.groups,
            captions: state.captions,
            viewport: state.viewport,
            canvasBounds: state.canvasBounds,
            updatedAt: now,
          };
        }
        return p;
      });

      // Switch to new page
      return {
        pages: updatedPages,
        currentPageId: targetPage.id,
        objects: targetPage.objects,
        groups: targetPage.groups,
        captions: targetPage.captions,
        viewport: targetPage.viewport,
        canvasBounds: targetPage.canvasBounds,
        selectedIds: [],
        editingTextId: null,
      };
    });
  },

  renameProject: (name: string): void => {
    set({ projectName: name });
  },
});

// Export helper for main store
export { createDefaultPage };
