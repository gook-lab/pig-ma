import { create } from "zustand";
import {
  persist,
  type PersistStorage,
  type StorageValue,
} from "zustand/middleware";
import { temporal } from "zundo";
import type {
  CanvasObject,
  PageData,
  PersistedStateLegacy,
  CanvasStore,
} from "@/types";
import { textSegmentsToTiptap } from "@/utils/tiptapMigration";
import { generateUUID } from "@/utils/uuid";
import { validatePersistedState } from "@/schemas";
import { migrateConnectorGeometry } from "@/utils/migrateConnectorGeometry";
import { createDebouncedHandleSet } from "./historyDebounce";

// Import all slices
import {
  createCoreSlice,
  coreInitialState,
  getInitialCanvasBounds,
} from "./slices/core";
import { createEditingSlice, editingInitialState } from "./slices/editing";
import { createDrawingSlice, drawingInitialState } from "./slices/drawing";
import { createShapesSlice, shapesInitialState } from "./slices/shapes";
import { createDragSlice, dragInitialState } from "./slices/drag";
import { createLockSlice, lockInitialState } from "./slices/lock";
import { createGridSlice, gridInitialState } from "./slices/grid";
import {
  createPreferencesSlice,
  preferencesInitialState,
} from "./slices/preferences";
import { createCaptionSlice, captionInitialState } from "./slices/caption";
import {
  createClipboardSlice,
  clipboardInitialState,
} from "./slices/clipboard";
import { createGroupsSlice, groupsInitialState } from "./slices/groups";
import { createPagesSlice, pagesInitialState } from "./slices/pages";
import {
  createTemplatesSlice,
  templatesInitialState,
} from "./slices/templates";
import { createUISlice, uiInitialState } from "./slices/ui";
import { createTableSlice, tableInitialState } from "./slices/table";
import { createAISlice, aiInitialState } from "./slices/ai";

// Re-export slices for tree-shaking
export * from "./slices";
export type { SliceCreator } from "./types";

// ============================================================================
// 대기 중인 히스토리 기록. undo/redo 직전에 flush 해야
// 방금 한 동작이 스택에 없어서 건너뛰는 일이 없다.
let pendingHistoryCommit: { flush(): void; cancel(): void } | null = null;

// Storage for localStorage persistence
// ============================================================================

/**
 * Custom storage for localStorage
 * - Raw data is returned without validation (to allow migrate to run first)
 * - Zod validation happens AFTER migrate in the migrate function
 * - This prevents data loss when schema changes require migration
 */
// 고빈도 상태 변경(줌/팬은 매 프레임 viewport 를 바꾼다)마다 전체 상태를
// JSON.stringify + localStorage 쓰기 하면, 5k 객체 보드에서 줌 CPU 의
// ~7% + GC 압박을 차지한다 (2026-08 벤치마크 프로파일). 트레일링
// 디바운스로 묶고, 탭 이탈(pagehide/hidden) 시 flush 해서 유실을 막는다.
const PERSIST_DEBOUNCE_MS = 500;

function createStorage<T>(): PersistStorage<T> {
  let pending: { name: string; value: StorageValue<T> } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (!pending) return;
    localStorage.setItem(pending.name, JSON.stringify(pending.value));
    pending = null;
  };

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  }

  return {
    getItem: (name: string): StorageValue<T> | null => {
      // 같은 탭에서 저장 직후 바로 읽는 경우(테스트 등) 최신을 보장
      if (pending?.name === name) flush();
      const str = localStorage.getItem(name);
      if (!str) return null;

      try {
        const raw = JSON.parse(str) as {
          state: unknown;
          version?: number;
        };

        // Return raw data - validation happens after migrate
        return {
          state: raw.state as T,
          version: raw.version,
        };
      } catch (e) {
        console.error("[Canvas Store] localStorage 파싱 실패:", e);
        return null;
      }
    },

    setItem: (name: string, value: StorageValue<T>) => {
      pending = { name, value };
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, PERSIST_DEBOUNCE_MS);
    },

    removeItem: (name: string) => {
      // 지연 중인 쓰기가 삭제를 되살리지 않도록 먼저 버린다
      if (pending?.name === name) {
        pending = null;
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
      }
      localStorage.removeItem(name);
    },
  };
}

// ============================================================================
// Store Creation
// ============================================================================

export const useCanvasStore = create<CanvasStore>()(
  persist(
    temporal(
      (set, get, api) => ({
        // Combine all initial states
        ...coreInitialState,
        ...editingInitialState,
        ...drawingInitialState,
        ...shapesInitialState,
        ...dragInitialState,
        ...lockInitialState,
        ...gridInitialState,
        ...preferencesInitialState,
        ...captionInitialState,
        ...clipboardInitialState,
        ...groupsInitialState,
        ...pagesInitialState,
        ...templatesInitialState,
        ...uiInitialState,
        ...tableInitialState,
        ...aiInitialState,

        // Combine all slice actions
        ...createCoreSlice(set, get, api),
        ...createEditingSlice(set, get, api),
        ...createDrawingSlice(set, get, api),
        ...createShapesSlice(set, get, api),
        ...createDragSlice(set, get, api),
        ...createLockSlice(set, get, api),
        ...createGridSlice(set, get, api),
        ...createPreferencesSlice(set, get, api),
        ...createCaptionSlice(set, get, api),
        ...createClipboardSlice(set, get, api),
        ...createGroupsSlice(set, get, api),
        ...createPagesSlice(set, get, api),
        ...createTemplatesSlice(set, get, api),
        ...createUISlice(set, get, api),
        ...createTableSlice(set, get, api),
        ...createAISlice(set, get, api),

        // Override actions that need access to temporal middleware
        setLocked: (locked) => {
          set({
            isLocked: locked,
            selectedIds: [],
            editingTextId: null,
            tool: locked ? "hand" : "select",
          });
          // Clear undo/redo stack when locked (prevent unlocking via undo)
          if (locked) {
            useCanvasStore.temporal.getState().clear();
          }
        },

        toggleLock: () => {
          const willLock = !useCanvasStore.getState().isLocked;
          set({
            isLocked: willLock,
            selectedIds: [],
            editingTextId: null,
            tool: willLock ? "hand" : "select",
          });
          if (willLock) {
            useCanvasStore.temporal.getState().clear();
          }
        },

        // Override page actions that need access to temporal middleware
        createPage: (name?: string): string => {
          const now = new Date().toISOString();
          const state = useCanvasStore.getState();
          const newPage: PageData = {
            id: generateUUID(),
            name: name ?? `페이지 ${state.pages.length + 1}`,
            objects: [],
            groups: [],
            captions: [],
            viewport: { x: 0, y: 0, zoom: 1 },
            canvasBounds: getInitialCanvasBounds(),
            createdAt: now,
            updatedAt: now,
          };

          // Save current page state
          const currentPage = state.pages.find(
            (p) => p.id === state.currentPageId,
          );
          if (currentPage) {
            const updatedCurrentPage: PageData = {
              ...currentPage,
              objects: state.objects,
              groups: state.groups,
              captions: state.captions,
              viewport: state.viewport,
              canvasBounds: state.canvasBounds,
              updatedAt: now,
            };

            useCanvasStore.setState({
              pages: state.pages
                .map((p) => (p.id === currentPage.id ? updatedCurrentPage : p))
                .concat(newPage),
              currentPageId: newPage.id,
              objects: newPage.objects,
              groups: newPage.groups,
              captions: newPage.captions,
              viewport: newPage.viewport,
              canvasBounds: newPage.canvasBounds,
              selectedIds: [],
              editingTextId: null,
            });
          } else {
            useCanvasStore.setState({
              pages: [...state.pages, newPage],
              currentPageId: newPage.id,
              objects: newPage.objects,
              groups: newPage.groups,
              captions: newPage.captions,
              viewport: newPage.viewport,
              canvasBounds: newPage.canvasBounds,
              selectedIds: [],
              editingTextId: null,
            });
          }

          // Clear undo/redo stack
          useCanvasStore.temporal.getState().clear();

          return newPage.id;
        },

        deletePage: (pageId: string): void => {
          useCanvasStore.setState((state) => {
            if (state.pages.length <= 1) return state;

            const pageIndex = state.pages.findIndex((p) => p.id === pageId);
            if (pageIndex === -1) return state;

            const newPages = state.pages.filter((p) => p.id !== pageId);

            if (state.currentPageId === pageId) {
              const newCurrentIndex = Math.min(pageIndex, newPages.length - 1);
              const newCurrentPage = newPages[newCurrentIndex];

              // Clear undo/redo stack
              setTimeout(() => {
                useCanvasStore.temporal.getState().clear();
              }, 0);

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

        switchPage: (pageId: string): void => {
          useCanvasStore.setState((state) => {
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

            // Clear undo/redo stack
            setTimeout(() => {
              useCanvasStore.temporal.getState().clear();
            }, 0);

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
      }),
      {
        // Zundo config - track objects and groups
        partialize: (state) => ({
          objects: state.objects,
          groups: state.groups,
        }),
        limit: 500,
        /**
         * 연속 변경(리사이즈·이동 드래그)을 한 덩어리로 묶어 한 번만 기록한다.
         *
         * 없으면 모서리를 잡고 늘리는 동안 mousemove 마다 히스토리가 쌓여서,
         * 리사이즈 한 번을 되돌리는 데 Cmd+Z 를 수십 번 눌러야 한다.
         * 자세한 근거는 ./historyDebounce.ts 주석 참조.
         */
        handleSet: (handleSet) => {
          const debounced = createDebouncedHandleSet(handleSet);
          pendingHistoryCommit = debounced;
          return debounced;
        },
        // Only save meaningful changes to history
        equality: (pastState, currentState) => {
          const past = pastState.objects;
          const current = currentState.objects;
          const pastGroups = pastState.groups;
          const currentGroups = currentState.groups;

          // Check group changes
          if (pastGroups.length !== currentGroups.length) return false;
          const pastGroupIds = new Set(pastGroups.map((g) => g.id));
          const currentGroupIds = new Set(currentGroups.map((g) => g.id));
          if (pastGroupIds.size !== currentGroupIds.size) return false;
          for (const id of pastGroupIds) {
            if (!currentGroupIds.has(id)) return false;
          }
          // Check group property changes
          const pastGroupMap = new Map(pastGroups.map((g) => [g.id, g]));
          for (const group of currentGroups) {
            const pastGroup = pastGroupMap.get(group.id);
            if (!pastGroup) return false;
            if (pastGroup.name !== group.name) return false;
            if (pastGroup.fill !== group.fill) return false;
            if (pastGroup.stroke !== group.stroke) return false;
            if (pastGroup.lineStyle !== group.lineStyle) return false;
            if (pastGroup.tagColor !== group.tagColor) return false;
          }

          // Check object changes
          if (past.length !== current.length) return false;

          const pastIds = new Set(past.map((o) => o.id));
          const currentIds = new Set(current.map((o) => o.id));
          if (pastIds.size !== currentIds.size) return false;
          for (const id of pastIds) {
            if (!currentIds.has(id)) return false;
          }

          // Compare properties
          const pastMap = new Map(past.map((o) => [o.id, o]));
          for (const obj of current) {
            const pastObj = pastMap.get(obj.id);
            if (!pastObj) return false;

            // Common properties (position, size, transform)
            if (pastObj.x !== obj.x || pastObj.y !== obj.y) return false;
            if (pastObj.width !== obj.width || pastObj.height !== obj.height)
              return false;
            if (pastObj.rotation !== obj.rotation) return false;
            if (pastObj.opacity !== obj.opacity) return false;

            // Text content
            if (pastObj.text !== obj.text) return false;
            if (
              pastObj.tiptapContent !== obj.tiptapContent &&
              JSON.stringify(pastObj.tiptapContent) !==
                JSON.stringify(obj.tiptapContent)
            )
              return false;

            // Style properties
            if (pastObj.fill !== obj.fill) return false;
            if (pastObj.fillMode !== obj.fillMode) return false;
            if (pastObj.stroke !== obj.stroke) return false;
            if (pastObj.strokeWidth !== obj.strokeWidth) return false;
            if (pastObj.backgroundColor !== obj.backgroundColor) return false;
            if (pastObj.lineStyle !== obj.lineStyle) return false;

            // Text style
            if (pastObj.fontSize !== obj.fontSize) return false;
            if (pastObj.fontWeight !== obj.fontWeight) return false;
            if (pastObj.textDecoration !== obj.textDecoration) return false;
            if (pastObj.fontFamily !== obj.fontFamily) return false;
            if (pastObj.textAlign !== obj.textAlign) return false;
            if (pastObj.textColor !== obj.textColor) return false;

            // Other common properties
            if (pastObj.groupId !== obj.groupId) return false;
            if (pastObj.locked !== obj.locked) return false;
            if (pastObj.zIndex !== obj.zIndex) return false;
            if (
              pastObj.points !== obj.points &&
              JSON.stringify(pastObj.points) !== JSON.stringify(obj.points)
            )
              return false;
            if (
              pastObj.reactions !== obj.reactions &&
              JSON.stringify(pastObj.reactions) !==
                JSON.stringify(obj.reactions)
            )
              return false;

            // Line (pencil) specific
            if (obj.type === "line") {
              if (pastObj.penType !== obj.penType) return false;
            }

            // TextBox specific
            if (obj.type === "textBox") {
              if (pastObj.fontSizePreset !== obj.fontSizePreset) return false;
              if (pastObj.listType !== obj.listType) return false;
              if (pastObj.indentLevel !== obj.indentLevel) return false;
              if (pastObj.link !== obj.link) return false;
            }

            // Shape-specific
            if (obj.type === "shape") {
              if (pastObj.shapeVariant !== obj.shapeVariant) return false;
              if (pastObj.isTextExpanded !== obj.isTextExpanded) return false;
            }

            // Image-specific
            if (obj.type === "image") {
              if (pastObj.src !== obj.src) return false;
            }

            // Connector-specific
            if (obj.type === "connector") {
              if (pastObj.endX !== obj.endX || pastObj.endY !== obj.endY)
                return false;
              if (
                pastObj.sourceId !== obj.sourceId ||
                pastObj.targetId !== obj.targetId
              )
                return false;
              if (
                pastObj.sourceAnchor !== obj.sourceAnchor ||
                pastObj.targetAnchor !== obj.targetAnchor
              )
                return false;
              if (
                pastObj.elbowBends !== obj.elbowBends &&
                JSON.stringify(pastObj.elbowBends) !==
                  JSON.stringify(obj.elbowBends)
              )
                return false;
              if (
                pastObj.startMarker !== obj.startMarker ||
                pastObj.endMarker !== obj.endMarker
              )
                return false;
              if (pastObj.pathStyle !== obj.pathStyle) return false;
              if (pastObj.elbowCornerStyle !== obj.elbowCornerStyle)
                return false;
              if (pastObj.elbowCornerRadius !== obj.elbowCornerRadius)
                return false;
              if (pastObj.label !== obj.label) return false;
              if (pastObj.labelOffsetY !== obj.labelOffsetY) return false;
              if (pastObj.labelTextBoxId !== obj.labelTextBoxId) return false;
              // 분기 커넥터 — 등록을 빠뜨리면 undo 가 조용히 안 된다
              if (
                pastObj.targetIds !== obj.targetIds &&
                JSON.stringify(pastObj.targetIds) !==
                  JSON.stringify(obj.targetIds)
              )
                return false;
              if (pastObj.junctionT !== obj.junctionT) return false;
              if (
                pastObj.branchLabels !== obj.branchLabels &&
                JSON.stringify(pastObj.branchLabels) !==
                  JSON.stringify(obj.branchLabels)
              )
                return false;
              if (
                pastObj.branchTargetT !== obj.branchTargetT &&
                JSON.stringify(pastObj.branchTargetT) !==
                  JSON.stringify(obj.branchTargetT)
              )
                return false;
            }

            // ConnectorLabel-specific (text on connector)
            if (obj.type === "connectorLabel" || obj.labelT !== undefined) {
              if (pastObj.labelT !== obj.labelT) return false;
              if (pastObj.connectedConnectorId !== obj.connectedConnectorId)
                return false;
            }

            // Table-specific
            if (obj.type === "table") {
              if (
                pastObj.tableData !== obj.tableData &&
                JSON.stringify(pastObj.tableData) !==
                  JSON.stringify(obj.tableData)
              )
                return false;
            }

            // Chart-specific
            if (obj.type === "chart") {
              if (
                pastObj.chartData !== obj.chartData &&
                JSON.stringify(pastObj.chartData) !==
                  JSON.stringify(obj.chartData)
              )
                return false;
              if (pastObj.chartShowHeader !== obj.chartShowHeader) return false;
              if (pastObj.chartTitle !== obj.chartTitle) return false;
            }

            // CodeBlock-specific
            if (obj.type === "codeBlock") {
              if (pastObj.code !== obj.code) return false;
              if (pastObj.codeLanguage !== obj.codeLanguage) return false;
              if (pastObj.codeTitle !== obj.codeTitle) return false;
              if (pastObj.codeTheme !== obj.codeTheme) return false;
            }

            // Embed-specific
            if (obj.type === "embed") {
              if (pastObj.embedUrl !== obj.embedUrl) return false;
              if (pastObj.embedType !== obj.embedType) return false;
              if (pastObj.isPlaying !== obj.isPlaying) return false;
              if (
                pastObj.embedMetadata !== obj.embedMetadata &&
                JSON.stringify(pastObj.embedMetadata) !==
                  JSON.stringify(obj.embedMetadata)
              )
                return false;
            }
          }

          return true;
        },
      },
    ),
    {
      // Persist config
      name: "canvas-app",
      version: 5, // v5: 커넥터 기하를 '끝점에 끌려다니지 않는' 형태로 (elbowY 절대좌표 + 연결점 비율)
      storage: createStorage(),
      partialize: (state) => ({
        // Page System (v3)
        projectId: state.projectId,
        projectName: state.projectName,
        pages: state.pages,
        currentPageId: state.currentPageId,
        // Legacy compatibility (objects/groups/captions are now per-page)
        objects: state.objects,
        viewport: state.viewport,
        recentShapes: state.recentShapes,
        favoriteShapes: state.favoriteShapes,
        captions: state.captions,
        currentUser: state.currentUser,
        groups: state.groups,
        // 사용자 설정
        defaultFontFamily: state.defaultFontFamily,
        // Template System
        favoriteTemplates: state.favoriteTemplates,
        customTemplates: state.customTemplates,
        recentTemplates: state.recentTemplates,
      }),
      migrate: (persistedState, version) => {
        let state = persistedState as PersistedStateLegacy;

        if (version < 2) {
          // v1 -> v2: TextSegment to Tiptap migration
          state = {
            ...state,
            objects:
              state.objects?.map((obj: CanvasObject) => {
                // Skip if already has tiptapContent
                if (obj.tiptapContent) {
                  return { ...obj, _contentVersion: 2 };
                }
                // Convert richText if present
                if (obj.richText && obj.richText.length > 0) {
                  return {
                    ...obj,
                    _contentVersion: 2,
                    tiptapContent: textSegmentsToTiptap(
                      obj.richText,
                      obj.lineIndents,
                    ),
                  };
                }
                // Convert plain text to simple paragraph
                if (obj.text) {
                  return {
                    ...obj,
                    _contentVersion: 2,
                    tiptapContent: {
                      type: "doc",
                      content: obj.text.split("\n").map((line: string) => ({
                        type: "paragraph",
                        content: line
                          ? [{ type: "text", text: line }]
                          : undefined,
                      })),
                    },
                  };
                }
                return { ...obj, _contentVersion: obj._contentVersion ?? 1 };
              }) ?? [],
          };
        }

        if (version < 3) {
          // v2 -> v3: Page system migration
          const now = new Date().toISOString();
          const firstPage: PageData = {
            id: generateUUID(),
            name: "페이지 1",
            objects: state.objects ?? [],
            groups: state.groups ?? [],
            captions: state.captions ?? [],
            viewport: state.viewport ?? { x: 0, y: 0, zoom: 3 },
            canvasBounds: getInitialCanvasBounds(),
            createdAt: now,
            updatedAt: now,
          };

          state = {
            ...state,
            projectId: generateUUID(),
            projectName: "새 프로젝트",
            pages: [firstPage],
            currentPageId: firstPage.id,
          };
        }

        if (version < 4) {
          // v3 -> v4: Unify rectangle type into shape + shapeVariant: "rectangle"
          const migrateRectangleToShape = (obj: CanvasObject): CanvasObject => {
            // Type assertion to handle legacy "rectangle" type that no longer exists in ObjectType
            if ((obj.type as string) === "rectangle") {
              return {
                ...obj,
                type: "shape",
                shapeVariant: "rectangle",
              };
            }
            return obj;
          };

          // Migrate objects in all pages
          state = {
            ...state,
            pages: state.pages?.map((page: PageData) => ({
              ...page,
              objects: page.objects.map(migrateRectangleToShape),
            })),
          };
        }

        if (version < 5) {
          // v4 -> v5: 커넥터가 끝점에 끌려다니지 않도록 기하를 올린다.
          //
          //  - elbowBends[].offset (상대) → elbowY (절대)
          //    없으면 소스 도형이 움직일 때 엘보우가 따라간다
          //  - sourceOffsetX/Y (절대 픽셀) → sourceOffsetRatioX/Y (크기 대비)
          //    없으면 도형을 리사이즈할 때 연결점이 안쪽으로 파고든다
          //
          // 상세 근거는 utils/migrateConnectorGeometry.ts 주석 참조.
          state = {
            ...state,
            ...(state.objects
              ? { objects: migrateConnectorGeometry(state.objects) }
              : {}),
            ...(state.pages
              ? {
                  pages: state.pages.map((page: PageData) => ({
                    ...page,
                    objects: migrateConnectorGeometry(page.objects),
                  })),
                }
              : {}),
          };
        }

        // Post-migration validation (warning only, data preserved)
        const validationResult = validatePersistedState(state);
        if (!validationResult.success) {
          console.warn(
            "[Canvas Store] 마이그레이션 후 데이터 검증 경고:",
            validationResult.error.format(),
          );
          // Data is preserved - validation errors are logged for debugging
        }

        return state;
      },
    },
  ),
);

// Undo/Redo functions using Zustand temporal middleware
//
// 디바운스 대기 중인 기록을 먼저 커밋한다. 안 그러면 드래그를 막 끝내고
// 바로 Cmd+Z 를 눌렀을 때 그 동작이 아직 스택에 없어서 한 단계 건너뛴다.
export const undo = () => {
  pendingHistoryCommit?.flush();
  useCanvasStore.temporal.getState().undo();
};
export const redo = () => {
  pendingHistoryCommit?.flush();
  useCanvasStore.temporal.getState().redo();
};

// Utility function to clear undo/redo history
export const clearHistory = () => {
  pendingHistoryCommit?.cancel();
  useCanvasStore.temporal.getState().clear();
};

// ============================================================================
// Selector Hooks (for optimized component subscriptions)
// ============================================================================

// Core selectors
export const useObjects = () => useCanvasStore((s) => s.objects);
export const useSelectedIds = () => useCanvasStore((s) => s.selectedIds);
export const useTool = () => useCanvasStore((s) => s.tool);
export const useViewport = () => useCanvasStore((s) => s.viewport);

// Drawing selectors
export const usePenSettings = () => useCanvasStore((s) => s.penSettings);
export const useShapeSettings = () => useCanvasStore((s) => s.shapeSettings);
export const useEraserSize = () => useCanvasStore((s) => s.eraserSize);

// Editing selectors
export const useEditingTextId = () => useCanvasStore((s) => s.editingTextId);
export const useActiveEditor = () => useCanvasStore((s) => s.activeEditor);

// Object selector by ID
export const useObject = (id: string) =>
  useCanvasStore((s) => s.objects.find((o) => o.id === id));

// Shapes panel selectors
export const useShowShapesPanel = () =>
  useCanvasStore((s) => s.showShapesPanel);
export const useSelectedShapeVariant = () =>
  useCanvasStore((s) => s.selectedShapeVariant);
export const useRecentShapes = () => useCanvasStore((s) => s.recentShapes);
export const useFavoriteShapes = () => useCanvasStore((s) => s.favoriteShapes);

// Caption selectors
export const useCaptions = () => useCanvasStore((s) => s.captions);
export const useCurrentUser = () => useCanvasStore((s) => s.currentUser);
export const useIsCaptionPanelOpen = () =>
  useCanvasStore((s) => s.isCaptionPanelOpen);
export const useActiveCaptionId = () =>
  useCanvasStore((s) => s.activeCaptionId);
export const useCaptionFilter = () => useCanvasStore((s) => s.captionFilter);
export const useCaption = (id: string) =>
  useCanvasStore((s) => s.captions.find((c) => c.id === id));

// Group selectors
export const useGroups = () => useCanvasStore((s) => s.groups);
export const useGroup = (id: string) =>
  useCanvasStore((s) => s.groups.find((g) => g.id === id));

// Page system selectors
export const useProjectId = () =>
  useCanvasStore((s: CanvasStore) => s.projectId);
export const useProjectName = () =>
  useCanvasStore((s: CanvasStore) => s.projectName);
export const usePages = () => useCanvasStore((s: CanvasStore) => s.pages);
export const useCurrentPageId = () =>
  useCanvasStore((s: CanvasStore) => s.currentPageId);
export const useCurrentPage = () =>
  useCanvasStore((s: CanvasStore) =>
    s.pages.find((p) => p.id === s.currentPageId),
  );
export const usePage = (id: string) =>
  useCanvasStore((s: CanvasStore) => s.pages.find((p) => p.id === id));

// Template selectors
export const useShowTemplatesPanel = () =>
  useCanvasStore((s) => s.showTemplatesPanel);
export const useFavoriteTemplates = () =>
  useCanvasStore((s) => s.favoriteTemplates);
export const useRecentTemplates = () =>
  useCanvasStore((s) => s.recentTemplates);

// Table selectors
export const useEditingTableCell = () =>
  useCanvasStore((s) => s.editingTableCell);

// Export for backward compatibility
export default useCanvasStore;
