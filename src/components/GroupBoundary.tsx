import { memo, useMemo, useRef, useEffect, useState } from "react";
import { Group, Rect, Text, Circle } from "react-konva";
import type Konva from "konva";
import type { GroupInfo, CanvasObject } from "@/types";
import { SectionTag } from "./SectionTag";
import { getObjectBounds, type Bounds } from "@/utils/geometry";
import { dragCoordinator } from "@/hooks/useDragCoordinator";
import {
  getConnectorEndpoints,
  getConnectorPathPoints,
} from "@/utils/connectorPath";

interface GroupBoundaryProps {
  group: GroupInfo;
  objects: CanvasObject[];
  zoom: number;
  isSelected: boolean;
  onSelect?: (groupId: string, e: Konva.KonvaEventObject<MouseEvent>) => void;
  onDragStart?: (groupId: string) => void;
  onDragMove?: (groupId: string, deltaX: number, deltaY: number) => void;
  onDragEnd?: (groupId: string) => void;
  /** Parent group (no direct members) — entire area is draggable */
  isParentGroup?: boolean;
  onBoundsChange?: (
    groupId: string,
    bounds: { x: number; y: number; width: number; height: number },
  ) => void;
  onScaleObjects?: (
    groupId: string,
    scaleX: number,
    scaleY: number,
    originX: number,
    originY: number,
  ) => void;
}

// lineStyle에 따른 dash 패턴
function getStrokeDash(
  lineStyle: string | undefined,
  strokeWidth: number,
): number[] | undefined {
  if (lineStyle === "dashed") return [strokeWidth * 3, strokeWidth * 2];
  if (lineStyle === "dotted") return [strokeWidth, strokeWidth * 2];
  return undefined;
}

// 리사이즈 핸들 위치 타입
type HandlePosition = "tl" | "t" | "tr" | "l" | "r" | "bl" | "b" | "br";

export const GroupBoundary = memo(function GroupBoundary({
  group,
  objects,
  zoom,
  isSelected,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  isParentGroup = false,
  onBoundsChange,
  onScaleObjects,
}: GroupBoundaryProps) {
  // 드래그 시작 위치 저장
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const groupRef = useRef<Konva.Group>(null);
  const isDragging = useRef(false);

  // 리사이즈 상태 - 로컬 상태로 관리하여 undo 스택 방지
  const [isResizing, setIsResizing] = useState(false);

  // 드래그 중인 객체 위치 추적 (bounds 재계산 트리거용)
  const [dragPositions, setDragPositions] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());

  // 그룹 내 객체 및 커넥터의 source/target 드래그 상태 구독
  useEffect(() => {
    const groupObjects = objects.filter((o) => o.groupId === group.id);
    const objectIdsToSubscribe = new Set<string>();

    // 그룹 내 모든 객체 ID 수집
    groupObjects.forEach((obj) => {
      objectIdsToSubscribe.add(obj.id);
      // 커넥터인 경우 source/target도 구독
      if (obj.type === "connector") {
        if (obj.sourceId) objectIdsToSubscribe.add(obj.sourceId);
        if (obj.targetId) objectIdsToSubscribe.add(obj.targetId);
      }
    });

    const unsubscribes: (() => void)[] = [];

    objectIdsToSubscribe.forEach((objId) => {
      const unsubscribe = dragCoordinator.subscribe(objId, (pos) => {
        setDragPositions((prev) => {
          const next = new Map(prev);
          if (pos) {
            next.set(objId, pos);
          } else {
            next.delete(objId);
          }
          return next;
        });
      });
      unsubscribes.push(unsubscribe);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [objects, group.id]);
  const [tempBounds, setTempBounds] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const resizeStartRef = useRef<{
    handle: HandlePosition;
    startX: number;
    startY: number;
    bounds: { x: number; y: number; width: number; height: number };
  } | null>(null);

  // objects가 변경될 때 (Transformer로 크기 조절 시) Group 위치 리셋
  useEffect(() => {
    if (groupRef.current && !isDragging.current && !isResizing) {
      groupRef.current.x(0);
      groupRef.current.y(0);
    }
  }, [objects, isResizing]);

  // 커넥터의 실제 bounds 계산 (연결된 도형의 위치 참조)
  // 드래그 중인 객체의 실시간 위치도 반영
  // 엘보우 커넥터의 경우 실제 렌더링되는 경로의 모든 점을 기반으로 계산
  const getConnectorRealBounds = (
    connector: CanvasObject,
    allObjects: CanvasObject[],
  ): Bounds => {
    // 라이브 드래그 위치를 반영한 도형으로 렌더러와 같은 단일 소스 계산
    const sourceObj = connector.sourceId
      ? allObjects.find((o) => o.id === connector.sourceId)
      : undefined;
    const targetObj = connector.targetId
      ? allObjects.find((o) => o.id === connector.targetId)
      : undefined;
    const sourceLive = connector.sourceId
      ? dragCoordinator.getPosition(connector.sourceId)
      : null;
    const targetLive = connector.targetId
      ? dragCoordinator.getPosition(connector.targetId)
      : null;
    const sourceWithDrag =
      sourceObj && sourceLive
        ? { ...sourceObj, x: sourceLive.x, y: sourceLive.y }
        : sourceObj;
    const targetWithDrag =
      targetObj && targetLive
        ? { ...targetObj, x: targetLive.x, y: targetLive.y }
        : targetObj;

    const endpoints = getConnectorEndpoints(
      connector,
      sourceWithDrag,
      targetWithDrag,
    );
    const startX = endpoints.start.x;
    const startY = endpoints.start.y;
    const endX = endpoints.end.x;
    const endY = endpoints.end.y;

    let minX = Math.min(startX, endX);
    let minY = Math.min(startY, endY);
    let maxX = Math.max(startX, endX);
    let maxY = Math.max(startY, endY);

    // 엘보우 커넥터의 경우 실제 렌더링되는 경로의 모든 점을 기반으로 bounds 계산
    if (connector.pathStyle === "elbowed" && connector.elbowBends) {
      const pathPoints = getConnectorPathPoints(
        connector,
        sourceWithDrag,
        targetWithDrag,
        { start: endpoints.start, end: endpoints.end },
      );

      // pathPoints는 [x1, y1, x2, y2, ...] 형태의 flat 배열
      for (let i = 0; i < pathPoints.length; i += 2) {
        const px = pathPoints[i];
        const py = pathPoints[i + 1];
        if (px !== undefined && py !== undefined) {
          minX = Math.min(minX, px);
          maxX = Math.max(maxX, px);
          minY = Math.min(minY, py);
          maxY = Math.max(maxY, py);
        }
      }
    } else if (connector.elbowBends && connector.elbowBends.length > 0) {
      // 엘보우 bend의 Y 좌표 포함
      for (const bend of connector.elbowBends) {
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
      }
    }

    const padding = Math.max(5, (connector.strokeWidth ?? 2) / 2);
    return {
      x: minX - padding,
      y: minY - padding,
      width: Math.max(maxX - minX + padding * 2, 10),
      height: Math.max(maxY - minY + padding * 2, 10),
    };
  };

  // 그룹에 속한 객체들의 바운딩 박스 계산
  // 모든 객체 포함 (커넥터는 연결된 도형의 실제 위치 참조)
  const objectBounds = useMemo(() => {
    const groupObjects = objects.filter((o) => o.groupId === group.id);
    if (groupObjects.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    groupObjects.forEach((obj) => {
      // 커넥터는 연결된 도형의 실제 위치를 참조하여 bounds 계산
      const objBounds =
        obj.type === "connector"
          ? getConnectorRealBounds(obj, objects)
          : getObjectBounds(obj);

      minX = Math.min(minX, objBounds.x);
      minY = Math.min(minY, objBounds.y);
      maxX = Math.max(maxX, objBounds.x + objBounds.width);
      maxY = Math.max(maxY, objBounds.y + objBounds.height);
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [objects, group.id, dragPositions]);

  // 기본 bounds (customBounds와 objectBounds 중 더 큰 영역 사용)
  const baseBounds = useMemo(() => {
    if (!objectBounds) return group.customBounds ?? null;

    // 기본 패딩 적용 (너무 넓지 않게)
    const defaultPadding = 20;
    const autoBounds = {
      x: objectBounds.x - defaultPadding,
      y: objectBounds.y - defaultPadding,
      width: objectBounds.width + defaultPadding * 2,
      height: objectBounds.height + defaultPadding * 2,
    };

    // customBounds가 없으면 자동 계산 bounds 사용
    if (!group.customBounds) return autoBounds;

    // customBounds와 autoBounds 중 더 큰 영역을 포함하도록 계산
    // (객체가 커지면 섹션도 자동으로 커지도록)
    const minX = Math.min(group.customBounds.x, autoBounds.x);
    const minY = Math.min(group.customBounds.y, autoBounds.y);
    const maxX = Math.max(
      group.customBounds.x + group.customBounds.width,
      autoBounds.x + autoBounds.width,
    );
    const maxY = Math.max(
      group.customBounds.y + group.customBounds.height,
      autoBounds.y + autoBounds.height,
    );

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [group.customBounds, objectBounds]);

  // 렌더링에 사용할 bounds (리사이즈 중에는 tempBounds 사용)
  const bounds = isResizing && tempBounds ? tempBounds : baseBounds;

  if (!bounds) return null;

  const strokeWidth = (group.strokeWidth ?? 1) / zoom;
  const cornerRadius = 12 / zoom;
  const tagOffset = 32 / zoom;
  const handleSize = 16 / zoom; // 핸들 크기 증가 (12 → 16)
  const handleCornerRadius = 4 / zoom; // 핸들 모서리 둥글게

  // 이벤트 핸들러 (hidden 상태에서도 사용하므로 먼저 정의)
  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 2) return;
    onSelect?.(group.id, e);
  };

  const handleTap = (e: Konva.KonvaEventObject<TouchEvent>) => {
    onSelect?.(group.id, e as unknown as Konva.KonvaEventObject<MouseEvent>);
  };

  // 숨김 상태일 때 스켈레톤 표시 (클릭으로 선택 가능하도록 listening 활성화)
  if (group.hidden) {
    return (
      <Group onClick={handleClick} onTap={handleTap}>
        {/* 클릭 가능한 히트 영역 */}
        <Rect
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          fill="#f3f4f6"
          stroke={isSelected ? "#0D99FF" : "#d1d5db"}
          strokeWidth={isSelected ? 2 / zoom : 1 / zoom}
          dash={[4 / zoom, 4 / zoom]}
          cornerRadius={cornerRadius}
        />
        <Text
          x={bounds.x + bounds.width / 2 - 30 / zoom}
          y={bounds.y + bounds.height / 2 - 10 / zoom}
          text="Hidden"
          fontSize={14 / zoom}
          fill="#9ca3af"
          fontFamily="Pretendard, sans-serif"
          listening={false}
        />
        <SectionTag
          name={group.name}
          x={bounds.x}
          y={bounds.y - tagOffset}
          zoom={zoom}
          color={group.tagColor}
        />
      </Group>
    );
  }

  const handleDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
    isDragging.current = true;
    const node = e.target;
    dragStartPos.current = { x: node.x(), y: node.y() };
    onDragStart?.(group.id);
  };

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (!dragStartPos.current) return;
    const node = e.target;
    const currentX = node.x();
    const currentY = node.y();
    const deltaX = currentX - dragStartPos.current.x;
    const deltaY = currentY - dragStartPos.current.y;
    dragStartPos.current = { x: currentX, y: currentY };
    onDragMove?.(group.id, deltaX, deltaY);
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    isDragging.current = false;
    const node = e.target;
    node.x(0);
    node.y(0);
    dragStartPos.current = null;
    onDragEnd?.(group.id);
  };

  // 리사이즈 핸들러
  const handleResizeStart = (
    handle: HandlePosition,
    e: Konva.KonvaEventObject<DragEvent>,
  ) => {
    e.cancelBubble = true;
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer || !baseBounds) return;

    setIsResizing(true);
    setTempBounds({ ...baseBounds });
    resizeStartRef.current = {
      handle,
      startX: pointer.x,
      startY: pointer.y,
      bounds: { ...baseBounds },
    };
  };

  const handleResizeMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (!resizeStartRef.current) return;
    e.cancelBubble = true;

    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;

    const {
      handle,
      startX,
      startY,
      bounds: startBounds,
    } = resizeStartRef.current;
    const deltaX = (pointer.x - startX) / zoom;
    const deltaY = (pointer.y - startY) / zoom;

    // 원래 비율 계산
    const aspectRatio = startBounds.width / startBounds.height;

    let newBounds = { ...startBounds };

    // 코너 핸들: 비율 유지 스케일링
    if (
      handle === "tl" ||
      handle === "tr" ||
      handle === "bl" ||
      handle === "br"
    ) {
      // 드래그 방향에 따라 스케일 계산
      let scale: number;

      if (handle === "br") {
        // 오른쪽 하단: 더 큰 변화량 기준
        const scaleByX = (startBounds.width + deltaX) / startBounds.width;
        const scaleByY = (startBounds.height + deltaY) / startBounds.height;
        scale = Math.max(0.1, (scaleByX + scaleByY) / 2);
        newBounds.width = startBounds.width * scale;
        newBounds.height = startBounds.height * scale;
      } else if (handle === "tl") {
        // 왼쪽 상단: 반대 방향
        const scaleByX = (startBounds.width - deltaX) / startBounds.width;
        const scaleByY = (startBounds.height - deltaY) / startBounds.height;
        scale = Math.max(0.1, (scaleByX + scaleByY) / 2);
        newBounds.width = startBounds.width * scale;
        newBounds.height = startBounds.height * scale;
        newBounds.x = startBounds.x + startBounds.width - newBounds.width;
        newBounds.y = startBounds.y + startBounds.height - newBounds.height;
      } else if (handle === "tr") {
        // 오른쪽 상단
        const scaleByX = (startBounds.width + deltaX) / startBounds.width;
        const scaleByY = (startBounds.height - deltaY) / startBounds.height;
        scale = Math.max(0.1, (scaleByX + scaleByY) / 2);
        newBounds.width = startBounds.width * scale;
        newBounds.height = startBounds.height * scale;
        newBounds.y = startBounds.y + startBounds.height - newBounds.height;
      } else if (handle === "bl") {
        // 왼쪽 하단
        const scaleByX = (startBounds.width - deltaX) / startBounds.width;
        const scaleByY = (startBounds.height + deltaY) / startBounds.height;
        scale = Math.max(0.1, (scaleByX + scaleByY) / 2);
        newBounds.width = startBounds.width * scale;
        newBounds.height = startBounds.height * scale;
        newBounds.x = startBounds.x + startBounds.width - newBounds.width;
      }
    } else {
      // 가장자리 핸들: 해당 축만 변경하되 비율 유지
      switch (handle) {
        case "t":
          newBounds.height = Math.max(100, startBounds.height - deltaY);
          newBounds.width = newBounds.height * aspectRatio;
          newBounds.y = startBounds.y + startBounds.height - newBounds.height;
          newBounds.x =
            startBounds.x + (startBounds.width - newBounds.width) / 2;
          break;
        case "b":
          newBounds.height = Math.max(100, startBounds.height + deltaY);
          newBounds.width = newBounds.height * aspectRatio;
          newBounds.x =
            startBounds.x + (startBounds.width - newBounds.width) / 2;
          break;
        case "l":
          newBounds.width = Math.max(100, startBounds.width - deltaX);
          newBounds.height = newBounds.width / aspectRatio;
          newBounds.x = startBounds.x + startBounds.width - newBounds.width;
          newBounds.y =
            startBounds.y + (startBounds.height - newBounds.height) / 2;
          break;
        case "r":
          newBounds.width = Math.max(100, startBounds.width + deltaX);
          newBounds.height = newBounds.width / aspectRatio;
          newBounds.y =
            startBounds.y + (startBounds.height - newBounds.height) / 2;
          break;
      }
    }

    // 최소 크기 제한
    const minSize = 100;
    if (newBounds.width < minSize || newBounds.height < minSize) {
      const minScale = Math.max(
        minSize / startBounds.width,
        minSize / startBounds.height,
      );
      newBounds.width = Math.max(minSize, startBounds.width * minScale);
      newBounds.height = Math.max(minSize, startBounds.height * minScale);
    }

    // 로컬 상태만 업데이트 (store 호출 X → undo 스택에 쌓이지 않음)
    setTempBounds(newBounds);
  };

  const handleResizeEnd = () => {
    // 최종 bounds와 객체 스케일링을 한 번에 처리
    if (resizeStartRef.current && tempBounds) {
      const { handle, bounds: startBounds } = resizeStartRef.current;
      const scaleX = tempBounds.width / startBounds.width;
      const scaleY = tempBounds.height / startBounds.height;

      // 균일 스케일 사용 (비율 유지)
      const uniformScale = (scaleX + scaleY) / 2;

      // 스케일이 변했을 때만 처리
      if (Math.abs(uniformScale - 1) > 0.01) {
        // 핸들 위치에 따라 원점 계산 (고정점)
        let originX: number;
        let originY: number;

        switch (handle) {
          case "tl":
            originX = startBounds.x + startBounds.width;
            originY = startBounds.y + startBounds.height;
            break;
          case "tr":
            originX = startBounds.x;
            originY = startBounds.y + startBounds.height;
            break;
          case "bl":
            originX = startBounds.x + startBounds.width;
            originY = startBounds.y;
            break;
          case "br":
            originX = startBounds.x;
            originY = startBounds.y;
            break;
          case "t":
            originX = startBounds.x + startBounds.width / 2;
            originY = startBounds.y + startBounds.height;
            break;
          case "b":
            originX = startBounds.x + startBounds.width / 2;
            originY = startBounds.y;
            break;
          case "l":
            originX = startBounds.x + startBounds.width;
            originY = startBounds.y + startBounds.height / 2;
            break;
          case "r":
            originX = startBounds.x;
            originY = startBounds.y + startBounds.height / 2;
            break;
          default:
            originX = startBounds.x + startBounds.width / 2;
            originY = startBounds.y + startBounds.height / 2;
        }

        // 객체 스케일링 (undo 스택에 1회만 쌓임)
        onScaleObjects?.(
          group.id,
          uniformScale,
          uniformScale,
          originX,
          originY,
        );
      }

      // bounds 업데이트 (undo 스택에 1회만 쌓임)
      onBoundsChange?.(group.id, tempBounds);
    }

    // 상태 초기화
    setIsResizing(false);
    setTempBounds(null);
    resizeStartRef.current = null;
  };

  const isDraggable = !group.locked && !!onDragMove;

  // 핸들 위치 계산
  const handlePositions: {
    pos: HandlePosition;
    x: number;
    y: number;
    cursor: string;
  }[] = [
    { pos: "tl", x: bounds.x, y: bounds.y, cursor: "nw-resize" },
    {
      pos: "t",
      x: bounds.x + bounds.width / 2,
      y: bounds.y,
      cursor: "n-resize",
    },
    { pos: "tr", x: bounds.x + bounds.width, y: bounds.y, cursor: "ne-resize" },
    {
      pos: "l",
      x: bounds.x,
      y: bounds.y + bounds.height / 2,
      cursor: "w-resize",
    },
    {
      pos: "r",
      x: bounds.x + bounds.width,
      y: bounds.y + bounds.height / 2,
      cursor: "e-resize",
    },
    {
      pos: "bl",
      x: bounds.x,
      y: bounds.y + bounds.height,
      cursor: "sw-resize",
    },
    {
      pos: "b",
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height,
      cursor: "s-resize",
    },
    {
      pos: "br",
      x: bounds.x + bounds.width,
      y: bounds.y + bounds.height,
      cursor: "se-resize",
    },
  ];

  return (
    <Group
      ref={groupRef}
      id={`group-boundary-${group.id}`}
      x={0}
      y={0}
      draggable={isDraggable && !isResizing}
      onClick={handleClick}
      onTap={handleTap}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      {/* 투명 히트 영역 - 부모 그룹은 전체 영역 드래그 가능 */}
      <Rect
        x={bounds.x}
        y={bounds.y}
        width={bounds.width}
        height={bounds.height}
        fill={isParentGroup ? "rgba(255,255,255,0.001)" : "transparent"}
        cornerRadius={cornerRadius}
        listening={isParentGroup}
      />

      {/* 배경 */}
      {group.fill && (
        <Rect
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          fill={group.fill}
          cornerRadius={cornerRadius}
          listening={false}
        />
      )}

      {/* 선택 테두리 - 선택 시 바깥쪽에 하늘색 테두리 표시 */}
      {isSelected && !group.locked && (
        <Rect
          x={bounds.x - 3 / zoom}
          y={bounds.y - 3 / zoom}
          width={bounds.width + 6 / zoom}
          height={bounds.height + 6 / zoom}
          stroke="#0D99FF"
          strokeWidth={Math.max(1.5, 2 / zoom)}
          dash={[4 / zoom, 4 / zoom]}
          cornerRadius={cornerRadius + 2 / zoom}
          fill="transparent"
          listening={false}
        />
      )}

      {/* 테두리 - 잠금 시 빨간 dash, 클릭으로 섹션 선택 가능 */}
      <Rect
        x={bounds.x}
        y={bounds.y}
        width={bounds.width}
        height={bounds.height}
        stroke={group.locked ? "#ef4444" : (group.stroke ?? "#d1d5db")}
        strokeWidth={
          group.locked
            ? Math.max(1.5, 2 / zoom)
            : isSelected
              ? 3 / zoom
              : strokeWidth
        }
        dash={
          group.locked
            ? [8 / zoom, 4 / zoom]
            : group.stroke
              ? getStrokeDash(
                  group.lineStyle,
                  isSelected ? 3 / zoom : strokeWidth,
                )
              : [4 / zoom, 4 / zoom]
        }
        cornerRadius={cornerRadius}
        fill="transparent"
        hitStrokeWidth={Math.max(20, 20 / zoom)}
      />

      {/* 섹션 태그 */}
      <SectionTag
        name={group.name}
        x={bounds.x}
        y={bounds.y - tagOffset}
        zoom={zoom}
        color={group.tagColor}
      />

      {/* 리사이즈 핸들 (선택 시에만, 잠금 해제 상태에서만 표시) */}
      {isSelected &&
        !group.locked &&
        onBoundsChange &&
        handlePositions.map(({ pos, x, y }) => (
          <Rect
            key={pos}
            x={x - handleSize / 2}
            y={y - handleSize / 2}
            width={handleSize}
            height={handleSize}
            fill="white"
            stroke="#0D99FF"
            strokeWidth={1.5 / zoom}
            cornerRadius={handleCornerRadius}
            draggable
            onDragStart={(e) => handleResizeStart(pos, e)}
            onDragMove={handleResizeMove}
            onDragEnd={handleResizeEnd}
            onMouseEnter={(e) => {
              const container = e.target.getStage()?.container();
              if (container) {
                const cursors: Record<HandlePosition, string> = {
                  tl: "nw-resize",
                  t: "n-resize",
                  tr: "ne-resize",
                  l: "w-resize",
                  r: "e-resize",
                  bl: "sw-resize",
                  b: "s-resize",
                  br: "se-resize",
                };
                container.style.cursor = cursors[pos];
              }
            }}
            onMouseLeave={(e) => {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = "default";
            }}
          />
        ))}

      {/* 잠금 뱃지 (우상단) */}
      {group.locked && (
        <Group
          x={bounds.x + bounds.width - 14 / zoom}
          y={bounds.y + 14 / zoom}
          listening={false}
        >
          {/* 뱃지 배경 */}
          <Circle x={0} y={0} radius={12 / zoom} fill="#ef4444" />
          {/* 자물쇠 - 몸체 */}
          <Rect
            x={-5 / zoom}
            y={-2 / zoom}
            width={10 / zoom}
            height={8 / zoom}
            fill="white"
            cornerRadius={2 / zoom}
          />
          {/* 자물쇠 - 고리 */}
          <Rect
            x={-3.5 / zoom}
            y={-7 / zoom}
            width={7 / zoom}
            height={6 / zoom}
            stroke="white"
            strokeWidth={2 / zoom}
            fill="transparent"
            cornerRadius={3 / zoom}
          />
        </Group>
      )}
    </Group>
  );
});
