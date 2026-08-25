import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Shapes,
  Bold,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Lock,
  Unlock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getOptionsBarTransform } from "@/utils/optionsBar";
import { ColorPickerPopup, CustomColorButton } from "./ColorPickerPopup";
import { useGlobalCustomColors } from "@/hooks/useCustomColors";
import type {
  CanvasObject,
  ShapeVariant,
  LineStyle,
  TextAlign,
  FontFamily,
  FontSize,
} from "@/types";
import type { Editor } from "@tiptap/core";
import {
  DEFAULT_FONT_FAMILY,
  FONT_OPTIONS,
  fontStack,
} from "@/constants/fonts";

interface ShapeOptionsBarProps {
  shape: CanvasObject;
  position: {
    x: number;
    y: number;
    above?: boolean;
    align?: "center" | "left" | "right";
  };
  onUpdate: (updates: Partial<CanvasObject>) => void;
  onLock?: () => void;
  onUnlock?: () => void;
  tiptapEditor?: Editor | null;
}

type FillMode = "fill" | "transparent" | "nofill";

// Color palettes matching the screenshots
// 17개 색상 + 커스텀 = 18개 (9열 x 2줄)
const FILL_COLORS = [
  "#6b7280",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#d1d5db",
  "#fca5a5",
  "#fdba74",
  "#fde047",
  "#86efac",
  "#93c5fd",
  "#c4b5fd",
  "#f9a8d4",
];

// 17개 색상 + 커스텀 = 18개 (9열 x 2줄)
const STROKE_COLORS = [
  "#6b7280",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#d1d5db",
  "#fca5a5",
  "#fdba74",
  "#fde047",
  "#86efac",
  "#93c5fd",
  "#c4b5fd",
  "#f9a8d4",
];

const TEXT_COLORS = [
  "#000000",
  "#374151",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
];

// Font families — 정본은 constants/fonts.ts (세 옵션바가 각자 들고 있었다)
const FONT_FAMILIES = FONT_OPTIONS;

// Font sizes
const FONT_SIZES: { id: FontSize; size: number; label: string }[] = [
  { id: "S", size: 12, label: "Small" },
  { id: "M", size: 16, label: "Medium" },
  { id: "L", size: 24, label: "Large" },
  { id: "XL", size: 32, label: "Extra large" },
];

// Shape definitions for picker
const SHAPE_VARIANTS: { id: ShapeVariant; label: string }[] = [
  { id: "rectangle", label: "사각형" },
  { id: "circle", label: "원" },
  { id: "diamond", label: "마름모" },
  { id: "triangle", label: "삼각형" },
  { id: "triangleDown", label: "역삼각형" },
  { id: "pentagon", label: "오각형" },
  { id: "hexagon", label: "육각형" },
  { id: "octagon", label: "팔각형" },
  { id: "star", label: "별" },
  { id: "star4", label: "4각 별" },
  { id: "cross", label: "십자" },
  { id: "arrowRight", label: "오른쪽 화살표" },
  { id: "arrowLeft", label: "왼쪽 화살표" },
  { id: "arrowUp", label: "위 화살표" },
  { id: "arrowDown", label: "아래 화살표" },
  { id: "chevronRight", label: "펜턴" },
  { id: "speechBubble", label: "말풍선" },
  { id: "roundedRect", label: "둥근 사각형" },
  { id: "ellipse", label: "타원" },
  { id: "flowProcess", label: "프로세스" },
  { id: "flowDecision", label: "결정" },
  { id: "flowTerminal", label: "터미널" },
  { id: "flowData", label: "데이터" },
  { id: "flowDocument", label: "문서" },
  { id: "flowDatabase", label: "데이터베이스" },
];

// SVG icons for shapes (simplified versions)
function ShapeIcon({
  variant,
  className,
}: {
  variant: ShapeVariant;
  className?: string;
}) {
  const baseClass = cn("w-6 h-6", className);

  switch (variant) {
    case "rectangle":
    case "flowProcess":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="3" y="5" width="18" height="14" rx="1" />
        </svg>
      );
    case "roundedRect":
    case "flowTerminal":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="3" y="5" width="18" height="14" rx="7" />
        </svg>
      );
    case "circle":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case "ellipse":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <ellipse cx="12" cy="12" rx="10" ry="6" />
        </svg>
      );
    case "triangle":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
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
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M12 21L2 3H22L12 21Z" />
        </svg>
      );
    case "diamond":
    case "flowDecision":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
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
          fill="none"
          stroke="currentColor"
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
          fill="none"
          stroke="currentColor"
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
          fill="none"
          stroke="currentColor"
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
          fill="none"
          stroke="currentColor"
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
          fill="none"
          stroke="currentColor"
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
          fill="none"
          stroke="currentColor"
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
          fill="none"
          stroke="currentColor"
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
          fill="none"
          stroke="currentColor"
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
          fill="none"
          stroke="currentColor"
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
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M8 2V14H4L12 22L20 14H16V2H8Z" />
        </svg>
      );
    case "chevronRight":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M4 4L16 12L4 20V4Z" />
        </svg>
      );
    case "speechBubble":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M3 4H21V16H9L3 22V4Z" />
        </svg>
      );
    case "flowData":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
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
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M3 4H21V18C21 18 18 16 12 18C6 20 3 18 3 18V4Z" />
        </svg>
      );
    case "flowDatabase":
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <ellipse cx="12" cy="6" rx="9" ry="3" />
          <path d="M3 6V18C3 19.66 7 21 12 21C17 21 21 19.66 21 18V6" />
        </svg>
      );
    default:
      return (
        <svg
          className={baseClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="3" y="5" width="18" height="14" />
        </svg>
      );
  }
}

export function ShapeOptionsBar({
  shape,
  position,
  onUpdate,
  onLock,
  onUnlock,
  tiptapEditor,
}: ShapeOptionsBarProps) {
  const isLocked = shape.locked === true;
  const [activePanel, setActivePanel] = useState<
    "shape" | "fill" | "stroke" | "textColor" | "fontFamily" | "fontSize" | null
  >(null);
  const [shapeSearch, setShapeSearch] = useState("");
  const [customFontSize, setCustomFontSize] = useState(
    String(shape.fontSize ?? 10),
  );
  // 드롭다운 버튼 refs (화면 경계 체크용)
  const dropdownButtonRefs = useRef<Record<string, HTMLButtonElement | null>>(
    {},
  );
  // 드롭다운이 위로 열려야 하는지 여부
  const [dropdownAbove, setDropdownAbove] = useState(false);
  // 커스텀 컬러 피커 상태
  const [showCustomPicker, setShowCustomPicker] = useState<
    "fill" | "stroke" | "textColor" | null
  >(null);
  // 커스텀 색상 히스토리
  const { customColors, addIfNotInPalette } = useGlobalCustomColors();

  const currentVariant = shape.shapeVariant ?? "rectangle";
  const currentFill = shape.fill ?? "#ffffff";
  const currentStroke = shape.stroke ?? "#374151";
  const currentLineStyle = shape.lineStyle ?? "solid";

  // Text options
  const currentTextColor = shape.textColor ?? "#000000";
  const currentTextAlign = shape.textAlign ?? "center";
  const currentFontFamily = shape.fontFamily ?? DEFAULT_FONT_FAMILY;
  const currentFontSize = shape.fontSize ?? 10;

  // Sync customFontSize with shape's fontSize
  useEffect(() => {
    setCustomFontSize(String(Math.round(shape.fontSize ?? 10)));
  }, [shape.fontSize]);

  // Bold/Strikethrough 상태 - tiptapEditor가 있으면 editor 상태 참조
  const isBold = tiptapEditor
    ? tiptapEditor.isActive("bold")
    : shape.fontWeight === "bold";
  const isStrikethrough = tiptapEditor
    ? tiptapEditor.isActive("strike")
    : shape.textDecoration === "line-through";

  // Bold 토글 핸들러
  const handleBoldToggle = useCallback(() => {
    if (isLocked) return;
    if (tiptapEditor) {
      tiptapEditor.chain().focus().toggleBold().run();
    } else {
      onUpdate({ fontWeight: isBold ? "normal" : "bold" });
    }
  }, [isLocked, tiptapEditor, isBold, onUpdate]);

  // Strikethrough 토글 핸들러
  const handleStrikethroughToggle = useCallback(() => {
    if (isLocked) return;
    if (tiptapEditor) {
      tiptapEditor.chain().focus().toggleStrike().run();
    } else {
      onUpdate({ textDecoration: isStrikethrough ? "none" : "line-through" });
    }
  }, [isLocked, tiptapEditor, isStrikethrough, onUpdate]);

  // Determine fill mode
  // nofill means white background (not transparent)
  const fillMode: FillMode =
    currentFill === "transparent"
      ? "transparent"
      : shape.fillMode === "nofill"
        ? "nofill"
        : "fill";

  // Filter shapes by search
  const filteredShapes = useMemo(() => {
    if (!shapeSearch.trim()) return SHAPE_VARIANTS;
    const search = shapeSearch.toLowerCase();
    return SHAPE_VARIANTS.filter(
      (s) =>
        s.label.toLowerCase().includes(search) ||
        s.id.toLowerCase().includes(search),
    );
  }, [shapeSearch]);

  const togglePanel = useCallback(
    (
      panel:
        "shape" | "fill" | "stroke" | "textColor" | "fontFamily" | "fontSize",
    ) => {
      setActivePanel((prev) => {
        if (prev === panel) return null;

        // 드롭다운이 열릴 때 화면 경계 체크
        const buttonEl = dropdownButtonRefs.current[panel];
        if (buttonEl) {
          const rect = buttonEl.getBoundingClientRect();
          const dropdownHeight = 250; // 예상 드롭다운 높이
          const spaceBelow = window.innerHeight - rect.bottom;
          // 아래 공간이 부족하면 위로 표시
          setDropdownAbove(spaceBelow < dropdownHeight);
        }

        return panel;
      });
    },
    [],
  );

  const handleAlignChange = useCallback(
    (align: TextAlign) => {
      if (tiptapEditor) {
        tiptapEditor.chain().focus().setTextAlign(align).run();
      }
      onUpdate({ textAlign: align });
    },
    [tiptapEditor, onUpdate],
  );

  const handleFontFamilyChange = (fontFamily: FontFamily) => {
    onUpdate({ fontFamily });
    setActivePanel(null);
  };

  const handleFontSizeChange = (size: number) => {
    onUpdate({ fontSize: size });
    setCustomFontSize(String(size));
    setActivePanel(null);
  };

  const handleCustomFontSize = () => {
    const size = Math.round(
      Math.max(8, Math.min(72, parseInt(customFontSize) || 10)),
    );
    onUpdate({ fontSize: size });
    setCustomFontSize(String(size));
    setActivePanel(null);
  };

  const handleFillModeChange = (mode: FillMode) => {
    if (mode === "fill") {
      // Keep current fill or default to white
      if (currentFill === "transparent" || fillMode === "nofill") {
        onUpdate({ fill: "#ffffff", fillMode: "fill" });
      } else {
        onUpdate({ fillMode: "fill" });
      }
    } else if (mode === "transparent") {
      onUpdate({ fill: "transparent", fillMode: "transparent" });
    } else {
      // nofill: white background but marked as "no fill"
      onUpdate({ fill: "#ffffff", fillMode: "nofill" });
    }
  };

  const handleStrokeStyleChange = (style: LineStyle | "none") => {
    if (style === "none") {
      onUpdate({ stroke: "transparent", lineStyle: "solid" });
    } else {
      // Restore stroke if was none
      if (currentStroke === "transparent") {
        onUpdate({ stroke: "#374151", lineStyle: style });
      } else {
        onUpdate({ lineStyle: style });
      }
    }
  };

  const isStrokeNone = currentStroke === "transparent";

  return (
    <div
      className="fixed z-[200]"
      style={{
        left: position.x,
        top: position.y,
        transform: getOptionsBarTransform({
          x: position.x,
          y: position.y,
          above: position.above ?? false,
          align: position.align ?? "center",
        }),
      }}
      // Prevent blur on editor when clicking options bar
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Main Options Bar */}
      <div className="popover-enter flex items-center gap-1 rounded-lg bg-gray-800 px-2 py-1.5 shadow-lg">
        {/* Shape Picker - only for 'shape' type (More Shapes) */}
        {shape.type === "shape" && (
          <>
            <button
              ref={(el) => {
                dropdownButtonRefs.current["shape"] = el;
              }}
              onClick={() => !isLocked && togglePanel("shape")}
              className={cn(
                "flex items-center gap-1 rounded p-2 transition-all",
                isLocked
                  ? "cursor-not-allowed opacity-50"
                  : "hover:bg-gray-700",
                activePanel === "shape" && !isLocked && "bg-gray-700",
              )}
              title="도형 변경"
              disabled={isLocked}
            >
              <Shapes className="h-5 w-5 text-white" />
              <svg
                className="h-2 w-2 text-white"
                viewBox="0 0 8 8"
                fill="currentColor"
              >
                <path d="M4 6L1 2h6L4 6z" />
              </svg>
            </button>

            <div className="mx-1 h-6 w-px bg-gray-600" />
          </>
        )}

        {/* Fill Color */}
        <button
          ref={(el) => {
            dropdownButtonRefs.current["fill"] = el;
          }}
          onClick={() => !isLocked && togglePanel("fill")}
          className={cn(
            "flex items-center gap-1 rounded p-1.5 transition-all",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-gray-700",
            activePanel === "fill" && !isLocked && "bg-gray-700",
          )}
          title="배경색"
          disabled={isLocked}
        >
          <div
            className="h-6 w-6 rounded-full border-2 border-gray-500"
            style={{
              backgroundColor:
                fillMode === "nofill"
                  ? "#ffffff"
                  : fillMode === "fill"
                    ? currentFill
                    : "transparent",
              backgroundImage:
                fillMode === "transparent"
                  ? "linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%), linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%)"
                  : undefined,
              backgroundSize:
                fillMode === "transparent" ? "6px 6px" : undefined,
              backgroundPosition:
                fillMode === "transparent" ? "0 0, 3px 3px" : undefined,
            }}
          />
          <svg
            className="h-2 w-2 text-white"
            viewBox="0 0 8 8"
            fill="currentColor"
          >
            <path d="M4 6L1 2h6L4 6z" />
          </svg>
        </button>

        <div className="mx-1 h-6 w-px bg-gray-600" />

        {/* Stroke/Border */}
        <button
          ref={(el) => {
            dropdownButtonRefs.current["stroke"] = el;
          }}
          onClick={() => !isLocked && togglePanel("stroke")}
          className={cn(
            "flex items-center gap-1 rounded p-1.5 transition-all",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-gray-700",
            activePanel === "stroke" && !isLocked && "bg-gray-700",
          )}
          title="테두리"
          disabled={isLocked}
        >
          <div className="flex h-6 w-6 items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect
                x="2"
                y="2"
                width="16"
                height="16"
                rx="2"
                stroke={isStrokeNone ? "#6b7280" : currentStroke}
                strokeWidth="2"
                strokeDasharray={
                  currentLineStyle === "dashed"
                    ? "4,2"
                    : currentLineStyle === "dotted"
                      ? "2,2"
                      : undefined
                }
              />
            </svg>
          </div>
          <svg
            className="h-2 w-2 text-white"
            viewBox="0 0 8 8"
            fill="currentColor"
          >
            <path d="M4 6L1 2h6L4 6z" />
          </svg>
        </button>

        <div className="mx-1 h-6 w-px bg-gray-600" />

        {/* Font Family */}
        <button
          ref={(el) => {
            dropdownButtonRefs.current["fontFamily"] = el;
          }}
          onClick={() => !isLocked && togglePanel("fontFamily")}
          className={cn(
            "flex min-w-[80px] items-center justify-center gap-1 rounded p-1.5 transition-all",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-gray-700",
            activePanel === "fontFamily" && !isLocked && "bg-gray-700",
          )}
          title="글꼴"
          disabled={isLocked}
        >
          <Type className="h-4 w-4 text-white" />
          <span
            className="max-w-[50px] truncate text-xs text-white"
            style={{ fontFamily: fontStack(currentFontFamily) }}
          >
            {FONT_FAMILIES.find((f) => f.id === currentFontFamily)?.label ??
              "Pretendard"}
          </span>
          <svg
            className="h-2 w-2 flex-shrink-0 text-white"
            viewBox="0 0 8 8"
            fill="currentColor"
          >
            <path d="M4 6L1 2h6L4 6z" />
          </svg>
        </button>

        {/* Font Size */}
        <button
          ref={(el) => {
            dropdownButtonRefs.current["fontSize"] = el;
          }}
          onClick={() => !isLocked && togglePanel("fontSize")}
          className={cn(
            "flex min-w-[50px] items-center justify-center gap-1 rounded p-1.5 transition-all",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-gray-700",
            activePanel === "fontSize" && !isLocked && "bg-gray-700",
          )}
          title="글꼴 크기"
          disabled={isLocked}
        >
          <span className="text-sm text-white">
            {Math.round(currentFontSize)}
          </span>
          <svg
            className="h-2 w-2 text-white"
            viewBox="0 0 8 8"
            fill="currentColor"
          >
            <path d="M4 6L1 2h6L4 6z" />
          </svg>
        </button>

        <div className="mx-1 h-6 w-px bg-gray-600" />

        {/* Text Color */}
        <button
          ref={(el) => {
            dropdownButtonRefs.current["textColor"] = el;
          }}
          onClick={() => !isLocked && togglePanel("textColor")}
          className={cn(
            "h-6 w-6 rounded-full border-2 transition-transform",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:scale-110",
            activePanel === "textColor" && !isLocked
              ? "border-white"
              : "border-gray-600",
          )}
          style={{ backgroundColor: currentTextColor }}
          title="텍스트 색상"
          disabled={isLocked}
        />

        <div className="mx-1 h-6 w-px bg-gray-600" />

        {/* Bold */}
        <button
          onClick={handleBoldToggle}
          className={cn(
            "rounded p-2 transition-all",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-gray-700",
            isBold && !isLocked && "bg-violet-600",
          )}
          title="Bold"
          disabled={isLocked}
        >
          <Bold className="h-4 w-4 text-white" />
        </button>

        {/* Strikethrough */}
        <button
          onClick={handleStrikethroughToggle}
          className={cn(
            "rounded p-2 transition-all",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-gray-700",
            isStrikethrough && !isLocked && "bg-violet-600",
          )}
          title="Strikethrough"
          disabled={isLocked}
        >
          <Strikethrough className="h-4 w-4 text-white" />
        </button>

        <div className="mx-1 h-6 w-px bg-gray-600" />

        {/* Align Left */}
        <button
          onClick={() => handleAlignChange("left")}
          className={cn(
            "rounded p-2 transition-all",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-gray-700",
            currentTextAlign === "left" && !isLocked && "bg-violet-600",
          )}
          title="Align Left"
          disabled={isLocked}
        >
          <AlignLeft className="h-4 w-4 text-white" />
        </button>

        {/* Align Center */}
        <button
          onClick={() => handleAlignChange("center")}
          className={cn(
            "rounded p-2 transition-all",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-gray-700",
            currentTextAlign === "center" && !isLocked && "bg-violet-600",
          )}
          title="Align Center"
          disabled={isLocked}
        >
          <AlignCenter className="h-4 w-4 text-white" />
        </button>

        {/* Align Right */}
        <button
          onClick={() => handleAlignChange("right")}
          className={cn(
            "rounded p-2 transition-all",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-gray-700",
            currentTextAlign === "right" && !isLocked && "bg-violet-600",
          )}
          title="Align Right"
          disabled={isLocked}
        >
          <AlignRight className="h-4 w-4 text-white" />
        </button>

        <div className="mx-1 h-6 w-px bg-gray-600" />

        {/* Lock/Unlock */}
        {isLocked ? (
          <button
            onClick={onUnlock}
            className="rounded bg-red-600 p-2 transition-all hover:bg-red-700"
            title="잠금 해제"
          >
            <Unlock className="h-4 w-4 text-white" />
          </button>
        ) : (
          <button
            onClick={onLock}
            className="rounded p-2 transition-all hover:bg-gray-700"
            title="잠금"
          >
            <Lock className="h-4 w-4 text-white" />
          </button>
        )}
      </div>

      {/* Dropdown Panels - 메인바 기준 절대 위치 (메인바 위치 고정) */}
      <div
        className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
        style={{
          top: dropdownAbove ? "auto" : "100%",
          bottom: dropdownAbove ? "100%" : "auto",
          marginTop: dropdownAbove ? 0 : 8,
          marginBottom: dropdownAbove ? 8 : 0,
        }}
      >
        {/* Shape Picker Panel */}
        {activePanel === "shape" && (
          <div className="w-72 rounded-lg bg-gray-800 p-3 shadow-lg">
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={shapeSearch}
                onChange={(e) => setShapeSearch(e.target.value)}
                placeholder="Search for a shape"
                className="w-full rounded-lg border border-gray-600 bg-gray-700 py-2 pr-3 pl-9 text-sm text-white placeholder-gray-400 focus:ring-2 focus:ring-violet-500 focus:outline-none"
              />
            </div>
            {/* Shape Grid */}
            <div className="grid grid-cols-6 gap-1">
              {filteredShapes.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    onUpdate({ shapeVariant: s.id });
                    setActivePanel(null);
                  }}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded transition-all",
                    "hover:bg-gray-700",
                    currentVariant === s.id && "bg-violet-600",
                  )}
                  title={s.label}
                >
                  <ShapeIcon variant={s.id} className="text-white" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Fill Panel */}
        {activePanel === "fill" && (
          <div className="rounded-lg bg-gray-800 p-3 shadow-lg">
            {/* Fill Mode Tabs */}
            <div className="mb-3 flex gap-2">
              <button
                onClick={() => handleFillModeChange("fill")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-all",
                  fillMode === "fill"
                    ? "bg-violet-600 text-white"
                    : "text-gray-300 hover:bg-gray-700",
                )}
              >
                <div className="h-4 w-4 rounded border-2 border-current bg-current" />
                Fill
              </button>
              <button
                onClick={() => handleFillModeChange("transparent")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-all",
                  fillMode === "transparent"
                    ? "bg-violet-600 text-white"
                    : "text-gray-300 hover:bg-gray-700",
                )}
              >
                <div
                  className="h-4 w-4 rounded border-2 border-current"
                  style={{
                    backgroundImage:
                      "linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%), linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%)",
                    backgroundSize: "6px 6px",
                    backgroundPosition: "0 0, 3px 3px",
                  }}
                />
                Transparent
              </button>
              <button
                onClick={() => handleFillModeChange("nofill")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm whitespace-nowrap transition-all",
                  fillMode === "nofill"
                    ? "bg-violet-600 text-white"
                    : "text-gray-300 hover:bg-gray-700",
                )}
              >
                <div className="h-4 w-4 rounded border-2 border-current bg-white" />
                No fill
              </button>
            </div>
            {/* Color Grid */}
            {fillMode === "fill" && (
              <>
                {/* Custom colors history */}
                {customColors.length > 0 && (
                  <div className="mb-2 border-b border-gray-700 pb-2">
                    <div className="mb-1.5 text-xs text-gray-400">
                      최근 사용
                    </div>
                    <div className="flex gap-1.5">
                      {customColors.map((color) => (
                        <button
                          key={color}
                          onClick={() => onUpdate({ fill: color })}
                          className={cn(
                            "h-6 w-6 rounded-full border-2 transition-transform",
                            currentFill.toLowerCase() === color.toLowerCase()
                              ? "scale-110 border-white"
                              : "border-transparent hover:scale-105",
                          )}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-9 gap-1.5">
                  {FILL_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => onUpdate({ fill: color })}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition-transform",
                        currentFill === color
                          ? "scale-110 border-white"
                          : "border-transparent hover:scale-105",
                      )}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                  {/* Custom color picker */}
                  <CustomColorButton
                    onClick={() =>
                      setShowCustomPicker(
                        showCustomPicker === "fill" ? null : "fill",
                      )
                    }
                    isActive={showCustomPicker === "fill"}
                  />
                </div>
              </>
            )}
            {/* Custom Color Picker Popup */}
            {showCustomPicker === "fill" && (
              <ColorPickerPopup
                currentColor={currentFill}
                onApply={(color) => {
                  onUpdate({ fill: color });
                  addIfNotInPalette(color, FILL_COLORS);
                }}
                onClose={() => setShowCustomPicker(null)}
              />
            )}
          </div>
        )}

        {/* Stroke Panel */}
        {activePanel === "stroke" && (
          <div className="rounded-lg bg-gray-800 p-3 shadow-lg">
            {/* Stroke Style Tabs */}
            <div className="mb-3 flex gap-2">
              <button
                onClick={() => handleStrokeStyleChange("solid")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-all",
                  !isStrokeNone && currentLineStyle === "solid"
                    ? "bg-violet-600 text-white"
                    : "text-gray-300 hover:bg-gray-700",
                )}
              >
                <svg width="16" height="2" viewBox="0 0 16 2">
                  <line
                    x1="0"
                    y1="1"
                    x2="16"
                    y2="1"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
                Solid
              </button>
              <button
                onClick={() => handleStrokeStyleChange("dashed")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-all",
                  !isStrokeNone && currentLineStyle === "dashed"
                    ? "bg-violet-600 text-white"
                    : "text-gray-300 hover:bg-gray-700",
                )}
              >
                <svg width="16" height="2" viewBox="0 0 16 2">
                  <line
                    x1="0"
                    y1="1"
                    x2="16"
                    y2="1"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="4,2"
                  />
                </svg>
                Dashed
              </button>
              <button
                onClick={() => handleStrokeStyleChange("none")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-all",
                  isStrokeNone
                    ? "bg-violet-600 text-white"
                    : "text-gray-300 hover:bg-gray-700",
                )}
              >
                <div className="relative flex h-4 w-4 items-center justify-center">
                  <div className="h-0.5 w-full bg-current" />
                  <div className="absolute h-0.5 w-5 rotate-45 bg-current" />
                </div>
                None
              </button>
            </div>
            {/* Color Grid */}
            {!isStrokeNone && (
              <>
                {/* Custom colors history */}
                {customColors.length > 0 && (
                  <div className="mb-2 border-b border-gray-700 pb-2">
                    <div className="mb-1.5 text-xs text-gray-400">
                      최근 사용
                    </div>
                    <div className="flex gap-1.5">
                      {customColors.map((color) => (
                        <button
                          key={color}
                          onClick={() => onUpdate({ stroke: color })}
                          className={cn(
                            "h-6 w-6 rounded-full border-2 transition-transform",
                            currentStroke.toLowerCase() === color.toLowerCase()
                              ? "scale-110 border-white"
                              : "border-transparent hover:scale-105",
                          )}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-9 gap-1.5">
                  {STROKE_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => onUpdate({ stroke: color })}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition-transform",
                        currentStroke === color
                          ? "scale-110 border-white"
                          : "border-transparent hover:scale-105",
                      )}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                  {/* Custom color picker */}
                  <CustomColorButton
                    onClick={() =>
                      setShowCustomPicker(
                        showCustomPicker === "stroke" ? null : "stroke",
                      )
                    }
                    isActive={showCustomPicker === "stroke"}
                  />
                </div>
              </>
            )}
            {/* Custom Color Picker Popup */}
            {showCustomPicker === "stroke" && (
              <ColorPickerPopup
                currentColor={currentStroke}
                onApply={(color) => {
                  onUpdate({ stroke: color });
                  addIfNotInPalette(color, STROKE_COLORS);
                }}
                onClose={() => setShowCustomPicker(null)}
              />
            )}
          </div>
        )}

        {/* Text Color Panel */}
        {activePanel === "textColor" && (
          <>
            <div className="rounded-lg bg-gray-800 p-3 shadow-lg">
              {/* Custom colors history */}
              {customColors.length > 0 && (
                <div className="mb-2 border-b border-gray-700 pb-2">
                  <div className="mb-1.5 text-xs text-gray-400">최근 사용</div>
                  <div className="flex gap-1.5">
                    {customColors.map((color) => (
                      <button
                        key={color}
                        onClick={() => {
                          onUpdate({ textColor: color });
                          setActivePanel(null);
                        }}
                        className={cn(
                          "h-6 w-6 rounded-full border-2 transition-transform",
                          currentTextColor.toLowerCase() === color.toLowerCase()
                            ? "scale-110 border-white"
                            : "border-transparent hover:scale-105",
                        )}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-1">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      onUpdate({ textColor: color });
                      setActivePanel(null);
                    }}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-transform",
                      currentTextColor === color
                        ? "scale-110 border-white"
                        : "border-transparent hover:scale-105",
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
                {/* Custom color picker */}
                <CustomColorButton
                  onClick={() =>
                    setShowCustomPicker(
                      showCustomPicker === "textColor" ? null : "textColor",
                    )
                  }
                  isActive={showCustomPicker === "textColor"}
                />
              </div>
              {/* Custom Color Picker Popup */}
              {showCustomPicker === "textColor" && (
                <ColorPickerPopup
                  currentColor={currentTextColor}
                  onApply={(color) => {
                    onUpdate({ textColor: color });
                    addIfNotInPalette(color, TEXT_COLORS);
                    setActivePanel(null);
                  }}
                  onClose={() => setShowCustomPicker(null)}
                />
              )}
            </div>
          </>
        )}

        {/* Font Family Panel */}
        {activePanel === "fontFamily" && (
          <div className="flex min-w-[140px] flex-col gap-1 rounded-lg bg-gray-800 px-2 py-1.5 shadow-lg">
            {FONT_FAMILIES.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => handleFontFamilyChange(id)}
                className={cn(
                  "rounded px-3 py-1.5 text-left text-sm transition-all",
                  "text-white hover:bg-gray-700",
                  currentFontFamily === id && "bg-violet-600",
                )}
                style={{ fontFamily: id }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Font Size Panel */}
        {activePanel === "fontSize" && (
          <div className="flex min-w-[140px] flex-col gap-1 rounded-lg bg-gray-800 px-2 py-1.5 shadow-lg">
            {FONT_SIZES.map(({ id, size, label }) => (
              <button
                key={id}
                onClick={() => handleFontSizeChange(size)}
                className={cn(
                  "flex items-center justify-between rounded px-3 py-1.5 text-sm transition-all",
                  "text-white hover:bg-gray-700",
                  currentFontSize === size && "bg-violet-600",
                )}
              >
                <span>{label}</span>
                <span className="text-xs text-gray-400">{size}</span>
              </button>
            ))}
            {/* Custom font size input */}
            <div className="mt-1 border-t border-gray-600 pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={customFontSize}
                  onChange={(e) => setCustomFontSize(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCustomFontSize()}
                  className="w-16 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white focus:ring-2 focus:ring-violet-500 focus:outline-none"
                  min={8}
                  max={72}
                />
                <button
                  onClick={handleCustomFontSize}
                  className="rounded bg-violet-600 px-2 py-1 text-xs text-white hover:bg-violet-700"
                >
                  적용
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
