/**
 * 옵션바 위치 계산 유틸리티
 *
 * 모든 옵션바 컴포넌트(TextOptionsBar, ShapeOptionsBar, ConnectorOptionsBar, LineOptionsBar)에서
 * 공통으로 사용하는 위치 계산 로직입니다.
 *
 * 기본 동작: 요소 하단에 표시
 * 하단 툴바와 겹칠 경우: 요소 상단에 표시
 */

import {
  OPTIONS_BAR_OFFSET,
  OPTIONS_BAR_HEIGHT,
  OPTIONS_BAR_TOOLBAR_RESERVED,
  OPTIONS_BAR_WIDTH,
  OPTIONS_BAR_SCREEN_PADDING,
} from "@/constants/zIndex";

/**
 * 옵션바 position에 따른 CSS transform 값을 계산합니다.
 */
export function getOptionsBarTransform(position: OptionsBarPosition): string {
  const { above, align } = position;

  // X 방향 translate
  let translateX: string;
  if (align === "left") {
    translateX = "0";
  } else if (align === "right") {
    translateX = "-100%";
  } else {
    translateX = "-50%";
  }

  // Y 방향 translate
  const translateY = above ? "-100%" : "0";

  return `translate(${translateX}, ${translateY})`;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OptionsBarPosition {
  x: number;
  y: number;
  above: boolean;
  /** 좌우 정렬: 'center' (기본), 'left' (왼쪽 고정), 'right' (오른쪽 고정) */
  align: "center" | "left" | "right";
}

export interface CalculateOptionsBarPositionParams {
  /** 요소의 캔버스 좌표 및 크기 */
  element: ElementBounds;
  /** 현재 뷰포트 상태 */
  viewport: Viewport;
  /** 요소와 옵션바 사이 간격 (기본값: OPTIONS_BAR_OFFSET) */
  offset?: number;
  /** 예상 옵션바 높이 (기본값: OPTIONS_BAR_HEIGHT) */
  barHeight?: number;
  /** 하단 툴바 높이 + 여백 (기본값: OPTIONS_BAR_TOOLBAR_RESERVED) */
  toolbarReservedHeight?: number;
  /** 예상 옵션바 너비 - 좌우 경계 체크용 (기본값: OPTIONS_BAR_WIDTH) */
  barWidth?: number;
  /** 화면 경계 여백 (기본값: OPTIONS_BAR_SCREEN_PADDING) */
  screenPadding?: number;
}

/**
 * 옵션바 위치를 계산합니다.
 *
 * @param params - 위치 계산에 필요한 파라미터
 * @returns 옵션바 위치 (screen 좌표) 및 상단 표시 여부
 *
 * @example
 * ```typescript
 * const position = calculateOptionsBarPosition({
 *   element: { x: shape.x, y: shape.y, width: shape.width, height: shape.height },
 *   viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
 * });
 *
 * // position.x: 화면 X 좌표 (요소 중앙)
 * // position.y: 화면 Y 좌표 (요소 하단 또는 상단)
 * // position.above: true면 상단에 표시
 * ```
 */
export function calculateOptionsBarPosition({
  element,
  viewport,
  offset = OPTIONS_BAR_OFFSET,
  barHeight = OPTIONS_BAR_HEIGHT,
  toolbarReservedHeight = OPTIONS_BAR_TOOLBAR_RESERVED,
  barWidth = OPTIONS_BAR_WIDTH,
  screenPadding = OPTIONS_BAR_SCREEN_PADDING,
}: CalculateOptionsBarPositionParams): OptionsBarPosition {
  // 요소 중앙 X 좌표 (화면 좌표)
  let screenX = (element.x + element.width / 2) * viewport.zoom + viewport.x;

  // 요소 하단 Y 좌표 (화면 좌표)
  const bottomY = element.y + element.height + offset;
  const screenBottomY = bottomY * viewport.zoom + viewport.y;

  // 하단 툴바와 겹치는지 확인
  const wouldOverlapToolbar =
    screenBottomY + barHeight > window.innerHeight - toolbarReservedHeight;

  // Y 좌표 결정
  let screenY: number;
  let above: boolean;

  if (wouldOverlapToolbar) {
    // 요소 상단에 표시
    const topY = element.y - offset;
    screenY = topY * viewport.zoom + viewport.y;
    above = true;
  } else {
    // 기본: 요소 하단에 표시
    screenY = screenBottomY;
    above = false;
  }

  // 좌우 경계 체크
  const halfBarWidth = barWidth / 2;
  let align: "center" | "left" | "right" = "center";

  // 왼쪽 경계 체크: 옵션바 왼쪽이 화면 밖으로 나가는 경우
  if (screenX - halfBarWidth < screenPadding) {
    screenX = screenPadding;
    align = "left";
  }
  // 오른쪽 경계 체크: 옵션바 오른쪽이 화면 밖으로 나가는 경우
  else if (screenX + halfBarWidth > window.innerWidth - screenPadding) {
    screenX = window.innerWidth - screenPadding;
    align = "right";
  }

  return { x: screenX, y: screenY, above, align };
}

/**
 * 원형 요소의 옵션바 위치를 계산합니다.
 * 원은 중심 좌표를 기준으로 하므로 별도 함수로 제공합니다.
 *
 * @param params - 위치 계산에 필요한 파라미터
 * @returns 옵션바 위치 (screen 좌표) 및 상단 표시 여부
 */
export function calculateOptionsBarPositionForCircle({
  centerX,
  centerY,
  radius,
  viewport,
  offset = OPTIONS_BAR_OFFSET,
  barHeight = OPTIONS_BAR_HEIGHT,
  toolbarReservedHeight = OPTIONS_BAR_TOOLBAR_RESERVED,
  barWidth = OPTIONS_BAR_WIDTH,
  screenPadding = OPTIONS_BAR_SCREEN_PADDING,
}: {
  centerX: number;
  centerY: number;
  radius: number;
  viewport: Viewport;
  offset?: number;
  barHeight?: number;
  toolbarReservedHeight?: number;
  barWidth?: number;
  screenPadding?: number;
}): OptionsBarPosition {
  // 원 중앙 X 좌표 (화면 좌표)
  let screenX = centerX * viewport.zoom + viewport.x;

  // 원 하단 Y 좌표 (화면 좌표)
  const bottomY = centerY + radius + offset;
  const screenBottomY = bottomY * viewport.zoom + viewport.y;

  // 하단 툴바와 겹치는지 확인
  const wouldOverlapToolbar =
    screenBottomY + barHeight > window.innerHeight - toolbarReservedHeight;

  // Y 좌표 결정
  let screenY: number;
  let above: boolean;

  if (wouldOverlapToolbar) {
    // 원 상단에 표시
    const topY = centerY - radius - offset;
    screenY = topY * viewport.zoom + viewport.y;
    above = true;
  } else {
    // 기본: 원 하단에 표시
    screenY = screenBottomY;
    above = false;
  }

  // 좌우 경계 체크
  const halfBarWidth = barWidth / 2;
  let align: "center" | "left" | "right" = "center";

  if (screenX - halfBarWidth < screenPadding) {
    screenX = screenPadding;
    align = "left";
  } else if (screenX + halfBarWidth > window.innerWidth - screenPadding) {
    screenX = window.innerWidth - screenPadding;
    align = "right";
  }

  return { x: screenX, y: screenY, above, align };
}

/**
 * 두 점을 연결하는 선(Connector, Line)의 옵션바 위치를 계산합니다.
 *
 * @param params - 위치 계산에 필요한 파라미터
 * @returns 옵션바 위치 (screen 좌표) 및 상단 표시 여부
 */
export function calculateOptionsBarPositionForLine({
  startX,
  startY,
  endX,
  endY,
  viewport,
  offset = OPTIONS_BAR_OFFSET,
  barHeight = OPTIONS_BAR_HEIGHT,
  toolbarReservedHeight = OPTIONS_BAR_TOOLBAR_RESERVED,
  barWidth = OPTIONS_BAR_WIDTH,
  screenPadding = OPTIONS_BAR_SCREEN_PADDING,
}: {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  viewport: Viewport;
  offset?: number;
  barHeight?: number;
  toolbarReservedHeight?: number;
  barWidth?: number;
  screenPadding?: number;
}): OptionsBarPosition {
  // 선 중앙 X 좌표 (화면 좌표)
  const centerX = (startX + endX) / 2;
  let screenX = centerX * viewport.zoom + viewport.x;

  // 선의 최상단/최하단 Y 좌표
  const maxY = Math.max(startY, endY);
  const minY = Math.min(startY, endY);

  // 선 하단 Y 좌표 (화면 좌표)
  const bottomY = maxY + offset;
  const screenBottomY = bottomY * viewport.zoom + viewport.y;

  // 하단 툴바와 겹치는지 확인
  const wouldOverlapToolbar =
    screenBottomY + barHeight > window.innerHeight - toolbarReservedHeight;

  // Y 좌표 결정
  let screenY: number;
  let above: boolean;

  if (wouldOverlapToolbar) {
    // 선 상단에 표시
    const topY = minY - offset;
    screenY = topY * viewport.zoom + viewport.y;
    above = true;
  } else {
    // 기본: 선 하단에 표시
    screenY = screenBottomY;
    above = false;
  }

  // 좌우 경계 체크
  const halfBarWidth = barWidth / 2;
  let align: "center" | "left" | "right" = "center";

  if (screenX - halfBarWidth < screenPadding) {
    screenX = screenPadding;
    align = "left";
  } else if (screenX + halfBarWidth > window.innerWidth - screenPadding) {
    screenX = window.innerWidth - screenPadding;
    align = "right";
  }

  return { x: screenX, y: screenY, above, align };
}

/**
 * 점 배열로 구성된 선(Pencil Drawing)의 옵션바 위치를 계산합니다.
 *
 * @param params - 위치 계산에 필요한 파라미터
 * @returns 옵션바 위치 (screen 좌표) 및 상단 표시 여부
 */
export function calculateOptionsBarPositionForPoints({
  baseX,
  baseY,
  points,
  viewport,
  offset = OPTIONS_BAR_OFFSET,
  barHeight = OPTIONS_BAR_HEIGHT,
  toolbarReservedHeight = OPTIONS_BAR_TOOLBAR_RESERVED,
  barWidth = OPTIONS_BAR_WIDTH,
  screenPadding = OPTIONS_BAR_SCREEN_PADDING,
}: {
  baseX: number;
  baseY: number;
  points: number[];
  viewport: Viewport;
  offset?: number;
  barHeight?: number;
  toolbarReservedHeight?: number;
  barWidth?: number;
  screenPadding?: number;
}): OptionsBarPosition {
  if (points.length < 2) {
    return { x: 0, y: 0, above: false, align: "center" };
  }

  // 점들의 바운딩 박스 계산
  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;

  for (let i = 0; i < points.length; i += 2) {
    const x = points[i]!;
    const y = points[i + 1]!;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  // 중앙 X 좌표 (화면 좌표)
  const centerX = baseX + (minX + maxX) / 2;
  let screenX = centerX * viewport.zoom + viewport.x;

  // 하단 Y 좌표 (화면 좌표)
  const bottomY = baseY + maxY + offset;
  const screenBottomY = bottomY * viewport.zoom + viewport.y;

  // 하단 툴바와 겹치는지 확인
  const wouldOverlapToolbar =
    screenBottomY + barHeight > window.innerHeight - toolbarReservedHeight;

  // Y 좌표 결정
  let screenY: number;
  let above: boolean;

  if (wouldOverlapToolbar) {
    // 상단에 표시
    const topY = baseY + minY - offset;
    screenY = topY * viewport.zoom + viewport.y;
    above = true;
  } else {
    // 기본: 하단에 표시
    screenY = screenBottomY;
    above = false;
  }

  // 좌우 경계 체크
  const halfBarWidth = barWidth / 2;
  let align: "center" | "left" | "right" = "center";

  if (screenX - halfBarWidth < screenPadding) {
    screenX = screenPadding;
    align = "left";
  } else if (screenX + halfBarWidth > window.innerWidth - screenPadding) {
    screenX = window.innerWidth - screenPadding;
    align = "right";
  }

  return { x: screenX, y: screenY, above, align };
}
