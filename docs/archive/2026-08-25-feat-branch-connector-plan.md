# 🌿 feat: 분기 커넥터 (마인드맵 화살표)

> **상태: 구현됨** (2026-08-25). `targetIds` / `junctionT` / `branchLabels` 로
> 데이터 모델이 들어갔고, 렌더는 `components/shapes/BranchConnector.tsx`,
> 경로 계산은 `utils/branchPath.ts` 다. Mermaid import 가 형제 엣지를
> 자동으로 묶는다. **편집 UX(+ 핸들, 분기점 드래그)는 아직 없다.**

## 문제 — 갈래가 여러 개면 선이 겹쳐 그려진다

한 노드에서 여러 노드로 나가는 흐름을 지금은 **독립 커넥터 N개**로 그린다.
셋 다 같은 변(예: bottom) 중앙에서 출발하므로 초반 구간이 **완전히 겹치고**,
갈라지는 지점에서 각자의 라운드 코너가 반대 방향으로 휘면서 갈고리처럼 보인다.

```
        [ battleScene ]
              │          ← 커넥터 2개가 이 구간을 겹쳐 그린다
        ┌─────┴─────┐    ← 각자 코너를 그려 이음매가 지저분해진다
        ▼           ▼
   [ spellFx ]  [ endBattle ]
```

문서 다이어그램(`docs/diagrams/*.png`)에서 실제로 드러났다. 겹친 선은
안티에일리어싱이 겹쳐 두껍게 보이고, 코너 두 개가 만나는 자리에 짧은
스텁이 튀어나온다.

마인드맵·조직도·플로우차트에서는 이 구조가 기본이라, 1:1 커넥터를 여러 개
얹는 방식으로는 근본적으로 깨끗해지지 않는다.

## 제안 — 줄기 하나 + 갈래 N개

**한 커넥터가 여러 타깃을 가진다.** 줄기(trunk)는 한 번만 그리고, 분기점
(junction)에서 갈래(branch)가 뻗어 나온다. 갈래는 **연결부 반대쪽 변**에서
빠져나온다 — 소스가 bottom 으로 나가면 갈래는 타깃의 top 으로 들어간다.

```
        [ battleScene ]
              │              trunk  (1개, 소스 앵커 → junction)
        ┌─────┴─────┐        junction (분기점, 드래그로 위치 조정)
        ▼           ▼        branch  (타깃 수만큼)
   [ spellFx ]  [ endBattle ]
```

### 데이터 모델

```ts
// 기존 커넥터는 그대로 두고, 타깃 배열을 optional 로 얹는다.
interface CanvasObject {
  // ...
  targetId?: string;        // 기존 1:1 (하위호환)
  targetIds?: string[];     // 분기 커넥터일 때
  junctionT?: number;       // 소스→타깃 사이 분기점 위치 (0~1, 기본 0.5)
  branchLabels?: Record<string, string>; // 타깃 id → 갈래 라벨
}
```

- `targetIds` 가 있으면 분기 커넥터로 렌더한다. 없으면 지금과 동일.
- 마이그레이션 불필요 — `targetIds` 를 안 쓰면 기존 저장 파일이 그대로 열린다.
- **되돌리기 필드 등록을 잊지 말 것**: `store/index.ts` 의 zundo equality 에
  `targetIds` / `junctionT` / `branchLabels` 를 추가해야 undo 가 동작한다
  (`.claude/rules/store.md` 의 "새 속성 추가 시 체크리스트").

### 렌더링

- 경로 계산은 `utils/elbowPath.ts` 를 재사용한다: trunk 는 소스 앵커 →
  junction, 각 branch 는 junction → 타깃 앵커. 라운드 코너도 그대로.
- **분기점에서 코너를 그리지 않는다** — junction 은 점 하나이고 갈래가 거기서
  시작한다. 지금 지저분해 보이는 이음매가 여기서 사라진다.
- 갈래가 2개일 때 junction 을 소스 바로 아래에 두면 지금과 같은 T 자,
  중간에 두면 마인드맵 형태가 된다 (`junctionT` 로 조절).

### 편집 UX

- 커넥터 도구로 소스에서 끌어 첫 타깃을 잇는다 (지금과 동일).
- 선택 상태에서 **+ 핸들**을 끌어 타깃을 추가하면 분기 커넥터로 승격된다.
- junction 핸들을 드래그해 분기점을 옮긴다 (`elbowBends` 의 중간점 핸들과
  같은 상호작용 — `getMidpointHandlePositions` 재사용).
- 갈래 하나를 지우면 `targetIds` 에서 빠지고, 1개만 남으면 1:1 로 되돌린다.

## Mermaid import 와의 관계

`src/mermaid/import.ts` 는 지금 같은 소스에서 나가는 엣지를 각각 커넥터로
만든다. 분기 커넥터가 생기면 **같은 소스·같은 앵커 엣지들을 하나로 묶어**
import 할 수 있고, 문서 다이어그램의 이음매 문제가 자동으로 해결된다.
(엣지 라벨은 `branchLabels` 로 옮긴다.)

## 하지 않을 것

- **다중 소스(N:1) 는 이번 범위가 아니다.** 모이는 흐름은 화살표 방향이
  반대라 junction 의 의미가 달라진다 — 별도 제안으로 다룬다.
- 자동 레이아웃(갈래 자동 정렬)은 넣지 않는다. 위치는 사용자가 정한다.

## 검증 (Given/When/Then)

1. 타깃 2개인 분기 커넥터를 만들면 → trunk 가 **한 번만** 그려지고 겹친
   선이 없다 (경로 points 수로 검증).
2. 소스를 드래그하면 → trunk 와 모든 갈래가 함께 따라온다.
3. 갈래를 하나 지우면 → 남은 1개가 1:1 커넥터로 되돌아가고, undo 로 복구된다.
4. `targetIds` 없는 기존 `.pigma` 파일을 열면 → 지금과 동일하게 렌더된다.
5. 분기점을 드래그하면 → `junctionT` 가 저장되고 undo 스택에 한 단계로 쌓인다.
