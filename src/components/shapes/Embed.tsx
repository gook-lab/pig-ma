import { memo } from "react";
import { Group, Rect, Text, Path } from "react-konva";
import type Konva from "konva";
import type { CanvasObject } from "@/types";
import { SelectionBorder } from "@/components/SelectionBorder";

interface EmbedProps {
  shape: CanvasObject;
  isSelected: boolean;
  isMultiSelected?: boolean;
  zoom?: number;
  draggable?: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDoubleClick?: () => void;
  isPlaying?: boolean;
}

// Header height for embed type badge
const HEADER_HEIGHT = 32;

// Service colors
const SERVICE_COLORS: Record<string, string> = {
  youtube: "#FF0000",
  figma: "#F24E1E",
  notion: "#000000",
};

// YouTube play button path (simplified)
const PLAY_ICON_PATH = "M8 5v14l11-7z"; // Simple triangle

export const Embed = memo(function Embed({
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
  isPlaying = false,
}: EmbedProps) {
  const width = shape.width ?? 480;
  const height = shape.height ?? 270;
  const isLocked = shape.locked === true;
  const embedType = shape.embedType ?? "youtube";
  const metadata = shape.embedMetadata ?? {};
  const serviceColor = SERVICE_COLORS[embedType] ?? "#6b7280";

  // Display title
  const displayTitle =
    metadata.title ||
    metadata.fileName ||
    metadata.pageName ||
    (embedType === "youtube"
      ? "YouTube Video"
      : embedType === "figma"
        ? "Figma File"
        : "Notion Page");

  // Content area (below header)
  const contentHeight = height - HEADER_HEIGHT;

  // Center position for play/icon
  const centerX = width / 2;
  const centerY = HEADER_HEIGHT + contentHeight / 2;

  return (
    <Group
      id={shape.id}
      x={shape.x}
      y={shape.y}
      rotation={shape.rotation ?? 0}
      opacity={shape.opacity ?? 1}
      draggable={draggable && !isLocked}
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={onDoubleClick}
      onDblTap={onDoubleClick}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    >
      {/* Background with border */}
      <Rect
        width={width}
        height={height}
        fill="#ffffff"
        cornerRadius={8}
        stroke={isSelected ? "#3b82f6" : "#9ca3af"}
        strokeWidth={isSelected ? 2 : 1.5}
        shadowColor="#000000"
        shadowBlur={12}
        shadowOpacity={0.15}
        shadowOffsetY={4}
      />

      {/* Header */}
      <Rect
        width={width}
        height={HEADER_HEIGHT}
        fill="#f9fafb"
        cornerRadius={[8, 8, 0, 0]}
      />

      {/* Service badge */}
      <Rect
        x={10}
        y={6}
        width={embedType === "youtube" ? 70 : embedType === "notion" ? 58 : 54}
        height={20}
        fill={serviceColor}
        cornerRadius={4}
      />
      <Text
        x={10}
        y={6}
        width={embedType === "youtube" ? 70 : embedType === "notion" ? 58 : 54}
        height={20}
        text={
          embedType === "youtube"
            ? "YouTube"
            : embedType === "figma"
              ? "Figma"
              : "Notion"
        }
        fontSize={11}
        fontFamily="system-ui, sans-serif"
        fontStyle="bold"
        fill="#ffffff"
        align="center"
        verticalAlign="middle"
        listening={false}
      />

      {/* Title */}
      <Text
        x={embedType === "youtube" ? 88 : embedType === "notion" ? 76 : 72}
        y={6}
        width={
          width -
          (embedType === "youtube" ? 98 : embedType === "notion" ? 86 : 82)
        }
        height={20}
        text={displayTitle}
        fontSize={12}
        fontFamily="system-ui, sans-serif"
        fill="#374151"
        ellipsis={true}
        verticalAlign="middle"
        listening={false}
      />

      {/* Content area - thumbnail background */}
      <Rect
        y={HEADER_HEIGHT}
        width={width}
        height={contentHeight}
        fill="#1f2937"
        cornerRadius={[0, 0, 8, 8]}
        listening={false}
      />

      {/* Play icon or service icon (when not playing) */}
      {!isPlaying && (
        <>
          {embedType === "youtube" ? (
            <>
              {/* YouTube play button background */}
              <Rect
                x={centerX - 32}
                y={centerY - 22}
                width={64}
                height={44}
                fill="rgba(255, 0, 0, 0.9)"
                cornerRadius={8}
                listening={false}
              />
              {/* Play triangle */}
              <Path
                x={centerX - 10}
                y={centerY - 10}
                data={PLAY_ICON_PATH}
                fill="#ffffff"
                scaleX={1.2}
                scaleY={1.2}
                listening={false}
              />
            </>
          ) : embedType === "figma" ? (
            <>
              {/* Figma icon background */}
              <Rect
                x={centerX - 30}
                y={centerY - 30}
                width={60}
                height={60}
                fill="rgba(242, 78, 30, 0.15)"
                cornerRadius={12}
                listening={false}
              />
              {/* Figma logo placeholder (simplified) */}
              <Text
                x={centerX - 30}
                y={centerY - 12}
                width={60}
                height={24}
                text="Figma"
                fontSize={14}
                fontStyle="bold"
                fontFamily="system-ui, sans-serif"
                fill="#F24E1E"
                align="center"
                verticalAlign="middle"
                listening={false}
              />
            </>
          ) : (
            <>
              {/* Notion icon background */}
              <Rect
                x={centerX - 30}
                y={centerY - 30}
                width={60}
                height={60}
                fill="rgba(0, 0, 0, 0.1)"
                cornerRadius={12}
                listening={false}
              />
              {/* Notion logo placeholder (simplified) */}
              <Text
                x={centerX - 30}
                y={centerY - 12}
                width={60}
                height={24}
                text="Notion"
                fontSize={14}
                fontStyle="bold"
                fontFamily="system-ui, sans-serif"
                fill="#000000"
                align="center"
                verticalAlign="middle"
                listening={false}
              />
            </>
          )}

          {/* Click to play hint */}
          <Text
            x={0}
            y={height - 28}
            width={width}
            height={20}
            text="Click to load"
            fontSize={11}
            fontFamily="system-ui, sans-serif"
            fill="#6b7280"
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </>
      )}

      {/* Selection border */}
      <SelectionBorder
        width={width}
        height={height}
        zoom={zoom}
        isMultiSelected={isMultiSelected}
      />
    </Group>
  );
});
