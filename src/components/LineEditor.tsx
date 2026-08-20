import { useCallback, useMemo } from "react";
import { useCanvasStore } from "@/store";
import { toPointArray } from "@/utils/geometry";
import { LineOptionsBar } from "./LineOptionsBar";
import { calculateOptionsBarPositionForPoints } from "@/utils/optionsBar";
import type { CanvasObject } from "@/types";

export function LineEditor() {
  const { objects, selectedIds, viewport, updateObject } = useCanvasStore();

  // Find if a single line (pencil drawing) is selected
  const selectedLine = useMemo(() => {
    if (selectedIds.length !== 1) return undefined;
    const obj = objects.find((o) => o.id === selectedIds[0]);
    return obj?.type === "line" ? obj : undefined;
  }, [objects, selectedIds]);

  // Calculate the position for the options bar (below or above depending on screen position)
  const getBarPosition = useCallback(() => {
    if (!selectedLine) return { x: 0, y: 0, above: false };

    const points = toPointArray(selectedLine.points);
    if (points.length < 2) return { x: 0, y: 0, above: false };

    return calculateOptionsBarPositionForPoints({
      baseX: selectedLine.x,
      baseY: selectedLine.y,
      points,
      viewport,
    });
  }, [selectedLine, viewport]);

  const handleUpdate = useCallback(
    (updates: Partial<CanvasObject>) => {
      if (selectedLine) {
        updateObject(selectedLine.id, updates);
      }
    },
    [selectedLine, updateObject],
  );

  // Don't show options bar for locked lines
  if (!selectedLine || selectedLine.locked) return null;

  const position = getBarPosition();

  return (
    <LineOptionsBar
      line={selectedLine}
      position={position}
      onUpdate={handleUpdate}
    />
  );
}
