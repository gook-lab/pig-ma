/**
 * 화살촉이 도형 경계에 닿는 위치 계산
 *
 * 커넥터가 도형에 붙어 있을 때, 선을 앵커까지 그대로 그리면 화살촉이
 * 도형 테두리를 파고든다. 그래서 마지막 점을 진행 방향의 반대로 살짝
 * 당겨 놓는다.
 *
 * 당기는 양이 크면 화살촉과 도형 사이가 벌어져 "연결이 안 된 것처럼"
 * 보인다. 도형에 stroke 가 있으면 그 두께만큼만 비켜서면 충분하다.
 */

/**
 * 화살촉을 도형 테두리에서 띄우는 거리(px).
 *
 * 0 이면 테두리에 딱 붙는다. 도형 stroke 의 절반 정도면 선이 테두리를
 * 파고들지 않으면서도 떨어져 보이지 않는다.
 */
export const ARROW_GAP = 1;

/**
 * 양 끝점을 ARROW_GAP 만큼 안쪽으로 당긴다.
 *
 * @param points      평탄화된 경로 [x0,y0,x1,y1,...]
 * @param pullStart   시작점을 당길지 (소스 도형 + 시작 마커가 있을 때)
 * @param pullEnd     끝점을 당길지 (타깃 도형 + 끝 마커가 있을 때)
 * @param gap         당길 거리 (기본 ARROW_GAP)
 */
export function adjustArrowEndpoints(
  points: number[],
  pullStart: boolean,
  pullEnd: boolean,
  gap: number = ARROW_GAP,
): number[] {
  if (points.length < 4 || gap <= 0) return points;

  const result = [...points];

  if (pullStart) {
    const firstX = result[0]!;
    const firstY = result[1]!;
    const nextX = result[2]!;
    const nextY = result[3]!;
    const dx = nextX - firstX;
    const dy = nextY - firstY;
    const dist = Math.hypot(dx, dy);
    // 첫 구간이 gap 보다 짧으면 당기지 않는다 — 당기면 선이 뒤집힌다
    if (dist >= gap) {
      result[0] = firstX + (dx / dist) * gap;
      result[1] = firstY + (dy / dist) * gap;
    }
  }

  if (pullEnd) {
    const len = result.length;
    const lastX = result[len - 2]!;
    const lastY = result[len - 1]!;
    const prevX = result[len - 4]!;
    const prevY = result[len - 3]!;
    const dx = lastX - prevX;
    const dy = lastY - prevY;
    const dist = Math.hypot(dx, dy);
    if (dist >= gap) {
      result[len - 2] = lastX - (dx / dist) * gap;
      result[len - 1] = lastY - (dy / dist) * gap;
    }
  }

  return result;
}
