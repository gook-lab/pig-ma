import { useState, useEffect, useRef } from "react";
import {
  MousePointer2,
  Hand,
  Square,
  Circle,
  Pencil,
  StickyNote,
  Type,
  MoreHorizontal,
  Lock,
  Unlock,
  Trash2,
  Spline,
  Grid2X2,
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Code,
  Link2,
  ImageIcon,
  Plus,
} from "lucide-react";
import { useCanvasStore, clearHistory } from "@/store";
import { createImage } from "@/utils/factory";
import { cn } from "@/lib/utils";
import type { Tool, PathStyle, ShapeVariant, ElbowCornerStyle } from "@/types";

// Simple shape icon component for favorite shapes in toolbar
// fillColor and strokeColor reflect current shapeSettings for visual preview
function ShapeIcon({
  variant,
  className,
  fillColor,
  strokeColor,
}: {
  variant: ShapeVariant;
  className?: string;
  fillColor?: string;
  strokeColor?: string;
}) {
  const baseClass = cn("w-4 h-4", className);
  const fill = fillColor === "transparent" ? "none" : (fillColor ?? "none");
  const stroke = strokeColor ?? "currentColor";

  switch (variant) {
    case "triangle":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        >
          <path d="M12 3L22 21H2L12 3Z" />
        </svg>
      );
    case "triangleDown":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        >
          <path d="M12 21L2 3H22L12 21Z" />
        </svg>
      );
    case "diamond":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        >
          <path d="M12 2L22 12L12 22L2 12L12 2Z" />
        </svg>
      );
    case "pentagon":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        >
          <path d="M12 2L22 9L18 21H6L2 9L12 2Z" />
        </svg>
      );
    case "hexagon":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        >
          <path d="M12 2L21 7V17L12 22L3 17V7L12 2Z" />
        </svg>
      );
    case "octagon":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        >
          <path d="M8 2H16L22 8V16L16 22H8L2 16V8L8 2Z" />
        </svg>
      );
    case "star":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        >
          <path d="M12 2L14.5 9H22L16 13.5L18.5 21L12 16.5L5.5 21L8 13.5L2 9H9.5L12 2Z" />
        </svg>
      );
    case "star4":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        >
          <path d="M12 2L14 10H22L14 14L12 22L10 14L2 10H10L12 2Z" />
        </svg>
      );
    case "cross":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        >
          <path d="M9 2H15V9H22V15H15V22H9V15H2V9H9V2Z" />
        </svg>
      );
    case "arrowRight":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        >
          <path d="M2 8H14V4L22 12L14 20V16H2V8Z" />
        </svg>
      );
    case "arrowLeft":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        >
          <path d="M22 8H10V4L2 12L10 20V16H22V8Z" />
        </svg>
      );
    case "arrowUp":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        >
          <path d="M8 22V10H4L12 2L20 10H16V22H8Z" />
        </svg>
      );
    case "arrowDown":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        >
          <path d="M8 2V14H4L12 22L20 14H16V2H8Z" />
        </svg>
      );
    case "speechBubble":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        >
          <path d="M3 4H21V16H9L3 22V4Z" />
        </svg>
      );
    case "roundedRect":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        >
          <rect x="3" y="5" width="18" height="14" rx="4" />
        </svg>
      );
    case "ellipse":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        >
          <ellipse cx="12" cy="12" rx="10" ry="6" />
        </svg>
      );
    case "flowProcess":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        >
          <rect x="2" y="6" width="20" height="12" />
        </svg>
      );
    case "flowDecision":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        >
          <path d="M12 2L22 12L12 22L2 12L12 2Z" />
        </svg>
      );
    case "flowTerminal":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        >
          <rect x="2" y="6" width="20" height="12" rx="6" />
        </svg>
      );
    case "flowData":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        >
          <path d="M6 5H22L18 19H2L6 5Z" />
        </svg>
      );
    case "flowDocument":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        >
          <path d="M3 3H21V18C18 16 15 20 12 18C9 16 6 20 3 18V3Z" />
        </svg>
      );
    case "flowDatabase":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
        >
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5V19C3 20.7 7 22 12 22S21 20.7 21 19V5" />
        </svg>
      );
    default:
      return <Square className={baseClass} />;
  }
}

const FILL_COLORS = [
  "#ffffff",
  "#fecaca",
  "#fed7aa",
  "#fef08a",
  "#bbf7d0",
  "#bfdbfe",
  "#e9d5ff",
  "transparent",
];

const STROKE_COLORS = [
  "#374151",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899", // 핑크 - Fill과 개수 맞춤 (8개)
];

// Default shape icons with fill/stroke support
function RectangleIcon({
  className,
  fillColor,
  strokeColor,
}: {
  className?: string;
  fillColor?: string;
  strokeColor?: string;
}) {
  const fill = fillColor === "transparent" ? "none" : (fillColor ?? "none");
  const stroke = strokeColor ?? "currentColor";
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth="1.5"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  );
}

function CircleIcon({
  className,
  fillColor,
  strokeColor,
}: {
  className?: string;
  fillColor?: string;
  strokeColor?: string;
}) {
  const fill = fillColor === "transparent" ? "none" : (fillColor ?? "none");
  const stroke = strokeColor ?? "currentColor";
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth="1.5"
    >
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

// Shape options (rectangle only - stickyNote and textBox are top-level)
type ShapeOption = { id: Tool; variant: "rectangle"; label: string };
const shapeOptions: ShapeOption[] = [
  { id: "rectangle", variant: "rectangle", label: "사각형" },
];

// Custom SVG Icons for path styles (same as ConnectorOptionsBar)
const StraightLineIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    className={className}
  >
    <path
      fill="currentColor"
      fillOpacity=".9"
      fillRule="evenodd"
      d="M23.59.146c.195.196.195.512 0 .708L.854 23.59c-.196.195-.512.195-.708 0-.195-.195-.195-.512 0-.707L22.883.146c.195-.195.512-.195.707 0"
      clipRule="evenodd"
    />
  </svg>
);

const StraightArrowIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    className={className}
  >
    <path
      fill="currentColor"
      fillOpacity=".9"
      fillRule="evenodd"
      stroke="currentColor"
      strokeWidth="0.5"
      d="M16.92 0c-.275 0-.5.224-.5.5 0 .276.225.5.5.5h5.11L.146 22.883c-.195.196-.195.512 0 .707.196.196.512.196.708 0L22.737 1.707v5.109c0 .276.224.5.5.5.276 0 .5-.224.5-.5V.497c-.002-.275-.225-.497-.5-.497z"
      clipRule="evenodd"
    />
  </svg>
);

const ElbowSharpIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="22"
    viewBox="0 0 22 26"
    className={className}
  >
    <path
      fill="currentColor"
      fillOpacity=".9"
      fillRule="evenodd"
      stroke="currentColor"
      strokeWidth="0.3"
      d="M17.236.646c.196-.195.512-.195.707 0l3.7 3.7c.412.412.412 1.079 0 1.49l-3.7 3.7c-.195.195-.511.195-.707 0-.195-.195-.195-.512 0-.707l3.237-3.237h-6.06c-1.556 0-2.818 1.262-2.818 2.818v13.272c0 2.109-1.709 3.818-3.818 3.818H1c-.276 0-.5-.224-.5-.5 0-.276.224-.5.5-.5h6.777c1.557 0 2.818-1.262 2.818-2.818V8.41c0-2.109 1.71-3.818 3.818-3.818h6.062l-3.239-3.238c-.195-.196-.195-.512 0-.708Z"
      clipRule="evenodd"
    />
  </svg>
);

const ElbowRoundedIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="22"
    viewBox="0 0 25 26"
    className={className}
  >
    <path
      fill="currentColor"
      d="M19.598.594c-.225-.161-.537-.11-.698.115-.16.224-.11.537.115.697zm4.147 3.585.29-.407zm.103.942-.378-.328zm-4.009 3.86c-.18.208-.158.524.05.705.209.18.525.158.706-.05zM1 24.5c-.276 0-.5.224-.5.5 0 .276.224.5.5.5zM19.015 1.406l4.438 3.18.583-.814L19.598.594zm4.455 3.387L19.839 8.98l.756.656 3.63-4.188zm-.017-.208c.017.012.04.042.046.094.006.053-.01.093-.03.114l.756.655c.428-.493.35-1.29-.19-1.676zM1 25.5c3.66 0 5.942-1.316 7.526-3.318 1.548-1.955 2.412-4.552 3.32-7.02.924-2.51 1.898-4.916 3.635-6.708 1.712-1.765 4.21-2.976 8.282-2.976v-1c-4.297 0-7.07 1.29-9 3.28-1.903 1.963-2.937 4.562-3.855 7.058-.933 2.537-1.742 4.946-3.166 6.745C6.356 23.313 4.37 24.5 1 24.5z"
    />
  </svg>
);

// Connector path style options (4 options: straight, straightArrow, elbowSharp, elbowRounded)
interface ConnectorPathOption {
  id: string;
  pathStyle: PathStyle;
  elbowCornerStyle?: ElbowCornerStyle;
  setArrow?: boolean;
  icon: React.FC<{ className?: string }>;
  label: string;
}

const connectorPathOptions: ConnectorPathOption[] = [
  {
    id: "straight",
    pathStyle: "straight",
    icon: StraightLineIcon,
    label: "직선",
  },
  {
    id: "straightArrow",
    pathStyle: "straight",
    setArrow: true,
    icon: StraightArrowIcon,
    label: "화살표",
  },
  {
    id: "elbowedSharp",
    pathStyle: "elbowed",
    elbowCornerStyle: "sharp",
    icon: ElbowSharpIcon,
    label: "꺾인선 (직각)",
  },
  {
    id: "elbowedRounded",
    pathStyle: "elbowed",
    elbowCornerStyle: "rounded",
    icon: ElbowRoundedIcon,
    label: "꺾인선 (둥근)",
  },
];

export function Toolbar() {
  const {
    tool,
    setTool,
    shapeSettings,
    setShapeSettings,
    setShowShapesPanel,
    isLocked,
    toggleLock,
    clearAllObjects,
    objects,
    clearSelection,
    connectorPathStyle,
    setConnectorPathStyle,
    connectorElbowCornerStyle,
    setConnectorElbowCornerStyle,
    connectorDefaultEndMarker,
    setConnectorDefaultEndMarker,
    favoriteShapes,
    setSelectedShapeVariant,
    addRecentShape,
    selectedShapeVariant,
    selectedIds,
    stickyNoteColor,
    setStickyNoteColor,
    hideUI,
    selectedChartVariant,
    setSelectedChartVariant,
  } = useCanvasStore();
  const [showShapePopover, setShowShapePopover] = useState(false);
  const [showConnectorPopover, setShowConnectorPopover] = useState(false);
  const [showStickyNotePopover, setShowStickyNotePopover] = useState(false);
  const [showChartPopover, setShowChartPopover] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showChartSub, setShowChartSub] = useState(false);
  const [hoveredSector, setHoveredSector] = useState<number | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Close popovers when objects are selected on canvas
  useEffect(() => {
    if (selectedIds.length > 0) {
      closeAllPopovers();
    }
  }, [selectedIds]);

  // Close popovers on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowShapePopover(false);
        setShowConnectorPopover(false);
        setShowStickyNotePopover(false);
        setShowChartPopover(false);
        setShowMoreMenu(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close more menu on outside click
  useEffect(() => {
    if (!showMoreMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(e.target as Node)
      ) {
        setShowMoreMenu(false);
      }
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [showMoreMenu]);

  // Get first 3 favorite shapes to show in toolbar
  const toolbarFavorites = favoriteShapes.slice(0, 3);

  // Check if current tool is a shape tool (including 'shape' for variants)
  const isShapeTool =
    shapeOptions.some((s) => s.id === tool) || tool === "shape";
  const currentShapeVariant = (shapeOptions.find((s) => s.id === tool)
    ?.variant ?? "rectangle") as "rectangle" | "circle";

  // Close all popovers helper
  const closeAllPopovers = () => {
    setShowShapePopover(false);
    setShowConnectorPopover(false);
    setShowStickyNotePopover(false);
    setShowChartPopover(false);
    setShowMoreMenu(false);
    setShowChartSub(false);
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("이미지는 10MB 이하만 가능합니다.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        const maxDim = 400;
        if (width > maxDim || height > maxDim) {
          const ratio = maxDim / Math.max(width, height);
          width *= ratio;
          height *= ratio;
        }
        const { viewport } = useCanvasStore.getState();
        const centerX =
          (window.innerWidth / 2 - viewport.x) / viewport.zoom - width / 2;
        const centerY =
          (window.innerHeight / 2 - viewport.y) / viewport.zoom - height / 2;
        const imageObj = createImage(centerX, centerY, src, width, height);
        useCanvasStore.getState().addObject(imageObj);
        useCanvasStore.getState().setSelectedIds([imageObj.id]);
        useCanvasStore.getState().setTool("select");
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleShapeSelect = (shapeId: Tool) => {
    setTool(shapeId);
    // Clear selection when changing to a drawing tool
    if (shapeId !== "select") {
      clearSelection();
    }
    // Keep popover open for all shape tools (color options hidden for connector)
  };

  // Handle favorite shape selection
  const handleFavoriteShapeSelect = (variant: ShapeVariant) => {
    setTool("shape");
    setSelectedShapeVariant(variant);
    addRecentShape(variant);
    clearSelection();
  };

  // Hide UI mode - hide toolbar
  if (hideUI) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
        {/* Unified Shape + Color Popover */}
        {showShapePopover && (
          <div
            className={cn(
              "popover-enter flex flex-col gap-3 px-4 py-3",
              "rounded-xl border border-gray-200 bg-white shadow-lg",
              "dark:border-[#c0c1c4] dark:bg-[#d6d7da]",
            )}
          >
            {/* Shape Selection Row */}
            <div className="flex items-center gap-1">
              {/* Default shapes: Rectangle, Circle - with fill/stroke colors */}
              {shapeOptions.map(({ id, variant, label }) => (
                <button
                  key={id}
                  onClick={() => handleShapeSelect(id)}
                  className={cn(
                    "rounded-lg border-2 p-2 transition-all",
                    tool === id
                      ? "border-violet-500 bg-violet-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                  )}
                  title={label}
                >
                  {variant === "rectangle" ? (
                    <RectangleIcon
                      className="h-4 w-4"
                      fillColor={shapeSettings.fillColor}
                      strokeColor={shapeSettings.strokeColor}
                    />
                  ) : (
                    <CircleIcon
                      className="h-4 w-4"
                      fillColor={shapeSettings.fillColor}
                      strokeColor={shapeSettings.strokeColor}
                    />
                  )}
                </button>
              ))}
              {/* Favorite shapes (max 3) - show with current fill/stroke colors */}
              {toolbarFavorites.map((variant) => (
                <button
                  key={variant}
                  onClick={() => handleFavoriteShapeSelect(variant)}
                  className={cn(
                    "rounded-lg border-2 p-2 transition-all",
                    tool === "shape" && selectedShapeVariant === variant
                      ? "border-violet-500 bg-violet-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                  )}
                  title={variant}
                >
                  <ShapeIcon
                    variant={variant}
                    fillColor={shapeSettings.fillColor}
                    strokeColor={shapeSettings.strokeColor}
                  />
                </button>
              ))}
              {/* Divider */}
              <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-600" />
              {/* More Shapes Button - keeps popover open */}
              <button
                onClick={() => {
                  setShowShapesPanel(true);
                  // Keep popover open when More Shapes is clicked
                }}
                className={cn(
                  "rounded-lg p-2.5 transition-all",
                  "hover:bg-gray-100",
                )}
                title="더 많은 도형"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>

            {/* Color Selection - always visible for quick shape creation */}
            <>
              {/* Divider */}
              <div className="h-px bg-gray-200 dark:bg-gray-600" />

              {/* Fill Color */}
              <div className="flex items-center gap-3">
                <span className="w-10 text-xs text-gray-500">Fill</span>
                <div className="flex gap-1">
                  {FILL_COLORS.map((color) => (
                    <button
                      key={`fill-${color}`}
                      onClick={() => setShapeSettings({ fillColor: color })}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition-transform",
                        shapeSettings.fillColor === color
                          ? "scale-110 border-violet-500"
                          : "border-gray-300 hover:scale-105",
                      )}
                      style={{
                        backgroundColor:
                          color === "transparent" ? "#fff" : color,
                        backgroundImage:
                          color === "transparent"
                            ? "linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)"
                            : undefined,
                        backgroundSize:
                          color === "transparent" ? "6px 6px" : undefined,
                        backgroundPosition:
                          color === "transparent" ? "0 0, 3px 3px" : undefined,
                      }}
                      title={color === "transparent" ? "투명" : color}
                    />
                  ))}
                </div>
              </div>

              {/* Stroke Color */}
              <div className="flex items-center gap-3">
                <span className="w-10 text-xs text-gray-500">Stroke</span>
                <div className="flex gap-1">
                  {STROKE_COLORS.map((color) => (
                    <button
                      key={`stroke-${color}`}
                      onClick={() => setShapeSettings({ strokeColor: color })}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition-transform",
                        shapeSettings.strokeColor === color
                          ? "scale-110 ring-2 ring-violet-400 ring-offset-1"
                          : "hover:scale-105",
                      )}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </>
          </div>
        )}

        {/* Connector Path Style Popover */}
        {showConnectorPopover && (
          <div
            className={cn(
              "popover-enter flex items-center gap-1 px-3 py-2",
              "rounded-xl border border-gray-200 bg-white shadow-lg",
              "dark:border-[#c0c1c4] dark:bg-[#d6d7da]",
            )}
          >
            {connectorPathOptions.map((option) => {
              const Icon = option.icon;
              // Calculate if this option is currently selected
              const isStraightMatch =
                option.pathStyle === "straight" &&
                connectorPathStyle === "straight" &&
                (option.setArrow
                  ? connectorDefaultEndMarker !== "none"
                  : connectorDefaultEndMarker === "none");
              const isElbowMatch =
                option.pathStyle === "elbowed" &&
                connectorPathStyle === "elbowed" &&
                connectorElbowCornerStyle === option.elbowCornerStyle;
              const isSelected = isStraightMatch || isElbowMatch;
              return (
                <button
                  key={option.id}
                  onClick={() => {
                    setConnectorPathStyle(option.pathStyle);
                    if (option.elbowCornerStyle) {
                      setConnectorElbowCornerStyle(option.elbowCornerStyle);
                    }
                    // Set default end marker based on option
                    setConnectorDefaultEndMarker(
                      option.setArrow ? "arrow" : "none",
                    );
                    setTool("connector");
                  }}
                  className={cn(
                    "rounded-lg p-2.5 transition-all",
                    "hover:bg-gray-100",
                    isSelected && "bg-violet-100 ring-2 ring-violet-500",
                  )}
                  title={option.label}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        )}

        {/* Chart Variant Popover */}
        {showChartPopover && (
          <div
            className={cn(
              "popover-enter flex items-center gap-1 px-3 py-2",
              "rounded-xl border border-gray-200 bg-white shadow-lg",
              "dark:border-[#c0c1c4] dark:bg-[#d6d7da]",
            )}
          >
            <button
              onClick={() => {
                setSelectedChartVariant("bar");
                setTool("chart");
                setShowChartPopover(false);
              }}
              className={cn(
                "rounded-lg p-2.5 transition-all",
                "hover:bg-gray-100",
                selectedChartVariant === "bar" &&
                  "bg-violet-100 ring-2 ring-violet-500",
              )}
              title="Bar Chart"
            >
              <BarChart3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setSelectedChartVariant("line");
                setTool("chart");
                setShowChartPopover(false);
              }}
              className={cn(
                "rounded-lg p-2.5 transition-all",
                "hover:bg-gray-100",
                selectedChartVariant === "line" &&
                  "bg-violet-100 ring-2 ring-violet-500",
              )}
              title="Line Chart"
            >
              <TrendingUp className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setSelectedChartVariant("pie");
                setTool("chart");
                setShowChartPopover(false);
              }}
              className={cn(
                "rounded-lg p-2.5 transition-all",
                "hover:bg-gray-100",
                selectedChartVariant === "pie" &&
                  "bg-violet-100 ring-2 ring-violet-500",
              )}
              title="Pie Chart"
            >
              <PieChartIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Main Toolbar */}
        <div
          className={cn(
            "flex h-12 items-center gap-1 px-3",
            "rounded-xl border border-gray-200 bg-white shadow-lg",
            "dark:border-[#c0c1c4] dark:bg-[#d6d7da]",
          )}
        >
          {/* Select */}
          <button
            onClick={() => {
              if (isLocked) return;
              setTool("select");
              closeAllPopovers();
            }}
            className={cn(
              "rounded-lg p-2.5 transition-colors",
              isLocked ? "cursor-not-allowed opacity-40" : "hover:bg-gray-100",
              !isLocked &&
                !showMoreMenu &&
                tool === "select" &&
                "bg-primary hover:bg-primary text-white",
            )}
            disabled={isLocked}
            title="선택 (V)"
          >
            <MousePointer2 className="h-4 w-4" />
          </button>

          {/* Hand (Pan) - Always enabled even when locked */}
          <button
            onClick={() => {
              setTool("hand");
              clearSelection();
              closeAllPopovers();
            }}
            className={cn(
              "rounded-lg p-2.5 transition-colors",
              "hover:bg-gray-100",
              tool === "hand" && "bg-primary hover:bg-primary text-white",
            )}
            title="이동 (H)"
          >
            <Hand className="h-4 w-4" />
          </button>

          {/* Divider */}
          <div className="mx-1 h-8 w-px bg-gray-200 dark:bg-gray-600" />

          {/* Pencil */}
          <button
            onClick={() => {
              if (isLocked) return;
              setTool("pencil");
              clearSelection();
              closeAllPopovers();
            }}
            className={cn(
              "rounded-lg p-2.5 transition-colors",
              isLocked ? "cursor-not-allowed opacity-40" : "hover:bg-gray-100",
              !isLocked &&
                tool === "pencil" &&
                "bg-primary hover:bg-primary text-white",
            )}
            disabled={isLocked}
            title="펜 (P)"
          >
            <Pencil className="h-4 w-4" />
          </button>

          {/* Unified Shape Selector */}
          <button
            onClick={() => {
              if (isLocked) return;
              if (!isShapeTool) {
                setTool("rectangle");
                clearSelection();
              }
              setShowConnectorPopover(false);
              setShowStickyNotePopover(false);
              setShowShapePopover((prev) => !prev);
            }}
            className={cn(
              "flex items-center gap-1 rounded-lg p-2.5 transition-colors",
              isLocked ? "cursor-not-allowed opacity-40" : "hover:bg-gray-100",
              !isLocked &&
                isShapeTool &&
                "bg-primary hover:bg-primary text-white",
            )}
            disabled={isLocked}
            title="도형"
          >
            {currentShapeVariant === "rectangle" ? (
              <Square className="h-4 w-4" />
            ) : (
              <Circle className="h-4 w-4" />
            )}
            <svg className="h-2 w-2" viewBox="0 0 8 8" fill="currentColor">
              <path d="M4 6L1 2h6L4 6z" />
            </svg>
          </button>

          {/* Sticky Note with color popover */}
          <div className="relative">
            {showStickyNotePopover && (
              <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2">
                <div className="popover-enter flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg">
                  {[
                    "#fef08a", // yellow
                    "#fecaca", // pink/red
                    "#bbf7d0", // green
                    "#bfdbfe", // blue
                    "#e9d5ff", // purple
                    "#fed7aa", // orange
                  ].map((color) => (
                    <button
                      key={color}
                      onClick={() => setStickyNoteColor(color)}
                      className={cn(
                        "h-7 w-7 rounded-lg border-2 transition-all",
                        stickyNoteColor === color
                          ? "scale-110 border-violet-500"
                          : "border-gray-200 hover:scale-105 hover:border-gray-300",
                      )}
                      style={{ backgroundColor: color }}
                      title="메모지 색상"
                    />
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={() => {
                if (isLocked) return;
                setTool("stickyNote");
                clearSelection();
                setShowShapePopover(false);
                setShowConnectorPopover(false);
                setShowStickyNotePopover((prev) => !prev);
              }}
              className={cn(
                "rounded-lg p-2.5 transition-colors",
                isLocked
                  ? "cursor-not-allowed opacity-40"
                  : "hover:bg-gray-100",
                !isLocked &&
                  tool === "stickyNote" &&
                  "bg-primary hover:bg-primary text-white",
              )}
              disabled={isLocked}
              title="메모지 (S)"
            >
              <StickyNote
                className="h-4 w-4"
                fill={stickyNoteColor}
                strokeWidth={1.5}
              />
            </button>
          </div>

          {/* TextBox - Top level */}
          <button
            onClick={() => {
              if (isLocked) return;
              setTool("textBox");
              clearSelection();
              closeAllPopovers();
            }}
            className={cn(
              "rounded-lg p-2.5 transition-colors",
              isLocked ? "cursor-not-allowed opacity-40" : "hover:bg-gray-100",
              !isLocked &&
                tool === "textBox" &&
                "bg-primary hover:bg-primary text-white",
            )}
            disabled={isLocked}
            title="텍스트 (T)"
          >
            <Type className="h-4 w-4" />
          </button>

          {/* More menu — Table, Chart, Code Block, Embed, Image */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => {
                if (isLocked) return;
                setShowShapePopover(false);
                setShowConnectorPopover(false);
                setShowStickyNotePopover(false);
                setShowChartPopover(false);
                const opening = !showMoreMenu;
                setShowMoreMenu(opening);
                if (opening) {
                  setTool("select");
                  clearSelection();
                }
              }}
              className={cn(
                "rounded-lg p-2.5 transition-colors",
                isLocked
                  ? "cursor-not-allowed opacity-40"
                  : "hover:bg-gray-100",
                !isLocked &&
                  showMoreMenu &&
                  "bg-primary hover:bg-primary text-white",
                !isLocked &&
                  !showMoreMenu &&
                  (tool === "table" ||
                    tool === "chart" ||
                    tool === "codeBlock" ||
                    tool === "embed") &&
                  "bg-primary hover:bg-primary text-white",
              )}
              disabled={isLocked}
              title="더보기 (Table, Chart, Code, Embed, Image)"
            >
              <Plus className="h-4 w-4" />
            </button>
            {/* Radial circle menu — FigJam style with pie sectors */}
            {showMoreMenu &&
              (() => {
                const items = [
                  {
                    icon: <Grid2X2 className="h-5 w-5" />,
                    label: "Table",
                    tool: "table" as Tool,
                    isChart: false,
                    action: () => {
                      setTool("table");
                      clearSelection();
                      setShowMoreMenu(false);
                      setShowChartSub(false);
                    },
                  },
                  {
                    icon:
                      selectedChartVariant === "pie" ? (
                        <PieChartIcon className="h-5 w-5" />
                      ) : selectedChartVariant === "line" ? (
                        <TrendingUp className="h-5 w-5" />
                      ) : (
                        <BarChart3 className="h-5 w-5" />
                      ),
                    label: "Chart",
                    tool: "chart" as Tool,
                    isChart: true,
                    action: () => {
                      setShowChartSub((prev) => !prev);
                    },
                  },
                  {
                    icon: <Code className="h-5 w-5" />,
                    label: "Code",
                    tool: "codeBlock" as Tool,
                    isChart: false,
                    action: () => {
                      setTool("codeBlock");
                      clearSelection();
                      setShowMoreMenu(false);
                      setShowChartSub(false);
                    },
                  },
                  {
                    icon: <Link2 className="h-5 w-5" />,
                    label: "Embed",
                    tool: "embed" as Tool,
                    isChart: false,
                    action: () => {
                      setTool("embed");
                      clearSelection();
                      setShowMoreMenu(false);
                      setShowChartSub(false);
                    },
                  },
                  {
                    icon: <ImageIcon className="h-5 w-5" />,
                    label: "Image",
                    tool: undefined as Tool | undefined,
                    isChart: false,
                    action: () => {
                      imageInputRef.current?.click();
                      setShowMoreMenu(false);
                      setShowChartSub(false);
                    },
                  },
                ];
                const n = items.length;
                const size = 240;
                const cx = size / 2;
                const cy = size / 2;
                const outerR = size / 2 - 4;
                const innerR = 36;
                const iconR = (outerR + innerR) / 2;

                // SVG arc helper
                const polarToXY = (r: number, angleDeg: number) => ({
                  x: cx + r * Math.cos((angleDeg * Math.PI) / 180),
                  y: cy + r * Math.sin((angleDeg * Math.PI) / 180),
                });

                const sectorPath = (startDeg: number, endDeg: number) => {
                  const oa = polarToXY(outerR, startDeg);
                  const ob = polarToXY(outerR, endDeg);
                  const ib = polarToXY(innerR, endDeg);
                  const ia = polarToXY(innerR, startDeg);
                  const large = endDeg - startDeg > 180 ? 1 : 0;
                  return [
                    `M ${oa.x} ${oa.y}`,
                    `A ${outerR} ${outerR} 0 ${large} 1 ${ob.x} ${ob.y}`,
                    `L ${ib.x} ${ib.y}`,
                    `A ${innerR} ${innerR} 0 ${large} 0 ${ia.x} ${ia.y}`,
                    "Z",
                  ].join(" ");
                };

                return (
                  <div
                    className="radial-menu-enter absolute bottom-full left-1/2 mb-3"
                    style={{ transform: "translateX(-50%)" }}
                  >
                    <div
                      className="relative"
                      style={{ width: size, height: size }}
                    >
                      <svg
                        width={size}
                        height={size}
                        className="absolute inset-0 drop-shadow-xl"
                      >
                        {/* Outer circle fill */}
                        <circle cx={cx} cy={cy} r={outerR} fill="white" />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={outerR}
                          fill="none"
                          stroke="#e5e7eb"
                          strokeWidth="1"
                        />
                        {/* Pie sector hover areas */}
                        {items.map((item, i) => {
                          const gap = 1.5;
                          const startDeg = (i / n) * 360 - 90 + gap;
                          const endDeg = ((i + 1) / n) * 360 - 90 - gap;
                          const isActive = item.tool && tool === item.tool;
                          return (
                            <path
                              key={`sector-${item.label}`}
                              d={sectorPath(startDeg, endDeg)}
                              fill={
                                isActive || hoveredSector === i
                                  ? "rgba(124, 58, 237, 0.07)"
                                  : "transparent"
                              }
                              stroke="none"
                              className="cursor-pointer transition-colors duration-150"
                              onClick={item.action}
                              onMouseEnter={() => setHoveredSector(i)}
                              onMouseLeave={() => setHoveredSector(null)}
                            />
                          );
                        })}
                        {/* Sector divider lines */}
                        {items.map((_, i) => {
                          const angleDeg = (i / n) * 360 - 90;
                          const inner = polarToXY(innerR + 2, angleDeg);
                          const outer = polarToXY(outerR - 2, angleDeg);
                          return (
                            <line
                              key={`line-${i}`}
                              x1={inner.x}
                              y1={inner.y}
                              x2={outer.x}
                              y2={outer.y}
                              stroke="#e5e7eb"
                              strokeWidth="1"
                            />
                          );
                        })}
                        {/* Inner circle */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={innerR}
                          fill="white"
                          stroke="#e5e7eb"
                          strokeWidth="1"
                        />
                      </svg>
                      {/* Center + icon */}
                      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <Plus className="h-5 w-5 text-gray-300" />
                      </div>
                      {/* Icon + label overlays */}
                      {items.map((item, i) => {
                        const midDeg = ((i + 0.5) / n) * 360 - 90;
                        const pos = polarToXY(iconR, midDeg);
                        const isActive = item.tool && tool === item.tool;
                        const isHovered = hoveredSector === i;

                        return (
                          <div
                            key={item.label}
                            className="pointer-events-none absolute flex flex-col items-center"
                            style={{
                              left: pos.x - 20,
                              top: pos.y - 18,
                              width: 40,
                            }}
                          >
                            <button
                              onClick={item.action}
                              onMouseEnter={() => setHoveredSector(i)}
                              onMouseLeave={() => setHoveredSector(null)}
                              className={cn(
                                "pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full transition-all duration-150",
                                isHovered && "scale-125",
                                isActive || isHovered
                                  ? "text-primary"
                                  : item.isChart && showChartSub
                                    ? "text-primary"
                                    : "text-gray-600",
                              )}
                            >
                              {item.icon}
                            </button>
                            <span
                              className={cn(
                                "text-[9px] leading-none font-medium transition-colors duration-150",
                                isActive || isHovered
                                  ? "text-primary"
                                  : "text-gray-400",
                              )}
                            >
                              {item.label}
                            </span>

                            {/* Chart sub-menu */}
                            {item.isChart && showChartSub && (
                              <div className="radial-menu-enter pointer-events-auto absolute bottom-full left-1/2 mb-1 flex -translate-x-1/2 gap-1 rounded-lg bg-white p-1.5 shadow-lg ring-1 ring-gray-200">
                                {(
                                  [
                                    {
                                      variant: "bar",
                                      icon: <BarChart3 className="h-4 w-4" />,
                                      label: "Bar",
                                    },
                                    {
                                      variant: "line",
                                      icon: <TrendingUp className="h-4 w-4" />,
                                      label: "Line",
                                    },
                                    {
                                      variant: "pie",
                                      icon: (
                                        <PieChartIcon className="h-4 w-4" />
                                      ),
                                      label: "Pie",
                                    },
                                  ] as const
                                ).map((chart) => (
                                  <button
                                    key={chart.variant}
                                    onClick={() => {
                                      setSelectedChartVariant(chart.variant);
                                      setTool("chart");
                                      clearSelection();
                                      setShowMoreMenu(false);
                                      setShowChartSub(false);
                                    }}
                                    className={cn(
                                      "flex flex-col items-center gap-0.5 rounded-md px-2.5 py-1.5 transition-colors",
                                      selectedChartVariant === chart.variant
                                        ? "bg-primary text-white"
                                        : "text-gray-600 hover:bg-gray-100",
                                    )}
                                  >
                                    {chart.icon}
                                    <span className="text-[9px] font-medium">
                                      {chart.label}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageFileSelect}
          />

          {/* Connector with path style popover */}
          <button
            onClick={() => {
              if (isLocked) return;
              setTool("connector");
              clearSelection();
              setShowShapePopover(false);
              setShowStickyNotePopover(false);
              setShowConnectorPopover((prev) => !prev);
            }}
            className={cn(
              "flex items-center gap-1 rounded-lg p-2.5 transition-colors",
              isLocked ? "cursor-not-allowed opacity-40" : "hover:bg-gray-100",
              !isLocked &&
                tool === "connector" &&
                "bg-primary hover:bg-primary text-white",
            )}
            disabled={isLocked}
            title="연결선 (L)"
          >
            {/* Show current connector path style icon */}
            {connectorPathStyle === "straight" && (
              <StraightArrowIcon className="h-4 w-4" />
            )}
            {connectorPathStyle === "elbowed" &&
              connectorElbowCornerStyle === "sharp" && (
                <ElbowSharpIcon className="h-4 w-4" />
              )}
            {connectorPathStyle === "elbowed" &&
              connectorElbowCornerStyle === "rounded" && (
                <ElbowRoundedIcon className="h-4 w-4" />
              )}
            {connectorPathStyle === "curved" && <Spline className="h-4 w-4" />}
            <svg className="h-2 w-2" viewBox="0 0 8 8" fill="currentColor">
              <path d="M4 6L1 2h6L4 6z" />
            </svg>
          </button>

          {/* Divider */}
          <div className="mx-1 h-8 w-px bg-gray-200 dark:bg-gray-600" />

          {/* Reset */}
          <button
            onClick={() => {
              if (objects.length > 0) {
                setShowResetConfirm(true);
              }
            }}
            className={cn(
              "rounded-lg p-2.5 transition-colors",
              objects.length === 0
                ? "cursor-not-allowed opacity-40"
                : "hover:bg-gray-100 hover:text-red-500",
            )}
            disabled={objects.length === 0}
            title="전체 삭제"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          {/* Divider */}
          <div className="mx-1 h-8 w-px bg-gray-200 dark:bg-gray-600" />

          {/* Lock/Unlock */}
          <button
            onClick={() => {
              if (isLocked) {
                window.dispatchEvent(new CustomEvent("canvas-unlock-request"));
              } else {
                toggleLock();
                clearSelection();
                closeAllPopovers();
                setTool("hand");
              }
            }}
            className={cn(
              "rounded-lg p-2.5 transition-colors",
              "hover:bg-gray-100",
              isLocked && "bg-amber-500 text-white hover:bg-amber-600",
            )}
            title={isLocked ? "잠금 해제 (Cmd+L)" : "화면 잠금 (Cmd+L)"}
          >
            {isLocked ? (
              <Lock className="h-4 w-4" />
            ) : (
              <Unlock className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Reset Confirmation Dialog - outside toolbar container */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="animate-in fade-in zoom-in-95 w-[320px] max-w-[calc(100vw-32px)] rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">
                캔버스 초기화
              </h3>
              <p className="mb-6 text-sm text-gray-500">
                모든 객체가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
              </p>
              <div className="flex w-full gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    clearAllObjects();
                    clearHistory(); // Undo/Redo 스택 초기화
                    setTool("select");
                    setShowResetConfirm(false);
                  }}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
