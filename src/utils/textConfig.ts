/**
 * @deprecated `@/constants/text`에서 import하세요.
 * 이 파일은 하위 호환성을 위해 유지됩니다.
 */
export {
  LINE_HEIGHT,
  INDENT_WIDTH,
  TEXT_CONFIG,
  FONT_SIZE_PRESETS,
  CURSOR,
  getFontSizeFromPreset,
  getTextAreaSize,
  getPaddingString,
} from "@/constants/text";

export type { FontSizePreset } from "@/constants/text";

// 기존 개별 export 호환성 유지
import { CURSOR } from "@/constants/text";
export const CURSOR_BLINK_INTERVAL = CURSOR.blinkInterval;
export const CURSOR_WIDTH = CURSOR.width;
export const CURSOR_HEIGHT_RATIO = CURSOR.heightRatio;
export const CURSOR_COLOR = CURSOR.color;
