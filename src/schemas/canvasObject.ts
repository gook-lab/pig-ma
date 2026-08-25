import { z } from "zod";
import { FONT_FAMILY_IDS } from "@/constants/fonts";
import type { FontFamily } from "@/types";

// Basic enum types
export const ObjectTypeSchema = z.enum([
  "image",
  "line",
  "stickyNote",
  "connector",
  "textBox",
  "shape",
  "connectorLabel",
  "table",
]);

export const ShapeVariantSchema = z.enum([
  // Basic shapes
  "rectangle",
  "roundedRect",
  "circle",
  "ellipse",
  "triangle",
  "triangleDown",
  "diamond",
  "pentagon",
  "hexagon",
  "octagon",
  "star",
  "star4",
  "cross",
  "arrowRight",
  "arrowLeft",
  "arrowUp",
  "arrowDown",
  "chevronRight",
  "chevronLeft",
  "speechBubble",
  // Flowchart shapes
  "flowProcess",
  "flowDecision",
  "flowTerminal",
  "flowData",
  "flowDocument",
  "flowDatabase",
  "flowPredefined",
  "flowManualInput",
  "flowPreparation",
  "flowDelay",
  "flowOr",
  "flowSumming",
]);

export const PenTypeSchema = z.enum(["marker", "pen", "highlighter"]);

export const MarkerStyleSchema = z.enum([
  "none",
  "arrow",
  "filledArrow",
  "diamond",
  "circle",
]);

export const LineStyleSchema = z.enum(["solid", "dashed", "dotted"]);

export const PathStyleSchema = z.enum(["straight", "curved", "elbowed"]);

export const ElbowCornerStyleSchema = z.enum(["sharp", "rounded"]);

export const ContentVersionSchema = z.union([z.literal(1), z.literal(2)]);

// 목록을 여기에 복사해 두면 폰트를 추가할 때 한쪽만 늘어나고, 새 폰트가 담긴
// .pigma 가 검증에서 튕긴다. 레지스트리에서 파생시켜 그 경로를 없앤다.
export const FontFamilySchema = z.enum(
  FONT_FAMILY_IDS as [FontFamily, ...FontFamily[]],
);

export const FontSizeSchema = z.enum(["S", "M", "L", "XL", "XXL"]);

export const TextAlignSchema = z.enum(["left", "center", "right"]);

export const ListTypeSchema = z.enum(["none", "number", "bullet"]);

export const FillModeSchema = z.enum(["fill", "transparent", "nofill"]);

// Staircase step for nested elbows
export const StaircaseStepSchema = z.object({
  y: z.number(),
  midX: z.number().optional(),
});

// Elbow bend point
export const ElbowBendSchema = z
  .object({
    segmentIndex: z.number(),
    offset: z.number(),
    elbowY: z.number().optional(),
    leftCornerX: z.number().optional(),
    rightCornerX: z.number().optional(),
    leftY: z.number().optional(),
    rightY: z.number().optional(),
    midLeftX: z.number().optional(),
    midRightX: z.number().optional(),
    leftYSteps: z.array(StaircaseStepSchema).optional(),
    rightYSteps: z.array(StaircaseStepSchema).optional(),
    leftCornerRatio: z.number().optional(),
    rightCornerRatio: z.number().optional(),
    bendId: z.string().optional(),
    parentBendId: z.string().optional(),
    region: z.enum(["primary", "left", "right"]).optional(),
  })
  .passthrough();

// Text segment (legacy)
export const TextSegmentSchema = z
  .object({
    text: z.string(),
    fontWeight: z.enum(["normal", "bold"]).optional(),
    textDecoration: z.enum(["none", "line-through"]).optional(),
    fontSize: z.number().optional(),
    textColor: z.string().optional(),
    link: z.string().optional(),
  })
  .passthrough();

// Table cell
export const TableCellSchema = z
  .object({
    id: z.string(),
    content: z.unknown().optional(), // Tiptap JSONContent
    backgroundColor: z.string().optional(),
    textAlign: TextAlignSchema.optional(),
    verticalAlign: z.enum(["top", "middle", "bottom"]).optional(),
    measuredHeight: z.number().optional(),
  })
  .passthrough();

// Table data
export const TableDataSchema = z
  .object({
    cells: z.record(z.string(), TableCellSchema),
    rowCount: z.number(),
    colCount: z.number(),
    colWidths: z.array(z.number()),
    rowHeights: z.array(z.number()),
    defaultColWidth: z.number(),
    defaultRowHeight: z.number(),
    borderColor: z.string(),
    backgroundColor: z.string().optional(),
  })
  .passthrough();

// Main CanvasObject schema
/**
 * Chart data — 얕은 검증.
 *
 * 렌더 경로가 items/series 를 배열로 가정하고 순회하므로, **배열성만은
 * 반드시 지킨다**. 문자열도 `.length` 를 가져서 `items && items.length > 0`
 * 류의 가드를 통과한 뒤 `.map`/`.forEach` 에서 터진 전례가 있다
 * (2026-08, 손상 .pigma 를 열면 캔버스 전체가 죽었다).
 * 항목 내부 필드는 렌더가 폴백을 갖고 있어 passthrough 로 둔다.
 */
export const ChartDataSchema = z
  .object({
    variant: z.string(),
    items: z.array(z.unknown()),
    series: z.array(z.unknown()).optional(),
  })
  .passthrough();

export const CanvasObjectSchema = z
  .object({
    id: z.string(),
    type: ObjectTypeSchema,
    x: z.number(),
    y: z.number(),
    rotation: z.number(),
    opacity: z.number(),

    // Shape-specific (optional)
    width: z.number().optional(),
    height: z.number().optional(),
    radius: z.number().optional(),
    fill: z.string().optional(),
    fillMode: FillModeSchema.optional(),
    stroke: z.string().optional(),
    strokeWidth: z.number().optional(),
    shapeVariant: ShapeVariantSchema.optional(),

    // Image-specific
    src: z.string().optional(),

    // Line-specific
    points: z.array(z.number()).optional(),
    penType: PenTypeSchema.optional(),

    // StickyNote & TextBox specific
    text: z.string().optional(),
    backgroundColor: z.string().optional(),
    fontSize: z.number().optional(),
    fontWeight: z.enum(["normal", "bold"]).optional(),
    textDecoration: z.enum(["none", "line-through"]).optional(),

    // TextBox specific
    fontFamily: FontFamilySchema.optional(),
    fontSizePreset: FontSizeSchema.optional(),
    textAlign: TextAlignSchema.optional(),
    listType: ListTypeSchema.optional(),
    indentLevel: z.number().optional(),
    link: z.string().optional(),
    textColor: z.string().optional(),

    // Rich text fields
    richText: z.array(TextSegmentSchema).optional(),
    lineIndents: z.array(z.number()).optional(),
    tiptapContent: z.unknown().optional(), // Tiptap JSONContent
    _contentVersion: ContentVersionSchema.optional(),

    // Author info
    authorId: z.string().optional(),
    authorName: z.string().optional(),

    // Connector/Arrow-specific
    endX: z.number().optional(),
    endY: z.number().optional(),
    sourceId: z.string().optional(),
    targetId: z.string().optional(),
    sourceAnchor: z
      .enum(["top", "right", "bottom", "left", "center"])
      .optional(),
    targetAnchor: z
      .enum(["top", "right", "bottom", "left", "center"])
      .optional(),
    sourceAngle: z.number().optional(),
    targetAngle: z.number().optional(),
    sourceOffsetX: z.number().optional(),
    sourceOffsetY: z.number().optional(),
    targetOffsetX: z.number().optional(),
    targetOffsetY: z.number().optional(),
    sourceOffsetRatioX: z.number().optional(),
    sourceOffsetRatioY: z.number().optional(),
    targetOffsetRatioX: z.number().optional(),
    targetOffsetRatioY: z.number().optional(),

    // Connector style options
    startMarker: MarkerStyleSchema.optional(),
    endMarker: MarkerStyleSchema.optional(),
    lineStyle: LineStyleSchema.optional(),
    pathStyle: PathStyleSchema.optional(),
    label: z.string().optional(),
    labelT: z.number().optional(),
    labelOffsetY: z.number().optional(),

    // Elbow connector advanced options
    elbowBends: z.array(ElbowBendSchema).optional(),
    elbowCornerStyle: ElbowCornerStyleSchema.optional(),
    elbowCornerRadius: z.number().optional(),

    // Lock state
    locked: z.boolean().optional(),

    // Connector-TextBox relationship
    labelTextBoxId: z.string().optional(),
    connectedConnectorId: z.string().optional(),

    // Group membership
    groupId: z.string().optional(),

    // Z-Index for layering
    zIndex: z.number().optional(),

    // Text expansion state
    isTextExpanded: z.boolean().optional(),

    // Table-specific
    tableData: TableDataSchema.optional(),

    // Chart-specific
    chartData: ChartDataSchema.optional(),
  })
  .passthrough(); // Allow unknown fields for backwards compatibility

export type CanvasObjectParsed = z.infer<typeof CanvasObjectSchema>;
