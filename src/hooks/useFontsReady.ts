import { useEffect } from "react";
import type Konva from "konva";
import type { RefObject } from "react";

/**
 * 웹폰트가 붙은 뒤 스테이지를 다시 그린다.
 *
 * Konva 는 텍스트 폭을 그릴 때 한 번 재고 그 결과를 노드에 담아 둔다. 그런데
 * Google Fonts 는 `unicode-range` 로 쪼개져 있어 **그 글자가 처음 그려질 때**
 * 비로소 받아온다 — 즉 첫 렌더는 거의 항상 폴백 폰트로 측정된다. 폰트가 나중에
 * 붙어도 재측정이 없으면 글자 모양만 바뀌고 줄바꿈·박스 폭은 폴백 기준으로
 * 남아 어긋난다.
 *
 * `document.fonts` 가 없는 환경(테스트/구형)에서는 아무것도 하지 않는다.
 */
export function useFontsReady(stageRef: RefObject<Konva.Stage | null>): void {
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return;

    let cancelled = false;
    const redraw = () => {
      if (cancelled) return;
      const stage = stageRef.current;
      if (!stage) return;
      // 캐시된 텍스트 폭을 버리게 하려면 레이어 단위 재그리기로 충분하다
      for (const layer of stage.getLayers()) layer.batchDraw();
    };

    // 최초 로드 완료 + 이후 추가 로드(글자가 새 unicode-range 를 건드릴 때)
    void document.fonts.ready.then(redraw);
    document.fonts.addEventListener("loadingdone", redraw);
    return () => {
      cancelled = true;
      document.fonts.removeEventListener("loadingdone", redraw);
    };
  }, [stageRef]);
}
