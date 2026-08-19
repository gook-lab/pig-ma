import { useRef, useEffect, useCallback, memo } from "react";
import type { TextSegment } from "@/types";
import {
  richTextToPlainText,
  toggleStyleInRange,
  textToRichText,
} from "@/utils/richText";

export interface HiddenTextareaProps {
  richText: TextSegment[];
  lineIndents: number[];
  onChange: (richText: TextSegment[], lineIndents: number[]) => void;
  onBlur: () => void;
  onCursorChange: (
    cursorIndex: number,
    selectionStart: number | null,
    selectionEnd: number | null,
  ) => void;
  position: { x: number; y: number };
}

export const HiddenTextarea = memo(function HiddenTextarea({
  richText,
  lineIndents,
  onChange,
  onBlur,
  onCursorChange,
  position,
}: HiddenTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const richTextRef = useRef(richText);
  const lineIndentsRef = useRef(lineIndents);
  const isComposingRef = useRef(false);

  // Keep refs in sync
  useEffect(() => {
    richTextRef.current = richText;
    lineIndentsRef.current = lineIndents;
  }, [richText, lineIndents]);

  // Get current plain text
  const getPlainText = useCallback(() => {
    return richTextToPlainText(richTextRef.current);
  }, []);

  // Sync textarea value with richText
  useEffect(() => {
    if (textareaRef.current && !isComposingRef.current) {
      const plainText = getPlainText();
      if (textareaRef.current.value !== plainText) {
        const { selectionStart, selectionEnd } = textareaRef.current;
        textareaRef.current.value = plainText;
        // Restore cursor position
        textareaRef.current.selectionStart = Math.min(
          selectionStart,
          plainText.length,
        );
        textareaRef.current.selectionEnd = Math.min(
          selectionEnd,
          plainText.length,
        );
      }
    }
  }, [richText, getPlainText]);

  // Focus on mount
  useEffect(() => {
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        // Move cursor to end
        const len = textareaRef.current.value.length;
        textareaRef.current.selectionStart = len;
        textareaRef.current.selectionEnd = len;
        updateCursorState();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update cursor state
  const updateCursorState = useCallback(() => {
    if (!textareaRef.current) return;
    const { selectionStart, selectionEnd } = textareaRef.current;
    if (selectionStart === selectionEnd) {
      onCursorChange(selectionStart, null, null);
    } else {
      // cursorIndex should be selectionEnd (the active cursor position)
      onCursorChange(selectionEnd, selectionStart, selectionEnd);
    }
  }, [onCursorChange]);

  // Handle input - simplified approach
  const handleInput = useCallback(() => {
    if (!textareaRef.current) return;

    const newText = textareaRef.current.value;
    const oldText = getPlainText();

    // During composition, still update to show intermediate state
    if (newText === oldText && !isComposingRef.current) {
      updateCursorState();
      return;
    }

    // Simple approach: convert new text to rich text, preserving styles where possible
    const newRichText = preserveStylesOnTextChange(
      richTextRef.current,
      oldText,
      newText,
    );

    // Update line indents
    const newLines = newText.split("\n").length;
    const newIndents = Array(newLines)
      .fill(0)
      .map((_, i) => lineIndentsRef.current[i] ?? 0);

    onChange(newRichText, newIndents);
    updateCursorState();
  }, [getPlainText, onChange, updateCursorState]);

  // Handle keydown
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      // Cmd/Ctrl + B: Bold
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        const { selectionStart, selectionEnd } = textarea;
        if (selectionStart !== selectionEnd) {
          const newRichText = toggleStyleInRange(
            richTextRef.current,
            selectionStart,
            selectionEnd,
            "fontWeight",
            "bold",
            "normal",
          );
          onChange(newRichText, lineIndentsRef.current);
        }
        return;
      }

      // Cmd/Ctrl + S: Strikethrough (prevent browser save)
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        const { selectionStart, selectionEnd } = textarea;
        if (selectionStart !== selectionEnd) {
          const newRichText = toggleStyleInRange(
            richTextRef.current,
            selectionStart,
            selectionEnd,
            "textDecoration",
            "line-through",
            "none",
          );
          onChange(newRichText, lineIndentsRef.current);
        }
        return;
      }

      // Tab: Indent
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        const { selectionStart } = textarea;
        const text = textarea.value;
        const lineStart = text.lastIndexOf("\n", selectionStart - 1) + 1;

        // Insert 2 spaces at line start
        const newText = text.slice(0, lineStart) + "  " + text.slice(lineStart);
        const newRichText = textToRichText(newText);

        // Update indents
        const lineIndex = text.slice(0, selectionStart).split("\n").length - 1;
        const newIndents = [...lineIndentsRef.current];
        while (newIndents.length <= lineIndex) newIndents.push(0);
        newIndents[lineIndex] = (newIndents[lineIndex] ?? 0) + 1;

        onChange(newRichText, newIndents);

        // Restore cursor
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.value = newText;
            textareaRef.current.selectionStart = selectionStart + 2;
            textareaRef.current.selectionEnd = selectionStart + 2;
            updateCursorState();
          }
        });
        return;
      }

      // Shift + Tab: Outdent
      if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();
        const { selectionStart } = textarea;
        const text = textarea.value;
        const lineStart = text.lastIndexOf("\n", selectionStart - 1) + 1;

        // Remove up to 2 spaces from line start
        const lineText = text.slice(lineStart);
        const spacesToRemove = lineText.startsWith("  ")
          ? 2
          : lineText.startsWith(" ")
            ? 1
            : 0;

        if (spacesToRemove > 0) {
          const newText =
            text.slice(0, lineStart) + text.slice(lineStart + spacesToRemove);
          const newRichText = textToRichText(newText);

          // Update indents
          const lineIndex =
            text.slice(0, selectionStart).split("\n").length - 1;
          const newIndents = [...lineIndentsRef.current];
          while (newIndents.length <= lineIndex) newIndents.push(0);
          newIndents[lineIndex] = Math.max(0, (newIndents[lineIndex] ?? 0) - 1);

          onChange(newRichText, newIndents);

          // Restore cursor
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              textareaRef.current.value = newText;
              const newPos = Math.max(
                lineStart,
                selectionStart - spacesToRemove,
              );
              textareaRef.current.selectionStart = newPos;
              textareaRef.current.selectionEnd = newPos;
              updateCursorState();
            }
          });
        }
        return;
      }

      // Enter: Handle bullet/number continuation
      if (e.key === "Enter") {
        const { selectionStart, selectionEnd } = textarea;

        // Only handle if no selection
        if (selectionStart !== selectionEnd) return;

        const text = textarea.value;
        const lineStart = text.lastIndexOf("\n", selectionStart - 1) + 1;
        const lineText = text.slice(lineStart, selectionStart);

        // Check for bullet point
        const bulletMatch = lineText.match(/^([ \t]*)(• )(.*)/);
        if (bulletMatch) {
          e.preventDefault();
          const [, indent, bullet, content] = bulletMatch;

          let newText: string;
          let newCursorPos: number;

          if (content.trim() === "") {
            // Empty bullet line - remove bullet
            newText =
              text.slice(0, lineStart) + indent + text.slice(selectionStart);
            newCursorPos = lineStart + indent.length;
          } else {
            // Add new bullet line
            const insertText = "\n" + indent + bullet;
            newText =
              text.slice(0, selectionStart) +
              insertText +
              text.slice(selectionStart);
            newCursorPos = selectionStart + insertText.length;
          }

          const newRichText = textToRichText(newText);
          onChange(newRichText, lineIndentsRef.current);

          requestAnimationFrame(() => {
            if (textareaRef.current) {
              textareaRef.current.value = newText;
              textareaRef.current.selectionStart = newCursorPos;
              textareaRef.current.selectionEnd = newCursorPos;
              updateCursorState();
            }
          });
          return;
        }

        // Check for numbered list
        const numberMatch = lineText.match(/^([ \t]*)(\d+)\. (.*)/);
        if (numberMatch) {
          e.preventDefault();
          const [, indent, numStr, content] = numberMatch;
          const num = parseInt(numStr);

          let newText: string;
          let newCursorPos: number;

          if (content.trim() === "") {
            // Empty number line - remove number
            newText =
              text.slice(0, lineStart) + indent + text.slice(selectionStart);
            newCursorPos = lineStart + indent.length;
          } else {
            // Add new numbered line
            const insertText = "\n" + indent + (num + 1) + ". ";
            newText =
              text.slice(0, selectionStart) +
              insertText +
              text.slice(selectionStart);
            newCursorPos = selectionStart + insertText.length;
          }

          const newRichText = textToRichText(newText);
          onChange(newRichText, lineIndentsRef.current);

          requestAnimationFrame(() => {
            if (textareaRef.current) {
              textareaRef.current.value = newText;
              textareaRef.current.selectionStart = newCursorPos;
              textareaRef.current.selectionEnd = newCursorPos;
              updateCursorState();
            }
          });
          return;
        }
      }

      // Escape: Blur
      if (e.key === "Escape") {
        e.preventDefault();
        onBlur();
        return;
      }

      // Stop propagation for typing keys
      e.stopPropagation();
    },
    [onChange, onBlur, updateCursorState],
  );

  // Handle selection change (for keyboard selection with Shift+arrows)
  const handleSelect = useCallback(() => {
    updateCursorState();
  }, [updateCursorState]);

  // Handle blur
  const handleBlur = useCallback(() => {
    onBlur();
  }, [onBlur]);

  // Handle composition (for IME input like Korean)
  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false;
    handleInput();
  }, [handleInput]);

  return (
    <textarea
      ref={textareaRef}
      className="pointer-events-auto fixed opacity-0"
      style={{
        left: position.x,
        top: position.y,
        width: 1,
        height: 1,
        fontSize: 16,
        padding: 0,
        border: "none",
        outline: "none",
        resize: "none",
        overflow: "hidden",
        whiteSpace: "pre-wrap",
        zIndex: 9999,
      }}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onSelect={handleSelect}
      onBlur={handleBlur}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
    />
  );
});

/**
 * Preserve existing styles when text changes
 * Simple approach: map character positions from old to new text
 */
function preserveStylesOnTextChange(
  oldRichText: TextSegment[],
  oldText: string,
  newText: string,
): TextSegment[] {
  // If no existing rich text or it's simple, just convert
  if (oldRichText.length <= 1) {
    return textToRichText(newText);
  }

  // Build a style map for old text
  const oldStyleMap: Partial<TextSegment>[] = [];
  let charIndex = 0;
  for (const seg of oldRichText) {
    for (let i = 0; i < seg.text.length; i++) {
      oldStyleMap[charIndex] = {
        fontWeight: seg.fontWeight,
        textDecoration: seg.textDecoration,
        fontSize: seg.fontSize,
        textColor: seg.textColor,
        link: seg.link,
      };
      charIndex++;
    }
  }

  // Find common prefix length
  let prefixLen = 0;
  while (
    prefixLen < oldText.length &&
    prefixLen < newText.length &&
    oldText[prefixLen] === newText[prefixLen]
  ) {
    prefixLen++;
  }

  // Find common suffix length
  let suffixLen = 0;
  while (
    suffixLen < oldText.length - prefixLen &&
    suffixLen < newText.length - prefixLen &&
    oldText[oldText.length - 1 - suffixLen] ===
      newText[newText.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  // Build new segments
  const newSegments: TextSegment[] = [];

  for (let i = 0; i < newText.length; i++) {
    let style: Partial<TextSegment> = {};

    if (i < prefixLen) {
      // In prefix - use old style
      style = oldStyleMap[i] ?? {};
    } else if (i >= newText.length - suffixLen) {
      // In suffix - use old style from corresponding position
      const oldIndex = oldText.length - (newText.length - i);
      style = oldStyleMap[oldIndex] ?? {};
    }
    // else: new text in the middle - no style (default)

    const char = newText[i];
    const lastSeg = newSegments[newSegments.length - 1];

    // Check if can merge with last segment
    if (lastSeg && stylesEqual(lastSeg, style)) {
      lastSeg.text += char;
    } else {
      newSegments.push({ text: char, ...style });
    }
  }

  return newSegments.length > 0 ? newSegments : [{ text: "" }];
}

function stylesEqual(
  a: Partial<TextSegment>,
  b: Partial<TextSegment>,
): boolean {
  return (
    (a.fontWeight ?? "normal") === (b.fontWeight ?? "normal") &&
    (a.textDecoration ?? "none") === (b.textDecoration ?? "none") &&
    a.fontSize === b.fontSize &&
    a.textColor === b.textColor &&
    a.link === b.link
  );
}

export default HiddenTextarea;
