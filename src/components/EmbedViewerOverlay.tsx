import { memo, useState, useEffect, useCallback } from "react";
import type { CanvasObject } from "@/types";
import { dragCoordinator, resizeCoordinator } from "@/hooks/useDragCoordinator";
import { getEmbedIframeUrl } from "@/utils/embed";
import { getCanvasOverlayZIndex } from "@/constants/zIndex";
import { useCanvasStore } from "@/store";

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface EmbedViewerOverlayProps {
  shape: CanvasObject;
  viewport: Viewport;
  objectIndex: number;
  isDragging?: boolean;
  onPlay?: () => void;
}

// Header height (same as Embed.tsx)
const HEADER_HEIGHT = 32;

/**
 * HTML overlay for Embed objects
 * Renders thumbnail when not playing, iframe when playing
 */
export const EmbedViewerOverlay = memo(function EmbedViewerOverlay({
  shape,
  viewport,
  objectIndex,
  isDragging = false,
  onPlay,
}: EmbedViewerOverlayProps) {
  const [dragPosition, setDragPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [resizeSize, setResizeSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Drag position tracking
  useEffect(() => {
    if (!isDragging) {
      setDragPosition(null);
      return;
    }

    const unsubscribe = dragCoordinator.subscribe(shape.id, (pos) => {
      setDragPosition(pos);
    });

    const initialPos = dragCoordinator.getPosition(shape.id);
    if (initialPos) {
      setDragPosition(initialPos);
    }

    return unsubscribe;
  }, [isDragging, shape.id]);

  // Resize tracking - always subscribe for smooth resizing
  useEffect(() => {
    const unsubscribe = resizeCoordinator.subscribe(shape.id, (size) => {
      setResizeSize(size);
    });

    // Check for initial resize state
    const initialSize = resizeCoordinator.getSize(shape.id);
    if (initialSize) {
      setResizeSize(initialSize);
    }

    return unsubscribe;
  }, [shape.id]);

  const currentX = dragPosition?.x ?? shape.x;
  const currentY = dragPosition?.y ?? shape.y;

  // Use resize size if available, otherwise fall back to shape dimensions
  const width = resizeSize?.width ?? shape.width ?? 480;
  const height = resizeSize?.height ?? shape.height ?? 270;
  const embedType = shape.embedType ?? "youtube";
  const metadata = shape.embedMetadata ?? {};
  const isPlaying = shape.isPlaying ?? false;

  // Calculate screen position
  const screenX = currentX * viewport.zoom + viewport.x;
  const screenY = currentY * viewport.zoom + viewport.y;
  const screenWidth = width * viewport.zoom;
  const screenHeight = height * viewport.zoom;
  const screenHeaderHeight = HEADER_HEIGHT * viewport.zoom;

  // Content area position
  const contentTop = screenY + screenHeaderHeight;
  const contentHeight = screenHeight - screenHeaderHeight;

  const handleClick = useCallback(() => {
    if (!isPlaying && onPlay) {
      onPlay();
    }
  }, [isPlaying, onPlay]);

  // Generate iframe URL
  const iframeUrl = isPlaying ? getEmbedIframeUrl(embedType, metadata) : "";

  // Thumbnail URL
  const thumbnailUrl = metadata.thumbnailUrl;

  // z-index for canvas overlay
  const zIndex = getCanvasOverlayZIndex(objectIndex);

  return (
    <>
      {/* Thumbnail/iframe container - positioned below header */}
      <div
        className="absolute overflow-hidden"
        style={{
          left: screenX,
          top: contentTop,
          width: screenWidth,
          height: contentHeight,
          zIndex,
          borderRadius: `0 0 ${8 * viewport.zoom}px ${8 * viewport.zoom}px`,
          cursor: !isPlaying ? "pointer" : "default",
          pointerEvents: isDragging ? "none" : "auto",
        }}
        onClick={handleClick}
      >
        {isPlaying ? (
          embedType === "youtube" ? (
            // 유튜브는 16:9 aspect-fit — 레터박스(검은 여백)를 iframe 안이
            // 아니라 이 컨테이너에 남긴다. iframe 내부(크로스오리진) 클릭은
            // 가로챌 수 없지만, 여백은 우리 div 라서 클릭 시 임베드가
            // 선택된다.
            (() => {
              const ratio = 16 / 9;
              const fitWidth = Math.min(screenWidth, contentHeight * ratio);
              const fitHeight = fitWidth / ratio;
              return (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{ backgroundColor: "#000" }}
                  onMouseDown={(e) => {
                    // iframe 위 클릭은 여기 도달하지 않는다 — 여백 전용
                    e.stopPropagation();
                    useCanvasStore.getState().setSelectedIds([shape.id]);
                  }}
                >
                  <iframe
                    src={iframeUrl}
                    title={metadata.title || "Embedded content"}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    style={{
                      width: fitWidth,
                      height: fitHeight,
                      border: "none",
                      flexShrink: 0,
                    }}
                  />
                </div>
              );
            })()
          ) : (
            // 그 외 임베드(Figma/Notion 등)는 전체 채움
            <iframe
              src={iframeUrl}
              title={metadata.title || "Embedded content"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              style={{
                width: "100%",
                height: "100%",
                border: "none",
              }}
            />
          )
        ) : (
          // Thumbnail when not playing
          <div className="relative h-full w-full">
            {/* Thumbnail image */}
            {thumbnailUrl && !imageError ? (
              <img
                src={thumbnailUrl}
                alt={metadata.title || "Thumbnail"}
                className="h-full w-full object-cover"
                style={{
                  opacity: imageLoaded ? 1 : 0,
                  transition: "opacity 0.2s",
                }}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
            ) : null}

            {/* Placeholder/fallback background */}
            {(!thumbnailUrl || imageError || !imageLoaded) && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center"
                style={{
                  backgroundColor: "#1f2937",
                }}
              >
                {embedType === "youtube" ? (
                  // YouTube play button
                  <div
                    className="flex items-center justify-center rounded-lg"
                    style={{
                      width: 68 * viewport.zoom,
                      height: 48 * viewport.zoom,
                      backgroundColor: "rgba(255, 0, 0, 0.9)",
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="white"
                      style={{
                        width: 24 * viewport.zoom,
                        height: 24 * viewport.zoom,
                      }}
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                ) : embedType === "figma" ? (
                  // Figma icon
                  <div
                    className="flex flex-col items-center justify-center rounded-xl"
                    style={{
                      width: 60 * viewport.zoom,
                      height: 60 * viewport.zoom,
                      backgroundColor: "rgba(242, 78, 30, 0.15)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14 * viewport.zoom,
                        fontWeight: "bold",
                        color: "#F24E1E",
                      }}
                    >
                      Figma
                    </span>
                  </div>
                ) : (
                  // Notion icon
                  <div
                    className="flex flex-col items-center justify-center rounded-xl"
                    style={{
                      width: 60 * viewport.zoom,
                      height: 60 * viewport.zoom,
                      backgroundColor: "rgba(0, 0, 0, 0.1)",
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="#000000"
                      style={{
                        width: 28 * viewport.zoom,
                        height: 28 * viewport.zoom,
                      }}
                    >
                      <path
                        d="M4 4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z M14 2v6h6 M8 13h8 M8 17h8 M8 9h4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </div>
            )}

            {/* Hover overlay for YouTube thumbnail */}
            {thumbnailUrl && imageLoaded && !imageError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity hover:opacity-100">
                {embedType === "youtube" && (
                  <div
                    className="flex items-center justify-center rounded-lg"
                    style={{
                      width: 68 * viewport.zoom,
                      height: 48 * viewport.zoom,
                      backgroundColor: "rgba(255, 0, 0, 0.9)",
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="white"
                      style={{
                        width: 24 * viewport.zoom,
                        height: 24 * viewport.zoom,
                      }}
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                )}
              </div>
            )}

            {/* Click to load hint */}
            <div
              className="absolute right-0 bottom-0 left-0 flex items-center justify-center"
              style={{
                height: 28 * viewport.zoom,
                backgroundColor: "rgba(0, 0, 0, 0.6)",
                fontSize: 11 * viewport.zoom,
                color: "#9ca3af",
              }}
            >
              Click to load
            </div>
          </div>
        )}
      </div>
    </>
  );
});
