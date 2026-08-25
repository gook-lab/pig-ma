import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import {
  Stage,
  Layer,
  Transformer,
  Shape,
  Rect,
  Line as KonvaLine,
  Group,
  Circle as KonvaCircle,
  Arrow,
  Ellipse as KonvaEllipse,
  Wedge,
  Text as KonvaText,
} from "react-konva";
import type Konva from "konva";
import { MousePointer2, Hand, Pencil, MoveRight } from "lucide-react";

// 단순한 + 형태 크로스헤어 커서 (FigJam 스타일)
const SimpleCrosshair = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 14 14"
    fill="none"
    className="text-gray-700 dark:text-gray-200"
    style={{ transform: "translate(-50%, -50%)" }}
  >
    {/* 수직선 */}
    <line
      x1="7"
      y1="0"
      x2="7"
      y2="14"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    {/* 수평선 */}
    <line
      x1="0"
      y1="7"
      x2="14"
      y2="7"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);
import { nanoid } from "nanoid";
import { useCanvasStore } from "@/store";
import { ShapeRenderer } from "./ShapeRenderer";
import { ConnectorLabel } from "./shapes/ConnectorLabel";
import { getShapePath } from "./shapes/Shape";
import {
  createRectangle,
  createLine,
  createStickyNote,
  createArrow,
  createTextBox,
  createShape,
  createTable,
  createChart,
  createCodeBlock,
  createEmbed,
  snapToGrid,
  getDefaultShapeSize,
  cloneShape,
} from "@/utils/factory";
import {
  getObjectBounds,
  rectsIntersect,
  normalizeRect,
  findSnapTarget,
  getShapeEdgeAnchors,
  getOffsetForDirection,
  getAnchorPoint,
  getOppositeAnchor,
  findNearestShapeInDirection,
  calculateAlignmentGuides,
  connectorIntersectsRect,
  type AnchorPosition,
  type Point,
  getOffsetRatioSafe,
  toPointArray,
} from "@/utils/geometry";
import {
  zoomIn as zoomInLevel,
  zoomOut as zoomOutLevel,
  MIN_ZOOM,
} from "@/constants/zoom";
import type { AlignmentGuide, CanvasObject } from "@/types";
import { ConnectionHandles } from "./ConnectionHandles";
import { ShapeErrorBoundary } from "./ShapeErrorBoundary";
import { CaptionMarker } from "./captions/CaptionMarker";
import { TextViewerOverlay } from "./tiptap/TextViewerOverlay";
import { hasMixedStyles } from "@/utils/tiptapMigration";
import { CodeBlockViewerOverlay } from "./CodeBlockViewerOverlay";
import { EmbedViewerOverlay } from "./EmbedViewerOverlay";
import { EmbedUrlModal } from "./EmbedUrlModal";
import { parseEmbedUrl } from "@/utils/embed";
import { ContextMenu } from "./ContextMenu";
import { GroupBoundary } from "./GroupBoundary";
import { TextEditorOverlay } from "./tiptap/TextEditorOverlay";
import { TableCellEditor } from "./tiptap/TableCellEditor";
import { TableAddButtons } from "./TableAddButtons";
import { getCanvasOverlayZIndex, Z_SELECTION_UI } from "@/constants/zIndex";
import { dragCoordinator, resizeCoordinator } from "@/hooks/useDragCoordinator";
import { setLastMousePosition } from "@/utils/mousePosition";
import { useVisibleObjects } from "@/hooks/useVisibleObjects";
import { calculateElbowPath, getClosestPointOnPath } from "@/utils/elbowPath";
import {
  getConnectorEndpoints,
  getConnectorPathPoints,
  toElbowSize,
} from "@/utils/connectorPath";
import { isShape } from "@/utils/typeGuards";
import { useFontsReady } from "@/hooks/useFontsReady";

interface MarqueeState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface DrawingState {
  points: number[];
  startX: number;
  startY: number;
}

interface ArrowDrawingState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  sourceId?: string;
  sourceAnchor?: AnchorPosition;
  sourceOffsetX?: number;
  sourceOffsetY?: number;
  sourceOffsetRatioX?: number;
  sourceOffsetRatioY?: number;
  targetId?: string;
  targetAnchor?: AnchorPosition;
  targetOffsetX?: number;
  targetOffsetY?: number;
  targetOffsetRatioX?: number;
  targetOffsetRatioY?: number;
}

// Connector 툴 활성화 시 Shape 위에 호버할 때 표시할 연결 포인트 상태
interface HoveredShapeForConnector {
  shapeId: string;
  anchors: { anchor: AnchorPosition; point: Point }[];
}

export function Canvas() {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const connectorLayerRef = useRef<Konva.Layer>(null);
  const selectionLayerRef = useRef<Konva.Layer>(null);
  const [stageSize, setStageSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [drawing, setDrawing] = useState<DrawingState | null>(null);
  const [arrowDrawing, setArrowDrawing] = useState<ArrowDrawingState | null>(
    null,
  );
  const [hoverPosition, setHoverPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{
    x: number;
    y: number;
    viewportX: number;
    viewportY: number;
  } | null>(null);
  // Connector 툴 활성화 시 호버된 Shape의 연결 포인트
  const [hoveredShapeForConnector, setHoveredShapeForConnector] =
    useState<HoveredShapeForConnector | null>(null);

  // 드래그 정렬 가이드 라인
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);

  // Embed URL modal state
  const [embedModalPosition, setEmbedModalPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Refs to avoid closure issues
  const marqueeRef = useRef<MarqueeState | null>(null);
  const drawingRef = useRef<DrawingState | null>(null);
  const arrowDrawingRef = useRef<ArrowDrawingState | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{
    x: number;
    y: number;
    viewportX: number;
    viewportY: number;
  } | null>(null);
  // 패닝 RAF 스로틀링
  const panRAFRef = useRef<number | null>(null);
  const pendingViewportRef = useRef<{
    x: number;
    y: number;
    zoom: number;
  } | null>(null);
  // handleMouseUp 중복 호출 방지 플래그
  const isMouseUpHandledRef = useRef(false);
  // 마키 드래그 발생 여부 (click 이벤트에서 선택 해제 방지용)
  const wasMarqueeDragRef = useRef(false);

  // Sync refs with state
  marqueeRef.current = marquee;
  drawingRef.current = drawing;
  arrowDrawingRef.current = arrowDrawing;
  isPanningRef.current = isPanning;
  panStartRef.current = panStart;

  // Reactive state: values needed for rendering/JSX
  const {
    objects,
    selectedIds,
    tool,
    viewport,
    penSettings,
    shapeSettings,
    editingTextId,
    selectedShapeVariant,
    selectedChartVariant,
    isLocked,
    eraserSize,
    connectorPathStyle,
    stickyNoteColor,
    captions,
    hideCaptions,
    groups,
    draggingIds,
    gridType,
    gridColor,
    editingTableCell,
  } = useCanvasStore();

  // O(1) lookup caches
  const selectedIdsSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const draggingIdsSet = useMemo(() => new Set(draggingIds), [draggingIds]);
  const groupsMap = useMemo(
    () => new Map(groups.map((g) => [g.id, g])),
    [groups],
  );
  // Set stageRef in store for export functionality
  useEffect(() => {
    useCanvasStore.getState().setStageRef(stageRef);
  }, []);

  // 웹폰트가 늦게 붙으면 텍스트 폭이 폴백 기준으로 굳는다 — 붙은 뒤 재측정
  useFontsReady(stageRef);

  // Listen for alignment guide updates from ShapeRenderer
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && "guides" in detail) {
        setAlignmentGuides(detail.guides);
      }
    };
    window.addEventListener("alignment-guides-update", handler);
    return () => window.removeEventListener("alignment-guides-update", handler);
  }, []);

  // Eraser state
  const [isErasing, setIsErasing] = useState(false);
  const [eraserPosition, setEraserPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Custom cursor ref (직접 DOM 업데이트로 성능 최적화)
  const cursorRef = useRef<HTMLDivElement>(null);
  const stageWrapperRef = useRef<HTMLDivElement>(null);
  const [isCursorVisible, setIsCursorVisible] = useState(false);
  const isCursorVisibleRef = useRef(false);
  isCursorVisibleRef.current = isCursorVisible;

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    canvasX: number;
    canvasY: number;
    clickedObjectId: string | null;
  } | null>(null);

  // Get eraser radius based on size
  const getEraserRadius = useCallback(() => {
    switch (eraserSize) {
      case "small":
        return 10;
      case "large":
        return 50;
      default:
        return 25;
    }
  }, [eraserSize]);

  // Check if a point is within eraser radius of a line and erase that portion
  const eraseAtPosition = useCallback(
    (x: number, y: number) => {
      const radius = getEraserRadius();
      const linesToDelete: string[] = [];
      const linesToAdd: {
        x: number;
        y: number;
        points: number[];
        original: (typeof objects)[0];
      }[] = [];

      objects.forEach((obj) => {
        if (obj.type !== "line" || !obj.points) return;

        // Find indices of points within eraser radius
        const erasedIndices = new Set<number>();
        for (let i = 0; i < obj.points.length; i += 2) {
          const px = obj.x + obj.points[i]!;
          const py = obj.y + obj.points[i + 1]!;
          const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
          if (dist < radius) {
            erasedIndices.add(i);
          }
        }

        if (erasedIndices.size === 0) return;

        // Mark original for deletion
        linesToDelete.push(obj.id);

        // Split into continuous segments (points not erased)
        const segments: number[][] = [];
        let currentSegment: number[] = [];

        for (let i = 0; i < obj.points.length; i += 2) {
          if (!erasedIndices.has(i)) {
            currentSegment.push(obj.points[i]!, obj.points[i + 1]!);
          } else {
            // When we hit an erased point, save current segment if valid
            if (currentSegment.length >= 4) {
              // At least 2 points (4 coordinates)
              segments.push(currentSegment);
            }
            currentSegment = [];
          }
        }
        // Don't forget the last segment
        if (currentSegment.length >= 4) {
          segments.push(currentSegment);
        }

        // Create new lines from remaining segments
        segments.forEach((segmentPoints) => {
          // Normalize points relative to segment's own origin
          const minX = Math.min(...segmentPoints.filter((_, i) => i % 2 === 0));
          const minY = Math.min(...segmentPoints.filter((_, i) => i % 2 === 1));
          const normalizedPoints = segmentPoints.map((val, i) =>
            i % 2 === 0 ? val - minX : val - minY,
          );

          linesToAdd.push({
            x: obj.x + minX,
            y: obj.y + minY,
            points: normalizedPoints,
            original: obj,
          });
        });
      });

      // Create new lines from linesToAdd - 직접 객체 생성 (createLine은 strokeWidth를 다시 조정하므로)
      const newLines = linesToAdd.map(({ x, y, points, original }) => ({
        id: nanoid(),
        type: "line" as const,
        x,
        y,
        points,
        penType: original.penType,
        stroke: original.stroke,
        strokeWidth: original.strokeWidth,
        rotation: original.rotation ?? 0,
        opacity: original.opacity,
      }));

      // Atomic operation: delete and add in single state update (for proper undo)
      if (linesToDelete.length > 0) {
        useCanvasStore.getState().eraseLinePartial(linesToDelete, newLines);
      }
    },
    [objects, getEraserRadius],
  );

  // Double-click to erase entire line
  const eraseEntireLine = useCallback(
    (x: number, y: number) => {
      const radius = getEraserRadius();
      const lineIds: string[] = [];

      objects.forEach((obj) => {
        if (obj.type !== "line" || !obj.points) return;

        // Check if any point of the line is within the eraser radius
        for (let i = 0; i < obj.points.length; i += 2) {
          const px = obj.x + obj.points[i]!;
          const py = obj.y + obj.points[i + 1]!;
          const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
          if (dist < radius) {
            lineIds.push(obj.id);
            break;
          }
        }
      });

      if (lineIds.length > 0) {
        useCanvasStore.getState().deleteObjects(lineIds);
      }
    },
    [objects, getEraserRadius],
  );

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setStageSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (panRAFRef.current) {
        cancelAnimationFrame(panRAFRef.current);
      }
    };
  }, []);

  // Prevent browser back/forward gesture on horizontal wheel scroll
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const container = stage.container();
    const preventBrowserGesture = (e: WheelEvent) => {
      // 좌우 스크롤(trackpad 스와이프) 시 브라우저 뒤로가기/앞으로가기 방지
      if (Math.abs(e.deltaX) > 0) {
        e.preventDefault();
      }
    };

    // passive: false로 등록해야 preventDefault가 작동함
    container.addEventListener("wheel", preventBrowserGesture, {
      passive: false,
    });
    return () => container.removeEventListener("wheel", preventBrowserGesture);
  }, []);

  // Set connector layer ref for dragCoordinator batch draw
  useEffect(() => {
    dragCoordinator.setLayer(connectorLayerRef.current);
    return () => {
      dragCoordinator.setLayer(null);
    };
  }, []);

  // 선택 UI 레이어 승격: Transformer 핸들이 HTML 뷰어 오버레이(CodeBlock/
  // Embed, z≤39)에도 가려지지 않도록 이 레이어의 캔버스만 CSS 로 띄운다.
  // paint 전용 승격 — pointer-events 를 꺼서 이벤트 흐름(오버레이 →
  // Stage 컨테이너 → Konva 히트테스트)은 기존과 동일하게 유지한다.
  useEffect(() => {
    const canvas = selectionLayerRef.current?.getCanvas()._canvas;
    if (!canvas) return;
    canvas.style.zIndex = String(Z_SELECTION_UI);
    canvas.style.pointerEvents = "none";
  }, []);

  // Reset isErasing when tool changes or when mouseup outside canvas
  useEffect(() => {
    if (tool !== "eraser") {
      setIsErasing(false);
    }
  }, [tool]);

  // 커스텀 커서 위치 업데이트 (window 레벨 - 드래그 중에도 동작)
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (cursorRef.current) {
        cursorRef.current.style.left = `${e.clientX}px`;
        cursorRef.current.style.top = `${e.clientY}px`;
      }
      // 캔버스 영역 내에서만 커스텀 커서 표시
      const isInsideCanvas =
        stageWrapperRef.current &&
        stageWrapperRef.current.contains(e.target as Node);
      if (isInsideCanvas && !isCursorVisibleRef.current) {
        setIsCursorVisible(true);
      } else if (!isInsideCanvas && isCursorVisibleRef.current) {
        setIsCursorVisible(false);
      }
    };
    window.addEventListener("mousemove", handleGlobalMouseMove);
    return () => window.removeEventListener("mousemove", handleGlobalMouseMove);
  }, []);

  useEffect(() => {
    const handleWindowMouseUp = () => {
      if (isErasing) {
        setIsErasing(false);
      }
    };
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => window.removeEventListener("mouseup", handleWindowMouseUp);
  }, [isErasing]);

  // 객체 bounds 캐시 (패닝 시 매 프레임 objects.forEach 방지)
  const objectBoundsRef = useRef({
    minX: 0,
    maxX: 0,
    minY: 0,
    maxY: 0,
    objectsLen: 0,
  });

  // objects 변경 시에만 bounds 재계산
  useMemo(() => {
    let minX = 0,
      maxX = 0,
      minY = 0,
      maxY = 0;
    for (const obj of objects) {
      const w = obj.width ?? 100;
      const h = obj.height ?? 100;
      if (obj.x - 200 < minX) minX = obj.x - 200;
      if (obj.y - 200 < minY) minY = obj.y - 200;
      if (obj.x + w + 200 > maxX) maxX = obj.x + w + 200;
      if (obj.y + h + 200 > maxY) maxY = obj.y + h + 200;
    }
    objectBoundsRef.current = {
      minX,
      maxX,
      minY,
      maxY,
      objectsLen: objects.length,
    };
  }, [objects]);

  // Zoom with wheel (Cmd + scroll only, like FigJam)
  // getState() 기반 — viewport/objects 변경 시 콜백 재생성 방지
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;

      const { viewport } = useCanvasStore.getState();

      // Cmd (Mac) 또는 Ctrl (Windows)를 누른 상태에서만 줌
      if (!e.evt.metaKey && !e.evt.ctrlKey) {
        // Cmd 없이 스크롤하면 패닝 (10% 줌 기준 bounds 제한)
        e.evt.preventDefault();
        e.evt.stopPropagation();
        const basePanSpeed = 1.2;
        // sqrt로 줌에 따른 속도 차이를 부드럽게 조절
        const adjustedSpeed =
          basePanSpeed * Math.max(0.5, Math.sqrt(viewport.zoom));
        const newX = viewport.x - e.evt.deltaX * adjustedSpeed;
        const newY = viewport.y - e.evt.deltaY * adjustedSpeed;

        // 10% 줌 기준 기본 bounds + 캐시된 객체 bounds
        const maxViewportWidth = stage.width() / MIN_ZOOM!;
        const maxViewportHeight = stage.height() / MIN_ZOOM!;
        const cached = objectBoundsRef.current;
        const boundsMinX = Math.min(-maxViewportWidth / 2, cached.minX);
        const boundsMaxX = Math.max(maxViewportWidth / 2, cached.maxX);
        const boundsMinY = Math.min(-maxViewportHeight / 2, cached.minY);
        const boundsMaxY = Math.max(maxViewportHeight / 2, cached.maxY);

        // 현재 줌에서의 뷰포트 크기
        const viewportWidth = stage.width() / viewport.zoom;
        const viewportHeight = stage.height() / viewport.zoom;

        // 뷰포트 좌상단 캔버스 좌표
        const viewportLeft = -newX / viewport.zoom;
        const viewportTop = -newY / viewport.zoom;

        // bounds 내로 클램프 (가로/세로 각각)
        const clampedLeft = Math.max(
          boundsMinX,
          Math.min(boundsMaxX - viewportWidth, viewportLeft),
        );
        const clampedTop = Math.max(
          boundsMinY,
          Math.min(boundsMaxY - viewportHeight, viewportTop),
        );

        useCanvasStore.getState().setViewport({
          x: -clampedLeft * viewport.zoom,
          y: -clampedTop * viewport.zoom,
          zoom: viewport.zoom,
        });
        return;
      }

      e.evt.preventDefault();

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const oldScale = viewport.zoom;
      const mousePointTo = {
        x: (pointer.x - viewport.x) / oldScale,
        y: (pointer.y - viewport.y) / oldScale,
      };

      // 20단계 줌 레벨 (10% ~ 3200%)
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const newZoom =
        direction > 0 ? zoomInLevel(oldScale) : zoomOutLevel(oldScale);

      useCanvasStore.getState().setViewport({
        x: pointer.x - mousePointTo.x * newZoom,
        y: pointer.y - mousePointTo.y * newZoom,
        zoom: newZoom,
      });
    },
    [], // 의존성 없음 — getState() + ref로 항상 최신 값 접근
  );

  // Click on stage
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;

      const {
        tool,
        viewport,
        currentUser,
        shapeSettings,
        stickyNoteColor,
        selectedShapeVariant,
        selectedChartVariant,
        defaultFontFamily,
      } = useCanvasStore.getState();
      const {
        clearSelection,
        setSelectedIds,
        addObject,
        setTool,
        setSelectedTableCells,
      } = useCanvasStore.getState();

      // Don't handle click if we're in pencil or eraser mode (handled by mouse events)
      if (tool === "pencil" || tool === "eraser") return;

      // 우클릭(button === 2)은 컨텍스트 메뉴에서 처리, 선택 해제하지 않음
      if (e.evt.button === 2) return;

      // 마키 드래그 후 click 이벤트에서는 선택 해제하지 않음
      if (wasMarqueeDragRef.current) {
        wasMarqueeDragRef.current = false;
        return;
      }

      // 도형 생성 도구: 어디를 클릭해도 새 요소 생성 (그룹 영역 포함)
      const isCreationTool =
        tool === "rectangle" ||
        tool === "stickyNote" ||
        tool === "textBox" ||
        tool === "shape" ||
        tool === "table" ||
        tool === "chart" ||
        tool === "codeBlock";

      // Click on stage background (deselect) or creation tool click anywhere
      if (e.target === stage || isCreationTool) {
        clearSelection();
        setSelectedTableCells(null);

        // Create shape if tool is selected (keep tool active for continuous creation)
        if (isCreationTool) {
          const pointer = stage.getPointerPosition();
          if (pointer) {
            const x = (pointer.x - viewport.x) / viewport.zoom;
            const y = (pointer.y - viewport.y) / viewport.zoom;

            // Author info for new objects
            const author = {
              authorId: currentUser.id,
              authorName: currentUser.name,
            };

            if (tool === "rectangle") {
              const newRect = createRectangle(x, y, shapeSettings, author);
              addObject(newRect);
              setSelectedIds([newRect.id]);
              setTool("select");
            } else if (tool === "stickyNote") {
              const newNote = createStickyNote(
                x,
                y,
                stickyNoteColor,
                author,
                defaultFontFamily,
              );
              addObject(newNote);
              setSelectedIds([newNote.id]);
              setTool("select");
            } else if (tool === "textBox") {
              const newTextBox = createTextBox(x, y, author, defaultFontFamily);
              addObject(newTextBox);
              setSelectedIds([newTextBox.id]);
              setTool("select");
            } else if (tool === "shape") {
              const newShape = createShape(
                x,
                y,
                selectedShapeVariant,
                shapeSettings,
                author,
                defaultFontFamily,
              );
              addObject(newShape);
              setSelectedIds([newShape.id]);
              setTool("select");
            } else if (tool === "table") {
              const newTable = createTable(x, y);
              addObject(newTable);
              setSelectedIds([newTable.id]);
              setTool("select");
            } else if (tool === "chart") {
              const newChart = createChart(x, y, selectedChartVariant);
              addObject(newChart);
              setSelectedIds([newChart.id]);
              setTool("select");
            } else if (tool === "codeBlock") {
              const newCodeBlock = createCodeBlock(
                x,
                y,
                "",
                "javascript",
                author,
              );
              addObject(newCodeBlock);
              setSelectedIds([newCodeBlock.id]);
              setTool("select");
            }
            // Switch to select tool after creating shape
          }
        }
      }

      // Embed tool: show URL modal on click
      if (tool === "embed") {
        clearSelection();
        const pointer = stage.getPointerPosition();
        if (pointer) {
          const x = (pointer.x - viewport.x) / viewport.zoom;
          const y = (pointer.y - viewport.y) / viewport.zoom;
          setEmbedModalPosition({ x, y });
        }
      }
    },
    [],
  );

  // Mouse down for marquee, pencil, and arrow
  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;

      // 새로운 마우스 다운 - 중복 호출 방지 플래그 리셋
      isMouseUpHandledRef.current = false;

      const {
        tool,
        isLocked,
        viewport,
        objects,
        selectedIds,
        shapeSettings,
        connectorPathStyle,
        connectorElbowCornerStyle,
        connectorDefaultEndMarker,
      } = useCanvasStore.getState();
      const {
        setEditingTextId,
        setFileDialogOpen,
        addObject,
        setSelectedIds,
        setTool,
      } = useCanvasStore.getState();

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const x = (pointer.x - viewport.x) / viewport.zoom;
      const y = (pointer.y - viewport.y) / viewport.zoom;

      // Hand tool - panning only (always allowed, even when locked)
      if (tool === "hand" || isLocked) {
        setIsPanning(true);
        setPanStart({
          x: pointer.x,
          y: pointer.y,
          viewportX: viewport.x,
          viewportY: viewport.y,
        });
        return;
      }

      // All other tools are disabled when locked
      // Select tool on stage background - start marquee selection
      if (tool === "select" && e.target === stage) {
        // 캔버스 배경 클릭 시 텍스트 편집 모드 해제 및 파일 다이얼로그 플래그 초기화
        setFileDialogOpen(false);
        setEditingTextId(null);
        setMarquee({ startX: x, startY: y, currentX: x, currentY: y });
      }
      // Pencil works anywhere (on top of objects)
      else if (tool === "pencil") {
        e.evt.preventDefault();
        setDrawing({ points: [0, 0], startX: x, startY: y });
      }
      // Eraser - start erasing lines
      else if (tool === "eraser") {
        e.evt.preventDefault();
        setIsErasing(true);
        setEraserPosition({ x, y });
        // Immediately check for lines to erase
        eraseAtPosition(x, y);
      }
      // Arrow/connector drawing - click-click mode (not drag)
      else if (tool === "connector") {
        // Connector가 이미 선택되어 있으면 새 화살표 생성하지 않음 (endpoint 드래그 모드)
        const hasSelectedConnector = selectedIds.some((id) => {
          const obj = objects.find((o) => o.id === id);
          return obj?.type === "connector";
        });
        if (hasSelectedConnector && e.target !== stage) {
          // 선택된 connector의 endpoint를 클릭한 것으로 간주 - 드래그 처리는 Connector 컴포넌트에서
          return;
        }

        e.evt.preventDefault();

        // 이미 첫 번째 점을 찍은 상태면 두 번째 클릭 (커넥터 완성)
        if (arrowDrawing) {
          const snappedX = snapToGrid(x);
          const snappedY = snapToGrid(y);

          // 연결 포인트에 스냅 시도
          let endX = snappedX;
          let endY = snappedY;
          let targetId: string | undefined;
          let targetAnchor: AnchorPosition | undefined;
          let targetOffsetX: number | undefined;
          let targetOffsetY: number | undefined;

          if (hoveredShapeForConnector) {
            const clickedAnchor = hoveredShapeForConnector.anchors.find(
              ({ point }) => {
                const dist = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
                return dist < 15;
              },
            );
            if (clickedAnchor) {
              endX = clickedAnchor.point.x;
              endY = clickedAnchor.point.y;
              targetId = hoveredShapeForConnector.shapeId;
              targetAnchor = clickedAnchor.anchor;
              // __group: 가상 ID인 경우 그룹 bounds에서 offset 계산
              const targetGroupMatch =
                hoveredShapeForConnector.shapeId.match(/^__group:(.+)$/);
              if (targetGroupMatch) {
                const group = useCanvasStore
                  .getState()
                  .groups.find((g) => g.id === targetGroupMatch[1]);
                if (group?.customBounds) {
                  targetOffsetX = endX - group.customBounds.x;
                  targetOffsetY = endY - group.customBounds.y;
                }
              } else {
                const targetShape = objects.find(
                  (obj) => obj.id === hoveredShapeForConnector.shapeId,
                );
                targetOffsetX = targetShape ? endX - targetShape.x : undefined;
                targetOffsetY = targetShape ? endY - targetShape.y : undefined;
              }
            }
          } else {
            // 빈 공간 - 스냅 타겟 확인 (그룹 경계 포함)
            const { objects: fo, groups: fg } = useCanvasStore.getState();
            const snapTarget = findSnapTarget(
              { x: snappedX, y: snappedY },
              fo,
              [],
              fg,
            );
            if (snapTarget) {
              endX = snapTarget.point.x;
              endY = snapTarget.point.y;
              targetId = snapTarget.object.id;
              targetAnchor = snapTarget.anchor;
              targetOffsetX = snapTarget.offsetX;
              targetOffsetY = snapTarget.offsetY;
            }
          }

          // 길이 확인 후 커넥터 생성
          const dx = endX - arrowDrawing.startX;
          const dy = endY - arrowDrawing.startY;
          const length = Math.sqrt(dx * dx + dy * dy);

          if (length > 10) {
            const newArrow = createArrow(
              arrowDrawing.startX,
              arrowDrawing.startY,
              endX,
              endY,
              {
                sourceId: arrowDrawing.sourceId,
                targetId,
                sourceAnchor: arrowDrawing.sourceAnchor,
                targetAnchor,
                sourceOffsetX: arrowDrawing.sourceOffsetX,
                sourceOffsetY: arrowDrawing.sourceOffsetY,
                sourceOffsetRatioX: arrowDrawing.sourceOffsetRatioX,
                sourceOffsetRatioY: arrowDrawing.sourceOffsetRatioY,
                targetOffsetX,
                targetOffsetY,
                targetOffsetRatioX: arrowDrawing.targetOffsetRatioX,
                targetOffsetRatioY: arrowDrawing.targetOffsetRatioY,
                stroke: shapeSettings.strokeColor,
                pathStyle: connectorPathStyle,
                elbowCornerStyle: connectorElbowCornerStyle,
                endMarker: connectorDefaultEndMarker,
              },
            );
            addObject(newArrow);
            setSelectedIds([newArrow.id]);
            setTool("select");
          }
          setArrowDrawing(null);
          setHoveredShapeForConnector(null);
          return;
        }

        // 첫 번째 클릭 - 시작점 설정
        // 연결 포인트 클릭 감지 (Shape 위에 호버 중일 때)
        if (hoveredShapeForConnector && !hasSelectedConnector) {
          const clickedAnchor = hoveredShapeForConnector.anchors.find(
            ({ point }) => {
              const dist = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
              return dist < 15;
            },
          );
          if (clickedAnchor) {
            // __group: 가상 ID인 경우 그룹 bounds에서 offset 계산
            let offsetX: number | undefined;
            let offsetY: number | undefined;
            // 크기 대비 비율 — 리사이즈해도 연결점이 가장자리에 남는다
            let ratioX: number | undefined;
            let ratioY: number | undefined;
            const groupMatch =
              hoveredShapeForConnector.shapeId.match(/^__group:(.+)$/);
            if (groupMatch) {
              const group = useCanvasStore
                .getState()
                .groups.find((g) => g.id === groupMatch[1]);
              if (group?.customBounds) {
                const b = group.customBounds;
                offsetX = clickedAnchor.point.x - b.x;
                offsetY = clickedAnchor.point.y - b.y;
                ratioX = b.width === 0 ? 0 : offsetX / b.width;
                ratioY = b.height === 0 ? 0 : offsetY / b.height;
              }
            } else {
              const sourceShape = objects.find(
                (obj) => obj.id === hoveredShapeForConnector.shapeId,
              );
              if (sourceShape) {
                offsetX = clickedAnchor.point.x - sourceShape.x;
                offsetY = clickedAnchor.point.y - sourceShape.y;
                const r = getOffsetRatioSafe(sourceShape, clickedAnchor.point);
                ratioX = r.ratioX;
                ratioY = r.ratioY;
              }
            }

            setArrowDrawing({
              startX: clickedAnchor.point.x,
              startY: clickedAnchor.point.y,
              endX: clickedAnchor.point.x,
              endY: clickedAnchor.point.y,
              sourceId: hoveredShapeForConnector.shapeId,
              sourceAnchor: clickedAnchor.anchor,
              sourceOffsetX: offsetX,
              sourceOffsetY: offsetY,
              sourceOffsetRatioX: ratioX,
              sourceOffsetRatioY: ratioY,
            });
            setHoveredShapeForConnector(null);
            return;
          }
        }

        // 빈 공간 또는 그룹 경계 클릭 - 그리드 스냅으로 커넥터 시작
        {
          const snappedX = snapToGrid(x);
          const snappedY = snapToGrid(y);

          const snapTarget = findSnapTarget(
            { x: snappedX, y: snappedY },
            objects,
            [],
            useCanvasStore.getState().groups,
          );

          setArrowDrawing({
            startX: snapTarget?.point.x ?? snappedX,
            startY: snapTarget?.point.y ?? snappedY,
            endX: snapTarget?.point.x ?? snappedX,
            endY: snapTarget?.point.y ?? snappedY,
            sourceId: snapTarget?.object.id,
            sourceAnchor: snapTarget?.anchor,
            sourceOffsetX: snapTarget?.offsetX,
            sourceOffsetY: snapTarget?.offsetY,
            ...(() => {
              const r = getOffsetRatioSafe(
                snapTarget?.object,
                snapTarget?.point,
              );
              return {
                sourceOffsetRatioX: r.ratioX,
                sourceOffsetRatioY: r.ratioY,
              };
            })(),
          });
        }
      }
    },
    [hoveredShapeForConnector, arrowDrawing],
  );

  // Mouse move for marquee, pencil, arrow, panning, and shape preview
  const handleMouseMove = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const { tool, viewport, objects, selectedIds } = useCanvasStore.getState();

    // Handle panning (10% 줌 기준 bounds 제한, 화면 비율 유지)
    if (isPanning && panStart) {
      const dx = pointer.x - panStart.x;
      const dy = pointer.y - panStart.y;
      const newX = panStart.viewportX + dx;
      const newY = panStart.viewportY + dy;

      // 10% 줌 기준 고정 bounds (화면 비율 유지, 중심 0,0 기준)
      const maxViewportWidth = stage.width() / MIN_ZOOM!;
      const maxViewportHeight = stage.height() / MIN_ZOOM!;
      const boundsMinX = -maxViewportWidth / 2;
      const boundsMaxX = maxViewportWidth / 2;
      const boundsMinY = -maxViewportHeight / 2;
      const boundsMaxY = maxViewportHeight / 2;

      // 현재 줌에서의 뷰포트 크기
      const viewportWidth = stage.width() / viewport.zoom;
      const viewportHeight = stage.height() / viewport.zoom;

      // 뷰포트 좌상단 캔버스 좌표
      const viewportLeft = -newX / viewport.zoom;
      const viewportTop = -newY / viewport.zoom;

      // bounds 내로 클램프 (가로/세로 각각)
      const clampedLeft = Math.max(
        boundsMinX,
        Math.min(boundsMaxX - viewportWidth, viewportLeft),
      );
      const clampedTop = Math.max(
        boundsMinY,
        Math.min(boundsMaxY - viewportHeight, viewportTop),
      );

      // RAF 스로틀링: 다음 프레임에 뷰포트 업데이트 스케줄
      const newViewport = {
        x: -clampedLeft * viewport.zoom,
        y: -clampedTop * viewport.zoom,
        zoom: viewport.zoom,
      };

      // Stage를 직접 업데이트하여 즉시 반영 (React 상태 우회)
      if (stageRef.current) {
        stageRef.current.position({ x: newViewport.x, y: newViewport.y });
        stageRef.current.batchDraw();
      }

      // RAF로 React 상태 업데이트 스로틀링
      pendingViewportRef.current = newViewport;
      if (!panRAFRef.current) {
        panRAFRef.current = requestAnimationFrame(() => {
          if (pendingViewportRef.current) {
            useCanvasStore.getState().setViewport(pendingViewportRef.current);
            pendingViewportRef.current = null;
          }
          panRAFRef.current = null;
        });
      }
      return;
    }

    const x = (pointer.x - viewport.x) / viewport.zoom;
    const y = (pointer.y - viewport.y) / viewport.zoom;

    if (marquee && tool === "select") {
      setMarquee((prev) =>
        prev ? { ...prev, currentX: x, currentY: y } : null,
      );
    } else if (drawing && tool === "pencil") {
      const relativeX = x - drawing.startX;
      const relativeY = y - drawing.startY;
      setDrawing((prev) =>
        prev
          ? { ...prev, points: [...prev.points, relativeX, relativeY] }
          : null,
      );
    } else if (isErasing && tool === "eraser") {
      setEraserPosition({ x, y });
      eraseAtPosition(x, y);
    } else if (arrowDrawing && tool === "connector") {
      // Snap to 10px grid
      const snappedX = snapToGrid(x);
      const snappedY = snapToGrid(y);

      // Check for snap target at end position (for grouping with shapes)
      const snapTarget = findSnapTarget(
        { x: snappedX, y: snappedY },
        objects,
        arrowDrawing.sourceId ? [arrowDrawing.sourceId] : [],
        useCanvasStore.getState().groups,
      );

      setArrowDrawing((prev) =>
        prev
          ? {
              ...prev,
              endX: snapTarget?.point.x ?? snappedX,
              endY: snapTarget?.point.y ?? snappedY,
              targetId: snapTarget?.object.id,
              targetAnchor: snapTarget?.anchor,
              targetOffsetX: snapTarget?.offsetX,
              targetOffsetY: snapTarget?.offsetY,
              ...(() => {
                const r = getOffsetRatioSafe(
                  snapTarget?.object,
                  snapTarget?.point,
                );
                return {
                  targetOffsetRatioX: r.ratioX,
                  targetOffsetRatioY: r.ratioY,
                };
              })(),
            }
          : null,
      );
    }

    // 마우스 위치 저장 (붙여넣기 등에서 사용)
    setLastMousePosition(x, y);

    // Track hover position for shape preview
    // 툴바/옵션바 영역에서는 미리보기 표시 안 함 (해당 x축 범위에서만)
    const TOOLBAR_HEIGHT = 130; // 툴바 + 옵션바 + 여유
    const TOOLBAR_WIDTH = 700; // 툴바 예상 너비 (옵션바 포함)
    const toolbarLeft = (window.innerWidth - TOOLBAR_WIDTH) / 2;
    const toolbarRight = toolbarLeft + TOOLBAR_WIDTH;

    const isInToolbarArea =
      pointer.y > window.innerHeight - TOOLBAR_HEIGHT &&
      pointer.x > toolbarLeft &&
      pointer.x < toolbarRight;

    if (
      (tool === "rectangle" ||
        tool === "stickyNote" ||
        tool === "textBox" ||
        tool === "shape" ||
        tool === "table" ||
        tool === "chart" ||
        tool === "codeBlock" ||
        tool === "embed") &&
      !isInToolbarArea
    ) {
      setHoverPosition({ x, y });
    } else {
      setHoverPosition(null);
    }

    // Track eraser position for cursor preview
    if (tool === "eraser") {
      setEraserPosition({ x, y });
    } else {
      setEraserPosition(null);
    }

    // Connector 툴 활성화 + 그리기 중 아닐 때 + 선택된 connector가 없을 때만 연결 포인트 표시
    // (connector가 선택되어 있으면 endpoint 드래그 모드이므로 새 연결 포인트 표시 안 함)
    const hasSelectedConnector = selectedIds.some((id) => {
      const obj = objects.find((o) => o.id === id);
      return obj?.type === "connector";
    });
    if (tool === "connector" && !arrowDrawing && !hasSelectedConnector) {
      const { objects: freshObjects, groups: freshGroups } =
        useCanvasStore.getState();
      const snapTarget = findSnapTarget(
        { x, y },
        freshObjects,
        [],
        freshGroups,
      );
      if (snapTarget) {
        const allAnchors = getShapeEdgeAnchors(snapTarget.object);

        // 이미 연결된 anchor 찾기 (해당 shape에 연결된 모든 connector의 anchor)
        const usedAnchors = new Set<string>();
        objects.forEach((obj) => {
          if (obj.type === "connector") {
            // source 측 anchor
            if (obj.sourceId === snapTarget.object.id && obj.sourceAnchor) {
              usedAnchors.add(obj.sourceAnchor);
            }
            // target 측 anchor
            if (obj.targetId === snapTarget.object.id && obj.targetAnchor) {
              usedAnchors.add(obj.targetAnchor);
            }
          }
        });

        // 사용 중이지 않은 anchor만 필터링
        const availableAnchors = allAnchors.filter(
          ({ anchor }) => !usedAnchors.has(anchor),
        );

        if (availableAnchors.length > 0) {
          setHoveredShapeForConnector({
            shapeId: snapTarget.object.id,
            anchors: availableAnchors,
          });
        } else {
          setHoveredShapeForConnector(null);
        }
      } else {
        setHoveredShapeForConnector(null);
      }
    } else {
      setHoveredShapeForConnector(null);
    }
  }, [marquee, drawing, arrowDrawing, isPanning, panStart]);

  // Mouse up for marquee, pencil, arrow, and panning
  const handleMouseUp = useCallback(() => {
    // Stop panning
    if (isPanningRef.current) {
      // RAF 정리 및 최종 상태 적용
      if (panRAFRef.current) {
        cancelAnimationFrame(panRAFRef.current);
        panRAFRef.current = null;
      }
      if (pendingViewportRef.current) {
        useCanvasStore.getState().setViewport(pendingViewportRef.current);
        pendingViewportRef.current = null;
      }
      setIsPanning(false);
      setPanStart(null);
      return;
    }

    // 중복 호출 방지 (Stage/window/leave 이벤트가 동시에 발생할 수 있음)
    if (isMouseUpHandledRef.current) {
      return;
    }

    const currentMarquee = marqueeRef.current;
    const currentDrawing = drawingRef.current;
    const currentArrowDrawing = arrowDrawingRef.current;

    // 처리할 것이 없으면 early return
    if (!currentMarquee && !currentDrawing && !currentArrowDrawing) {
      return;
    }

    // 처리 시작 - 플래그 설정
    isMouseUpHandledRef.current = true;

    const { tool, objects, penSettings } = useCanvasStore.getState();
    const { setSelectedIds, addObject } = useCanvasStore.getState();

    if (currentMarquee && tool === "select") {
      const selectionRect = normalizeRect(
        currentMarquee.startX,
        currentMarquee.startY,
        currentMarquee.currentX,
        currentMarquee.currentY,
      );

      // Only select if the marquee has some size
      if (selectionRect.width > 5 || selectionRect.height > 5) {
        // 마키 드래그가 있었음을 표시 (click 이벤트에서 선택 해제 방지)
        wasMarqueeDragRef.current = true;

        const selectedObjectIds = objects
          .filter((obj) => {
            // For connectors, check actual line segment intersection
            if (obj.type === "connector") {
              return connectorIntersectsRect(obj, selectionRect);
            }
            // For other objects, use bounding box intersection
            const bounds = getObjectBounds(obj);
            return rectsIntersect(bounds, selectionRect);
          })
          .map((obj) => obj.id);

        if (selectedObjectIds.length > 0) {
          setSelectedIds(selectedObjectIds);
        }
      }
      setMarquee(null);
    } else if (currentDrawing && tool === "pencil") {
      if (currentDrawing.points.length >= 4) {
        addObject(
          createLine(
            currentDrawing.startX,
            currentDrawing.startY,
            currentDrawing.points,
            penSettings,
          ),
        );
      }
      setDrawing(null);
    } else if (isErasing && tool === "eraser") {
      setIsErasing(false);
    }
    // connector tool uses click-click mode, not drag - do nothing on mouseUp
  }, []);

  // Window-level mouseup handler for fast drag outside Stage
  useEffect(() => {
    const handleWindowMouseUp = () => {
      // 마퀴 선택, 드로잉, 패닝 중 하나라도 진행 중이면 처리
      // (arrowDrawing은 클릭-클릭 방식이므로 mouseup에서 처리하지 않음)
      if (marqueeRef.current || drawingRef.current || isPanningRef.current) {
        handleMouseUp();
      }
    };

    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => window.removeEventListener("mouseup", handleWindowMouseUp);
  }, [handleMouseUp]);

  // Shape selection
  const handleSelect = useCallback(
    (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      const { tool, isLocked, objects, editingTextId, selectedTableCells } =
        useCanvasStore.getState();
      const {
        setSelectedIds,
        addToSelection,
        setEditingTextId,
        setFileDialogOpen,
        setSelectedTableCells,
      } = useCanvasStore.getState();

      // Don't select when locked
      if (isLocked) return;

      // 우클릭은 handleContextMenu에서 처리 (다중 선택 유지를 위해)
      if ("button" in e.evt && e.evt.button === 2) return;

      // Don't select when using pencil, eraser, connector, or hand tool
      // Hand tool is for panning only - selection is handled by Select tool
      if (
        tool === "pencil" ||
        tool === "eraser" ||
        tool === "connector" ||
        tool === "hand"
      )
        return;

      // Don't select when using creation tools (rectangle, stickyNote, textBox, shape)
      // These tools create new objects instead of selecting existing ones
      if (
        tool === "rectangle" ||
        tool === "stickyNote" ||
        tool === "textBox" ||
        tool === "shape"
      )
        return;

      const obj = objects.find((o) => o.id === id);
      if (!obj) return;

      // 잠긴 그룹에 속한 객체는 선택 불가
      if (obj.groupId) {
        const group = groupsMap.get(obj.groupId);
        if (group?.locked) return;
      }

      // 다른 요소 선택 시 텍스트 편집 모드 해제 및 파일 다이얼로그 플래그 초기화
      if (editingTextId && editingTextId !== id) {
        setFileDialogOpen(false);
        setEditingTextId(null);
      }

      // Clear table cell selection when selecting a different object
      if (selectedTableCells && selectedTableCells.tableId !== id) {
        setSelectedTableCells(null);
      }

      // Check for modifier keys (Shift OR Cmd/Ctrl for multi-select)
      const shiftKey = "shiftKey" in e.evt && e.evt.shiftKey;
      const cmdKey = "metaKey" in e.evt && (e.evt.metaKey || e.evt.ctrlKey);
      const isMultiSelectModifier = shiftKey || cmdKey;

      // 개별 요소 클릭 시 해당 요소만 선택 (그룹 여부와 관계없이)
      // 그룹 경계 클릭은 GroupBoundary의 onSelect에서 그룹 전체 선택 처리
      if (isMultiSelectModifier) {
        addToSelection(id);
      } else {
        setSelectedIds([id]);
      }
    },
    [groupsMap],
  );

  // Context menu handler
  const handleContextMenu = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();

      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const { viewport, selectedIds, objects } = useCanvasStore.getState();

      // 캔버스 좌표 계산
      const canvasX = (pointer.x - viewport.x) / viewport.zoom;
      const canvasY = (pointer.y - viewport.y) / viewport.zoom;

      // 우클릭 위치에 객체가 있는지 확인
      const shape = stage.getIntersection(pointer);
      let targetId: string | null = null;

      if (shape) {
        let target: Konva.Node | null = shape;
        while (target && !target.id()) {
          target = target.parent;
        }
        if (target && target.id()) {
          targetId = target.id();
        }
      }

      // 객체 위에서 우클릭했고 선택되지 않은 경우
      const selectedIdsSetLocal = new Set(selectedIds);
      if (targetId && !selectedIdsSetLocal.has(targetId)) {
        const targetObj = objects.find((obj) => obj.id === targetId);
        if (targetObj && !targetObj.locked) {
          // 다중 선택 상태에서는 선택 유지 (변경하지 않음)
          // 단일 선택 또는 선택 없음 상태에서만 해당 객체로 선택 변경
          if (selectedIds.length <= 1) {
            useCanvasStore.getState().setSelectedIds([targetId]);
          }
        }
      }

      setContextMenu({
        x: e.evt.clientX,
        y: e.evt.clientY,
        canvasX,
        canvasY,
        clickedObjectId: targetId,
      });
    },
    [],
  );

  // HTML context menu handler (for overlay elements like TableAddButtons)
  const handleHtmlContextMenu = useCallback(
    (e: React.MouseEvent, objectId?: string) => {
      e.preventDefault();
      e.stopPropagation();

      const { viewport } = useCanvasStore.getState();

      // 캔버스 좌표 계산
      const canvasX = (e.clientX - viewport.x) / viewport.zoom;
      const canvasY = (e.clientY - viewport.y) / viewport.zoom;

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        canvasX,
        canvasY,
        clickedObjectId: objectId ?? null,
      });
    },
    [],
  );

  // Update transformer nodes
  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;

    // 다중 선택 시 Transformer 숨김 (개별 선택 표시로 대체)
    // 파워포인트 스타일: 여러 요소 선택 시 개별 테두리만 표시, 통합 리사이즈 핸들 없음
    if (selectedIds.length > 1) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    // 그룹 전체가 선택된 경우 Transformer 비활성화 (GroupBoundary에서 처리)
    const selectedObjects = objects.filter((o) => selectedIdsSet.has(o.id));
    const groupIds = [
      ...new Set(selectedObjects.map((o) => o.groupId).filter(Boolean)),
    ];

    // 모든 선택된 객체가 같은 그룹에 속하고, 그 그룹의 모든 객체가 선택된 경우
    if (groupIds.length === 1) {
      const groupId = groupIds[0];
      const groupObjectIds = objects
        .filter((o) => o.groupId === groupId)
        .map((o) => o.id);
      const allGroupObjectsSelected = groupObjectIds.every((id) =>
        selectedIdsSet.has(id),
      );

      if (allGroupObjectsSelected) {
        // 그룹 전체 선택 - Transformer 숨김 (GroupBoundary의 리사이즈 핸들 사용)
        transformer.nodes([]);
        transformer.getLayer()?.batchDraw();
        return;
      }
    }

    // Exclude connectors and connectorLabels from Transformer (they have their own drag handles)
    // Lines (pencil drawings) can use Transformer for resizing
    const transformableIds = selectedIds.filter((id) => {
      const obj = objects.find((o) => o.id === id);
      return obj && obj.type !== "connector" && obj.type !== "connectorLabel";
    });

    const nodes = transformableIds
      .map((id) => stage.findOne(`#${id}`))
      .filter((node): node is Konva.Node => node != null);

    // Reset scale to 1 when connecting nodes to Transformer
    // This prevents size changes when re-selecting after editing
    nodes.forEach((node) => {
      node.scaleX(1);
      node.scaleY(1);
    });

    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedIds, selectedIdsSet, objects]);

  // Transform (real-time during drag) - for textBox, stickyNote, and shape
  // Font size is NOT changed during resize - user's intentional font size is preserved
  const handleTransform = useCallback(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    // Get current objects from store directly (avoid stale closure)
    const currentObjects = useCanvasStore.getState().objects;

    transformer.nodes().forEach((node) => {
      const obj = currentObjects.find((o) => o.id === node.id());
      if (
        !obj ||
        (obj.type !== "textBox" &&
          obj.type !== "stickyNote" &&
          obj.type !== "shape" &&
          obj.type !== "table" &&
          obj.type !== "codeBlock" &&
          obj.type !== "embed")
      )
        return;

      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      // Reset scale immediately and apply to actual properties
      node.scaleX(1);
      node.scaleY(1);

      // Publish resize for HTML overlay sync (embed, codeBlock, etc.)
      if (obj.type === "embed" || obj.type === "codeBlock") {
        const newWidth = Math.max(200, (obj.width ?? 480) * scaleX);
        const newHeight = Math.max(150, (obj.height ?? 270) * scaleY);
        resizeCoordinator.setSize(node.id(), newWidth, newHeight);
      }

      // Handle table resizing with proportional column/row scaling
      if (obj.type === "table" && obj.tableData) {
        const newWidth = Math.max(60, (obj.width ?? 240) * scaleX);
        const newHeight = Math.max(40, (obj.height ?? 80) * scaleY);

        // Scale column widths proportionally
        const totalColWidth = obj.tableData.colWidths.reduce(
          (a, b) => a + b,
          0,
        );
        const newColWidths = obj.tableData.colWidths.map((w) =>
          Math.max(30, (w / totalColWidth) * newWidth),
        );

        // Scale row heights proportionally
        const totalRowHeight = obj.tableData.rowHeights.reduce(
          (a, b) => a + b,
          0,
        );
        const newRowHeights = obj.tableData.rowHeights.map((h) =>
          Math.max(20, (h / totalRowHeight) * newHeight),
        );

        useCanvasStore.getState().updateObject(node.id(), {
          x: node.x(),
          y: node.y(),
          width: newWidth,
          height: newHeight,
          tableData: {
            ...obj.tableData,
            colWidths: newColWidths,
            rowHeights: newRowHeights,
          },
        });
        return;
      }

      useCanvasStore.getState().updateObject(node.id(), {
        x: node.x(),
        y: node.y(),
        width: Math.max(20, (obj.width ?? (isShape(obj) ? 100 : 200)) * scaleX),
        height: Math.max(
          20,
          (obj.height ?? (isShape(obj) ? 100 : 200)) * scaleY,
        ),
      });
    });
  }, []);

  // Transform end
  const handleTransformEnd = useCallback(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    // Get current objects from store directly (avoid stale closure)
    const currentObjects = useCanvasStore.getState().objects;

    transformer.nodes().forEach((node) => {
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);

      const obj = currentObjects.find((o) => o.id === node.id());
      if (!obj) return;

      // textBox, stickyNote, shape, table, codeBlock, and embed are handled in real-time by handleTransform
      if (
        obj.type === "textBox" ||
        obj.type === "stickyNote" ||
        obj.type === "shape" ||
        obj.type === "table" ||
        obj.type === "codeBlock" ||
        obj.type === "embed"
      ) {
        // Clear resize coordinator for HTML overlay components
        if (obj.type === "embed" || obj.type === "codeBlock") {
          resizeCoordinator.clear(node.id());
        }
        // Just ensure final position is set
        useCanvasStore.getState().updateObject(node.id(), {
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
        });
        return;
      }

      if (obj.type === "line") {
        // For line, scale all points
        const scaledPoints = toPointArray(obj.points).map((p, i) =>
          i % 2 === 0 ? p * scaleX : p * scaleY,
        );
        useCanvasStore.getState().updateObject(node.id(), {
          x: node.x(),
          y: node.y(),
          points: scaledPoints,
          rotation: node.rotation(),
        });
      } else {
        // rectangle, image, stickyNote
        useCanvasStore.getState().updateObject(node.id(), {
          x: node.x(),
          y: node.y(),
          width: Math.max(5, (obj.width ?? 100) * scaleX),
          height: Math.max(5, (obj.height ?? 100) * scaleY),
          rotation: node.rotation(),
        });
      }
    });
  }, []);

  // Cancel arrow drawing on escape or undo (Cmd+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: 취소
      if (e.key === "Escape" && arrowDrawing) {
        setArrowDrawing(null);
      }
      // Cmd+Z (Undo): 첫 번째 점만 찍은 상태면 취소
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "z" &&
        !e.shiftKey &&
        arrowDrawing
      ) {
        e.preventDefault();
        e.stopPropagation();
        setArrowDrawing(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [arrowDrawing]);

  // 숨겨진 그룹 ID 집합
  const hiddenGroupIds = useMemo(() => {
    return new Set(groups.filter((g) => g.hidden).map((g) => g.id));
  }, [groups]);

  // Separate objects by type for layering (memoized for performance)
  // 숨겨진 그룹에 속한 객체는 렌더링하지 않음
  // Line 객체도 같은 레이어에서 렌더링하여 Z-order 존중
  const allObjects = useMemo(
    () => objects.filter((obj) => !hiddenGroupIds.has(obj.groupId ?? "")),
    [objects, hiddenGroupIds],
  );

  // 뷰포트 가상화: 화면에 보이는 객체만 렌더링 (Progressive Disclosure)
  // 선택된 객체와 연결된 Connector는 뷰포트 밖이어도 포함
  const visibleObjects = useVisibleObjects(allObjects, viewport, selectedIds, {
    padding: 150, // 버퍼 영역 (300→150으로 축소하여 렌더링할 객체 수 감소)
  });

  // 단일 패스로 visibleObjects를 3가지 카테고리로 분류
  const { objectsBehindGroups, objectsInFrontOfGroups, connectorLabels } =
    useMemo(() => {
      const behind: (typeof visibleObjects)[0][] = [];
      const front: (typeof visibleObjects)[0][] = [];
      const labels: (typeof visibleObjects)[0][] = [];
      for (const obj of visibleObjects) {
        if (obj.type === "connectorLabel") {
          labels.push(obj);
        } else if ((obj.zIndex ?? 0) < 0) {
          behind.push(obj);
        } else {
          front.push(obj);
        }
      }
      return {
        objectsBehindGroups: behind,
        objectsInFrontOfGroups: front,
        connectorLabels: labels,
      };
    }, [visibleObjects]);

  // O(1) 객체 조회를 위한 Map (Connector에 전달하여 memo() 최적화 활성화)
  const objectsById = useMemo(() => {
    const map = new Map<string, (typeof objects)[0]>();
    objects.forEach((obj) => map.set(obj.id, obj));
    return map;
  }, [objects]);

  // HTML 오버레이 대상 객체를 단일 패스로 사전 분류 (3회 objects.map().filter().map() 제거)
  // 원본 objects 배열에서의 인덱스 조회 (오버레이 z-index용)
  const objectIndexMap = useMemo(
    () => new Map(objects.map((o, i) => [o.id, i] as const)),
    [objects],
  );

  // 오버레이 분류 — visibleObjects 기반 (viewport 의존 제거, 이미 뷰포트 필터링 완료)
  // 화면 픽셀 크기가 MIN_OVERLAY_SCREEN_SIZE 미만인 객체는 오버레이 스킵 (읽을 수 없을 정도로 작음)
  const MIN_OVERLAY_SCREEN_SIZE = 24; // px — 이 이하에서는 텍스트가 보이지 않음
  const { overlayTextObjects, overlayCodeBlocks, overlayEmbeds } =
    useMemo(() => {
      const texts: Array<{ obj: (typeof objects)[0]; actualIndex: number }> =
        [];
      const codeBlocks: Array<{
        obj: (typeof objects)[0];
        actualIndex: number;
      }> = [];
      const embeds: Array<{ obj: (typeof objects)[0]; actualIndex: number }> =
        [];

      const currentZoom = viewport.zoom;

      for (const obj of visibleObjects) {
        if ((obj.zIndex ?? 0) < 0) continue;
        if (hiddenGroupIds.has(obj.groupId ?? "")) continue;

        // 화면 픽셀 크기 필터 — 줌 적용 후 너무 작으면 오버레이 스킵
        const screenW = (obj.width ?? 100) * currentZoom;
        const screenH = (obj.height ?? 100) * currentZoom;
        if (
          screenW < MIN_OVERLAY_SCREEN_SIZE &&
          screenH < MIN_OVERLAY_SCREEN_SIZE
        )
          continue;

        const actualIndex = objectIndexMap.get(obj.id) ?? 0;

        if (
          (obj.type === "stickyNote" || obj.type === "textBox") &&
          obj.id !== editingTextId
        ) {
          texts.push({ obj, actualIndex });
        } else if (
          obj.type === "shape" &&
          obj.tiptapContent &&
          hasMixedStyles(obj.tiptapContent) &&
          obj.id !== editingTextId
        ) {
          // Shape with mixed tiptap styles needs HTML overlay
          texts.push({ obj, actualIndex });
        } else if (obj.type === "codeBlock" && obj.id !== editingTextId) {
          codeBlocks.push({ obj, actualIndex });
        } else if (obj.type === "embed") {
          embeds.push({ obj, actualIndex });
        }
      }
      return {
        overlayTextObjects: texts,
        overlayCodeBlocks: codeBlocks,
        overlayEmbeds: embeds,
      };
    }, [
      visibleObjects,
      editingTextId,
      hiddenGroupIds,
      objectIndexMap,
      viewport.zoom,
    ]);

  // Calculate drawing preview style based on pen type
  const getDrawingStyle = () => {
    let strokeWidth = penSettings.strokeWidth;
    let opacity = 1;

    if (penSettings.penType === "marker") {
      strokeWidth = penSettings.strokeWidth * 2;
      opacity = 0.7;
    } else if (penSettings.penType === "highlighter") {
      strokeWidth = penSettings.strokeWidth * 4;
      opacity = 0.4;
    }

    return { strokeWidth, opacity };
  };

  const drawingStyle = getDrawingStyle();

  // Stage wrapper에 적용할 인라인 cursor 스타일 (className보다 확실함)
  // CSS Grid Pattern — apply to Konva Stage's container div (behind canvas, no z-index issues)
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const container = stage.container();
    if (!container) return;

    if (gridType === "blank") {
      container.style.backgroundImage = "none";
      return;
    }

    const screenGap = 20;
    const dotSize = gridType === "dots" ? 1.2 : 1;
    const offsetX = viewport.x % screenGap;
    const offsetY = viewport.y % screenGap;

    if (gridType === "dots") {
      container.style.backgroundImage = `radial-gradient(circle, ${gridColor} ${dotSize}px, transparent ${dotSize}px)`;
    } else {
      container.style.backgroundImage = `linear-gradient(${gridColor} 1px, transparent 1px), linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`;
    }
    container.style.backgroundSize = `${screenGap}px ${screenGap}px`;
    container.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
  }, [gridType, gridColor, viewport.x, viewport.y]);

  const getWrapperCursorStyle = (): React.CSSProperties => {
    if (isLocked) {
      if (tool === "hand") {
        return { cursor: isPanning ? "grabbing" : "grab" };
      }
      return { cursor: "not-allowed" };
    }
    // 커스텀 커서 사용 시 브라우저 커서 숨김
    return { cursor: "none" };
  };

  return (
    <>
      {/* Stage wrapper - cursor 스타일을 확실하게 적용 */}
      <div ref={stageWrapperRef} style={getWrapperCursorStyle()}>
        {/* CSS Grid Pattern — applied to Konva Stage container after mount */}
        {false &&
          gridType !== "blank" &&
          (() => {
            const screenGap = 20;
            const dotSize = gridType === "dots" ? 1.2 : 1;
            const offsetX = viewport.x % screenGap;
            const offsetY = viewport.y % screenGap;

            return (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  zIndex: 0,
                  ...(gridType === "dots"
                    ? {
                        backgroundImage: `radial-gradient(circle, ${gridColor} ${dotSize}px, transparent ${dotSize}px)`,
                        backgroundSize: `${screenGap}px ${screenGap}px`,
                        backgroundPosition: `${offsetX}px ${offsetY}px`,
                      }
                    : {
                        backgroundImage: `linear-gradient(${gridColor} 1px, transparent 1px), linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`,
                        backgroundSize: `${screenGap}px ${screenGap}px`,
                        backgroundPosition: `${offsetX}px ${offsetY}px`,
                      }),
                }}
              />
            );
          })()}
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          x={viewport.x}
          y={viewport.y}
          scaleX={viewport.zoom}
          scaleY={viewport.zoom}
          onWheel={handleWheel}
          onClick={handleStageClick}
          onDblClick={() => {
            // When Stage is draggable, double-clicks are captured at Stage level
            // Find the actual target using pointer position
            const stage = stageRef.current;
            if (!stage) return;

            const pointer = stage.getPointerPosition();
            if (!pointer) return;

            const { tool, viewport, objects } = useCanvasStore.getState();

            // Eraser tool: double-click to erase entire line
            if (tool === "eraser") {
              const canvasX = (pointer.x - viewport.x) / viewport.zoom;
              const canvasY = (pointer.y - viewport.y) / viewport.zoom;
              eraseEntireLine(canvasX, canvasY);
              return;
            }

            // Get the shape at pointer position
            const shape = stage.getIntersection(pointer);
            if (!shape) return;

            // Find the parent Group (which has the id)
            let target: Konva.Node | null = shape;
            while (target && !target.id()) {
              target = target.parent;
            }

            if (target && target.id()) {
              const obj = objects.find((o) => o.id === target!.id());
              if (
                (obj?.type === "stickyNote" || (obj && isShape(obj))) &&
                tool !== "pencil"
              ) {
                useCanvasStore.getState().setEditingTextId(target.id());
              }
            }
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            handleMouseUp();
            setHoverPosition(null);
            setIsCursorVisible(false);
          }}
          onContextMenu={handleContextMenu}
        >
          {/* Grid rendering moved to CSS div before Stage */}

          {/* Legacy Konva grid removed — CSS pattern is 100x faster */}
          {false && gridType !== "blank" && (
            <Layer listening={false}>
              <Shape
                perfectDrawEnabled={false}
                shadowForStrokeEnabled={false}
                sceneFunc={(ctx) => {
                  const zoomFactor = Math.min(1, viewport.zoom);
                  const targetScreenGap = 50 * (0.5 + 0.5 * zoomFactor);
                  const rawCanvasGap = targetScreenGap / viewport.zoom;
                  const baseGap = 10;
                  const power = Math.round(Math.log2(rawCanvasGap / baseGap));
                  const gap = baseGap * Math.pow(2, Math.max(0, power));
                  const viewportLeft = -viewport.x / viewport.zoom;
                  const viewportTop = -viewport.y / viewport.zoom;
                  const viewportRight =
                    (-viewport.x + stageSize.width) / viewport.zoom;
                  const viewportBottom =
                    (-viewport.y + stageSize.height) / viewport.zoom;
                  const visibleLeft =
                    Math.floor(viewportLeft / gap) * gap - gap;
                  const visibleTop = Math.floor(viewportTop / gap) * gap - gap;
                  const visibleRight =
                    Math.ceil(viewportRight / gap) * gap + gap;
                  const visibleBottom =
                    Math.ceil(viewportBottom / gap) * gap + gap;
                  const maxCount = 100;
                  const cols = Math.min(
                    maxCount,
                    Math.ceil((visibleRight - visibleLeft) / gap),
                  );
                  const rows = Math.min(
                    maxCount,
                    Math.ceil((visibleBottom - visibleTop) / gap),
                  );

                  if (gridType === "dots") {
                    const dotRadius = 1.5 / viewport.zoom;
                    ctx.fillStyle = gridColor;
                    ctx.beginPath();
                    for (let i = 0; i <= cols; i++) {
                      for (let j = 0; j <= rows; j++) {
                        const x = visibleLeft + i * gap;
                        const y = visibleTop + j * gap;
                        ctx.moveTo(x + dotRadius, y);
                        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
                      }
                    }
                    ctx.fill();
                  } else if (gridType === "lines") {
                    const lineWidth = 1 / viewport.zoom;
                    ctx.strokeStyle = gridColor;
                    ctx.lineWidth = lineWidth;
                    ctx.beginPath();

                    // Vertical lines
                    for (let i = 0; i <= cols; i++) {
                      const x = visibleLeft + i * gap;
                      ctx.moveTo(x, visibleTop);
                      ctx.lineTo(x, visibleTop + rows * gap);
                    }

                    // Horizontal lines
                    for (let j = 0; j <= rows; j++) {
                      const y = visibleTop + j * gap;
                      ctx.moveTo(visibleLeft, y);
                      ctx.lineTo(visibleLeft + cols * gap, y);
                    }

                    ctx.stroke();
                  }
                }}
              />
            </Layer>
          )}

          {/* Objects Layer (shapes, images, sticky notes - NOT lines) */}
          {/* Objects Layer - connector 툴일 때는 Shape 드래그 비활성화 (화살표 생성 우선) */}
          <Layer listening={tool !== "pencil" && tool !== "connector"}>
            {/* 섹션 배경 뒤에 렌더링할 객체 (zIndex < 0) */}
            {objectsBehindGroups.map((obj) => (
              <ShapeErrorBoundary
                key={obj.id}
                objectId={obj.id}
                resetKey={obj}
                bounds={{
                  x: obj.x,
                  y: obj.y,
                  width: obj.width ?? 100,
                  height: obj.height ?? 100,
                }}
              >
                <ShapeRenderer
                  obj={obj}
                  renderMode="simplified"
                  isSelected={selectedIdsSet.has(obj.id)}
                  isMultiSelected={
                    selectedIdsSet.has(obj.id) && selectedIds.length > 1
                  }
                  isObjectLocked={
                    obj.locked === true ||
                    (obj.groupId
                      ? groupsMap.get(obj.groupId)?.locked === true
                      : false)
                  }
                  skipSelectionBorder={selectedIds.length > 30}
                />
              </ShapeErrorBoundary>
            ))}

            {/* 그룹 경계선 (섹션 배경) */}
            {groups.map((group) => {
              // 그룹에 속한 객체가 선택되어 있는지 확인
              let groupObjectIds = objects
                .filter((o) => o.groupId === group.id)
                .map((o) => o.id);

              // 중첩 그룹: 직접 멤버가 없으면 customBounds 안의 객체 사용
              const isParentGroup =
                groupObjectIds.length === 0 && !!group.customBounds;
              if (isParentGroup && group.customBounds) {
                const b = group.customBounds;
                groupObjectIds = objects
                  .filter(
                    (o) =>
                      o.x >= b.x &&
                      o.y >= b.y &&
                      o.x <= b.x + b.width &&
                      o.y <= b.y + b.height,
                  )
                  .map((o) => o.id);
              }

              const isGroupSelected =
                groupObjectIds.some((id) => selectedIdsSet.has(id)) ||
                selectedIdsSet.has(`__group:${group.id}`);

              return (
                <GroupBoundary
                  key={`group-${group.id}`}
                  group={group}
                  objects={objects}
                  zoom={viewport.zoom}
                  isSelected={isGroupSelected}
                  isParentGroup={isParentGroup}
                  onSelect={(groupId, e) => {
                    const { tool, isLocked, selectedIds } =
                      useCanvasStore.getState();
                    const { setSelectedIds, selectGroup } =
                      useCanvasStore.getState();
                    // Hand 도구, 커넥터 도구, 잠금 모드에서는 선택 불가
                    if (tool === "hand" || tool === "connector" || isLocked)
                      return;

                    const shiftKey = e.evt.shiftKey;

                    if (shiftKey) {
                      // Shift+클릭: 기존 선택에 그룹 추가
                      const newSelectedIds = [
                        ...new Set([...selectedIds, ...groupObjectIds]),
                      ];
                      setSelectedIds(newSelectedIds);
                    } else {
                      // 일반 클릭: 그룹 선택
                      selectGroup(groupId);
                    }
                  }}
                  onDragStart={(groupId) => {
                    const { isLocked, objects, selectedIds } =
                      useCanvasStore.getState();
                    const { addDraggingIds, selectGroup } =
                      useCanvasStore.getState();
                    // 그룹이 잠겨있거나 잠금 모드면 드래그 불가
                    if (group.locked || isLocked) return;

                    // 드래그 시작 - 해당 그룹 객체들의 HTML overlay 숨기기
                    addDraggingIds(groupObjectIds);

                    // 그룹이 선택되지 않았으면 먼저 선택
                    const selectedIdsSetLocal = new Set(selectedIds);
                    const isAlreadySelected =
                      groupObjectIds.some((id) =>
                        selectedIdsSetLocal.has(id),
                      ) || selectedIdsSetLocal.has(`__group:${groupId}`);
                    if (!isAlreadySelected) {
                      selectGroup(groupId);
                    }

                    // 드래그 시작 시 그룹 객체들 위치 기록
                    groupObjectIds.forEach((objId) => {
                      const obj = objects.find((o) => o.id === objId);
                      if (obj) {
                        dragCoordinator.setPosition(
                          objId,
                          obj.x ?? 0,
                          obj.y ?? 0,
                        );
                      }
                    });
                  }}
                  onDragMove={(_groupId, deltaX, deltaY) => {
                    const { isLocked, objects } = useCanvasStore.getState();
                    // 그룹이 잠겨있거나 잠금 모드면 드래그 불가
                    if (group.locked || isLocked) return;

                    const stage = stageRef.current;
                    if (!stage) return;

                    // 모든 그룹 객체들 위치 업데이트 및 Konva 노드 직접 이동
                    groupObjectIds.forEach((objId) => {
                      const obj = objects.find((o) => o.id === objId);
                      if (!obj) return;

                      // 연결된 커넥터는 도형의 앵커 포인트를 따라가므로 건너뛰기
                      // (도형이 이동하면 커넥터는 자동으로 재계산됨)
                      if (
                        obj.type === "connector" &&
                        (obj.sourceId || obj.targetId)
                      ) {
                        return;
                      }

                      // dragCoordinator에서 현재 위치 가져오기, 없으면 store에서 가져오기
                      let currentPos = dragCoordinator.getPosition(objId);
                      if (!currentPos) {
                        currentPos = { x: obj.x ?? 0, y: obj.y ?? 0 };
                        dragCoordinator.setPosition(
                          objId,
                          currentPos.x,
                          currentPos.y,
                        );
                      }

                      if (currentPos) {
                        const newX = currentPos.x + deltaX;
                        const newY = currentPos.y + deltaY;
                        dragCoordinator.setPosition(objId, newX, newY);

                        // 독립적인 커넥터는 dragCoordinator 구독으로 Line points 직접 업데이트
                        // (Group 위치 변경하면 렌더링 꼬임)
                        if (obj.type === "connector") {
                          return;
                        }

                        // Stage에서 직접 노드 찾기 (모든 레이어 검색)
                        const node = stage.findOne(`#${objId}`);
                        if (node) {
                          node.x(newX);
                          node.y(newY);
                        }
                      }
                    });

                    // 부모 그룹: 자식 GroupBoundary 노드도 실시간 이동
                    if (isParentGroup) {
                      const { groups: allGroups } = useCanvasStore.getState();
                      for (const childGroup of allGroups) {
                        if (childGroup.id === group.id) continue;
                        if (!childGroup.customBounds || !group.customBounds)
                          continue;
                        const cb = childGroup.customBounds;
                        const pb = group.customBounds;
                        // 자식 그룹이 부모 bounds 안에 있는지 확인
                        if (
                          cb.x >= pb.x &&
                          cb.y >= pb.y &&
                          cb.x + cb.width <= pb.x + pb.width &&
                          cb.y + cb.height <= pb.y + pb.height
                        ) {
                          const childNode = stage.findOne(
                            `#group-boundary-${childGroup.id}`,
                          );
                          if (childNode) {
                            childNode.x(childNode.x() + deltaX);
                            childNode.y(childNode.y() + deltaY);
                          }
                        }
                      }
                    }

                    // 모든 레이어 다시 그리기
                    stage.batchDraw();
                  }}
                  onDragEnd={(groupId) => {
                    const { isLocked, objects } = useCanvasStore.getState();
                    const { removeDraggingIds, moveGroupObjects } =
                      useCanvasStore.getState();
                    // 드래그 종료 - 해당 그룹 객체들의 HTML overlay 다시 표시
                    removeDraggingIds(groupObjectIds);

                    // 그룹이 잠겨있거나 잠금 모드면 드래그 불가
                    if (group.locked || isLocked) return;

                    // 최종 위치 계산 및 store 업데이트
                    let totalDeltaX = 0;
                    let totalDeltaY = 0;
                    let count = 0;

                    groupObjectIds.forEach((objId) => {
                      const obj = objects.find((o) => o.id === objId);

                      // 연결된 커넥터는 평균 계산에서 제외 (onDragMove에서 건너뛰었으므로)
                      if (
                        obj?.type === "connector" &&
                        (obj.sourceId || obj.targetId)
                      ) {
                        dragCoordinator.clear(objId);
                        return;
                      }

                      const finalPos = dragCoordinator.getPosition(objId);
                      if (obj && finalPos) {
                        totalDeltaX += finalPos.x - (obj.x ?? 0);
                        totalDeltaY += finalPos.y - (obj.y ?? 0);
                        count++;
                      }
                      dragCoordinator.clear(objId);
                    });

                    if (count > 0) {
                      const avgDeltaX = totalDeltaX / count;
                      const avgDeltaY = totalDeltaY / count;
                      if (
                        Math.abs(avgDeltaX) > 0.5 ||
                        Math.abs(avgDeltaY) > 0.5
                      ) {
                        moveGroupObjects(groupId, avgDeltaX, avgDeltaY);

                        // 부모 그룹: 자식 GroupBoundary Konva 위치 리셋 (store가 업데이트되어 React가 다시 렌더링)
                        if (isParentGroup) {
                          const stage = stageRef.current;
                          const { groups: allGroups } =
                            useCanvasStore.getState();
                          for (const childGroup of allGroups) {
                            if (childGroup.id === group.id) continue;
                            const childNode = stage?.findOne(
                              `#group-boundary-${childGroup.id}`,
                            );
                            if (childNode) {
                              childNode.x(0);
                              childNode.y(0);
                            }
                          }
                        }
                      }
                    }
                  }}
                  onBoundsChange={(groupId, newBounds) => {
                    useCanvasStore
                      .getState()
                      .updateGroup(groupId, { customBounds: newBounds });
                  }}
                  onScaleObjects={(
                    groupId,
                    scaleX,
                    scaleY,
                    originX,
                    originY,
                  ) => {
                    useCanvasStore
                      .getState()
                      .scaleGroupObjects(
                        groupId,
                        scaleX,
                        scaleY,
                        originX,
                        originY,
                      );
                  }}
                />
              );
            })}

            {/* 섹션 배경 앞에 렌더링할 객체 (zIndex >= 0) */}
            {objectsInFrontOfGroups.map((obj) => (
              <ShapeErrorBoundary
                key={obj.id}
                objectId={obj.id}
                resetKey={obj}
                bounds={{
                  x: obj.x,
                  y: obj.y,
                  width: obj.width ?? 100,
                  height: obj.height ?? 100,
                }}
              >
                <ShapeRenderer
                  obj={obj}
                  renderMode="full"
                  isSelected={selectedIdsSet.has(obj.id)}
                  isMultiSelected={
                    selectedIdsSet.has(obj.id) && selectedIds.length > 1
                  }
                  isObjectLocked={
                    obj.locked === true ||
                    (obj.groupId
                      ? groupsMap.get(obj.groupId)?.locked === true
                      : false)
                  }
                  skipSelectionBorder={selectedIds.length > 30}
                />
              </ShapeErrorBoundary>
            ))}
          </Layer>

          {/* Selection UI Layer — 선택 상호작용 UI(Transformer 핸들)와 잠금
              배지는 항상 다른 객체 위에 보여야 한다. Objects 레이어 안에 두면
              z-order 가 높은 객체·HTML 뷰어 오버레이(CodeBlock/Embed, z≤39)에
              가려지므로 별도 레이어로 분리하고, 마운트 시 이 레이어의 캔버스
              CSS z-index 를 오버레이보다 높인다 (위 useEffect). */}
          <Layer
            ref={selectionLayerRef}
            listening={tool !== "pencil" && tool !== "connector"}
          >
            {/* Lock badges for locked objects */}
            {visibleObjects
              .filter((obj) => obj.locked)
              .map((obj) => {
                // Calculate badge position (top-right corner)
                const width = obj.width ?? 100;
                const badgeX = obj.x + width - 4 / viewport.zoom;
                const badgeY = obj.y + 4 / viewport.zoom;

                const badgeSize = Math.max(16, 20 / viewport.zoom);
                const iconScale = badgeSize / 24;

                return (
                  <Group
                    key={`lock-${obj.id}`}
                    x={badgeX}
                    y={badgeY}
                    listening={false}
                  >
                    {/* Badge background */}
                    <KonvaCircle
                      x={0}
                      y={0}
                      radius={badgeSize / 2}
                      fill="#ef4444"
                      shadowColor="rgba(0,0,0,0.3)"
                      shadowBlur={4 / viewport.zoom}
                      shadowOffset={{
                        x: 1 / viewport.zoom,
                        y: 1 / viewport.zoom,
                      }}
                    />
                    {/* Lock icon using Shape sceneFunc */}
                    <Shape
                      sceneFunc={(ctx, shape) => {
                        const s = iconScale;
                        ctx.save();
                        ctx.translate(-5 * s, -6 * s);
                        ctx.fillStyle = "white";

                        // Lock body (rounded rectangle)
                        ctx.beginPath();
                        ctx.roundRect(1 * s, 5 * s, 8 * s, 7 * s, 1 * s);
                        ctx.fill();

                        // Lock shackle (arc)
                        ctx.strokeStyle = "white";
                        ctx.lineWidth = 1.5 * s;
                        ctx.lineCap = "round";
                        ctx.beginPath();
                        ctx.arc(5 * s, 5 * s, 2.5 * s, Math.PI, 0);
                        ctx.stroke();

                        ctx.restore();
                        ctx.fillStrokeShape(shape);
                      }}
                    />
                  </Group>
                );
              })}
            {/* Check if any selected object is locked or is a table */}
            {(() => {
              const hasLockedSelection = selectedIds.some((id) => {
                const obj = objects.find((o) => o.id === id);
                return obj?.locked;
              });
              const hasTableSelection = selectedIds.some((id) => {
                const obj = objects.find((o) => o.id === id);
                return obj?.type === "table";
              });
              const borderColor = hasLockedSelection ? "#ef4444" : "#0D99FF";
              // Transformer는 Stage scale 영향을 받지 않으므로 고정값 사용
              const borderWidth = hasLockedSelection ? 3 : 1.5;

              return (
                <Transformer
                  ref={transformerRef}
                  rotateEnabled={
                    !isLocked && !hasLockedSelection && !hasTableSelection
                  }
                  resizeEnabled={!isLocked && !hasLockedSelection}
                  borderStroke={borderColor}
                  borderStrokeWidth={borderWidth}
                  anchorStroke={borderColor}
                  anchorFill="#fff"
                  anchorSize={12}
                  anchorCornerRadius={4}
                  rotateAnchorOffset={30}
                  rotateAnchorCursor="grab"
                  anchorStyleFunc={(anchor) => {
                    // Transformer anchor는 Stage scale 영향을 받지 않으므로 고정값 사용
                    // 리사이즈 핸들 스타일 (코너 및 가장자리)
                    if (!anchor.hasName("rotater")) {
                      const size = 12;
                      anchor.width(size);
                      anchor.height(size);
                      anchor.offsetX(size / 2);
                      anchor.offsetY(size / 2);
                      anchor.cornerRadius(4);
                      anchor.fill("#fff");
                      anchor.stroke(borderColor);
                      anchor.strokeWidth(2);
                    }
                    // Rotation anchor gets a special rotation icon style
                    if (anchor.hasName("rotater")) {
                      const size = 24;
                      anchor.width(size);
                      anchor.height(size);
                      anchor.offsetX(size / 2);
                      anchor.offsetY(size / 2);
                      anchor.cornerRadius(size / 2);
                      anchor.fill("#fff");
                      anchor.stroke("#0D99FF");
                      anchor.strokeWidth(2);
                      // Add rotation arrows using sceneFunc
                      anchor.sceneFunc((ctx, shape) => {
                        const s = shape.width();
                        const half = s / 2;
                        // Background circle
                        ctx.beginPath();
                        ctx.arc(half, half, half - 1, 0, Math.PI * 2);
                        ctx.closePath();
                        ctx.fillStrokeShape(shape);
                        // Draw rotation arrow
                        ctx.save();
                        ctx.translate(half, half);
                        ctx.strokeStyle = "#0D99FF";
                        ctx.lineWidth = 2;
                        ctx.lineCap = "round";
                        // Arc arrow (larger radius)
                        const arcRadius = half * 0.55;
                        ctx.beginPath();
                        ctx.arc(
                          0,
                          0,
                          arcRadius,
                          -Math.PI * 0.75,
                          Math.PI * 0.35,
                        );
                        ctx.stroke();
                        // Arrow head (larger)
                        const arrowX = Math.cos(Math.PI * 0.35) * arcRadius;
                        const arrowY = Math.sin(Math.PI * 0.35) * arcRadius;
                        const arrowSize = 4;
                        ctx.beginPath();
                        ctx.moveTo(arrowX - arrowSize, arrowY - arrowSize);
                        ctx.lineTo(arrowX, arrowY);
                        ctx.lineTo(arrowX + arrowSize, arrowY - arrowSize);
                        ctx.stroke();
                        ctx.restore();
                      });
                    }
                  }}
                  onTransform={handleTransform}
                  onTransformEnd={handleTransformEnd}
                  onDragStart={() => {
                    // 드래그 시작 - 선택된 객체들의 HTML overlay 숨기기
                    const { selectedIds } = useCanvasStore.getState();
                    useCanvasStore.getState().addDraggingIds(selectedIds);
                  }}
                  onDragMove={() => {
                    // Update dragCoordinator for all selected nodes during multi-selection drag
                    const transformer = transformerRef.current;
                    if (!transformer) return;

                    const nodes = transformer.nodes();
                    if (nodes.length === 0) return;

                    // 첫 번째 노드를 기준으로 정렬 가이드 계산
                    const firstNode = nodes[0]!;
                    const firstObj = objects.find(
                      (o) => o.id === firstNode.id(),
                    );
                    if (!firstObj) return;

                    let currentX = firstNode.x();
                    let currentY = firstNode.y();

                    // 정렬 가이드 계산
                    const draggedBounds = {
                      x: currentX,
                      y: currentY,
                      width: firstObj.width ?? 100,
                      height: firstObj.height ?? 100,
                    };

                    const { guides, snappedX, snappedY } =
                      calculateAlignmentGuides(
                        draggedBounds,
                        objects,
                        selectedIds,
                      );

                    // 스냅 적용 (모든 노드에 동일한 오프셋 적용)
                    if (snappedX !== undefined || snappedY !== undefined) {
                      const offsetX =
                        snappedX !== undefined ? snappedX - currentX : 0;
                      const offsetY =
                        snappedY !== undefined ? snappedY - currentY : 0;

                      nodes.forEach((node) => {
                        node.x(node.x() + offsetX);
                        node.y(node.y() + offsetY);
                      });
                    }

                    // 가이드 라인 업데이트
                    setAlignmentGuides(guides);

                    // dragCoordinator 업데이트
                    nodes.forEach((node) => {
                      dragCoordinator.setPosition(
                        node.id(),
                        node.x(),
                        node.y(),
                      );
                    });
                  }}
                  onDragEnd={() => {
                    // 드래그 종료 - 선택된 객체들의 HTML overlay 다시 표시
                    const { selectedIds } = useCanvasStore.getState();
                    useCanvasStore.getState().removeDraggingIds(selectedIds);

                    // 가이드 라인 제거
                    setAlignmentGuides([]);

                    // Clear dragCoordinator positions after drag ends
                    const transformer = transformerRef.current;
                    if (!transformer) return;
                    transformer.nodes().forEach((node) => {
                      dragCoordinator.clear(node.id());
                    });
                  }}
                  boundBoxFunc={(oldBox, newBox) => {
                    if (newBox.width < 5 || newBox.height < 5) return oldBox;
                    return newBox;
                  }}
                />
              );
            })()}
          </Layer>

          {/* Batch Selection Borders Layer - rendered when 30+ objects selected for performance */}
          {selectedIds.length > 30 && (
            <Layer listening={false}>
              {visibleObjects
                .filter(
                  (obj) =>
                    selectedIdsSet.has(obj.id) &&
                    obj.type !== "connector" &&
                    obj.type !== "connectorLabel",
                )
                .map((obj) => (
                  <Rect
                    key={`sel-${obj.id}`}
                    x={(obj.x ?? 0) - 2}
                    y={(obj.y ?? 0) - 2}
                    width={(obj.width ?? 100) + 4}
                    height={(obj.height ?? 100) + 4}
                    rotation={obj.rotation ?? 0}
                    stroke="#0D99FF"
                    strokeWidth={2 / viewport.zoom}
                    dash={[4, 4]}
                    listening={false}
                    perfectDrawEnabled={false}
                  />
                ))}
            </Layer>
          )}

          {/* Connectors Layer */}
          <Layer ref={connectorLayerRef} listening={tool !== "pencil"}>
            {/* Connection Points - Shape 위에 호버 시 연결 포인트 표시 */}
            {hoveredShapeForConnector &&
              tool === "connector" &&
              !arrowDrawing && (
                <Group listening={false}>
                  {hoveredShapeForConnector.anchors.map(({ anchor, point }) => (
                    <KonvaCircle
                      key={`${hoveredShapeForConnector.shapeId}-${anchor}`}
                      x={point.x}
                      y={point.y}
                      radius={6 / viewport.zoom}
                      fill="#22c55e"
                      stroke="white"
                      strokeWidth={1.5 / viewport.zoom}
                      perfectDrawEnabled={false}
                      shadowForStrokeEnabled={false}
                    />
                  ))}
                </Group>
              )}

            {/* Connection Handles - Shape/Group 선택 시 4방향 파란색 핸들 표시 */}
            {selectedIds.length === 1 &&
              tool === "select" &&
              !isLocked &&
              (() => {
                let selectedObj: CanvasObject | undefined;
                const selectedId = selectedIds[0]!;

                // Check for __group: virtual selection — create virtual shape from group bounds
                const groupMatch = selectedId.match(/^__group:(.+)$/);
                if (groupMatch) {
                  const group = groups.find((g) => g.id === groupMatch[1]);
                  if (group) {
                    let b = group.customBounds;
                    // No customBounds → calculate from member objects
                    if (!b) {
                      const members = objects.filter(
                        (o) => o.groupId === group.id,
                      );
                      if (members.length > 0) {
                        const padding = 20;
                        const minX = Math.min(...members.map((o) => o.x));
                        const minY = Math.min(...members.map((o) => o.y));
                        const maxX = Math.max(
                          ...members.map((o) => o.x + (o.width ?? 100)),
                        );
                        const maxY = Math.max(
                          ...members.map((o) => o.y + (o.height ?? 100)),
                        );
                        b = {
                          x: minX - padding,
                          y: minY - padding,
                          width: maxX - minX + padding * 2,
                          height: maxY - minY + padding * 2,
                        };
                      }
                    }
                    if (b) {
                      selectedObj = {
                        id: selectedId,
                        type: "shape",
                        shapeVariant: "rectangle",
                        x: b.x,
                        y: b.y,
                        width: b.width,
                        height: b.height,
                        rotation: 0,
                        opacity: 1,
                      };
                    }
                  }
                } else {
                  selectedObj = objects.find((o) => o.id === selectedIds[0]);
                }

                if (
                  !selectedObj ||
                  selectedObj.type === "connector" ||
                  selectedObj.type === "connectorLabel" ||
                  selectedObj.type === "line" ||
                  selectedObj.type === "textBox" ||
                  selectedObj.type === "chart" ||
                  selectedObj.type === "codeBlock" ||
                  selectedObj.type === "embed" ||
                  selectedObj.locked
                )
                  return null;
                return (
                  <ConnectionHandles
                    shape={selectedObj}
                    zoom={viewport.zoom}
                    objects={objects}
                    onHandleClick={(anchor) => {
                      const { addObject, setSelectedIds, defaultFontFamily } =
                        useCanvasStore.getState();
                      // StickyNote: 커넥터 없이 새 스티키 노트만 생성
                      if (selectedObj.type === "stickyNote") {
                        const offset = getOffsetForDirection(
                          selectedObj,
                          anchor,
                        );
                        const newNote = createStickyNote(
                          selectedObj.x + offset.x,
                          selectedObj.y + offset.y,
                          "#fef08a",
                          undefined,
                          defaultFontFamily,
                        );
                        addObject(newNote);
                        setSelectedIds([newNote.id]);
                        return;
                      }

                      // Shape/Rectangle 등: 도형 복제 + 커넥터 연결
                      const anchorPoint = getAnchorPoint(selectedObj, anchor);

                      // 클릭 방향에 가까운 도형 찾기
                      const nearestShape = findNearestShapeInDirection(
                        anchorPoint,
                        anchor,
                        objects,
                        [selectedObj.id],
                        200,
                      );

                      let targetObj: typeof selectedObj;

                      if (nearestShape) {
                        // 기존 도형에 연결
                        targetObj = nearestShape;
                      } else {
                        // 도형 복제
                        const offset = getOffsetForDirection(
                          selectedObj,
                          anchor,
                        );
                        const cloned = cloneShape(selectedObj, offset);
                        addObject(cloned);
                        targetObj = cloned;
                      }

                      // 커넥터 생성
                      const targetAnchor = getOppositeAnchor(anchor);
                      const sourceAnchorPoint = getAnchorPoint(
                        selectedObj,
                        anchor,
                      );
                      const targetAnchorPoint = getAnchorPoint(
                        targetObj,
                        targetAnchor,
                      );

                      const sourceOffsetX = sourceAnchorPoint.x - selectedObj.x;
                      const sourceOffsetY = sourceAnchorPoint.y - selectedObj.y;
                      const targetOffsetX = targetAnchorPoint.x - targetObj.x;
                      const targetOffsetY = targetAnchorPoint.y - targetObj.y;

                      const newConnector = createArrow(
                        sourceAnchorPoint.x,
                        sourceAnchorPoint.y,
                        targetAnchorPoint.x,
                        targetAnchorPoint.y,
                        {
                          sourceId: selectedObj.id,
                          targetId: targetObj.id,
                          sourceAnchor: anchor,
                          targetAnchor: targetAnchor,
                          sourceOffsetX,
                          sourceOffsetY,
                          targetOffsetX,
                          targetOffsetY,
                          stroke: shapeSettings.strokeColor,
                        },
                      );
                      addObject(newConnector);

                      // 새로 생성/연결된 대상 객체만 선택 (커넥터 연결은 이미 그룹핑으로 간주)
                      setSelectedIds([targetObj.id]);
                    }}
                  />
                );
              })()}

            {/* ConnectorLabels - connector 위에 렌더링 */}
            {connectorLabels.map((obj) => {
              const isSelected = selectedIdsSet.has(obj.id);
              const objGroup = obj.groupId ? groupsMap.get(obj.groupId) : null;
              const isObjectLocked =
                obj.locked === true || objGroup?.locked === true;

              // Get connected connector for position calculation
              const connectedConnector = obj.connectedConnectorId
                ? objectsById.get(obj.connectedConnectorId)
                : undefined;

              if (
                !connectedConnector ||
                connectedConnector.type !== "connector"
              ) {
                return null; // Skip rendering if connector not found
              }

              // Calculate connector path (드래그 중인 shape 위치 반영)
              const sourceObj = connectedConnector.sourceId
                ? objectsById.get(connectedConnector.sourceId)
                : undefined;
              const targetObj = connectedConnector.targetId
                ? objectsById.get(connectedConnector.targetId)
                : undefined;

              // 드래그 중인 shape의 실시간 위치 가져오기
              const sourceDragPos = sourceObj
                ? dragCoordinator.getPosition(sourceObj.id)
                : undefined;
              const targetDragPos = targetObj
                ? dragCoordinator.getPosition(targetObj.id)
                : undefined;

              // 드래그 위치 또는 store 위치 사용
              const sourceObjWithDragPos =
                sourceObj && sourceDragPos
                  ? { ...sourceObj, x: sourceDragPos.x, y: sourceDragPos.y }
                  : sourceObj;
              const targetObjWithDragPos =
                targetObj && targetDragPos
                  ? { ...targetObj, x: targetDragPos.x, y: targetDragPos.y }
                  : targetObj;

              // 렌더러와 같은 단일 소스 — 라이브 드래그 위치를 반영한
              // 도형을 그대로 넘기면 앵커·ratio·리드인 스텁까지 일치한다.
              const { start: startPoint, end: endPoint } =
                getConnectorEndpoints(
                  connectedConnector,
                  sourceObjWithDragPos,
                  targetObjWithDragPos,
                );

              const pathStyle = connectedConnector.pathStyle ?? "straight";
              let pathPoints: number[];

              if (pathStyle === "curved") {
                // 곡선 라벨 보간은 베지어 샘플링 유지 (폴리라인 보간과 다름)
                const midX = (startPoint.x + endPoint.x) / 2;
                const midY = (startPoint.y + endPoint.y) / 2;
                const dx = endPoint.x - startPoint.x;
                const dy = endPoint.y - startPoint.y;
                const controlX = midX - dy * 0.2;
                const controlY = midY + dx * 0.2;

                pathPoints = [];
                for (let i = 0; i <= 10; i++) {
                  const t = i / 10;
                  const mt = 1 - t;
                  pathPoints.push(
                    mt * mt * startPoint.x +
                      2 * mt * t * controlX +
                      t * t * endPoint.x,
                    mt * mt * startPoint.y +
                      2 * mt * t * controlY +
                      t * t * endPoint.y,
                  );
                }
              } else {
                // straight / elbowed 는 단일 소스가 그대로 처리한다
                pathPoints = getConnectorPathPoints(
                  connectedConnector,
                  sourceObjWithDragPos,
                  targetObjWithDragPos,
                  { start: startPoint, end: endPoint },
                );
              }

              // 라벨은 절대좌표(obj.x, obj.y)를 사용 - shape 이동 시 따라가지 않음
              // (드래그할 때만 경로에 스냅되어 이동)
              const labelRenderShape = obj;

              return (
                <ConnectorLabel
                  key={obj.id}
                  shape={labelRenderShape}
                  connector={connectedConnector}
                  sourceObj={sourceObj}
                  targetObj={targetObj}
                  isSelected={isSelected}
                  zoom={viewport.zoom}
                  draggable={!isObjectLocked && tool !== "hand" && !isLocked}
                  onSelect={(e) => handleSelect(obj.id, e)}
                  onDragStart={() => {}}
                  onDragMove={(e) => {
                    // Constrain to connector path
                    if (pathPoints.length >= 4) {
                      const closest = getClosestPointOnPath(pathPoints, {
                        x: e.target.x(),
                        y: e.target.y(),
                      });
                      e.target.position({ x: closest.x, y: closest.y });
                      dragCoordinator.setPosition(obj.id, closest.x, closest.y);
                    }
                  }}
                  onDragEnd={(e) => {
                    dragCoordinator.clear(obj.id);
                    // 절대좌표로 저장 (경로에 스냅된 위치)
                    if (pathPoints.length >= 4) {
                      const closest = getClosestPointOnPath(pathPoints, {
                        x: e.target.x(),
                        y: e.target.y(),
                      });
                      useCanvasStore.getState().updateObject(obj.id, {
                        x: closest.x,
                        y: closest.y,
                        labelT: closest.t,
                      });
                    }
                  }}
                  onDoubleClick={() =>
                    !isObjectLocked &&
                    useCanvasStore.getState().setEditingTextId(obj.id)
                  }
                  isEditing={editingTextId === obj.id}
                />
              );
            })}
          </Layer>

          {/* Drawing Layer (current drawing preview and marquee selection) */}
          <Layer>
            {/* Drawing preview line */}
            {drawing && (
              <KonvaLine
                x={drawing.startX}
                y={drawing.startY}
                points={drawing.points}
                stroke={penSettings.strokeColor}
                strokeWidth={drawingStyle.strokeWidth}
                opacity={drawingStyle.opacity}
                lineCap="round"
                lineJoin="round"
                tension={0.5}
              />
            )}

            {/* Marquee selection rectangle */}
            {marquee && (
              <Rect
                x={Math.min(marquee.startX, marquee.currentX)}
                y={Math.min(marquee.startY, marquee.currentY)}
                width={Math.abs(marquee.currentX - marquee.startX)}
                height={Math.abs(marquee.currentY - marquee.startY)}
                fill="rgba(59, 130, 246, 0.1)"
                stroke="#3b82f6"
                strokeWidth={1 / viewport.zoom}
                dash={[4 / viewport.zoom, 4 / viewport.zoom]}
              />
            )}

            {/* Alignment guides (드래그 정렬 가이드 라인) */}
            {alignmentGuides.map((guide, idx) => (
              <KonvaLine
                key={`guide-${idx}`}
                points={
                  guide.type === "horizontal"
                    ? [guide.start, guide.position, guide.end, guide.position]
                    : [guide.position, guide.start, guide.position, guide.end]
                }
                stroke="#3b82f6"
                strokeWidth={1 / viewport.zoom}
                dash={[4 / viewport.zoom, 4 / viewport.zoom]}
                listening={false}
              />
            ))}

            {/* Shape preview on hover */}
            {hoverPosition && tool === "rectangle" && (
              <Rect
                x={hoverPosition.x}
                y={hoverPosition.y}
                width={75}
                height={60}
                fill={
                  shapeSettings.fillColor === "transparent"
                    ? "rgba(0,0,0,0.05)"
                    : shapeSettings.fillColor
                }
                stroke={shapeSettings.strokeColor}
                strokeWidth={shapeSettings.strokeWidth}
                opacity={0.5}
                cornerRadius={4}
                listening={false}
              />
            )}
            {hoverPosition && tool === "stickyNote" && (
              <Group
                x={hoverPosition.x}
                y={hoverPosition.y}
                opacity={0.5}
                listening={false}
              >
                <Rect
                  x={4}
                  y={4}
                  width={150}
                  height={150}
                  fill="rgba(0,0,0,0.1)"
                  cornerRadius={4}
                />
                <Rect
                  width={150}
                  height={150}
                  fill={stickyNoteColor}
                  cornerRadius={4}
                />
              </Group>
            )}
            {/* TextBox preview */}
            {hoverPosition && tool === "textBox" && (
              <Group
                x={hoverPosition.x}
                y={hoverPosition.y}
                opacity={0.5}
                listening={false}
              >
                <Rect
                  width={150}
                  height={30}
                  fill="rgba(255,255,255,0.8)"
                  stroke="#d1d5db"
                  strokeWidth={1}
                  cornerRadius={4}
                  dash={[4, 4]}
                />
              </Group>
            )}

            {/* Table preview */}
            {hoverPosition && tool === "table" && (
              <Group
                x={hoverPosition.x}
                y={hoverPosition.y}
                opacity={0.5}
                listening={false}
              >
                {/* 2x2 테이블 미리보기 */}
                <Rect
                  width={240}
                  height={80}
                  fill="#FFFFFF"
                  stroke="#E0E0E0"
                  strokeWidth={1}
                />
                {/* 세로 중앙선 */}
                <KonvaLine
                  points={[120, 0, 120, 80]}
                  stroke="#E0E0E0"
                  strokeWidth={1}
                />
                {/* 가로 중앙선 */}
                <KonvaLine
                  points={[0, 40, 240, 40]}
                  stroke="#E0E0E0"
                  strokeWidth={1}
                />
              </Group>
            )}

            {/* Code Block preview */}
            {hoverPosition && tool === "codeBlock" && (
              <Group
                x={hoverPosition.x}
                y={hoverPosition.y}
                opacity={0.5}
                listening={false}
              >
                <Rect
                  width={400}
                  height={200}
                  fill="#1e1e1e"
                  stroke="#374151"
                  strokeWidth={1}
                  cornerRadius={8}
                />
                {/* Header */}
                <Rect
                  width={400}
                  height={28}
                  fill="#2d2d2d"
                  cornerRadius={[8, 8, 0, 0]}
                />
                {/* Language badge */}
                <Rect
                  x={12}
                  y={6}
                  width={70}
                  height={16}
                  fill="#f7df1e"
                  cornerRadius={4}
                />
                <KonvaText
                  x={20}
                  y={8}
                  text="javascript"
                  fontSize={10}
                  fontFamily="IBM Plex Mono, monospace"
                  fill="#000"
                />
                {/* Sample code lines */}
                <KonvaText
                  x={12}
                  y={40}
                  text="// Click to add code"
                  fontSize={14}
                  fontFamily="IBM Plex Mono, monospace"
                  fill="#6a9955"
                />
              </Group>
            )}

            {/* Embed preview */}
            {hoverPosition && tool === "embed" && (
              <Group
                x={hoverPosition.x}
                y={hoverPosition.y}
                opacity={0.5}
                listening={false}
              >
                <Rect
                  width={480}
                  height={270}
                  fill="#1a1a1a"
                  stroke="#374151"
                  strokeWidth={1}
                  cornerRadius={8}
                />
                {/* Header */}
                <Rect
                  width={480}
                  height={32}
                  fill="#2d2d2d"
                  cornerRadius={[8, 8, 0, 0]}
                />
                {/* Service badge placeholder */}
                <Rect
                  x={10}
                  y={6}
                  width={70}
                  height={20}
                  fill="#FF0000"
                  cornerRadius={4}
                />
                <KonvaText
                  x={10}
                  y={6}
                  width={70}
                  height={20}
                  text="YouTube"
                  fontSize={11}
                  fontStyle="bold"
                  fontFamily="system-ui, sans-serif"
                  fill="#ffffff"
                  align="center"
                  verticalAlign="middle"
                />
                {/* Play icon */}
                <Rect
                  x={208}
                  y={119}
                  width={64}
                  height={44}
                  fill="rgba(255, 0, 0, 0.9)"
                  cornerRadius={8}
                />
                <KonvaText
                  x={226}
                  y={133}
                  text="▶"
                  fontSize={20}
                  fill="#ffffff"
                />
              </Group>
            )}

            {/* Chart preview */}
            {hoverPosition && tool === "chart" && (
              <Group
                x={hoverPosition.x}
                y={hoverPosition.y}
                opacity={0.5}
                listening={false}
              >
                <Rect
                  width={200}
                  height={150}
                  fill="#FFFFFF"
                  stroke="#E0E0E0"
                  strokeWidth={1}
                  cornerRadius={4}
                />
                {/* Chart type specific preview */}
                {selectedChartVariant === "bar" && (
                  <>
                    <Rect
                      x={30}
                      y={90}
                      width={30}
                      height={40}
                      fill="#3b82f6"
                      cornerRadius={[2, 2, 0, 0]}
                    />
                    <Rect
                      x={70}
                      y={50}
                      width={30}
                      height={80}
                      fill="#10b981"
                      cornerRadius={[2, 2, 0, 0]}
                    />
                    <Rect
                      x={110}
                      y={70}
                      width={30}
                      height={60}
                      fill="#f59e0b"
                      cornerRadius={[2, 2, 0, 0]}
                    />
                    <Rect
                      x={150}
                      y={100}
                      width={30}
                      height={30}
                      fill="#ef4444"
                      cornerRadius={[2, 2, 0, 0]}
                    />
                  </>
                )}
                {selectedChartVariant === "line" && (
                  <>
                    <KonvaLine
                      points={[30, 100, 70, 60, 110, 80, 150, 50]}
                      stroke="#3b82f6"
                      strokeWidth={2}
                      lineCap="round"
                      lineJoin="round"
                    />
                    <KonvaCircle x={30} y={100} radius={4} fill="#3b82f6" />
                    <KonvaCircle x={70} y={60} radius={4} fill="#10b981" />
                    <KonvaCircle x={110} y={80} radius={4} fill="#f59e0b" />
                    <KonvaCircle x={150} y={50} radius={4} fill="#ef4444" />
                  </>
                )}
                {selectedChartVariant === "pie" && (
                  <>
                    <Wedge
                      x={100}
                      y={75}
                      radius={50}
                      angle={90}
                      rotation={-90}
                      fill="#3b82f6"
                    />
                    <Wedge
                      x={100}
                      y={75}
                      radius={50}
                      angle={120}
                      rotation={0}
                      fill="#10b981"
                    />
                    <Wedge
                      x={100}
                      y={75}
                      radius={50}
                      angle={80}
                      rotation={120}
                      fill="#f59e0b"
                    />
                    <Wedge
                      x={100}
                      y={75}
                      radius={50}
                      angle={70}
                      rotation={200}
                      fill="#ef4444"
                    />
                  </>
                )}
              </Group>
            )}

            {/* Shape variant preview (from More Shapes panel) */}
            {hoverPosition &&
              tool === "shape" &&
              (() => {
                const variant = selectedShapeVariant;
                const { width: previewWidth, height: previewHeight } =
                  getDefaultShapeSize(variant);
                const fill =
                  shapeSettings.fillColor === "transparent"
                    ? "rgba(0,0,0,0.05)"
                    : shapeSettings.fillColor;
                const stroke = shapeSettings.strokeColor;
                const strokeWidth = shapeSettings.strokeWidth;

                // Simple shapes using Konva primitives
                if (variant === "rectangle" || variant === "flowProcess") {
                  return (
                    <Rect
                      x={hoverPosition.x}
                      y={hoverPosition.y}
                      width={previewWidth}
                      height={previewHeight}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      opacity={0.5}
                      cornerRadius={4}
                      listening={false}
                    />
                  );
                }

                if (variant === "roundedRect" || variant === "flowTerminal") {
                  return (
                    <Rect
                      x={hoverPosition.x}
                      y={hoverPosition.y}
                      width={previewWidth}
                      height={previewHeight}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      opacity={0.5}
                      cornerRadius={Math.min(previewWidth, previewHeight) / 2}
                      listening={false}
                    />
                  );
                }

                if (
                  variant === "circle" ||
                  variant === "flowOr" ||
                  variant === "flowSumming"
                ) {
                  return (
                    <KonvaCircle
                      x={hoverPosition.x + previewWidth / 2}
                      y={hoverPosition.y + previewHeight / 2}
                      radius={Math.min(previewWidth, previewHeight) / 2}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      opacity={0.5}
                      listening={false}
                    />
                  );
                }

                if (variant === "ellipse") {
                  return (
                    <KonvaEllipse
                      x={hoverPosition.x + previewWidth / 2}
                      y={hoverPosition.y + previewHeight / 2}
                      radiusX={previewWidth / 2}
                      radiusY={previewHeight / 2}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      opacity={0.5}
                      listening={false}
                    />
                  );
                }

                // All polygon-based shapes use getShapePath
                const points = getShapePath(
                  variant,
                  previewWidth,
                  previewHeight,
                );
                return (
                  <KonvaLine
                    x={hoverPosition.x}
                    y={hoverPosition.y}
                    points={points}
                    closed
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    opacity={0.5}
                    listening={false}
                  />
                );
              })()}

            {/* Arrow drawing preview */}
            {arrowDrawing &&
              (() => {
                // pathStyle에 따라 미리보기 경로 계산
                let previewPoints: number[];

                if (connectorPathStyle === "elbowed") {
                  // 엘보우 경로 — 커밋된 커넥터의 첫 렌더와 같은 인자를 쓴다.
                  // 앵커/도형 크기를 빼먹으면 그리는 동안과 놓은 직후의
                  // 경로가 달라져 선이 튄다.
                  const previewSource = arrowDrawing.sourceId
                    ? objects.find((o) => o.id === arrowDrawing.sourceId)
                    : undefined;
                  const previewTarget = arrowDrawing.targetId
                    ? objects.find((o) => o.id === arrowDrawing.targetId)
                    : undefined;
                  previewPoints = calculateElbowPath(
                    { x: arrowDrawing.startX, y: arrowDrawing.startY },
                    { x: arrowDrawing.endX, y: arrowDrawing.endY },
                    [],
                    arrowDrawing.sourceAnchor,
                    arrowDrawing.targetAnchor,
                    {
                      sourceSize: toElbowSize(previewSource),
                      targetSize: toElbowSize(previewTarget),
                    },
                  );
                } else if (connectorPathStyle === "curved") {
                  // 곡선: 베지어 곡선을 샘플링
                  const startX = arrowDrawing.startX;
                  const startY = arrowDrawing.startY;
                  const endX = arrowDrawing.endX;
                  const endY = arrowDrawing.endY;
                  const midX = (startX + endX) / 2;
                  const midY = (startY + endY) / 2;
                  const dx = endX - startX;
                  const dy = endY - startY;
                  const controlX = midX - dy * 0.2;
                  const controlY = midY + dx * 0.2;

                  previewPoints = [];
                  for (let i = 0; i <= 20; i++) {
                    const t = i / 20;
                    const mt = 1 - t;
                    const x =
                      mt * mt * startX + 2 * mt * t * controlX + t * t * endX;
                    const y =
                      mt * mt * startY + 2 * mt * t * controlY + t * t * endY;
                    previewPoints.push(x, y);
                  }
                } else {
                  // 직선
                  previewPoints = [
                    arrowDrawing.startX,
                    arrowDrawing.startY,
                    arrowDrawing.endX,
                    arrowDrawing.endY,
                  ];
                }

                return (
                  <Group listening={false}>
                    <Arrow
                      points={previewPoints}
                      stroke={shapeSettings.strokeColor}
                      strokeWidth={1.5}
                      fill={shapeSettings.strokeColor}
                      pointerLength={6}
                      pointerWidth={6}
                      opacity={0.7}
                    />
                    {/* Start point indicator */}
                    <KonvaCircle
                      x={arrowDrawing.startX}
                      y={arrowDrawing.startY}
                      radius={6 / viewport.zoom}
                      fill={arrowDrawing.sourceId ? "#22c55e" : "#3b82f6"}
                      stroke="white"
                      strokeWidth={1.5 / viewport.zoom}
                    />
                    {/* End point indicator */}
                    <KonvaCircle
                      x={arrowDrawing.endX}
                      y={arrowDrawing.endY}
                      radius={6 / viewport.zoom}
                      fill={arrowDrawing.targetId ? "#22c55e" : "#3b82f6"}
                      stroke="white"
                      strokeWidth={1.5 / viewport.zoom}
                    />
                  </Group>
                );
              })()}

            {/* Caption Markers */}
            {!hideCaptions &&
              captions.map((caption, index) => (
                <CaptionMarker
                  key={caption.id}
                  caption={caption}
                  index={index + 1}
                  zoom={viewport.zoom}
                  onClick={() =>
                    useCanvasStore.getState().setActiveCaptionId(caption.id)
                  }
                  onDragEnd={(id, x, y) =>
                    useCanvasStore.getState().updateCaption(id, { x, y })
                  }
                />
              ))}

            {/* Eraser cursor preview */}
            {eraserPosition && tool === "eraser" && (
              <KonvaCircle
                x={eraserPosition.x}
                y={eraserPosition.y}
                radius={getEraserRadius()}
                fill={
                  isErasing
                    ? "rgba(239, 68, 68, 0.2)"
                    : "rgba(156, 163, 175, 0.2)"
                }
                stroke={isErasing ? "#ef4444" : "#9ca3af"}
                strokeWidth={2 / viewport.zoom}
                dash={[4 / viewport.zoom, 4 / viewport.zoom]}
                listening={false}
              />
            )}
          </Layer>
        </Stage>
      </div>

      {/* Custom cursor overlay - 툴별 아이콘 커서 (ref로 직접 DOM 업데이트) */}
      <div
        ref={cursorRef}
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          pointerEvents: "none",
          zIndex: 9999,
          transform: "translate(-2px, -2px)",
          visibility: isCursorVisible && !isLocked ? "visible" : "hidden",
        }}
      >
        {tool === "select" && (
          <MousePointer2
            size={15}
            className="text-gray-800 drop-shadow-sm dark:text-gray-200"
          />
        )}
        {tool === "hand" && (
          <Hand
            size={18}
            className={`drop-shadow-sm ${isPanning ? "text-gray-600 dark:text-gray-400" : "text-gray-800 dark:text-gray-200"}`}
            style={{ transform: isPanning ? "rotate(-10deg)" : undefined }}
          />
        )}
        {tool === "pencil" && (
          <Pencil
            size={15}
            className="text-gray-800 drop-shadow-sm dark:text-gray-200"
            style={{ transform: "rotate(90deg) translate(6px, -6px)" }}
          />
        )}
        {tool === "connector" && (
          <MoveRight
            size={15}
            className="text-gray-800 drop-shadow-sm dark:text-gray-200"
          />
        )}
        {(tool === "rectangle" ||
          tool === "shape" ||
          tool === "stickyNote" ||
          tool === "textBox" ||
          tool === "table" ||
          tool === "chart" ||
          tool === "codeBlock" ||
          tool === "embed") && <SimpleCrosshair size={14} />}
        {/* eraser 커서는 Konva Circle로 이미 표시됨 */}
      </div>

      {/* TextViewerOverlay — only for objects with mixed inline styles (partial bold, multiple colors).
          Simple text is rendered by Konva Text inside TextBox/StickyNote components (no DOM cost). */}
      {overlayTextObjects
        .filter(({ obj }) => {
          // Only render HTML overlay for mixed-style text that Konva Text can't handle
          if (!obj.tiptapContent) return false;
          return hasMixedStyles(obj.tiptapContent);
        })
        .map(({ obj, actualIndex }) => (
          <TextViewerOverlay
            key={obj.id}
            shape={obj}
            viewport={viewport}
            zIndex={getCanvasOverlayZIndex(actualIndex)}
            isSelected={selectedIdsSet.has(obj.id)}
            isDragging={draggingIdsSet.has(obj.id)}
            isObscured={false}
          />
        ))}

      {/* CodeBlock Viewer Overlay - syntax highlighting for all codeBlocks */}
      {/* Pre-classified via overlayCodeBlocks useMemo */}
      {overlayCodeBlocks.map(({ obj, actualIndex }) => (
        <CodeBlockViewerOverlay
          key={`codeblock-view-${obj.id}`}
          shape={obj}
          viewport={viewport}
          zIndex={getCanvasOverlayZIndex(actualIndex)}
          isEditing={editingTextId === obj.id}
          isDragging={draggingIdsSet.has(obj.id)}
        />
      ))}

      {/* Embed Viewer Overlay - thumbnail/iframe for all embeds */}
      {/* Pre-classified via overlayEmbeds useMemo */}
      {overlayEmbeds.map(({ obj, actualIndex }) => (
        <EmbedViewerOverlay
          key={`embed-view-${obj.id}`}
          shape={obj}
          viewport={viewport}
          objectIndex={actualIndex}
          isDragging={draggingIdsSet.has(obj.id)}
          onPlay={() =>
            useCanvasStore.getState().updateObject(obj.id, { isPlaying: true })
          }
        />
      ))}

      {/* Tiptap Text Editor Overlay - 편집 중일 때만 표시 */}
      {editingTextId && <TextEditorOverlay />}

      {/* Table Cell Editor Overlay - 테이블 셀 편집 중일 때만 표시 */}
      {editingTableCell && <TableCellEditor />}

      {/* Table Add Buttons - 테이블이 선택되었을 때 행/열 추가 버튼 */}
      {selectedIds.length === 1 &&
        objects.find((o) => o.id === selectedIds[0] && o.type === "table") && (
          <TableAddButtons
            table={objects.find((o) => o.id === selectedIds[0])!}
            viewport={viewport}
            onContextMenu={(e) => handleHtmlContextMenu(e, selectedIds[0])}
          />
        )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          canvasPosition={{ x: contextMenu.canvasX, y: contextMenu.canvasY }}
          hasSelection={selectedIds.length > 0}
          clickedObjectId={contextMenu.clickedObjectId}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Embed URL Modal */}
      {embedModalPosition && (
        <EmbedUrlModal
          onSubmit={(url) => {
            const parsed = parseEmbedUrl(url);
            if (parsed && embedModalPosition) {
              const embed = createEmbed(
                embedModalPosition.x,
                embedModalPosition.y,
                parsed.url,
                parsed.type,
                parsed.metadata,
              );
              useCanvasStore.getState().addObject(embed);
              useCanvasStore.getState().setSelectedIds([embed.id]);
              useCanvasStore.getState().setTool("select");
            }
            setEmbedModalPosition(null);
          }}
          onClose={() => {
            setEmbedModalPosition(null);
            useCanvasStore.getState().setTool("select");
          }}
        />
      )}
    </>
  );
}
