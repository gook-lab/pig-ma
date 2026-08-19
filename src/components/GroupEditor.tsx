import { useMemo, useCallback } from "react";
import { useCanvasStore } from "@/store";
import { getObjectBounds } from "@/utils/geometry";
import { GroupOptionsBar } from "./GroupOptionsBar";

export function GroupEditor() {
  const { objects, selectedIds, groups, viewport, updateGroup } =
    useCanvasStore();

  // 선택된 객체들의 공통 그룹 찾기
  // 옵션바 표시 조건: 섹션 전체가 선택된 경우, 또는 __group: 가상 선택
  const selectedGroup = useMemo(() => {
    if (selectedIds.length === 0) return undefined;

    // __group: 가상 선택 마커 체크
    const groupMatch = selectedIds[0]?.match(/^__group:(.+)$/);
    if (groupMatch) {
      return groups.find((g) => g.id === groupMatch[1]);
    }

    const selectedObjects = objects.filter((o) => selectedIds.includes(o.id));

    // 혼합 선택 체크 (그룹 요소 + 개별 요소가 섞인 경우 숨김)
    const hasGroupedObjects = selectedObjects.some((o) => o.groupId);
    const hasUngroupedObjects = selectedObjects.some((o) => !o.groupId);
    if (hasGroupedObjects && hasUngroupedObjects) return undefined;

    const groupIds = [
      ...new Set(selectedObjects.map((o) => o.groupId).filter(Boolean)),
    ];

    // 단일 그룹에 속한 경우만 체크
    if (groupIds.length !== 1) return undefined;

    const groupId = groupIds[0];
    const group = groups.find((g) => g.id === groupId);
    if (!group) return undefined;

    // 그룹의 모든 객체가 선택되었는지 확인
    const groupObjectIds = objects
      .filter((o) => o.groupId === groupId)
      .map((o) => o.id);

    const allGroupObjectsSelected = groupObjectIds.every((id) =>
      selectedIds.includes(id),
    );

    // 섹션 전체가 선택된 경우에만 옵션바 표시
    return allGroupObjectsSelected ? group : undefined;
  }, [objects, selectedIds, groups]);

  // 섹션 바운딩 박스 계산 (customBounds 우선, 없으면 객체 bounds + padding)
  const getSectionBounds = useCallback(() => {
    if (!selectedGroup) return null;

    // customBounds가 있으면 그것 사용
    if (selectedGroup.customBounds) {
      return selectedGroup.customBounds;
    }

    // 없으면 객체 bounds 계산 + padding
    const groupObjects = objects.filter((o) => o.groupId === selectedGroup.id);
    if (groupObjects.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    groupObjects.forEach((obj) => {
      const objBounds = getObjectBounds(obj);
      minX = Math.min(minX, objBounds.x);
      minY = Math.min(minY, objBounds.y);
      maxX = Math.max(maxX, objBounds.x + objBounds.width);
      maxY = Math.max(maxY, objBounds.y + objBounds.height);
    });

    const defaultPadding = 20;
    return {
      x: minX - defaultPadding,
      y: minY - defaultPadding,
      width: maxX - minX + defaultPadding * 2,
      height: maxY - minY + defaultPadding * 2,
    };
  }, [selectedGroup, objects]);

  // 옵션바 위치 계산 (항상 섹션 상단에 배치)
  const position = useMemo(() => {
    const bounds = getSectionBounds();
    if (!bounds) return { x: 0, y: 0, above: true };

    const barHeight = 50;
    // 태그와 옵션바 사이 간격 (화면 픽셀 기준, 줌 독립적)
    const tagGap = 20;

    const centerX = bounds.x + bounds.width / 2;
    const screenX = centerX * viewport.zoom + viewport.x;

    // 섹션 태그 화면 y 위치 = bounds.y * zoom + viewport.y - 32
    // (GroupBoundary에서 태그는 32/zoom 캔버스 좌표에 배치되어 화면에서는 32px 위)
    const tagScreenY = bounds.y * viewport.zoom + viewport.y - 32;

    // 옵션바 하단을 태그 상단에서 tagGap만큼 위에 배치
    let screenY = tagScreenY - tagGap;

    // 화면 상단을 넘어가면 최소 barHeight 위치로 clamp
    if (screenY < barHeight) {
      screenY = barHeight;
    }

    // 섹션은 항상 상단에 옵션바 배치
    return { x: screenX, y: screenY, above: true };
  }, [getSectionBounds, viewport]);

  if (!selectedGroup) return null;

  return (
    <GroupOptionsBar
      group={selectedGroup}
      position={position}
      onUpdate={(updates) => updateGroup(selectedGroup.id, updates)}
    />
  );
}
