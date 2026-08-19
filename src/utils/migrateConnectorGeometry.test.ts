import { describe, it, expect } from "vitest";
import { migrateConnectorGeometry } from "./migrateConnectorGeometry";
import { getAnchorPoint, getAnchorPointWithAngle } from "./geometry";
import type { CanvasObject } from "@/types";

function shape(
  id: string,
  x: number,
  y: number,
  w = 200,
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

function connector(over: Partial<CanvasObject> = {}): CanvasObject {
  return {
    id: "c1",
    type: "connector",
    x: 0,
    y: 0,
    endX: 500,
    endY: 0,
    rotation: 0,
    opacity: 1,
    ...over,
  } as CanvasObject;
}

describe("연결점: 절대 오프셋 → 크기 대비 비율", () => {
  const src = shape("s", 100, 100); // 오른쪽 앵커 (300,150)

  it("오른쪽 가장자리 오프셋은 비율 (1, 0.5) 가 된다", () => {
    const anchor = getAnchorPoint(src, "right");
    const c = connector({
      sourceId: "s",
      sourceAnchor: "right",
      sourceOffsetX: anchor.x - src.x, // 200
      sourceOffsetY: anchor.y - src.y, // 50
    });

    const [, out] = migrateConnectorGeometry([src, c]);
    expect(out!.sourceOffsetRatioX).toBeCloseTo(1);
    expect(out!.sourceOffsetRatioY).toBeCloseTo(0.5);
  });

  it("변환 후에는 리사이즈해도 가장자리에 붙어 있다", () => {
    const anchor = getAnchorPoint(src, "right");
    const c = connector({
      sourceId: "s",
      sourceAnchor: "right",
      sourceOffsetX: anchor.x - src.x,
      sourceOffsetY: anchor.y - src.y,
    });
    const [, migrated] = migrateConnectorGeometry([src, c]);

    const bigger = shape("s", 100, 100, 600, 400);
    const p = getAnchorPointWithAngle(
      bigger,
      "right",
      undefined,
      migrated!.sourceOffsetX,
      migrated!.sourceOffsetY,
      migrated!.sourceOffsetRatioX,
      migrated!.sourceOffsetRatioY,
    );

    expect(p.x).toBeCloseTo(700); // 커진 도형의 오른쪽 변
    expect(p.y).toBeCloseTo(300);
  });

  it("타깃 쪽도 동일하게 변환된다", () => {
    const tgt = shape("t", 800, 100);
    const anchor = getAnchorPoint(tgt, "left");
    const c = connector({
      targetId: "t",
      targetAnchor: "left",
      targetOffsetX: anchor.x - tgt.x,
      targetOffsetY: anchor.y - tgt.y,
    });

    const out = migrateConnectorGeometry([tgt, c])[1]!;
    expect(out.targetOffsetRatioX).toBeCloseTo(0);
    expect(out.targetOffsetRatioY).toBeCloseTo(0.5);
  });

  it("이미 비율이 있으면 덮어쓰지 않는다", () => {
    const c = connector({
      sourceId: "s",
      sourceOffsetX: 200,
      sourceOffsetY: 50,
      sourceOffsetRatioX: 0.25,
      sourceOffsetRatioY: 0.75,
    });

    const out = migrateConnectorGeometry([src, c])[1]!;
    expect(out.sourceOffsetRatioX).toBe(0.25);
    expect(out.sourceOffsetRatioY).toBe(0.75);
  });

  it("연결된 도형이 없으면 건드리지 않는다", () => {
    const c = connector({
      sourceId: "없는도형",
      sourceOffsetX: 10,
      sourceOffsetY: 10,
    });

    const out = migrateConnectorGeometry([c])[0]!;
    expect(out.sourceOffsetRatioX).toBeUndefined();
  });
});

describe("엘보우: 상대 offset → 절대 elbowY", () => {
  const src = shape("s", 100, 100); // 오른쪽 앵커 y = 150

  it("소스 앵커 Y 를 기준으로 절대 좌표가 된다", () => {
    const c = connector({
      sourceId: "s",
      sourceAnchor: "right",
      elbowBends: [{ segmentIndex: 0, offset: 80, region: "primary" }],
    });

    const out = migrateConnectorGeometry([src, c])[1]!;
    expect(out.elbowBends![0]!.elbowY).toBeCloseTo(230); // 150 + 80
  });

  it("도형에 안 붙어 있으면 커넥터 자신의 y 를 쓴다", () => {
    const c = connector({
      y: 400,
      elbowBends: [{ segmentIndex: 0, offset: 25, region: "primary" }],
    });

    const out = migrateConnectorGeometry([c])[0]!;
    expect(out.elbowBends![0]!.elbowY).toBeCloseTo(425);
  });

  it("이미 elbowY 가 있으면 그대로 둔다", () => {
    const c = connector({
      sourceId: "s",
      elbowBends: [
        { segmentIndex: 0, offset: 80, region: "primary", elbowY: 999 },
      ],
    });

    const out = migrateConnectorGeometry([src, c])[1]!;
    expect(out.elbowBends![0]!.elbowY).toBe(999);
  });

  it("변환 후에는 소스가 움직여도 엘보우가 따라가지 않는다", () => {
    const c = connector({
      sourceId: "s",
      sourceAnchor: "right",
      elbowBends: [{ segmentIndex: 0, offset: 80, region: "primary" }],
    });
    const migrated = migrateConnectorGeometry([src, c])[1]!;
    const before = migrated.elbowBends![0]!.elbowY;

    // 소스를 아래로 300 옮긴 뒤 다시 변환해도 값이 변하면 안 된다
    const moved = shape("s", 100, 400);
    const again = migrateConnectorGeometry([moved, migrated])[1]!;

    expect(again.elbowBends![0]!.elbowY).toBe(before);
  });

  it("계단 값(leftY/midLeftX)은 손대지 않는다", () => {
    const c = connector({
      sourceId: "s",
      elbowBends: [
        {
          segmentIndex: 0,
          offset: 80,
          region: "primary",
          leftY: 210,
          midLeftX: 340,
        },
      ],
    });

    const b = migrateConnectorGeometry([src, c])[1]!.elbowBends![0]!;
    expect(b.leftY).toBe(210);
    expect(b.midLeftX).toBe(340);
  });
});

describe("전체 동작", () => {
  it("커넥터가 아닌 객체는 그대로 통과한다", () => {
    const s = shape("s", 0, 0);
    expect(migrateConnectorGeometry([s])[0]).toBe(s);
  });

  it("두 번 돌려도 결과가 같다 (멱등)", () => {
    const src = shape("s", 100, 100);
    const c = connector({
      sourceId: "s",
      sourceAnchor: "right",
      sourceOffsetX: 200,
      sourceOffsetY: 50,
      elbowBends: [{ segmentIndex: 0, offset: 80, region: "primary" }],
    });

    const once = migrateConnectorGeometry([src, c]);
    const twice = migrateConnectorGeometry(once);
    expect(twice).toEqual(once);
  });

  it("원본 배열을 변경하지 않는다", () => {
    const src = shape("s", 100, 100);
    const c = connector({
      sourceId: "s",
      sourceOffsetX: 200,
      sourceOffsetY: 50,
    });
    const snapshot = JSON.stringify([src, c]);

    migrateConnectorGeometry([src, c]);
    expect(JSON.stringify([src, c])).toBe(snapshot);
  });

  it("빈 배열도 처리한다", () => {
    expect(migrateConnectorGeometry([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 실제 렌더 경로까지 확인 — 변환 전/후로 동작이 실제로 달라지는가
// ---------------------------------------------------------------------------

describe("변환 전후 렌더 동작 비교", () => {
  it("변환 전에는 소스가 움직이면 엘보우가 따라간다", async () => {
    const { calculateElbowPath } = await import("./elbowPath");
    const legacy = { segmentIndex: 0, offset: 80, region: "primary" as const };

    const before = (
      calculateElbowPath as unknown as (...a: unknown[]) => number[]
    )(
      { x: 300, y: 150 },
      { x: 900, y: 500 },
      [legacy],
      "sharp",
      8,
      "right",
      "left",
    );
    const afterMove = (
      calculateElbowPath as unknown as (...a: unknown[]) => number[]
    )(
      { x: 300, y: 450 }, // 소스가 아래로 300 이동
      { x: 900, y: 500 },
      [legacy],
      "sharp",
      8,
      "right",
      "left",
    );

    // offset 기반이라 엘보우 Y 가 함께 밀린다
    expect(before).not.toEqual(afterMove);
  });

  it("변환 후에는 소스가 움직여도 엘보우 Y 가 고정된다", async () => {
    const { calculateElbowPath } = await import("./elbowPath");
    const migrated = {
      segmentIndex: 0,
      offset: 80,
      region: "primary" as const,
      elbowY: 230, // 150 + 80
    };

    const run = (startY: number) =>
      (calculateElbowPath as unknown as (...a: unknown[]) => number[])(
        { x: 300, y: startY },
        { x: 900, y: 500 },
        [migrated],
        "sharp",
        8,
        "right",
        "left",
      );

    const a = run(150);
    const b = run(450);

    // 엘보우 높이(230)는 양쪽 모두에 그대로 있어야 한다
    const hasElbowY = (flat: number[]) => {
      for (let i = 1; i < flat.length; i += 2) {
        if (Math.abs(flat[i]! - 230) < 1e-6) return true;
      }
      return false;
    };
    expect(hasElbowY(a)).toBe(true);
    expect(hasElbowY(b)).toBe(true);
  });
});
