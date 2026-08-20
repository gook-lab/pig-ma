import { describe, it, expect } from "vitest";
import {
  getConnectorEndpoints,
  getConnectorPathPoints,
  computeConnectorPathPoints,
  toElbowSize,
} from "./connectorPath";
import { calculateElbowPath } from "./elbowPath";
import type { CanvasObject, ElbowBend } from "@/types";

/**
 * 단일 소스 계약: 경로 위에 무언가를 놓는 모든 코드(라벨·옵션바·그룹 경계·
 * 미리보기)는 렌더러와 **같은 함수, 같은 인자**로 경로를 얻어야 한다.
 *
 * 이 테스트는 "옛 방식(앵커/옵션 생략 직접 호출)이 단일 소스와 다른 결과를
 * 내는" 케이스를 고정한다 — 누군가 다시 직접 호출로 돌아가면 여기서 잡힌다.
 */

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

const BEND: ElbowBend = {
  segmentIndex: 0,
  offset: 0,
  region: "primary",
  elbowY: 400,
  leftCornerX: 450,
  rightCornerX: 700,
} as ElbowBend;

function connector(over: Partial<CanvasObject> = {}): CanvasObject {
  return {
    id: "c1",
    type: "connector",
    x: 0,
    y: 0,
    endX: 900,
    endY: 500,
    pathStyle: "elbowed",
    elbowBends: [{ ...BEND }],
    rotation: 0,
    opacity: 1,
    ...over,
  } as CanvasObject;
}

describe("끝점 계산 (getConnectorEndpoints)", () => {
  it("ratio 오프셋을 반영한다 — 리사이즈된 도형에서도 가장자리", () => {
    const src = shape("s", 100, 100, 600, 400); // 리사이즈된 큰 도형
    const c = connector({
      sourceId: "s",
      sourceAnchor: "right",
      sourceOffsetX: 200, // 예전(200x100) 기준 절대 오프셋 — 이제 안쪽
      sourceOffsetY: 50,
      sourceOffsetRatioX: 1,
      sourceOffsetRatioY: 0.5,
    });

    const { start } = getConnectorEndpoints(c, src);
    expect(start.x).toBeCloseTo(700); // 커진 도형의 오른쪽 변 (ratio 우선)
    expect(start.y).toBeCloseTo(300);
  });

  it("도형이 없으면 커넥터 좌표를 쓴다", () => {
    const c = connector();
    const { start, end } = getConnectorEndpoints(c);
    expect(start).toEqual({ x: 0, y: 0 });
    expect(end).toEqual({ x: 900, y: 500 });
  });
});

describe("경로 계산 (getConnectorPathPoints)", () => {
  it("앵커 리드인 스텁을 포함한다 — 직접 호출(앵커 생략)과 다르다", () => {
    const c = connector({
      sourceAnchor: "left",
      targetAnchor: "left",
      x: 300,
      y: 200,
      endX: 1000,
      endY: 700,
    });

    const unified = getConnectorPathPoints(c);
    // 옛 방식: 앵커를 빼고 직접 호출 (소비자들이 하던 것)
    const legacy = calculateElbowPath(
      { x: 300, y: 200 },
      { x: 1000, y: 700 },
      c.elbowBends!,
    );

    expect(unified).not.toEqual(legacy); // 리드인 스텁만큼 달라야 한다
    // left 앵커 → 왼쪽으로 출발 (도형 관통 방지)
    expect(unified[2]!).toBeLessThan(300);
  });

  it("overrides.start/end 로 라이브 드래그 위치를 치환할 수 있다", () => {
    const c = connector({ sourceAnchor: "right", targetAnchor: "left" });
    const p = getConnectorPathPoints(c, undefined, undefined, {
      start: { x: 10, y: 20 },
      end: { x: 500, y: 600 },
    });
    expect([p[0], p[1]]).toEqual([10, 20]);
    expect([p[p.length - 2], p[p.length - 1]]).toEqual([500, 600]);
  });

  it("overrides.bends 로 미리보기 bend 를 치환할 수 있다", () => {
    const c = connector();
    const moved = [{ ...BEND, elbowY: 250 }];
    const p = getConnectorPathPoints(c, undefined, undefined, { bends: moved });

    const ys = [];
    for (let i = 1; i < p.length; i += 2) ys.push(p[i]!);
    expect(ys).toContain(250);
    expect(ys).not.toContain(400);
  });

  it("straight / curved 분기도 렌더러 수식과 동일하다", () => {
    const straight = getConnectorPathPoints(
      connector({ pathStyle: "straight", elbowBends: undefined }),
    );
    expect(straight).toEqual([0, 0, 900, 500]);

    const curved = getConnectorPathPoints(
      connector({ pathStyle: "curved", elbowBends: undefined }),
    );
    expect(curved).toEqual(
      computeConnectorPathPoints(0, 0, 900, 500, "curved"),
    );
    expect(curved).toHaveLength(6); // [start, control, end]
  });

  it("도형 크기가 우회 여유(elbowOptions)로 전달된다", () => {
    // bend 없는 반전 배치 — 크기를 알면 도형을 비껴 우회한다
    const src = shape("s", 300, 100, 100, 300);
    const tgt = shape("t", 50, 118, 100, 300);
    const c = connector({
      sourceId: "s",
      targetId: "t",
      sourceAnchor: "right",
      targetAnchor: "left",
      elbowBends: [],
    });

    const withSizes = getConnectorPathPoints(c, src, tgt);
    const withoutSizes = getConnectorPathPoints({
      ...c,
      sourceId: undefined,
      targetId: undefined,
      x: 350,
      y: 100,
      endX: 0,
      endY: 118,
    } as CanvasObject);
    // 크기 전달 여부에 따라 우회 거리가 달라진다 (동일하면 배선이 끊긴 것)
    expect(withSizes).not.toEqual(withoutSizes);
  });
});

describe("toElbowSize", () => {
  it("radius 도형은 지름으로 환산한다", () => {
    expect(toElbowSize({ radius: 40 })).toEqual({ width: 80, height: 80 });
  });
  it("크기 정보가 없으면 undefined", () => {
    expect(toElbowSize({})).toBeUndefined();
    expect(toElbowSize(undefined)).toBeUndefined();
  });
});
