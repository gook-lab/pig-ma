import { nanoid } from "nanoid";
import type {
  CanvasObject,
  PenSettings,
  ShapeSettings,
  ShapeVariant,
  PathStyle,
  ElbowCornerStyle,
  MarkerStyle,
  TableData,
  ChartVariant,
  EmbedType,
  EmbedMetadata,
} from "@/types";
import { createDefaultTableData, getTableWidth, getTableHeight } from "./table";
import { CHART_COLORS } from "@/constants/colors";
import { cloneTableData } from "./table";

// Author info for factory functions
export interface AuthorInfo {
  authorId?: string;
  authorName?: string;
}

/**
 * Rectangle 생성
 * @deprecated createShape(x, y, "rectangle", settings)를 대신 사용하세요.
 * rectangle은 shape + shapeVariant: "rectangle"로 통합 예정
 */
export function createRectangle(
  x: number,
  y: number,
  settings: ShapeSettings,
  author?: AuthorInfo,
): CanvasObject {
  // Delegate to createShape with "rectangle" variant
  return createShape(x, y, "rectangle", settings, author);
}

/**
 * Circle 생성 — createShape(x, y, "circle", settings) 편의 래퍼.
 * createRectangle 과 대칭으로 제공한다.
 */
export function createCircle(
  x: number,
  y: number,
  settings: ShapeSettings,
  author?: AuthorInfo,
): CanvasObject {
  return createShape(x, y, "circle", settings, author);
}

export function createImage(
  x: number,
  y: number,
  src: string,
  width: number,
  height: number,
): CanvasObject {
  return {
    id: nanoid(),
    type: "image",
    x,
    y,
    width,
    height,
    src,
    rotation: 0,
    opacity: 1,
  };
}

export function createLine(
  x: number,
  y: number,
  points: number[],
  settings: PenSettings,
): CanvasObject {
  // Determine opacity based on pen type
  let opacity = 1;
  if (settings.penType === "marker") opacity = 0.7;
  if (settings.penType === "highlighter") opacity = 0.4;

  // Determine stroke width based on pen type
  let strokeWidth = settings.strokeWidth;
  if (settings.penType === "marker") strokeWidth = settings.strokeWidth * 2;
  if (settings.penType === "highlighter")
    strokeWidth = settings.strokeWidth * 4;

  return {
    id: nanoid(),
    type: "line",
    x,
    y,
    points,
    penType: settings.penType,
    stroke: settings.strokeColor,
    strokeWidth,
    rotation: 0,
    opacity,
  };
}

const STICKY_COLORS = [
  "#fef08a",
  "#fecaca",
  "#bbf7d0",
  "#bfdbfe",
  "#e9d5ff",
  "#fed7aa",
];

// Grid snap unit for connectors (same as canvas grid)
export const GRID_SIZE = 10;

// Grid snap unit for shapes (1px for precise alignment with guides)
export const SHAPE_GRID_SIZE = 1;

// Snap value to connector grid (10px)
export function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

// Snap value to shape grid (5px)
export function snapToShapeGrid(value: number): number {
  return Math.round(value / SHAPE_GRID_SIZE) * SHAPE_GRID_SIZE;
}

// Create standalone arrow (can optionally attach to shapes)
export function createArrow(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  options?: {
    sourceId?: string;
    targetId?: string;
    sourceAnchor?: "top" | "right" | "bottom" | "left" | "center";
    targetAnchor?: "top" | "right" | "bottom" | "left" | "center";
    sourceOffsetX?: number;
    sourceOffsetY?: number;
    targetOffsetX?: number;
    targetOffsetY?: number;
    // 도형 크기 대비 연결점 비율 — 리사이즈해도 가장자리에 붙어 있게 한다
    sourceOffsetRatioX?: number;
    sourceOffsetRatioY?: number;
    targetOffsetRatioX?: number;
    targetOffsetRatioY?: number;
    stroke?: string;
    strokeWidth?: number;
    pathStyle?: PathStyle;
    elbowCornerStyle?: ElbowCornerStyle;
    endMarker?: MarkerStyle;
  },
): CanvasObject {
  return {
    id: nanoid(),
    type: "connector",
    x: snapToGrid(startX),
    y: snapToGrid(startY),
    endX: snapToGrid(endX),
    endY: snapToGrid(endY),
    sourceId: options?.sourceId,
    targetId: options?.targetId,
    sourceAnchor: options?.sourceAnchor,
    targetAnchor: options?.targetAnchor,
    sourceOffsetX: options?.sourceOffsetX,
    sourceOffsetY: options?.sourceOffsetY,
    targetOffsetX: options?.targetOffsetX,
    targetOffsetY: options?.targetOffsetY,
    sourceOffsetRatioX: options?.sourceOffsetRatioX,
    sourceOffsetRatioY: options?.sourceOffsetRatioY,
    targetOffsetRatioX: options?.targetOffsetRatioX,
    targetOffsetRatioY: options?.targetOffsetRatioY,
    stroke: options?.stroke ?? "#374151",
    strokeWidth: options?.strokeWidth ?? 2,
    pathStyle: options?.pathStyle ?? "straight",
    elbowCornerStyle: options?.elbowCornerStyle ?? "sharp",
    endMarker: options?.endMarker ?? "arrow",
    rotation: 0,
    opacity: 1,
  };
}

// Legacy function for backward compatibility
export function createConnector(
  sourceId: string,
  targetId: string,
  sourceAnchor: "top" | "right" | "bottom" | "left" | "center",
  targetAnchor: "top" | "right" | "bottom" | "left" | "center",
): CanvasObject {
  return {
    id: nanoid(),
    type: "connector",
    x: 0,
    y: 0,
    endX: 0,
    endY: 0,
    sourceId,
    targetId,
    sourceAnchor,
    targetAnchor,
    stroke: "#374151",
    strokeWidth: 2,
    rotation: 0,
    opacity: 1,
  };
}

export function createStickyNote(
  x: number,
  y: number,
  backgroundColor?: string,
  author?: AuthorInfo,
): CanvasObject {
  return {
    id: nanoid(),
    type: "stickyNote",
    x,
    y,
    width: 150,
    height: 150,
    backgroundColor: backgroundColor ?? STICKY_COLORS[0], // yellow
    text: "",
    fontSize: 16,
    fontWeight: "normal",
    textDecoration: "none",
    fontFamily: "Pretendard",
    fontSizePreset: "S", // 'S' preset = 16px, matches fontSize
    textAlign: "left",
    listType: "none",
    indentLevel: 0,
    textColor: "#000000",
    rotation: 0,
    opacity: 1,
    authorId: author?.authorId,
    authorName: author?.authorName,
  };
}

export function createTextBox(
  x: number,
  y: number,
  author?: AuthorInfo,
): CanvasObject {
  // 초기 높이: fontSize(16) * LINE_HEIGHT(1.5) + padding(16) = 40
  // 자동 높이 조정과 일치시켜 불필요한 상태 변경 방지
  return {
    id: nanoid(),
    type: "textBox",
    x,
    y,
    width: 150,
    height: 40,
    text: "",
    textColor: "#000000",
    fontFamily: "Pretendard",
    fontSizePreset: "M",
    fontSize: 16,
    fontWeight: "normal",
    textDecoration: "none",
    textAlign: "left",
    listType: "none",
    indentLevel: 0,
    rotation: 0,
    opacity: 1,
    authorId: author?.authorId,
    authorName: author?.authorName,
  };
}

export function createCodeBlock(
  x: number,
  y: number,
  code?: string,
  language?: string,
  author?: AuthorInfo,
): CanvasObject {
  return {
    id: nanoid(),
    type: "codeBlock",
    x,
    y,
    width: 400,
    height: 200,
    code: code ?? "",
    codeLanguage: (language as import("@/types").CodeLanguage) ?? "javascript",
    backgroundColor: "#383838", // Dark theme
    textColor: "#d4d4d4",
    fontSize: 14,
    fontFamily: "IBM Plex Mono" as import("@/types").FontFamily,
    rotation: 0,
    opacity: 1,
    authorId: author?.authorId,
    authorName: author?.authorName,
  };
}

// 도형별 기본 크기 (가로 x 세로)
export function getDefaultShapeSize(variant: ShapeVariant): {
  width: number;
  height: number;
} {
  switch (variant) {
    // Flowchart shapes - 가로로 긴 형태
    case "flowProcess":
      return { width: 120, height: 60 };
    case "flowTerminal":
      return { width: 120, height: 50 };
    case "flowData":
      return { width: 120, height: 60 };
    case "flowDocument":
      return { width: 100, height: 80 };
    case "flowDatabase":
      return { width: 80, height: 100 };
    case "flowPredefined":
      return { width: 120, height: 60 };
    case "flowManualInput":
      return { width: 120, height: 60 };
    case "flowDecision":
      return { width: 80, height: 80 };
    case "flowOr":
      return { width: 60, height: 60 };
    case "flowSumming":
      return { width: 60, height: 60 };
    case "flowDelay":
      return { width: 80, height: 50 };
    case "flowPreparation":
      return { width: 120, height: 60 };

    // Basic shapes with specific ratios
    case "ellipse":
      return { width: 100, height: 60 };
    case "arrowRight":
    case "arrowLeft":
    case "chevronRight":
    case "chevronLeft":
      return { width: 100, height: 60 };
    case "arrowUp":
    case "arrowDown":
      return { width: 60, height: 100 };
    case "speechBubble":
      return { width: 120, height: 80 };

    // Rectangle (legacy type, now unified as shape variant)
    case "rectangle":
      return { width: 75, height: 60 };

    // Default square shapes
    default:
      return { width: 75, height: 75 };
  }
}

export function createShape(
  x: number,
  y: number,
  variant: ShapeVariant,
  settings: ShapeSettings,
  author?: AuthorInfo,
): CanvasObject {
  const { width, height } = getDefaultShapeSize(variant);

  return {
    id: nanoid(),
    type: "shape",
    x,
    y,
    width,
    height,
    shapeVariant: variant,
    fill: settings.fillColor,
    stroke: settings.strokeColor,
    strokeWidth: settings.strokeWidth,
    textAlign: "center",
    rotation: 0,
    opacity: 1,
    authorId: author?.authorId,
    authorName: author?.authorName,
  };
}

// Clone a shape with a new ID and offset position
export function cloneShape(
  obj: CanvasObject,
  offset: { x: number; y: number },
): CanvasObject {
  // 라벨 텍스트박스 참조는 물려주지 않는다 — 사본이 원본의 라벨을 가리키면
  // 사본을 고칠 때 원본이 바뀐다.
  const rest = { ...obj } as CanvasObject & { labelTextBoxId?: string };
  delete rest.labelTextBoxId;

  return {
    ...rest,
    id: nanoid(),
    x: obj.x + offset.x,
    y: obj.y + offset.y,
    // 테이블은 깊은 복사가 필요하다.
    //
    // 얕게 두면 사본과 원본이 같은 tableData 를 가리켜서 한쪽 셀을 고치면
    // 다른 쪽도 바뀐다. 앵커를 끌어 도형을 복제하는 흐름(Canvas.tsx)에서
    // 테이블도 복제 대상이 된다.
    ...(obj.type === "table" && obj.tableData
      ? { tableData: cloneTableData(obj.tableData) }
      : {}),
  };
}

// Create a ConnectorLabel (lightweight text label for connectors)
export function createConnectorLabel(
  connectorId: string,
  x: number,
  y: number,
  labelT: number = 0.5,
): CanvasObject {
  return {
    id: nanoid(),
    type: "connectorLabel",
    x, // 절대좌표 (생성 시 중앙 위치)
    y,
    text: "",
    fontSize: 12,
    fontFamily: "Pretendard",
    textColor: "#374151",
    fontWeight: "normal",
    textDecoration: "none",
    connectedConnectorId: connectorId,
    labelT,
    rotation: 0,
    opacity: 1,
  };
}

// Create a Table (2x2 default)
export function createTable(
  x: number,
  y: number,
  tableData?: TableData,
): CanvasObject {
  const data = tableData ?? createDefaultTableData();
  return {
    id: nanoid(),
    type: "table",
    x,
    y,
    width: getTableWidth(data),
    height: getTableHeight(data),
    tableData: data,
    rotation: 0,
    opacity: 1,
  };
}

// Create a Chart
export function createChart(
  x: number,
  y: number,
  variant: ChartVariant,
): CanvasObject {
  const baseItems = [
    { label: "A", value: 30, color: CHART_COLORS[0] },
    { label: "B", value: 50, color: CHART_COLORS[1] },
    { label: "C", value: 20, color: CHART_COLORS[2] },
  ];

  // Line chart: 멀티 시리즈 지원
  const series =
    variant === "line"
      ? [
          {
            id: nanoid(),
            name: "Series 1",
            values: [30, 50, 20],
            style: {
              color: CHART_COLORS[0],
              strokeWidth: 2,
              lineStyle: "solid" as const,
              fillEnabled: false,
              fillOpacity: 0.2,
            },
          },
        ]
      : undefined;

  return {
    id: nanoid(),
    type: "chart",
    x,
    y,
    width: 200,
    height: 150,
    chartData: {
      variant,
      items: baseItems,
      showLabels: true,
      innerRadius: variant === "pie" ? 0 : undefined,
      // Settings defaults
      textColor: "#374151",
      cornerRadius: 2,
      sortBy: "none",
      showAxis: variant === "line" || variant === "bar",
      showYAxis: variant === "line" || variant === "bar",
      showGridX: variant === "bar",
      showGridY: variant === "line" || variant === "bar",
      xAxisMargin: variant === "line" ? 16 : 0,
      curveType: variant === "line" ? "linear" : undefined,
      orientation: variant === "line" ? "horizontal" : undefined,
      // Multi-series (Line chart only)
      series,
      // Legend defaults
      showLegend: true,
      legendPosition: "bottom",
      legendAlign: "center",
    },
    rotation: 0,
    opacity: 1,
  };
}

/**
 * Embed 생성 (YouTube, Figma, Notion)
 */
export function createEmbed(
  x: number,
  y: number,
  url: string,
  embedType: EmbedType,
  metadata: EmbedMetadata,
  author?: AuthorInfo,
): CanvasObject {
  // YouTube는 16:9, Figma/Notion은 4:3 기본값
  let width: number;
  let height: number;

  switch (embedType) {
    case "youtube":
      width = 480;
      height = 270;
      break;
    case "figma":
      width = 400;
      height = 300;
      break;
    case "notion":
      width = 400;
      height = 320;
      break;
    default:
      width = 400;
      height = 300;
  }

  return {
    id: nanoid(),
    type: "embed",
    x: snapToShapeGrid(x),
    y: snapToShapeGrid(y),
    width,
    height,
    embedUrl: url,
    embedType,
    embedMetadata: metadata,
    isPlaying: false,
    rotation: 0,
    opacity: 1,
    authorId: author?.authorId,
    authorName: author?.authorName,
  };
}
