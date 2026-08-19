import { nanoid } from "nanoid";
import type {
  CanvasObject,
  GroupInfo,
  Tool,
  CanvasStoreActions,
  TemplateDefinition,
} from "@/types";
import type { SliceCreator } from "../types";

// ============================================================================
// Templates Slice Types
// ============================================================================

export interface TemplatesState {
  showTemplatesPanel: boolean;
  favoriteTemplates: string[];
  recentTemplates: string[];
  customTemplates: TemplateDefinition[];
}

export interface TemplatesActions {
  setShowTemplatesPanel: CanvasStoreActions["setShowTemplatesPanel"];
  toggleFavoriteTemplate: CanvasStoreActions["toggleFavoriteTemplate"];
  addRecentTemplate: CanvasStoreActions["addRecentTemplate"];
  applyTemplate: CanvasStoreActions["applyTemplate"];
  saveGroupAsTemplate: CanvasStoreActions["saveGroupAsTemplate"];
  deleteCustomTemplate: CanvasStoreActions["deleteCustomTemplate"];
}

export type TemplatesSlice = TemplatesState & TemplatesActions;

// ============================================================================
// Initial State
// ============================================================================

export const templatesInitialState: TemplatesState = {
  showTemplatesPanel: false,
  favoriteTemplates: [],
  recentTemplates: [],
  customTemplates: [],
};

// ============================================================================
// Slice Creator
// ============================================================================

export const createTemplatesSlice: SliceCreator<TemplatesSlice> = (set) => ({
  ...templatesInitialState,

  setShowTemplatesPanel: (show: boolean) => set({ showTemplatesPanel: show }),

  toggleFavoriteTemplate: (templateId: string) =>
    set((state) => {
      if (state.favoriteTemplates.includes(templateId)) {
        return {
          favoriteTemplates: state.favoriteTemplates.filter(
            (id) => id !== templateId,
          ),
        };
      }
      return {
        favoriteTemplates: [...state.favoriteTemplates, templateId],
      };
    }),

  addRecentTemplate: (templateId: string) =>
    set((state) => {
      // Remove if already exists, add to front, keep max 8
      const filtered = state.recentTemplates.filter((id) => id !== templateId);
      return { recentTemplates: [templateId, ...filtered].slice(0, 8) };
    }),

  applyTemplate: (template, position) =>
    set((state) => {
      if (template.objects.length === 0) return state;

      // Calculate template bounds/center
      const bounds = template.objects.reduce(
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

      // Create a new group for all template objects
      const templateGroupId = nanoid();

      // Create group ID mapping (template.groups -> new IDs)
      const groupIdMap = new Map<string, string>();
      (template.groups ?? []).forEach((group) => {
        groupIdMap.set(group.id, nanoid());
      });

      // Create object ID mapping (old ID -> new ID)
      const objectIdMap = new Map<string, string>();
      template.objects.forEach((obj) => {
        objectIdMap.set(obj.id, nanoid());
      });

      // Calculate position delta
      const deltaX = position.x - centerX;
      const deltaY = position.y - centerY;

      // Clone objects with new IDs and adjusted positions
      const newObjects: CanvasObject[] = template.objects.map((obj) => {
        const newId = objectIdMap.get(obj.id)!;
        return {
          ...obj,
          id: newId,
          x: obj.x + deltaX,
          y: obj.y + deltaY,
          // Connector endX/endY also moved
          ...(obj.type === "connector" &&
          obj.endX !== undefined &&
          obj.endY !== undefined
            ? { endX: obj.endX + deltaX, endY: obj.endY + deltaY }
            : {}),
          // Remap connector sourceId/targetId if within template
          ...(obj.type === "connector"
            ? {
                sourceId:
                  obj.sourceId && objectIdMap.has(obj.sourceId)
                    ? objectIdMap.get(obj.sourceId)
                    : undefined,
                targetId:
                  obj.targetId && objectIdMap.has(obj.targetId)
                    ? objectIdMap.get(obj.targetId)
                    : undefined,
              }
            : {}),
          locked: false,
          // Assign to template group (all objects in same group)
          groupId: templateGroupId,
        };
      });

      // Create new group for the entire template
      // Use stored group style if available (from custom templates)
      const storedGroupStyle = template.groups?.[0];
      const newTemplateGroup: GroupInfo = {
        id: templateGroupId,
        name: storedGroupStyle?.name || template.name,
        // Apply stored group styles
        fill: storedGroupStyle?.fill,
        stroke: storedGroupStyle?.stroke,
        strokeWidth: storedGroupStyle?.strokeWidth,
        lineStyle: storedGroupStyle?.lineStyle,
        tagColor: storedGroupStyle?.tagColor,
        hidden: storedGroupStyle?.hidden,
      };

      // Clone any additional groups from template (for nested groups)
      const additionalGroups = (template.groups ?? []).slice(1);
      const newGroups: GroupInfo[] = [
        newTemplateGroup,
        ...additionalGroups.map((group) => ({
          ...group,
          id: groupIdMap.get(group.id)!,
          customBounds: undefined, // Recalculate bounds
        })),
      ];

      return {
        objects: [...state.objects, ...newObjects],
        groups: [...state.groups, ...newGroups],
        selectedIds: newObjects.map((obj) => obj.id),
        tool: "select" as Tool,
        showTemplatesPanel: false,
      };
    }),

  saveGroupAsTemplate: (groupId, name) =>
    set((state) => {
      const group = state.groups.find((g) => g.id === groupId);
      if (!group) return state;

      // Get all objects in the group
      const groupObjects = state.objects.filter(
        (obj) => obj.groupId === groupId,
      );
      if (groupObjects.length === 0) return state;

      // Calculate bounds for centering
      const bounds = groupObjects.reduce(
        (acc, obj) => ({
          minX: Math.min(acc.minX, obj.x),
          minY: Math.min(acc.minY, obj.y),
          maxX: Math.max(acc.maxX, obj.x + (obj.width ?? obj.radius ?? 50)),
          maxY: Math.max(acc.maxY, obj.y + (obj.height ?? obj.radius ?? 50)),
        }),
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
      );

      // Normalize positions (make relative to 0,0)
      const offsetX = bounds.minX;
      const offsetY = bounds.minY;

      const normalizedObjects: CanvasObject[] = groupObjects.map((obj) => ({
        ...obj,
        x: obj.x - offsetX,
        y: obj.y - offsetY,
        ...(obj.type === "connector" &&
        obj.endX !== undefined &&
        obj.endY !== undefined
          ? {
              endX: obj.endX - offsetX,
              endY: obj.endY - offsetY,
            }
          : {}),
        groupId: undefined, // Remove group reference
        locked: false,
      }));

      const templateName =
        name || group.name || `My Template ${state.customTemplates.length + 1}`;

      // Save group style information
      const groupStyle: GroupInfo = {
        id: "template-group", // Placeholder ID, will be replaced on apply
        name: group.name || templateName,
        fill: group.fill,
        stroke: group.stroke,
        strokeWidth: group.strokeWidth,
        lineStyle: group.lineStyle,
        tagColor: group.tagColor,
        hidden: group.hidden,
      };

      const newTemplate: TemplateDefinition = {
        id: `custom-${nanoid()}`,
        name: templateName,
        description: `Custom template from "${group.name || "Section"}"`,
        category: "custom",
        objects: normalizedObjects,
        groups: [groupStyle], // Store group style info
        tags: ["custom", "user"],
      };

      return {
        customTemplates: [...state.customTemplates, newTemplate],
      };
    }),

  deleteCustomTemplate: (templateId: string) =>
    set((state) => ({
      customTemplates: state.customTemplates.filter((t) => t.id !== templateId),
      favoriteTemplates: state.favoriteTemplates.filter(
        (id) => id !== templateId,
      ),
      recentTemplates: state.recentTemplates.filter((id) => id !== templateId),
    })),
});
