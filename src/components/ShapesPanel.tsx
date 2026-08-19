import { useState, useMemo, lazy, Suspense, memo } from "react";
import {
  X,
  Search,
  ChevronDown,
  ChevronUp,
  Star,
  Clock,
  Lock,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { useCanvasStore, DEFAULT_FAVORITE_SHAPES } from "@/store";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { ShapeVariant } from "@/types";

const MAX_FAVORITES = 3;

interface ShapeDefinition {
  id: ShapeVariant;
  label: string;
  icon: React.ReactNode;
}

interface ShapeCategory {
  id: string;
  label: string;
  shapes: ShapeDefinition[];
}

// ============================================================================
// Lazy Loading Shape Icons (Progressive Disclosure Pattern)
// ============================================================================

// Lazy load icon components by category
const BasicShapeIconModule = lazy(() =>
  import("./shapes/icons/BasicShapeIcons").then((m) => ({
    default: m.BasicShapeIcon,
  })),
);

const FlowchartShapeIconModule = lazy(() =>
  import("./shapes/icons/FlowchartShapeIcons").then((m) => ({
    default: m.FlowchartShapeIcon,
  })),
);

// Icon loading placeholder
const IconSkeleton = memo(function IconSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn("flex h-8 w-8 items-center justify-center", className)}>
      <Loader2 className="h-4 w-4 animate-spin text-gray-300" />
    </div>
  );
});

// Flowchart shape variants for categorization
const FLOWCHART_VARIANTS = new Set([
  "flowProcess",
  "flowDecision",
  "flowTerminal",
  "flowData",
  "flowDocument",
  "flowDatabase",
  "flowPredefined",
  "flowManualInput",
  "flowPreparation",
  "flowDelay",
  "flowOr",
  "flowSumming",
]);

/**
 * ShapeIcon with lazy loading
 * 카테고리에 따라 적절한 아이콘 모듈을 로드합니다.
 */
const ShapeIcon = memo(function ShapeIcon({
  variant,
  className,
}: {
  variant: ShapeVariant;
  className?: string;
}) {
  const isFlowchart = FLOWCHART_VARIANTS.has(variant);

  return (
    <Suspense fallback={<IconSkeleton className={className} />}>
      {isFlowchart ? (
        <FlowchartShapeIconModule variant={variant} className={className} />
      ) : (
        <BasicShapeIconModule variant={variant} className={className} />
      )}
    </Suspense>
  );
});

const SHAPE_CATEGORIES: ShapeCategory[] = [
  {
    id: "basic",
    label: "Basic",
    shapes: [
      // rectangle and circle are excluded - they are default tools in toolbar
      { id: "triangle", label: "삼각형", icon: null },
      { id: "diamond", label: "마름모", icon: null },
      { id: "pentagon", label: "오각형", icon: null },
      { id: "hexagon", label: "육각형", icon: null },
      { id: "triangleDown", label: "역삼각형", icon: null },
      { id: "ellipse", label: "타원", icon: null },
      { id: "cross", label: "십자", icon: null },
      { id: "arrowLeft", label: "왼쪽 화살표", icon: null },
      { id: "arrowRight", label: "오른쪽 화살표", icon: null },
      { id: "chevronRight", label: "펜턴", icon: null },
      { id: "star", label: "별", icon: null },
      { id: "speechBubble", label: "말풍선", icon: null },
    ],
  },
  {
    id: "flowchart",
    label: "Flowchart",
    shapes: [
      { id: "flowProcess", label: "프로세스", icon: null },
      { id: "flowTerminal", label: "터미널", icon: null },
      { id: "flowDecision", label: "결정", icon: null },
      { id: "flowDatabase", label: "데이터베이스", icon: null },
      { id: "flowDocument", label: "문서", icon: null },
      { id: "flowData", label: "데이터", icon: null },
      { id: "flowPredefined", label: "서브프로세스", icon: null },
      { id: "flowManualInput", label: "수동 입력", icon: null },
      { id: "flowPreparation", label: "준비", icon: null },
      { id: "flowDelay", label: "지연", icon: null },
      { id: "flowOr", label: "OR", icon: null },
      { id: "flowSumming", label: "합계", icon: null },
    ],
  },
];

export function ShapesPanel() {
  const {
    showShapesPanel,
    setShowShapesPanel,
    selectedShapeVariant,
    setSelectedShapeVariant,
    setTool,
    recentShapes,
    addRecentShape,
    favoriteShapes,
    toggleFavoriteShape,
  } = useCanvasStore();
  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({
    favorites: true,
    recent: true,
    basic: true,
    flowchart: true,
  });

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return SHAPE_CATEGORIES;

    const searchLower = search.toLowerCase();
    return SHAPE_CATEGORIES.map((category) => ({
      ...category,
      shapes: category.shapes.filter(
        (shape) =>
          shape.label.toLowerCase().includes(searchLower) ||
          shape.id.toLowerCase().includes(searchLower),
      ),
    })).filter((category) => category.shapes.length > 0);
  }, [search]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const handleShapeSelect = (variant: ShapeVariant) => {
    setSelectedShapeVariant(variant);
    setTool("shape");
    addRecentShape(variant);
  };

  const handleToggleFavorite = (e: React.MouseEvent, variant: ShapeVariant) => {
    e.stopPropagation();
    // Check if trying to add when already at max
    if (
      !favoriteShapes.includes(variant) &&
      favoriteShapes.length >= MAX_FAVORITES
    ) {
      toast("즐겨찾기는 최대 3개까지 가능합니다", {
        duration: 2000,
        position: "bottom-center",
        icon: "⭐",
      });
      return;
    }
    toggleFavoriteShape(variant);
  };

  // Get shape label from categories
  const getShapeLabel = (variant: ShapeVariant): string => {
    for (const category of SHAPE_CATEGORIES) {
      const shape = category.shapes.find((s) => s.id === variant);
      if (shape) return shape.label;
    }
    return variant;
  };

  if (!showShapesPanel) return null;

  return (
    <div
      className="fixed left-4 z-40 flex w-64 flex-col rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-[#c0c1c4] dark:bg-[#d6d7da]"
      style={{ top: "76px", height: "calc(100% - 176px)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-[#c0c1c4]">
        <h2 className="font-semibold text-gray-800 dark:text-gray-800">
          Shapes
        </h2>
        <button
          onClick={() => setShowShapesPanel(false)}
          className="rounded p-1 transition-colors hover:bg-gray-100 dark:hover:bg-[#c8c9cc]"
        >
          <X className="h-5 w-5 text-gray-500 dark:text-gray-600" />
        </button>
      </div>

      {/* Search */}
      <div className="border-b border-gray-200 p-3 dark:border-[#c0c1c4]">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search shapes"
            className="pr-3 pl-9"
          />
        </div>
      </div>

      {/* Shape Categories */}
      <div className="flex-1 overflow-y-auto">
        {/* Favorites Section */}
        {favoriteShapes.length > 0 && !search.trim() && (
          <div className="border-b border-gray-100">
            <button
              onClick={() => toggleCategory("favorites")}
              className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                Favorites
                <span className="text-xs text-gray-400">
                  ({favoriteShapes.length}/{MAX_FAVORITES})
                </span>
              </span>
              {expandedCategories["favorites"] ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>
            {expandedCategories["favorites"] && (
              <div className="grid grid-cols-4 gap-1 px-3 pb-3">
                {favoriteShapes.map((variant) => {
                  const isDefaultFavorite =
                    DEFAULT_FAVORITE_SHAPES.includes(variant);
                  return (
                    <button
                      key={variant}
                      onClick={() => handleShapeSelect(variant)}
                      className={cn(
                        "group relative flex aspect-square items-center justify-center rounded-lg transition-all",
                        "hover:bg-violet-50 hover:text-violet-600",
                        selectedShapeVariant === variant &&
                          "bg-violet-100 text-violet-700 ring-2 ring-violet-500",
                      )}
                      title={getShapeLabel(variant)}
                    >
                      <ShapeIcon variant={variant} className="text-gray-600" />
                      {isDefaultFavorite ? (
                        <div className="absolute top-0.5 right-0.5 p-0.5">
                          <Lock className="h-3 w-3 text-gray-400" />
                        </div>
                      ) : (
                        <button
                          onClick={(e) => handleToggleFavorite(e, variant)}
                          className="absolute top-0.5 right-0.5 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-yellow-100"
                        >
                          <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500 drop-shadow-[0_0_1px_rgba(0,0,0,0.3)]" />
                        </button>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Recent Section */}
        {recentShapes.length > 0 && !search.trim() && (
          <div className="border-b border-gray-100">
            <button
              onClick={() => toggleCategory("recent")}
              className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Clock className="h-4 w-4 text-gray-500" />
                Recent
              </span>
              {expandedCategories["recent"] ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>
            {expandedCategories["recent"] && (
              <div className="grid grid-cols-4 gap-1 px-3 pb-3">
                {recentShapes.map((variant) => (
                  <button
                    key={variant}
                    onClick={() => handleShapeSelect(variant)}
                    className={cn(
                      "group relative flex aspect-square items-center justify-center rounded-lg transition-all",
                      "hover:bg-violet-50 hover:text-violet-600",
                      selectedShapeVariant === variant &&
                        "bg-violet-100 text-violet-700 ring-2 ring-violet-500",
                    )}
                    title={getShapeLabel(variant)}
                  >
                    <ShapeIcon variant={variant} className="text-gray-600" />
                    <button
                      onClick={(e) => handleToggleFavorite(e, variant)}
                      className={cn(
                        "absolute top-0.5 right-0.5 rounded p-0.5 transition-opacity hover:bg-yellow-100",
                        favoriteShapes.includes(variant)
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100",
                      )}
                    >
                      <Star
                        className={cn(
                          "h-3.5 w-3.5",
                          favoriteShapes.includes(variant)
                            ? "fill-yellow-500 text-yellow-500 drop-shadow-[0_0_1px_rgba(0,0,0,0.3)]"
                            : "stroke-2 text-gray-400",
                        )}
                      />
                    </button>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {filteredCategories.map((category) => (
          <div key={category.id} className="border-b border-gray-100">
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(category.id)}
              className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-700">
                {category.label}
              </span>
              {expandedCategories[category.id] ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>

            {/* Category Shapes Grid */}
            {expandedCategories[category.id] && (
              <div className="grid grid-cols-4 gap-1 px-3 pb-3">
                {category.shapes.map((shape) => (
                  <button
                    key={shape.id}
                    onClick={() => handleShapeSelect(shape.id)}
                    className={cn(
                      "group relative flex aspect-square items-center justify-center rounded-lg transition-all",
                      "hover:bg-violet-50 hover:text-violet-600",
                      selectedShapeVariant === shape.id &&
                        "bg-violet-100 text-violet-700 ring-2 ring-violet-500",
                    )}
                    title={shape.label}
                  >
                    <ShapeIcon variant={shape.id} className="text-gray-600" />
                    <button
                      onClick={(e) => handleToggleFavorite(e, shape.id)}
                      className={cn(
                        "absolute top-0.5 right-0.5 rounded p-0.5 transition-opacity hover:bg-yellow-100",
                        favoriteShapes.includes(shape.id)
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100",
                      )}
                    >
                      <Star
                        className={cn(
                          "h-3.5 w-3.5",
                          favoriteShapes.includes(shape.id)
                            ? "fill-yellow-500 text-yellow-500 drop-shadow-[0_0_1px_rgba(0,0,0,0.3)]"
                            : "stroke-2 text-gray-400",
                        )}
                      />
                    </button>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
