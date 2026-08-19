import { useState, useRef, useEffect, useCallback } from "react";
import {
  ChevronDown,
  Grid3X3,
  Square,
  LayoutGrid,
  Eye,
  EyeOff,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store";
import { Z_OPTIONS_BAR } from "@/constants/zIndex";
import { ColorPickerPopup, CustomColorButton } from "./ColorPickerPopup";
import type { GridType } from "@/types";

const GRID_COLORS = [
  "#d4d4d4", // gray (default)
  "#fecaca", // red
  "#fed7aa", // orange
  "#fef08a", // yellow
  "#bbf7d0", // green
  "#bfdbfe", // blue
  "#e9d5ff", // purple
  "#000000", // black
];

interface GridOption {
  type: GridType;
  label: string;
  icon: typeof Grid3X3;
  hasColor: boolean;
}

const GRID_OPTIONS: GridOption[] = [
  { type: "dots", label: "Dot Grid", icon: Grid3X3, hasColor: true },
  { type: "blank", label: "Blank", icon: Square, hasColor: false },
  { type: "lines", label: "Line Grid", icon: LayoutGrid, hasColor: true },
];

export function ViewMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showCustomColorPicker, setShowCustomColorPicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const gridType = useCanvasStore((state) => state.gridType);
  const gridColor = useCanvasStore((state) => state.gridColor);
  const hideUI = useCanvasStore((state) => state.hideUI);
  const setGridType = useCanvasStore((state) => state.setGridType);
  const setGridColor = useCanvasStore((state) => state.setGridColor);
  const toggleHideUI = useCanvasStore((state) => state.toggleHideUI);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowColorPicker(false);
        setShowCustomColorPicker(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleGridTypeSelect = useCallback(
    (type: GridType) => {
      setGridType(type);
      // Don't close menu to allow color selection
    },
    [setGridType],
  );

  const handleColorSelect = useCallback(
    (color: string) => {
      setGridColor(color);
      setShowColorPicker(false);
      setShowCustomColorPicker(false);
    },
    [setGridColor],
  );

  const handleCustomColorApply = useCallback(
    (color: string) => {
      setGridColor(color);
      setShowCustomColorPicker(false);
      setShowColorPicker(false);
    },
    [setGridColor],
  );

  const currentGridOption = GRID_OPTIONS.find((opt) => opt.type === gridType);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium",
          "transition-colors hover:bg-gray-100",
          isOpen && "bg-gray-100",
        )}
      >
        View
        <ChevronDown size={14} className={cn(isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-[#c0c1c4] dark:bg-[#d6d7da]"
          style={{ zIndex: Z_OPTIONS_BAR }}
        >
          {/* Grid Type Section */}
          <div className="px-2 py-1.5 text-xs font-medium text-gray-500 uppercase dark:text-gray-400">
            Canvas Grid
          </div>

          {GRID_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = gridType === option.type;

            return (
              <div key={option.type} className="relative">
                <button
                  onClick={() => handleGridTypeSelect(option.type)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                    "transition-colors hover:bg-gray-50 dark:hover:bg-[#c8c9cc]",
                    "dark:text-gray-800",
                    isSelected &&
                      "bg-violet-50 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
                  )}
                >
                  <Icon size={16} />
                  <span className="flex-1">{option.label}</span>
                  {isSelected && <Check size={14} />}
                </button>

                {/* Color indicator for selected grid type with color support */}
                {isSelected && option.hasColor && (
                  <button
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="absolute top-1/2 right-8 h-4 w-4 -translate-y-1/2 rounded border border-gray-300"
                    style={{ backgroundColor: gridColor }}
                    title="Change grid color"
                  />
                )}
              </div>
            );
          })}

          {/* Color Picker (shown when color button is clicked) */}
          {showColorPicker && currentGridOption?.hasColor && (
            <div className="border-t border-gray-100 px-3 py-2">
              <div className="mb-2 text-xs font-medium text-gray-500">
                Grid Color
              </div>
              <div className="flex flex-wrap gap-1">
                {GRID_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorSelect(color)}
                    className={cn(
                      "h-6 w-6 rounded border-2",
                      gridColor === color
                        ? "border-violet-500"
                        : "border-gray-200 hover:border-gray-400",
                    )}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
                {/* 커스텀 색상 버튼 */}
                <CustomColorButton
                  onClick={() =>
                    setShowCustomColorPicker(!showCustomColorPicker)
                  }
                  isActive={showCustomColorPicker}
                />
              </div>

              {/* 커스텀 색상 피커 팝업 */}
              {showCustomColorPicker && (
                <div className="mt-2">
                  <ColorPickerPopup
                    currentColor={gridColor}
                    onApply={handleCustomColorApply}
                    onClose={() => setShowCustomColorPicker(false)}
                  />
                </div>
              )}
            </div>
          )}

          <div className="my-1 h-px bg-gray-100" />

          {/* UI Visibility Section */}
          <div className="px-2 py-1.5 text-xs font-medium text-gray-500 uppercase">
            Interface
          </div>

          <button
            onClick={() => {
              toggleHideUI();
              setIsOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
              "transition-colors hover:bg-gray-50",
            )}
          >
            {hideUI ? <Eye size={16} /> : <EyeOff size={16} />}
            <span className="flex-1">{hideUI ? "Show UI" : "Hide UI"}</span>
            <span className="text-xs text-gray-400">Cmd+/</span>
          </button>
        </div>
      )}
    </div>
  );
}
