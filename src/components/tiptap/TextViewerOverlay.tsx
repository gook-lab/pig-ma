import { useMemo, memo, useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { TiptapEditor } from "./TiptapEditor";
import type { JSONContent } from "@tiptap/core";
import {
  textSegmentsToTiptap,
  plainTextToTiptap,
  createEmptyTiptapContent,
} from "@/utils/tiptapMigration";
import { dragCoordinator } from "@/hooks/useDragCoordinator";
import type { CanvasObject } from "@/types";
import { TEXT_CONFIG } from "@/utils/textConfig";

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface TextViewerOverlayProps {
  shape: CanvasObject;
  viewport: Viewport;
  zIndex: number;
  /** 선택된 상태 - 선택 시 배경/그림자 숨김 (Konva에서 렌더링) */
  isSelected?: boolean;
  /** 드래그 중인지 여부 - 드래그 중이면 dragCoordinator 구독 */
  isDragging?: boolean;
  /** 다른 객체에 가려진 상태 - 가려지면 숨김 (z-order 반영) */
  isObscured?: boolean;
}

/**
 * 비편집 상태에서 텍스트를 렌더링하는 경량 오버레이
 * generateHTML을 사용하여 Tiptap 인스턴스 생성 없이 렌더링
 */
export const TextViewerOverlay = memo(function TextViewerOverlay({
  shape,
  viewport,
  zIndex,
  isSelected = false,
  isDragging = false,
  isObscured = false,
}: TextViewerOverlayProps) {
  // 다른 객체에 가려진 경우 렌더링하지 않음 (z-order 반영)
  // 단, 선택된 상태에서는 항상 표시 (선택한 객체는 보여야 함)
  if (isObscured && !isSelected) {
    return null;
  }
  // 드래그 중일 때 실시간 위치 추적
  const [dragPosition, setDragPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!isDragging) {
      setDragPosition(null);
      return;
    }

    // 드래그 중이면 dragCoordinator 구독
    const unsubscribe = dragCoordinator.subscribe(shape.id, (pos) => {
      setDragPosition(pos);
    });

    // 초기 위치 설정
    const initialPos = dragCoordinator.getPosition(shape.id);
    if (initialPos) {
      setDragPosition(initialPos);
    }

    return unsubscribe;
  }, [isDragging, shape.id]);

  // 드래그 중이면 dragPosition 사용, 아니면 shape 위치 사용
  const currentX = dragPosition?.x ?? shape.x;
  const currentY = dragPosition?.y ?? shape.y;

  const content = useMemo((): JSONContent => {
    if (shape.tiptapContent) return shape.tiptapContent;
    if (shape.richText && shape.richText.length > 0) {
      return textSegmentsToTiptap(shape.richText, shape.lineIndents);
    }
    if (shape.text) {
      return plainTextToTiptap(shape.text);
    }
    return createEmptyTiptapContent();
  }, [shape.tiptapContent, shape.richText, shape.text, shape.lineIndents]);

  // 내용이 비어있는지 확인
  const isEmpty =
    !content.content ||
    content.content.length === 0 ||
    content.content.every(
      (node) =>
        node.type === "paragraph" &&
        (!node.content || node.content.length === 0),
    );

  const isStickyNote = shape.type === "stickyNote";
  const isTextBox = shape.type === "textBox";
  // 원본 크기 (줌 적용 전)
  const width = shape.width ?? 200;
  const height = shape.height ?? 100;

  // TEXT_CONFIG에서 타입별 padding 가져오기
  const getPadding = () => {
    if (isStickyNote) {
      const p = TEXT_CONFIG.stickyNote.padding;
      return `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px`;
    }
    if (isTextBox) {
      const p = TEXT_CONFIG.textBox.padding;
      return `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px`;
    }
    return "8px"; // 기본값
  };

  const style: CSSProperties = {
    position: "fixed",
    // 화면 좌표로 변환
    left: currentX * viewport.zoom + viewport.x,
    top: currentY * viewport.zoom + viewport.y,
    // 원본 크기 유지 (transform으로 스케일)
    width,
    minHeight: height,
    // 회전과 스케일을 함께 적용 - 원본 비율 유지
    transform: `scale(${viewport.zoom}) rotate(${shape.rotation ?? 0}deg)`,
    transformOrigin: "top left",
    pointerEvents: "none", // 전체는 비활성화, 링크만 CSS로 활성화
    zIndex,
    padding: getPadding(),
    boxSizing: "border-box",
    overflowX: "hidden" as const,
    overflowY: "visible" as const,
    wordBreak: "break-word",
  };

  // StickyNote 배경은 항상 Konva에서만 렌더링 (z-order 반영을 위해)
  // HTML에서는 텍스트만 렌더링

  return (
    <>
      {/* 메인 컨테이너 */}
      <div style={style}>
        {/* 내용이 있으면 TiptapEditor(editable=false)로 렌더링 - 편집 모드와 동일한 렌더링 보장 */}
        {/* key에 _contentVersion 포함하여 content 변경 시 리마운트 */}
        {!isEmpty && (
          <TiptapEditor
            key={`${shape.id}-${shape._contentVersion ?? 0}`}
            content={content}
            onChange={() => {}}
            editable={false}
            defaultFontSize={shape.fontSize ?? 16}
            defaultFontFamily={shape.fontFamily ?? "Pretendard"}
            defaultTextColor={shape.textColor ?? "#1f2937"}
            defaultTextAlign={
              (shape.textAlign as "left" | "center" | "right") ?? "center"
            }
            className="tiptap-viewer-mode"
          />
        )}

        {/* 내용이 없으면 플레이스홀더 표시 */}
        {isEmpty && (
          <div
            style={{
              color: "#9ca3af",
              fontSize: `${Math.max(8, shape.fontSize ?? 16)}px`,
              fontFamily: shape.fontFamily ?? "Pretendard",
            }}
          >
            {isStickyNote ? "텍스트를 입력하세요..." : "Add text"}
          </div>
        )}

        {/* StickyNote 작성자명 */}
        {isStickyNote && shape.authorName && (
          <div
            style={{
              position: "absolute",
              left: `${TEXT_CONFIG.stickyNote.padding.left}px`,
              bottom: "4px",
              fontSize: "10px",
              color: "#9ca3af",
              fontStyle: "italic",
            }}
          >
            {shape.authorName}
          </div>
        )}
      </div>
    </>
  );
});

/**
 * 가상화를 위한 뷰포트 내 가시성 체크
 */
export function isInViewport(
  shape: CanvasObject,
  viewport: Viewport,
  windowWidth: number,
  windowHeight: number,
): boolean {
  const padding = 100; // 여유 공간

  const shapeScreenX = shape.x * viewport.zoom + viewport.x;
  const shapeScreenY = shape.y * viewport.zoom + viewport.y;
  const shapeScreenWidth = (shape.width ?? 200) * viewport.zoom;
  const shapeScreenHeight = (shape.height ?? 100) * viewport.zoom;

  // 화면 밖인지 체크
  if (shapeScreenX + shapeScreenWidth < -padding) return false;
  if (shapeScreenY + shapeScreenHeight < -padding) return false;
  if (shapeScreenX > windowWidth + padding) return false;
  if (shapeScreenY > windowHeight + padding) return false;

  return true;
}
