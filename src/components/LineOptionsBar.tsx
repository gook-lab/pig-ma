import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { getOptionsBarTransform } from "@/utils/optionsBar";
import { ColorPickerPopup, CustomColorButton } from "./ColorPickerPopup";
import { useGlobalCustomColors } from "@/hooks/useCustomColors";
import type { CanvasObject, PenType } from "@/types";

interface LineOptionsBarProps {
  line: CanvasObject;
  position: {
    x: number;
    y: number;
    above?: boolean;
    align?: "center" | "left" | "right";
  };
  onUpdate: (updates: Partial<CanvasObject>) => void;
}

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

function MarkerIcon({
  className,
  color,
}: {
  className?: string;
  color: string;
}) {
  return (
    <svg viewBox="0 0 32 40" className={className}>
      <rect x="8" y="4" width="16" height="24" rx="2" fill={color} />
      <path d="M12 28 L16 38 L20 28 Z" fill={color} />
      <rect
        x="10"
        y="6"
        width="4"
        height="8"
        rx="1"
        fill="white"
        opacity="0.3"
      />
    </svg>
  );
}

function HighlighterIcon({
  className,
  color,
}: {
  className?: string;
  color: string;
}) {
  return (
    <svg viewBox="0 0 32 40" className={className}>
      <rect
        x="6"
        y="2"
        width="20"
        height="28"
        rx="3"
        fill={color}
        opacity="0.7"
      />
      <path d="M8 30 L24 30 L20 38 L12 38 Z" fill={color} opacity="0.7" />
      <rect
        x="8"
        y="4"
        width="6"
        height="20"
        rx="1"
        fill="white"
        opacity="0.2"
      />
    </svg>
  );
}

export function LineOptionsBar({
  line,
  position,
  onUpdate,
}: LineOptionsBarProps) {
  const [activePanel, setActivePanel] = useState<"color" | "type" | null>(null);
  // 드롭다운 버튼 refs (화면 경계 체크용)
  const dropdownButtonRefs = useRef<Record<string, HTMLButtonElement | null>>(
    {},
  );
  // 드롭다운이 위로 열려야 하는지 여부
  const [dropdownAbove, setDropdownAbove] = useState(false);
  // 커스텀 컬러 피커 상태
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  // 커스텀 색상 히스토리
  const { customColors, addIfNotInPalette } = useGlobalCustomColors();

  const currentColor = line.stroke ?? "#1f2937";
  const currentPenType = line.penType ?? "pen";

  const togglePanel = useCallback((panel: "color" | "type") => {
    setActivePanel((prev) => {
      if (prev === panel) return null;

      // 드롭다운이 열릴 때 화면 경계 체크
      const buttonEl = dropdownButtonRefs.current[panel];
      if (buttonEl) {
        const rect = buttonEl.getBoundingClientRect();
        const dropdownHeight = 150; // 예상 드롭다운 높이
        const spaceBelow = window.innerHeight - rect.bottom;
        // 아래 공간이 부족하면 위로 표시
        setDropdownAbove(spaceBelow < dropdownHeight);
      }

      return panel;
    });
  }, []);

  const handleColorChange = (color: string) => {
    onUpdate({ stroke: color });
    addIfNotInPalette(color, STROKE_COLORS);
    setActivePanel(null);
  };

  const handlePenTypeChange = (penType: PenType) => {
    // Base strokeWidth (from original line or default)
    const baseStrokeWidth = 2;

    // Calculate strokeWidth and opacity based on pen type
    let strokeWidth = baseStrokeWidth;
    let opacity = 1;

    if (penType === "marker") {
      strokeWidth = baseStrokeWidth * 2;
      opacity = 0.7;
    } else if (penType === "highlighter") {
      strokeWidth = baseStrokeWidth * 4;
      opacity = 0.4;
    }

    onUpdate({ penType, strokeWidth, opacity });
    setActivePanel(null);
  };

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
        {/* Stroke Color */}
        <button
          ref={(el) => {
            dropdownButtonRefs.current["color"] = el;
          }}
          onClick={() => togglePanel("color")}
          className={cn(
            "flex items-center gap-1 rounded p-1.5 transition-all",
            "hover:bg-gray-700",
            activePanel === "color" && "bg-gray-700",
          )}
          title="선 색상"
        >
          <div
            className="h-6 w-6 rounded-full border-2 border-gray-500"
            style={{ backgroundColor: currentColor }}
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

        {/* Pen Type */}
        <button
          ref={(el) => {
            dropdownButtonRefs.current["type"] = el;
          }}
          onClick={() => togglePanel("type")}
          className={cn(
            "flex items-center gap-1 rounded p-1.5 transition-all",
            "hover:bg-gray-700",
            activePanel === "type" && "bg-gray-700",
          )}
          title="펜 종류"
        >
          <div className="flex h-6 w-6 items-center justify-center">
            {currentPenType === "highlighter" ? (
              <HighlighterIcon className="h-7 w-5" color={currentColor} />
            ) : (
              <MarkerIcon
                className={cn(
                  "h-7",
                  currentPenType === "marker" ? "w-6" : "w-4",
                )}
                color={currentColor}
              />
            )}
          </div>
          <svg
            className="h-2 w-2 text-white"
            viewBox="0 0 8 8"
            fill="currentColor"
          >
            <path d="M4 6L1 2h6L4 6z" />
          </svg>
        </button>
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
        {/* Color Panel */}
        {activePanel === "color" && (
          <div className="rounded-lg bg-gray-800 p-3 shadow-lg">
            {/* Custom colors history */}
            {customColors.length > 0 && (
              <div className="mb-2 border-b border-gray-700 pb-2">
                <div className="mb-1.5 text-xs text-gray-400">최근 사용</div>
                <div className="flex gap-1.5">
                  {customColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleColorChange(color)}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition-transform",
                        currentColor.toLowerCase() === color.toLowerCase()
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
                  onClick={() => handleColorChange(color)}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition-transform",
                    currentColor === color
                      ? "scale-110 border-white"
                      : "border-transparent hover:scale-105",
                  )}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
              {/* Custom color picker */}
              <CustomColorButton
                onClick={() => setShowCustomPicker(!showCustomPicker)}
                isActive={showCustomPicker}
              />
            </div>
            {/* Custom Color Picker Popup */}
            {showCustomPicker && (
              <ColorPickerPopup
                currentColor={currentColor}
                onApply={(color) => handleColorChange(color)}
                onClose={() => setShowCustomPicker(false)}
              />
            )}
          </div>
        )}

        {/* Pen Type Panel */}
        {activePanel === "type" && (
          <div className="popover-enter flex items-center gap-1 rounded-lg bg-gray-800 px-2 py-1.5 shadow-lg">
            {/* Pen */}
            <button
              onClick={() => handlePenTypeChange("pen")}
              className={cn(
                "flex items-center justify-center rounded p-2 transition-all",
                "hover:bg-gray-700",
                currentPenType === "pen" && "bg-violet-600",
              )}
              title="Pen"
            >
              <MarkerIcon className="h-6 w-4" color="#ffffff" />
            </button>

            {/* Marker */}
            <button
              onClick={() => handlePenTypeChange("marker")}
              className={cn(
                "flex items-center justify-center rounded p-2 transition-all",
                "hover:bg-gray-700",
                currentPenType === "marker" && "bg-violet-600",
              )}
              title="Marker"
            >
              <MarkerIcon className="h-7 w-5" color="#ffffff" />
            </button>

            {/* Highlighter */}
            <button
              onClick={() => handlePenTypeChange("highlighter")}
              className={cn(
                "flex items-center justify-center rounded p-2 transition-all",
                "hover:bg-gray-700",
                currentPenType === "highlighter" && "bg-violet-600",
              )}
              title="Highlighter"
            >
              <HighlighterIcon className="h-7 w-5" color="#ffffff" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
