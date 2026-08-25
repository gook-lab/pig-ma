import { memo, useState, useCallback, useRef } from "react";
import { Plus, GripVertical, GripHorizontal } from "lucide-react";
import { useCanvasStore } from "@/store";
import {
  getTableWidth,
  getTableHeight,
  getCellAtPosition,
} from "@/utils/table";
import type { CanvasObject } from "@/types";

interface TableAddButtonsProps {
  table: CanvasObject;
  viewport: { x: number; y: number; zoom: number };
  onContextMenu?: (e: React.MouseEvent) => void;
}

export const TableAddButtons = memo(function TableAddButtons({
  table,
  viewport,
  onContextMenu,
}: TableAddButtonsProps) {
  const addTableRow = useCanvasStore((s) => s.addTableRow);
  const addTableColumn = useCanvasStore((s) => s.addTableColumn);
  const reorderTableRow = useCanvasStore((s) => s.reorderTableRow);
  const reorderTableColumn = useCanvasStore((s) => s.reorderTableColumn);
  const resizeTableRow = useCanvasStore((s) => s.resizeTableRow);
  const resizeTableColumn = useCanvasStore((s) => s.resizeTableColumn);
  const setTableDragState = useCanvasStore((s) => s.setTableDragState);
  const setEditingTableCell = useCanvasStore((s) => s.setEditingTableCell);

  const [hoveredRowBorder, setHoveredRowBorder] = useState<number | null>(null);
  const [hoveredColBorder, setHoveredColBorder] = useState<number | null>(null);
  const [isHoveringLastRow, setIsHoveringLastRow] = useState(false);
  const [isHoveringLastCol, setIsHoveringLastCol] = useState(false);
  const [dragRowIndex, setDragRowIndex] = useState<number | null>(null);
  const [dragOverRowIndex, setDragOverRowIndex] = useState<number | null>(null);
  const [dragColIndex, setDragColIndex] = useState<number | null>(null);
  const [dragOverColIndex, setDragOverColIndex] = useState<number | null>(null);
  const [resizingRowIndex, setResizingRowIndex] = useState<number | null>(null);
  const [resizingColIndex, setResizingColIndex] = useState<number | null>(null);

  // Use refs to track drag state for event handlers
  const dragRowIndexRef = useRef<number | null>(null);
  const dragOverRowIndexRef = useRef<number | null>(null);
  const dragColIndexRef = useRef<number | null>(null);
  const dragOverColIndexRef = useRef<number | null>(null);
  const resizeStartYRef = useRef<number>(0);
  const resizeStartXRef = useRef<number>(0);
  const resizeStartHeightRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(0);

  // Context menu handler - prevent default and trigger app's context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu?.(e);
    },
    [onContextMenu],
  );

  const tableData = table.tableData;

  // 조기 반환은 훅을 모두 호출한 뒤에 한다.
  // 모든 useCallback 호출 뒤로 옮김 (아래 early returns 참조)
  const tableWidth = tableData ? getTableWidth(tableData) : 0;
  const tableHeight = tableData ? getTableHeight(tableData) : 0;

  // Calculate screen positions
  const tableScreenX = table.x * viewport.zoom + viewport.x;
  const tableScreenY = table.y * viewport.zoom + viewport.y;
  const scaledWidth = tableWidth * viewport.zoom;
  const scaledHeight = tableHeight * viewport.zoom;

  // Button size
  const buttonSize = 18;
  const handleWidth = 32;

  // Calculate row Y positions (cumulative)
  const getRowY = (rowIndex: number): number => {
    let y = 0;
    for (let i = 0; i < rowIndex; i++) {
      y += tableData!.rowHeights[i] ?? tableData!.defaultRowHeight;
    }
    return y * viewport.zoom;
  };

  // Calculate column X positions (cumulative)
  const getColX = (colIndex: number): number => {
    let x = 0;
    for (let i = 0; i < colIndex; i++) {
      x += tableData!.colWidths[i] ?? tableData!.defaultColWidth;
    }
    return x * viewport.zoom;
  };

  // Get row height
  const getRowHeight = (rowIndex: number): number => {
    return (
      (tableData!.rowHeights[rowIndex] ?? tableData!.defaultRowHeight) *
      viewport.zoom
    );
  };

  // Double-click handler - trigger cell editing
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!tableData) return;
      e.stopPropagation();
      e.preventDefault();

      // Convert screen coordinates to table-relative coordinates
      const relativeX = (e.clientX - tableScreenX) / viewport.zoom;
      const relativeY = (e.clientY - tableScreenY) / viewport.zoom;

      // Get the cell at this position
      const cellInfo = getCellAtPosition(tableData, relativeX, relativeY);
      if (cellInfo) {
        setEditingTableCell({
          tableId: table.id,
          cellKey: cellInfo.cellKey,
          row: cellInfo.row,
          col: cellInfo.col,
        });
      }
    },
    [
      tableScreenX,
      tableScreenY,
      viewport.zoom,
      tableData,
      table.id,
      setEditingTableCell,
    ],
  );

  // Row drag handlers
  const handleRowDragStart = useCallback(
    (e: React.MouseEvent, rowIndex: number) => {
      if (!tableData) return;
      e.preventDefault();
      e.stopPropagation();

      setDragRowIndex(rowIndex);
      setDragOverRowIndex(rowIndex);
      dragRowIndexRef.current = rowIndex;
      dragOverRowIndexRef.current = rowIndex;

      // Update store for Table component to render drag state
      setTableDragState({
        tableId: table.id,
        type: "row",
        dragIndex: rowIndex,
        dragOverIndex: rowIndex,
      });

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const currentDragRow = dragRowIndexRef.current;
        if (currentDragRow === null) return;

        const relativeY = moveEvent.clientY - tableScreenY;
        let accY = 0;
        let targetRow = 0;

        for (let i = 0; i < tableData.rowCount; i++) {
          const rowHeight =
            (tableData.rowHeights[i] ?? tableData.defaultRowHeight) *
            viewport.zoom;
          if (relativeY < accY + rowHeight / 2) {
            targetRow = i;
            break;
          }
          accY += rowHeight;
          targetRow = i;
        }

        targetRow = Math.max(0, Math.min(tableData.rowCount - 1, targetRow));
        dragOverRowIndexRef.current = targetRow;
        setDragOverRowIndex(targetRow);

        // Update store
        setTableDragState({
          tableId: table.id,
          type: "row",
          dragIndex: currentDragRow,
          dragOverIndex: targetRow,
        });
      };

      const handleMouseUp = () => {
        const fromRow = dragRowIndexRef.current;
        const toRow = dragOverRowIndexRef.current;

        if (fromRow !== null && toRow !== null && fromRow !== toRow) {
          reorderTableRow(table.id, fromRow, toRow);
        }

        setDragRowIndex(null);
        setDragOverRowIndex(null);
        dragRowIndexRef.current = null;
        dragOverRowIndexRef.current = null;
        setTableDragState(null);

        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [
      table.id,
      tableData,
      tableScreenY,
      viewport.zoom,
      reorderTableRow,
      setTableDragState,
    ],
  );

  // Column drag handlers
  const handleColDragStart = useCallback(
    (e: React.MouseEvent, colIndex: number) => {
      if (!tableData) return;
      e.preventDefault();
      e.stopPropagation();

      setDragColIndex(colIndex);
      setDragOverColIndex(colIndex);
      dragColIndexRef.current = colIndex;
      dragOverColIndexRef.current = colIndex;

      // Update store for Table component to render drag state
      setTableDragState({
        tableId: table.id,
        type: "column",
        dragIndex: colIndex,
        dragOverIndex: colIndex,
      });

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const currentDragCol = dragColIndexRef.current;
        if (currentDragCol === null) return;

        const relativeX = moveEvent.clientX - tableScreenX;
        let accX = 0;
        let targetCol = 0;

        for (let i = 0; i < tableData.colCount; i++) {
          const colWidth =
            (tableData.colWidths[i] ?? tableData.defaultColWidth) *
            viewport.zoom;
          if (relativeX < accX + colWidth / 2) {
            targetCol = i;
            break;
          }
          accX += colWidth;
          targetCol = i;
        }

        targetCol = Math.max(0, Math.min(tableData.colCount - 1, targetCol));
        dragOverColIndexRef.current = targetCol;
        setDragOverColIndex(targetCol);

        // Update store
        setTableDragState({
          tableId: table.id,
          type: "column",
          dragIndex: currentDragCol,
          dragOverIndex: targetCol,
        });
      };

      const handleMouseUp = () => {
        const fromCol = dragColIndexRef.current;
        const toCol = dragOverColIndexRef.current;

        if (fromCol !== null && toCol !== null && fromCol !== toCol) {
          reorderTableColumn(table.id, fromCol, toCol);
        }

        setDragColIndex(null);
        setDragOverColIndex(null);
        dragColIndexRef.current = null;
        dragOverColIndexRef.current = null;
        setTableDragState(null);

        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [
      table.id,
      tableData,
      tableScreenX,
      viewport.zoom,
      reorderTableColumn,
      setTableDragState,
    ],
  );

  // Calculate visual offset for rows during drag (swap effect - only target row moves)
  const getRowDragOffset = (rowIndex: number): number => {
    if (dragRowIndex === null || dragOverRowIndex === null) return 0;
    if (dragRowIndex === dragOverRowIndex) return 0;

    // Only the target row swaps position with the dragged row
    if (rowIndex === dragOverRowIndex) {
      const draggedRowY = getRowY(dragRowIndex);
      const targetRowY = getRowY(dragOverRowIndex);
      return draggedRowY - targetRowY;
    }
    return 0;
  };

  // Get column width
  const getColWidth = (colIndex: number): number => {
    return (
      (tableData!.colWidths[colIndex] ?? tableData!.defaultColWidth) *
      viewport.zoom
    );
  };

  // Calculate visual offset for columns during drag (swap effect - only target column moves)
  const getColDragOffset = (colIndex: number): number => {
    if (dragColIndex === null || dragOverColIndex === null) return 0;
    if (dragColIndex === dragOverColIndex) return 0;

    // Only the target column swaps position with the dragged column
    if (colIndex === dragOverColIndex) {
      const draggedColX = getColX(dragColIndex);
      const targetColX = getColX(dragOverColIndex);
      return draggedColX - targetColX;
    }
    return 0;
  };

  const handleHeight = 32;

  // Row resize handler (drag row border to resize)
  const handleRowResizeStart = useCallback(
    (e: React.MouseEvent, rowIndex: number) => {
      if (!tableData) return;
      e.preventDefault();
      e.stopPropagation();

      setResizingRowIndex(rowIndex);
      resizeStartYRef.current = e.clientY;
      resizeStartHeightRef.current =
        tableData.rowHeights[rowIndex] ?? tableData.defaultRowHeight;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaY =
          (moveEvent.clientY - resizeStartYRef.current) / viewport.zoom;
        const newHeight = resizeStartHeightRef.current + deltaY;
        resizeTableRow(table.id, rowIndex, newHeight);
      };

      const handleMouseUp = () => {
        setResizingRowIndex(null);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [table.id, tableData, viewport.zoom, resizeTableRow],
  );

  // Column resize handler (drag column border to resize)
  const handleColResizeStart = useCallback(
    (e: React.MouseEvent, colIndex: number) => {
      if (!tableData) return;
      e.preventDefault();
      e.stopPropagation();

      setResizingColIndex(colIndex);
      resizeStartXRef.current = e.clientX;
      resizeStartWidthRef.current =
        tableData.colWidths[colIndex] ?? tableData.defaultColWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX =
          (moveEvent.clientX - resizeStartXRef.current) / viewport.zoom;
        const newWidth = resizeStartWidthRef.current + deltaX;
        resizeTableColumn(table.id, colIndex, newWidth);
      };

      const handleMouseUp = () => {
        setResizingColIndex(null);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [table.id, tableData, viewport.zoom, resizeTableColumn],
  );

  // 조기 반환: 훅을 모두 호출한 뒤에 한다
  if (!tableData) return null;
  if (table.locked === true) return null;

  return (
    <div>
      {/* Empty placeholder at original drag position */}
      {dragColIndex !== null &&
        dragOverColIndex !== null &&
        dragColIndex !== dragOverColIndex && (
          <div
            className="pointer-events-none absolute"
            style={{
              left: tableScreenX + getColX(dragColIndex),
              top: tableScreenY,
              width: getColWidth(dragColIndex),
              height: scaledHeight,
              zIndex: 62,
              backgroundColor: "rgba(148, 163, 184, 0.15)",
              borderRadius: 4,
            }}
          />
        )}

      {/* Dragged column border (shows border and shadow only - cells move in Konva) */}
      {dragColIndex !== null && dragOverColIndex !== null && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: tableScreenX + getColX(dragColIndex) - 4,
            top: tableScreenY - 4,
            width: getColWidth(dragColIndex) + 8,
            height: scaledHeight + 8,
            zIndex: 70,
            border: "2px solid #3b82f6",
            borderRadius: 8,
            boxShadow:
              "0 12px 24px rgba(59, 130, 246, 0.25), 0 4px 8px rgba(0, 0, 0, 0.1)",
            transform: `translateX(${getColX(dragOverColIndex) - getColX(dragColIndex)}px)`,
            transition: "transform 200ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      )}

      {/* Column drag handles (top side) */}
      {tableData &&
        Array.from({ length: tableData.colCount }).map((_, colIndex) => {
          const colX = getColX(colIndex);
          const colWidth = getColWidth(colIndex);
          const isDragging = dragColIndex === colIndex;
          const isTarget =
            dragOverColIndex === colIndex && dragColIndex !== dragOverColIndex;
          const offset = getColDragOffset(colIndex);

          // Calculate where the dragged handle should move to
          const draggedOffset =
            isDragging && dragOverColIndex !== null
              ? getColX(dragOverColIndex) - getColX(dragColIndex)
              : 0;

          return (
            <div
              key={`col-handle-${colIndex}`}
              className={`absolute flex items-center justify-center ${
                isDragging
                  ? "opacity-100"
                  : isTarget
                    ? "opacity-100"
                    : "opacity-0 hover:opacity-100"
              }`}
              style={{
                left: tableScreenX + colX,
                top: tableScreenY - handleHeight - 4,
                width: colWidth,
                height: handleHeight,
                zIndex: isDragging ? 71 : isTarget ? 66 : 61,
                backgroundColor: isDragging
                  ? "rgba(59, 130, 246, 0.3)"
                  : isTarget
                    ? "rgba(99, 102, 241, 0.2)"
                    : "transparent",
                borderRadius: 4,
                transform: isDragging
                  ? `translateX(${draggedOffset}px)`
                  : `translateX(${offset}px)`,
                transition: isDragging
                  ? "none"
                  : "transform 200ms cubic-bezier(0.4, 0, 0.2, 1), opacity 150ms",
                cursor: isDragging ? "grabbing" : "grab",
              }}
              onMouseDown={(e) => handleColDragStart(e, colIndex)}
              onContextMenu={handleContextMenu}
            >
              <GripHorizontal
                className={`h-5 w-5 ${isDragging ? "text-blue-600" : isTarget ? "text-indigo-500" : "text-gray-500"}`}
              />
            </div>
          );
        })}

      {/* Column drop indicator line - removed for swap effect */}

      {/* Empty placeholder at original drag position (gray empty space) */}
      {dragRowIndex !== null &&
        dragOverRowIndex !== null &&
        dragRowIndex !== dragOverRowIndex && (
          <div
            className="pointer-events-none absolute"
            style={{
              left: tableScreenX,
              top: tableScreenY + getRowY(dragRowIndex),
              width: scaledWidth,
              height: getRowHeight(dragRowIndex),
              zIndex: 75,
              backgroundColor: "rgba(226, 232, 240, 0.8)",
              borderRadius: 2,
            }}
          />
        )}

      {/* Dragged row border (shows border and shadow only - cells move in Konva) */}
      {dragRowIndex !== null && dragOverRowIndex !== null && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: tableScreenX - 4,
            top: tableScreenY + getRowY(dragRowIndex) - 4,
            width: scaledWidth + 8,
            height: getRowHeight(dragRowIndex) + 8,
            zIndex: 70,
            border: "2px solid #3b82f6",
            borderRadius: 8,
            boxShadow:
              "0 12px 24px rgba(59, 130, 246, 0.25), 0 4px 8px rgba(0, 0, 0, 0.1)",
            transform: `translateY(${getRowY(dragOverRowIndex) - getRowY(dragRowIndex)}px)`,
            transition: "transform 200ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      )}

      {/* Row drag handles (left side) */}
      {tableData &&
        Array.from({ length: tableData.rowCount }).map((_, rowIndex) => {
          const rowY = getRowY(rowIndex);
          const rowHeight = getRowHeight(rowIndex);
          const isDragging = dragRowIndex === rowIndex;
          const isTarget =
            dragOverRowIndex === rowIndex && dragRowIndex !== dragOverRowIndex;
          const offset = getRowDragOffset(rowIndex);

          // Calculate where the dragged handle should move to
          const draggedOffset =
            isDragging && dragOverRowIndex !== null
              ? getRowY(dragOverRowIndex) - getRowY(dragRowIndex)
              : 0;

          return (
            <div
              key={`row-handle-${rowIndex}`}
              className={`absolute flex items-center justify-center ${
                isDragging
                  ? "opacity-100"
                  : isTarget
                    ? "opacity-100"
                    : "opacity-0 hover:opacity-100"
              }`}
              style={{
                left: tableScreenX - handleWidth - 4,
                top: tableScreenY + rowY,
                width: handleWidth,
                height: rowHeight,
                zIndex: isDragging ? 71 : isTarget ? 66 : 61,
                backgroundColor: isDragging
                  ? "rgba(59, 130, 246, 0.3)"
                  : isTarget
                    ? "rgba(99, 102, 241, 0.2)"
                    : "transparent",
                borderRadius: 4,
                transform: isDragging
                  ? `translateY(${draggedOffset}px)`
                  : `translateY(${offset}px)`,
                transition: isDragging
                  ? "none"
                  : "transform 200ms cubic-bezier(0.4, 0, 0.2, 1), opacity 150ms",
                cursor: isDragging ? "grabbing" : "grab",
              }}
              onMouseDown={(e) => handleRowDragStart(e, rowIndex)}
              onContextMenu={handleContextMenu}
            >
              <GripVertical
                className={`h-5 w-5 ${isDragging ? "text-blue-600" : isTarget ? "text-indigo-500" : "text-gray-500"}`}
              />
            </div>
          );
        })}

      {/* Drop indicator line removed - swap effect shows elements exchanging positions */}

      {/* Row resize handles (horizontal borders between rows) */}
      {tableData &&
        Array.from({ length: tableData.rowCount - 1 }).map((_, index) => {
          const borderY = getRowY(index + 1);
          const isResizing = resizingRowIndex === index;

          return (
            <div
              key={`row-resize-${index}`}
              className={`absolute cursor-row-resize ${
                isResizing ? "bg-blue-400" : "hover:bg-blue-300"
              }`}
              style={{
                left: tableScreenX,
                top: tableScreenY + borderY - 3,
                width: scaledWidth,
                height: 6,
                zIndex: 68,
                opacity: isResizing ? 1 : 0,
                transition: "opacity 150ms",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) => {
                if (!isResizing) e.currentTarget.style.opacity = "0";
              }}
              onMouseDown={(e) => handleRowResizeStart(e, index)}
              onContextMenu={handleContextMenu}
            />
          );
        })}

      {/* Column resize handles (vertical borders between columns) */}
      {tableData &&
        Array.from({ length: tableData.colCount - 1 }).map((_, index) => {
          const borderX = getColX(index + 1);
          const isResizing = resizingColIndex === index;

          return (
            <div
              key={`col-resize-${index}`}
              className={`absolute cursor-col-resize ${
                isResizing ? "bg-blue-400" : "hover:bg-blue-300"
              }`}
              style={{
                left: tableScreenX + borderX - 3,
                top: tableScreenY,
                width: 6,
                height: scaledHeight,
                zIndex: 68,
                opacity: isResizing ? 1 : 0,
                transition: "opacity 150ms",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) => {
                if (!isResizing) e.currentTarget.style.opacity = "0";
              }}
              onMouseDown={(e) => handleColResizeStart(e, index)}
              onContextMenu={handleContextMenu}
            />
          );
        })}

      {/* Row border insert buttons (between rows - on the LEFT side) */}
      {tableData &&
        Array.from({ length: tableData.rowCount - 1 }).map((_, index) => {
          const borderY = getRowY(index + 1);
          const isHovered = hoveredRowBorder === index;

          return (
            <div
              key={`row-border-${index}`}
              className="absolute"
              style={{
                left: tableScreenX - 30,
                top: tableScreenY + borderY - 15,
                width: 30,
                height: 30,
                zIndex: 63,
                cursor: "none",
              }}
              onMouseEnter={() => setHoveredRowBorder(index)}
              onMouseLeave={() => setHoveredRowBorder(null)}
              onContextMenu={handleContextMenu}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addTableRow(table.id, index);
                }}
                onContextMenu={handleContextMenu}
                className={`absolute flex items-center justify-center rounded-full bg-blue-500 text-white shadow-md transition-all hover:bg-blue-600 ${
                  isHovered ? "scale-100 opacity-100" : "scale-50 opacity-0"
                }`}
                style={{
                  left: 6,
                  top: 6,
                  width: buttonSize,
                  height: buttonSize,
                  cursor: "pointer",
                }}
                title="행 삽입"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          );
        })}

      {/* Column border insert buttons (between columns - on the TOP) */}
      {tableData &&
        Array.from({ length: tableData.colCount - 1 }).map((_, index) => {
          const borderX = getColX(index + 1);
          const isHovered = hoveredColBorder === index;

          return (
            <div
              key={`col-border-${index}`}
              className="absolute"
              style={{
                left: tableScreenX + borderX - 15,
                top: tableScreenY - 30,
                width: 30,
                height: 30,
                zIndex: 63,
                cursor: "none",
              }}
              onMouseEnter={() => setHoveredColBorder(index)}
              onMouseLeave={() => setHoveredColBorder(null)}
              onContextMenu={handleContextMenu}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addTableColumn(table.id, index);
                }}
                onContextMenu={handleContextMenu}
                className={`absolute flex items-center justify-center rounded-full bg-blue-500 text-white shadow-md transition-all hover:bg-blue-600 ${
                  isHovered ? "scale-100 opacity-100" : "scale-50 opacity-0"
                }`}
                style={{
                  left: 6,
                  top: 6,
                  width: buttonSize,
                  height: buttonSize,
                  cursor: "pointer",
                }}
                title="열 삽입"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          );
        })}

      {/* Last column hover zone - right half of last column cells + outside area */}
      {/* Right half of last column (excluding corner row) */}
      <div
        className="absolute"
        style={{
          left:
            tableScreenX +
            getColX(tableData!.colCount - 1) +
            getColWidth(tableData!.colCount - 1) / 2,
          top: tableScreenY,
          width: getColWidth(tableData!.colCount - 1) / 2,
          height: scaledHeight - getRowHeight(tableData!.rowCount - 1),
          zIndex: 59,
        }}
        onMouseEnter={() => setIsHoveringLastCol(true)}
        onMouseLeave={() => setIsHoveringLastCol(false)}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      />
      {/* Outside area (right of table) */}
      <div
        className="absolute"
        style={{
          left: tableScreenX + scaledWidth,
          top: tableScreenY,
          width: 50,
          height: scaledHeight,
          zIndex: 59,
        }}
        onMouseEnter={() => setIsHoveringLastCol(true)}
        onMouseLeave={() => setIsHoveringLastCol(false)}
        onContextMenu={handleContextMenu}
      />

      {/* Last row hover zone - bottom half of last row cells + outside area */}
      {/* Bottom half of last row (excluding corner column) */}
      <div
        className="absolute"
        style={{
          left: tableScreenX,
          top:
            tableScreenY +
            getRowY(tableData!.rowCount - 1) +
            getRowHeight(tableData!.rowCount - 1) / 2,
          width: scaledWidth - getColWidth(tableData!.colCount - 1),
          height: getRowHeight(tableData!.rowCount - 1) / 2,
          zIndex: 59,
        }}
        onMouseEnter={() => setIsHoveringLastRow(true)}
        onMouseLeave={() => setIsHoveringLastRow(false)}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      />
      {/* Outside area (below table) */}
      <div
        className="absolute"
        style={{
          left: tableScreenX,
          top: tableScreenY + scaledHeight,
          width: scaledWidth,
          height: 50,
          zIndex: 59,
        }}
        onMouseEnter={() => setIsHoveringLastRow(true)}
        onMouseLeave={() => setIsHoveringLastRow(false)}
        onContextMenu={handleContextMenu}
      />

      {/* Corner cell hover zone - bottom-right area (shows both buttons) */}
      {/* Right half of corner cell's bottom half */}
      <div
        className="absolute"
        style={{
          left:
            tableScreenX +
            getColX(tableData!.colCount - 1) +
            getColWidth(tableData!.colCount - 1) / 2,
          top:
            tableScreenY +
            getRowY(tableData!.rowCount - 1) +
            getRowHeight(tableData!.rowCount - 1) / 2,
          width: getColWidth(tableData!.colCount - 1) / 2 - 12,
          height: getRowHeight(tableData!.rowCount - 1) / 2,
          zIndex: 59,
        }}
        onMouseEnter={() => {
          setIsHoveringLastCol(true);
          setIsHoveringLastRow(true);
        }}
        onMouseLeave={() => {
          setIsHoveringLastCol(false);
          setIsHoveringLastRow(false);
        }}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      />
      {/* Bottom half of corner cell's left half (row button only) */}
      <div
        className="absolute"
        style={{
          left: tableScreenX + getColX(tableData!.colCount - 1),
          top:
            tableScreenY +
            getRowY(tableData!.rowCount - 1) +
            getRowHeight(tableData!.rowCount - 1) / 2,
          width: getColWidth(tableData!.colCount - 1) / 2,
          height: getRowHeight(tableData!.rowCount - 1) / 2,
          zIndex: 59,
        }}
        onMouseEnter={() => setIsHoveringLastRow(true)}
        onMouseLeave={() => setIsHoveringLastRow(false)}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      />
      {/* Right half of corner cell's top half (column button only) */}
      <div
        className="absolute"
        style={{
          left:
            tableScreenX +
            getColX(tableData!.colCount - 1) +
            getColWidth(tableData!.colCount - 1) / 2,
          top: tableScreenY + getRowY(tableData!.rowCount - 1),
          width: getColWidth(tableData!.colCount - 1) / 2,
          height: getRowHeight(tableData!.rowCount - 1) / 2,
          zIndex: 59,
        }}
        onMouseEnter={() => setIsHoveringLastCol(true)}
        onMouseLeave={() => setIsHoveringLastCol(false)}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      />
      {/* Corner outside area (bottom-right of table) */}
      <div
        className="absolute"
        style={{
          left: tableScreenX + scaledWidth,
          top: tableScreenY + scaledHeight,
          width: 50,
          height: 50,
          zIndex: 59,
        }}
        onMouseEnter={() => {
          setIsHoveringLastCol(true);
          setIsHoveringLastRow(true);
        }}
        onMouseLeave={() => {
          setIsHoveringLastCol(false);
          setIsHoveringLastRow(false);
        }}
        onContextMenu={handleContextMenu}
      />

      {/* Add Column bar (right edge - full height) - shows on last column hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          addTableColumn(table.id);
        }}
        onMouseEnter={() => setIsHoveringLastCol(true)}
        onMouseLeave={() => setIsHoveringLastCol(false)}
        onContextMenu={handleContextMenu}
        className={`absolute flex items-center justify-center bg-blue-500 text-white shadow-md transition-all hover:bg-blue-600 ${
          isHoveringLastCol ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        style={{
          left: tableScreenX + scaledWidth + 16,
          top: tableScreenY,
          width: 28,
          height: scaledHeight,
          zIndex: 60,
          borderRadius: 8,
          cursor: "pointer",
        }}
        title="열 추가"
      >
        <Plus className="h-5 w-5" />
      </button>

      {/* Add Row bar (bottom edge - full width) - shows on last row hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          addTableRow(table.id);
        }}
        onMouseEnter={() => setIsHoveringLastRow(true)}
        onMouseLeave={() => setIsHoveringLastRow(false)}
        onContextMenu={handleContextMenu}
        className={`absolute flex items-center justify-center bg-blue-500 text-white shadow-md transition-all hover:bg-blue-600 ${
          isHoveringLastRow ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        style={{
          left: tableScreenX,
          top: tableScreenY + scaledHeight + 16,
          width: scaledWidth,
          height: 28,
          zIndex: 60,
          borderRadius: 8,
          cursor: "pointer",
        }}
        title="행 추가"
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
});
