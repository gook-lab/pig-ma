/**
 * Pig-ma - FigJam-style infinite canvas library for React
 *
 * @packageDocumentation
 */

// ============================================================================
// Styles - Import this in your app
// ============================================================================
import "./index.css";

// ============================================================================
// Main Canvas Component
// ============================================================================
export { Canvas } from "./components/Canvas";

// ============================================================================
// Toolbar & UI Components
// ============================================================================
export { Toolbar } from "./components/Toolbar";
export { Header } from "./components/Header";
export { PageDropdown } from "./components/PageDropdown";
export { ProjectNameEditor } from "./components/ProjectNameEditor";
export { ViewMenu } from "./components/ViewMenu";
export { LogoMenu } from "./components/LogoMenu";
export { ZoomControls } from "./components/ZoomControls";
export { FloatingUtilityBar } from "./components/FloatingUtilityBar";
export { ContextMenu } from "./components/ContextMenu";
export { ShapesPanel } from "./components/ShapesPanel";
export { TemplatesPanel } from "./components/TemplatesPanel";

// ============================================================================
// Options Bars
// ============================================================================
export { TextOptionsBar } from "./components/TextOptionsBar";
export { ShapeOptionsBar } from "./components/ShapeOptionsBar";
export { ConnectorOptionsBar } from "./components/ConnectorOptionsBar";
export { LineOptionsBar } from "./components/LineOptionsBar";

// ============================================================================
// Editors
// ============================================================================
export { TextBoxEditor } from "./components/TextBoxEditor";
export { ShapeTextEditor } from "./components/ShapeTextEditor";
export { RichTextEditor } from "./components/RichTextEditor";
export type {
  RichTextEditorRef,
  RichTextEditorProps,
} from "./components/RichTextEditor";

// ============================================================================
// Konva Text Input Components
// ============================================================================
export {
  KonvaCursor,
  HiddenTextarea,
  useKonvaTextInput,
  calculateCursorPosition,
  calculateSelectionRects,
} from "./components/KonvaTextInput";
export type {
  TextInputState,
  KonvaTextInputRef,
} from "./components/KonvaTextInput";

// ============================================================================
// Renderers
// ============================================================================
export {
  RichTextRenderer,
  SimpleRichTextRenderer,
} from "./components/RichTextRenderer";

// ============================================================================
// Shape Components
// ============================================================================
/** @deprecated Use Shape component with shapeVariant="rectangle" instead */
export { Rectangle } from "./components/shapes/Rectangle";
export { StickyNote } from "./components/shapes/StickyNote";
export { TextBox } from "./components/shapes/TextBox";
export { Shape, getShapePath } from "./components/shapes/Shape";
export { Connector } from "./components/shapes/Connector";
export { Line } from "./components/shapes/Line";
export { CanvasImage } from "./components/shapes/CanvasImage";
export { Chart } from "./components/shapes/Chart";
export { Table } from "./components/shapes/Table";
export { CodeBlock } from "./components/shapes/CodeBlock";
export { Embed } from "./components/shapes/Embed";

// ============================================================================
// Chart Components
// ============================================================================
export { ChartRightPanel } from "./components/ChartRightPanel";
export { ChartOptionsBar } from "./components/ChartOptionsBar";
export { ChartItemOptionsBar } from "./components/ChartItemOptionsBar";
export { ChartTooltip } from "./components/ChartTooltip";
export { ChartEditor } from "./components/ChartEditor";
export { CodeBlockEditor } from "./components/CodeBlockEditor";
export { EmbedEditor } from "./components/EmbedEditor";
export { EmbedOptionsBar } from "./components/EmbedOptionsBar";
export { EmbedUrlModal } from "./components/EmbedUrlModal";
export { EmbedViewerOverlay } from "./components/EmbedViewerOverlay";
export { LegendOptionsBar } from "./components/LegendOptionsBar";
export { LineSeriesOptionsBar } from "./components/LineSeriesOptionsBar";
export { PointOptionsBar } from "./components/PointOptionsBar";

// ============================================================================
// Caption/Comment System
// ============================================================================
export {
  CaptionInput,
  CaptionMarker,
  CaptionPopup,
  CaptionMessage,
  CaptionPanel,
  CaptionPanelItem,
  CaptionFilters,
  EmojiPicker,
} from "./components/captions";

// ============================================================================
// Figma Import UI
// ============================================================================
export { FigmaImportModal } from "./components/FigmaImportModal";

// ============================================================================
// Search & Export
// ============================================================================
export { SearchPanel } from "./components/SearchPanel";
export { ExportPanel } from "./components/ExportPanel";

// ============================================================================
// Reactions (Voting)
// ============================================================================
export { ReactionBar, ReactionDisplay } from "./components/ReactionBar";

// ============================================================================
// Utility Components
// ============================================================================
export {
  SelectionBorder,
  CircleSelectionBorder,
} from "./components/SelectionBorder";
export { MultiSelectIndicator } from "./components/MultiSelectIndicator";
export { ConnectionHandles } from "./components/ConnectionHandles";
export { CursorChat } from "./components/CursorChat";
export { UnlockConfirmDialog } from "./components/UnlockConfirmDialog";
export { LockOverlay } from "./components/LockOverlay";
export { HistoryPanel } from "./components/HistoryPanel";
export { Minimap } from "./components/Minimap";
export { CanvasScrollbars } from "./components/CanvasScrollbars";

// ============================================================================
// Group System Components
// ============================================================================
export { GroupBoundary } from "./components/GroupBoundary";
export { GroupOptionsBar } from "./components/GroupOptionsBar";
export { GroupEditor } from "./components/GroupEditor";
export { SectionTag } from "./components/SectionTag";

// ============================================================================
// Popovers
// ============================================================================
export { PencilPopover } from "./components/PencilPopover";
export { StickyNotePopover } from "./components/StickyNotePopover";

// ============================================================================
// Hooks
// ============================================================================
export { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
export { useImageDrop } from "./hooks/useImageDrop";
export { useHistoryStore } from "./hooks/useAutoSave";
export { dragCoordinator, resizeCoordinator } from "./hooks/useDragCoordinator";
export type { DragPosition, ResizeSize } from "./hooks/useDragCoordinator";
export { useShortcutsStore } from "./hooks/useShortcuts";
export {
  useGlobalCustomColors,
  customColorManager,
} from "./hooks/useCustomColors";
export {
  useVisibleObjects,
  useVisibleObjectsStats,
} from "./hooks/useVisibleObjects";
export {
  useActiveToolContext,
  useActiveToolWithSettings,
  useToolContextAvailability,
} from "./hooks/useActiveToolContext";

// ============================================================================
// Tool Contexts (Progressive Disclosure Pattern)
// ============================================================================
export {
  // Pencil
  PencilProvider,
  usePencilContext,
  usePencilContextSafe,
  // Shape
  ShapeProvider,
  useShapeContext,
  useShapeContextSafe,
  // Connector
  ConnectorProvider,
  useConnectorContext,
  useConnectorContextSafe,
  // StickyNote
  StickyNoteProvider,
  useStickyNoteContext,
  useStickyNoteContextSafe,
  // Combined
  ToolProvider,
} from "./contexts";
export type {
  PencilContextValue,
  PencilSettings as ToolPencilSettings,
  ShapeContextValue,
  ShapeSettings as ToolShapeSettings,
  ConnectorContextValue,
  ConnectorSettings as ToolConnectorSettings,
  StickyNoteContextValue,
  ToolProviderProps,
} from "./contexts";

// ============================================================================
// Store & Selectors
// ============================================================================
export {
  useCanvasStore,
  undo,
  redo,
  DEFAULT_FAVORITE_SHAPES,
  // Optimized selectors
  useObjects,
  useSelectedIds,
  useTool,
  useViewport,
  usePenSettings,
  useShapeSettings,
  useEditingTextId,
  useActiveEditor,
  useObject,
  useShowShapesPanel,
  useSelectedShapeVariant,
  useRecentShapes,
  useFavoriteShapes,
  useEraserSize,
  useCaptions,
  useCurrentUser,
  useIsCaptionPanelOpen,
  useActiveCaptionId,
  useCaptionFilter,
  useCaption,
  // Group selectors
  useGroups,
  useGroup,
  // Page selectors
  useProjectId,
  useProjectName,
  usePages,
  useCurrentPageId,
  useCurrentPage,
  usePage,
  // Template selectors
  useShowTemplatesPanel,
  useFavoriteTemplates,
  useRecentTemplates,
} from "./store";
export type {
  EditingCursorState,
  CanvasStore,
  CanvasStoreState,
  CanvasStoreActions,
} from "./types";

// ============================================================================
// Factory Functions
// ============================================================================
export {
  createRectangle,
  createCircle,
  createImage,
  createLine,
  createArrow,
  createConnector,
  createStickyNote,
  createTextBox,
  createCodeBlock,
  createShape,
  createEmbed,
  cloneShape,
  snapToGrid,
  snapToShapeGrid,
  getDefaultShapeSize,
  GRID_SIZE,
  SHAPE_GRID_SIZE,
} from "./utils/factory";
export type { AuthorInfo } from "./utils/factory";

// ============================================================================
// Geometry Utilities
// ============================================================================
export {
  getObjectBounds,
  rectsIntersect,
  normalizeRect,
  getObjectCenter,
  getAnchorPoint,
  findClosestAnchor,
  findSnapTarget,
  calculateAlignmentGuides,
  SNAP_THRESHOLD,
  ALIGNMENT_THRESHOLD,
  ALIGNMENT_PROXIMITY,
  CONNECTOR_SNAP_THRESHOLD,
  CONNECTOR_DEAD_ZONE,
  // Viewport Virtualization
  isObjectInViewport,
  filterVisibleObjects,
} from "./utils/geometry";
export type {
  Bounds,
  AlignmentResult,
  ConnectorSnapPoint,
  Viewport,
} from "./utils/geometry";

// ============================================================================
// Type Guards (TypeScript narrowing helpers)
// ============================================================================
export {
  isShape,
  isRectangle,
  isConnector,
  isConnectorLabel,
  isTextBox,
  isStickyNote,
  isLine,
  isImage,
  isTable,
  isCodeBlock,
  hasTextContent,
  hasBounds,
  isTextEditable,
  isSelectable,
  getDefaultSize,
  getObjectBounds as getObjectBoundsFromGuard,
} from "./utils/typeGuards";

// ============================================================================
// Canvas Bounds Utilities
// ============================================================================
export {
  calculateCanvasBounds,
  calculateMinimapBounds,
  clampViewportToBounds,
  BASE_CANVAS_WIDTH,
  BASE_CANVAS_HEIGHT,
  BASE_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_MULTIPLIER,
} from "./utils/canvasBounds";

// ============================================================================
// Options Bar Utilities
// ============================================================================
export {
  calculateOptionsBarPosition,
  calculateOptionsBarPositionForCircle,
  calculateOptionsBarPositionForLine,
  calculateOptionsBarPositionForPoints,
  getOptionsBarTransform,
} from "./utils/optionsBar";
export type {
  Viewport as OptionsBarViewport,
  ElementBounds,
  OptionsBarPosition,
  CalculateOptionsBarPositionParams,
} from "./utils/optionsBar";

// ============================================================================
// Tiptap Editor Components (Notion-style)
// ============================================================================
export {
  TiptapEditor,
  TiptapViewer,
  TextEditorOverlay,
  TextViewerOverlay,
  tiptapExtensions,
  isInViewport,
} from "./components/tiptap";
export type {
  TiptapEditorProps,
  TiptapViewerProps,
  Editor as TiptapEditorInstance,
  JSONContent,
} from "./components/tiptap";

// ============================================================================
// Tiptap Migration Utilities
// ============================================================================
export {
  textSegmentsToTiptap,
  tiptapToPlainText,
  plainTextToTiptap,
  createEmptyTiptapContent,
  isTiptapContentEmpty,
} from "./utils/tiptapMigration";

// ============================================================================
// Rich Text Utilities
// ============================================================================
export {
  textToRichText,
  richTextToPlainText,
  mergeAdjacentSegments,
  splitAndApplyStyle,
  toggleStyleInRange,
  measureTextWidth,
  calculateLineBreaks,
  getCharIndexFromSegments,
  getSegmentFromCharIndex,
  LINE_HEIGHT,
} from "./utils/richText";
export type { LineData } from "./utils/richText";

// ============================================================================
// Text Configuration
// ============================================================================
export {
  TEXT_CONFIG,
  FONT_SIZE_PRESETS,
  getFontSizeFromPreset as getFontSizeFromTextConfig,
  getTextAreaSize,
  CURSOR_BLINK_INTERVAL,
  CURSOR_WIDTH,
  CURSOR_HEIGHT_RATIO,
  CURSOR_COLOR,
  INDENT_WIDTH,
  LINE_HEIGHT as TEXT_LINE_HEIGHT,
} from "./utils/textConfig";
export type { FontSizePreset } from "./utils/textConfig";

// ============================================================================
// Template Data & Utilities
// ============================================================================
export { DEFAULT_TEMPLATES, TEMPLATE_CATEGORIES } from "./data/templates";
export {
  getAllTemplates,
  getTemplatesByCategory,
  getTemplateById,
  searchTemplates,
  getCategoryInfo,
  getAllCategories,
  getTemplateBounds,
  generateTemplateThumbnail,
} from "./utils/templates";

// ============================================================================
// Embed Utilities
// ============================================================================
export {
  parseYouTubeUrl,
  parseFigmaUrl,
  parseEmbedUrl,
  getEmbedIframeUrl,
} from "./utils/embed";

// ============================================================================
// Types
// ============================================================================
export type {
  // Core types
  ObjectType,
  Tool,
  EraserSize,
  ShapeVariant,
  // Style types
  FontFamily,
  FontSize,
  TextAlign,
  ListType,
  PenType,
  MarkerStyle,
  LineStyle,
  PathStyle,
  // Object types
  CanvasObject,
  TextSegment,
  PenSettings,
  ShapeSettings,
  CanvasBounds,
  CanvasState,
  // Keyboard types
  ShortcutAction,
  KeyBinding,
  ShortcutConfig,
  // Caption types
  CommentAttachment,
  CommentMessage,
  CaptionThread,
  User,
  CaptionFilter,
  // Group types
  GroupInfo,
  // Grid types
  GridType,
  // Alignment guide types
  AlignmentGuide,
  // Page types
  PageData,
  // Tiptap migration types
  ContentVersion,
  // Template types
  TemplateCategory,
  TemplateDefinition,
  TemplateCategoryInfo,
  // Chart types
  ChartVariant,
  ChartSortBy,
  ChartDataItem,
  ChartLineStyle,
  ChartSeries,
  ChartData,
  SelectedPoint,
  // Reaction types
  REACTION_EMOJIS,
  ReactionEmoji,
  ObjectReaction,
  // Code block types
  CodeLanguage,
  CODE_LANGUAGES,
  // Embed types
  EmbedType,
  EmbedMetadata,
} from "./types";

// ============================================================================
// Lib Utilities
// ============================================================================
export { cn } from "./lib/utils";

// ============================================================================
// Zod Schemas (Runtime Type Validation)
// ============================================================================
export {
  // Validation functions
  validatePersistedState,
  validateCanvasObject,
  validatePageData,
  // Core schemas
  CanvasObjectSchema,
  PageDataSchema,
  GroupInfoSchema,
  CaptionThreadSchema,
  ViewportSchema,
  CanvasBoundsSchema,
  UserSchema,
  PersistedStateSchema,
  // Enum schemas
  ObjectTypeSchema,
  ShapeVariantSchema,
  PenTypeSchema,
  MarkerStyleSchema,
  LineStyleSchema,
  PathStyleSchema,
} from "./schemas";
export type {
  CanvasObjectParsed,
  PageDataParsed,
  GroupInfoParsed,
  CaptionThreadParsed,
  ViewportParsed,
  CanvasBoundsParsed,
  UserParsed,
  PersistedStateParsed,
} from "./schemas";

// ============================================================================
// Figma Integration (v0.1.0: read/import)
// ============================================================================
export {
  figmaToPigma,
  pigmaToFigma,
  extractLeafNodes,
  hexToFigmaColor,
  figmaColorToHex,
  fetchFile,
  fetchNodes,
  parseFigmaFileUrl,
  FigmaAuthError,
  FigmaNotFoundError,
  FigmaRateLimitError,
} from "./figma";
export type {
  FigmaNode,
  FigmaColor,
  FigmaPaint,
  FigmaTextStyle,
  FigmaBoundingBox,
  FigmaNodeType,
  FigmaFileResponse,
  PigmaShape,
} from "./figma";

// ============================================================================
// Constants
// ============================================================================
export {
  Z_TEXT_INPUT,
  Z_MODAL_BACKDROP,
  Z_MODAL_CONTENT,
  Z_OPTIONS_BAR,
  Z_CONTEXT_MENU,
  Z_CURSOR_CHAT,
  Z_CAPTION_POPUP_BACKDROP,
  Z_CAPTION_POPUP,
  Z_EMOJI_PICKER_BACKDROP,
  Z_EMOJI_PICKER,
  Z_HEADER,
  Z_SHARE_BUTTON,
  Z_UNLOCK_DIALOG,
  Z_CAPTION_PANEL,
  Z_LOCK_OVERLAY,
  Z_LOCK_BADGE,
  Z_TOOLBAR,
  Z_POPOVER,
  Z_ZOOM_CONTROLS,
  Z_FLOATING_UTILITY,
  Z_CANVAS_OVERLAY_BASE,
  Z_SIDE_PANEL,
  Z_DROPDOWN_BACKDROP,
  Z_DROPDOWN_CONTENT,
  getCanvasOverlayZIndex,
  // 옵션바 위치 상수
  OPTIONS_BAR_OFFSET,
  OPTIONS_BAR_HEIGHT,
  OPTIONS_BAR_TOOLBAR_RESERVED,
  OPTIONS_BAR_DROPDOWN_HEIGHT,
  OPTIONS_BAR_WIDTH,
  OPTIONS_BAR_SCREEN_PADDING,
} from "./constants/zIndex";

// ============================================================================
// Zoom Constants
// ============================================================================
export {
  ZOOM_LEVELS_PERCENT,
  ZOOM_LEVELS,
  DEFAULT_ZOOM,
  MIN_ZOOM as ZOOM_MIN,
  MAX_ZOOM as ZOOM_MAX,
  DEFAULT_ZOOM_INDEX,
  zoomIn,
  zoomOut,
  findClosestZoomIndex,
  snapToZoomLevel,
  getZoomPercent,
} from "./constants/zoom";
