import { memo, useState, useCallback } from "react";
import { Group, Circle, Text, Rect } from "react-konva";
import type { CaptionThread } from "@/types";
import type Konva from "konva";

interface CaptionMarkerProps {
  caption: CaptionThread;
  index: number; // 1-based index for display
  zoom: number;
  onClick: () => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}

const MARKER_RADIUS = 16;
const UNREAD_COLOR = "#3b82f6"; // blue-500
const READ_COLOR = "#6b7280"; // gray-500
const RESOLVED_COLOR = "#22c55e"; // green-500

export const CaptionMarker = memo(function CaptionMarker({
  caption,
  index,
  zoom,
  onClick,
  onDragEnd,
}: CaptionMarkerProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const baseRadius = MARKER_RADIUS / zoom;
  const currentRadius = isHovered || isDragging ? baseRadius * 1.2 : baseRadius;
  const fontSize = 11 / zoom;

  // Determine color based on state
  let fillColor = UNREAD_COLOR;
  if (caption.isResolved) {
    fillColor = RESOLVED_COLOR;
  } else if (caption.isRead) {
    fillColor = READ_COLOR;
  }

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      setIsDragging(false);
      const node = e.target;
      onDragEnd(caption.id, node.x(), node.y());
    },
    [caption.id, onDragEnd],
  );

  const handleClick = useCallback(() => {
    // Only trigger click if not dragging
    if (!isDragging) {
      onClick();
    }
  }, [isDragging, onClick]);

  return (
    <Group
      name="caption-marker"
      x={caption.x}
      y={caption.y}
      draggable
      onClick={handleClick}
      onTap={handleClick}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Shadow for depth */}
      <Circle
        radius={currentRadius + 1 / zoom}
        fill="rgba(0,0,0,0.2)"
        offsetY={-2 / zoom}
      />

      {/* Main circle */}
      <Circle
        radius={currentRadius}
        fill={isDragging ? "#1d4ed8" : fillColor}
        stroke="white"
        strokeWidth={2 / zoom}
      />

      {/* Index number */}
      <Text
        text={String(index)}
        fontSize={fontSize}
        fontFamily="system-ui, sans-serif"
        fontStyle="bold"
        fill="white"
        align="center"
        verticalAlign="middle"
        offsetX={index >= 10 ? fontSize * 0.6 : fontSize * 0.3}
        offsetY={fontSize * 0.45}
      />

      {/* Unread indicator - small dot */}
      {!caption.isRead && !caption.isResolved && (
        <Circle
          x={baseRadius * 0.7}
          y={-baseRadius * 0.7}
          radius={4 / zoom}
          fill="#ef4444"
          stroke="white"
          strokeWidth={1 / zoom}
        />
      )}

      {/* Reply count badge */}
      {caption.messages.length > 1 && (
        <Group x={baseRadius * 0.5} y={baseRadius * 0.5}>
          <Rect
            width={16 / zoom}
            height={12 / zoom}
            offsetX={8 / zoom}
            offsetY={6 / zoom}
            fill="white"
            cornerRadius={6 / zoom}
            stroke={fillColor}
            strokeWidth={1 / zoom}
          />
          <Text
            text={String(caption.messages.length - 1)}
            fontSize={8 / zoom}
            fontFamily="system-ui, sans-serif"
            fontStyle="bold"
            fill={fillColor}
            align="center"
            verticalAlign="middle"
            offsetX={4 / zoom}
            offsetY={4 / zoom}
          />
        </Group>
      )}

      {/* Hover tooltip - first message preview */}
      {isHovered && !isDragging && (
        <Group y={-baseRadius - 10 / zoom}>
          <Rect
            x={-80 / zoom}
            y={-30 / zoom}
            width={160 / zoom}
            height={25 / zoom}
            fill="rgba(31, 41, 55, 0.95)"
            cornerRadius={4 / zoom}
          />
          <Text
            text={
              (caption.messages[0]?.content?.slice(0, 20) ?? "") +
              ((caption.messages[0]?.content?.length ?? 0) > 20 ? "..." : "")
            }
            fontSize={10 / zoom}
            fontFamily="system-ui, sans-serif"
            fill="white"
            width={150 / zoom}
            x={-75 / zoom}
            y={-25 / zoom}
            align="center"
          />
        </Group>
      )}
    </Group>
  );
});
