import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useCanvasStore } from "./index";
import { isTextReadable, TEXT_LOD_MIN_SCREEN_PX } from "@/constants/text";

describe("persist 디바운스", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("고빈도 상태 변경이 localStorage 쓰기 한 번으로 묶인다", () => {
    const spy = vi.spyOn(globalThis.localStorage, "setItem");
    // 줌/팬 시뮬레이션 — 매 틱 viewport 변경
    for (let i = 0; i < 20; i++) {
      useCanvasStore.getState().setViewport({ zoom: 1 + i * 0.01 });
    }
    const before = spy.mock.calls.filter(
      ([key]) => key === "canvas-app",
    ).length;
    expect(before).toBe(0); // 디바운스 중 — 아직 쓰기 없음

    vi.advanceTimersByTime(600);
    const after = spy.mock.calls.filter(([key]) => key === "canvas-app").length;
    expect(after).toBe(1); // 트레일링 1회
    spy.mockRestore();
  });
});

describe("isTextReadable (줌 LOD)", () => {
  it("화면상 높이가 임계값 미만이면 렌더 생략 판정", () => {
    expect(isTextReadable(16, 1)).toBe(true); // 16px
    expect(isTextReadable(16, 0.3)).toBe(false); // 4.8px < 6
    expect(isTextReadable(10, 0.6)).toBe(true); // 6px == 임계값
    expect(isTextReadable(TEXT_LOD_MIN_SCREEN_PX, 1)).toBe(true);
  });
});
