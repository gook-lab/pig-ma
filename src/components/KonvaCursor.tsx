import { memo, useMemo, useState, useEffect } from "react";
import { Group, Rect, Line } from "react-konva";
import type { TextSegment } from "@/types";
import { measureTextWidth, LINE_HEIGHT } from "@/utils/richText";

interface KonvaCursorProps {
  richText: TextSegment[];
  cursorIndex: number;
  selectionStart: number | null;
  selectionEnd: number | null;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontFamily: string;
  textAlign: "left" | "center" | "right";
  lineIndents?: number[];
}

interface CharPosition {
  x: number;
  y: number;
  lineIndex: number;
  lineFontSize: number; // max fontSize at this line for line height calculation
  charFontSize: number; // actual fontSize of the character at this position
}

interface LineInfo {
  chars: { char: string; fontSize: number; fontWeight: string }[];
  width: number;
  indent: number;
  maxFontSize: number; // Maximum font size in this line
}

/**
 * Calculate the position of each character for cursor/selection rendering
 * Returns positions with per-line font sizes for proper cursor height
 */
function calculateCharPositions(
  richText: TextSegment[],
  maxWidth: number,
  defaultFontSize: number,
  fontFamily: string,
  textAlign: "left" | "center" | "right",
  lineIndents: number[] = [],
): { positions: CharPosition[]; lineHeights: number[] } {
  const positions: CharPosition[] = [];

  // Handle empty richText - return single position at origin with default font size
  if (richText.length === 0 || richText.every((seg) => seg.text === "")) {
    const lineHeight = defaultFontSize * LINE_HEIGHT;
    positions.push({
      x: 0,
      y: 0,
      lineIndex: 0,
      lineFontSize: defaultFontSize,
      charFontSize: defaultFontSize,
    });
    return { positions, lineHeights: [lineHeight] };
  }

  // Build lines with max font size tracking
  const lines: LineInfo[] = [];
  let currentLine: LineInfo = {
    chars: [],
    width: 0,
    indent: lineIndents[0] ?? 0,
    maxFontSize: defaultFontSize,
  };
  let lineIndex = 0;

  for (const segment of richText) {
    const segFontSize = segment.fontSize ?? defaultFontSize;
    const fontWeight = segment.fontWeight ?? "normal";

    for (let i = 0; i < segment.text.length; i++) {
      const char = segment.text[i];

      if (char === "\n") {
        lines.push(currentLine);
        lineIndex++;
        currentLine = {
          chars: [],
          width: 0,
          indent: lineIndents[lineIndex] ?? 0,
          maxFontSize: defaultFontSize,
        };
        continue;
      }

      const charWidth = measureTextWidth(
        char,
        segFontSize,
        fontFamily,
        fontWeight,
      );
      const indentWidth = currentLine.indent * 20;

      // Check for word wrap
      if (
        currentLine.width + indentWidth + charWidth > maxWidth &&
        currentLine.chars.length > 0
      ) {
        lines.push(currentLine);
        lineIndex++;
        currentLine = {
          chars: [],
          width: 0,
          indent: lineIndents[lineIndex] ?? 0,
          maxFontSize: defaultFontSize,
        };
      }

      currentLine.chars.push({ char, fontSize: segFontSize, fontWeight });
      currentLine.width += charWidth;
      currentLine.maxFontSize = Math.max(currentLine.maxFontSize, segFontSize);
    }
  }
  lines.push(currentLine);

  // Calculate line heights based on max font size per line
  const lineHeights = lines.map((line) => line.maxFontSize * LINE_HEIGHT);

  // Calculate cumulative Y positions
  const lineYPositions: number[] = [];
  let cumulativeY = 0;
  for (let i = 0; i < lines.length; i++) {
    lineYPositions.push(cumulativeY);
    cumulativeY += lineHeights[i];
  }

  // Calculate positions based on text alignment
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const y = lineYPositions[lineIdx];
    const indentWidth = line.indent * 20;
    const lineFontSize = line.maxFontSize;

    // Calculate line start X based on alignment
    let lineStartX = indentWidth;
    if (textAlign === "center") {
      lineStartX = (maxWidth - line.width) / 2;
    } else if (textAlign === "right") {
      lineStartX = maxWidth - line.width;
    }

    let currentX = lineStartX;

    for (const charInfo of line.chars) {
      positions.push({
        x: currentX,
        y,
        lineIndex: lineIdx,
        lineFontSize,
        charFontSize: charInfo.fontSize,
      });
      const charWidth = measureTextWidth(
        charInfo.char,
        charInfo.fontSize,
        fontFamily,
        charInfo.fontWeight,
      );
      currentX += charWidth;
    }

    // Add position for end of line (after last character)
    // This handles cursor at end of line
    if (lineIdx < lines.length - 1) {
      // Add newline character position - use last char's fontSize or default
      const lastCharFontSize =
        line.chars.length > 0
          ? line.chars[line.chars.length - 1].fontSize
          : defaultFontSize;
      positions.push({
        x: currentX,
        y,
        lineIndex: lineIdx,
        lineFontSize,
        charFontSize: lastCharFontSize,
      });
    }
  }

  // Add final position at end of text
  const lastLine = lines[lines.length - 1];
  const lastY = lineYPositions[lines.length - 1];
  const lastIndent = lastLine.indent * 20;
  let lastX = lastIndent + lastLine.width;
  if (textAlign === "center") {
    lastX = (maxWidth - lastLine.width) / 2 + lastLine.width;
  } else if (textAlign === "right") {
    lastX = maxWidth;
  }
  // Use last char's fontSize for cursor at end, or default if line is empty
  const lastCharFontSize =
    lastLine.chars.length > 0
      ? lastLine.chars[lastLine.chars.length - 1].fontSize
      : defaultFontSize;
  positions.push({
    x: lastX,
    y: lastY,
    lineIndex: lines.length - 1,
    lineFontSize: lastLine.maxFontSize,
    charFontSize: lastCharFontSize,
  });

  return { positions, lineHeights };
}

export const KonvaCursor = memo(function KonvaCursor({
  richText,
  cursorIndex,
  selectionStart,
  selectionEnd,
  x,
  y,
  width,
  fontSize,
  fontFamily,
  textAlign,
  lineIndents = [],
}: KonvaCursorProps) {
  // Calculate all character positions with line heights
  const { positions: charPositions, lineHeights } = useMemo(() => {
    return calculateCharPositions(
      richText,
      width,
      fontSize,
      fontFamily,
      textAlign,
      lineIndents,
    );
  }, [richText, width, fontSize, fontFamily, textAlign, lineIndents]);

  // Get cursor position and height
  const { cursorPos, cursorHeight } = useMemo(() => {
    const idx = Math.max(0, Math.min(cursorIndex, charPositions.length - 1));
    const pos = charPositions[idx] ?? {
      x: 0,
      y: 0,
      lineIndex: 0,
      lineFontSize: fontSize,
      charFontSize: fontSize,
    };
    const height = pos.charFontSize * LINE_HEIGHT;
    return { cursorPos: pos, cursorHeight: height };
  }, [charPositions, cursorIndex, fontSize]);

  // Calculate selection rectangles
  const selectionRects = useMemo(() => {
    if (
      selectionStart === null ||
      selectionEnd === null ||
      selectionStart === selectionEnd
    ) {
      return [];
    }

    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    const rects: { x: number; y: number; width: number; height: number }[] = [];

    // Group selections by line
    const lineSelections = new Map<number, { minX: number; maxX: number }>();

    for (let i = start; i < end && i < charPositions.length - 1; i++) {
      const pos = charPositions[i];
      const nextPos = charPositions[i + 1];

      if (!pos || !nextPos) continue;

      const charWidth = nextPos.x - pos.x;
      const lineIdx = pos.lineIndex;

      if (lineSelections.has(lineIdx)) {
        const existing = lineSelections.get(lineIdx)!;
        existing.minX = Math.min(existing.minX, pos.x);
        existing.maxX = Math.max(existing.maxX, pos.x + Math.max(charWidth, 0));
      } else {
        lineSelections.set(lineIdx, {
          minX: pos.x,
          maxX: pos.x + Math.max(charWidth, 0),
        });
      }
    }

    // Convert to rectangles with proper line heights
    let cumulativeY = 0;
    for (let lineIdx = 0; lineIdx < lineHeights.length; lineIdx++) {
      const sel = lineSelections.get(lineIdx);
      if (sel) {
        rects.push({
          x: sel.minX,
          y: cumulativeY,
          width: Math.max(sel.maxX - sel.minX, 2),
          height: lineHeights[lineIdx],
        });
      }
      cumulativeY += lineHeights[lineIdx];
    }

    return rects;
  }, [selectionStart, selectionEnd, charPositions, lineHeights]);

  const hasSelection =
    selectionStart !== null &&
    selectionEnd !== null &&
    selectionStart !== selectionEnd;

  // Cursor blinking
  const [showCursor, setShowCursor] = useState(true);
  useEffect(() => {
    if (hasSelection) return; // No blinking when selection exists
    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, [hasSelection]);

  // Reset cursor visibility when cursor position changes
  useEffect(() => {
    setShowCursor(true);
  }, [cursorIndex]);

  return (
    <Group x={x} y={y}>
      {/* Selection highlights */}
      {selectionRects.map((rect, idx) => (
        <Rect
          key={`sel-${idx}`}
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          fill="#3b82f6"
          opacity={0.3}
          listening={false}
        />
      ))}

      {/* Cursor line (only when no selection and visible) */}
      {!hasSelection && showCursor && (
        <Line
          points={[
            cursorPos.x,
            cursorPos.y,
            cursorPos.x,
            cursorPos.y + cursorHeight,
          ]}
          stroke="#000000"
          strokeWidth={2}
          listening={false}
        />
      )}
    </Group>
  );
});

export default KonvaCursor;
