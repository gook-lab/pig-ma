import { memo, useCallback } from "react";
import type Konva from "konva";
import type { CanvasObject } from "@/types";
import type { ConnectorSnapPoint, Point } from "@/utils/geometry";
import { useCanvasStore } from "@/store";
import { dragCoordinator } from "@/hooks/useDragCoordinator";
import { translateElbowBends } from "@/utils/translateElbowBends";
import { getAnchorPoint, calculateAlignmentGuides } from "@/utils/geometry";
import { CanvasImage } from "./shapes/CanvasImage";
import { Line } from "./shapes/Line";
import { StickyNote } from "./shapes/StickyNote";
import { TextBox } from "./shapes/TextBox";
import { ConnectorShapeRenderer } from "./ConnectorShapeRenderer";
import { Shape as VariantShape } from "./shapes/Shape";
import { Table } from "./shapes/Table";
import { Chart } from "./shapes/Chart";
import { CodeBlock } from "./shapes/CodeBlock";
import { Embed } from "./shapes/Embed";

interface ShapeRendererProps {
  obj: CanvasObject;
  renderMode: "simplified" | "full";
  isSelected: boolean;
  isMultiSelected: boolean;
  isObjectLocked: boolean;
  /** When true, skip individual SelectionBorder (batch rendered at Canvas level) */
  skipSelectionBorder?: boolean;
}

/**
 * ShapeRenderer - Pure React wrapper for Shape components.
 * Returns the Shape component directly (NO Konva <Group> wrapper).
 * Uses memo() with shallow comparison - unchanged objects keep same reference.
 * All event handlers access state via useCanvasStore.getState() for reference stability.
 */
export const ShapeRenderer = memo(function ShapeRenderer({
  obj,
  renderMode,
  isSelected,
  isMultiSelected: isMultiSelectedProp,
  isObjectLocked,
  skipSelectionBorder = false,
}: ShapeRendererProps) {
  // When batch rendering selection borders at Canvas level, suppress individual borders
  const isMultiSelected = skipSelectionBorder ? false : isMultiSelectedProp;
  // Fine-grained store subscriptions for render-time reactive state
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  const tool = useCanvasStore((s) => s.tool);
  const isLocked = useCanvasStore((s) => s.isLocked);
  const editingTextId = useCanvasStore((s) => s.editingTextId);
  // 타입별로 무관한 상태는 상수 null 로 좁힌다 — 전부 구독하면 테이블 셀
  // 선택을 드래그하는 동안 캔버스의 모든 도형이 리렌더된다.
  const editingChartTitleId = useCanvasStore((s) =>
    obj.type === "chart" ? s.editingChartTitleId : null,
  );
  const editingTableCell = useCanvasStore((s) =>
    obj.type === "table" ? s.editingTableCell : null,
  );
  const selectedTableCells = useCanvasStore((s) =>
    obj.type === "table" ? s.selectedTableCells : null,
  );

  // === Stable event handlers using getState() ===

  const handleSelect = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      const state = useCanvasStore.getState();
      if (state.isLocked) return;

      // Right-click handled by handleContextMenu
      if ("button" in e.evt && e.evt.button === 2) return;

      // Don't select with certain tools
      if (
        state.tool === "pencil" ||
        state.tool === "eraser" ||
        state.tool === "connector" ||
        state.tool === "hand"
      )
        return;

      // Don't select with creation tools
      if (
        state.tool === "rectangle" ||
        state.tool === "stickyNote" ||
        state.tool === "textBox" ||
        state.tool === "shape"
      )
        return;

      const targetObj = state.objects.find((o) => o.id === obj.id);
      if (!targetObj) return;

      // Locked group check
      if (targetObj.groupId) {
        const group = state.groups.find((g) => g.id === targetObj.groupId);
        if (group?.locked) return;
      }

      // Clear editing state if selecting different object
      if (state.editingTextId && state.editingTextId !== obj.id) {
        state.setFileDialogOpen(false);
        state.setEditingTextId(null);
      }

      // Clear table cell selection when selecting a different object
      if (
        state.selectedTableCells &&
        state.selectedTableCells.tableId !== obj.id
      ) {
        state.setSelectedTableCells(null);
      }

      // Multi-select with modifier keys
      const shiftKey = "shiftKey" in e.evt && e.evt.shiftKey;
      const cmdKey = "metaKey" in e.evt && (e.evt.metaKey || e.evt.ctrlKey);
      const isMultiSelectModifier = shiftKey || cmdKey;

      if (isMultiSelectModifier) {
        state.addToSelection(obj.id);
      } else {
        state.setSelectedIds([obj.id]);
      }
    },
    [obj.id],
  );

  const handleDoubleClick = useCallback(() => {
    const state = useCanvasStore.getState();
    if (state.tool === "pencil" || state.tool === "eraser") return;
    const targetObj = state.objects.find((o) => o.id === obj.id);
    if (targetObj?.locked) return;
    state.setEditingTextId(obj.id);
  }, [obj.id]);

  const handleTextClick = useCallback(() => {
    useCanvasStore.getState().setEditingTextId(obj.id);
  }, [obj.id]);

  const handleUpdate = useCallback(
    (updates: Partial<CanvasObject>) => {
      useCanvasStore.getState().updateObject(obj.id, updates);
    },
    [obj.id],
  );

  const handleCellDoubleClick = useCallback(
    (tableId: string, cellKey: string, row: number, col: number) => {
      if (!isObjectLocked) {
        useCanvasStore
          .getState()
          .setEditingTableCell({ tableId, cellKey, row, col });
      }
    },
    [isObjectLocked],
  );

  const handleCellSelectionChange = useCallback(
    (selection: import("@/types").TableCellSelection | null) => {
      useCanvasStore.getState().setSelectedTableCells(selection);
    },
    [],
  );

  const handleChartHeaderDoubleClick = useCallback(() => {
    if (!isObjectLocked) {
      window.dispatchEvent(
        new CustomEvent("chart-edit-title", {
          detail: { id: obj.id },
        }),
      );
    }
  }, [obj.id, isObjectLocked]);

  // 차트 본문 더블클릭 = 제목 편집 (헤더 더블클릭과 동일한 문법 —
  // 스티키노트 더블클릭이 텍스트 편집인 것과 맞춘다). 헤더가 숨겨져
  // 있으면 제목 입력 오버레이가 앉을 자리가 없으므로 무시한다.
  const handleChartDoubleClick = useCallback(() => {
    if (!isObjectLocked && obj.chartShowHeader !== false) {
      window.dispatchEvent(
        new CustomEvent("chart-edit-title", {
          detail: { id: obj.id },
        }),
      );
    }
  }, [obj.id, obj.chartShowHeader, isObjectLocked]);

  const handleCodeBlockDoubleClick = useCallback(() => {
    if (!isObjectLocked) {
      useCanvasStore.getState().setEditingTextId(obj.id);
    }
  }, [obj.id, isObjectLocked]);

  const handleCodeBlockHeaderDoubleClick = useCallback(() => {
    if (!isObjectLocked) {
      window.dispatchEvent(
        new CustomEvent("codeblock-edit-title", {
          detail: { id: obj.id },
        }),
      );
    }
  }, [obj.id, isObjectLocked]);

  const handleEmbedDoubleClick = useCallback(() => {
    if (!isObjectLocked) {
      useCanvasStore.getState().updateObject(obj.id, {
        isPlaying: !obj.isPlaying,
      });
    }
  }, [obj.id, obj.isPlaying, isObjectLocked]);

  // --- Simplified mode callbacks (stable) ---

  const simplifiedDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      dragCoordinator.setPosition(obj.id, e.target.x(), e.target.y());
    },
    [obj.id],
  );

  const simplifiedDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      dragCoordinator.clear(obj.id);
      useCanvasStore.getState().updateObject(obj.id, {
        x: e.target.x(),
        y: e.target.y(),
      });
    },
    [obj.id],
  );

  // --- Simple drag callbacks (for line/table/chart/codeBlock/embed in full mode) ---
  // These types don't use alignment guides or group siblings movement

  const simpleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      dragCoordinator.setPosition(obj.id, e.target.x(), e.target.y());
    },
    [obj.id],
  );

  const simpleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      dragCoordinator.clear(obj.id);
      useCanvasStore.getState().updateObject(obj.id, {
        x: e.target.x(),
        y: e.target.y(),
      });
    },
    [obj.id],
  );

  const draggingSimpleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const state = useCanvasStore.getState();
      state.removeDraggingIds([obj.id]);
      dragCoordinator.clear(obj.id);
      state.updateObject(obj.id, {
        x: e.target.x(),
        y: e.target.y(),
      });
    },
    [obj.id],
  );

  // --- Full mode commonProps callbacks (for stickyNote/textBox/shape/image) ---

  const fullDragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (isObjectLocked) {
        e.target.stopDrag();
        return;
      }
      const state = useCanvasStore.getState();
      if (state.tool === "hand") return;

      state.addDraggingIds([obj.id]);

      const shiftKey = e.evt.shiftKey;
      const cmdKey = e.evt.metaKey || e.evt.ctrlKey;
      const selectedIdsSet = new Set(state.selectedIds);

      // Cmd/Ctrl: individual element drag (ignore group)
      if (cmdKey) {
        if (!selectedIdsSet.has(obj.id)) {
          if (shiftKey) {
            state.addToSelection(obj.id);
          } else {
            state.setSelectedIds([obj.id]);
          }
        }
        return;
      }

      if (shiftKey) {
        if (!selectedIdsSet.has(obj.id)) {
          state.addToSelection(obj.id);
        }
      } else {
        // Select only this element when dragging individually
        state.setSelectedIds([obj.id]);
      }
    },
    [obj.id, isObjectLocked],
  );

  const fullDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const state = useCanvasStore.getState();
      let currentX = e.target.x();
      let currentY = e.target.y();

      // Alignment guide + connector snap calculation
      const draggedBounds = {
        x: currentX,
        y: currentY,
        width: obj.width ?? 100,
        height: obj.height ?? 100,
      };

      // Connector snap points
      const connectorSnapPoints: ConnectorSnapPoint[] = [];
      state.objects.forEach((connector) => {
        if (connector.type !== "connector") return;

        // Dragged shape is source
        if (connector.sourceId === obj.id && connector.targetId) {
          const tObj = state.objects.find((o) => o.id === connector.targetId);
          if (tObj) {
            const tempObj = { ...obj, x: currentX, y: currentY };
            let draggedAnchor: Point;
            if (
              connector.sourceOffsetX !== undefined &&
              connector.sourceOffsetY !== undefined
            ) {
              draggedAnchor = {
                x: currentX + connector.sourceOffsetX,
                y: currentY + connector.sourceOffsetY,
              };
            } else if (connector.sourceAnchor) {
              draggedAnchor = getAnchorPoint(tempObj, connector.sourceAnchor);
            } else {
              return;
            }

            let targetAnchorPoint: Point;
            if (
              connector.targetOffsetX !== undefined &&
              connector.targetOffsetY !== undefined
            ) {
              targetAnchorPoint = {
                x: tObj.x + connector.targetOffsetX,
                y: tObj.y + connector.targetOffsetY,
              };
            } else if (connector.targetAnchor) {
              targetAnchorPoint = getAnchorPoint(tObj, connector.targetAnchor);
            } else {
              return;
            }

            connectorSnapPoints.push({
              draggedAnchorX: draggedAnchor.x,
              draggedAnchorY: draggedAnchor.y,
              targetX: targetAnchorPoint.x,
              targetY: targetAnchorPoint.y,
            });
          }
        }

        // Dragged shape is target
        if (connector.targetId === obj.id && connector.sourceId) {
          const sObj = state.objects.find((o) => o.id === connector.sourceId);
          if (sObj) {
            const tempObj = { ...obj, x: currentX, y: currentY };
            let draggedAnchor: Point;
            if (
              connector.targetOffsetX !== undefined &&
              connector.targetOffsetY !== undefined
            ) {
              draggedAnchor = {
                x: currentX + connector.targetOffsetX,
                y: currentY + connector.targetOffsetY,
              };
            } else if (connector.targetAnchor) {
              draggedAnchor = getAnchorPoint(tempObj, connector.targetAnchor);
            } else {
              return;
            }

            let sourceAnchorPoint: Point;
            if (
              connector.sourceOffsetX !== undefined &&
              connector.sourceOffsetY !== undefined
            ) {
              sourceAnchorPoint = {
                x: sObj.x + connector.sourceOffsetX,
                y: sObj.y + connector.sourceOffsetY,
              };
            } else if (connector.sourceAnchor) {
              sourceAnchorPoint = getAnchorPoint(sObj, connector.sourceAnchor);
            } else {
              return;
            }

            connectorSnapPoints.push({
              draggedAnchorX: draggedAnchor.x,
              draggedAnchorY: draggedAnchor.y,
              targetX: sourceAnchorPoint.x,
              targetY: sourceAnchorPoint.y,
            });
          }
        }
      });

      const { guides, snappedX, snappedY } = calculateAlignmentGuides(
        draggedBounds,
        state.objects,
        [obj.id, ...state.selectedIds],
        undefined,
        undefined,
        connectorSnapPoints,
      );

      if (snappedX !== undefined) {
        currentX = snappedX;
        e.target.x(snappedX);
      }

      if (snappedY !== undefined) {
        currentY = snappedY;
        e.target.y(snappedY);
      }

      // Update alignment guides via custom event (setAlignmentGuides is Canvas local state)
      window.dispatchEvent(
        new CustomEvent("alignment-guides-update", {
          detail: { guides },
        }),
      );

      dragCoordinator.setPosition(obj.id, currentX, currentY);

      // Cmd/Ctrl individual drag - skip group movement
      const cmdKey = e.evt.metaKey || e.evt.ctrlKey;
      if (cmdKey) return;

      // Move group siblings if whole group is selected
      if (obj.groupId) {
        const siblings = state.objects.filter(
          (o) => o.groupId === obj.groupId && o.id !== obj.id,
        );
        if (siblings.length > 0) {
          const selectedIdsSet = new Set(state.selectedIds);
          const groupObjectIds = [obj.id, ...siblings.map((s) => s.id)];
          const isGroupSelected = groupObjectIds.every((id) =>
            selectedIdsSet.has(id),
          );

          if (isGroupSelected) {
            const layer = e.target.getLayer();
            if (!layer) return;

            const deltaX = currentX - obj.x;
            const deltaY = currentY - obj.y;

            siblings.forEach((sibling) => {
              const siblingNode = layer.findOne(`#${sibling.id}`);
              if (siblingNode) {
                const newX = sibling.x + deltaX;
                const newY = sibling.y + deltaY;
                siblingNode.x(newX);
                siblingNode.y(newY);
                dragCoordinator.setPosition(sibling.id, newX, newY);
              }
            });
          }
        }
      }
    },
    [obj.id, obj.x, obj.y, obj.width, obj.height, obj.groupId],
  );

  const fullDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const state = useCanvasStore.getState();

      state.removeDraggingIds([obj.id]);

      // Clear alignment guides
      window.dispatchEvent(
        new CustomEvent("alignment-guides-update", {
          detail: { guides: [] },
        }),
      );

      dragCoordinator.clear(obj.id);
      const finalX = e.target.x();
      const finalY = e.target.y();
      state.updateObject(obj.id, { x: finalX, y: finalY });

      // Cmd/Ctrl individual drag - skip group update
      const cmdKey = e.evt.metaKey || e.evt.ctrlKey;
      if (cmdKey) return;

      // Update group siblings in store
      if (obj.groupId) {
        const siblings = state.objects.filter(
          (o) => o.groupId === obj.groupId && o.id !== obj.id,
        );
        if (siblings.length > 0) {
          const selectedIdsSet = new Set(state.selectedIds);
          const groupObjectIds = [obj.id, ...siblings.map((s) => s.id)];
          const isGroupSelected = groupObjectIds.every((id) =>
            selectedIdsSet.has(id),
          );

          if (isGroupSelected) {
            const deltaX = e.target.x() - obj.x;
            const deltaY = e.target.y() - obj.y;
            const movingIds = new Set(groupObjectIds);

            siblings.forEach((sibling) => {
              dragCoordinator.clear(sibling.id);

              if (sibling.type === "connector") {
                // 양 끝이 함께 움직일 때만 꺾임을 평행 이동한다.
                // bend 는 절대 좌표라 안 옮기면 도형만 이동하고 형태가 찌그러진다.
                // (moveGroupObjects 와 같은 규칙 — 그룹 경계가 아니라 도형을
                //  직접 끌면 이 경로를 탄다)
                const sourceMoves =
                  !sibling.sourceId || movingIds.has(sibling.sourceId);
                const targetMoves =
                  !sibling.targetId || movingIds.has(sibling.targetId);
                const movedBends =
                  sourceMoves && targetMoves
                    ? translateElbowBends(sibling.elbowBends, deltaX, deltaY)
                    : sibling.elbowBends;

                state.updateObject(sibling.id, {
                  ...(sibling.sourceId
                    ? {}
                    : { x: sibling.x + deltaX, y: sibling.y + deltaY }),
                  ...(sibling.targetId || sibling.endX === undefined
                    ? {}
                    : {
                        endX: sibling.endX + deltaX,
                        endY: (sibling.endY ?? 0) + deltaY,
                      }),
                  ...(movedBends !== sibling.elbowBends
                    ? { elbowBends: movedBends }
                    : {}),
                });
                return;
              }

              state.updateObject(sibling.id, {
                x: sibling.x + deltaX,
                y: sibling.y + deltaY,
              });
            });
          }
        }
      }
    },
    [obj.id, obj.x, obj.y, obj.groupId],
  );

  // --- Line-specific full drag start ---
  const lineDragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const state = useCanvasStore.getState();
      if (state.tool === "hand") return;
      state.addDraggingIds([obj.id]);
      const shiftKey = e.evt.shiftKey;
      const selectedIdsSet = new Set(state.selectedIds);
      if (shiftKey) {
        if (!selectedIdsSet.has(obj.id)) {
          state.addToSelection(obj.id);
        }
      } else if (!selectedIdsSet.has(obj.id)) {
        state.setSelectedIds([obj.id]);
      }
    },
    [obj.id],
  );

  // --- CodeBlock/Embed drag start (adds dragging ids) ---
  const draggingDragStart = useCallback(() => {
    const s = useCanvasStore.getState();
    if (s.tool === "hand") return;
    s.addDraggingIds([obj.id]);
  }, [obj.id]);

  const draggable = !isObjectLocked && tool !== "hand" && !isLocked;

  // === Render by object type ===

  switch (obj.type) {
    case "stickyNote":
      return (
        <StickyNote
          shape={obj}
          isSelected={isSelected}
          isMultiSelected={isMultiSelected}
          zoom={zoom}
          draggable={draggable}
          onSelect={handleSelect}
          onDragStart={renderMode === "simplified" ? NOOP : fullDragStart}
          onDragMove={
            renderMode === "simplified" ? simplifiedDragMove : fullDragMove
          }
          onDragEnd={
            renderMode === "simplified" ? simplifiedDragEnd : fullDragEnd
          }
          onDoubleClick={handleDoubleClick}
          isEditing={editingTextId === obj.id}
        />
      );

    case "textBox":
      return (
        <TextBox
          shape={obj}
          isSelected={isSelected}
          isMultiSelected={isMultiSelected}
          zoom={zoom}
          draggable={draggable}
          isEditing={editingTextId === obj.id}
          onSelect={handleSelect}
          onDragStart={renderMode === "simplified" ? NOOP : fullDragStart}
          onDragMove={
            renderMode === "simplified" ? simplifiedDragMove : fullDragMove
          }
          onDragEnd={
            renderMode === "simplified" ? simplifiedDragEnd : fullDragEnd
          }
          onDoubleClick={handleDoubleClick}
        />
      );

    case "shape":
      return (
        <VariantShape
          shape={obj}
          isSelected={isSelected}
          isMultiSelected={isMultiSelected}
          zoom={zoom}
          draggable={draggable}
          onSelect={handleSelect}
          onDragStart={renderMode === "simplified" ? NOOP : fullDragStart}
          onDragMove={
            renderMode === "simplified" ? simplifiedDragMove : fullDragMove
          }
          onDragEnd={
            renderMode === "simplified" ? simplifiedDragEnd : fullDragEnd
          }
          onDoubleClick={handleDoubleClick}
          onTextClick={renderMode === "full" ? handleTextClick : undefined}
          isEditing={editingTextId === obj.id}
        />
      );

    case "image":
      return (
        <CanvasImage
          shape={obj}
          isSelected={isSelected}
          isMultiSelected={isMultiSelected}
          zoom={zoom}
          draggable={draggable}
          onSelect={handleSelect}
          onDragStart={renderMode === "simplified" ? NOOP : fullDragStart}
          onDragMove={
            renderMode === "simplified" ? simplifiedDragMove : fullDragMove
          }
          onDragEnd={
            renderMode === "simplified" ? simplifiedDragEnd : fullDragEnd
          }
        />
      );

    case "connector":
      return (
        <ConnectorShapeRenderer
          obj={obj}
          isSelected={isSelected}
          isMultiSelected={isMultiSelected}
          isObjectLocked={isObjectLocked}
        />
      );

    case "line":
      return (
        <Line
          shape={obj}
          isSelected={isSelected}
          isMultiSelected={isMultiSelected}
          zoom={zoom}
          draggable={draggable}
          onSelect={handleSelect}
          onDragStart={renderMode === "simplified" ? NOOP : lineDragStart}
          onDragMove={
            renderMode === "simplified" ? simplifiedDragMove : simpleDragMove
          }
          onDragEnd={
            renderMode === "simplified"
              ? simplifiedDragEnd
              : draggingSimpleDragEnd
          }
        />
      );

    case "table":
      return (
        <Table
          shape={obj}
          isSelected={isSelected}
          isMultiSelected={isMultiSelected}
          zoom={zoom}
          draggable={draggable}
          editingCell={editingTableCell}
          selectedCells={selectedTableCells}
          onSelect={handleSelect}
          onDragStart={NOOP}
          onDragMove={
            renderMode === "simplified" ? simplifiedDragMove : simpleDragMove
          }
          onDragEnd={
            renderMode === "simplified" ? simplifiedDragEnd : simpleDragEnd
          }
          onCellDoubleClick={handleCellDoubleClick}
          onCellSelectionChange={handleCellSelectionChange}
        />
      );

    case "chart":
      return (
        <Chart
          shape={obj}
          isSelected={isSelected}
          isMultiSelected={isMultiSelected}
          zoom={zoom}
          draggable={draggable}
          onSelect={handleSelect}
          onDragStart={NOOP}
          onDragMove={
            renderMode === "simplified" ? simplifiedDragMove : simpleDragMove
          }
          onDragEnd={
            renderMode === "simplified" ? simplifiedDragEnd : simpleDragEnd
          }
          onDoubleClick={handleChartDoubleClick}
          onHeaderDoubleClick={handleChartHeaderDoubleClick}
          onUpdate={handleUpdate}
          isEditingTitle={editingChartTitleId === obj.id}
        />
      );

    case "codeBlock":
      return (
        <CodeBlock
          shape={obj}
          isSelected={isSelected}
          isMultiSelected={isMultiSelected}
          zoom={zoom}
          tool={tool}
          draggable={draggable}
          onSelect={handleSelect}
          onDragStart={renderMode === "simplified" ? NOOP : draggingDragStart}
          onDragMove={
            renderMode === "simplified" ? simplifiedDragMove : simpleDragMove
          }
          onDragEnd={
            renderMode === "simplified"
              ? simplifiedDragEnd
              : draggingSimpleDragEnd
          }
          onDoubleClick={handleCodeBlockDoubleClick}
          onHeaderDoubleClick={handleCodeBlockHeaderDoubleClick}
          isEditing={editingTextId === obj.id}
        />
      );

    case "embed":
      return (
        <Embed
          shape={obj}
          isSelected={isSelected}
          isMultiSelected={isMultiSelected}
          zoom={zoom}
          draggable={draggable}
          onSelect={handleSelect}
          onDragStart={renderMode === "simplified" ? NOOP : draggingDragStart}
          onDragMove={
            renderMode === "simplified" ? simplifiedDragMove : simpleDragMove
          }
          onDragEnd={
            renderMode === "simplified"
              ? simplifiedDragEnd
              : draggingSimpleDragEnd
          }
          onDoubleClick={handleEmbedDoubleClick}
          isPlaying={obj.isPlaying}
        />
      );

    // connectorLabel is rendered separately in Canvas.tsx
    default:
      return null;
  }
});

// Stable module-level constants to avoid creating new references
const NOOP = () => {};
