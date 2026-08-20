import { useMemo, useState, useEffect } from "react";
import type { CanvasObject } from "@/types";
import { filterVisibleObjects, type Viewport } from "@/utils/geometry";

interface UseVisibleObjectsOptions {
  /** 버퍼 영역 (기본 200px) - 스크롤 시 깜빡임 방지 */
  padding?: number;
  /** 디바운스 시간 (ms) - 빠른 패닝 시 필터링 지연 */
  debounceMs?: number;
}

/**
 * 뷰포트 가상화 훅
 * Progressive Disclosure 패턴: 화면에 보이는 객체만 반환하여 렌더링 최적화
 *
 * @param objects - 전체 객체 배열
 * @param viewport - 뷰포트 상태
 * @param selectedIds - 선택된 객체 ID 배열
 * @param options - 옵션
 * @returns 가시적인 객체 배열
 *
 * @example
 * ```tsx
 * const visibleObjects = useVisibleObjects(objects, viewport, selectedIds);
 *
 * return visibleObjects.map(obj => <Shape key={obj.id} shape={obj} />);
 * ```
 */
export function useVisibleObjects(
  objects: CanvasObject[],
  viewport: Viewport,
  selectedIds: string[],
  options: UseVisibleObjectsOptions = {},
): CanvasObject[] {
  const { padding = 200, debounceMs = 0 } = options;

  // 윈도우 크기 추적
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1920,
    height: typeof window !== "undefined" ? window.innerHeight : 1080,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 디바운스된 뷰포트 (빠른 패닝 시 필터링 지연)
  //
  // debounceMs === 0 이면 디바운스 자체가 없는 것이므로 **상태를 거치지 않고
  // viewport 를 그대로 쓴다**. 예전에는 이 경우에도 이펙트에서 setState 를
  // 호출했는데, 팬/줌은 매 프레임 viewport 를 바꾸므로 프레임마다 렌더가
  // 한 번 더 얹히는 낭비였다 (react-hooks/set-state-in-effect 가 잡은 패턴).
  const [debouncedViewport, setDebouncedViewport] = useState(viewport);

  useEffect(() => {
    if (debounceMs === 0) return;

    const timer = setTimeout(() => {
      setDebouncedViewport(viewport);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [viewport, debounceMs]);

  const effectiveViewport = debounceMs === 0 ? viewport : debouncedViewport;

  // 가시적인 객체 필터링
  const visibleObjects = useMemo(() => {
    return filterVisibleObjects(
      objects,
      effectiveViewport,
      windowSize.width,
      windowSize.height,
      selectedIds,
      padding,
    );
  }, [
    objects,
    effectiveViewport,
    windowSize.width,
    windowSize.height,
    selectedIds,
    padding,
  ]);

  return visibleObjects;
}

/**
 * 뷰포트 가상화 통계 훅 (디버깅/모니터링용)
 */
export function useVisibleObjectsStats(
  totalCount: number,
  visibleCount: number,
): {
  total: number;
  visible: number;
  culled: number;
  percentage: number;
} {
  return useMemo(
    () => ({
      total: totalCount,
      visible: visibleCount,
      culled: totalCount - visibleCount,
      percentage:
        totalCount > 0 ? Math.round((visibleCount / totalCount) * 100) : 100,
    }),
    [totalCount, visibleCount],
  );
}
