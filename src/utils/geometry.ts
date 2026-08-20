import type { CanvasObject, AlignmentGuide, GroupInfo } from "@/types";
import { GRID_SIZE, SHAPE_GRID_SIZE } from "./factory";
import { isShape } from "./typeGuards";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 객체의 points 를 안전한 숫자 배열로 정규화한다.
 *
 * 손상된 데이터(문자열 등)는 `.length` 가 있어서 배열 가드를 통과한 뒤
 * `.map`/인덱싱에서 터진다. 미니맵·정렬·지우개처럼 **도형 단위 ErrorBoundary
 * 바깥**(HTML 트리나 Canvas 자체 렌더)에서 points 를 순회하는 경로가 여럿이라,
 * 한 객체의 손상이 앱 전체를 죽일 수 있다. 그 길목들은 이 헬퍼를 쓴다.
 */
export function toPointArray(points: unknown): number[] {
  if (!Array.isArray(points)) return [];
  return points.filter((p): p is number => typeof p === "number");
}

export function getObjectBounds(obj: CanvasObject): Bounds {
  switch (obj.type) {
    case "line": {
      const linePoints = toPointArray(obj.points);
      if (linePoints.length < 2) {
        return { x: obj.x, y: obj.y, width: 10, height: 10 };
      }
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (let i = 0; i + 1 < linePoints.length; i += 2) {
        const px = linePoints[i]!;
        const py = linePoints[i + 1]!;
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }
      // strokeWidth를 고려한 padding 추가 (최소 5px)
      const padding = Math.max(5, (obj.strokeWidth ?? 2) / 2);
      return {
        x: obj.x + minX - padding,
        y: obj.y + minY - padding,
        width: Math.max(10, maxX - minX + padding * 2),
        height: Math.max(10, maxY - minY + padding * 2),
      };
    }
    case "connector": {
      // Calculate bounds including start, end, and all elbow bend points
      const startX = obj.x;
      const startY = obj.y;
      const endX = obj.endX ?? startX;
      const endY = obj.endY ?? startY;

      let minX = Math.min(startX, endX);
      let minY = Math.min(startY, endY);
      let maxX = Math.max(startX, endX);
      let maxY = Math.max(startY, endY);

      // Include elbow bend points in bounds calculation
      if (obj.elbowBends && obj.elbowBends.length > 0) {
        for (const bend of obj.elbowBends) {
          // Use elbowY for vertical bounds
          if (bend.elbowY !== undefined) {
            minY = Math.min(minY, bend.elbowY);
            maxY = Math.max(maxY, bend.elbowY);
          }
          if (bend.leftY !== undefined) {
            minY = Math.min(minY, bend.leftY);
            maxY = Math.max(maxY, bend.leftY);
          }
          if (bend.rightY !== undefined) {
            minY = Math.min(minY, bend.rightY);
            maxY = Math.max(maxY, bend.rightY);
          }
          // Use corner X positions for horizontal bounds
          if (bend.leftCornerX !== undefined) {
            minX = Math.min(minX, bend.leftCornerX);
            maxX = Math.max(maxX, bend.leftCornerX);
          }
          if (bend.rightCornerX !== undefined) {
            minX = Math.min(minX, bend.rightCornerX);
            maxX = Math.max(maxX, bend.rightCornerX);
          }
        }
      }

      // Add padding for stroke width
      const padding = Math.max(5, (obj.strokeWidth ?? 2) / 2);
      return {
        x: minX - padding,
        y: minY - padding,
        width: Math.max(maxX - minX + padding * 2, 10),
        height: Math.max(maxY - minY + padding * 2, 10),
      };
    }
    case "table": {
      // 테이블은 tableData에서 실제 크기 계산
      const tableData = obj.tableData;
      if (!tableData) {
        return {
          x: obj.x,
          y: obj.y,
          width: obj.width ?? 240,
          height: obj.height ?? 80,
        };
      }

      // 같은 이유로 배열임을 확인한 뒤 합산한다
      const tableWidth = Array.isArray(tableData.colWidths)
        ? tableData.colWidths.reduce((sum, w) => sum + w, 0)
        : (obj.width ?? 240);
      const tableHeight = Array.isArray(tableData.rowHeights)
        ? tableData.rowHeights.reduce((sum, h) => sum + h, 0)
        : (obj.height ?? 80);

      return {
        x: obj.x,
        y: obj.y,
        width: tableWidth,
        height: tableHeight,
      };
    }
    case "chart": {
      // 차트는 범례 크기를 포함한 실제 bounds 계산
      const baseWidth = obj.width ?? 200;
      const baseHeight = obj.height ?? 150;
      const chartData = obj.chartData;

      if (!chartData) {
        return {
          x: obj.x,
          y: obj.y,
          width: baseWidth,
          height: baseHeight,
        };
      }

      const showLegend = chartData.showLegend ?? true;
      const legendPosition = chartData.legendPosition ?? "bottom";

      // 범례 크기 계산 (간략화된 버전)
      let legendWidth = 0;
      let legendHeight = 0;

      if (showLegend) {
        const legendItems =
          chartData.variant === "line" && chartData.series
            ? chartData.series
            : chartData.items;

        // Array.isArray 로 검사한다 — 손상된 데이터(예: items 가 문자열)는
        // length > 0 을 통과한 뒤 .map/.forEach 에서 터진다. 이 함수는 뷰포트
        // 가상화가 **모든 객체**에 대해 호출하므로, 한 객체의 손상이 캔버스
        // 전체 렌더를 무너뜨린다 (도형 단위 ErrorBoundary 보다 상위 경로).
        if (Array.isArray(legendItems) && legendItems.length > 0) {
          const isVertical =
            legendPosition === "left" || legendPosition === "right";

          if (isVertical) {
            // 세로 배열: 최대 라벨 너비 기반
            const maxLabelLength = Math.max(
              ...legendItems.map(
                (item: { name?: string; label?: string }) =>
                  (item.name || item.label || "").length,
              ),
            );
            legendWidth = Math.min(14 + maxLabelLength * 7 + 12, 100) + 8;
          } else {
            // 가로 배열: 줄바꿈 고려한 높이
            const availableWidth = baseWidth - 20;
            let currentX = 0;
            let rowCount = 1;

            legendItems.forEach((item: { name?: string; label?: string }) => {
              const label = item.name || item.label || "";
              const itemWidth = 14 + label.length * 6 + 12;
              if (currentX + itemWidth > availableWidth && currentX > 0) {
                rowCount++;
                currentX = 0;
              }
              currentX += itemWidth;
            });

            legendHeight = rowCount * 16 + (rowCount - 1) * 4 + 8;
          }
        }
      }

      return {
        x: obj.x,
        y: obj.y,
        width:
          baseWidth +
          (legendPosition === "left" || legendPosition === "right"
            ? legendWidth
            : 0),
        height:
          baseHeight +
          (legendPosition === "top" || legendPosition === "bottom"
            ? legendHeight
            : 0),
      };
    }
    case "image":
    case "stickyNote":
    default:
      return {
        x: obj.x,
        y: obj.y,
        width: obj.width ?? 100,
        height: obj.height ?? 100,
      };
  }
}

export function rectsIntersect(a: Bounds, b: Bounds): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

/**
 * Check if container completely contains target
 * Returns true if target is fully inside container
 */
export function rectContains(container: Bounds, target: Bounds): boolean {
  return (
    container.x <= target.x &&
    container.y <= target.y &&
    container.x + container.width >= target.x + target.width &&
    container.y + container.height >= target.y + target.height
  );
}

// Check if a line segment intersects with a rectangle
function lineSegmentIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: Bounds,
): boolean {
  // Check if either endpoint is inside the rect
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;

  const pointInRect = (px: number, py: number) =>
    px >= left && px <= right && py >= top && py <= bottom;

  if (pointInRect(x1, y1) || pointInRect(x2, y2)) {
    return true;
  }

  // Check if line segment intersects any of the 4 edges of the rect
  const lineIntersectsLine = (
    ax1: number,
    ay1: number,
    ax2: number,
    ay2: number,
    bx1: number,
    by1: number,
    bx2: number,
    by2: number,
  ): boolean => {
    const denom = (by2 - by1) * (ax2 - ax1) - (bx2 - bx1) * (ay2 - ay1);
    if (Math.abs(denom) < 1e-10) return false;

    const ua = ((bx2 - bx1) * (ay1 - by1) - (by2 - by1) * (ax1 - bx1)) / denom;
    const ub = ((ax2 - ax1) * (ay1 - by1) - (ay2 - ay1) * (ax1 - bx1)) / denom;

    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  };

  // Check all 4 edges
  return (
    lineIntersectsLine(x1, y1, x2, y2, left, top, right, top) || // top
    lineIntersectsLine(x1, y1, x2, y2, right, top, right, bottom) || // right
    lineIntersectsLine(x1, y1, x2, y2, left, bottom, right, bottom) || // bottom
    lineIntersectsLine(x1, y1, x2, y2, left, top, left, bottom) // left
  );
}

// Check if a connector's actual line segments intersect with a rectangle
export function connectorIntersectsRect(
  obj: CanvasObject,
  rect: Bounds,
): boolean {
  if (obj.type !== "connector") return false;

  const startX = obj.x;
  const startY = obj.y;
  const endX = obj.endX ?? startX;
  const endY = obj.endY ?? startY;

  // Build the list of points along the connector path
  // Note: ElbowBend uses elbowY/leftCornerX/rightCornerX instead of x/y
  // For now, we just check start-to-end segment; full elbow path check TBD
  const points: { x: number; y: number }[] = [
    { x: startX, y: startY },
    { x: endX, y: endY },
  ];

  // Check each segment of the connector
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    if (lineSegmentIntersectsRect(p1.x, p1.y, p2.x, p2.y, rect)) {
      return true;
    }
  }

  return false;
}

export function normalizeRect(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): Bounds {
  return {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  };
}

export interface Point {
  x: number;
  y: number;
}

export function getObjectCenter(obj: CanvasObject): Point {
  // For rectangles, images, stickyNotes, shapes
  const width = obj.width ?? 100;
  const height = obj.height ?? 100;
  return { x: obj.x + width / 2, y: obj.y + height / 2 };
}

export type AnchorPosition = "top" | "right" | "bottom" | "left" | "center";

// Get anchor point with optional angle/offset
// offset이 있으면 도형 위치 + offset으로 계산 (도형 이동 시 상대 위치 유지)
/**
 * 연결점의 '크기 대비 비율' 을 구한다.
 *
 * 커넥터를 도형 가장자리에 붙일 때 이 비율을 저장해 두면, 나중에 도형을
 * 키우거나 줄여도 연결점이 같은 자리(가장자리 위 같은 지점)에 남는다.
 */
export function getOffsetRatio(
  obj: CanvasObject,
  point: Point,
): { ratioX: number; ratioY: number } {
  const b = getObjectBounds(obj);
  return {
    ratioX: b.width === 0 ? 0 : (point.x - b.x) / b.width,
    ratioY: b.height === 0 ? 0 : (point.y - b.y) / b.height,
  };
}

/**
 * 연결 대상/지점이 있으면 비율을, 없으면 빈 객체를 준다.
 * 커넥터를 저장하는 쪽에서 스프레드로 쓰기 편하게 만든 래퍼다.
 */
export function getOffsetRatioSafe(
  obj: CanvasObject | undefined,
  point: Point | undefined,
): { ratioX?: number; ratioY?: number } {
  if (!obj || !point) return {};
  return getOffsetRatio(obj, point);
}

/**
 * 커넥터가 실제로 붙는 지점.
 *
 * 우선순위:
 *   1. 크기 대비 비율(ratio) — 도형을 리사이즈해도 따라온다
 *   2. 절대 픽셀 오프셋 — 예전 데이터 호환용. 리사이즈하면 어긋난다
 *   3. 앵커(top/right/bottom/left) 기본 위치
 *
 * 2번만 있던 시절에는 도형을 키우면 연결점이 도형 안쪽에 박혀서
 * 화살표가 도형을 뚫고 나오는 것처럼 보였다.
 */
export function getAnchorPointWithAngle(
  obj: CanvasObject,
  anchor: AnchorPosition,
  _angle?: number,
  offsetX?: number,
  offsetY?: number,
  ratioX?: number,
  ratioY?: number,
): Point {
  if (ratioX !== undefined && ratioY !== undefined) {
    const b = getObjectBounds(obj);
    return {
      x: b.x + b.width * ratioX,
      y: b.y + b.height * ratioY,
    };
  }

  // offset이 있으면 도형 위치 기준으로 계산 (레거시)
  if (offsetX !== undefined && offsetY !== undefined) {
    return {
      x: obj.x + offsetX,
      y: obj.y + offsetY,
    };
  }

  // 기본: 앵커 포인트 사용
  return getAnchorPoint(obj, anchor);
}

// Rotate a point around a center
function rotatePoint(point: Point, center: Point, angleDeg: number): Point {
  if (angleDeg === 0) return point;
  const angleRad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

// Get anchor point for special shape variants (star, triangle, etc.)
// Returns the actual vertex position instead of bounding box edge
function getShapeVariantAnchor(
  obj: CanvasObject,
  anchor: AnchorPosition,
  center: Point,
  width: number,
  height: number,
): Point | null {
  const variant = obj.shapeVariant;
  if (!variant) return null;

  // For star shapes, calculate actual tip/valley positions
  // Star has 5 outer tips (at even indices) and 5 inner valleys (at odd indices)
  // Tips are at angles: -π/2 (top), -π/10 (upper-right), 3π/10 (lower-right), 7π/10 (lower-left), 11π/10 (upper-left)
  if (variant === "star") {
    const outerR = Math.min(width, height) / 2;
    const innerR = outerR * 0.4;

    switch (anchor) {
      case "top":
        // Top tip at angle -π/2 (index 0)
        return { x: center.x, y: center.y - outerR };
      case "bottom": {
        // No tip at bottom - use inner valley at angle π/2 (index 5)
        // This is the bottom-most center point on the star
        return { x: center.x, y: center.y + innerR };
      }
      case "right": {
        // Upper-right tip at angle -π/2 + 2π/5 = -π/10 (index 2)
        const angle = -Math.PI / 2 + (2 * Math.PI) / 5;
        return {
          x: center.x + outerR * Math.cos(angle),
          y: center.y + outerR * Math.sin(angle),
        };
      }
      case "left": {
        // Upper-left tip at angle -π/2 - 2π/5 = -9π/10 (index 8)
        const angle = -Math.PI / 2 - (2 * Math.PI) / 5;
        return {
          x: center.x + outerR * Math.cos(angle),
          y: center.y + outerR * Math.sin(angle),
        };
      }
    }
  }

  if (variant === "star4") {
    const outerR = Math.min(width, height) / 2;
    // 4-pointed star has tips at angles: -π/2 (top), 0 (right), π/2 (bottom), π (left)
    switch (anchor) {
      case "top":
        return { x: center.x, y: center.y - outerR };
      case "right":
        return { x: center.x + outerR, y: center.y };
      case "bottom":
        return { x: center.x, y: center.y + outerR };
      case "left":
        return { x: center.x - outerR, y: center.y };
    }
  }

  if (variant === "triangle") {
    // Triangle: top vertex at (width/2, 0), bottom at (0, height) and (width, height)
    switch (anchor) {
      case "top":
        return { x: center.x, y: obj.y };
      case "bottom":
        return { x: center.x, y: obj.y + height };
      case "right":
        // Midpoint of right edge
        return { x: center.x + width / 4, y: center.y + height / 4 };
      case "left":
        // Midpoint of left edge
        return { x: center.x - width / 4, y: center.y + height / 4 };
    }
  }

  if (variant === "triangleDown") {
    // Inverted triangle
    switch (anchor) {
      case "top":
        return { x: center.x, y: obj.y };
      case "bottom":
        return { x: center.x, y: obj.y + height };
      case "right":
        return { x: center.x + width / 4, y: center.y - height / 4 };
      case "left":
        return { x: center.x - width / 4, y: center.y - height / 4 };
    }
  }

  // For pentagon, hexagon, octagon - use the tip closest to the anchor direction
  if (
    variant === "pentagon" ||
    variant === "hexagon" ||
    variant === "octagon"
  ) {
    const sides = variant === "pentagon" ? 5 : variant === "hexagon" ? 6 : 8;
    const r = Math.min(width, height) / 2;

    // Find the vertex closest to the anchor direction
    const targetAngle =
      anchor === "top"
        ? -Math.PI / 2
        : anchor === "right"
          ? 0
          : anchor === "bottom"
            ? Math.PI / 2
            : Math.PI;

    let closestVertex: Point | null = null;
    let closestDist = Infinity;

    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
      const vertex = {
        x: center.x + r * Math.cos(angle),
        y: center.y + r * Math.sin(angle),
      };

      // Calculate angular distance
      let angleDiff = Math.abs(angle - targetAngle);
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

      if (angleDiff < closestDist) {
        closestDist = angleDiff;
        closestVertex = vertex;
      }
    }

    return closestVertex;
  }

  return null; // Use default bounding box anchor
}

export function getAnchorPoint(
  obj: CanvasObject,
  anchor: AnchorPosition,
): Point {
  const center = getObjectCenter(obj);
  const rotation = obj.rotation ?? 0;

  let point: Point;

  // For rectangles, images, stickyNotes, shapes
  const width = obj.width ?? 100;
  const height = obj.height ?? 100;
  const halfW = width / 2;
  const halfH = height / 2;

  // Check for special shape variants first
  if (obj.type === "shape" && anchor !== "center") {
    const variantPoint = getShapeVariantAnchor(
      obj,
      anchor,
      center,
      width,
      height,
    );
    if (variantPoint) {
      return rotatePoint(variantPoint, center, rotation);
    }
  }

  switch (anchor) {
    case "top":
      point = { x: center.x, y: center.y - halfH };
      break;
    case "right":
      point = { x: center.x + halfW, y: center.y };
      break;
    case "bottom":
      point = { x: center.x, y: center.y + halfH };
      break;
    case "left":
      point = { x: center.x - halfW, y: center.y };
      break;
    case "center":
      return center;
  }

  // Apply rotation around center
  return rotatePoint(point, center, rotation);
}

export function findClosestAnchor(
  obj: CanvasObject,
  point: Point,
): AnchorPosition {
  const anchors: AnchorPosition[] = ["top", "right", "bottom", "left"];
  let closest: AnchorPosition = "center";
  let minDist = Infinity;

  for (const anchor of anchors) {
    const anchorPoint = getAnchorPoint(obj, anchor);
    const dist = Math.sqrt(
      (point.x - anchorPoint.x) ** 2 + (point.y - anchorPoint.y) ** 2,
    );
    if (dist < minDist) {
      minDist = dist;
      closest = anchor;
    }
  }

  return closest;
}

// Snap threshold - 그리드 셀 1개 크기 기반 (도형이 그리드 셀 내에 있으면 스냅)
export const SNAP_THRESHOLD = GRID_SIZE;

export interface SnapResult {
  object: CanvasObject;
  anchor: AnchorPosition;
  point: Point;
  distance: number;
  angle?: number; // for circles: exact angle in radians
  offsetX?: number; // 도형 x 기준 offset
  offsetY?: number; // 도형 y 기준 offset
  /** Group ID when snapped to a group boundary (instead of a shape) */
  groupId?: string;
}

// Check if a shape's bounding box overlaps with a grid cell area
function shapeOverlapsGridCell(obj: CanvasObject, gridPoint: Point): boolean {
  const bounds = getObjectBounds(obj);

  // 그리드 셀 영역: 현재 그리드 포인트 주변 ±GRID_SIZE
  const cellHalf = GRID_SIZE;
  const cellBounds: Bounds = {
    x: gridPoint.x - cellHalf,
    y: gridPoint.y - cellHalf,
    width: cellHalf * 2,
    height: cellHalf * 2,
  };

  return rectsIntersect(bounds, cellBounds);
}

// Snap to shape grid (3px)
function snapToShapeGrid(value: number): number {
  return Math.round(value / SHAPE_GRID_SIZE) * SHAPE_GRID_SIZE;
}

// Find closest point on rectangle edge, snapped to grid
// 중앙 연결점 근처(±5px)에 있으면 정확히 중앙으로 스냅
const ANCHOR_SNAP_THRESHOLD = 5;

function findClosestRectEdgePoint(
  obj: CanvasObject,
  point: Point,
): { point: Point; anchor: AnchorPosition } {
  const bounds = getObjectBounds(obj);
  const left = bounds.x;
  const right = bounds.x + bounds.width;
  const top = bounds.y;
  const bottom = bounds.y + bounds.height;
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;

  // 각 변에 대해 가장 가까운 점 계산
  const candidates: { point: Point; anchor: AnchorPosition; dist: number }[] =
    [];

  // Top edge: y = top, x clamped to [left, right]
  // 중앙(centerX) 근처면 centerX로 스냅
  let topX = Math.max(left, Math.min(right, point.x));
  if (Math.abs(topX - centerX) < ANCHOR_SNAP_THRESHOLD) {
    topX = centerX;
  } else {
    topX = snapToShapeGrid(topX);
  }
  candidates.push({
    point: { x: topX, y: top },
    anchor: "top",
    dist: Math.sqrt((point.x - topX) ** 2 + (point.y - top) ** 2),
  });

  // Bottom edge: y = bottom, x clamped to [left, right]
  let bottomX = Math.max(left, Math.min(right, point.x));
  if (Math.abs(bottomX - centerX) < ANCHOR_SNAP_THRESHOLD) {
    bottomX = centerX;
  } else {
    bottomX = snapToShapeGrid(bottomX);
  }
  candidates.push({
    point: { x: bottomX, y: bottom },
    anchor: "bottom",
    dist: Math.sqrt((point.x - bottomX) ** 2 + (point.y - bottom) ** 2),
  });

  // Left edge: x = left, y clamped to [top, bottom]
  // 중앙(centerY) 근처면 centerY로 스냅
  let leftY = Math.max(top, Math.min(bottom, point.y));
  if (Math.abs(leftY - centerY) < ANCHOR_SNAP_THRESHOLD) {
    leftY = centerY;
  } else {
    leftY = snapToShapeGrid(leftY);
  }
  candidates.push({
    point: { x: left, y: leftY },
    anchor: "left",
    dist: Math.sqrt((point.x - left) ** 2 + (point.y - leftY) ** 2),
  });

  // Right edge: x = right, y clamped to [top, bottom]
  let rightY = Math.max(top, Math.min(bottom, point.y));
  if (Math.abs(rightY - centerY) < ANCHOR_SNAP_THRESHOLD) {
    rightY = centerY;
  } else {
    rightY = snapToShapeGrid(rightY);
  }
  candidates.push({
    point: { x: right, y: rightY },
    anchor: "right",
    dist: Math.sqrt((point.x - right) ** 2 + (point.y - rightY) ** 2),
  });

  // 가장 가까운 후보 선택
  candidates.sort((a, b) => a.dist - b.dist);
  return { point: candidates[0]!.point, anchor: candidates[0]!.anchor };
}

// Find closest point on polygon edge, snapped to grid
function findClosestPolygonEdgePoint(
  obj: CanvasObject,
  point: Point,
): { point: Point; anchor: AnchorPosition } | null {
  const variant = obj.shapeVariant;
  if (!variant) return null;

  const width = obj.width ?? 100;
  const height = obj.height ?? 100;
  const baseX = obj.x;
  const baseY = obj.y;

  const vertices = getPolygonVertices(variant, width, height);
  if (!vertices || vertices.length < 3) return null;

  // Transform vertices to world coordinates
  const worldVertices = vertices.map((v) => ({
    x: baseX + v.x,
    y: baseY + v.y,
  }));

  // Find closest point on any edge
  let closestPoint: Point | null = null;
  let closestDist = Infinity;
  let closestAnchor: AnchorPosition = "center";

  for (let i = 0; i < worldVertices.length; i++) {
    const v1 = worldVertices[i]!;
    const v2 = worldVertices[(i + 1) % worldVertices.length]!;

    // Find closest point on this edge segment
    const edgePoint = closestPointOnSegment(point, v1, v2);
    const dist = Math.sqrt(
      (point.x - edgePoint.x) ** 2 + (point.y - edgePoint.y) ** 2,
    );

    if (dist < closestDist) {
      closestDist = dist;
      // Snap to shape grid
      closestPoint = {
        x: snapToShapeGrid(edgePoint.x),
        y: snapToShapeGrid(edgePoint.y),
      };
      // Determine anchor based on edge direction
      const edgeAngle = Math.atan2(v2.y - v1.y, v2.x - v1.x);
      const normalAngle = edgeAngle + Math.PI / 2;
      closestAnchor = angleToAnchor(normalAngle);
    }
  }

  if (!closestPoint) return null;

  return { point: closestPoint, anchor: closestAnchor };
}

// Find closest point on a line segment
function closestPointOnSegment(p: Point, a: Point, b: Point): Point {
  const ax = p.x - a.x;
  const ay = p.y - a.y;
  const bx = b.x - a.x;
  const by = b.y - a.y;

  const dot = ax * bx + ay * by;
  const lenSq = bx * bx + by * by;

  // Handle degenerate case (segment is a point)
  if (lenSq === 0) return a;

  // Clamp t to [0, 1] to stay on segment
  const t = Math.max(0, Math.min(1, dot / lenSq));

  return {
    x: a.x + t * bx,
    y: a.y + t * by,
  };
}

// Find the nearest shape edge point to snap to (magnetic snap)
// 그리드 포인트 기준으로 주변 그리드 셀 내에 도형이 있으면 해당 도형 외곽선에 스냅 (5px 단위)
export function findSnapTarget(
  point: Point,
  objects: CanvasObject[],
  excludeIds: string[] = [],
  groups?: GroupInfo[],
): SnapResult | null {
  let bestSnap: SnapResult | null = null;
  let minDist = Infinity;

  // Check group boundaries (sections) as snap targets
  if (groups) {
    for (const group of groups) {
      // Get bounds: customBounds or calculate from member objects
      let b = group.customBounds;
      if (!b) {
        const members = objects.filter((o) => o.groupId === group.id);
        if (members.length === 0) continue;
        const padding = 20;
        const minX = Math.min(...members.map((o) => o.x));
        const minY = Math.min(...members.map((o) => o.y));
        const maxX = Math.max(...members.map((o) => o.x + (o.width ?? 100)));
        const maxY = Math.max(...members.map((o) => o.y + (o.height ?? 100)));
        b = {
          x: minX - padding,
          y: minY - padding,
          width: maxX - minX + padding * 2,
          height: maxY - minY + padding * 2,
        };
      }

      const virtualObj: CanvasObject = {
        id: `__group:${group.id}`,
        type: "shape",
        shapeVariant: "rectangle",
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        rotation: 0,
        opacity: 1,
      };

      // For groups, use wider snap range — check if point is near any edge (within 30px)
      const result = findClosestRectEdgePoint(virtualObj, point);
      const dist = Math.sqrt(
        (point.x - result.point.x) ** 2 + (point.y - result.point.y) ** 2,
      );

      // Only snap to group boundary if within 50px of edge
      if (dist > 50) continue;

      if (dist < minDist) {
        minDist = dist;
        bestSnap = {
          object: virtualObj,
          anchor: result.anchor,
          point: result.point,
          distance: dist,
          offsetX: result.point.x - b.x,
          offsetY: result.point.y - b.y,
          groupId: group.id,
        };
      }
    }
  }

  // Only consider shapes (not lines or connectors)
  const shapes = objects.filter(
    (obj) =>
      (isShape(obj) ||
        obj.type === "stickyNote" ||
        obj.type === "textBox" ||
        obj.type === "table" ||
        obj.type === "chart") &&
      !excludeIds.includes(obj.id),
  );

  for (const obj of shapes) {
    // 도형이 현재 그리드 포인트의 셀 영역과 겹치는지 확인
    if (!shapeOverlapsGridCell(obj, point)) {
      continue; // 겹치지 않으면 스킵
    }

    // 도형 외곽선의 가장 가까운 점 찾기 (그리드에 맞춤)
    let edgePoint: Point;
    let anchor: AnchorPosition;
    let angle: number | undefined;

    if (obj.type === "shape" && obj.shapeVariant) {
      // Check if it's a polygon shape
      const polygonResult = findClosestPolygonEdgePoint(obj, point);
      if (polygonResult) {
        edgePoint = polygonResult.point;
        anchor = polygonResult.anchor;
      } else {
        // Fall back to rectangle for non-polygon shapes (circle, ellipse variants)
        const result = findClosestRectEdgePoint(obj, point);
        edgePoint = result.point;
        anchor = result.anchor;
      }
    } else {
      const result = findClosestRectEdgePoint(obj, point);
      edgePoint = result.point;
      anchor = result.anchor;
    }

    const dist = Math.sqrt(
      (point.x - edgePoint.x) ** 2 + (point.y - edgePoint.y) ** 2,
    );

    if (dist < minDist) {
      minDist = dist;
      // 도형 위치 기준 offset 계산 (도형 이동 시 상대 위치 유지용)
      const offsetX = edgePoint.x - obj.x;
      const offsetY = edgePoint.y - obj.y;
      bestSnap = {
        object: obj,
        anchor,
        point: edgePoint,
        distance: dist,
        angle, // 원의 경우에만 값이 있음
        offsetX,
        offsetY,
      };
    }
  }

  return bestSnap;
}

// Check if a point is near a shape's edge (for showing snap indicators)
export function getShapeEdgeAnchors(
  obj: CanvasObject,
): { anchor: AnchorPosition; point: Point }[] {
  // For 'shape' type with polygon variants, return edge midpoints
  if (obj.type === "shape" && obj.shapeVariant) {
    const polygonAnchors = getPolygonEdgeAnchors(obj);
    if (polygonAnchors) {
      return polygonAnchors;
    }
  }

  // Default: 4-directional anchors
  const anchors: AnchorPosition[] = ["top", "right", "bottom", "left"];
  return anchors.map((anchor) => ({
    anchor,
    point: getAnchorPoint(obj, anchor),
  }));
}

// Get polygon-specific anchor points at edge midpoints
function getPolygonEdgeAnchors(
  obj: CanvasObject,
): { anchor: AnchorPosition; point: Point }[] | null {
  const variant = obj.shapeVariant;
  if (!variant) return null;

  const width = obj.width ?? 100;
  const height = obj.height ?? 100;
  const baseX = obj.x;
  const baseY = obj.y;

  // Get vertex points based on variant
  const vertices = getPolygonVertices(variant, width, height);
  if (!vertices || vertices.length < 3) return null;

  // Calculate edge midpoints
  const anchors: { anchor: AnchorPosition; point: Point }[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const v1 = vertices[i]!;
    const v2 = vertices[(i + 1) % vertices.length]!;
    const midX = baseX + (v1.x + v2.x) / 2;
    const midY = baseY + (v1.y + v2.y) / 2;

    // Determine anchor direction based on edge angle
    const angle = Math.atan2(v2.y - v1.y, v2.x - v1.x);
    const normalAngle = angle + Math.PI / 2; // perpendicular to edge
    const anchor = angleToAnchor(normalAngle);

    anchors.push({
      anchor,
      point: { x: midX, y: midY },
    });
  }

  return anchors;
}

// Convert angle to closest anchor position (for display purposes)
function angleToAnchor(angle: number): AnchorPosition {
  // Normalize to [0, 2π)
  const normalized = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  // Divide into 4 quadrants
  if (normalized >= Math.PI * 1.75 || normalized < Math.PI * 0.25) {
    return "right";
  } else if (normalized >= Math.PI * 0.25 && normalized < Math.PI * 0.75) {
    return "bottom";
  } else if (normalized >= Math.PI * 0.75 && normalized < Math.PI * 1.25) {
    return "left";
  } else {
    return "top";
  }
}

// Get opposite anchor position (for connection handles)
export function getOppositeAnchor(anchor: AnchorPosition): AnchorPosition {
  switch (anchor) {
    case "top":
      return "bottom";
    case "bottom":
      return "top";
    case "left":
      return "right";
    case "right":
      return "left";
    case "center":
      return "center";
  }
}

// Get offset for direction (for cloning shapes with connection handles)
// Returns offset based on shape size + 100px spacing
export function getOffsetForDirection(
  obj: CanvasObject,
  direction: AnchorPosition,
): { x: number; y: number } {
  const width = obj.width ?? 100;
  const height = obj.height ?? 100;
  const spacing = 100;

  switch (direction) {
    case "top":
      return { x: 0, y: -(height + spacing) };
    case "bottom":
      return { x: 0, y: height + spacing };
    case "left":
      return { x: -(width + spacing), y: 0 };
    case "right":
      return { x: width + spacing, y: 0 };
    case "center":
      return { x: 0, y: 0 };
  }
}

// Find the nearest shape in a specific direction within maxDistance
export function findNearestShapeInDirection(
  point: Point,
  direction: AnchorPosition,
  objects: CanvasObject[],
  excludeIds: string[],
  maxDistance: number = 200,
): CanvasObject | null {
  let nearest: CanvasObject | null = null;
  let minDist = Infinity;

  // Only consider shapes (not lines or connectors)
  const shapes = objects.filter(
    (obj) =>
      (isShape(obj) ||
        obj.type === "stickyNote" ||
        obj.type === "textBox" ||
        obj.type === "table" ||
        obj.type === "chart") &&
      !excludeIds.includes(obj.id),
  );

  for (const obj of shapes) {
    const center = getObjectCenter(obj);

    // Calculate direction from point to shape center
    const dx = center.x - point.x;
    const dy = center.y - point.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > maxDistance) continue;

    // Check if the shape is in the specified direction
    let isInDirection = false;
    const threshold = 0.5; // Allow some angle tolerance

    switch (direction) {
      case "top":
        // Shape should be above (negative y)
        isInDirection = dy < 0 && Math.abs(dx) < Math.abs(dy) * (1 + threshold);
        break;
      case "bottom":
        // Shape should be below (positive y)
        isInDirection = dy > 0 && Math.abs(dx) < Math.abs(dy) * (1 + threshold);
        break;
      case "left":
        // Shape should be to the left (negative x)
        isInDirection = dx < 0 && Math.abs(dy) < Math.abs(dx) * (1 + threshold);
        break;
      case "right":
        // Shape should be to the right (positive x)
        isInDirection = dx > 0 && Math.abs(dy) < Math.abs(dx) * (1 + threshold);
        break;
      case "center":
        isInDirection = true;
        break;
    }

    if (isInDirection && dist < minDist) {
      minDist = dist;
      nearest = obj;
    }
  }

  return nearest;
}

// Get polygon vertices for specific variants
function getPolygonVertices(
  variant: string,
  width: number,
  height: number,
): Point[] | null {
  switch (variant) {
    case "triangle":
      return [
        { x: width / 2, y: 0 },
        { x: width, y: height },
        { x: 0, y: height },
      ];
    case "triangleDown":
      return [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width / 2, y: height },
      ];
    case "diamond":
    case "flowDecision":
      return [
        { x: width / 2, y: 0 },
        { x: width, y: height / 2 },
        { x: width / 2, y: height },
        { x: 0, y: height / 2 },
      ];
    case "pentagon": {
      const points: Point[] = [];
      for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        points.push({
          x: width / 2 + (width / 2) * Math.cos(angle),
          y: height / 2 + (height / 2) * Math.sin(angle),
        });
      }
      return points;
    }
    case "hexagon":
    case "flowPreparation": {
      const points: Point[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (i * 2 * Math.PI) / 6 - Math.PI / 2;
        points.push({
          x: width / 2 + (width / 2) * Math.cos(angle),
          y: height / 2 + (height / 2) * Math.sin(angle),
        });
      }
      return points;
    }
    case "octagon": {
      const inset = Math.min(width, height) * 0.3;
      return [
        { x: inset, y: 0 },
        { x: width - inset, y: 0 },
        { x: width, y: inset },
        { x: width, y: height - inset },
        { x: width - inset, y: height },
        { x: inset, y: height },
        { x: 0, y: height - inset },
        { x: 0, y: inset },
      ];
    }
    case "flowData":
      return [
        { x: width * 0.15, y: 0 },
        { x: width, y: 0 },
        { x: width * 0.85, y: height },
        { x: 0, y: height },
      ];
    case "flowManualInput":
      return [
        { x: 0, y: height * 0.2 },
        { x: width, y: 0 },
        { x: width, y: height },
        { x: 0, y: height },
      ];
    case "speechBubble":
      return [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: height * 0.7 },
        { x: width * 0.4, y: height * 0.7 },
        { x: width * 0.2, y: height },
        { x: width * 0.2, y: height * 0.7 },
        { x: 0, y: height * 0.7 },
      ];
    case "arrowRight":
      return [
        { x: 0, y: height * 0.25 },
        { x: width * 0.6, y: height * 0.25 },
        { x: width * 0.6, y: 0 },
        { x: width, y: height / 2 },
        { x: width * 0.6, y: height },
        { x: width * 0.6, y: height * 0.75 },
        { x: 0, y: height * 0.75 },
      ];
    case "arrowLeft":
      return [
        { x: width, y: height * 0.25 },
        { x: width * 0.4, y: height * 0.25 },
        { x: width * 0.4, y: 0 },
        { x: 0, y: height / 2 },
        { x: width * 0.4, y: height },
        { x: width * 0.4, y: height * 0.75 },
        { x: width, y: height * 0.75 },
      ];
    case "arrowUp":
      return [
        { x: width * 0.25, y: height },
        { x: width * 0.25, y: height * 0.4 },
        { x: 0, y: height * 0.4 },
        { x: width / 2, y: 0 },
        { x: width, y: height * 0.4 },
        { x: width * 0.75, y: height * 0.4 },
        { x: width * 0.75, y: height },
      ];
    case "arrowDown":
      return [
        { x: width * 0.25, y: 0 },
        { x: width * 0.25, y: height * 0.6 },
        { x: 0, y: height * 0.6 },
        { x: width / 2, y: height },
        { x: width, y: height * 0.6 },
        { x: width * 0.75, y: height * 0.6 },
        { x: width * 0.75, y: 0 },
      ];
    case "chevronRight":
      return [
        { x: 0, y: 0 },
        { x: width, y: height / 2 },
        { x: 0, y: height },
      ];
    case "chevronLeft":
      return [
        { x: width, y: 0 },
        { x: 0, y: height / 2 },
        { x: width, y: height },
      ];
    case "cross": {
      const arm = Math.min(width, height) * 0.3;
      const cx = width / 2;
      const cy = height / 2;
      return [
        { x: cx - arm, y: 0 },
        { x: cx + arm, y: 0 },
        { x: cx + arm, y: cy - arm },
        { x: width, y: cy - arm },
        { x: width, y: cy + arm },
        { x: cx + arm, y: cy + arm },
        { x: cx + arm, y: height },
        { x: cx - arm, y: height },
        { x: cx - arm, y: cy + arm },
        { x: 0, y: cy + arm },
        { x: 0, y: cy - arm },
        { x: cx - arm, y: cy - arm },
      ];
    }
    case "star": {
      // 5-pointed star: 10 vertices alternating outer tips and inner valleys
      const outerR = Math.min(width, height) / 2;
      const innerR = outerR * 0.4;
      const cx = width / 2;
      const cy = height / 2;
      const points: Point[] = [];
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        points.push({
          x: cx + r * Math.cos(angle),
          y: cy + r * Math.sin(angle),
        });
      }
      return points;
    }
    case "star4": {
      // 4-pointed star: 8 vertices alternating outer tips and inner valleys
      const outerR = Math.min(width, height) / 2;
      const innerR = outerR * 0.4;
      const cx = width / 2;
      const cy = height / 2;
      const points: Point[] = [];
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4 - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        points.push({
          x: cx + r * Math.cos(angle),
          y: cy + r * Math.sin(angle),
        });
      }
      return points;
    }
    case "flowProcess":
    case "rectangle":
      return [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: height },
        { x: 0, y: height },
      ];
    default:
      // For circle, ellipse, and other complex shapes, use default 4-directional anchors
      return null;
  }
}

// ============================================================================
// Alignment Guide System (드래그 정렬 가이드)
// ============================================================================

export const ALIGNMENT_THRESHOLD = 10; // 10px 이내에서 스냅
export const ALIGNMENT_PROXIMITY = 500; // 500px 이내의 도형만 비교

// Connector snap 관련 상수 (Figma 방식)
export const CONNECTOR_SNAP_THRESHOLD = 3; // 3px 이내에서 연결점에 정확히 스냅
export const CONNECTOR_DEAD_ZONE = 10; // 10px 이내는 dead zone (스냅 없음)

export interface AlignmentResult {
  guides: AlignmentGuide[];
  snappedX?: number; // 스냅된 X 좌표
  snappedY?: number; // 스냅된 Y 좌표
  inDeadZoneX?: boolean; // X축이 connector dead zone 내에 있음 (스냅 없음)
  inDeadZoneY?: boolean; // Y축이 connector dead zone 내에 있음 (스냅 없음)
}

// Connector 연결점 스냅 정보
export interface ConnectorSnapPoint {
  draggedAnchorX: number; // 드래그 중인 도형의 anchor X
  draggedAnchorY: number; // 드래그 중인 도형의 anchor Y
  targetX: number; // 상대 도형 anchor X
  targetY: number; // 상대 도형 anchor Y
}

/**
 * 두 바운딩 박스 중심점 간의 거리를 계산합니다.
 */
function getBoundsDistance(a: Bounds, b: Bounds): number {
  const aCenterX = a.x + a.width / 2;
  const aCenterY = a.y + a.height / 2;
  const bCenterX = b.x + b.width / 2;
  const bCenterY = b.y + b.height / 2;
  return Math.sqrt((aCenterX - bCenterX) ** 2 + (aCenterY - bCenterY) ** 2);
}

/**
 * 드래그 중인 요소의 정렬 가이드를 계산합니다.
 *
 * @param draggedBounds - 드래그 중인 요소의 바운딩 박스
 * @param allObjects - 모든 캔버스 객체
 * @param excludeIds - 비교에서 제외할 객체 ID (드래그 중인 요소)
 * @param threshold - 스냅 임계값 (기본 5px)
 * @param proximity - 근접 거리 (기본 500px, 이 거리 내의 도형만 비교)
 * @param connectorSnapPoints - connector 연결점 스냅 정보 (직선 유지용)
 * @returns 가이드 라인 목록과 스냅된 좌표
 */
export function calculateAlignmentGuides(
  draggedBounds: Bounds,
  allObjects: CanvasObject[],
  excludeIds: string[],
  threshold: number = ALIGNMENT_THRESHOLD,
  proximity: number = ALIGNMENT_PROXIMITY,
  connectorSnapPoints: ConnectorSnapPoint[] = [],
): AlignmentResult {
  const guides: AlignmentGuide[] = [];
  let snappedX: number | undefined;
  let snappedY: number | undefined;

  // 드래그 요소의 정렬 포인트
  const draggedTop = draggedBounds.y;
  const draggedBottom = draggedBounds.y + draggedBounds.height;
  const draggedCenterY = draggedBounds.y + draggedBounds.height / 2;
  const draggedLeft = draggedBounds.x;
  const draggedRight = draggedBounds.x + draggedBounds.width;
  const draggedCenterX = draggedBounds.x + draggedBounds.width / 2;

  // 정렬 포인트 (드래그 요소)
  const draggedHorizontalPoints = [draggedTop, draggedCenterY, draggedBottom];
  const draggedVerticalPoints = [draggedLeft, draggedCenterX, draggedRight];

  // ============================================================================
  // Step 1: Connector snap 먼저 체크 (Figma 방식)
  // - 매우 가까움 (3px 이내): connector 스냅 적용
  // - Dead zone (3~10px): 모든 스냅 무시 (자유 이동)
  // - 멀음 (10px 이상): 일반 정렬 스냅 허용
  // ============================================================================
  let hasConnectorSnapX = false;
  let hasConnectorSnapY = false;
  let inDeadZoneX = false;
  let inDeadZoneY = false;
  let connectorSnappedX: number | undefined;
  let connectorSnappedY: number | undefined;
  let connectorTargetX: number | undefined;
  let connectorTargetY: number | undefined;

  for (const snapPoint of connectorSnapPoints) {
    // Y축 (수평 정렬)
    const yDiff = Math.abs(snapPoint.draggedAnchorY - snapPoint.targetY);
    if (yDiff <= CONNECTOR_SNAP_THRESHOLD) {
      // 매우 가까움: connector 스냅
      const offset = snapPoint.targetY - snapPoint.draggedAnchorY;
      connectorSnappedY = draggedBounds.y + offset;
      connectorTargetY = snapPoint.targetY;
      hasConnectorSnapY = true;
      inDeadZoneY = false;
    } else if (yDiff <= CONNECTOR_DEAD_ZONE && !hasConnectorSnapY) {
      // Dead zone: 모든 Y축 스냅 무시
      inDeadZoneY = true;
    }

    // X축 (수직 정렬)
    const xDiff = Math.abs(snapPoint.draggedAnchorX - snapPoint.targetX);
    if (xDiff <= CONNECTOR_SNAP_THRESHOLD) {
      // 매우 가까움: connector 스냅
      const offset = snapPoint.targetX - snapPoint.draggedAnchorX;
      connectorSnappedX = draggedBounds.x + offset;
      connectorTargetX = snapPoint.targetX;
      hasConnectorSnapX = true;
      inDeadZoneX = false;
    } else if (xDiff <= CONNECTOR_DEAD_ZONE && !hasConnectorSnapX) {
      // Dead zone: 모든 X축 스냅 무시
      inDeadZoneX = true;
    }
  }

  // ============================================================================
  // Step 2: 일반 정렬 스냅 계산 (dead zone이 아닌 축에서만)
  // ============================================================================
  const compareObjects = allObjects.filter((obj) => {
    if (excludeIds.includes(obj.id)) return false;
    if (obj.type === "connector" || obj.type === "line") return false;

    // 근접 거리 체크
    const targetBounds = getObjectBounds(obj);
    const distance = getBoundsDistance(draggedBounds, targetBounds);
    return distance <= proximity;
  });

  // 각 축에서 가장 가까운 스냅 및 모든 매칭 가이드 수집
  let closestHorizontalDist = Infinity;
  let closestVerticalDist = Infinity;

  // 수평/수직 각각에서 가장 가까운 스냅 정보
  let bestHorizontalSnap: { snappedY: number; targetY: number } | null = null;
  let bestVerticalSnap: { snappedX: number; targetX: number } | null = null;

  // 가이드 라인 범위 계산용 (같은 정렬선에 여러 도형이 있을 수 있음)
  const horizontalGuideRanges: Map<number, { minX: number; maxX: number }> =
    new Map();
  const verticalGuideRanges: Map<number, { minY: number; maxY: number }> =
    new Map();

  for (const obj of compareObjects) {
    const targetBounds = getObjectBounds(obj);

    // 대상 요소의 정렬 포인트
    const targetTop = targetBounds.y;
    const targetBottom = targetBounds.y + targetBounds.height;
    const targetCenterY = targetBounds.y + targetBounds.height / 2;
    const targetLeft = targetBounds.x;
    const targetRight = targetBounds.x + targetBounds.width;
    const targetCenterX = targetBounds.x + targetBounds.width / 2;

    const targetHorizontalPoints = [targetTop, targetCenterY, targetBottom];
    const targetVerticalPoints = [targetLeft, targetCenterX, targetRight];

    // 수평 정렬 체크 (top, centerY, bottom)
    // Dead zone이거나 connector 스냅이 있으면 스킵
    if (!inDeadZoneY && !hasConnectorSnapY) {
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const diff = Math.abs(
            draggedHorizontalPoints[i]! - targetHorizontalPoints[j]!,
          );
          if (diff < threshold) {
            const targetY = targetHorizontalPoints[j]!;
            const offset = targetY - draggedHorizontalPoints[i]!;
            const newSnappedY = draggedBounds.y + offset;

            // 가장 가까운 스냅 업데이트
            if (diff < closestHorizontalDist) {
              closestHorizontalDist = diff;
              bestHorizontalSnap = { snappedY: newSnappedY, targetY };
            }

            // 가이드 범위 확장 (같은 Y 위치의 모든 도형 포함)
            const roundedY = Math.round(targetY);
            const existing = horizontalGuideRanges.get(roundedY);
            const minX = Math.min(draggedBounds.x, targetBounds.x);
            const maxX = Math.max(
              draggedBounds.x + draggedBounds.width,
              targetBounds.x + targetBounds.width,
            );

            if (existing) {
              existing.minX = Math.min(existing.minX, minX);
              existing.maxX = Math.max(existing.maxX, maxX);
            } else {
              horizontalGuideRanges.set(roundedY, { minX, maxX });
            }
          }
        }
      }
    }

    // 수직 정렬 체크 (left, centerX, right)
    // Dead zone이거나 connector 스냅이 있으면 스킵
    if (!inDeadZoneX && !hasConnectorSnapX) {
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const diff = Math.abs(
            draggedVerticalPoints[i]! - targetVerticalPoints[j]!,
          );
          if (diff < threshold) {
            const targetX = targetVerticalPoints[j]!;
            const offset = targetX - draggedVerticalPoints[i]!;
            const newSnappedX = draggedBounds.x + offset;

            // 가장 가까운 스냅 업데이트
            if (diff < closestVerticalDist) {
              closestVerticalDist = diff;
              bestVerticalSnap = { snappedX: newSnappedX, targetX };
            }

            // 가이드 범위 확장 (같은 X 위치의 모든 도형 포함)
            const roundedX = Math.round(targetX);
            const existing = verticalGuideRanges.get(roundedX);
            const minY = Math.min(draggedBounds.y, targetBounds.y);
            const maxY = Math.max(
              draggedBounds.y + draggedBounds.height,
              targetBounds.y + targetBounds.height,
            );

            if (existing) {
              existing.minY = Math.min(existing.minY, minY);
              existing.maxY = Math.max(existing.maxY, maxY);
            } else {
              verticalGuideRanges.set(roundedX, { minY, maxY });
            }
          }
        }
      }
    }
  }

  // ============================================================================
  // Step 3: 스냅 적용
  // - connector 스냅: 정확한 좌표 사용
  // - dead zone: 스냅 없음 (자유 이동)
  // - 일반 정렬 스냅: 그리드 스냅 적용
  // ============================================================================

  // Connector 스냅이 있으면 가이드 범위 설정
  if (hasConnectorSnapY && connectorTargetY !== undefined) {
    const roundedY = Math.round(connectorTargetY);
    // connector snap points에서 가이드 범위 계산
    for (const sp of connectorSnapPoints) {
      if (Math.abs(sp.targetY - connectorTargetY) < 1) {
        const minX = Math.min(sp.draggedAnchorX, sp.targetX);
        const maxX = Math.max(sp.draggedAnchorX, sp.targetX);
        horizontalGuideRanges.set(roundedY, {
          minX: minX - 10,
          maxX: maxX + 10,
        });
        break;
      }
    }
  }
  if (hasConnectorSnapX && connectorTargetX !== undefined) {
    const roundedX = Math.round(connectorTargetX);
    for (const sp of connectorSnapPoints) {
      if (Math.abs(sp.targetX - connectorTargetX) < 1) {
        const minY = Math.min(sp.draggedAnchorY, sp.targetY);
        const maxY = Math.max(sp.draggedAnchorY, sp.targetY);
        verticalGuideRanges.set(roundedX, { minY: minY - 10, maxY: maxY + 10 });
        break;
      }
    }
  }

  // Y축 스냅 적용
  if (hasConnectorSnapY && connectorSnappedY !== undefined) {
    // Connector 스냅 (정확한 좌표)
    snappedY = connectorSnappedY;
    bestHorizontalSnap = {
      snappedY: connectorSnappedY,
      targetY: connectorTargetY!,
    };
  } else if (!inDeadZoneY && bestHorizontalSnap) {
    // 일반 정렬 스냅 (그리드에 맞춤)
    snappedY = snapToShapeGrid(bestHorizontalSnap.snappedY);
  }
  // dead zone이면 snappedY는 undefined (자유 이동)

  // X축 스냅 적용
  if (hasConnectorSnapX && connectorSnappedX !== undefined) {
    // Connector 스냅 (정확한 좌표)
    snappedX = connectorSnappedX;
    bestVerticalSnap = {
      snappedX: connectorSnappedX,
      targetX: connectorTargetX!,
    };
  } else if (!inDeadZoneX && bestVerticalSnap) {
    // 일반 정렬 스냅 (그리드에 맞춤)
    snappedX = snapToShapeGrid(bestVerticalSnap.snappedX);
  }
  // dead zone이면 snappedX는 undefined (자유 이동)

  // ============================================================================
  // Step 4: 가이드 라인 생성
  // ============================================================================

  // 수평 가이드 생성 (스냅된 Y 위치와 일치하는 것만)
  if (bestHorizontalSnap) {
    const roundedY = Math.round(bestHorizontalSnap.targetY);
    const range = horizontalGuideRanges.get(roundedY);
    if (range) {
      guides.push({
        type: "horizontal",
        position: bestHorizontalSnap.targetY,
        start: range.minX - 10,
        end: range.maxX + 10,
      });
    }
  }

  // 수직 가이드 생성 (스냅된 X 위치와 일치하는 것만)
  if (bestVerticalSnap) {
    const roundedX = Math.round(bestVerticalSnap.targetX);
    const range = verticalGuideRanges.get(roundedX);
    if (range) {
      guides.push({
        type: "vertical",
        position: bestVerticalSnap.targetX,
        start: range.minY - 10,
        end: range.maxY + 10,
      });
    }
  }

  return { guides, snappedX, snappedY, inDeadZoneX, inDeadZoneY };
}

// ============================================================================
// Viewport Virtualization (뷰포트 가상화)
// ============================================================================

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/**
 * 객체가 뷰포트 내에 있는지 확인합니다.
 * Progressive Disclosure 패턴: 화면에 보이는 요소만 렌더링하여 성능 최적화
 *
 * @param obj - 캔버스 객체
 * @param viewport - 뷰포트 상태 (x, y, zoom)
 * @param windowWidth - 윈도우 너비
 * @param windowHeight - 윈도우 높이
 * @param padding - 버퍼 영역 (기본 200px) - 스크롤 시 깜빡임 방지
 * @returns 뷰포트 내 가시성 여부
 */
export function isObjectInViewport(
  obj: CanvasObject,
  viewport: Viewport,
  windowWidth: number,
  windowHeight: number,
  padding: number = 200,
): boolean {
  const bounds = getObjectBounds(obj);

  // 캔버스 좌표 → 화면 좌표 변환
  const screenX = bounds.x * viewport.zoom + viewport.x;
  const screenY = bounds.y * viewport.zoom + viewport.y;
  const screenWidth = bounds.width * viewport.zoom;
  const screenHeight = bounds.height * viewport.zoom;

  // 화면 밖인지 체크 (버퍼 영역 포함)
  if (screenX + screenWidth < -padding) return false;
  if (screenY + screenHeight < -padding) return false;
  if (screenX > windowWidth + padding) return false;
  if (screenY > windowHeight + padding) return false;

  return true;
}

/**
 * 뷰포트 내 객체만 필터링합니다.
 * 선택된 객체는 뷰포트 밖이어도 항상 포함됩니다.
 *
 * @param objects - 전체 객체 배열
 * @param viewport - 뷰포트 상태
 * @param windowWidth - 윈도우 너비
 * @param windowHeight - 윈도우 높이
 * @param selectedIds - 선택된 객체 ID 배열
 * @param padding - 버퍼 영역
 * @returns 가시적인 객체 배열
 */
export function filterVisibleObjects(
  objects: CanvasObject[],
  viewport: Viewport,
  windowWidth: number,
  windowHeight: number,
  selectedIds: string[] = [],
  padding: number = 200,
): CanvasObject[] {
  const selectedSet = new Set(selectedIds);
  // O(1) 객체 조회를 위한 Map 생성
  const objectsById = new Map(objects.map((obj) => [obj.id, obj]));

  return objects.filter((obj) => {
    // 선택된 객체는 항상 렌더링
    if (selectedSet.has(obj.id)) return true;

    // Connector는 연결된 Shape이 보이면 렌더링
    if (obj.type === "connector") {
      const sourceId = obj.sourceId;
      const targetId = obj.targetId;

      // 연결된 Shape 중 하나라도 선택되어 있으면 포함
      if (sourceId && selectedSet.has(sourceId)) return true;
      if (targetId && selectedSet.has(targetId)) return true;

      // 연결된 Shape 중 하나라도 뷰포트 내에 있으면 포함
      if (sourceId) {
        const sourceObj = objectsById.get(sourceId);
        if (
          sourceObj &&
          isObjectInViewport(
            sourceObj,
            viewport,
            windowWidth,
            windowHeight,
            padding,
          )
        ) {
          return true;
        }
      }
      if (targetId) {
        const targetObj = objectsById.get(targetId);
        if (
          targetObj &&
          isObjectInViewport(
            targetObj,
            viewport,
            windowWidth,
            windowHeight,
            padding,
          )
        ) {
          return true;
        }
      }

      // 연결 없는 독립 Connector는 자체 bounds로 체크
      if (!sourceId && !targetId) {
        return isObjectInViewport(
          obj,
          viewport,
          windowWidth,
          windowHeight,
          padding,
        );
      }

      return false;
    }

    // ConnectorLabel은 연결된 Connector가 보이면 렌더링
    if (obj.type === "connectorLabel") {
      const connectorId = obj.connectedConnectorId;
      if (connectorId) {
        const connector = objectsById.get(connectorId);
        if (connector) {
          // Connector가 선택되어 있으면 포함
          if (selectedSet.has(connectorId)) return true;

          // Connector의 source/target이 보이면 포함
          const sourceId = connector.sourceId;
          const targetId = connector.targetId;

          if (sourceId && selectedSet.has(sourceId)) return true;
          if (targetId && selectedSet.has(targetId)) return true;

          if (sourceId) {
            const sourceObj = objectsById.get(sourceId);
            if (
              sourceObj &&
              isObjectInViewport(
                sourceObj,
                viewport,
                windowWidth,
                windowHeight,
                padding,
              )
            ) {
              return true;
            }
          }
          if (targetId) {
            const targetObj = objectsById.get(targetId);
            if (
              targetObj &&
              isObjectInViewport(
                targetObj,
                viewport,
                windowWidth,
                windowHeight,
                padding,
              )
            ) {
              return true;
            }
          }

          // 독립 Connector면 Connector 자체로 체크
          if (!sourceId && !targetId) {
            return isObjectInViewport(
              connector,
              viewport,
              windowWidth,
              windowHeight,
              padding,
            );
          }
        }
      }
      return false;
    }

    // 일반 객체는 뷰포트 체크
    return isObjectInViewport(
      obj,
      viewport,
      windowWidth,
      windowHeight,
      padding,
    );
  });
}
