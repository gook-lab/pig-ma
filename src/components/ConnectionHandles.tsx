import { memo, useState, useEffect, useMemo } from "react";
import {
  Group,
  Circle as KonvaCircle,
  Rect,
  Line as KonvaLine,
  Arrow,
} from "react-konva";
import type { CanvasObject } from "@/types";
import {
  getOffsetForDirection,
  getAnchorPoint,
  getOppositeAnchor,
  findNearestShapeInDirection,
  type AnchorPosition,
  type Point,
} from "@/utils/geometry";
import { dragCoordinator } from "@/hooks/useDragCoordinator";
import { getShapePath } from "@/components/shapes/Shape";

interface ConnectionHandlesProps {
  shape: CanvasObject;
  zoom: number;
  objects: CanvasObject[];
  onHandleClick: (anchor: AnchorPosition) => void;
}

// Default state (same as green connection points)
const HANDLE_RADIUS_DEFAULT = 6;
const HANDLE_STROKE_WIDTH_DEFAULT = 1.5;

// Hover state (larger, fully visible with icon)
const HANDLE_RADIUS_HOVER = 12;
const HANDLE_STROKE_WIDTH_HOVER = 2;

// Colors - default has transparency in fill only, stroke stays solid
const HANDLE_COLOR_DEFAULT = "rgba(59, 130, 246, 0.6)"; // #3b82f6 with 60% opacity
const HANDLE_COLOR_HOVER = "#3b82f6"; // solid blue
// Align with Transformer resize handles (anchorSize=12, so edge + 6px for handle center)
// Connection handle should be just outside: edge + 6 (resize handle center) + 8 (gap) + 6 (connection handle radius) = 20
const HANDLE_OFFSET = 20; // Distance from shape edge (aligned with resize handles)
const HANDLE_OFFSET_TOP = 42; // Extra offset for top to avoid rotate icon

// Get offset for each anchor direction
function getHandleOffset(anchor: AnchorPosition): { x: number; y: number } {
  switch (anchor) {
    case "top":
      return { x: 0, y: -HANDLE_OFFSET_TOP }; // Extra offset to avoid rotate icon
    case "bottom":
      return { x: 0, y: HANDLE_OFFSET };
    case "left":
      return { x: -HANDLE_OFFSET, y: 0 };
    case "right":
      return { x: HANDLE_OFFSET, y: 0 };
    case "center":
      return { x: 0, y: 0 };
  }
}

// Get arrow rotation based on anchor direction
function getArrowRotation(anchor: AnchorPosition): number {
  switch (anchor) {
    case "top":
      return -90;
    case "bottom":
      return 90;
    case "left":
      return 180;
    case "right":
      return 0;
    case "center":
      return 0;
  }
}

// Rotate offset vector by angle in degrees
function rotateOffset(
  offset: { x: number; y: number },
  angleDeg: number,
): { x: number; y: number } {
  if (angleDeg === 0) return offset;
  const angleRad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return {
    x: offset.x * cos - offset.y * sin,
    y: offset.x * sin + offset.y * cos,
  };
}

// Calculate anchor points directly from shape bounds (aligned with Transformer)
function calculateAnchorPoints(
  shape: CanvasObject,
  dragOffset?: { x: number; y: number },
): { anchor: AnchorPosition; point: Point }[] {
  // Use shape's actual bounds (same as Transformer)
  const x = dragOffset?.x ?? shape.x;
  const y = dragOffset?.y ?? shape.y;
  const width = shape.width ?? 100;
  const height = shape.height ?? 100;
  const rotation = shape.rotation ?? 0;

  // Calculate center
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  // Calculate base anchor points on shape edge (same as resize handles)
  const basePoints: { anchor: AnchorPosition; point: Point }[] = [
    { anchor: "top", point: { x: centerX, y } },
    { anchor: "right", point: { x: x + width, y: centerY } },
    { anchor: "bottom", point: { x: centerX, y: y + height } },
    { anchor: "left", point: { x, y: centerY } },
  ];

  return basePoints.map(({ anchor, point }) => {
    const offset = getHandleOffset(anchor);
    // Rotate the offset to match the shape's rotation
    const rotatedOffset = rotateOffset(offset, rotation);
    // Also rotate the base point around center if shape is rotated
    const rotatedPoint = rotateOffset(
      { x: point.x - centerX, y: point.y - centerY },
      rotation,
    );
    return {
      anchor,
      point: {
        x: centerX + rotatedPoint.x + rotatedOffset.x,
        y: centerY + rotatedPoint.y + rotatedOffset.y,
      },
    };
  });
}

export const ConnectionHandles = memo(function ConnectionHandles({
  shape,
  zoom,
  objects,
  onHandleClick,
}: ConnectionHandlesProps) {
  const [hoveredAnchor, setHoveredAnchor] = useState<AnchorPosition | null>(
    null,
  );
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  // Subscribe to drag coordinator for real-time position updates
  useEffect(() => {
    const unsubscribe = dragCoordinator.subscribe(shape.id, (pos) => {
      setDragPos(pos ? { x: pos.x, y: pos.y } : null);
    });

    const currentPos = dragCoordinator.getPosition(shape.id);
    if (currentPos) {
      setDragPos({ x: currentPos.x, y: currentPos.y });
    }

    return () => {
      unsubscribe();
      setDragPos(null);
    };
  }, [shape.id]);

  // Find already connected anchors (from connectors)
  const connectedAnchors = useMemo(() => {
    const connected = new Set<AnchorPosition>();
    objects.forEach((obj) => {
      if (obj.type === "connector") {
        // Check if this shape is the source
        if (obj.sourceId === shape.id && obj.sourceAnchor) {
          connected.add(obj.sourceAnchor);
        }
        // Check if this shape is the target
        if (obj.targetId === shape.id && obj.targetAnchor) {
          connected.add(obj.targetAnchor);
        }
      }
    });
    return connected;
  }, [objects, shape.id]);

  // Get anchor points (filtered to exclude already connected)
  const anchorPoints = calculateAnchorPoints(
    shape,
    dragPos ?? undefined,
  ).filter(({ anchor }) => !connectedAnchors.has(anchor));

  // Calculate zoom-compensated sizes
  const radiusDefault = HANDLE_RADIUS_DEFAULT / zoom;
  const radiusHover = HANDLE_RADIUS_HOVER / zoom;
  const strokeWidthDefault = HANDLE_STROKE_WIDTH_DEFAULT / zoom;
  const strokeWidthHover = HANDLE_STROKE_WIDTH_HOVER / zoom;

  // Calculate preview data for hovered anchor
  const previewData = useMemo(() => {
    if (!hoveredAnchor) return null;

    const currentX = dragPos?.x ?? shape.x;
    const currentY = dragPos?.y ?? shape.y;
    const currentShape = { ...shape, x: currentX, y: currentY };

    // StickyNote: 스티키 노트만 미리보기 (커넥터 없음)
    if (shape.type === "stickyNote") {
      const offset = getOffsetForDirection(shape, hoveredAnchor);
      return {
        type: "stickyNote" as const,
        previewX: currentX + offset.x,
        previewY: currentY + offset.y,
        width: 150,
        height: 150,
      };
    }

    // Shape/Rectangle/Circle: 해당 방향에 기존 도형이 있는지 확인
    const anchorPoint = getAnchorPoint(currentShape, hoveredAnchor);
    const nearestShape = findNearestShapeInDirection(
      anchorPoint,
      hoveredAnchor,
      objects,
      [shape.id],
      200,
    );

    if (nearestShape) {
      // 기존 도형에 연결 - 커넥터만 미리보기
      const sourceAnchor = hoveredAnchor;
      const targetAnchor = getOppositeAnchor(hoveredAnchor);
      const startPoint = getAnchorPoint(currentShape, sourceAnchor);
      const endPoint = getAnchorPoint(nearestShape, targetAnchor);

      return {
        type: "connectorOnly" as const,
        connectorStart: startPoint,
        connectorEnd: endPoint,
      };
    }

    // 해당 방향에 도형 없음 - 복제된 도형 + 커넥터 미리보기
    const offset = getOffsetForDirection(shape, hoveredAnchor);
    const previewX = currentX + offset.x;
    const previewY = currentY + offset.y;

    const previewShape = {
      ...shape,
      x: previewX,
      y: previewY,
    };

    const sourceAnchor = hoveredAnchor;
    const targetAnchor = getOppositeAnchor(hoveredAnchor);
    const startPoint = getAnchorPoint(currentShape, sourceAnchor);
    const endPoint = getAnchorPoint(previewShape, targetAnchor);

    return {
      type: "shapeWithConnector" as const,
      previewX,
      previewY,
      width: shape.width ?? 75,
      height: shape.height ?? 75,
      shapeVariant: shape.shapeVariant,
      fill: shape.fill ?? "#f3f4f6",
      stroke: shape.stroke ?? "#374151",
      strokeWidth: shape.strokeWidth ?? 2,
      connectorStart: startPoint,
      connectorEnd: endPoint,
    };
  }, [hoveredAnchor, shape, dragPos, objects]);

  return (
    <Group listening={true}>
      {/* Preview when hovering - different based on shape type */}
      {hoveredAnchor && previewData && (
        <Group listening={false} opacity={0.4}>
          {previewData.type === "stickyNote" ? (
            // StickyNote: 스티키 노트만 미리보기 (커넥터 없음)
            <Rect
              x={previewData.previewX}
              y={previewData.previewY}
              width={150}
              height={150}
              fill="#fef08a"
              cornerRadius={4}
            />
          ) : previewData.type === "connectorOnly" ? (
            // 기존 도형에 연결 - 커넥터만 미리보기
            <Arrow
              points={[
                previewData.connectorStart.x,
                previewData.connectorStart.y,
                previewData.connectorEnd.x,
                previewData.connectorEnd.y,
              ]}
              stroke="#3b82f6"
              strokeWidth={2}
              pointerLength={8}
              pointerWidth={8}
              fill="#3b82f6"
            />
          ) : (
            // 도형 복제 + 커넥터 미리보기
            <>
              {/* 커넥터 화살표 */}
              <Arrow
                points={[
                  previewData.connectorStart.x,
                  previewData.connectorStart.y,
                  previewData.connectorEnd.x,
                  previewData.connectorEnd.y,
                ]}
                stroke="#374151"
                strokeWidth={2}
                pointerLength={8}
                pointerWidth={8}
                fill="#374151"
              />
              {/* 복제된 도형 */}
              {previewData.shapeVariant ? (
                // Shape variant (Line으로 polygon 렌더링)
                <KonvaLine
                  x={previewData.previewX}
                  y={previewData.previewY}
                  points={getShapePath(
                    previewData.shapeVariant,
                    previewData.width,
                    previewData.height,
                  )}
                  closed
                  fill={previewData.fill}
                  stroke={previewData.stroke}
                  strokeWidth={previewData.strokeWidth}
                />
              ) : (
                // Rectangle (기본)
                <Rect
                  x={previewData.previewX}
                  y={previewData.previewY}
                  width={previewData.width}
                  height={previewData.height}
                  fill={previewData.fill}
                  stroke={previewData.stroke}
                  strokeWidth={previewData.strokeWidth}
                  cornerRadius={4}
                />
              )}
            </>
          )}
        </Group>
      )}

      {/* Connection handles */}
      {anchorPoints.map(({ anchor, point }) => {
        const isHovered = hoveredAnchor === anchor;
        const radius = isHovered ? radiusHover : radiusDefault;
        const fillColor = isHovered ? HANDLE_COLOR_HOVER : HANDLE_COLOR_DEFAULT;

        return (
          <Group key={anchor}>
            {/* Handle circle */}
            <KonvaCircle
              x={point.x}
              y={point.y}
              radius={radius}
              fill={fillColor}
              stroke="white"
              strokeWidth={isHovered ? strokeWidthHover : strokeWidthDefault}
              onMouseEnter={() => setHoveredAnchor(anchor)}
              onMouseLeave={() => setHoveredAnchor(null)}
              onClick={(e) => {
                e.cancelBubble = true;
                onHandleClick(anchor);
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                onHandleClick(anchor);
              }}
            />

            {/* Arrow icon inside handle when hovered (Lucide ArrowRight style) */}
            {isHovered && (
              <Group
                x={point.x}
                y={point.y}
                rotation={getArrowRotation(anchor) + (shape.rotation ?? 0)}
                listening={false}
              >
                {/* Arrow line */}
                <KonvaLine
                  points={[-5 / zoom, 0, 5 / zoom, 0]}
                  stroke="white"
                  strokeWidth={2.5 / zoom}
                  lineCap="round"
                />
                {/* Arrow head (chevron) */}
                <KonvaLine
                  points={[
                    1 / zoom,
                    -4 / zoom,
                    5 / zoom,
                    0,
                    1 / zoom,
                    4 / zoom,
                  ]}
                  stroke="white"
                  strokeWidth={2.5 / zoom}
                  lineCap="round"
                  lineJoin="round"
                />
              </Group>
            )}
          </Group>
        );
      })}
    </Group>
  );
});
