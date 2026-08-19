import { memo, useEffect, useState, useMemo } from "react";
import toast from "react-hot-toast";
import { Z_OPTIONS_BAR } from "@/constants/zIndex";
import { useSelectedIds, useObjects } from "@/store";

const MULTI_SELECT_HINT_KEY = "multiSelectHintShown";

/**
 * 다중 선택 시 상단 중앙에 표시되는 안내 메시지
 * - 선택된 요소 개수 표시 (섹션은 1개로 카운트)
 * - Cmd+클릭 / 우클릭 그룹핑 안내
 * - ARIA live region으로 스크린 리더 지원
 */
export const MultiSelectIndicator = memo(function MultiSelectIndicator() {
  const selectedIds = useSelectedIds();
  const objects = useObjects();
  const [hasShownHint, setHasShownHint] = useState(false);

  // 선택된 개수 및 상태 계산
  const { selectedCount, isOnlySectionSelected } = useMemo(() => {
    const selectedObjects = objects.filter((o) => selectedIds.includes(o.id));

    // 그룹에 속한 객체들의 고유 groupId 수집
    const groupIds = new Set(
      selectedObjects.map((o) => o.groupId).filter(Boolean),
    );

    // 그룹에 속하지 않은 개별 객체 수
    const ungroupedCount = selectedObjects.filter((o) => !o.groupId).length;

    // 섹션만 선택됨: 모든 객체가 동일한 그룹에 속하고 개별 객체 없음
    const isOnlySectionSelected = groupIds.size === 1 && ungroupedCount === 0;

    // 총 개수 = 섹션 수 + 개별 객체 수
    return {
      selectedCount: groupIds.size + ungroupedCount,
      isOnlySectionSelected,
    };
  }, [objects, selectedIds]);

  const isMultiSelect = selectedIds.length > 1;

  // 첫 다중 선택 시 그룹핑 힌트 토스트 표시 (1회만)
  useEffect(() => {
    if (isMultiSelect && !hasShownHint) {
      const hintShown = localStorage.getItem(MULTI_SELECT_HINT_KEY);
      if (!hintShown) {
        toast("우클릭하여 그룹으로 묶을 수 있습니다", {
          icon: "💡",
          duration: 4000,
        });
        localStorage.setItem(MULTI_SELECT_HINT_KEY, "true");
        setHasShownHint(true);
      }
    }
  }, [isMultiSelect, hasShownHint]);

  // 다중 선택이 아니거나 섹션만 선택된 경우 숨김
  if (!isMultiSelect || isOnlySectionSelected) {
    return (
      // 스크린 리더 전용 - 선택 해제 안내
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {isOnlySectionSelected ? "섹션 선택됨" : "선택된 요소 없음"}
      </div>
    );
  }

  return (
    <>
      {/* 시각적 표시 - 상단 중앙 */}
      <div
        className="animate-in fade-in slide-in-from-top-2 fixed top-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-white shadow-lg duration-200"
        style={{ zIndex: Z_OPTIONS_BAR }}
      >
        <span className="font-medium">{selectedCount}개 선택됨</span>
        <span className="text-sm text-gray-400">Cmd+클릭으로 추가/해제</span>
      </div>

      {/* 스크린 리더 전용 실시간 안내 */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {selectedCount}개 요소 선택됨. Cmd+클릭으로 추가/해제, Escape로 선택
        해제, 우클릭으로 그룹핑 가능
      </div>
    </>
  );
});
