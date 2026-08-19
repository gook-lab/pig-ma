import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDebouncedHandleSet } from "./historyDebounce";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("히스토리 디바운스", () => {
  it("연속 변경은 한 번만 기록된다", () => {
    const commit = vi.fn();
    const d = createDebouncedHandleSet(commit, 400);

    for (let i = 0; i < 60; i++) d(`s${i}`);
    expect(commit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("기록되는 것은 버스트의 '첫' 과거 상태다", () => {
    const commit = vi.fn();
    const d = createDebouncedHandleSet(commit, 400);

    d("드래그전");
    d("중간1");
    d("중간2");
    vi.advanceTimersByTime(400);

    // 되돌아갈 지점은 제스처 시작 전이어야 한다
    expect(commit).toHaveBeenCalledWith("드래그전");
  });

  it("떨어진 동작은 각각 기록된다", () => {
    const commit = vi.fn();
    const d = createDebouncedHandleSet(commit, 400);

    d("A");
    vi.advanceTimersByTime(400);
    d("B");
    vi.advanceTimersByTime(400);

    expect(commit).toHaveBeenCalledTimes(2);
    expect(commit).toHaveBeenNthCalledWith(1, "A");
    expect(commit).toHaveBeenNthCalledWith(2, "B");
  });

  it("대기 시간 안에 이어지면 계속 묶인다", () => {
    const commit = vi.fn();
    const d = createDebouncedHandleSet(commit, 400);

    d("첫");
    vi.advanceTimersByTime(300);
    d("둘");
    vi.advanceTimersByTime(300);
    d("셋");
    vi.advanceTimersByTime(400);

    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith("첫");
  });

  it("flush 는 즉시 커밋한다 (undo 직전)", () => {
    const commit = vi.fn();
    const d = createDebouncedHandleSet(commit, 400);

    d("대기중");
    d.flush();

    expect(commit).toHaveBeenCalledWith("대기중");
  });

  it("flush 후에는 타이머가 다시 커밋하지 않는다", () => {
    const commit = vi.fn();
    const d = createDebouncedHandleSet(commit, 400);

    d("x");
    d.flush();
    vi.advanceTimersByTime(1000);

    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("대기 중인 게 없으면 flush 는 아무 일도 안 한다", () => {
    const commit = vi.fn();
    const d = createDebouncedHandleSet(commit, 400);

    d.flush();
    expect(commit).not.toHaveBeenCalled();
  });

  it("cancel 은 대기 중인 기록을 버린다", () => {
    const commit = vi.fn();
    const d = createDebouncedHandleSet(commit, 400);

    d("버릴것");
    d.cancel();
    vi.advanceTimersByTime(1000);

    expect(commit).not.toHaveBeenCalled();
  });

  it("여러 인자를 그대로 전달한다", () => {
    const commit = vi.fn();
    const d = createDebouncedHandleSet(commit, 400);

    d("past", true, "current", null);
    vi.advanceTimersByTime(400);

    expect(commit).toHaveBeenCalledWith("past", true, "current", null);
  });
});
