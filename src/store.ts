/**
 * @deprecated Import from '@/store' instead of '@/store.ts'
 * This file re-exports from the new modular store structure for backward compatibility.
 */
export {
  useCanvasStore,
  useCanvasStore as default,
  undo,
  redo,
  clearHistory,
  // Selector hooks
  useObjects,
  useSelectedIds,
  useTool,
  useViewport,
  usePenSettings,
  useShapeSettings,
  useEraserSize,
  useEditingTextId,
  useActiveEditor,
  useObject,
  useShowShapesPanel,
  useSelectedShapeVariant,
  useRecentShapes,
  useFavoriteShapes,
  useCaptions,
  useCurrentUser,
  useIsCaptionPanelOpen,
  useActiveCaptionId,
  useCaptionFilter,
  useCaption,
  useGroups,
  useGroup,
  useProjectId,
  useProjectName,
  usePages,
  useCurrentPageId,
  useCurrentPage,
  usePage,
  useShowTemplatesPanel,
  useFavoriteTemplates,
  useRecentTemplates,
} from "./store/index";
export * from "./store/slices";
export type { SliceCreator } from "./store/types";

// Re-export DEFAULT_FAVORITE_SHAPES for backward compatibility
export { DEFAULT_FAVORITE_SHAPES } from "./store/slices/shapes";
