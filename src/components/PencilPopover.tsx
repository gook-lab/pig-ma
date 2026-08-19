import { Eraser } from "lucide-react";
import { useCanvasStore } from "@/store";
import { cn } from "@/lib/utils";
import type { EraserSize } from "@/types";

const ERASER_SIZES: { id: EraserSize; label: string; size: number }[] = [
  { id: "small", label: "작게", size: 10 },
  { id: "medium", label: "중간", size: 25 },
  { id: "large", label: "크게", size: 50 },
];

const COLORS = [
  "#1f2937", // dark gray (almost black)
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
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
      {/* Marker body */}
      <rect x="8" y="4" width="16" height="24" rx="2" fill={color} />
      {/* Marker tip */}
      <path d="M12 28 L16 38 L20 28 Z" fill={color} />
      {/* Cap highlight */}
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
      {/* Highlighter body - angled */}
      <rect
        x="6"
        y="2"
        width="20"
        height="28"
        rx="3"
        fill={color}
        opacity="0.7"
      />
      {/* Chisel tip */}
      <path d="M8 30 L24 30 L20 38 L12 38 Z" fill={color} opacity="0.7" />
      {/* Body stripe */}
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

export function PencilPopover() {
  const {
    tool,
    setTool,
    penSettings,
    setPenSettings,
    eraserSize,
    setEraserSize,
  } = useCanvasStore();

  // Show for both pencil and eraser tools
  if (tool !== "pencil" && tool !== "eraser") return null;

  const currentColor = penSettings.strokeColor;

  const handleEraserSelect = (size: EraserSize) => {
    setEraserSize(size);
    setTool("eraser");
  };

  return (
    <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {/* Pen Types */}
      <div
        className={cn(
          "flex items-center gap-1 px-3 py-2",
          "rounded-xl border border-gray-200 bg-white shadow-lg",
        )}
      >
        {/* Pen */}
        <button
          onClick={() => {
            setPenSettings({ penType: "pen" });
            setTool("pencil");
          }}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-all",
            "hover:border-gray-300 hover:bg-gray-50",
            tool === "pencil" && penSettings.penType === "pen"
              ? "border-violet-500 bg-violet-50"
              : "border-gray-200",
          )}
          title="Pen"
        >
          <MarkerIcon className="h-8 w-5" color={currentColor} />
        </button>

        {/* Marker */}
        <button
          onClick={() => {
            setPenSettings({ penType: "marker" });
            setTool("pencil");
          }}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-all",
            "hover:border-gray-300 hover:bg-gray-50",
            tool === "pencil" && penSettings.penType === "marker"
              ? "border-violet-500 bg-violet-50"
              : "border-gray-200",
          )}
          title="Marker"
        >
          <MarkerIcon className="h-9 w-6" color={currentColor} />
        </button>

        {/* Highlighter - always show current color */}
        <button
          onClick={() => {
            setPenSettings({ penType: "highlighter" });
            setTool("pencil");
          }}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-all",
            "hover:border-gray-300 hover:bg-gray-50",
            tool === "pencil" && penSettings.penType === "highlighter"
              ? "border-violet-500 bg-violet-50"
              : "border-gray-200",
          )}
          title="Highlighter"
        >
          <HighlighterIcon className="h-9 w-6" color={currentColor} />
        </button>

        {/* Divider */}
        <div className="mx-1 h-10 w-px bg-gray-200" />

        {/* Eraser Sizes - standardized button size with border */}
        {ERASER_SIZES.map(({ id, label, size }) => (
          <button
            key={id}
            onClick={() => handleEraserSelect(id)}
            className={cn(
              "flex h-10 w-10 flex-col items-center justify-center gap-0.5 rounded-lg border-2 transition-all",
              "hover:border-gray-300 hover:bg-gray-50",
              tool === "eraser" && eraserSize === id
                ? "border-violet-500 bg-violet-50"
                : "border-gray-200",
            )}
            title={`지우개 - ${label}`}
          >
            <Eraser
              className="text-gray-600"
              style={{ width: 14 + size / 5, height: 14 + size / 5 }}
            />
            <span className="text-[8px] text-gray-500">{label}</span>
          </button>
        ))}

        {/* Divider */}
        <div className="mx-1 h-10 w-px bg-gray-200" />

        {/* Colors - standardized size (w-6 h-6 to match shape popover) */}
        {COLORS.map((color) => (
          <button
            key={color}
            onClick={() => setPenSettings({ strokeColor: color })}
            className={cn(
              "h-6 w-6 rounded-full border-2 transition-all",
              penSettings.strokeColor === color
                ? "scale-110 border-violet-500"
                : "border-transparent hover:scale-105",
            )}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}

        {/* Color wheel / custom picker */}
        <label
          className={cn(
            "h-6 w-6 cursor-pointer rounded-full transition-all hover:scale-105",
            "relative overflow-hidden border-2",
            penSettings.strokeColor && !COLORS.includes(penSettings.strokeColor)
              ? "border-violet-500"
              : "border-transparent",
          )}
          style={{
            background:
              "conic-gradient(from 0deg, #ef4444, #eab308, #22c55e, #3b82f6, #8b5cf6, #ef4444)",
          }}
          title="Custom color"
        >
          <input
            type="color"
            value={penSettings.strokeColor}
            onChange={(e) => setPenSettings({ strokeColor: e.target.value })}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  );
}
