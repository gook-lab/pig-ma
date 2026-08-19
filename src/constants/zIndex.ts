/**
 * Z-Index 계층 상수
 *
 * UI 요소들의 z-index를 중앙에서 관리합니다.
 * 숫자가 클수록 화면 앞에 표시됩니다.
 *
 * 계층 구조:
 * - TEXT_INPUT (9999): 텍스트 입력 필드 (항상 최상위)
 * - MODAL (200+): 모달, 다이얼로그
 * - OPTIONS_BAR (200): 옵션바, 컨텍스트 메뉴
 * - CAPTION_POPUP (150): 캡션 팝업
 * - HEADER (100): 헤더, 공유 버튼
 * - CAPTION_PANEL (90): 캡션 패널
 * - LOCK_OVERLAY (60): 잠금 오버레이
 * - TOOLBAR (50): 툴바, 팝오버, 플로팅 유틸리티
 * - SIDE_PANEL (40): 사이드 패널
 * - CANVAS_OVERLAY (10-39): 캔버스 오버레이 (텍스트, 코드블럭 등)
 */

// 텍스트 입력 (최상위)
export const Z_TEXT_INPUT = 9999;

// 모달 / 다이얼로그
export const Z_MODAL_BACKDROP = 200;
export const Z_MODAL_CONTENT = 201;

// 옵션바 / 컨텍스트 메뉴 / 캡션 입력
export const Z_OPTIONS_BAR = 200;
export const Z_CONTEXT_MENU = 200;
export const Z_CURSOR_CHAT = 200;

// 캡션 시스템
export const Z_CAPTION_POPUP_BACKDROP = 150;
export const Z_CAPTION_POPUP = 151;
export const Z_EMOJI_PICKER_BACKDROP = 160;
export const Z_EMOJI_PICKER = 161;

// 헤더 / 상단 UI
export const Z_HEADER = 100;
export const Z_SHARE_BUTTON = 100;
export const Z_UNLOCK_DIALOG = 100;

// 캡션 패널
export const Z_CAPTION_PANEL = 90;

// 잠금 오버레이
export const Z_LOCK_OVERLAY = 60;
export const Z_LOCK_BADGE = 61;

// 툴바 / 팝오버 / 플로팅 UI
export const Z_TOOLBAR = 50;
export const Z_POPOVER = 50;
export const Z_ZOOM_CONTROLS = 50;
export const Z_FLOATING_UTILITY = 50;

// 캔버스 오버레이 (TextViewerOverlay, TextEditorOverlay, CodeBlockViewerOverlay)
// 실제 값: Z_CANVAS_OVERLAY_BASE + objectIndex (최대 Z_CANVAS_OVERLAY_MAX)
export const Z_CANVAS_OVERLAY_BASE = 10;
export const Z_CANVAS_OVERLAY_MAX = 39; // Z_SIDE_PANEL(40) 미만으로 유지

// 사이드 패널
export const Z_SIDE_PANEL = 40;

// 선택 상호작용 UI 레이어 (Transformer 핸들 — Konva 캔버스 엘리먼트에 적용)
// 캔버스 오버레이(≤39)보다 위, 사이드 패널(40)과는 동값 — 패널이 DOM 상
// 뒤에 렌더링되므로 동값이면 패널이 위에 남는다.
export const Z_SELECTION_UI = 40;

// 드롭다운 내부 (상대적 z-index)
export const Z_DROPDOWN_BACKDROP = 10;
export const Z_DROPDOWN_CONTENT = 20;

/**
 * 캔버스 오버레이 z-index 계산
 * @param objectIndex - objects 배열에서의 인덱스
 * @returns z-index 값 (Z_CANVAS_OVERLAY_MAX 이하로 제한)
 */
export function getCanvasOverlayZIndex(objectIndex: number): number {
  return Math.min(Z_CANVAS_OVERLAY_BASE + objectIndex, Z_CANVAS_OVERLAY_MAX);
}

// ============================================================================
// 옵션바 위치 상수
// ============================================================================

/** 요소와 옵션바 사이 간격 (px) */
export const OPTIONS_BAR_OFFSET = 30;

/** 옵션바 메인 바 높이 (px) - 드롭다운 제외 */
export const OPTIONS_BAR_HEIGHT = 50;

/** 옵션바 예상 너비 - 좌우 경계 체크용 (px) */
export const OPTIONS_BAR_WIDTH = 700;

/** 화면 경계 여백 (px) */
export const OPTIONS_BAR_SCREEN_PADDING = 16;

/** 하단 툴바 여유 공간 (px) */
export const OPTIONS_BAR_TOOLBAR_RESERVED = 100;

/** 드롭다운 예상 높이 - 화면 경계 체크용 (px) */
export const OPTIONS_BAR_DROPDOWN_HEIGHT = 250;
