import { describe, it, expect } from "vitest";
import { ShapeErrorBoundary } from "./ShapeErrorBoundary";

// 렌더 테스트는 DOM/Konva 백엔드가 필요하므로, 회귀 위험이 큰 정적 로직
// (에러 진입 + 리셋 계약)만 직접 검증한다.
type Props = Parameters<typeof ShapeErrorBoundary.getDerivedStateFromProps>[0];
type State = Parameters<typeof ShapeErrorBoundary.getDerivedStateFromProps>[1];

const props = (resetKey: unknown): Props =>
  ({
    resetKey,
    objectId: "obj-1",
    bounds: { x: 0, y: 0, width: 10, height: 10 },
    children: null,
  }) as Props;

describe("ShapeErrorBoundary", () => {
  it("에러가 나면 폴백 상태로 전환한다", () => {
    expect(ShapeErrorBoundary.getDerivedStateFromError()).toEqual({
      hasError: true,
    });
  });

  it("객체가 수정되면 에러를 해제하고 다시 시도한다", () => {
    const objV1 = { id: "obj-1", broken: true };
    const objV2 = { id: "obj-1", broken: false };
    const errored: State = { hasError: true, resetKey: objV1 };

    const next = ShapeErrorBoundary.getDerivedStateFromProps(
      props(objV2),
      errored,
    );
    expect(next).toEqual({ hasError: false, resetKey: objV2 });
  });

  it("같은 객체면 폴백을 유지한다 (무한 재시도 방지)", () => {
    const obj = { id: "obj-1" };
    const errored: State = { hasError: true, resetKey: obj };
    expect(
      ShapeErrorBoundary.getDerivedStateFromProps(props(obj), errored),
    ).toBeNull();
  });
});
