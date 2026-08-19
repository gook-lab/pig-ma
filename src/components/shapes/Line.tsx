import { memo, useMemo, useEffect, useRef } from "react";
import { Group, Line as KonvaLine, Rect } from "react-konva";
import type Konva from "konva";
import type { CanvasObject } from "@/types";

interface LineProps {
  shape: CanvasObject;
  isSelected: boolean;
  /** 다중 선택 모드 (2개 이상 선택됨) */
  isMultiSelected?: boolean;
  /** 현재 줌 레벨 */
  zoom?: number;
  draggable?: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
}

export const Line = memo(function Line({
  shape,
  isSelected: _isSelected,
  isMultiSelected = false,
  zoom = 1,
  draggable = true,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
}: LineProps) {
  void _isSelected; // Selection indicator handled by Transformer (단일 선택 시)
  const points = shape.points ?? [];

  // Calculate bounding box from points for multi-select border
  const bounds = useMemo(() => {
    if (points.length < 2) return { minX: 0, minY: 0, width: 0, height: 0 };

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (let i = 0; i < points.length; i += 2) {
      const x = points[i]!;
      const y = points[i + 1]!;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    return {
      minX,
      minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [points]);
  return (
    <Group
      id={shape.id}
      x={shape.x}
      y={shape.y}
      rotation={shape.rotation}
      draggable={draggable}
      onClick={onSelect}
      onTap={onSelect}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    >
      {/* 히트 영역 - 전체 바운딩 박스 클릭 가능 */}
      {(bounds.width > 0 || bounds.height > 0) && (
        <Rect
          x={bounds.minX - 5}
          y={bounds.minY - 5}
          width={bounds.width + 10}
          height={bounds.height + 10}
          fill="rgba(255,255,255,0.001)"
          perfectDrawEnabled={false}
        />
      )}
      {/* 다중 선택 시 개별 선택 테두리 */}
      {isMultiSelected && (bounds.width > 0 || bounds.height > 0) && (
        <Rect
          x={bounds.minX - 2}
          y={bounds.minY - 2}
          width={bounds.width + 4}
          height={bounds.height + 4}
          stroke="#0D99FF"
          strokeWidth={2 / zoom}
          fill="transparent"
          dash={[4, 4]}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
      <CachedLine
        points={points}
        stroke={shape.stroke ?? "#000000"}
        strokeWidth={shape.strokeWidth ?? 2}
        opacity={shape.opacity ?? 1}
      />
    </Group>
  );
});

/** Cached Konva Line — caches to bitmap for complex drawings (many points) */
const CachedLine = memo(function CachedLine({
  points,
  stroke,
  strokeWidth,
  opacity,
}: {
  points: number[];
  stroke: string;
  strokeWidth: number;
  opacity: number;
}) {
  const lineRef = useRef<Konva.Line>(null);

  // Cache the line as bitmap when it has many points (>20 points = >40 values)
  useEffect(() => {
    const node = lineRef.current;
    if (!node) return;
    if (points.length > 40) {
      try {
        node.cache({ pixelRatio: 2 });
      } catch {
        // cache can fail for very large shapes
      }
    } else {
      node.clearCache();
    }
  }, [points, stroke, strokeWidth]);

  return (
    <KonvaLine
      ref={lineRef}
      points={points}
      stroke={stroke}
      strokeWidth={strokeWidth}
      opacity={opacity}
      lineCap="round"
      lineJoin="round"
      tension={0.5}
      hitStrokeWidth={Math.max(20, strokeWidth + 10)}
      perfectDrawEnabled={false}
      shadowForStrokeEnabled={false}
    />
  );
});
