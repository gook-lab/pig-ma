import { describe, it, expect } from "vitest";
import {
  getObjectBounds,
  getObjectCenter,
  getAnchorPoint,
  getAnchorPointWithAngle,
  getOffsetRatio,
  getOppositeAnchor,
  findClosestAnchor,
  rectsIntersect,
  rectContains,
  normalizeRect,
  isObjectInViewport,
  filterVisibleObjects,
} from "./geometry";
import type { CanvasObject } from "@/types";

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

function rect(over: Partial<CanvasObject> = {}): CanvasObject {
  return {
    id: over.id ?? "r1",
    type: "shape",
    shapeVariant: "rectangle",
    x: 100,
    y: 100,
    width: 200,
    height: 100,
    rotation: 0,
    opacity: 1,
    ...over,
  } as CanvasObject;
}

// ---------------------------------------------------------------------------

describe("getObjectBounds", () => {
  it("사각형은 x/y/width/height 그대로다", () => {
    expect(getObjectBounds(rect())).toMatchObject({
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    });
  });

  it("선은 모든 점을 감싸고 stroke 만큼 여유를 둔다", () => {
    const line = rect({
      id: "l1",
      type: "line",
      x: 10,
      y: 20,
      points: [0, 0, 50, -30, 100, 40],
      strokeWidth: 8,
    });
    const b = getObjectBounds(line);

    // 점 범위는 x 0..100, y -30..40, padding = max(5, 8/2) = 5
    expect(b.x).toBe(10 + 0 - 5);
    expect(b.y).toBe(20 - 30 - 5);
    expect(b.width).toBe(100 + 10);
    expect(b.height).toBe(70 + 10);
  });

  it("점이 없는 선도 크기 0 이 되지 않는다", () => {
    const b = getObjectBounds(rect({ type: "line", points: undefined }));
    expect(b.width).toBeGreaterThan(0);
    expect(b.height).toBeGreaterThan(0);
  });

  it("커넥터는 엘보우 꺾임까지 포함한다", () => {
    const conn = rect({
      id: "c1",
      type: "connector",
      x: 0,
      y: 0,
      endX: 400,
      endY: 0,
      elbowBends: [
        { segmentIndex: 0, offset: 0, region: "primary", elbowY: -250 },
      ],
    } as Partial<CanvasObject>);
    const b = getObjectBounds(conn);

    // 꺾임이 y = -250 까지 올라가므로 bounds 가 그걸 포함해야 한다
    expect(b.y).toBeLessThanOrEqual(-250);
    expect(b.y + b.height).toBeGreaterThanOrEqual(0);
  });
});

describe("getObjectCenter / getAnchorPoint", () => {
  const r = rect(); // x100 y100 w200 h100 → center (200,150)

  it("중심은 bounds 의 가운데다", () => {
    expect(getObjectCenter(r)).toEqual({ x: 200, y: 150 });
  });

  it("네 앵커는 각 변의 중점이다", () => {
    expect(getAnchorPoint(r, "left")).toEqual({ x: 100, y: 150 });
    expect(getAnchorPoint(r, "right")).toEqual({ x: 300, y: 150 });
    expect(getAnchorPoint(r, "top")).toEqual({ x: 200, y: 100 });
    expect(getAnchorPoint(r, "bottom")).toEqual({ x: 200, y: 200 });
  });

  it("center 앵커는 중심이다", () => {
    expect(getAnchorPoint(r, "center")).toEqual(getObjectCenter(r));
  });

  it("앵커는 항상 도형 경계 위에 있다 (안쪽이 아니다)", () => {
    const b = getObjectBounds(r);
    for (const a of ["left", "right", "top", "bottom"] as const) {
      const p = getAnchorPoint(r, a);
      const onVerticalEdge = p.x === b.x || p.x === b.x + b.width;
      const onHorizontalEdge = p.y === b.y || p.y === b.y + b.height;
      expect(onVerticalEdge || onHorizontalEdge).toBe(true);
    }
  });

  it("90도 회전하면 앵커도 함께 돈다", () => {
    const rotated = rect({ rotation: 90 });
    const right = getAnchorPoint(rotated, "right");
    const c = getObjectCenter(rotated);

    // 오른쪽 앵커가 회전해서 아래로 내려와야 한다
    expect(right.y).toBeGreaterThan(c.y);
    expect(Math.abs(right.x - c.x)).toBeLessThan(1e-6);
  });
});

describe("getOppositeAnchor", () => {
  it("서로 마주보는 쌍이다", () => {
    expect(getOppositeAnchor("left")).toBe("right");
    expect(getOppositeAnchor("right")).toBe("left");
    expect(getOppositeAnchor("top")).toBe("bottom");
    expect(getOppositeAnchor("bottom")).toBe("top");
  });

  it("두 번 적용하면 제자리다", () => {
    for (const a of ["left", "right", "top", "bottom"] as const) {
      expect(getOppositeAnchor(getOppositeAnchor(a))).toBe(a);
    }
  });
});

describe("findClosestAnchor", () => {
  const r = rect(); // center (200,150)

  it("도형 오른쪽 먼 지점은 right 앵커를 고른다", () => {
    expect(findClosestAnchor(r, { x: 900, y: 150 })).toBe("right");
  });

  it("도형 위쪽 먼 지점은 top 앵커를 고른다", () => {
    expect(findClosestAnchor(r, { x: 200, y: -500 })).toBe("top");
  });
});

describe("사각형 판정", () => {
  const a = { x: 0, y: 0, width: 100, height: 100 };

  it("겹치면 true", () => {
    expect(rectsIntersect(a, { x: 50, y: 50, width: 100, height: 100 })).toBe(
      true,
    );
  });

  it("떨어져 있으면 false", () => {
    expect(rectsIntersect(a, { x: 200, y: 0, width: 10, height: 10 })).toBe(
      false,
    );
  });

  it("포함 관계는 rectContains 로 구분된다", () => {
    const inner = { x: 10, y: 10, width: 10, height: 10 };
    expect(rectContains(a, inner)).toBe(true);
    expect(rectContains(inner, a)).toBe(false);
  });

  it("자기 자신을 포함한다", () => {
    expect(rectContains(a, a)).toBe(true);
  });
});

describe("normalizeRect", () => {
  it("어느 방향으로 끌어도 같은 사각형이 된다", () => {
    const expected = { x: 10, y: 20, width: 90, height: 80 };
    expect(normalizeRect(10, 20, 100, 100)).toMatchObject(expected);
    expect(normalizeRect(100, 100, 10, 20)).toMatchObject(expected);
    expect(normalizeRect(100, 20, 10, 100)).toMatchObject(expected);
    expect(normalizeRect(10, 100, 100, 20)).toMatchObject(expected);
  });

  it("폭/높이는 음수가 되지 않는다", () => {
    const n = normalizeRect(50, 50, 0, 0);
    expect(n.width).toBeGreaterThanOrEqual(0);
    expect(n.height).toBeGreaterThanOrEqual(0);
  });
});

describe("뷰포트 가상화", () => {
  const viewport = { x: 0, y: 0, zoom: 1 };
  const W = 1000;
  const H = 800;

  it("화면 안 객체는 보인다", () => {
    expect(isObjectInViewport(rect({ x: 100, y: 100 }), viewport, W, H)).toBe(
      true,
    );
  });

  it("화면에서 아주 멀면 안 보인다", () => {
    expect(isObjectInViewport(rect({ x: 99999, y: 0 }), viewport, W, H)).toBe(
      false,
    );
    expect(isObjectInViewport(rect({ x: -99999, y: 0 }), viewport, W, H)).toBe(
      false,
    );
  });

  it("경계 바로 밖은 padding 덕에 아직 보인다 (팬 시 깜박임 방지)", () => {
    // padding 기본 200 → 화면 오른쪽 밖 100px 지점은 아직 포함
    expect(
      isObjectInViewport(rect({ x: 1050, y: 100 }), viewport, W, H, 200),
    ).toBe(true);
  });

  it("줌 아웃하면 더 많이 들어온다", () => {
    const far = rect({ x: 4000, y: 0 });
    expect(isObjectInViewport(far, { x: 0, y: 0, zoom: 1 }, W, H)).toBe(false);
    expect(isObjectInViewport(far, { x: 0, y: 0, zoom: 0.1 }, W, H)).toBe(true);
  });

  it("선택된 객체는 화면 밖이어도 항상 포함된다", () => {
    const offscreen = rect({ id: "sel", x: 99999 });
    const onscreen = rect({ id: "vis", x: 100 });
    const visible = filterVisibleObjects(
      [offscreen, onscreen],
      viewport,
      W,
      H,
      ["sel"],
    );
    expect(visible.map((o) => o.id).sort()).toEqual(["sel", "vis"]);
  });

  it("아무것도 선택 안 했으면 화면 밖 객체는 빠진다", () => {
    const visible = filterVisibleObjects(
      [rect({ id: "far", x: 99999 }), rect({ id: "near", x: 100 })],
      viewport,
      W,
      H,
    );
    expect(visible.map((o) => o.id)).toEqual(["near"]);
  });
});

// ---------------------------------------------------------------------------
// 도형 리사이즈 시 연결점 유지
// ---------------------------------------------------------------------------

describe("연결점은 도형 크기가 바뀌어도 가장자리에 남는다", () => {
  const before = rect({ x: 100, y: 100, width: 200, height: 100 });
  const rightEdge = getAnchorPoint(before, "right"); // (300,150)

  it("비율은 가장자리 위 상대 위치를 나타낸다", () => {
    const { ratioX, ratioY } = getOffsetRatio(before, rightEdge);
    expect(ratioX).toBeCloseTo(1);
    expect(ratioY).toBeCloseTo(0.5);
  });

  it("도형을 키워도 연결점이 오른쪽 가장자리에 붙어 있다", () => {
    const { ratioX, ratioY } = getOffsetRatio(before, rightEdge);
    const after = rect({ x: 100, y: 100, width: 400, height: 300 });

    const p = getAnchorPointWithAngle(
      after,
      "right",
      undefined,
      undefined,
      undefined,
      ratioX,
      ratioY,
    );
    const b = getObjectBounds(after);

    expect(p.x).toBeCloseTo(b.x + b.width); // 여전히 오른쪽 변
    expect(p.y).toBeCloseTo(b.y + b.height / 2);
  });

  it("절대 오프셋만 있으면 리사이즈 후 도형 안쪽으로 파고든다 (레거시 동작)", () => {
    const offsetX = rightEdge.x - before.x; // 200
    const offsetY = rightEdge.y - before.y; // 50
    const after = rect({ x: 100, y: 100, width: 400, height: 300 });

    const p = getAnchorPointWithAngle(
      after,
      "right",
      undefined,
      offsetX,
      offsetY,
    );
    const b = getObjectBounds(after);

    // 오른쪽 변(500)이 아니라 300 에 머문다 → 도형 내부
    expect(p.x).toBeLessThan(b.x + b.width);
  });

  it("비율이 절대 오프셋보다 우선한다", () => {
    const after = rect({ x: 100, y: 100, width: 400, height: 300 });
    const p = getAnchorPointWithAngle(after, "right", undefined, 0, 0, 1, 0.5);

    expect(p.x).toBeCloseTo(500);
  });

  it("아무 것도 없으면 앵커 기본 위치를 쓴다", () => {
    expect(getAnchorPointWithAngle(before, "right")).toEqual(
      getAnchorPoint(before, "right"),
    );
  });

  it("크기 0 도형에서도 NaN 이 나오지 않는다", () => {
    const zero = rect({ width: 0, height: 0 });
    const r = getOffsetRatio(zero, { x: 100, y: 100 });
    expect(Number.isFinite(r.ratioX)).toBe(true);
    expect(Number.isFinite(r.ratioY)).toBe(true);
  });
});
