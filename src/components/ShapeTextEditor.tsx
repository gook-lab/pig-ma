import { useRef, useEffect, useCallback, useState } from "react";
import { useCanvasStore } from "@/store";
import { cn } from "@/lib/utils";
import { LINE_HEIGHT } from "@/utils/richText";
import { isShape as isShapeGuard } from "@/utils/typeGuards";
import { TEXT_CONFIG } from "@/constants/text";

export function ShapeTextEditor() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justOpenedRef = useRef(false);
  const initializedRef = useRef<string | null>(null); // Track which object we've initialized for
  const {
    objects,
    editingTextId,
    setEditingTextId,
    updateObject,
    viewport,
    pendingTextInput,
    setPendingTextInput,
  } = useCanvasStore();
  const [textValue, setTextValue] = useState("");

  const editingObject = objects.find((obj) => obj.id === editingTextId);

  // Handle shape variants (all support text)
  const isShape = editingObject ? isShapeGuard(editingObject) : false;

  // Initialize text value when editing starts
  useEffect(() => {
    if (editingObject && isShape) {
      // Only initialize once per editing session
      if (initializedRef.current === editingObject.id) {
        return;
      }
      initializedRef.current = editingObject.id;

      // If there's a pending text input (user started typing on selected shape),
      // replace existing text with the new input
      if (pendingTextInput) {
        setTextValue(pendingTextInput);
        setPendingTextInput(null);
      } else {
        setTextValue(editingObject.text ?? "");
      }
      pendingSaveRef.current = false;
    } else {
      // Reset when not editing
      initializedRef.current = null;
    }
  }, [editingObject?.id, isShape, pendingTextInput, setPendingTextInput]);

  // Save and close editor
  const handleSave = useCallback(() => {
    if (editingTextId && textareaRef.current) {
      const currentText = textareaRef.current.value;
      const finalText = currentText.trim() || undefined;
      updateObject(editingTextId, { text: finalText });
    }
    setEditingTextId(null);
    pendingSaveRef.current = false;
  }, [editingTextId, updateObject, setEditingTextId]);

  // Cancel editing without saving
  const handleCancel = useCallback(() => {
    setEditingTextId(null);
    pendingSaveRef.current = false;
  }, [setEditingTextId]);

  // Focus textarea when editing starts
  useEffect(() => {
    if (editingTextId && isShape && textareaRef.current) {
      // Cancel any pending blur timeout when focusing
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      // Mark as just opened to ignore immediate blur events
      justOpenedRef.current = true;
      setTimeout(() => {
        justOpenedRef.current = false;
      }, 200);

      textareaRef.current.focus();
      // Select all text if there is existing text
      if (editingObject?.text) {
        textareaRef.current.select();
      }
    }
  }, [editingTextId, isShape, editingObject?.text]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  // Don't show editor for locked objects
  if (!editingTextId || !editingObject || !isShape || editingObject.locked)
    return null;

  // Use TEXT_CONFIG for consistent padding with view mode
  const { padding } = TEXT_CONFIG.shape;

  // Calculate position in screen coordinates
  const width = editingObject.width ?? 100;
  const height = editingObject.height ?? 100;
  const screenX = editingObject.x * viewport.zoom + viewport.x;
  const screenY = editingObject.y * viewport.zoom + viewport.y;

  // Use raw fontSize (CSS transform handles zoom scaling)
  const fontSize = editingObject.fontSize ?? 10;
  const textAlign = editingObject.textAlign ?? "center";

  return (
    <div
      className="pointer-events-none fixed"
      style={{
        left: screenX,
        top: screenY,
        width,
        height,
        transform: `scale(${viewport.zoom})`,
        transformOrigin: "top left",
        zIndex: 9999,
        padding: `${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <textarea
        ref={textareaRef}
        value={textValue}
        onChange={(e) => {
          // Just update local state - don't sync to store during typing
          setTextValue(e.target.value);
        }}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={() => {
          isComposingRef.current = false;
          // If Enter was pressed during composition, save now
          if (pendingSaveRef.current) {
            // Use requestAnimationFrame to ensure the composition text is committed
            requestAnimationFrame(() => {
              handleSave();
            });
          }
        }}
        onBlur={() => {
          // Ignore blur if editor just opened (double-click causes immediate blur)
          if (justOpenedRef.current) {
            return;
          }
          // Don't save on blur if we're waiting for compositionend
          if (!isComposingRef.current) {
            handleSave();
          }
        }}
        onKeyDown={(e) => {
          e.stopPropagation();

          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            // If composing, defer save to compositionend
            if (isComposingRef.current || e.nativeEvent.isComposing) {
              pendingSaveRef.current = true;
              return;
            }
            handleSave();
          } else if (e.key === "Escape") {
            e.preventDefault();
            // If composing, just close without saving
            if (isComposingRef.current) {
              isComposingRef.current = false;
            }
            handleCancel();
          }
          // Shift+Enter = new line (default textarea behavior)
        }}
        className={cn(
          "pointer-events-auto resize-none outline-none",
          "bg-transparent",
        )}
        style={{
          width: "100%",
          height: "100%",
          fontSize,
          fontWeight: editingObject.fontWeight ?? "normal",
          textDecoration:
            editingObject.textDecoration === "line-through"
              ? "line-through"
              : "none",
          textAlign,
          lineHeight: LINE_HEIGHT,
          color: editingObject.textColor ?? "#1f2937",
          wordWrap: "break-word",
          overflowWrap: "break-word",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
        placeholder="Add text"
      />
    </div>
  );
}
