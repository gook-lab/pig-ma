import { memo, useMemo } from "react";
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
import { isTextReadable } from "@/constants/text";
import { useCanvasStore } from "@/store";
import { LINE_HEIGHT } from "@/utils/richText";

interface StickyNoteProps {
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
  /** 편집 중일 때 true - 텍스트 숨김 (TextEditorOverlay에서 표시) */
  isEditing?: boolean;
}

export const StickyNote = memo(function StickyNote({
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
  isEditing = false,
}: StickyNoteProps) {
  void _isSelected; // Selection indicator handled by Transformer (단일 선택 시)
  const width = shape.width ?? 200;
  const height = shape.height ?? 200;
  const isLocked = shape.locked === true;

  const plainText = useMemo(() => {
    if (shape.tiptapContent) return tiptapToPlainText(shape.tiptapContent);
    if (shape.text) return shape.text;
    return "";
  }, [shape.tiptapContent, shape.text]);

  const isMixed = useMemo(
    () => (shape.tiptapContent ? hasMixedStyles(shape.tiptapContent) : false),
    [shape.tiptapContent],
  );

  const tiptapStyle = useMemo(() => {
    if (shape.tiptapContent) return extractFirstTextStyle(shape.tiptapContent);
    return {};
  }, [shape.tiptapContent]);

  const stickyFontSize = Math.max(
    8,
    tiptapStyle.fontSize ??
      shape.fontSize ??
      TEXT_CONFIG.stickyNote.defaultFontSize,
  );
  // 줌 LOD — boolean 구독: 임계값을 넘나들 때만 리렌더
  const textReadable = useCanvasStore((s) =>
    isTextReadable(stickyFontSize, s.viewport.zoom),
  );

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
      {/* 그림자 - 항상 표시 (z-order 반영을 위해) */}
      <Rect
        x={4}
        y={4}
        width={width}
        height={height}
        fill="rgba(0,0,0,0.1)"
        cornerRadius={4}
        perfectDrawEnabled={false}
        listening={false}
      />
      {/* 배경 - 항상 표시 (z-order 반영을 위해) */}
      <Rect
        width={width}
        height={height}
        fill={shape.backgroundColor ?? "#fef08a"}
        stroke={isLocked ? "#ef4444" : undefined}
        strokeWidth={isLocked ? 2 : 0}
        dash={isLocked ? [8, 4] : undefined}
        cornerRadius={4}
        perfectDrawEnabled={false}
      />
      {/* Konva Text - 편집 중이 아닐 때 Canvas 내부에서 텍스트 렌더링 */}
      {!isEditing &&
        textReadable &&
        plainText &&
        !isMixed &&
        (() => {
          const pad = TEXT_CONFIG.stickyNote.padding;
          return (
            <Text
              x={pad.left}
              y={pad.top}
              width={width - pad.left - pad.right}
              height={height - pad.top - pad.bottom}
              text={plainText}
              fontSize={Math.max(
                8,
                tiptapStyle.fontSize ??
                  shape.fontSize ??
                  TEXT_CONFIG.stickyNote.defaultFontSize,
              )}
              fontFamily={
                tiptapStyle.fontFamily ??
                shape.fontFamily ??
                "Pretendard, sans-serif"
              }
              fontStyle={
                tiptapStyle.fontStyle ??
                (shape.fontWeight === "bold" ? "bold" : "normal")
              }
              fill={tiptapStyle.color ?? shape.textColor ?? "#1f2937"}
              align={
                (tiptapStyle.textAlign as string) ?? shape.textAlign ?? "center"
              }
              verticalAlign="top"
              lineHeight={LINE_HEIGHT}
              wrap="word"
              ellipsis={true}
              textDecoration={tiptapStyle.textDecoration}
              listening={false}
              perfectDrawEnabled={false}
            />
          );
        })()}
    </Group>
  );
});
