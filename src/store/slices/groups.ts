import type { GroupInfo, CanvasStoreActions, CanvasObject } from "@/types";
import { generateUUID } from "@/utils/uuid";
import type { SliceCreator } from "../types";
import { translateElbowBends } from "@/utils/translateElbowBends";

// ============================================================================
// Groups Slice Types
// ============================================================================

export interface GroupsState {
  groups: GroupInfo[];
}

export interface GroupsActions {
  groupSelected: CanvasStoreActions["groupSelected"];
  ungroupSelected: CanvasStoreActions["ungroupSelected"];
  updateGroup: CanvasStoreActions["updateGroup"];
  deleteGroup: CanvasStoreActions["deleteGroup"];
  selectGroup: CanvasStoreActions["selectGroup"];
  moveGroupObjects: CanvasStoreActions["moveGroupObjects"];
  scaleGroupObjects: CanvasStoreActions["scaleGroupObjects"];
}

export type GroupsSlice = GroupsState & GroupsActions;

// ============================================================================
// Initial State
// ============================================================================

export const groupsInitialState: GroupsState = {
  groups: [],
};

// ============================================================================
// Slice Creator
// ============================================================================

export const createGroupsSlice: SliceCreator<GroupsSlice> = (set) => ({
  ...groupsInitialState,

  groupSelected: () =>
    set((state) => {
      const { selectedIds, objects, groups } = state;
      if (selectedIds.length < 2) return state; // Need at least 2 objects

      // Collect existing group IDs from selected objects
      const existingGroupIds = new Set(
        objects
          .filter((o) => selectedIds.includes(o.id))
          .map((o) => o.groupId)
          .filter(Boolean),
      );

      // Skip if all objects are already in the same group
      const selectedObjs = objects.filter((o) => selectedIds.includes(o.id));
      const allInSameGroup = selectedObjs.every(
        (obj) => obj.groupId && obj.groupId === selectedObjs[0]?.groupId,
      );
      if (allInSameGroup && selectedObjs[0]?.groupId) {
        return state;
      }

      // Inherit style from the dominant group (most objects)
      let inheritedStyle: Partial<GroupInfo> = {};
      if (existingGroupIds.size > 0) {
        const groupCounts = new Map<string, number>();
        for (const obj of selectedObjs) {
          if (obj.groupId) {
            groupCounts.set(
              obj.groupId,
              (groupCounts.get(obj.groupId) ?? 0) + 1,
            );
          }
        }
        let maxCount = 0;
        let dominantGroupId: string | null = null;
        for (const [gid, count] of groupCounts) {
          if (count > maxCount) {
            maxCount = count;
            dominantGroupId = gid;
          }
        }
        if (dominantGroupId) {
          const dominantGroup = groups.find((g) => g.id === dominantGroupId);
          if (dominantGroup) {
            inheritedStyle = {
              name: dominantGroup.name,
              fill: dominantGroup.fill,
              stroke: dominantGroup.stroke,
              lineStyle: dominantGroup.lineStyle,
              tagColor: dominantGroup.tagColor,
            };
          }
        }
      }

      // Create new group
      const groupId = generateUUID();
      const newGroup: GroupInfo = {
        id: groupId,
        name: inheritedStyle.name ?? `섹션 ${groups.length + 1}`,
        fill: inheritedStyle.fill,
        stroke: inheritedStyle.stroke,
        lineStyle: inheritedStyle.lineStyle,
        tagColor: inheritedStyle.tagColor,
      };

      // Assign new groupId to selected objects
      const updatedObjects = objects.map((obj) =>
        selectedIds.includes(obj.id) ? { ...obj, groupId } : obj,
      );

      // Clean up groups with only 1 member left
      const groupMemberCounts = new Map<string, number>();
      for (const obj of updatedObjects) {
        if (obj.groupId) {
          groupMemberCounts.set(
            obj.groupId,
            (groupMemberCounts.get(obj.groupId) ?? 0) + 1,
          );
        }
      }

      const groupsToDissolve = new Set<string>();
      for (const gid of existingGroupIds) {
        const count = groupMemberCounts.get(gid as string) ?? 0;
        if (count < 2) {
          groupsToDissolve.add(gid as string);
        }
      }

      const finalObjects = updatedObjects.map((obj) =>
        obj.groupId && groupsToDissolve.has(obj.groupId)
          ? { ...obj, groupId: undefined }
          : obj,
      );

      // Clean up unused group metadata
      const usedGroupIds = new Set(
        finalObjects.map((o) => o.groupId).filter(Boolean),
      );
      const remainingGroups = groups.filter((g) => usedGroupIds.has(g.id));

      return {
        objects: finalObjects,
        groups: [...remainingGroups, newGroup],
      };
    }),

  ungroupSelected: () =>
    set((state) => {
      const { selectedIds, objects, groups } = state;

      // Extract group IDs from __group: virtual markers
      const virtualGroupIds = selectedIds
        .filter((id) => id.startsWith("__group:"))
        .map((id) => id.replace("__group:", ""));

      // Find selected objects that belong to groups
      const selectedWithGroup = objects.filter(
        (o) => selectedIds.includes(o.id) && o.groupId,
      );

      // For virtual group selections, find all objects in that group
      if (selectedWithGroup.length === 0 && virtualGroupIds.length === 0)
        return state;

      // Affected group IDs = from selected objects + virtual markers
      const affectedGroupIds = new Set([
        ...selectedWithGroup.map((o) => o.groupId),
        ...virtualGroupIds,
      ]);

      // Remove groupId from selected objects AND objects in virtual-selected groups
      const updatedObjects = objects.map((obj) => {
        if (selectedIds.includes(obj.id) && obj.groupId) {
          return { ...obj, groupId: undefined };
        }
        if (obj.groupId && affectedGroupIds.has(obj.groupId)) {
          return { ...obj, groupId: undefined };
        }
        return obj;
      });

      // Check remaining members per group
      const groupMemberCounts = new Map<string, number>();
      for (const obj of updatedObjects) {
        if (obj.groupId) {
          groupMemberCounts.set(
            obj.groupId,
            (groupMemberCounts.get(obj.groupId) ?? 0) + 1,
          );
        }
      }

      // Dissolve groups with less than 2 members
      const groupsToDissolve = new Set<string>();
      for (const groupId of affectedGroupIds) {
        const count = groupMemberCounts.get(groupId as string) ?? 0;
        if (count < 2) {
          groupsToDissolve.add(groupId as string);
        }
      }

      // Remove groupId from objects in dissolved groups
      const finalObjects = updatedObjects.map((obj) =>
        obj.groupId && groupsToDissolve.has(obj.groupId)
          ? { ...obj, groupId: undefined }
          : obj,
      );

      // Remove affected groups and clean up unused groups
      const usedGroupIds = new Set(
        finalObjects.map((o) => o.groupId).filter(Boolean),
      );
      const remainingGroups = groups.filter(
        (g) =>
          !affectedGroupIds.has(g.id) &&
          (usedGroupIds.has(g.id) || !!g.customBounds),
      );

      return {
        objects: finalObjects,
        groups: remainingGroups,
        selectedIds: [],
      };
    }),

  updateGroup: (groupId, updates) =>
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId ? { ...g, ...updates } : g,
      ),
    })),

  deleteGroup: (groupId) =>
    set((state) => {
      // Remove groupId from objects
      const updatedObjects = state.objects.map((obj) =>
        obj.groupId === groupId ? { ...obj, groupId: undefined } : obj,
      );
      // Delete group metadata
      const remainingGroups = state.groups.filter((g) => g.id !== groupId);
      return { objects: updatedObjects, groups: remainingGroups };
    }),

  selectGroup: (groupId) =>
    set(() => {
      // Use virtual selection marker for all groups.
      // This prevents cluttered selection indicators on every child object.
      // Objects inside the section can still be individually selected by clicking them directly.
      return { selectedIds: [`__group:${groupId}`] };
    }),

  moveGroupObjects: (groupId, deltaX, deltaY) =>
    set((state) => {
      const group = state.groups.find((g) => g.id === groupId);
      const hasDirectMembers = state.objects.some((o) => o.groupId === groupId);

      // For parent groups with no direct members, find objects within customBounds
      const isInGroup = (obj: CanvasObject) => {
        if (obj.groupId === groupId) return true;
        if (!hasDirectMembers && group?.customBounds) {
          const b = group.customBounds;
          return (
            obj.x >= b.x &&
            obj.y >= b.y &&
            obj.x <= b.x + b.width &&
            obj.y <= b.y + b.height
          );
        }
        return false;
      };

      // 이번 이동으로 자리가 바뀌는 객체들 (커넥터 강체 판정에 쓴다)
      const movingIds = new Set(
        state.objects.filter(isInGroup).map((o) => o.id),
      );

      return {
        objects: state.objects.map((obj) => {
          if (!isInGroup(obj)) return obj;

          // Handle connectors
          if (obj.type === "connector") {
            const hasSourceConnection = !!obj.sourceId;
            const hasTargetConnection = !!obj.targetId;

            // 각 끝점이 이번 이동으로 실제로 움직이는가?
            // 붙어 있지 않으면 커넥터 자신이 움직이고, 붙어 있으면 그 도형이
            // 같은 그룹 안에 있어야 함께 움직인다.
            const sourceMoves =
              !hasSourceConnection || movingIds.has(obj.sourceId!);
            const targetMoves =
              !hasTargetConnection || movingIds.has(obj.targetId!);

            // 양쪽이 함께 움직이면 강체 이동 — 엘보우 꺾임도 같이 옮겨야
            // 형태가 보존된다. bend 는 절대 좌표라 안 옮기면 제자리에 남아
            // 도형만 이동하고 꺾임이 찌그러진다.
            const isRigidMove = sourceMoves && targetMoves;
            const movedBends = isRigidMove
              ? translateElbowBends(obj.elbowBends, deltaX, deltaY)
              : obj.elbowBends;

            const updates: Partial<typeof obj> = {};

            if (movedBends !== obj.elbowBends) {
              updates.elbowBends = movedBends;
            }

            // Only move start point if not connected
            if (!hasSourceConnection) {
              updates.x = (obj.x ?? 0) + deltaX;
              updates.y = (obj.y ?? 0) + deltaY;
            }

            // Only move end point if not connected
            if (
              !hasTargetConnection &&
              obj.endX !== undefined &&
              obj.endY !== undefined
            ) {
              updates.endX = obj.endX + deltaX;
              updates.endY = obj.endY + deltaY;
            }

            return Object.keys(updates).length > 0
              ? { ...obj, ...updates }
              : obj;
          }

          // Regular objects: move x, y
          return {
            ...obj,
            x: (obj.x ?? 0) + deltaX,
            y: (obj.y ?? 0) + deltaY,
          };
        }),
        // Also move customBounds
        groups: state.groups.map((g) =>
          g.id === groupId && g.customBounds
            ? {
                ...g,
                customBounds: {
                  ...g.customBounds,
                  x: g.customBounds.x + deltaX,
                  y: g.customBounds.y + deltaY,
                },
              }
            : g,
        ),
        // Also move child group customBounds
        ...(!hasDirectMembers && group?.customBounds
          ? {
              groups: state.groups.map((g) => {
                // Move this group and any child groups within its bounds
                if (g.id === groupId && g.customBounds) {
                  return {
                    ...g,
                    customBounds: {
                      ...g.customBounds,
                      x: g.customBounds.x + deltaX,
                      y: g.customBounds.y + deltaY,
                    },
                  };
                }
                if (
                  g.customBounds &&
                  group.customBounds &&
                  g.customBounds.x >= group.customBounds.x &&
                  g.customBounds.y >= group.customBounds.y &&
                  g.customBounds.x + g.customBounds.width <=
                    group.customBounds.x + group.customBounds.width &&
                  g.customBounds.y + g.customBounds.height <=
                    group.customBounds.y + group.customBounds.height
                ) {
                  return {
                    ...g,
                    customBounds: {
                      ...g.customBounds,
                      x: g.customBounds.x + deltaX,
                      y: g.customBounds.y + deltaY,
                    },
                  };
                }
                return g;
              }),
            }
          : {}),
      };
    }),

  scaleGroupObjects: (groupId, scaleX, scaleY, originX, originY) =>
    set((state) => {
      // Step 1: Collect IDs of shapes in the group (excluding connectors)
      const groupObjectIds = new Set(
        state.objects
          .filter((o) => o.groupId === groupId && o.type !== "connector")
          .map((o) => o.id),
      );

      // Step 2: Update all objects
      const updatedObjects = state.objects.map((obj) => {
        // Connector: scale offsets if connected to group objects
        if (obj.type === "connector") {
          const updates: Partial<typeof obj> = {};

          // Scale sourceOffset if sourceId is in group
          if (obj.sourceId && groupObjectIds.has(obj.sourceId)) {
            if (obj.sourceOffsetX !== undefined) {
              updates.sourceOffsetX = obj.sourceOffsetX * scaleX;
            }
            if (obj.sourceOffsetY !== undefined) {
              updates.sourceOffsetY = obj.sourceOffsetY * scaleY;
            }
          }

          // Scale targetOffset if targetId is in group
          if (obj.targetId && groupObjectIds.has(obj.targetId)) {
            if (obj.targetOffsetX !== undefined) {
              updates.targetOffsetX = obj.targetOffsetX * scaleX;
            }
            if (obj.targetOffsetY !== undefined) {
              updates.targetOffsetY = obj.targetOffsetY * scaleY;
            }
          }

          return Object.keys(updates).length > 0 ? { ...obj, ...updates } : obj;
        }

        // Skip objects not in group
        if (obj.groupId !== groupId) return obj;

        // Scale position relative to origin
        const objX = obj.x ?? 0;
        const objY = obj.y ?? 0;
        const newX = originX + (objX - originX) * scaleX;
        const newY = originY + (objY - originY) * scaleY;

        const updates: Partial<typeof obj> = {
          x: newX,
          y: newY,
        };

        // Scale size based on type
        if (obj.type === "line") {
          // Scale line points array
          if (obj.points) {
            updates.points = obj.points.map((p, i) =>
              i % 2 === 0 ? p * scaleX : p * scaleY,
            );
          }
        } else {
          // Rectangles, images, sticky notes, text boxes, shapes, etc.
          if (obj.width !== undefined) {
            updates.width = Math.max(5, obj.width * scaleX);
          }
          if (obj.height !== undefined) {
            updates.height = Math.max(5, obj.height * scaleY);
          }
          // Also scale font size (based on vertical scale)
          if (obj.fontSize !== undefined) {
            updates.fontSize = Math.max(4, Math.round(obj.fontSize * scaleY));
          }
        }

        return { ...obj, ...updates };
      });

      return { objects: updatedObjects };
    }),
});
