/**
 * Elbow Handler Actions
 *
 * 각 핸들러는 자신의 값만 수정하고, 다른 값은 절대 건드리지 않음
 * - left 핸들러 → leftCornerX만
 * - right 핸들러 → rightCornerX만
 * - center 핸들러 → elbowY만
 * - midLeft → midLeftX만
 * - midRight → midRightX만
 * - leftY 계단 → leftY만
 * - rightY 계단 → rightY만
 */

import type { ElbowBend } from "@/types";

// 최소 간격 상수
const MIN_CORNER_GAP = 20;
/**
 * bend 생성/유지 최소 임계(px).
 *
 * 미리보기(handleMidpointDragMove)와 커밋(handleMidpointDragEnd)이 반드시
 * 같은 값을 봐야 한다 — 한쪽만 임계를 걸면 "드래그 중엔 꺾였다가 놓으면
 * 사라지는" 괴리가 생긴다.
 */
export const MIN_EDGE_GAP = 10;

/**
 * 드래그 제약은 **인접한 저작값(코너)** 기준으로만 건다.
 *
 * 예전에는 커넥터 끝점(startX/endX)으로 잘랐다. 그러면 타깃을 옮겨 코너가
 * 끝점 밖으로 나간 상태에서 핸들을 살짝만 건드려도 저작한 계단이 끝점 안으로
 * 찌그러졌다(0px 드래그로도 800 → 490). 렌더(applyBends)는 이미 코너 기준만
 * 쓰도록 고쳤으므로, 드래그도 같은 기준을 써야 한다.
 *
 * 지켜야 하는 것은 '이웃 저작값을 넘어가 경로가 되돌아오는 것'뿐이다.
 *
 * @param limit  넘지 말아야 할 이웃 값 (코너 등)
 * @param gap    이웃과 최소한 벌려둘 거리
 * @param below  limit 보다 작아야 하는가 (true) / 커야 하는가 (false)
 */
function limitAgainst(
  value: number,
  limit: number,
  gap: number,
  below: boolean,
): number {
  return below ? Math.min(value, limit - gap) : Math.max(value, limit + gap);
}

/**
 * 1. 직선 → 엘보우 생성 (center 핸들 Y축 드래그)
 *
 * 직선 상태에서 처음 엘보우를 생성할 때만 사용
 * 초기 leftCornerX, rightCornerX를 25%, 75% 비율로 설정
 */
export function createElbowFromStraight(
  startX: number,
  startY: number,
  endX: number,
  _endY: number,
  dragDeltaY: number,
): ElbowBend | null {
  const newElbowY = startY + dragDeltaY;
  const newOffset = newElbowY - startY;

  // 최소 offset 체크 (10px 이상이어야 bend 생성)
  if (Math.abs(newOffset) < MIN_EDGE_GAP) {
    return null;
  }

  return {
    segmentIndex: 0,
    offset: newOffset,
    elbowY: newElbowY,
    ...defaultCorners(startX, endX),
    region: "primary",
  };
}

/**
 * 기본 코너 위치 — 항상 leftCornerX < rightCornerX.
 *
 * 예전 공식 `startX + span * 0.25/0.75` 는 반전 span(start > end)에서
 * 좌우가 뒤집힌 코너를 만들었고, 그 역전값이 코너 드래그 클램프·중앙
 * 수평선 방향을 연쇄적으로 무너뜨렸다. 이름이 곧 계약이다:
 * left 는 왼쪽, right 는 오른쪽.
 */
export function defaultCorners(
  startX: number,
  endX: number,
): { leftCornerX: number; rightCornerX: number } {
  const lo = Math.min(startX, endX);
  const span = Math.abs(endX - startX);
  return {
    leftCornerX: lo + span * 0.25,
    rightCornerX: lo + span * 0.75,
  };
}

/**
 * 2. 엘보우 Y축 조절 (center 핸들 Y축 드래그)
 *
 * elbowY만 수정, 다른 모든 값 유지
 */
export function adjustElbowY(
  existingBend: ElbowBend,
  dragDeltaY: number,
  startY: number,
): ElbowBend | null {
  const currentElbowY =
    existingBend.elbowY ?? startY + (existingBend.offset ?? 0);
  const newElbowY = currentElbowY + dragDeltaY;
  const newOffset = newElbowY - startY;

  // 최소 offset 체크 - 너무 작으면 엘보우 삭제 (null 반환)
  if (Math.abs(newOffset) < MIN_EDGE_GAP) {
    return null;
  }

  // elbowY와 offset만 수정, 나머지는 그대로 유지
  return {
    ...existingBend,
    elbowY: newElbowY,
    offset: newOffset,
  };
}

/**
 * 3. 좌측 코너 X축 조절 (left 핸들 X축 드래그)
 *
 * leftCornerX만 수정, 다른 모든 값 유지
 */
export function adjustLeftCornerX(
  existingBend: ElbowBend,
  dragDeltaX: number,
  constraints: { minX: number; maxX: number },
): ElbowBend {
  const currentLeftX = existingBend.leftCornerX!;
  let newLeftX = currentLeftX + dragDeltaX;

  // 우측 코너만 넘지 않게 한다 (시작점으로는 제한하지 않는다).
  // 방향은 현재 값이 반대 코너의 어느 쪽에 있는가로 — adjustMidLeftX 주석 참조.
  // (반전 저작으로 코너가 뒤집혀 있으면 0px 드래그로 스냅되던 것을 막는다)
  newLeftX = limitAgainst(
    newLeftX,
    constraints.maxX,
    MIN_CORNER_GAP,
    currentLeftX === constraints.maxX ? true : currentLeftX < constraints.maxX,
  );

  // leftCornerX만 수정
  return {
    ...existingBend,
    leftCornerX: newLeftX,
  };
}

/**
 * 4. 우측 코너 X축 조절 (right 핸들 X축 드래그)
 *
 * rightCornerX만 수정, 다른 모든 값 유지
 */
export function adjustRightCornerX(
  existingBend: ElbowBend,
  dragDeltaX: number,
  constraints: { minX: number; maxX: number },
): ElbowBend {
  const currentRightX = existingBend.rightCornerX!;
  let newRightX = currentRightX + dragDeltaX;

  // 좌측 코너만 넘지 않게 한다 (끝점으로는 제한하지 않는다).
  // 방향은 현재 값 기준 — adjustMidLeftX 주석 참조.
  newRightX = limitAgainst(
    newRightX,
    constraints.minX,
    MIN_CORNER_GAP,
    currentRightX === constraints.minX
      ? false
      : currentRightX < constraints.minX,
  );

  // rightCornerX만 수정
  return {
    ...existingBend,
    rightCornerX: newRightX,
  };
}

/**
 * 5. 좌측 계단 Y축 조절 (left region 핸들 Y축 드래그)
 *
 * leftY만 수정, 다른 모든 값 유지
 */
export function adjustLeftY(existingBend: ElbowBend, newY: number): ElbowBend {
  // leftY만 수정
  return {
    ...existingBend,
    leftY: newY,
  };
}

/**
 * 6. 우측 계단 Y축 조절 (right region 핸들 Y축 드래그)
 *
 * rightY만 수정, 다른 모든 값 유지
 */
export function adjustRightY(existingBend: ElbowBend, newY: number): ElbowBend {
  // rightY만 수정
  return {
    ...existingBend,
    rightY: newY,
  };
}

/**
 * 7. 좌측 계단 중간선 X축 조절 (midLeft 핸들 X축 드래그)
 *
 * midLeftX만 수정, 다른 모든 값 유지
 */
export function adjustMidLeftX(
  existingBend: ElbowBend,
  dragDeltaX: number,
  constraints: { minX: number; maxX: number },
): ElbowBend {
  const currentMidLeftX =
    existingBend.midLeftX ?? (constraints.minX + existingBend.leftCornerX!) / 2;
  let newMidLeftX = currentMidLeftX + dragDeltaX;

  // 좌측 코너만 넘지 않게 한다 (시작점으로는 제한하지 않는다).
  //
  // 방향은 **현재 값이 코너의 어느 쪽에 있는가**로 정한다. 끝점 위치로
  // 유도하면 "정방향으로 저작한 뒤 타깃만 코너 앞으로 온" 경우와 "완전
  // 반전 배치"를 구분할 수 없다 — 둘 다 끝점이 코너 앞이지만 저작값은
  // 서로 반대편에 있다. 막을 것은 코너 '통과'뿐이다.
  newMidLeftX = limitAgainst(
    newMidLeftX,
    constraints.maxX,
    MIN_EDGE_GAP,
    currentMidLeftX === constraints.maxX
      ? constraints.minX <= constraints.maxX
      : currentMidLeftX < constraints.maxX,
  );

  // midLeftX만 수정
  return {
    ...existingBend,
    midLeftX: newMidLeftX,
  };
}

/**
 * 8. 우측 계단 중간선 X축 조절 (midRight 핸들 X축 드래그)
 *
 * midRightX만 수정, 다른 모든 값 유지
 */
export function adjustMidRightX(
  existingBend: ElbowBend,
  dragDeltaX: number,
  constraints: { minX: number; maxX: number },
): ElbowBend {
  const currentMidRightX =
    existingBend.midRightX ??
    (existingBend.rightCornerX! + constraints.maxX) / 2;
  let newMidRightX = currentMidRightX + dragDeltaX;

  // 우측 코너만 넘지 않게 한다 (끝점으로는 제한하지 않는다).
  // 방향은 현재 값이 코너의 어느 쪽에 있는가로 정한다 — adjustMidLeftX 주석 참조.
  newMidRightX = limitAgainst(
    newMidRightX,
    constraints.minX,
    MIN_EDGE_GAP,
    currentMidRightX === constraints.minX
      ? constraints.maxX < constraints.minX
      : currentMidRightX < constraints.minX,
  );

  // midRightX만 수정
  return {
    ...existingBend,
    midRightX: newMidRightX,
  };
}

/**
 * 9. 연속 계단 추가 (newLeft/newRight region)
 *
 * leftYSteps 또는 rightYSteps에만 새 step 추가
 */
export function addStairStep(
  existingBend: ElbowBend,
  side: "left" | "right",
  newY: number,
  midX: number,
  /**
   * 새 층을 배열의 어디에 끼울지.
   *
   * 렌더 순서: 좌측은 start → step[0] → step[1] → … → leftY,
   * 우측은 rightY → step[0] → … → end. 그래서 **start 세그먼트에서 만든
   * 층은 맨 앞(start)**, **end 세그먼트에서 만든 층은 맨 뒤(end)** 에
   * 끼워야 드래그한 바로 그 구간에서 꺾인다.
   */
  position: "start" | "end" = "end",
): ElbowBend {
  const newStep = { y: newY, midX };
  const key = side === "left" ? "leftYSteps" : "rightYSteps";
  const currentSteps = existingBend[key] ?? [];

  return {
    ...existingBend,
    [key]:
      position === "start"
        ? [newStep, ...currentSteps]
        : [...currentSteps, newStep],
  };
}

/**
 * 9b. 연속 계단의 특정 층 Y 조절
 *
 * 계단이 여러 층일 때 각 층을 독립적으로 움직일 수 있어야 한다.
 * (예전에는 층마다 핸들이 없어서 아예 조작이 불가능했다)
 */
export function adjustStairStepY(
  existingBend: ElbowBend,
  side: "left" | "right",
  stepIndex: number,
  newY: number,
): ElbowBend {
  const key = side === "left" ? "leftYSteps" : "rightYSteps";
  const steps = existingBend[key] ?? [];
  if (stepIndex < 0 || stepIndex >= steps.length) return existingBend;

  const next = steps.map((st, i) =>
    i === stepIndex ? { ...st, y: newY } : st,
  );
  return { ...existingBend, [key]: next };
}

/**
 * 9d. 연속 계단 층의 중간 수직선 X 조절
 *
 * midLeftX/midRightX 와 같은 규칙 — 인접한 코너만 넘지 않게 한다.
 * (이 함수가 없던 시절엔 Connector.tsx 가 같은 계산을 인라인으로 복제했고,
 *  그쪽만 끝점 기준으로 남아 드래그 중에 계단이 찌그러졌다)
 */
export function adjustStairStepMidX(
  existingBend: ElbowBend,
  side: "left" | "right",
  stepIndex: number,
  dragDeltaX: number,
  cornerX: number,
): ElbowBend {
  const key = side === "left" ? "leftYSteps" : "rightYSteps";
  const steps = existingBend[key] ?? [];
  const step = steps[stepIndex];
  if (!step) return existingBend;

  const current = step.midX ?? cornerX;
  const moved = current + dragDeltaX;
  // 좌측 계단은 코너가 오른쪽에, 우측 계단은 코너가 왼쪽에 있다
  // 방향은 현재 값이 코너의 어느 쪽에 있는가로 — adjustMidLeftX 주석 참조.
  const limited = limitAgainst(
    moved,
    cornerX,
    MIN_EDGE_GAP,
    current === cornerX ? side === "left" : current < cornerX,
  );

  const next = steps.map((st, i) =>
    i === stepIndex ? { ...st, midX: limited } : st,
  );
  return { ...existingBend, [key]: next };
}

/**
 * 9c. 연속 계단의 특정 층 제거
 *
 * 층을 이웃 층과 같은 높이로 끌어다 놓으면 그 층은 의미가 없어진다.
 * 남겨두면 길이 0 의 계단이 되어 핸들만 겹쳐 쌓인다.
 */
export function removeStairStep(
  existingBend: ElbowBend,
  side: "left" | "right",
  stepIndex: number,
): ElbowBend {
  const key = side === "left" ? "leftYSteps" : "rightYSteps";
  const steps = existingBend[key] ?? [];
  if (stepIndex < 0 || stepIndex >= steps.length) return existingBend;

  const next = steps.filter((_, i) => i !== stepIndex);
  const result = { ...existingBend, [key]: next };
  if (next.length === 0) delete result[key];
  return result;
}

/**
 * 10. 엘보우 전체 X축 이동 (center 핸들 X축 드래그)
 *
 * leftCornerX와 rightCornerX를 동일한 양만큼 이동
 * (엘보우 폭은 유지하면서 위치만 이동)
 */
export function moveElbowX(
  existingBend: ElbowBend,
  dragDeltaX: number,
  bounds?: { minX: number; maxX: number },
): ElbowBend {
  let newLeftX = existingBend.leftCornerX! + dragDeltaX;
  let newRightX = existingBend.rightCornerX! + dragDeltaX;

  // 실제로 끌었을 때만 span 안으로 가둔다.
  //
  // 드래그 없이(0px) 호출되는 경우에도 가두면, 타깃을 옮겨 코너가 끝점 밖으로
  // 나간 상태에서 핸들을 살짝 건드리는 것만으로 저작한 계단이 찌그러진다.
  // 사용자가 실제로 민 경우에만 범위를 적용한다.
  // 코너가 이미 span 밖에 저작돼 있으면(반전 배치·타깃 이동 후) 클램프를
  // 걸지 않는다 — 1px 드래그만으로 엘보우 전체가 span 안으로 끌려온다.
  // 클램프는 '정상 범위에서의 드래그 보조'지 데이터 교정 수단이 아니다.
  const cornersInsideSpan =
    bounds !== undefined &&
    Math.min(existingBend.leftCornerX!, existingBend.rightCornerX!) >=
      Math.min(bounds.minX, bounds.maxX) &&
    Math.max(existingBend.leftCornerX!, existingBend.rightCornerX!) <=
      Math.max(bounds.minX, bounds.maxX);

  if (bounds && dragDeltaX !== 0 && cornersInsideSpan) {
    const lo = Math.min(bounds.minX, bounds.maxX) + MIN_EDGE_GAP;
    const hi = Math.max(bounds.minX, bounds.maxX) - MIN_EDGE_GAP;
    const gap = Math.max(MIN_CORNER_GAP, newRightX - newLeftX);

    if (hi - lo <= MIN_CORNER_GAP) {
      // 자리가 거의 없다 — 최소 간격만 확보한다
      newLeftX = lo;
      newRightX = lo + MIN_CORNER_GAP;
    } else if (gap >= hi - lo) {
      // 간격이 span 보다 넓다 — span 에 맞춰 줄인다
      newLeftX = lo;
      newRightX = hi;
    } else if (newLeftX < lo) {
      newLeftX = lo;
      newRightX = lo + gap;
    } else if (newRightX > hi) {
      newRightX = hi;
      newLeftX = hi - gap;
    }
  }

  return {
    ...existingBend,
    leftCornerX: newLeftX,
    rightCornerX: newRightX,
  };
}
