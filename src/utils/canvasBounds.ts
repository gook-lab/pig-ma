import type { CanvasObject, CanvasBounds } from "@/types";

// 기본 캔버스 크기 (100% 줌 기준)
export const BASE_CANVAS_WIDTH = 1280;
export const BASE_CANVAS_HEIGHT = 720;

// 줌 상수 (FigJam 스타일)
// 1.0 = 100%, 0.1 = 10%, 8.0 = 800%
export const BASE_ZOOM = 1.0; // 내부 줌 1.0 = 표시 100%
export const MIN_ZOOM = 0.1; // 최소 줌 (10%)
export const MAX_ZOOM = 8.0; // 최대 줌 (800%)
export const ZOOM_MULTIPLIER = 2; // 배수 (2배)

/**
 * 캔버스 범위 계산 (FigJam 스타일 - 무한 캔버스)
 * - 모든 방향으로 자유롭게 확장 가능
 * - 객체가 있는 영역 + 여유 공간 포함
 */
export function calculateCanvasBounds(
  objects: CanvasObject[],
  zoom: number,
  stageWidth: number,
  stageHeight: number,
): CanvasBounds {
  // 현재 줌에서 볼 수 있는 영역
  const viewportWidth = stageWidth / zoom;
  const viewportHeight = stageHeight / zoom;

  // 기본 범위: 뷰포트 크기의 2배 (양방향으로)
  let minX = -viewportWidth;
  let minY = -viewportHeight;
  let maxX = viewportWidth;
  let maxY = viewportHeight;

  // 객체들이 있으면 해당 방향으로 확장
  objects.forEach((obj) => {
    const x = obj.x;
    const y = obj.y;
    const width = obj.width ?? 100;
    const height = obj.height ?? 100;

    minX = Math.min(minX, x - 200);
    minY = Math.min(minY, y - 200);
    maxX = Math.max(maxX, x + width + 200);
    maxY = Math.max(maxY, y + height + 200);
  });

  return { minX, minY, maxX, maxY };
}

/**
 * 미니맵/스크롤바용 캔버스 범위 계산 (FigJam 스타일)
 * - 모든 방향으로 확장 가능
 * - 객체가 있는 영역 + 여유 공간 포함
 */
export function calculateMinimapBounds(
  objects: CanvasObject[],
  stageWidth: number,
  stageHeight: number,
): CanvasBounds {
  // 기본 범위: 화면 크기 기준 (양방향)
  let minX = -stageWidth;
  let minY = -stageHeight;
  let maxX = stageWidth;
  let maxY = stageHeight;

  // 객체들이 있으면 해당 방향으로 확장
  objects.forEach((obj) => {
    const x = obj.x;
    const y = obj.y;
    const width = obj.width ?? 100;
    const height = obj.height ?? 100;

    minX = Math.min(minX, x - 200);
    minY = Math.min(minY, y - 200);
    maxX = Math.max(maxX, x + width + 200);
    maxY = Math.max(maxY, y + height + 200);
  });

  return { minX, minY, maxX, maxY };
}

/**
 * 뷰포트 위치를 bounds 내로 클램프
 */
export function clampViewportToBounds(
  viewportX: number,
  viewportY: number,
  zoom: number,
  stageWidth: number,
  stageHeight: number,
  bounds: CanvasBounds,
): { x: number; y: number } {
  // 뷰포트의 캔버스 좌표 범위
  const viewportWidth = stageWidth / zoom;
  const viewportHeight = stageHeight / zoom;

  // 뷰포트 좌상단의 캔버스 좌표
  const viewportLeft = -viewportX / zoom;
  const viewportTop = -viewportY / zoom;

  // bounds 내로 클램프
  const clampedLeft = Math.max(
    bounds.minX,
    Math.min(bounds.maxX - viewportWidth, viewportLeft),
  );
  const clampedTop = Math.max(
    bounds.minY,
    Math.min(bounds.maxY - viewportHeight, viewportTop),
  );

  // 다시 viewport 좌표로 변환
  return {
    x: -clampedLeft * zoom,
    y: -clampedTop * zoom,
  };
}
