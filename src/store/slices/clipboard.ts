import { nanoid } from "nanoid";
import type { CanvasObject, GroupInfo, CanvasStoreActions } from "@/types";
import type { SliceCreator } from "../types";
import { cloneTableData } from "@/utils/table";
import { translateElbowBends } from "@/utils/translateElbowBends";

// ============================================================================
// Clipboard Slice Types
// ============================================================================

export interface ClipboardState {
  clipboard: CanvasObject[];
  clipboardGroups: GroupInfo[];
}

export interface ClipboardActions {
  copyObjects: CanvasStoreActions["copyObjects"];
  pasteObjects: CanvasStoreActions["pasteObjects"];
  pasteAndReplace: CanvasStoreActions["pasteAndReplace"];
  bringToFront: CanvasStoreActions["bringToFront"];
  sendToBack: CanvasStoreActions["sendToBack"];
  lockObjects: CanvasStoreActions["lockObjects"];
  unlockObjects: CanvasStoreActions["unlockObjects"];
  unlockAllObjects: CanvasStoreActions["unlockAllObjects"];
}

export type ClipboardSlice = ClipboardState & ClipboardActions;

// ============================================================================
// Initial State
// ============================================================================

export const clipboardInitialState: ClipboardState = {
  clipboard: [],
  clipboardGroups: [],
};

// ============================================================================
// Slice Creator
// ============================================================================

export const createClipboardSlice: SliceCreator<ClipboardSlice> = (set) => ({
  ...clipboardInitialState,

  copyObjects: () =>
    set((state) => {
      const selectedIdSet = new Set(state.selectedIds);
      const selectedObjects = state.objects.filter((obj) =>
        selectedIdSet.has(obj.id),
      );
      // FigJam 패턴: 양쪽 도형이 모두 선택된 커넥터는 직접 선택하지 않았어도
      // 함께 복사한다. 커넥터는 보통 클릭 선택 대상이 아니라서, 이걸 빼면
      // 연결된 도형 묶음을 복사해도 연결이 사라진 채 붙는다.
      const copiedIds = new Set(selectedObjects.map((obj) => obj.id));
      const bridgeConnectors = state.objects.filter(
        (obj) =>
          obj.type === "connector" &&
          !copiedIds.has(obj.id) &&
          obj.sourceId !== undefined &&
          obj.targetId !== undefined &&
          copiedIds.has(obj.sourceId) &&
          copiedIds.has(obj.targetId),
      );
      // 따라오는 커넥터의 라벨 텍스트박스도 함께 — 없으면 붙여넣기에서
      // labelTextBoxId 리맵이 실패해 참조가 끊긴다.
      const labelIds = new Set(
        bridgeConnectors.map((c) => c.labelTextBoxId).filter(Boolean),
      );
      const bridgeLabels = state.objects.filter(
        (obj) => labelIds.has(obj.id) && !copiedIds.has(obj.id),
      );
      const clipboard = [
        ...selectedObjects,
        ...bridgeConnectors,
        ...bridgeLabels,
      ];
      // Also save groups that contain selected objects
      const groupIds = new Set(
        selectedObjects.map((obj) => obj.groupId).filter(Boolean),
      );
      const selectedGroups = state.groups.filter((g) => groupIds.has(g.id));
      return {
        clipboard,
        clipboardGroups: selectedGroups,
      };
    }),

  pasteObjects: (x, y) =>
    set((state) => {
      if (state.clipboard.length === 0) return state;

      // Calculate center point of clipboard objects
      const bounds = state.clipboard.reduce(
        (acc, obj) => ({
          minX: Math.min(acc.minX, obj.x),
          minY: Math.min(acc.minY, obj.y),
          maxX: Math.max(acc.maxX, obj.x + (obj.width ?? obj.radius ?? 50)),
          maxY: Math.max(acc.maxY, obj.y + (obj.height ?? obj.radius ?? 50)),
        }),
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
      );
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;

      // Create group ID mapping (oldGroupId -> newGroupId)
      const groupIdMap = new Map<string, string>();
      state.clipboardGroups.forEach((group) => {
        groupIdMap.set(group.id, nanoid());
      });

      // Create object ID mapping (oldObjectId -> newObjectId)
      const objectIdMap = new Map<string, string>();
      state.clipboard.forEach((obj) => {
        objectIdMap.set(obj.id, nanoid());
      });

      // Clone with new IDs and adjusted positions
      const deltaX = x - centerX;
      const deltaY = y - centerY;
      const newObjects = state.clipboard.map((obj) => {
        const newId = objectIdMap.get(obj.id)!;
        return {
          ...obj,
          id: newId,
          x: obj.x + deltaX,
          y: obj.y + deltaY,
          // Also move connector endX, endY
          ...(obj.type === "connector" &&
          obj.endX !== undefined &&
          obj.endY !== undefined
            ? { endX: obj.endX + deltaX, endY: obj.endY + deltaY }
            : {}),
          // Remap connector sourceId, targetId (only if within clipboard)
          ...(obj.type === "connector"
            ? (() => {
                const newSourceId =
                  obj.sourceId && objectIdMap.has(obj.sourceId)
                    ? objectIdMap.get(obj.sourceId)
                    : undefined;
                const newTargetId =
                  obj.targetId && objectIdMap.has(obj.targetId)
                    ? objectIdMap.get(obj.targetId)
                    : undefined;
                // 저작한 엘보우 형태는 버리지 않는다 — 붙여넣기는 전체를
                // (deltaX, deltaY) 만큼 옮기는 강체 이동이므로 bend 절대
                // 좌표도 같은 델타로 옮기면 모양이 그대로 보존된다.
                const elbowBends = translateElbowBends(
                  obj.elbowBends,
                  deltaX,
                  deltaY,
                );
                return {
                  sourceId: newSourceId,
                  targetId: newTargetId,
                  elbowBends,
                };
              })()
            : {}),
          // 커넥터 라벨 텍스트박스도 사본을 가리키게 한다.
          //
          // 리맵하지 않으면 붙여넣은 커넥터가 '원본' 라벨을 가리켜서,
          // 사본의 라벨을 고치면 원본이 바뀌고 원본 라벨을 지우면 사본의
          // 참조까지 끊긴다. 클립보드에 라벨이 없으면 참조를 버린다.
          ...(obj.labelTextBoxId
            ? { labelTextBoxId: objectIdMap.get(obj.labelTextBoxId) }
            : {}),
          // Deep copy tableData for table objects
          ...(obj.type === "table" && obj.tableData
            ? { tableData: cloneTableData(obj.tableData) }
            : {}),
          locked: false, // Unlock on paste
          groupId: obj.groupId ? groupIdMap.get(obj.groupId) : undefined,
        };
      });

      // Create new groups with -copy-N suffix
      const newGroups = state.clipboardGroups.map((group) => {
        const baseName = group.name?.replace(/-copy-\d+$/, "") ?? "Group";
        const copyPattern = new RegExp(
          `^${baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-copy-(\\d+)$`,
        );
        let maxNum = 0;
        state.groups.forEach((g) => {
          if (g.name === baseName) maxNum = Math.max(maxNum, 0);
          const match = g.name?.match(copyPattern);
          if (match) maxNum = Math.max(maxNum, parseInt(match[1]!, 10));
        });
        return {
          ...group,
          id: groupIdMap.get(group.id)!,
          name: `${baseName}-copy-${maxNum + 1}`,
          customBounds: undefined,
        };
      });

      return {
        objects: [...state.objects, ...newObjects],
        groups: [...state.groups, ...newGroups],
        selectedIds: newObjects.map((obj) => obj.id),
      };
    }),

  pasteAndReplace: (x, y) =>
    set((state) => {
      if (state.clipboard.length === 0) return state;

      // Delete selected objects first, then paste
      const remainingObjects = state.objects.filter(
        (obj) => !state.selectedIds.includes(obj.id),
      );

      // Calculate center point of clipboard objects
      const bounds = state.clipboard.reduce(
        (acc, obj) => ({
          minX: Math.min(acc.minX, obj.x),
          minY: Math.min(acc.minY, obj.y),
          maxX: Math.max(acc.maxX, obj.x + (obj.width ?? obj.radius ?? 50)),
          maxY: Math.max(acc.maxY, obj.y + (obj.height ?? obj.radius ?? 50)),
        }),
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
      );
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;

      // Create group ID mapping
      const groupIdMap = new Map<string, string>();
      state.clipboardGroups.forEach((group) => {
        groupIdMap.set(group.id, nanoid());
      });

      // Create object ID mapping
      const objectIdMap = new Map<string, string>();
      state.clipboard.forEach((obj) => {
        objectIdMap.set(obj.id, nanoid());
      });

      const deltaX = x - centerX;
      const deltaY = y - centerY;
      const newObjects = state.clipboard.map((obj) => {
        const newId = objectIdMap.get(obj.id)!;
        return {
          ...obj,
          id: newId,
          x: obj.x + deltaX,
          y: obj.y + deltaY,
          ...(obj.type === "connector" &&
          obj.endX !== undefined &&
          obj.endY !== undefined
            ? { endX: obj.endX + deltaX, endY: obj.endY + deltaY }
            : {}),
          ...(obj.type === "connector"
            ? (() => {
                const newSourceId =
                  obj.sourceId && objectIdMap.has(obj.sourceId)
                    ? objectIdMap.get(obj.sourceId)
                    : undefined;
                const newTargetId =
                  obj.targetId && objectIdMap.has(obj.targetId)
                    ? objectIdMap.get(obj.targetId)
                    : undefined;
                // pasteObjects 와 동일 — 강체 이동으로 저작 형태 보존
                const elbowBends = translateElbowBends(
                  obj.elbowBends,
                  deltaX,
                  deltaY,
                );
                return {
                  sourceId: newSourceId,
                  targetId: newTargetId,
                  elbowBends,
                };
              })()
            : {}),
          // pasteObjects 와 동일 — 라벨 텍스트박스 참조도 사본으로 옮긴다
          ...(obj.labelTextBoxId
            ? { labelTextBoxId: objectIdMap.get(obj.labelTextBoxId) }
            : {}),
          // Deep copy tableData for table objects
          ...(obj.type === "table" && obj.tableData
            ? { tableData: cloneTableData(obj.tableData) }
            : {}),
          locked: false,
          groupId: obj.groupId ? groupIdMap.get(obj.groupId) : undefined,
        };
      });

      // Create new groups with -copy-N suffix
      const newGroups = state.clipboardGroups.map((group) => {
        const baseName = group.name?.replace(/-copy-\d+$/, "") ?? "Group";
        const copyPattern = new RegExp(
          `^${baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-copy-(\\d+)$`,
        );
        let maxNum = 0;
        state.groups.forEach((g) => {
          if (g.name === baseName) maxNum = Math.max(maxNum, 0);
          const match = g.name?.match(copyPattern);
          if (match && match[1])
            maxNum = Math.max(maxNum, parseInt(match[1], 10));
        });
        return {
          ...group,
          id: groupIdMap.get(group.id)!,
          name: `${baseName}-copy-${maxNum + 1}`,
          customBounds: undefined,
        };
      });

      return {
        objects: [...remainingObjects, ...newObjects],
        groups: [...state.groups, ...newGroups],
        selectedIds: newObjects.map((obj) => obj.id),
      };
    }),

  bringToFront: () =>
    set((state) => {
      const selectedSet = new Set(state.selectedIds);
      const selectedObjs = state.objects.filter((obj) =>
        selectedSet.has(obj.id),
      );

      // Collect group IDs of selected objects
      const selectedGroupIds = new Set(
        selectedObjs.map((obj) => obj.groupId).filter(Boolean) as string[],
      );

      // Check if entire group is selected
      const fullySelectedGroupIds = new Set<string>();
      selectedGroupIds.forEach((groupId) => {
        const groupObjectIds = state.objects
          .filter((o) => o.groupId === groupId)
          .map((o) => o.id);
        const allSelected = groupObjectIds.every((id) => selectedSet.has(id));
        if (allSelected) {
          fullySelectedGroupIds.add(groupId);
        }
      });

      // Reorder: unselected first, selected last
      const result: typeof state.objects = [];
      state.objects.forEach((obj) => {
        if (!selectedSet.has(obj.id)) {
          result.push(obj);
        }
      });
      selectedObjs.forEach((obj) => {
        result.push({ ...obj, zIndex: 0 });
      });

      // Reorder groups: fully selected groups to end
      let newGroups = state.groups;
      if (fullySelectedGroupIds.size > 0) {
        const unselectedGroups = state.groups.filter(
          (g) => !fullySelectedGroupIds.has(g.id),
        );
        const selectedGroups = state.groups.filter((g) =>
          fullySelectedGroupIds.has(g.id),
        );
        newGroups = [...unselectedGroups, ...selectedGroups];
      }

      return { objects: result, groups: newGroups };
    }),

  sendToBack: () =>
    set((state) => {
      const selectedSet = new Set(state.selectedIds);
      const selectedObjs = state.objects.filter((obj) =>
        selectedSet.has(obj.id),
      );

      // Collect group IDs of selected objects
      const selectedGroupIds = new Set(
        selectedObjs.map((obj) => obj.groupId).filter(Boolean) as string[],
      );

      // Check if entire group is selected
      const fullySelectedGroupIds = new Set<string>();
      selectedGroupIds.forEach((groupId) => {
        const groupObjectIds = state.objects
          .filter((o) => o.groupId === groupId)
          .map((o) => o.id);
        const allSelected = groupObjectIds.every((id) => selectedSet.has(id));
        if (allSelected) {
          fullySelectedGroupIds.add(groupId);
        }
      });

      // Reorder: selected first, unselected last
      const result: typeof state.objects = [];
      selectedObjs.forEach((obj) => {
        result.push({
          ...obj,
          zIndex: obj.groupId ? 0 : -1,
        });
      });
      state.objects.forEach((obj) => {
        if (!selectedSet.has(obj.id)) {
          result.push(obj);
        }
      });

      // Reorder groups: fully selected groups to beginning
      let newGroups = state.groups;
      if (fullySelectedGroupIds.size > 0) {
        const selectedGroups = state.groups.filter((g) =>
          fullySelectedGroupIds.has(g.id),
        );
        const unselectedGroups = state.groups.filter(
          (g) => !fullySelectedGroupIds.has(g.id),
        );
        newGroups = [...selectedGroups, ...unselectedGroups];
      }

      return { objects: result, groups: newGroups };
    }),

  lockObjects: () =>
    set((state) => ({
      objects: state.objects.map((obj) =>
        state.selectedIds.includes(obj.id) ? { ...obj, locked: true } : obj,
      ),
      selectedIds: [], // Clear selection after lock
    })),

  unlockObjects: () =>
    set((state) => ({
      objects: state.objects.map((obj) =>
        state.selectedIds.includes(obj.id) ? { ...obj, locked: false } : obj,
      ),
    })),

  unlockAllObjects: () =>
    set((state) => ({
      objects: state.objects.map((obj) => ({ ...obj, locked: false })),
    })),
});
