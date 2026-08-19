import { memo } from "react";
import { Group, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { CanvasObject } from "@/types";
import { SelectionBorder } from "@/components/SelectionBorder";

interface CodeBlockProps {
  shape: CanvasObject;
  isSelected: boolean;
  isMultiSelected?: boolean;
  zoom?: number;
  draggable?: boolean;
  tool?: string;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDoubleClick?: () => void;
  onHeaderDoubleClick?: () => void;
  isEditing?: boolean;
  isEditingTitle?: boolean;
}

// Language badge colors
const LANGUAGE_COLORS: Record<string, string> = {
  javascript: "#f7df1e",
  typescript: "#3178c6",
  python: "#3776ab",
  java: "#b07219",
  go: "#00add8",
  rust: "#dea584",
  ruby: "#cc342d",
  php: "#777bb4",
  swift: "#fa7343",
  kotlin: "#a97bff",
  html: "#e34c26",
  css: "#264de4",
  json: "#292929",
  yaml: "#cb171e",
  sql: "#e38c00",
  bash: "#4eaa25",
  default: "#6b7280",
};

export const CodeBlock = memo(function CodeBlock({
  shape,
  isSelected: _isSelected,
  isMultiSelected = false,
  zoom = 1,
  draggable = true,
  tool = "select",
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDoubleClick,
  onHeaderDoubleClick,
  isEditing: _isEditing = false,
  isEditingTitle = false,
}: CodeBlockProps) {
  void _isSelected; // Used by CodeBlockViewerOverlay
  void _isEditing; // Reserved for future use
  const width = shape.width ?? 400;
  const height = shape.height ?? 200;
  const isLocked = shape.locked === true;
  const code = shape.code ?? "";
  const title = shape.codeTitle ?? "";
  const language = shape.codeLanguage ?? "plaintext";
  const theme = shape.codeTheme ?? "dark";
  const backgroundColor =
    shape.backgroundColor ?? (theme === "dark" ? "#383838" : "#ffffff");
  const headerColor = theme === "dark" ? "#2d2d2d" : "#f3f4f6";
  const titleColor = theme === "dark" ? "#9ca3af" : "#6b7280";
  const lineCountColor = theme === "dark" ? "#6b7280" : "#9ca3af";
  const borderColor = theme === "dark" ? "#374151" : "#d1d5db";

  // Custom text cursor based on theme (white for dark when using select tool)
  const textCursor =
    tool === "select" && theme === "dark"
      ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath d='M4 2h8v1H9v10h3v1H4v-1h3V3H4V2z' fill='white'/%3E%3C/svg%3E") 8 8, text`
      : tool === "select"
        ? "text"
        : "default";

  // Calculate header height for language badge
  const headerHeight = 28;
  const padding = 12;

  // Badge width calculation
  const badgeWidth = Math.max(60, language.length * 7 + 16);
  // Title start position (after badge + gap)
  const titleStartX = padding + badgeWidth + 8;
  // Available width for title (before line count)
  const titleMaxWidth = width - titleStartX - 70;

  const languageColor = LANGUAGE_COLORS[language] ?? LANGUAGE_COLORS.default;

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
    >
      {/* Multi-selection border */}
      <SelectionBorder
        width={width}
        height={height}
        zoom={zoom}
        isMultiSelected={isMultiSelected}
      />

      {/* Shadow */}
      <Rect
        x={3}
        y={3}
        width={width}
        height={height}
        fill="rgba(0,0,0,0.2)"
        cornerRadius={8}
        perfectDrawEnabled={false}
        listening={false}
      />

      {/* Background */}
      <Rect
        width={width}
        height={height}
        fill={backgroundColor}
        stroke={isLocked ? "#ef4444" : borderColor}
        strokeWidth={isLocked ? 2 : 1}
        dash={isLocked ? [8, 4] : undefined}
        cornerRadius={8}
        perfectDrawEnabled={false}
        cursor="default"
      />

      {/* Header with language badge - clickable for title editing */}
      <Group y={0}>
        {/* Header background - clickable */}
        <Rect
          width={width}
          height={headerHeight}
          fill={headerColor}
          cornerRadius={[8, 8, 0, 0]}
          perfectDrawEnabled={false}
          cursor={textCursor}
          onClick={(e) => {
            e.cancelBubble = true;
            onSelect(e);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            onSelect(e);
          }}
          onDblClick={(e) => {
            e.cancelBubble = true;
            onHeaderDoubleClick?.();
          }}
          onDblTap={(e) => {
            e.cancelBubble = true;
            onHeaderDoubleClick?.();
          }}
        />

        {/* Language badge */}
        <Rect
          x={padding}
          y={6}
          width={badgeWidth}
          height={16}
          fill={languageColor}
          cornerRadius={4}
          perfectDrawEnabled={false}
          listening={false}
        />
        <Text
          x={padding + 8}
          y={8}
          text={language}
          fontSize={10}
          fontFamily="IBM Plex Mono, monospace"
          fill={
            language === "javascript" || language === "json" ? "#000" : "#fff"
          }
          listening={false}
        />

        {/* Title (if exists and not editing) */}
        {title && !isEditingTitle && (
          <Text
            x={titleStartX}
            y={8}
            width={titleMaxWidth}
            text={title}
            fontSize={11}
            fontFamily="IBM Plex Mono, monospace"
            fill={titleColor}
            ellipsis={true}
            listening={false}
          />
        )}

        {/* Line count */}
        <Text
          x={width - padding - 60}
          y={8}
          width={60}
          text={`${code.split("\n").length} lines`}
          fontSize={10}
          fontFamily="IBM Plex Mono, monospace"
          fill={lineCountColor}
          align="right"
          listening={false}
        />
      </Group>

      {/* Code area - double click for code editing */}
      <Rect
        y={headerHeight}
        width={width}
        height={height - headerHeight}
        fill="transparent"
        cursor={textCursor}
        onClick={(e) => {
          e.cancelBubble = true;
          onSelect(e);
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onSelect(e);
        }}
        onDblClick={(e) => {
          e.cancelBubble = true;
          onDoubleClick?.();
        }}
        onDblTap={(e) => {
          e.cancelBubble = true;
          onDoubleClick?.();
        }}
      />

      {/* Code content is rendered by CodeBlockViewerOverlay (HTML with syntax highlighting) */}
    </Group>
  );
});
