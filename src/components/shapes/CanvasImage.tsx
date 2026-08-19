import { memo, useEffect, useState } from "react";
import { Group, Image as KonvaImage, Rect } from "react-konva";
import type Konva from "konva";
import type { CanvasObject } from "@/types";
import { SelectionBorder } from "@/components/SelectionBorder";

// 디코드된 이미지 캐시 (src → HTMLImageElement).
//
// 뷰포트 가상화로 화면 밖 이미지는 언마운트되는데, 캐시가 없으면 스크롤로
// 다시 들어올 때마다 dataURL 을 재디코드하고 그동안 이미지가 사라져
// 깜빡인다. 캐시 히트면 마운트 즉시 동기 렌더링된다.
const MAX_CACHE_ENTRIES = 100;
const imageCache = new Map<string, HTMLImageElement>();

function getCachedImage(src: string): HTMLImageElement | undefined {
  const hit = imageCache.get(src);
  if (hit) {
    // LRU: 최근 사용을 뒤로 보낸다
    imageCache.delete(src);
    imageCache.set(src, hit);
  }
  return hit;
}

function cacheImage(src: string, img: HTMLImageElement): void {
  imageCache.set(src, img);
  if (imageCache.size > MAX_CACHE_ENTRIES) {
    const oldest = imageCache.keys().next().value;
    if (oldest !== undefined) imageCache.delete(oldest);
  }
}

interface CanvasImageProps {
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
}

export const CanvasImage = memo(function CanvasImage({
  shape,
  isSelected: _isSelected,
  isMultiSelected = false,
  zoom = 1,
  draggable = true,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
}: CanvasImageProps) {
  void _isSelected; // Selection indicator handled by Transformer (단일 선택 시)
  // 이미지는 캐시에서 렌더 시점에 파생한다 — 캐시 히트면 첫 렌더부터
  // 즉시 표시되어 뷰포트 재진입 시 깜빡임이 없다. 미스면 effect 가
  // 디코드를 걸고, 완료 시 리렌더만 트리거한다.
  const image = shape.src ? (getCachedImage(shape.src) ?? null) : null;
  const [, forceRender] = useState(0);

  const width = shape.width ?? 100;
  const height = shape.height ?? 100;

  useEffect(() => {
    const src = shape.src;
    if (!src || imageCache.has(src)) return;

    let cancelled = false;
    const img = new window.Image();
    img.src = src;
    img.onload = () => {
      cacheImage(src, img);
      if (!cancelled) forceRender((n) => n + 1);
    };
    return () => {
      cancelled = true;
    };
  }, [shape.src]);

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
      {/* 다중 선택 시 개별 선택 테두리 */}
      <SelectionBorder
        width={width}
        height={height}
        zoom={zoom}
        isMultiSelected={isMultiSelected}
      />
      {image ? (
        <KonvaImage
          width={width}
          height={height}
          image={image}
          {...(shape.crop
            ? {
                crop: shape.crop,
              }
            : {})}
          perfectDrawEnabled={false}
        />
      ) : (
        // 디코드 중 플레이스홀더 — 예전에는 null 을 반환해 자리 자체가
        // 사라졌다 (선택·드래그도 불가). 자리를 지키면 로딩 팝이 없다.
        <Rect
          width={width}
          height={height}
          fill="#f3f4f6"
          stroke="#e5e7eb"
          strokeWidth={1}
          cornerRadius={2}
        />
      )}
    </Group>
  );
});
