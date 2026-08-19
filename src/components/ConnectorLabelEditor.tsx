import { useCallback, useMemo } from "react";
import { useCanvasStore } from "@/store";
import { ConnectorLabelOptionsBar } from "./ConnectorLabelOptionsBar";
import { getPointOnPath } from "@/utils/elbowPath";
import { getConnectorPathPoints } from "@/utils/connectorPath";
import { calculateOptionsBarPosition } from "@/utils/optionsBar";
import type { CanvasObject } from "@/types";

export function ConnectorLabelEditor() {
  const { objects, selectedIds, viewport, updateObject, setEditingTextId } =
    useCanvasStore();

  // Find if a single connectorLabel is selected
  const selectedLabel = useMemo(() => {
    if (selectedIds.length !== 1) return undefined;
    const obj = objects.find(
      (o) => o.id === selectedIds[0] && o.type === "connectorLabel",
    );
    return obj;
  }, [objects, selectedIds]);

  // Get connected connector
  const connectedConnector = useMemo(() => {
    if (!selectedLabel?.connectedConnectorId) return undefined;
    return objects.find((o) => o.id === selectedLabel.connectedConnectorId);
  }, [objects, selectedLabel?.connectedConnectorId]);

  // Calculate label position on connector path
  const labelPosition = useMemo(() => {
    if (
      !selectedLabel ||
      !connectedConnector ||
      connectedConnector.type !== "connector"
    ) {
      return { x: 0, y: 0 };
    }

    // Calculate connector path
    const sourceObj = connectedConnector.sourceId
      ? objects.find((o) => o.id === connectedConnector.sourceId)
      : undefined;
    const targetObj = connectedConnector.targetId
      ? objects.find((o) => o.id === connectedConnector.targetId)
      : undefined;

    // 렌더러와 같은 단일 소스로 경로를 계산한다 — 앵커 리드인/크기 우회가
    // 빠지면 라벨이 실제 그려진 선과 다른 경로 위에 앉는다.
    const pathPoints = getConnectorPathPoints(
      connectedConnector,
      sourceObj,
      targetObj,
    );

    const labelT = selectedLabel.labelT ?? 0.5;
    return getPointOnPath(pathPoints, labelT);
  }, [selectedLabel, connectedConnector, objects]);

  // Calculate options bar position using standard utility
  const barPosition = useMemo(() => {
    if (!selectedLabel)
      return { x: 0, y: 0, above: true, align: "center" as const };

    // Estimate label size (fontSize + padding)
    const fontSize = selectedLabel.fontSize ?? 12;
    const estimatedWidth = Math.max(
      60,
      (selectedLabel.text?.length ?? 8) * fontSize * 0.6,
    );
    const estimatedHeight = fontSize + 12; // padding

    return calculateOptionsBarPosition({
      element: {
        x: labelPosition.x - estimatedWidth / 2,
        y: labelPosition.y - estimatedHeight / 2,
        width: estimatedWidth,
        height: estimatedHeight,
      },
      viewport,
      offset: 12,
      barHeight: 40,
    });
  }, [selectedLabel, labelPosition, viewport]);

  const handleUpdate = useCallback(
    (updates: Partial<CanvasObject>) => {
      if (selectedLabel) {
        updateObject(selectedLabel.id, updates);
      }
    },
    [selectedLabel, updateObject],
  );

  const handleStartEdit = useCallback(() => {
    if (selectedLabel) {
      setEditingTextId(selectedLabel.id);
    }
  }, [selectedLabel, setEditingTextId]);

  if (!selectedLabel || !connectedConnector) return null;

  return (
    <ConnectorLabelOptionsBar
      label={selectedLabel}
      position={barPosition}
      onUpdate={handleUpdate}
      onStartEdit={handleStartEdit}
    />
  );
}
