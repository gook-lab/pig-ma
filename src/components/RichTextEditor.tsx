import {
  useRef,
  useEffect,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import type { TextSegment, FontFamily, TextAlign } from "@/types";
import {
  richTextToPlainText,
  splitAndApplyStyle,
  toggleStyleInRange,
  mergeAdjacentSegments,
  LINE_HEIGHT,
} from "@/utils/richText";

export interface RichTextEditorProps {
  richText: TextSegment[];
  lineIndents?: number[];
  onChange: (richText: TextSegment[], lineIndents: number[]) => void;
  onBlur: () => void;
  style: {
    fontSize: number;
    fontFamily: FontFamily;
    textAlign: TextAlign;
    textColor?: string;
  };
  zoom?: number;
  placeholder?: string;
}

export interface RichTextEditorRef {
  focus: () => void;
  getSelection: () => { start: number; end: number } | null;
  applyStyle: (style: Partial<TextSegment>) => void;
  toggleBold: () => void;
  toggleStrikethrough: () => void;
  toggleBullet: () => void;
  toggleNumber: () => void;
}

export const RichTextEditor = forwardRef<
  RichTextEditorRef,
  RichTextEditorProps
>(function RichTextEditor(
  {
    richText,
    lineIndents = [],
    onChange,
    onBlur,
    style,
    zoom = 1,
    placeholder,
  },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [localLineIndents, setLocalLineIndents] =
    useState<number[]>(lineIndents);
  const isInitializedRef = useRef(false);

  // Convert richText to HTML for contenteditable
  const toHTML = useCallback(
    (segments: TextSegment[]): string => {
      if (segments.length === 0) return "";

      return segments
        .map((seg) => {
          let text = seg.text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br>");

          const styles: string[] = [];
          if (seg.fontWeight === "bold") styles.push("font-weight:bold");
          if (seg.textDecoration === "line-through")
            styles.push("text-decoration:line-through");
          // zoom 적용하여 폰트 크기 설정
          if (seg.fontSize) styles.push(`font-size:${seg.fontSize * zoom}px`);
          if (seg.textColor) styles.push(`color:${seg.textColor}`);

          if (styles.length > 0 || seg.link) {
            const styleAttr =
              styles.length > 0 ? ` style="${styles.join(";")}"` : "";
            const linkAttr = seg.link ? ` data-link="${seg.link}"` : "";
            return `<span${styleAttr}${linkAttr}>${text}</span>`;
          }
          return text;
        })
        .join("");
    },
    [zoom],
  );

  // Parse HTML back to richText segments
  const fromHTML = useCallback(
    (html: string, currentZoom: number = 1): TextSegment[] => {
      const div = document.createElement("div");
      div.innerHTML = html;

      const segments: TextSegment[] = [];

      const parseNode = (
        node: Node,
        inheritedStyle: Partial<TextSegment> = {},
      ) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || "";
          if (text) {
            segments.push({ text, ...inheritedStyle });
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;

          if (el.tagName === "BR") {
            segments.push({ text: "\n" });
            return;
          }

          // DIV는 줄바꿈으로 처리 (contenteditable에서 Enter 시 생성)
          if (el.tagName === "DIV" && segments.length > 0) {
            const lastSeg = segments[segments.length - 1];
            if (lastSeg && !lastSeg.text.endsWith("\n")) {
              segments.push({ text: "\n" });
            }
          }

          // Parse style from element
          const computedStyle = el.style;
          const currentStyle: Partial<TextSegment> = { ...inheritedStyle };

          if (
            computedStyle.fontWeight === "bold" ||
            el.tagName === "B" ||
            el.tagName === "STRONG"
          ) {
            currentStyle.fontWeight = "bold";
          }
          if (
            computedStyle.textDecoration.includes("line-through") ||
            el.tagName === "S" ||
            el.tagName === "STRIKE"
          ) {
            currentStyle.textDecoration = "line-through";
          }
          if (computedStyle.fontSize) {
            // zoom으로 나눠서 원본 크기 복원
            const parsedSize = parseInt(computedStyle.fontSize);
            currentStyle.fontSize = Math.round(parsedSize / currentZoom);
          }
          if (computedStyle.color) {
            currentStyle.textColor = computedStyle.color;
          }
          if (el.dataset.link) {
            currentStyle.link = el.dataset.link;
          }

          // Handle nested nodes - 재귀적으로 스타일 상속
          el.childNodes.forEach((child) => parseNode(child, currentStyle));
        }
      };

      div.childNodes.forEach((node) => parseNode(node));

      // Normalize newlines
      const normalized = segments.map((seg) => ({
        ...seg,
        text: seg.text.replace(/\r\n/g, "\n"),
      }));

      return mergeAdjacentSegments(normalized);
    },
    [],
  );

  // Get current selection range in terms of plain text indices
  const getSelectionRange = useCallback((): {
    start: number;
    end: number;
  } | null => {
    const selection = window.getSelection();
    if (!selection || !editorRef.current) return null;

    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return null;

    // Calculate offset by traversing nodes
    const getTextOffset = (
      container: Node,
      offset: number,
      root: HTMLElement,
    ): number => {
      let totalOffset = 0;

      const walk = (node: Node): boolean => {
        if (node === container) {
          if (node.nodeType === Node.TEXT_NODE) {
            totalOffset += offset;
          }
          return true;
        }

        if (node.nodeType === Node.TEXT_NODE) {
          if (node.textContent) {
            totalOffset += node.textContent.length;
          }
        } else if (
          node.nodeType === Node.ELEMENT_NODE &&
          (node as HTMLElement).tagName === "BR"
        ) {
          totalOffset += 1; // BR counts as newline
        }

        if (node.childNodes) {
          for (let i = 0; i < node.childNodes.length; i++) {
            if (walk(node.childNodes[i]!)) return true;
          }
        }
        return false;
      };

      walk(root);
      return totalOffset;
    };

    const start = getTextOffset(
      range.startContainer,
      range.startOffset,
      editorRef.current,
    );
    const end = getTextOffset(
      range.endContainer,
      range.endOffset,
      editorRef.current,
    );

    return { start: Math.min(start, end), end: Math.max(start, end) };
  }, []);

  // Get current richText from DOM (for accurate style application)
  const getCurrentRichText = useCallback((): TextSegment[] => {
    if (!editorRef.current) return richText;
    const html = editorRef.current.innerHTML;
    return fromHTML(html, zoom);
  }, [richText, fromHTML, zoom]);

  // Restore selection after DOM update
  const restoreSelection = useCallback((start: number, end: number) => {
    if (!editorRef.current) return;

    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    let currentOffset = 0;
    let startNode: Node | null = null;
    let startOffset = 0;
    let endNode: Node | null = null;
    let endOffset = 0;

    const walkNodes = (node: Node) => {
      if (startNode && endNode) return;

      if (node.nodeType === Node.TEXT_NODE) {
        const textLen = node.textContent?.length ?? 0;
        if (!startNode && currentOffset + textLen >= start) {
          startNode = node;
          startOffset = start - currentOffset;
        }
        if (!endNode && currentOffset + textLen >= end) {
          endNode = node;
          endOffset = end - currentOffset;
        }
        currentOffset += textLen;
      } else if (
        node.nodeType === Node.ELEMENT_NODE &&
        (node as HTMLElement).tagName === "BR"
      ) {
        if (!startNode && currentOffset + 1 >= start) {
          startNode = node.parentNode;
          startOffset = Array.from(node.parentNode?.childNodes ?? []).indexOf(
            node as ChildNode,
          );
        }
        if (!endNode && currentOffset + 1 >= end) {
          endNode = node.parentNode;
          endOffset = Array.from(node.parentNode?.childNodes ?? []).indexOf(
            node as ChildNode,
          );
        }
        currentOffset += 1;
      } else {
        node.childNodes.forEach(walkNodes);
      }
    };

    editorRef.current.childNodes.forEach(walkNodes);

    if (startNode && endNode) {
      try {
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        selection.removeAllRanges();
        selection.addRange(range);
      } catch {
        // 선택 복원 실패 시 무시
      }
    }
  }, []);

  // Apply style to current selection
  const applyStyle = useCallback(
    (styleUpdate: Partial<TextSegment>) => {
      const selection = getSelectionRange();
      if (!selection || selection.start === selection.end) return;

      // 현재 DOM 상태에서 richText 파싱
      const currentRichText = getCurrentRichText();
      const newRichText = splitAndApplyStyle(
        currentRichText,
        selection.start,
        selection.end,
        styleUpdate,
      );

      // DOM 업데이트 후 선택 복원
      if (editorRef.current) {
        editorRef.current.innerHTML = toHTML(newRichText);
        restoreSelection(selection.start, selection.end);
      }

      onChange(newRichText, localLineIndents);
    },
    [
      getCurrentRichText,
      localLineIndents,
      onChange,
      getSelectionRange,
      toHTML,
      restoreSelection,
    ],
  );

  // Toggle bold
  const toggleBold = useCallback(() => {
    const selection = getSelectionRange();
    if (!selection || selection.start === selection.end) return;

    // 현재 DOM 상태에서 richText 파싱
    const currentRichText = getCurrentRichText();
    const newRichText = toggleStyleInRange(
      currentRichText,
      selection.start,
      selection.end,
      "fontWeight",
      "bold",
      "normal",
    );

    // DOM 업데이트 후 선택 복원
    if (editorRef.current) {
      editorRef.current.innerHTML = toHTML(newRichText);
      restoreSelection(selection.start, selection.end);
    }

    onChange(newRichText, localLineIndents);
  }, [
    getCurrentRichText,
    localLineIndents,
    onChange,
    getSelectionRange,
    toHTML,
    restoreSelection,
  ]);

  // Toggle strikethrough
  const toggleStrikethrough = useCallback(() => {
    const selection = getSelectionRange();
    if (!selection || selection.start === selection.end) return;

    // 현재 DOM 상태에서 richText 파싱
    const currentRichText = getCurrentRichText();
    const newRichText = toggleStyleInRange(
      currentRichText,
      selection.start,
      selection.end,
      "textDecoration",
      "line-through",
      "none",
    );

    // DOM 업데이트 후 선택 복원
    if (editorRef.current) {
      editorRef.current.innerHTML = toHTML(newRichText);
      restoreSelection(selection.start, selection.end);
    }

    onChange(newRichText, localLineIndents);
  }, [
    getCurrentRichText,
    localLineIndents,
    onChange,
    getSelectionRange,
    toHTML,
    restoreSelection,
  ]);

  // Toggle bullet point on current line
  const toggleBullet = useCallback(() => {
    if (!editorRef.current) return;

    const selection = getSelectionRange();
    if (!selection) return;

    const currentRichText = getCurrentRichText();
    const plainText = richTextToPlainText(currentRichText);
    const cursorPos = selection.start;

    // 현재 줄 찾기
    const beforeCursor = plainText.slice(0, cursorPos);
    const lineStart = beforeCursor.lastIndexOf("\n") + 1;
    const lineEnd = plainText.indexOf("\n", cursorPos);
    const actualLineEnd = lineEnd === -1 ? plainText.length : lineEnd;
    const lineText = plainText.slice(lineStart, actualLineEnd);

    let newPlainText: string;
    let newCursorPos: number;

    // 이미 글머리 기호가 있으면 제거, 없으면 추가
    if (lineText.startsWith("• ")) {
      newPlainText =
        plainText.slice(0, lineStart) +
        lineText.slice(2) +
        plainText.slice(actualLineEnd);
      newCursorPos = Math.max(lineStart, cursorPos - 2);
    } else if (lineText.match(/^\d+\. /)) {
      // 번호 매기기가 있으면 글머리로 교체
      const numMatch = lineText.match(/^\d+\. /);
      const numLen = numMatch ? numMatch[0].length : 0;
      newPlainText =
        plainText.slice(0, lineStart) +
        "• " +
        lineText.slice(numLen) +
        plainText.slice(actualLineEnd);
      newCursorPos = cursorPos - numLen + 2;
    } else {
      newPlainText =
        plainText.slice(0, lineStart) +
        "• " +
        lineText +
        plainText.slice(actualLineEnd);
      newCursorPos = cursorPos + 2;
    }

    const newRichText = [{ text: newPlainText }];
    editorRef.current.innerHTML = toHTML(newRichText);
    restoreSelection(newCursorPos, newCursorPos);
    onChange(newRichText, localLineIndents);
  }, [
    getSelectionRange,
    getCurrentRichText,
    toHTML,
    restoreSelection,
    onChange,
    localLineIndents,
  ]);

  // Toggle numbered list on current line
  const toggleNumber = useCallback(() => {
    if (!editorRef.current) return;

    const selection = getSelectionRange();
    if (!selection) return;

    const currentRichText = getCurrentRichText();
    const plainText = richTextToPlainText(currentRichText);
    const cursorPos = selection.start;

    // 현재 줄 찾기
    const beforeCursor = plainText.slice(0, cursorPos);
    const lineStart = beforeCursor.lastIndexOf("\n") + 1;
    const lineEnd = plainText.indexOf("\n", cursorPos);
    const actualLineEnd = lineEnd === -1 ? plainText.length : lineEnd;
    const lineText = plainText.slice(lineStart, actualLineEnd);

    // 현재 줄 번호 계산 (이전 줄들의 번호 매기기 확인)
    const lines = plainText.slice(0, lineStart).split("\n");
    let lineNumber = 1;
    for (let i = lines.length - 1; i >= 0; i--) {
      const match = lines[i]!.match(/^(\d+)\. /);
      if (match) {
        lineNumber = parseInt(match[1]!) + 1;
        break;
      }
    }

    let newPlainText: string;
    let newCursorPos: number;

    // 이미 번호 매기기가 있으면 제거, 없으면 추가
    const numMatch = lineText.match(/^\d+\. /);
    if (numMatch) {
      newPlainText =
        plainText.slice(0, lineStart) +
        lineText.slice(numMatch[0].length) +
        plainText.slice(actualLineEnd);
      newCursorPos = Math.max(lineStart, cursorPos - numMatch[0].length);
    } else if (lineText.startsWith("• ")) {
      // 글머리가 있으면 번호로 교체
      const prefix = `${lineNumber}. `;
      newPlainText =
        plainText.slice(0, lineStart) +
        prefix +
        lineText.slice(2) +
        plainText.slice(actualLineEnd);
      newCursorPos = cursorPos - 2 + prefix.length;
    } else {
      const prefix = `${lineNumber}. `;
      newPlainText =
        plainText.slice(0, lineStart) +
        prefix +
        lineText +
        plainText.slice(actualLineEnd);
      newCursorPos = cursorPos + prefix.length;
    }

    const newRichText = [{ text: newPlainText }];
    editorRef.current.innerHTML = toHTML(newRichText);
    restoreSelection(newCursorPos, newCursorPos);
    onChange(newRichText, localLineIndents);
  }, [
    getSelectionRange,
    getCurrentRichText,
    toHTML,
    restoreSelection,
    onChange,
    localLineIndents,
  ]);

  // Expose methods to parent
  useImperativeHandle(
    ref,
    () => ({
      focus: () => editorRef.current?.focus(),
      getSelection: getSelectionRange,
      applyStyle,
      toggleBold,
      toggleStrikethrough,
      toggleBullet,
      toggleNumber,
    }),
    [
      getSelectionRange,
      applyStyle,
      toggleBold,
      toggleStrikethrough,
      toggleBullet,
      toggleNumber,
    ],
  );

  // Handle input
  const handleInput = useCallback(() => {
    if (isComposing || !editorRef.current) return;

    const html = editorRef.current.innerHTML;
    const newSegments = fromHTML(html, zoom);

    // Calculate line indents from content
    const plainText = richTextToPlainText(newSegments);
    const lines = plainText.split("\n");
    const newLineIndents = lines.map((_, idx) => localLineIndents[idx] ?? 0);

    onChange(newSegments, newLineIndents);
  }, [isComposing, fromHTML, onChange, localLineIndents, zoom]);

  // Handle keydown
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Enter 키 처리 - 글머리 기호/번호 매기기 자동 추가
      if (e.key === "Enter") {
        const currentRichText = getCurrentRichText();
        const plainText = richTextToPlainText(currentRichText);
        const cursorPos = getSelectionRange()?.start ?? 0;

        // 현재 줄 찾기
        const beforeCursor = plainText.slice(0, cursorPos);
        const lineStart = beforeCursor.lastIndexOf("\n") + 1;
        const lineEnd = plainText.indexOf("\n", cursorPos);
        const actualLineEnd = lineEnd === -1 ? plainText.length : lineEnd;
        const lineText = plainText.slice(lineStart, actualLineEnd);

        // 현재 줄의 들여쓰기(선행 공백) 감지
        const leadingSpaces = lineText.match(/^[ \t]*/)?.[0] ?? "";

        // 글머리 기호 처리
        const bulletMatch = lineText.match(/^([ \t]*)(• )(.*)/);
        if (bulletMatch) {
          e.preventDefault();
          const [, indent, bullet, content] = bulletMatch;

          // 빈 글머리 줄이면 글머리 제거
          if (content!.trim() === "") {
            const newPlainText =
              plainText.slice(0, lineStart) +
              indent! +
              plainText.slice(actualLineEnd);
            const newRichText = [{ text: newPlainText }];
            if (editorRef.current) {
              editorRef.current.innerHTML = toHTML(newRichText);
              restoreSelection(
                lineStart + indent!.length,
                lineStart + indent!.length,
              );
            }
            onChange(newRichText, localLineIndents);
          } else {
            // 다음 줄에 글머리 기호 추가
            const insertText = "\n" + indent! + bullet;
            document.execCommand("insertText", false, insertText);
            handleInput();
          }
          return;
        }

        // 번호 매기기 처리
        const numberMatch = lineText.match(/^([ \t]*)(\d+)\. (.*)/);
        if (numberMatch) {
          e.preventDefault();
          const [, indent, numStr, content] = numberMatch;
          const currentNum = parseInt(numStr!);

          // 빈 번호 줄이면 번호 제거
          if (content!.trim() === "") {
            const newPlainText =
              plainText.slice(0, lineStart) +
              indent! +
              plainText.slice(actualLineEnd);
            const newRichText = [{ text: newPlainText }];
            if (editorRef.current) {
              editorRef.current.innerHTML = toHTML(newRichText);
              restoreSelection(
                lineStart + indent!.length,
                lineStart + indent!.length,
              );
            }
            onChange(newRichText, localLineIndents);
          } else {
            // 다음 줄에 증가된 번호 추가
            const insertText = "\n" + indent! + (currentNum + 1) + ". ";
            document.execCommand("insertText", false, insertText);
            handleInput();
          }
          return;
        }

        // Shift+Enter: 들여쓰기 유지하면서 줄바꿈
        if (e.shiftKey && leadingSpaces.length > 0) {
          e.preventDefault();
          const insertText = "\n" + leadingSpaces;
          document.execCommand("insertText", false, insertText);
          handleInput();
          return;
        }

        // 일반 Enter는 기본 동작 (줄바꿈)
        return;
      }

      // Backspace 키 처리 - 줄 시작에서 글머리/번호 먼저 제거
      if (e.key === "Backspace") {
        const selection = getSelectionRange();
        if (!selection || selection.start !== selection.end) return; // 선택 영역이 있으면 기본 동작

        const currentRichText = getCurrentRichText();
        const plainText = richTextToPlainText(currentRichText);
        const cursorPos = selection.start;

        // 현재 줄 찾기
        const beforeCursor = plainText.slice(0, cursorPos);
        const lineStart = beforeCursor.lastIndexOf("\n") + 1;
        const cursorInLine = cursorPos - lineStart;

        // 줄 시작 바로 뒤에 커서가 있을 때 (글머리/번호 바로 뒤)
        const lineText = plainText.slice(lineStart);

        // 글머리 기호 바로 뒤에서 Backspace
        if (lineText.startsWith("• ") && cursorInLine === 2) {
          e.preventDefault();
          const newPlainText =
            plainText.slice(0, lineStart) + plainText.slice(lineStart + 2);
          const newRichText = [{ text: newPlainText }];
          if (editorRef.current) {
            editorRef.current.innerHTML = toHTML(newRichText);
            restoreSelection(lineStart, lineStart);
          }
          onChange(newRichText, localLineIndents);
          return;
        }

        // 번호 매기기 바로 뒤에서 Backspace
        const numMatch = lineText.match(/^(\d+)\. /);
        if (numMatch && cursorInLine === numMatch[0].length) {
          e.preventDefault();
          const newPlainText =
            plainText.slice(0, lineStart) +
            plainText.slice(lineStart + numMatch[0].length);
          const newRichText = [{ text: newPlainText }];
          if (editorRef.current) {
            editorRef.current.innerHTML = toHTML(newRichText);
            restoreSelection(lineStart, lineStart);
          }
          onChange(newRichText, localLineIndents);
          return;
        }

        // 기본 Backspace 동작
        return;
      }

      // Tab for indent - 공백 삽입 방식
      if (e.key === "Tab") {
        e.preventDefault();

        if (e.shiftKey) {
          // Shift+Tab: 줄 시작의 공백 제거
          const selection = window.getSelection();
          if (!selection || !editorRef.current) return;

          const currentRichText = getCurrentRichText();
          const plainText = richTextToPlainText(currentRichText);
          const cursorPos = getSelectionRange()?.start ?? 0;

          // 현재 줄의 시작 위치 찾기
          const beforeCursor = plainText.slice(0, cursorPos);
          const lineStart = beforeCursor.lastIndexOf("\n") + 1;
          const lineText = plainText.slice(lineStart);

          // 줄 시작에 공백이 있으면 제거
          const leadingSpaces = lineText.match(/^[ \t]+/);
          if (leadingSpaces) {
            const spacesToRemove = Math.min(leadingSpaces[0].length, 2);
            // DOM에서 공백 제거
            const newPlainText =
              plainText.slice(0, lineStart) +
              plainText.slice(lineStart + spacesToRemove);

            // richText 업데이트
            const newRichText = [{ text: newPlainText }];
            if (editorRef.current) {
              editorRef.current.innerHTML = toHTML(newRichText);
              // 커서 위치 복원
              restoreSelection(
                Math.max(lineStart, cursorPos - spacesToRemove),
                Math.max(lineStart, cursorPos - spacesToRemove),
              );
            }
            onChange(newRichText, localLineIndents);
          }
        } else {
          // Tab: 현재 줄 시작에 공백 2개 삽입
          const currentRichText = getCurrentRichText();
          const plainText = richTextToPlainText(currentRichText);
          const cursorPos = getSelectionRange()?.start ?? 0;

          // 현재 줄의 시작 위치 찾기
          const beforeCursor = plainText.slice(0, cursorPos);
          const lineStart = beforeCursor.lastIndexOf("\n") + 1;

          // 줄 시작에 공백 2개 삽입
          const newPlainText =
            plainText.slice(0, lineStart) + "  " + plainText.slice(lineStart);

          const newRichText = [{ text: newPlainText }];
          if (editorRef.current) {
            editorRef.current.innerHTML = toHTML(newRichText);
            // 커서 위치 복원 (공백 2개 추가됨)
            restoreSelection(cursorPos + 2, cursorPos + 2);
          }
          onChange(newRichText, localLineIndents);
        }
        return;
      }

      // Cmd/Ctrl+B for bold
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        toggleBold();
        return;
      }

      // Cmd/Ctrl+S for strikethrough
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        toggleStrikethrough();
        return;
      }

      // ESC to blur
      if (e.key === "Escape") {
        e.preventDefault();
        onBlur();
        return;
      }

      e.stopPropagation();
    },
    [
      getCurrentRichText,
      localLineIndents,
      onChange,
      onBlur,
      toggleBold,
      toggleStrikethrough,
      getSelectionRange,
      handleInput,
      toHTML,
      restoreSelection,
    ],
  );

  // Initialize content on mount only
  useEffect(() => {
    if (editorRef.current && !isInitializedRef.current) {
      const html = toHTML(richText);
      editorRef.current.innerHTML = html;
      isInitializedRef.current = true;
    }
  }, [richText, toHTML]);

  // Sync line indents
  useEffect(() => {
    setLocalLineIndents(lineIndents);
  }, [lineIndents]);

  // Focus on mount
  useEffect(() => {
    requestAnimationFrame(() => {
      editorRef.current?.focus();
    });
  }, []);

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onBlur={onBlur}
      onCompositionStart={() => setIsComposing(true)}
      onCompositionEnd={() => {
        setIsComposing(false);
        handleInput();
      }}
      className="h-full w-full break-words whitespace-pre-wrap outline-none"
      style={{
        fontSize: style.fontSize,
        fontFamily: style.fontFamily,
        textAlign: style.textAlign,
        color: style.textColor ?? "#000000",
        lineHeight: LINE_HEIGHT,
        minHeight: "1em",
        margin: 0,
        padding: 0,
      }}
      data-placeholder={placeholder}
    />
  );
});
