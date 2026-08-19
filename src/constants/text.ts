/**
 * 텍스트 관련 공통 설정
 * View(Konva)와 Edit(HTML) 모두 동일한 값을 사용하여 일관성 보장
 *
 * 사용처:
 * - TextViewerOverlay.tsx (view 모드)
 * - TextEditorOverlay.tsx (edit 모드)
 * - ShapeTextEditor.tsx (shape 텍스트 edit)
 * - Rectangle.tsx, StickyNote.tsx 등 (Konva 렌더링)
 */

// 줄 높이 배율 (폰트 크기 * LINE_HEIGHT = 실제 줄 높이)
export const LINE_HEIGHT = 1.5;

// 들여쓰기 너비 (픽셀)
export const INDENT_WIDTH = 20;

// 타입별 텍스트 설정
export const TEXT_CONFIG = {
  stickyNote: {
    defaultFontSize: 16,
    defaultFontFamily: "Pretendard",
    defaultTextColor: "#1f2937",
    defaultWidth: 200,
    defaultHeight: 200,
    padding: {
      left: 12,
      right: 12,
      top: 8,
      bottom: 12,
    },
    authorHeight: 20, // 작성자명 영역 높이
    placeholder: "텍스트를 입력하세요...",
  },
  textBox: {
    defaultFontSize: 24, // preset M
    defaultFontFamily: "Pretendard",
    defaultTextColor: "#000000",
    defaultWidth: 200,
    defaultHeight: 40,
    padding: {
      left: 4,
      right: 4,
      top: 4,
      bottom: 4,
    },
    minFontSize: 8, // 가독성 최소 크기
    placeholder: "Add text",
  },
  shape: {
    defaultFontSize: 10,
    defaultFontFamily: "Pretendard",
    defaultTextColor: "#1f2937",
    defaultWidth: 100,
    defaultHeight: 100,
    padding: {
      left: 8,
      right: 8,
      top: 8,
      bottom: 8,
    },
    defaultTextAlign: "center" as const,
    defaultVerticalAlign: "middle" as const,
    placeholder: "Add text",
  },
  connectorLabel: {
    defaultFontSize: 12,
    defaultFontFamily: "Pretendard",
    defaultTextColor: "#374151",
    defaultWidth: 100,
    defaultHeight: 24,
    padding: {
      left: 6,
      right: 6,
      top: 6,
      bottom: 6,
    },
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderColor: "#3b82f6",
  },
} as const;

// 폰트 크기 프리셋 (TextBox용)
export const FONT_SIZE_PRESETS = {
  S: 16,
  M: 24,
  L: 32,
  XL: 48,
  XXL: 64,
} as const;

export type FontSizePreset = keyof typeof FONT_SIZE_PRESETS;

/**
 * 프리셋에서 폰트 크기 가져오기
 */
export function getFontSizeFromPreset(preset: FontSizePreset): number {
  return FONT_SIZE_PRESETS[preset];
}

/**
 * 텍스트 영역 크기 계산
 * View와 Edit 모드에서 동일한 텍스트 영역을 보장
 */
export function getTextAreaSize(
  type: keyof typeof TEXT_CONFIG,
  width: number,
  height: number,
  hasAuthor: boolean = false,
): { width: number; height: number; x: number; y: number } {
  const config = TEXT_CONFIG[type];
  const padding = config.padding;

  const textWidth = width - padding.left - padding.right;

  let textHeight: number;
  const textY = padding.top;

  if (type === "stickyNote") {
    const authorHeight = hasAuthor ? TEXT_CONFIG.stickyNote.authorHeight : 0;
    textHeight = height - padding.top - padding.bottom - authorHeight;
  } else {
    textHeight = height - padding.top - padding.bottom;
  }

  return {
    width: textWidth,
    height: textHeight,
    x: padding.left,
    y: textY,
  };
}

/**
 * CSS padding 문자열 생성 헬퍼
 * @example getPaddingString("stickyNote") => "8px 12px 12px 12px"
 */
export function getPaddingString(type: keyof typeof TEXT_CONFIG): string {
  const p = TEXT_CONFIG[type].padding;
  return `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px`;
}

// 커서 관련 상수
export const CURSOR = {
  /** 깜빡임 속도 (ms) */
  blinkInterval: 530,
  /** 커서 두께 (px) */
  width: 1,
  /** 커서 높이 배율 (폰트 크기 기준) */
  heightRatio: 1.0,
  /** 기본 색상 */
  color: "#6b7280", // gray-500
} as const;
