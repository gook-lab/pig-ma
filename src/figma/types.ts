/**
 * Figma API types (subset of REST API response)
 * Based on: https://developers.figma.com/docs/rest-api/files/
 */

// ============================================================================
// Figma Node Types
// ============================================================================

export interface FigmaColor {
  r: number; // 0-1
  g: number; // 0-1
  b: number; // 0-1
  a: number; // 0-1
}

export interface FigmaPaint {
  type: "SOLID" | "GRADIENT_LINEAR" | "GRADIENT_RADIAL" | "IMAGE";
  color?: FigmaColor;
  opacity?: number;
}

export interface FigmaTextStyle {
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  textAlignHorizontal: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  textAutoResize?: "NONE" | "HEIGHT" | "WIDTH_AND_HEIGHT";
  textDecoration?: "NONE" | "STRIKETHROUGH" | "UNDERLINE";
  /** 리치텍스트 오버라이드 항목은 자체 fills(=글자색)를 가질 수 있다 */
  fills?: FigmaPaint[];
}

export interface FigmaBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type FigmaNodeType =
  | "DOCUMENT"
  | "CANVAS"
  | "FRAME"
  | "GROUP"
  | "RECTANGLE"
  | "ELLIPSE"
  | "TEXT"
  | "STICKY"
  | "SHAPE_WITH_TEXT"
  | "CONNECTOR"
  | "LINE"
  | "VECTOR"
  | "INSTANCE"
  | "COMPONENT"
  | "SECTION";

/** Subset of Figma node relevant for mapping */
export interface FigmaNode {
  id: string;
  name: string;
  type: FigmaNodeType;
  absoluteBoundingBox?: FigmaBoundingBox;
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  strokeWeight?: number;
  opacity?: number;
  rotation?: number;
  characters?: string;
  style?: Partial<FigmaTextStyle>;
  /** 문자별 스타일 오버라이드 id (0 = 기본 style). characters 와 같은 길이이거나 짧을 수 있다 */
  characterStyleOverrides?: number[];
  /** 오버라이드 id → 부분 스타일 */
  styleOverrideTable?: Record<string, Partial<FigmaTextStyle>>;
  children?: FigmaNode[];
  // Geometry paths (available when ?geometry=paths is passed)
  fillGeometry?: Array<{ path: string; windingRule: string }>;
  strokeGeometry?: Array<{ path: string; windingRule: string }>;
  // Sticky note specific
  authorVisible?: boolean;
}

// ============================================================================
// Figma REST API Response Types
// ============================================================================

export interface FigmaFileResponse {
  name: string;
  lastModified: string;
  version: string;
  document: FigmaNode; // root DOCUMENT node
}

// ============================================================================
// Pig-ma Shape Types (mapper input/output)
// ============================================================================

/** Subset of CanvasObject used by the mapper */
export interface PigmaShape {
  id: string;
  type: "shape" | "stickyNote" | "textBox" | "line" | "image" | "connector";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  fill?: string; // hex color, e.g. "#FEF08A"
  fillMode?: "fill" | "transparent" | "nofill";
  stroke?: string; // hex color
  strokeWidth?: number;
  opacity?: number;
  text?: string; // plain text (v0.1.0)
  /** 리치텍스트 (Figma characterStyleOverrides ↔ Tiptap 변환 결과) */
  tiptapContent?: import("@tiptap/core").JSONContent;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: "left" | "center" | "right";
  textColor?: string; // hex color for text
  fontWeight?: "normal" | "bold";
  shapeVariant?: "rectangle" | "roundedRect" | "circle" | "ellipse";
  backgroundColor?: string; // sticky note background
  // Line/drawing specific
  points?: number[]; // flat array [x1,y1, x2,y2, ...]
  penType?: "pen" | "marker" | "highlighter";
  // Image specific
  src?: string; // image URL
  imageRef?: string; // Figma imageRef (resolved to src via fetchImageUrls)
  /** Figma imageTransform — 2x3 affine matrix [[a,b,tx],[c,d,ty]] */
  imageTransform?: number[][];
  // Connector specific
  endX?: number;
  endY?: number;
  startMarker?: string;
  endMarker?: string;
  sourceId?: string; // connected shape ID (start)
  targetId?: string; // connected shape ID (end)
  pathStyle?: "straight" | "elbowed" | "curved";
}

// ============================================================================
// Error Types
// ============================================================================

export class FigmaAuthError extends Error {
  constructor(message = "Invalid or expired Figma access token") {
    super(message);
    this.name = "FigmaAuthError";
  }
}

export class FigmaNotFoundError extends Error {
  constructor(fileKey: string) {
    super(`Figma file not found: ${fileKey}`);
    this.name = "FigmaNotFoundError";
  }
}

export class FigmaRateLimitError extends Error {
  constructor() {
    super("Figma API rate limit exceeded. Try again later.");
    this.name = "FigmaRateLimitError";
  }
}
