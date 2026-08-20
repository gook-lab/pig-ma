import { memo, useRef, useCallback, useMemo } from "react";
import { Stage, Layer, Rect, Line, Circle } from "react-konva";
import { Plus, Minus, RotateCcw } from "lucide-react";
import type Konva from "konva";
import type { CanvasObject } from "@/types";
import { toPointArray } from "@/utils/geometry";
import {
  zoomIn as getNextZoom,
  zoomOut as getPrevZoom,
  DEFAULT_ZOOM,
} from "@/constants/zoom";
import { isShape } from "@/utils/typeGuards";

interface MinimapProps {
  objects: CanvasObject[];
  viewport: { x: number; y: number; zoom: number };
  stageSize: { width: number; height: number };
  onViewportChange: (x: number, y: number) => void;
  onZoomChange: (zoom: number) => void;
  hideUI?: boolean;
}

// 미니맵 크기 (패딩 없이 전체 영역 사용)
const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 120;
const MINIMAP_PADDING = 0;

// 최소 줌 (10%)에서의 최대 뷰포트를 기준으로 미니맵 범위 설정
const MIN_ZOOM = 0.1;

export const Minimap = memo(function Minimap({
  objects,
  viewport,
  stageSize,
  onViewportChange,
  onZoomChange,
  hideUI = false,
}: MinimapProps) {
  const stageRef = useRef<Konva.Stage>(null);

  // 줌 핸들러
  const handleZoomIn = useCallback(() => {
    const nextZoom = getNextZoom(viewport.zoom);
    onZoomChange(nextZoom);
  }, [viewport.zoom, onZoomChange]);

  const handleZoomOut = useCallback(() => {
    const prevZoom = getPrevZoom(viewport.zoom);
    onZoomChange(prevZoom);
  }, [viewport.zoom, onZoomChange]);

  const handleResetZoom = useCallback(() => {
    onZoomChange(DEFAULT_ZOOM);
  }, [onZoomChange]);

  // 캔버스 범위 계산 (10% 줌 기준 + 객체 위치 고려 동적 확장)
  // FigJam 스타일: 10% 줌에서 뷰포트가 미니맵 전체를 차지 + 객체 영역 포함
  const canvasBounds = useMemo(() => {
    // 10% 줌에서의 최대 뷰포트 크기를 기준으로 기본 범위 설정
    const maxViewportWidth = stageSize.width / MIN_ZOOM;
    const maxViewportHeight = stageSize.height / MIN_ZOOM;

    // 중심점 (0, 0) 기준 기본 범위
    let minX = -maxViewportWidth / 2;
    let minY = -maxViewportHeight / 2;
    let maxX = maxViewportWidth / 2;
    let maxY = maxViewportHeight / 2;

    // 객체 위치에 따라 bounds 동적 확장
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

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [stageSize, objects]);

  // 스케일 및 실제 캔버스 영역 계산 (화면 비율에 맞게)
  const { scale, canvasArea } = useMemo(() => {
    const availableWidth = MINIMAP_WIDTH - MINIMAP_PADDING * 2;
    const availableHeight = MINIMAP_HEIGHT - MINIMAP_PADDING * 2;

    const scaleX = availableWidth / canvasBounds.width;
    const scaleY = availableHeight / canvasBounds.height;
    const s = Math.min(scaleX, scaleY);

    // 실제 캔버스 영역 크기
    const canvasWidth = canvasBounds.width * s;
    const canvasHeight = canvasBounds.height * s;

    // 중앙 정렬
    const canvasX = MINIMAP_PADDING + (availableWidth - canvasWidth) / 2;
    const canvasY = MINIMAP_PADDING + (availableHeight - canvasHeight) / 2;

    return {
      scale: s,
      canvasArea: {
        x: canvasX,
        y: canvasY,
        width: canvasWidth,
        height: canvasHeight,
      },
    };
  }, [canvasBounds]);

  // 캔버스 좌표 → 미니맵 좌표 변환 (canvasArea 기준)
  const toMinimapX = useCallback(
    (x: number) => {
      return (x - canvasBounds.minX) * scale + canvasArea.x;
    },
    [canvasBounds.minX, scale, canvasArea.x],
  );

  const toMinimapY = useCallback(
    (y: number) => {
      return (y - canvasBounds.minY) * scale + canvasArea.y;
    },
    [canvasBounds.minY, scale, canvasArea.y],
  );

  // 미니맵 좌표 → 캔버스 좌표 변환
  const toCanvasX = useCallback(
    (x: number) => {
      return (x - canvasArea.x) / scale + canvasBounds.minX;
    },
    [canvasBounds.minX, scale, canvasArea.x],
  );

  const toCanvasY = useCallback(
    (y: number) => {
      return (y - canvasArea.y) / scale + canvasBounds.minY;
    },
    [canvasBounds.minY, scale, canvasArea.y],
  );

  // 현재 뷰포트 영역 (파란색 박스) - bounds 내로 클램프
  const viewportRect = useMemo(() => {
    const viewWidth = stageSize.width / viewport.zoom;
    const viewHeight = stageSize.height / viewport.zoom;

    // 뷰포트 좌상단 캔버스 좌표
    let left = -viewport.x / viewport.zoom;
    let top = -viewport.y / viewport.zoom;

    // bounds 내로 클램프
    left = Math.max(
      canvasBounds.minX,
      Math.min(canvasBounds.maxX - viewWidth, left),
    );
    top = Math.max(
      canvasBounds.minY,
      Math.min(canvasBounds.maxY - viewHeight, top),
    );

    // 뷰포트 크기가 bounds보다 크면 bounds 전체로 설정 (10% 줌)
    const clampedWidth = Math.min(viewWidth, canvasBounds.width);
    const clampedHeight = Math.min(viewHeight, canvasBounds.height);

    // 미니맵 좌표로 변환
    const minimapX = toMinimapX(left);
    const minimapY = toMinimapY(top);
    const minimapWidth = clampedWidth * scale;
    const minimapHeight = clampedHeight * scale;

    return {
      x: minimapX,
      y: minimapY,
      width: Math.max(4, minimapWidth),
      height: Math.max(4, minimapHeight),
    };
  }, [viewport, stageSize, scale, canvasBounds, toMinimapX, toMinimapY]);

  // 클릭으로 뷰포트 이동 (bounds 내로 클램프)
  const handleClick = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;

      const pos = stage.getPointerPosition();
      if (!pos) return;

      // 클릭 위치를 캔버스 좌표로 변환
      const canvasX = toCanvasX(pos.x);
      const canvasY = toCanvasY(pos.y);

      // 뷰포트 중심을 클릭 위치로 이동
      const viewWidth = stageSize.width / viewport.zoom;
      const viewHeight = stageSize.height / viewport.zoom;

      // 뷰포트 좌상단 계산
      let viewportLeft = canvasX - viewWidth / 2;
      let viewportTop = canvasY - viewHeight / 2;

      // bounds 내로 클램프
      viewportLeft = Math.max(
        canvasBounds.minX,
        Math.min(canvasBounds.maxX - viewWidth, viewportLeft),
      );
      viewportTop = Math.max(
        canvasBounds.minY,
        Math.min(canvasBounds.maxY - viewHeight, viewportTop),
      );

      const newViewportX = -viewportLeft * viewport.zoom;
      const newViewportY = -viewportTop * viewport.zoom;

      onViewportChange(newViewportX, newViewportY);
    },
    [
      toCanvasX,
      toCanvasY,
      stageSize,
      viewport.zoom,
      canvasBounds,
      onViewportChange,
    ],
  );

  // 미니맵용 형광색 (눈에 잘 띄는 색상)
  const MINIMAP_COLORS = {
    stickyNote: "#facc15", // 밝은 노란색
    shape: "#22d3ee", // 밝은 시안
    rectangle: "#a78bfa", // 밝은 보라색
    textBox: "#4ade80", // 밝은 녹색
    image: "#fb923c", // 밝은 주황색
    line: "#f472b6", // 밝은 핑크
    connector: "#60a5fa", // 밝은 파란색
    default: "#94a3b8", // 기본 회색
  };

  // 최소 표시 크기 (눈에 잘 보이도록)
  const MIN_DISPLAY_SIZE = 4;

  // 객체 렌더링
  const renderObject = useCallback(
    (obj: CanvasObject) => {
      const x = toMinimapX(obj.x);
      const y = toMinimapY(obj.y);

      if (obj.type === "connector") {
        const endX = toMinimapX(obj.endX ?? obj.x + 100);
        const endY = toMinimapY(obj.endY ?? obj.y);
        return (
          <Line
            key={obj.id}
            points={[x, y, endX, endY]}
            stroke={MINIMAP_COLORS.connector}
            strokeWidth={2}
            listening={false}
          />
        );
      }

      if (obj.type === "line") {
        const points = toPointArray(obj.points).map((p, i) =>
          i % 2 === 0
            ? toMinimapX(obj.x + p) - x + x
            : toMinimapY(obj.y + p) - y + y,
        );
        return (
          <Line
            key={obj.id}
            points={points.length > 0 ? points : [x, y, x, y]}
            stroke={MINIMAP_COLORS.line}
            strokeWidth={2}
            listening={false}
          />
        );
      }

      // 원형 객체
      if (
        obj.type === "shape" &&
        (obj.shapeVariant === "circle" || obj.shapeVariant === "ellipse")
      ) {
        const w = Math.max(MIN_DISPLAY_SIZE, (obj.width ?? 80) * scale);
        const h = Math.max(MIN_DISPLAY_SIZE, (obj.height ?? 80) * scale);
        return (
          <Circle
            key={obj.id}
            x={x + w / 2}
            y={y + h / 2}
            radius={Math.max(MIN_DISPLAY_SIZE / 2, Math.min(w, h) / 2)}
            fill={MINIMAP_COLORS.shape}
            stroke="#0891b2"
            strokeWidth={1}
            listening={false}
          />
        );
      }

      // 사각형 객체 (rectangle, stickyNote, textBox, image, shape)
      const width = Math.max(MIN_DISPLAY_SIZE, (obj.width ?? 100) * scale);
      const height = Math.max(MIN_DISPLAY_SIZE, (obj.height ?? 80) * scale);

      // 타입별 형광색 적용
      let fill = MINIMAP_COLORS.default;
      let stroke = "#64748b";
      if (obj.type === "stickyNote") {
        fill = MINIMAP_COLORS.stickyNote;
        stroke = "#ca8a04";
      } else if (obj.type === "textBox") {
        fill = MINIMAP_COLORS.textBox;
        stroke = "#16a34a";
      } else if (obj.type === "image") {
        fill = MINIMAP_COLORS.image;
        stroke = "#ea580c";
      } else if (isShape(obj)) {
        // Unified: rectangle is now shape + shapeVariant: "rectangle"
        fill = MINIMAP_COLORS.shape;
        stroke = "#0891b2";
      }

      return (
        <Rect
          key={obj.id}
          x={x}
          y={y}
          width={width}
          height={height}
          fill={fill}
          stroke={stroke}
          strokeWidth={1}
          cornerRadius={1}
          listening={false}
        />
      );
    },
    [toMinimapX, toMinimapY, scale],
  );

  // Hide UI mode - hide minimap (hooks 이후에 처리)
  if (hideUI) {
    return null;
  }

  return (
    <div className="fixed right-4 bottom-6 z-40 flex flex-col items-end">
      {/* 탭 라벨 + 줌 컨트롤 */}
      <div className="flex h-8 w-full items-center justify-between rounded-t border border-b-0 border-gray-200 bg-white px-2 dark:border-[#c0c1c4] dark:bg-[#d6d7da]">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-600">
          Minimap
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="rounded p-1 transition-colors hover:bg-gray-100 dark:hover:bg-[#c8c9cc]"
            title="Zoom Out"
          >
            <Minus className="h-4 w-4 text-gray-600 dark:text-gray-700" />
          </button>
          <button
            onClick={handleZoomIn}
            className="rounded p-1 transition-colors hover:bg-gray-100 dark:hover:bg-[#c8c9cc]"
            title="Zoom In"
          >
            <Plus className="h-4 w-4 text-gray-600 dark:text-gray-700" />
          </button>
          {viewport.zoom !== DEFAULT_ZOOM && (
            <button
              onClick={handleResetZoom}
              className="rounded p-1 transition-colors hover:bg-gray-100 dark:hover:bg-[#c8c9cc]"
              title="Reset View (100%)"
            >
              <RotateCcw className="h-4 w-4 text-gray-600 dark:text-gray-700" />
            </button>
          )}
        </div>
      </div>
      {/* 미니맵 본체 */}
      <div
        className="cursor-pointer overflow-hidden rounded-b border border-gray-200 bg-white shadow-lg dark:border-[#c0c1c4] dark:bg-[#d6d7da]"
        style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
      >
        <Stage
          ref={stageRef}
          width={MINIMAP_WIDTH}
          height={MINIMAP_HEIGHT}
          onClick={handleClick}
        >
          {/* 배경 */}
          <Layer>
            <Rect
              width={MINIMAP_WIDTH}
              height={MINIMAP_HEIGHT}
              fill="#f0f0f0"
            />
            {/* 캔버스 영역 (실제 화면 비율에 맞춤) */}
            <Rect
              x={canvasArea.x}
              y={canvasArea.y}
              width={canvasArea.width}
              height={canvasArea.height}
              fill="#fafafa"
              stroke="#e5e5e5"
              strokeWidth={0.5}
            />
          </Layer>

          {/* 객체들 */}
          <Layer>{objects.map(renderObject)}</Layer>

          {/* 뷰포트 인디케이터 (드래그 불가 - 클릭으로만 이동) */}
          <Layer>
            <Rect
              x={viewportRect.x}
              y={viewportRect.y}
              width={viewportRect.width}
              height={viewportRect.height}
              stroke="#3b82f6"
              strokeWidth={1.5}
              fill="rgba(59, 130, 246, 0.08)"
              listening={false}
            />
          </Layer>
        </Stage>
      </div>
    </div>
  );
});
