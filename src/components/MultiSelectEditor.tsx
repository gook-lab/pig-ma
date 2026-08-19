import { useCallback, useMemo } from "react";
import { useCanvasStore } from "@/store";
import type { CanvasObject } from "@/types";
import { getObjectBounds } from "@/utils/geometry";
import { calculateOptionsBarPosition } from "@/utils/optionsBar";
import {
  alignObjects,
  distributeObjects,
  isAlignable,
  type AlignDirection,
  type DistributeDirection,
  type ObjectUpdate,
} from "@/utils/align";
import { AlignOptionsBar } from "./AlignOptionsBar";

/** 정렬/분배 옵션바 추정 너비 (버튼 8개 + 구분선 2개) */
const ALIGN_BAR_WIDTH = 340;

/**
 * 다중 선택(2개 이상) 시 정렬/분배 옵션바를 표시하는 Editor.
 * `__group:` 가상 마커(섹션 선택)는 제외한다.
 */
export function MultiSelectEditor() {
  const objects = useCanvasStore((s) => s.objects);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const viewport = useCanvasStore((s) => s.viewport);
  const isLocked = useCanvasStore((s) => s.isLocked);
  const editingTextId = useCanvasStore((s) => s.editingTextId);

  const selectedObjects = useMemo(() => {
    const realIds = selectedIds.filter((id) => !id.startsWith("__group:"));
    if (realIds.length < 2) return [];
    const idSet = new Set(realIds);
    return objects.filter((o) => idSet.has(o.id));
  }, [objects, selectedIds]);

  const alignableCount = useMemo(
    () => selectedObjects.filter(isAlignable).length,
    [selectedObjects],
  );

  /** 여러 객체 이동을 한 번의 set 으로 반영 → undo 한 단계로 묶임 */
  const applyUpdates = useCallback((updates: ObjectUpdate[]) => {
    if (updates.length === 0) return;
    const changesById = new Map(updates.map((u) => [u.id, u.changes]));
    useCanvasStore.setState((state) => ({
      objects: state.objects.map((o) => {
        const changes = changesById.get(o.id);
        return changes ? { ...o, ...changes } : o;
      }),
    }));
  }, []);

  const handleAlign = useCallback(
    (direction: AlignDirection) => {
      applyUpdates(alignObjects(selectedObjects, direction));
    },
    [selectedObjects, applyUpdates],
  );

  const handleDistribute = useCallback(
    (direction: DistributeDirection) => {
      applyUpdates(distributeObjects(selectedObjects, direction));
    },
    [selectedObjects, applyUpdates],
  );

  if (isLocked || editingTextId) return null;
  if (alignableCount < 2) return null;

  // 선택 전체 바운딩 박스 기준으로 옵션바 위치 계산
  const combined = selectionBounds(selectedObjects);
  const position = calculateOptionsBarPosition({
    element: combined,
    viewport,
    barWidth: ALIGN_BAR_WIDTH,
  });

  return (
    <AlignOptionsBar
      position={position}
      canDistribute={alignableCount >= 3}
      onAlign={handleAlign}
      onDistribute={handleDistribute}
    />
  );
}

function selectionBounds(objects: CanvasObject[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const obj of objects) {
    const b = getObjectBounds(obj);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
