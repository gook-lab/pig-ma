import { memo, useMemo, useCallback } from "react";
import { Group, Rect, Text, Path } from "react-konva";
import type Konva from "konva";
import type { CanvasObject } from "@/types";
import {
  RichTextRenderer,
  SimpleRichTextRenderer,
} from "@/components/RichTextRenderer";
import { SelectionBorder } from "@/components/SelectionBorder";
import { textToRichText, calculateRichTextHeight } from "@/utils/richText";
import { useCanvasStore } from "@/store";
import { TEXT_CONFIG } from "@/constants/text";

interface RectangleProps {
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
  isEditing?: boolean;
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

// Locked state dash pattern (same as GroupBoundary)
function getLockedDash(_strokeWidth: number): number[] {
  return [8, 4];
}

export const Rectangle = memo(function Rectangle({
  shape,
  isSelected: _isSelected,
  isMultiSelected = false,
  zoom = 1,
  draggable = true,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDoubleClick,
  isEditing,
}: RectangleProps) {
  const isSelected = _isSelected; // Used for expand button visibility
  const updateObject = useCanvasStore((s) => s.updateObject);

  const baseWidth = shape.width ?? 100;
  const baseHeight = shape.height ?? 80;
  const strokeWidth = shape.strokeWidth ?? 2;
  const isLocked = shape.locked === true;
  const dash = isLocked
    ? getLockedDash(strokeWidth)
    : getStrokeDash(shape.lineStyle, strokeWidth);
  const strokeColor = isLocked ? "#ef4444" : (shape.stroke ?? "#374151");
  const fontSize = shape.fontSize ?? 10;
  const fontFamily = shape.fontFamily ?? "Pretendard";
  const textAlign = shape.textAlign ?? "center";
  const textColor = shape.textColor ?? "#1f2937";
  const isTextExpanded = shape.isTextExpanded ?? false;

  // Use TEXT_CONFIG for consistent padding with edit mode
  const { padding } = TEXT_CONFIG.shape;
  const paddingX = padding.left + padding.right;
  const paddingY = padding.top + padding.bottom;
  const textAreaWidth = baseWidth - paddingX;

  // Get rich text or convert plain text
  const richText = useMemo(() => {
    if (shape.richText && shape.richText.length > 0) {
      return shape.richText;
    }
    return shape.text ? textToRichText(shape.text) : [];
  }, [shape.richText, shape.text]);

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
    const first = richText[0];
    return richText.some(
      (seg) =>
        (seg.fontWeight ?? "normal") !== (first.fontWeight ?? "normal") ||
        (seg.textDecoration ?? "none") !== (first.textDecoration ?? "none") ||
        seg.fontSize !== first.fontSize ||
        seg.textColor !== first.textColor,
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

  return (
    <Group
      id={shape.id}
      x={shape.x}
      y={shape.y}
      rotation={shape.rotation}
      opacity={shape.opacity}
      draggable={draggable}
      onClick={onSelect}
      onTap={onSelect}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDblClick={onDoubleClick}
      onDblTap={onDoubleClick}
    >
      {/* 다중 선택 시 개별 선택 테두리 */}
      <SelectionBorder
        width={width}
        height={height}
        zoom={zoom}
        isMultiSelected={isMultiSelected}
      />
      <Rect
        width={width}
        height={height}
        fill={shape.fill ?? "#ffffff"}
        stroke={strokeColor}
        strokeWidth={isLocked ? Math.max(2, strokeWidth) : strokeWidth}
        dash={dash}
        cornerRadius={4}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
      />
      {/* Text with rich formatting - clipped to text area */}
      {!isEditing && richText.length > 0 && (
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
            />
          )}
        </Group>
      )}
      {/* Placeholder when no text */}
      {!isEditing && richText.length === 0 && (
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
          listening={false}
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
