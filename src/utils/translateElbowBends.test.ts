import { describe, it, expect } from "vitest";
import { translateElbowBends } from "./translateElbowBends";
import type { ElbowBend } from "@/types";

const full = (): ElbowBend[] => [
  {
    segmentIndex: 0,
    offset: 80,
    region: "primary",
    elbowY: 300,
    leftCornerX: 450,
    rightCornerX: 700,
    leftY: 250,
    rightY: 150,
    midLeftX: 380,
    midRightX: 800,
    leftYSteps: [{ y: 230, midX: 200 }],
    rightYSteps: [{ y: 370, midX: 900 }],
  } as ElbowBend,
];

describe("엘보우 평행 이동", () => {
  it("모든 X 좌표가 deltaX 만큼 움직인다", () => {
    const [b] = translateElbowBends(full(), 100, 0)!;
    expect(b!.leftCornerX).toBe(550);
    expect(b!.rightCornerX).toBe(800);
    expect(b!.midLeftX).toBe(480);
    expect(b!.midRightX).toBe(900);
    expect(b!.leftYSteps![0]!.midX).toBe(300);
    expect(b!.rightYSteps![0]!.midX).toBe(1000);
  });

  it("모든 Y 좌표가 deltaY 만큼 움직인다", () => {
    const [b] = translateElbowBends(full(), 0, -50)!;
    expect(b!.elbowY).toBe(250);
    expect(b!.leftY).toBe(200);
    expect(b!.rightY).toBe(100);
    expect(b!.leftYSteps![0]!.y).toBe(180);
    expect(b!.rightYSteps![0]!.y).toBe(320);
  });

  it("X 는 Y 를, Y 는 X 를 건드리지 않는다", () => {
    const [x] = translateElbowBends(full(), 100, 0)!;
    expect(x!.elbowY).toBe(300);

    const [y] = translateElbowBends(full(), 0, 100)!;
    expect(y!.leftCornerX).toBe(450);
  });

  it("상대값(offset)은 그대로 둔다", () => {
    const [b] = translateElbowBends(full(), 100, 100)!;
    expect(b!.offset).toBe(80);
  });

  it("없는 필드는 만들지 않는다", () => {
    const sparse: ElbowBend[] = [
      {
        segmentIndex: 0,
        offset: 0,
        region: "primary",
        elbowY: 100,
      } as ElbowBend,
    ];
    const [b] = translateElbowBends(sparse, 50, 50)!;

    expect(b!.elbowY).toBe(150);
    expect(b!.leftCornerX).toBeUndefined();
    expect(b!.midRightX).toBeUndefined();
    expect(b!.leftYSteps).toBeUndefined();
  });

  it("이동량이 0 이면 같은 배열을 그대로 반환한다", () => {
    const bends = full();
    expect(translateElbowBends(bends, 0, 0)).toBe(bends);
  });

  it("빈 값도 안전하다", () => {
    expect(translateElbowBends(undefined, 10, 10)).toBeUndefined();
    expect(translateElbowBends([], 10, 10)).toEqual([]);
  });

  it("원본을 변경하지 않는다", () => {
    const bends = full();
    const snapshot = JSON.stringify(bends);
    translateElbowBends(bends, 100, 100);
    expect(JSON.stringify(bends)).toBe(snapshot);
  });

  it("왕복하면 제자리로 돌아온다", () => {
    const bends = full();
    const there = translateElbowBends(bends, 250, -130)!;
    const back = translateElbowBends(there, -250, 130)!;
    expect(back).toEqual(bends);
  });
});
