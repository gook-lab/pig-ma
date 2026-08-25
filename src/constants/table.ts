/**
 * 테이블 관련 공통 상수
 * Table.tsx, TableAddButtons.tsx, TableCellEditor.tsx 등에서 공유
 */

import { DEFAULT_FONT_FAMILY } from "./fonts";

// 테이블 기본 크기
export const TABLE_DEFAULTS = {
  /** 기본 열 너비 (px) */
  colWidth: 120,
  /** 기본 행 높이 (px) */
  rowHeight: 40,
  /** 기본 행 수 */
  rowCount: 2,
  /** 기본 열 수 */
  colCount: 2,
  /** 기본 테두리 색상 */
  borderColor: "#E0E0E0",
} as const;

// 테이블 셀 관련 상수
export const TABLE_CELL = {
  /** 셀 내부 padding */
  padding: {
    left: 8,
    right: 8,
    top: 4,
    bottom: 4,
  },
  /** 최소 행 높이 (px) */
  minRowHeight: 24,
  /** 최소 열 너비 (px) */
  minColWidth: 40,
  /** 기본 폰트 크기 */
  fontSize: 14,
  /** 기본 폰트 패밀리 */
  fontFamily: DEFAULT_FONT_FAMILY,
  /** 기본 텍스트 색상 */
  textColor: "#1f2937",
  /** 기본 텍스트 정렬 */
  textAlign: "left" as const,
  /** 기본 수직 정렬 */
  verticalAlign: "middle" as const,
} as const;

// 테이블 드래그/리사이즈 UI 상수
export const TABLE_UI = {
  /** 드래그 핸들 너비 */
  handleWidth: 32,
  /** 드래그 핸들 높이 */
  handleHeight: 32,
  /** 추가 버튼 크기 */
  addButtonSize: 18,
  /** 리사이즈 핸들 두께 */
  resizeHandleThickness: 6,
  /** 호버 존 외부 영역 너비 */
  hoverZoneOutside: 50,
} as const;

/**
 * 셀 키 생성 헬퍼
 * @example getCellKey(0, 1) => "0-1"
 */
export function getCellKey(row: number, col: number): string {
  return `${row}-${col}`;
}

/**
 * 셀 키에서 위치 추출 헬퍼
 * @example parseCellKey("1-2") => { row: 1, col: 2 }
 */
export function parseCellKey(cellKey: string): { row: number; col: number } {
  const parts = cellKey.split("-").map(Number);
  return { row: parts[0] ?? 0, col: parts[1] ?? 0 };
}
