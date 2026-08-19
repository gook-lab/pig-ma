import type {
  CanvasObject,
  Tool,
  CanvasBounds,
  CanvasStoreActions,
} from "@/types";
import type { SliceCreator } from "../types";
import { getAnchorPointWithAngle } from "@/utils/geometry";

// ============================================================================
// Core Slice Types
// ============================================================================

export interface CoreState {
  objects: CanvasObject[];
  selectedIds: string[];
  tool: Tool;
  viewport: { x: number; y: number; zoom: number };
  canvasBounds: CanvasBounds;
}

export interface CoreActions {
  addObject: CanvasStoreActions["addObject"];
  updateObject: CanvasStoreActions["updateObject"];
  deleteSelected: CanvasStoreActions["deleteSelected"];
  deleteObjects: CanvasStoreActions["deleteObjects"];
  clearAllObjects: CanvasStoreActions["clearAllObjects"];
  setObjectsLocked: CanvasStoreActions["setObjectsLocked"];
  eraseLinePartial: CanvasStoreActions["eraseLinePartial"];
  setSelectedIds: CanvasStoreActions["setSelectedIds"];
  addToSelection: CanvasStoreActions["addToSelection"];
  clearSelection: CanvasStoreActions["clearSelection"];
  setTool: CanvasStoreActions["setTool"];
  setViewport: CanvasStoreActions["setViewport"];
  resetViewport: CanvasStoreActions["resetViewport"];
  expandCanvasBounds: CanvasStoreActions["expandCanvasBounds"];
  resetCanvasBounds: CanvasStoreActions["resetCanvasBounds"];
}

export type CoreSlice = CoreState & CoreActions;

// ============================================================================
// Helpers
// ============================================================================

export const getInitialCanvasBounds = (): CanvasBounds => {
  const width = typeof window !== "undefined" ? window.innerWidth : 1920;
  const height = typeof window !== "undefined" ? window.innerHeight : 1080;
  return { minX: 0, minY: 0, maxX: width, maxY: height };
};

const getObjectExtent = (obj: CanvasObject) => {
  const width = obj.width ?? obj.radius ?? 100;
  const height = obj.height ?? obj.radius ?? 100;
  return {
    minX: obj.x,
    minY: obj.y,
    maxX: obj.x + width,
    maxY: obj.y + height,
  };
};

// ============================================================================
// Initial State
// ============================================================================

export const coreInitialState: CoreState = {
  objects: [],
  selectedIds: [],
  tool: "select",
  viewport: { x: 0, y: 0, zoom: 1 },
  canvasBounds: getInitialCanvasBounds(),
};

// ============================================================================
// Slice Creator
// ============================================================================

export const createCoreSlice: SliceCreator<CoreSlice> = (set, get) => ({
  ...coreInitialState,

  addObject: (object) =>
    set((state) => {
      const extent = getObjectExtent(object);
      const padding = 50;
      const newBounds = { ...state.canvasBounds };

      if (extent.minX - padding < newBounds.minX) {
        newBounds.minX = extent.minX - padding;
      }
      if (extent.minY - padding < newBounds.minY) {
        newBounds.minY = extent.minY - padding;
      }
      if (extent.maxX + padding > newBounds.maxX) {
        newBounds.maxX = extent.maxX + padding;
      }
      if (extent.maxY + padding > newBounds.maxY) {
        newBounds.maxY = extent.maxY + padding;
      }

      return {
        objects: [...state.objects, object],
        canvasBounds: newBounds,
      };
    }),

  updateObject: (id, updates) =>
    set((state) => {
      const updatedObjects = state.objects.map((obj) =>
        obj.id === id ? { ...obj, ...updates } : obj,
      );

      if (updates.x !== undefined || updates.y !== undefined) {
        const updatedObj = updatedObjects.find((o) => o.id === id);
        if (updatedObj) {
          const extent = getObjectExtent(updatedObj);
          const padding = 50;
          const newBounds = { ...state.canvasBounds };

          if (extent.minX - padding < newBounds.minX) {
            newBounds.minX = extent.minX - padding;
          }
          if (extent.minY - padding < newBounds.minY) {
            newBounds.minY = extent.minY - padding;
          }
          if (extent.maxX + padding > newBounds.maxX) {
            newBounds.maxX = extent.maxX + padding;
          }
          if (extent.maxY + padding > newBounds.maxY) {
            newBounds.maxY = extent.maxY + padding;
          }

          return { objects: updatedObjects, canvasBounds: newBounds };
        }
      }

      return { objects: updatedObjects };
    }),

  deleteSelected: () => {
    const { selectedIds, deleteObjects } = get();
    if (selectedIds.length > 0) {
      deleteObjects(selectedIds);
    }
  },

  setObjectsLocked: (ids, locked) =>
    set((state) => {
      const idSet = new Set(ids);
      let changed = false;
      const objects = state.objects.map((obj) => {
        if (!idSet.has(obj.id) || (obj.locked ?? false) === locked) return obj;
        changed = true;
        return { ...obj, locked };
      });
      if (!changed) return state;
      // 잠그는 객체가 선택되어 있으면 선택 해제 (잠긴 객체는 편집 불가)
      const selectedIds = locked
        ? state.selectedIds.filter((id) => !idSet.has(id))
        : state.selectedIds;
      return { objects, selectedIds };
    }),

  deleteObjects: (ids) =>
    set((state) => {
      const toDelete = new Set(ids);

      // Collect related objects to delete
      state.objects.forEach((obj) => {
        if (
          toDelete.has(obj.id) &&
          obj.type === "connector" &&
          obj.labelTextBoxId
        ) {
          toDelete.add(obj.labelTextBoxId);
        }
      });

      // 삭제되는 객체를 id 로 찾을 수 있게 미리 담아둔다.
      // 커넥터 끝점을 '사라지기 직전 위치'에 고정하려면 그 도형이 필요하다.
      const deletedById = new Map(
        state.objects.filter((o) => toDelete.has(o.id)).map((o) => [o.id, o]),
      );

      // Filter and clean up references
      const remainingObjects = state.objects
        .filter((obj) => !toDelete.has(obj.id))
        .map((obj) => {
          let next = obj;

          if (
            next.type === "connector" &&
            next.labelTextBoxId &&
            toDelete.has(next.labelTextBoxId)
          ) {
            const withoutLabel = { ...next };
            delete withoutLabel.labelTextBoxId;
            next = withoutLabel;
          }

          // 연결된 도형이 사라지면 커넥터를 '분리'한다.
          //
          // id 만 남겨두면 렌더가 앵커를 못 구해 낡은 endX/endY 로 폴백하면서
          // 화살표가 엉뚱한 곳으로 튄다. 대신 마지막으로 붙어 있던 좌표를
          // 그대로 굳혀서, 화면상 위치는 변하지 않고 연결만 끊기게 한다.
          if (next.type === "connector") {
            const src = next.sourceId
              ? deletedById.get(next.sourceId)
              : undefined;
            const tgt = next.targetId
              ? deletedById.get(next.targetId)
              : undefined;

            if (src) {
              const p = getAnchorPointWithAngle(
                src,
                next.sourceAnchor ?? "center",
                next.sourceAngle,
                next.sourceOffsetX,
                next.sourceOffsetY,
                next.sourceOffsetRatioX,
                next.sourceOffsetRatioY,
              );
              const detached = { ...next, x: p.x, y: p.y };
              delete detached.sourceId;
              delete detached.sourceAnchor;
              delete detached.sourceAngle;
              delete detached.sourceOffsetX;
              delete detached.sourceOffsetY;
              delete detached.sourceOffsetRatioX;
              delete detached.sourceOffsetRatioY;
              next = detached;
            }

            if (tgt) {
              const p = getAnchorPointWithAngle(
                tgt,
                next.targetAnchor ?? "center",
                next.targetAngle,
                next.targetOffsetX,
                next.targetOffsetY,
                next.targetOffsetRatioX,
                next.targetOffsetRatioY,
              );
              const detached = { ...next, endX: p.x, endY: p.y };
              delete detached.targetId;
              delete detached.targetAnchor;
              delete detached.targetAngle;
              delete detached.targetOffsetX;
              delete detached.targetOffsetY;
              delete detached.targetOffsetRatioX;
              delete detached.targetOffsetRatioY;
              next = detached;
            }
          }

          return next;
        });

      const usedGroupIds = new Set(
        remainingObjects.map((obj) => obj.groupId).filter(Boolean),
      );
      // Keep groups with members. For customBounds groups (parent sections),
      // keep only if there are still objects within the bounds area.
      const remainingGroups = state.groups.filter((g) => {
        if (usedGroupIds.has(g.id)) return true;
        if (g.customBounds) {
          const b = g.customBounds;
          return remainingObjects.some(
            (o) =>
              o.x >= b.x &&
              o.y >= b.y &&
              o.x <= b.x + b.width &&
              o.y <= b.y + b.height,
          );
        }
        return false;
      });

      // 사라진 객체의 id 를 들고 있는 상태를 전부 정리한다(고스트 상태 방지).
      //
      // 남겨두면 없는 객체를 향해 액션이 날아가거나, 그 id 가 영원히
      // "드래그 중 / 편집 중"으로 남아 렌더 최적화와 입력 처리가 어긋난다.
      const editingTableCell =
        state.editingTableCell && toDelete.has(state.editingTableCell.tableId)
          ? null
          : state.editingTableCell;
      const selectedTableCells =
        state.selectedTableCells &&
        toDelete.has(state.selectedTableCells.tableId)
          ? null
          : state.selectedTableCells;
      const tableDragState =
        state.tableDragState && toDelete.has(state.tableDragState.tableId)
          ? null
          : state.tableDragState;
      const editingTextId =
        state.editingTextId && toDelete.has(state.editingTextId)
          ? null
          : state.editingTextId;
      const draggingIds = state.draggingIds.filter((id) => !toDelete.has(id));

      return {
        objects: remainingObjects,
        groups: remainingGroups,
        selectedIds: state.selectedIds.filter((id) => !toDelete.has(id)),
        editingTableCell,
        selectedTableCells,
        tableDragState,
        editingTextId,
        draggingIds,
        isDragging: draggingIds.length > 0,
      };
    }),

  clearAllObjects: () =>
    set({
      objects: [],
      selectedIds: [],
      canvasBounds: getInitialCanvasBounds(),
      captions: [],
      activeCaptionId: null,
      isCaptionPanelOpen: false,
      showShapesPanel: false,
      groups: [],
      isLocked: false,
      // 객체가 하나도 안 남으므로 id 를 참조하던 상태도 전부 비운다
      draggingIds: [],
      isDragging: false,
      editingTextId: null,
      editingTableCell: null,
      selectedTableCells: null,
      tableDragState: null,
    }),

  eraseLinePartial: (deleteIds, newLines) =>
    set((state) => {
      const remainingObjects = state.objects.filter(
        (obj) => !deleteIds.includes(obj.id),
      );
      return {
        objects: [...remainingObjects, ...newLines],
        selectedIds: state.selectedIds.filter((id) => !deleteIds.includes(id)),
      };
    }),

  setSelectedIds: (ids) => set({ selectedIds: ids }),

  addToSelection: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((sid) => sid !== id)
        : [...state.selectedIds, id],
    })),

  clearSelection: () => set({ selectedIds: [] }),

  setTool: (tool) => set({ tool }),

  setViewport: (viewport) =>
    set((state) => ({
      viewport: { ...state.viewport, ...viewport },
    })),

  resetViewport: () => set({ viewport: { x: 0, y: 0, zoom: 1 } }),

  expandCanvasBounds: (obj) =>
    set((state) => {
      const extent = getObjectExtent(obj);
      const padding = 50;
      return {
        canvasBounds: {
          minX: Math.min(state.canvasBounds.minX, extent.minX - padding),
          minY: Math.min(state.canvasBounds.minY, extent.minY - padding),
          maxX: Math.max(state.canvasBounds.maxX, extent.maxX + padding),
          maxY: Math.max(state.canvasBounds.maxY, extent.maxY + padding),
        },
      };
    }),

  resetCanvasBounds: () => set({ canvasBounds: getInitialCanvasBounds() }),
});
