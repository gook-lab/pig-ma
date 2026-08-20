import { describe, it, expect } from "vitest";
import { calculateElbowPath, getSegments } from "./elbowPath";
import type { ElbowBend } from "@/types";

/**
 * 저장된 bend 가 있어도 커넥터는 **앵커 바깥 방향으로 나가고 들어와야** 한다.
 *
 * 앵커 법선 라우팅은 getBaseElbowPoints(=bend 가 없을 때)에만 적용돼 있었다.
 * bend 가 있으면 applyBends 가 경로를 만드는데 거긴 앵커를 보지 않아서,
 * 왼쪽 변에 붙은 커넥터가 오른쪽으로 나가며 도형을 관통했다.
 */

interface Pt {
  x: number;
  y: number;
}

function path(
  start: Pt,
  end: Pt,
  bends: ElbowBend[],
  sourceAnchor?: string,
  targetAnchor?: string,
): Pt[] {
  const flat = (calculateElbowPath as unknown as (...a: unknown[]) => number[])(
    start,
    end,
    bends,
    sourceAnchor,
    targetAnchor,
  );
  const out: Pt[] = [];
  for (let i = 0; i < flat.length; i += 2)
    out.push({ x: flat[i]!, y: flat[i + 1]! });
  return out;
}

function isAxisAligned(p: Pt[]): boolean {
  const EPS = 1e-6;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i]!;
    const b = p[i + 1]!;
    if (Math.abs(a.x - b.x) > EPS && Math.abs(a.y - b.y) > EPS) return false;
  }
  return true;
}

function hasReversal(p: Pt[]): boolean {
  const segs = getSegments(p.flatMap((q) => [q.x, q.y]));
  for (let i = 1; i < segs.length; i++) {
    const a = segs[i - 1]!;
    const b = segs[i]!;
    if (a.direction !== b.direction) continue;
    const da =
      a.direction === "horizontal" ? a.end.x - a.start.x : a.end.y - a.start.y;
    const db =
      b.direction === "horizontal" ? b.end.x - b.start.x : b.end.y - b.start.y;
    if (da * db < 0) return true;
  }
  return false;
}

const START = { x: 300, y: 200 };
const END = { x: 1000, y: 700 };

const bend = (over: Partial<ElbowBend> = {}): ElbowBend =>
  ({
    segmentIndex: 0,
    offset: 0,
    region: "primary",
    elbowY: 400,
    leftCornerX: 500,
    rightCornerX: 800,
    ...over,
  }) as ElbowBend;

describe("소스 앵커 방향으로 출발한다", () => {
  it("left 앵커면 왼쪽으로 나간다 (도형을 관통하지 않는다)", () => {
    const p = path(START, END, [bend()], "left", "left");
    expect(p[1]!.x).toBeLessThan(START.x);
  });

  it("right 앵커면 오른쪽으로 나간다 (기존 동작 유지)", () => {
    const p = path(START, END, [bend()], "right", "left");
    expect(p[1]!.x).toBeGreaterThan(START.x);
  });

  it("left 앵커로 나가도 저작한 코너/엘보우는 유지된다", () => {
    const p = path(START, END, [bend()], "left", "left");
    expect(p.some((q) => Math.abs(q.y - 400) < 1)).toBe(true); // elbowY
    expect(p.some((q) => Math.abs(q.x - 500) < 1)).toBe(true); // leftCornerX
    expect(p.some((q) => Math.abs(q.x - 800) < 1)).toBe(true); // rightCornerX
  });

  it("left 앵커 경로도 축 정렬이고 왕복하지 않는다", () => {
    const p = path(START, END, [bend()], "left", "left");
    expect(isAxisAligned(p)).toBe(true);
    expect(hasReversal(p)).toBe(false);
    expect(p[0]).toEqual(START);
    expect(p[p.length - 1]).toEqual(END);
  });
});

// 타깃(도착) 쪽은 의도적으로 제외한다.
//
// 같은 규칙을 적용하면 X축 반전 동작("저작한 모양은 그대로, 마지막 연결선
// 방향만 바뀐다")과 충돌한다. 타깃이 코너보다 앞이면 오른쪽에서 진입하는
// 것이 자연스럽고, 앵커 법선으로 강제하면 불필요한 우회가 생긴다.
describe("타깃 쪽은 기존 동작을 유지한다", () => {
  it("타깃 앵커를 바꿔도 도착 경로는 그대로다", () => {
    const a = path(START, END, [bend()], "right", "left");
    const b = path(START, END, [bend()], "right", "right");
    expect(b).toEqual(a);
  });
});

describe("계단이 있어도 유지된다", () => {
  it("left 앵커 + 좌측 계단", () => {
    const p = path(
      START,
      END,
      [bend({ leftY: 300, midLeftX: 400 })],
      "left",
      "left",
    );
    expect(p[1]!.x).toBeLessThan(START.x);
    expect(isAxisAligned(p)).toBe(true);
    expect(hasReversal(p)).toBe(false);
    expect(p[p.length - 1]).toEqual(END);
  });

  it("right 앵커 + 우측 계단 (회귀)", () => {
    const p = path(
      START,
      END,
      [bend({ rightY: 600, midRightX: 900 })],
      "right",
      "left",
    );
    expect(p.some((q) => Math.abs(q.x - 900) < 1)).toBe(true);
    expect(hasReversal(p)).toBe(false);
  });
});

describe("앵커가 없으면 예전 동작 그대로", () => {
  it("앵커 미지정 시 경로가 바뀌지 않는다", () => {
    const withAnchor = path(START, END, [bend()], "right", "left");
    const without = path(START, END, [bend()]);
    expect(without).toEqual(withAnchor);
  });
});
