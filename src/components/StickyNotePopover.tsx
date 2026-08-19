import { useCanvasStore } from "@/store";
import { cn } from "@/lib/utils";

const STICKY_NOTE_COLORS = [
  "#fef08a", // yellow
  "#fecaca", // pink/red
  "#bbf7d0", // green
  "#bfdbfe", // blue
  "#e9d5ff", // purple
  "#fed7aa", // orange
];

export function StickyNotePopover() {
  const { tool, stickyNoteColor, setStickyNoteColor } = useCanvasStore();

  // Only show when stickyNote tool is selected
  if (tool !== "stickyNote") return null;

  return (
    <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      <div
        className={cn(
          "flex items-center gap-1.5 px-3 py-2",
          "rounded-xl border border-gray-200 bg-white shadow-lg",
        )}
      >
        {STICKY_NOTE_COLORS.map((color) => (
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
  );
}
