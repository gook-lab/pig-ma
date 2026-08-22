---
title: "refactor: Canvas 전반 성능 최적화"
type: refactor
status: completed
date: 2026-03-26
deepened: 2026-03-27
---

# refactor: Canvas 전반 성능 최적화

## Overview

도구 요소(shape, chart, codeBlock, embed, table 등)가 늘어남에 따라 Canvas.tsx의 렌더링 병목이 심화되고 있다. 불필요한 리렌더를 제거하고, 데이터 구조를 최적화하며, HTML 오버레이 파이프라인을 개선하여 대규모 캔버스에서도 부드러운 조작감을 유지한다.

## Problem Frame

Canvas.tsx(4,389줄)가 Zustand store의 30개 이상 필드를 셀렉터 없이 구독하여 어떤 상태 변경이든 전체 컴포넌트가 리렌더된다. `.map()` 내부 인라인 콜백으로 모든 Shape의 `memo()`가 무효화되고, HTML 오버레이에서 O(n²) 가려짐 검사가 수행된다. 객체 수가 늘수록 이 문제들이 선형 이상으로 악화된다.

## Requirements Trace

- R1. Canvas.tsx의 store 구독을 세분화하여 무관한 상태 변경 시 리렌더 방지
- R2. Shape 컴포넌트의 `memo()`가 실질적으로 동작하도록 콜백 참조 안정화
- R3. `selectedIds` 검색을 O(1)로 개선
- R4. HTML 오버레이(TextViewer, CodeBlock, Embed)에서 뷰포트 밖 객체 제거 및 가려짐 검사 최적화
- R5. groupSiblings, groups 조회 등 반복 계산을 사전 캐싱
- R6. 중복 switch/case 렌더링 로직 통합으로 유지보수성 향상
- R7. Temporal equality의 JSON.stringify 비용 절감
- R8. 기존 기능(선택, 드래그, 줌, undo/redo)에 동작 변화 없음

## Scope Boundaries

- Canvas.tsx 분할(파일 쪼개기)은 이 계획의 범위가 아님 — 렌더링 경로 최적화에 집중
- DragCoordinator, ResizeCoordinator 등 이미 최적화된 패턴은 변경하지 않음
- React Compiler 도입이나 Konva 버전 업그레이드 등 프레임워크 레벨 변경 제외
- 시각적 동작 변화 없음 (순수 성능 리팩토링)

## Context & Research

### Relevant Code and Patterns

- `src/components/Canvas.tsx` — 메인 렌더링 파이프라인, 모든 병목의 진원지
- `src/hooks/useVisibleObjects.ts` — 뷰포트 가상화 (양호하나 개선 여지)
- `src/hooks/useDragCoordinator.ts` — React state 우회 패턴 (모범 사례)
- `src/store/index.ts` — Zustand store, temporal equality 함수 (Immer 미사용, 스프레드 패턴)
- `src/utils/geometry.ts` — `filterVisibleObjects`, bounds 계산, `rectContains`
- `src/constants/zIndex.ts` — `getCanvasOverlayZIndex`
- Store에 `useObjects`, `useSelectedIds` 등 세밀한 셀렉터 훅이 정의되어 있으나 Canvas.tsx에서 미사용

### Institutional Learnings

- 프로젝트 규칙(`patterns.md`, `store.md`)에 fine-grained selector 패턴이 명시되어 있음
- `memo()` + `useCallback()` 패턴이 components.md에 규정되어 있으나 Canvas.tsx 내부에서 미준수

### Deepening Research Findings

- **react-konva reconciler 검증**: react-konva는 Konva 노드 타입만 씬 그래프 노드로 생성함. 순수 React 래퍼(`ShapeRenderer`)는 Konva 씬 그래프에 투명 — 이벤트 버블링, 히트 디텍션에 영향 없음. 단, Konva `<Group>` 래핑 시 히트 디텍션 2x 오버헤드 발생.
- **`getState()` 안전성 검증**: Zustand `set()`은 동기적. `onDragStart`에서 `setSelectedIds` 호출 후 즉시 `onDragMove`의 `getState()`가 최신 값을 반환. DragCoordinator가 이미 store를 우회하므로 드래그 중 `objects` 참조 변경 없음. 클로저보다 `getState()`가 더 안전.
- **Store 업데이트 패턴**: `updateObject`는 `{ ...obj, ...updates }` 스프레드를 사용 (Immer 미사용). 변경되지 않은 중첩 객체(`tiptapContent`, `chartData` 등)는 동일 참조를 유지 → `===` 선검사로 JSON.stringify 90%+ 스킵 가능.
- **objectsBehindGroups 행동 차이**: zIndex < 0 객체는 **드래그 콜백만 간소화**(빈 onDragStart, 정렬 가이드/커넥터 스냅/그룹 드래그 없음). 단, **onSelect(handleSelect)는 동일하게 존재** — 배경 객체도 클릭 선택은 가능. objectsInFrontOfGroups는 210줄의 전체 onDragMove 로직 포함(정렬 가이드 계산, 커넥터 스냅 포인트 탐색, 그룹 siblings 이동). 단순 통합 불가, 렌더 모드 분기 필요.

## Key Technical Decisions

- **Canvas.tsx를 쪼개지 않고 내부 최적화**: 파일 분할은 별도 리팩토링으로 — 이 계획은 렌더링 경로 병목 해소에 집중
- **ShapeRenderer는 순수 React 래퍼**: Konva `<Group>` 래핑 없이 Shape 컴포넌트를 직접 반환. react-konva reconciler가 React 래퍼를 씬 그래프에 투명하게 처리하므로 성능 페널티 없이 `memo()` 경계 확보. Konva `<Group>` 래핑 시 히트 디텍션 오버헤드가 발생하므로 명시적으로 금지.
- **ShapeRenderer의 렌더 모드 분기**: `objectsBehindGroups`와 `objectsInFrontOfGroups`의 행동 차이를 `renderMode: "simplified" | "full"` prop으로 분기. **simplified 모드는 드래그 콜백만 간소화 — `onSelect`(handleSelect)는 simplified에서도 동일하게 동작** (실제 코드에서 objectsBehindGroups도 선택 콜백 포함). simplified에서 비활성: `onDragStart`(빈 함수), `onDragMove`(정렬 가이드/커넥터 스냅/그룹 siblings 없음).
- **콜백 안정화 전략 — `getState()` 기반**: 이벤트 핸들러 내에서 `useCanvasStore.getState()`로 최신 상태 접근. Zustand `set()`이 동기적이므로 stale closure 위험이 오히려 현재 클로저 패턴보다 낮음. `handleSelect`(12개 클로저 의존성)가 최우선 변환 대상.
- **ShapeRenderer는 `obj` 참조를 prop으로 수신**: 부모의 visibleObjects 배열에서 이미 계산된 객체 참조를 직접 전달. `objectId` + 내부 셀렉터(`objects.find()`) 방식은 N개 ShapeRenderer × O(n) find = O(n²)로 성능 악화. 스프레드 패턴에서 변경되지 않은 객체는 동일 참조를 유지하므로, `memo()`의 shallow comparison으로 불필요한 리렌더 방지 가능. `groupSiblings`는 `getState()` 내에서 계산.
- **selectedIdsSet을 useMemo로 캐싱**: `selectedIds` 배열 → `Set<string>` 변환을 한 번만 수행 (15회 `.includes()` 호출 제거)
- **groupsMap 사전 계산**: `groups.find()` 반복 호출 → `Map<string, Group>` 캐싱 (5회 선형 검색 제거)
- **HTML 오버레이에 visibleObjects 전달**: 전체 objects 대신 뷰포트 필터링된 배열 사용
- **가려짐 검사는 O(n) 역순 패스 불가 → bounds 캐싱으로 개선**: 단일 직사각형 축적으로 직사각형 합집합 추적은 불가능. 대신 `getObjectBounds` 결과를 사전 캐싱하여 중복 계산 제거. 현재 실질적 복잡도는 O(m × n) (m = overlay 대상 수, 보통 10-30개)이며, `some()`의 early exit로 실제 비용은 낮음. 프로파일링으로 병목 확인 후 추가 최적화 판단.
- **visibleObjects → 3개 파생 배열을 단일 패스로 분류**: `objectsBehindGroups`, `objectsInFrontOfGroups`, `connectorLabels` 분류를 3회 `.filter()` 대신 1회 순회로 처리

## Open Questions

### Resolved During Planning

- **Q: Canvas.tsx를 여러 파일로 분할해야 하는가?** → 이 계획에서는 분할하지 않음. 렌더링 경로 최적화만으로 충분한 효과를 기대할 수 있으며, 파일 분할은 독립적인 리팩토링으로 후속 진행 가능.
- **Q: React Compiler가 인라인 콜백 문제를 자동 해결하는가?** → React 19 + React Compiler가 활성화되어 있지 않은 상태. ShapeRenderer 래퍼가 가장 확실한 해결책.
- **Q: ShapeRenderer가 Konva `<Group>`을 래핑해야 하는가?** → 아니오. react-konva reconciler가 React 래퍼를 씬 그래프에 투명하게 처리하므로 `<Group>` 없이 Shape 컴포넌트를 직접 반환해야 함. `<Group>` 래핑은 히트 디텍션에 ~2x 오버헤드, `findOne('#id')` 탐색 경로 변경, 이벤트 버블링 단계 추가 등 부작용 유발.
- **Q: `getState()` 사용 시 stale state 위험이 있는가?** → Zustand `set()`은 동기적이므로 `getState()`는 항상 최신 값을 반환. 드래그 중 `objects`는 `onDragEnd`까지 변경되지 않으며, `selectedIds`도 동기적으로 업데이트됨. 현재 클로저 패턴보다 `getState()`가 더 안전.
- **Q: Immer 사용 여부가 `===` 비교 전략에 영향을 주는가?** → Store는 Immer 미사용, `{ ...obj, ...updates }` 스프레드 패턴 사용. 변경되지 않은 중첩 객체는 동일 참조 유지 → `===` 선검사로 JSON.stringify를 안전하게 스킵 가능.

### Deferred to Implementation

- **정렬 가이드(alignment guide) 계산의 정확한 최적화 방식** — 현재 onDragMove 내에서 매 프레임 계산되지만, DragCoordinator가 이미 store를 우회하므로 리렌더와는 별개. `setAlignmentGuides`가 React state를 트리거하는 부분은 ref 기반 패턴 전환 고려 가능하나, 실측 후 판단.
- **가려짐 검사의 추가 최적화 필요 여부** — bounds 캐싱 적용 후 프로파일링으로 병목 여부 재확인. 여전히 문제라면 공간 인덱스 또는 객체 타입별 사전 분류 도입.

## Implementation Units

### 실행 순서: Unit 1 → Unit 2(JSON.stringify) → Unit 3(ShapeRenderer) → Unit 4(액션 추출) → Unit 5(Overlay) → Unit 6(Optional)

> **시퀀싱 근거:** Unit 1(Set 캐싱)과 Unit 2(JSON.stringify)는 독립적이고 저위험으로 먼저 실행. Unit 3(ShapeRenderer)은 가장 높은 위험이나 최대 효과. Unit 4(액션 추출)는 Unit 3과 독립 실행 가능하나, ShapeRenderer의 `getState()` 패턴이 확립된 후 Canvas.tsx Stage 핸들러에 동일 패턴 적용하는 것이 자연스러움. Unit 5(Overlay)는 Unit 1의 Set 캐싱에만 의존. Unit 6은 프로파일링 결과에 따라 선택적 실행.

---

- [ ] **Unit 1: selectedIds Set 캐싱 + groupsMap 사전 계산**

**Goal:** 반복 호출되는 배열 검색과 find를 O(1) 조회로 전환. `visibleObjects` 3개 파생 배열 분류를 단일 패스로 통합.

**Requirements:** R3, R5

**Dependencies:** None

**Files:**
- Modify: `src/components/Canvas.tsx`
- Test: 수동 테스트 — 선택, 드래그, 그룹 조작 동작 확인

**Approach:**
- `const selectedIdsSet = useMemo(() => new Set(selectedIds), [selectedIds])` 추가
- `const draggingIdsSet = useMemo(() => new Set(draggingIds), [draggingIds])` 추가
- `const groupsMap = useMemo(() => new Map(groups.map(g => [g.id, g])), [groups])` 추가
- `const groupSiblingsMap = useMemo(() => Map<string, CanvasObject[]>)` — groupId를 키로, 해당 그룹의 멤버 객체 배열을 값으로. onDragMove에서 `groupSiblingsMap.get(obj.groupId)?.filter(o => o.id !== obj.id)` 로 자신 제외 siblings 조회.
- `.map()` 내부의 `selectedIds.includes(obj.id)` → `selectedIdsSet.has(obj.id)` 교체 (`.map()` 내부 호출 + `useCallback` 내부 호출 포함. `useCallback` 내부 사용 시 `selectedIdsSet`이 의존성에 추가됨)
- `draggingIds.includes(obj.id)` → `draggingIdsSet.has(obj.id)` 교체
- `groups.find(g => g.id === obj.groupId)` → `groupsMap.get(obj.groupId)` 교체 (5회)
- `visibleObjects`(이미 뷰포트 필터링 완료) → `objectsBehindGroups`, `objectsInFrontOfGroups`, `connectorLabels` 분류를 3회 `.filter()` 대신 단일 `useMemo` 순회로 통합. 입력이 `visibleObjects`이므로 뷰포트 밖 객체는 이미 제외됨.

**Patterns to follow:**
- 기존 `objectsById` Map 패턴 (Canvas.tsx 내 이미 존재)

**Test scenarios:**
- 100+ 객체에서 단일/다중 선택 동작 정상
- 그룹 내 객체 드래그 시 siblings 동기화 정상
- Shift+클릭 다중 선택 정상
- zIndex < 0 객체가 여전히 올바른 배열에 분류됨

**Verification:**
- `selectedIds.includes` 호출이 Canvas.tsx에서 0건
- `draggingIds.includes` 호출이 Canvas.tsx에서 0건
- `groups.find` 호출이 `.map()` 내부에서 0건
- `visibleObjects.filter(...)` 3연속 호출이 단일 순회로 통합됨

---

- [ ] **Unit 2: Temporal equality JSON.stringify 최적화**

**Goal:** undo/redo 비교에서 JSON.stringify 비용 절감

**Requirements:** R7

**Dependencies:** None (독립적)

**Files:**
- Modify: `src/store/index.ts` (temporal equality 함수, 311-502행)
- Test: 수동 테스트 — 속성 변경 후 Cmd+Z 되돌리기 동작 확인

**Approach:**
- `tiptapContent`, `chartData`, `tableData`, `points`, `reactions`, `elbowBends`, `embedMetadata` 7개 필드에 `===` 참조 비교 선검사 추가
- Store가 Immer 미사용 + 스프레드 패턴이므로 `===`가 true이면 내용도 동일함이 보장됨 (x/y만 변경 시 중첩 객체는 동일 참조 유지)
- 참조가 다를 때만 `JSON.stringify` 비교 fallback (또는 제거)
- 특히 `points` 배열(line 타입에서 수백 좌표)이 가장 큰 절감 대상

**Patterns to follow:**
- 기존 equality 함수의 속성별 비교 패턴

**Test scenarios:**
- chartData 변경 후 undo → 이전 데이터로 복원
- tiptapContent 편집 후 undo → 이전 텍스트로 복원
- 빠른 연속 편집 시 undo history가 정상 기록
- x/y 드래그만 수행 시 equality 함수가 JSON.stringify를 호출하지 않음

**Verification:**
- equality 함수에서 `===` 선검사 후에만 JSON.stringify (또는 deep compare) 실행
- 기존 undo/redo 테스트 시나리오 전체 통과

---

- [ ] **Unit 3: ShapeRenderer 래퍼 컴포넌트 추출**

**Goal:** `.map()` 내부 인라인 콜백을 제거하여 Shape 컴포넌트의 `memo()`가 실질적으로 동작하도록 함

**Requirements:** R2, R6

**Dependencies:** Unit 1 (selectedIdsSet, groupsMap, groupSiblingsMap 사용)

**Files:**
- Create: `src/components/ShapeRenderer.tsx`
- Modify: `src/components/Canvas.tsx`
- Test: 수동 테스트 — 모든 도형 타입별 선택/드래그/더블클릭 동작 확인

**Approach:**
- `ShapeRenderer`는 **순수 React 래퍼** — Konva `<Group>` 래핑 없이 Shape 컴포넌트를 직접 반환
- Props: `obj` (CanvasObject 참조), `renderMode` ("simplified" | "full"), `isSelected` (boolean), `isMultiSelected` (boolean), `isObjectLocked` (boolean), `zoom`, `tool` 등
- `obj` 참조는 부모의 visibleObjects에서 직접 전달 — 스프레드 패턴에서 변경되지 않은 객체는 동일 참조 유지 → `memo()` shallow comparison으로 리렌더 방지. `objectId` + 내부 `objects.find()` 셀렉터 방식은 N×O(n) = O(n²)이므로 채택하지 않음.
- 이벤트 핸들러는 모두 `useCanvasStore.getState()` 기반으로 구현:
  - `handleSelect`: `getState()`에서 `tool`, `objects`, `groups`, `selectedIds`, `editingTextId` 접근 (12개 클로저 의존성 해소)
  - `onDragEnd`, `onDoubleClick`, `onUpdate`: fire-and-forget 액션이므로 `getState()` 자연스러움
  - `onDragStart`: `getState().selectedIds`로 선택 상태 확인 후 `setSelectedIds` 호출
  - `onDragMove`: 아래 4개 서브시스템 포함 (full 모드 전용):
    1. 정렬 가이드(alignment guide) 계산 — 인접 객체 대비 스냅 라인 표시
    2. 커넥터 스냅 포인트 탐색 — `objects` 순회하여 연결 대상 탐색
    3. 그룹 siblings 이동 — `groupSiblings` 배열의 Konva 노드 직접 이동
    4. 마키(marquee) 교차 판정 — 드래그 범위 내 객체 선택
- `renderMode === "simplified"`: `onDragStart(() => {})`, onDragMove 간소화 (위 4개 서브시스템 없음). **단, onSelect(handleSelect)는 full과 동일하게 동작** — 배경 객체도 클릭 선택 가능.
- `renderMode === "full"`: 정렬 가이드, 커넥터 스냅, 그룹 드래그 포함 전체 콜백
- `objectsBehindGroups.map(obj => <ShapeRenderer obj={obj} renderMode="simplified" />)`
- `objectsInFrontOfGroups.map(obj => <ShapeRenderer obj={obj} renderMode="full" />)`
- switch/case 로직은 ShapeRenderer 내부에 한 번만 존재

**Patterns to follow:**
- 기존 Shape 컴포넌트들의 `memo(function ...)` 패턴
- DragCoordinator의 store 직접 접근 패턴
- StickyNote.tsx의 `id={shape.id}` 패턴 (Konva `findOne('#id')` 호환성 유지)

**Test scenarios:**
- 12개 도형 타입 각각: 생성, 선택, 드래그, 더블클릭(편집) 정상
- 그룹 내 객체 드래그 시 그룹 siblings 동기화
- zIndex < 0 객체가 그룹 배경 뒤에 렌더링 (simplified 모드)
- zIndex < 0 객체가 선택/정렬 가이드 등 고급 인터랙션에 참여하지 않음
- Connector가 연결 대상 드래그 시 정상 추종
- `layer.findOne('#' + sibling.id)`가 정상 작동 (ShapeRenderer가 Konva Group을 추가하지 않으므로)

**Verification:**
- Canvas.tsx `.map()` 내부에 인라인 arrow function이 0건
- React DevTools Profiler에서 비선택 Shape가 리렌더되지 않는 것 확인
- Konva 씬 그래프에 ShapeRenderer로 인한 추가 노드가 없는 것 확인

---

- [ ] **Unit 4: Canvas.tsx 액션 함수 추출 + Stage 핸들러 `getState()` 전환**

**Goal:** Canvas.tsx에서 액션 함수를 `getState()`로 분리하여 구독 범위 축소. 셀렉터 세분화는 Canvas.tsx 파일 분할 후 후속 작업으로 분리.

**Requirements:** R1 (부분 달성)

**Dependencies:** None (Unit 3과 독립적으로 실행 가능)

**Files:**
- Modify: `src/components/Canvas.tsx`
- Test: 수동 테스트 — 전체 기능 회귀 확인

**Approach:**
- 액션 함수(`updateObject`, `addObject`, `deleteObjects`, `setSelectedIds` 등)를 이벤트 핸들러 내에서 `useCanvasStore.getState()`로 접근 — 구독에서 제외
- Stage 레벨 이벤트 핸들러(`handleMouseDown`, `handleMouseMove`, `handleMouseUp`, `handleWheel`)에서 `tool`, `isLocked` 등을 `getState()`로 접근 — stale closure 해소
- **스코프 제한**: 셀렉터를 "렌더링/도구/편집"으로 분리하는 것은 이 범위에서 **하지 않음** — Canvas.tsx가 단일 함수인 한 셀렉터 분리의 효과가 제한적(`editingTextId`가 Konva Layer + HTML overlay 양쪽에 사용). Canvas.tsx 파일 분할 시 함께 수행.
- `useCanvasStore()`의 비셀렉터 호출은 유지하되, 액션 함수가 구독 대상에서 빠지므로 Zustand의 상태 비교에서 함수 참조 변경이 제외됨

**Patterns to follow:**
- Unit 3(ShapeRenderer)에서 적용한 `getState()` 패턴
- DragCoordinator의 store 직접 접근 패턴

**Test scenarios:**
- `tool` 전환 직후 클릭/드래그 이벤트가 올바른 tool 값을 사용함 (stale closure 없음)
- Undo/Redo 정상 동작
- 전체 기능 회귀 없음

**Verification:**
- 이벤트 핸들러 내 액션 함수 호출이 모두 `getState()` 기반
- Stage 레벨 핸들러에서 `tool` 등 모드 상태가 `getState()` 기반

---

- [ ] **Unit 5: HTML 오버레이 파이프라인 최적화**

**Goal:** HTML 오버레이에서 뷰포트 밖 객체 제거, 가려짐 검사 개선, 중복 순회 통합

**Requirements:** R4

**Dependencies:** Unit 1 (selectedIdsSet, draggingIdsSet)

**Files:**
- Modify: `src/components/Canvas.tsx` (오버레이 렌더링 섹션, 4248-4332행)
- Test: 수동 테스트 — 텍스트/코드블록/임베드 오버레이가 줌/패닝 시 정상 표시

**Approach:**
- **3회 전체 배열 순회 제거**: TextViewer(4248행), CodeBlock(4292행), Embed(4313행)이 각각 `objects.map().filter().map()` 체인을 실행 → 단일 `useMemo`로 사전 분류하여 `overlayTextObjects`, `overlayCodeBlocks`, `overlayEmbeds` 배열 생성
- 사전 분류 시 `visibleObjects` 기반 필터링 적용 (이미 뷰포트 + 300px 버퍼 검사 포함). `isInViewport` 런타임 필터 제거.
- z-index를 위한 원본 인덱스: `objectIndexMap = useMemo(() => new Map(objects.map((o, i) => [o.id, i])), [objects])`. 사용 시 `getCanvasOverlayZIndex(objectIndexMap.get(obj.id) ?? 0)` — 객체 삭제 race condition에서 `undefined` 반환 방지.
- **가려짐 검사 최적화**: O(n) 역순 패스 축적은 직사각형 합집합 추적이 필요하여 비실용적. 대신:
  - `getObjectBounds` 결과를 사전 캐싱 (`boundsMap = useMemo(...)`) — 현재 동일 객체의 bounds를 중복 계산하는 문제 해소
  - **가려짐 검사는 전체 `objects` 배열 기준 유지** — 뷰포트 밖의 높은 z-index 객체가 가장자리 오버레이를 가릴 수 있으므로 `visibleObjects`로 축소하면 안 됨. overlay 대상만 `visibleObjects`에서 선별하되, 가려짐 판정은 full objects 대상.
  - `some()`의 early exit 특성 유지 (첫 번째 완전 포함 발견 시 종료)
  - 실질적 복잡도 O(m × n)에서 m은 overlay 대상 수(보통 10-30개). 프로파일링 후 추가 최적화 필요성 판단
- `selectedIdsSet.has()`, `draggingIdsSet.has()` 사용 (Unit 1에서 생성)

**Patterns to follow:**
- 기존 `filterVisibleObjects` 패턴
- `objectsById` Map 캐싱 패턴

**Test scenarios:**
- 뷰포트 밖 스티키노트가 HTML DOM에 렌더되지 않음
- 큰 Rectangle 뒤에 완전히 가려진 스티키노트의 오버레이가 숨겨짐
- 패닝 시 오버레이가 자연스럽게 나타남/사라짐 (300px 버퍼)
- 코드블록 편집 모드 진입/종료 정상

**Verification:**
- 오버레이 섹션에서 `objects.map().filter().map()` 3연속 체인이 0건
- `getObjectBounds` 동일 객체 중복 호출이 0건
- 100+ 객체 캔버스에서 뷰포트에 10개만 보일 때 DOM 노드 수가 10개 근처

---

- [ ] **Unit 6: useVisibleObjects 미세 최적화 (Optional — 프로파일링 후 필요 시)**

**Goal:** 윈도우 resize 처리 개선 및 내부 Map 재생성 방지. 프로파일링에서 useVisibleObjects가 병목으로 확인될 때만 실행.

**Requirements:** R1 (불필요한 리렌더 감소) — 예상 효과 낮음

**Dependencies:** None (독립적). Units 1-5 완료 후 프로파일링 결과에 따라 실행 여부 결정.

**Files:**
- Modify: `src/hooks/useVisibleObjects.ts`
- Modify: `src/utils/geometry.ts` (`filterVisibleObjects` 내부)
- Test: 수동 테스트 — 브라우저 리사이즈 시 뷰포트 가상화 정상 동작

**Approach:**
- `useState`로 윈도우 크기를 추적하는 대신 `useRef` + `ResizeObserver`로 불필요한 리렌더 방지
- `filterVisibleObjects` 내부에서 매번 `new Map(objects.map(...))` 생성하는 부분 → Canvas에서 이미 `objectsById` Map을 생성하고 있으므로 인자로 전달하여 중복 제거
- debounceMs가 0일 때 `debouncedViewport` useState를 우회하여 즉시 반영

**Patterns to follow:**
- DragCoordinator의 `useRef` 기반 DOM 업데이트 패턴

**Test scenarios:**
- 브라우저 창 리사이즈 시 뷰포트 밖 객체가 정상적으로 컬링됨
- 빠른 패닝 시 객체가 깜빡이지 않음

**Verification:**
- `useVisibleObjects` 내 `useState` for windowSize가 제거됨
- `filterVisibleObjects` 내부 `new Map(...)` 생성이 제거됨
- 패닝 시 불필요한 컴포넌트 리렌더 감소 (Profiler 확인)

## System-Wide Impact

- **Interaction graph:** ShapeRenderer 추출로 Canvas.tsx → ShapeRenderer → 개별 Shape 컴포넌트 계층이 생김. 이벤트 핸들러가 `getState()` 기반으로 전환되므로 클로저 의존성 체인이 해소됨. 단, ShapeRenderer 내부에서 `useCanvasStore.getState()`를 사용하는 것은 React의 선언적 데이터 흐름과 다른 명령적 패턴이므로, 향후 유지보수 시 이 설계 의도를 인지해야 함.
- **Konva 씬 그래프:** ShapeRenderer는 순수 React 래퍼이므로 Konva 씬 그래프에 노드를 추가하지 않음. `layer.findOne('#id')`, 이벤트 버블링, 히트 디텍션 경로 모두 변경 없음.
- **Error propagation:** 순수 렌더링 최적화이므로 에러 전파 경로 변경 없음.
- **State lifecycle risks:** store 구독 세분화 시 셀렉터 누락으로 상태 불일치 가능 — 특히 `editingTextId`가 Konva Layer와 HTML overlay 양쪽 모두에 영향을 주는 점 주의. `tool` 값은 `getState()` 전환으로 stale closure 문제가 해소되지만, 렌더링 의존성과 이벤트 핸들러 의존성을 혼동하지 않도록 주의.
- **API surface parity:** 라이브러리 빌드(`npm run build:lib`)에 ShapeRenderer가 내부 컴포넌트로 추가되지만 public API 변경 없음.
- **Integration coverage:** 드래그 + 그룹 + 커넥터 조합, 줌 + HTML 오버레이 조합, undo/redo + 모든 속성 타입, `tool` 전환 직후 인터랙션 등 교차 시나리오에서 회귀 확인 필요.

## Risks & Dependencies

- **ShapeRenderer의 onDragMove 210줄 추출**: 정렬 가이드, 커넥터 스냅, 그룹 siblings 이동 로직이 포함됨. `renderMode === "simplified"`에서는 이 로직이 실행되지 않아야 하며, `renderMode === "full"`에서는 `getState()` 기반으로 최신 `objects`, `groups`, `selectedIds`에 접근. DragCoordinator가 이미 store를 우회하는 패턴이므로 기술적 위험은 관리 가능하나 코드량이 크므로 꼼꼼한 테스트 필요.
- **`getState()` 패턴의 유지보수 비용**: React의 선언적 데이터 흐름 대신 명령적 접근을 사용하므로, 향후 새 상태를 추가할 때 "이 핸들러가 이 상태를 참조하는가?"를 코드 리뷰에서 확인해야 함. ShapeRenderer 내부에 어떤 store 필드를 `getState()`로 접근하는지 주석으로 명시할 것.
- **셀렉터 세분화는 이 범위에서 제외**: `editingTextId`가 Konva Layer + HTML overlay 양쪽에 사용되어 Canvas.tsx 파일 분할 없이는 셀렉터 분리 효과가 제한적. 이 범위에서는 액션 함수 추출 + Stage 핸들러 `getState()` 전환에 집중. 셀렉터 세분화는 Canvas.tsx 파일 분할 시 함께 수행.
- **HTML 오버레이에서 visibleObjects 사용 시 z-index 계산 변경**: 원본 objects 배열 인덱스를 `objectIndexMap`으로 유지. `getCanvasOverlayZIndex(objectIndexMap.get(obj.id))` 패턴으로 z-order 일관성 보장.
- **가려짐 검사 O(n) 접근법의 포기**: 역순 패스 축적은 직사각형 합집합 추적이 필요하여 비실용적. bounds 캐싱 + early exit가 현실적 최적화이며, 프로파일링 결과에 따라 후속 개선 판단.

## Sources & References

- Related patterns: `src/hooks/useDragCoordinator.ts` (React state 우회 모범 사례)
- react-konva reconciler: `node_modules/react-konva/lib/ReactKonvaHostConfig.js` (순수 React 래퍼가 씬 그래프에 투명함을 확인)
- Canvas.tsx 핵심 영역: 1912-2119행 (objectsBehindGroups, simplified callbacks), 2465-2840행 (objectsInFrontOfGroups, full callbacks), 1270-1345행 (handleSelect), 4248-4332행 (HTML overlays)
- Store: `src/store/index.ts` 311-502행 (temporal equality), 105행 (updateObject 스프레드 패턴)
- Project rules: `.claude/rules/patterns.md`, `.claude/rules/store.md`, `.claude/rules/components.md`
- Zustand docs: shallow equality, selector patterns, synchronous set() behavior
