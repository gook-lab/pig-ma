import { describe, it, expect } from "vitest";
import {
  calculateAlignmentGuides,
  ALIGNMENT_THRESHOLD,
  ALIGNMENT_PROXIMITY,
  CONNECTOR_SNAP_THRESHOLD,
  CONNECTOR_DEAD_ZONE,
  getObjectBounds,
} from "./geometry";
import type { CanvasObject } from "@/types";

function rect(
  id: string,
  x: number,
  y: number,
  w = 100,
  h = 100,
): CanvasObject {
  return {
    id,
    type: "shape",
    shapeVariant: "rectangle",
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    opacity: 1,
  } as CanvasObject;
}

const bounds = (o: CanvasObject) => getObjectBounds(o);

describe("정렬 가이드 — 기본", () => {
  const other = rect("other", 0, 0, 100, 100); // left0 centerX50 right100

  it("완전히 어긋나 있으면 가이드가 없다", () => {
    const dragged = bounds(rect("d", 500, 500));
    const r = calculateAlignmentGuides(dragged, [other], ["d"]);
    expect(r.guides).toHaveLength(0);
    expect(r.snappedX).toBeUndefined();
    expect(r.snappedY).toBeUndefined();
  });

  it("왼쪽 변이 threshold 안이면 X 가 스냅된다", () => {
    const dragged = bounds(rect("d", 3, 400));
    const r = calculateAlignmentGuides(dragged, [other], ["d"]);
    expect(r.snappedX).toBe(0);
    expect(r.guides.some((g) => g.type === "vertical")).toBe(true);
  });

  it("threshold 밖이면 스냅하지 않는다", () => {
    const dragged = bounds(rect("d", ALIGNMENT_THRESHOLD + 5, 400));
    const r = calculateAlignmentGuides(dragged, [other], ["d"]);
    expect(r.snappedX).toBeUndefined();
  });

  it("중심선끼리도 맞춘다", () => {
    // other centerX = 50 → dragged(w100) 의 centerX 가 50 이려면 x = 0
    const dragged = bounds(rect("d", 2, 400));
    const r = calculateAlignmentGuides(dragged, [other], ["d"]);
    expect(r.snappedX).toBeDefined();
  });

  it("가로 정렬도 같은 방식으로 동작한다", () => {
    const dragged = bounds(rect("d", 400, 4));
    const r = calculateAlignmentGuides(dragged, [other], ["d"]);
    expect(r.snappedY).toBe(0);
    expect(r.guides.some((g) => g.type === "horizontal")).toBe(true);
  });

  it("자기 자신은 비교 대상에서 빠진다", () => {
    const self = rect("d", 0, 0);
    const r = calculateAlignmentGuides(bounds(self), [self], ["d"]);
    expect(r.guides).toHaveLength(0);
  });
});

describe("정렬 가이드 — 근접 범위(proximity)", () => {
  it("아주 멀리 있는 도형과는 정렬하지 않는다", () => {
    const far = rect("far", 0, 100000, 100, 100);
    const dragged = bounds(rect("d", 3, 100000)); // X 는 맞지만 거리가 멀다
    const r = calculateAlignmentGuides(bounds(rect("d", 3, 0)), [far], ["d"]);
    expect(r.snappedX).toBeUndefined();
    void dragged;
  });

  it("proximity 안이면 정렬한다", () => {
    const near = rect("near", 0, ALIGNMENT_PROXIMITY - 50);
    const r = calculateAlignmentGuides(bounds(rect("d", 3, 0)), [near], ["d"]);
    expect(r.snappedX).toBe(0);
  });
});

describe("커넥터 스냅 — Figma식 3단계", () => {
  const other = rect("other", 1000, 1000); // 정렬 간섭 없게 멀리
  const draggedBounds = bounds(rect("d", 0, 0));

  function withConnector(dx: number, dy: number) {
    return calculateAlignmentGuides(
      draggedBounds,
      [other],
      ["d"],
      ALIGNMENT_THRESHOLD,
      ALIGNMENT_PROXIMITY,
      [
        {
          draggedAnchorX: 50,
          draggedAnchorY: 50,
          targetX: 50 + dx,
          targetY: 50 + dy,
        },
      ],
    );
  }

  it("아주 가까우면(3px 이내) 연결점에 붙는다", () => {
    const r = withConnector(CONNECTOR_SNAP_THRESHOLD - 1, 0);
    expect(r.snappedX).toBeDefined();
  });

  it("dead zone(3~10px)에서는 스냅하지 않는다 — 자유 이동", () => {
    const r = withConnector(CONNECTOR_DEAD_ZONE - 2, 0);
    expect(r.snappedX).toBeUndefined();
    expect(r.inDeadZoneX).toBe(true);
  });

  it("dead zone 을 벗어나면 다시 일반 정렬이 허용된다", () => {
    const r = withConnector(CONNECTOR_DEAD_ZONE + 50, 0);
    expect(r.inDeadZoneX).toBeFalsy();
  });

  it("X 와 Y 의 dead zone 은 독립적이다", () => {
    const r = withConnector(
      CONNECTOR_DEAD_ZONE - 2,
      CONNECTOR_SNAP_THRESHOLD - 1,
    );
    expect(r.inDeadZoneX).toBe(true);
    expect(r.snappedY).toBeDefined();
  });
});

describe("가이드 선의 범위", () => {
  it("가이드는 두 도형을 모두 덮는 구간이다", () => {
    const other = rect("other", 0, 0, 100, 100);
    const dragged = bounds(rect("d", 3, 300, 100, 100));
    const r = calculateAlignmentGuides(dragged, [other], ["d"]);
    const v = r.guides.find((g) => g.type === "vertical");

    expect(v).toBeDefined();
    expect(v!.start).toBeLessThanOrEqual(0);
    expect(v!.end).toBeGreaterThanOrEqual(400);
  });
});
