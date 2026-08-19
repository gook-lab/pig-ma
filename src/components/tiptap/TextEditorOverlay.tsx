import {
  useCallback,
  useMemo,
  useEffect,
  useState,
  useRef,
  useLayoutEffect,
} from "react";
import type { CSSProperties } from "react";
import { TiptapEditor } from "./TiptapEditor";
import type { Editor, JSONContent } from "@tiptap/core";
import {
  textSegmentsToTiptap,
  tiptapToPlainText,
  plainTextToTiptap,
  createEmptyTiptapContent,
} from "@/utils/tiptapMigration";
import { calculateOptionsBarPosition } from "@/utils/optionsBar";
import { getPointOnPath } from "@/utils/elbowPath";
import { getConnectorPathPoints } from "@/utils/connectorPath";
import { isShape as isShapeType } from "@/utils/typeGuards";
import { TEXT_CONFIG } from "@/utils/textConfig";
import { useCanvasStore } from "@/store";
import { TextOptionsBar } from "@/components/TextOptionsBar";

export function TextEditorOverlay() {
  const editingTextId = useCanvasStore((s) => s.editingTextId);
  const objects = useCanvasStore((s) => s.objects);
  const viewport = useCanvasStore((s) => s.viewport);
  const updateObject = useCanvasStore((s) => s.updateObject);
  const setEditingTextId = useCanvasStore((s) => s.setEditingTextId);
  const setActiveEditor = useCanvasStore((s) => s.setActiveEditor);
  const isFileDialogOpen = useCanvasStore((s) => s.isFileDialogOpen);
  const lockObjects = useCanvasStore((s) => s.lockObjects);
  const unlockObjects = useCanvasStore((s) => s.unlockObjects);
  const setSelectedIds = useCanvasStore((s) => s.setSelectedIds);
  const pendingTextInput = useCanvasStore((s) => s.pendingTextInput);
  const setPendingTextInput = useCanvasStore((s) => s.setPendingTextInput);

  const [editor, setEditor] = useState<Editor | null>(null);
  const migratedIdsRef = useRef<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const outerContainerRef = useRef<HTMLDivElement>(null);
  // ref를 사용하여 blur 핸들러에서 항상 최신 값을 참조
  const isFileDialogOpenRef = useRef(isFileDialogOpen);
  isFileDialogOpenRef.current = isFileDialogOpen;
  // 에디터가 방금 열렸는지 추적 (blur 무시용)
  const justOpenedRef = useRef(true);
  // blur 이벤트가 내부 이동인지 추적
  const isInternalFocusRef = useRef(false);
  // pendingTextInput 처리 여부 추적
  const pendingTextProcessedRef = useRef<string | null>(null);

  const editingObject = useMemo(
    () => objects.find((o) => o.id === editingTextId),
    [objects, editingTextId],
  );

  // 마이그레이션 즉시 저장 (richText → tiptapContent)
  // ref로 추적하여 같은 객체에 대해 한 번만 수행
  useEffect(() => {
    if (!editingObject?.id) return;
    if (migratedIdsRef.current.has(editingObject.id)) return;
    if (editingObject.tiptapContent) return;
    if (!editingObject.richText || editingObject.richText.length === 0) return;

    migratedIdsRef.current.add(editingObject.id);
    const migrated = textSegmentsToTiptap(
      editingObject.richText,
      editingObject.lineIndents,
    );
    updateObject(editingObject.id, {
      tiptapContent: migrated,
      _contentVersion: 2,
    });
  }, [editingObject?.id, updateObject]);

  const tiptapContent = useMemo((): JSONContent => {
    if (editingObject?.tiptapContent) {
      return editingObject.tiptapContent;
    }
    if (editingObject?.richText && editingObject.richText.length > 0) {
      return textSegmentsToTiptap(
        editingObject.richText,
        editingObject.lineIndents,
      );
    }
    // text 필드만 있는 경우 (레거시)
    if (editingObject?.text) {
      return plainTextToTiptap(editingObject.text);
    }
    return createEmptyTiptapContent();
  }, [
    editingObject?.tiptapContent,
    editingObject?.richText,
    editingObject?.lineIndents,
    editingObject?.text,
  ]);

  const handleChange = useCallback(
    (content: JSONContent) => {
      if (!editingObject) return;
      updateObject(editingObject.id, {
        tiptapContent: content,
        _contentVersion: 2,
        // 하위 호환용 평문 동기화
        text: tiptapToPlainText(content),
      });
    },
    [editingObject, updateObject],
  );

  const handleBlur = useCallback(
    (e?: React.FocusEvent) => {
      // 에디터가 방금 열린 경우 blur 무시 (마운트 직후 blur 방지)
      if (justOpenedRef.current) return;
      // 파일 다이얼로그가 열려 있으면 blur 무시
      // ref를 사용하여 항상 최신 값 참조 (useCallback 클로저 문제 방지)
      if (isFileDialogOpenRef.current) return;
      // 내부 focus 이동 중이면 blur 무시
      if (isInternalFocusRef.current) {
        isInternalFocusRef.current = false;
        return;
      }
      // relatedTarget이 같은 컨테이너 내에 있으면 blur 무시
      if (
        e?.relatedTarget &&
        outerContainerRef.current?.contains(e.relatedTarget as Node)
      ) {
        return;
      }
      // IME 조합 중이거나 내부 포커스 이동 시 즉시 처리하지 않음
      // 짧은 딜레이 후 실제로 포커스가 외부로 이동했는지 확인
      setTimeout(() => {
        // 다시 한번 조건 체크 (비동기 처리 중 상태 변경 가능)
        if (justOpenedRef.current) return;
        if (isFileDialogOpenRef.current) return;
        // 현재 활성 요소가 컨테이너 내부인지 확인
        if (outerContainerRef.current?.contains(document.activeElement)) {
          return;
        }
        setActiveEditor(null);
        setEditingTextId(null);
      }, 100);
    },
    [setActiveEditor, setEditingTextId],
  );

  const handleEditorReady = useCallback(
    (editorInstance: Editor) => {
      setEditor(editorInstance);
      setActiveEditor(editorInstance);

      // pendingTextInput이 있으면 기존 내용 대체 후 입력
      if (
        pendingTextInput &&
        pendingTextProcessedRef.current !== editingTextId
      ) {
        pendingTextProcessedRef.current = editingTextId;
        // 기존 내용 클리어하고 새 텍스트 입력 (빈 paragraph 하나만 유지)
        editorInstance.commands.setContent({
          type: "doc",
          content: [{ type: "paragraph" }],
        });
        editorInstance.commands.insertContent(pendingTextInput);
        setPendingTextInput(null);
      }

      // 에디터가 준비되면 포커스 (start 위치로 - 빈 문서에서 추가 paragraph 생성 방지)
      editorInstance.commands.focus("start");
      // 200ms 후에 blur 허용 (마운트 직후 blur 방지)
      setTimeout(() => {
        justOpenedRef.current = false;
      }, 200);
    },
    [setActiveEditor, pendingTextInput, editingTextId, setPendingTextInput],
  );

  // editingTextId가 변경될 때마다 justOpenedRef 리셋
  useLayoutEffect(() => {
    if (editingTextId) {
      justOpenedRef.current = true;
    }
  }, [editingTextId]);

  // 옵션 바 위치 계산 (공용 유틸리티 사용)
  // TextBoxEditor(view 모드)와 동일한 barHeight 사용하여 모드 전환 시 위치 일관성 유지
  const optionsBarPosition = useMemo(() => {
    if (!editingObject)
      return { x: 0, y: 0, above: false, align: "center" as const };

    const width = editingObject.width ?? 200;
    const height = editingObject.height ?? 100;

    // StickyNote는 옵션바를 항상 아래에 배치 (Connection Handles, rotate 가리지 않도록)
    if (editingObject.type === "stickyNote") {
      const screenX =
        (editingObject.x + width / 2) * viewport.zoom + viewport.x;
      const screenY =
        (editingObject.y + height + 30) * viewport.zoom + viewport.y;
      return { x: screenX, y: screenY, above: false, align: "center" as const };
    }

    return calculateOptionsBarPosition({
      element: {
        x: editingObject.x,
        y: editingObject.y,
        width,
        height,
      },
      viewport,
      // 드롭다운 포함한 높이 - TextBoxEditor와 동일하게 설정
      barHeight: 200,
    });
  }, [editingObject, viewport]);

  // 객체 업데이트 핸들러
  const handleUpdate = useCallback(
    (updates: Record<string, unknown>) => {
      if (!editingObject) return;
      updateObject(editingObject.id, updates);
    },
    [editingObject, updateObject],
  );

  // 잠금 핸들러
  const handleLock = useCallback(() => {
    if (!editingObject) return;
    setSelectedIds([editingObject.id]);
    lockObjects();
    setEditingTextId(null);
  }, [editingObject, setSelectedIds, lockObjects, setEditingTextId]);

  const handleUnlock = useCallback(() => {
    if (!editingObject) return;
    setSelectedIds([editingObject.id]);
    unlockObjects();
  }, [editingObject, setSelectedIds, unlockObjects]);

  // 콘텐츠 크기에 따라 메모지 크기 자동 조정
  useEffect(() => {
    if (!containerRef.current || !editingObject) return;

    // 타입별 padding 가져오기
    const getObjectPadding = () => {
      if (editingObject.type === "stickyNote") {
        return TEXT_CONFIG.stickyNote.padding;
      }
      if (editingObject.type === "textBox") {
        return TEXT_CONFIG.textBox.padding;
      }
      if (isShapeType(editingObject)) {
        return TEXT_CONFIG.shape.padding;
      }
      return { left: 8, right: 8, top: 8, bottom: 8 };
    };

    const objectPadding = getObjectPadding();
    const paddingX = objectPadding.left + objectPadding.right;
    const paddingY = objectPadding.top + objectPadding.bottom;
    const authorHeight =
      editingObject.type === "stickyNote" && editingObject.authorName
        ? TEXT_CONFIG.stickyNote.authorHeight
        : 0;

    const checkAndResize = () => {
      const container = containerRef.current;
      if (!container) return;

      // 실제 콘텐츠 크기 측정 (스크롤 포함)
      const contentWidth = container.scrollWidth;
      const contentHeight = container.scrollHeight;

      const currentWidth = editingObject.width ?? 200;
      const currentHeight = editingObject.height ?? 100;

      // CSS transform: scale()을 사용하므로 scrollWidth/scrollHeight는 원본 크기
      const minRequiredWidth = contentWidth + paddingX;
      const minRequiredHeight = contentHeight + paddingY + authorHeight;

      const updates: { width?: number; height?: number } = {};

      // 콘텐츠가 현재 너비보다 크면 너비 확장 (1px 여유)
      if (minRequiredWidth > currentWidth + 1) {
        updates.width = Math.ceil(minRequiredWidth);
      }

      // 콘텐츠가 현재 높이보다 크면 높이 확장 (1px 여유)
      if (minRequiredHeight > currentHeight + 1) {
        updates.height = Math.ceil(minRequiredHeight);
      }

      if (Object.keys(updates).length > 0) {
        updateObject(editingObject.id, updates);
      }
    };

    // 초기 체크
    checkAndResize();

    // MutationObserver로 콘텐츠 변경 감지
    const mutationObserver = new MutationObserver(() => {
      requestAnimationFrame(checkAndResize);
    });

    mutationObserver.observe(containerRef.current, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    // ResizeObserver로 크기 변경 감지
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(checkAndResize);
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    };
    // Note: editingObject?.width, editingObject?.height 제외 - 무한 루프 방지
    // ResizeObserver/MutationObserver가 변경을 감지하므로 의존성 불필요
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editingObject?.id,
    editingObject?.type,
    editingObject?.authorName,
    updateObject,
  ]);

  // CodeBlock은 CodeBlockEditor에서 처리하므로 제외
  if (!editingObject || !editingTextId || editingObject.type === "codeBlock")
    return null;

  // 객체 순서 기반 z-index
  const objectIndex = objects.findIndex((o) => o.id === editingObject.id);

  // 위치 계산 (좌상단 기준)
  let objectX = editingObject.x;
  let objectY = editingObject.y;
  let objectWidth = editingObject.width ?? 200;
  let objectHeight = editingObject.height ?? 100;

  // ConnectorLabel: 커넥터 경로 기반 동적 위치 계산
  if (
    editingObject.type === "connectorLabel" &&
    editingObject.connectedConnectorId
  ) {
    const connector = objects.find(
      (o) => o.id === editingObject.connectedConnectorId,
    );
    if (connector && connector.type === "connector") {
      const sourceObj = connector.sourceId
        ? objects.find((o) => o.id === connector.sourceId)
        : undefined;
      const targetObj = connector.targetId
        ? objects.find((o) => o.id === connector.targetId)
        : undefined;

      // 렌더러와 같은 단일 소스 — 앵커 리드인/ratio 오프셋 포함
      const pathPoints = getConnectorPathPoints(
        connector,
        sourceObj,
        targetObj,
      );

      const labelT = editingObject.labelT ?? 0.5;
      const pos = getPointOnPath(pathPoints, labelT);
      objectX = pos.x;
      objectY = pos.y;
      objectWidth = 100;
      objectHeight = 24;
    }
  }

  // TEXT_CONFIG에서 타입별 padding 가져오기
  const getPadding = () => {
    if (editingObject.type === "stickyNote") {
      const p = TEXT_CONFIG.stickyNote.padding;
      return `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px`;
    }
    if (editingObject.type === "textBox") {
      const p = TEXT_CONFIG.textBox.padding;
      return `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px`;
    }
    if (isShapeType(editingObject)) {
      const p = TEXT_CONFIG.shape.padding;
      return `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px`;
    }
    return "8px"; // 기본값
  };

  const style: CSSProperties = {
    position: "fixed",
    left: objectX * viewport.zoom + viewport.x,
    top: objectY * viewport.zoom + viewport.y,
    // 원본 크기 유지 (transform으로 스케일)
    width: objectWidth,
    minHeight: objectHeight,
    // 회전과 스케일을 함께 적용 - 원본 비율 유지
    transform: `scale(${viewport.zoom}) rotate(${editingObject.rotation ?? 0}deg)`,
    transformOrigin: "top left",
    zIndex: 50 + objectIndex,
    padding: getPadding(),
    boxSizing: "border-box",
    overflow: "hidden",
  };

  // 타입별 배경색/테두리 적용
  if (editingObject.type === "stickyNote") {
    style.backgroundColor = editingObject.backgroundColor ?? "#fef08a";
    style.borderRadius = "4px";
  } else if (editingObject.type === "textBox") {
    // TextBox fill 적용 (transparent가 아니고 fillMode가 fill인 경우)
    const fill = editingObject.fill ?? "transparent";
    const fillMode = editingObject.fillMode ?? "transparent";
    if (fill !== "transparent" && fillMode === "fill") {
      style.backgroundColor = fill;
    }
    // TextBox stroke 적용
    const stroke = editingObject.stroke ?? "transparent";
    if (stroke !== "transparent") {
      const lineStyle = editingObject.lineStyle ?? "solid";
      style.border = `2px ${lineStyle} ${stroke}`;
    }
    style.borderRadius = "4px";
  } else if (editingObject.type === "connectorLabel") {
    // ConnectorLabel - 배경 및 border 추가 (view 모드와 동일)
    style.backgroundColor = "rgba(255, 255, 255, 0.9)";
    style.border = "1px solid #3b82f6";
    style.borderRadius = "4px";
    style.padding = "6px";
    style.transform = `scale(${viewport.zoom})`;
    style.transformOrigin = "center center";
    // 위치를 중앙 기준으로 조정
    style.left =
      objectX * viewport.zoom + viewport.x - (objectWidth * viewport.zoom) / 2;
    style.top =
      objectY * viewport.zoom + viewport.y - (objectHeight * viewport.zoom) / 2;
  } else if (isShapeType(editingObject)) {
    // Shape (including rectangle variant) - 배경 투명 (Konva shape가 그대로 보이도록)
    // 텍스트 영역만 오버레이
    style.backgroundColor = "transparent";
  }

  // shape은 ShapeOptionsBar에서, connectorLabel은 ConnectorLabelEditor에서 처리
  const isShape = isShapeType(editingObject);
  const isConnectorLabel = editingObject.type === "connectorLabel";

  return (
    <>
      {/* TextOptionsBar - textBox/stickyNote 전용 (shape/rectangle은 ShapeOptionsBar에서, connectorLabel은 ConnectorLabelEditor에서 처리) */}
      {!isShape && !isConnectorLabel && (
        <TextOptionsBar
          object={editingObject}
          position={optionsBarPosition}
          onUpdate={handleUpdate}
          tiptapEditor={editor}
          onLock={handleLock}
          onUnlock={handleUnlock}
        />
      )}

      {/* Tiptap Editor Overlay */}
      <div
        ref={outerContainerRef}
        style={style}
        tabIndex={-1}
        onMouseDown={(e) => {
          // 클릭 시 에디터에 포커스 유지 (blur 방지)
          e.stopPropagation();
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          // 컨테이너 클릭 시 에디터에 포커스
          editor?.commands.focus();
        }}
        onFocus={() => {
          // 컨테이너가 focus를 받으면 에디터에 전달
          editor?.commands.focus();
        }}
        onBlur={(e) => {
          // relatedTarget이 컨테이너 외부로 나갈 때만 blur 처리
          if (
            e.relatedTarget &&
            outerContainerRef.current?.contains(e.relatedTarget as Node)
          ) {
            return;
          }
          handleBlur(e);
        }}
      >
        <div ref={containerRef}>
          <TiptapEditor
            key={editingObject.id}
            content={tiptapContent}
            onChange={handleChange}
            onEditorReady={handleEditorReady}
            defaultFontSize={editingObject.fontSize ?? 16}
            defaultFontFamily={editingObject.fontFamily ?? "Pretendard"}
            defaultTextColor={editingObject.textColor ?? "#1f2937"}
            defaultTextAlign={
              (editingObject.textAlign as "left" | "center" | "right") ??
              "center"
            }
            className="h-full w-full"
          />
        </div>

        {/* StickyNote 작성자명 - 뷰 모드와 동일하게 표시 */}
        {editingObject.type === "stickyNote" && editingObject.authorName && (
          <div
            style={{
              position: "absolute",
              left: `${TEXT_CONFIG.stickyNote.padding.left}px`,
              bottom: "4px",
              fontSize: "10px",
              color: "#9ca3af",
              fontStyle: "italic",
              pointerEvents: "none",
            }}
          >
            {editingObject.authorName}
          </div>
        )}
      </div>
    </>
  );
}
