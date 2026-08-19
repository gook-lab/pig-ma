import { describe, it, expect, beforeEach } from "vitest";
import { useCanvasStore } from "./index";
import { createShape, createArrow } from "@/utils/factory";
import { getAnchorPoint } from "@/utils/geometry";
import type { CanvasObject, ShapeSettings } from "@/types";

/**
 * 연결된 도형이 사라지면 커넥터는 "그 자리에 그대로" 남아야 한다.
 *
 * 예전에는 sourceId/targetId 가 사라진 객체를 계속 가리켰다. 그러면 렌더가
 * 앵커를 못 구해 낡은 endX/endY 로 폴백하면서 화살표가 엉뚱한 곳으로 튄다.
 */

const SETTINGS = {
  fill: "#fff",
  stroke: "#000",
  strokeWidth: 2,
} as unknown as ShapeSettings;

const store = () => useCanvasStore.getState();
const shape = (x: number, y: number) =>
  createShape(x, y, "rectangle", SETTINGS);
const conn = () =>
  store().objects.find((o) => o.type === "connector") as CanvasObject;

function scene() {
  const s1 = shape(0, 0);
  const s2 = shape(500, 300);
  const start = getAnchorPoint(s1, "right");
  const end = getAnchorPoint(s2, "left");
  const c = createArrow(start.x, start.y, end.x, end.y, {
    sourceId: s1.id,
    targetId: s2.id,
    sourceAnchor: "right",
    targetAnchor: "left",
  });
  [s1, s2, c].forEach(store().addObject);
  return { s1, s2, c, start, end };
}

beforeEach(() => store().clearAllObjects());

describe("연결된 도형을 지우면 커넥터가 분리된다", () => {
  it("타깃을 지우면 targetId 가 사라진다", () => {
    const { s2 } = scene();
    store().deleteObjects([s2.id]);

    expect(conn()).toBeDefined();
    expect(conn().targetId).toBeUndefined();
  });

  it("소스를 지우면 sourceId 가 사라진다", () => {
    const { s1 } = scene();
    store().deleteObjects([s1.id]);

    expect(conn().sourceId).toBeUndefined();
  });

  it("끝점이 지워지기 직전 위치에 고정된다 (튀지 않는다)", () => {
    const { s2, end } = scene();
    store().deleteObjects([s2.id]);

    expect(conn().endX).toBeCloseTo(end.x);
    expect(conn().endY).toBeCloseTo(end.y);
  });

  it("시작점도 마찬가지로 고정된다", () => {
    const { s1, start } = scene();
    store().deleteObjects([s1.id]);

    expect(conn().x).toBeCloseTo(start.x);
    expect(conn().y).toBeCloseTo(start.y);
  });

  it("앵커/오프셋 잔재도 함께 정리된다", () => {
    const { s2 } = scene();
    store().deleteObjects([s2.id]);

    const c = conn() as CanvasObject & Record<string, unknown>;
    expect(c.targetAnchor).toBeUndefined();
    expect(c.targetOffsetX).toBeUndefined();
    expect(c.targetOffsetY).toBeUndefined();
    expect(c.targetOffsetRatioX).toBeUndefined();
    expect(c.targetOffsetRatioY).toBeUndefined();
  });

  it("반대쪽 연결은 유지된다", () => {
    const { s1, s2 } = scene();
    store().deleteObjects([s2.id]);

    expect(conn().sourceId).toBe(s1.id);
    expect(conn().sourceAnchor).toBe("right");
  });

  it("양쪽을 다 지우면 커넥터는 자유 커넥터가 된다", () => {
    const { s1, s2, start, end } = scene();
    store().deleteObjects([s1.id, s2.id]);

    const c = conn();
    expect(c.sourceId).toBeUndefined();
    expect(c.targetId).toBeUndefined();
    expect(c.x).toBeCloseTo(start.x);
    expect(c.y).toBeCloseTo(start.y);
    expect(c.endX).toBeCloseTo(end.x);
    expect(c.endY).toBeCloseTo(end.y);
  });

  it("커넥터 자체를 지우면 그냥 사라진다", () => {
    const { c } = scene();
    store().deleteObjects([c.id]);

    expect(store().objects.find((o) => o.type === "connector")).toBeUndefined();
  });

  it("관련 없는 도형을 지우면 아무것도 안 바뀐다", () => {
    const { s1, s2 } = scene();
    const other = shape(900, 900);
    store().addObject(other);

    store().deleteObjects([other.id]);

    expect(conn().sourceId).toBe(s1.id);
    expect(conn().targetId).toBe(s2.id);
  });

  it("엘보우 꺾임은 그대로 유지된다", () => {
    const { s2, c } = scene();
    store().updateObject(c.id, {
      pathStyle: "elbowed",
      elbowBends: [
        { segmentIndex: 0, offset: 0, region: "primary", elbowY: 150 },
      ],
    });

    store().deleteObjects([s2.id]);

    expect(conn().elbowBends).toHaveLength(1);
  });
});
