import { describe, it, expect } from "vitest";
import {
  adjustLeftCornerX,
  adjustRightCornerX,
  adjustMidLeftX,
  adjustMidRightX,
  moveElbowX,
  adjustStairStepMidX,
} from "./elbowHandlers";
import type { ElbowBend } from "@/types";

/**
 * 드래그 시점 제약은 렌더 시점 보정과 **같은 기준**을 써야 한다.
 *
 * 렌더는 저작값을 코너 기준으로만 보정하도록 고쳤는데(applyBends), 드래그는
 * 여전히 끝점(startX/endX)으로 잘랐다. 그래서 타깃을 옮겨 놓은 뒤 핸들을
 * 살짝만 건드려도 저작한 계단이 끝점 안으로 찌그러졌다.
 *
 * 핵심 계약: **0px 드래그는 아무것도 바꾸지 않는다.**
 * 값이 현재 범위 밖이더라도 사용자가 실제로 끌지 않았다면 손대면 안 된다.
 */

const START_X = 300;
const END_X = 500; // 타깃이 왼쪽으로 와서 코너/혹보다 앞에 있는 상태

const authored = (over: Partial<ElbowBend> = {}): ElbowBend =>
  ({
    segmentIndex: 0,
    offset: 0,
    region: "primary",
    elbowY: 300,
    leftCornerX: 450,
    rightCornerX: 700, // END_X(500) 보다 오른쪽 — 저작 당시엔 유효했다
    rightY: 150,
    midRightX: 800, // 코너 밖의 '혹'
    leftY: 250,
    midLeftX: 380,
    ...over,
  }) as ElbowBend;

describe("0px 드래그는 저작값을 바꾸지 않는다", () => {
  it("adjustMidRightX", () => {
    const b = authored();
    const out = adjustMidRightX(b, 0, {
      minX: b.rightCornerX!,
      maxX: END_X,
    });
    expect(out.midRightX).toBe(800);
  });

  it("adjustRightCornerX", () => {
    const b = authored();
    const out = adjustRightCornerX(b, 0, {
      minX: b.leftCornerX!,
      maxX: END_X,
    });
    expect(out.rightCornerX).toBe(700);
  });

  it("adjustMidLeftX", () => {
    const b = authored({ midLeftX: 200 }); // startX(300) 보다 왼쪽
    const out = adjustMidLeftX(b, 0, {
      minX: START_X,
      maxX: b.leftCornerX!,
    });
    expect(out.midLeftX).toBe(200);
  });

  it("adjustLeftCornerX", () => {
    const b = authored({ leftCornerX: 250 }); // startX 보다 왼쪽
    const out = adjustLeftCornerX(b, 0, {
      minX: START_X,
      maxX: b.rightCornerX!,
    });
    expect(out.leftCornerX).toBe(250);
  });

  it("moveElbowX", () => {
    const b = authored();
    const out = moveElbowX(b, 0, { minX: START_X, maxX: END_X });
    expect(out.leftCornerX).toBe(450);
    expect(out.rightCornerX).toBe(700);
  });
});

describe("드래그한 만큼은 정확히 반영된다", () => {
  it("범위 안에서는 그대로 더해진다", () => {
    const b = authored({ midRightX: 750 });
    const out = adjustMidRightX(b, 30, { minX: b.rightCornerX!, maxX: 2000 });
    expect(out.midRightX).toBe(780);
  });

  it("범위 밖에 있던 값도 드래그한 만큼 움직인다", () => {
    const b = authored(); // midRightX 800, endX 500
    const out = adjustMidRightX(b, -50, {
      minX: b.rightCornerX!,
      maxX: END_X,
    });
    expect(out.midRightX).toBe(750);
  });
});

describe("코너를 넘어가는 것만 막는다 (역주행 방지)", () => {
  it("midRightX 는 rightCornerX 왼쪽으로 못 간다", () => {
    const b = authored({ midRightX: 720 });
    const out = adjustMidRightX(b, -100, {
      minX: b.rightCornerX!,
      maxX: END_X,
    });
    expect(out.midRightX!).toBeGreaterThanOrEqual(b.rightCornerX!);
  });

  it("midLeftX 는 leftCornerX 오른쪽으로 못 간다", () => {
    const b = authored({ midLeftX: 430 });
    const out = adjustMidLeftX(b, 100, {
      minX: START_X,
      maxX: b.leftCornerX!,
    });
    expect(out.midLeftX!).toBeLessThanOrEqual(b.leftCornerX!);
  });

  it("두 코너는 서로를 넘지 않는다", () => {
    const b = authored();
    const left = adjustLeftCornerX(b, 500, {
      minX: START_X,
      maxX: b.rightCornerX!,
    });
    expect(left.leftCornerX!).toBeLessThan(b.rightCornerX!);

    const right = adjustRightCornerX(b, -500, {
      minX: b.leftCornerX!,
      maxX: END_X,
    });
    expect(right.rightCornerX!).toBeGreaterThan(b.leftCornerX!);
  });
});

describe("끝점은 드래그를 제한하지 않는다", () => {
  it("타깃 너머로도 혹을 끌 수 있다", () => {
    const b = authored({ midRightX: 750 });
    const out = adjustMidRightX(b, 400, {
      minX: b.rightCornerX!,
      maxX: END_X, // 500 — 훨씬 못 미친다
    });
    expect(out.midRightX).toBe(1150);
  });

  it("코너도 타깃 너머로 갈 수 있다", () => {
    const b = authored({ rightCornerX: 700 });
    const out = adjustRightCornerX(b, 300, {
      minX: b.leftCornerX!,
      maxX: END_X,
    });
    expect(out.rightCornerX).toBe(1000);
  });
});

describe("다른 필드는 건드리지 않는다", () => {
  it.each([
    [
      "adjustMidRightX",
      (b: ElbowBend) =>
        adjustMidRightX(b, 40, { minX: b.rightCornerX!, maxX: END_X }),
    ],
    [
      "adjustMidLeftX",
      (b: ElbowBend) =>
        adjustMidLeftX(b, -40, { minX: START_X, maxX: b.leftCornerX! }),
    ],
    [
      "adjustRightCornerX",
      (b: ElbowBend) =>
        adjustRightCornerX(b, 40, { minX: b.leftCornerX!, maxX: END_X }),
    ],
    [
      "adjustLeftCornerX",
      (b: ElbowBend) =>
        adjustLeftCornerX(b, -40, { minX: START_X, maxX: b.rightCornerX! }),
    ],
  ])("%s 는 elbowY/rightY/leftY 를 보존한다", (_n, fn) => {
    const b = authored();
    const out = fn(b);
    expect(out.elbowY).toBe(b.elbowY);
    expect(out.rightY).toBe(b.rightY);
    expect(out.leftY).toBe(b.leftY);
  });

  it("원본을 변경하지 않는다", () => {
    const b = authored();
    const snapshot = JSON.stringify(b);
    adjustMidRightX(b, 100, { minX: b.rightCornerX!, maxX: END_X });
    expect(JSON.stringify(b)).toBe(snapshot);
  });
});

describe("연속 계단 층의 중간선도 코너 기준이다", () => {
  const withSteps = authored({
    leftYSteps: [{ y: 230, midX: 200 }], // startX(300) 보다 왼쪽
    rightYSteps: [{ y: 370, midX: 900 }], // endX(500) 보다 오른쪽
  });

  it("0px 드래그는 좌측 층을 바꾸지 않는다", () => {
    const out = adjustStairStepMidX(withSteps, "left", 0, 0, 450);
    expect(out.leftYSteps![0]!.midX).toBe(200);
  });

  it("0px 드래그는 우측 층을 바꾸지 않는다", () => {
    const out = adjustStairStepMidX(withSteps, "right", 0, 0, 700);
    expect(out.rightYSteps![0]!.midX).toBe(900);
  });

  it("드래그한 만큼 움직인다", () => {
    expect(
      adjustStairStepMidX(withSteps, "right", 0, 50, 700).rightYSteps![0]!.midX,
    ).toBe(950);
  });

  it("코너는 넘지 않는다", () => {
    // 좌측 층은 코너(450) 오른쪽으로 못 간다
    expect(
      adjustStairStepMidX(withSteps, "left", 0, 999, 450).leftYSteps![0]!.midX!,
    ).toBeLessThanOrEqual(450);
    // 우측 층은 코너(700) 왼쪽으로 못 간다
    expect(
      adjustStairStepMidX(withSteps, "right", 0, -999, 700).rightYSteps![0]!
        .midX!,
    ).toBeGreaterThanOrEqual(700);
  });

  it("다른 층과 원본은 건드리지 않는다", () => {
    const two = authored({
      leftYSteps: [
        { y: 230, midX: 200 },
        { y: 245, midX: 260 },
      ],
    });
    const snapshot = JSON.stringify(two);
    const out = adjustStairStepMidX(two, "left", 0, 30, 450);

    expect(out.leftYSteps![1]!.midX).toBe(260);
    expect(JSON.stringify(two)).toBe(snapshot);
  });

  it("없는 층 인덱스는 무시한다", () => {
    expect(adjustStairStepMidX(withSteps, "left", 9, 50, 450)).toBe(withSteps);
  });
});

// ---------------------------------------------------------------------------
// 전수 감사에서 확인된 잔여 3건 — 전부 같은 뿌리("저작값이 규칙의 전제
// 반대편에 있을 때")의 마지막 변주들
// ---------------------------------------------------------------------------

describe("코너 드래그도 현재값 기준 방향을 따른다 (역전 저작)", () => {
  // 반전 span 에서 구공식으로 만들어진 역전 코너 (left > right)
  const inverted = authored({
    leftCornerX: 700,
    rightCornerX: 400,
  });

  it("0px 드래그는 코너를 바꾸지 않는다", () => {
    const l = adjustLeftCornerX(inverted, 0, { minX: 900, maxX: 400 });
    const r = adjustRightCornerX(inverted, 0, { minX: 700, maxX: 100 });
    expect(l.leftCornerX).toBe(700);
    expect(r.rightCornerX).toBe(400);
  });

  it("드래그한 만큼 움직이고, 반대 코너 통과만 막는다", () => {
    const l = adjustLeftCornerX(inverted, -50, { minX: 900, maxX: 400 });
    expect(l.leftCornerX).toBe(650);
    // 역전 상태: left(700)는 right(400)보다 큰 쪽 → 400+20 아래로는 못 감
    const crossed = adjustLeftCornerX(inverted, -999, { minX: 900, maxX: 400 });
    expect(crossed.leftCornerX!).toBeGreaterThanOrEqual(420);
  });
});

describe("moveElbowX — 코너가 span 밖에 저작돼 있으면 클램프하지 않는다", () => {
  it("반전 span 밖의 엘보우도 delta 만큼만 움직인다", () => {
    const beyond = authored({ leftCornerX: 551, rightCornerX: 600 });
    const out = moveElbowX(beyond, 1, { minX: 534, maxX: 293 });
    expect(out.leftCornerX).toBe(552);
    expect(out.rightCornerX).toBe(601);
  });

  it("정상 범위 안에서는 기존 클램프가 유지된다 (회귀)", () => {
    const inside = authored({ leftCornerX: 350, rightCornerX: 450 });
    const out = moveElbowX(inside, 999, { minX: 300, maxX: 500 });
    expect(out.rightCornerX!).toBeLessThanOrEqual(490);
  });
});

describe("defaultCorners — 어느 방향이든 left < right", () => {
  it("정방향", async () => {
    const { defaultCorners } = await import("./elbowHandlers");
    expect(defaultCorners(100, 500)).toEqual({
      leftCornerX: 200,
      rightCornerX: 400,
    });
  });

  it("반전 span 에서도 역전되지 않는다", async () => {
    const { defaultCorners, createElbowFromStraight } =
      await import("./elbowHandlers");
    const c = defaultCorners(534, 293);
    expect(c.leftCornerX).toBeLessThan(c.rightCornerX);

    const bend = createElbowFromStraight(534, 400, 293, 400, 60)!;
    expect(bend.leftCornerX!).toBeLessThan(bend.rightCornerX!);
  });
});
