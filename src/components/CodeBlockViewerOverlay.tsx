import { memo, useMemo, useState, useEffect } from "react";
import { createLowlight } from "lowlight";
import type { CanvasObject } from "@/types";
import { dragCoordinator } from "@/hooks/useDragCoordinator";
import { enhanceHighlighting } from "@/utils/codeHighlight";

// Import common languages
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import java from "highlight.js/lib/languages/java";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import ruby from "highlight.js/lib/languages/ruby";
import php from "highlight.js/lib/languages/php";
import swift from "highlight.js/lib/languages/swift";
import kotlin from "highlight.js/lib/languages/kotlin";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import jsonLang from "highlight.js/lib/languages/json";
import yaml from "highlight.js/lib/languages/yaml";
import markdown from "highlight.js/lib/languages/markdown";
import sql from "highlight.js/lib/languages/sql";
import bash from "highlight.js/lib/languages/bash";

// Create lowlight instance with registered languages
const lowlight = createLowlight();
lowlight.register("javascript", javascript);
lowlight.register("typescript", typescript);
lowlight.register("python", python);
lowlight.register("java", java);
lowlight.register("go", go);
lowlight.register("rust", rust);
lowlight.register("c", c);
lowlight.register("cpp", cpp);
lowlight.register("csharp", csharp);
lowlight.register("ruby", ruby);
lowlight.register("php", php);
lowlight.register("swift", swift);
lowlight.register("kotlin", kotlin);
lowlight.register("html", xml);
lowlight.register("xml", xml);
lowlight.register("css", css);
lowlight.register("json", jsonLang);
lowlight.register("yaml", yaml);
lowlight.register("markdown", markdown);
lowlight.register("sql", sql);
lowlight.register("bash", bash);

// Convert lowlight AST to HTML string
function toHtml(tree: ReturnType<typeof lowlight.highlight>): string {
  function nodeToHtml(node: unknown): string {
    if (typeof node === "string") return escapeHtml(node);
    const n = node as {
      type: string;
      value?: string;
      tagName?: string;
      properties?: { className?: string[] };
      children?: unknown[];
    };
    if (n.type === "text") return escapeHtml(n.value ?? "");
    if (n.type === "element") {
      const className = n.properties?.className?.join(" ") ?? "";
      const children = n.children?.map(nodeToHtml).join("") ?? "";
      return `<span class="${className}">${children}</span>`;
    }
    return "";
  }

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  return tree.children.map(nodeToHtml).join("");
}

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface CodeBlockViewerOverlayProps {
  shape: CanvasObject;
  viewport: Viewport;
  zIndex: number;
  isEditing?: boolean;
  /** 드래그 중인지 여부 - 드래그 중이면 dragCoordinator 구독 */
  isDragging?: boolean;
}

/**
 * Syntax highlighting overlay for CodeBlock in view mode
 * Renders highlighted code using HTML instead of Konva Text
 */
export const CodeBlockViewerOverlay = memo(function CodeBlockViewerOverlay({
  shape,
  viewport,
  zIndex,
  isEditing = false,
  isDragging = false,
}: CodeBlockViewerOverlayProps) {
  // 편집 중 렌더 생략은 훅을 모두 호출한 뒤에 한다 (아래 early return).
  // 훅 위에서 반환하면 isEditing 토글마다 훅 개수가 달라져 rules-of-hooks
  // 위반이 된다 — 지금은 부모가 언마운트해줘서 드러나지 않을 뿐이다.

  // 드래그 중일 때 실시간 위치 추적
  const [dragPosition, setDragPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!isDragging) {
      setDragPosition(null);
      return;
    }

    // 드래그 중이면 dragCoordinator 구독
    const unsubscribe = dragCoordinator.subscribe(shape.id, (pos) => {
      setDragPosition(pos);
    });

    // 초기 위치 설정
    const initialPos = dragCoordinator.getPosition(shape.id);
    if (initialPos) {
      setDragPosition(initialPos);
    }

    return unsubscribe;
  }, [isDragging, shape.id]);

  // 드래그 중이면 dragPosition 사용, 아니면 shape 위치 사용
  const currentX = dragPosition?.x ?? shape.x;
  const currentY = dragPosition?.y ?? shape.y;

  const code = shape.code ?? "";
  const language = shape.codeLanguage ?? "plaintext";
  const fontSize = shape.fontSize ?? 14;
  const theme = shape.codeTheme ?? "dark";
  const backgroundColor =
    shape.backgroundColor ?? (theme === "dark" ? "#383838" : "#ffffff");
  const width = shape.width ?? 400;
  const height = shape.height ?? 200;
  const headerHeight = 28;
  const padding = 12;

  // Theme-specific styles
  const isDark = theme === "dark";

  // Calculate screen position
  const screenX = currentX * viewport.zoom + viewport.x;
  const screenY = currentY * viewport.zoom + viewport.y;
  const screenWidth = width * viewport.zoom;
  const screenHeight = height * viewport.zoom;
  const screenHeaderHeight = headerHeight * viewport.zoom;

  // Get highlighted HTML with enhanced builtin recognition
  const highlightedHtml = useMemo(() => {
    if (!code) return "";
    try {
      if (language === "plaintext") {
        return code
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      }
      const result = lowlight.highlight(language, code);
      const html = toHtml(result);
      // Apply VS Code-style enhanced highlighting for builtins
      return enhanceHighlighting(html, language);
    } catch {
      return code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }
  }, [code, language]);

  // Don't render when editing (CodeBlockEditor handles it)
  if (isEditing) return null;

  return (
    <>
      <div
        id={`codeblock-${shape.id}`}
        className="pointer-events-none fixed overflow-hidden rounded-b-lg"
        style={{
          left: screenX,
          top: screenY + screenHeaderHeight,
          width: screenWidth,
          height: screenHeight - screenHeaderHeight,
          zIndex,
          color: isDark ? "#d4d4d4" : "#1e1e1e",
        }}
      >
        <div
          className="absolute inset-0 overflow-hidden whitespace-pre-wrap break-words font-mono"
          style={{
            padding: `${padding * viewport.zoom}px`,
            fontSize: `${fontSize * viewport.zoom}px`,
            lineHeight: 1.5,
            backgroundColor,
          }}
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      </div>

      {/* Syntax highlight styles - theme-specific */}
      <style>{`
        #codeblock-${shape.id} .hljs-keyword { color: ${isDark ? "#c586c0" : "#af00db"}; }
        #codeblock-${shape.id} .hljs-string { color: ${isDark ? "#ce9178" : "#a31515"}; }
        #codeblock-${shape.id} .hljs-number { color: ${isDark ? "#b5cea8" : "#098658"}; }
        #codeblock-${shape.id} .hljs-comment { color: ${isDark ? "#6a9955" : "#008000"}; font-style: italic; }
        #codeblock-${shape.id} .hljs-function { color: ${isDark ? "#dcdcaa" : "#795e26"}; }
        #codeblock-${shape.id} .hljs-class { color: ${isDark ? "#4ec9b0" : "#267f99"}; }
        #codeblock-${shape.id} .hljs-variable { color: ${isDark ? "#9cdcfe" : "#001080"}; }
        #codeblock-${shape.id} .hljs-built_in { color: ${isDark ? "#4fc1ff" : "#0070c1"}; }
        #codeblock-${shape.id} .hljs-type { color: ${isDark ? "#4ec9b0" : "#267f99"}; }
        #codeblock-${shape.id} .hljs-attr { color: ${isDark ? "#9cdcfe" : "#001080"}; }
        #codeblock-${shape.id} .hljs-property { color: ${isDark ? "#9cdcfe" : "#001080"}; }
        #codeblock-${shape.id} .hljs-punctuation { color: ${isDark ? "#d4d4d4" : "#1e1e1e"}; }
        #codeblock-${shape.id} .hljs-operator { color: ${isDark ? "#d4d4d4" : "#1e1e1e"}; }
        #codeblock-${shape.id} .hljs-meta { color: ${isDark ? "#c586c0" : "#af00db"}; }
        #codeblock-${shape.id} .hljs-tag { color: ${isDark ? "#569cd6" : "#800000"}; }
        #codeblock-${shape.id} .hljs-name { color: ${isDark ? "#569cd6" : "#800000"}; }
        #codeblock-${shape.id} .hljs-attribute { color: ${isDark ? "#9cdcfe" : "#e50000"}; }
      `}</style>
    </>
  );
});
