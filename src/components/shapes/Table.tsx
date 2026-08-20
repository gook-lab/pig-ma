import { memo, useCallback, useRef, useMemo } from "react";
import { Group, Rect, Shape, Text } from "react-konva";
import type Konva from "konva";
import type {
  CanvasObject,
  TableEditingState,
  TableCellSelection,
} from "@/types";
import { useCanvasStore } from "@/store";
import { SelectionBorder } from "@/components/SelectionBorder";
import {
  getTableWidth,
  getTableHeight,
  getCellBounds,
  getCellAtPosition,
  getRowY,
  getColX,
} from "@/utils/table";
import { TABLE_CELL } from "@/constants/table";
import { isTextReadable } from "@/constants/text";
import {
  tiptapToPlainText,
  extractFirstTextStyle,
} from "@/utils/tiptapMigration";

interface TableProps {
  shape: CanvasObject;
  isSelected: boolean;
  isMultiSelected?: boolean;
  zoom?: number;
  draggable?: boolean;
  editingCell?: TableEditingState | null;
  selectedCells?: TableCellSelection | null;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onCellDoubleClick?: (
    tableId: string,
    cellKey: string,
    row: number,
    col: number,
  ) => void;
  onCellSelectionChange?: (selection: TableCellSelection | null) => void;
}

export const Table = memo(function Table({
  shape,
  isSelected,
  isMultiSelected = false,
  zoom = 1,
  draggable = true,
  editingCell,
  selectedCells,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onCellDoubleClick,
  onCellSelectionChange,
}: TableProps) {
  const tableData = shape.tableData;
  const isDraggingCellRef = useRef(false);
  const dragStartCellRef = useRef<{ row: number; col: number } | null>(null);
  const tableDragState = useCanvasStore((s) => s.tableDragState);
  // 줌 LOD — 셀 텍스트는 기본 폰트(14px) 기준 boolean 구독
  const cellTextReadable = useCanvasStore((s) =>
    isTextReadable(TABLE_CELL.fontSize, s.viewport.zoom),
  );

  // 조기 반환은 훅을 모두 호출한 뒤에 한다 (아래 early return) — 훅 위에서
  // 반환하면 tableData 유무에 따라 훅 개수가 달라진다.
  const tableWidth = tableData ? getTableWidth(tableData) : 0;
  const tableHeight = tableData ? getTableHeight(tableData) : 0;
  const isLocked = shape.locked === true;

  // Calculate drag offset for a row (swap effect)
  const getRowDragOffset = useMemo(() => {
    return (rowIndex: number): number => {
      if (!tableData) return 0;
      if (
        !tableDragState ||
        tableDragState.tableId !== shape.id ||
        tableDragState.type !== "row"
      ) {
        return 0;
      }
      const { dragIndex, dragOverIndex } = tableDragState;
      if (dragIndex === dragOverIndex) return 0;

      // Dragged row moves to target position
      if (rowIndex === dragIndex) {
        return (
          getRowY(tableData, dragOverIndex) - getRowY(tableData, dragIndex)
        );
      }
      // Target row moves to original position (swap)
      if (rowIndex === dragOverIndex) {
        return (
          getRowY(tableData, dragIndex) - getRowY(tableData, dragOverIndex)
        );
      }
      return 0;
    };
  }, [tableDragState, shape.id, tableData]);

  // Calculate drag offset for a column (swap effect)
  const getColDragOffset = useMemo(() => {
    return (colIndex: number): number => {
      if (!tableData) return 0;
      if (
        !tableDragState ||
        tableDragState.tableId !== shape.id ||
        tableDragState.type !== "column"
      ) {
        return 0;
      }
      const { dragIndex, dragOverIndex } = tableDragState;
      if (dragIndex === dragOverIndex) return 0;

      // Dragged column moves to target position
      if (colIndex === dragIndex) {
        return (
          getColX(tableData, dragOverIndex) - getColX(tableData, dragIndex)
        );
      }
      // Target column moves to original position (swap)
      if (colIndex === dragOverIndex) {
        return (
          getColX(tableData, dragIndex) - getColX(tableData, dragOverIndex)
        );
      }
      return 0;
    };
  }, [tableDragState, shape.id, tableData]);

  // Check if a row/col is being dragged
  const isDraggingRow =
    tableDragState?.tableId === shape.id && tableDragState?.type === "row";
  const isDraggingCol =
    tableDragState?.tableId === shape.id && tableDragState?.type === "column";

  // Get local position from event
  const getLocalPosition = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      if (!stage) return null;

      const group = e.target.findAncestor("Group");
      if (!group) return null;

      const transform = group.getAbsoluteTransform().copy().invert();
      const pos = stage.getPointerPosition();
      if (!pos) return null;

      return transform.point(pos);
    },
    [],
  );

  // Handle cell drag selection start (only when editing a cell)
  const handleCellDragStart = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isSelected || !onCellSelectionChange || !tableData) return;

      // Only start cell selection on left mouse button
      if (e.evt.button !== 0) return;
      // Only allow cell selection when already editing a cell (text input mode)
      if (!editingCell) return; // 텍스트 입력 모드가 아니면 테이블 이동

      const localPos = getLocalPosition(e);
      if (!localPos) return;

      const cellInfo = getCellAtPosition(tableData, localPos.x, localPos.y);
      if (!cellInfo) return;

      isDraggingCellRef.current = true;
      dragStartCellRef.current = { row: cellInfo.row, col: cellInfo.col };

      onCellSelectionChange({
        tableId: shape.id,
        startRow: cellInfo.row,
        startCol: cellInfo.col,
        endRow: cellInfo.row,
        endCol: cellInfo.col,
      });
    },
    [
      isSelected,
      onCellSelectionChange,
      tableData,
      shape.id,
      getLocalPosition,
      editingCell,
    ],
  );

  // Handle cell drag selection move
  const handleCellDragMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (
        !isDraggingCellRef.current ||
        !dragStartCellRef.current ||
        !onCellSelectionChange ||
        !tableData
      )
        return;

      const localPos = getLocalPosition(e);
      if (!localPos) return;

      const cellInfo = getCellAtPosition(tableData, localPos.x, localPos.y);
      if (!cellInfo) return;

      onCellSelectionChange({
        tableId: shape.id,
        startRow: dragStartCellRef.current.row,
        startCol: dragStartCellRef.current.col,
        endRow: cellInfo.row,
        endCol: cellInfo.col,
      });
    },
    [onCellSelectionChange, tableData, shape.id, getLocalPosition],
  );

  // Handle cell drag selection end
  const handleCellDragEnd = useCallback(() => {
    isDraggingCellRef.current = false;
    dragStartCellRef.current = null;
  }, []);

  // Handle single click to select cell
  const handleCellClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!onCellSelectionChange || !tableData) return;

      const localPos = getLocalPosition(e);
      if (!localPos) return;

      const cellInfo = getCellAtPosition(tableData, localPos.x, localPos.y);
      if (cellInfo) {
        onCellSelectionChange({
          tableId: shape.id,
          startRow: cellInfo.row,
          startCol: cellInfo.col,
          endRow: cellInfo.row,
          endCol: cellInfo.col,
        });
      }
    },
    [onCellSelectionChange, tableData, shape.id, getLocalPosition],
  );

  // Handle double-click on table to edit cell
  const handleDoubleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!onCellDoubleClick || !tableData) return;

      // Get click position relative to table
      const stage = e.target.getStage();
      if (!stage) return;

      const group = e.target.findAncestor("Group");
      if (!group) return;

      const transform = group.getAbsoluteTransform().copy().invert();
      const pos = stage.getPointerPosition();
      if (!pos) return;

      const localPos = transform.point(pos);

      // Find which cell was clicked
      const cellInfo = getCellAtPosition(tableData, localPos.x, localPos.y);
      if (cellInfo) {
        onCellDoubleClick(
          shape.id,
          cellInfo.cellKey,
          cellInfo.row,
          cellInfo.col,
        );
      }
    },
    [onCellDoubleClick, tableData, shape.id],
  );

  // Draw grid lines using sceneFunc for performance
  const drawGrid = useCallback(
    (ctx: Konva.Context, _shape: Konva.Shape) => {
      if (!tableData) return;

      ctx.beginPath();
      ctx.strokeStyle = tableData.borderColor;
      ctx.lineWidth = 1;

      // Draw horizontal lines
      let y = 0;
      for (let row = 0; row <= tableData.rowCount; row++) {
        ctx.moveTo(0, y);
        ctx.lineTo(tableWidth, y);
        if (row < tableData.rowCount) {
          y += tableData.rowHeights[row] ?? tableData.defaultRowHeight;
        }
      }

      // Draw vertical lines
      let x = 0;
      for (let col = 0; col <= tableData.colCount; col++) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, tableHeight);
        if (col < tableData.colCount) {
          x += tableData.colWidths[col] ?? tableData.defaultColWidth;
        }
      }

      ctx.stroke();
    },
    [tableData, tableWidth, tableHeight],
  );

  // Calculate selected cells highlight bounds
  const getSelectedCellsBounds = useCallback(() => {
    if (!selectedCells || selectedCells.tableId !== shape.id || !tableData)
      return null;

    const minRow = Math.min(selectedCells.startRow, selectedCells.endRow);
    const maxRow = Math.max(selectedCells.startRow, selectedCells.endRow);
    const minCol = Math.min(selectedCells.startCol, selectedCells.endCol);
    const maxCol = Math.max(selectedCells.startCol, selectedCells.endCol);

    const startBounds = getCellBounds(tableData, minRow, minCol);
    const endBounds = getCellBounds(tableData, maxRow, maxCol);

    return {
      x: startBounds.x,
      y: startBounds.y,
      width: endBounds.x + endBounds.width - startBounds.x,
      height: endBounds.y + endBounds.height - startBounds.y,
    };
  }, [selectedCells, shape.id, tableData]);

  const selectedBounds = getSelectedCellsBounds();

  // Combined click handler: select table + select cell
  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      onSelect(e);
      // After selecting table, also select the clicked cell
      if ("button" in e.evt) {
        handleCellClick(e as Konva.KonvaEventObject<MouseEvent>);
      }
    },
    [onSelect, handleCellClick],
  );

  if (!tableData) {
    return null;
  }

  return (
    <Group
      id={shape.id}
      x={shape.x}
      y={shape.y}
      rotation={shape.rotation}
      opacity={shape.opacity}
      draggable={draggable && !isDraggingCellRef.current}
      onClick={handleClick}
      onTap={handleClick}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDblClick={handleDoubleClick}
      onDblTap={
        handleDoubleClick as unknown as (
          e: Konva.KonvaEventObject<TouchEvent>,
        ) => void
      }
      onMouseDown={handleCellDragStart}
      onMouseMove={handleCellDragMove}
      onMouseUp={handleCellDragEnd}
      onMouseLeave={handleCellDragEnd}
    >
      {/* Multi-selection border */}
      <SelectionBorder
        width={tableWidth}
        height={tableHeight}
        zoom={zoom}
        isMultiSelected={isMultiSelected}
      />

      {/* Table background */}
      <Rect
        width={tableWidth}
        height={tableHeight}
        fill={tableData.backgroundColor ?? "#FFFFFF"}
        stroke={isLocked ? "#ef4444" : tableData.borderColor}
        strokeWidth={isLocked ? 2 : 1}
        dash={isLocked ? [8, 4] : undefined}
        perfectDrawEnabled={false}
      />

      {/* Cell backgrounds (for cells with custom colors) */}
      {Object.entries(tableData.cells).map(([key, cell]) => {
        if (!cell.backgroundColor) return null;
        const [rowStr, colStr] = key.split("-");
        const row = parseInt(rowStr!, 10);
        const col = parseInt(colStr!, 10);
        const bounds = getCellBounds(tableData, row, col);

        // Apply drag offset
        const rowOffset = getRowDragOffset(row);
        const colOffset = getColDragOffset(col);
        const isDragged =
          (isDraggingRow && tableDragState?.dragIndex === row) ||
          (isDraggingCol && tableDragState?.dragIndex === col);

        return (
          <Rect
            key={key}
            x={bounds.x + colOffset}
            y={bounds.y + rowOffset}
            width={bounds.width}
            height={bounds.height}
            fill={cell.backgroundColor}
            opacity={isDragged ? 1 : undefined}
            perfectDrawEnabled={false}
            listening={false}
          />
        );
      })}

      {/* Cell text content */}
      {Object.entries(tableData.cells).map(([key, cell]) => {
        // Skip if this cell is being edited (editor overlay handles it)
        if (editingCell?.tableId === shape.id && editingCell?.cellKey === key) {
          return null;
        }

        if (!cell.content) return null;
        if (!cellTextReadable) return null;

        const text = tiptapToPlainText(cell.content);
        if (!text) return null;

        const [rowStr, colStr] = key.split("-");
        const row = parseInt(rowStr!, 10);
        const col = parseInt(colStr!, 10);
        const bounds = getCellBounds(tableData, row, col);

        // Apply drag offset
        const rowOffset = getRowDragOffset(row);
        const colOffset = getColDragOffset(col);

        // Extract text style from Tiptap content
        const style = extractFirstTextStyle(cell.content);

        return (
          <Text
            key={`text-${key}`}
            x={bounds.x + TABLE_CELL.padding.left + colOffset}
            y={bounds.y + TABLE_CELL.padding.top + rowOffset}
            width={
              bounds.width - TABLE_CELL.padding.left - TABLE_CELL.padding.right
            }
            height={
              bounds.height - TABLE_CELL.padding.top - TABLE_CELL.padding.bottom
            }
            text={text}
            fontSize={style.fontSize ?? 14}
            fontFamily={style.fontFamily ?? "Pretendard"}
            fontStyle={style.fontStyle}
            textDecoration={style.textDecoration}
            fill={style.color ?? "#1f2937"}
            align={cell.textAlign ?? "left"}
            verticalAlign={cell.verticalAlign ?? "middle"}
            listening={false}
            perfectDrawEnabled={false}
          />
        );
      })}

      {/* Selected cells highlight */}
      {selectedBounds && (
        <Rect
          x={selectedBounds.x}
          y={selectedBounds.y}
          width={selectedBounds.width}
          height={selectedBounds.height}
          fill="rgba(13, 153, 255, 0.1)"
          stroke="#0D99FF"
          strokeWidth={2 / zoom}
          perfectDrawEnabled={false}
          listening={false}
        />
      )}

      {/* Editing cell highlight */}
      {editingCell && editingCell.tableId === shape.id && (
        <Rect
          {...getCellBounds(tableData, editingCell.row, editingCell.col)}
          fill="transparent"
          stroke="#0D99FF"
          strokeWidth={2 / zoom}
          perfectDrawEnabled={false}
          listening={false}
        />
      )}

      {/* Grid lines (drawn last to be on top) */}
      <Shape
        sceneFunc={drawGrid}
        listening={false}
        perfectDrawEnabled={false}
      />
    </Group>
  );
});
