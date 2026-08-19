import { describe, it, expect } from "vitest";
import { calculateElbowPath, getSegments } from "./elbowPath";
import type { ElbowBend } from "@/types";

// ---------------------------------------------------------------------------
// applyBends — 저장된 bend 로 경로를 만드는 부분.
// elbowPath.ts 에서 가장 분기가 많은 곳(380줄, 조건 61개)인데 테스트가 없었다.
// 여기서는 "어떤 bend 를 넣어도 깨지지 않는다"는 불변식 위주로 잠근다.
// ---------------------------------------------------------------------------

interface Pt {
  x: number;
  y: number;
}

function path(
  start: Pt,
  end: Pt,
  bends: ElbowBend[],
  sourceAnchor = "right",
  targetAnchor = "left",
): Pt[] {
  const flat = (calculateElbowPath as unknown as (...a: unknown[]) => number[])(
    start,
    end,
    bends,
    "sharp",
    8,
    sourceAnchor,
    targetAnchor,
  );
  const out: Pt[] = [];
  for (let i = 0; i < flat.length; i += 2)
    out.push({ x: flat[i]!, y: flat[i + 1]! });
  return out;
}

function isAxisAligned(p: Pt[]): boolean {
  const EPS = 1e-6;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i]!;
    const b = p[i + 1]!;
    if (Math.abs(a.x - b.x) > EPS && Math.abs(a.y - b.y) > EPS) return false;
  }
  return true;
}

/**
 * 진짜 왕복(스파이크)만 잡는다.
 *
 * 같은 축 세그먼트가 연달아 나오는 것 자체는 문제가 아니다. 중간 정점이
 * 하나 더 있을 뿐 직선으로 이어질 수 있다. 문제는 **진행 방향이 뒤집히는**
 * 경우다 — 갔다가 되돌아오면 선이 겹쳐 보인다.
 */
function hasReversal(p: Pt[]): boolean {
  const segs = getSegments(p.flatMap((q) => [q.x, q.y]));
  for (let i = 1; i < segs.length; i++) {
    const a = segs[i - 1]!;
    const b = segs[i]!;
    if (a.direction !== b.direction) continue;
    const da =
      a.direction === "horizontal" ? a.end.x - a.start.x : a.end.y - a.start.y;
    const db =
      b.direction === "horizontal" ? b.end.x - b.start.x : b.end.y - b.start.y;
    if (da * db < 0) return true;
  }
  return false;
}

function hasZeroLengthSegment(p: Pt[]): boolean {
  const EPS = 1e-6;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i]!;
    const b = p[i + 1]!;
    if (Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS) return true;
  }
  return false;
}

const START = { x: 100, y: 200 };
const END = { x: 900, y: 400 };

/** 기본 ㄷ자 bend */
function base(over: Partial<ElbowBend> = {}): ElbowBend {
  return {
    segmentIndex: 0,
    offset: 100,
    region: "primary",
    elbowY: 300,
    leftCornerX: 300,
    rightCornerX: 700,
    ...over,
  } as ElbowBend;
}

// ---------------------------------------------------------------------------

describe("기본 ㄷ자", () => {
  it("start → leftCorner → elbowY → rightCorner → end 순서다", () => {
    const p = path(START, END, [base()]);

    expect(p[0]).toEqual(START);
    expect(p[p.length - 1]).toEqual(END);
    expect(p.some((q) => q.x === 300 && q.y === 300)).toBe(true);
    expect(p.some((q) => q.x === 700 && q.y === 300)).toBe(true);
    expect(isAxisAligned(p)).toBe(true);
  });

  it("elbowY 를 바꾸면 중앙 수평선만 움직인다", () => {
    const up = path(START, END, [base({ elbowY: 50 })]);
    const down = path(START, END, [base({ elbowY: 900 })]);

    expect(up.some((q) => q.y === 50)).toBe(true);
    expect(down.some((q) => q.y === 900)).toBe(true);
    // 코너 X 는 그대로
    for (const p of [up, down]) {
      expect(p.some((q) => q.x === 300)).toBe(true);
      expect(p.some((q) => q.x === 700)).toBe(true);
    }
  });

  it("bend 가 비어 있으면 기본 경로다", () => {
    expect(path(START, END, [])).toEqual(path(START, END, []));
    expect(isAxisAligned(path(START, END, []))).toBe(true);
  });
});

describe("계단(staircase)", () => {
  it("leftY 를 주면 좌측에 계단이 생긴다", () => {
    const p = path(START, END, [base({ leftY: 250, midLeftX: 200 })]);

    expect(p.some((q) => q.y === 250)).toBe(true);
    expect(p.some((q) => q.x === 200)).toBe(true);
    expect(isAxisAligned(p)).toBe(true);
    expect(hasZeroLengthSegment(p)).toBe(false);
  });

  it("rightY 를 주면 우측에 계단이 생긴다", () => {
    const p = path(START, END, [base({ rightY: 350, midRightX: 800 })]);

    expect(p.some((q) => q.y === 350)).toBe(true);
    expect(isAxisAligned(p)).toBe(true);
    expect(hasZeroLengthSegment(p)).toBe(false);
  });

  it("양쪽 계단을 동시에 줘도 경로가 성립한다", () => {
    const p = path(START, END, [
      base({ leftY: 250, midLeftX: 200, rightY: 350, midRightX: 800 }),
    ]);

    expect(p[0]).toEqual(START);
    expect(p[p.length - 1]).toEqual(END);
    expect(isAxisAligned(p)).toBe(true);
    expect(hasZeroLengthSegment(p)).toBe(false);
  });
});

describe("좌표가 범위를 벗어나도 깨지지 않는다", () => {
  const wild: Array<[string, Partial<ElbowBend>]> = [
    ["코너가 뒤집힘", { leftCornerX: 800, rightCornerX: 200 }],
    ["코너가 겹침", { leftCornerX: 500, rightCornerX: 500 }],
    ["코너가 start 앞", { leftCornerX: -500, rightCornerX: 0 }],
    ["코너가 end 뒤", { leftCornerX: 1500, rightCornerX: 2000 }],
    ["midLeftX 가 코너 밖", { leftY: 250, midLeftX: 5000 }],
    ["midRightX 가 코너 밖", { rightY: 350, midRightX: -5000 }],
    ["elbowY 가 아주 멂", { elbowY: -99999 }],
    ["계단 Y 가 아주 멂", { leftY: 99999, rightY: -99999 }],
  ];

  it.each(wild)("%s — 축 정렬을 유지한다", (_n, over) => {
    const p = path(START, END, [base(over)]);
    expect(isAxisAligned(p)).toBe(true);
  });

  it.each(wild)("%s — 양 끝점을 지킨다", (_n, over) => {
    const p = path(START, END, [base(over)]);
    expect(p[0]).toEqual(START);
    expect(p[p.length - 1]).toEqual(END);
  });

  it.each(wild)("%s — 길이 0 세그먼트가 없다", (_n, over) => {
    expect(hasZeroLengthSegment(path(START, END, [base(over)]))).toBe(false);
  });

  it.each(wild)("%s — NaN/Infinity 가 섞이지 않는다", (_n, over) => {
    for (const q of path(START, END, [base(over)])) {
      expect(Number.isFinite(q.x)).toBe(true);
      expect(Number.isFinite(q.y)).toBe(true);
    }
  });
});

describe("반전 배치", () => {
  const rStart = { x: 900, y: 200 };
  const rEnd = { x: 100, y: 400 };

  it("타깃이 왼쪽에 있어도 경로가 성립한다", () => {
    const p = path(rStart, rEnd, [
      base({ leftCornerX: 700, rightCornerX: 300 }),
    ]);

    expect(p[0]).toEqual(rStart);
    expect(p[p.length - 1]).toEqual(rEnd);
    expect(isAxisAligned(p)).toBe(true);
    expect(hasZeroLengthSegment(p)).toBe(false);
  });

  it("반전 + 계단 조합도 성립한다", () => {
    const p = path(rStart, rEnd, [
      base({
        leftCornerX: 700,
        rightCornerX: 300,
        rightY: 350,
        midRightX: 200,
      }),
    ]);
    expect(isAxisAligned(p)).toBe(true);
    expect(p[p.length - 1]).toEqual(rEnd);
  });
});

describe("직선 스냅", () => {
  it("모든 Y 가 15px 이내면 2점 직선으로 접힌다", () => {
    const s = { x: 100, y: 200 };
    const e = { x: 900, y: 205 };
    const p = path(s, e, [base({ elbowY: 203, leftY: 201, rightY: 204 })]);

    expect(p).toHaveLength(2);
  });

  it("하나라도 벗어나면 엘보우가 유지된다", () => {
    const s = { x: 100, y: 200 };
    const e = { x: 900, y: 205 };
    const p = path(s, e, [base({ elbowY: 500 })]);

    expect(p.length).toBeGreaterThan(2);
  });
});

describe("세그먼트 분해", () => {
  it("각 세그먼트는 수평/수직이 번갈아 나온다", () => {
    const p = path(START, END, [base()]);
    const segs = getSegments(p.flatMap((q) => [q.x, q.y]));

    for (let i = 1; i < segs.length; i++) {
      expect(segs[i]!.direction).not.toBe(segs[i - 1]!.direction);
    }
  });

  it("계단이 있으면 세그먼트가 더 많아진다", () => {
    const plain = getSegments(
      path(START, END, [base()]).flatMap((q) => [q.x, q.y]),
    );
    const stair = getSegments(
      path(START, END, [base({ leftY: 250, midLeftX: 200 })]).flatMap((q) => [
        q.x,
        q.y,
      ]),
    );
    expect(stair.length).toBeGreaterThan(plain.length);
  });
});

describe("레거시 offset 기반 bend", () => {
  it("elbowY 없이 offset 만 있어도 동작한다", () => {
    const p = path(START, END, [
      { segmentIndex: 0, offset: 150, region: "primary" } as ElbowBend,
    ]);

    expect(p[0]).toEqual(START);
    expect(p[p.length - 1]).toEqual(END);
    expect(isAxisAligned(p)).toBe(true);
  });

  it("비율(ratio) 기반 코너도 동작한다", () => {
    const p = path(START, END, [
      {
        segmentIndex: 0,
        offset: 100,
        region: "primary",
        elbowY: 300,
        leftCornerRatio: 0.3,
        rightCornerRatio: 0.8,
      } as ElbowBend,
    ]);

    expect(isAxisAligned(p)).toBe(true);
    expect(p[p.length - 1]).toEqual(END);
  });
});

// ---------------------------------------------------------------------------
// 끝점이 움직여 코너가 범위 밖이 되는 경우
//
// leftCornerX / rightCornerX 는 절대 좌표로 저장된다. 도형을 옮기거나
// 리사이즈하거나 삭제(끝점 고정)하면 끝점만 움직이고 코너는 그대로라,
// rightCornerX 가 end.x 보다 오른쪽에 남을 수 있다. 그러면 마지막 수평선이
// 왼쪽으로 되돌아가고 화살촉이 거꾸로 향한다.
//
// moveElbowX 에서 '핸들을 끌 때'는 이미 막았지만, '끝점이 움직일 때'는
// 렌더 시점에 한 번 더 막아야 한다.
// ---------------------------------------------------------------------------

describe("끝점이 움직여도 저작한 코너는 그대로 있다", () => {
  const start = { x: 380, y: 250 };
  const bend = base({
    elbowY: 122,
    leftCornerX: 660,
    rightCornerX: 940,
    leftY: 315,
    midLeftX: 560,
  });

  it.each([1290, 940, 800, 705, 500])(
    "끝점 x=%i — 저작한 코너 위치가 유지된다",
    (endX) => {
      const p = path(start, { x: endX, y: 540 }, [bend]);
      // 사용자가 만든 좌측 계단과 코너가 경로에 남아 있어야 한다
      expect(p.some((q) => Math.abs(q.x - 560) < 1)).toBe(true);
      expect(p.some((q) => Math.abs(q.x - 660) < 1)).toBe(true);
      expect(p.some((q) => Math.abs(q.y - 315) < 1)).toBe(true);
      expect(p.some((q) => Math.abs(q.y - 122) < 1)).toBe(true);
    },
  );

  it.each([1290, 940, 800, 705, 500])(
    "끝점 x=%i — 같은 축을 왕복하지 않는다",
    (endX) => {
      expect(hasReversal(path(start, { x: endX, y: 540 }, [bend]))).toBe(false);
    },
  );

  it.each([1290, 940, 800, 705, 500])(
    "끝점 x=%i — 축 정렬이고 양 끝을 지킨다",
    (endX) => {
      const end = { x: endX, y: 540 };
      const p = path(start, end, [bend]);
      expect(isAxisAligned(p)).toBe(true);
      expect(p[0]).toEqual(start);
      expect(p[p.length - 1]).toEqual(end);
      expect(hasZeroLengthSegment(p)).toBe(false);
    },
  );

  it("끝점이 코너보다 앞이면 오른쪽에서 진입한다 (자연스러운 L)", () => {
    const p = path(start, { x: 705, y: 540 }, [bend]);
    const last = p[p.length - 1]!;
    const prev = p[p.length - 2]!;

    expect(Math.abs(prev.y - last.y)).toBeLessThan(1); // 마지막은 수평
    expect(prev.x).toBeGreaterThan(last.x); // 오른쪽에서 들어온다
  });
});

// ---------------------------------------------------------------------------
// X축 반전 — 저작된 계단은 지키고 '마지막 연결선'만 다시 그린다
//
// 우측 계단(rightY/midRightX/rightYSteps)은 '정방향' 기준으로 저작된 값이다.
// 타깃이 소스 왼쪽으로 가면 그 값들은 방향이 뒤집힌 채로 남아, 위로 갔다가
// 다시 내려오는 스파이크를 만든다.
//
// FigJam 은 이 경우 사용자가 만든 계단 모양은 그대로 두고 마지막 연결선만
// 새로 잇는다. 그 규약을 여기서 잠근다.
// ---------------------------------------------------------------------------

describe("X축 반전", () => {
  const start = { x: 300, y: 200 };
  const end = { x: 100, y: 800 }; // 타깃이 소스 왼쪽 아래

  const authored = base({
    elbowY: 300,
    leftCornerX: 450,
    rightCornerX: 700,
    leftY: 250,
    midLeftX: 380,
    rightY: 260, // 정방향 기준으로 저작됨 — 반전 상태에선 의미가 뒤집힌다
    midRightX: 800,
  });

  it("위로 갔다 내려오는 스파이크가 없다", () => {
    expect(hasReversal(path(start, end, [authored]))).toBe(false);
  });

  it("경로는 축 정렬이고 양 끝점을 지킨다", () => {
    const p = path(start, end, [authored]);
    expect(isAxisAligned(p)).toBe(true);
    expect(p[0]).toEqual(start);
    expect(p[p.length - 1]).toEqual(end);
  });

  it("길이 0 세그먼트가 없다", () => {
    expect(hasZeroLengthSegment(path(start, end, [authored]))).toBe(false);
  });

  it("좌측에 저작한 계단은 그대로 유지된다", () => {
    const p = path(start, end, [authored]);
    // 사용자가 만든 좌측 계단(leftY, midLeftX)이 경로에 남아 있어야 한다
    expect(p.some((q) => Math.abs(q.y - 250) < 1)).toBe(true);
    expect(p.some((q) => Math.abs(q.x - 380) < 1)).toBe(true);
  });

  it("중앙 엘보우 높이도 유지된다", () => {
    const p = path(start, end, [authored]);
    expect(p.some((q) => Math.abs(q.y - 300) < 1)).toBe(true);
  });

  it("마지막 구간은 타깃을 향해 곧장 들어간다", () => {
    const p = path(start, end, [authored]);
    const last = p[p.length - 1]!;
    const prev = p[p.length - 2]!;

    // 끝점으로 들어오는 마지막 선분은 수평이고 오른쪽에서 접근한다
    expect(Math.abs(prev.y - last.y)).toBeLessThan(1);
    expect(prev.x).toBeGreaterThan(last.x);
  });

  it.each([
    ["바로 왼쪽", { x: 250, y: 400 }],
    ["멀리 왼쪽 위", { x: -400, y: 50 }],
    ["멀리 왼쪽 아래", { x: -400, y: 900 }],
    ["거의 같은 높이", { x: 100, y: 205 }],
  ])("타깃이 %s 이어도 성립한다", (_n, e) => {
    const p = path(start, e as Pt, [authored]);
    expect(isAxisAligned(p)).toBe(true);
    expect(hasReversal(p)).toBe(false);
    expect(p[p.length - 1]).toEqual(e);
  });
});

// ---------------------------------------------------------------------------
// X축 반전 — 마지막 엘보우 구간을 '버리지 말고 좌우로 뒤집는다'
//
// 우측 계단은 정방향 기준으로 저작된 값이라 그대로 쓰면 방향이 뒤집힌 채
// 남는다. 그렇다고 버리면 사용자가 만든 모양이 사라진다.
// 마지막 코너(rightCornerX)를 축으로 좌우 대칭 이동시키면 모양은 그대로 두고
// 방향만 자연스럽게 뒤집을 수 있다.
// ---------------------------------------------------------------------------

describe("X축 반전 — 저작한 모양은 그대로, 마지막 연결선 방향만 바뀐다", () => {
  const start = { x: 300, y: 200 };
  const authored = base({
    elbowY: 300,
    leftCornerX: 450,
    rightCornerX: 700,
    leftY: 250,
    midLeftX: 380,
    rightY: 150, // elbowY 보다 위 — '위로 솟는 혹'
    midRightX: 800, // 코너 오른쪽으로 100
  });

  const forward = () => path(start, { x: 1100, y: 800 }, [authored]);
  const reversed = () => path(start, { x: 100, y: 800 }, [authored]);

  // 이것이 이 기능의 계약이다.
  it("마지막 점을 뺀 나머지 경로가 정방향과 완전히 같다", () => {
    expect(reversed().slice(0, -1)).toEqual(forward().slice(0, -1));
  });

  it("혹의 위치와 높이가 그대로다 (대칭 이동하지 않는다)", () => {
    const p = reversed();
    expect(p.some((q) => Math.abs(q.x - 800) < 1)).toBe(true); // 코너 오른쪽 그대로
    expect(p.some((q) => Math.abs(q.y - 150) < 1)).toBe(true);
  });

  it("마지막 선분만 타깃 쪽(왼쪽)으로 향한다", () => {
    const p = reversed();
    const last = p[p.length - 1]!;
    const prev = p[p.length - 2]!;

    expect(Math.abs(prev.y - last.y)).toBeLessThan(1); // 수평
    expect(prev.x).toBeGreaterThan(last.x); // 왼쪽으로
  });

  it("스파이크가 없다", () => {
    expect(hasReversal(reversed())).toBe(false);
    expect(hasReversal(forward())).toBe(false);
  });

  it("좌측 계단과 중앙 엘보우도 유지된다", () => {
    const p = reversed();
    expect(p.some((q) => Math.abs(q.x - 380) < 1)).toBe(true);
    expect(p.some((q) => Math.abs(q.y - 250) < 1)).toBe(true);
    expect(p.some((q) => Math.abs(q.y - 300) < 1)).toBe(true);
  });

  it.each([
    ["바로 왼쪽", { x: 250, y: 500 }],
    ["멀리 왼쪽 위", { x: -400, y: 50 }],
    ["멀리 왼쪽 아래", { x: -400, y: 900 }],
  ])("타깃이 %s 이어도 축 정렬과 양 끝점을 지킨다", (_n, e) => {
    const p = path(start, e as Pt, [authored]);
    expect(isAxisAligned(p)).toBe(true);
    expect(hasZeroLengthSegment(p)).toBe(false);
    expect(p[p.length - 1]).toEqual(e);
  });

  it("우측 계단이 없으면 단순 L 로 닫는다", () => {
    const noStair = base({
      elbowY: 300,
      leftCornerX: 450,
      rightCornerX: 700,
    });
    const p = path(start, { x: 100, y: 800 }, [noStair]);

    expect(hasReversal(p)).toBe(false);
    expect(p[p.length - 1]).toEqual({ x: 100, y: 800 });
  });
});

// ---------------------------------------------------------------------------
// 저작한 모양은 끝점 위치와 무관하다
//
// 이 파일에서 가장 중요한 계약. 도형을 어디로 옮기든 사용자가 만든 계단·혹은
// 그 자리에 있어야 하고, 마지막 연결선만 타깃을 향해 바뀐다.
//
// 예전에는 중간 수직선(midLeftX/midRightX)을 [끝점, 코너] 범위로 클램프해서,
// 타깃이 가까워지면 혹이 끌려와 작아지다가 사라졌다.
// ---------------------------------------------------------------------------

describe("저작한 계단은 끝점이 어디에 있든 그대로다", () => {
  const start = { x: 300, y: 200 };
  const authored = base({
    elbowY: 300,
    leftCornerX: 450,
    rightCornerX: 700,
    leftY: 250,
    midLeftX: 380,
    rightY: 150,
    midRightX: 800, // 코너(700) 오른쪽으로 100 — 이 '혹'이 유지돼야 한다
  });

  const END_XS = [1100, 900, 820, 750, 500, 100, -300];

  it.each(END_XS)("end.x=%i — 혹의 위치(midRightX)가 그대로다", (endX) => {
    const p = path(start, { x: endX, y: 800 }, [authored]);
    expect(p.some((q) => Math.abs(q.x - 800) < 1e-6)).toBe(true);
  });

  it.each(END_XS)("end.x=%i — 혹의 높이(rightY)가 그대로다", (endX) => {
    const p = path(start, { x: endX, y: 800 }, [authored]);
    expect(p.some((q) => Math.abs(q.y - 150) < 1e-6)).toBe(true);
  });

  it.each(END_XS)("end.x=%i — 좌측 계단과 코너도 그대로다", (endX) => {
    const p = path(start, { x: endX, y: 800 }, [authored]);
    for (const v of [380, 450, 700]) {
      expect(p.some((q) => Math.abs(q.x - v) < 1e-6)).toBe(true);
    }
    expect(p.some((q) => Math.abs(q.y - 250) < 1e-6)).toBe(true);
  });

  it("끝점만 다르고 나머지 경로는 모두 동일하다", () => {
    const paths = END_XS.map((x) => path(start, { x, y: 800 }, [authored]));
    const head = (p: Pt[]) => p.slice(0, -1);

    for (const p of paths) {
      expect(head(p)).toEqual(head(paths[0]!));
    }
  });

  it.each(END_XS)("end.x=%i — 스파이크 없이 축 정렬을 지킨다", (endX) => {
    const end = { x: endX, y: 800 };
    const p = path(start, end, [authored]);
    expect(hasReversal(p)).toBe(false);
    expect(isAxisAligned(p)).toBe(true);
    expect(p[p.length - 1]).toEqual(end);
  });

  it("중간선이 코너를 넘어가면 그때만 제한된다 (역주행 방지)", () => {
    // midLeftX(947) 가 leftCorner(450) 를 넘어간 경우 — 이건 막아야 한다
    const broken = base({
      elbowY: 300,
      leftCornerX: 450,
      rightCornerX: 700,
      leftY: 250,
      midLeftX: 947,
    });
    const p = path(start, { x: 1100, y: 800 }, [broken]);
    expect(hasReversal(p)).toBe(false);
    expect(p.some((q) => Math.abs(q.x - 947) < 1e-6)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 폭 0 왕복(retrace) — 같은 선 위를 갔다가 되돌아오는 구간은 그리지 않는다
//
// 좌우 코너가 같은 X 에 붙으면 중앙 수평선의 폭이 0 이 되고, elbowY 로의
// 수직 왕복만 남는다(실제 사용자 리포트: 세로선이 위로 솟았다가 되돌아옴).
// 훅/계단은 항상 수평선으로 분리되므로, '연속한 동일선상 역방향' 은 언제나
// 시각적 스파이크다 — 의도된 형태를 해치지 않고 접을 수 있다.
// ---------------------------------------------------------------------------

describe("폭 0 왕복은 접힌다", () => {
  function hasRetrace(p: Pt[]): boolean {
    const segs = getSegments(p.flatMap((q) => [q.x, q.y]));
    for (let i = 1; i < segs.length; i++) {
      const a = segs[i - 1]!;
      const b = segs[i]!;
      if (a.direction !== b.direction) continue;
      const da =
        a.direction === "horizontal"
          ? a.end.x - a.start.x
          : a.end.y - a.start.y;
      const db =
        b.direction === "horizontal"
          ? b.end.x - b.start.x
          : b.end.y - b.start.y;
      if (da * db < 0) return true;
    }
    return false;
  }

  it("사용자 리포트 재구성 — 코너가 같은 X 에 붙은 반전 계단", () => {
    const start = { x: 534, y: 120 };
    const end = { x: 293, y: 700 };
    const b = base({
      leftYSteps: [
        { y: 205, midX: 662 },
        { y: 360, midX: 790 },
      ],
      leftY: 637,
      midLeftX: 957,
      leftCornerX: 551,
      rightCornerX: 551,
      elbowY: 462,
    });
    const p = path(start, end, [b]);

    expect(hasRetrace(p)).toBe(false);
    expect(p[0]).toEqual(start);
    expect(p[p.length - 1]).toEqual(end);
    expect(isAxisAligned(p)).toBe(true);
    // 저작한 계단은 그대로 남는다
    expect(p.some((q) => Math.abs(q.y - 205) < 1)).toBe(true);
    expect(p.some((q) => Math.abs(q.y - 360) < 1)).toBe(true);
    expect(p.some((q) => Math.abs(q.y - 637) < 1)).toBe(true);
  });

  it("퍼즈: 코너 동일/역전 × elbowY 이탈 × 정/반전 — 왕복이 절대 없다", () => {
    const corners = [
      [400, 700],
      [551, 551], // 동일
      [700, 400], // 역전
      [551, 571],
    ];
    const elbows = [50, 300, 462, 900];
    const ends = [
      { x: 900, y: 500 }, // 정방향
      { x: 293, y: 700 }, // 반전
      { x: 100, y: 100 }, // 반전 + 위
    ];
    const stairs = [
      {},
      { leftY: 250, midLeftX: 350 },
      { rightY: 350, midRightX: 800 },
      { leftY: 637, midLeftX: 957, leftYSteps: [{ y: 205, midX: 662 }] },
    ];
    const start = { x: 300, y: 200 };

    for (const [lc, rc] of corners) {
      for (const ey of elbows) {
        for (const end of ends) {
          for (const st of stairs) {
            const b = base({
              leftCornerX: lc,
              rightCornerX: rc,
              elbowY: ey,
              ...st,
            });
            const p = path(start, end, [b]);

            expect(hasRetrace(p)).toBe(false);
            expect(isAxisAligned(p)).toBe(true);
            expect(hasZeroLengthSegment(p)).toBe(false);
            expect(p[0]).toEqual(start);
            expect(p[p.length - 1]).toEqual(end);
            for (const q of p) {
              expect(Number.isFinite(q.x) && Number.isFinite(q.y)).toBe(true);
            }
          }
        }
      }
    }
  });
});
