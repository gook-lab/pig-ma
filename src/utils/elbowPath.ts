/**
 * Elbow Connector Path Utilities
 *
 * Handles calculation of elbowed connector paths with support for:
 * - Midpoint handles for creating new bends
 * - Sharp and rounded corners
 * - Segment-based bend management
 */

import type { ElbowBend } from "@/types";

export interface Point {
  x: number;
  y: number;
}

/** 우회 경로 계산에 쓰는 도형 크기 (없으면 기본 여유로 대체) */
export interface ElbowSize {
  width: number;
  height: number;
}

/**
 * 경로 계산 옵션.
 * 크기를 주면 반전 배치에서 도형을 비껴가는 여유를 크기에 비례해 잡는다.
 */
export interface ElbowPathOptions {
  sourceSize?: ElbowSize;
  targetSize?: ElbowSize;
}

export interface Segment {
  start: Point;
  end: Point;
  index: number;
  direction: "horizontal" | "vertical";
}

/**
 * 핸들 타입:
 * - 'center': 직선 상태의 중앙 핸들 또는 ㄷ자의 하단 수평 핸들 (파란색, Y축 이동)
 * - 'left': ㄷ자의 좌측 수직 핸들 (회색, X축 이동)
 * - 'right': ㄷ자의 우측 수직 핸들 (회색, X축 이동)
 */
export type HandleType = "center" | "left" | "right";

export interface MidpointHandle extends Point {
  segmentIndex: number;
  canBend: boolean;
  direction: "horizontal" | "vertical";
  handleType: HandleType;
  /** 다중 엘보우: 이 핸들이 속한 bend의 ID (없으면 새 bend 생성) */
  bendId?: string;
  /** FigJam 스타일 영역 (좌측/우측/중앙)
   *  - 'newLeft'/'newRight': 연속 계단 생성용 (startY/endY 세그먼트에서 새 레벨 추가) */
  region?: "primary" | "left" | "right" | "newLeft" | "newRight";
  /** 좌/우측 수평 세그먼트: Y 위치 조절 가능 여부 (계단식 꺾임용) */
  canAdjustY?: boolean;
  /** 수직 핸들이 조절하는 X 좌표 타입
   *  - leftStep/rightStep: 연속 계단의 step.midX 조절용 */
  verticalTarget?:
    | "leftCorner"
    | "midLeft"
    | "rightCorner"
    | "midRight"
    | "leftStep"
    | "rightStep";
  /** 연속 계단의 인덱스 (leftYSteps[stepIndex] 또는 rightYSteps[stepIndex]) */
  stepIndex?: number;
}

// 기본 코너 비율 상수
const DEFAULT_LEFT_RATIO = 0.25;
const DEFAULT_RIGHT_RATIO = 0.75;

// 엘보우 연장 거리 (앵커 바깥으로 뽑는 스텁 길이)
const ELBOW_EXTENSION = 50;

// 도형 가장자리에서 우회선까지 남기는 여유
const ELBOW_CLEARANCE = 20;

// 직선 스냅 threshold (이 범위 내 Y/X 차이는 직선으로 처리)
const STRAIGHT_LINE_SNAP_THRESHOLD = 15;

/**
 * 앵커 방향(법선) 기반 직교 라우팅
 *
 * 커넥터는 소스 앵커의 바깥 방향으로 출발해서 타깃 앵커의 바깥쪽에서 진입해야 한다.
 * 이 두 제약을 먼저 고정하고 그 사이를 축 정렬 경로로 잇는다.
 *
 * 이전 구현은 흐름 축(수평/수직) 하나만 정하고 4점 ㄷ자를 그렸는데, 그래서
 * (a) 혼합 앵커(right→top)에서 타깃 앵커 방향이 무시되고
 * (b) 반전 배치에서 마지막 선분이 소스 도형을 관통했다.
 */

type Axis = "horizontal" | "vertical";

interface Vec {
  x: number;
  y: number;
}

/** 앵커 이름 → 바깥 방향 단위 벡터 */
function anchorToDir(anchor?: string): Vec | null {
  switch (anchor) {
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
    case "top":
      return { x: 0, y: -1 };
    case "bottom":
      return { x: 0, y: 1 };
    default:
      return null; // "center" 또는 미지정
  }
}

function axisOf(dir: Vec): Axis {
  return dir.x !== 0 ? "horizontal" : "vertical";
}

/**
 * 소스/타깃의 이탈·진입 방향을 결정한다.
 * 앵커가 없으면 좌표 차이로 추정한다(기존 폴백 동작 유지).
 */
function resolveDirections(
  start: Point,
  end: Point,
  sourceAnchor?: string,
  targetAnchor?: string,
): { srcDir: Vec; tgtDir: Vec; inferred: boolean } {
  const explicitSrc = anchorToDir(sourceAnchor);
  const explicitTgt = anchorToDir(targetAnchor);
  if (explicitSrc && explicitTgt) {
    return { srcDir: explicitSrc, tgtDir: explicitTgt, inferred: false };
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dominant: Axis =
    Math.abs(dy) > Math.abs(dx) ? "vertical" : "horizontal";

  // 한쪽만 있으면 그 축을 존중하고 반대쪽은 마주보게 추정한다.
  const known = explicitSrc ?? explicitTgt;
  const axis: Axis = known ? axisOf(known) : dominant;

  const srcDir =
    explicitSrc ??
    (axis === "horizontal"
      ? { x: dx >= 0 ? 1 : -1, y: 0 }
      : { x: 0, y: dy >= 0 ? 1 : -1 });
  const tgtDir =
    explicitTgt ??
    (axis === "horizontal"
      ? { x: dx >= 0 ? -1 : 1, y: 0 }
      : { x: 0, y: dy >= 0 ? -1 : 1 });

  return { srcDir, tgtDir, inferred: !explicitSrc || !explicitTgt };
}

/** 도형 크기가 주어지면 그 절반, 없으면 기본 여유(ELBOW_EXTENSION)를 쓴다 */
function halfExtent(size: ElbowSize | undefined, axis: Axis): number {
  if (!size) return ELBOW_EXTENSION;
  return (axis === "horizontal" ? size.width : size.height) / 2;
}

/**
 * 연속한 중복점을 제거한다.
 *
 * 길이 0 세그먼트가 남으면 getSegments 가 그것도 세그먼트로 세서
 * 엉뚱한 자리에 핸들이 생긴다. bend 좌표를 범위로 제한하면 두 점이
 * 같은 자리로 겹칠 수 있어(코너에 딱 붙는 경우) 여기서 걷어낸다.
 */
function dedupePoints(points: Point[]): Point[] {
  const EPS = 1e-6;
  const out: Point[] = [];

  for (const p of points) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < EPS && Math.abs(last.y - p.y) < EPS) {
      continue;
    }
    out.push({ ...p });
  }

  return out;
}

/**
 * 같은 선 위를 갔다가 되돌아오는 왕복(retrace)을 접는다.
 *
 * 좌우 코너가 같은 X 에 붙으면 중앙 수평선의 폭이 0 이 되고, elbowY 로의
 * 수직 excursion 이 "위로 갔다가 같은 선으로 되돌아오는" 순수 왕복으로
 * 남는다 — 화면에는 도형 밖으로 솟은 가시처럼 보인다.
 *
 * 훅·계단처럼 의도된 굴곡은 항상 반대 축 세그먼트로 분리되어 있으므로,
 * '연속한 동일선상 역방향 쌍'은 언제나 폭 0 의 시각적 스파이크다.
 * 중간점을 제거하고(A→B→C ⇒ A→C), 접힌 자리에서 새 쌍이 생길 수 있어
 * 안정될 때까지 반복한다.
 */
function collapseRetrace(points: Point[]): Point[] {
  const EPS = 1e-6;
  let out = points;
  let changed = true;

  while (changed && out.length >= 3) {
    changed = false;
    for (let i = 1; i < out.length - 1; i++) {
      const a = out[i - 1]!;
      const b = out[i]!;
      const c = out[i + 1]!;

      const sameX = Math.abs(a.x - b.x) < EPS && Math.abs(b.x - c.x) < EPS;
      const sameY = Math.abs(a.y - b.y) < EPS && Math.abs(b.y - c.y) < EPS;
      if (!sameX && !sameY) continue;

      const d1 = sameX ? b.y - a.y : b.x - a.x;
      const d2 = sameX ? c.y - b.y : c.x - b.x;
      if (d1 * d2 >= 0) continue; // 같은 방향(또는 길이 0)은 왕복이 아니다

      out = [...out.slice(0, i), ...out.slice(i + 1)];
      changed = true;
      break;
    }
    if (changed) out = dedupePoints(out); // A→B→A 가 접히면 중복점이 남는다
  }

  return out;
}

/** 중복점 + 일직선 위의 중간점을 모두 제거한다 */
function simplify(points: Point[]): Point[] {
  const EPS = 1e-6;
  const out = dedupePoints(points);

  // 일직선 위의 중간점 제거
  for (let i = out.length - 2; i >= 1; i--) {
    const a = out[i - 1]!;
    const b = out[i]!;
    const c = out[i + 1]!;
    if (!a || !b || !c) continue;
    const collinearH = Math.abs(a.y - b.y) < EPS && Math.abs(b.y - c.y) < EPS;
    const collinearV = Math.abs(a.x - b.x) < EPS && Math.abs(b.x - c.x) < EPS;
    if (collinearH || collinearV) out.splice(i, 1);
  }

  return out;
}

/**
 * 앵커 바깥 방향으로 나가고 들어오도록 앞·뒤 구간만 고쳐 붙인다.
 *
 * 앵커 법선 라우팅은 getBaseElbowPoints(= bend 가 없을 때)에만 있었다.
 * 저장된 bend 가 있으면 applyBends 가 경로를 만드는데 거긴 앵커를 보지 않아,
 * 왼쪽 변에 붙은 커넥터가 오른쪽으로 나가며 도형을 관통했다.
 *
 * applyBends 내부를 건드리지 않고 **결과 경로의 첫/마지막 구간만** 교체한다.
 * 저작한 코너·엘보우·계단은 그대로 남는다.
 *
 *   기존:  start ──▶ (leftX, start.y) ──▶ (leftX, elbowY) ──▶ …
 *   교체:  start ◀── stub
 *                    stub ──▶ (stub.x, elbowY) ──▶ (leftX, elbowY) ──▶ …
 */
function applyAnchorLeadInOut(
  points: Point[],
  start: Point,
  end: Point,
  srcDir: Vec | null,
  tgtDir: Vec | null,
): Point[] {
  if (points.length < 3) return points;
  let out = points;

  // --- 출발: 첫 구간이 소스 앵커 법선과 반대인가 -------------------------
  if (srcDir && srcDir.x !== 0) {
    const first = out[1]!;
    const second = out[2]!;
    const goes = first.x - start.x;
    const conflicts = goes * srcDir.x < 0;
    // 두 번째 점의 Y 가 달라야 '나갔다가 세로로 비켜서' 돌아올 수 있다.
    const canDetour = Math.abs(second.y - start.y) > 1e-6;

    if (conflicts && canDetour) {
      const stubX = start.x + srcDir.x * ELBOW_EXTENSION;
      out = [
        start,
        { x: stubX, y: start.y },
        { x: stubX, y: second.y },
        ...out.slice(2),
      ];
    }
  }

  // --- 도착 쪽은 손대지 않는다 ------------------------------------------
  //
  // 타깃 앵커에도 같은 규칙을 적용해 봤지만, 앞서 합의한 X축 반전 동작
  // ("저작한 모양은 그대로, 마지막 연결선 방향만 바뀐다")과 충돌한다.
  // 타깃이 코너보다 앞에 오면 오른쪽에서 진입하는 것이 자연스럽고,
  // 그걸 앵커 법선으로 강제하면 불필요한 우회가 생긴다.
  //
  // 확인된 증상은 출발 쪽이므로 거기까지만 고친다.
  void end;
  void tgtDir;

  return out;
}

/**
 * 계단 중간 수직선을 '저작한 코너' 기준으로만 제한한다.
 *
 * 예전에는 [끝점, 코너] 범위로 클램프했는데, 그러면 도형을 움직여 끝점이
 * 가까워질 때마다 저작한 계단이 끌려와 작아졌다. 끝점은 사용자가 만든
 * 모양에 영향을 주면 안 된다.
 *
 * 막아야 하는 것은 중간선이 **코너를 넘어가서** 경로가 되돌아오는 것뿐이다.
 *
 * @param towardPositive 진행 방향이 +x 인가 (좌측 영역은 코너가 오른쪽에 있다)
 */
function clampAtCorner(
  value: number,
  corner: number,
  towardPositive: boolean,
): number {
  return towardPositive ? Math.min(value, corner) : Math.max(value, corner);
}

/**
 * 같은 축을 공유하는 두 스텁을 잇는다.
 *
 * - 마주보고 있으면(서로를 향해 진행 가능) 중간선에서 갈아탄다.
 * - 등지고 있으면(반전 배치) 두 도형을 **비껴가는** 우회선을 잡는다.
 *   이때 필요한 여유가 도형 크기에 비례하므로 sourceSize/targetSize를 쓴다.
 */
function connectSameAxis(
  start: Point,
  end: Point,
  s: Point,
  t: Point,
  srcDir: Vec,
  tgtDir: Vec,
  axis: Axis,
  options?: ElbowPathOptions,
): Point[] {
  if (axis === "horizontal") {
    const canAdvance = (t.x - s.x) * srcDir.x > 0;
    const targetFacesBack = (s.x - t.x) * tgtDir.x > 0;

    if (canAdvance && targetFacesBack) {
      const midX = (s.x + t.x) / 2;
      return [s, { x: midX, y: s.y }, { x: midX, y: t.y }, t];
    }

    // 등지고 있음 → 두 도형을 위/아래로 비껴간다
    const srcHalf = halfExtent(options?.sourceSize, "vertical");
    const tgtHalf = halfExtent(options?.targetSize, "vertical");
    const gap = Math.abs(start.y - end.y);
    const needed = srcHalf + tgtHalf + ELBOW_CLEARANCE * 2;

    let detourY: number;
    if (gap >= needed) {
      detourY = (start.y + end.y) / 2; // 사이로 질러갈 공간이 있다
    } else if (end.y >= start.y) {
      detourY = Math.max(start.y + srcHalf, end.y + tgtHalf) + ELBOW_CLEARANCE;
    } else {
      detourY = Math.min(start.y - srcHalf, end.y - tgtHalf) - ELBOW_CLEARANCE;
    }

    return [s, { x: s.x, y: detourY }, { x: t.x, y: detourY }, t];
  }

  const canAdvance = (t.y - s.y) * srcDir.y > 0;
  const targetFacesBack = (s.y - t.y) * tgtDir.y > 0;

  if (canAdvance && targetFacesBack) {
    const midY = (s.y + t.y) / 2;
    return [s, { x: s.x, y: midY }, { x: t.x, y: midY }, t];
  }

  const srcHalf = halfExtent(options?.sourceSize, "horizontal");
  const tgtHalf = halfExtent(options?.targetSize, "horizontal");
  const gap = Math.abs(start.x - end.x);
  const needed = srcHalf + tgtHalf + ELBOW_CLEARANCE * 2;

  let detourX: number;
  if (gap >= needed) {
    detourX = (start.x + end.x) / 2;
  } else if (end.x >= start.x) {
    detourX = Math.max(start.x + srcHalf, end.x + tgtHalf) + ELBOW_CLEARANCE;
  } else {
    detourX = Math.min(start.x - srcHalf, end.x - tgtHalf) - ELBOW_CLEARANCE;
  }

  return [s, { x: detourX, y: s.y }, { x: detourX, y: t.y }, t];
}

/**
 * 기본 elbowed 경로 포인트 계산 (bends 없이)
 *
 * 1. 소스 앵커 바깥으로 스텁을 뽑고, 타깃 앵커 바깥에도 스텁을 잡는다.
 * 2. 두 스텁을 축 정렬 경로로 잇는다.
 *    - 축이 다르면 L자 하나로 끝난다 (혼합 앵커).
 *    - 축이 같으면 마주보는지 등지는지에 따라 중간선 / 우회선을 쓴다.
 * 3. 중복·일직선 점을 정리한다.
 */
function getBaseElbowPoints(
  start: Point,
  end: Point,
  sourceAnchor?: string,
  targetAnchor?: string,
  options?: ElbowPathOptions,
): Point[] {
  const { srcDir, tgtDir } = resolveDirections(
    start,
    end,
    sourceAnchor,
    targetAnchor,
  );
  const srcAxis = axisOf(srcDir);
  const tgtAxis = axisOf(tgtDir);

  // 직선 스냅 — 두 앵커가 같은 축을 볼 때만 허용한다.
  // (앵커가 top인데 수평 직선을 그으면 도형 옆구리에서 선이 나온다)
  if (
    srcAxis === "horizontal" &&
    tgtAxis === "horizontal" &&
    Math.abs(start.y - end.y) < STRAIGHT_LINE_SNAP_THRESHOLD
  ) {
    return [start, { x: end.x, y: start.y }];
  }
  if (
    srcAxis === "vertical" &&
    tgtAxis === "vertical" &&
    Math.abs(start.x - end.x) < STRAIGHT_LINE_SNAP_THRESHOLD
  ) {
    return [start, { x: start.x, y: end.y }];
  }

  // 앵커 바깥으로 뽑은 스텁 점
  const s: Point = {
    x: start.x + srcDir.x * ELBOW_EXTENSION,
    y: start.y + srcDir.y * ELBOW_EXTENSION,
  };
  const t: Point = {
    x: end.x + tgtDir.x * ELBOW_EXTENSION,
    y: end.y + tgtDir.y * ELBOW_EXTENSION,
  };

  let middle: Point[];
  if (srcAxis !== tgtAxis) {
    // 혼합 앵커 → L자 하나로 이어진다
    const corner: Point =
      srcAxis === "horizontal" ? { x: t.x, y: s.y } : { x: s.x, y: t.y };
    middle = [s, corner, t];
  } else {
    middle = connectSameAxis(
      start,
      end,
      s,
      t,
      srcDir,
      tgtDir,
      srcAxis,
      options,
    );
  }

  return simplify([start, ...middle, end]);
}

/**
 * Bends를 적용한 경로 포인트 계산
 *
 * FigJam 스타일 계단식 꺾임 (반절 계단):
 * - elbowY: 중앙 수평선의 Y 좌표
 * - leftY: 좌측 계단 Y 좌표 (Shape에 연결된 시작점은 startY 유지, 코너 방향 반절만 leftY)
 * - rightY: 우측 계단 Y 좌표 (Shape에 연결된 끝점은 endY 유지, 코너 방향 반절만 rightY)
 *
 * 좌측 계단 경로 (leftY가 startY와 다를 때):
 * start(startY) → [수평] → midLeft(startY) → [수직] → midLeft(leftY) → [수평] → leftCorner(leftY) → [수직] → leftCorner(elbowY)
 *
 * 우측 계단 경로 (rightY가 endY와 다를 때):
 * rightCorner(elbowY) → [수직] → rightCorner(rightY) → [수평] → midRight(rightY) → [수직] → midRight(endY) → [수평] → end(endY)
 *
 * @param basePoints - 기본 경로 포인트 (getBaseElbowPoints에서 반환된 값)
 * @param bends - 적용할 bend 배열
 * @param originalStart - 원래 시작점 (직선 스냅 전의 좌표, shape 이동 시 연결점 독립성 보장)
 * @param originalEnd - 원래 끝점 (직선 스냅 전의 좌표, shape 이동 시 연결점 독립성 보장)
 */
function applyBends(
  basePoints: Point[],
  bends: ElbowBend[],
  originalStart: Point,
  originalEnd: Point,
): Point[] {
  if (bends.length === 0) return basePoints;

  // 원래 좌표 사용 (basePoints는 직선 스냅 등으로 변경될 수 있음)
  const start = originalStart;
  const end = originalEnd;

  // X축 반전 감지 (source가 target보다 오른쪽에 있음)
  const isXReversed = start.x > end.x;

  // Primary bend 찾기
  const primaryBend = bends.find(
    (b) => b.region === "primary" || (!b.region && b.segmentIndex === 0),
  );

  // 전체 직선 스냅: 모든 핵심 Y 좌표가 threshold 이내이면 직선으로 반환
  // 이렇게 하면 segments.length === 1 이 되어 핸들러도 1/2 지점 하나로 돌아감
  if (primaryBend && primaryBend.elbowY !== undefined) {
    const elbowY = primaryBend.elbowY;
    const leftY = primaryBend.leftY ?? start.y;
    const rightY = primaryBend.rightY ?? end.y;

    // 모든 Y 좌표가 직선 범위 내인지 확인 (start.y 기준)
    const allYsInRange =
      Math.abs(start.y - end.y) < STRAIGHT_LINE_SNAP_THRESHOLD &&
      Math.abs(start.y - elbowY) < STRAIGHT_LINE_SNAP_THRESHOLD &&
      Math.abs(leftY - start.y) < STRAIGHT_LINE_SNAP_THRESHOLD &&
      Math.abs(rightY - end.y) < STRAIGHT_LINE_SNAP_THRESHOLD;

    if (allYsInRange) {
      // 전체가 직선 범위 → 단순 직선 반환
      return [start, { x: end.x, y: start.y }];
    }
  }

  // 절대 좌표가 저장되어 있으면 ㄷ자 경로 생성
  if (
    primaryBend &&
    (primaryBend.elbowY !== undefined ||
      primaryBend.leftCornerX !== undefined ||
      primaryBend.rightCornerX !== undefined)
  ) {
    // 절대 좌표 계산 (저장된 값 또는 비율 기반)
    const leftX =
      primaryBend.leftCornerX ??
      start.x +
        (end.x - start.x) * (primaryBend.leftCornerRatio ?? DEFAULT_LEFT_RATIO);
    const rightX =
      primaryBend.rightCornerX ??
      start.x +
        (end.x - start.x) *
          (primaryBend.rightCornerRatio ?? DEFAULT_RIGHT_RATIO);

    // elbowY 계산:
    // - elbowY가 저장되어 있으면: 절대 좌표 사용 (Shape 이동과 독립)
    // - elbowY가 없으면: start.y + offset으로 계산 (이전 버전 호환)
    const elbowY =
      primaryBend.elbowY !== undefined
        ? primaryBend.elbowY // 절대 좌표 사용
        : start.y + primaryBend.offset; // fallback: 상대 좌표

    // X축 반전 시: 기존 엘보우 유지하면서 마지막 수평선만 연장
    // FigJam 스타일: 기존 형태 유지, rightCorner에서 end까지 L자로 직접 연결
    if (isXReversed) {
      // leftX, rightX는 기존 저장 값 유지 (엘보우 형태 유지)
      const leftY = primaryBend.leftY ?? start.y;

      const result: Point[] = [];

      // 좌측 영역: start → (연속 계단) → leftCorner
      //
      // 반전이라고 좌측 계단이 사라지면 안 된다 — 정방향과 같은 순서로
      // 층들을 그린 뒤 leftY 로 내려간다. (예전엔 이 루프가 없어서 반전
      // 배치에서 저작한 층들이 통째로 렌더에서 빠졌다)
      {
        const revLeftSteps = primaryBend.leftYSteps ?? [];
        let curY = start.y;
        let curX = start.x;
        result.push(start);

        for (const step of revLeftSteps) {
          const stepMidX = step.midX ?? (curX + leftX) / 2;
          result.push({ x: stepMidX, y: curY });
          result.push({ x: stepMidX, y: step.y });
          curY = step.y;
          curX = stepMidX;
        }

        if (Math.abs(leftY - curY) > 1) {
          const midLeftX = clampAtCorner(
            primaryBend.midLeftX ?? (curX + leftX) / 2,
            leftX,
            curX <= leftX,
          );
          result.push({ x: midLeftX, y: curY });
          result.push({ x: midLeftX, y: leftY });
          result.push({ x: leftX, y: leftY });
        } else {
          result.push({ x: leftX, y: curY });
        }
      }

      // 중앙 영역: leftCorner(elbowY) → rightCorner(elbowY)
      result.push({ x: leftX, y: elbowY });
      result.push({ x: rightX, y: elbowY });

      // 우측 영역: 저작된 계단을 **그대로** 그린다.
      //
      // 반전이라고 해서 모양을 손대면 안 된다. 사용자가 만든 것은 그 자리에
      // 두고, 타깃까지 가는 **마지막 수평선의 방향만** 바뀌면 된다.
      //
      // ⚠️ midRightX 를 [rightX, end.x] 로 클램프하면 안 된다.
      //    반전 상태에서는 그 범위가 뒤집혀 있어서 저작한 800 이 코너(700)로
      //    끌려오고, 수평선이 사라지면서 세로선이 두 번 연속돼 스파이크가 된다.
      //    (정방향에서만 의미 있는 클램프였다)
      if (primaryBend.rightY !== undefined) {
        const storedRightY = primaryBend.rightY;
        const midRightX = primaryBend.midRightX ?? (rightX + end.x) / 2;
        const revRightSteps = primaryBend.rightYSteps ?? [];

        result.push({ x: rightX, y: storedRightY }); // 코너에서 혹 높이로
        result.push({ x: midRightX, y: storedRightY }); // 수평: 저작 그대로

        // 연속 계단 층들 — 정방향과 같은 사슬 규칙으로 그린다.
        // (없으면 end 세그먼트에서 만든 새 층이 저장만 되고 화면에 안 나온다)
        let curY = storedRightY;
        let curX = midRightX;
        for (const step of revRightSteps) {
          const stepMidX = step.midX ?? (curX + end.x) / 2;
          result.push({ x: stepMidX, y: curY });
          result.push({ x: stepMidX, y: step.y });
          curY = step.y;
          curX = stepMidX;
        }

        if (Math.abs(curY - end.y) < STRAIGHT_LINE_SNAP_THRESHOLD) {
          result.push(end);
        } else if (revRightSteps.length > 0) {
          // 층이 있으면 정방향과 같은 규칙으로 '수평 → 수직' 으로 닫는다.
          // 수직부터 닫으면 마지막 층의 midX 와 마무리 X 가 같은 세로선에
          // 겹쳐 폭 0 왕복이 되고, 층의 수평 구간 자체가 사라진다.
          result.push({ x: end.x, y: curY });
          result.push(end);
        } else {
          result.push({ x: curX, y: end.y }); // 수직
          result.push(end); // 수평 — 방향만 타깃 쪽으로
        }
      } else if (Math.abs(elbowY - end.y) < STRAIGHT_LINE_SNAP_THRESHOLD) {
        // 우측 계단 없음: 코너에서 바로 end 로
        result.push(end);
      } else {
        result.push({ x: rightX, y: end.y });
        result.push(end);
      }

      return result;
    }

    // 저장된 코너(leftCornerX/rightCornerX)는 **건드리지 않는다**.
    //
    // 한때 이 값을 [start.x, end.x] 로 클램프했었다. 역주행을 막으려는
    // 의도였지만, 그 결과 타깃을 움직일 때마다 사용자가 만들어 둔 계단이
    // 끌려왔다. 저작한 모양은 끝점이 움직여도 그대로 있어야 한다.
    //
    // 끝점이 코너보다 앞에 오면 마지막 연결선이 왼쪽으로 향하게 되는데,
    // 그건 잘못된 게 아니라 '오른쪽에서 진입'하는 자연스러운 L 자다.
    // 진짜 막아야 하는 것은 같은 축을 왕복하는 스파이크뿐이다.

    // 계단식 꺾임을 위한 Y 좌표 (없으면 시작/끝점 Y 사용)
    const leftY = primaryBend.leftY ?? start.y;
    const rightY = primaryBend.rightY ?? end.y;

    // 연속 계단 데이터 (먼저 선언)
    const leftYSteps = primaryBend.leftYSteps ?? [];
    const rightYSteps = primaryBend.rightYSteps ?? [];

    // FigJam 스타일 적용 조건:
    // 1. 연속 계단(rightYSteps)이 있는 경우 → 항상 FigJam 스타일 (계단 구조 유지)
    // 2. rightY가 elbowY-end.y 범위를 벗어난 경우 → FigJam 스타일 (Y축 반전)
    const hasRightYSteps = rightYSteps.length > 0;
    const isRightYOutOfRange =
      primaryBend.rightY !== undefined &&
      ((elbowY <= end.y &&
        (primaryBend.rightY < elbowY - 1 || primaryBend.rightY > end.y + 1)) ||
        (elbowY > end.y &&
          (primaryBend.rightY > elbowY + 1 || primaryBend.rightY < end.y - 1)));
    const useFigJamStyleRight = hasRightYSteps || isRightYOutOfRange;

    // 핸들러에서 이미 범위 제한을 적용했으므로, 저장된 값을 그대로 사용
    // (범위 체크/재조정 로직 제거)

    const result: Point[] = [];

    // 좌측 영역: start → leftCorner
    if (leftYSteps.length > 0 || Math.abs(leftY - start.y) > 1) {
      // 연속 계단 또는 단일 계단 있음
      result.push(start);

      // 연속 계단 처리: 각 step에 대해 계단 추가
      let currentY = start.y;
      let currentX = start.x;

      for (let i = 0; i < leftYSteps.length; i++) {
        const step = leftYSteps[i]!;
        // 저장된 midX 그대로 사용 (재조정 제거)
        const stepMidX = step.midX ?? (currentX + leftX) / 2;

        result.push({ x: stepMidX, y: currentY }); // 수평: currentY 유지
        result.push({ x: stepMidX, y: step.y }); // 수직: step.y로 이동

        // 다음 계단은 이전 step.y에서 연속적으로 이어짐
        currentY = step.y;
        currentX = stepMidX;
      }

      // 마지막 단계: leftY 계단 (있으면)
      if (Math.abs(leftY - start.y) > 1) {
        // FigJam 스타일 반절 계단
        // 저장된 midLeftX 그대로 사용 (재조정 제거)
        const midLeftX = clampAtCorner(
          primaryBend.midLeftX ?? (currentX + leftX) / 2,
          leftX,
          currentX <= leftX,
        );

        result.push({ x: midLeftX, y: currentY }); // 수평: currentY 유지
        result.push({ x: midLeftX, y: leftY }); // 수직: leftY로 이동 (그대로 사용)
        result.push({ x: leftX, y: leftY }); // 수평: leftCorner까지
      } else {
        // leftY 계단 없음 (연속 계단만 있음)
        result.push({ x: leftX, y: currentY });
      }
    } else {
      // 계단 없음: start → leftCorner (직선)
      result.push(start);
      result.push({ x: leftX, y: start.y });
    }

    // 중앙 영역: leftCorner(elbowY) → rightCorner(elbowY)
    result.push({ x: leftX, y: elbowY });
    result.push({ x: rightX, y: elbowY });

    // 우측 영역: rightCorner → end
    // FigJam 스타일 시: 기존 계단 모두 유지하고 마지막 연결만 조절
    if (useFigJamStyleRight) {
      // FigJam 스타일: 모든 기존 계단 고정, 마지막 수직선만 조절
      let currentY = elbowY;
      let currentX = rightX;

      // rightY 계단 처리 (고정값 유지)
      if (primaryBend.rightY !== undefined) {
        const storedRightY = primaryBend.rightY;
        const midRightX = clampAtCorner(
          primaryBend.midRightX ?? (rightX + end.x) / 2,
          rightX,
          false, // 코너보다 왼쪽으로 오지 않게만 (end.x 로는 제한하지 않는다)
        );

        result.push({ x: rightX, y: storedRightY }); // rightCorner에서 storedRightY로
        result.push({ x: midRightX, y: storedRightY }); // 수평: storedRightY 유지

        currentY = storedRightY;
        currentX = midRightX;
      }

      // 연속 계단 처리 (rightYSteps도 고정값으로 유지)
      for (let i = 0; i < rightYSteps.length; i++) {
        const step = rightYSteps[i]!;
        // 저장된 midX 그대로 사용 (재조정 제거)
        const stepMidX = step.midX ?? (currentX + end.x) / 2;

        result.push({ x: stepMidX, y: currentY }); // 수평: currentY 유지
        result.push({ x: stepMidX, y: step.y }); // 수직: step.y로 이동 (고정값)

        currentY = step.y;
        currentX = stepMidX;
      }

      // 마지막 연결: 항상 end로 끝나야 함 (녹색 점 위치와 일치)
      if (Math.abs(currentY - end.y) < STRAIGHT_LINE_SNAP_THRESHOLD) {
        // 직선 스냅: end까지 직접 연결 (불필요한 수직 이동 생략)
        result.push(end);
      } else if (rightYSteps.length > 0) {
        // 연속 계단이 있으면 좌측과 대칭으로 '수평 → 수직' 으로 닫는다.
        //
        // 수직부터 닫으면 마지막 계단 층(step.y)이 자기 수평 구간을 갖지 못하고
        // 수직선 위의 점으로만 남는다. 그러면 그 층을 잡을 핸들도 만들 수 없어서
        // "보이는데 조작할 수 없는" 계단이 된다.
        result.push({ x: end.x, y: currentY });
        result.push(end);
      } else {
        // 계단이 없을 때는 기존 모양(수직 → 수평)을 유지한다
        result.push({ x: currentX, y: end.y });
        result.push(end);
      }
    } else if (rightYSteps.length > 0 || Math.abs(rightY - end.y) > 1) {
      // 일반 계단 처리 (기존 로직)
      let currentY = elbowY;
      let currentX = rightX;

      // rightY 계단 처리
      if (Math.abs(rightY - end.y) > 1) {
        // 저장된 midRightX 그대로 사용 (재조정 제거)
        const midRightX = clampAtCorner(
          primaryBend.midRightX ?? (rightX + end.x) / 2,
          rightX,
          false, // 코너보다 왼쪽으로 오지 않게만 (end.x 로는 제한하지 않는다)
        );

        result.push({ x: rightX, y: rightY }); // rightCorner에서 rightY로 (그대로 사용)
        result.push({ x: midRightX, y: rightY }); // 수평: rightY 유지
        result.push({ x: midRightX, y: end.y }); // 수직: end.y로 (좌측과 대칭)

        currentY = end.y;
        currentX = midRightX;
      }

      // 연속 계단 처리 (end.y에서 시작)
      for (let i = 0; i < rightYSteps.length; i++) {
        const step = rightYSteps[i]!;
        // 저장된 midX 그대로 사용 (재조정 제거)
        const stepMidX = step.midX ?? (currentX + end.x) / 2;

        result.push({ x: stepMidX, y: currentY }); // 수평: currentY 유지
        result.push({ x: stepMidX, y: step.y }); // 수직: step.y로 이동

        currentY = step.y;
        currentX = stepMidX;
      }

      // 마지막 연결: 항상 end로 끝나야 함 (녹색 점 위치와 일치)
      if (Math.abs(currentY - end.y) < STRAIGHT_LINE_SNAP_THRESHOLD) {
        // 직선 스냅: end까지 직접 연결 (불필요한 수직 이동 생략)
        result.push(end);
      } else {
        // 기존 로직: 수평 후 수직
        result.push({ x: end.x, y: currentY });
        result.push(end);
      }
    } else {
      // 계단 없음: rightCorner → end (기본 스타일: 수직 먼저 → 수평)
      result.push({ x: rightX, y: end.y });
      result.push(end);
    }

    return result;
  }

  // 직선 상태 (2개 포인트)에서 bend 적용 시 ㄷ자로 확장
  if (basePoints.length === 2 && bends.length > 0 && primaryBend) {
    const isHorizontal = Math.abs(start.y - end.y) < 1;

    if (isHorizontal) {
      const leftX =
        start.x +
        (end.x - start.x) * (primaryBend.leftCornerRatio ?? DEFAULT_LEFT_RATIO);
      const rightX =
        start.x +
        (end.x - start.x) *
          (primaryBend.rightCornerRatio ?? DEFAULT_RIGHT_RATIO);
      const elbowY = start.y + primaryBend.offset;

      return [
        start,
        { x: leftX, y: start.y },
        { x: leftX, y: elbowY },
        { x: rightX, y: elbowY },
        { x: rightX, y: end.y },
        end,
      ];
    } else {
      const topY =
        start.y +
        (end.y - start.y) * (primaryBend.leftCornerRatio ?? DEFAULT_LEFT_RATIO);
      const bottomY =
        start.y +
        (end.y - start.y) *
          (primaryBend.rightCornerRatio ?? DEFAULT_RIGHT_RATIO);
      return [
        start,
        { x: start.x, y: topY },
        { x: start.x + primaryBend.offset, y: topY },
        { x: start.x + primaryBend.offset, y: bottomY },
        { x: start.x, y: bottomY },
        end,
      ];
    }
  }

  // 세그먼트별 bend 정보 맵 (레거시 처리)
  const bendBySegment = new Map<number, ElbowBend>();
  for (const bend of bends) {
    if (!bend.region) {
      bendBySegment.set(bend.segmentIndex, bend);
    }
  }

  const result: Point[] = [basePoints[0]!];

  for (let i = 0; i < basePoints.length - 1; i++) {
    const segStart = basePoints[i]!;
    const segEnd = basePoints[i + 1]!;
    const bend = bendBySegment.get(i);

    if (bend) {
      const isHorizontal = Math.abs(segStart.y - segEnd.y) < 1;
      const leftRatio = bend.leftCornerRatio ?? DEFAULT_LEFT_RATIO;
      const rightRatio = bend.rightCornerRatio ?? DEFAULT_RIGHT_RATIO;

      if (isHorizontal) {
        const leftX = segStart.x + (segEnd.x - segStart.x) * leftRatio;
        const rightX = segStart.x + (segEnd.x - segStart.x) * rightRatio;
        result.push({ x: leftX, y: segStart.y });
        result.push({ x: leftX, y: segStart.y + bend.offset });
        result.push({ x: rightX, y: segStart.y + bend.offset });
        result.push({ x: rightX, y: segStart.y });
        if (Math.abs(segStart.y - segEnd.y) > 1) {
          result.push({ x: segEnd.x, y: segEnd.y });
        }
      } else {
        const topY = segStart.y + (segEnd.y - segStart.y) * leftRatio;
        const bottomY = segStart.y + (segEnd.y - segStart.y) * rightRatio;
        result.push({ x: segStart.x, y: topY });
        result.push({ x: segStart.x + bend.offset, y: topY });
        result.push({ x: segStart.x + bend.offset, y: bottomY });
        result.push({ x: segStart.x, y: bottomY });
        if (Math.abs(segStart.x - segEnd.x) > 1) {
          result.push({ x: segEnd.x, y: segEnd.y });
        }
      }
    } else {
      result.push(segEnd);
    }
  }

  return result;
}

/**
 * Elbow 경로 계산 (메인 함수)
 * Note: 둥근 모서리는 Connector.tsx 의 sceneFunc 이 그린다. 예전엔 여기로
 * cornerStyle/cornerRadius 를 넘겼는데 무시되기만 해서 (넘긴 값이 먹는 줄
 * 아는 함정) 파라미터를 제거했다.
 */
export function calculateElbowPath(
  start: Point,
  end: Point,
  bends: ElbowBend[] = [],
  sourceAnchor?: string,
  targetAnchor?: string,
  options?: ElbowPathOptions,
): number[] {
  const basePoints = getBaseElbowPoints(
    start,
    end,
    sourceAnchor,
    targetAnchor,
    options,
  );
  // 원래의 start/end 좌표를 전달하여 shape 이동 시 연결점 독립성 보장
  // 중복점만 걷어낸다. 일직선 중간점은 핸들 세그먼트라 유지해야 한다.
  let pointsWithBends = dedupePoints(applyBends(basePoints, bends, start, end));

  // 저작한 bend 가 있어도 앵커 바깥으로 나가고 들어와야 한다.
  if (bends.length > 0 && (sourceAnchor || targetAnchor)) {
    pointsWithBends = dedupePoints(
      applyAnchorLeadInOut(
        pointsWithBends,
        start,
        end,
        anchorToDir(sourceAnchor),
        anchorToDir(targetAnchor),
      ),
    );
  }

  // 경로의 마지막 점이 end와 다르면 end로 교체 (화살표 위치 일치 보장)
  const lastPoint = pointsWithBends[pointsWithBends.length - 1];
  if (lastPoint && (lastPoint.x !== end.x || lastPoint.y !== end.y)) {
    pointsWithBends = [...pointsWithBends.slice(0, -1), end];
  }

  // 폭 0 왕복은 어떤 저작 의도도 표현하지 않는다 — 최종 반환 직전에 접는다.
  pointsWithBends = collapseRetrace(pointsWithBends);

  // Note: rounded corners are now handled directly in Connector.tsx sceneFunc
  // This allows proper quadraticCurveTo rendering instead of additional points
  return pointsWithBends.flatMap((p) => [p.x, p.y]);
}

/**
 * 경로 포인트에서 세그먼트 목록 추출
 */
export function getSegments(points: number[]): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 2; i += 2) {
    const start = { x: points[i]!, y: points[i + 1]! };
    const end = { x: points[i + 2]!, y: points[i + 3]! };

    if (start.x === end.x && start.y === end.y) continue;

    // 축 분류는 절대 오차가 아니라 '어느 축이 지배적인가'로 한다.
    //
    // 완전한 엘보우 경로의 세그먼트는 정확히 축 정렬이라 어느 방식이든 같지만,
    // 직선 스냅(STRAIGHT_LINE_SNAP_THRESHOLD, 15px) 경로는 마지막 점이 end 로
    // 보정되면서 최대 15px 기울어진다. 절대 오차(0.01)로 재면 그 선이
    // vertical 로 분류되고, 핸들 드래그가 '수직 직선' 분기로 빠져 Y 이동이
    // 통째로 무시된다(= 엘보우가 아예 안 만들어진다).
    const direction: "horizontal" | "vertical" =
      Math.abs(start.x - end.x) >= Math.abs(start.y - end.y)
        ? "horizontal"
        : "vertical";

    segments.push({
      start,
      end,
      index: segments.length,
      direction,
    });
  }
  return segments;
}

/**
 * 핸들 타입 (확장):
 * - 'center': 중앙 수평 핸들 (파란색, Y축 이동) - ㄷ자 높이 조절
 * - 'left': ㄷ자 좌측 수직 핸들 (회색, X축 이동) - 좌측 코너 위치
 * - 'right': ㄷ자 우측 수직 핸들 (회색, X축 이동) - 우측 코너 위치
 * - 'startHorizontal': Shape A에 연결된 수평 핸들 (파란색, Y축 이동)
 * - 'endHorizontal': Shape B에 연결된 수평 핸들 (파란색, Y축 이동)
 */
export type ExtendedHandleType =
  | HandleType
  | "startHorizontal"
  | "endHorizontal";

export interface ExtendedMidpointHandle extends Point {
  segmentIndex: number;
  canBend: boolean;
  direction: "horizontal" | "vertical";
  handleType: ExtendedHandleType;
}

/**
 * ㄷ자 커넥터의 핸들 위치 계산
 *
 * 직선 상태: 중앙에 파란색 핸들 1개 (Y축 드래그 → ㄷ자로 변환)
 * ㄷ자 상태: 동적 핸들 생성
 *   - 수평 세그먼트: 파란색 핸들 (Y축 이동) - 새 엘보우 생성 가능
 *   - 수직 세그먼트: 회색 핸들 (X축 이동) - 코너 위치 조절
 *
 * 다중 엘보우 (FigJam 스타일):
 *   - leftY와 일치하는 수평 세그먼트 → region='left', canAdjustY=true
 *   - rightY와 일치하는 수평 세그먼트 → region='right', canAdjustY=true
 *   - elbowY와 일치하는 수평 세그먼트 → region='primary' (elbowY 조절)
 *   - startY/endY와 일치하는 수평 세그먼트 → 새 계단 생성 가능
 *   - leftYSteps[i]/rightYSteps[i] 와 일치하는 수평 세그먼트 → 그 층 전용 핸들
 *     (stepIndex 로 구분한다. 예전에는 region 만으로 중복 제거해서 층이 여러 개면
 *      첫 층만 핸들을 갖고 나머지는 조작할 수 없었다)
 */
export function getMidpointHandlePositions(
  segments: Segment[],
  existingBends: ElbowBend[],
  startY?: number,
  endY?: number,
): MidpointHandle[] {
  const isStraight = segments.length === 1;

  if (isStraight) {
    // 직선: 중간에 파란색 핸들 1개
    const seg = segments[0]!;
    return [
      {
        x: (seg.start.x + seg.end.x) / 2,
        y: (seg.start.y + seg.end.y) / 2,
        segmentIndex: 0,
        canBend: true,
        direction: seg.direction,
        handleType: "center",
        region: "primary",
      },
    ];
  }

  // 다중 세그먼트: 동적으로 핸들 생성
  const handles: MidpointHandle[] = [];

  // 기본 ㄷ자 bend (region='primary' 또는 segmentIndex=0)
  const primaryBend = existingBends.find(
    (b) => b.region === "primary" || (!b.region && b.segmentIndex === 0),
  );

  // 저장된 Y 좌표들
  const leftY = primaryBend?.leftY;
  const rightY = primaryBend?.rightY;
  const elbowY = primaryBend?.elbowY;
  // 코너 X 좌표 (좌/우 영역 구분용)
  const leftCornerX = primaryBend?.leftCornerX;
  const rightCornerX = primaryBend?.rightCornerX;
  // 연속 계단 층들 — 각 층의 수평선도 조작 핸들을 가져야 한다
  const leftYStepsForHandles = primaryBend?.leftYSteps ?? [];
  const rightYStepsForHandles = primaryBend?.rightYSteps ?? [];

  // 직선 스냅 감지: 우측/좌측 계단이 직선 스냅되었는지 체크
  // 직선 스냅된 구간에서는 해당 계단 핸들러를 생성하지 않음 (중복 방지)
  const isRightStraightSnapped =
    rightY !== undefined &&
    endY !== undefined &&
    Math.abs(rightY - endY) < STRAIGHT_LINE_SNAP_THRESHOLD;
  const isLeftStraightSnapped =
    leftY !== undefined &&
    startY !== undefined &&
    Math.abs(leftY - startY) < STRAIGHT_LINE_SNAP_THRESHOLD;

  // 연속 계단 층은 '경로에 나오는 순서대로' 배정한다.
  //
  // X 좌표만으로 매칭하면 같은 X 에 수직선이 둘 이상일 때 구분이 안 되어,
  // 위쪽 핸들을 끌었는데 아래쪽 값이 바뀐다. applyBends 는 층을 순서대로
  // 그리므로, 커서를 두고 하나씩 소비하면 중복이 원천적으로 생기지 않는다.
  let leftStepCursor = 0;
  let rightStepCursor = 0;
  // 코너/중간선은 각각 정확히 하나의 수직 세그먼트에서 나온다 — 한 번 배정하면 소비.
  const usedVerticalTargets = new Set<string>();
  // 수평도 동일 원칙 — leftY/rightY 는 각각 정확히 하나의 수평선에서 나온다.
  let usedLeftY = false;
  let usedRightY = false;
  let usedPrimary = false;
  // 수평 층도 경로 순서대로 소비한다 (findIndex 는 같은 Y 층을 구분 못 한다)
  let hLeftStepCursor = 0;
  let hRightStepCursor = 0;

  // 수평 세그먼트만 필터링 (인덱스 유지)
  const horizontalSegments = segments
    .map((seg, idx) => ({ seg, idx }))
    .filter((item) => item.seg.direction === "horizontal");

  // 기본 ㄷ자(5세그먼트)에서 중앙 수평 세그먼트 찾기
  const centerHorizontalIdx = Math.floor(horizontalSegments.length / 2);

  // 공선 런(run): 경로상 인접한 같은 방향 세그먼트는 시각적으로 한 직선이다.
  // 저작값 둘이 같은 Y(또는 X)에 겹치면 사이의 수직선이 길이 0 이 되어
  // 일직선 중간점이 남고, 한 직선이 여러 조각으로 나뉜다. 핸들을 조각
  // 중앙에 두면 사용자에게는 '중앙이 아닌 곳의 핸들'로 보이므로,
  // 런 전체의 중앙에 하나만 놓는다. (collapseRetrace 가 역방향 쌍을
  // 접은 뒤라 런 내부 조각들은 항상 같은 방향으로 진행한다.)
  const runIdOf: number[] = [];
  for (let i = 0; i < segments.length; i++) {
    runIdOf[i] =
      i > 0 && segments[i]!.direction === segments[i - 1]!.direction
        ? runIdOf[i - 1]!
        : i;
  }
  const runMidpoint = (i: number): Point => {
    const id = runIdOf[i]!;
    let j = i;
    while (j + 1 < segments.length && runIdOf[j + 1] === id) j++;
    return {
      x: (segments[id]!.start.x + segments[j]!.end.x) / 2,
      y: (segments[id]!.start.y + segments[j]!.end.y) / 2,
    };
  };
  // 한 런에는 핸들 하나 — 뒤 조각은 분류(플래그 소비)만 하고 핸들은 내지 않는다.
  const emittedRuns = new Set<number>();

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const length =
      seg.direction === "horizontal"
        ? Math.abs(seg.end.x - seg.start.x)
        : Math.abs(seg.end.y - seg.start.y);

    // 최소 길이 체크 - 너무 짧은 세그먼트는 핸들 생성 안 함
    // 단, 주요 구간(startY/endY 연결 수평선, leftCorner/rightCorner 연결 수직선)은 예외
    if (length < 5) continue;

    if (seg.direction === "horizontal") {
      // 수평 세그먼트: 파란색 핸들 (Y축 이동)
      const segY = seg.start.y; // 수평 세그먼트의 Y 좌표

      // 세그먼트의 실제 Y 좌표와 저장된 값 비교로 역할 판단
      let region: "primary" | "left" | "right" | "newLeft" | "newRight" =
        "primary";
      let canAdjustY = false;
      // 연속 계단 층이면 몇 번째 층인지 — 드래그 처리에서 이 값으로 대상을 고른다
      let stepIndex: number | undefined;

      // 분류는 전부 Y-정체 + 경로 순서 소비로 한다.
      //
      // 한때 X 범위 휴리스틱(isLeftRegion/isRightRegion/isCenterRegion)으로
      // 걸렀지만, 코너가 경로의 한쪽 끝(예: top 앵커로 수직 진입하는 배치)에
      // 오면 그 판정이 통째로 뒤집혀 중앙·계단 핸들이 사라졌다.
      // 저장값과 세그먼트는 Y 로 1:1 이므로 X 는 볼 이유가 없다.
      const isElbowYSegment =
        elbowY !== undefined && Math.abs(segY - elbowY) < 1;

      const nextHLeft = leftYStepsForHandles[hLeftStepCursor];
      const nextHRight = rightYStepsForHandles[hRightStepCursor];

      if (isElbowYSegment && !usedPrimary) {
        // 중앙 수평 세그먼트 (elbowY) → elbowY 조절
        region = "primary";
        canAdjustY = false;
        usedPrimary = true;
      } else if (nextHLeft && Math.abs(segY - nextHLeft.y) < 1) {
        // 좌측 연속 계단의 한 층 (경로 순서대로 소비)
        region = "left";
        canAdjustY = true;
        stepIndex = hLeftStepCursor;
        hLeftStepCursor++;
      } else if (nextHRight && Math.abs(segY - nextHRight.y) < 1) {
        // 우측 연속 계단의 한 층
        region = "right";
        canAdjustY = true;
        stepIndex = hRightStepCursor;
        hRightStepCursor++;
      } else if (
        !usedLeftY &&
        leftY !== undefined &&
        Math.abs(segY - leftY) < 1
      ) {
        // leftY 세그먼트 — 경로 순서상 먼저 나오는 쪽이 좌측이다.
        // (leftY === rightY 인 경우도 소비 순서가 X 휴리스틱을 대체한다)
        region = "left";
        canAdjustY = true;
        usedLeftY = true;
      } else if (
        !usedRightY &&
        rightY !== undefined &&
        Math.abs(segY - rightY) < 1
      ) {
        region = "right";
        canAdjustY = true;
        usedRightY = true;
      } else if (startY !== undefined && Math.abs(segY - startY) < 1) {
        // start 세그먼트: 좌측 체인(leftY/계단)이 이미 있으면 이 드래그는
        // **새 층 생성**이어야 한다. 예전처럼 'left' 를 주면 기존 leftY 가
        // 움직여서, 여기를 끌었는데 다른 수평선이 움직였다.
        const hasLeftChain =
          leftY !== undefined || leftYStepsForHandles.length > 0;
        if (hasLeftChain) {
          region = "newLeft";
          canAdjustY = true;
        } else if (leftCornerX !== undefined) {
          // 체인 없음: 첫 계단 생성 (adjustLeftY 가 leftY 를 만든다)
          region = "left";
          canAdjustY = true;
        } else {
          // 코너 좌표 없음(레거시) → 인덱스 기반 판단
          const horzIdx = horizontalSegments.findIndex(
            (item) => item.idx === i,
          );
          if (horzIdx === 0) {
            region = "left";
            canAdjustY = true;
          } else if (horzIdx === horizontalSegments.length - 1) {
            region = "right";
            canAdjustY = true;
          }
        }
      } else if (endY !== undefined && Math.abs(segY - endY) < 1) {
        // end 세그먼트 — start 쪽과 대칭
        const hasRightChain =
          rightY !== undefined || rightYStepsForHandles.length > 0;
        if (hasRightChain) {
          region = "newRight";
          canAdjustY = true;
        } else if (rightCornerX !== undefined) {
          region = "right";
          canAdjustY = true;
        } else {
          const horzIdx = horizontalSegments.findIndex(
            (item) => item.idx === i,
          );
          if (horzIdx === horizontalSegments.length - 1) {
            region = "right";
            canAdjustY = true;
          }
        }
      } else {
        // fallback: 인덱스 기반 판단 (elbowY가 없는 기본 구조에서만)
        // elbowY가 정의되어 있으면 fallback으로 primary 설정하지 않음
        if (elbowY === undefined) {
          const horzIdx = horizontalSegments.findIndex(
            (item) => item.idx === i,
          );
          if (horizontalSegments.length >= 3) {
            if (horzIdx === centerHorizontalIdx) {
              region = "primary";
            }
          }
        }
        // elbowY가 있지만 매칭되지 않은 세그먼트는 region이 기본값('primary')으로 남지 않도록
        // 다른 region으로 처리되지 않았으면 핸들 생성 안 함
        if (elbowY !== undefined && region === "primary" && !isElbowYSegment) {
          continue; // elbowY가 있는데 이 세그먼트가 elbowY가 아니면 스킵
        }
      }

      // 중복 핸들 방지: 같은 region의 핸들이 이미 있으면 추가하지 않음
      // (특히 primary 영역은 1개만 있어야 함)
      // 직선 스냅 시: right/left region도 1개만 있어야 함 (같은 Y에 여러 세그먼트가 합쳐짐)
      // 중복 판정은 region 만이 아니라 stepIndex 까지 본다.
      // region 만 보면 좌측에 계단이 여러 층일 때 첫 층만 핸들을 갖고
      // 나머지 층은 조작할 수 없게 된다(연속 계단이 막혀 있던 이유).
      const alreadyExists = handles.some(
        (h) =>
          h.handleType === "center" &&
          h.region === region &&
          h.stepIndex === stepIndex,
      );
      if (alreadyExists && region === "primary") {
        continue; // primary 핸들은 1개만
      }
      // 직선 스냅된 경우: right/left 핸들도 1개만
      if (
        alreadyExists &&
        ((region === "right" && isRightStraightSnapped) ||
          (region === "left" && isLeftStraightSnapped))
      ) {
        continue;
      }

      if (emittedRuns.has(runIdOf[i]!)) continue;
      emittedRuns.add(runIdOf[i]!);
      const runMid = runMidpoint(i);
      handles.push({
        x: runMid.x,
        y: runMid.y,
        segmentIndex: i,
        canBend: true,
        direction: seg.direction,
        handleType: "center",
        region,
        canAdjustY,
        stepIndex,
        bendId: primaryBend?.bendId,
      });
    } else {
      // 수직 세그먼트: 회색 핸들 (X축 이동)
      // 기본 ㄷ자의 좌/우측 핸들 구분
      let handleType: HandleType = "left";
      let verticalTarget:
        | "leftCorner"
        | "midLeft"
        | "rightCorner"
        | "midRight" = "leftCorner";

      // 수직 세그먼트의 X 좌표
      const segX = seg.start.x;

      // primary bend의 좌/우 수직 세그먼트 식별
      // X좌표 기반으로 판단 (leftCornerX보다 왼쪽이면 left, rightCornerX보다 오른쪽이면 right)
      if (leftCornerX !== undefined && rightCornerX !== undefined) {
        // 코너 X 좌표 기준으로 영역 판단
        const midX = (leftCornerX + rightCornerX) / 2;
        if (segX <= leftCornerX + 5) {
          handleType = "left";
        } else if (segX >= rightCornerX - 5) {
          handleType = "right";
        } else {
          // 중앙 영역 (leftCornerX와 rightCornerX 사이)
          // 중앙점 기준으로 좌/우 판단
          handleType = segX < midX ? "left" : "right";
        }
      } else if (horizontalSegments.length >= 3) {
        const centerHorzSegIdx = horizontalSegments[centerHorizontalIdx]!.idx;
        handleType = i < centerHorzSegIdx ? "left" : "right";
      } else if (segments.length === 5) {
        handleType = i === 1 ? "left" : "right";
      } else {
        handleType = i < Math.floor(segments.length / 2) ? "left" : "right";
      }

      // 버그 3 수정: 수직 핸들이 조절하는 X 좌표 타입 결정
      // 계단식 구조에서 midLeftX/midRightX와 leftCornerX/rightCornerX 구분
      // 세그먼트의 Y좌표를 함께 고려하여 정확한 역할 판단
      const segTopY = Math.min(seg.start.y, seg.end.y);
      const segBottomY = Math.max(seg.start.y, seg.end.y);
      // segX는 위에서 이미 선언됨

      // midLeftX/midRightX 존재 여부 (계단식 구조인지 확인)
      const midLeftX = primaryBend?.midLeftX;
      const midRightX = primaryBend?.midRightX;

      // 연속 계단 데이터
      const leftYSteps = primaryBend?.leftYSteps ?? [];
      const rightYSteps = primaryBend?.rightYSteps ?? [];

      // 연속 계단의 step.midX와 매칭되는지 확인
      let stepIndex: number | undefined;
      let foundLeftStep = false;
      let foundRightStep = false;

      // X 만으로는 부족하다 — 수직선이 같은 X 에 둘 이상 있으면 구분이 안 되어
      // 위쪽 핸들을 끌었는데 아래쪽 값이 바뀐다. 수직 세그먼트는 Y 구간이
      // 서로 다르므로, 그 층의 Y(step.y)를 끝점으로 갖는지까지 확인한다.
      const touchesY = (y: number) =>
        Math.abs(segTopY - y) < 5 || Math.abs(segBottomY - y) < 5;

      // 다음 차례의 좌측 층과 맞는지 (순서대로 하나씩만 소비)
      const nextLeft = leftYSteps[leftStepCursor];
      if (
        nextLeft &&
        nextLeft.midX !== undefined &&
        Math.abs(segX - nextLeft.midX) < 5 &&
        touchesY(nextLeft.y)
      ) {
        foundLeftStep = true;
        stepIndex = leftStepCursor;
        leftStepCursor++;
      }

      // 다음 차례의 우측 층과 맞는지
      if (!foundLeftStep) {
        const nextRight = rightYSteps[rightStepCursor];
        if (
          nextRight &&
          nextRight.midX !== undefined &&
          Math.abs(segX - nextRight.midX) < 5 &&
          touchesY(nextRight.y)
        ) {
          foundRightStep = true;
          stepIndex = rightStepCursor;
          rightStepCursor++;
        }
      }

      // verticalTarget 및 stepIndex 결정
      //
      // 원칙: 'X 위치'가 아니라 **어느 저장값이 이 세그먼트를 만들었는가**로
      // 분류한다. X 휴리스틱("코너보다 왼쪽이면 left")은 X축 반전 배치에서
      // midRightX 가 좌측 코너보다 왼쪽에 오는 순간 무너져서, 아래쪽 핸들을
      // 끌면 위쪽 세로선이 움직였다. 각 저장값은 X 일치 + Y 접촉으로 정확히
      // 하나의 세그먼트에 배정되고, 배정되면 소비된다.
      const leftChainY =
        leftYSteps.length > 0 ? leftYSteps[leftYSteps.length - 1]!.y : startY;
      const rightChainY =
        rightYSteps.length > 0 ? rightYSteps[rightYSteps.length - 1]!.y : endY;

      const matchesMidLeft =
        !usedVerticalTargets.has("midLeft") &&
        midLeftX !== undefined &&
        Math.abs(segX - midLeftX) < 5 &&
        leftChainY !== undefined &&
        touchesY(leftChainY);
      const matchesMidRight =
        !usedVerticalTargets.has("midRight") &&
        midRightX !== undefined &&
        Math.abs(segX - midRightX) < 5 &&
        ((rightChainY !== undefined && touchesY(rightChainY)) ||
          (endY !== undefined && touchesY(endY)));
      // 코너 수직선은 항상 한쪽 끝이 elbowY 다 (좌: start쪽→elbowY, 우: elbowY→끝쪽)
      const matchesLeftCorner =
        !usedVerticalTargets.has("leftCorner") &&
        leftCornerX !== undefined &&
        Math.abs(segX - leftCornerX) < 5 &&
        (elbowY === undefined || touchesY(elbowY));
      const matchesRightCorner =
        !usedVerticalTargets.has("rightCorner") &&
        rightCornerX !== undefined &&
        Math.abs(segX - rightCornerX) < 5 &&
        (elbowY === undefined || touchesY(elbowY));

      const hasAbsoluteCorners =
        leftCornerX !== undefined && rightCornerX !== undefined;

      if (foundLeftStep) {
        verticalTarget = "leftStep" as typeof verticalTarget;
      } else if (foundRightStep) {
        verticalTarget = "rightStep" as typeof verticalTarget;
      } else if (matchesMidLeft) {
        verticalTarget = "midLeft";
        handleType = "left";
        usedVerticalTargets.add("midLeft");
      } else if (matchesMidRight) {
        verticalTarget = "midRight";
        handleType = "right";
        usedVerticalTargets.add("midRight");
      } else if (matchesLeftCorner) {
        verticalTarget = "leftCorner";
        handleType = "left";
        usedVerticalTargets.add("leftCorner");
      } else if (matchesRightCorner) {
        verticalTarget = "rightCorner";
        handleType = "right";
        usedVerticalTargets.add("rightCorner");
      } else if (hasAbsoluteCorners) {
        // 절대좌표 구조인데 어느 저장값과도 안 맞는 수직선 = 앵커 리드인
        // 스텁 같은 파생 세그먼트다. 조작할 저작값이 없으므로 핸들을 만들지
        // 않는다 (만들면 엉뚱한 값을 조절하는 유령 핸들이 된다).
        continue;
      } else if (handleType === "left") {
        // 레거시(비율 기반, 절대좌표 없음) 폴백 — 기존 휴리스틱 유지
        verticalTarget = midLeftX !== undefined ? "midLeft" : "leftCorner";
      } else {
        verticalTarget = midRightX !== undefined ? "midRight" : "rightCorner";
      }

      if (emittedRuns.has(runIdOf[i]!)) continue;
      emittedRuns.add(runIdOf[i]!);
      const runMid = runMidpoint(i);
      handles.push({
        x: runMid.x,
        y: runMid.y,
        segmentIndex: i,
        canBend: true,
        verticalTarget,
        stepIndex, // 연속 계단의 인덱스 (leftYSteps[stepIndex] 또는 rightYSteps[stepIndex])
        direction: seg.direction,
        handleType,
        bendId: primaryBend?.bendId,
        region: "primary",
      });
    }
  }

  return handles;
}

/**
 * 특정 세그먼트에 bend를 추가할 수 있는지 확인
 */
export function canAddBend(
  segmentIndex: number,
  existingBends: ElbowBend[],
): boolean {
  return !existingBends.some((b) => b.segmentIndex === segmentIndex);
}

// 직선으로 리셋되는 임계값 (px)
export const ELBOW_SNAP_THRESHOLD = 5;

/**
 * 드래그 offset을 ElbowBend로 변환
 */
export function createBendFromDrag(
  segmentIndex: number,
  dragDelta: Point,
  direction: "horizontal" | "vertical",
): ElbowBend | null {
  const offset = direction === "horizontal" ? dragDelta.y : dragDelta.x;

  // 최소 이동량 체크 (임계값 미만이면 무시)
  if (Math.abs(offset) < ELBOW_SNAP_THRESHOLD) return null;

  return {
    segmentIndex,
    offset,
  };
}

/**
 * 기존 bends 배열에 새 bend 추가 또는 업데이트
 */
export function updateBends(
  existingBends: ElbowBend[],
  newBend: ElbowBend,
): ElbowBend[] {
  const idx = existingBends.findIndex(
    (b) => b.segmentIndex === newBend.segmentIndex,
  );
  if (idx >= 0) {
    const updated = [...existingBends];
    updated[idx] = { ...updated[idx], ...newBend };
    return updated;
  }
  return [...existingBends, newBend];
}

/**
 * 기본 elbow 경로의 세그먼트 목록 (bends 적용 전)
 */
export function getBaseSegments(start: Point, end: Point): Segment[] {
  const basePoints = getBaseElbowPoints(start, end);
  const flatPoints = basePoints.flatMap((p) => [p.x, p.y]);
  return getSegments(flatPoints);
}

/**
 * flat points 배열을 Point[] 배열로 변환
 */
export function getPointsFromFlat(flatPoints: number[]): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < flatPoints.length - 1; i += 2) {
    points.push({ x: flatPoints[i]!, y: flatPoints[i + 1]! });
  }
  return points;
}

/**
 * ㄷ자 커넥터의 Y offset 업데이트 (하단 수평 핸들 드래그)
 * offset이 0에 가까우면 null 반환 (직선으로 리셋)
 */
export function updateElbowOffset(
  existingBend: ElbowBend | undefined,
  newOffset: number,
): ElbowBend | null {
  // offset이 임계값 미만이면 직선으로 리셋
  if (Math.abs(newOffset) < ELBOW_SNAP_THRESHOLD) {
    return null;
  }

  return {
    segmentIndex: 0,
    offset: newOffset,
    leftCornerRatio: existingBend?.leftCornerRatio,
    rightCornerRatio: existingBend?.rightCornerRatio,
  };
}

/**
 * ㄷ자 커넥터의 좌측 코너 X 위치 업데이트 (좌측 회색 핸들 드래그)
 */
export function updateLeftCornerRatio(
  existingBend: ElbowBend,
  start: Point,
  end: Point,
  newX: number,
): ElbowBend {
  const totalWidth = end.x - start.x;
  let newRatio = (newX - start.x) / totalWidth;

  // 비율 범위 제한 (0.05 ~ rightRatio - 0.1)
  const rightRatio = existingBend.rightCornerRatio ?? DEFAULT_RIGHT_RATIO;
  newRatio = Math.max(0.05, Math.min(newRatio, rightRatio - 0.1));

  return {
    ...existingBend,
    leftCornerRatio: newRatio,
  };
}

/**
 * ㄷ자 커넥터의 우측 코너 X 위치 업데이트 (우측 회색 핸들 드래그)
 */
export function updateRightCornerRatio(
  existingBend: ElbowBend,
  start: Point,
  end: Point,
  newX: number,
): ElbowBend {
  const totalWidth = end.x - start.x;
  let newRatio = (newX - start.x) / totalWidth;

  // 비율 범위 제한 (leftRatio + 0.1 ~ 0.95)
  const leftRatio = existingBend.leftCornerRatio ?? DEFAULT_LEFT_RATIO;
  newRatio = Math.max(leftRatio + 0.1, Math.min(newRatio, 0.95));

  return {
    ...existingBend,
    rightCornerRatio: newRatio,
  };
}

/**
 * 새로운 bend 생성 (다중 엘보우)
 *
 * 수평 세그먼트를 드래그하여 새 ㄷ자 생성
 */
export function createNewBend(
  segmentIndex: number,
  segment: Segment,
  dragOffsetY: number,
): ElbowBend | null {
  // 최소 이동량 체크
  if (Math.abs(dragOffsetY) < ELBOW_SNAP_THRESHOLD) return null;

  const segLength = segment.end.x - segment.start.x;

  return {
    segmentIndex,
    offset: dragOffsetY,
    elbowY: segment.start.y + dragOffsetY,
    leftCornerX: segment.start.x + segLength * DEFAULT_LEFT_RATIO,
    rightCornerX: segment.start.x + segLength * DEFAULT_RIGHT_RATIO,
    bendId: `bend-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };
}

/**
 * 기존 bends 배열에 새 bend 추가
 */
export function addBendToArray(
  existingBends: ElbowBend[],
  newBend: ElbowBend,
): ElbowBend[] {
  // 동일 segmentIndex의 기존 bend 대체
  const existingIndex = existingBends.findIndex(
    (b) => b.segmentIndex === newBend.segmentIndex,
  );
  if (existingIndex >= 0) {
    const updated = [...existingBends];
    updated[existingIndex] = newBend;
    return updated;
  }
  return [...existingBends, newBend];
}

/**
 * bend 삭제 (offset이 임계값 미만일 때)
 */
export function removeBendFromArray(
  existingBends: ElbowBend[],
  segmentIndex: number,
): ElbowBend[] {
  return existingBends.filter((b) => b.segmentIndex !== segmentIndex);
}

/**
 * 특정 세그먼트의 bend 업데이트 (다중 엘보우)
 */
export function updateBendAtSegment(
  existingBends: ElbowBend[],
  segmentIndex: number,
  updates: Partial<ElbowBend>,
): ElbowBend[] {
  return existingBends.map((b) => {
    if (b.segmentIndex === segmentIndex) {
      return { ...b, ...updates };
    }
    return b;
  });
}

/**
 * 경로 상 특정 위치(t: 0~1)의 좌표 계산
 *
 * @param flatPoints - 경로 포인트 배열 [x1, y1, x2, y2, ...]
 * @param t - 경로 상 위치 (0=시작점, 1=끝점)
 * @returns 해당 위치의 좌표와 세그먼트 방향
 */
export function getPointOnPath(
  flatPoints: number[],
  t: number,
): { x: number; y: number; direction: "horizontal" | "vertical" } {
  if (flatPoints.length < 4) {
    return {
      x: flatPoints[0] ?? 0,
      y: flatPoints[1] ?? 0,
      direction: "horizontal",
    };
  }

  // 전체 경로 길이 계산
  let totalLength = 0;
  const segmentLengths: number[] = [];

  for (let i = 0; i < flatPoints.length - 2; i += 2) {
    const x1 = flatPoints[i]!;
    const y1 = flatPoints[i + 1]!;
    const x2 = flatPoints[i + 2]!;
    const y2 = flatPoints[i + 3]!;
    const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    segmentLengths.push(length);
    totalLength += length;
  }

  if (totalLength === 0) {
    return { x: flatPoints[0]!, y: flatPoints[1]!, direction: "horizontal" };
  }

  // t 값을 경로 상 거리로 변환
  const targetDistance = t * totalLength;
  let accumulatedLength = 0;

  for (let i = 0; i < segmentLengths.length; i++) {
    const segLength = segmentLengths[i]!;
    const segStart = accumulatedLength;
    const segEnd = accumulatedLength + segLength;

    if (targetDistance <= segEnd || i === segmentLengths.length - 1) {
      // 이 세그먼트 내에서의 비율
      const segT = segLength > 0 ? (targetDistance - segStart) / segLength : 0;
      const x1 = flatPoints[i * 2]!;
      const y1 = flatPoints[i * 2 + 1]!;
      const x2 = flatPoints[i * 2 + 2]!;
      const y2 = flatPoints[i * 2 + 3]!;

      const direction: "horizontal" | "vertical" =
        Math.abs(y2 - y1) < 0.01 ? "horizontal" : "vertical";

      return {
        x: x1 + (x2 - x1) * segT,
        y: y1 + (y2 - y1) * segT,
        direction,
      };
    }

    accumulatedLength += segLength;
  }

  // Fallback: 끝점 반환
  return {
    x: flatPoints[flatPoints.length - 2]!,
    y: flatPoints[flatPoints.length - 1]!,
    direction: "horizontal",
  };
}

/**
 * 주어진 좌표에서 경로 상 가장 가까운 점의 t 값 계산
 *
 * @param flatPoints - 경로 포인트 배열 [x1, y1, x2, y2, ...]
 * @param point - 검사할 좌표
 * @returns 가장 가까운 점의 t 값, 거리, 좌표
 */
export function getClosestPointOnPath(
  flatPoints: number[],
  point: { x: number; y: number },
): { t: number; distance: number; x: number; y: number } {
  if (flatPoints.length < 4) {
    const x = flatPoints[0] ?? 0;
    const y = flatPoints[1] ?? 0;
    const dx = point.x - x;
    const dy = point.y - y;
    return { t: 0, distance: Math.sqrt(dx * dx + dy * dy), x, y };
  }

  // 전체 경로 길이 계산
  let totalLength = 0;
  const segmentLengths: number[] = [];

  for (let i = 0; i < flatPoints.length - 2; i += 2) {
    const x1 = flatPoints[i]!;
    const y1 = flatPoints[i + 1]!;
    const x2 = flatPoints[i + 2]!;
    const y2 = flatPoints[i + 3]!;
    const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    segmentLengths.push(length);
    totalLength += length;
  }

  if (totalLength === 0) {
    const x = flatPoints[0]!;
    const y = flatPoints[1]!;
    const dx = point.x - x;
    const dy = point.y - y;
    return { t: 0, distance: Math.sqrt(dx * dx + dy * dy), x, y };
  }

  let closestT = 0;
  let closestDistance = Infinity;
  let closestX = flatPoints[0]!;
  let closestY = flatPoints[1]!;
  let accumulatedLength = 0;

  for (let i = 0; i < segmentLengths.length; i++) {
    const x1 = flatPoints[i * 2]!;
    const y1 = flatPoints[i * 2 + 1]!;
    const x2 = flatPoints[i * 2 + 2]!;
    const y2 = flatPoints[i * 2 + 3]!;
    const segLength = segmentLengths[i]!;

    // 세그먼트 상에서 가장 가까운 점 찾기
    const dx = x2 - x1;
    const dy = y2 - y1;

    if (segLength === 0) {
      const dist = Math.sqrt((point.x - x1) ** 2 + (point.y - y1) ** 2);
      if (dist < closestDistance) {
        closestDistance = dist;
        closestX = x1;
        closestY = y1;
        closestT = accumulatedLength / totalLength;
      }
    } else {
      // 점과 선분 사이의 최단 거리 계산
      const t = Math.max(
        0,
        Math.min(
          1,
          ((point.x - x1) * dx + (point.y - y1) * dy) / (segLength * segLength),
        ),
      );
      const projX = x1 + t * dx;
      const projY = y1 + t * dy;
      const dist = Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);

      if (dist < closestDistance) {
        closestDistance = dist;
        closestX = projX;
        closestY = projY;
        closestT = (accumulatedLength + t * segLength) / totalLength;
      }
    }

    accumulatedLength += segLength;
  }

  return {
    t: closestT,
    distance: closestDistance,
    x: closestX,
    y: closestY,
  };
}
