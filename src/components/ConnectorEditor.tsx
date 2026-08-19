import { useCallback, useMemo } from "react";
import { useCanvasStore } from "@/store";
import { ConnectorOptionsBar } from "./ConnectorOptionsBar";
import { calculateOptionsBarPositionForLine } from "@/utils/optionsBar";
import {
  getConnectorEndpoints,
  getConnectorPathPoints,
} from "@/utils/connectorPath";
import { createConnectorLabel } from "@/utils/factory";
import { getPointOnPath } from "@/utils/elbowPath";
import type { CanvasObject } from "@/types";

export function ConnectorEditor() {
  const { objects, selectedIds, viewport, updateObject, addObject } =
    useCanvasStore();

  // Find if a single connector is selected
  const selectedConnector =
    selectedIds.length === 1
      ? objects.find(
          (obj) => obj.id === selectedIds[0] && obj.type === "connector",
        )
      : undefined;

  // Get source and target objects if connected
  const sourceObject = useMemo(() => {
    if (!selectedConnector?.sourceId) return undefined;
    return objects.find((obj) => obj.id === selectedConnector.sourceId);
  }, [objects, selectedConnector?.sourceId]);

  const targetObject = useMemo(() => {
    if (!selectedConnector?.targetId) return undefined;
    return objects.find((obj) => obj.id === selectedConnector.targetId);
  }, [objects, selectedConnector?.targetId]);

  // Calculate actual start and end points — 렌더러와 같은 단일 소스 사용
  const actualPoints = useMemo(() => {
    if (!selectedConnector)
      return { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } };
    return getConnectorEndpoints(selectedConnector, sourceObject, targetObject);
  }, [selectedConnector, sourceObject, targetObject]);

  // Calculate path points for TextBox creation
  //
  // 반드시 렌더러와 같은 단일 소스(getConnectorPathPoints)를 쓴다. 예전처럼
  // calculateElbowPath 를 직접 부르면 앵커 리드인 스텁·크기 비례 우회가
  // 빠진 "다른 경로" 위에 옵션바/라벨이 앉는다.
  const pathPoints = useMemo(() => {
    if (!selectedConnector) return [];
    return getConnectorPathPoints(
      selectedConnector,
      sourceObject,
      targetObject,
    );
  }, [selectedConnector, sourceObject, targetObject]);

  // Calculate the position for the options bar (below or above depending on screen position)
  // ㄷ자 커넥터의 경우 실제 경로 포인트의 바운딩 박스를 사용
  const getBarPosition = useCallback(() => {
    if (!selectedConnector)
      return { x: 0, y: 0, above: false, align: "center" as const };

    const startX = actualPoints.start.x;
    const startY = actualPoints.start.y;
    const endX = actualPoints.end.x;
    const endY = actualPoints.end.y;

    // elbowed 스타일인 경우 실제 경로 포인트의 바운딩 박스 계산
    if (selectedConnector.pathStyle === "elbowed" && pathPoints.length > 0) {
      // 경로 포인트에서 min/max 계산
      let minY = Infinity;
      let maxY = -Infinity;
      let minX = Infinity;
      let maxX = -Infinity;

      for (let i = 0; i < pathPoints.length; i += 2) {
        const x = pathPoints[i];
        const y = pathPoints[i + 1];
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }

      return calculateOptionsBarPositionForLine({
        startX: minX,
        startY: minY,
        endX: maxX,
        endY: maxY,
        viewport,
      });
    }

    return calculateOptionsBarPositionForLine({
      startX,
      startY,
      endX,
      endY,
      viewport,
    });
  }, [selectedConnector, actualPoints, pathPoints, viewport]);

  const handleUpdate = useCallback(
    (updates: Partial<CanvasObject>) => {
      if (selectedConnector) {
        updateObject(selectedConnector.id, updates);
      }
    },
    [selectedConnector, updateObject],
  );

  // Create a ConnectorLabel at the center of the connector path
  const handleAddLabel = useCallback(() => {
    if (!selectedConnector) return;

    // Already has a label, do nothing (deletion is done via label selection + Delete key)
    if (selectedConnector.labelTextBoxId) return;

    // Calculate center position (labelT = 0.5)
    const centerPos = getPointOnPath(pathPoints, 0.5);

    // Create label with absolute coordinates
    const label = createConnectorLabel(
      selectedConnector.id,
      centerPos.x,
      centerPos.y,
      0.5,
    );

    // Inherit groupId from connector (connector and shapes are already grouped)
    if (selectedConnector.groupId) {
      label.groupId = selectedConnector.groupId;
    }

    addObject(label);

    // Update connector to reference the label
    updateObject(selectedConnector.id, { labelTextBoxId: label.id });
  }, [selectedConnector, pathPoints, addObject, updateObject]);

  // Nothing to render if no connector is selected
  if (!selectedConnector) return null;

  const position = getBarPosition();

  return (
    <>
      {/* Show options bar only when connector is selected and not locked */}
      {!selectedConnector.locked && (
        <ConnectorOptionsBar
          connector={selectedConnector}
          position={position}
          startPoint={actualPoints.start}
          endPoint={actualPoints.end}
          onUpdate={handleUpdate}
          onStartTextEdit={handleAddLabel}
        />
      )}
    </>
  );
}
