import {
  useRef,
  useEffect,
  useState,
  useCallback,
  memo,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Line, Rect, Group } from "react-konva";
import { measureTextWidth, LINE_HEIGHT } from "@/utils/richText";
import {
  CURSOR_BLINK_INTERVAL,
  CURSOR_WIDTH,
  CURSOR_HEIGHT_RATIO,
} from "@/utils/textConfig";
import { fontStack } from "@/constants/fonts";

// ============================================================================
// Types
// ============================================================================

export interface TextInputState {
  value: string;
  cursorIndex: number;
  selectionStart: number | null;
  selectionEnd: number | null;
  isFocused: boolean;
}

export interface KonvaTextInputRef {
  focus: () => void;
  blur: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
  getCursorPosition: () => number;
  setCursorPosition: (pos: number) => void;
  getState: () => TextInputState;
}

interface CursorPosition {
  x: number;
  y: number;
  height: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 텍스트와 커서 위치를 기반으로 Konva 좌표의 커서 위치 계산
 */
export function calculateCursorPosition(
  text: string,
  cursorIndex: number,
  fontSize: number,
  fontFamily: string,
  fontWeight: string,
  textAreaWidth: number,
  textAlign: "left" | "center" | "right",
): CursorPosition {
  const lineHeight = fontSize * LINE_HEIGHT;
  const lines = text.split("\n");

  let charCount = 0;
  let targetLine = 0;
  let charInLine = 0;

  // 커서가 위치한 줄과 줄 내 위치 찾기
  for (let i = 0; i < lines.length; i++) {
    const lineLength = lines[i]!.length;
    if (charCount + lineLength >= cursorIndex) {
      targetLine = i;
      charInLine = cursorIndex - charCount;
      break;
    }
    charCount += lineLength + 1; // +1 for newline
    if (i === lines.length - 1) {
      targetLine = i;
      charInLine = lineLength;
    }
  }

  // 커서 위치까지의 텍스트 너비 계산
  const lineText = lines[targetLine] ?? "";
  const textBeforeCursor = lineText.slice(0, charInLine);
  const cursorX = measureTextWidth(
    textBeforeCursor,
    fontSize,
    fontFamily,
    fontWeight,
  );

  // 정렬에 따른 오프셋 계산
  const lineWidth = measureTextWidth(
    lineText,
    fontSize,
    fontFamily,
    fontWeight,
  );
  let alignOffset = 0;
  if (textAlign === "center") {
    alignOffset = (textAreaWidth - lineWidth) / 2;
  } else if (textAlign === "right") {
    alignOffset = textAreaWidth - lineWidth;
  }

  // 커서 높이는 폰트 크기 기준, y 위치는 줄 높이 기준
  const cursorHeight = fontSize * CURSOR_HEIGHT_RATIO;
  // 커서를 줄 중앙에 배치 (줄 높이와 커서 높이 차이의 절반만큼 아래로)
  const yOffset = (lineHeight - cursorHeight) / 2;

  return {
    x: cursorX + alignOffset,
    y: targetLine * lineHeight + yOffset,
    height: cursorHeight,
  };
}

/**
 * 선택 영역의 사각형들 계산
 */
export function calculateSelectionRects(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  fontSize: number,
  fontFamily: string,
  fontWeight: string,
  textAreaWidth: number,
  textAlign: "left" | "center" | "right",
): { x: number; y: number; width: number; height: number }[] {
  const lineHeight = fontSize * LINE_HEIGHT;
  const lines = text.split("\n");
  const rects: { x: number; y: number; width: number; height: number }[] = [];

  let charCount = 0;
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]!;
    const lineStart = charCount;
    const lineEnd = charCount + line.length;

    // 이 줄이 선택 범위에 포함되는지 확인
    if (lineEnd >= selectionStart && lineStart <= selectionEnd) {
      const selectStartInLine = Math.max(0, selectionStart - lineStart);
      const selectEndInLine = Math.min(line.length, selectionEnd - lineStart);

      const textBefore = line.slice(0, selectStartInLine);
      const selectedText = line.slice(selectStartInLine, selectEndInLine);

      const beforeWidth = measureTextWidth(
        textBefore,
        fontSize,
        fontFamily,
        fontWeight,
      );
      const selectedWidth = measureTextWidth(
        selectedText,
        fontSize,
        fontFamily,
        fontWeight,
      );

      // 정렬 오프셋
      const lineWidth = measureTextWidth(
        line || "",
        fontSize,
        fontFamily,
        fontWeight,
      );
      let alignOffset = 0;
      if (textAlign === "center") {
        alignOffset = (textAreaWidth - lineWidth) / 2;
      } else if (textAlign === "right") {
        alignOffset = textAreaWidth - lineWidth;
      }

      if (selectedWidth > 0) {
        rects.push({
          x: beforeWidth + alignOffset,
          y: lineIdx * lineHeight,
          width: selectedWidth,
          height: lineHeight,
        });
      }
    }

    charCount = lineEnd + 1; // +1 for newline
  }

  return rects;
}

// ============================================================================
// KonvaCursor - Konva Layer 안에서 렌더링되는 커서/선택 영역
// ============================================================================

interface KonvaCursorProps {
  /** 텍스트 값 */
  value: string;
  /** 커서 위치 (문자 인덱스) */
  cursorIndex: number;
  /** 선택 시작 위치 */
  selectionStart?: number | null;
  /** 선택 끝 위치 */
  selectionEnd?: number | null;
  /** 포커스 상태 */
  isFocused: boolean;
  /** 폰트 크기 */
  fontSize: number;
  /** 폰트 패밀리 */
  fontFamily?: string;
  /** 폰트 굵기 */
  fontWeight?: "normal" | "bold";
  /** 텍스트 영역 너비 */
  width: number;
  /** 텍스트 정렬 */
  textAlign?: "left" | "center" | "right";
  /** 커서 색상 */
  cursorColor?: string;
  /** Group x 위치 */
  x?: number;
  /** Group y 위치 */
  y?: number;
}

export const KonvaCursor = memo(function KonvaCursor({
  value,
  cursorIndex,
  selectionStart,
  selectionEnd,
  isFocused,
  fontSize,
  fontFamily = fontStack(),
  fontWeight = "normal",
  width,
  textAlign = "left",
  cursorColor = "#000000",
  x = 0,
  y = 0,
}: KonvaCursorProps) {
  const [showCursor, setShowCursor] = useState(true);

  // 커서 깜빡임
  useEffect(() => {
    if (!isFocused) {
      setShowCursor(false);
      return;
    }

    setShowCursor(true);
    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, CURSOR_BLINK_INTERVAL);

    return () => clearInterval(interval);
  }, [isFocused]);

  // 입력 시 커서 깜빡임 리셋
  useEffect(() => {
    if (isFocused) {
      setShowCursor(true);
    }
  }, [value, cursorIndex, isFocused]);

  if (!isFocused) return null;

  // 커서 위치 계산
  const cursorPosition = calculateCursorPosition(
    value,
    cursorIndex,
    fontSize,
    fontFamily,
    fontWeight,
    width,
    textAlign,
  );

  // 선택 영역 계산
  const hasSelection =
    selectionStart != null &&
    selectionEnd != null &&
    selectionStart !== selectionEnd;

  const selectionRects = hasSelection
    ? calculateSelectionRects(
        value,
        Math.min(selectionStart!, selectionEnd!),
        Math.max(selectionStart!, selectionEnd!),
        fontSize,
        fontFamily,
        fontWeight,
        width,
        textAlign,
      )
    : [];

  return (
    <Group x={x} y={y} listening={false}>
      {/* 선택 영역 하이라이트 */}
      {selectionRects.map((rect, idx) => (
        <Rect
          key={idx}
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          fill="#3b82f6"
          opacity={0.3}
          listening={false}
        />
      ))}

      {/* 커서 (선택 없을 때만) */}
      {showCursor && !hasSelection && (
        <Line
          x={cursorPosition.x}
          y={cursorPosition.y}
          points={[0, 0, 0, cursorPosition.height]}
          stroke={cursorColor}
          strokeWidth={CURSOR_WIDTH}
          listening={false}
        />
      )}
    </Group>
  );
});

// ============================================================================
// HiddenTextarea - 키보드 입력을 받는 HTML 요소
// ============================================================================

interface HiddenTextareaProps {
  /** 초기 텍스트 값 */
  initialValue?: string;
  /** 텍스트 변경 시 콜백 */
  onChange?: (
    value: string,
    cursorIndex: number,
    selectionStart: number | null,
    selectionEnd: number | null,
  ) => void;
  /** 포커스 해제 시 콜백 */
  onBlur?: () => void;
  /** ESC 키 입력 시 콜백 */
  onEscape?: () => void;
  /** 포커스 시 콜백 */
  onFocus?: () => void;
  /** 화면 위치 (캔버스 좌표 → 화면 좌표 변환된 값) */
  screenPosition: { x: number; y: number; width: number; height: number };
  /** 폰트 크기 (화면 기준, zoom 적용됨) */
  fontSize: number;
  /** 폰트 패밀리 */
  fontFamily?: string;
  /** 자동 포커스 */
  autoFocus?: boolean;
}

export const HiddenTextarea = memo(
  forwardRef<HTMLTextAreaElement, HiddenTextareaProps>(function HiddenTextarea(
    {
      initialValue = "",
      onChange,
      onBlur,
      onEscape,
      onFocus,
      screenPosition,
      fontSize,
      fontFamily = fontStack(),
      autoFocus = true,
    },
    ref,
  ) {
    const innerRef = useRef<HTMLTextAreaElement>(null);
    const [value, setValue] = useState(initialValue);

    // 외부 ref와 내부 ref 연결
    useImperativeHandle(ref, () => innerRef.current!, []);

    // 자동 포커스
    useEffect(() => {
      if (autoFocus && innerRef.current) {
        innerRef.current.focus();
        innerRef.current.setSelectionRange(value.length, value.length);
      }
    }, [autoFocus]);

    const handleInput = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setValue(newValue);
        onChange?.(
          newValue,
          e.target.selectionStart ?? newValue.length,
          e.target.selectionStart,
          e.target.selectionEnd,
        );
      },
      [onChange],
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onEscape?.();
        }
      },
      [onEscape],
    );

    const handleSelect = useCallback(
      (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
        const target = e.target as HTMLTextAreaElement;
        onChange?.(
          value,
          target.selectionStart ?? 0,
          target.selectionStart,
          target.selectionEnd,
        );
      },
      [onChange, value],
    );

    const handleFocus = useCallback(() => {
      onFocus?.();
    }, [onFocus]);

    const handleBlur = useCallback(() => {
      onBlur?.();
    }, [onBlur]);

    // 투명 textarea 스타일 (실제 위치에 맞게 배치)
    const textareaStyle: React.CSSProperties = {
      position: "fixed",
      left: screenPosition.x,
      top: screenPosition.y,
      width: screenPosition.width,
      height: screenPosition.height,
      opacity: 0,
      pointerEvents: "auto",
      zIndex: 1000,
      fontSize: fontSize,
      fontFamily,
      lineHeight: LINE_HEIGHT,
      padding: 0,
      margin: 0,
      border: "none",
      outline: "none",
      resize: "none",
      overflow: "hidden",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      caretColor: "transparent", // 네이티브 커서 숨김
    };

    return (
      <textarea
        ref={innerRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onSelect={handleSelect}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={textareaStyle}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    );
  }),
);

// ============================================================================
// useKonvaTextInput - 상태 관리 훅
// ============================================================================

interface UseKonvaTextInputOptions {
  initialValue?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
}

export function useKonvaTextInput(options: UseKonvaTextInputOptions = {}) {
  const { initialValue = "", onChange, onBlur } = options;

  const [state, setState] = useState<TextInputState>({
    value: initialValue,
    cursorIndex: initialValue.length,
    selectionStart: null,
    selectionEnd: null,
    isFocused: false,
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = useCallback(
    (
      value: string,
      cursorIndex: number,
      selectionStart: number | null,
      selectionEnd: number | null,
    ) => {
      setState((prev) => ({
        ...prev,
        value,
        cursorIndex,
        selectionStart,
        selectionEnd,
      }));
      onChange?.(value);
    },
    [onChange],
  );

  const handleFocus = useCallback(() => {
    setState((prev) => ({ ...prev, isFocused: true }));
  }, []);

  const handleBlur = useCallback(() => {
    setState((prev) => ({ ...prev, isFocused: false }));
    onBlur?.();
  }, [onBlur]);

  const focus = useCallback(() => {
    textareaRef.current?.focus();
  }, []);

  const blur = useCallback(() => {
    textareaRef.current?.blur();
  }, []);

  return {
    state,
    textareaRef,
    handleChange,
    handleFocus,
    handleBlur,
    focus,
    blur,
  };
}
