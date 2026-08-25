import { memo, useMemo } from "react";
import { Group, Text } from "react-konva";
import type { TextSegment, TextAlign, FontFamily } from "@/types";
import {
  measureTextWidth,
  richTextToPlainText,
  LINE_HEIGHT,
} from "@/utils/richText";

interface RichTextRendererProps {
  richText: TextSegment[];
  lineIndents?: number[];
  x: number;
  y: number;
  width: number;
  height: number;
  defaultFontSize: number;
  defaultColor: string;
  defaultFontFamily?: FontFamily;
  textAlign?: TextAlign;
  verticalAlign?: "top" | "middle" | "bottom";
  listening?: boolean;
}

interface RenderedSegment {
  key: string;
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  textDecoration: string;
  fill: string;
  link?: string;
}

const INDENT_WIDTH = 20; // Pixels per indent level
const LINE_HEIGHT_MULTIPLIER = LINE_HEIGHT; // 공통 상수 사용

/**
 * RichTextRenderer
 *
 * Renders rich text segments using Konva Text nodes.
 * Handles word wrapping, line breaks, and per-segment styling.
 */
export const RichTextRenderer = memo(function RichTextRenderer({
  richText,
  lineIndents = [],
  x,
  y,
  width,
  height,
  defaultFontSize,
  defaultColor,
  defaultFontFamily = "Pretendard",
  textAlign = "left",
  verticalAlign = "top",
  listening = false,
}: RichTextRendererProps) {
  // Calculate rendered segments with positions
  const renderedSegments = useMemo((): RenderedSegment[] => {
    if (!richText || richText.length === 0) return [];

    const segments: RenderedSegment[] = [];
    let currentX = 0;
    let currentY = 0;
    let lineIndex = 0;
    let segmentKey = 0;

    // Current line segments (for alignment calculation)
    let currentLineSegments: RenderedSegment[] = [];
    let currentLineWidth = 0;
    let currentLineHeight = defaultFontSize * LINE_HEIGHT_MULTIPLIER;

    const indent = (lineIndents[lineIndex] ?? 0) * INDENT_WIDTH;
    currentX = indent;

    const flushLine = () => {
      if (currentLineSegments.length === 0) return;

      // Calculate alignment offset
      let alignOffset = 0;
      if (textAlign === "center") {
        alignOffset = (width - currentLineWidth) / 2;
      } else if (textAlign === "right") {
        alignOffset = width - currentLineWidth;
      }

      // Apply alignment offset to all segments in line
      currentLineSegments.forEach((seg) => {
        seg.x += alignOffset;
        segments.push(seg);
      });

      currentLineSegments = [];
      currentLineWidth = 0;
      lineIndex++;
      currentY += currentLineHeight;
      currentLineHeight = defaultFontSize * LINE_HEIGHT_MULTIPLIER;
      const newIndent = (lineIndents[lineIndex] ?? 0) * INDENT_WIDTH;
      currentX = newIndent;
    };

    for (let segIdx = 0; segIdx < richText.length; segIdx++) {
      const segment = richText[segIdx]!;
      const fontSize = segment.fontSize ?? defaultFontSize;
      const fontFamily: string = defaultFontFamily || "Pretendard";
      const fontWeight = segment.fontWeight ?? "normal";
      const hasLink = !!segment.link;
      // Link text is blue, otherwise use segment color or default
      const fill = hasLink ? "#3b82f6" : (segment.textColor ?? defaultColor);
      // Link text has underline, strikethrough takes priority
      const textDecoration =
        segment.textDecoration === "line-through"
          ? "line-through"
          : hasLink
            ? "underline"
            : "";
      const link = segment.link;

      // Update line height if this segment is taller
      const segmentLineHeight = fontSize * LINE_HEIGHT_MULTIPLIER;
      if (segmentLineHeight > currentLineHeight) {
        currentLineHeight = segmentLineHeight;
      }

      // Process text character by character for wrapping
      let word = "";
      let wordWidth = 0;

      for (let i = 0; i <= segment.text.length; i++) {
        const char = segment.text[i];

        // End of segment or newline or space
        if (i === segment.text.length || char === "\n" || char === " ") {
          // Handle the word we've accumulated
          if (word.length > 0) {
            // Check if word fits on current line
            if (
              currentX + wordWidth > width &&
              currentX > (lineIndents[lineIndex] ?? 0) * INDENT_WIDTH
            ) {
              // Wrap to next line
              flushLine();
            }

            // Add word segment
            currentLineSegments.push({
              key: `seg-${segmentKey++}`,
              text: word,
              x: currentX,
              y: currentY,
              width: wordWidth,
              fontSize,
              fontFamily,
              fontWeight,
              textDecoration,
              fill,
              link,
            });
            currentX += wordWidth;
            currentLineWidth += wordWidth;
            word = "";
            wordWidth = 0;
          }

          // Handle space
          if (char === " ") {
            const spaceWidth = measureTextWidth(
              " ",
              fontSize,
              fontFamily,
              fontWeight,
            );
            if (currentX + spaceWidth <= width) {
              currentLineSegments.push({
                key: `seg-${segmentKey++}`,
                text: " ",
                x: currentX,
                y: currentY,
                width: spaceWidth,
                fontSize,
                fontFamily,
                fontWeight,
                textDecoration,
                fill,
                link,
              });
              currentX += spaceWidth;
              currentLineWidth += spaceWidth;
            }
          }

          // Handle newline
          if (char === "\n") {
            flushLine();
          }
        } else {
          // Accumulate word
          word += char;
          wordWidth += measureTextWidth(
            char as string,
            fontSize,
            fontFamily,
            fontWeight,
          );
        }
      }
    }

    // Flush remaining line
    flushLine();

    // Apply vertical alignment
    const totalHeight = currentY;
    let verticalOffset = 0;
    if (verticalAlign === "middle") {
      verticalOffset = Math.max(0, (height - totalHeight) / 2);
    } else if (verticalAlign === "bottom") {
      verticalOffset = Math.max(0, height - totalHeight);
    }

    if (verticalOffset > 0) {
      segments.forEach((seg) => {
        seg.y += verticalOffset;
      });
    }

    return segments;
  }, [
    richText,
    lineIndents,
    width,
    height,
    defaultFontSize,
    defaultColor,
    defaultFontFamily,
    textAlign,
    verticalAlign,
  ]);

  if (renderedSegments.length === 0) {
    return null;
  }

  // Handle link click
  const handleLinkClick = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Group x={x} y={y} listening={listening}>
      {renderedSegments.map((seg) => (
        <Text
          key={seg.key}
          x={seg.x}
          y={seg.y}
          text={seg.text}
          fontSize={seg.fontSize}
          fontFamily={seg.fontFamily}
          fontStyle={seg.fontWeight === "bold" ? "bold" : "normal"}
          textDecoration={seg.textDecoration}
          fill={seg.fill}
          perfectDrawEnabled={false}
          listening={!!seg.link}
          onClick={seg.link ? () => handleLinkClick(seg.link!) : undefined}
          onTap={seg.link ? () => handleLinkClick(seg.link!) : undefined}
          onMouseEnter={
            seg.link
              ? (e) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = "pointer";
                }
              : undefined
          }
          onMouseLeave={
            seg.link
              ? (e) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = "default";
                }
              : undefined
          }
        />
      ))}
    </Group>
  );
});

/**
 * Simple rich text renderer that uses a single Text node
 * Fallback for when rich text has uniform styling
 */
export const SimpleRichTextRenderer = memo(function SimpleRichTextRenderer({
  richText,
  x,
  y,
  width,
  height,
  defaultFontSize,
  defaultColor,
  defaultFontFamily = "Pretendard",
  textAlign = "left",
  verticalAlign = "top",
  listening = false,
}: Omit<RichTextRendererProps, "lineIndents">) {
  const plainText = useMemo(() => richTextToPlainText(richText), [richText]);

  // Check if all segments have uniform styling
  const uniformStyle = useMemo(() => {
    if (richText.length === 0) return null;
    if (richText.length === 1) return richText[0];

    const first = richText[0]!;
    const isUniform = richText.every(
      (seg) =>
        (seg.fontWeight ?? "normal") === (first!.fontWeight ?? "normal") &&
        (seg.textDecoration ?? "none") === (first!.textDecoration ?? "none") &&
        seg.fontSize === first!.fontSize &&
        seg.textColor === first!.textColor &&
        seg.link === first!.link, // Also check link uniformity
    );

    return isUniform ? first : null;
  }, [richText]);

  if (!uniformStyle) {
    // Fall back to full renderer
    return (
      <RichTextRenderer
        richText={richText}
        x={x}
        y={y}
        width={width}
        height={height}
        defaultFontSize={defaultFontSize}
        defaultColor={defaultColor}
        defaultFontFamily={defaultFontFamily}
        textAlign={textAlign}
        verticalAlign={verticalAlign}
        listening={listening}
      />
    );
  }

  const hasLink = !!uniformStyle.link;
  const textColor = hasLink
    ? "#3b82f6"
    : (uniformStyle.textColor ?? defaultColor);
  const decoration =
    uniformStyle.textDecoration === "line-through"
      ? "line-through"
      : hasLink
        ? "underline"
        : "";

  const handleClick = () => {
    if (uniformStyle.link) {
      window.open(uniformStyle.link, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Text
      x={x}
      y={y}
      width={width}
      height={height}
      text={plainText}
      fontSize={uniformStyle.fontSize ?? defaultFontSize}
      fontFamily={defaultFontFamily}
      fontStyle={uniformStyle.fontWeight === "bold" ? "bold" : "normal"}
      textDecoration={decoration}
      fill={textColor}
      align={textAlign}
      verticalAlign={verticalAlign}
      lineHeight={LINE_HEIGHT_MULTIPLIER}
      wrap="word"
      ellipsis
      perfectDrawEnabled={false}
      listening={hasLink || listening}
      onClick={hasLink ? handleClick : undefined}
      onTap={hasLink ? handleClick : undefined}
      onMouseEnter={
        hasLink
          ? (e) => {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = "pointer";
            }
          : undefined
      }
      onMouseLeave={
        hasLink
          ? (e) => {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = "default";
            }
          : undefined
      }
    />
  );
});
