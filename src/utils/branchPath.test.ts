import { describe, it, expect } from "vitest";
import {
  computeBranchPaths,
  computeJunction,
  isBranchConnector,
} from "./branchPath";

const start = { x: 100, y: 100 };

describe("computeJunction", () => {
  it("아래로 흐르면 소스와 가장 가까운 타깃 사이에 놓인다", () => {
    const j = computeJunction({
      start,
      sourceAnchor: "bottom",
      targets: [
        { id: "a", point: { x: 0, y: 300 } },
        { id: "b", point: { x: 200, y: 500 } },
      ],
      junctionT: 0.5,
    });
    // 가장 가까운 타깃(y=300) 기준 중간 → 200. x 는 줄기라 소스와 같다.
    expect(j).toEqual({ x: 100, y: 200 });
  });

  it("junctionT 로 분기점을 옮긴다", () => {
    const near = computeJunction({
      start,
      sourceAnchor: "bottom",
      targets: [{ id: "a", point: { x: 0, y: 300 } }],
      junctionT: 0.2,
    });
    const far = computeJunction({
      start,
      sourceAnchor: "bottom",
      targets: [{ id: "a", point: { x: 0, y: 300 } }],
      junctionT: 0.8,
    });
    expect(near.y).toBeLessThan(far.y);
  });

  it("소스·타깃에 붙지 않게 최소 스텁을 남긴다", () => {
    const j = computeJunction({
      start,
      sourceAnchor: "bottom",
      targets: [{ id: "a", point: { x: 0, y: 300 } }],
      junctionT: 0, // 소스에 딱 붙이려는 값
    });
    expect(j.y).toBeGreaterThan(start.y);
    expect(j.y).toBeLessThan(300);
  });

  it("가로 흐름이면 x 축에서 나뉜다", () => {
    const j = computeJunction({
      start,
      sourceAnchor: "right",
      targets: [{ id: "a", point: { x: 500, y: 0 } }],
      junctionT: 0.5,
    });
    expect(j.y).toBe(start.y);
    expect(j.x).toBe(300);
  });

  it("위로 흐르면 분기점이 소스보다 위에 온다", () => {
    const j = computeJunction({
      start,
      sourceAnchor: "top",
      targets: [{ id: "a", point: { x: 0, y: -200 } }],
      junctionT: 0.5,
    });
    expect(j.y).toBeLessThan(start.y);
  });
});

describe("computeBranchPaths", () => {
  const input = {
    start,
    sourceAnchor: "bottom" as const,
    targets: [
      { id: "a", point: { x: 0, y: 400 }, anchor: "top" as const },
      { id: "b", point: { x: 300, y: 400 }, anchor: "top" as const },
    ],
    pathStyle: "elbowed" as const,
  };

  it("줄기는 소스에서 분기점까지 한 번만 그린다", () => {
    const r = computeBranchPaths(input);
    expect(r.trunk).toEqual([
      start.x,
      start.y,
      r.junction.x,
      r.junction.y,
    ]);
  });

  it("갈래는 타깃 수만큼이고 입력 순서를 지킨다", () => {
    const r = computeBranchPaths(input);
    expect(r.branches.map((b) => b.id)).toEqual(["a", "b"]);
  });

  it("모든 갈래가 분기점에서 출발한다 — 줄기 구간이 겹쳐 그려지지 않는다", () => {
    const r = computeBranchPaths(input);
    for (const b of r.branches) {
      expect(b.points[0]).toBe(r.junction.x);
      expect(b.points[1]).toBe(r.junction.y);
    }
  });

  it("갈래 끝점은 타깃 좌표다", () => {
    const r = computeBranchPaths(input);
    for (const [i, b] of r.branches.entries()) {
      const n = b.points.length;
      expect(b.points[n - 2]).toBe(input.targets[i]!.point.x);
      expect(b.points[n - 1]).toBe(input.targets[i]!.point.y);
    }
  });

  it("straight 스타일이면 갈래가 직선 2점이다", () => {
    const r = computeBranchPaths({ ...input, pathStyle: "straight" });
    for (const b of r.branches) expect(b.points).toHaveLength(4);
  });

  it("타깃이 없으면 줄기가 소스 자리에 머문다", () => {
    const r = computeBranchPaths({ ...input, targets: [] });
    expect(r.junction).toEqual(start);
    expect(r.branches).toEqual([]);
  });
});

describe("isBranchConnector", () => {
  it("targetIds 가 있는 커넥터만 분기로 본다", () => {
    expect(isBranchConnector({ type: "connector", targetIds: ["a"] })).toBe(
      true,
    );
    expect(isBranchConnector({ type: "connector", targetIds: [] })).toBe(false);
    expect(isBranchConnector({ type: "connector" })).toBe(false);
    expect(isBranchConnector({ type: "shape", targetIds: ["a"] })).toBe(false);
  });
});
