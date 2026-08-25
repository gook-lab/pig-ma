import { useEffect, useCallback, useMemo } from "react";
import { useCanvasStore } from "@/store";
import { TextOptionsBar } from "./TextOptionsBar";
import { calculateOptionsBarPosition } from "@/utils/optionsBar";
import type { CanvasObject } from "@/types";
import { calculateRichTextHeight, textToRichText } from "@/utils/richText";
import { TEXT_CONFIG } from "@/utils/textConfig";
import { isShape } from "@/utils/typeGuards";
import toast from "react-hot-toast";
import { DEFAULT_FONT_FAMILY } from "@/constants/fonts";

/**
 * TextBoxEditor - 선택된 textBox/stickyNote에 대한 옵션바 표시
 *
 * 편집 모드는 TextEditorOverlay가 담당합니다.
 * 이 컴포넌트는 선택 상태에서의 옵션바 표시와 키 입력 시 편집 모드 진입만 처리합니다.
 *
 * Note: shape/rectangle의 텍스트 편집도 TextEditorOverlay에서 처리됩니다.
 * 이 컴포넌트는 키 입력으로 편집 모드 진입만 담당합니다.
 */
export function TextBoxEditor() {
  const {
    objects,
    selectedIds,
    viewport,
    updateObject,
    editingTextId,
    setEditingTextId,
    lockObjects,
    unlockObjects,
    setPendingTextInput,
  } = useCanvasStore();

  // Find if a textBox or stickyNote is selected (for showing options bar)
  const selectedTextObject = useMemo(() => {
    if (selectedIds.length !== 1) return undefined;
    return objects.find(
      (obj) =>
        obj.id === selectedIds[0] &&
        (obj.type === "textBox" || obj.type === "stickyNote"),
    );
  }, [objects, selectedIds]);

  // Find if a shape is selected (for auto-edit on key press)
  const selectedShapeObject = useMemo(() => {
    if (selectedIds.length !== 1) return undefined;
    return objects.find((obj) => obj.id === selectedIds[0] && isShape(obj));
  }, [objects, selectedIds]);

  // Check if currently editing
  const isEditing = !!editingTextId;

  // Listen for keydown to auto-enter edit mode when textBox/stickyNote is selected
  useEffect(() => {
    // Don't allow editing locked objects
    if (
      !selectedTextObject ||
      editingTextId === selectedTextObject.id ||
      selectedTextObject.locked
    )
      return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in other inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      // Enter edit mode on printable character
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setEditingTextId(selectedTextObject.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedTextObject?.id,
    selectedTextObject?.locked,
    editingTextId,
    setEditingTextId,
  ]);

  // Listen for keydown to auto-enter edit mode when shape/rectangle is selected
  useEffect(() => {
    // Don't allow editing locked objects
    if (
      !selectedShapeObject ||
      editingTextId === selectedShapeObject.id ||
      selectedShapeObject.locked
    )
      return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in other inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      // Enter edit mode on printable character
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Store the first character for TextEditorOverlay to use
        setPendingTextInput(e.key);
        setEditingTextId(selectedShapeObject.id);
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedShapeObject?.id,
    selectedShapeObject?.locked,
    editingTextId,
    setEditingTextId,
    setPendingTextInput,
  ]);

  // Calculate bar position (below or above the object depending on screen position)
  const getBarPosition = useCallback(() => {
    if (!selectedTextObject)
      return { x: 0, y: 0, above: false, align: "center" as const };

    const width = selectedTextObject.width ?? 200;
    const height = selectedTextObject.height ?? 40;

    // StickyNote는 옵션바를 항상 아래에 배치 (Connection Handles, rotate 가리지 않도록)
    if (selectedTextObject.type === "stickyNote") {
      const screenX =
        (selectedTextObject.x + width / 2) * viewport.zoom + viewport.x;
      const screenY =
        (selectedTextObject.y + height + 30) * viewport.zoom + viewport.y;
      return { x: screenX, y: screenY, above: false, align: "center" as const };
    }

    return calculateOptionsBarPosition({
      element: {
        x: selectedTextObject.x,
        y: selectedTextObject.y,
        width,
        height,
      },
      viewport,
      // TextOptionsBar는 드롭다운 포함하여 높이가 더 큼
      barHeight: 200,
    });
  }, [selectedTextObject, viewport]);

  // For options bar updates
  const handleUpdate = useCallback(
    (updates: Partial<CanvasObject>) => {
      if (!selectedTextObject) return;

      // If fontSize is being updated, recalculate height using rich text
      if (updates.fontSize !== undefined) {
        const isStickyNote = selectedTextObject.type === "stickyNote";
        const config = isStickyNote
          ? TEXT_CONFIG.stickyNote
          : TEXT_CONFIG.textBox;
        const paddingX = config.padding.left;
        const paddingVertical = config.padding.top + config.padding.bottom;

        const width = selectedTextObject.width ?? 200;
        const textWidth = width - paddingX * 2;

        // Get current richText or create from plain text
        const richText =
          selectedTextObject.richText && selectedTextObject.richText.length > 0
            ? selectedTextObject.richText
            : textToRichText(selectedTextObject.text ?? "");

        // Apply the new fontSize to all segments that don't have explicit fontSize
        const newFontSize = updates.fontSize;
        const updatedRichText = richText.map((seg) => ({
          ...seg,
          fontSize: seg.fontSize ?? newFontSize,
        }));

        // Calculate actual rendered height
        const { height: contentHeight } = calculateRichTextHeight(
          updatedRichText,
          textWidth,
          newFontSize,
          selectedTextObject.fontFamily ?? DEFAULT_FONT_FAMILY,
          selectedTextObject.lineIndents ?? [],
        );

        if (selectedTextObject.type === "textBox") {
          const newHeight = Math.max(40, contentHeight + paddingVertical);
          updateObject(selectedTextObject.id, {
            ...updates,
            height: newHeight,
          });
        } else if (selectedTextObject.type === "stickyNote") {
          const authorHeight = selectedTextObject.authorName ? 20 : 0;
          const totalContentHeight =
            contentHeight + paddingVertical + authorHeight;
          const minHeight = 150;
          const currentHeight = selectedTextObject.height ?? minHeight;
          const newHeight = Math.max(currentHeight, totalContentHeight);
          updateObject(selectedTextObject.id, {
            ...updates,
            height: newHeight,
          });
        } else {
          updateObject(selectedTextObject.id, updates);
        }
      } else {
        updateObject(selectedTextObject.id, updates);
      }
    },
    [selectedTextObject, updateObject],
  );

  const handleLock = useCallback(() => {
    lockObjects();
    toast.success("잠금되었습니다", {
      duration: 1500,
      position: "bottom-center",
    });
  }, [lockObjects]);

  const handleUnlock = useCallback(() => {
    unlockObjects();
    toast.success("잠금 해제되었습니다", {
      duration: 1500,
      position: "bottom-center",
    });
  }, [unlockObjects]);

  // 편집 중이거나 선택된 객체가 없으면 렌더링하지 않음
  if (isEditing || !selectedTextObject) return null;

  const position = getBarPosition();

  return (
    <TextOptionsBar
      object={selectedTextObject}
      position={position}
      onUpdate={handleUpdate}
      onLock={handleLock}
      onUnlock={handleUnlock}
    />
  );
}
