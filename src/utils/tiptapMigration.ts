import type { JSONContent } from "@tiptap/core";
import type { TextSegment } from "@/types";

/**
 * TextSegment 배열을 Tiptap JSONContent로 변환
 */
export function textSegmentsToTiptap(
  segments: TextSegment[],
  lineIndents?: number[],
): JSONContent {
  // 빈 배열 또는 undefined 처리
  if (!segments || segments.length === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }

  // 텍스트를 줄 단위로 분리
  const lines = splitByNewlines(segments);

  return {
    type: "doc",
    content: lines.map((lineSegments, lineIndex) => ({
      type: "paragraph",
      attrs: lineIndents?.[lineIndex]
        ? { textIndent: `${lineIndents[lineIndex] * 20}px` }
        : undefined,
      content:
        lineSegments.length > 0
          ? lineSegments.map((seg) => ({
              type: "text",
              text: seg.text,
              marks: buildMarks(seg),
            }))
          : undefined,
    })),
  };
}

/**
 * 텍스트 세그먼트에서 Tiptap marks 생성
 * textStyle attrs는 단일 객체로 병합
 */
function buildMarks(seg: TextSegment): JSONContent["marks"] | undefined {
  const marks: NonNullable<JSONContent["marks"]> = [];

  if (seg.fontWeight === "bold") {
    marks.push({ type: "bold" });
  }
  if (seg.textDecoration === "line-through") {
    marks.push({ type: "strike" });
  }

  // textStyle attrs를 단일 객체로 병합
  const textStyleAttrs: Record<string, string> = {};
  if (seg.fontSize !== undefined && seg.fontSize !== null) {
    textStyleAttrs.fontSize = `${seg.fontSize}px`;
  }
  if (seg.textColor !== undefined && seg.textColor !== null) {
    textStyleAttrs.color = seg.textColor;
  }

  if (Object.keys(textStyleAttrs).length > 0) {
    marks.push({ type: "textStyle", attrs: textStyleAttrs });
  }

  if (seg.link) {
    marks.push({ type: "link", attrs: { href: seg.link } });
  }

  return marks.length > 0 ? marks : undefined;
}

/**
 * 텍스트 세그먼트를 줄바꿈 기준으로 분리
 */
function splitByNewlines(segments: TextSegment[]): TextSegment[][] {
  const lines: TextSegment[][] = [[]];

  segments.forEach((seg) => {
    const parts = seg.text.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) {
        const lastLine = lines[lines.length - 1];
        if (lastLine) lastLine.push({ ...seg, text: part });
      }
    });
  });

  return lines;
}

/**
 * Tiptap JSONContent를 평문으로 변환 (하위 호환용)
 * 역변환 함수(tiptapToTextSegments)는 테이블/이미지 등 손실 위험으로 제거됨
 */
export function tiptapToPlainText(content: JSONContent): string {
  if (!content) return "";

  const texts: string[] = [];

  function traverse(node: JSONContent): void {
    if (node.type === "text" && node.text) {
      texts.push(node.text);
    } else if (node.type === "paragraph") {
      const lastText = texts[texts.length - 1];
      if (texts.length > 0 && lastText && !lastText.endsWith("\n")) {
        texts.push("\n");
      }
    } else if (node.type === "hardBreak") {
      texts.push("\n");
    }
    // 테이블 셀은 탭으로 구분
    else if (node.type === "tableCell" || node.type === "tableHeader") {
      texts.push("\t");
    }
    // 테이블 행은 줄바꿈
    else if (node.type === "tableRow") {
      texts.push("\n");
    }
    // 이미지는 대체 텍스트 사용
    else if (node.type === "image") {
      const alt = node.attrs?.alt;
      texts.push(typeof alt === "string" ? alt : "[image]");
    }
    // 코드 블럭
    else if (node.type === "codeBlock") {
      texts.push("\n```\n");
    }

    if (node.content) {
      node.content.forEach(traverse);
    }
  }

  traverse(content);
  return texts.join("").trim();
}

/**
 * 단순 텍스트를 Tiptap JSONContent로 변환
 */
export function plainTextToTiptap(text: string): JSONContent {
  if (!text) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }

  const lines = text.split("\n");

  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : undefined,
    })),
  };
}

/**
 * 빈 Tiptap 문서 생성
 * 정확히 하나의 빈 paragraph만 포함 (Tiptap이 자동으로 추가 paragraph 생성 방지)
 */
export function createEmptyTiptapContent(): JSONContent {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

/**
 * Tiptap content가 비어있는지 확인
 */
export function isTiptapContentEmpty(
  content: JSONContent | undefined,
): boolean {
  if (!content) return true;
  if (!content.content || content.content.length === 0) return true;

  // 모든 paragraph가 비어있는지 확인
  return content.content.every((node) => {
    if (node.type !== "paragraph") return false;
    return !node.content || node.content.length === 0;
  });
}

/**
 * 스타일이 적용된 텍스트 세그먼트
 */
export interface StyledTextSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  underline?: boolean;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
}

/**
 * Tiptap JSONContent에서 스타일이 적용된 텍스트 세그먼트 배열로 변환
 * Konva에서 렌더링할 수 있도록 줄별로 세그먼트 배열 반환
 */
export function tiptapToStyledSegments(
  content: JSONContent,
): StyledTextSegment[][] {
  if (!content || !content.content) return [];

  const lines: StyledTextSegment[][] = [];

  for (const node of content.content) {
    if (node.type === "paragraph") {
      const lineSegments: StyledTextSegment[] = [];

      if (node.content) {
        for (const textNode of node.content) {
          if (textNode.type === "text" && textNode.text) {
            const segment: StyledTextSegment = { text: textNode.text };

            if (textNode.marks) {
              for (const mark of textNode.marks) {
                if (mark.type === "bold") segment.bold = true;
                if (mark.type === "italic") segment.italic = true;
                if (mark.type === "strike") segment.strike = true;
                if (mark.type === "underline") segment.underline = true;
                if (mark.type === "textStyle" && mark.attrs) {
                  if (mark.attrs.fontSize) {
                    segment.fontSize = parseInt(mark.attrs.fontSize, 10);
                  }
                  if (mark.attrs.color) {
                    segment.color = mark.attrs.color;
                  }
                  if (mark.attrs.fontFamily) {
                    segment.fontFamily = mark.attrs.fontFamily;
                  }
                }
              }
            }

            lineSegments.push(segment);
          } else if (textNode.type === "hardBreak") {
            lines.push(lineSegments.slice());
            lineSegments.length = 0;
          }
        }
      }

      lines.push(lineSegments);
    }
  }

  return lines;
}

/**
 * Tiptap 콘텐츠의 첫 번째 텍스트 스타일 추출
 * 테이블 셀 등에서 기본 스타일로 사용
 */
export function extractFirstTextStyle(content: JSONContent): {
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  fontStyle?: string; // "normal" | "bold" | "italic" | "bold italic"
  textDecoration?: string; // "line-through" | "underline"
  textAlign?: string; // "left" | "center" | "right"
} {
  const result: ReturnType<typeof extractFirstTextStyle> = {};

  function traverse(node: JSONContent): boolean {
    // Extract textAlign from paragraph attrs
    if (node.type === "paragraph" && node.attrs?.textAlign) {
      result.textAlign = node.attrs.textAlign;
    }
    if (node.type === "text" && node.marks) {
      let hasBold = false;
      let hasItalic = false;
      let hasStrike = false;

      for (const mark of node.marks) {
        if (mark.type === "bold") hasBold = true;
        if (mark.type === "italic") hasItalic = true;
        if (mark.type === "strike") hasStrike = true;
        if (mark.type === "textStyle" && mark.attrs) {
          if (mark.attrs.fontSize) {
            result.fontSize = parseInt(mark.attrs.fontSize, 10);
          }
          if (mark.attrs.color) {
            result.color = mark.attrs.color;
          }
          if (mark.attrs.fontFamily) {
            result.fontFamily = mark.attrs.fontFamily;
          }
        }
      }

      if (hasBold && hasItalic) result.fontStyle = "bold italic";
      else if (hasBold) result.fontStyle = "bold";
      else if (hasItalic) result.fontStyle = "italic";

      if (hasStrike) result.textDecoration = "line-through";

      return true; // 첫 번째 텍스트 노드만 처리
    }

    if (node.content) {
      for (const child of node.content) {
        if (traverse(child)) return true;
      }
    }

    return false;
  }

  traverse(content);
  return result;
}

/**
 * Check if tiptapContent has mixed inline styles (different colors, fonts, etc. within the same block).
 * If true, Konva Text can't render it accurately — fall back to Tiptap HTML overlay.
 */
export function hasMixedStyles(content: JSONContent): boolean {
  let firstStyle: string | null = null;
  let mixed = false;

  function traverse(node: JSONContent): void {
    if (mixed) return;
    // mention 노드가 있으면 항상 mixed (HTML 렌더링 필요)
    if (node.type === "mention") {
      mixed = true;
      return;
    }
    if (node.type === "text") {
      // Serialize marks to compare
      const styleKey = node.marks
        ? JSON.stringify(
            node.marks.map((m) => ({ type: m.type, attrs: m.attrs })),
          )
        : "none";

      if (firstStyle === null) {
        firstStyle = styleKey;
      } else if (styleKey !== firstStyle) {
        mixed = true;
        return;
      }
    }
    if (node.content) {
      for (const child of node.content) {
        traverse(child);
      }
    }
  }

  traverse(content);
  return mixed;
}
