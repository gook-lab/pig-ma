import type { TextSegment } from "@/types";

/**
 * 공통 라인 높이 배율 (HTML CSS와 Konva에서 동일하게 사용)
 */
export const LINE_HEIGHT = 1.5;

/**
 * Convert plain text to rich text segments
 */
export function textToRichText(text: string): TextSegment[] {
  if (!text) return [];
  return [{ text }];
}

/**
 * Convert rich text segments to plain text (for backup/compatibility)
 */
export function richTextToPlainText(richText: TextSegment[]): string {
  if (!richText || richText.length === 0) return "";
  return richText.map((seg) => seg.text).join("");
}

/**
 * Check if two segments have the same style
 */
function segmentsHaveSameStyle(a: TextSegment, b: TextSegment): boolean {
  return (
    (a.fontWeight ?? "normal") === (b.fontWeight ?? "normal") &&
    (a.textDecoration ?? "none") === (b.textDecoration ?? "none") &&
    a.fontSize === b.fontSize &&
    a.textColor === b.textColor &&
    a.link === b.link
  );
}

/**
 * Merge adjacent segments with the same style
 */
export function mergeAdjacentSegments(segments: TextSegment[]): TextSegment[] {
  if (segments.length === 0) return [];

  const result: TextSegment[] = [];
  let current = { ...segments[0]! };

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i]!;
    if (segmentsHaveSameStyle(current, next)) {
      current.text += next.text;
    } else {
      if (current.text) result.push(current);
      current = { ...next };
    }
  }

  if (current.text) result.push(current);
  return result;
}

/**
 * Split segments and apply style to a specific range
 *
 * @param segments - Existing rich text segments
 * @param startIndex - Start character index in plain text
 * @param endIndex - End character index in plain text
 * @param style - Style to apply
 * @returns New array of segments with style applied
 */
export function splitAndApplyStyle(
  segments: TextSegment[],
  startIndex: number,
  endIndex: number,
  style: Partial<TextSegment>,
): TextSegment[] {
  if (segments.length === 0 || startIndex >= endIndex) return segments;

  const result: TextSegment[] = [];
  let currentIndex = 0;

  for (const segment of segments) {
    const segmentEnd = currentIndex + segment.text.length;

    // Segment is entirely before the selection
    if (segmentEnd <= startIndex) {
      result.push(segment);
    }
    // Segment is entirely after the selection
    else if (currentIndex >= endIndex) {
      result.push(segment);
    }
    // Segment overlaps with the selection
    else {
      // Part before selection
      if (currentIndex < startIndex) {
        result.push({
          ...segment,
          text: segment.text.slice(0, startIndex - currentIndex),
        });
      }

      // Selected part
      const selectedStart = Math.max(0, startIndex - currentIndex);
      const selectedEnd = Math.min(
        segment.text.length,
        endIndex - currentIndex,
      );
      result.push({
        ...segment,
        ...style,
        text: segment.text.slice(selectedStart, selectedEnd),
      });

      // Part after selection
      if (segmentEnd > endIndex) {
        result.push({
          ...segment,
          text: segment.text.slice(endIndex - currentIndex),
        });
      }
    }

    currentIndex = segmentEnd;
  }

  return mergeAdjacentSegments(result);
}

/**
 * Toggle a boolean style for a range
 * If all characters in range have the style, remove it; otherwise apply it
 */
export function toggleStyleInRange(
  segments: TextSegment[],
  startIndex: number,
  endIndex: number,
  styleKey: "fontWeight" | "textDecoration",
  activeValue: "bold" | "line-through",
  inactiveValue?: "normal" | "none",
): TextSegment[] {
  // Smart default for inactiveValue based on activeValue
  const inactive = inactiveValue ?? (activeValue === "bold" ? "normal" : "none");

  // Check if all characters in range have the style
  let currentIndex = 0;
  let allHaveStyle = true;

  for (const segment of segments) {
    const segmentEnd = currentIndex + segment.text.length;

    // Check overlap with selection
    if (currentIndex < endIndex && segmentEnd > startIndex) {
      if (segment[styleKey] !== activeValue) {
        allHaveStyle = false;
        break;
      }
    }

    currentIndex = segmentEnd;
  }

  const newValue = allHaveStyle ? inactive : activeValue;
  return splitAndApplyStyle(segments, startIndex, endIndex, {
    [styleKey]: newValue,
  });
}

// Canvas context cache for text measurement (performance optimization)
let _measureCanvas: HTMLCanvasElement | null = null;
let _measureCtx: CanvasRenderingContext2D | null = null;
let _lastFont: string = "";

function getMeasureContext(): CanvasRenderingContext2D | null {
  // DOM 이 없는 환경(테스트/SSR)에서는 measureTextWidth 의 추정 폴백을 쓴다
  if (typeof document === "undefined") return null;
  if (!_measureCanvas) {
    _measureCanvas = document.createElement("canvas");
    _measureCtx = _measureCanvas.getContext("2d");
  }
  return _measureCtx;
}

/**
 * Measure text width using canvas (cached context for performance)
 */
export function measureTextWidth(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: string = "normal",
): number {
  const ctx = getMeasureContext();
  if (!ctx) return text.length * fontSize * 0.6; // Fallback estimate

  const font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  // Only update font if changed (avoid expensive font parsing)
  if (_lastFont !== font) {
    ctx.font = font;
    _lastFont = font;
  }
  return ctx.measureText(text).width;
}

/**
 * Calculate line breaks for rich text segments
 * Returns an array of line data, each containing segment ranges
 */
export interface LineData {
  segments: {
    segmentIndex: number;
    startChar: number;
    endChar: number;
  }[];
  indent: number;
}

export function calculateLineBreaks(
  segments: TextSegment[],
  maxWidth: number,
  defaultFontSize: number,
  defaultFontFamily: string = "Pretendard",
  lineIndents: number[] = [],
): LineData[] {
  if (segments.length === 0) return [];

  const lines: LineData[] = [];
  let currentLine: LineData = { segments: [], indent: lineIndents[0] ?? 0 };
  let currentLineWidth = currentLine.indent * 20; // 20px per indent level

  let charIndex = 0;
  let lineIndex = 0;

  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const segment = segments[segIdx]!;
    const fontSize = segment.fontSize ?? defaultFontSize;
    const fontFamily = defaultFontFamily;
    const fontWeight = segment.fontWeight ?? "normal";

    let segStartChar = 0;

    for (let i = 0; i < segment.text.length; i++) {
      const char = segment.text[i]!;

      // Handle explicit line breaks
      if (char === "\n") {
        if (i > segStartChar || currentLine.segments.length > 0) {
          if (i > segStartChar) {
            currentLine.segments.push({
              segmentIndex: segIdx,
              startChar: segStartChar,
              endChar: i,
            });
          }
          lines.push(currentLine);
        }
        lineIndex++;
        currentLine = {
          segments: [],
          indent: lineIndents[lineIndex] ?? 0,
        };
        currentLineWidth = currentLine.indent * 20;
        segStartChar = i + 1;
        charIndex++;
        continue;
      }

      const charWidth = measureTextWidth(
        char,
        fontSize,
        fontFamily,
        fontWeight,
      );

      // Check if we need to wrap
      if (currentLineWidth + charWidth > maxWidth && currentLineWidth > 0) {
        // Find word boundary
        let wrapPoint = i;
        if (char !== " ") {
          // Look back for a space
          for (let j = i - 1; j > segStartChar; j--) {
            if (segment.text[j]! === " ") {
              wrapPoint = j + 1;
              break;
            }
          }
        }

        // Add current segment up to wrap point
        if (wrapPoint > segStartChar) {
          currentLine.segments.push({
            segmentIndex: segIdx,
            startChar: segStartChar,
            endChar: wrapPoint,
          });
        }

        lines.push(currentLine);
        lineIndex++;
        currentLine = {
          segments: [],
          indent: lineIndents[lineIndex]!,
        };
        currentLineWidth = currentLine.indent * 20;
        segStartChar = wrapPoint;

        // Skip leading space on new line
        if (segment.text[segStartChar]! === " ") {
          segStartChar++;
        }

        i = segStartChar - 1; // Will be incremented by loop
        continue;
      }

      currentLineWidth += charWidth;
      charIndex++;
    }

    // Add remaining text from this segment
    if (segStartChar < segment.text.length) {
      currentLine.segments.push({
        segmentIndex: segIdx,
        startChar: segStartChar,
        endChar: segment.text.length,
      });
    }
  }

  // Add final line
  if (currentLine.segments.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Get character index from segments at a specific position
 */
export function getCharIndexFromSegments(
  segments: TextSegment[],
  segmentIndex: number,
  charOffset: number,
): number {
  let index = 0;
  for (let i = 0; i < segmentIndex && i < segments.length; i++) {
    index += segments[i]!.text.length;
  }
  return index + charOffset;
}

/**
 * Get segment index and char offset from character index
 */
export function getSegmentFromCharIndex(
  segments: TextSegment[],
  charIndex: number,
): { segmentIndex: number; charOffset: number } {
  let currentIndex = 0;

  for (let i = 0; i < segments.length; i++) {
    const segmentEnd = currentIndex + segments[i]!.text.length;
    if (charIndex < segmentEnd) {
      return {
        segmentIndex: i,
        charOffset: charIndex - currentIndex,
      };
    }
    currentIndex = segmentEnd;
  }

  // Return end of last segment
  return {
    segmentIndex: Math.max(0, segments.length - 1),
    charOffset:
      segments.length > 0 ? segments[segments.length - 1]!.text.length : 0,
  };
}

/**
 * Get character index from click position (x, y) relative to text area
 */
export function getCharIndexFromPosition(
  richText: TextSegment[],
  clickX: number,
  clickY: number,
  maxWidth: number,
  defaultFontSize: number,
  fontFamily: string = "Pretendard",
  textAlign: "left" | "center" | "right" = "left",
  lineIndents: number[] = [],
): number {
  if (richText.length === 0) return 0;

  const lineHeight = defaultFontSize * LINE_HEIGHT;

  // Build line info
  interface LineInfo {
    text: string;
    startIndex: number;
    width: number;
    indent: number;
  }

  const lines: LineInfo[] = [];
  let currentLine: LineInfo = {
    text: "",
    startIndex: 0,
    width: 0,
    indent: lineIndents[0] ?? 0,
  };
  let globalCharIndex = 0;
  let lineIndex = 0;

  for (const segment of richText) {
    const segFontSize = segment.fontSize ?? defaultFontSize;
    const fontWeight = segment.fontWeight ?? "normal";

    for (let i = 0; i < segment.text.length; i++) {
      const char = segment.text[i]!;

      if (char === "\n") {
        lines.push(currentLine);
        lineIndex++;
        currentLine = {
          text: "",
          startIndex: globalCharIndex + 1,
          width: 0,
          indent: lineIndents[lineIndex] ?? 0,
        };
        globalCharIndex++;
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
        currentLine.text.length > 0
      ) {
        lines.push(currentLine);
        lineIndex++;
        currentLine = {
          text: char,
          startIndex: globalCharIndex,
          width: charWidth,
          indent: lineIndents[lineIndex] ?? 0,
        };
      } else {
        currentLine.text += char;
        currentLine.width += charWidth;
      }
      globalCharIndex++;
    }
  }
  lines.push(currentLine);

  // Find which line was clicked
  const clickedLineIndex = Math.min(
    Math.max(0, Math.floor(clickY / lineHeight)),
    lines.length - 1,
  );
  const line = lines[clickedLineIndex]!;

  // Calculate line start X based on alignment
  const indentWidth = line!.indent * 20;
  let lineStartX = indentWidth;
  if (textAlign === "center") {
    lineStartX = (maxWidth - line!.width) / 2;
  } else if (textAlign === "right") {
    lineStartX = maxWidth - line!.width;
  }

  // If click is before line start, return line start
  if (clickX <= lineStartX) {
    return line!.startIndex;
  }

  // If click is after line end, return line end
  if (clickX >= lineStartX + line!.width) {
    return line!.startIndex + line!.text.length;
  }

  // Find character within line
  let currentX = lineStartX;
  let charIndexInLine = 0;

  // Get styles for each character in the line
  for (let i = 0; i < line!.text.length; i++) {
    const globalIdx = line!.startIndex + i;
    let fontSize = defaultFontSize;
    let fontWeight = "normal";

    // Find the segment this character belongs to
    let idx = 0;
    for (const seg of richText) {
      if (idx + seg.text.length > globalIdx) {
        fontSize = seg.fontSize ?? defaultFontSize;
        fontWeight = seg.fontWeight ?? "normal";
        break;
      }
      idx += seg.text.length;
    }

    const char = line!.text[i]!;
    const charWidth = measureTextWidth(char, fontSize, fontFamily, fontWeight);

    // Check if click is within this character
    if (clickX < currentX + charWidth / 2) {
      return line!.startIndex + charIndexInLine;
    }

    currentX += charWidth;
    charIndexInLine++;
  }

  return line!.startIndex + line!.text.length;
}

/**
 * Calculate the actual rendered height of rich text considering:
 * - Different font sizes per segment
 * - Word wrapping based on container width
 * - Line breaks
 */
export function calculateRichTextHeight(
  richText: TextSegment[],
  maxWidth: number,
  defaultFontSize: number,
  defaultFontFamily: string = "Pretendard",
  lineIndents: number[] = [],
): { height: number; lineCount: number } {
  if (richText.length === 0 || richText.every((seg) => seg.text === "")) {
    // Empty text - return single line height
    const lineHeight = defaultFontSize * LINE_HEIGHT;
    return { height: lineHeight, lineCount: 1 };
  }

  // Build lines with max font size tracking (similar to KonvaCursor logic)
  interface LineInfo {
    maxFontSize: number;
  }

  const lines: LineInfo[] = [];
  let currentLine: LineInfo = { maxFontSize: defaultFontSize };
  let currentLineWidth = (lineIndents[0] ?? 0) * 20;
  let lineIndex = 0;

  for (const segment of richText) {
    const segFontSize = segment.fontSize ?? defaultFontSize;
    const fontWeight = segment.fontWeight ?? "normal";

    for (let i = 0; i < segment.text.length; i++) {
      const char = segment.text[i]!;

      if (char === "\n") {
        lines.push(currentLine);
        lineIndex++;
        currentLine = { maxFontSize: defaultFontSize };
        currentLineWidth = (lineIndents[lineIndex] ?? 0) * 20;
        continue;
      }

      const charWidth = measureTextWidth(
        char,
        segFontSize,
        defaultFontFamily,
        fontWeight,
      );

      // Check for word wrap
      if (currentLineWidth + charWidth > maxWidth && currentLineWidth > 0) {
        lines.push(currentLine);
        lineIndex++;
        currentLine = { maxFontSize: defaultFontSize };
        currentLineWidth = (lineIndents[lineIndex] ?? 0) * 20;
      }

      currentLineWidth += charWidth;
      currentLine.maxFontSize = Math.max(currentLine.maxFontSize, segFontSize);
    }
  }
  lines.push(currentLine);

  // Calculate total height based on each line's max font size
  let totalHeight = 0;
  for (const line of lines) {
    totalHeight += line.maxFontSize * LINE_HEIGHT;
  }

  return { height: totalHeight, lineCount: lines.length };
}
