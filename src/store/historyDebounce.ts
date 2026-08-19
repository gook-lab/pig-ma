/**
 * 히스토리(undo/redo) 기록 디바운스
 *
 * ## 문제
 * zundo 는 `set` 이 일어날 때마다 직전 상태를 스택에 쌓는다. 그런데 도형
 * 모서리를 잡고 늘리면 mousemove 마다 `updateObject` 가 돌아서, 한 번의
 * 리사이즈 제스처가 히스토리 수십 개를 만든다. Cmd+Z 를 수십 번 눌러야
 * 리사이즈 하나가 취소된다.
 *
 * ## 해법
 * 연속된 변경을 한 덩어리로 묶어 **한 번만** 기록한다.
 *
 * 여기서 중요한 건 "버스트의 **첫** 과거 상태를 남긴다"는 점이다.
 * 되돌아갈 지점은 드래그가 **시작되기 전**이지, 드래그 도중의 어느 중간
 * 프레임이 아니다. 마지막 것을 남기면 Cmd+Z 가 제스처 직전이 아니라
 * 거의 제자리로 되돌아간다.
 *
 *   set  s0 → s1 → s2 → ... → s59      (mousemove 60번)
 *   기록 s0                            ← 첫 과거 상태 하나만
 */

/** 이 시간 동안 추가 변경이 없으면 하나의 제스처가 끝난 것으로 본다 */
export const HISTORY_DEBOUNCE_MS = 400;

export interface DebouncedHandleSet<TArgs extends unknown[]> {
  (...args: TArgs): void;
  /** 대기 중인 기록을 즉시 커밋한다 (undo/redo 직전에 호출) */
  flush(): void;
  /** 대기 중인 기록을 버린다 (히스토리 clear 시) */
  cancel(): void;
}

/**
 * @param commit  실제로 히스토리에 쌓는 함수 (zundo 의 _handleSet)
 * @param waitMs  이 시간만큼 조용하면 커밋
 */
export function createDebouncedHandleSet<TArgs extends unknown[]>(
  commit: (...args: TArgs) => void,
  waitMs: number = HISTORY_DEBOUNCE_MS,
): DebouncedHandleSet<TArgs> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: TArgs | null = null;

  const commitPending = () => {
    const args = pending;
    pending = null;
    timer = null;
    if (args) commit(...args);
  };

  const debounced = ((...args: TArgs) => {
    // 버스트의 첫 호출만 붙잡는다. 이후 호출은 타이머만 미룬다.
    if (pending === null) pending = args;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(commitPending, waitMs);
  }) as DebouncedHandleSet<TArgs>;

  debounced.flush = () => {
    if (timer !== null) clearTimeout(timer);
    commitPending();
  };

  debounced.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    pending = null;
  };

  return debounced;
}
