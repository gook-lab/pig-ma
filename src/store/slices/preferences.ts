import type { FontFamily, CanvasStoreActions } from "@/types";
import { DEFAULT_FONT_FAMILY } from "@/constants/fonts";
import type { SliceCreator } from "../types";

// ============================================================================
// Preferences Slice Types
// ============================================================================

/**
 * 앱 전역 사용자 설정. 문서(objects)가 아니라 **이 브라우저의 취향**이므로
 * .pigma 에는 안 들어가고 localStorage 에만 남는다.
 *
 * grid/ui 슬라이스와 나눠 둔 이유: 저쪽은 화면 상태(잠금, 패널 열림 등)가
 * 섞여 있어 무엇이 영구 설정인지 구분되지 않는다.
 */
export interface PreferencesState {
  /**
   * **새로 만드는** 객체가 받을 폰트. 이미 있는 객체는 각자 값을 유지한다 —
   * 여기서 바꿨다고 문서 전체 서체가 바뀌면 되돌릴 방법이 없다.
   */
  defaultFontFamily: FontFamily;
}

export interface PreferencesActions {
  setDefaultFontFamily: CanvasStoreActions["setDefaultFontFamily"];
}

export type PreferencesSlice = PreferencesState & PreferencesActions;

// ============================================================================
// Initial State
// ============================================================================

export const preferencesInitialState: PreferencesState = {
  defaultFontFamily: DEFAULT_FONT_FAMILY,
};

// ============================================================================
// Slice Creator
// ============================================================================

export const createPreferencesSlice: SliceCreator<PreferencesSlice> = (
  set,
) => ({
  ...preferencesInitialState,

  setDefaultFontFamily: (family) => set({ defaultFontFamily: family }),
});
