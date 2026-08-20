import { Component, type ReactNode } from "react";
import { Rect } from "react-konva";

interface ShapeErrorBoundaryProps {
  children: ReactNode;
  /** 실패 시 자리 표시용 — 스토어 상의 객체 기하 (Konva 노드에 의존하지 않는다) */
  bounds: { x: number; y: number; width: number; height: number };
  /** 이 값이 바뀌면 에러 상태를 초기화하고 다시 렌더를 시도한다 */
  resetKey: unknown;
  /** 로그용 객체 식별자 */
  objectId: string;
}

interface ShapeErrorBoundaryState {
  hasError: boolean;
  resetKey: unknown;
}

/**
 * 도형 하나의 렌더 실패를 그 도형 안에 가둔다.
 *
 * 앱 레벨 ErrorBoundary 만 있으면 객체 하나가 던진 예외로 캔버스 전체가
 * 폴백 화면으로 바뀐다. 손상된 객체(예: chartData 없는 차트)는 import 로
 * 들어올 수 있으므로, 실패한 도형만 자리 표시자로 대체하고 나머지 보드는
 * 계속 쓸 수 있게 한다.
 *
 * 폴백은 반드시 Konva 노드여야 한다 — 이 경계는 Stage 안에서 렌더된다.
 */
export class ShapeErrorBoundary extends Component<
  ShapeErrorBoundaryProps,
  ShapeErrorBoundaryState
> {
  state: ShapeErrorBoundaryState = {
    hasError: false,
    resetKey: this.props.resetKey,
  };

  static getDerivedStateFromError(): Partial<ShapeErrorBoundaryState> {
    return { hasError: true };
  }

  static getDerivedStateFromProps(
    props: ShapeErrorBoundaryProps,
    state: ShapeErrorBoundaryState,
  ): Partial<ShapeErrorBoundaryState> | null {
    // 객체가 수정되면(또는 다른 객체로 교체되면) 다시 시도한다 —
    // 사용자가 손상된 값을 고쳤는데 계속 자리 표시자면 복구 방법이 없다.
    if (props.resetKey !== state.resetKey) {
      return { hasError: false, resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error) {
    console.error(
      `[pig-ma] 객체 렌더 실패 — 자리 표시자로 대체합니다 (id: ${this.props.objectId})`,
      error,
    );
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { x, y, width, height } = this.props.bounds;
    return (
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        stroke="#ef4444"
        strokeWidth={1}
        dash={[6, 4]}
        fill="rgba(239, 68, 68, 0.06)"
        listening={false}
        perfectDrawEnabled={false}
      />
    );
  }
}
