import { memo, useState, useCallback, useEffect, useRef } from "react";
import { Bold, Strikethrough, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import { Z_OPTIONS_BAR } from "@/constants/zIndex";
import { getOptionsBarTransform } from "@/utils/optionsBar";
import { ColorPickerPopup, CustomColorButton } from "./ColorPickerPopup";
import { useGlobalCustomColors } from "@/hooks/useCustomColors";
import type { CanvasObject, FontFamily } from "@/types";

interface ConnectorLabelOptionsBarProps {
  label: CanvasObject;
  position: {
    x: number;
    y: number;
    above: boolean;
    align?: "center" | "left" | "right";
  };
  onUpdate: (updates: Partial<CanvasObject>) => void;
  onStartEdit: () => void;
}

// 17개 색상 + 커스텀 = 18개 (9열 x 2줄)
const TEXT_COLORS = [
  "#000000",
  "#374151",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
  "#fca5a5",
  "#fdba74",
  "#fde047",
  "#86efac",
  "#93c5fd",
  "#c4b5fd",
  "#f9a8d4",
];

const FONT_OPTIONS: { value: FontFamily; label: string }[] = [
  { value: "Pretendard", label: "Pretendard" },
  { value: "Noto Sans KR", label: "Noto Sans" },
  { value: "Nanum Gothic", label: "Nanum Gothic" },
  { value: "IBM Plex Sans KR", label: "IBM Plex" },
];

const SIZE_OPTIONS = [
  { value: 10, label: "Small" },
  { value: 12, label: "Medium" },
  { value: 14, label: "Large" },
  { value: 16, label: "XL" },
];

export const ConnectorLabelOptionsBar = memo(function ConnectorLabelOptionsBar({
  label,
  position,
  onUpdate,
  onStartEdit: _onStartEdit,
}: ConnectorLabelOptionsBarProps) {
  const [activePanel, setActivePanel] = useState<
    "textColor" | "fontFamily" | "fontSize" | null
  >(null);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [dropdownAbove, setDropdownAbove] = useState(false);
  const dropdownButtonRefs = useRef<Record<string, HTMLButtonElement | null>>(
    {},
  );
  const { customColors, addIfNotInPalette } = useGlobalCustomColors();

  const currentColor = label.textColor ?? "#374151";
  const currentFont = label.fontFamily ?? "Pretendard";
  const currentSize = label.fontSize ?? 12;
  const isBold = label.fontWeight === "bold";
  const isStrikethrough = label.textDecoration === "line-through";

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".connector-label-options-bar")) {
        setActivePanel(null);
        setShowCustomPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const togglePanel = useCallback(
    (panel: "textColor" | "fontFamily" | "fontSize") => {
      setActivePanel((prev) => {
        if (prev === panel) return null;

        const buttonEl = dropdownButtonRefs.current[panel];
        if (buttonEl) {
          const rect = buttonEl.getBoundingClientRect();
          const dropdownHeight = 200;
          const spaceBelow = window.innerHeight - rect.bottom;
          setDropdownAbove(spaceBelow < dropdownHeight);
        }

        return panel;
      });
      setShowCustomPicker(false);
    },
    [],
  );

  const handleBoldToggle = useCallback(() => {
    onUpdate({ fontWeight: isBold ? "normal" : "bold" });
  }, [isBold, onUpdate]);

  const handleStrikethroughToggle = useCallback(() => {
    onUpdate({ textDecoration: isStrikethrough ? "none" : "line-through" });
  }, [isStrikethrough, onUpdate]);

  const handleColorSelect = useCallback(
    (color: string) => {
      onUpdate({ textColor: color });
      setActivePanel(null);
    },
    [onUpdate],
  );

  const handleFontSelect = useCallback(
    (font: FontFamily) => {
      onUpdate({ fontFamily: font });
      setActivePanel(null);
    },
    [onUpdate],
  );

  const handleSizeSelect = useCallback(
    (size: number) => {
      onUpdate({ fontSize: size });
      setActivePanel(null);
    },
    [onUpdate],
  );

  return (
    <div
      className="connector-label-options-bar fixed"
      style={{
        left: position.x,
        top: position.y,
        transform: getOptionsBarTransform({
          ...position,
          align: position.align ?? "center",
        }),
        zIndex: Z_OPTIONS_BAR,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Main Options Bar */}
      <div className="popover-enter flex items-center gap-1 rounded-lg bg-gray-800 px-2 py-1.5 shadow-lg">
        {/* Text Color Button */}
        <button
          ref={(el) => {
            dropdownButtonRefs.current["textColor"] = el;
          }}
          onClick={() => togglePanel("textColor")}
          className={cn(
            "flex items-center gap-1 rounded p-1.5 transition-all",
            "hover:bg-gray-700",
            activePanel === "textColor" && "bg-gray-700",
          )}
          title="Text Color"
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

        <div className="mx-1 h-4 w-px bg-gray-600" />

        {/* Font Family */}
        <button
          ref={(el) => {
            dropdownButtonRefs.current["fontFamily"] = el;
          }}
          onClick={() => togglePanel("fontFamily")}
          className={cn(
            "flex min-w-[80px] items-center justify-center gap-1 rounded p-1.5 transition-all",
            "hover:bg-gray-700",
            activePanel === "fontFamily" && "bg-gray-700",
          )}
          title="Font"
        >
          <Type className="h-4 w-4 text-white" />
          <span
            className="max-w-[50px] truncate text-xs text-white"
            style={{ fontFamily: currentFont }}
          >
            {FONT_OPTIONS.find((f) => f.value === currentFont)?.label ??
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
          onClick={() => togglePanel("fontSize")}
          className={cn(
            "flex min-w-[50px] items-center justify-center gap-1 rounded p-1.5 transition-all",
            "hover:bg-gray-700",
            activePanel === "fontSize" && "bg-gray-700",
          )}
          title="Size"
        >
          <span className="text-sm text-white">{Math.round(currentSize)}</span>
          <svg
            className="h-2 w-2 text-white"
            viewBox="0 0 8 8"
            fill="currentColor"
          >
            <path d="M4 6L1 2h6L4 6z" />
          </svg>
        </button>

        <div className="mx-1 h-4 w-px bg-gray-600" />

        {/* Bold */}
        <button
          onClick={handleBoldToggle}
          className={cn(
            "rounded p-2 transition-all",
            "hover:bg-gray-700",
            isBold && "bg-violet-600",
          )}
          title="Bold"
        >
          <Bold className="h-4 w-4 text-white" />
        </button>

        {/* Strikethrough */}
        <button
          onClick={handleStrikethroughToggle}
          className={cn(
            "rounded p-2 transition-all",
            "hover:bg-gray-700",
            isStrikethrough && "bg-violet-600",
          )}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4 text-white" />
        </button>
      </div>

      {/* Dropdown Panels */}
      <div
        className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
        style={{
          top: dropdownAbove ? "auto" : "100%",
          bottom: dropdownAbove ? "100%" : "auto",
          marginTop: dropdownAbove ? 0 : 8,
          marginBottom: dropdownAbove ? 8 : 0,
        }}
      >
        {/* Text Color Panel */}
        {activePanel === "textColor" && (
          <div className="rounded-lg bg-gray-800 p-3 shadow-lg">
            {/* Custom colors history */}
            {customColors.length > 0 && (
              <div className="mb-2 border-b border-gray-700 pb-2">
                <div className="mb-1.5 text-xs text-gray-400">Recent</div>
                <div className="flex gap-1.5">
                  {customColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleColorSelect(color)}
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
              {TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorSelect(color)}
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
                onApply={(color) => {
                  onUpdate({ textColor: color });
                  addIfNotInPalette(color, TEXT_COLORS);
                  setActivePanel(null);
                }}
                onClose={() => setShowCustomPicker(false)}
              />
            )}
          </div>
        )}

        {/* Font Family Panel */}
        {activePanel === "fontFamily" && (
          <div className="flex min-w-[140px] flex-col gap-1 rounded-lg bg-gray-800 px-2 py-1.5 shadow-lg">
            {FONT_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleFontSelect(value)}
                className={cn(
                  "rounded px-3 py-1.5 text-left text-sm transition-all",
                  "text-white hover:bg-gray-700",
                  currentFont === value && "bg-violet-600",
                )}
                style={{ fontFamily: value }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Font Size Panel */}
        {activePanel === "fontSize" && (
          <div className="flex min-w-[100px] flex-col gap-1 rounded-lg bg-gray-800 px-2 py-1.5 shadow-lg">
            {SIZE_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleSizeSelect(value)}
                className={cn(
                  "flex items-center justify-between rounded px-3 py-1.5 text-sm transition-all",
                  "text-white hover:bg-gray-700",
                  currentSize === value && "bg-violet-600",
                )}
              >
                <span>{label}</span>
                <span className="text-xs text-gray-400">{value}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
