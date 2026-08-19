import { memo, useCallback, useRef, useMemo } from "react";
import type { CanvasObject } from "@/types";

interface CanvasScrollbarsProps {
  objects: CanvasObject[];
  viewport: { x: number; y: number; zoom: number };
  stageSize: { width: number; height: number };
  onViewportChange: (x: number, y: number) => void;
}

// 스크롤바 스타일 상수
const SCROLLBAR_SIZE = 8;
const SCROLLBAR_MARGIN = 4;
const MIN_THUMB_SIZE = 30;

// 최소 줌 (10%)에서의 최대 뷰포트를 기준으로 bounds 설정
const MIN_ZOOM = 0.1;

export const CanvasScrollbars = memo(function CanvasScrollbars({
  objects,
  viewport,
  stageSize,
  onViewportChange,
}: CanvasScrollbarsProps) {
  const hTrackRef = useRef<HTMLDivElement>(null);
  const vTrackRef = useRef<HTMLDivElement>(null);
  const isDraggingH = useRef(false);
  const isDraggingV = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragStartViewport = useRef({ x: 0, y: 0 });

  // 캔버스 bounds 계산 (10% 줌 기준 + 객체 위치 고려 동적 확장)
  const bounds = useMemo(() => {
    // 10% 줌에서의 최대 뷰포트 크기를 기준으로 기본 범위 설정
    const maxViewportWidth = stageSize.width / MIN_ZOOM;
    const maxViewportHeight = stageSize.height / MIN_ZOOM;

    // 중심점 (0, 0) 기준 기본 범위
    let minX = -maxViewportWidth / 2;
    let minY = -maxViewportHeight / 2;
    let maxX = maxViewportWidth / 2;
    let maxY = maxViewportHeight / 2;

    // 객체 위치에 따라 bounds 동적 확장
    objects.forEach((obj) => {
      const x = obj.x;
      const y = obj.y;
      const width = obj.width ?? 100;
      const height = obj.height ?? 100;
      minX = Math.min(minX, x - 200);
      minY = Math.min(minY, y - 200);
      maxX = Math.max(maxX, x + width + 200);
      maxY = Math.max(maxY, y + height + 200);
    });

    return { minX, minY, maxX, maxY };
  }, [stageSize, objects]);

  // 현재 뷰포트의 캔버스 좌표
  const viewportCanvas = useMemo(() => {
    const left = -viewport.x / viewport.zoom;
    const top = -viewport.y / viewport.zoom;
    const width = stageSize.width / viewport.zoom;
    const height = stageSize.height / viewport.zoom;
    return { left, top, width, height };
  }, [viewport, stageSize]);

  // bounds 크기
  const boundsSize = useMemo(
    () => ({
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY,
    }),
    [bounds],
  );

  // 스크롤바 표시 여부 (뷰포트가 전체보다 작을 때만)
  const showHorizontal = viewportCanvas.width < boundsSize.width;
  const showVertical = viewportCanvas.height < boundsSize.height;

  // 가로 스크롤바 계산
  const hScrollbar = useMemo(() => {
    if (!showHorizontal) return null;

    const trackWidth =
      stageSize.width -
      SCROLLBAR_MARGIN * 2 -
      (showVertical ? SCROLLBAR_SIZE + SCROLLBAR_MARGIN : 0);
    const thumbRatio = Math.min(1, viewportCanvas.width / boundsSize.width);
    const thumbWidth = Math.max(MIN_THUMB_SIZE, trackWidth * thumbRatio);

    // 뷰포트 위치를 스크롤바 위치로 변환
    const scrollRange = boundsSize.width - viewportCanvas.width;
    const viewportOffset = viewportCanvas.left - bounds.minX;
    const scrollRatio = scrollRange > 0 ? viewportOffset / scrollRange : 0;
    const thumbX =
      (trackWidth - thumbWidth) * Math.max(0, Math.min(1, scrollRatio));

    return { trackWidth, thumbWidth, thumbX };
  }, [
    showHorizontal,
    showVertical,
    stageSize.width,
    viewportCanvas,
    boundsSize,
    bounds.minX,
  ]);

  // 세로 스크롤바 계산
  const vScrollbar = useMemo(() => {
    if (!showVertical) return null;

    const trackHeight =
      stageSize.height -
      SCROLLBAR_MARGIN * 2 -
      (showHorizontal ? SCROLLBAR_SIZE + SCROLLBAR_MARGIN : 0) -
      100; // 툴바 여유
    const thumbRatio = Math.min(1, viewportCanvas.height / boundsSize.height);
    const thumbHeight = Math.max(MIN_THUMB_SIZE, trackHeight * thumbRatio);

    // 뷰포트 위치를 스크롤바 위치로 변환
    const scrollRange = boundsSize.height - viewportCanvas.height;
    const viewportOffset = viewportCanvas.top - bounds.minY;
    const scrollRatio = scrollRange > 0 ? viewportOffset / scrollRange : 0;
    const thumbY =
      (trackHeight - thumbHeight) * Math.max(0, Math.min(1, scrollRatio));

    return { trackHeight, thumbHeight, thumbY };
  }, [
    showVertical,
    showHorizontal,
    stageSize.height,
    viewportCanvas,
    boundsSize,
    bounds.minY,
  ]);

  // 가로 스크롤바 드래그
  const handleHMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDraggingH.current = true;
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      dragStartViewport.current = { x: viewport.x, y: viewport.y };

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDraggingH.current || !hScrollbar) return;

        const deltaX = e.clientX - dragStartPos.current.x;
        const trackWidth = hScrollbar.trackWidth;
        const thumbWidth = hScrollbar.thumbWidth;
        const scrollableTrack = trackWidth - thumbWidth;

        if (scrollableTrack <= 0) return;

        // 스크롤바 이동량을 캔버스 이동량으로 변환
        const scrollRange = boundsSize.width - viewportCanvas.width;
        const canvasDelta = (deltaX / scrollableTrack) * scrollRange;

        const newViewportX =
          dragStartViewport.current.x - canvasDelta * viewport.zoom;
        onViewportChange(newViewportX, viewport.y);
      };

      const handleMouseUp = () => {
        isDraggingH.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [
      viewport,
      hScrollbar,
      boundsSize.width,
      viewportCanvas.width,
      onViewportChange,
    ],
  );

  // 세로 스크롤바 드래그
  const handleVMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDraggingV.current = true;
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      dragStartViewport.current = { x: viewport.x, y: viewport.y };

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDraggingV.current || !vScrollbar) return;

        const deltaY = e.clientY - dragStartPos.current.y;
        const trackHeight = vScrollbar.trackHeight;
        const thumbHeight = vScrollbar.thumbHeight;
        const scrollableTrack = trackHeight - thumbHeight;

        if (scrollableTrack <= 0) return;

        // 스크롤바 이동량을 캔버스 이동량으로 변환
        const scrollRange = boundsSize.height - viewportCanvas.height;
        const canvasDelta = (deltaY / scrollableTrack) * scrollRange;

        const newViewportY =
          dragStartViewport.current.y - canvasDelta * viewport.zoom;
        onViewportChange(viewport.x, newViewportY);
      };

      const handleMouseUp = () => {
        isDraggingV.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [
      viewport,
      vScrollbar,
      boundsSize.height,
      viewportCanvas.height,
      onViewportChange,
    ],
  );

  // 트랙 클릭 (페이지 점프)
  const handleHTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (!hTrackRef.current || !hScrollbar) return;

      const rect = hTrackRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const trackWidth = hScrollbar.trackWidth;
      const thumbWidth = hScrollbar.thumbWidth;
      const scrollableTrack = trackWidth - thumbWidth;

      if (scrollableTrack <= 0) return;

      // 클릭 위치를 중심으로 이동
      const targetThumbX = clickX - thumbWidth / 2;
      const scrollRatio = Math.max(
        0,
        Math.min(1, targetThumbX / scrollableTrack),
      );
      const scrollRange = boundsSize.width - viewportCanvas.width;
      const targetCanvasX = bounds.minX + scrollRatio * scrollRange;

      const newViewportX = -targetCanvasX * viewport.zoom;
      onViewportChange(newViewportX, viewport.y);
    },
    [
      hScrollbar,
      boundsSize.width,
      viewportCanvas.width,
      bounds.minX,
      viewport,
      onViewportChange,
    ],
  );

  const handleVTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (!vTrackRef.current || !vScrollbar) return;

      const rect = vTrackRef.current.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const trackHeight = vScrollbar.trackHeight;
      const thumbHeight = vScrollbar.thumbHeight;
      const scrollableTrack = trackHeight - thumbHeight;

      if (scrollableTrack <= 0) return;

      // 클릭 위치를 중심으로 이동
      const targetThumbY = clickY - thumbHeight / 2;
      const scrollRatio = Math.max(
        0,
        Math.min(1, targetThumbY / scrollableTrack),
      );
      const scrollRange = boundsSize.height - viewportCanvas.height;
      const targetCanvasY = bounds.minY + scrollRatio * scrollRange;

      const newViewportY = -targetCanvasY * viewport.zoom;
      onViewportChange(viewport.x, newViewportY);
    },
    [
      vScrollbar,
      boundsSize.height,
      viewportCanvas.height,
      bounds.minY,
      viewport,
      onViewportChange,
    ],
  );

  if (!showHorizontal && !showVertical) return null;

  return (
    <>
      {/* 가로 스크롤바 */}
      {showHorizontal && hScrollbar && (
        <div
          ref={hTrackRef}
          className="fixed bottom-4 left-4 cursor-pointer rounded-full bg-gray-200/50 transition-colors hover:bg-gray-200/80"
          style={{
            width: hScrollbar.trackWidth,
            height: SCROLLBAR_SIZE,
            right: showVertical ? SCROLLBAR_SIZE + SCROLLBAR_MARGIN * 2 + 4 : 4,
          }}
          onClick={handleHTrackClick}
        >
          <div
            className="absolute cursor-grab rounded-full bg-gray-400 transition-colors hover:bg-gray-500 active:cursor-grabbing active:bg-gray-600"
            style={{
              width: hScrollbar.thumbWidth,
              height: SCROLLBAR_SIZE,
              left: hScrollbar.thumbX,
            }}
            onMouseDown={handleHMouseDown}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* 세로 스크롤바 */}
      {showVertical && vScrollbar && (
        <div
          ref={vTrackRef}
          className="fixed top-20 right-4 cursor-pointer rounded-full bg-gray-200/50 transition-colors hover:bg-gray-200/80"
          style={{
            width: SCROLLBAR_SIZE,
            height: vScrollbar.trackHeight,
          }}
          onClick={handleVTrackClick}
        >
          <div
            className="absolute cursor-grab rounded-full bg-gray-400 transition-colors hover:bg-gray-500 active:cursor-grabbing active:bg-gray-600"
            style={{
              width: SCROLLBAR_SIZE,
              height: vScrollbar.thumbHeight,
              top: vScrollbar.thumbY,
            }}
            onMouseDown={handleVMouseDown}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
});
