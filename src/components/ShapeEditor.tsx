import { useCallback, useMemo } from "react";
import { useCanvasStore } from "@/store";
import { ShapeOptionsBar } from "./ShapeOptionsBar";
import { calculateOptionsBarPosition } from "@/utils/optionsBar";
import type { CanvasObject } from "@/types";
import { isShape } from "@/utils/typeGuards";
import toast from "react-hot-toast";

export function ShapeEditor() {
  const {
    objects,
    selectedIds,
    viewport,
    updateObject,
    editingTextId,
    lockObjects,
    unlockObjects,
    activeEditor,
  } = useCanvasStore();

  // Find if a single shape is selected
  const selectedShape = useMemo(() => {
    if (selectedIds.length !== 1) return undefined;
    const obj = objects.find((o) => o.id === selectedIds[0]);
    if (obj && isShape(obj)) {
      return obj;
    }
    return undefined;
  }, [objects, selectedIds]);

  // Find shape being edited (for text editing mode)
  const editingShape = useMemo(() => {
    if (!editingTextId) return undefined;
    const obj = objects.find((o) => o.id === editingTextId);
    if (obj && isShape(obj)) {
      return obj;
    }
    return undefined;
  }, [objects, editingTextId]);

  // Show options bar when shape is selected OR when editing shape text
  // 다중 선택 시에는 옵션바 숨김
  const targetShape = selectedShape ?? editingShape;
  const isMultiSelect = selectedIds.length > 1;
  const shouldShowOptionsBar = !!targetShape && !isMultiSelect;

  // Calculate the position for the options bar (below or above depending on screen position)
  const getBarPosition = useCallback(() => {
    if (!targetShape) return { x: 0, y: 0, above: false };

    return calculateOptionsBarPosition({
      element: {
        x: targetShape.x,
        y: targetShape.y,
        width: targetShape.width ?? 100,
        height: targetShape.height ?? 100,
      },
      viewport,
    });
  }, [targetShape, viewport]);

  const handleUpdate = useCallback(
    (updates: Partial<CanvasObject>) => {
      if (targetShape) {
        updateObject(targetShape.id, updates);
      }
    },
    [targetShape, updateObject],
  );

  const handleLock = useCallback(() => {
    if (targetShape) {
      lockObjects();
      toast.success("잠금되었습니다", {
        duration: 1500,
        position: "bottom-center",
      });
    }
  }, [targetShape, lockObjects]);

  const handleUnlock = useCallback(() => {
    if (targetShape) {
      unlockObjects();
      toast.success("잠금 해제되었습니다", {
        duration: 1500,
        position: "bottom-center",
      });
    }
  }, [targetShape, unlockObjects]);

  // Show options bar for selected shapes (including locked ones)
  if (!shouldShowOptionsBar || !targetShape) return null;

  const position = getBarPosition();

  return (
    <ShapeOptionsBar
      shape={targetShape}
      position={position}
      onUpdate={handleUpdate}
      onLock={handleLock}
      onUnlock={handleUnlock}
      tiptapEditor={editingTextId ? activeEditor : null}
    />
  );
}
