import { describe, it, expect } from "vitest";
import {
  calculateElbowPath,
  getSegments,
  getMidpointHandlePositions,
} from "./elbowPath";
import type { ElbowBend } from "@/types";

/**
 * 수직 핸들은 서로를 침범하면 안 된다.
 *
 * 예전에는 X 좌표만으로 역할을 판정해서, 두 수직선이 같은 X 에 있으면
 * 구분이 안 됐다. 위쪽 핸들을 끌면 아래쪽 값이 바뀌었다.
 * 수직 세그먼트는 Y 구간이 서로 다르므로 그것으로 구분해야 한다.
 */

const START = { x: 100, y: 200 };
const END = { x: 1000, y: 800 };

function verticalHandles(bend: ElbowBend) {
  const flat = (calculateElbowPath as unknown as (...a: unknown[]) => number[])(
    START,
    END,
    [bend],
    "sharp",
    8,
    "right",
    "left",
  );
  const segs = getSegments(flat);
  return {
    segs,
    handles: getMidpointHandlePositions(segs, [bend], START.y, END.y).filter(
      (h) => h.handleType !== "center",
    ),
  };
}

const base = (over: Partial<ElbowBend> = {}): ElbowBend =>
  ({
    segmentIndex: 0,
    offset: 0,
    region: "primary",
    elbowY: 400,
    leftCornerX: 400,
    rightCornerX: 700,
    ...over,
  }) as ElbowBend;

describe("수직 핸들은 각자 다른 대상을 가리킨다", () => {
  it("계단 중간선이 코너와 같은 X 라도 구분된다", () => {
    // midLeftX 를 leftCornerX 와 같게 둔다 → 두 수직선이 같은 X
    const bend = base({ leftY: 300, midLeftX: 400 });
    const { handles } = verticalHandles(bend);

    const keys = handles.map(
      (h) => `${h.verticalTarget}:${h.stepIndex ?? "-"}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("연속 계단 층의 중간선이 midLeftX 와 같은 X 라도 구분된다", () => {
    const bend = base({
      leftY: 300,
      midLeftX: 250,
      leftYSteps: [{ y: 250, midX: 250 }], // midLeftX 와 동일한 X
    });
    const { handles } = verticalHandles(bend);

    const keys = handles.map(
      (h) => `${h.verticalTarget}:${h.stepIndex ?? "-"}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("두 계단 층이 같은 X 라도 stepIndex 가 다르다", () => {
    const bend = base({
      leftY: 320,
      midLeftX: 350,
      leftYSteps: [
        { y: 240, midX: 200 },
        { y: 280, midX: 200 }, // 같은 X
      ],
    });
    const { handles } = verticalHandles(bend);

    const stepHandles = handles.filter((h) => h.verticalTarget === "leftStep");
    const idxs = stepHandles.map((h) => h.stepIndex);
    expect(new Set(idxs).size).toBe(idxs.length);
  });

  it("각 수직 세그먼트마다 핸들이 하나씩 있다", () => {
    const bend = base({
      leftY: 300,
      midLeftX: 250,
      rightY: 600,
      midRightX: 850,
    });
    const { segs, handles } = verticalHandles(bend);

    const vertical = segs.filter((s) => s.direction === "vertical");
    expect(handles).toHaveLength(vertical.length);
  });

  it("핸들 위치가 자기 세그먼트 위에 있다", () => {
    const bend = base({
      leftY: 300,
      midLeftX: 250,
      rightY: 600,
      midRightX: 850,
    });
    const { segs, handles } = verticalHandles(bend);
    const vertical = segs.filter((s) => s.direction === "vertical");

    for (const h of handles) {
      const onSome = vertical.some(
        (s) =>
          Math.abs(s.start.x - h.x) < 1 &&
          h.y >= Math.min(s.start.y, s.end.y) - 1 &&
          h.y <= Math.max(s.start.y, s.end.y) + 1,
      );
      expect(onSome).toBe(true);
    }
  });

  it("기본 ㄷ자는 좌우 코너 핸들 두 개다 (회귀)", () => {
    const { handles } = verticalHandles(base());
    const targets = handles.map((h) => h.verticalTarget).sort();
    expect(targets).toEqual(["leftCorner", "rightCorner"]);
  });
});

// ---------------------------------------------------------------------------
// X축 반전 배치 — 수직 핸들은 'X 위치'가 아니라 '어느 저장값이 만든 세그먼트인가'
// 로 분류해야 한다.
//
// 반전에서는 midRightX 가 좌측 코너보다 왼쪽에 올 수 있다. X 휴리스틱은 이걸
// leftCorner 로 오인해서, 아래쪽 핸들을 끌면 위쪽 세로선이 움직였다
// (실제 사용자 리포트 재구성).
// ---------------------------------------------------------------------------

describe("X축 반전에서도 수직 핸들이 자기 세그먼트를 가리킨다", () => {
  // 스크린샷 재구성: 타깃이 소스 왼쪽 아래
  const start = { x: 252, y: 246 };
  const end = { x: 170, y: 963 };
  const bend = {
    segmentIndex: 0,
    offset: 0,
    region: "primary",
    elbowY: 537,
    leftCornerX: 550,
    rightCornerX: 735,
    rightY: 878,
    midRightX: 452, // 좌측 코너(550)보다 왼쪽 — X 휴리스틱이 무너지는 지점
  } as ElbowBend;

  function handles() {
    const flat = (
      calculateElbowPath as unknown as (...a: unknown[]) => number[]
    )(start, end, [bend], "sharp", 8, "right", "left");
    const segs = getSegments(flat);
    return getMidpointHandlePositions(segs, [bend], start.y, end.y).filter(
      (h) => h.handleType !== "center",
    );
  }

  it("verticalTarget 이 서로 겹치지 않는다", () => {
    const targets = handles().map(
      (h) => `${h.verticalTarget}:${h.stepIndex ?? "-"}`,
    );
    expect(new Set(targets).size).toBe(targets.length);
  });

  it("각 핸들이 자기 저장값을 가리킨다", () => {
    const byX = new Map(
      handles().map((h) => [Math.round(h.x), h.verticalTarget]),
    );
    expect(byX.get(550)).toBe("leftCorner");
    expect(byX.get(735)).toBe("rightCorner");
    expect(byX.get(452)).toBe("midRight"); // ← 오분류되던 지점
  });

  it("midRight 핸들의 handleType 도 right 다 (드래그 배선 일치)", () => {
    const h = handles().find((x) => Math.round(x.x) === 452)!;
    expect(h.handleType).toBe("right");
  });
});

// ---------------------------------------------------------------------------
// 반전 배치에서 midRight 드래그 클램프 — 코너 '너머'의 방향이 뒤집힌다
// ---------------------------------------------------------------------------

describe("반전 배치에서 mid 클램프는 방향을 따라간다", () => {
  it("midRightX 가 코너 왼쪽에 있어도 0px 드래그로 스냅되지 않는다", async () => {
    const { adjustMidRightX } = await import("./elbowHandlers");
    const b = {
      segmentIndex: 0,
      offset: 0,
      region: "primary",
      elbowY: 537,
      leftCornerX: 550,
      rightCornerX: 735,
      rightY: 878,
      midRightX: 452,
    } as ElbowBend;

    // 반전: endX(170) < rightCornerX(735) → mid 는 코너 '왼쪽'이 정상
    const out = adjustMidRightX(b, 0, { minX: b.rightCornerX!, maxX: 170 });
    expect(out.midRightX).toBe(452);
  });

  it("반전에서 코너를 오른쪽으로 넘어가려 하면 그때만 막는다", async () => {
    const { adjustMidRightX } = await import("./elbowHandlers");
    const b = {
      segmentIndex: 0,
      offset: 0,
      region: "primary",
      rightCornerX: 735,
      midRightX: 452,
    } as ElbowBend;

    const out = adjustMidRightX(b, 999, { minX: b.rightCornerX!, maxX: 170 });
    expect(out.midRightX!).toBeLessThanOrEqual(735);
  });

  it("정방향 동작은 그대로다 (회귀)", async () => {
    const { adjustMidRightX } = await import("./elbowHandlers");
    const b = {
      segmentIndex: 0,
      offset: 0,
      region: "primary",
      rightCornerX: 700,
      midRightX: 800,
    } as ElbowBend;

    // 정방향: endX(1000) > corner(700) → 코너 왼쪽으로 못 감
    expect(adjustMidRightX(b, 0, { minX: 700, maxX: 1000 }).midRightX).toBe(
      800,
    );
    expect(
      adjustMidRightX(b, -999, { minX: 700, maxX: 1000 }).midRightX!,
    ).toBeGreaterThanOrEqual(700);
  });
});
