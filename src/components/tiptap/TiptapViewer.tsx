import { useMemo, memo, useCallback } from "react";
import { generateHTML } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { tiptapExtensions } from "./TiptapEditor";
import { fontStack } from "@/constants/fonts";

export interface TiptapViewerProps {
  content: JSONContent;
  className?: string;
  defaultFontSize?: number;
  defaultFontFamily?: string;
  defaultTextColor?: string;
  defaultTextAlign?: "left" | "center" | "right";
  /** 링크 클릭 허용 여부 (뷰어 모드에서만 true) */
  enableLinkClick?: boolean;
}

export const TiptapViewer = memo(function TiptapViewer({
  content,
  className,
  defaultFontSize = 10,
  defaultFontFamily = fontStack(),
  defaultTextColor = "#1f2937",
  defaultTextAlign = "left",
  enableLinkClick = false,
}: TiptapViewerProps) {
  const html = useMemo(() => {
    if (!content || !content.content?.length) return "";
    try {
      return generateHTML(content, tiptapExtensions);
    } catch (e) {
      console.error("TiptapViewer: Failed to generate HTML", e);
      return "";
    }
  }, [content]);

  const style = useMemo(
    () => ({
      fontSize: `${defaultFontSize}px`,
      fontFamily: defaultFontFamily,
      color: defaultTextColor,
      textAlign: defaultTextAlign,
    }),
    [defaultFontSize, defaultFontFamily, defaultTextColor, defaultTextAlign],
  );

  // 링크 클릭 핸들러
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!enableLinkClick) return;

      const target = e.target as HTMLElement;
      const link = target.closest("a");
      if (link) {
        e.preventDefault();
        e.stopPropagation();
        const href = link.getAttribute("href");
        if (href) {
          // 외부 링크는 새 탭에서 열기
          window.open(href, "_blank", "noopener,noreferrer");
        }
      }
    },
    [enableLinkClick],
  );

  if (!html) {
    return null;
  }

  // 링크, 코드, 테이블, 이미지 스타일을 위한 CSS
  const viewerStyles = `
    .tiptap-viewer a {
      color: #3b82f6;
      text-decoration: underline;
      cursor: pointer;
      pointer-events: auto;
    }
    .tiptap-viewer a:hover {
      color: #2563eb;
    }
    .tiptap-viewer code {
      background-color: #f3f4f6;
      color: #e11d48;
      padding: 0.15em 0.3em;
      border-radius: 4px;
      font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
      font-size: 0.9em;
    }
    .tiptap-viewer pre {
      background-color: #1e293b;
      color: #e2e8f0;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
      font-size: 0.9em;
      overflow-x: auto;
      margin: 8px 0;
    }
    .tiptap-viewer pre code {
      background: none;
      color: inherit;
      padding: 0;
      font-size: inherit;
    }
    .tiptap-viewer table {
      border-collapse: collapse;
      width: 100%;
      margin: 8px 0;
    }
    .tiptap-viewer th,
    .tiptap-viewer td {
      border: 1px solid #d1d5db;
      padding: 8px 12px;
      text-align: left;
      min-width: 50px;
    }
    .tiptap-viewer th {
      background-color: #f3f4f6;
      font-weight: 600;
    }
    .tiptap-viewer tr:hover td {
      background-color: #f9fafb;
    }
    .tiptap-viewer img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 8px 0;
    }
  `;

  return (
    <>
      <style>{viewerStyles}</style>
      <div
        className={`tiptap-viewer ${className ?? ""}`}
        style={style}
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={handleClick}
      />
    </>
  );
});
