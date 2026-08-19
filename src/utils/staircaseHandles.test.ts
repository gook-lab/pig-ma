import { describe, it, expect } from "vitest";
import {
  calculateElbowPath,
  getSegments,
  getMidpointHandlePositions,
} from "./elbowPath";
import { adjustStairStepY, removeStairStep } from "./elbowHandlers";
import type { ElbowBend } from "@/types";

/**
 * 연속 계단(leftYSteps / rightYSteps)의 조작 핸들.
 *
 * 렌더링은 예전부터 되고 있었지만 핸들 생성이 막혀 있어서, 계단이 여러 층인
 * 구조에서는 **중간 층을 잡을 수가 없었다**. 눈에는 보이는데 손댈 수 없는 상태.
 *
 * 핵심 불변식: 수평 세그먼트 하나에는 그것을 조절할 수 있는 center 핸들이
 * 하나씩 있어야 한다.
 */

const START = { x: 100, y: 200 };
const END = { x: 900, y: 400 };

function handlesFor(bend: ElbowBend) {
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
    handles: getMidpointHandlePositions(segs, [bend], START.y, END.y),
  };
}

const base = (over: Partial<ElbowBend> = {}): ElbowBend =>
  ({
    segmentIndex: 0,
    offset: 100,
    region: "primary",
    elbowY: 300,
    leftCornerX: 400,
    rightCornerX: 700,
    ...over,
  }) as ElbowBend;

describe("기본 ㄷ자 (회귀)", () => {
  it("중앙 수평선에 primary 핸들이 하나 있다", () => {
    const { handles } = handlesFor(base());
    const primary = handles.filter(
      (h) => h.handleType === "center" && h.region === "primary",
    );
    expect(primary).toHaveLength(1);
  });
});

describe("단일 계단", () => {
  it("좌측 계단이 생기면 좌측 핸들이 있다", () => {
    const { handles } = handlesFor(base({ leftY: 250, midLeftX: 250 }));
    expect(
      handles.some((h) => h.handleType === "center" && h.region === "left"),
    ).toBe(true);
  });
});

describe("연속 계단 — 모든 수평 구간이 조작 가능해야 한다", () => {
  const bend = base({
    leftY: 250,
    midLeftX: 340,
    leftYSteps: [{ y: 225, midX: 200 }],
  });

  it("논리적 수평 구간(고유 Y)마다 center 핸들이 하나씩 있다", () => {
    // 같은 Y 로 연속된 조각(계단 사슬의 연결부)은 시각적으로 한 직선이라
    // 핸들도 하나여야 한다 — 두 개면 겹친 유령 핸들이 된다.
    const { segs, handles } = handlesFor(bend);
    const uniqueYs = new Set(
      segs
        .filter((s) => s.direction === "horizontal")
        .map((s) => Math.round(s.start.y)),
    );
    const centers = handles.filter((h) => h.handleType === "center");

    expect(centers).toHaveLength(uniqueYs.size);
  });

  it("각 계단 층이 자기 stepIndex 를 갖는다", () => {
    const { handles } = handlesFor(bend);
    const stepHandles = handles.filter(
      (h) => h.handleType === "center" && h.stepIndex !== undefined,
    );

    expect(stepHandles.length).toBeGreaterThan(0);
    expect(stepHandles.map((h) => h.stepIndex)).toContain(0);
  });

  it("계단 층 핸들은 Y 조절이 가능하다", () => {
    const { handles } = handlesFor(bend);
    const stepHandle = handles.find(
      (h) => h.handleType === "center" && h.stepIndex === 0,
    );

    expect(stepHandle?.canAdjustY).toBe(true);
    expect(stepHandle?.region).toBe("left");
  });

  it("핸들 위치가 해당 세그먼트 위에 있다", () => {
    const { segs, handles } = handlesFor(bend);
    const horizontal = segs.filter((s) => s.direction === "horizontal");

    for (const h of handles.filter((x) => x.handleType === "center")) {
      const onSome = horizontal.some(
        (s) =>
          Math.abs(s.start.y - h.y) < 1 &&
          h.x >= Math.min(s.start.x, s.end.x) - 1 &&
          h.x <= Math.max(s.start.x, s.end.x) + 1,
      );
      expect(onSome).toBe(true);
    }
  });

  it("계단이 두 층이어도 각각 핸들이 생긴다", () => {
    const { handles } = handlesFor(
      base({
        leftY: 260,
        midLeftX: 360,
        leftYSteps: [
          { y: 230, midX: 180 },
          { y: 245, midX: 270 },
        ],
      }),
    );
    const stepIdxs = handles
      .filter((h) => h.handleType === "center" && h.stepIndex !== undefined)
      .map((h) => h.stepIndex);

    expect(stepIdxs).toContain(0);
    expect(stepIdxs).toContain(1);
  });

  it("우측 연속 계단도 동일하게 동작한다", () => {
    const { segs, handles } = handlesFor(
      base({
        rightY: 350,
        midRightX: 800,
        rightYSteps: [{ y: 375, midX: 860 }],
      }),
    );
    const uniqueYs = new Set(
      segs
        .filter((s) => s.direction === "horizontal")
        .map((s) => Math.round(s.start.y)),
    );
    const centers = handles.filter((h) => h.handleType === "center");

    expect(centers).toHaveLength(uniqueYs.size);
    expect(centers.some((h) => h.region === "right" && h.stepIndex === 0)).toBe(
      true,
    );
  });

  it("핸들 좌표에 NaN 이 없다", () => {
    const { handles } = handlesFor(bend);
    for (const h of handles) {
      expect(Number.isFinite(h.x)).toBe(true);
      expect(Number.isFinite(h.y)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 계단 층 조절 헬퍼
// ---------------------------------------------------------------------------

describe("계단 층 조절", () => {
  const bend = base({
    leftY: 260,
    leftYSteps: [
      { y: 230, midX: 180 },
      { y: 245, midX: 270 },
    ],
  });

  it("지정한 층만 움직인다", () => {
    const out = adjustStairStepY(bend, "left", 0, 210);

    expect(out.leftYSteps![0]!.y).toBe(210);
    expect(out.leftYSteps![1]!.y).toBe(245); // 다른 층은 그대로
    expect(out.leftY).toBe(260); // 기본 계단도 그대로
  });

  it("midX 는 보존된다", () => {
    const out = adjustStairStepY(bend, "left", 1, 300);
    expect(out.leftYSteps![1]!.midX).toBe(270);
  });

  it("범위 밖 인덱스는 무시한다", () => {
    expect(adjustStairStepY(bend, "left", 9, 100)).toBe(bend);
    expect(adjustStairStepY(bend, "left", -1, 100)).toBe(bend);
  });

  it("원본을 변경하지 않는다", () => {
    const snapshot = JSON.stringify(bend);
    adjustStairStepY(bend, "left", 0, 999);
    expect(JSON.stringify(bend)).toBe(snapshot);
  });

  it("층을 제거하면 나머지가 앞으로 당겨진다", () => {
    const out = removeStairStep(bend, "left", 0);

    expect(out.leftYSteps).toHaveLength(1);
    expect(out.leftYSteps![0]!.y).toBe(245);
  });

  it("마지막 층을 제거하면 배열 자체가 사라진다", () => {
    const single = base({ leftYSteps: [{ y: 230, midX: 180 }] });
    const out = removeStairStep(single, "left", 0);

    expect(out.leftYSteps).toBeUndefined();
  });

  it("우측도 동일하게 동작한다", () => {
    const r = base({ rightYSteps: [{ y: 370, midX: 800 }] });
    expect(adjustStairStepY(r, "right", 0, 390).rightYSteps![0]!.y).toBe(390);
    expect(removeStairStep(r, "right", 0).rightYSteps).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 수평(center) 핸들의 정체성 — 수직 핸들과 같은 원칙
//
// start/end 세그먼트가 기존 leftY/rightY 와 같은 region 을 받으면, 끝 쪽
// 수평선을 끌었을 때 기존 계단(훅)이 움직인다 (실제 사용자 리포트 재구성:
// X반전 + 좌측 계단 + 우측 훅 구조).
// 이미 계단이 있는 쪽의 start/end 세그먼트는 '새 층 생성'(newLeft/newRight)
// 이어야 한다.
// ---------------------------------------------------------------------------

describe("수평 핸들도 각자 자기 저장값을 가리킨다 (X반전 리포트 재구성)", () => {
  const start = { x: 370, y: 188 };
  const end = { x: 127, y: 768 };
  const bend = base({
    leftY: 275,
    midLeftX: 497,
    leftCornerX: 625,
    elbowY: 429,
    rightCornerX: 792,
    rightY: 819,
    midRightX: 644,
  });

  function centerHandles() {
    const flat = (
      calculateElbowPath as unknown as (...a: unknown[]) => number[]
    )(start, end, [bend], "sharp", 8, "right", "left");
    const segs = getSegments(flat);
    return getMidpointHandlePositions(segs, [bend], start.y, end.y).filter(
      (h) => h.handleType === "center",
    );
  }

  it("region(+stepIndex)이 서로 겹치지 않는다", () => {
    const keys = centerHandles().map(
      (h) => `${h.region}:${h.stepIndex ?? "-"}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("각 수평선이 자기 저장값에 배정된다", () => {
    const byY = new Map(
      centerHandles().map((h) => [Math.round(h.y), h.region]),
    );
    expect(byY.get(275)).toBe("left"); // leftY 세그먼트
    expect(byY.get(429)).toBe("primary"); // elbowY (반전이라 X범위 휴리스틱은 실패했었음)
    expect(byY.get(819)).toBe("right"); // rightY 훅
  });

  it("계단이 이미 있는 쪽의 start/end 세그먼트는 '새 층 생성'이다", () => {
    const byY = new Map(
      centerHandles().map((h) => [Math.round(h.y), h.region]),
    );
    expect(byY.get(188)).toBe("newLeft"); // 기존 leftY 를 움직이면 안 된다
    expect(byY.get(768)).toBe("newRight"); // 기존 rightY 훅을 움직이면 안 된다
  });

  it("계단이 없는 단순 ㄷ자에서는 기존 동작 그대로다 (회귀)", () => {
    const plain = base({ elbowY: 300, leftCornerX: 400, rightCornerX: 700 });
    const flat = (
      calculateElbowPath as unknown as (...a: unknown[]) => number[]
    )(
      { x: 100, y: 200 },
      { x: 900, y: 400 },
      [plain],
      "sharp",
      8,
      "right",
      "left",
    );
    const hs = getMidpointHandlePositions(
      getSegments(flat),
      [plain],
      200,
      400,
    ).filter((h) => h.handleType === "center");
    const regions = hs.map((h) => h.region).sort();

    // 첫 계단 생성은 여전히 left/right 로 (adjustLeftY/adjustRightY 가 생성)
    expect(regions).toEqual(["left", "primary", "right"]);
  });
});

describe("새 층 삽입 위치 (addStairStep)", () => {
  it("newLeft 는 맨 앞에 끼운다 — 첫 층이 start 세그먼트에서 꺾인다", async () => {
    const { addStairStep } = await import("./elbowHandlers");
    const b = base({
      leftY: 300,
      leftYSteps: [{ y: 250, midX: 200 }],
    });
    const out = addStairStep(b, "left", 220, 150, "start");

    expect(out.leftYSteps!.map((s) => s.y)).toEqual([220, 250]);
  });

  it("newRight 는 맨 뒤에 붙인다 — 마지막 층이 end 세그먼트에서 꺾인다", async () => {
    const { addStairStep } = await import("./elbowHandlers");
    const b = base({
      rightY: 350,
      rightYSteps: [{ y: 370, midX: 800 }],
    });
    const out = addStairStep(b, "right", 390, 860, "end");

    expect(out.rightYSteps!.map((s) => s.y)).toEqual([370, 390]);
  });
});

describe("반전 배치에서 새 층이 실제로 그려진다 (종단간)", () => {
  const start = { x: 370, y: 188 };
  const end = { x: 127, y: 768 };
  const authored = base({
    leftY: 275,
    midLeftX: 497,
    leftCornerX: 625,
    elbowY: 429,
    rightCornerX: 792,
    rightY: 819,
    midRightX: 644,
  });

  function draw(b: ElbowBend): { xs: number[]; ys: number[] } {
    const flat = (
      calculateElbowPath as unknown as (...a: unknown[]) => number[]
    )(start, end, [b], "sharp", 8, "right", "left");
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < flat.length; i += 2) {
      xs.push(flat[i]!);
      ys.push(flat[i + 1]!);
    }
    return { xs, ys };
  }

  it("end 세그먼트 드래그(newRight)로 만든 층이 경로에 나타난다", async () => {
    const { addStairStep } = await import("./elbowHandlers");
    const dragged = addStairStep(authored, "right", 728, 385, "end");

    const { ys } = draw(dragged);
    expect(ys).toContain(728); // 새 층
    expect(ys).toContain(819); // 기존 훅은 그대로
  });

  it("기존 훅(rightY)은 새 층 생성으로 움직이지 않는다", async () => {
    const { addStairStep } = await import("./elbowHandlers");
    const dragged = addStairStep(authored, "right", 728, 385, "end");
    expect(dragged.rightY).toBe(819);
  });

  it("반전에서 좌측 층(leftYSteps)도 렌더된다", () => {
    const withLeftStep = base({
      leftY: 300,
      midLeftX: 480,
      leftCornerX: 625,
      elbowY: 429,
      rightCornerX: 792,
      leftYSteps: [{ y: 240, midX: 430 }],
    });
    const { ys, xs } = draw(withLeftStep);
    expect(ys).toContain(240);
    expect(xs).toContain(430);
  });

  it("층이 있어도 축 정렬이 유지된다", async () => {
    const { addStairStep } = await import("./elbowHandlers");
    const dragged = addStairStep(authored, "right", 728, 385, "end");
    const flat = (
      calculateElbowPath as unknown as (...a: unknown[]) => number[]
    )(start, end, [dragged], "sharp", 8, "right", "left");

    for (let i = 0; i + 3 < flat.length; i += 2) {
      const sameX = Math.abs(flat[i]! - flat[i + 2]!) < 1e-6;
      const sameY = Math.abs(flat[i + 1]! - flat[i + 3]!) < 1e-6;
      expect(sameX || sameY).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 수평 분류의 X-휴리스틱 잔재 — top 앵커 + 코너가 왼쪽 끝에 온 배치
//
// rightCornerX 가 경로의 왼쪽 끝(타깃 위 진입)에 오면 isRightRegion 이
// 거의 모든 세그먼트에 참이 되어, 계단 층 가드(!isRightRegion)와 elbowY 의
// isCenterRegion 요구가 전부 거부됐다 — 중앙·계단 핸들이 통째로 사라졌다
// (실제 사용자 리포트 재구성).
// ---------------------------------------------------------------------------

describe("코너가 어디에 있든 수평 핸들은 Y-정체로 배정된다", () => {
  const start = { x: 585, y: 141 };
  const end = { x: 404, y: 673 }; // 타깃 '위' 앵커로 수직 진입
  const bend = base({
    leftYSteps: [
      { y: 227, midX: 713 },
      { y: 380, midX: 841 },
    ],
    leftY: 615,
    midLeftX: 995,
    leftCornerX: 637,
    elbowY: 483,
    rightCornerX: 404, // 경로 왼쪽 끝 — X 휴리스틱이 무너지는 배치
  });

  function centers() {
    const flat = (
      calculateElbowPath as unknown as (...a: unknown[]) => number[]
    )(start, end, [bend], "sharp", 8, "right", "top");
    return getMidpointHandlePositions(
      getSegments(flat),
      [bend],
      start.y,
      end.y,
    ).filter((h) => h.handleType === "center");
  }

  it("elbowY 중앙 수평선에 primary 핸들이 있다", () => {
    const byY = new Map(centers().map((h) => [Math.round(h.y), h.region]));
    expect(byY.get(483)).toBe("primary");
  });

  it("계단 층들도 핸들을 받는다", () => {
    const steps = centers().filter(
      (h) => h.region === "left" && h.stepIndex !== undefined,
    );
    expect(steps.map((h) => h.stepIndex).sort()).toEqual([0, 1]);
  });

  it("모든 수평선이 핸들을 받고 서로 겹치지 않는다", () => {
    const hs = centers();
    expect(hs).toHaveLength(5); // 141/227/380/615/483
    const keys = hs.map((h) => `${h.region}:${h.stepIndex ?? "-"}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("공선 런 핸들 위치 (저작값이 같은 Y 에 겹칠 때)", () => {
  // 사용자 리포트: leftY(674)==elbowY(674) 로 사이 수직선이 길이 0 이 되면
  // 경로에 일직선 중간점(x=617)이 남아 한 직선이 두 조각이 된다.
  // 핸들이 조각 중앙(x=675)에 앉아 '중앙이 아닌 핸들'로 보였다.
  const flat = [
    345, 201, 470, 201, 470, 287, 578, 287, 578, 439, 733, 439, 733, 674, 617,
    674, 398, 674, 398, 605, 163, 605, 163, 732,
  ];
  const bend = {
    segmentIndex: 0,
    offset: 0,
    region: "primary",
    leftYSteps: [
      { y: 287, midX: 470 },
      { y: 439, midX: 578 },
    ],
    midLeftX: 733,
    leftY: 674,
    leftCornerX: 617,
    elbowY: 674,
    rightCornerX: 398,
    rightY: 605,
    midRightX: 163,
  } as unknown as Parameters<typeof getMidpointHandlePositions>[1][number];

  function handles() {
    return getMidpointHandlePositions(getSegments(flat), [bend], 201, 732);
  }

  it("공선으로 쪼개진 직선에는 핸들이 하나만 생긴다", () => {
    const onLine = handles().filter(
      (h) => h.handleType === "center" && Math.abs(h.y - 674) < 1,
    );
    expect(onLine).toHaveLength(1);
  });

  it("핸들은 조각이 아니라 직선 전체의 중앙에 놓인다", () => {
    const [h] = handles().filter(
      (h) => h.handleType === "center" && Math.abs(h.y - 674) < 1,
    );
    expect(h!.x).toBeCloseTo((733 + 398) / 2, 0); // 565.5 — 675(조각 중앙)가 아니다
  });

  it("다른 수평선들은 여전히 각자 핸들을 가진다", () => {
    const ys = handles()
      .filter((h) => h.handleType === "center")
      .map((h) => Math.round(h.y))
      .sort((a, b) => a - b);
    expect(ys).toEqual([201, 287, 439, 605, 674]);
  });
});
