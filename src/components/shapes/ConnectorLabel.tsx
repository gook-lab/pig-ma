import { memo, useRef, useEffect, useState, useCallback } from "react";
import { Group, Text, Rect } from "react-konva";
import type Konva from "konva";
import type { CanvasObject } from "@/types";
import { dragCoordinator } from "@/hooks/useDragCoordinator";
import { getPointOnPath } from "@/utils/elbowPath";
import {
  getConnectorEndpoints,
  getConnectorPathPoints,
} from "@/utils/connectorPath";

interface ConnectorLabelProps {
  shape: CanvasObject;
  connector: CanvasObject;
  sourceObj?: CanvasObject;
  targetObj?: CanvasObject;
  isSelected: boolean;
  zoom: number;
  draggable: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart: () => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDoubleClick: () => void;
  isEditing?: boolean;
}

export const ConnectorLabel = memo(function ConnectorLabel({
  shape,
  connector,
  sourceObj,
  targetObj,
  isSelected,
  zoom,
  draggable,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDoubleClick,
  isEditing,
}: ConnectorLabelProps) {
  const groupRef = useRef<Konva.Group>(null);
  const textRef = useRef<Konva.Text>(null);
  const [textSize, setTextSize] = useState({ width: 40, height: 16 });

  // 실시간 위치 계산 함수 (드래그 구독용)
  const calculatePosition = useCallback(
    (
      sourceDragPos?: { x: number; y: number },
      targetDragPos?: { x: number; y: number },
    ) => {
      const sourceWithDrag =
        sourceObj && sourceDragPos
          ? { ...sourceObj, x: sourceDragPos.x, y: sourceDragPos.y }
          : sourceObj;
      const targetWithDrag =
        targetObj && targetDragPos
          ? { ...targetObj, x: targetDragPos.x, y: targetDragPos.y }
          : targetObj;

      // 렌더러와 같은 단일 소스 — ratio 오프셋까지 포함해 끝점을 계산한다
      const { start: startPoint, end: endPoint } = getConnectorEndpoints(
        connector,
        sourceWithDrag,
        targetWithDrag,
      );

      const labelT = shape.labelT ?? 0.5;
      const pathStyle = connector.pathStyle ?? "straight";

      // 직선(straight)인 경우 단순 선형 보간
      if (pathStyle === "straight") {
        return {
          x: startPoint.x + (endPoint.x - startPoint.x) * labelT,
          y: startPoint.y + (endPoint.y - startPoint.y) * labelT,
        };
      }

      // 곡선(curved)인 경우 베지어 곡선 보간
      if (pathStyle === "curved") {
        const midX = (startPoint.x + endPoint.x) / 2;
        const midY = (startPoint.y + endPoint.y) / 2;
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const controlX = midX - dy * 0.2;
        const controlY = midY + dx * 0.2;

        // Quadratic bezier: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
        const t = labelT;
        const mt = 1 - t;
        return {
          x:
            mt * mt * startPoint.x + 2 * mt * t * controlX + t * t * endPoint.x,
          y:
            mt * mt * startPoint.y + 2 * mt * t * controlY + t * t * endPoint.y,
        };
      }

      // 엘보우(elbowed)인 경우 — 렌더러와 같은 단일 소스로 경로를 계산한다.
      // 앵커 리드인 스텁이 빠지면 라벨이 실제 선과 다른 경로 위에 앉는다.
      const pathPoints = getConnectorPathPoints(
        connector,
        sourceWithDrag,
        targetWithDrag,
        { start: startPoint, end: endPoint },
      );

      return getPointOnPath(pathPoints, labelT);
    },
    [connector, sourceObj, targetObj, shape.labelT],
  );

  // Source/target shape 드래그 시 라벨 위치를 커넥터 경로 위에 유지
  useEffect(() => {
    const unsubscribes: (() => void)[] = [];

    if (connector.sourceId || connector.targetId) {
      // 연결된 커넥터: source/target 드래그 구독
      let latestSourcePos: { x: number; y: number } | undefined;
      let latestTargetPos: { x: number; y: number } | undefined;

      const updateLabelPos = () => {
        const newPos = calculatePosition(latestSourcePos, latestTargetPos);
        groupRef.current?.position(newPos);
        groupRef.current?.getLayer()?.batchDraw();
      };

      if (connector.sourceId) {
        unsubscribes.push(
          dragCoordinator.subscribe(connector.sourceId, (pos) => {
            latestSourcePos = pos ?? undefined;
            if (pos) updateLabelPos();
          }),
        );
      }
      if (connector.targetId) {
        unsubscribes.push(
          dragCoordinator.subscribe(connector.targetId, (pos) => {
            latestTargetPos = pos ?? undefined;
            if (pos) updateLabelPos();
          }),
        );
      }
    } else {
      // Standalone connector 드래그 구독
      unsubscribes.push(
        dragCoordinator.subscribe(connector.id, (rawPos) => {
          if (!rawPos) return;
          const deltaX = rawPos.x - connector.x;
          const deltaY = rawPos.y - connector.y;
          const basePos = calculatePosition();
          groupRef.current?.position({
            x: basePos.x + deltaX,
            y: basePos.y + deltaY,
          });
          groupRef.current?.getLayer()?.batchDraw();
        }),
      );
    }

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [
    connector.id,
    connector.sourceId,
    connector.targetId,
    connector.x,
    connector.y,
    calculatePosition,
  ]);

  // Measure text size after render
  useEffect(() => {
    // 다음 프레임에서 측정 (Konva 텍스트 렌더링 완료 후)
    const timer = requestAnimationFrame(() => {
      if (textRef.current) {
        // 텍스트 실제 크기 측정
        const measuredWidth = textRef.current.getTextWidth();
        const measuredHeight = textRef.current.height();

        // 최소 크기 보장
        const minWidth = 40;
        const currentFontSize = shape.fontSize ?? 12;
        const minHeight = currentFontSize * 1.2;

        setTextSize({
          width: Math.max(minWidth, Math.ceil(measuredWidth) + 2),
          height: Math.max(minHeight, measuredHeight),
        });
      }
    });
    return () => cancelAnimationFrame(timer);
  }, [shape.text, shape.fontSize, shape.fontFamily, shape.fontWeight]);

  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      e.cancelBubble = true;
      onSelect(e);
    },
    [onSelect],
  );

  const fontSize = shape.fontSize ?? 12;
  const fontFamily = shape.fontFamily ?? "Pretendard";
  const fontWeight = shape.fontWeight === "bold" ? "bold" : "normal";
  const textDecoration =
    shape.textDecoration === "line-through" ? "line-through" : "";
  const textColor = shape.textColor ?? "#374151";
  const displayText = shape.text || "";
  const placeholder = "Add text";

  // Hide when editing (HTML input takes over)
  if (isEditing) {
    return null;
  }

  const padding = 6;

  // 커넥터 경로상 위치를 항상 재계산 (source/target 이동 시 자동 추적)
  const pathPos = calculatePosition();
  // 사용자가 라벨을 직접 드래그한 경우 Y 오프셋 유지
  const labelOffsetY = shape.labelOffsetY ?? 0;

  return (
    <Group
      ref={groupRef}
      id={shape.id}
      x={pathPos.x}
      y={pathPos.y + labelOffsetY}
      offsetX={textSize.width / 2 + padding}
      offsetY={textSize.height / 2 + padding}
      draggable={draggable}
      onClick={handleClick}
      onTap={handleClick}
      onDblClick={onDoubleClick}
      onDblTap={onDoubleClick}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    >
      {/* Background with border */}
      <Rect
        x={0}
        y={0}
        width={textSize.width + padding * 2}
        height={textSize.height + padding * 2}
        fill="rgba(255, 255, 255, 0.9)"
        stroke={isSelected ? "#3b82f6" : "#d1d5db"}
        strokeWidth={isSelected ? 1.5 / zoom : 1 / zoom}
        cornerRadius={4}
      />
      {/* Text */}
      <Text
        ref={textRef}
        x={padding}
        y={padding}
        text={displayText || placeholder}
        fontSize={fontSize}
        fontFamily={fontFamily}
        fontStyle={fontWeight}
        textDecoration={textDecoration}
        fill={displayText ? textColor : "#6b7280"}
        align="center"
        verticalAlign="middle"
      />
    </Group>
  );
});
