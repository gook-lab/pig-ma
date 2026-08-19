import { describe, it, expect } from "vitest";
import { alignObjects, distributeObjects, isAlignable } from "./align";
import type { CanvasObject } from "@/types";

function obj(partial: Partial<CanvasObject>): CanvasObject {
  return {
    id: partial.id ?? "o1",
    type: "shape",
    x: 0,
    y: 0,
    rotation: 0,
    opacity: 1,
    width: 100,
    height: 50,
    ...partial,
  };
}

function changesOf(
  updates: { id: string; changes: Partial<CanvasObject> }[],
  id: string,
): Partial<CanvasObject> | undefined {
  return updates.find((u) => u.id === id)?.changes;
}

describe("isAlignable", () => {
  it("잠긴 객체와 도형에 붙은 커넥터는 제외한다", () => {
    expect(isAlignable(obj({ locked: true }))).toBe(false);
    expect(
      isAlignable(obj({ type: "connector", sourceId: "a", endX: 10, endY: 0 })),
    ).toBe(false);
    expect(isAlignable(obj({ type: "connector", endX: 10, endY: 0 }))).toBe(
      true,
    ); // standalone 커넥터는 대상
    expect(isAlignable(obj({}))).toBe(true);
  });
});

describe("alignObjects", () => {
  const a = obj({ id: "a", x: 0, y: 0, width: 100, height: 50 });
  const b = obj({ id: "b", x: 200, y: 100, width: 60, height: 80 });

  it("left: 가장 왼쪽 x 로 정렬", () => {
    const updates = alignObjects([a, b], "left");
    expect(changesOf(updates, "b")!.x).toBe(0);
    expect(changesOf(updates, "a")).toBeUndefined(); // 이미 정렬됨 → 변경 없음
  });

  it("right: 가장 오른쪽 모서리로 정렬", () => {
    const updates = alignObjects([a, b], "right");
    // 오른쪽 끝 = max(0+100, 200+60) = 260
    expect(changesOf(updates, "a")!.x).toBe(160);
    expect(changesOf(updates, "b")).toBeUndefined();
  });

  it("centerX: 선택 영역 중앙으로 정렬", () => {
    const updates = alignObjects([a, b], "centerX");
    // 선택 영역 [0, 260] → 중앙 130
    expect(changesOf(updates, "a")!.x).toBe(80); // 중심 50 → 130
    expect(changesOf(updates, "b")!.x).toBe(100); // 중심 230 → 130
  });

  it("top/bottom/centerY 는 y 축으로 동작", () => {
    expect(changesOf(alignObjects([a, b], "top"), "b")!.y).toBe(0);
    // 아래쪽 끝 = max(0+50, 100+80) = 180
    expect(changesOf(alignObjects([a, b], "bottom"), "a")!.y).toBe(130);
    // 중앙 90
    expect(changesOf(alignObjects([a, b], "centerY"), "a")!.y).toBe(65);
  });

  it("standalone 커넥터는 끝점도 함께 이동한다", () => {
    const conn = obj({
      id: "c",
      type: "connector",
      x: 300,
      y: 0,
      width: undefined,
      height: undefined,
      endX: 400,
      endY: 50,
    });
    const updates = alignObjects([a, conn], "left");
    const ch = changesOf(updates, "c")!;
    expect(ch.x).toBe(0);
    expect(ch.endX).toBe(100); // 동일 delta(-300) 적용
  });

  it("standalone 엘보우 커넥터는 꺾임점(elbowBends)도 강체 이동한다", () => {
    const conn = obj({
      id: "c",
      type: "connector",
      x: 300,
      y: 100,
      width: undefined,
      height: undefined,
      endX: 400,
      endY: 200,
      pathStyle: "elbowed",
      elbowBends: [
        {
          segmentIndex: 0,
          offset: 0,
          elbowY: 150,
          leftCornerX: 320,
          rightCornerX: 380,
        },
      ],
    });
    const updates = alignObjects([a, conn], "left"); // dx = -300
    const ch = changesOf(updates, "c")!;
    expect(ch.x).toBe(0);
    const bend = ch.elbowBends![0]!;
    expect(bend.elbowY).toBe(150); // dy = 0 → y 계열 유지
    expect(bend.leftCornerX).toBe(20); // 320 - 300
    expect(bend.rightCornerX).toBe(80); // 380 - 300

    const topUpdates = alignObjects([a, conn], "top"); // dy = -100
    const topBend = changesOf(topUpdates, "c")!.elbowBends![0]!;
    expect(topBend.elbowY).toBe(50); // 150 - 100
    expect(topBend.leftCornerX).toBe(320); // dx = 0 → x 계열 유지
  });

  it("대상이 2개 미만이면 빈 배열 (잠긴 객체 제외 후)", () => {
    expect(alignObjects([a], "left")).toEqual([]);
    expect(alignObjects([a, obj({ id: "l", locked: true })], "left")).toEqual(
      [],
    );
  });
});

describe("distributeObjects", () => {
  it("horizontal: 양 끝 고정, 사이 간격 균등", () => {
    const objs = [
      obj({ id: "a", x: 0, width: 100 }),
      obj({ id: "b", x: 500, width: 100 }), // 끝
      obj({ id: "c", x: 120, width: 100 }), // 중간 — 재배치 대상
    ];
    const updates = distributeObjects(objs, "horizontal");
    // 전체 폭 600, 크기 합 300 → gap = 300/2 = 150
    // 순서: a(0), c(120), b(500) → c 는 0+100+150 = 250 으로
    expect(changesOf(updates, "c")!.x).toBe(250);
    expect(changesOf(updates, "a")).toBeUndefined();
    expect(changesOf(updates, "b")).toBeUndefined();
  });

  it("vertical: y 축 균등 분배", () => {
    const objs = [
      obj({ id: "a", y: 0, height: 50 }),
      obj({ id: "b", y: 60, height: 50 }),
      obj({ id: "c", y: 400, height: 50 }),
    ];
    const updates = distributeObjects(objs, "vertical");
    // 전체 [0, 450], 크기 합 150 → gap = 300/2 = 150
    expect(changesOf(updates, "b")!.y).toBe(200); // 0+50+150
  });

  it("3개 미만이면 빈 배열", () => {
    expect(
      distributeObjects([obj({ id: "a" }), obj({ id: "b" })], "horizontal"),
    ).toEqual([]);
  });
});
