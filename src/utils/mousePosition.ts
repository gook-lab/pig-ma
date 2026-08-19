/**
 * 마우스 위치 추적 유틸리티
 *
 * React state 대신 모듈 레벨 변수로 관리하여
 * mousemove 시 불필요한 리렌더를 방지합니다.
 *
 * 주요 사용처: 붙여넣기 시 마우스 위치에 객체 배치
 */

// 캔버스 좌표 기준 마우스 위치
let lastMousePosition = { x: 0, y: 0 };

/**
 * 마우스 위치 업데이트 (Canvas의 onMouseMove에서 호출)
 */
export function setLastMousePosition(x: number, y: number): void {
  lastMousePosition.x = x;
  lastMousePosition.y = y;
}

/**
 * 현재 마우스 위치 반환
 */
export function getLastMousePosition(): { x: number; y: number } {
  return lastMousePosition;
}
