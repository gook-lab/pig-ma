import type { CanvasObject } from "@/types";
import type { Bounds } from "./geometry";
import { getObjectBounds } from "./geometry";
import { translateElbowBends } from "./translateElbowBends";

// ============================================================================
// 정렬/분배 (Align & Distribute)
//
// 다중 선택된 객체들의 이동량을 계산하는 순수 함수.
// 실제 store 반영은 호출부(MultiSelectEditor)에서 한 번의 set 으로 수행한다.
// ============================================================================

export type AlignDirection =
  | "left"
  | "centerX"
  | "right"
  | "top"
  | "centerY"
  | "bottom";

export type DistributeDirection = "horizontal" | "vertical";

export interface ObjectUpdate {
  id: string;
  changes: Partial<CanvasObject>;
}

/** 정렬/분배에서 제외할 객체 — 잠김, 도형에 붙은 커넥터(도형을 따라가므로) */
export function isAlignable(obj: CanvasObject): boolean {
  if (obj.locked) return false;
  if (obj.type === "connector" && (obj.sourceId || obj.targetId)) return false;
  if (obj.type === "connectorLabel") return false;
  return true;
}

/**
 * 정렬용 경계 — getObjectBounds 의 히트영역 패딩(strokeWidth 기반) 없이
 * 실제 기하 경계로 계산한다. 패딩이 있으면 정렬 결과가 수 px 어긋난다.
 */
function alignBounds(obj: CanvasObject): Bounds {
  if (obj.type === "connector") {
    const endX = obj.endX ?? obj.x;
    const endY = obj.endY ?? obj.y;
    return {
      x: Math.min(obj.x, endX),
      y: Math.min(obj.y, endY),
      width: Math.abs(endX - obj.x),
      height: Math.abs(endY - obj.y),
    };
  }
  if (obj.type === "line" && obj.points && obj.points.length >= 2) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (let i = 0; i + 1 < obj.points.length; i += 2) {
      minX = Math.min(minX, obj.points[i]!);
      maxX = Math.max(maxX, obj.points[i]!);
      minY = Math.min(minY, obj.points[i + 1]!);
      maxY = Math.max(maxY, obj.points[i + 1]!);
    }
    return {
      x: obj.x + minX,
      y: obj.y + minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }
  return getObjectBounds(obj);
}

/** 객체를 dx/dy 만큼 이동시키는 변경분 (커넥터는 끝점 포함) */
function moveChanges(
  obj: CanvasObject,
  dx: number,
  dy: number,
): Partial<CanvasObject> {
  const changes: Partial<CanvasObject> = {
    x: obj.x + dx,
    y: obj.y + dy,
  };
  if (obj.type === "connector") {
    if (obj.endX != null) changes.endX = obj.endX + dx;
    if (obj.endY != null) changes.endY = obj.endY + dy;
    // 엘보우 꺾임점(절대좌표)도 강체 이동 — 안 하면 정렬 시 모양이 찌그러진다
    if (obj.elbowBends?.length) {
      changes.elbowBends = translateElbowBends(obj.elbowBends, dx, dy);
    }
  }
  return changes;
}

/**
 * 선택 영역 기준 정렬. 대상이 2개 미만이면 빈 배열.
 */
export function alignObjects(
  objects: CanvasObject[],
  direction: AlignDirection,
): ObjectUpdate[] {
  const targets = objects.filter(isAlignable);
  if (targets.length < 2) return [];

  const boundsList = targets.map((obj) => ({
    obj,
    bounds: alignBounds(obj),
  }));
  const minX = Math.min(...boundsList.map((b) => b.bounds.x));
  const minY = Math.min(...boundsList.map((b) => b.bounds.y));
  const maxX = Math.max(...boundsList.map((b) => b.bounds.x + b.bounds.width));
  const maxY = Math.max(...boundsList.map((b) => b.bounds.y + b.bounds.height));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const updates: ObjectUpdate[] = [];
  for (const { obj, bounds } of boundsList) {
    let dx = 0;
    let dy = 0;
    switch (direction) {
      case "left":
        dx = minX - bounds.x;
        break;
      case "centerX":
        dx = centerX - (bounds.x + bounds.width / 2);
        break;
      case "right":
        dx = maxX - (bounds.x + bounds.width);
        break;
      case "top":
        dy = minY - bounds.y;
        break;
      case "centerY":
        dy = centerY - (bounds.y + bounds.height / 2);
        break;
      case "bottom":
        dy = maxY - (bounds.y + bounds.height);
        break;
    }
    if (dx !== 0 || dy !== 0) {
      updates.push({ id: obj.id, changes: moveChanges(obj, dx, dy) });
    }
  }
  return updates;
}

/**
 * 등간격 분배. 양 끝 객체는 고정하고 사이 간격을 균등하게 만든다.
 * 대상이 3개 미만이면 빈 배열.
 */
export function distributeObjects(
  objects: CanvasObject[],
  direction: DistributeDirection,
): ObjectUpdate[] {
  const targets = objects.filter(isAlignable);
  if (targets.length < 3) return [];

  const horizontal = direction === "horizontal";
  const boundsList = targets
    .map((obj) => ({ obj, bounds: alignBounds(obj) }))
    .sort((a, b) =>
      horizontal ? a.bounds.x - b.bounds.x : a.bounds.y - b.bounds.y,
    );

  const first = boundsList[0]!.bounds;
  const last = boundsList[boundsList.length - 1]!.bounds;
  const spanStart = horizontal ? first.x : first.y;
  const spanEnd = horizontal ? last.x + last.width : last.y + last.height;
  const totalSize = boundsList.reduce(
    (sum, b) => sum + (horizontal ? b.bounds.width : b.bounds.height),
    0,
  );
  const gap = (spanEnd - spanStart - totalSize) / (boundsList.length - 1);

  const updates: ObjectUpdate[] = [];
  let cursor = spanStart;
  for (const { obj, bounds } of boundsList) {
    const current = horizontal ? bounds.x : bounds.y;
    const delta = cursor - current;
    if (delta !== 0) {
      updates.push({
        id: obj.id,
        changes: horizontal
          ? moveChanges(obj, delta, 0)
          : moveChanges(obj, 0, delta),
      });
    }
    cursor += (horizontal ? bounds.width : bounds.height) + gap;
  }
  return updates;
}
