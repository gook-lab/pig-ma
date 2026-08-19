/**
 * 줌 레벨 상수 (60단계)
 * 10% ~ 800% 범위 (FigJam 스타일)
 */

// 줌 레벨 배열 (퍼센트 값) - 10% ~ 800%
// FigJam 스타일: 메모 기준 최대 화면 절반, 최소 점처럼 보이는 수준
export const ZOOM_LEVELS_PERCENT = [
  // 10% ~ 50%: 줌 아웃 구간 (11단계)
  10, 12, 15, 17, 20, 25, 30, 33, 40, 45, 50,
  // 50% ~ 100%: 일반 작업 구간 (10단계)
  55, 60, 67, 70, 75, 80, 85, 90, 95, 100,
  // 100% ~ 400%: 15% 단위 확대 구간 (20단계)
  115, 130, 145, 160, 175, 190, 205, 220, 235, 250, 265, 280, 295, 310, 325,
  340, 355, 370, 385, 400,
  // 400% ~ 800%: 고배율 작업 구간 (20단계)
  420, 440, 460, 480, 500, 520, 540, 560, 580, 600, 620, 640, 660, 680, 700,
  720, 740, 760, 780, 800,
] as const;

// 줌 레벨 배열 (실제 값, 1.0 = 100%)
export const ZOOM_LEVELS = ZOOM_LEVELS_PERCENT.map((p) => p / 100);

// 기본 줌 레벨 (100%)
export const DEFAULT_ZOOM = 1.0;

// 최소/최대 줌
export const MIN_ZOOM = ZOOM_LEVELS[0]; // 0.1 (10%)
export const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1]; // 4.0 (400%)

// 기본 줌 인덱스 (100% = index 7)
export const DEFAULT_ZOOM_INDEX = ZOOM_LEVELS.indexOf(1.0);

/**
 * 현재 줌에서 다음 단계로 이동
 */
export function zoomIn(currentZoom: number): number {
  const currentIndex = findClosestZoomIndex(currentZoom);
  const nextIndex = Math.min(currentIndex + 1, ZOOM_LEVELS.length - 1);
  return ZOOM_LEVELS[nextIndex];
}

/**
 * 현재 줌에서 이전 단계로 이동
 */
export function zoomOut(currentZoom: number): number {
  const currentIndex = findClosestZoomIndex(currentZoom);
  const prevIndex = Math.max(currentIndex - 1, 0);
  return ZOOM_LEVELS[prevIndex];
}

/**
 * 현재 줌에 가장 가까운 줌 레벨 인덱스 찾기
 */
export function findClosestZoomIndex(zoom: number): number {
  let closestIndex = 0;
  let closestDiff = Math.abs(ZOOM_LEVELS[0] - zoom);

  for (let i = 1; i < ZOOM_LEVELS.length; i++) {
    const diff = Math.abs(ZOOM_LEVELS[i] - zoom);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestIndex = i;
    }
  }

  return closestIndex;
}

/**
 * 줌 값을 가장 가까운 줌 레벨로 스냅
 */
export function snapToZoomLevel(zoom: number): number {
  return ZOOM_LEVELS[findClosestZoomIndex(zoom)];
}

/**
 * 줌 퍼센트 문자열 반환
 */
export function getZoomPercent(zoom: number): number {
  return Math.round(zoom * 100);
}
