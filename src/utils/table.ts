import type { TableCell, TableData } from "../types";
import { TABLE_CELL, TABLE_DEFAULTS } from "@/constants/table";

/**
 * 테이블 유틸리티 함수
 * 순수 함수 - 입력값 변경 없음 (immutable)
 */

/**
 * 행/열 인덱스로 셀 키 생성
 * @example getCellKey(0, 1) => "0-1"
 */
export function getCellKey(row: number, col: number): string {
  return `${row}-${col}`;
}

/**
 * 셀 키에서 행/열 인덱스 추출
 * @example getCellPosition("1-2") => { row: 1, col: 2 }
 */
export function getCellPosition(cellKey: string): { row: number; col: number } {
  const [row, col] = cellKey.split("-").map(Number);
  return { row, col };
}

/**
 * 테이블에서 특정 셀 가져오기
 * @returns 셀 데이터 또는 undefined (셀이 없는 경우)
 */
export function getCell(
  tableData: TableData,
  row: number,
  col: number,
): TableCell | undefined {
  const key = getCellKey(row, col);
  return tableData.cells[key];
}

/**
 * 테이블에 셀 설정 (immutable)
 * @returns 새로운 TableData 객체
 */
export function setCell(
  tableData: TableData,
  row: number,
  col: number,
  cell: TableCell,
): TableData {
  const key = getCellKey(row, col);
  return {
    ...tableData,
    cells: {
      ...tableData.cells,
      [key]: cell,
    },
  };
}

/**
 * 테이블 전체 너비 계산
 */
export function getTableWidth(tableData: TableData): number {
  return tableData.colWidths.reduce((sum, w) => sum + w, 0);
}

/**
 * 테이블 전체 높이 계산
 */
export function getTableHeight(tableData: TableData): number {
  return tableData.rowHeights.reduce((sum, h) => sum + h, 0);
}

/**
 * 캔버스 좌표에서 셀 위치 찾기
 * @param localX 테이블 로컬 X 좌표
 * @param localY 테이블 로컬 Y 좌표
 * @returns 셀 위치 또는 null (테이블 외부)
 */
export function getCellAtPosition(
  tableData: TableData,
  localX: number,
  localY: number,
): { row: number; col: number; cellKey: string } | null {
  // 테이블 범위 체크
  const tableWidth = getTableWidth(tableData);
  const tableHeight = getTableHeight(tableData);

  if (
    localX < 0 ||
    localX >= tableWidth ||
    localY < 0 ||
    localY >= tableHeight
  ) {
    return null;
  }

  // 열 찾기
  let col = tableData.colCount - 1; // 기본값: 마지막 열
  let accX = 0;
  for (let i = 0; i < tableData.colCount; i++) {
    accX += tableData.colWidths[i] ?? tableData.defaultColWidth;
    if (localX < accX) {
      col = i;
      break;
    }
  }

  // 행 찾기
  let row = tableData.rowCount - 1; // 기본값: 마지막 행
  let accY = 0;
  for (let i = 0; i < tableData.rowCount; i++) {
    accY += tableData.rowHeights[i] ?? tableData.defaultRowHeight;
    if (localY < accY) {
      row = i;
      break;
    }
  }

  return { row, col, cellKey: getCellKey(row, col) };
}

/**
 * 특정 행의 Y 좌표 계산 (누적)
 */
export function getRowY(tableData: TableData, rowIndex: number): number {
  let y = 0;
  for (let i = 0; i < rowIndex; i++) {
    y += tableData.rowHeights[i] ?? tableData.defaultRowHeight;
  }
  return y;
}

/**
 * 특정 열의 X 좌표 계산 (누적)
 */
export function getColX(tableData: TableData, colIndex: number): number {
  let x = 0;
  for (let i = 0; i < colIndex; i++) {
    x += tableData.colWidths[i] ?? tableData.defaultColWidth;
  }
  return x;
}

/**
 * 특정 행의 높이
 */
export function getRowHeight(tableData: TableData, rowIndex: number): number {
  return tableData.rowHeights[rowIndex] ?? tableData.defaultRowHeight;
}

/**
 * 특정 열의 너비
 */
export function getColWidth(tableData: TableData, colIndex: number): number {
  return tableData.colWidths[colIndex] ?? tableData.defaultColWidth;
}

/**
 * 셀의 바운딩 박스 계산
 * @returns 셀의 { x, y, width, height } (테이블 로컬 좌표)
 */
export function getCellBounds(
  tableData: TableData,
  row: number,
  col: number,
): { x: number; y: number; width: number; height: number } {
  const x = getColX(tableData, col);
  const y = getRowY(tableData, row);
  const width = getColWidth(tableData, col);
  const height = getRowHeight(tableData, row);

  return { x, y, width, height };
}

/**
 * 새로운 빈 셀 생성
 */
export function createEmptyCell(id?: string): TableCell {
  return {
    id: id ?? crypto.randomUUID(),
    textAlign: "left",
    verticalAlign: "middle",
  };
}

/**
 * 기본 테이블 데이터 생성
 * TABLE_DEFAULTS 상수 사용
 */
export function createDefaultTableData(): TableData {
  const cells: Record<string, TableCell> = {};
  const { rowCount, colCount, rowHeight, colWidth, borderColor } =
    TABLE_DEFAULTS;

  // 기본 셀 생성
  for (let row = 0; row < rowCount; row++) {
    for (let col = 0; col < colCount; col++) {
      const key = getCellKey(row, col);
      cells[key] = createEmptyCell();
    }
  }

  return {
    cells,
    rowCount,
    colCount,
    colWidths: Array(colCount).fill(colWidth),
    rowHeights: Array(rowCount).fill(rowHeight),
    defaultColWidth: colWidth,
    defaultRowHeight: rowHeight,
    borderColor,
  };
}

/**
 * 행 추가 (immutable)
 * @param afterIndex 이 인덱스 다음에 행 추가 (기본값: 마지막)
 */
export function addRow(tableData: TableData, afterIndex?: number): TableData {
  const insertIndex = afterIndex ?? tableData.rowCount - 1;
  const newRowIndex = insertIndex + 1;
  const newCells: Record<string, TableCell> = {};

  // 기존 셀 복사 및 인덱스 조정
  for (const [key, cell] of Object.entries(tableData.cells)) {
    const { row, col } = getCellPosition(key);
    if (row > insertIndex) {
      // 삽입 위치 이후 행은 인덱스 +1
      newCells[getCellKey(row + 1, col)] = cell;
    } else {
      newCells[key] = cell;
    }
  }

  // 새 행 셀 추가
  for (let col = 0; col < tableData.colCount; col++) {
    newCells[getCellKey(newRowIndex, col)] = createEmptyCell();
  }

  // 행 높이 배열 업데이트
  const newRowHeights = [...tableData.rowHeights];
  newRowHeights.splice(newRowIndex, 0, tableData.defaultRowHeight);

  return {
    ...tableData,
    cells: newCells,
    rowCount: tableData.rowCount + 1,
    rowHeights: newRowHeights,
  };
}

/**
 * 열 추가 (immutable)
 * @param afterIndex 이 인덱스 다음에 열 추가 (기본값: 마지막)
 */
export function addColumn(
  tableData: TableData,
  afterIndex?: number,
): TableData {
  const insertIndex = afterIndex ?? tableData.colCount - 1;
  const newColIndex = insertIndex + 1;
  const newCells: Record<string, TableCell> = {};

  // 기존 셀 복사 및 인덱스 조정
  for (const [key, cell] of Object.entries(tableData.cells)) {
    const { row, col } = getCellPosition(key);
    if (col > insertIndex) {
      // 삽입 위치 이후 열은 인덱스 +1
      newCells[getCellKey(row, col + 1)] = cell;
    } else {
      newCells[key] = cell;
    }
  }

  // 새 열 셀 추가
  for (let row = 0; row < tableData.rowCount; row++) {
    newCells[getCellKey(row, newColIndex)] = createEmptyCell();
  }

  // 열 너비 배열 업데이트
  const newColWidths = [...tableData.colWidths];
  newColWidths.splice(newColIndex, 0, tableData.defaultColWidth);

  return {
    ...tableData,
    cells: newCells,
    colCount: tableData.colCount + 1,
    colWidths: newColWidths,
  };
}

/**
 * 행 삭제 (immutable)
 * @returns 새로운 TableData 또는 null (행이 1개면 삭제 불가)
 */
export function deleteRow(
  tableData: TableData,
  rowIndex: number,
): TableData | null {
  if (tableData.rowCount <= 1) {
    return null; // 최소 1행 유지
  }

  const newCells: Record<string, TableCell> = {};

  for (const [key, cell] of Object.entries(tableData.cells)) {
    const { row, col } = getCellPosition(key);
    if (row < rowIndex) {
      newCells[key] = cell;
    } else if (row > rowIndex) {
      // 삭제된 행 이후는 인덱스 -1
      newCells[getCellKey(row - 1, col)] = cell;
    }
    // row === rowIndex인 셀은 제외
  }

  const newRowHeights = [...tableData.rowHeights];
  newRowHeights.splice(rowIndex, 1);

  return {
    ...tableData,
    cells: newCells,
    rowCount: tableData.rowCount - 1,
    rowHeights: newRowHeights,
  };
}

/**
 * 열 삭제 (immutable)
 * @returns 새로운 TableData 또는 null (열이 1개면 삭제 불가)
 */
export function deleteColumn(
  tableData: TableData,
  colIndex: number,
): TableData | null {
  if (tableData.colCount <= 1) {
    return null; // 최소 1열 유지
  }

  const newCells: Record<string, TableCell> = {};

  for (const [key, cell] of Object.entries(tableData.cells)) {
    const { row, col } = getCellPosition(key);
    if (col < colIndex) {
      newCells[key] = cell;
    } else if (col > colIndex) {
      // 삭제된 열 이후는 인덱스 -1
      newCells[getCellKey(row, col - 1)] = cell;
    }
    // col === colIndex인 셀은 제외
  }

  const newColWidths = [...tableData.colWidths];
  newColWidths.splice(colIndex, 1);

  return {
    ...tableData,
    cells: newCells,
    colCount: tableData.colCount - 1,
    colWidths: newColWidths,
  };
}

/**
 * 다음 셀 키 계산 (Tab 네비게이션)
 * @returns 다음 셀 키 또는 null (마지막 셀인 경우)
 */
export function getNextCellKey(
  tableData: TableData,
  currentRow: number,
  currentCol: number,
): string | null {
  const nextCol = currentCol + 1;
  if (nextCol < tableData.colCount) {
    return getCellKey(currentRow, nextCol);
  }

  // 다음 행 첫 열
  const nextRow = currentRow + 1;
  if (nextRow < tableData.rowCount) {
    return getCellKey(nextRow, 0);
  }

  return null; // 마지막 셀
}

/**
 * 이전 셀 키 계산 (Shift+Tab 네비게이션)
 * @returns 이전 셀 키 또는 null (첫 번째 셀인 경우)
 */
export function getPrevCellKey(
  tableData: TableData,
  currentRow: number,
  currentCol: number,
): string | null {
  const prevCol = currentCol - 1;
  if (prevCol >= 0) {
    return getCellKey(currentRow, prevCol);
  }

  // 이전 행 마지막 열
  const prevRow = currentRow - 1;
  if (prevRow >= 0) {
    return getCellKey(prevRow, tableData.colCount - 1);
  }

  return null; // 첫 번째 셀
}

/**
 * 아래 셀 키 계산 (Enter 네비게이션)
 * @returns 아래 셀 키 또는 null (마지막 행인 경우)
 */
export function getCellBelowKey(
  tableData: TableData,
  currentRow: number,
  currentCol: number,
): string | null {
  const nextRow = currentRow + 1;
  if (nextRow < tableData.rowCount) {
    return getCellKey(nextRow, currentCol);
  }
  return null;
}

/**
 * 테이블 데이터 deep copy (복사/붙여넣기용)
 * 새로운 셀 ID 생성
 */
export function cloneTableData(tableData: TableData): TableData {
  const newCells: Record<string, TableCell> = {};

  for (const [key, cell] of Object.entries(tableData.cells)) {
    newCells[key] = {
      ...cell,
      id: crypto.randomUUID(),
      content: cell.content
        ? JSON.parse(JSON.stringify(cell.content))
        : undefined,
    };
  }

  return {
    ...tableData,
    cells: newCells,
    colWidths: [...tableData.colWidths],
    rowHeights: [...tableData.rowHeights],
  };
}

/**
 * 행 순서 변경 (드래그앤드롭)
 * @param fromIndex 이동할 행 인덱스
 * @param toIndex 목표 위치 인덱스
 */
export function reorderRow(
  tableData: TableData,
  fromIndex: number,
  toIndex: number,
): TableData {
  if (fromIndex === toIndex) return tableData;
  if (fromIndex < 0 || fromIndex >= tableData.rowCount) return tableData;
  if (toIndex < 0 || toIndex >= tableData.rowCount) return tableData;

  const newCells: Record<string, TableCell> = {};

  // 행 순서 재배열
  const rowOrder = Array.from({ length: tableData.rowCount }, (_, i) => i);
  const [removed] = rowOrder.splice(fromIndex, 1);
  rowOrder.splice(toIndex, 0, removed);

  // 새로운 인덱스로 셀 복사
  for (let newRow = 0; newRow < rowOrder.length; newRow++) {
    const oldRow = rowOrder[newRow];
    for (let col = 0; col < tableData.colCount; col++) {
      const oldKey = getCellKey(oldRow, col);
      const newKey = getCellKey(newRow, col);
      const cell = tableData.cells[oldKey];
      if (cell) {
        newCells[newKey] = cell;
      }
    }
  }

  // 행 높이 재배열
  const newRowHeights = rowOrder.map(
    (oldIndex) => tableData.rowHeights[oldIndex],
  );

  return {
    ...tableData,
    cells: newCells,
    rowHeights: newRowHeights,
  };
}

/**
 * 열 순서 변경 (드래그앤드롭)
 * @param fromIndex 이동할 열 인덱스
 * @param toIndex 목표 위치 인덱스
 */
export function reorderColumn(
  tableData: TableData,
  fromIndex: number,
  toIndex: number,
): TableData {
  if (fromIndex === toIndex) return tableData;
  if (fromIndex < 0 || fromIndex >= tableData.colCount) return tableData;
  if (toIndex < 0 || toIndex >= tableData.colCount) return tableData;

  const newCells: Record<string, TableCell> = {};

  // 열 순서 재배열
  const colOrder = Array.from({ length: tableData.colCount }, (_, i) => i);
  const [removed] = colOrder.splice(fromIndex, 1);
  colOrder.splice(toIndex, 0, removed);

  // 새로운 인덱스로 셀 복사
  for (let row = 0; row < tableData.rowCount; row++) {
    for (let newCol = 0; newCol < colOrder.length; newCol++) {
      const oldCol = colOrder[newCol];
      const oldKey = getCellKey(row, oldCol);
      const newKey = getCellKey(row, newCol);
      const cell = tableData.cells[oldKey];
      if (cell) {
        newCells[newKey] = cell;
      }
    }
  }

  // 열 너비 재배열
  const newColWidths = colOrder.map(
    (oldIndex) => tableData.colWidths[oldIndex],
  );

  return {
    ...tableData,
    cells: newCells,
    colWidths: newColWidths,
  };
}

// ============================================================================
// 셀 텍스트 영역 (캔버스 렌더링 ↔ 편집 오버레이 정합)
// ============================================================================

export interface CellContentBox {
  width: number;
  height: number;
}

/**
 * 캔버스(Konva Text)가 실제로 글자를 그리는 영역.
 * Table.tsx 의 <Text width/height> 계산과 같은 식이어야 한다.
 */
export function getCanvasCellContentBox(
  cellWidth: number,
  cellHeight: number,
): CellContentBox {
  return {
    width: cellWidth - TABLE_CELL.padding.left - TABLE_CELL.padding.right,
    height: cellHeight - TABLE_CELL.padding.top - TABLE_CELL.padding.bottom,
  };
}

/**
 * 편집 오버레이(HTML)가 글자를 흘리는 영역.
 *
 * box-sizing: border-box 라서 border 를 주면 그만큼 콘텐츠 폭이 줄어든다.
 * 캔버스 셀에는 대응하는 안쪽 여백이 없으므로, 포커스하는 순간 텍스트가
 * 더 좁은 폭으로 다시 줄바꿈되고 → ResizeObserver 가 그 높이를 재서
 * autoFitRowHeight 로 행 높이를 바꿔버린다. 그래서 "생성 때와 포커스 때
 * 크기가 다르다"가 된다.
 *
 * 해결: 포커스 테두리를 border 가 아니라 outline 으로 그린다(레이아웃 미참여).
 * 이 함수는 그 불변식을 테스트로 잠그기 위한 것이다.
 */
export function getEditorCellContentBox(
  cellWidth: number,
  cellHeight: number,
  borderWidth = 0,
): CellContentBox {
  return {
    width:
      cellWidth -
      TABLE_CELL.padding.left -
      TABLE_CELL.padding.right -
      borderWidth * 2,
    height:
      cellHeight -
      TABLE_CELL.padding.top -
      TABLE_CELL.padding.bottom -
      borderWidth * 2,
  };
}
