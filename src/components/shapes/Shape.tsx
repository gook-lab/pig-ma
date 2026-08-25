import { memo, useMemo, useCallback } from "react";
import {
  Group,
  Shape as KonvaShape,
  Rect,
  Circle,
  Ellipse,
  Line,
  Text,
  Path,
} from "react-konva";
import type Konva from "konva";
import type { CanvasObject, ShapeVariant } from "@/types";
import {
  RichTextRenderer,
  SimpleRichTextRenderer,
} from "@/components/RichTextRenderer";
import { SelectionBorder } from "@/components/SelectionBorder";
import {
  textToRichText,
  calculateRichTextHeight,
  LINE_HEIGHT,
} from "@/utils/richText";
import { useCanvasStore } from "@/store";
import { TEXT_CONFIG, isTextReadable } from "@/constants/text";
import {
  tiptapToPlainText,
  extractFirstTextStyle,
  hasMixedStyles,
} from "@/utils/tiptapMigration";
import { fontStack } from "@/constants/fonts";

interface ShapeProps {
  shape: CanvasObject;
  isSelected: boolean;
  /** 다중 선택 모드 (2개 이상 선택됨) */
  isMultiSelected?: boolean;
  /** 현재 줌 레벨 */
  zoom?: number;
  draggable?: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDoubleClick?: () => void;
  onTextClick?: () => void;
  isEditing?: boolean;
}

// Helper to generate path points for various shapes - exported for preview
export function getShapePath(
  variant: ShapeVariant,
  width: number,
  height: number,
): number[] {
  switch (variant) {
    case "triangle":
      return [width / 2, 0, width, height, 0, height];
    case "triangleDown":
      return [0, 0, width, 0, width / 2, height];
    case "diamond":
      return [
        width / 2,
        0,
        width,
        height / 2,
        width / 2,
        height,
        0,
        height / 2,
      ];
    case "pentagon": {
      const points: number[] = [];
      for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        points.push(width / 2 + (width / 2) * Math.cos(angle));
        points.push(height / 2 + (height / 2) * Math.sin(angle));
      }
      return points;
    }
    case "hexagon": {
      const points: number[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (i * 2 * Math.PI) / 6 - Math.PI / 2;
        points.push(width / 2 + (width / 2) * Math.cos(angle));
        points.push(height / 2 + (height / 2) * Math.sin(angle));
      }
      return points;
    }
    case "octagon": {
      const inset = Math.min(width, height) * 0.3;
      return [
        inset,
        0,
        width - inset,
        0,
        width,
        inset,
        width,
        height - inset,
        width - inset,
        height,
        inset,
        height,
        0,
        height - inset,
        0,
        inset,
      ];
    }
    case "star": {
      const points: number[] = [];
      const outerR = Math.min(width, height) / 2;
      const innerR = outerR * 0.4;
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        points.push(width / 2 + r * Math.cos(angle));
        points.push(height / 2 + r * Math.sin(angle));
      }
      return points;
    }
    case "star4": {
      const points: number[] = [];
      const outerR = Math.min(width, height) / 2;
      const innerR = outerR * 0.3;
      for (let i = 0; i < 8; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (i * Math.PI) / 4 - Math.PI / 2;
        points.push(width / 2 + r * Math.cos(angle));
        points.push(height / 2 + r * Math.sin(angle));
      }
      return points;
    }
    case "cross": {
      const arm = Math.min(width, height) * 0.3;
      const cx = width / 2;
      const cy = height / 2;
      return [
        cx - arm,
        0,
        cx + arm,
        0,
        cx + arm,
        cy - arm,
        width,
        cy - arm,
        width,
        cy + arm,
        cx + arm,
        cy + arm,
        cx + arm,
        height,
        cx - arm,
        height,
        cx - arm,
        cy + arm,
        0,
        cy + arm,
        0,
        cy - arm,
        cx - arm,
        cy - arm,
      ];
    }
    case "arrowRight":
      return [
        0,
        height * 0.25,
        width * 0.6,
        height * 0.25,
        width * 0.6,
        0,
        width,
        height / 2,
        width * 0.6,
        height,
        width * 0.6,
        height * 0.75,
        0,
        height * 0.75,
      ];
    case "arrowLeft":
      return [
        width,
        height * 0.25,
        width * 0.4,
        height * 0.25,
        width * 0.4,
        0,
        0,
        height / 2,
        width * 0.4,
        height,
        width * 0.4,
        height * 0.75,
        width,
        height * 0.75,
      ];
    case "arrowUp":
      return [
        width * 0.25,
        height,
        width * 0.25,
        height * 0.4,
        0,
        height * 0.4,
        width / 2,
        0,
        width,
        height * 0.4,
        width * 0.75,
        height * 0.4,
        width * 0.75,
        height,
      ];
    case "arrowDown":
      return [
        width * 0.25,
        0,
        width * 0.25,
        height * 0.6,
        0,
        height * 0.6,
        width / 2,
        height,
        width,
        height * 0.6,
        width * 0.75,
        height * 0.6,
        width * 0.75,
        0,
      ];
    case "chevronRight":
      return [0, 0, width, height / 2, 0, height];
    case "chevronLeft":
      return [width, 0, 0, height / 2, width, height];
    case "speechBubble":
      return [
        0,
        0,
        width,
        0,
        width,
        height * 0.7,
        width * 0.4,
        height * 0.7,
        width * 0.2,
        height,
        width * 0.2,
        height * 0.7,
        0,
        height * 0.7,
      ];
    // Flowchart shapes
    case "flowProcess":
      return [0, 0, width, 0, width, height, 0, height];
    case "flowDecision":
      return [
        width / 2,
        0,
        width,
        height / 2,
        width / 2,
        height,
        0,
        height / 2,
      ];
    case "flowData":
      return [width * 0.15, 0, width, 0, width * 0.85, height, 0, height];
    case "flowPreparation":
      return [
        width * 0.15,
        0,
        width * 0.85,
        0,
        width,
        height / 2,
        width * 0.85,
        height,
        width * 0.15,
        height,
        0,
        height / 2,
      ];
    case "flowManualInput":
      return [0, height * 0.2, width, 0, width, height, 0, height];
    case "flowTerminal": {
      // Rounded rectangle approximation (pill shape)
      const r = Math.min(width, height) / 2;
      const points: number[] = [];
      // Top edge (left to right)
      points.push(r, 0, width - r, 0);
      // Right arc (top to bottom) - approximate with polygon
      for (let i = 0; i <= 8; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 8;
        points.push(width - r + r * Math.cos(angle), r + r * Math.sin(angle));
      }
      // Bottom edge (right to left)
      points.push(width - r, height, r, height);
      // Left arc (bottom to top)
      for (let i = 0; i <= 8; i++) {
        const angle = Math.PI / 2 + (i * Math.PI) / 8;
        points.push(r + r * Math.cos(angle), height - r + r * Math.sin(angle));
      }
      return points;
    }
    case "flowDocument": {
      // Document shape with wavy bottom
      const waveHeight = height * 0.1;
      return [
        0,
        0,
        width,
        0,
        width,
        height - waveHeight,
        width * 0.75,
        height,
        width * 0.5,
        height - waveHeight,
        width * 0.25,
        height,
        0,
        height - waveHeight,
      ];
    }
    case "flowDatabase": {
      // Cylinder approximation
      const ellipseH = height * 0.15;
      const points: number[] = [];
      // Top ellipse (approximated)
      for (let i = 0; i <= 16; i++) {
        const angle = Math.PI + (i * Math.PI) / 16;
        points.push(
          width / 2 + (width / 2) * Math.cos(angle),
          ellipseH + ellipseH * Math.sin(angle),
        );
      }
      // Right side
      points.push(width, height - ellipseH);
      // Bottom ellipse
      for (let i = 0; i <= 16; i++) {
        const angle = (i * Math.PI) / 16;
        points.push(
          width / 2 + (width / 2) * Math.cos(angle),
          height - ellipseH + ellipseH * Math.sin(angle),
        );
      }
      // Left side
      points.push(0, ellipseH);
      return points;
    }
    case "flowPredefined":
      // Rectangle with side indents
      return [
        width * 0.1,
        0,
        width * 0.9,
        0,
        width * 0.9,
        height,
        width * 0.1,
        height,
      ];
    case "flowDelay":
      // D shape (half circle on right)
      const points: number[] = [0, 0, width * 0.5, 0];
      for (let i = 0; i <= 16; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 16;
        points.push(
          width * 0.5 + (height / 2) * Math.cos(angle),
          height / 2 + (height / 2) * Math.sin(angle),
        );
      }
      points.push(width * 0.5, height, 0, height);
      return points;
    default:
      return [0, 0, width, 0, width, height, 0, height];
  }
}

// Convert lineStyle to Konva dash array
function getStrokeDash(
  lineStyle: string | undefined,
  strokeWidth: number,
): number[] | undefined {
  if (lineStyle === "dashed") return [strokeWidth * 3, strokeWidth * 2];
  if (lineStyle === "dotted") return [strokeWidth, strokeWidth * 2];
  return undefined;
}

/**
 * Render the inner shape content based on variant
 */
function ShapeContent({
  variant,
  width,
  height,
  fill,
  stroke,
  strokeWidth,
  dash,
}: {
  variant: ShapeVariant;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  dash?: number[];
}) {
  // Rectangle variant
  if (variant === "rectangle") {
    return (
      <Rect
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={dash}
        cornerRadius={4}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
      />
    );
  }

  // Rounded Rectangle / Terminal
  if (variant === "roundedRect" || variant === "flowTerminal") {
    return (
      <Rect
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={dash}
        cornerRadius={Math.min(width, height) / 2}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
      />
    );
  }

  // Circle variant
  if (variant === "circle") {
    const radius = Math.min(width, height) / 2;
    return (
      <Circle
        x={width / 2}
        y={height / 2}
        radius={radius}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={dash}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
      />
    );
  }

  // Ellipse variant
  if (variant === "ellipse") {
    return (
      <Ellipse
        x={width / 2}
        y={height / 2}
        radiusX={width / 2}
        radiusY={height / 2}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={dash}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
      />
    );
  }

  // Flowchart Database (Cylinder)
  if (variant === "flowDatabase") {
    const ellipseHeight = height * 0.15;
    return (
      <>
        {/* Body */}
        <KonvaShape
          sceneFunc={(ctx, shapeNode) => {
            ctx.beginPath();
            ctx.moveTo(0, ellipseHeight);
            ctx.lineTo(0, height - ellipseHeight);
            ctx.quadraticCurveTo(0, height, width / 2, height);
            ctx.quadraticCurveTo(width, height, width, height - ellipseHeight);
            ctx.lineTo(width, ellipseHeight);
            ctx.closePath();
            ctx.fillStrokeShape(shapeNode);
          }}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          dash={dash}
        />
        {/* Top ellipse */}
        <Ellipse
          x={width / 2}
          y={ellipseHeight}
          radiusX={width / 2}
          radiusY={ellipseHeight}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          dash={dash}
        />
      </>
    );
  }

  // Flowchart Document (curved bottom)
  if (variant === "flowDocument") {
    return (
      <KonvaShape
        sceneFunc={(ctx, shapeNode) => {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(width, 0);
          ctx.lineTo(width, height * 0.85);
          ctx.quadraticCurveTo(
            width * 0.75,
            height * 0.7,
            width * 0.5,
            height * 0.85,
          );
          ctx.quadraticCurveTo(width * 0.25, height, 0, height * 0.85);
          ctx.closePath();
          ctx.fillStrokeShape(shapeNode);
        }}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={dash}
        perfectDrawEnabled={false}
      />
    );
  }

  // Flowchart Delay (D shape)
  if (variant === "flowDelay") {
    return (
      <KonvaShape
        sceneFunc={(ctx, shapeNode) => {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(width * 0.6, 0);
          ctx.quadraticCurveTo(width, 0, width, height / 2);
          ctx.quadraticCurveTo(width, height, width * 0.6, height);
          ctx.lineTo(0, height);
          ctx.closePath();
          ctx.fillStrokeShape(shapeNode);
        }}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={dash}
        perfectDrawEnabled={false}
      />
    );
  }

  // Flowchart OR (circle with cross)
  if (variant === "flowOr") {
    const radius = Math.min(width, height) / 2;
    return (
      <>
        <Circle
          x={width / 2}
          y={height / 2}
          radius={radius}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          dash={dash}
        />
        <Line
          points={[width / 2, 0, width / 2, height]}
          stroke={stroke}
          strokeWidth={strokeWidth}
          dash={dash}
        />
        <Line
          points={[0, height / 2, width, height / 2]}
          stroke={stroke}
          strokeWidth={strokeWidth}
          dash={dash}
        />
      </>
    );
  }

  // Flowchart Summing (circle with X)
  if (variant === "flowSumming") {
    const radius = Math.min(width, height) / 2;
    const offset = radius * 0.7;
    return (
      <>
        <Circle
          x={width / 2}
          y={height / 2}
          radius={radius}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          dash={dash}
        />
        <Line
          points={[
            width / 2 - offset,
            height / 2 - offset,
            width / 2 + offset,
            height / 2 + offset,
          ]}
          stroke={stroke}
          strokeWidth={strokeWidth}
          dash={dash}
        />
        <Line
          points={[
            width / 2 + offset,
            height / 2 - offset,
            width / 2 - offset,
            height / 2 + offset,
          ]}
          stroke={stroke}
          strokeWidth={strokeWidth}
          dash={dash}
        />
      </>
    );
  }

  // Flowchart Predefined (rectangle with side lines)
  if (variant === "flowPredefined") {
    const sideWidth = width * 0.1;
    return (
      <>
        <Rect
          width={width}
          height={height}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          dash={dash}
        />
        <Line
          points={[sideWidth, 0, sideWidth, height]}
          stroke={stroke}
          strokeWidth={strokeWidth}
          dash={dash}
        />
        <Line
          points={[width - sideWidth, 0, width - sideWidth, height]}
          stroke={stroke}
          strokeWidth={strokeWidth}
          dash={dash}
        />
      </>
    );
  }

  // All other polygon-based shapes
  const points = getShapePath(variant, width, height);
  return (
    <Line
      points={points}
      closed
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      dash={dash}
      perfectDrawEnabled={false}
      shadowForStrokeEnabled={false}
    />
  );
}

/**
 * Unified Shape Component
 *
 * 모든 ShapeVariant를 렌더링하는 통합 컴포넌트.
 * Group 패턴을 따라 일관된 선택/드래그 동작을 보장합니다.
 *
 * @pattern Group Wrapper
 * - 모든 variant는 Group으로 감싸서 id, x, y, rotation을 Group에 설정
 * - 내부 요소는 (0, 0) 기준으로 상대 배치
 * - 드래그 시 Group 위치만 업데이트 → store의 x, y와 일치
 */
export const Shape = memo(function Shape({
  shape,
  isSelected,
  isMultiSelected = false,
  zoom = 1,
  draggable = true,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDoubleClick,
  onTextClick,
  isEditing,
}: ShapeProps) {
  void isSelected; // Selection indicator handled by Transformer (단일 선택 시)
  const updateObject = useCanvasStore((s) => s.updateObject);

  const baseWidth = shape.width ?? 100;
  const baseHeight = shape.height ?? 100;
  const variant = shape.shapeVariant ?? "rectangle";
  const fill = shape.fill ?? "#ffffff";
  const isLocked = shape.locked === true;
  const stroke = isLocked ? "#ef4444" : (shape.stroke ?? "#374151");
  const strokeWidth = isLocked
    ? Math.max(2, shape.strokeWidth ?? 2)
    : (shape.strokeWidth ?? 2);
  const lineStyle = shape.lineStyle;
  const dash = isLocked ? [8, 4] : getStrokeDash(lineStyle, strokeWidth);

  // Text styling
  const fontSize = shape.fontSize ?? 10;
  const fontFamily = fontStack(shape.fontFamily);
  const textAlign = shape.textAlign ?? "center";
  const textColor = shape.textColor ?? "#1f2937";
  const isTextExpanded = shape.isTextExpanded ?? false;
  // 줌 LOD — boolean 구독: 임계값을 넘나들 때만 리렌더
  const textReadable = useCanvasStore((s) =>
    isTextReadable(fontSize, s.viewport.zoom),
  );

  // Use TEXT_CONFIG for consistent padding with edit mode
  const { padding } = TEXT_CONFIG.shape;
  const paddingX = padding.left + padding.right;
  const paddingY = padding.top + padding.bottom;
  const textAreaWidth = baseWidth - paddingX;

  // Prefer tiptapContent (set by Tiptap editor) over legacy richText
  const useTiptap = !!shape.tiptapContent;
  const tiptapPlainText = useMemo(() => {
    if (shape.tiptapContent) return tiptapToPlainText(shape.tiptapContent);
    return "";
  }, [shape.tiptapContent]);
  const tiptapStyle = useMemo(() => {
    if (shape.tiptapContent) return extractFirstTextStyle(shape.tiptapContent);
    return {};
  }, [shape.tiptapContent]);
  const isMixed = useMemo(
    () => (shape.tiptapContent ? hasMixedStyles(shape.tiptapContent) : false),
    [shape.tiptapContent],
  );

  // Legacy: rich text segments (used when tiptapContent is not available)
  const richText = useMemo(() => {
    if (useTiptap) return []; // skip legacy when tiptap is available
    if (shape.richText && shape.richText.length > 0) {
      return shape.richText;
    }
    return shape.text ? textToRichText(shape.text) : [];
  }, [shape.richText, shape.text, useTiptap]);

  // Calculate text height and check for overflow
  const textMetrics = useMemo(() => {
    if (richText.length === 0) {
      return { height: 0, lineCount: 0, isOverflowing: false };
    }
    const { height, lineCount } = calculateRichTextHeight(
      richText,
      textAreaWidth,
      fontSize,
      fontFamily,
    );
    // Check overflow based on current shape height
    const availableTextHeight = baseHeight - paddingY;
    const isOverflowing = height > availableTextHeight;
    return { height, lineCount, isOverflowing, availableTextHeight };
  }, [richText, textAreaWidth, fontSize, fontFamily, baseHeight, paddingY]);

  // Calculate actual shape dimensions - respect user-set dimensions
  const { width, height, textAreaHeight } = useMemo(() => {
    const w = baseWidth;
    const h = baseHeight;

    if (isTextExpanded && textMetrics.isOverflowing) {
      // Expanded mode: grow shape to fit all text
      const expandedH = Math.max(h, textMetrics.height + paddingY);
      return {
        width: w,
        height: expandedH,
        textAreaHeight: textMetrics.height,
      };
    }
    // Normal mode: use shape's actual dimensions
    return {
      width: w,
      height: h,
      textAreaHeight: h - paddingY,
    };
  }, [baseWidth, baseHeight, isTextExpanded, textMetrics, paddingY]);

  // Check if text has mixed styles
  const hasRichFormatting = useMemo(() => {
    if (richText.length <= 1) return false;
    const first = richText[0]!;
    return richText.some(
      (seg) =>
        (seg.fontWeight ?? "normal") !== (first!.fontWeight ?? "normal") ||
        (seg.textDecoration ?? "none") !== (first!.textDecoration ?? "none") ||
        seg.fontSize !== first!.fontSize ||
        seg.textColor !== first!.textColor,
    );
  }, [richText]);

  // Toggle text expansion
  const handleToggleExpand = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      e.cancelBubble = true; // Prevent selection
      const newExpanded = !isTextExpanded;
      const updates: Partial<CanvasObject> = { isTextExpanded: newExpanded };
      // If expanding, update shape height to fit text
      if (newExpanded && textMetrics.isOverflowing) {
        const expandedH = Math.max(baseHeight, textMetrics.height + paddingY);
        updates.height = expandedH;
      } else if (!newExpanded) {
        // If collapsing, restore original height
        updates.height = baseHeight;
      }
      updateObject(shape.id, updates);
    },
    [
      shape.id,
      isTextExpanded,
      textMetrics.isOverflowing,
      textMetrics.height,
      baseHeight,
      paddingY,
      updateObject,
    ],
  );

  // Expand/collapse button size
  const buttonSize = 20 / zoom;
  const buttonY = height + 4 / zoom;

  // Common Group props for all variants
  const groupProps = {
    id: shape.id,
    x: shape.x,
    y: shape.y,
    rotation: shape.rotation,
    opacity: shape.opacity,
    draggable,
    onClick: onSelect,
    onTap: onSelect,
    onDblClick: onDoubleClick,
    onDblTap: onDoubleClick,
    onDragStart,
    onDragMove,
    onDragEnd,
  };

  return (
    <Group {...groupProps}>
      {/* 다중 선택 시 개별 선택 테두리 */}
      <SelectionBorder
        width={width}
        height={height}
        zoom={zoom}
        isMultiSelected={isMultiSelected}
      />
      {/* Shape content */}
      <ShapeContent
        variant={variant}
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={dash}
      />

      {/* Text rendering - tiptapContent uses Konva Text, legacy uses RichTextRenderer */}
      {!isEditing &&
        textReadable &&
        useTiptap &&
        tiptapPlainText &&
        !isMixed && (
          <Text
            x={padding.left}
            y={padding.top}
            width={textAreaWidth}
            height={textAreaHeight}
            text={tiptapPlainText}
            fontSize={tiptapStyle.fontSize ?? fontSize}
            fontFamily={fontStack(tiptapStyle.fontFamily) ?? fontFamily}
            fontStyle={tiptapStyle.fontStyle ?? "normal"}
            fill={tiptapStyle.color ?? textColor}
            align={(tiptapStyle.textAlign as string) ?? textAlign}
            verticalAlign="middle"
            lineHeight={LINE_HEIGHT}
            wrap="word"
            ellipsis
            textDecoration={tiptapStyle.textDecoration}
            listening={false}
            perfectDrawEnabled={false}
          />
        )}
      {!isEditing && textReadable && richText.length > 0 && (
        <Group
          x={padding.left}
          y={padding.top}
          clipX={0}
          clipY={0}
          clipWidth={textAreaWidth}
          clipHeight={textAreaHeight}
        >
          {hasRichFormatting ? (
            <RichTextRenderer
              richText={richText}
              lineIndents={shape.lineIndents}
              x={0}
              y={0}
              width={textAreaWidth}
              height={textAreaHeight}
              defaultFontSize={fontSize}
              defaultColor={textColor}
              defaultFontFamily={fontFamily}
              textAlign={textAlign}
              verticalAlign="middle"
              listening={isSelected}
            />
          ) : (
            <SimpleRichTextRenderer
              richText={richText}
              x={0}
              y={0}
              width={textAreaWidth}
              height={textAreaHeight}
              defaultFontSize={fontSize}
              defaultColor={textColor}
              defaultFontFamily={fontFamily}
              textAlign={textAlign}
              verticalAlign="middle"
              listening={isSelected}
            />
          )}
        </Group>
      )}
      {/* Placeholder when no text — hide if tiptapContent has text */}
      {!isEditing &&
        textReadable &&
        richText.length === 0 &&
        !tiptapPlainText &&
        isSelected && (
          <Text
            x={padding.left}
            y={padding.top}
            width={textAreaWidth}
            height={textAreaHeight}
            text="Add text"
            fontSize={fontSize}
            fontFamily={fontFamily}
            fill="#9ca3af"
            align={textAlign}
            verticalAlign="middle"
            wrap="word"
            ellipsis
            perfectDrawEnabled={false}
            listening={isSelected}
            onClick={onTextClick}
            onTap={onTextClick}
          />
        )}

      {/* Expand/Collapse button - show when text overflows and selected */}
      {isSelected && !isEditing && textMetrics.isOverflowing && (
        <Group
          x={width / 2 - buttonSize / 2}
          y={buttonY}
          onClick={handleToggleExpand}
          onTap={handleToggleExpand}
        >
          {/* Button background */}
          <Rect
            width={buttonSize}
            height={buttonSize}
            fill="#3b82f6"
            cornerRadius={buttonSize / 4}
            shadowColor="rgba(0,0,0,0.2)"
            shadowBlur={4}
            shadowOffsetY={2}
          />
          {/* Arrow icon */}
          <Path
            x={buttonSize / 2}
            y={buttonSize / 2}
            data={
              isTextExpanded
                ? "M -4 2 L 0 -2 L 4 2" // Up arrow (collapse)
                : "M -4 -2 L 0 2 L 4 -2" // Down arrow (expand)
            }
            stroke="white"
            strokeWidth={2 / zoom}
            lineCap="round"
            lineJoin="round"
          />
        </Group>
      )}
    </Group>
  );
});
