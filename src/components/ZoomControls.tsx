import { Plus, Minus, RotateCcw } from "lucide-react";
import { useCanvasStore } from "@/store";
import { cn } from "@/lib/utils";
import {
  zoomIn as getNextZoom,
  zoomOut as getPrevZoom,
  DEFAULT_ZOOM,
} from "@/constants/zoom";

export function ZoomControls() {
  const { viewport, setViewport, hideUI } = useCanvasStore();

  const handleZoomIn = () => {
    const nextZoom = getNextZoom(viewport.zoom);
    setViewport({ zoom: nextZoom });
  };

  const handleZoomOut = () => {
    const prevZoom = getPrevZoom(viewport.zoom);
    setViewport({ zoom: prevZoom });
  };

  const handleResetZoom = () => {
    setViewport({ zoom: DEFAULT_ZOOM, x: 0, y: 0 });
  };

  // Hide UI mode - hide zoom controls
  if (hideUI) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed right-4 bottom-6 z-50",
        "flex h-10 items-center gap-1 px-2",
        "rounded-xl border border-gray-200 bg-white shadow-lg",
        "dark:border-[#c0c1c4] dark:bg-[#d6d7da]",
      )}
    >
      <button
        onClick={handleZoomOut}
        className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-[#c8c9cc]"
        title="Zoom Out"
      >
        <Minus className="h-4 w-4" />
      </button>

      <button
        onClick={handleZoomIn}
        className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-[#c8c9cc]"
        title="Zoom In"
      >
        <Plus className="h-4 w-4" />
      </button>

      {viewport.zoom !== DEFAULT_ZOOM && (
        <>
          <div className="mx-0.5 h-6 w-px bg-gray-200 dark:bg-[#b8b9bc]" />
          <button
            onClick={handleResetZoom}
            className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-[#c8c9cc]"
            title="Reset View (100%)"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}
