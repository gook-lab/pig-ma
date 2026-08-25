import { memo, useCallback, useMemo } from "react";
import type Konva from "konva";
import type { CanvasObject } from "@/types";
import { useCanvasStore } from "@/store";
import { Connector } from "./shapes/Connector";
import { BranchConnector } from "./shapes/BranchConnector";
import { isBranchConnector } from "@/utils/branchPath";

interface ConnectorShapeRendererProps {
  obj: CanvasObject;
  isSelected: boolean;
  isMultiSelected: boolean;
  isObjectLocked: boolean;
}

/**
 * ConnectorShapeRenderer - Dedicated renderer for connector objects.
 * Extracted from ShapeRenderer to avoid conditional hooks for the
 * `objects` subscription that connectors need for source/target resolution.
 */
export const ConnectorShapeRenderer = memo(function ConnectorShapeRenderer({
  obj,
  isSelected,
  isMultiSelected,
  isObjectLocked,
}: ConnectorShapeRendererProps) {
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  // 끝점 도형만 좁게 구독한다 — objects 배열 전체를 구독하면 캔버스의
  // 아무 객체가 바뀔 때마다 모든 커넥터가 리렌더된다. find 는 대상 도형이
  // 안 바뀌면 같은 참조를 돌려주므로 리렌더가 발생하지 않는다.
  const sourceRaw = useCanvasStore((s) =>
    obj.sourceId && !obj.sourceId.startsWith("__group:")
      ? s.objects.find((o) => o.id === obj.sourceId)
      : undefined,
  );
  const targetRaw = useCanvasStore((s) =>
    obj.targetId && !obj.targetId.startsWith("__group:")
      ? s.objects.find((o) => o.id === obj.targetId)
      : undefined,
  );
  // 분기 커넥터의 갈래 타깃들.
  // ⚠️ 셀렉터가 배열을 만들어 돌려주면 매 렌더 새 참조라 무한 루프가 난다
  // ("getSnapshot should be cached"). 구독은 **원시값 키**로 하고, 실제 도형은
  // 그 키가 바뀔 때만 getState() 로 읽는다.
  const branchTargetKey = useCanvasStore((s) => {
    const ids = obj.targetIds;
    if (!ids?.length) return "";
    let key = "";
    for (const id of ids) {
      const o = s.objects.find((x) => x.id === id);
      key += o
        ? `${o.id}:${o.x},${o.y},${o.width ?? 0},${o.height ?? 0}|`
        : "-|";
    }
    return key;
  });
  const branchTargets = useMemo(
    () => {
      const ids = obj.targetIds;
      if (!ids?.length) return [];
      const objects = useCanvasStore.getState().objects;
      return ids.map((id) => objects.find((o) => o.id === id));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [branchTargetKey, obj.targetIds],
  );
  // __group: 연결은 그룹 customBounds 만 구독 (참조 안정 — 이동 시에만 변경)
  const sourceGroupBounds = useCanvasStore((s) => {
    const m = obj.sourceId?.match(/^__group:(.+)$/);
    return m ? s.groups.find((g) => g.id === m[1])?.customBounds : undefined;
  });
  const targetGroupBounds = useCanvasStore((s) => {
    const m = obj.targetId?.match(/^__group:(.+)$/);
    return m ? s.groups.find((g) => g.id === m[1])?.customBounds : undefined;
  });

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

  const handleUpdate = useCallback(
    (updates: Partial<CanvasObject>) => {
      useCanvasStore.getState().updateObject(obj.id, updates);
    },
    [obj.id],
  );

  // 그룹 연결용 가상 도형은 bounds 참조가 바뀔 때만 재생성 (memo 로
  // 참조 안정 유지 — 매 렌더 새 객체를 만들면 Connector memo 가 무력화된다)
  const sourceObj = useMemo(
    () =>
      sourceRaw ??
      (sourceGroupBounds && obj.sourceId
        ? makeGroupVirtualObject(obj.sourceId, sourceGroupBounds)
        : undefined),
    [sourceRaw, sourceGroupBounds, obj.sourceId],
  );
  const targetObj = useMemo(
    () =>
      targetRaw ??
      (targetGroupBounds && obj.targetId
        ? makeGroupVirtualObject(obj.targetId, targetGroupBounds)
        : undefined),
    [targetRaw, targetGroupBounds, obj.targetId],
  );

  if (isBranchConnector(obj)) {
    return (
      <BranchConnector
        connector={obj}
        sourceObject={sourceObj}
        targetObjects={branchTargets}
        isSelected={isSelected && !isObjectLocked}
        isMultiSelected={isMultiSelected}
        zoom={zoom}
        onSelect={handleSelect}
      />
    );
  }

  return (
    <Connector
      connector={obj}
      sourceObject={sourceObj}
      targetObject={targetObj}
      isSelected={isSelected && !isObjectLocked}
      isMultiSelected={isMultiSelected}
      zoom={zoom}
      onSelect={handleSelect}
      onUpdate={isObjectLocked ? NOOP_UPDATE : handleUpdate}
    />
  );
});

const NOOP_UPDATE = () => {};

function makeGroupVirtualObject(
  id: string,
  b: { x: number; y: number; width: number; height: number },
): CanvasObject {
  return {
    id,
    type: "shape",
    shapeVariant: "rectangle",
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    rotation: 0,
    opacity: 1,
  } as CanvasObject;
}
