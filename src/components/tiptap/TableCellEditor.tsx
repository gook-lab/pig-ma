import {
  useCallback,
  useEffect,
  useRef,
  useLayoutEffect,
  useState,
} from "react";
import type { CSSProperties } from "react";
import { TiptapEditor } from "./TiptapEditor";
import type { Editor, JSONContent } from "@tiptap/core";
import { createEmptyTiptapContent } from "@/utils/tiptapMigration";
import { useCanvasStore } from "@/store";
import {
  getCellBounds,
  getCell,
  getNextCellKey,
  getPrevCellKey,
  getCellBelowKey,
  getCellPosition,
  getTableWidth,
} from "@/utils/table";
import { TABLE_CELL } from "@/constants/table";
import { TextOptionsBar } from "@/components/TextOptionsBar";
import { calculateOptionsBarPosition } from "@/utils/optionsBar";
import { fontStack } from "@/constants/fonts";

export function TableCellEditor() {
  const editingTableCell = useCanvasStore((s) => s.editingTableCell);
  const objects = useCanvasStore((s) => s.objects);
  const viewport = useCanvasStore((s) => s.viewport);
  const updateTableCell = useCanvasStore((s) => s.updateTableCell);
  const setEditingTableCell = useCanvasStore((s) => s.setEditingTableCell);
  const setActiveEditor = useCanvasStore((s) => s.setActiveEditor);
  const autoFitRowHeight = useCanvasStore((s) => s.autoFitRowHeight);

  const [editor, setEditor] = useState<Editor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorContentRef = useRef<HTMLDivElement>(null);
  const justOpenedRef = useRef(true);

  // Find the table object
  const tableObject = editingTableCell
    ? objects.find((o) => o.id === editingTableCell.tableId)
    : null;

  const tableData = tableObject?.tableData;

  // Get current cell content
  const cellContent =
    tableData && editingTableCell
      ? getCell(tableData, editingTableCell.row, editingTableCell.col)?.content
      : undefined;

  const handleChange = useCallback(
    (content: JSONContent) => {
      if (!editingTableCell) return;
      updateTableCell(editingTableCell.tableId, editingTableCell.cellKey, {
        content,
      });
    },
    [editingTableCell, updateTableCell],
  );

  const handleBlur = useCallback(() => {
    // Skip blur if editor just opened
    if (justOpenedRef.current) return;

    setTimeout(() => {
      if (justOpenedRef.current) return;
      // Check if focus is still inside the container
      if (containerRef.current?.contains(document.activeElement)) {
        return;
      }
      setActiveEditor(null);
      setEditingTableCell(null);
    }, 100);
  }, [setActiveEditor, setEditingTableCell]);

  const handleEditorReady = useCallback(
    (editorInstance: Editor) => {
      setEditor(editorInstance);
      setActiveEditor(editorInstance);
      editorInstance.commands.focus("end");

      // Allow blur after short delay
      setTimeout(() => {
        justOpenedRef.current = false;
      }, 200);
    },
    [setActiveEditor],
  );

  // Reset justOpenedRef when editing cell changes
  useLayoutEffect(() => {
    if (editingTableCell) {
      justOpenedRef.current = true;
    }
  }, [editingTableCell?.cellKey]);

  // Auto-fit row height based on content
  useEffect(() => {
    if (!editingTableCell || !editorContentRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        if (height > 0) {
          autoFitRowHeight(
            editingTableCell.tableId,
            editingTableCell.row,
            editingTableCell.cellKey,
            height,
          );
        }
      }
    });

    resizeObserver.observe(editorContentRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [editingTableCell, autoFitRowHeight]);

  // Navigate to another cell
  const navigateToCell = useCallback(
    (newCellKey: string | null) => {
      if (!newCellKey || !editingTableCell) return;
      const { row, col } = getCellPosition(newCellKey);
      setEditingTableCell({
        tableId: editingTableCell.tableId,
        cellKey: newCellKey,
        row,
        col,
      });
    },
    [editingTableCell, setEditingTableCell],
  );

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editingTableCell || !tableData) return;

      if (e.key === "Escape") {
        e.preventDefault();
        setActiveEditor(null);
        setEditingTableCell(null);
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        const nextKey = e.shiftKey
          ? getPrevCellKey(
              tableData,
              editingTableCell.row,
              editingTableCell.col,
            )
          : getNextCellKey(
              tableData,
              editingTableCell.row,
              editingTableCell.col,
            );

        if (nextKey) {
          navigateToCell(nextKey);
        } else {
          // Exit editing if at first/last cell
          setActiveEditor(null);
          setEditingTableCell(null);
        }
        return;
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const belowKey = getCellBelowKey(
          tableData,
          editingTableCell.row,
          editingTableCell.col,
        );

        if (belowKey) {
          navigateToCell(belowKey);
        } else {
          // Exit editing if at last row
          setActiveEditor(null);
          setEditingTableCell(null);
        }
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    editingTableCell,
    tableData,
    setActiveEditor,
    setEditingTableCell,
    navigateToCell,
  ]);

  if (!editingTableCell || !tableObject || !tableData) return null;

  // Calculate cell position
  const cellBounds = getCellBounds(
    tableData,
    editingTableCell.row,
    editingTableCell.col,
  );

  // Transform to screen coordinates
  const cellScreenX =
    (tableObject.x + cellBounds.x) * viewport.zoom + viewport.x;
  const cellScreenY =
    (tableObject.y + cellBounds.y) * viewport.zoom + viewport.y;
  const _cellScreenWidth = cellBounds.width * viewport.zoom;
  const _cellScreenHeight = cellBounds.height * viewport.zoom;
  // Reserved for future use
  void _cellScreenWidth;
  void _cellScreenHeight;

  // Calculate TextOptionsBar position (below the cell, centered)
  const tableWidth = getTableWidth(tableData);

  const optionsBarPosition = calculateOptionsBarPosition({
    element: {
      x: tableObject.x,
      y: tableObject.y + cellBounds.y + cellBounds.height,
      width: tableWidth,
      height: 0,
    },
    viewport,
  });

  const { padding } = TABLE_CELL;
  const style: CSSProperties = {
    position: "fixed",
    left: cellScreenX,
    top: cellScreenY,
    width: cellBounds.width,
    minHeight: cellBounds.height,
    transform: `scale(${viewport.zoom})`,
    transformOrigin: "top left",
    zIndex: 100,
    padding: `${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`,
    boxSizing: "border-box",
    backgroundColor: "#FFFFFF",
    // 포커스 테두리는 border 가 아니라 outline 으로 그린다.
    // border 는 box-sizing:border-box 에서 콘텐츠 폭을 4px 줄여, 캔버스가 그리던
    // 폭과 달라진다 → 포커스 순간 텍스트가 다시 줄바꿈되고 ResizeObserver 가
    // 그 높이를 재서 autoFitRowHeight 가 행 높이를 바꿔버린다.
    // outline 은 레이아웃에 참여하지 않아 콘텐츠 폭이 캔버스와 정확히 같아진다.
    // (getCanvasCellContentBox / getEditorCellContentBox 가 이 불변식을 잠근다)
    outline: "2px solid #0D99FF",
    outlineOffset: "-2px",
    display: "flex",
    alignItems: "center",
  };

  // Create a pseudo CanvasObject for TextOptionsBar
  const pseudoObject = {
    id: editingTableCell.tableId,
    type: "table" as const,
    x: tableObject.x,
    y: tableObject.y,
    rotation: 0,
    opacity: 1,
    width: tableWidth,
  };

  return (
    <>
      {/* TextOptionsBar for table cell */}
      <TextOptionsBar
        object={pseudoObject}
        position={optionsBarPosition}
        onUpdate={() => {}}
        tiptapEditor={editor}
      />

      {/* Cell Editor */}
      <div
        ref={containerRef}
        style={style}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          editor?.commands.focus();
        }}
        onBlur={handleBlur}
      >
        <div ref={editorContentRef}>
          <TiptapEditor
            key={editingTableCell.cellKey}
            content={cellContent ?? createEmptyTiptapContent()}
            onChange={handleChange}
            onEditorReady={handleEditorReady}
            defaultFontSize={14}
            defaultFontFamily={fontStack()}
            defaultTextColor="#1f2937"
            defaultTextAlign="left"
            className="h-full w-full"
          />
        </div>
      </div>
    </>
  );
}
