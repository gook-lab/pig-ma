import { describe, it, expect } from "vitest";
import { adjustArrowEndpoints, ARROW_GAP } from "./arrowEndpoints";

/** 수평 경로: (0,100) → (200,100) */
const HORIZONTAL = [0, 100, 200, 100];

describe("화살촉 위치 보정", () => {
  it("도형에 안 붙어 있으면 건드리지 않는다", () => {
    expect(adjustArrowEndpoints(HORIZONTAL, false, false)).toEqual(HORIZONTAL);
  });

  it("끝점을 진행 방향 반대로 당긴다", () => {
    const out = adjustArrowEndpoints(HORIZONTAL, false, true, 6);
    expect(out[2]).toBe(194);
    expect(out[3]).toBe(100); // 축은 그대로 — 기울지 않는다
  });

  it("시작점도 같은 방식으로 당긴다", () => {
    const out = adjustArrowEndpoints(HORIZONTAL, true, false, 6);
    expect(out[0]).toBe(6);
    expect(out[1]).toBe(100);
  });

  it("gap 이 0 이면 테두리에 딱 붙는다", () => {
    expect(adjustArrowEndpoints(HORIZONTAL, true, true, 0)).toEqual(HORIZONTAL);
  });

  it("축 정렬 경로는 보정 후에도 축 정렬이다", () => {
    // 엘보우 경로: 수평 → 수직 → 수평
    const elbow = [0, 0, 100, 0, 100, 200, 300, 200];
    const out = adjustArrowEndpoints(elbow, true, true, 6);

    for (let i = 0; i < out.length - 2; i += 2) {
      const sameX = Math.abs(out[i]! - out[i + 2]!) < 1e-9;
      const sameY = Math.abs(out[i + 1]! - out[i + 3]!) < 1e-9;
      expect(sameX || sameY).toBe(true);
    }
  });

  it("마지막 구간이 gap 보다 짧으면 당기지 않는다 (선이 뒤집히는 것 방지)", () => {
    const tiny = [0, 0, 100, 0, 100, 2]; // 마지막 구간 길이 2
    const out = adjustArrowEndpoints(tiny, false, true, 6);
    expect(out).toEqual(tiny);
  });

  it("원본 배열을 변경하지 않는다", () => {
    const src = [...HORIZONTAL];
    adjustArrowEndpoints(src, true, true, 6);
    expect(src).toEqual(HORIZONTAL);
  });

  it("점이 2개 미만이면 그대로 반환한다", () => {
    expect(adjustArrowEndpoints([1, 2], true, true)).toEqual([1, 2]);
  });

  it("기본 gap 은 화살촉이 떨어져 보이지 않을 만큼 작다", () => {
    // 6px 이었을 때 '연결이 안 된 것처럼' 보인다는 피드백이 있었다
    expect(ARROW_GAP).toBeLessThanOrEqual(2);
  });
});
