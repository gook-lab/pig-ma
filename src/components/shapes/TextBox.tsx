import { memo, useRef, useMemo } from "react";
import { Group, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { CanvasObject } from "@/types";
import { SelectionBorder } from "@/components/SelectionBorder";
import {
  tiptapToPlainText,
  extractFirstTextStyle,
  hasMixedStyles,
} from "@/utils/tiptapMigration";
import { TEXT_CONFIG } from "@/utils/textConfig";
import { LINE_HEIGHT } from "@/utils/richText";
import { isTextReadable } from "@/constants/text";
import { useCanvasStore } from "@/store";
import { fontStack } from "@/constants/fonts";

interface TextBoxProps {
  shape: CanvasObject;
  isSelected: boolean;
  /** 다중 선택 모드 (2개 이상 선택됨) */
  isMultiSelected?: boolean;
  /** 현재 줌 레벨 */
  zoom?: number;
  draggable?: boolean;
  isEditing: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDoubleClick: () => void;
  onHeightChange?: (newHeight: number) => void;
}

export const TextBox = memo(function TextBox({
  shape,
  isSelected: _isSelected,
  isMultiSelected = false,
  zoom = 1,
  draggable = true,
  isEditing,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDoubleClick,
  onHeightChange: _onHeightChange,
}: TextBoxProps) {
  void _isSelected; // Selection indicator handled by Transformer (단일 선택 시)
  const groupRef = useRef<Konva.Group>(null);

  const width = shape.width ?? 200;
  const height = shape.height ?? 40;
  const isLocked = shape.locked === true;

  return (
    <Group
      ref={groupRef}
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
      {/* 히트 영역 - 전체 영역 클릭 가능하게 (거의 투명하지만 hit detection 가능) */}
      <Rect
        width={width}
        height={height}
        fill="rgba(255,255,255,0.001)"
        perfectDrawEnabled={false}
      />
      {/* Background - 편집 중이 아닐 때만 배경/테두리 표시 */}
      {!isEditing && (
        <Rect
          width={width}
          height={height}
          fill={shape.fill ?? "transparent"}
          stroke={isLocked ? "#ef4444" : (shape.stroke ?? "transparent")}
          strokeWidth={
            isLocked
              ? 2
              : shape.stroke && shape.stroke !== "transparent"
                ? (shape.strokeWidth ?? 2)
                : 0
          }
          dash={
            isLocked
              ? [8, 4]
              : shape.lineStyle === "dashed"
                ? [8, 4]
                : shape.lineStyle === "dotted"
                  ? [2, 4]
                  : undefined
          }
          cornerRadius={4}
          perfectDrawEnabled={false}
          listening={false}
        />
      )}
      {/* Konva Text - 편집 중이 아닐 때 Canvas 내부에서 텍스트 렌더링 (DOM 없음) */}
      {!isEditing && (
        <KonvaTextContent shape={shape} width={width} height={height} />
      )}
      {/* Link indicator */}
      {shape.link && (
        <Rect
          x={width - 20}
          y={4}
          width={16}
          height={16}
          fill="#3b82f6"
          cornerRadius={2}
          opacity={0.8}
          listening={false}
        />
      )}
    </Group>
  );
});

/** Lightweight Konva-based text renderer (replaces heavy Tiptap HTML overlay) */
const KonvaTextContent = memo(function KonvaTextContent({
  shape,
  width,
  height,
}: {
  shape: CanvasObject;
  width: number;
  height: number;
}) {
  // Mixed styles (partial bold, multiple colors) → skip Konva Text, use TextViewerOverlay
  const isMixed = useMemo(
    () => (shape.tiptapContent ? hasMixedStyles(shape.tiptapContent) : false),
    [shape.tiptapContent],
  );

  const plainText = useMemo(() => {
    if (shape.tiptapContent) return tiptapToPlainText(shape.tiptapContent);
    if (shape.text) return shape.text;
    return "";
  }, [shape.tiptapContent, shape.text]);

  // Extract inline styles from tiptapContent (font, color, bold set in editor)
  const tiptapStyle = useMemo(() => {
    if (shape.tiptapContent) return extractFirstTextStyle(shape.tiptapContent);
    return {};
  }, [shape.tiptapContent]);

  const fontSize = Math.max(
    8,
    tiptapStyle.fontSize ??
      shape.fontSize ??
      TEXT_CONFIG.textBox.defaultFontSize,
  );
  // 줌 LOD — raw zoom 이 아니라 '읽을 수 있는가' boolean 을 구독한다.
  // 줌 틱마다가 아니라 임계값을 넘나들 때만 리렌더된다.
  const textReadable = useCanvasStore((s) =>
    isTextReadable(fontSize, s.viewport.zoom),
  );

  if (!plainText || isMixed || !textReadable) return null;

  const pad = TEXT_CONFIG.textBox.padding;
  const fontFamily = fontStack(tiptapStyle.fontFamily ?? shape.fontFamily);
  const fontStyle =
    tiptapStyle.fontStyle ?? (shape.fontWeight === "bold" ? "bold" : "normal");
  const textColor = tiptapStyle.color ?? shape.textColor ?? "#1f2937";

  return (
    <Text
      x={pad.left}
      y={pad.top}
      width={width - pad.left - pad.right}
      height={height - pad.top - pad.bottom}
      text={plainText}
      fontSize={fontSize}
      fontFamily={fontFamily}
      fontStyle={fontStyle}
      fill={textColor}
      align={(tiptapStyle.textAlign as string) ?? shape.textAlign ?? "left"}
      verticalAlign="top"
      lineHeight={LINE_HEIGHT}
      wrap="word"
      ellipsis={true}
      textDecoration={tiptapStyle.textDecoration}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
});
