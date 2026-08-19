import { describe, it, expect } from "vitest";
import { calculateElbowPath, getSegments } from "./elbowPath";
import { createElbowFromStraight, moveElbowX } from "./elbowHandlers";

// ---------------------------------------------------------------------------
// 테스트 헬퍼
// ---------------------------------------------------------------------------

interface Pt {
  x: number;
  y: number;
}
interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 중심 + 크기로 사각형을 만든다 (도형은 항상 중심 기준) */
function box(cx: number, cy: number, w: number, h: number) {
  return {
    rect: {
      left: cx - w / 2,
      top: cy - h / 2,
      right: cx + w / 2,
      bottom: cy + h / 2,
    } as Rect,
    size: { width: w, height: h },
    anchor: {
      left: { x: cx - w / 2, y: cy },
      right: { x: cx + w / 2, y: cy },
      top: { x: cx, y: cy - h / 2 },
      bottom: { x: cx, y: cy + h / 2 },
    },
  };
}

/** flat number[] → Point[] */
function toPoints(flat: number[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < flat.length; i += 2)
    out.push({ x: flat[i], y: flat[i + 1] });
  return out;
}

/**
 * 축 정렬 선분이 사각형 '내부'를 지나는지.
 * 경계에 닿는 것(가장자리에서 출발/도착)은 관통이 아니다 — 열린 구간으로 판정.
 */
function segmentEntersRect(a: Pt, b: Pt, r: Rect): boolean {
  const EPS = 1e-6;
  if (Math.abs(a.y - b.y) < EPS) {
    // 수평 선분
    const y = a.y;
    if (y <= r.top + EPS || y >= r.bottom - EPS) return false;
    const lo = Math.min(a.x, b.x);
    const hi = Math.max(a.x, b.x);
    return hi > r.left + EPS && lo < r.right - EPS;
  }
  if (Math.abs(a.x - b.x) < EPS) {
    // 수직 선분
    const x = a.x;
    if (x <= r.left + EPS || x >= r.right - EPS) return false;
    const lo = Math.min(a.y, b.y);
    const hi = Math.max(a.y, b.y);
    return hi > r.top + EPS && lo < r.bottom - EPS;
  }
  return false; // 축 정렬이 아니면 별도 검사(assertAxisAligned)가 잡는다
}

function crossesRect(path: Pt[], r: Rect): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    if (segmentEntersRect(path[i], path[i + 1], r)) return true;
  }
  return false;
}

/** 모든 선분이 수평 또는 수직인지 */
function isAxisAligned(path: Pt[]): boolean {
  const EPS = 1e-6;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (Math.abs(a.x - b.x) > EPS && Math.abs(a.y - b.y) > EPS) return false;
  }
  return true;
}

type Dir = "left" | "right" | "top" | "bottom";

/** 첫 선분이 소스 앵커의 바깥 방향으로 출발하는지 */
function leavesAlong(path: Pt[], dir: Dir): boolean {
  const [a, b] = path;
  if (!a || !b) return false;
  switch (dir) {
    case "right":
      return b.x > a.x;
    case "left":
      return b.x < a.x;
    case "bottom":
      return b.y > a.y;
    case "top":
      return b.y < a.y;
  }
}

/** 마지막 선분이 타깃 앵커의 바깥쪽에서 진입하는지 */
function arrivesAlong(path: Pt[], dir: Dir): boolean {
  const b = path[path.length - 1];
  const a = path[path.length - 2];
  if (!a || !b) return false;
  switch (dir) {
    case "left":
      return a.x < b.x; // 왼쪽 앵커 → 왼쪽에서 들어온다
    case "right":
      return a.x > b.x;
    case "top":
      return a.y < b.y;
    case "bottom":
      return a.y > b.y;
  }
}

function elbow(
  start: Pt,
  end: Pt,
  sourceAnchor?: string,
  targetAnchor?: string,
  options?: unknown,
): Pt[] {
  return toPoints(
    (calculateElbowPath as unknown as (...a: unknown[]) => number[])(
      start,
      end,
      [],
      "sharp",
      8,
      sourceAnchor,
      targetAnchor,
      options,
    ),
  );
}

// ---------------------------------------------------------------------------
// 모든 경로가 지켜야 하는 불변식
// ---------------------------------------------------------------------------

describe("elbow 경로 불변식", () => {
  const scenarios: Array<[string, Pt, Pt, Dir, Dir]> = [
    ["정방향 좌→우", { x: 100, y: 100 }, { x: 400, y: 300 }, "right", "left"],
    ["X반전", { x: 400, y: 100 }, { x: 100, y: 120 }, "right", "left"],
    ["X반전 Y근접", { x: 400, y: 100 }, { x: 100, y: 118 }, "right", "left"],
    [
      "혼합앵커 right→top",
      { x: 100, y: 100 },
      { x: 400, y: 300 },
      "right",
      "top",
    ],
    [
      "수직 bottom→top",
      { x: 100, y: 100 },
      { x: 130, y: 400 },
      "bottom",
      "top",
    ],
    ["Y반전", { x: 100, y: 400 }, { x: 130, y: 100 }, "bottom", "top"],
    [
      "좌향 출발 left→right",
      { x: 400, y: 100 },
      { x: 100, y: 300 },
      "left",
      "right",
    ],
  ];

  it.each(scenarios)(
    "%s — start에서 시작해 end에서 끝난다",
    (_n, s, e, sa, ta) => {
      const p = elbow(s, e, sa, ta);
      expect(p[0]).toEqual(s);
      expect(p[p.length - 1]).toEqual(e);
    },
  );

  it.each(scenarios)("%s — 모든 선분이 축 정렬이다", (_n, s, e, sa, ta) => {
    expect(isAxisAligned(elbow(s, e, sa, ta))).toBe(true);
  });

  it.each(scenarios)("%s — 소스 앵커 방향으로 출발한다", (_n, s, e, sa, ta) => {
    expect(leavesAlong(elbow(s, e, sa, ta), sa)).toBe(true);
  });

  it.each(scenarios)("%s — 타깃 앵커 방향에서 진입한다", (_n, s, e, sa, ta) => {
    expect(arrivesAlong(elbow(s, e, sa, ta), ta)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 기존에 정상이던 경로는 그대로여야 한다 (회귀 방지)
// ---------------------------------------------------------------------------

describe("정방향 경로 회귀", () => {
  it("좌→우 정방향은 midX 기준 ㄱ자를 유지한다", () => {
    expect(
      elbow({ x: 100, y: 100 }, { x: 400, y: 300 }, "right", "left"),
    ).toEqual([
      { x: 100, y: 100 },
      { x: 250, y: 100 },
      { x: 250, y: 300 },
      { x: 400, y: 300 },
    ]);
  });

  it("상→하 정방향은 midY 기준 ㄱ자를 유지한다", () => {
    expect(
      elbow({ x: 100, y: 100 }, { x: 130, y: 400 }, "bottom", "top"),
    ).toEqual([
      { x: 100, y: 100 },
      { x: 100, y: 250 },
      { x: 130, y: 250 },
      { x: 130, y: 400 },
    ]);
  });

  // 직선 스냅(15px 이내)은 2점 경로로 줄이되, 마지막 점은 항상 end로 보정된다.
  // 화살촉이 앵커에서 뜨지 않게 하려는 의도적 트레이드오프이며, 그 결과
  // 최대 15px 기울어진 선분이 남는다.
  it("거의 수평이면 2점 직선으로 스냅하고 끝점은 end에 붙는다", () => {
    expect(
      elbow({ x: 100, y: 100 }, { x: 400, y: 108 }, "right", "left"),
    ).toEqual([
      { x: 100, y: 100 },
      { x: 400, y: 108 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// 버그 1 — 반전 시 도형 관통
// ---------------------------------------------------------------------------

describe("반전 경로가 도형을 관통하지 않는다", () => {
  it("X반전: 타깃이 소스 왼쪽이고 Y가 겹칠 때 소스를 통과하지 않는다", () => {
    const src = box(350, 100, 100, 60); // x 300~400, y 70~130
    const tgt = box(150, 118, 100, 60); // x 100~200, y 88~148
    const p = elbow(src.anchor.right, tgt.anchor.left, "right", "left", {
      sourceSize: src.size,
      targetSize: tgt.size,
    });

    expect(crossesRect(p, src.rect)).toBe(false);
    expect(crossesRect(p, tgt.rect)).toBe(false);
  });

  it("X반전: 크기 정보가 없어도 관통하지 않는다 (기본 여유 사용)", () => {
    const src = box(350, 100, 100, 60);
    const tgt = box(150, 118, 100, 60);
    const p = elbow(src.anchor.right, tgt.anchor.left, "right", "left");

    expect(crossesRect(p, src.rect)).toBe(false);
    expect(crossesRect(p, tgt.rect)).toBe(false);
  });

  it("Y반전: 타깃이 소스 위쪽이고 X가 겹칠 때 소스를 통과하지 않는다", () => {
    const src = box(100, 400, 60, 100); // x 70~130, y 350~450
    const tgt = box(118, 150, 60, 100); // x 88~148, y 100~200
    const p = elbow(src.anchor.bottom, tgt.anchor.top, "bottom", "top", {
      sourceSize: src.size,
      targetSize: tgt.size,
    });

    expect(crossesRect(p, src.rect)).toBe(false);
    expect(crossesRect(p, tgt.rect)).toBe(false);
  });

  it("큰 도형에서도 관통하지 않는다 (고정 50px 여유로는 부족한 크기)", () => {
    const src = box(350, 100, 100, 300); // 높이 300 — 반쪽만 150px
    const tgt = box(150, 118, 100, 300);
    const p = elbow(src.anchor.right, tgt.anchor.left, "right", "left", {
      sourceSize: src.size,
      targetSize: tgt.size,
    });

    expect(crossesRect(p, src.rect)).toBe(false);
    expect(crossesRect(p, tgt.rect)).toBe(false);
  });

  it("세로로 충분히 떨어져 있으면 사이로 질러간다 (불필요한 우회 없음)", () => {
    const src = box(350, 100, 100, 60);
    const tgt = box(150, 500, 100, 60);
    const p = elbow(src.anchor.right, tgt.anchor.left, "right", "left", {
      sourceSize: src.size,
      targetSize: tgt.size,
    });

    const ys = p.map((q) => q.y);
    // 두 도형 사이(130 ~ 470)를 지나는 수평선이 있어야 한다
    expect(ys.some((y) => y > 130 && y < 470)).toBe(true);
    expect(crossesRect(p, src.rect)).toBe(false);
    expect(crossesRect(p, tgt.rect)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 버그 2 — 혼합 앵커 무시
// ---------------------------------------------------------------------------

describe("혼합 앵커를 존중한다", () => {
  it("right→top: 타깃에 수직으로 진입한다", () => {
    const p = elbow({ x: 100, y: 100 }, { x: 400, y: 300 }, "right", "top");
    const last = p[p.length - 1];
    const prev = p[p.length - 2];

    expect(prev.x).toBe(last.x); // 마지막 선분이 수직
    expect(prev.y).toBeLessThan(last.y); // 위에서 내려온다
  });

  it("bottom→left: 타깃에 수평으로 진입한다", () => {
    const p = elbow({ x: 100, y: 100 }, { x: 400, y: 300 }, "bottom", "left");
    const last = p[p.length - 1];
    const prev = p[p.length - 2];

    expect(prev.y).toBe(last.y); // 마지막 선분이 수평
    expect(prev.x).toBeLessThan(last.x); // 왼쪽에서 들어온다
  });

  it("right→top 과 right→left 는 서로 다른 경로여야 한다", () => {
    const a = elbow({ x: 100, y: 100 }, { x: 400, y: 300 }, "right", "top");
    const b = elbow({ x: 100, y: 100 }, { x: 400, y: 300 }, "right", "left");
    expect(a).not.toEqual(b);
  });

  it("소스가 left 앵커면 왼쪽으로 출발한다", () => {
    const p = elbow({ x: 400, y: 100 }, { x: 100, y: 300 }, "left", "right");
    expect(p[1].x).toBeLessThan(p[0].x);
  });
});

// ---------------------------------------------------------------------------
// 버그 3 — 저장된 bend 의 계단 중간선이 코너 바깥으로 나가 경로가 되돌아온다
//
// 핸들을 끌 때는 그 시점의 도형 위치 기준으로 범위가 제한되지만,
// 그 뒤 도형을 옮기면 midLeftX 가 [start.x, leftCornerX] 밖으로 밀려난다.
// 그러면 경로가 오른쪽으로 갔다가 왼쪽으로 되돌아온다.
// ---------------------------------------------------------------------------

/** 정방향(왼→오른) 배치에서 x 가 뒤로 물러나는 구간이 있는지 */
function backtracksInX(path: Pt[]): boolean {
  const EPS = 1e-6;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    if (b.x < a.x - EPS) return true;
  }
  return false;
}

function elbowWithBends(
  start: Pt,
  end: Pt,
  bends: unknown[],
  sourceAnchor?: string,
  targetAnchor?: string,
): Pt[] {
  return toPoints(
    (calculateElbowPath as unknown as (...a: unknown[]) => number[])(
      start,
      end,
      bends,
      "sharp",
      8,
      sourceAnchor,
      targetAnchor,
    ),
  );
}

describe("저장된 bend 가 있어도 경로가 되돌아가지 않는다", () => {
  const start = { x: 287, y: 203 };
  const end = { x: 1600, y: 292 };

  it("midLeftX 가 leftCornerX 오른쪽으로 밀려나도 좌측 계단이 역주행하지 않는다", () => {
    const bend = {
      region: "primary",
      segmentIndex: 0,
      offset: 152,
      elbowY: 355,
      leftCornerX: 614,
      rightCornerX: 1277,
      midLeftX: 947, // leftCornerX(614) 보다 오른쪽 — 도형을 옮긴 뒤 생기는 상태
      leftY: 312,
    };
    const p = elbowWithBends(start, end, [bend], "right", "left");

    expect(backtracksInX(p)).toBe(false);
    expect(p[0]).toEqual(start);
    expect(p[p.length - 1]).toEqual(end);
    expect(isAxisAligned(p)).toBe(true);
  });

  it("midRightX 가 rightCornerX 왼쪽으로 밀려나도 우측 계단이 역주행하지 않는다", () => {
    const bend = {
      region: "primary",
      segmentIndex: 0,
      offset: 152,
      elbowY: 355,
      leftCornerX: 614,
      rightCornerX: 1277,
      midRightX: 900, // rightCornerX(1277) 보다 왼쪽
      rightY: 320,
    };
    const p = elbowWithBends(start, end, [bend], "right", "left");

    expect(backtracksInX(p)).toBe(false);
    expect(isAxisAligned(p)).toBe(true);
  });

  it("정상 범위의 midLeftX 는 그대로 존중한다", () => {
    const bend = {
      region: "primary",
      segmentIndex: 0,
      offset: 152,
      elbowY: 355,
      leftCornerX: 614,
      rightCornerX: 1277,
      midLeftX: 450, // start.x(287) 와 leftCornerX(614) 사이 — 정상
      leftY: 312,
    };
    const p = elbowWithBends(start, end, [bend], "right", "left");

    expect(p.some((q) => Math.abs(q.x - 450) < 1e-6)).toBe(true);
    expect(backtracksInX(p)).toBe(false);
  });
});

describe("경로에 길이 0 세그먼트가 남지 않는다", () => {
  it("bend 좌표가 코너에 딱 붙어도 중복점이 없다", () => {
    const bend = {
      region: "primary",
      segmentIndex: 0,
      offset: 152,
      elbowY: 355,
      leftCornerX: 614,
      rightCornerX: 1277,
      midLeftX: 947,
      leftY: 312,
    };
    const p = elbowWithBends(
      { x: 287, y: 203 },
      { x: 1600, y: 292 },
      [bend],
      "right",
      "left",
    );

    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i]!;
      const b = p[i + 1]!;
      expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 버그 4 — 두 끝점의 Y가 같을 때 엘보우를 만들 수 있어야 한다
//
// 비율(leftCornerRatio) 기반 simple-path bend 는 (newY - startY) / (endY - startY)
// 로 계산되므로 endY === startY 면 표현 자체가 불가능하다. 이때는 절대좌표
// ㄷ자(createElbowFromStraight)로 승격해야 하며, 그러지 않으면 드래그가
// 아무 일도 하지 않는다.
// ---------------------------------------------------------------------------

describe("끝점 Y가 같아도 엘보우를 만들 수 있다", () => {
  const start = { x: 417, y: 428 };
  const end = { x: 1063, y: 428 }; // 완전히 수평

  it("bend 가 없으면 직선 2점이다", () => {
    const p = elbowWithBends(start, end, [], "right", "left");
    expect(p).toHaveLength(2);
  });

  it("절대좌표 bend 를 주면 ㄷ자가 만들어진다", () => {
    const bend = createElbowFromStraight(start.x, start.y, end.x, end.y, 60);
    expect(bend).not.toBeNull();

    const p = elbowWithBends(start, end, [bend!], "right", "left");
    expect(p.length).toBeGreaterThan(2);
    // 중간 구간이 드래그한 만큼 내려가 있어야 한다
    expect(p.some((q) => Math.abs(q.y - 488) < 1e-6)).toBe(true);
    expect(isAxisAligned(p)).toBe(true);
    expect(p[0]).toEqual(start);
    expect(p[p.length - 1]).toEqual(end);
  });

  it("위로 끌어도 대칭으로 동작한다", () => {
    const bend = createElbowFromStraight(start.x, start.y, end.x, end.y, -60);
    const p = elbowWithBends(start, end, [bend!], "right", "left");
    expect(p.some((q) => Math.abs(q.y - 368) < 1e-6)).toBe(true);
  });

  it("드래그가 너무 작으면(10px 미만) bend 를 만들지 않는다", () => {
    expect(
      createElbowFromStraight(start.x, start.y, end.x, end.y, 8),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 버그 5 — 살짝 기운 "직선"이 수직 세그먼트로 분류된다
//
// calculateElbowPath 는 Y 차이가 15px 이내면 직선으로 스냅하고 마지막 점을
// end 로 보정한다. 그래서 2점 경로가 최대 15px 기울어질 수 있다.
// 그런데 getSegments 는 |Δy| < 0.01 일 때만 horizontal 로 봤다.
// → 기운 직선이 vertical 로 분류되고, 핸들 드래그가 "수직 직선" 분기로 빠져
//   Y 이동이 무시된다(= 엘보우가 아예 안 만들어진다).
// 축 분류는 절대 오차가 아니라 '어느 축이 지배적인가'로 해야 한다.
// ---------------------------------------------------------------------------

describe("세그먼트 축 분류는 지배적인 축을 따른다", () => {
  it("Δx 가 훨씬 큰 선은 수평이다 (기울어져 있어도)", () => {
    const p = elbow({ x: 430, y: 672 }, { x: 1500, y: 663 }, "right", "left");
    const segs = getSegments(p.flatMap((q) => [q.x, q.y]));

    expect(segs).toHaveLength(1);
    expect(segs[0]!.direction).toBe("horizontal");
  });

  it("Δy 가 훨씬 큰 선은 수직이다", () => {
    const segs = getSegments([430, 100, 439, 900]);
    expect(segs[0]!.direction).toBe("vertical");
  });

  it("정확한 축 정렬 세그먼트는 기존과 동일하게 분류된다", () => {
    expect(getSegments([0, 0, 100, 0])[0]!.direction).toBe("horizontal");
    expect(getSegments([0, 0, 0, 100])[0]!.direction).toBe("vertical");
  });

  it("엘보우 경로의 각 세그먼트 분류는 그대로다", () => {
    const p = elbow({ x: 100, y: 100 }, { x: 400, y: 300 }, "right", "left");
    const segs = getSegments(p.flatMap((q) => [q.x, q.y]));
    expect(segs.map((s) => s.direction)).toEqual([
      "horizontal",
      "vertical",
      "horizontal",
    ]);
  });
});

// ---------------------------------------------------------------------------
// 버그 6 — 엘보우 구간을 좌우로 밀면 커넥터 범위를 벗어난다
//
// moveElbowX 는 leftCornerX/rightCornerX 를 그대로 더하기만 해서 범위 제한이 없다.
// 오른쪽으로 밀면 rightCornerX 가 end.x 를 넘어가 마지막 수평선이 되돌아오고,
// 왼쪽으로 밀면 leftCornerX 가 start.x 앞으로 가서 첫 수평선이 되돌아온다.
// ---------------------------------------------------------------------------

describe("엘보우를 좌우로 밀어도 커넥터 범위를 벗어나지 않는다", () => {
  const start = { x: 697, y: 396 };
  const end = { x: 1620, y: 515 };
  const bounds = { minX: start.x, maxX: end.x };

  function movedPath(delta: number) {
    const base = createElbowFromStraight(start.x, start.y, end.x, end.y, -180)!;
    const moved = moveElbowX(base, delta, bounds);
    return {
      bend: moved,
      path: elbowWithBends(start, end, [moved], "right", "left"),
    };
  }

  it("오른쪽으로 크게 밀어도 코너가 end.x 를 넘지 않는다", () => {
    const { bend, path } = movedPath(500);
    expect(bend.rightCornerX!).toBeLessThanOrEqual(end.x);
    expect(bend.leftCornerX!).toBeGreaterThanOrEqual(start.x);
    expect(backtracksInX(path)).toBe(false);
  });

  it("왼쪽으로 크게 밀어도 코너가 start.x 앞으로 가지 않는다", () => {
    const { bend, path } = movedPath(-700);
    expect(bend.leftCornerX!).toBeGreaterThanOrEqual(start.x);
    expect(bend.rightCornerX!).toBeLessThanOrEqual(end.x);
    expect(backtracksInX(path)).toBe(false);
  });

  it("두 코너가 겹치지 않는다 (중앙 수평선이 사라지면 위아래로 튄다)", () => {
    for (const d of [0, 200, 500, 900, -300, -700, -2000]) {
      const { bend } = movedPath(d);
      expect(bend.rightCornerX! - bend.leftCornerX!).toBeGreaterThan(0);
    }
  });

  it("범위 안에서의 이동은 그대로 반영된다", () => {
    const { bend } = movedPath(100);
    const base = createElbowFromStraight(start.x, start.y, end.x, end.y, -180)!;
    expect(bend.leftCornerX!).toBeCloseTo(base.leftCornerX! + 100);
    expect(bend.rightCornerX!).toBeCloseTo(base.rightCornerX! + 100);
  });

  it("이동해도 경로는 축 정렬이고 양 끝점을 지킨다", () => {
    for (const d of [500, -700]) {
      const { path } = movedPath(d);
      expect(isAxisAligned(path)).toBe(true);
      expect(path[0]).toEqual(start);
      expect(path[path.length - 1]).toEqual(end);
    }
  });
});
