import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { createLowlight } from "lowlight";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store";
import { calculateOptionsBarPosition } from "@/utils/optionsBar";
import { Z_OPTIONS_BAR, Z_TEXT_INPUT } from "@/constants/zIndex";
import { enhanceHighlighting } from "@/utils/codeHighlight";
import {
  CODE_LANGUAGES,
  CODE_THEMES,
  type CodeLanguage,
  type CodeTheme,
} from "@/types";
import {
  ChevronDown,
  Copy,
  Check,
  Sun,
  Moon,
  Lock,
  Unlock,
} from "lucide-react";

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

export function CodeBlockEditor() {
  const objects = useCanvasStore((s) => s.objects);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const viewport = useCanvasStore((s) => s.viewport);
  const updateObject = useCanvasStore((s) => s.updateObject);
  const editingTextId = useCanvasStore((s) => s.editingTextId);
  const setEditingTextId = useCanvasStore((s) => s.setEditingTextId);
  const isLocked = useCanvasStore((s) => s.isLocked);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Find selected code block
  const selectedObject = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    const obj = objects.find((o) => o.id === selectedIds[0]);
    if (!obj || obj.type !== "codeBlock") return null;
    return obj;
  }, [objects, selectedIds]);

  const isEditingCode = editingTextId === selectedObject?.id;

  // Listen for header double-click event
  useEffect(() => {
    const handleHeaderEdit = (e: CustomEvent<{ id: string }>) => {
      if (selectedObject && e.detail.id === selectedObject.id) {
        setIsEditingTitle(true);
        // Exit code editing if active
        if (isEditingCode) {
          setEditingTextId(null);
        }
      }
    };

    window.addEventListener(
      "codeblock-edit-title" as string,
      handleHeaderEdit as EventListener,
    );
    return () => {
      window.removeEventListener(
        "codeblock-edit-title" as string,
        handleHeaderEdit as EventListener,
      );
    };
  }, [selectedObject, isEditingCode, setEditingTextId]);

  // Focus title input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Reset title editing when selection changes
  useEffect(() => {
    setIsEditingTitle(false);
  }, [selectedIds]);

  // Get highlighted HTML with enhanced builtin recognition
  const highlightedHtml = useMemo(() => {
    if (!selectedObject?.code) return "";
    const language = selectedObject.codeLanguage ?? "plaintext";
    try {
      if (language === "plaintext") {
        return escapeHtml(selectedObject.code);
      }
      const result = lowlight.highlight(language, selectedObject.code);
      const html = toHtml(result);
      // Apply VS Code-style enhanced highlighting for builtins
      return enhanceHighlighting(html, language);
    } catch {
      return escapeHtml(selectedObject.code);
    }

    function escapeHtml(text: string): string {
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }
  }, [selectedObject?.code, selectedObject?.codeLanguage]);

  // Handle code change
  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!selectedObject) return;
      updateObject(selectedObject.id, { code: e.target.value });
    },
    [selectedObject, updateObject],
  );

  // Handle title change
  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedObject) return;
      updateObject(selectedObject.id, { codeTitle: e.target.value });
    },
    [selectedObject, updateObject],
  );

  // Handle title submit
  const handleTitleSubmit = useCallback(() => {
    setIsEditingTitle(false);
  }, []);

  // Handle language change
  const handleLanguageChange = useCallback(
    (language: CodeLanguage) => {
      if (!selectedObject) return;
      updateObject(selectedObject.id, { codeLanguage: language });
      setShowLanguageDropdown(false);
    },
    [selectedObject, updateObject],
  );

  // Handle theme toggle
  const handleThemeToggle = useCallback(() => {
    if (!selectedObject) return;
    const currentTheme = selectedObject.codeTheme ?? "dark";
    const newTheme: CodeTheme = currentTheme === "dark" ? "light" : "dark";
    const themeConfig = CODE_THEMES.find((t) => t.value === newTheme)!;
    updateObject(selectedObject.id, {
      codeTheme: newTheme,
      backgroundColor: themeConfig.backgroundColor,
      textColor: themeConfig.textColor,
    });
  }, [selectedObject, updateObject]);

  // Handle copy
  const handleCopy = useCallback(() => {
    if (!selectedObject?.code) return;
    navigator.clipboard.writeText(selectedObject.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [selectedObject?.code]);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditingCode && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditingCode]);

  // Sync scroll between textarea and highlight
  const handleScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // Handle keyboard shortcuts for code editor
  const handleCodeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Tab key for indentation
      if (e.key === "Tab") {
        e.preventDefault();
        const textarea = textareaRef.current;
        if (!textarea || !selectedObject) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const code = selectedObject.code ?? "";

        const newCode = code.substring(0, start) + "  " + code.substring(end);
        updateObject(selectedObject.id, { code: newCode });

        // Restore cursor position
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
      }

      // Escape to stop editing
      if (e.key === "Escape") {
        setEditingTextId(null);
      }
    },
    [selectedObject, updateObject, setEditingTextId],
  );

  // Handle keyboard for title editor
  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Enter" || e.key === "Escape") {
        handleTitleSubmit();
      }
    },
    [handleTitleSubmit],
  );

  if (!selectedObject || isLocked) return null;

  // Calculate position
  const screenX = selectedObject.x * viewport.zoom + viewport.x;
  const screenY = selectedObject.y * viewport.zoom + viewport.y;
  const screenWidth = (selectedObject.width ?? 400) * viewport.zoom;
  const screenHeight = (selectedObject.height ?? 200) * viewport.zoom;
  const headerHeight = 28 * viewport.zoom;

  // Badge dimensions for title input positioning
  const language = selectedObject.codeLanguage ?? "plaintext";
  const badgeWidth = Math.max(60, language.length * 7 + 16) * viewport.zoom;
  const titleStartX =
    screenX + 12 * viewport.zoom + badgeWidth + 8 * viewport.zoom;
  const titleMaxWidth =
    screenWidth -
    (12 * viewport.zoom + badgeWidth + 8 * viewport.zoom) -
    70 * viewport.zoom;

  // Options bar position (above the code block)
  const position = calculateOptionsBarPosition({
    element: {
      x: selectedObject.x,
      y: selectedObject.y,
      width: selectedObject.width ?? 400,
      height: selectedObject.height ?? 200,
    },
    viewport,
    barHeight: 40,
    barWidth: 300,
  });

  return (
    <>
      {/* Options Bar */}
      <div
        className={cn(
          "pointer-events-auto fixed flex cursor-default items-center gap-2",
          "popover-enter rounded-lg bg-gray-800 px-2 py-1.5 shadow-lg",
        )}
        style={{
          left: position.x,
          top: position.y,
          transform: `translateX(${position.align === "center" ? "-50%" : position.align === "right" ? "-100%" : "0"})`,
          zIndex: Z_OPTIONS_BAR,
        }}
        onMouseDown={(e) => e.preventDefault()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Language Selector */}
        <div className="relative">
          <button
            onClick={() =>
              !selectedObject.locked &&
              setShowLanguageDropdown(!showLanguageDropdown)
            }
            disabled={selectedObject.locked}
            className={cn(
              "flex items-center gap-1 rounded px-2 py-1 text-sm transition-colors",
              selectedObject.locked
                ? "cursor-not-allowed text-gray-500"
                : "cursor-pointer text-white hover:bg-gray-700",
            )}
          >
            {CODE_LANGUAGES.find((l) => l.value === selectedObject.codeLanguage)
              ?.label ?? "Plain Text"}
            <ChevronDown size={14} />
          </button>

          {showLanguageDropdown && !selectedObject.locked && (
            <div
              className={cn(
                "absolute left-0 cursor-default",
                "max-h-60 w-40 overflow-y-auto rounded-lg bg-gray-800 py-1 shadow-xl",
                "border border-gray-700",
                position.above ? "bottom-full mb-1" : "top-full mt-1",
              )}
              style={{ zIndex: Z_OPTIONS_BAR + 1 }}
              onMouseDown={(e) => e.preventDefault()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {CODE_LANGUAGES.map((lang) => (
                <button
                  key={lang.value}
                  onClick={() => handleLanguageChange(lang.value)}
                  className={cn(
                    "w-full cursor-pointer px-3 py-1.5 text-left text-sm text-white",
                    "transition-colors hover:bg-gray-700",
                    selectedObject.codeLanguage === lang.value && "bg-gray-700",
                  )}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-5 w-px bg-gray-600" />

        {/* Theme Toggle Button */}
        <button
          onClick={() => !selectedObject.locked && handleThemeToggle()}
          disabled={selectedObject.locked}
          className={cn(
            "flex items-center gap-1 rounded px-2 py-1 text-sm transition-colors",
            selectedObject.locked
              ? "cursor-not-allowed text-gray-500"
              : "cursor-pointer text-white hover:bg-gray-700",
          )}
          title={
            selectedObject.locked
              ? "Unlock to change"
              : (selectedObject.codeTheme ?? "dark") === "dark"
                ? "Switch to Light"
                : "Switch to Dark"
          }
        >
          {(selectedObject.codeTheme ?? "dark") === "dark" ? (
            <Sun size={14} />
          ) : (
            <Moon size={14} />
          )}
        </button>

        <div className="h-5 w-px bg-gray-600" />

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className={cn(
            "flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-sm text-white",
            "transition-colors hover:bg-gray-700",
          )}
          title="Copy code"
        >
          {copied ? (
            <Check size={14} className="text-green-400" />
          ) : (
            <Copy size={14} />
          )}
        </button>

        <div className="h-5 w-px bg-gray-600" />

        {/* Lock/Unlock Button */}
        <button
          onClick={() =>
            updateObject(selectedObject.id, {
              locked: !selectedObject.locked,
            })
          }
          className={cn(
            "cursor-pointer rounded p-1.5 transition-all",
            "hover:bg-gray-700",
            selectedObject.locked && "bg-red-600 hover:bg-red-700",
          )}
          title={selectedObject.locked ? "Unlock" : "Lock"}
        >
          {selectedObject.locked ? (
            <Lock size={14} className="text-white" />
          ) : (
            <Unlock size={14} className="text-white" />
          )}
        </button>
      </div>

      {/* Header click zone - when editing code, click to switch to title editing */}
      {isEditingCode && (
        <div
          className="pointer-events-auto fixed cursor-text"
          style={{
            left: screenX,
            top: screenY,
            width: screenWidth,
            height: headerHeight,
            zIndex: Z_TEXT_INPUT + 1,
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            // Switch from code editing to title editing
            setEditingTextId(null);
            setIsEditingTitle(true);
          }}
        />
      )}

      {/* Header background zone - when editing title to prevent deselection */}
      {isEditingTitle && (
        <div
          className="pointer-events-auto fixed"
          style={{
            left: screenX,
            top: screenY,
            width: screenWidth,
            height: headerHeight,
            zIndex: Z_TEXT_INPUT - 1,
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
        />
      )}

      {/* Title Editor Overlay (in header) */}
      {isEditingTitle &&
        (() => {
          const isDark = (selectedObject.codeTheme ?? "dark") === "dark";
          return (
            <input
              ref={titleInputRef}
              type="text"
              value={selectedObject.codeTitle ?? ""}
              onChange={handleTitleChange}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleTitleSubmit}
              placeholder="Enter title..."
              className={cn(
                "pointer-events-auto fixed bg-transparent",
                "border-b border-violet-500 outline-none",
                "cursor-text font-mono",
              )}
              style={{
                left: titleStartX,
                top: screenY + 5 * viewport.zoom,
                width: Math.max(100, titleMaxWidth),
                height: 18 * viewport.zoom,
                fontSize: `${11 * viewport.zoom}px`,
                zIndex: Z_TEXT_INPUT,
                color: isDark ? "#d4d4d4" : "#374151",
                caretColor: isDark ? "#ffffff" : "#1e1e1e",
              }}
              onMouseDown={(e) => e.stopPropagation()}
            />
          );
        })()}

      {/* Code area click zone - only when editing title to switch to code editing */}
      {isEditingTitle && (
        <div
          className="pointer-events-auto fixed cursor-text"
          style={{
            left: screenX,
            top: screenY + headerHeight,
            width: screenWidth,
            height: screenHeight - headerHeight,
            zIndex: Z_TEXT_INPUT,
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            // Switch from title editing to code editing
            setIsEditingTitle(false);
            setEditingTextId(selectedObject.id);
          }}
        />
      )}

      {/* Code View Overlay is rendered by CodeBlockViewerOverlay in Canvas.tsx */}

      {/* Code Editor Overlay */}
      {isEditingCode && (
        <div
          id={`codeblock-editor-${selectedObject.id}`}
          className="pointer-events-auto fixed cursor-text overflow-hidden rounded-b-lg"
          style={{
            left: screenX,
            top: screenY + headerHeight,
            width: screenWidth,
            height: screenHeight - headerHeight,
            zIndex: Z_TEXT_INPUT,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Syntax highlighted background */}
          <div
            ref={highlightRef}
            className="pointer-events-none absolute inset-0 overflow-hidden font-mono break-words whitespace-pre-wrap"
            style={{
              padding: `${12 * viewport.zoom}px`,
              fontSize: `${(selectedObject.fontSize ?? 14) * viewport.zoom}px`,
              lineHeight: 1.5,
              backgroundColor:
                selectedObject.backgroundColor ??
                ((selectedObject.codeTheme ?? "dark") === "dark"
                  ? "#383838"
                  : "#ffffff"),
              color:
                (selectedObject.codeTheme ?? "dark") === "dark"
                  ? "#d4d4d4"
                  : "#1e1e1e",
            }}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />

          {/* Editable textarea (transparent) */}
          <textarea
            ref={textareaRef}
            value={selectedObject.code ?? ""}
            onChange={handleCodeChange}
            onScroll={handleScroll}
            onKeyDown={handleCodeKeyDown}
            className={cn(
              "absolute inset-0 h-full w-full resize-none font-mono",
              "bg-transparent text-transparent",
              "rounded-b-lg border-t-0 border-r-2 border-b-2 border-l-2 border-violet-500 outline-none",
            )}
            style={{
              padding: `${12 * viewport.zoom}px`,
              fontSize: `${(selectedObject.fontSize ?? 14) * viewport.zoom}px`,
              lineHeight: 1.5,
              caretColor:
                (selectedObject.codeTheme ?? "dark") === "dark"
                  ? "#ffffff"
                  : "#1e1e1e",
            }}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
      )}

      {/* Syntax highlight styles - theme-specific */}
      {isEditingCode &&
        (() => {
          const isDark = (selectedObject.codeTheme ?? "dark") === "dark";
          return (
            <style>{`
            #codeblock-editor-${selectedObject.id} .hljs-keyword { color: ${isDark ? "#c586c0" : "#af00db"}; }
            #codeblock-editor-${selectedObject.id} .hljs-string { color: ${isDark ? "#ce9178" : "#a31515"}; }
            #codeblock-editor-${selectedObject.id} .hljs-number { color: ${isDark ? "#b5cea8" : "#098658"}; }
            #codeblock-editor-${selectedObject.id} .hljs-comment { color: ${isDark ? "#6a9955" : "#008000"}; font-style: italic; }
            #codeblock-editor-${selectedObject.id} .hljs-function { color: ${isDark ? "#dcdcaa" : "#795e26"}; }
            #codeblock-editor-${selectedObject.id} .hljs-class { color: ${isDark ? "#4ec9b0" : "#267f99"}; }
            #codeblock-editor-${selectedObject.id} .hljs-variable { color: ${isDark ? "#9cdcfe" : "#001080"}; }
            #codeblock-editor-${selectedObject.id} .hljs-built_in { color: ${isDark ? "#4fc1ff" : "#0070c1"}; }
            #codeblock-editor-${selectedObject.id} .hljs-type { color: ${isDark ? "#4ec9b0" : "#267f99"}; }
            #codeblock-editor-${selectedObject.id} .hljs-attr { color: ${isDark ? "#9cdcfe" : "#001080"}; }
            #codeblock-editor-${selectedObject.id} .hljs-property { color: ${isDark ? "#9cdcfe" : "#001080"}; }
            #codeblock-editor-${selectedObject.id} .hljs-punctuation { color: ${isDark ? "#d4d4d4" : "#1e1e1e"}; }
            #codeblock-editor-${selectedObject.id} .hljs-operator { color: ${isDark ? "#d4d4d4" : "#1e1e1e"}; }
            #codeblock-editor-${selectedObject.id} .hljs-meta { color: ${isDark ? "#c586c0" : "#af00db"}; }
            #codeblock-editor-${selectedObject.id} .hljs-tag { color: ${isDark ? "#569cd6" : "#800000"}; }
            #codeblock-editor-${selectedObject.id} .hljs-name { color: ${isDark ? "#569cd6" : "#800000"}; }
            #codeblock-editor-${selectedObject.id} .hljs-attribute { color: ${isDark ? "#9cdcfe" : "#e50000"}; }
          `}</style>
          );
        })()}
    </>
  );
}
