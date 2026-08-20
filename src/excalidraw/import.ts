import type { CanvasObject } from "@/types";
import { useCanvasStore } from "@/store";
import { validateCanvasObject } from "@/schemas";
import { convertExcalidraw, parseExcalidrawFile } from "./mapper";
import { ExcalidrawImportError } from "./types";

// ============================================================================
// Excalidraw import — store 적용
// ============================================================================

export interface ExcalidrawImportSummary {
  importedCount: number;
  groupCount: number;
  skippedCount: number;
}

/** 객체 하나의 캔버스 상 바운딩 박스 (커넥터/라인 포함) */
function objectBounds(obj: CanvasObject): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  if (obj.type === "connector") {
    const endX = obj.endX ?? obj.x;
    const endY = obj.endY ?? obj.y;
    return {
      minX: Math.min(obj.x, endX),
      minY: Math.min(obj.y, endY),
      maxX: Math.max(obj.x, endX),
      maxY: Math.max(obj.y, endY),
    };
  }
  if (obj.type === "line" && obj.points && obj.points.length >= 2) {
    let minDx = Infinity,
      minDy = Infinity,
      maxDx = -Infinity,
      maxDy = -Infinity;
    for (let i = 0; i + 1 < obj.points.length; i += 2) {
      minDx = Math.min(minDx, obj.points[i]!);
      maxDx = Math.max(maxDx, obj.points[i]!);
      minDy = Math.min(minDy, obj.points[i + 1]!);
      maxDy = Math.max(maxDy, obj.points[i + 1]!);
    }
    return {
      minX: obj.x + minDx,
      minY: obj.y + minDy,
      maxX: obj.x + maxDx,
      maxY: obj.y + maxDy,
    };
  }
  return {
    minX: obj.x,
    minY: obj.y,
    maxX: obj.x + (obj.width ?? 0),
    maxY: obj.y + (obj.height ?? 0),
  };
}

/**
 * .excalidraw JSON 문자열을 파싱하여 현재 캔버스에 추가한다.
 * 가져온 요소들은 현재 뷰포트 중앙에 배치된다 (기존 객체는 유지).
 * 실패 시 ExcalidrawImportError.
 */
export function importExcalidrawToCanvas(
  json: string,
): ExcalidrawImportSummary {
  const data = parseExcalidrawFile(json);
  const converted = convertExcalidraw(data);
  const { groups } = converted;

  // 매퍼 출력이라 대부분 정상이지만, 손상된 입력이 그대로 통과해 store 로
  // 들어가면 렌더 경로에서 캔버스 전체가 죽을 수 있다 — 입구에서 거른다.
  const objects = converted.objects.filter(
    (obj) => validateCanvasObject(obj).success,
  );
  const skippedCount =
    converted.skippedCount + (converted.objects.length - objects.length);

  if (objects.length === 0) {
    throw new ExcalidrawImportError("No importable elements found");
  }

  // 뷰포트 중앙 배치 (FigmaImportModal 과 동일한 방식)
  const { viewport } = useCanvasStore.getState();
  const centerX = -viewport.x + window.innerWidth / 2 / viewport.zoom;
  const centerY = -viewport.y + window.innerHeight / 2 / viewport.zoom;

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const obj of objects) {
    const b = objectBounds(obj);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  const offsetX = centerX - (minX + maxX) / 2;
  const offsetY = centerY - (minY + maxY) / 2;

  const store = useCanvasStore.getState();
  for (const obj of objects) {
    store.addObject({
      ...obj,
      x: obj.x + offsetX,
      y: obj.y + offsetY,
      endX: obj.endX != null ? obj.endX + offsetX : undefined,
      endY: obj.endY != null ? obj.endY + offsetY : undefined,
    });
  }

  if (groups.length > 0) {
    const shifted = groups.map((g) =>
      g.customBounds
        ? {
            ...g,
            customBounds: {
              ...g.customBounds,
              x: g.customBounds.x + offsetX,
              y: g.customBounds.y + offsetY,
            },
          }
        : g,
    );
    useCanvasStore.setState((state) => ({
      groups: [...state.groups, ...shifted],
    }));
  }

  return {
    importedCount: objects.length,
    groupCount: groups.length,
    skippedCount,
  };
}
