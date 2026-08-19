import { useState, useCallback, useEffect, useRef } from "react";
import { useCanvasStore } from "@/store";
import { Z_OPTIONS_BAR } from "@/constants/zIndex";
import { getOptionsBarTransform } from "@/utils/optionsBar";
import { ColorPickerPopup, CustomColorButton } from "./ColorPickerPopup";
import { useGlobalCustomColors } from "@/hooks/useCustomColors";
import {
  Type,
  Bold,
  Strikethrough,
  Link,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Lock,
  Unlock,
  Image,
  Table,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CanvasObject,
  FontFamily,
  FontSize,
  TextAlign,
  ListType,
  LineStyle,
} from "@/types";
import type { RichTextEditorRef } from "./RichTextEditor";
import type { Editor } from "@tiptap/react";

interface TextOptionsBarProps {
  object: CanvasObject;
  position: {
    x: number;
    y: number;
    above?: boolean;
    align?: "center" | "left" | "right";
  };
  onUpdate: (updates: Partial<CanvasObject>) => void;
  /** @deprecated Use tiptapEditor instead */
  getEditorRef?: () => RichTextEditorRef | null;
  /** Tiptap Editor 인스턴스 (편집 모드에서 전달됨) */
  tiptapEditor?: Editor | null;
  onLock?: () => void;
  onUnlock?: () => void;
  // Konva 기반 선택 영역 스타일 적용
  hasSelection?: () => boolean;
  applyStyleToSelection?: (
    style: Partial<import("@/types").TextSegment>,
  ) => void;
  // 현재 선택 영역의 폰트 크기 (편집 모드에서 사용)
  selectionFontSize?: number;
}

type FillMode = "fill" | "transparent" | "nofill";

const FONT_FAMILIES: { id: FontFamily; label: string }[] = [
  { id: "Pretendard", label: "Pretendard" },
  { id: "Noto Sans KR", label: "Noto Sans" },
  { id: "Nanum Gothic", label: "나눔고딕" },
  { id: "Nanum Myeongjo", label: "나눔명조" },
  { id: "IBM Plex Sans KR", label: "IBM Plex" },
];

const FONT_SIZES: { id: FontSize; size: number; label: string }[] = [
  { id: "S", size: 16, label: "Small" },
  { id: "M", size: 24, label: "Medium" },
  { id: "L", size: 40, label: "Large" },
  { id: "XL", size: 64, label: "Extra large" },
  { id: "XXL", size: 96, label: "Huge" },
];

const TEXT_COLORS = [
  "#000000",
  "#374151",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
];

const STICKY_COLORS = [
  "#fef08a", // yellow
  "#fecaca", // pink/red
  "#bbf7d0", // green
  "#bfdbfe", // blue
  "#e9d5ff", // purple
  "#fed7aa", // orange
];

// Fill/Stroke colors for TextBox (matching ShapeOptionsBar)
// 17개 색상 + 커스텀 = 18개 (9열 x 2줄)
const FILL_COLORS = [
  "#6b7280",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#d1d5db",
  "#fca5a5",
  "#fdba74",
  "#fde047",
  "#86efac",
  "#93c5fd",
  "#c4b5fd",
  "#f9a8d4",
];

// 17개 색상 + 커스텀 = 18개 (9열 x 2줄)
const STROKE_COLORS = [
  "#6b7280",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#d1d5db",
  "#fca5a5",
  "#fdba74",
  "#fde047",
  "#86efac",
  "#93c5fd",
  "#c4b5fd",
  "#f9a8d4",
];

export function getFontSizeFromPreset(preset: FontSize): number {
  return FONT_SIZES.find((f) => f.id === preset)?.size ?? 16;
}

export function TextOptionsBar({
  object,
  position,
  onUpdate,
  getEditorRef,
  tiptapEditor,
  onLock,
  onUnlock,
  hasSelection: hasSelectionProp,
  applyStyleToSelection,
  selectionFontSize,
}: TextOptionsBarProps) {
  const setFileDialogOpen = useCanvasStore((s) => s.setFileDialogOpen);
  const isLocked = object.locked === true;
  const [activePanel, setActivePanel] = useState<
    | "fill"
    | "stroke"
    | "textColor"
    | "stickyColor"
    | "fontFamily"
    | "fontSize"
    | "link"
    | "image"
    | "table"
    | null
  >(null);
  const [linkUrl, setLinkUrl] = useState(object.link ?? "");
  // 선택 영역 폰트 크기가 있으면 그것을 사용, 없으면 객체 기본값
  const effectiveFontSize = selectionFontSize ?? object.fontSize ?? 16;
  const [customFontSize, setCustomFontSize] = useState(
    String(effectiveFontSize),
  );
  // 이미지 입력 ref
  const imageInputRef = useRef<HTMLInputElement>(null);
  // 테이블 크기 (rows x cols)
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  // Tiptap selection 저장 (input 포커스 시 selection 유지용)
  const savedSelectionRef = useRef<{ from: number; to: number } | null>(null);
  // 드롭다운 버튼 refs (화면 경계 체크용)
  const dropdownButtonRefs = useRef<Record<string, HTMLButtonElement | null>>(
    {},
  );
  // 드롭다운이 위로 열려야 하는지 여부
  const [dropdownAbove, setDropdownAbove] = useState(false);
  // 커스텀 컬러 피커 상태
  const [showCustomPicker, setShowCustomPicker] = useState<
    "textColor" | "stickyColor" | "fill" | "stroke" | null
  >(null);
  // 커스텀 색상 히스토리
  const { customColors, addIfNotInPalette } = useGlobalCustomColors();

  const isStickyNote = object.type === "stickyNote";
  const isTextBox = object.type === "textBox";

  // Sync customFontSize with selection or object's fontSize
  useEffect(() => {
    const fontSize = selectionFontSize ?? object.fontSize ?? 16;
    setCustomFontSize(String(Math.round(fontSize)));
  }, [object.fontSize, selectionFontSize]);

  const currentFontFamily = object.fontFamily ?? "Pretendard";
  const currentTextAlign = object.textAlign ?? "left";
  const currentListType = object.listType ?? "none";
  const isBold = object.fontWeight === "bold";
  const isStrikethrough = object.textDecoration === "line-through";

  // TextBox fill/stroke values
  const currentFill = object.fill ?? "transparent";
  const currentStroke = object.stroke ?? "transparent";
  const currentLineStyle = object.lineStyle ?? "solid";

  // Determine fill mode for TextBox
  const fillMode: FillMode =
    currentFill === "transparent"
      ? "transparent"
      : object.fillMode === "nofill"
        ? "nofill"
        : "fill";
  const isStrokeNone = currentStroke === "transparent";

  const togglePanel = useCallback(
    (
      panel:
        | "fill"
        | "stroke"
        | "textColor"
        | "stickyColor"
        | "fontFamily"
        | "fontSize"
        | "link"
        | "image"
        | "table",
    ) => {
      setActivePanel((prev) => {
        if (prev === panel) return null;

        // StickyNote는 옵션바가 아래에 있으므로 드롭다운은 항상 위로 열림
        if (isStickyNote) {
          setDropdownAbove(true);
          return panel;
        }

        // 드롭다운이 열릴 때 화면 경계 체크
        const buttonEl = dropdownButtonRefs.current[panel];
        if (buttonEl) {
          const rect = buttonEl.getBoundingClientRect();
          const dropdownHeight = 250; // 예상 드롭다운 높이
          const spaceBelow = window.innerHeight - rect.bottom;
          // 아래 공간이 부족하면 위로 표시
          setDropdownAbove(spaceBelow < dropdownHeight);
        }

        return panel;
      });
    },
    [isStickyNote],
  );

  // TextBox fill mode handler
  const handleFillModeChange = useCallback(
    (mode: FillMode) => {
      if (mode === "fill") {
        if (currentFill === "transparent" || fillMode === "nofill") {
          onUpdate({ fill: "#ffffff", fillMode: "fill" });
        } else {
          onUpdate({ fillMode: "fill" });
        }
      } else if (mode === "transparent") {
        onUpdate({ fill: "transparent", fillMode: "transparent" });
      } else {
        onUpdate({ fill: "#ffffff", fillMode: "nofill" });
      }
    },
    [currentFill, fillMode, onUpdate],
  );

  // TextBox stroke style handler
  const handleStrokeStyleChange = useCallback(
    (style: LineStyle | "none") => {
      if (style === "none") {
        onUpdate({ stroke: "transparent", lineStyle: "solid" });
      } else {
        if (currentStroke === "transparent") {
          onUpdate({ stroke: "#374151", lineStyle: style });
        } else {
          onUpdate({ lineStyle: style });
        }
      }
    },
    [currentStroke, onUpdate],
  );

  // Check if there's a text selection
  const hasSelection = useCallback(() => {
    // Konva 기반 선택 영역 확인 (우선)
    if (hasSelectionProp) {
      return hasSelectionProp();
    }
    // Tiptap 에디터 선택 영역 확인
    if (tiptapEditor) {
      const { from, to } = tiptapEditor.state.selection;
      return from !== to;
    }
    // 기존 RichTextEditor 기반 선택 영역 확인 (폴백)
    const editor = getEditorRef?.();
    if (!editor) return false;
    const sel = editor.getSelection();
    return sel !== null && sel.start !== sel.end;
  }, [hasSelectionProp, tiptapEditor, getEditorRef]);

  const handleFontSizeChange = useCallback(
    (preset: FontSize) => {
      const size = getFontSizeFromPreset(preset);
      // Tiptap 에디터의 경우 선택 영역에 폰트 크기 적용
      if (tiptapEditor) {
        if (hasSelection()) {
          // 선택 영역이 있으면 해당 텍스트에만 적용
          (
            tiptapEditor.commands as { setFontSize?: (size: string) => boolean }
          ).setFontSize?.(`${size}px`);
        } else {
          // 선택 영역이 없으면 객체 기본 폰트 크기 업데이트
          onUpdate({ fontSizePreset: preset, fontSize: size });
        }
        setCustomFontSize(String(size));
        setActivePanel(null);
        return;
      }
      if (hasSelection()) {
        // 선택 영역에 스타일 적용
        if (applyStyleToSelection) {
          applyStyleToSelection({ fontSize: size });
        } else {
          const editor = getEditorRef?.();
          if (editor) {
            editor.applyStyle({ fontSize: size });
          }
        }
      } else {
        onUpdate({ fontSizePreset: preset, fontSize: size });
      }
      setCustomFontSize(String(size));
      setActivePanel(null);
    },
    [tiptapEditor, applyStyleToSelection, getEditorRef, hasSelection, onUpdate],
  );

  const handleCustomFontSize = useCallback(() => {
    const size = Math.round(
      Math.max(4, Math.min(200, parseInt(customFontSize) || 16)),
    );
    // Tiptap 에디터의 경우 선택 영역에 폰트 크기 적용
    if (tiptapEditor) {
      if (hasSelection()) {
        // 선택 영역이 있으면 해당 텍스트에만 적용
        (
          tiptapEditor.commands as { setFontSize?: (size: string) => boolean }
        ).setFontSize?.(`${size}px`);
      } else {
        // 선택 영역이 없으면 객체 기본 폰트 크기 업데이트
        onUpdate({ fontSize: size, fontSizePreset: undefined });
      }
      setCustomFontSize(String(size));
      setActivePanel(null);
      return;
    }
    if (hasSelection()) {
      // 선택 영역에 스타일 적용
      if (applyStyleToSelection) {
        applyStyleToSelection({ fontSize: size });
      } else {
        const editor = getEditorRef?.();
        if (editor) {
          editor.applyStyle({ fontSize: size });
        }
      }
    } else {
      onUpdate({ fontSize: size, fontSizePreset: undefined });
    }
    setCustomFontSize(String(size));
    setActivePanel(null);
  }, [
    tiptapEditor,
    applyStyleToSelection,
    customFontSize,
    getEditorRef,
    hasSelection,
    onUpdate,
  ]);

  const handleBoldToggle = useCallback(() => {
    // Tiptap 에디터 우선
    if (tiptapEditor) {
      tiptapEditor.chain().focus().toggleBold().run();
      return;
    }
    // 기존 RichTextEditor
    const editor = getEditorRef?.();
    if (editor && hasSelection()) {
      editor.toggleBold();
    } else {
      onUpdate({ fontWeight: isBold ? "normal" : "bold" });
    }
  }, [tiptapEditor, getEditorRef, hasSelection, isBold, onUpdate]);

  const handleStrikethroughToggle = useCallback(() => {
    // Tiptap 에디터 우선
    if (tiptapEditor) {
      tiptapEditor.chain().focus().toggleStrike().run();
      return;
    }
    // 기존 RichTextEditor
    const editor = getEditorRef?.();
    if (editor && hasSelection()) {
      editor.toggleStrikethrough();
    } else {
      onUpdate({ textDecoration: isStrikethrough ? "none" : "line-through" });
    }
  }, [tiptapEditor, getEditorRef, hasSelection, isStrikethrough, onUpdate]);

  const handleTextColorChange = useCallback(
    (color: string) => {
      // Tiptap 에디터 우선
      if (tiptapEditor) {
        tiptapEditor.chain().focus().setColor(color).run();
        setActivePanel(null);
        return;
      }
      // 기존 RichTextEditor
      const editor = getEditorRef?.();
      if (editor && hasSelection()) {
        editor.applyStyle({ textColor: color });
      } else {
        onUpdate({ textColor: color });
      }
      setActivePanel(null);
    },
    [tiptapEditor, getEditorRef, hasSelection, onUpdate],
  );

  const handleLinkSave = useCallback(() => {
    // Tiptap 에디터 우선
    if (tiptapEditor) {
      if (linkUrl) {
        tiptapEditor.chain().focus().setLink({ href: linkUrl }).run();
      } else {
        tiptapEditor.chain().focus().unsetLink().run();
      }
      setActivePanel(null);
      return;
    }
    // 기존 RichTextEditor
    const editor = getEditorRef?.();
    if (editor && hasSelection()) {
      editor.applyStyle({ link: linkUrl || undefined });
    } else {
      onUpdate({ link: linkUrl || undefined });
    }
    setActivePanel(null);
  }, [tiptapEditor, getEditorRef, hasSelection, linkUrl, onUpdate]);

  const handleListTypeToggle = useCallback(
    (type: ListType) => {
      // Tiptap 에디터 우선
      if (tiptapEditor) {
        if (type === "bullet") {
          tiptapEditor.chain().focus().toggleBulletList().run();
        } else if (type === "number") {
          tiptapEditor.chain().focus().toggleOrderedList().run();
        }
        return;
      }
      // 기존 RichTextEditor
      const editor = getEditorRef?.();
      if (editor) {
        // 편집 모드: 현재 줄에 글머리/번호 토글
        if (type === "bullet") {
          editor.toggleBullet();
        } else if (type === "number") {
          editor.toggleNumber();
        }
      } else {
        // 비편집 모드: listType 속성 변경
        onUpdate({ listType: currentListType === type ? "none" : type });
      }
    },
    [tiptapEditor, currentListType, getEditorRef, onUpdate],
  );

  const handleAlignChange = useCallback(
    (align: TextAlign) => {
      // Tiptap 에디터 우선
      if (tiptapEditor) {
        tiptapEditor.chain().focus().setTextAlign(align).run();
      }
      // 항상 객체 속성도 업데이트 (비편집 모드에서도 적용)
      onUpdate({ textAlign: align });
    },
    [tiptapEditor, onUpdate],
  );

  return (
    <div
      className="fixed"
      style={{
        zIndex: Z_OPTIONS_BAR,
        left: position.x,
        top: position.y,
        transform: getOptionsBarTransform({
          ...position,
          above: position.above ?? false,
          align: position.align ?? "center",
        }),
      }}
      // Prevent blur on editor when clicking options bar
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Main Options Bar */}
      <div className="popover-enter flex items-center gap-1 rounded-lg bg-gray-800 px-2 py-1.5 shadow-lg">
        {/* Sticky Note Color (only for stickyNote) */}
        {isStickyNote && (
          <>
            <button
              onClick={() => !isLocked && togglePanel("stickyColor")}
              className={cn(
                "h-6 w-6 rounded border-2 transition-transform",
                isLocked ? "cursor-not-allowed opacity-50" : "hover:scale-110",
                activePanel === "stickyColor" && !isLocked
                  ? "border-white"
                  : "border-gray-600",
              )}
              style={{ backgroundColor: object.backgroundColor ?? "#fef08a" }}
              title="메모지 색상"
              disabled={isLocked}
            />
            <div className="mx-1 h-6 w-px bg-gray-600" />
          </>
        )}

        {/* Fill Color (only for textBox) */}
        {isTextBox && (
          <>
            <button
              onClick={() => !isLocked && togglePanel("fill")}
              className={cn(
                "flex items-center gap-1 rounded p-1.5 transition-all",
                isLocked
                  ? "cursor-not-allowed opacity-50"
                  : "hover:bg-gray-700",
                activePanel === "fill" && !isLocked && "bg-gray-700",
              )}
              title="배경색"
              disabled={isLocked}
            >
              <div
                className="h-6 w-6 rounded-full border-2 border-gray-500"
                style={{
                  backgroundColor:
                    fillMode === "fill" ? currentFill : "transparent",
                  backgroundImage:
                    fillMode !== "fill"
                      ? "linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%), linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%)"
                      : undefined,
                  backgroundSize: fillMode !== "fill" ? "6px 6px" : undefined,
                  backgroundPosition:
                    fillMode !== "fill" ? "0 0, 3px 3px" : undefined,
                }}
              />
              <svg
                className="h-2 w-2 text-white"
                viewBox="0 0 8 8"
                fill="currentColor"
              >
                <path d="M4 6L1 2h6L4 6z" />
              </svg>
            </button>

            <div className="mx-1 h-6 w-px bg-gray-600" />

            {/* Stroke/Border (only for textBox) */}
            <button
              onClick={() => !isLocked && togglePanel("stroke")}
              className={cn(
                "flex items-center gap-1 rounded p-1.5 transition-all",
                isLocked
                  ? "cursor-not-allowed opacity-50"
                  : "hover:bg-gray-700",
                activePanel === "stroke" && !isLocked && "bg-gray-700",
              )}
              title="테두리"
              disabled={isLocked}
            >
              <div className="flex h-6 w-6 items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect
                    x="2"
                    y="2"
                    width="16"
                    height="16"
                    rx="2"
                    stroke={isStrokeNone ? "#6b7280" : currentStroke}
                    strokeWidth="2"
                    strokeDasharray={
                      currentLineStyle === "dashed"
                        ? "4,2"
                        : currentLineStyle === "dotted"
                          ? "2,2"
                          : undefined
                    }
                  />
                </svg>
              </div>
              <svg
                className="h-2 w-2 text-white"
                viewBox="0 0 8 8"
                fill="currentColor"
              >
                <path d="M4 6L1 2h6L4 6z" />
              </svg>
            </button>

            <div className="mx-1 h-6 w-px bg-gray-600" />
          </>
        )}

        {/* Font Family */}
        <button
          onClick={() => !isLocked && togglePanel("fontFamily")}
          className={cn(
            "flex min-w-[80px] items-center justify-center gap-1 rounded p-1.5 transition-all",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-gray-700",
            activePanel === "fontFamily" && !isLocked && "bg-gray-700",
          )}
          title="글꼴"
          disabled={isLocked}
        >
          <Type className="h-4 w-4 text-white" />
          <span
            className="max-w-[50px] truncate text-xs text-white"
            style={{ fontFamily: currentFontFamily }}
          >
            {FONT_FAMILIES.find((f) => f.id === currentFontFamily)?.label ??
              "Pretendard"}
          </span>
          <svg
            className="h-2 w-2 flex-shrink-0 text-white"
            viewBox="0 0 8 8"
            fill="currentColor"
          >
            <path d="M4 6L1 2h6L4 6z" />
          </svg>
        </button>

        {/* Font Size */}
        <button
          ref={(el) => {
            dropdownButtonRefs.current["fontSize"] = el;
          }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => !isLocked && togglePanel("fontSize")}
          className={cn(
            "flex min-w-[50px] items-center justify-center gap-1 rounded p-1.5 transition-all",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-gray-700",
            activePanel === "fontSize" && !isLocked && "bg-gray-700",
          )}
          title="글꼴 크기"
          disabled={isLocked}
        >
          <span className="text-sm text-white">
            {Math.round(object.fontSize ?? 16)}
          </span>
          <svg
            className="h-2 w-2 text-white"
            viewBox="0 0 8 8"
            fill="currentColor"
          >
            <path d="M4 6L1 2h6L4 6z" />
          </svg>
        </button>

        <div className="mx-1 h-6 w-px bg-gray-600" />

        {/* Text Color */}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => !isLocked && togglePanel("textColor")}
          className={cn(
            "h-6 w-6 rounded-full border-2 transition-transform",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:scale-110",
            activePanel === "textColor" && !isLocked
              ? "border-white"
              : "border-gray-600",
          )}
          style={{ backgroundColor: object.textColor ?? "#000000" }}
          title="텍스트 색상"
          disabled={isLocked}
        />

        <div className="mx-1 h-6 w-px bg-gray-600" />

        {/* Bold */}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => !isLocked && handleBoldToggle()}
          className={cn(
            "rounded p-2 transition-all",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-gray-700",
            isBold && !isLocked && "bg-violet-600",
          )}
          title="Bold (Cmd+B)"
          disabled={isLocked}
        >
          <Bold className="h-4 w-4 text-white" />
        </button>

        {/* Strikethrough */}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => !isLocked && handleStrikethroughToggle()}
          className={cn(
            "rounded p-2 transition-all",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-gray-700",
            isStrikethrough && !isLocked && "bg-violet-600",
          )}
          title="Strikethrough (Cmd+S)"
          disabled={isLocked}
        >
          <Strikethrough className="h-4 w-4 text-white" />
        </button>

        {/* Link */}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (isLocked) return;
            setLinkUrl(object.link ?? "");
            // 링크 패널을 열 때 미리 fileDialogOpen 플래그 설정
            // (패널 내 입력 클릭 시 에디터 blur가 먼저 발생하므로)
            if (activePanel !== "link") {
              setFileDialogOpen(true);
            }
            togglePanel("link");
          }}
          className={cn(
            "rounded p-2 transition-all",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-gray-700",
            (activePanel === "link" || object.link) &&
              !isLocked &&
              "bg-violet-600",
          )}
          title="Link"
          disabled={isLocked}
        >
          <Link className="h-4 w-4 text-white" />
        </button>

        <div className="mx-1 h-6 w-px bg-gray-600" />

        {/* List - Bullet */}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => !isLocked && handleListTypeToggle("bullet")}
          className={cn(
            "rounded p-2 transition-all",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-gray-700",
            currentListType === "bullet" && !isLocked && "bg-violet-600",
          )}
          title="Bullet List"
          disabled={isLocked}
        >
          <List className="h-4 w-4 text-white" />
        </button>

        {/* List - Number */}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => !isLocked && handleListTypeToggle("number")}
          className={cn(
            "rounded p-2 transition-all",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-gray-700",
            currentListType === "number" && !isLocked && "bg-violet-600",
          )}
          title="Numbered List"
          disabled={isLocked}
        >
          <ListOrdered className="h-4 w-4 text-white" />
        </button>

        <div className="mx-1 h-6 w-px bg-gray-600" />

        {/* Align Left */}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleAlignChange("left")}
          className={cn(
            "rounded p-2 transition-all",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-gray-700",
            currentTextAlign === "left" && !isLocked && "bg-violet-600",
          )}
          title="Align Left"
          disabled={isLocked}
        >
          <AlignLeft className="h-4 w-4 text-white" />
        </button>

        {/* Align Center */}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleAlignChange("center")}
          className={cn(
            "rounded p-2 transition-all",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-gray-700",
            currentTextAlign === "center" && !isLocked && "bg-violet-600",
          )}
          title="Align Center"
          disabled={isLocked}
        >
          <AlignCenter className="h-4 w-4 text-white" />
        </button>

        {/* Align Right */}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleAlignChange("right")}
          className={cn(
            "rounded p-2 transition-all",
            isLocked ? "cursor-not-allowed opacity-50" : "hover:bg-gray-700",
            currentTextAlign === "right" && !isLocked && "bg-violet-600",
          )}
          title="Align Right"
          disabled={isLocked}
        >
          <AlignRight className="h-4 w-4 text-white" />
        </button>

        {/* 리치 텍스트 기능 (이미지/테이블/코드블럭) - StickyNote만 표시 */}
        {isStickyNote && (
          <>
            <div className="mx-1 h-6 w-px bg-gray-600" />

            {/* Insert Image */}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (isLocked || !tiptapEditor) return;
                // 이미지 패널을 열 때 미리 fileDialogOpen 플래그 설정
                if (activePanel !== "image") {
                  setFileDialogOpen(true);
                }
                togglePanel("image");
              }}
              className={cn(
                "rounded p-2 transition-all",
                isLocked || !tiptapEditor
                  ? "cursor-not-allowed opacity-50"
                  : "hover:bg-gray-700",
                activePanel === "image" &&
                  !isLocked &&
                  tiptapEditor &&
                  "bg-violet-600",
              )}
              title={
                tiptapEditor
                  ? "이미지 삽입"
                  : "이미지 삽입 (더블클릭하여 편집 모드 진입 필요)"
              }
              disabled={isLocked || !tiptapEditor}
            >
              <Image className="h-4 w-4 text-white" />
            </button>

            {/* Insert Table */}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (isLocked || !tiptapEditor) return;
                // 테이블 패널을 열 때 미리 fileDialogOpen 플래그 설정
                if (activePanel !== "table") {
                  setFileDialogOpen(true);
                }
                togglePanel("table");
              }}
              className={cn(
                "rounded p-2 transition-all",
                isLocked || !tiptapEditor
                  ? "cursor-not-allowed opacity-50"
                  : "hover:bg-gray-700",
                activePanel === "table" &&
                  !isLocked &&
                  tiptapEditor &&
                  "bg-violet-600",
              )}
              title={
                tiptapEditor
                  ? "테이블 삽입"
                  : "테이블 삽입 (더블클릭하여 편집 모드 진입 필요)"
              }
              disabled={isLocked || !tiptapEditor}
            >
              <Table className="h-4 w-4 text-white" />
            </button>

            {/* Code Block */}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (isLocked || !tiptapEditor) return;
                tiptapEditor.chain().focus().toggleCodeBlock().run();
              }}
              className={cn(
                "rounded p-2 transition-all",
                isLocked || !tiptapEditor
                  ? "cursor-not-allowed opacity-50"
                  : "hover:bg-gray-700",
                tiptapEditor?.isActive("codeBlock") &&
                  !isLocked &&
                  "bg-violet-600",
              )}
              title={
                tiptapEditor
                  ? "코드 블럭"
                  : "코드 블럭 (더블클릭하여 편집 모드 진입 필요)"
              }
              disabled={isLocked || !tiptapEditor}
            >
              <svg
                className="h-4 w-4 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <polyline points="8 8 4 12 8 16" />
                <polyline points="16 8 20 12 16 16" />
              </svg>
            </button>
          </>
        )}

        <div className="mx-1 h-6 w-px bg-gray-600" />

        {/* Lock/Unlock */}
        {isLocked ? (
          <button
            onClick={onUnlock}
            className="rounded bg-red-600 p-2 transition-all hover:bg-red-700"
            title="잠금 해제"
          >
            <Unlock className="h-4 w-4 text-white" />
          </button>
        ) : (
          <button
            onClick={onLock}
            className="rounded p-2 transition-all hover:bg-gray-700"
            title="잠금"
          >
            <Lock className="h-4 w-4 text-white" />
          </button>
        )}
      </div>

      {/* Dropdown Panels - 메인바 기준 절대 위치 (메인바 위치 고정) */}
      <div
        className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
        style={{
          top: dropdownAbove ? "auto" : "100%",
          bottom: dropdownAbove ? "100%" : "auto",
          marginTop: dropdownAbove ? 0 : 8,
          marginBottom: dropdownAbove ? 8 : 0,
        }}
      >
        {/* Fill Panel (only for textBox) */}
        {activePanel === "fill" && isTextBox && (
          <div className="rounded-lg bg-gray-800 p-3 shadow-lg">
            {/* Fill Mode Tabs */}
            <div className="mb-3 flex gap-2">
              <button
                onClick={() => handleFillModeChange("fill")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-all",
                  fillMode === "fill"
                    ? "bg-violet-600 text-white"
                    : "text-gray-300 hover:bg-gray-700",
                )}
              >
                <div className="h-4 w-4 rounded border-2 border-current bg-current" />
                Fill
              </button>
              <button
                onClick={() => handleFillModeChange("transparent")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-all",
                  fillMode === "transparent" || fillMode === "nofill"
                    ? "bg-violet-600 text-white"
                    : "text-gray-300 hover:bg-gray-700",
                )}
              >
                <div
                  className="h-4 w-4 rounded border-2 border-current"
                  style={{
                    backgroundImage:
                      "linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%), linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%)",
                    backgroundSize: "6px 6px",
                    backgroundPosition: "0 0, 3px 3px",
                  }}
                />
                Transparent
              </button>
            </div>
            {/* Color Grid */}
            {fillMode === "fill" && (
              <>
                {/* Custom colors history */}
                {customColors.length > 0 && (
                  <div className="mb-2 border-b border-gray-700 pb-2">
                    <div className="mb-1.5 text-xs text-gray-400">
                      최근 사용
                    </div>
                    <div className="flex gap-1.5">
                      {customColors.map((color) => (
                        <button
                          key={color}
                          onClick={() =>
                            onUpdate({ fill: color, fillMode: "fill" })
                          }
                          className={cn(
                            "h-6 w-6 rounded-full border-2 transition-transform",
                            currentFill.toLowerCase() === color.toLowerCase()
                              ? "scale-110 border-white"
                              : "border-transparent hover:scale-105",
                          )}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-9 gap-1.5">
                  {FILL_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() =>
                        onUpdate({ fill: color, fillMode: "fill" })
                      }
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition-transform",
                        currentFill === color
                          ? "scale-110 border-white"
                          : "border-transparent hover:scale-105",
                      )}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                  {/* Custom color picker */}
                  <CustomColorButton
                    onClick={() =>
                      setShowCustomPicker(
                        showCustomPicker === "fill" ? null : "fill",
                      )
                    }
                    isActive={showCustomPicker === "fill"}
                  />
                </div>
              </>
            )}
            {/* Custom Color Picker Popup */}
            {showCustomPicker === "fill" && (
              <ColorPickerPopup
                currentColor={
                  currentFill === "transparent" ? "#ffffff" : currentFill
                }
                onApply={(color) => {
                  onUpdate({ fill: color, fillMode: "fill" });
                  addIfNotInPalette(color, FILL_COLORS);
                }}
                onClose={() => setShowCustomPicker(null)}
              />
            )}
          </div>
        )}

        {/* Stroke Panel (only for textBox) */}
        {activePanel === "stroke" && isTextBox && (
          <div className="rounded-lg bg-gray-800 p-3 shadow-lg">
            {/* Stroke Style Tabs */}
            <div className="mb-3 flex gap-2">
              <button
                onClick={() => handleStrokeStyleChange("solid")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-all",
                  !isStrokeNone && currentLineStyle === "solid"
                    ? "bg-violet-600 text-white"
                    : "text-gray-300 hover:bg-gray-700",
                )}
              >
                <svg width="16" height="2" viewBox="0 0 16 2">
                  <line
                    x1="0"
                    y1="1"
                    x2="16"
                    y2="1"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
                Solid
              </button>
              <button
                onClick={() => handleStrokeStyleChange("dashed")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-all",
                  !isStrokeNone && currentLineStyle === "dashed"
                    ? "bg-violet-600 text-white"
                    : "text-gray-300 hover:bg-gray-700",
                )}
              >
                <svg width="16" height="2" viewBox="0 0 16 2">
                  <line
                    x1="0"
                    y1="1"
                    x2="16"
                    y2="1"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="4,2"
                  />
                </svg>
                Dashed
              </button>
              <button
                onClick={() => handleStrokeStyleChange("none")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-all",
                  isStrokeNone
                    ? "bg-violet-600 text-white"
                    : "text-gray-300 hover:bg-gray-700",
                )}
              >
                <div className="relative flex h-4 w-4 items-center justify-center">
                  <div className="h-0.5 w-full bg-current" />
                  <div className="absolute h-0.5 w-5 rotate-45 bg-current" />
                </div>
                None
              </button>
            </div>
            {/* Color Grid */}
            {!isStrokeNone && (
              <>
                {/* Custom colors history */}
                {customColors.length > 0 && (
                  <div className="mb-2 border-b border-gray-700 pb-2">
                    <div className="mb-1.5 text-xs text-gray-400">
                      최근 사용
                    </div>
                    <div className="flex gap-1.5">
                      {customColors.map((color) => (
                        <button
                          key={color}
                          onClick={() => onUpdate({ stroke: color })}
                          className={cn(
                            "h-6 w-6 rounded-full border-2 transition-transform",
                            currentStroke.toLowerCase() === color.toLowerCase()
                              ? "scale-110 border-white"
                              : "border-transparent hover:scale-105",
                          )}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-9 gap-1.5">
                  {STROKE_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => onUpdate({ stroke: color })}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition-transform",
                        currentStroke === color
                          ? "scale-110 border-white"
                          : "border-transparent hover:scale-105",
                      )}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                  {/* Custom color picker */}
                  <CustomColorButton
                    onClick={() =>
                      setShowCustomPicker(
                        showCustomPicker === "stroke" ? null : "stroke",
                      )
                    }
                    isActive={showCustomPicker === "stroke"}
                  />
                </div>
              </>
            )}
            {/* Custom Color Picker Popup */}
            {showCustomPicker === "stroke" && (
              <ColorPickerPopup
                currentColor={currentStroke}
                onApply={(color) => {
                  onUpdate({ stroke: color });
                  addIfNotInPalette(color, STROKE_COLORS);
                }}
                onClose={() => setShowCustomPicker(null)}
              />
            )}
          </div>
        )}

        {/* Sticky Note Color Palette */}
        {activePanel === "stickyColor" && isStickyNote && (
          <>
            <div className="rounded-lg bg-gray-800 p-3 shadow-lg">
              {/* Custom colors history */}
              {customColors.length > 0 && (
                <div className="mb-2 border-b border-gray-700 pb-2">
                  <div className="mb-1.5 text-xs text-gray-400">최근 사용</div>
                  <div className="flex gap-1.5">
                    {customColors.map((color) => (
                      <button
                        key={color}
                        onClick={() => {
                          onUpdate({ backgroundColor: color });
                          setActivePanel(null);
                        }}
                        className={cn(
                          "h-6 w-6 rounded border-2 transition-transform",
                          (
                            object.backgroundColor ?? "#fef08a"
                          ).toLowerCase() === color.toLowerCase()
                            ? "scale-110 border-white"
                            : "border-transparent hover:scale-105",
                        )}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-1">
                {STICKY_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      onUpdate({ backgroundColor: color });
                      setActivePanel(null);
                    }}
                    className={cn(
                      "h-6 w-6 rounded border-2 transition-transform",
                      object.backgroundColor === color
                        ? "scale-110 border-white"
                        : "border-transparent hover:scale-105",
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
                {/* Custom color picker */}
                <CustomColorButton
                  onClick={() =>
                    setShowCustomPicker(
                      showCustomPicker === "stickyColor" ? null : "stickyColor",
                    )
                  }
                  isActive={showCustomPicker === "stickyColor"}
                />
              </div>
              {/* Custom Color Picker Popup */}
              {showCustomPicker === "stickyColor" && (
                <ColorPickerPopup
                  currentColor={object.backgroundColor ?? "#fef08a"}
                  onApply={(color) => {
                    onUpdate({ backgroundColor: color });
                    addIfNotInPalette(color, STICKY_COLORS);
                    setActivePanel(null);
                  }}
                  onClose={() => setShowCustomPicker(null)}
                />
              )}
            </div>
          </>
        )}

        {/* Text Color Palette */}
        {activePanel === "textColor" && (
          <>
            <div className="rounded-lg bg-gray-800 p-3 shadow-lg">
              {/* Custom colors history */}
              {customColors.length > 0 && (
                <div className="mb-2 border-b border-gray-700 pb-2">
                  <div className="mb-1.5 text-xs text-gray-400">최근 사용</div>
                  <div className="flex gap-1.5">
                    {customColors.map((color) => (
                      <button
                        key={color}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleTextColorChange(color)}
                        className={cn(
                          "h-6 w-6 rounded-full border-2 transition-transform",
                          (object.textColor ?? "#000000").toLowerCase() ===
                            color.toLowerCase()
                            ? "scale-110 border-white"
                            : "border-transparent hover:scale-105",
                        )}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-1">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleTextColorChange(color)}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-transform",
                      object.textColor === color
                        ? "scale-110 border-white"
                        : "border-transparent hover:scale-105",
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
                {/* Custom color picker */}
                <CustomColorButton
                  onClick={() =>
                    setShowCustomPicker(
                      showCustomPicker === "textColor" ? null : "textColor",
                    )
                  }
                  isActive={showCustomPicker === "textColor"}
                />
              </div>
              {/* Custom Color Picker Popup */}
              {showCustomPicker === "textColor" && (
                <ColorPickerPopup
                  currentColor={object.textColor ?? "#000000"}
                  onApply={(color) => {
                    handleTextColorChange(color);
                    addIfNotInPalette(color, TEXT_COLORS);
                  }}
                  onClose={() => setShowCustomPicker(null)}
                />
              )}
            </div>
          </>
        )}

        {/* Font Family Dropdown */}
        {activePanel === "fontFamily" && (
          <div className="flex min-w-[140px] flex-col gap-1 rounded-lg bg-gray-800 px-2 py-1.5 shadow-lg">
            {FONT_FAMILIES.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => {
                  onUpdate({ fontFamily: id });
                  setActivePanel(null);
                }}
                className={cn(
                  "rounded px-3 py-1.5 text-left text-sm transition-all",
                  "text-white hover:bg-gray-700",
                  currentFontFamily === id && "bg-violet-600",
                )}
                style={{ fontFamily: id }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Font Size Dropdown */}
        {activePanel === "fontSize" && (
          <div className="flex min-w-[140px] flex-col gap-1 rounded-lg bg-gray-800 px-2 py-1.5 shadow-lg">
            {FONT_SIZES.map(({ id, size, label }) => (
              <button
                key={id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleFontSizeChange(id)}
                className={cn(
                  "flex items-center justify-between rounded px-3 py-1.5 text-sm transition-all",
                  "text-white hover:bg-gray-700",
                  object.fontSize === size && "bg-violet-600",
                )}
              >
                <span>{label}</span>
                <span className="text-xs text-gray-400">{size}</span>
              </button>
            ))}
            {/* Custom font size input */}
            <div className="mt-1 border-t border-gray-600 pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={customFontSize}
                  onChange={(e) => setCustomFontSize(e.target.value)}
                  onMouseDown={(e) => {
                    // selection 저장 (input 포커스 후에도 복원할 수 있도록)
                    if (tiptapEditor) {
                      const { from, to } = tiptapEditor.state.selection;
                      savedSelectionRef.current = { from, to };
                    }
                    e.stopPropagation();
                  }}
                  onFocus={() => setFileDialogOpen(true)}
                  onBlur={() => {
                    setTimeout(() => {
                      if (tiptapEditor) {
                        tiptapEditor.commands.focus();
                        // 저장된 selection 복원
                        if (savedSelectionRef.current) {
                          tiptapEditor.commands.setTextSelection(
                            savedSelectionRef.current,
                          );
                          savedSelectionRef.current = null;
                        }
                      }
                      setTimeout(() => setFileDialogOpen(false), 50);
                    }, 10);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCustomFontSize();
                    e.stopPropagation();
                  }}
                  min={4}
                  max={200}
                  className="w-16 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white focus:ring-2 focus:ring-violet-500 focus:outline-none"
                  data-options-bar-input="true"
                />
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleCustomFontSize}
                  className="rounded bg-violet-600 px-2 py-1 text-xs text-white hover:bg-violet-700"
                >
                  적용
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Link Input */}
        {activePanel === "link" && (
          <div className="flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2 shadow-lg">
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="w-48 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white outline-none focus:border-violet-500"
              onMouseDown={(e) => e.stopPropagation()}
              onFocus={() => setFileDialogOpen(true)}
              onBlur={() => {
                // 에디터로 포커스 복원 후 fileDialogOpen 플래그 해제
                // 순서 중요: 먼저 에디터에 포커스 → 그 다음 플래그 해제
                setTimeout(() => {
                  tiptapEditor?.commands.focus();
                  // 에디터가 포커스를 받은 후 플래그 해제
                  setTimeout(() => setFileDialogOpen(false), 50);
                }, 10);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLinkSave();
                if (e.key === "Escape") {
                  setActivePanel(null);
                  tiptapEditor?.commands.focus();
                }
                e.stopPropagation();
              }}
            />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleLinkSave}
              className="rounded bg-violet-600 px-2 py-1 text-sm text-white hover:bg-violet-700"
            >
              Save
            </button>
          </div>
        )}

        {/* Image Insert Panel */}
        {activePanel === "image" && tiptapEditor && (
          <div className="flex flex-col gap-2 rounded-lg bg-gray-800 p-3 shadow-lg">
            <p className="text-xs text-gray-400">이미지 삽입</p>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                setFileDialogOpen(false);
                const file = e.target.files?.[0];
                if (!file) {
                  // 파일 선택 취소 시 에디터에 포커스 복원
                  tiptapEditor.commands.focus();
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  const base64 = reader.result as string;
                  tiptapEditor.chain().focus().setImage({ src: base64 }).run();
                  setActivePanel(null);
                };
                reader.readAsDataURL(file);
              }}
            />
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => {
                setFileDialogOpen(true);
                // 파일 다이얼로그가 닫히면 window가 다시 focus를 받음
                const handleWindowFocus = () => {
                  window.removeEventListener("focus", handleWindowFocus);
                  // 짧은 지연 후 플래그 리셋 (파일 선택 완료 처리 대기)
                  setTimeout(() => {
                    setFileDialogOpen(false);
                    tiptapEditor.commands.focus();
                  }, 100);
                };
                window.addEventListener("focus", handleWindowFocus);
                imageInputRef.current?.click();
              }}
              className="rounded bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-700"
            >
              파일 선택
            </button>
            <div className="flex items-center gap-2">
              <input
                type="url"
                placeholder="또는 URL 입력..."
                className="flex-1 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white outline-none focus:border-violet-500"
                onMouseDown={(e) => e.stopPropagation()}
                onFocus={() => setFileDialogOpen(true)}
                onBlur={() => {
                  // 에디터로 포커스 복원 후 fileDialogOpen 플래그 해제
                  setTimeout(() => {
                    tiptapEditor?.commands.focus();
                    setTimeout(() => setFileDialogOpen(false), 50);
                  }, 10);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const url = (e.target as HTMLInputElement).value;
                    if (url) {
                      tiptapEditor
                        ?.chain()
                        .focus()
                        .setImage({ src: url })
                        .run();
                      setActivePanel(null);
                    }
                  }
                  if (e.key === "Escape") {
                    setActivePanel(null);
                    tiptapEditor?.commands.focus();
                  }
                  e.stopPropagation();
                }}
              />
            </div>
          </div>
        )}

        {/* Table Insert Panel */}
        {activePanel === "table" && tiptapEditor && (
          <div className="flex flex-col gap-2 rounded-lg bg-gray-800 p-3 shadow-lg">
            <p className="text-xs text-gray-400">테이블 삽입</p>
            <div className="flex items-center gap-2">
              <label className="text-sm text-white">행:</label>
              <input
                type="number"
                value={tableRows}
                onChange={(e) =>
                  setTableRows(
                    Math.max(1, Math.min(10, parseInt(e.target.value) || 1)),
                  )
                }
                min={1}
                max={10}
                className="w-14 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white outline-none focus:border-violet-500"
                onMouseDown={(e) => e.stopPropagation()}
                onFocus={() => setFileDialogOpen(true)}
                onBlur={() => {
                  setTimeout(() => {
                    tiptapEditor?.commands.focus();
                    setTimeout(() => setFileDialogOpen(false), 50);
                  }, 10);
                }}
                onKeyDown={(e) => e.stopPropagation()}
              />
              <label className="text-sm text-white">열:</label>
              <input
                type="number"
                value={tableCols}
                onChange={(e) =>
                  setTableCols(
                    Math.max(1, Math.min(10, parseInt(e.target.value) || 1)),
                  )
                }
                min={1}
                max={10}
                className="w-14 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white outline-none focus:border-violet-500"
                onMouseDown={(e) => e.stopPropagation()}
                onFocus={() => setFileDialogOpen(true)}
                onBlur={() => {
                  setTimeout(() => {
                    tiptapEditor?.commands.focus();
                    setTimeout(() => setFileDialogOpen(false), 50);
                  }, 10);
                }}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                tiptapEditor
                  .chain()
                  .focus()
                  .insertTable({
                    rows: tableRows,
                    cols: tableCols,
                    withHeaderRow: true,
                  })
                  .run();
                setActivePanel(null);
              }}
              className="rounded bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-700"
            >
              삽입
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
