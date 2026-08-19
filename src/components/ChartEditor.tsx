import { useCallback, useMemo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store";
import { ChartRightPanel } from "./ChartRightPanel";
import { Z_TEXT_INPUT } from "@/constants/zIndex";
import type { CanvasObject } from "@/types";

const CHART_HEADER_HEIGHT = 28;

export function ChartEditor() {
  const objects = useCanvasStore((s) => s.objects);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const viewport = useCanvasStore((s) => s.viewport);
  const updateObject = useCanvasStore((s) => s.updateObject);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const editingChartTitleId = useCanvasStore((s) => s.editingChartTitleId);
  const setEditingChartTitleId = useCanvasStore(
    (s) => s.setEditingChartTitleId,
  );
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Find if a single chart is selected
  const selectedChart = useMemo(() => {
    if (selectedIds.length !== 1) return undefined;
    const obj = objects.find((o) => o.id === selectedIds[0]);
    if (obj && obj.type === "chart") {
      return obj;
    }
    return undefined;
  }, [objects, selectedIds]);

  const isEditingTitle =
    editingChartTitleId !== null && selectedChart?.id === editingChartTitleId;

  // Listen for header double-click event
  useEffect(() => {
    const handleTitleEdit = (e: CustomEvent<{ id: string }>) => {
      // Check if this chart is selected (compare IDs, not object reference)
      if (selectedIds.length === 1 && e.detail.id === selectedIds[0]) {
        setEditingChartTitleId(e.detail.id);
      }
    };

    window.addEventListener(
      "chart-edit-title" as string,
      handleTitleEdit as EventListener,
    );
    return () => {
      window.removeEventListener(
        "chart-edit-title" as string,
        handleTitleEdit as EventListener,
      );
    };
  }, [selectedIds, setEditingChartTitleId]);

  // Focus title input when editing starts
  useEffect(() => {
    if (isEditingTitle) {
      // Use setTimeout to ensure the input is fully rendered and DOM is settled
      const timerId = setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.focus();
          titleInputRef.current.select();
        }
      }, 50);
      return () => clearTimeout(timerId);
    }
  }, [isEditingTitle]);

  // Reset title editing only when a different chart is selected
  const prevSelectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentId = selectedIds.length === 1 ? selectedIds[0] ?? null : null;
    if (
      prevSelectedIdRef.current !== null &&
      prevSelectedIdRef.current !== currentId
    ) {
      setEditingChartTitleId(null);
    }
    prevSelectedIdRef.current = currentId;
  }, [selectedIds, setEditingChartTitleId]);

  const handleUpdate = useCallback(
    (updates: Partial<CanvasObject>) => {
      if (selectedChart) {
        updateObject(selectedChart.id, updates);
      }
    },
    [selectedChart, updateObject],
  );

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (selectedChart) {
        updateObject(selectedChart.id, { chartTitle: e.target.value });
      }
    },
    [selectedChart, updateObject],
  );

  const handleTitleSubmit = useCallback(() => {
    setEditingChartTitleId(null);
  }, [setEditingChartTitleId]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Enter" || e.key === "Escape") {
        handleTitleSubmit();
      }
    },
    [handleTitleSubmit],
  );

  const handleCloseRightPanel = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // Don't render if no chart selected or if chart is locked
  if (!selectedChart || selectedChart.locked) return null;

  const showHeader = selectedChart.chartShowHeader !== false;

  // Calculate title input position
  const screenX = selectedChart.x * viewport.zoom + viewport.x;
  const screenY = selectedChart.y * viewport.zoom + viewport.y;
  const screenWidth = (selectedChart.width ?? 200) * viewport.zoom;
  const headerHeight = CHART_HEADER_HEIGHT * viewport.zoom;

  return (
    <>
      {/* Title Editor Overlay */}
      {isEditingTitle && showHeader && (
        <>
          {/* Header background zone to prevent deselection */}
          <div
            className="pointer-events-auto fixed"
            style={{
              left: screenX,
              top: screenY,
              width: screenWidth,
              height: headerHeight,
              zIndex: Z_TEXT_INPUT - 1,
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          />
          {/* Title input */}
          <input
            ref={titleInputRef}
            type="text"
            autoFocus
            value={selectedChart.chartTitle ?? ""}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            onBlur={handleTitleSubmit}
            placeholder={
              selectedChart.chartData?.variant === "bar"
                ? "Bar Chart"
                : selectedChart.chartData?.variant === "line"
                  ? "Line Chart"
                  : "Pie Chart"
            }
            className={cn(
              "pointer-events-auto fixed bg-transparent",
              "outline-none border-b border-violet-500",
              "font-sans cursor-text",
            )}
            style={{
              left: screenX + 8 * viewport.zoom,
              top: screenY + 5 * viewport.zoom,
              width: screenWidth - 40 * viewport.zoom,
              height: 18 * viewport.zoom,
              fontSize: `${11 * viewport.zoom}px`,
              zIndex: Z_TEXT_INPUT,
              color: "#374151",
              caretColor: "#1e1e1e",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          />
        </>
      )}

      {/* ChartRightPanel handles both global and individual selection modes */}
      <ChartRightPanel
        shape={selectedChart}
        onUpdate={handleUpdate}
        onClose={handleCloseRightPanel}
      />
    </>
  );
}
