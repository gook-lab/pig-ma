import type {
  TableEditingState,
  TableCell,
  TableCellSelection,
  TableDragState,
  CanvasStoreActions,
} from "@/types";
import type { SliceCreator } from "../types";
import {
  getCellKey,
  addRow,
  addColumn,
  deleteRow,
  deleteColumn,
  reorderRow,
  reorderColumn,
  getTableWidth,
  getTableHeight,
} from "@/utils/table";
import { TABLE_CELL } from "@/constants/table";

// ============================================================================
// Table Slice Types
// ============================================================================

export interface TableState {
  editingTableCell: TableEditingState | null;
  selectedTableCells: TableCellSelection | null;
  tableDragState: TableDragState | null;
}

export interface TableActions {
  setEditingTableCell: CanvasStoreActions["setEditingTableCell"];
  updateTableCell: CanvasStoreActions["updateTableCell"];
  addTableRow: CanvasStoreActions["addTableRow"];
  addTableColumn: CanvasStoreActions["addTableColumn"];
  deleteTableRow: CanvasStoreActions["deleteTableRow"];
  deleteTableColumn: CanvasStoreActions["deleteTableColumn"];
  reorderTableRow: CanvasStoreActions["reorderTableRow"];
  reorderTableColumn: CanvasStoreActions["reorderTableColumn"];
  setSelectedTableCells: CanvasStoreActions["setSelectedTableCells"];
  clearSelectedTableCells: CanvasStoreActions["clearSelectedTableCells"];
  deleteSelectedTableCells: CanvasStoreActions["deleteSelectedTableCells"];
  resizeTableRow: CanvasStoreActions["resizeTableRow"];
  resizeTableColumn: CanvasStoreActions["resizeTableColumn"];
  autoFitRowHeight: CanvasStoreActions["autoFitRowHeight"];
  setTableDragState: CanvasStoreActions["setTableDragState"];
}

export type TableSlice = TableState & TableActions;

// ============================================================================
// Initial State
// ============================================================================

export const tableInitialState: TableState = {
  editingTableCell: null,
  selectedTableCells: null,
  tableDragState: null,
};

// ============================================================================
// Slice Creator
// ============================================================================

export const createTableSlice: SliceCreator<TableSlice> = (set) => ({
  ...tableInitialState,

  setEditingTableCell: (state) => set({ editingTableCell: state }),

  updateTableCell: (tableId, cellKey, updates) =>
    set((state) => {
      const objects = state.objects.map((obj) => {
        if (obj.id !== tableId || !obj.tableData) return obj;

        const existingCell = obj.tableData.cells[cellKey];
        const updatedCell: TableCell = existingCell
          ? { ...existingCell, ...updates }
          : { id: crypto.randomUUID(), ...updates };

        return {
          ...obj,
          tableData: {
            ...obj.tableData,
            cells: {
              ...obj.tableData.cells,
              [cellKey]: updatedCell,
            },
          },
        };
      });

      return { objects };
    }),

  addTableRow: (tableId, afterIndex) =>
    set((state) => {
      const objects = state.objects.map((obj) => {
        if (obj.id !== tableId || !obj.tableData) return obj;

        const newTableData = addRow(obj.tableData, afterIndex);
        return {
          ...obj,
          tableData: newTableData,
          height: getTableHeight(newTableData),
        };
      });

      return { objects };
    }),

  addTableColumn: (tableId, afterIndex) =>
    set((state) => {
      const objects = state.objects.map((obj) => {
        if (obj.id !== tableId || !obj.tableData) return obj;

        const newTableData = addColumn(obj.tableData, afterIndex);
        return {
          ...obj,
          tableData: newTableData,
          width: getTableWidth(newTableData),
        };
      });

      return { objects };
    }),

  deleteTableRow: (tableId, rowIndex) =>
    set((state) => {
      const objects = state.objects.map((obj) => {
        if (obj.id !== tableId || !obj.tableData) return obj;

        const newTableData = deleteRow(obj.tableData, rowIndex);
        if (!newTableData) return obj; // Cannot delete last row

        return {
          ...obj,
          tableData: newTableData,
          height: getTableHeight(newTableData),
        };
      });

      // Clear editing state if the deleted row contained the editing cell
      const editingTableCell = state.editingTableCell;
      if (
        editingTableCell &&
        editingTableCell.tableId === tableId &&
        editingTableCell.row === rowIndex
      ) {
        return { objects, editingTableCell: null };
      }

      // Adjust editing cell row index if needed
      if (
        editingTableCell &&
        editingTableCell.tableId === tableId &&
        editingTableCell.row > rowIndex
      ) {
        return {
          objects,
          editingTableCell: {
            ...editingTableCell,
            row: editingTableCell.row - 1,
            cellKey: getCellKey(editingTableCell.row - 1, editingTableCell.col),
          },
        };
      }

      return { objects };
    }),

  deleteTableColumn: (tableId, colIndex) =>
    set((state) => {
      const objects = state.objects.map((obj) => {
        if (obj.id !== tableId || !obj.tableData) return obj;

        const newTableData = deleteColumn(obj.tableData, colIndex);
        if (!newTableData) return obj; // Cannot delete last column

        return {
          ...obj,
          tableData: newTableData,
          width: getTableWidth(newTableData),
        };
      });

      // Clear editing state if the deleted column contained the editing cell
      const editingTableCell = state.editingTableCell;
      if (
        editingTableCell &&
        editingTableCell.tableId === tableId &&
        editingTableCell.col === colIndex
      ) {
        return { objects, editingTableCell: null };
      }

      // Adjust editing cell column index if needed
      if (
        editingTableCell &&
        editingTableCell.tableId === tableId &&
        editingTableCell.col > colIndex
      ) {
        return {
          objects,
          editingTableCell: {
            ...editingTableCell,
            col: editingTableCell.col - 1,
            cellKey: getCellKey(editingTableCell.row, editingTableCell.col - 1),
          },
        };
      }

      return { objects };
    }),

  reorderTableRow: (tableId, fromIndex, toIndex) =>
    set((state) => {
      const objects = state.objects.map((obj) => {
        if (obj.id !== tableId || !obj.tableData) return obj;

        const newTableData = reorderRow(obj.tableData, fromIndex, toIndex);
        return {
          ...obj,
          tableData: newTableData,
        };
      });

      // Adjust editing cell row index if needed
      const editingTableCell = state.editingTableCell;
      if (editingTableCell && editingTableCell.tableId === tableId) {
        const oldRow = editingTableCell.row;
        let newRow = oldRow;

        if (oldRow === fromIndex) {
          // The row being edited was moved
          newRow = toIndex;
        } else if (fromIndex < toIndex) {
          // Moving down: rows between shift up
          if (oldRow > fromIndex && oldRow <= toIndex) {
            newRow = oldRow - 1;
          }
        } else {
          // Moving up: rows between shift down
          if (oldRow >= toIndex && oldRow < fromIndex) {
            newRow = oldRow + 1;
          }
        }

        if (newRow !== oldRow) {
          return {
            objects,
            editingTableCell: {
              ...editingTableCell,
              row: newRow,
              cellKey: getCellKey(newRow, editingTableCell.col),
            },
          };
        }
      }

      return { objects };
    }),

  reorderTableColumn: (tableId, fromIndex, toIndex) =>
    set((state) => {
      const objects = state.objects.map((obj) => {
        if (obj.id !== tableId || !obj.tableData) return obj;

        const newTableData = reorderColumn(obj.tableData, fromIndex, toIndex);
        return {
          ...obj,
          tableData: newTableData,
        };
      });

      // Adjust editing cell column index if needed
      const editingTableCell = state.editingTableCell;
      if (editingTableCell && editingTableCell.tableId === tableId) {
        const oldCol = editingTableCell.col;
        let newCol = oldCol;

        if (oldCol === fromIndex) {
          // The column being edited was moved
          newCol = toIndex;
        } else if (fromIndex < toIndex) {
          // Moving right: columns between shift left
          if (oldCol > fromIndex && oldCol <= toIndex) {
            newCol = oldCol - 1;
          }
        } else {
          // Moving left: columns between shift right
          if (oldCol >= toIndex && oldCol < fromIndex) {
            newCol = oldCol + 1;
          }
        }

        if (newCol !== oldCol) {
          return {
            objects,
            editingTableCell: {
              ...editingTableCell,
              col: newCol,
              cellKey: getCellKey(editingTableCell.row, newCol),
            },
          };
        }
      }

      return { objects };
    }),

  setSelectedTableCells: (selection) => set({ selectedTableCells: selection }),

  clearSelectedTableCells: () => set({ selectedTableCells: null }),

  deleteSelectedTableCells: () =>
    set((state) => {
      const selection = state.selectedTableCells;
      if (!selection) return state;

      const { tableId, startRow, startCol, endRow, endCol } = selection;
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);

      // Find the table
      const table = state.objects.find((obj) => obj.id === tableId);
      if (!table || !table.tableData) return state;

      const tableData = table.tableData;
      const selectedRowCount = maxRow - minRow + 1;
      const selectedColCount = maxCol - minCol + 1;
      const isFullRowSelection = selectedColCount === tableData.colCount;
      const isFullColSelection = selectedRowCount === tableData.rowCount;

      // Determine what to delete
      if (isFullRowSelection && selectedRowCount < tableData.rowCount) {
        // Delete selected rows (from highest to lowest to preserve indices)
        let newTableData = tableData;
        for (let row = maxRow; row >= minRow; row--) {
          const result = deleteRow(newTableData, row);
          if (result) newTableData = result;
        }

        const objects = state.objects.map((obj) =>
          obj.id === tableId
            ? {
                ...obj,
                tableData: newTableData,
                height: getTableHeight(newTableData),
              }
            : obj,
        );

        return { objects, selectedTableCells: null, editingTableCell: null };
      } else if (isFullColSelection && selectedColCount < tableData.colCount) {
        // Delete selected columns (from highest to lowest to preserve indices)
        let newTableData = tableData;
        for (let col = maxCol; col >= minCol; col--) {
          const result = deleteColumn(newTableData, col);
          if (result) newTableData = result;
        }

        const objects = state.objects.map((obj) =>
          obj.id === tableId
            ? {
                ...obj,
                tableData: newTableData,
                width: getTableWidth(newTableData),
              }
            : obj,
        );

        return { objects, selectedTableCells: null, editingTableCell: null };
      } else {
        // Clear content of selected cells
        const newCells = { ...tableData.cells };
        for (let row = minRow; row <= maxRow; row++) {
          for (let col = minCol; col <= maxCol; col++) {
            const key = getCellKey(row, col);
            if (newCells[key]) {
              newCells[key] = {
                ...newCells[key],
                content: undefined,
              };
            }
          }
        }

        const objects = state.objects.map((obj) =>
          obj.id === tableId
            ? {
                ...obj,
                tableData: {
                  ...tableData,
                  cells: newCells,
                },
              }
            : obj,
        );

        return { objects, selectedTableCells: null };
      }
    }),

  resizeTableRow: (tableId, rowIndex, height) =>
    set((state) => {
      const newHeight = Math.max(TABLE_CELL.minRowHeight, height);

      const objects = state.objects.map((obj) => {
        if (obj.id !== tableId || !obj.tableData) return obj;

        const newRowHeights = [...obj.tableData.rowHeights];
        newRowHeights[rowIndex] = newHeight;

        const newTableData = {
          ...obj.tableData,
          rowHeights: newRowHeights,
        };

        return {
          ...obj,
          tableData: newTableData,
          height: getTableHeight(newTableData),
        };
      });

      return { objects };
    }),

  resizeTableColumn: (tableId, colIndex, width) =>
    set((state) => {
      const newWidth = Math.max(TABLE_CELL.minColWidth, width);

      const objects = state.objects.map((obj) => {
        if (obj.id !== tableId || !obj.tableData) return obj;

        const newColWidths = [...obj.tableData.colWidths];
        newColWidths[colIndex] = newWidth;

        const newTableData = {
          ...obj.tableData,
          colWidths: newColWidths,
        };

        return {
          ...obj,
          tableData: newTableData,
          width: getTableWidth(newTableData),
        };
      });

      return { objects };
    }),

  autoFitRowHeight: (tableId, rowIndex, cellKey, measuredHeight) =>
    set((state) => {
      // 셀 패딩 (상하)
      const padding = TABLE_CELL.padding.top + TABLE_CELL.padding.bottom;

      const objects = state.objects.map((obj) => {
        if (obj.id !== tableId || !obj.tableData) return obj;

        // 테이블의 기본 행 높이를 최소값으로 사용
        const minRowHeight = obj.tableData.defaultRowHeight;

        // 해당 셀의 measuredHeight 업데이트
        const existingCell = obj.tableData.cells[cellKey];
        const updatedCell = existingCell
          ? { ...existingCell, measuredHeight }
          : { id: crypto.randomUUID(), measuredHeight };

        const newCells = {
          ...obj.tableData.cells,
          [cellKey]: updatedCell,
        };

        // 해당 행의 모든 셀 중 가장 큰 measuredHeight 찾기
        let maxHeight = minRowHeight;
        for (let col = 0; col < obj.tableData.colCount; col++) {
          const key = getCellKey(rowIndex, col);
          const cell = newCells[key];
          if (cell?.measuredHeight) {
            maxHeight = Math.max(maxHeight, cell.measuredHeight + padding);
          }
        }

        // 행 높이 업데이트 - 최소값은 테이블의 기본 행 높이
        const newRowHeights = [...obj.tableData.rowHeights];
        newRowHeights[rowIndex] = Math.max(maxHeight, minRowHeight);

        const newTableData = {
          ...obj.tableData,
          cells: newCells,
          rowHeights: newRowHeights,
        };

        return {
          ...obj,
          tableData: newTableData,
          height: getTableHeight(newTableData),
        };
      });

      return { objects };
    }),

  setTableDragState: (state) => set({ tableDragState: state }),
});
