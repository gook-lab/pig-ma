import type { ElbowBend } from "@/types";

/**
 * 엘보우 꺾임을 통째로 평행 이동한다.
 *
 * bend 는 전부 **절대 좌표**다(도형을 옮겨도 형태가 유지되도록 그렇게 만들었다).
 * 그래서 커넥터가 양 끝과 함께 통째로 움직일 때는 bend 도 같은 만큼 옮겨야
 * 형태가 보존된다. 안 옮기면 도형만 이동하고 꺾임은 제자리에 남아 찌그러진다.
 *
 * ⚠️ **강체 이동일 때만** 부른다. 한쪽 끝만 움직이는 경우엔 형태가 실제로
 * 달라지는 게 맞으므로 평행 이동하면 안 된다.
 */
export function translateElbowBends(
  bends: ElbowBend[] | undefined,
  deltaX: number,
  deltaY: number,
): ElbowBend[] | undefined {
  if (!bends || bends.length === 0) return bends;
  if (deltaX === 0 && deltaY === 0) return bends;

  const moveX = (v: number | undefined) => (v === undefined ? v : v + deltaX);
  const moveY = (v: number | undefined) => (v === undefined ? v : v + deltaY);

  return bends.map((b) => ({
    ...b,
    // 중앙 엘보우 + 코너
    elbowY: moveY(b.elbowY),
    leftCornerX: moveX(b.leftCornerX),
    rightCornerX: moveX(b.rightCornerX),
    // 계단
    leftY: moveY(b.leftY),
    rightY: moveY(b.rightY),
    midLeftX: moveX(b.midLeftX),
    midRightX: moveX(b.midRightX),
    // 연속 계단 층
    ...(b.leftYSteps
      ? {
          leftYSteps: b.leftYSteps.map((st) => ({
            ...st,
            y: st.y + deltaY,
            midX: moveX(st.midX),
          })),
        }
      : {}),
    ...(b.rightYSteps
      ? {
          rightYSteps: b.rightYSteps.map((st) => ({
            ...st,
            y: st.y + deltaY,
            midX: moveX(st.midX),
          })),
        }
      : {}),
    // offset / ratio 는 상대값이라 그대로 둔다
  }));
}
