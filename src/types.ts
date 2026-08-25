export type ObjectType =
  | "image"
  | "line"
  | "stickyNote"
  | "connector"
  | "textBox"
  | "shape"
  | "connectorLabel"
  | "table"
  | "chart"
  | "codeBlock"
  | "embed";

export type Tool =
  | "select"
  | "hand"
  | "rectangle"
  | "image"
  | "pencil"
  | "eraser"
  | "stickyNote"
  | "connector"
  | "textBox"
  | "shape"
  | "table"
  | "chart"
  | "codeBlock"
  | "embed";

export type EraserSize = "small" | "medium" | "large";

// Grid type for canvas background
export type GridType = "dots" | "blank" | "lines";

// Shape variants for the unified 'shape' type
export type ShapeVariant =
  // Basic shapes
  | "rectangle"
  | "roundedRect"
  | "circle"
  | "ellipse"
  | "triangle"
  | "triangleDown"
  | "diamond"
  | "pentagon"
  | "hexagon"
  | "octagon"
  | "star"
  | "star4"
  | "cross"
  | "arrowRight"
  | "arrowLeft"
  | "arrowUp"
  | "arrowDown"
  | "chevronRight"
  | "chevronLeft"
  | "speechBubble"
  // Flowchart shapes
  | "flowProcess" // Rectangle
  | "flowDecision" // Diamond
  | "flowTerminal" // Rounded rectangle (start/end)
  | "flowData" // Parallelogram
  | "flowDocument" // Document shape
  | "flowDatabase" // Cylinder
  | "flowPredefined" // Rectangle with double vertical lines
  | "flowManualInput" // Trapezoid
  | "flowPreparation" // Hexagon
  | "flowDelay" // D shape
  | "flowOr" // Circle with cross
  | "flowSumming"; // Circle with X

// Text styles
// 토큰이지 CSS 패밀리명이 아니다 — 스택은 constants/fonts.ts 가 갖는다.
// 추가할 때 손댈 곳은 `.claude/rules/constants.md` 의 FONTS 절 참조.
export type FontFamily =
  | "System"
  | "Pretendard"
  | "Noto Sans KR"
  | "Nanum Gothic"
  | "Nanum Myeongjo"
  | "IBM Plex Sans KR"
  | "Handwriting";
export type FontSize = "S" | "M" | "L" | "XL" | "XXL";
export type TextAlign = "left" | "center" | "right";
export type ListType = "none" | "number" | "bullet";

// ============================================================================
// Table Types
// ============================================================================

/**
 * 테이블 셀 데이터
 * cells Record의 키는 "row-col" 형식 (예: "0-0", "1-2")
 */
export interface TableCell {
  id: string;
  content?: import("@tiptap/core").JSONContent; // Tiptap 리치 텍스트 콘텐츠
  backgroundColor?: string;
  textAlign?: TextAlign;
  verticalAlign?: "top" | "middle" | "bottom";
  measuredHeight?: number; // 셀 콘텐츠의 측정된 높이 (자동 행 높이 계산용)
}

/**
 * 테이블 데이터 구조
 * Record 기반 셀 저장으로 O(1) 조회 성능
 */
export interface TableData {
  cells: Record<string, TableCell>; // key: "row-col" (O(1) lookup)
  rowCount: number;
  colCount: number;
  colWidths: number[]; // 각 열의 너비 (px)
  rowHeights: number[]; // 각 행의 높이 (px)
  defaultColWidth: number; // 기본 열 너비 (기본값 120px)
  defaultRowHeight: number; // 기본 행 높이 (기본값 40px)
  borderColor: string; // 테두리 색상
  backgroundColor?: string; // 테이블 배경색
}

/**
 * 테이블 셀 편집 상태
 */
export interface TableEditingState {
  tableId: string;
  cellKey: string; // "row-col" 형식
  row: number;
  col: number;
}

/**
 * 테이블 셀 선택 상태 (드래그 선택)
 */
export interface TableCellSelection {
  tableId: string;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

/**
 * 테이블 행/열 드래그 상태 (재정렬)
 */
export interface TableDragState {
  tableId: string;
  type: "row" | "column";
  dragIndex: number;
  dragOverIndex: number;
}

// ============================================================================
// Chart Types
// ============================================================================

/**
 * 차트 종류
 */
export type ChartVariant = "bar" | "line" | "pie";

/**
 * 차트 정렬 옵션
 */
export type ChartSortBy =
  | "none"
  | "value-asc"
  | "value-desc"
  | "label-asc"
  | "label-desc";

/**
 * 차트 데이터 항목
 */
export type CornerPosition = "all" | "top" | "bottom";

export interface ChartDataItem {
  label: string;
  value: number;
  color: string; // 배경(바) 색상
  colorOverride?: boolean; // 개별 색상 사용 (globalColor 무시)
  labelColor?: string; // 라벨 텍스트 색상 (기본: #374151)
  valueColor?: string; // 값 텍스트 색상 (기본: #374151)
  showLabel?: boolean; // 개별 라벨 표시 (기본: true)
  showValue?: boolean; // 개별 값 표시 (기본: true)
  labelFontSize?: number; // 라벨 폰트 크기 (기본: 10, 범위: 2-16)
  valueFontSize?: number; // 값 폰트 크기 (기본: 10, 범위: 2-16)
  labelBold?: boolean; // 라벨 볼드 (기본: false)
  valueBold?: boolean; // 값 볼드 (기본: false)
  valueOffsetY?: number; // 값 Y 오프셋 (-80 ~ 80, 기본: 0)
  fontSize?: number; // @deprecated - 하위 호환용 (labelFontSize/valueFontSize 사용)
  cornerRadius?: number; // 바 모서리 반경 (기본: 2, bar chart only)
  cornerPosition?: CornerPosition; // 모서리 적용 위치 (기본: "top", bar chart only)
}

/**
 * 라인 차트 시리즈 라인 스타일
 */
export type ChartLineStyle = "solid" | "dashed" | "dotted";

/**
 * 시리즈 개별 스타일 (멀티 라인 차트)
 */
export interface LineSeriesStyle {
  color: string; // 라인 색상
  colorOverride?: boolean; // 개별 색상 사용 (globalColor 무시)
  strokeWidth?: number; // 두께 (기본: 2)
  lineStyle?: ChartLineStyle; // solid/dashed/dotted (기본: solid)
  fillEnabled?: boolean; // 영역 채우기 (기본: false)
  fillOpacity?: number; // 채우기 투명도 (기본: 0.2)
}

/**
 * 차트 시리즈 데이터 (멀티 라인 차트)
 */
export interface ChartSeries {
  id: string; // nanoid
  name: string; // 시리즈 이름
  values: (number | null)[]; // X축 포인트별 값 배열 (null = 숨김)
  style: LineSeriesStyle;
  pointColors?: string[]; // 포인트별 개별 색상 (없으면 style.color 사용)
  pointShowLabels?: boolean[]; // 포인트별 라벨 표시 (없으면 true)
  pointShowValues?: boolean[]; // 포인트별 값 표시 (없으면 true)
}

/**
 * 선택된 포인트 (시리즈 인덱스 + 포인트 인덱스)
 */
export interface SelectedPoint {
  seriesIndex: number;
  pointIndex: number;
}

/**
 * 차트 데이터 구조 (tableData 패턴)
 */
export interface ChartData {
  variant: ChartVariant;
  items: ChartDataItem[];
  showLabels: boolean;
  showValues?: boolean; // 값 표시 (기본: true)
  innerRadius?: number; // pie → donut (0이면 pie, >0이면 donut)
  pieStyle?: "default" | "donut" | "3d" | "rounded" | "gradient"; // 파이 차트 스타일

  // Settings
  textColor?: string; // 라벨 색상 (기본: #374151)
  globalColor?: string; // 전체 색상 (설정 시 모든 바/라인에 적용)
  cornerRadius?: number; // 바 모서리 (기본: 2)
  sortBy?: ChartSortBy; // 정렬

  // Line chart 전용
  showAxis?: boolean; // X축 표시 (기본: true)
  showYAxis?: boolean; // Y축 표시 (기본: true)
  showGridX?: boolean; // X축 그리드 (기본: true)
  showGridY?: boolean; // Y축 그리드 (기본: true)
  showGrid?: boolean; // 레거시 호환용 (deprecated)
  curveType?: "linear" | "curved"; // 라인 타입 (기본: linear)
  orientation?: "horizontal" | "vertical"; // 차트 방향 (기본: horizontal)

  // Multi-series (Line chart only)
  series?: ChartSeries[]; // 시리즈 배열 (없으면 items[].value를 단일 시리즈로 사용)
  selectedSeriesIndex?: number; // 선택된 시리즈
  selectedPoint?: SelectedPoint; // 선택된 포인트 (시리즈 + 포인트 인덱스)
  xAxisMargin?: number; // X축 시작 마진 (기본: 0)
  yAxisMargin?: number; // Y축 시작 마진 (기본: 0)

  // Selection
  selectedItemIndex?: number; // 선택된 항목 인덱스

  // Legend
  showLegend?: boolean; // 범례 표시 (기본: true)
  selectedLegendIndex?: number; // 선택된 범례 인덱스
  legendPosition?: "top" | "bottom" | "left" | "right"; // 범례 위치 (기본: bottom)
  legendAlign?: "start" | "center" | "end"; // 범례 정렬 (기본: start)

  // Text styling
  labelBold?: boolean; // 라벨 볼드 (기본: false)
  valueBold?: boolean; // 값 볼드 (기본: false)
  labelColor?: string; // 라벨 색상 (기본: #374151)
  valueColor?: string; // 값 색상 (기본: #374151)

  // Value position (Bar/Line only, not Pie)
  valueOffsetY?: number; // 값 Y 오프셋 (-80 ~ 80, 기본: 0)
  valuePosition?: "top" | "center"; // Bar only: 값 위치 (기본: top)
}

// Content version for Tiptap migration
export type ContentVersion = 1 | 2; // 1 = TextSegment[], 2 = Tiptap JSONContent

// Tiptap JSON content type (re-exported from @tiptap/core)
export type { JSONContent } from "@tiptap/core";

// Rich text segment (inline formatting unit)
/** @deprecated Use tiptapContent with JSONContent instead */
export interface TextSegment {
  text: string;
  fontWeight?: "normal" | "bold";
  textDecoration?: "none" | "line-through";
  fontSize?: number;
  textColor?: string;
  link?: string;
}

export type PenType = "marker" | "pen" | "highlighter";

// Connector styles
export type MarkerStyle =
  | "none"
  | "arrow"
  | "filledArrow"
  | "diamond"
  | "circle";
export type LineStyle = "solid" | "dashed" | "dotted";
export type PathStyle = "straight" | "curved" | "elbowed";
export type ElbowCornerStyle = "sharp" | "rounded";

// 연속 계단 단계 (중첩 계단 지원)
export interface StaircaseStep {
  y: number; // 이 레벨의 Y 좌표 (시작점에서의 offset)
  midX?: number; // 이 레벨의 중간 수직선 X 좌표
}

// Elbow connector bend point (ㄷ자 꺾임 상태)
// FigJam 스타일: 절대 좌표로 저장하여 Shape 이동 시 엘보우 위치 고정
// 계단식 꺾임: leftY/rightY로 좌우 수평선의 Y 위치를 개별 제어
// 연속 계단: leftYSteps/rightYSteps 배열로 여러 레벨 지원
export interface ElbowBend {
  segmentIndex: number; // 어떤 세그먼트에 bend가 있는지 (레거시, 주로 0 사용)
  offset: number; // Y 방향 offset (초기 생성 시 사용, 이후 elbowY로 대체)
  // 절대 좌표 (FigJam 스타일 - Shape 이동 시 고정)
  elbowY?: number; // 중앙 엘보우 수평선의 절대 Y 좌표
  leftCornerX?: number; // 좌측 코너의 절대 X 좌표
  rightCornerX?: number; // 우측 코너의 절대 X 좌표
  // 계단식 꺾임 (FigJam 스타일) - 좌우 수평선의 개별 Y 좌표
  leftY?: number; // 좌측 수평선의 Y 좌표 (없으면 startY 사용)
  rightY?: number; // 우측 수평선의 Y 좌표 (없으면 endY 사용)
  // 계단식 꺾임 - 중간 수직선의 X 좌표 (버그 3 수정: 개별 수직선 조절용)
  midLeftX?: number; // 좌측 계단의 중간 수직선 X 좌표
  midRightX?: number; // 우측 계단의 중간 수직선 X 좌표
  // 연속 계단 지원 (중첩 계단) - startY 세그먼트 드래그 시 새 레벨 추가
  leftYSteps?: StaircaseStep[]; // 좌측 추가 계단 레벨들 (leftY 이후)
  rightYSteps?: StaircaseStep[]; // 우측 추가 계단 레벨들 (rightY 이후)
  // 비율 기반 (레거시, 절대 좌표가 없을 때 fallback)
  leftCornerRatio?: number; // 좌측 코너 X 위치 비율 (0-1, 기본 0.25)
  rightCornerRatio?: number; // 우측 코너 X 위치 비율 (0-1, 기본 0.75)
  // 다중 엘보우 지원
  bendId?: string; // 고유 ID (여러 bend 구분용)
  parentBendId?: string; // 부모 bend ID (중첩 시)
  // FigJam 스타일 영역 기반 bend (좌측/우측 수평 영역) - deprecated, leftY/rightY 사용
  region?: "primary" | "left" | "right";
}

// Flat structure - optional fields instead of inheritance
export interface CanvasObject {
  id: string;
  type: ObjectType;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  // Shape-specific (optional)
  width?: number;
  height?: number;
  radius?: number; // for circular shapes in shape variants
  fill?: string;
  fillMode?: "fill" | "transparent" | "nofill"; // fill mode for shapes
  stroke?: string;
  strokeWidth?: number;
  shapeVariant?: ShapeVariant; // for 'shape' type - specifies the visual shape
  // Image-specific
  src?: string; // image
  crop?: { x: number; y: number; width: number; height: number }; // image crop region (in original image pixels)
  // Line-specific
  points?: number[];
  penType?: PenType;
  // StickyNote & TextBox specific
  text?: string;
  backgroundColor?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  textDecoration?: "none" | "line-through";
  // TextBox specific
  fontFamily?: FontFamily;
  fontSizePreset?: FontSize;
  textAlign?: TextAlign;
  listType?: ListType;
  indentLevel?: number;
  link?: string;
  textColor?: string;
  // Rich text fields
  /** @deprecated Use tiptapContent instead. Read-only after migration. */
  richText?: TextSegment[]; // Rich text segments (takes precedence over text)
  /** @deprecated Use tiptapContent instead */
  lineIndents?: number[]; // Indent level per line (index = line number)
  // Tiptap content (primary, takes precedence over richText and text)
  tiptapContent?: import("@tiptap/core").JSONContent;
  // Content version for migration tracking (1 = TextSegment[], 2 = Tiptap JSONContent)
  _contentVersion?: ContentVersion;
  // Author info
  authorId?: string;
  authorName?: string;
  // Connector/Arrow-specific
  endX?: number; // end point (x, y is start point)
  endY?: number;
  sourceId?: string; // optional - set when snapped to a shape
  targetId?: string; // optional - set when snapped to a shape
  sourceAnchor?: "top" | "right" | "bottom" | "left" | "center";
  targetAnchor?: "top" | "right" | "bottom" | "left" | "center";
  sourceAngle?: number; // for circle: exact angle in radians
  targetAngle?: number; // for circle: exact angle in radians
  // 도형 기준 상대적 offset (도형 이동 시 위치 유지용).
  // ⚠️ 절대 픽셀이라 도형을 리사이즈하면 연결점이 어긋난다 — 아래 ratio 를 쓴다.
  sourceOffsetX?: number;
  sourceOffsetY?: number;
  targetOffsetX?: number;
  targetOffsetY?: number;
  // 도형 크기 대비 연결점 비율 (0~1). 리사이즈해도 가장자리에 붙어 있다.
  // 없으면 위 절대 offset 으로 폴백한다(예전 데이터 호환).
  sourceOffsetRatioX?: number;
  sourceOffsetRatioY?: number;
  targetOffsetRatioX?: number;
  targetOffsetRatioY?: number;
  // Connector style options
  startMarker?: MarkerStyle;
  endMarker?: MarkerStyle;
  lineStyle?: LineStyle;
  pathStyle?: PathStyle;
  label?: string; // text label on the connector
  labelT?: number; // position on path (0~1, 0=start, 1=end, default 0.5)
  labelOffsetY?: number; // Y-axis offset from path (default 0)
  // Elbow connector advanced options
  elbowBends?: ElbowBend[]; // 세그먼트별 꺾임점
  elbowCornerStyle?: ElbowCornerStyle; // 모서리 스타일 (sharp/rounded)
  elbowCornerRadius?: number; // rounded일 때 반지름 (기본 8px)
  // Lock state
  locked?: boolean; // locked objects cannot be moved/edited
  // Connector-TextBox relationship
  labelTextBoxId?: string; // 연결된 TextBox ID (커넥터 → 텍스트박스)
  connectedConnectorId?: string; // 연결된 커넥터 ID (텍스트박스 → 커넥터)
  // Group membership
  groupId?: string; // 그룹에 속한 경우 그룹 ID
  // Z-Index for layering (negative = behind group backgrounds)
  zIndex?: number; // 음수면 섹션 배경 뒤에 렌더링
  // Text expansion state (for shape text overflow)
  isTextExpanded?: boolean; // 텍스트 확장 상태 (true면 전체 텍스트 표시, 도형 크기 조정)
  // Table-specific
  tableData?: TableData; // 테이블 데이터 (type === 'table'일 때 사용)
  // Chart-specific
  chartData?: ChartData; // 차트 데이터 (type === 'chart'일 때 사용)
  chartShowHeader?: boolean; // 차트 헤더 표시 여부 (default: true)
  chartTitle?: string; // 차트 제목 (헤더에 표시)
  // CodeBlock-specific
  code?: string; // 코드 내용
  codeLanguage?: CodeLanguage; // 프로그래밍 언어
  codeTitle?: string; // 코드 블록 타이틀 (헤더 영역)
  codeTheme?: CodeTheme; // 코드 블록 테마 (dark/light)
  // Embed-specific
  embedUrl?: string; // 원본 URL
  embedType?: EmbedType; // youtube | figma
  embedMetadata?: EmbedMetadata; // 메타데이터 (썸네일, 제목 등)
  isPlaying?: boolean; // iframe 활성화 여부
  // Reactions (voting)
  reactions?: ObjectReaction[]; // 이모지 리액션 목록
}

// ============================================================================
// Embed Types
// ============================================================================

/** 지원하는 임베드 서비스 타입 */
export type EmbedType = "youtube" | "figma" | "notion";

/** Figma 파일 타입 */
export type FigmaType = "design" | "board" | "proto";

/** 임베드 메타데이터 */
export interface EmbedMetadata {
  title?: string;
  thumbnailUrl?: string;
  // YouTube
  videoId?: string;
  startTime?: number; // 초 단위 (타임스탬프)
  // Figma
  fileKey?: string;
  fileName?: string;
  nodeId?: string; // 특정 프레임 ID
  figmaType?: FigmaType;
  // Notion
  pageId?: string;
  pageName?: string;
}

// ============================================================================
// CodeBlock Types
// ============================================================================

/** 지원하는 프로그래밍 언어 */
export type CodeLanguage =
  | "javascript"
  | "typescript"
  | "python"
  | "java"
  | "go"
  | "rust"
  | "c"
  | "cpp"
  | "csharp"
  | "ruby"
  | "php"
  | "swift"
  | "kotlin"
  | "html"
  | "css"
  | "json"
  | "yaml"
  | "markdown"
  | "sql"
  | "bash"
  | "plaintext";

export const CODE_LANGUAGES: { value: CodeLanguage; label: string }[] = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "ruby", label: "Ruby" },
  { value: "php", label: "PHP" },
  { value: "swift", label: "Swift" },
  { value: "kotlin", label: "Kotlin" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "markdown", label: "Markdown" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash" },
  { value: "plaintext", label: "Plain Text" },
];

/** 코드 블록 테마 */
export type CodeTheme = "dark" | "light";

/** 코드 테마 설정 */
export const CODE_THEMES: {
  value: CodeTheme;
  label: string;
  backgroundColor: string;
  textColor: string;
}[] = [
  {
    value: "dark",
    label: "Dark",
    backgroundColor: "#383838",
    textColor: "#d4d4d4",
  },
  {
    value: "light",
    label: "Light",
    backgroundColor: "#ffffff",
    textColor: "#1e1e1e",
  },
];

// ============================================================================
// Reaction Types (Voting)
// ============================================================================

/** 기본 리액션 이모지 세트 */
export const REACTION_EMOJIS = ["👍", "👎", "❤️", "🎉", "🤔", "👀"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/** 개별 리액션 (누가 어떤 이모지를 달았는지) */
export interface ObjectReaction {
  emoji: ReactionEmoji;
  userId: string;
  userName?: string;
  createdAt: number; // timestamp
}

export interface PenSettings {
  penType: PenType;
  strokeColor: string;
  strokeWidth: number;
}

export interface ShapeSettings {
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
}

export interface CanvasBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface CanvasState {
  // Objects
  objects: CanvasObject[];
  selectedIds: string[];
  tool: Tool;
  // Viewport (merged, not separate store)
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
  // Canvas bounds (dynamic, expands when objects are created near edges)
  canvasBounds: CanvasBounds;
}

// Keyboard shortcuts
export type ShortcutAction =
  | "select"
  | "hand"
  | "shape"
  | "pencil"
  | "eraser"
  | "stickyNote"
  | "connector"
  | "textBox"
  | "chart"
  | "delete"
  | "undo"
  | "redo";

export interface KeyBinding {
  key: string;
  modifiers?: ("ctrl" | "shift" | "alt" | "meta")[];
}

export interface ShortcutConfig {
  action: ShortcutAction;
  label: string;
  binding: KeyBinding;
}

// ============================================================================
// Caption/Comment System Types
// ============================================================================

export interface CommentAttachment {
  id: string;
  type: "image";
  url: string; // base64
  name: string;
}

export interface CommentMessage {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  attachments?: CommentAttachment[];
}

export interface CaptionThread {
  id: string;
  x: number; // 캔버스 좌표
  y: number;
  messages: CommentMessage[];
  isResolved: boolean;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  avatarColor?: string;
}

export interface CaptionFilter {
  showResolved: boolean;
  onlyMyThreads: boolean;
  sortBy: "date" | "unread";
  authorSearch: string;
}

// ============================================================================
// Group System Types
// ============================================================================

export interface GroupInfo {
  id: string;
  name: string; // 섹션명
  fill?: string; // 그룹 배경색
  stroke?: string; // 테두리 색상
  strokeWidth?: number;
  lineStyle?: "solid" | "dashed" | "dotted";
  hidden?: boolean; // 스켈레톤 표시 여부
  locked?: boolean; // 그룹 잠금
  tagColor?: string; // 섹션 태그 배경색
  // 커스텀 바운드 (설정되면 자동 계산 대신 사용)
  customBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// ============================================================================
// Alignment Guide Types (드래그 정렬 가이드)
// ============================================================================

export interface AlignmentGuide {
  type: "horizontal" | "vertical";
  position: number; // y 좌표 (horizontal) 또는 x 좌표 (vertical)
  start: number; // 가이드 라인 시작점
  end: number; // 가이드 라인 끝점
}

// ============================================================================
// Page System Types
// ============================================================================

export interface PageData {
  id: string;
  name: string;
  objects: CanvasObject[];
  groups: GroupInfo[];
  captions: CaptionThread[];
  viewport: { x: number; y: number; zoom: number };
  canvasBounds: CanvasBounds;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Template System Types
// ============================================================================

export type TemplateCategory =
  | "flowchart"
  | "wireframe"
  | "orgChart"
  | "mindMap"
  | "kanban"
  | "timeline"
  | "brainstorm"
  | "retro"
  | "todo"
  | "custom";

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  thumbnail?: string;
  objects: CanvasObject[];
  groups?: GroupInfo[];
  tags?: string[];
}

export interface TemplateCategoryInfo {
  id: TemplateCategory;
  label: string;
  icon?: string;
}

// ============================================================================
// Store Types (Zustand)
// ============================================================================

// Tiptap Editor 타입 (store에서 사용)
export type { Editor } from "@tiptap/core";

/**
 * 텍스트 편집 커서 상태 (Konva 커서 렌더링용)
 */
export interface EditingCursorState {
  value: string;
  cursorIndex: number;
  selectionStart: number | null;
  selectionEnd: number | null;
  isFocused: boolean;
  richText: TextSegment[];
}

/**
 * 캔버스 스토어 상태 (CanvasState 확장)
 */
export interface CanvasStoreState extends CanvasState {
  // Pen/Shape settings
  penSettings: PenSettings;
  shapeSettings: ShapeSettings;

  // Text editing
  editingTextId: string | null;
  editingChartTitleId: string | null;
  pendingTextInput: string | null;
  editingCursor: EditingCursorState | null;
  activeEditor: import("@tiptap/core").Editor | null;
  isFileDialogOpen: boolean;
  stageRef: React.RefObject<import("konva").default.Stage | null> | null;

  // Shapes Panel
  showShapesPanel: boolean;
  selectedShapeVariant: ShapeVariant;
  recentShapes: ShapeVariant[];
  favoriteShapes: ShapeVariant[];

  // Chart
  selectedChartVariant: ChartVariant;

  // Lock Mode
  isLocked: boolean;

  // Drag state
  draggingIds: string[];
  /** @deprecated Use draggingIds.length > 0 instead */
  isDragging: boolean;

  // Eraser
  eraserSize: EraserSize;

  // Connector/StickyNote presets
  connectorPathStyle: PathStyle;
  connectorElbowCornerStyle: ElbowCornerStyle;
  connectorDefaultEndMarker: MarkerStyle;
  stickyNoteColor: string;

  // Caption System
  captions: CaptionThread[];
  currentUser: User;
  isCaptionPanelOpen: boolean;
  activeCaptionId: string | null;
  captionFilter: CaptionFilter;

  // Clipboard
  clipboard: CanvasObject[];
  clipboardGroups: GroupInfo[];
  hideCaptions: boolean;
  hideUI: boolean;

  // Theme
  theme: "light" | "dark";

  // Grid Settings
  gridType: GridType;
  gridColor: string;

  // Group System
  groups: GroupInfo[];

  // Page System
  projectId: string;
  projectName: string;
  pages: PageData[];
  currentPageId: string;

  // Template System
  showTemplatesPanel: boolean;
  favoriteTemplates: string[];
  recentTemplates: string[];
  customTemplates: TemplateDefinition[];

  // Table editing
  editingTableCell: TableEditingState | null;
  // Table cell selection (drag selection)
  selectedTableCells: TableCellSelection | null;
  // Table row/column drag state (reordering)
  tableDragState: TableDragState | null;
}

/**
 * 캔버스 스토어 액션
 */
export interface CanvasStoreActions {
  // Objects
  addObject: (object: CanvasObject) => void;
  updateObject: (id: string, updates: Partial<CanvasObject>) => void;
  deleteSelected: () => void;
  deleteObjects: (ids: string[]) => void;
  clearAllObjects: () => void;
  /** 여러 객체의 잠금 상태를 한 번에 변경 (undo 한 단계) */
  setObjectsLocked: (ids: string[], locked: boolean) => void;
  eraseLinePartial: (deleteIds: string[], newLines: CanvasObject[]) => void;

  // Selection
  setSelectedIds: (ids: string[]) => void;
  addToSelection: (id: string) => void;
  clearSelection: () => void;

  // Tool
  setTool: (tool: Tool) => void;

  // Viewport
  setViewport: (viewport: Partial<CanvasState["viewport"]>) => void;
  resetViewport: () => void;

  // Pen/Shape settings
  setPenSettings: (settings: Partial<PenSettings>) => void;
  setShapeSettings: (settings: Partial<ShapeSettings>) => void;

  // Text editing
  setEditingTextId: (id: string | null) => void;
  setEditingChartTitleId: (id: string | null) => void;
  setPendingTextInput: (text: string | null) => void;
  setEditingCursor: (cursor: EditingCursorState | null) => void;
  setActiveEditor: (editor: import("@tiptap/core").Editor | null) => void;
  setFileDialogOpen: (open: boolean) => void;
  setStageRef: (
    ref: React.RefObject<import("konva").default.Stage | null>,
  ) => void;

  // Shapes Panel
  setShowShapesPanel: (show: boolean) => void;
  setSelectedShapeVariant: (variant: ShapeVariant) => void;
  addRecentShape: (variant: ShapeVariant) => void;
  toggleFavoriteShape: (variant: ShapeVariant) => void;

  // Chart
  setSelectedChartVariant: (variant: ChartVariant) => void;

  // Lock Mode
  setLocked: (locked: boolean) => void;
  toggleLock: () => void;

  // Drag state
  addDraggingIds: (ids: string[]) => void;
  removeDraggingIds: (ids: string[]) => void;
  clearDraggingIds: () => void;
  /** @deprecated Use addDraggingIds/removeDraggingIds instead */
  setDragging: (dragging: boolean) => void;

  // Eraser
  setEraserSize: (size: EraserSize) => void;

  // Connector/StickyNote presets
  setConnectorPathStyle: (style: PathStyle) => void;
  setConnectorElbowCornerStyle: (style: ElbowCornerStyle) => void;
  setConnectorDefaultEndMarker: (marker: MarkerStyle) => void;
  setStickyNoteColor: (color: string) => void;

  // Canvas bounds
  expandCanvasBounds: (obj: CanvasObject) => void;
  resetCanvasBounds: () => void;

  // Caption System
  addCaption: (
    x: number,
    y: number,
    content: string,
    attachments?: CommentAttachment[],
  ) => CaptionThread;
  addReply: (
    captionId: string,
    content: string,
    attachments?: CommentAttachment[],
  ) => void;
  deleteCaption: (captionId: string) => void;
  deleteMessage: (captionId: string, messageId: string) => void;
  resolveCaption: (captionId: string) => void;
  unresolveCaption: (captionId: string) => void;
  markAsRead: (captionId: string) => void;
  setActiveCaptionId: (id: string | null) => void;
  toggleCaptionPanel: () => void;
  setCaptionPanelOpen: (open: boolean) => void;
  setCaptionFilter: (filter: Partial<CaptionFilter>) => void;
  updateCaption: (captionId: string, updates: Partial<CaptionThread>) => void;

  // Clipboard / Context Menu
  copyObjects: () => void;
  pasteObjects: (x: number, y: number) => void;
  pasteAndReplace: (x: number, y: number) => void;
  bringToFront: () => void;
  sendToBack: () => void;
  lockObjects: () => void;
  unlockObjects: () => void;
  unlockAllObjects: () => void;
  toggleHideCaptions: () => void;
  toggleHideUI: () => void;

  // Theme
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;

  // Grid Settings
  setGridType: (type: GridType) => void;
  setGridColor: (color: string) => void;

  // Group System
  groupSelected: () => void;
  ungroupSelected: () => void;
  updateGroup: (groupId: string, updates: Partial<GroupInfo>) => void;
  deleteGroup: (groupId: string) => void;
  selectGroup: (groupId: string) => void;
  moveGroupObjects: (groupId: string, deltaX: number, deltaY: number) => void;
  scaleGroupObjects: (
    groupId: string,
    scaleX: number,
    scaleY: number,
    originX: number,
    originY: number,
  ) => void;

  // Page System
  createPage: (name?: string) => string;
  deletePage: (pageId: string) => void;
  renamePage: (pageId: string, name: string) => void;
  switchPage: (pageId: string) => void;
  renameProject: (name: string) => void;

  // Template System
  setShowTemplatesPanel: (show: boolean) => void;
  toggleFavoriteTemplate: (templateId: string) => void;
  addRecentTemplate: (templateId: string) => void;
  applyTemplate: (
    template: TemplateDefinition,
    position: { x: number; y: number },
  ) => void;
  saveGroupAsTemplate: (groupId: string, name?: string) => void;
  deleteCustomTemplate: (templateId: string) => void;

  // Table System
  setEditingTableCell: (state: TableEditingState | null) => void;
  updateTableCell: (
    tableId: string,
    cellKey: string,
    updates: Partial<TableCell>,
  ) => void;
  addTableRow: (tableId: string, afterIndex?: number) => void;
  addTableColumn: (tableId: string, afterIndex?: number) => void;
  deleteTableRow: (tableId: string, rowIndex: number) => void;
  deleteTableColumn: (tableId: string, colIndex: number) => void;
  reorderTableRow: (
    tableId: string,
    fromIndex: number,
    toIndex: number,
  ) => void;
  reorderTableColumn: (
    tableId: string,
    fromIndex: number,
    toIndex: number,
  ) => void;
  setSelectedTableCells: (selection: TableCellSelection | null) => void;
  clearSelectedTableCells: () => void;
  deleteSelectedTableCells: () => void;
  resizeTableRow: (tableId: string, rowIndex: number, height: number) => void;
  resizeTableColumn: (tableId: string, colIndex: number, width: number) => void;
  autoFitRowHeight: (
    tableId: string,
    rowIndex: number,
    cellKey: string,
    measuredHeight: number,
  ) => void;
  setTableDragState: (state: TableDragState | null) => void;
}

// ============================================================================
// AI Types
// ============================================================================

/**
 * AI가 감지한 shape의 의미/의도
 */
export type AIProvider = "gemini" | "claude";

export type AIIntentCategory =
  | "flowchart"
  | "org-chart"
  | "er-diagram"
  | "mind-map"
  | "sequence"
  | "form"
  | "layout"
  | "generic";

export interface ShapeIntent {
  objectIds: string[];
  category: AIIntentCategory;
  label: string;
  confidence: number;
  reasoning: string;
}

/**
 * AI 다이어그램 생성 요청에서 Claude가 반환하는 shape 정의
 */
export interface AIShapeDefinition {
  type: ObjectType;
  text?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  shapeVariant?: ShapeVariant;
  connections?: Array<{ targetIndex: number; label?: string }>;
}

export type AILayoutHint = "dag" | "grid" | "radial";

export interface AIGenerateResponse {
  shapes: AIShapeDefinition[];
  layout: AILayoutHint;
}

/**
 * AI 슬라이스 상태
 */
export interface AISliceState {
  aiProvider: AIProvider;
  aiApiKey: string | null;
  aiLoading: boolean;
  aiError: string | null;
  shapeIntents: Map<string, ShapeIntent>;
  aiUsageCount: number;
}

/**
 * AI 슬라이스 액션
 */
export interface AISliceActions {
  setAIProvider: (provider: AIProvider) => void;
  setAIApiKey: (key: string | null) => void;
  generateDiagram: (prompt: string) => Promise<void>;
  analyzeSelection: () => Promise<void>;
  clearAIError: () => void;
  clearShapeIntents: () => void;
}

/**
 * 전체 캔버스 스토어 타입 (상태 + 액션 + AI)
 */
export type CanvasStore = CanvasStoreState &
  CanvasStoreActions &
  AISliceState &
  AISliceActions;

// ============================================================================
// Migration Types (for Zustand persist)
// ============================================================================

/**
 * 마이그레이션 함수에서 사용되는 이전 버전 상태의 부분 타입
 * unknown 필드를 가진 Record로 정의하여 안전한 속성 접근 허용
 */
export type PersistedStateLegacy = Record<string, unknown> & {
  objects?: CanvasObject[];
  groups?: GroupInfo[];
  captions?: CaptionThread[];
  viewport?: { x: number; y: number; zoom: number };
  // Added in v3 migration
  pages?: PageData[];
  projectId?: string;
  projectName?: string;
  currentPageId?: string;
};
