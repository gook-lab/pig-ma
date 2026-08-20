import { memo, useCallback, useMemo, useState, useEffect, useRef } from "react";
import {
  Arrow,
  Line,
  Group,
  Circle,
  RegularPolygon,
  Text,
  Rect,
  Shape,
} from "react-konva";
import type Konva from "konva";
import type { CanvasObject, MarkerStyle, LineStyle, ElbowBend } from "@/types";
import { useCanvasStore } from "@/store";
import { adjustArrowEndpoints } from "@/utils/arrowEndpoints";
import { translateElbowBends } from "@/utils/translateElbowBends";
import {
  computeConnectorPathPoints as calculatePathPoints,
  toElbowSize,
} from "@/utils/connectorPath";
import {
  getAnchorPointWithAngle,
  findSnapTarget,
  getOffsetRatioSafe,
} from "@/utils/geometry";
import { snapToGrid } from "@/utils/factory";
import { dragCoordinator, type DragPosition } from "@/hooks/useDragCoordinator";
import {
  type ElbowPathOptions,
  getSegments,
  getMidpointHandlePositions,
  getPointOnPath,
  getClosestPointOnPath,
  type MidpointHandle,
  type Segment,
} from "@/utils/elbowPath";
import {
  MIN_EDGE_GAP,
  createElbowFromStraight,
  adjustElbowY,
  adjustLeftCornerX,
  adjustRightCornerX,
  adjustLeftY,
  adjustRightY,
  adjustMidLeftX,
  adjustMidRightX,
  moveElbowX,
  adjustStairStepY,
  adjustStairStepMidX,
  addStairStep,
  defaultCorners,
  removeStairStep,
} from "@/utils/elbowHandlers";

interface ConnectorProps {
  connector: CanvasObject;
  sourceObject?: CanvasObject;
  targetObject?: CanvasObject;
  isSelected: boolean;
  /** 다중 선택 모드 (2개 이상 선택됨) */
  isMultiSelected?: boolean;
  zoom: number; // viewport zoom for fixed-size handles
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onUpdate: (updates: Partial<CanvasObject>) => void;
}

// Get dash pattern for line style
function getDashPattern(lineStyle: LineStyle): number[] {
  switch (lineStyle) {
    case "dashed":
      return [10, 5];
    case "dotted":
      return [2, 4];
    default:
      return [];
  }
}

// Calculate angle between two points
function calculateAngle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  return Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
}

// Drag state for optimized dragging
interface DragState {
  type: "start" | "end";
  x: number;
  y: number;
  snappedTo?: { objectId: string; anchor: string };
}

// Midpoint handle drag state
interface MidpointDragState {
  segmentIndex: number;
  direction: "horizontal" | "vertical";
  handleType: "center" | "left" | "right";
  startX: number;
  startY: number;
  currentOffset: number;
  currentOffsetX: number; // X축 이동량 (center 핸들의 좌우 이동용)
  // 현재 bend 정보 (ㄷ자 상태일 때)
  existingBend?: ElbowBend;
  // 해당 세그먼트 정보
  segment?: Segment;
  // FigJam 스타일 영역 (좌측/우측/중앙)
  // 'newLeft'/'newRight': 연속 계단 생성용 (기존 계단 위에 새 레벨 추가)
  region?: "primary" | "left" | "right" | "newLeft" | "newRight";
  // FigJam 스타일 계단식 꺾임: leftY/rightY 조절 가능 여부
  canAdjustY?: boolean;
  // 버그 3 수정: 수직 핸들이 조절하는 X 좌표 타입
  verticalTarget?:
    | "leftCorner"
    | "midLeft"
    | "rightCorner"
    | "midRight"
    | "leftStep"
    | "rightStep";
  // 연속 계단의 인덱스 (leftYSteps[stepIndex] 또는 rightYSteps[stepIndex])
  stepIndex?: number;
}

export const Connector = memo(function Connector({
  connector,
  sourceObject,
  targetObject,
  isSelected,
  isMultiSelected = false,
  zoom,
  onSelect,
  onUpdate,
}: ConnectorProps) {
  // 스냅 대상 목록은 드래그 이벤트 시점에만 필요하다 — reactive 구독 대신
  // getState() 로 읽는다 (구독하면 아무 객체나 바뀔 때마다 모든 커넥터가
  // 리렌더된다). ShapeRenderer 의 getState() 핸들러 패턴과 동일.
  const getSnapObjects = useCallback(
    () => useCanvasStore.getState().objects,
    [],
  );
  // Local drag state for smooth dragging (don't update store during drag)
  const [dragState, setDragState] = useState<DragState | null>(null);
  // Midpoint handle drag state
  const [midpointDragState, setMidpointDragState] =
    useState<MidpointDragState | null>(null);

  // 드래그 이동량은 ref 에 담는다.
  //
  // 이 값들은 handleMidpointDragEnd 에서만 읽는데, 예전에는 mousemove 마다
  // setMidpointDragState 로 상태에 넣었다. 그 리렌더가 react-konva 로 하여금
  // Line 의 points prop 을 다시 적용하게 만들어, 드래그 중 lineRef 로 직접
  // 그려둔 경로를 매 프레임 덮어썼다 — 그게 깜박임의 원인이다.
  const midpointDragOffsetRef = useRef({ offset: 0, offsetX: 0 });

  // Drag 중 실시간 경로 points (핸들 위치 계산용)
  const [dragPoints, setDragPoints] = useState<number[] | null>(null);

  // Refs for direct Konva manipulation (React 리렌더 없이 업데이트)
  const groupRef = useRef<Konva.Group>(null);
  const lineRef = useRef<Konva.Line | Konva.Arrow>(null);
  const roundedElbowRef = useRef<Konva.Shape>(null);
  const startMarkerRef = useRef<Konva.Group>(null);
  const endMarkerRef = useRef<Konva.Group>(null);
  const startHandleRef = useRef<Konva.Circle>(null);
  const endHandleRef = useRef<Konva.Circle>(null);
  const liveSourcePosRef = useRef<DragPosition | null>(null);
  const liveTargetPosRef = useRef<DragPosition | null>(null);
  // 독립적인 커넥터(sourceId, targetId 없음)의 드래그 delta
  const liveDeltaRef = useRef<{ x: number; y: number } | null>(null);

  // 의존성 최소화를 위해 필요한 값들 추출
  const connectorSourceId = connector.sourceId;
  const connectorTargetId = connector.targetId;
  const connectorSourceAnchor = connector.sourceAnchor;
  const connectorTargetAnchor = connector.targetAnchor;
  const connectorSourceAngle = connector.sourceAngle;
  const connectorTargetAngle = connector.targetAngle;
  const connectorSourceOffsetX = connector.sourceOffsetX;
  const connectorSourceOffsetY = connector.sourceOffsetY;
  const connectorTargetOffsetX = connector.targetOffsetX;
  const connectorTargetOffsetY = connector.targetOffsetY;
  const connectorSourceOffsetRatioX = connector.sourceOffsetRatioX;
  const connectorSourceOffsetRatioY = connector.sourceOffsetRatioY;
  const connectorTargetOffsetRatioX = connector.targetOffsetRatioX;
  const connectorTargetOffsetRatioY = connector.targetOffsetRatioY;
  const connectorX = connector.x;
  const connectorY = connector.y;
  const connectorEndX = connector.endX;
  const connectorEndY = connector.endY;
  const connectorPathStyle = connector.pathStyle ?? "straight";
  const connectorElbowBends = useMemo(
    () => connector.elbowBends ?? [],
    [connector.elbowBends],
  );
  const connectorElbowCornerStyle = connector.elbowCornerStyle ?? "sharp";
  const connectorElbowCornerRadius = connector.elbowCornerRadius ?? 8;

  // 반전 배치에서 도형을 비껴가는 여유를 크기에 비례해 잡기 위해 전달한다.
  const elbowSizeOptions = useMemo<ElbowPathOptions>(
    () => ({
      sourceSize: toElbowSize(sourceObject),
      targetSize: toElbowSize(targetObject),
    }),
    [sourceObject, targetObject],
  );

  // sourceObject에서 필요한 값만 추출 (ref로 캐싱)
  const sourceDataRef = useRef<{
    x: number;
    y: number;
    type: string;
    width?: number;
    height?: number;
    radius?: number;
    shapeVariant?: string;
    rotation?: number;
  } | null>(null);
  if (sourceObject) {
    sourceDataRef.current = {
      x: sourceObject.x,
      y: sourceObject.y,
      type: sourceObject.type,
      width: sourceObject.width,
      height: sourceObject.height,
      radius: sourceObject.radius,
      shapeVariant: sourceObject.shapeVariant,
      rotation: sourceObject.rotation,
    };
  } else {
    sourceDataRef.current = null;
  }

  const targetDataRef = useRef<{
    x: number;
    y: number;
    type: string;
    width?: number;
    height?: number;
    radius?: number;
    shapeVariant?: string;
    rotation?: number;
  } | null>(null);
  if (targetObject) {
    targetDataRef.current = {
      x: targetObject.x,
      y: targetObject.y,
      type: targetObject.type,
      width: targetObject.width,
      height: targetObject.height,
      radius: targetObject.radius,
      shapeVariant: targetObject.shapeVariant,
      rotation: targetObject.rotation,
    };
  } else {
    targetDataRef.current = null;
  }

  // 직접 Konva 라인 포인트 업데이트 (React 리렌더 없이)
  const updateLinePoints = useCallback(() => {
    // 현재 시작/끝점 계산
    let startX: number, startY: number, endX: number, endY: number;

    const sourceData = sourceDataRef.current;
    const targetData = targetDataRef.current;

    // Source position - 스프레드 연산자 대신 직접 값 사용
    if (liveSourcePosRef.current && sourceData) {
      // 라이브 위치 사용 시 객체 재생성 없이 계산
      const liveX = liveSourcePosRef.current.x;
      const liveY = liveSourcePosRef.current.y;
      const tempSource = {
        ...sourceData,
        x: liveX,
        y: liveY,
      } as Parameters<typeof getAnchorPointWithAngle>[0];
      const anchor = getAnchorPointWithAngle(
        tempSource,
        connectorSourceAnchor ?? "center",
        connectorSourceAngle,
        connectorSourceOffsetX,
        connectorSourceOffsetY,
        connectorSourceOffsetRatioX,
        connectorSourceOffsetRatioY,
      );
      startX = anchor.x;
      startY = anchor.y;
    } else if (connectorSourceId && sourceData) {
      const anchor = getAnchorPointWithAngle(
        sourceData as Parameters<typeof getAnchorPointWithAngle>[0],
        connectorSourceAnchor ?? "center",
        connectorSourceAngle,
        connectorSourceOffsetX,
        connectorSourceOffsetY,
        connectorSourceOffsetRatioX,
        connectorSourceOffsetRatioY,
      );
      startX = anchor.x;
      startY = anchor.y;
    } else {
      // 독립적인 커넥터 - 드래그 delta 적용
      const delta = liveDeltaRef.current;
      if (delta) {
        startX = connectorX + delta.x;
        startY = connectorY + delta.y;
      } else {
        startX = connectorX;
        startY = connectorY;
      }
    }

    // Target position
    if (liveTargetPosRef.current && targetData) {
      const liveX = liveTargetPosRef.current.x;
      const liveY = liveTargetPosRef.current.y;
      const tempTarget = {
        ...targetData,
        x: liveX,
        y: liveY,
      } as Parameters<typeof getAnchorPointWithAngle>[0];
      const anchor = getAnchorPointWithAngle(
        tempTarget,
        connectorTargetAnchor ?? "center",
        connectorTargetAngle,
        connectorTargetOffsetX,
        connectorTargetOffsetY,
        connectorTargetOffsetRatioX,
        connectorTargetOffsetRatioY,
      );
      endX = anchor.x;
      endY = anchor.y;
    } else if (connectorTargetId && targetData) {
      const anchor = getAnchorPointWithAngle(
        targetData as Parameters<typeof getAnchorPointWithAngle>[0],
        connectorTargetAnchor ?? "center",
        connectorTargetAngle,
        connectorTargetOffsetX,
        connectorTargetOffsetY,
        connectorTargetOffsetRatioX,
        connectorTargetOffsetRatioY,
      );
      endX = anchor.x;
      endY = anchor.y;
    } else {
      // 독립적인 커넥터 - 드래그 delta 적용
      const delta = liveDeltaRef.current;
      if (delta) {
        endX = (connectorEndX ?? connectorX + 100) + delta.x;
        endY = (connectorEndY ?? connectorY) + delta.y;
      } else {
        endX = connectorEndX ?? connectorX + 100;
        endY = connectorEndY ?? connectorY;
      }
    }

    // 마커 크기만큼 offset 적용 (shape border를 넘지 않도록)
    // Note: 핸들 위치는 0 유지, 화살표 끝점만 별도 조정
    const markerSize = 0;
    const connectorStartMarker = connector.startMarker ?? "none";
    const connectorEndMarker = connector.endMarker ?? "arrow";

    if (connectorSourceId && sourceData && connectorStartMarker !== "none") {
      const dx = endX - startX;
      const dy = endY - startY;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        startX += (dx / len) * markerSize;
        startY += (dy / len) * markerSize;
      }
    }
    if (connectorTargetId && targetData && connectorEndMarker !== "none") {
      const dx = startX - endX;
      const dy = startY - endY;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        endX += (dx / len) * markerSize;
        endY += (dy / len) * markerSize;
      }
    }

    // 강체 이동 미리보기: 커넥터 전체가 같은 delta 로 움직이는 중이면
    // 저작한 꺾임(절대 좌표)도 같은 만큼 옮겨 그린다. 안 옮기면 드래그 중
    // 도형만 이동하고 꺾임은 제자리에 남아 찌그러졌다가, 놓는 순간 커밋
    // (moveGroupObjects / fullDragEnd)이 bends 를 옮기면서 되돌아온다 —
    // 미리보기와 커밋이 같은 형태를 보여야 한다.
    let previewBends = connectorElbowBends;
    if (connectorElbowBends.length > 0) {
      const liveSrc = liveSourcePosRef.current;
      const liveTgt = liveTargetPosRef.current;
      if (liveSrc && liveTgt && sourceData && targetData) {
        const dx = liveSrc.x - sourceData.x;
        const dy = liveSrc.y - sourceData.y;
        const tdx = liveTgt.x - targetData.x;
        const tdy = liveTgt.y - targetData.y;
        if (
          Math.abs(dx - tdx) < 0.5 &&
          Math.abs(dy - tdy) < 0.5 &&
          (dx !== 0 || dy !== 0)
        ) {
          previewBends =
            translateElbowBends(connectorElbowBends, dx, dy) ??
            connectorElbowBends;
        }
      } else if (!connectorSourceId && !connectorTargetId) {
        // 독립 커넥터 통드래그도 같은 규칙
        const delta = liveDeltaRef.current;
        if (delta && (delta.x !== 0 || delta.y !== 0)) {
          previewBends =
            translateElbowBends(connectorElbowBends, delta.x, delta.y) ??
            connectorElbowBends;
        }
      }
    }

    // 새 포인트 계산 및 적용
    const newPoints = calculatePathPoints(
      startX,
      startY,
      endX,
      endY,
      connectorPathStyle,
      previewBends,
      connectorSourceAnchor,
      connectorTargetAnchor,
      elbowSizeOptions,
    );
    // 화살표 시작점/끝점 조정 (shape border에서 띄움)
    const adjustedPoints = adjustArrowEndpoints(
      newPoints,
      !!connectorSourceId && connectorStartMarker !== "none",
      !!connectorTargetId && connectorEndMarker !== "none",
    );

    // 직접 Konva 업데이트 (React 리렌더 없이 60fps 유지)
    // Rounded elbow는 Shape 컴포넌트(sceneFunc)를 사용하므로 points() 메서드가 없음
    const isRoundedElbow =
      connectorPathStyle === "elbowed" &&
      connectorElbowCornerStyle === "rounded";

    if (lineRef.current && !isRoundedElbow) {
      // Line/Arrow 컴포넌트 - 직접 points 업데이트
      lineRef.current.points(adjustedPoints);
    } else {
      // Rounded elbow Shape 또는 ref 없음 - React state로 업데이트
      setDragPoints(adjustedPoints);
    }

    // 마커 위치도 직접 업데이트 (React 리렌더 없이)
    if (startMarkerRef.current) {
      // 화살표 시작점 조정이 적용된 좌표 사용
      startMarkerRef.current.position({
        x: adjustedPoints[0]!,
        y: adjustedPoints[1]!,
      });
      // 각도 계산 (화살표 방향)
      const startAngle =
        adjustedPoints.length >= 4
          ? calculateAngle(
              adjustedPoints[0]!,
              adjustedPoints[1]!,
              adjustedPoints[2]!,
              adjustedPoints[3]!,
            )
          : 0;
      startMarkerRef.current.rotation(startAngle + 180);
    }
    if (endMarkerRef.current) {
      // 화살표 끝점 조정이 적용된 좌표 사용
      const len = adjustedPoints.length;
      const finalX = adjustedPoints[len - 2]!;
      const finalY = adjustedPoints[len - 1]!;
      endMarkerRef.current.position({ x: finalX, y: finalY });
      const endAngle =
        len >= 4
          ? calculateAngle(
              adjustedPoints[len - 4]!,
              adjustedPoints[len - 3]!,
              adjustedPoints[len - 2]!,
              adjustedPoints[len - 1]!,
            )
          : 0;
      endMarkerRef.current.rotation(endAngle);
    }

    // 핸들 위치도 직접 업데이트 (standalone 드래그 중에는 건너뛰기)
    if (!dragStartPosRef.current) {
      if (startHandleRef.current) {
        startHandleRef.current.position({ x: startX, y: startY });
      }
      if (endHandleRef.current) {
        endHandleRef.current.position({ x: endX, y: endY });
      }
    }

    // 배치 드로우 스케줄링 (각 Connector가 개별 batchDraw 대신)
    dragCoordinator.scheduleDraw();
  }, [
    connector.startMarker,
    connector.endMarker,
    connectorSourceId,
    connectorTargetId,
    connectorSourceAnchor,
    connectorTargetAnchor,
    connectorSourceAngle,
    connectorTargetAngle,
    connectorSourceOffsetX,
    connectorSourceOffsetY,
    connectorTargetOffsetX,
    connectorTargetOffsetY,
    connectorSourceOffsetRatioX,
    connectorSourceOffsetRatioY,
    connectorTargetOffsetRatioX,
    connectorTargetOffsetRatioY,
    connectorX,
    connectorY,
    connectorEndX,
    connectorEndY,
    connectorPathStyle,
    connectorElbowBends,
    connectorElbowCornerStyle,
    connectorElbowCornerRadius,
    elbowSizeOptions,
  ]);

  // Subscribe to source shape drag events (직접 Konva 업데이트)
  useEffect(() => {
    if (!connector.sourceId) return;

    const unsubscribe = dragCoordinator.subscribe(connector.sourceId, (pos) => {
      liveSourcePosRef.current = pos;
      if (pos) {
        updateLinePoints();
      } else {
        // 드래그 종료 시 초기화
        setDragPoints(null);
      }
    });

    return () => {
      unsubscribe();
      liveSourcePosRef.current = null;
    };
  }, [connector.sourceId, updateLinePoints]);

  // Subscribe to target shape drag events (직접 Konva 업데이트)
  useEffect(() => {
    if (!connector.targetId) return;

    const unsubscribe = dragCoordinator.subscribe(connector.targetId, (pos) => {
      liveTargetPosRef.current = pos;
      if (pos) {
        updateLinePoints();
      } else {
        // 드래그 종료 시 초기화
        setDragPoints(null);
      }
    });

    return () => {
      unsubscribe();
      liveTargetPosRef.current = null;
    };
  }, [connector.targetId, updateLinePoints]);

  // Subscribe to independent connector drag events (sourceId, targetId 둘 다 없는 경우)
  useEffect(() => {
    // 연결된 커넥터는 이미 source/target 구독 중이므로 건너뛰기
    if (connector.sourceId || connector.targetId) return;

    const unsubscribe = dragCoordinator.subscribe(connector.id, (pos) => {
      if (!pos) return;
      // delta 계산 (드래그 시작점 대비 현재 위치)
      const deltaX = pos.x - (connectorX ?? 0);
      const deltaY = pos.y - (connectorY ?? 0);
      liveDeltaRef.current = { x: deltaX, y: deltaY };
      updateLinePoints();
    });

    return () => {
      unsubscribe();
      liveDeltaRef.current = null;
    };
  }, [
    connector.id,
    connector.sourceId,
    connector.targetId,
    connectorX,
    connectorY,
    updateLinePoints,
  ]);

  // Fixed screen-size for handles (inverse zoom)
  const handleRadius = 6 / zoom;
  const handleStroke = 2 / zoom;
  const hitArea = 16 / zoom;

  // Calculate base start point (React 렌더링용 - 드래그 중에는 lineRef로 직접 업데이트)
  const baseStartX =
    connector.sourceId && sourceObject
      ? getAnchorPointWithAngle(
          sourceObject,
          connector.sourceAnchor ?? "center",
          connector.sourceAngle,
          connector.sourceOffsetX,
          connector.sourceOffsetY,
          connector.sourceOffsetRatioX,
          connector.sourceOffsetRatioY,
        ).x
      : connector.x;
  const baseStartY =
    connector.sourceId && sourceObject
      ? getAnchorPointWithAngle(
          sourceObject,
          connector.sourceAnchor ?? "center",
          connector.sourceAngle,
          connector.sourceOffsetX,
          connector.sourceOffsetY,
          connector.sourceOffsetRatioX,
          connector.sourceOffsetRatioY,
        ).y
      : connector.y;

  // Calculate base end point
  const baseEndX =
    connector.targetId && targetObject
      ? getAnchorPointWithAngle(
          targetObject,
          connector.targetAnchor ?? "center",
          connector.targetAngle,
          connector.targetOffsetX,
          connector.targetOffsetY,
          connector.targetOffsetRatioX,
          connector.targetOffsetRatioY,
        ).x
      : (connector.endX ?? connector.x + 100);
  const baseEndY =
    connector.targetId && targetObject
      ? getAnchorPointWithAngle(
          targetObject,
          connector.targetAnchor ?? "center",
          connector.targetAngle,
          connector.targetOffsetX,
          connector.targetOffsetY,
          connector.targetOffsetRatioX,
          connector.targetOffsetRatioY,
        ).y
      : (connector.endY ?? connector.y);

  // Apply drag state if dragging
  let startX = dragState?.type === "start" ? dragState.x : baseStartX;
  let startY = dragState?.type === "start" ? dragState.y : baseStartY;
  let endX = dragState?.type === "end" ? dragState.x : baseEndX;
  let endY = dragState?.type === "end" ? dragState.y : baseEndY;

  // Styles
  const lineStyle = connector.lineStyle ?? "solid";
  const pathStyle = connector.pathStyle ?? "straight";
  const startMarker = connector.startMarker ?? "none";
  const endMarker = connector.endMarker ?? "arrow";

  // 마커 크기만큼 offset 적용 (shape border를 넘지 않도록)
  // Note: 핸들 위치는 0 유지, 화살표 끝점만 별도 조정
  const markerSize = 0;
  if (connector.sourceId && sourceObject && startMarker !== "none") {
    // 시작점에서 끝점 방향으로 마커 크기만큼 이동
    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      startX += (dx / len) * markerSize;
      startY += (dy / len) * markerSize;
    }
  }
  if (connector.targetId && targetObject && endMarker !== "none") {
    // 끝점에서 시작점 방향으로 마커 크기만큼 이동
    const dx = startX - endX;
    const dy = startY - endY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      endX += (dx / len) * markerSize;
      endY += (dy / len) * markerSize;
    }
  }
  const strokeColor = isSelected ? "#0D99FF" : (connector.stroke ?? "#374151");
  const strokeWidth = connector.strokeWidth ?? 2; // Keep same width when selected

  // Check if connector is standalone (not attached to any shapes)
  const isStandalone = !connector.sourceId && !connector.targetId;
  // Disable Group drag when handles are being dragged
  const isHandleDragging = dragState !== null || midpointDragState !== null;
  const canDragConnector =
    isStandalone && isSelected && !connector.locked && !isHandleDragging;

  // Drag state for standalone connector
  const dragStartPosRef = useRef<{
    x: number;
    y: number;
    endX: number;
    endY: number;
    lineX: number;
    lineY: number;
  } | null>(null);

  // Handle standalone connector drag (using transparent Rect overlay)
  const handleConnectorDragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      dragStartPosRef.current = {
        x: connector.x,
        y: connector.y,
        endX: connector.endX ?? connector.x,
        endY: connector.endY ?? connector.y,
        lineX: e.target.x(),
        lineY: e.target.y(),
      };
    },
    [connector.x, connector.y, connector.endX, connector.endY],
  );

  const handleConnectorDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (!dragStartPosRef.current || !lineRef.current) return;

      const deltaX = e.target.x() - dragStartPosRef.current.lineX;
      const deltaY = e.target.y() - dragStartPosRef.current.lineY;

      // Calculate new points with delta applied
      const newStartX = dragStartPosRef.current.x + deltaX;
      const newStartY = dragStartPosRef.current.y + deltaY;
      const newEndX = dragStartPosRef.current.endX + deltaX;
      const newEndY = dragStartPosRef.current.endY + deltaY;

      // Update line points directly (keeps Line.x, Line.y at 0)
      const newPoints = calculatePathPoints(
        newStartX,
        newStartY,
        newEndX,
        newEndY,
        pathStyle,
        connector.elbowBends ?? [],
        connector.sourceAnchor,
        connector.targetAnchor,
        elbowSizeOptions,
      );
      lineRef.current.points(newPoints);

      // Update handle positions to follow
      if (startHandleRef.current) {
        startHandleRef.current.position({ x: newStartX, y: newStartY });
      }
      if (endHandleRef.current) {
        endHandleRef.current.position({ x: newEndX, y: newEndY });
      }

      // Notify dragCoordinator so ConnectorLabel can follow
      dragCoordinator.setPosition(connector.id, newStartX, newStartY);

      // Schedule batch draw
      dragCoordinator.scheduleDraw();
    },
    [
      connector.id,
      pathStyle,
      connector.elbowBends,
      connector.elbowCornerStyle,
      connector.elbowCornerRadius,
      elbowSizeOptions,
    ],
  );

  const handleConnectorDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (!dragStartPosRef.current) return;

      // Calculate delta
      const deltaX = e.target.x() - dragStartPosRef.current.lineX;
      const deltaY = e.target.y() - dragStartPosRef.current.lineY;

      // Reset Rect position (for next drag)
      e.target.position({
        x: dragStartPosRef.current.lineX,
        y: dragStartPosRef.current.lineY,
      });

      // Snap to grid
      const snappedX = snapToGrid(dragStartPosRef.current.x + deltaX);
      const snappedY = snapToGrid(dragStartPosRef.current.y + deltaY);
      const snappedEndX = snapToGrid(dragStartPosRef.current.endX + deltaX);
      const snappedEndY = snapToGrid(dragStartPosRef.current.endY + deltaY);

      // Update connector position
      //
      // 저작한 꺾임(절대 좌표)도 같은 만큼 옮긴다 — 끝점만 옮기면 꺾임이
      // 제자리에 남아 형태가 찌그러진다 (moveGroupObjects 와 같은 규칙).
      const snappedDeltaX = snappedX - dragStartPosRef.current.x;
      const snappedDeltaY = snappedY - dragStartPosRef.current.y;
      const movedBends = translateElbowBends(
        connector.elbowBends,
        snappedDeltaX,
        snappedDeltaY,
      );
      onUpdate({
        x: snappedX,
        y: snappedY,
        endX: snappedEndX,
        endY: snappedEndY,
        ...(movedBends !== connector.elbowBends
          ? { elbowBends: movedBends }
          : {}),
      });

      // Clear drag position
      dragCoordinator.clear(connector.id);
      dragStartPosRef.current = null;
    },
    [connector.id, connector.elbowBends, onUpdate],
  );

  // Elbow connector: current bends
  // 드래그 중에는 변경하지 않음 (lineRef로 직접 조작)
  const currentElbowBends = useMemo(() => {
    return connector.elbowBends ?? [];
  }, [connector.elbowBends]);

  // Calculate path points (memoized for non-drag state)
  const points = useMemo(
    () =>
      calculatePathPoints(
        startX,
        startY,
        endX,
        endY,
        pathStyle,
        currentElbowBends,
        connector.sourceAnchor,
        connector.targetAnchor,
        elbowSizeOptions,
      ),
    [
      startX,
      startY,
      endX,
      endY,
      pathStyle,
      currentElbowBends,
      connector.elbowCornerStyle,
      connector.elbowCornerRadius,
      connector.sourceAnchor,
      connector.targetAnchor,
      elbowSizeOptions,
    ],
  );

  // 화살표 렌더링용 points (시작점/끝점 shape border에서 띄움)
  // 녹색 핸들 위치는 원래 points 사용
  const arrowPoints = useMemo(() => {
    return adjustArrowEndpoints(
      points,
      !!connector.sourceId && startMarker !== "none",
      !!connector.targetId && endMarker !== "none",
    );
  }, [points, connector.sourceId, startMarker, connector.targetId, endMarker]);

  // Midpoint handles for elbowed connectors
  // bends 적용 후 실제 경로의 세그먼트에서 계산
  // 드래그 중에는 dragPoints 사용하여 실시간 위치 반영
  const midpointHandles = useMemo((): MidpointHandle[] => {
    if (pathStyle !== "elbowed") return [];

    // 드래그 중이면 dragPoints 사용, 아니면 기본 points 사용
    const currentPoints = dragPoints ?? points;
    const currentSegments = getSegments(currentPoints);

    // startY, endY 전달 (세그먼트 역할 판단용)
    return getMidpointHandlePositions(
      currentSegments,
      connector.elbowBends ?? [],
      startY,
      endY,
    );
  }, [pathStyle, points, dragPoints, connector.elbowBends, startY, endY]);

  // Calculate angles for markers (화살표 방향 기준)
  const startAngle = useMemo(() => {
    if (points.length >= 4) {
      // 첫 번째 세그먼트 계산
      let x1 = points[0]!;
      let y1 = points[1]!;
      let x2 = points[2]!;
      let y2 = points[3]!;

      // 첫 번째 세그먼트 길이가 너무 짧으면 다음 세그먼트 사용
      const segLen = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      if (segLen < 1 && points.length >= 6) {
        // 다음 세그먼트 사용
        x1 = points[2]!;
        y1 = points[3]!;
        x2 = points[4]!;
        y2 = points[5]!;
      }

      return calculateAngle(x1, y1, x2, y2);
    }
    return 0;
  }, [points]);

  const endAngle = useMemo(() => {
    if (points.length >= 4) {
      const len = points.length;
      // 마지막 세그먼트 계산
      let x1 = points[len - 4]!;
      let y1 = points[len - 3]!;
      let x2 = points[len - 2]!;
      let y2 = points[len - 1]!;

      // 마지막 세그먼트 길이가 너무 짧으면 이전 세그먼트 사용
      const segLen = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      if (segLen < 1 && len >= 6) {
        // 이전 세그먼트 사용
        x1 = points[len - 6]!;
        y1 = points[len - 5]!;
        x2 = points[len - 4]!;
        y2 = points[len - 3]!;
      }

      return calculateAngle(x1, y1, x2, y2);
    }
    return 0;
  }, [points]);

  // 경로의 실제 첫 번째 점 좌표 (화살표 시작점 조정 적용됨)
  const finalStartPoint = useMemo(() => {
    if (arrowPoints.length >= 2) {
      return {
        x: arrowPoints[0]!,
        y: arrowPoints[1]!,
      };
    }
    return { x: startX, y: startY };
  }, [arrowPoints, startX, startY]);

  // 경로의 실제 마지막 점 좌표 (화살표 끝점 조정 적용됨)
  const finalEndPoint = useMemo(() => {
    if (arrowPoints.length >= 2) {
      return {
        x: arrowPoints[arrowPoints.length - 2]!,
        y: arrowPoints[arrowPoints.length - 1]!,
      };
    }
    return { x: endX, y: endY };
  }, [arrowPoints, endX, endY]);

  // Optimized drag handlers - update local state during drag, commit on end
  const handleStartDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const rawX = e.target.x();
      const rawY = e.target.y();

      // 먼저 원본 좌표로 shape 연결점 찾기 (더 정확한 스냅)
      const snapTarget = findSnapTarget(
        { x: rawX, y: rawY },
        getSnapObjects(),
        connector.targetId ? [connector.targetId] : [],
      );

      // shape 연결점을 찾으면 그 좌표 사용, 아니면 그리드 스냅
      const targetX = snapTarget?.point.x ?? snapToGrid(rawX);
      const targetY = snapTarget?.point.y ?? snapToGrid(rawY);

      setDragState({
        type: "start",
        x: targetX,
        y: targetY,
        snappedTo: snapTarget
          ? { objectId: snapTarget.object.id, anchor: snapTarget.anchor }
          : undefined,
      });

      // Sync circle position with calculated position (so arrow follows)
      e.target.position({ x: targetX, y: targetY });
    },
    [getSnapObjects, connector.targetId],
  );

  const handleStartDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const rawX = e.target.x();
      const rawY = e.target.y();

      // 먼저 원본 좌표로 shape 연결점 찾기 (더 정확한 스냅)
      const snapTarget = findSnapTarget(
        { x: rawX, y: rawY },
        getSnapObjects(),
        connector.targetId ? [connector.targetId] : [],
      );

      // Commit to store (including angle/offset for position tracking)
      onUpdate({
        x: snapTarget?.point.x ?? snapToGrid(rawX),
        y: snapTarget?.point.y ?? snapToGrid(rawY),
        sourceId: snapTarget?.object.id,
        sourceAnchor: snapTarget?.anchor,
        sourceAngle: snapTarget?.angle,
        sourceOffsetX: snapTarget?.offsetX,
        sourceOffsetY: snapTarget?.offsetY,
        // 도형을 리사이즈해도 연결점이 가장자리에 남도록 비율도 저장한다
        ...(() => {
          const r = getOffsetRatioSafe(snapTarget?.object, snapTarget?.point);
          return {
            sourceOffsetRatioX: r.ratioX,
            sourceOffsetRatioY: r.ratioY,
          };
        })(),
      });

      // Clear drag state
      setDragState(null);
    },
    [getSnapObjects, connector.targetId, onUpdate],
  );

  const handleEndDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const rawX = e.target.x();
      const rawY = e.target.y();

      // 먼저 원본 좌표로 shape 연결점 찾기 (더 정확한 스냅)
      const snapTarget = findSnapTarget(
        { x: rawX, y: rawY },
        getSnapObjects(),
        connector.sourceId ? [connector.sourceId] : [],
      );

      // shape 연결점을 찾으면 그 좌표 사용, 아니면 그리드 스냅
      const targetX = snapTarget?.point.x ?? snapToGrid(rawX);
      const targetY = snapTarget?.point.y ?? snapToGrid(rawY);

      setDragState({
        type: "end",
        x: targetX,
        y: targetY,
        snappedTo: snapTarget
          ? { objectId: snapTarget.object.id, anchor: snapTarget.anchor }
          : undefined,
      });

      // Sync circle position with calculated position (so arrow follows)
      e.target.position({ x: targetX, y: targetY });
    },
    [getSnapObjects, connector.sourceId],
  );

  const handleEndDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const rawX = e.target.x();
      const rawY = e.target.y();

      // 먼저 원본 좌표로 shape 연결점 찾기 (더 정확한 스냅)
      const snapTarget = findSnapTarget(
        { x: rawX, y: rawY },
        getSnapObjects(),
        connector.sourceId ? [connector.sourceId] : [],
      );

      onUpdate({
        endX: snapTarget?.point.x ?? snapToGrid(rawX),
        endY: snapTarget?.point.y ?? snapToGrid(rawY),
        targetId: snapTarget?.object.id,
        targetAnchor: snapTarget?.anchor,
        targetAngle: snapTarget?.angle,
        targetOffsetX: snapTarget?.offsetX,
        targetOffsetY: snapTarget?.offsetY,
        ...(() => {
          const r = getOffsetRatioSafe(snapTarget?.object, snapTarget?.point);
          return {
            targetOffsetRatioX: r.ratioX,
            targetOffsetRatioY: r.ratioY,
          };
        })(),
      });

      setDragState(null);
    },
    [getSnapObjects, connector.sourceId, onUpdate],
  );

  // Midpoint handle drag handlers
  const handleMidpointDragStart = useCallback(
    (handle: MidpointHandle) => {
      // 현재 경로의 세그먼트 정보
      const currentSegments = getSegments(points);
      const segment = currentSegments[handle.segmentIndex];

      // primary bend 찾기 (leftY/rightY 값이 여기에 저장됨)
      const existingBend = connector.elbowBends?.find(
        (b) => b.region === "primary" || (!b.region && b.segmentIndex === 0),
      );

      midpointDragOffsetRef.current = { offset: 0, offsetX: 0 };
      setMidpointDragState({
        segmentIndex: handle.segmentIndex,
        direction: handle.direction,
        handleType: handle.handleType,
        startX: handle.x,
        startY: handle.y,
        currentOffset: 0,
        currentOffsetX: 0, // X축 이동량 초기화
        existingBend,
        segment,
        region: handle.region,
        canAdjustY: handle.canAdjustY,
        verticalTarget: handle.verticalTarget,
        stepIndex: handle.stepIndex, // 연속 계단 인덱스
      });
    },
    [connector.elbowBends, points],
  );

  const handleMidpointDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>, handle: MidpointHandle) => {
      if (!midpointDragState) return;

      const currentX = e.target.x();
      const currentY = e.target.y();

      // 핸들 타입에 따라 축 제한 적용
      let offset: number;
      let offsetX: number = 0; // 추가: X축 이동량
      let isXMovement = false; // 추가: X축 이동 여부

      if (handle.handleType === "center") {
        // 중앙 핸들(수평 세그먼트): FigJam 스타일 - Y축과 X축 모두 허용
        // 드래그 방향에 따라 자동 결정
        const deltaX = Math.abs(currentX - midpointDragState.startX);
        const deltaY = Math.abs(currentY - midpointDragState.startY);

        if (deltaX > deltaY + 5) {
          // X축 이동이 우세: 세그먼트 전체를 좌우로 이동
          offset = 0;
          offsetX = currentX - midpointDragState.startX;
          isXMovement = true;
          e.target.y(midpointDragState.startY);
        } else {
          // Y축 이동 (기존 동작)
          offset = currentY - midpointDragState.startY;
          e.target.x(midpointDragState.startX);
        }
      } else {
        // 좌측/우측 핸들: X축만 이동
        offset = currentX - midpointDragState.startX;
        e.target.y(midpointDragState.startY);
      }

      // 드래그 중 lineRef로 직접 라인 업데이트 (React 상태 우회)
      if (lineRef.current) {
        const existingBends = connector.elbowBends ?? [];
        let tempBends: ElbowBend[] = [...existingBends];
        const existingBend = midpointDragState.existingBend;

        if (handle.handleType === "center") {
          // 수평 세그먼트 핸들: Y축 또는 X축 이동
          // 각 핸들은 자신의 값만 수정, 다른 값은 ...b로 유지

          if (isXMovement) {
            // X축 이동: leftCornerX와 rightCornerX만 동시에 이동 (다른 값 유지)
            if (existingBend) {
              // simple-path bend 감지 (offset만 있고 절대좌표 없는 수직 ㄷ자)
              const isSimplePath =
                existingBend.leftCornerX === undefined &&
                existingBend.rightCornerX === undefined &&
                existingBend.elbowY === undefined;
              if (isSimplePath) {
                // simple-path: offset만 업데이트 (leftCornerX/rightCornerX 설정하면 main path 트리거됨)
                tempBends = existingBends.map((b) => {
                  if (
                    b.region === "primary" ||
                    (!b.region && b.segmentIndex === 0)
                  ) {
                    return {
                      ...b,
                      offset: (existingBend.offset ?? 0) + offsetX,
                    };
                  }
                  return b;
                });
              } else {
                // 저장 시점(handleMidpointDragEnd)과 같은 범위 제한을 쓴다.
                // 안 그러면 드래그 중에는 범위 밖으로 나갔다가 놓는 순간 튄다.
                tempBends = existingBends.map((b) => {
                  if (
                    b.region === "primary" ||
                    (!b.region && b.segmentIndex === 0)
                  ) {
                    return moveElbowX(
                      {
                        ...b,
                        leftCornerX:
                          b.leftCornerX ??
                          defaultCorners(startX, endX).leftCornerX,
                        rightCornerX:
                          b.rightCornerX ??
                          defaultCorners(startX, endX).rightCornerX,
                      },
                      offsetX,
                      { minX: startX, maxX: endX },
                    );
                  }
                  return b;
                });
              }
            } else {
              // bend가 없는 기본 엘보우: 임시 bend 생성
              const isVerticalStraight =
                midpointDragState.direction === "vertical";
              if (isVerticalStraight) {
                // 수직 직선: X 이동 → offset = X 변위 (simple path에서 처리)
                // 커밋(handleMidpointDragEnd)과 같은 임계를 적용한다 — 없으면
                // 10px 미만 드래그에서 미리보기엔 꺾임이 보이다가 놓는 순간
                // 사라진다.
                if (Math.abs(offsetX) >= MIN_EDGE_GAP) {
                  tempBends = [
                    {
                      segmentIndex: 0,
                      offset: offsetX,
                      region: "primary",
                      // leftCornerX/rightCornerX 설정 안 함 → simple path 유지
                    },
                  ];
                }
              } else {
                tempBends = [
                  moveElbowX(
                    {
                      segmentIndex: 0,
                      offset: 0,
                      region: "primary",
                      ...defaultCorners(startX, endX),
                    },
                    offsetX,
                    { minX: startX, maxX: endX },
                  ),
                ];
              }
            }
          } else if (midpointDragState.canAdjustY && midpointDragState.region) {
            // FigJam 스타일 계단식 꺾임: leftY/rightY만 조절 (다른 값 유지)
            const newY = midpointDragState.startY + offset;

            if (
              midpointDragState.stepIndex !== undefined &&
              (midpointDragState.region === "left" ||
                midpointDragState.region === "right")
            ) {
              // 연속 계단의 특정 층 — 저장 시점과 같은 규칙으로 미리보기
              const side = midpointDragState.region;
              const idx = midpointDragState.stepIndex;
              tempBends = existingBends.map((b) =>
                b.region === "primary" || (!b.region && b.segmentIndex === 0)
                  ? adjustStairStepY(b, side, idx, newY)
                  : b,
              );
            } else if (
              midpointDragState.region === "newLeft" ||
              midpointDragState.region === "newRight"
            ) {
              // 새 층 생성 미리보기 — 커밋과 같은 헬퍼(addStairStep)·같은
              // 임계·같은 삽입 위치를 쓴다. start 세그먼트에서 만든 층은
              // 맨 앞, end 세그먼트에서 만든 층은 맨 뒤여야 드래그한 바로
              // 그 구간에서 꺾인다.
              const isLeft = midpointDragState.region === "newLeft";
              const neighborY = isLeft ? startY : endY;
              if (Math.abs(newY - neighborY) >= MIN_EDGE_GAP) {
                tempBends = existingBends.map((b) =>
                  b.region === "primary" || (!b.region && b.segmentIndex === 0)
                    ? addStairStep(
                        b,
                        isLeft ? "left" : "right",
                        newY,
                        midpointDragState.startX,
                        isLeft ? "start" : "end",
                      )
                    : b,
                );
              }
            } else if (midpointDragState.region === "left") {
              // leftY만 수정
              tempBends = existingBends.map((b) => {
                if (
                  b.region === "primary" ||
                  (!b.region && b.segmentIndex === 0)
                ) {
                  return { ...b, leftY: newY };
                }
                return b;
              });
            } else if (midpointDragState.region === "right") {
              // rightY만 수정
              tempBends = existingBends.map((b) => {
                if (
                  b.region === "primary" ||
                  (!b.region && b.segmentIndex === 0)
                ) {
                  return { ...b, rightY: newY };
                }
                return b;
              });
            }
          } else if (midpointDragState.region === "primary" && existingBend) {
            // simple-path bend 감지
            const isSimplePath =
              existingBend.leftCornerX === undefined &&
              existingBend.rightCornerX === undefined &&
              existingBend.elbowY === undefined;
            if (isSimplePath) {
              // 수직 ㄷ자의 수평 핸들 Y 드래그: leftCornerRatio 조절
              // topY = start.y + (end.y - start.y) * ratio
              const dy = endY - startY;
              if (Math.abs(dy) > 1) {
                const newY = midpointDragState.startY + offset;
                const newRatio = Math.max(
                  0.05,
                  Math.min(0.95, (newY - startY) / dy),
                );
                tempBends = existingBends.map((b) => {
                  if (
                    b.region === "primary" ||
                    (!b.region && b.segmentIndex === 0)
                  ) {
                    return { ...b, leftCornerRatio: newRatio };
                  }
                  return b;
                });
              } else {
                // 두 끝점의 Y가 같으면 비율(ratio)로는 엘보우를 표현할 수 없다
                // (0 으로 나눠진다). 예전에는 여기서 그냥 빠져나가서 드래그가
                // 통째로 무시됐다 — 절대좌표 ㄷ자로 승격시킨다.
                const upgraded = createElbowFromStraight(
                  startX,
                  startY,
                  endX,
                  endY,
                  offset,
                );
                if (upgraded) {
                  tempBends = [
                    ...existingBends.filter(
                      (b) =>
                        !(
                          b.region === "primary" ||
                          (!b.region && b.segmentIndex === 0)
                        ),
                    ),
                    upgraded,
                  ];
                }
              }
            } else {
              // elbowY만 조절 — 커밋과 같은 헬퍼를 쓴다. adjustElbowY 는
              // 오프셋이 MIN_EDGE_GAP 미만이면 null(=bend 삭제)을 돌려주는데,
              // 미리보기가 이를 무시하면 드래그 중엔 작은 꺾임이 보이다가
              // 놓는 순간 통째로 사라진다.
              const updated = adjustElbowY(existingBend, offset, startY);
              tempBends = updated
                ? existingBends.map((b) =>
                    b.region === "primary" ||
                    (!b.region && b.segmentIndex === 0)
                      ? updated
                      : b,
                  )
                : existingBends.filter(
                    (b) =>
                      !(
                        b.region === "primary" ||
                        (!b.region && b.segmentIndex === 0)
                      ),
                  );
            }
          } else if (!existingBend) {
            // 직선 → ㄷ자 변환: 새로운 primary bend 생성
            const defaultElbowY = (startY + endY) / 2;
            const newElbowY = defaultElbowY + offset;

            tempBends = existingBends.filter(
              (b) =>
                !(
                  b.region === "primary" ||
                  (!b.region && b.segmentIndex === 0)
                ),
            );
            const isVerticalStraight =
              midpointDragState.direction === "vertical";
            if (isVerticalStraight) {
              // 수직 직선: Y 이동은 무의미 (X 이동만 엘보우 생성)
              // 아무것도 하지 않음 (dragEnd에서 처리)
            } else {
              tempBends.push({
                segmentIndex: 0,
                offset: newElbowY - startY,
                elbowY: newElbowY,
                ...defaultCorners(startX, endX),
                region: "primary",
              });
            }
          }
        } else {
          // left/right 수직 핸들: X축 이동 (코너 위치 조절)
          // simple-path bend는 좌표가 없으므로 무시
          const isSimplePath =
            existingBend &&
            existingBend.leftCornerX === undefined &&
            existingBend.rightCornerX === undefined &&
            existingBend.elbowY === undefined;
          if (!isSimplePath) {
            // 각 핸들은 자신의 값만 수정, 다른 값은 ...b로 유지
            {
              const activeBend = existingBend;
              const verticalTarget = midpointDragState.verticalTarget;
              const stepIndex = midpointDragState.stepIndex;

              // 미리보기는 저장 시점(handleMidpointDragEnd)과 **같은 헬퍼**를 쓴다.
              //
              // 예전에는 여기서 같은 계산을 인라인으로 복제했는데, 헬퍼만 코너
              // 기준으로 고치고 이쪽은 끝점 기준으로 남아서 "드래그 중에는
              // 찌그러졌다가 놓으면 돌아오는" 현상이 생겼다.
              const baseX =
                handle.handleType === "left"
                  ? (activeBend?.leftCornerX ??
                    defaultCorners(startX, endX).leftCornerX)
                  : (activeBend?.rightCornerX ??
                    defaultCorners(startX, endX).rightCornerX);
              const newX = baseX + offset;

              // 각 핸들은 해당 좌표만 독립적으로 수정 (다른 값은 ...b로 유지)
              if (
                activeBend &&
                verticalTarget === "leftStep" &&
                stepIndex !== undefined
              ) {
                tempBends = existingBends.map((b) =>
                  b.region === "primary" || (!b.region && b.segmentIndex === 0)
                    ? adjustStairStepMidX(
                        b,
                        "left",
                        stepIndex,
                        offset,
                        b.leftCornerX ?? startX,
                      )
                    : b,
                );
              } else if (
                activeBend &&
                verticalTarget === "rightStep" &&
                stepIndex !== undefined
              ) {
                tempBends = existingBends.map((b) =>
                  b.region === "primary" || (!b.region && b.segmentIndex === 0)
                    ? adjustStairStepMidX(
                        b,
                        "right",
                        stepIndex,
                        offset,
                        b.rightCornerX ?? endX,
                      )
                    : b,
                );
              } else if (activeBend && verticalTarget === "midLeft") {
                tempBends = existingBends.map((b) =>
                  b.region === "primary" || (!b.region && b.segmentIndex === 0)
                    ? adjustMidLeftX(b, offset, {
                        minX: startX,
                        maxX: b.leftCornerX ?? startX,
                      })
                    : b,
                );
              } else if (activeBend && verticalTarget === "midRight") {
                tempBends = existingBends.map((b) =>
                  b.region === "primary" || (!b.region && b.segmentIndex === 0)
                    ? adjustMidRightX(b, offset, {
                        minX: b.rightCornerX ?? endX,
                        maxX: endX,
                      })
                    : b,
                );
              } else if (handle.handleType === "left") {
                // leftCornerX만 수정
                const clampedX = Math.min(
                  newX,
                  (activeBend?.rightCornerX ?? endX) - 20,
                );
                if (activeBend) {
                  tempBends = existingBends.map((b) => {
                    if (
                      b.region === "primary" ||
                      (!b.region && b.segmentIndex === 0)
                    ) {
                      return { ...b, leftCornerX: clampedX };
                    }
                    return b;
                  });
                } else {
                  // bend 없는 기본 L자: 새 bend 생성
                  tempBends = [
                    {
                      segmentIndex: 0,
                      offset: 0,
                      region: "primary",
                      leftCornerX: clampedX,
                      rightCornerX: clampedX,
                    },
                  ];
                }
              } else {
                // rightCornerX만 수정
                const clampedX = Math.max(
                  newX,
                  (activeBend?.leftCornerX ?? startX) + 20,
                );
                if (activeBend) {
                  tempBends = existingBends.map((b) => {
                    if (
                      b.region === "primary" ||
                      (!b.region && b.segmentIndex === 0)
                    ) {
                      return { ...b, rightCornerX: clampedX };
                    }
                    return b;
                  });
                } else {
                  // bend 없는 기본 L자: 새 bend 생성
                  tempBends = [
                    {
                      segmentIndex: 0,
                      offset: 0,
                      region: "primary",
                      leftCornerX: clampedX,
                      rightCornerX: clampedX,
                    },
                  ];
                }
              }
            }
          } // end if (!isSimplePath) for left/right handles
        }

        const newPoints = calculatePathPoints(
          startX,
          startY,
          endX,
          endY,
          pathStyle,
          tempBends,
          connector.sourceAnchor,
          connector.targetAnchor,
          elbowSizeOptions,
        );
        // 화살표 시작점/끝점 조정 (shape border에서 띄움)
        const adjustedPoints = adjustArrowEndpoints(
          newPoints,
          !!connector.sourceId && startMarker !== "none",
          !!connector.targetId && endMarker !== "none",
        );

        lineRef.current.points(adjustedPoints);

        // 직접 Layer 다시 그리기 (dragCoordinator 대신)
        const layer = lineRef.current.getLayer();
        if (layer) {
          layer.batchDraw();
        }
        dragCoordinator.scheduleDraw();
        // 드래그 중에는 React 상태 업데이트하지 않음 (Konva 직접 조작만 사용)
        // setDragPoints는 리렌더링을 트리거하여 핸들 위치가 변경되고 드래그가 취소됨
        // 대신 lineRef.current.points()로 직접 업데이트하고, 드래그 끝날 때 상태 저장
      }
      // 리렌더를 일으키지 않는다 (위 주석 참조)
      midpointDragOffsetRef.current = { offset, offsetX };
    },
    [
      midpointDragState,
      startX,
      startY,
      endX,
      endY,
      pathStyle,
      connector.elbowCornerStyle,
      connector.elbowCornerRadius,
      connector.elbowBends,
      elbowSizeOptions,
    ],
  );

  const handleMidpointDragEnd = useCallback(
    (_handle: MidpointHandle) => {
      if (!midpointDragState) return;

      const existingBends = connector.elbowBends ?? [];
      // store에서 최신 bend 가져오기
      const storeBend = existingBends.find(
        (b) => b.region === "primary" || (!b.region && b.segmentIndex === 0),
      );
      // 드래그 시작 시점의 bend (fallback)
      const existingBend = midpointDragState.existingBend;
      // 최종 사용할 bend (store 우선)
      const currentBend = storeBend ?? existingBend;

      const { handleType, verticalTarget, region } = midpointDragState;
      const { offset: currentOffset, offsetX: currentOffsetX } =
        midpointDragOffsetRef.current;
      const isXMovement =
        Math.abs(currentOffsetX) > Math.abs(currentOffset) + 5;

      let newBend: ElbowBend | null = null;

      // ===== CENTER 핸들 (수평 세그먼트) =====
      if (handleType === "center") {
        // 1. X축 이동: 엘보우 전체 이동 (leftCornerX, rightCornerX 동시 이동)
        if (isXMovement) {
          // simple-path bend 감지: offset만 있고 절대좌표 없는 수직 ㄷ자
          const isSimplePath =
            currentBend &&
            currentBend.leftCornerX === undefined &&
            currentBend.rightCornerX === undefined &&
            currentBend.elbowY === undefined;
          const isVerticalStraight = midpointDragState.direction === "vertical";

          if (isSimplePath) {
            // 기존 simple-path bend: offset 업데이트
            newBend = {
              ...currentBend,
              offset: (currentBend.offset ?? 0) + currentOffsetX,
            };
            // offset이 너무 작으면 리셋
            if (Math.abs(newBend.offset ?? 0) < MIN_EDGE_GAP) {
              onUpdate({ elbowBends: [] });
              setMidpointDragState(null);
              setDragPoints(null);
              return;
            }
          } else if (isVerticalStraight && !currentBend) {
            // 수직 직선 + X 이동: simple path용 offset bend 생성
            if (Math.abs(currentOffsetX) >= MIN_EDGE_GAP) {
              newBend = {
                segmentIndex: 0,
                offset: currentOffsetX,
                region: "primary" as const,
              };
            }
          } else {
            const baseBend = currentBend ?? {
              segmentIndex: 0,
              offset: 0,
              region: "primary" as const,
              ...defaultCorners(startX, endX),
            };
            newBend = moveElbowX(baseBend, currentOffsetX, {
              minX: startX,
              maxX: endX,
            });
          }
        }
        // 2. 계단 생성/조절 (left/right region)
        // 2-0. 연속 계단의 특정 층 조절 (stepIndex 가 있으면 그 층만 건드린다)
        else if (
          currentBend &&
          (region === "left" || region === "right") &&
          midpointDragState.stepIndex !== undefined
        ) {
          const side = region;
          const idx = midpointDragState.stepIndex;
          const newY = midpointDragState.startY + currentOffset;
          const steps =
            (side === "left"
              ? currentBend.leftYSteps
              : currentBend.rightYSteps) ?? [];

          // 이웃 층과 같은 높이로 끌면 그 층은 의미가 없어진다 → 제거
          const neighborY =
            idx > 0 ? steps[idx - 1]?.y : side === "left" ? startY : endY;
          const isFlat =
            neighborY !== undefined && Math.abs(newY - neighborY) < 10;

          newBend = isFlat
            ? removeStairStep(currentBend, side, idx)
            : adjustStairStepY(currentBend, side, idx, newY);
        }
        // 2-1. 새 층 생성 — 계단이 이미 있는 쪽의 start/end 세그먼트 드래그.
        //      기존 leftY/rightY 를 움직이면 "여기를 끌었는데 저기가 움직이는"
        //      현상이 된다. 새 층을 드래그한 구간 쪽에 끼운다.
        else if (
          (region === "newLeft" || region === "newRight") &&
          currentBend
        ) {
          const isLeft = region === "newLeft";
          const newY = midpointDragState.startY + currentOffset;
          const neighborY = isLeft ? startY : endY;
          if (Math.abs(newY - neighborY) >= MIN_EDGE_GAP) {
            newBend = addStairStep(
              currentBend,
              isLeft ? "left" : "right",
              newY,
              midpointDragState.startX,
              isLeft ? "start" : "end",
            );
          }
          // 임계 미만이면 저장하지 않는다 (미리보기도 같은 규칙이라 튀지 않음)
        } else if (region === "left" && currentBend) {
          const newY = midpointDragState.startY + currentOffset;
          const isReset = Math.abs(newY - startY) < 10;
          if (isReset) {
            // 계단 리셋: leftY, midLeftX 제거
            newBend = { ...currentBend };
            delete newBend.leftY;
            delete newBend.midLeftX;
          } else {
            newBend = adjustLeftY(currentBend, newY);
            // 처음 계단 생성 시 midLeftX 설정
            if (!newBend.midLeftX) {
              newBend.midLeftX = midpointDragState.startX;
            }
            // 절대 좌표들이 없으면 저장 (Shape 이동 시 고정되도록)
            if (newBend.elbowY === undefined) {
              newBend.elbowY = startY + (currentBend.offset ?? 0);
            }
            if (newBend.leftCornerX === undefined) {
              newBend.leftCornerX = defaultCorners(startX, endX).leftCornerX;
            }
            if (newBend.rightCornerX === undefined) {
              newBend.rightCornerX = defaultCorners(startX, endX).rightCornerX;
            }
          }
        } else if (region === "right" && currentBend) {
          const newY = midpointDragState.startY + currentOffset;
          const isReset = Math.abs(newY - endY) < 10;
          if (isReset) {
            // 계단 리셋: rightY, midRightX 제거
            newBend = { ...currentBend };
            delete newBend.rightY;
            delete newBend.midRightX;
          } else {
            newBend = adjustRightY(currentBend, newY);
            // 처음 계단 생성 시 midRightX 설정
            if (!newBend.midRightX) {
              newBend.midRightX = midpointDragState.startX;
            }
            // 절대 좌표들이 없으면 저장 (Shape 이동 시 고정되도록)
            if (newBend.elbowY === undefined) {
              newBend.elbowY = startY + (currentBend.offset ?? 0);
            }
            if (newBend.leftCornerX === undefined) {
              newBend.leftCornerX = defaultCorners(startX, endX).leftCornerX;
            }
            if (newBend.rightCornerX === undefined) {
              newBend.rightCornerX = defaultCorners(startX, endX).rightCornerX;
            }
          }
        }
        // 3. 연속 계단(다층) — 위의 2-0 분기에서 stepIndex 로 층별 조절을 처리한다.
        //    핸들은 getMidpointHandlePositions 가 층마다 하나씩 만든다.
        //    newLeft/newRight(새 층 생성)는 addStairStep 으로 별도 처리.
        // 4. 기존 엘보우 Y축 조절 (primary region)
        else if (region === "primary" && currentBend) {
          // simple-path bend 감지
          const isSimplePath =
            currentBend.leftCornerX === undefined &&
            currentBend.rightCornerX === undefined &&
            currentBend.elbowY === undefined;
          if (isSimplePath) {
            // 수직 ㄷ자: Y 드래그 → leftCornerRatio 조절
            const dy = endY - startY;
            if (Math.abs(dy) > 1) {
              const newY = midpointDragState.startY + currentOffset;
              const newRatio = Math.max(
                0.05,
                Math.min(0.95, (newY - startY) / dy),
              );
              newBend = { ...currentBend, leftCornerRatio: newRatio };
            } else {
              // 끝점 Y가 같으면 비율로 표현 불가 → 절대좌표 ㄷ자로 승격
              // (승격하지 않으면 newBend 가 null 이라 드래그가 조용히 사라진다)
              newBend = createElbowFromStraight(
                startX,
                startY,
                endX,
                endY,
                currentOffset,
              );
            }
          } else {
            newBend = adjustElbowY(currentBend, currentOffset, startY);
            // null이면 엘보우 삭제 (직선으로 리셋)
            if (!newBend) {
              onUpdate({ elbowBends: [] });
              setMidpointDragState(null);
              setDragPoints(null);
              return;
            }
          }
        }
        // 5. 직선 → 엘보우 생성 (bend 없는 상태)
        else if (!currentBend) {
          const isVerticalStraight = midpointDragState.direction === "vertical";
          if (isVerticalStraight) {
            // 수직 직선: X 이동으로만 엘보우 생성 (Y 이동은 무시)
            if (Math.abs(currentOffsetX) >= 10) {
              newBend = {
                segmentIndex: 0,
                offset: currentOffsetX,
                region: "primary" as const,
                // leftCornerX/rightCornerX 없음 → simple path 유지
              };
            }
          } else {
            // 기본 엘보우 생성 (currentOffset으로 드래그 거리 반영)
            const defaultElbowY = (startY + endY) / 2;
            newBend = createElbowFromStraight(
              startX,
              startY,
              endX,
              endY,
              defaultElbowY - startY + currentOffset,
            );

            // region이 left 또는 right인 경우 해당 계단도 설정
            if (newBend) {
              if (region === "left") {
                const newY = midpointDragState.startY + currentOffset;
                newBend.leftY = newY;
                newBend.midLeftX = midpointDragState.startX;
              } else if (region === "right") {
                const newY = midpointDragState.startY + currentOffset;
                newBend.rightY = newY;
                newBend.midRightX = midpointDragState.startX;
              }
            }
          } // end else (horizontal)
        }
      }

      // ===== LEFT/RIGHT 핸들 (수직 세그먼트) =====
      else if (handleType === "left" || handleType === "right") {
        // simple-path bend는 leftCornerX/rightCornerX가 없어서 수직 핸들 조절 불가
        const isSimplePath =
          currentBend &&
          currentBend.leftCornerX === undefined &&
          currentBend.rightCornerX === undefined &&
          currentBend.elbowY === undefined;
        if (isSimplePath) {
          // simple-path bend: 수직 핸들 드래그 무시 (offset/ratio만 사용)
          setMidpointDragState(null);
          setDragPoints(null);
          return;
        }
        const activeBend = currentBend ?? {
          segmentIndex: 0,
          offset: 0,
          region: "primary" as const,
          ...defaultCorners(startX, endX),
        };
        const dragDelta = currentOffset;
        const stepIndex = midpointDragState.stepIndex;

        // 1. leftStep: 연속 계단 leftYSteps[stepIndex].midX 조절
        if (verticalTarget === "leftStep" && stepIndex !== undefined) {
          newBend = adjustStairStepMidX(
            activeBend,
            "left",
            stepIndex,
            dragDelta,
            activeBend.leftCornerX ?? startX,
          );
        }
        // 2. rightStep: 연속 계단 rightYSteps[stepIndex].midX 조절
        else if (verticalTarget === "rightStep" && stepIndex !== undefined) {
          newBend = adjustStairStepMidX(
            activeBend,
            "right",
            stepIndex,
            dragDelta,
            activeBend.rightCornerX ?? endX,
          );
        }
        // 3. midLeft: 좌측 계단 중간선 X축 조절
        else if (verticalTarget === "midLeft") {
          newBend = adjustMidLeftX(activeBend, dragDelta, {
            minX: startX,
            maxX: activeBend.leftCornerX!,
          });
        }
        // 4. midRight: 우측 계단 중간선 X축 조절
        else if (verticalTarget === "midRight") {
          newBend = adjustMidRightX(activeBend, dragDelta, {
            minX: activeBend.rightCornerX!,
            maxX: endX,
          });
        }
        // 5. left: 좌측 코너 X축 조절
        else if (handleType === "left") {
          // X축 반전 여부 확인
          const isXReversed = startX > endX;
          if (isXReversed) {
            newBend = adjustLeftCornerX(activeBend, dragDelta, {
              minX: startX,
              maxX: activeBend.rightCornerX ?? startX + 200,
            });
          } else {
            newBend = adjustLeftCornerX(activeBend, dragDelta, {
              minX: startX,
              maxX: activeBend.rightCornerX!,
            });
          }
        }
        // 6. right: 우측 코너 X축 조절
        else if (handleType === "right") {
          const isXReversed = startX > endX;
          if (isXReversed) {
            newBend = adjustRightCornerX(activeBend, dragDelta, {
              minX: activeBend.leftCornerX!,
              maxX: Math.max(startX, endX) + 500,
            });
          } else {
            newBend = adjustRightCornerX(activeBend, dragDelta, {
              minX: activeBend.leftCornerX!,
              maxX: endX,
            });
          }
        }
      }

      // 결과 저장
      if (newBend) {
        const newBends = existingBends.filter(
          (b) =>
            !(b.region === "primary" || (!b.region && b.segmentIndex === 0)),
        );
        newBends.push(newBend);
        onUpdate({ elbowBends: newBends });
      }

      setMidpointDragState(null);
      setDragPoints(null);
    },
    [
      midpointDragState,
      connector.elbowBends,
      onUpdate,
      startX,
      startY,
      endX,
      endY,
    ],
  );

  // Render marker content (without position - position is handled by parent Group)
  const renderMarkerContent = useCallback(
    (markerStyle: MarkerStyle) => {
      const size = 6;
      // 회전은 부모 Group에서 처리하므로 여기서는 기본 방향(0도)으로 렌더링
      // 단, filledArrow는 -90도 보정 필요

      switch (markerStyle) {
        case "arrow":
          return (
            <Line
              points={[-size, -size / 2, 0, 0, -size, size / 2]}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              lineCap="round"
              lineJoin="round"
              listening={false}
            />
          );
        case "filledArrow":
          return (
            <RegularPolygon
              sides={3}
              radius={size}
              fill={strokeColor}
              rotation={-90}
              listening={false}
            />
          );
        case "diamond":
          return (
            <RegularPolygon
              sides={4}
              radius={size * 0.8}
              fill={strokeColor}
              listening={false}
            />
          );
        case "circle":
          return (
            <Circle radius={size / 2} fill={strokeColor} listening={false} />
          );
        default:
          return null;
      }
    },
    [strokeColor, strokeWidth],
  );

  // Label position (based on labelT or center of path)
  const labelT = connector.labelT ?? 0.5;
  const labelOffsetY = connector.labelOffsetY ?? 0;
  const labelPosition = useMemo(() => {
    const pointOnPath = getPointOnPath(points, labelT);
    return {
      x: pointOnPath.x,
      y: pointOnPath.y + labelOffsetY,
    };
  }, [points, labelT, labelOffsetY]);

  // Don't render if start and end are the same
  if (startX === endX && startY === endY) return null;

  // Check if we should use Arrow component (for simple arrow end marker)
  const useArrowComponent =
    endMarker === "arrow" && startMarker === "none" && pathStyle === "straight";

  // Determine handle colors based on snap state
  const startHandleColor =
    dragState?.type === "start" && dragState.snappedTo
      ? "#22c55e"
      : connector.sourceId
        ? "#22c55e"
        : "#0D99FF";
  const endHandleColor =
    dragState?.type === "end" && dragState.snappedTo
      ? "#22c55e"
      : connector.targetId
        ? "#22c55e"
        : "#0D99FF";

  // Calculate bounding box for multi-select border
  const minX = Math.min(startX, endX);
  const minY = Math.min(startY, endY);
  const maxX = Math.max(startX, endX);
  const maxY = Math.max(startY, endY);
  const borderPadding = 10;

  return (
    <Group ref={groupRef} id={connector.id}>
      {/* 다중 선택 시 개별 선택 테두리 */}
      {isMultiSelected && (
        <Rect
          x={minX - borderPadding}
          y={minY - borderPadding}
          width={maxX - minX + borderPadding * 2}
          height={maxY - minY + borderPadding * 2}
          stroke="#0D99FF"
          strokeWidth={2 / zoom}
          fill="transparent"
          dash={[4, 4]}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
      {useArrowComponent ? (
        <Arrow
          ref={lineRef as React.RefObject<Konva.Arrow>}
          points={dragPoints ?? arrowPoints}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill={strokeColor}
          pointerLength={6}
          pointerWidth={6}
          lineCap="round"
          lineJoin="round"
          dash={getDashPattern(lineStyle)}
          hitStrokeWidth={20}
          onClick={onSelect}
          onTap={onSelect}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
        />
      ) : (
        <>
          {/* Rounded elbow connector uses Shape with sceneFunc for curved corners */}
          {pathStyle === "elbowed" &&
          connectorElbowCornerStyle === "rounded" ? (
            <Shape
              ref={roundedElbowRef}
              sceneFunc={(context, shape) => {
                const currentPoints = dragPoints ?? arrowPoints;
                if (currentPoints.length < 4) return;

                const radius = connectorElbowCornerRadius;
                context.beginPath();
                context.moveTo(currentPoints[0]!, currentPoints[1]!);

                // Process each corner point
                for (let i = 2; i < currentPoints.length - 2; i += 2) {
                  const prevX = currentPoints[i - 2]!;
                  const prevY = currentPoints[i - 1]!;
                  const currX = currentPoints[i]!;
                  const currY = currentPoints[i + 1]!;
                  const nextX = currentPoints[i + 2]!;
                  const nextY = currentPoints[i + 3]!;

                  // Calculate direction vectors
                  const dx1 = currX - prevX;
                  const dy1 = currY - prevY;
                  const dx2 = nextX - currX;
                  const dy2 = nextY - currY;
                  const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
                  const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

                  if (len1 === 0 || len2 === 0) {
                    context.lineTo(currX, currY);
                    continue;
                  }

                  // Calculate max radius based on segment lengths
                  const maxRadius = Math.min(len1 / 2, len2 / 2, radius);

                  // Calculate corner start and end points
                  const cornerStartX = currX - (dx1 / len1) * maxRadius;
                  const cornerStartY = currY - (dy1 / len1) * maxRadius;
                  const cornerEndX = currX + (dx2 / len2) * maxRadius;
                  const cornerEndY = currY + (dy2 / len2) * maxRadius;

                  // Draw line to corner start, then quadratic curve through corner
                  context.lineTo(cornerStartX, cornerStartY);
                  context.quadraticCurveTo(
                    currX,
                    currY,
                    cornerEndX,
                    cornerEndY,
                  );
                }

                // Draw final segment
                context.lineTo(
                  currentPoints[currentPoints.length - 2]!,
                  currentPoints[currentPoints.length - 1]!,
                );

                context.strokeShape(shape);
              }}
              hitFunc={(context, shape) => {
                // Hit detection must follow the same path as sceneFunc
                const currentPoints = dragPoints ?? arrowPoints;
                if (currentPoints.length < 4) return;

                const radius = connectorElbowCornerRadius;
                context.beginPath();
                context.moveTo(currentPoints[0]!, currentPoints[1]!);

                // Process each corner point (same logic as sceneFunc)
                for (let i = 2; i < currentPoints.length - 2; i += 2) {
                  const prevX = currentPoints[i - 2]!;
                  const prevY = currentPoints[i - 1]!;
                  const currX = currentPoints[i]!;
                  const currY = currentPoints[i + 1]!;
                  const nextX = currentPoints[i + 2]!;
                  const nextY = currentPoints[i + 3]!;

                  const dx1 = currX - prevX;
                  const dy1 = currY - prevY;
                  const dx2 = nextX - currX;
                  const dy2 = nextY - currY;
                  const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
                  const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

                  if (len1 === 0 || len2 === 0) {
                    context.lineTo(currX, currY);
                    continue;
                  }

                  const maxRadius = Math.min(len1 / 2, len2 / 2, radius);
                  const cornerStartX = currX - (dx1 / len1) * maxRadius;
                  const cornerStartY = currY - (dy1 / len1) * maxRadius;
                  const cornerEndX = currX + (dx2 / len2) * maxRadius;
                  const cornerEndY = currY + (dy2 / len2) * maxRadius;

                  context.lineTo(cornerStartX, cornerStartY);
                  context.quadraticCurveTo(
                    currX,
                    currY,
                    cornerEndX,
                    cornerEndY,
                  );
                }

                context.lineTo(
                  currentPoints[currentPoints.length - 2]!,
                  currentPoints[currentPoints.length - 1]!,
                );

                // Use strokeShape for hit detection along the path
                context.strokeShape(shape);
              }}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              lineCap="round"
              lineJoin="round"
              dash={getDashPattern(lineStyle)}
              hitStrokeWidth={20}
              onClick={onSelect}
              onTap={onSelect}
              perfectDrawEnabled={false}
              shadowForStrokeEnabled={false}
            />
          ) : (
            <Line
              ref={lineRef as React.RefObject<Konva.Line>}
              points={dragPoints ?? arrowPoints}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              lineCap="round"
              lineJoin="round"
              dash={getDashPattern(lineStyle)}
              tension={pathStyle === "curved" ? 0.5 : 0}
              hitStrokeWidth={20}
              onClick={onSelect}
              onTap={onSelect}
              perfectDrawEnabled={false}
              shadowForStrokeEnabled={false}
            />
          )}
          {/* Start Marker - Group으로 감싸서 ref로 위치/회전 제어 (shape border에서 3px 간격) */}
          {startMarker !== "none" && (
            <Group
              ref={startMarkerRef}
              x={finalStartPoint.x}
              y={finalStartPoint.y}
              rotation={startAngle + 180}
            >
              {renderMarkerContent(startMarker)}
            </Group>
          )}
          {/* End Marker - 경로의 실제 마지막 점에 렌더링 (직선 스냅 시 endX/endY와 다를 수 있음) */}
          {endMarker !== "none" && (
            <Group
              ref={endMarkerRef}
              x={finalEndPoint.x}
              y={finalEndPoint.y}
              rotation={endAngle}
            >
              {renderMarkerContent(endMarker)}
            </Group>
          )}
        </>
      )}

      {/* Drag overlay for standalone connector */}
      {canDragConnector && (
        <Rect
          x={minX - borderPadding}
          y={minY - borderPadding}
          width={maxX - minX + borderPadding * 2}
          height={maxY - minY + borderPadding * 2}
          fill="rgba(0,0,0,0.001)"
          draggable
          onDragStart={handleConnectorDragStart}
          onDragMove={handleConnectorDragMove}
          onDragEnd={handleConnectorDragEnd}
          perfectDrawEnabled={false}
        />
      )}

      {/* Label */}
      {connector.label && (
        <Group
          x={labelPosition.x}
          y={labelPosition.y}
          draggable={isSelected && !connector.locked}
          onDragMove={(e) => {
            const newPos = { x: e.target.x(), y: e.target.y() };
            const closest = getClosestPointOnPath(points, newPos);
            // Snap to path if within 50px
            if (closest.distance <= 50) {
              e.target.position({ x: closest.x, y: closest.y });
            }
          }}
          onDragEnd={(e) => {
            const finalPos = { x: e.target.x(), y: e.target.y() };
            const closest = getClosestPointOnPath(points, finalPos);
            // Clamp t to 0~1
            const newT = Math.max(0, Math.min(1, closest.t));
            const newOffsetY = finalPos.y - closest.y;
            onUpdate({ labelT: newT, labelOffsetY: newOffsetY });
            // Reset position to calculated position (will be recalculated based on new labelT)
            e.target.position({ x: 0, y: 0 });
          }}
        >
          <Rect
            x={-connector.label.length * 3.5 - 4}
            y={-10}
            width={connector.label.length * 7 + 8}
            height={20}
            fill="white"
            cornerRadius={4}
            shadowColor="black"
            shadowBlur={4}
            shadowOpacity={0.1}
          />
          <Text
            x={0}
            y={-6}
            text={connector.label}
            fontSize={12}
            fill="#374151"
            align="center"
            offsetX={connector.label.length * 3.5}
            listening={false}
            perfectDrawEnabled={false}
          />
        </Group>
      )}

      {/* Draggable endpoint handles - only when selected */}
      {isSelected && (
        <>
          {/* Start point handle - fixed screen size */}
          <Circle
            ref={startHandleRef}
            x={startX}
            y={startY}
            radius={handleRadius}
            fill={startHandleColor}
            stroke="white"
            strokeWidth={handleStroke}
            draggable
            hitStrokeWidth={hitArea}
            onDragMove={handleStartDragMove}
            onDragEnd={handleStartDragEnd}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
          {/* End point handle - fixed screen size */}
          <Circle
            ref={endHandleRef}
            x={endX}
            y={endY}
            radius={handleRadius}
            fill={endHandleColor}
            stroke="white"
            strokeWidth={handleStroke}
            draggable
            hitStrokeWidth={hitArea}
            onDragMove={handleEndDragMove}
            onDragEnd={handleEndDragEnd}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
          {/* Midpoint handles for elbowed connectors */}
          {/* center: 파란색 (Y축 이동), left/right: 회색 (X축 이동) */}
          {pathStyle === "elbowed" &&
            midpointHandles.map((handle) => {
              const isCenter = handle.handleType === "center";
              const fillColor = isCenter ? "#0D99FF" : "#94a3b8";
              const cursor = isCenter ? "ns-resize" : "ew-resize";
              // 드래그 중인 핸들인지 확인 (드래그 중에는 Konva가 위치 관리)
              const isDraggingThis =
                midpointDragState?.segmentIndex === handle.segmentIndex;

              // 드래그 중에는 나머지 핸들을 숨긴다.
              //
              // 드래그 중 선은 lineRef 로 직접 갱신하고 React 상태(points)는
              // 건드리지 않는다(그러면 리렌더가 드래그를 취소한다). 그래서 다른
              // 핸들들은 드래그 전 경로 기준 좌표에 그대로 남아, 선에서 떨어진
              // 유령 점처럼 보인다. 드래그가 끝나면 다시 나타난다.
              if (midpointDragState && !isDraggingThis) return null;

              return (
                <Circle
                  key={`midpoint-${handle.segmentIndex}`}
                  // 드래그 중인 핸들은 x, y 업데이트 안 함 (Konva 드래그와 충돌 방지)
                  {...(isDraggingThis ? {} : { x: handle.x, y: handle.y })}
                  radius={5 / zoom}
                  fill={fillColor}
                  stroke="white"
                  strokeWidth={1.5 / zoom}
                  draggable={handle.canBend}
                  hitStrokeWidth={hitArea}
                  onDragStart={() => handleMidpointDragStart(handle)}
                  onDragMove={(e) => handleMidpointDragMove(e, handle)}
                  onDragEnd={() => handleMidpointDragEnd(handle)}
                  cursor={handle.canBend ? cursor : "not-allowed"}
                  perfectDrawEnabled={false}
                  shadowForStrokeEnabled={false}
                />
              );
            })}
        </>
      )}
    </Group>
  );
});
