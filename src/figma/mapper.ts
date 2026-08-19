/**
 * Figma ↔ Pig-ma shape mapper
 *
 * Pure functions for converting between pig-ma CanvasObjects and Figma nodes.
 * v0.1.0: Rectangle, Ellipse, Text, Sticky note
 */

import { nanoid } from "nanoid";
import type { JSONContent } from "@tiptap/core";
import type {
  FigmaColor,
  FigmaNode,
  FigmaPaint,
  FigmaTextStyle,
  PigmaShape,
} from "./types";
import type { TextSegment } from "@/types";
import { measureTextWidth } from "@/utils/richText";
import {
  textSegmentsToTiptap,
  tiptapToStyledSegments,
} from "@/utils/tiptapMigration";

/** Result of importing a Figma document: shapes + groups */
export interface FigmaImportResult {
  shapes: PigmaShape[];
  groups: Array<{
    id: string;
    name: string;
    fill?: string;
    stroke?: string;
    memberIds: string[];
    customBounds?: { x: number; y: number; width: number; height: number };
  }>;
}

// ============================================================================
// Color Conversion
// ============================================================================

/** Convert hex color string to Figma RGBA (0-1 scale) */
export function hexToFigmaColor(hex: string): FigmaColor {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return { r, g, b, a: 1 };
}

/** Convert Figma RGBA (0-1 scale) to hex color string */
export function figmaColorToHex(color: FigmaColor): string {
  const r = Math.round(color.r * 255)
    .toString(16)
    .padStart(2, "0");
  const g = Math.round(color.g * 255)
    .toString(16)
    .padStart(2, "0");
  const b = Math.round(color.b * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${r}${g}${b}`.toUpperCase();
}

/** Extract first solid fill color from Figma paint array */
function getFirstSolidFill(paints?: FigmaPaint[]): string | undefined {
  if (!paints) return undefined;
  const solid = paints.find((p) => p.type === "SOLID" && p.color);
  return solid?.color ? figmaColorToHex(solid.color) : undefined;
}

/** Create Figma paint array from hex color */
function hexToFigmaPaint(hex: string): FigmaPaint[] {
  return [{ type: "SOLID", color: hexToFigmaColor(hex) }];
}

// ============================================================================
// Text Alignment Conversion
// ============================================================================

type FigmaTextAlign = "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
type PigmaTextAlign = "left" | "center" | "right";

function figmaTextAlignToPigma(
  align?: FigmaTextAlign,
): PigmaTextAlign | undefined {
  if (!align) return undefined;
  const map: Record<FigmaTextAlign, PigmaTextAlign> = {
    LEFT: "left",
    CENTER: "center",
    RIGHT: "right",
    JUSTIFIED: "left",
  };
  return map[align];
}

function pigmaTextAlignToFigma(align?: PigmaTextAlign): FigmaTextAlign {
  if (!align) return "LEFT";
  const map: Record<PigmaTextAlign, FigmaTextAlign> = {
    left: "LEFT",
    center: "CENTER",
    right: "RIGHT",
  };
  return map[align];
}

// ============================================================================
// Font & Rich Text Mapping
// ============================================================================

const PIGMA_FONT_FAMILIES = [
  "Pretendard",
  "Noto Sans KR",
  "Nanum Gothic",
  "Nanum Myeongjo",
  "IBM Plex Sans KR",
] as const;

/**
 * Figma 폰트명 → pig-ma FontFamily.
 *
 * 예전에는 임의의 Figma 폰트명을 그대로 캐스팅해 넣었는데, pig-ma 의
 * FontFamily 유니온에 없는 값("Inter" 등)이 저장되어 렌더 폴백이 제각각이었다.
 * 유니온에 있는 폰트만 통과시키고, 손글씨 계열(Figma Hand 등)은 가장 캐주얼한
 * 대체 폰트로, 그 외는 undefined(=pig-ma 기본 폰트)로 정규화한다.
 */
export function mapFigmaFontFamily(family?: string): string | undefined {
  if (!family) return undefined;
  const exact = PIGMA_FONT_FAMILIES.find(
    (k) => k.toLowerCase() === family.toLowerCase(),
  );
  if (exact) return exact;
  if (/hand|script|virgil|comic|marker/i.test(family)) return "Nanum Gothic";
  return undefined;
}

/** 오버라이드 스타일 → TextSegment 스타일 필드 */
function overrideToSegmentStyle(
  st: Partial<FigmaTextStyle>,
): Omit<TextSegment, "text"> {
  const seg: Omit<TextSegment, "text"> = {};
  if (st.fontWeight !== undefined) {
    seg.fontWeight = st.fontWeight >= 700 ? "bold" : "normal";
  }
  if (st.textDecoration === "STRIKETHROUGH") {
    seg.textDecoration = "line-through";
  }
  if (st.fontSize !== undefined) seg.fontSize = st.fontSize;
  const color = getFirstSolidFill(st.fills);
  if (color) seg.textColor = color;
  return seg;
}

/**
 * Figma characterStyleOverrides → Tiptap JSONContent.
 *
 * overrides[i]는 i번째 문자의 스타일 id (0 또는 배열보다 짧은 나머지 = 기본
 * style). 같은 id 연속 구간을 세그먼트로 묶어 textSegmentsToTiptap 에 넘긴다.
 * 오버라이드가 없으면 undefined — 평문 경로(text 필드)를 그대로 쓴다.
 */
function overridesToTiptap(node: FigmaNode): JSONContent | undefined {
  const characters = node.characters;
  const overrides = node.characterStyleOverrides;
  const table = node.styleOverrideTable;
  if (!characters || !overrides?.length || !table) return undefined;
  if (!overrides.some((id) => id !== 0)) return undefined;

  // Figma 의 오버라이드 인덱스는 코드포인트 단위다 — UTF-16 코드유닛으로
  // 세면 이모지/서로게이트 페어에서 스타일 경계가 어긋난다.
  const chars = [...characters];
  const segments: TextSegment[] = [];
  let runStart = 0;
  let runId = overrides[0] ?? 0;
  const flush = (end: number) => {
    if (end <= runStart) return;
    const text = chars.slice(runStart, end).join("");
    const st = runId !== 0 ? table[String(runId)] : undefined;
    segments.push({ text, ...(st ? overrideToSegmentStyle(st) : {}) });
  };
  for (let i = 1; i <= chars.length; i++) {
    const id = overrides[i] ?? 0;
    if (i === chars.length || id !== runId) {
      flush(i);
      runStart = i;
      runId = id;
    }
  }
  return textSegmentsToTiptap(segments);
}

/**
 * Tiptap JSONContent → Figma characters + characterStyleOverrides.
 * (pigmaToFigma 의 TEXT 내보내기용 — import 의 역방향)
 */
export function tiptapToFigmaOverrides(content: JSONContent): {
  characters: string;
  characterStyleOverrides: number[];
  styleOverrideTable: Record<string, Partial<FigmaTextStyle>>;
} {
  const lines = tiptapToStyledSegments(content);
  let characters = "";
  const overrides: number[] = [];
  const table: Record<string, Partial<FigmaTextStyle>> = {};
  const idByKey = new Map<string, number>();
  let nextId = 1;

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) {
      characters += "\n";
      overrides.push(0);
    }
    for (const seg of line) {
      const style: Partial<FigmaTextStyle> = {};
      if (seg.bold) style.fontWeight = 700;
      if (seg.strike) style.textDecoration = "STRIKETHROUGH";
      if (seg.fontSize !== undefined) style.fontSize = seg.fontSize;
      if (seg.color) style.fills = hexToFigmaPaint(seg.color);

      let id = 0;
      if (Object.keys(style).length > 0) {
        const key = JSON.stringify(style);
        const existing = idByKey.get(key);
        if (existing !== undefined) {
          id = existing;
        } else {
          id = nextId++;
          idByKey.set(key, id);
          table[String(id)] = style;
        }
      }
      characters += seg.text;
      // 코드포인트 단위로 센다 (Figma 인덱싱과 일치 — 이모지 안전)
      for (const _ch of seg.text) overrides.push(id);
    }
  });

  return {
    characters,
    characterStyleOverrides: overrides,
    styleOverrideTable: table,
  };
}

// ============================================================================
// Figma → Pig-ma
// ============================================================================

/** Convert a Figma node to a pig-ma shape. Returns null for unsupported types. */
export function figmaToPigma(node: FigmaNode): PigmaShape | null {
  const bbox = node.absoluteBoundingBox;
  if (!bbox) return null;

  const base: Pick<
    PigmaShape,
    "id" | "x" | "y" | "width" | "height" | "rotation" | "opacity"
  > = {
    id: nanoid(),
    x: bbox.x,
    y: bbox.y,
    width: bbox.width,
    height: bbox.height,
    rotation: node.rotation ?? 0,
    opacity: node.opacity ?? 1,
  };

  // Check for IMAGE fill — any node with image fill becomes a pig-ma image
  const imageFill = node.fills?.find((p) => p.type === "IMAGE");
  if (imageFill) {
    const fillData = imageFill as unknown as Record<string, unknown>;
    const imageRef = fillData.imageRef as string | undefined;
    const imageTransform = fillData.imageTransform as number[][] | undefined;

    // If imageTransform has a meaningful offset, the image is cropped in Figma.
    // Use node render API instead of raw image to get the correctly cropped version.
    const hasTransform =
      imageTransform &&
      imageTransform.length >= 2 &&
      (Math.abs(imageTransform[0]![2] ?? 0) > 0.01 ||
        Math.abs(imageTransform[1]![2] ?? 0) > 0.01 ||
        Math.abs((imageTransform[0]![0] ?? 1) - 1) > 0.01 ||
        Math.abs((imageTransform[1]![1] ?? 1) - 1) > 0.01);

    return {
      ...base,
      type: "image" as const,
      // Use node render for transformed images, raw imageRef for simple ones
      imageRef: hasTransform ? `node:${node.id}` : imageRef,
    };
  }

  const fill = getFirstSolidFill(node.fills);
  const stroke = getFirstSolidFill(node.strokes);

  switch (node.type) {
    case "RECTANGLE":
    case "FRAME":
      // clipsContent FRAME은 extractLeafNodes 가 자식째로 넘긴다 —
      // 자식을 버리고 빈 사각형으로 만들면 크롭된 콘텐츠(이미지 등)가
      // 사라지므로, 프레임 전체를 render API 로 래스터화한다
      // (크롭이 Figma 서버 렌더링에 그대로 반영된다).
      if (node.type === "FRAME" && node.children && node.children.length > 0) {
        return {
          ...base,
          type: "image",
          imageRef: `node:${node.id}`,
        };
      }
      return {
        ...base,
        type: "shape",
        shapeVariant: "rectangle",
        fill,
        fillMode: fill ? "fill" : "nofill",
        stroke,
        strokeWidth: node.strokeWeight,
      };

    case "ELLIPSE":
      return {
        ...base,
        type: "shape",
        shapeVariant: "ellipse",
        fill,
        fillMode: fill ? "fill" : "nofill",
        stroke,
        strokeWidth: node.strokeWeight,
      };

    case "TEXT": {
      const characters = node.characters ?? "";
      const fontSize = node.style?.fontSize ?? 14;
      const mappedFamily = mapFigmaFontFamily(node.style?.fontFamily);
      const fontWeight: "normal" | "bold" =
        (node.style?.fontWeight ?? 400) >= 700 ? "bold" : "normal";

      // 폭 계산: 예전에는 폰트별 상수 버퍼(1.2/1.5 배)를 곱했는데, 텍스트
      // 길이에 따라 과대/과소가 심했다. pig-ma 쪽 렌더 폰트로 가장 긴 줄을
      // 실측해서 그 폭을 보장한다. 고정 박스(textAutoResize NONE)는 저작자가
      // 폭을 명시한 것이므로 그대로 존중한다.
      const textAutoResize = node.style?.textAutoResize;
      let width = bbox.width;
      if (textAutoResize !== "NONE") {
        const longestLine = characters
          .split("\n")
          .reduce(
            (max, line) =>
              Math.max(
                max,
                measureTextWidth(
                  line,
                  fontSize,
                  mappedFamily ?? "Pretendard",
                  fontWeight,
                ),
              ),
            0,
          );
        width = Math.max(bbox.width, Math.ceil(longestLine) + 8);
      }

      return {
        ...base,
        width,
        type: "textBox",
        text: characters,
        tiptapContent: overridesToTiptap(node),
        fontSize: node.style?.fontSize,
        fontFamily: mappedFamily,
        fontWeight,
        textAlign: figmaTextAlignToPigma(
          node.style?.textAlignHorizontal as FigmaTextAlign,
        ),
        // Figma TEXT fills = text color, not background. Don't use as shape fill.
        textColor: fill,
      };
    }

    case "STICKY":
    case "SHAPE_WITH_TEXT":
      return {
        ...base,
        type: "stickyNote",
        text: node.characters ?? "",
        backgroundColor: fill ?? "#FEF08A",
        fontSize: node.style?.fontSize,
      };

    case "LINE":
    case "CONNECTOR": {
      const connStart = (node as unknown as Record<string, unknown>)
        .connectorStart as
        | { position?: { x: number; y: number }; endpointNodeId?: string }
        | undefined;
      const connEnd = (node as unknown as Record<string, unknown>)
        .connectorEnd as
        | { position?: { x: number; y: number }; endpointNodeId?: string }
        | undefined;
      const lineType = (node as unknown as Record<string, unknown>)
        .connectorLineType as string | undefined;

      let startX = bbox.x;
      let startY = bbox.y;
      let eX = bbox.x + bbox.width;
      let eY = bbox.y + bbox.height;

      if (connStart?.position && connStart.endpointNodeId === "0:1") {
        startX = connStart.position.x;
        startY = connStart.position.y;
      }
      if (connEnd?.position && connEnd.endpointNodeId === "0:1") {
        eX = connEnd.position.x;
        eY = connEnd.position.y;
      }

      // Map Figma connectorLineType to pig-ma pathStyle
      const pathStyle: PigmaShape["pathStyle"] =
        lineType === "CURVED"
          ? "curved"
          : lineType === "ELBOWED"
            ? "elbowed"
            : "straight";

      return {
        ...base,
        x: startX,
        y: startY,
        type: "connector",
        endX: eX,
        endY: eY,
        stroke: stroke ?? fill ?? "#9ca3af",
        strokeWidth: node.strokeWeight ?? 1,
        startMarker: "none",
        endMarker: "none",
        pathStyle,
      };
    }

    case "VECTOR": {
      // Figma's strokeGeometry is the stroke OUTLINE (a closed shape, not the center line).
      // For stroke-only vectors (freehand drawings), we use fillGeometry if available,
      // otherwise render as image (the strokeGeometry outline looks wrong as a line).
      const fillPath = node.fillGeometry?.[0]?.path;

      if (fillPath) {
        const relPoints = svgPathToPoints(fillPath);
        if (relPoints.length >= 4) {
          return {
            ...base,
            type: "line",
            points: relPoints,
            stroke: stroke ?? fill ?? "#000000",
            strokeWidth: node.strokeWeight ?? 2,
            penType: "pen",
          };
        }
      }

      // Stroke-only vectors (freehand drawings): render as image via Figma render API
      // Return as image with a special figmaNodeId for server-side rendering
      return {
        ...base,
        type: "image",
        imageRef: `node:${node.id}`,
      };
    }

    default:
      return null;
  }
}

// ============================================================================
// Pig-ma → Figma
// ============================================================================

/** Convert a pig-ma shape to a Figma node */
export function pigmaToFigma(shape: PigmaShape): FigmaNode {
  const base: Pick<
    FigmaNode,
    "id" | "absoluteBoundingBox" | "opacity" | "rotation"
  > = {
    id: shape.id,
    absoluteBoundingBox: {
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
    },
    opacity: shape.opacity ?? 1,
    rotation: shape.rotation ?? 0,
  };

  switch (shape.type) {
    case "shape": {
      const isEllipse =
        shape.shapeVariant === "circle" || shape.shapeVariant === "ellipse";
      const fills =
        shape.fill && shape.fillMode !== "nofill"
          ? hexToFigmaPaint(shape.fill)
          : [];
      const strokes = shape.stroke ? hexToFigmaPaint(shape.stroke) : [];
      return {
        ...base,
        name: shape.shapeVariant ?? "rectangle",
        type: isEllipse ? "ELLIPSE" : "RECTANGLE",
        fills,
        strokes,
        strokeWeight: shape.strokeWidth,
      };
    }

    case "textBox": {
      // 리치텍스트가 있으면 characterStyleOverrides 로 역변환한다
      const rich = shape.tiptapContent
        ? tiptapToFigmaOverrides(shape.tiptapContent)
        : undefined;
      const hasOverrides =
        rich && Object.keys(rich.styleOverrideTable).length > 0;
      return {
        ...base,
        name: shape.text?.substring(0, 30) ?? "Text",
        type: "TEXT",
        characters: hasOverrides ? rich.characters : (shape.text ?? ""),
        ...(hasOverrides
          ? {
              characterStyleOverrides: rich.characterStyleOverrides,
              styleOverrideTable: rich.styleOverrideTable,
            }
          : {}),
        // For TEXT, fills = text color (not background)
        fills: shape.textColor
          ? hexToFigmaPaint(shape.textColor)
          : shape.fill
            ? hexToFigmaPaint(shape.fill)
            : [],
        style: {
          fontSize: shape.fontSize ?? 16,
          fontFamily: shape.fontFamily ?? "Inter",
          fontWeight: shape.fontWeight === "bold" ? 700 : 400,
          textAlignHorizontal: pigmaTextAlignToFigma(shape.textAlign),
        },
      };
    }

    case "stickyNote":
      return {
        ...base,
        name: shape.text?.substring(0, 30) ?? "Sticky Note",
        type: "STICKY",
        characters: shape.text ?? "",
        fills: hexToFigmaPaint(shape.backgroundColor ?? "#FEF08A"),
        style: {
          fontSize: shape.fontSize ?? 16,
          fontFamily: "Inter",
          fontWeight: 400,
          textAlignHorizontal: "LEFT",
        },
      };

    case "line":
      return {
        ...base,
        name: "Drawing",
        type: "VECTOR",
        fills: [],
        strokes: shape.stroke ? hexToFigmaPaint(shape.stroke) : [],
        strokeWeight: shape.strokeWidth ?? 2,
      };

    default:
      return {
        ...base,
        name: "Unknown",
        type: "RECTANGLE",
        fills: [],
      };
  }
}

// ============================================================================
// SVG Path Parsing (for VECTOR/LINE nodes)
// ============================================================================

/** Number of line segments to approximate each bezier curve */
const BEZIER_SAMPLES = 8;

/** Sample a cubic bezier curve into points */
function sampleCubicBezier(
  x0: number,
  y0: number,
  cp1x: number,
  cp1y: number,
  cp2x: number,
  cp2y: number,
  x1: number,
  y1: number,
  points: number[],
) {
  for (let s = 1; s <= BEZIER_SAMPLES; s++) {
    const t = s / BEZIER_SAMPLES;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    const px =
      mt2 * mt * x0 + 3 * mt2 * t * cp1x + 3 * mt * t2 * cp2x + t2 * t * x1;
    const py =
      mt2 * mt * y0 + 3 * mt2 * t * cp1y + 3 * mt * t2 * cp2y + t2 * t * y1;
    points.push(px, py);
  }
}

/** Sample a quadratic bezier curve into points */
function sampleQuadBezier(
  x0: number,
  y0: number,
  cpx: number,
  cpy: number,
  x1: number,
  y1: number,
  points: number[],
) {
  for (let s = 1; s <= BEZIER_SAMPLES; s++) {
    const t = s / BEZIER_SAMPLES;
    const mt = 1 - t;
    const px = mt * mt * x0 + 2 * mt * t * cpx + t * t * x1;
    const py = mt * mt * y0 + 2 * mt * t * cpy + t * t * y1;
    points.push(px, py);
  }
}

/**
 * Parse an SVG path `d` attribute into a flat points array [x1,y1, x2,y2, ...].
 * Handles M (moveto), L (lineto), C (cubic bezier — sampled into curves),
 * Q (quadratic bezier — sampled into curves), and Z (closepath).
 * Relative commands (m, l, c, q) are also supported.
 */
export function svgPathToPoints(d: string): number[] {
  const points: number[] = [];
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;

  // Tokenize: split into commands and their numeric arguments
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens) return points;

  let i = 0;
  const num = () => parseFloat(tokens[i++]!);

  while (i < tokens.length) {
    const cmd = tokens[i++];

    switch (cmd) {
      case "M":
        cx = num();
        cy = num();
        startX = cx;
        startY = cy;
        points.push(cx, cy);
        // Implicit L after M
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]!))) {
          cx = num();
          cy = num();
          points.push(cx, cy);
        }
        break;

      case "m":
        cx += num();
        cy += num();
        startX = cx;
        startY = cy;
        points.push(cx, cy);
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]!))) {
          cx += num();
          cy += num();
          points.push(cx, cy);
        }
        break;

      case "L":
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]!))) {
          cx = num();
          cy = num();
          points.push(cx, cy);
        }
        break;

      case "l":
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]!))) {
          cx += num();
          cy += num();
          points.push(cx, cy);
        }
        break;

      case "C":
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]!))) {
          const cp1x = num(),
            cp1y = num();
          const cp2x = num(),
            cp2y = num();
          const ex = num(),
            ey = num();
          sampleCubicBezier(cx, cy, cp1x, cp1y, cp2x, cp2y, ex, ey, points);
          cx = ex;
          cy = ey;
        }
        break;

      case "c":
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]!))) {
          const cp1x = cx + num(),
            cp1y = cy + num();
          const cp2x = cx + num(),
            cp2y = cy + num();
          const dx = num(),
            dy = num();
          const ex = cx + dx,
            ey = cy + dy;
          sampleCubicBezier(cx, cy, cp1x, cp1y, cp2x, cp2y, ex, ey, points);
          cx = ex;
          cy = ey;
        }
        break;

      case "Q":
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]!))) {
          const qcpx = num(),
            qcpy = num();
          const qex = num(),
            qey = num();
          sampleQuadBezier(cx, cy, qcpx, qcpy, qex, qey, points);
          cx = qex;
          cy = qey;
        }
        break;

      case "q":
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]!))) {
          const qcpx = cx + num(),
            qcpy = cy + num();
          const qdx = num(),
            qdy = num();
          const qex = cx + qdx,
            qey = cy + qdy;
          sampleQuadBezier(cx, cy, qcpx, qcpy, qex, qey, points);
          cx = qex;
          cy = qey;
        }
        break;

      case "H":
        cx = num();
        points.push(cx, cy);
        break;

      case "h":
        cx += num();
        points.push(cx, cy);
        break;

      case "V":
        cy = num();
        points.push(cx, cy);
        break;

      case "v":
        cy += num();
        points.push(cx, cy);
        break;

      case "Z":
      case "z":
        if (cx !== startX || cy !== startY) {
          cx = startX;
          cy = startY;
          points.push(cx, cy);
        }
        break;
    }
  }

  return points;
}

// ============================================================================
// Tree Traversal
// ============================================================================

/** Renderable node types that can be mapped to pig-ma shapes */
const RENDERABLE_TYPES = new Set([
  "RECTANGLE",
  "ELLIPSE",
  "TEXT",
  "STICKY",
  "SHAPE_WITH_TEXT",
  "FRAME",
  "LINE",
  "VECTOR",
  "CONNECTOR",
]);

/**
 * Extract renderable leaf nodes from a Figma document tree.
 * Walks DOCUMENT > CANVAS (page) > ... > leaf nodes.
 * FRAME nodes with children are treated as containers (skipped),
 * FRAME nodes without children are treated as rectangles (included).
 */
export function extractLeafNodes(root: FigmaNode): FigmaNode[] {
  const result: FigmaNode[] = [];

  function walk(node: FigmaNode) {
    // FRAME with children = container.
    if (node.type === "FRAME" && node.children && node.children.length > 0) {
      const clipsContent =
        (node as unknown as Record<string, unknown>).clipsContent === true;

      // clipsContent FRAME: treat as single renderable node (don't recurse)
      if (clipsContent && node.absoluteBoundingBox) {
        result.push(node);
        return;
      }

      // Non-clipping: add background + recurse
      const hasFill = node.fills?.some(
        (f) => f.type === "SOLID" && f.color && (f.color.a ?? 1) > 0,
      );
      if (hasFill && node.absoluteBoundingBox) {
        result.push({ ...node, children: undefined });
      }
      for (const child of node.children) {
        walk(child);
      }
      return;
    }

    // DOCUMENT, CANVAS, GROUP, SECTION = structural, recurse
    if (
      node.type === "DOCUMENT" ||
      node.type === "CANVAS" ||
      node.type === "GROUP" ||
      node.type === "SECTION"
    ) {
      if (node.children) {
        for (const child of node.children) {
          walk(child);
        }
      }
      return;
    }

    // Renderable leaf node
    if (RENDERABLE_TYPES.has(node.type) && node.absoluteBoundingBox) {
      result.push(node);
    }
  }

  walk(root);
  return result;
}

/**
 * Import a Figma document tree, converting nodes to pig-ma shapes
 * and SECTION nodes to groups.
 *
 * Returns shapes with groupId set for SECTION children,
 * plus group definitions to add to the store.
 */
export function importFigmaDocument(root: FigmaNode): FigmaImportResult {
  const shapes: PigmaShape[] = [];
  const groups: FigmaImportResult["groups"] = [];
  // Figma node ID → pig-ma shape ID mapping (for connector linking)
  const figmaIdToPigmaId = new Map<string, string>();
  // SECTION Figma node IDs → pig-ma group IDs
  const sectionIdToGroupId = new Map<string, string>();
  // Deferred connector data (resolved in pass 2)
  const connectorData: Array<{
    shapeId: string;
    startNodeId?: string;
    endNodeId?: string;
  }> = [];

  // Track parent group IDs for nested sections
  const parentGroupIds: string[] = [];

  function walk(node: FigmaNode, currentGroupId?: string) {
    // SECTION = pig-ma group. Create group, recurse with groupId.
    if (node.type === "SECTION") {
      const groupId = nanoid();
      const fill = getFirstSolidFill(node.fills);
      const sectionStroke = getFirstSolidFill(node.strokes);
      const sectionBbox = node.absoluteBoundingBox;
      groups.push({
        id: groupId,
        name: node.name || `섹션`,
        fill,
        stroke: sectionStroke,
        memberIds: [],
        customBounds: sectionBbox
          ? {
              x: sectionBbox.x,
              y: sectionBbox.y,
              width: sectionBbox.width,
              height: sectionBbox.height,
            }
          : undefined,
      });
      sectionIdToGroupId.set(node.id, groupId);

      // Push parent group so nested shapes are added to parent too
      if (currentGroupId) parentGroupIds.push(currentGroupId);

      if (node.children) {
        for (const child of node.children) {
          walk(child, groupId);
        }
      }

      if (currentGroupId) parentGroupIds.pop();
      return;
    }

    // FRAME with children = container.
    if (node.type === "FRAME" && node.children && node.children.length > 0) {
      const clipsContent =
        (node as unknown as Record<string, unknown>).clipsContent === true;

      // clipsContent FRAME: render entire frame as single image (Figma handles clipping)
      if (clipsContent && node.absoluteBoundingBox) {
        const bbox = node.absoluteBoundingBox;
        const clippedShape: PigmaShape = {
          id: nanoid(),
          type: "image",
          x: bbox.x,
          y: bbox.y,
          width: bbox.width,
          height: bbox.height,
          rotation: node.rotation ?? 0,
          opacity: node.opacity ?? 1,
          imageRef: `node:${node.id}`,
        };
        shapes.push(clippedShape);
        figmaIdToPigmaId.set(node.id, clippedShape.id);
        if (currentGroupId) {
          const group = groups.find((g) => g.id === currentGroupId);
          if (group) group.memberIds.push(clippedShape.id);
        }
        // Don't recurse into children — the rendered image includes everything
        return;
      }

      // Non-clipping FRAME: add background shape + recurse into children
      const hasFill = node.fills?.some(
        (f) => f.type === "SOLID" && f.color && (f.color.a ?? 1) > 0,
      );
      if (hasFill && node.absoluteBoundingBox) {
        const bgShape = figmaToPigma({ ...node, children: undefined });
        if (bgShape) {
          shapes.push(bgShape);
          figmaIdToPigmaId.set(node.id, bgShape.id);
          if (currentGroupId) {
            const group = groups.find((g) => g.id === currentGroupId);
            if (group) group.memberIds.push(bgShape.id);
          }
        }
      }
      for (const child of node.children) {
        walk(child, currentGroupId);
      }
      return;
    }

    // DOCUMENT, CANVAS, GROUP = structural, recurse
    if (
      node.type === "DOCUMENT" ||
      node.type === "CANVAS" ||
      node.type === "GROUP"
    ) {
      if (node.children) {
        for (const child of node.children) {
          walk(child, currentGroupId);
        }
      }
      return;
    }

    // Renderable leaf node
    if (RENDERABLE_TYPES.has(node.type) && node.absoluteBoundingBox) {
      const shape = figmaToPigma(node);
      if (shape) {
        shapes.push(shape);
        figmaIdToPigmaId.set(node.id, shape.id);

        // Track connector endpoints for pass 2
        if (node.type === "CONNECTOR") {
          const connStart = (node as unknown as Record<string, unknown>)
            .connectorStart as { endpointNodeId?: string } | undefined;
          const connEnd = (node as unknown as Record<string, unknown>)
            .connectorEnd as { endpointNodeId?: string } | undefined;
          connectorData.push({
            shapeId: shape.id,
            startNodeId: connStart?.endpointNodeId,
            endNodeId: connEnd?.endpointNodeId,
          });
        }

        // Assign to group if inside a SECTION
        if (currentGroupId) {
          const group = groups.find((g) => g.id === currentGroupId);
          if (group) {
            group.memberIds.push(shape.id);
          }
        }
      }
    }
  }

  walk(root);

  // Pass 2: Resolve connector connections (Figma node ID → pig-ma shape ID)
  // Only connect to shapes, NOT groups. Group IDs as sourceId/targetId
  // would cause pig-ma to fail finding the CanvasObject.
  for (const conn of connectorData) {
    const shape = shapes.find((s) => s.id === conn.shapeId);
    if (!shape) continue;

    if (conn.startNodeId) {
      const pigmaId = figmaIdToPigmaId.get(conn.startNodeId);
      if (pigmaId) shape.sourceId = pigmaId;
      // Don't use sectionIdToGroupId — groups aren't CanvasObjects
    }
    if (conn.endNodeId) {
      const pigmaId = figmaIdToPigmaId.get(conn.endNodeId);
      if (pigmaId) shape.targetId = pigmaId;
    }
  }

  return { shapes, groups };
}
