# Elbow Connector 리팩토링 계획

## 목표

각 핸들러가 **자신의 영역만** 독립적으로 조절하도록 구조 분리

## 핵심 원칙

1. **직선 → 엘보우 생성**: 1개 핸들러 → 5개 핸들러
2. **각 핸들러는 독립적**: 다른 엘보우/직선 구간에 영향 없음
3. **Shape 이동 시 축 반전**: 최종 연결 직선만 변경, 기존 엘보우 구조 유지

---

## 현재 구조 문제점

```
Connector.tsx
├── handleMidpointDragStart()
├── handleMidpointDragMove()   ← 모든 핸들러 타입 처리 (복잡)
└── handleMidpointDragEnd()    ← 모든 핸들러 타입 처리 (복잡)

elbowPath.ts
├── applyBends()              ← 범위 체크/재조정 로직 (부작용 발생)
├── getMidpointHandlePositions() ← 핸들러 위치 계산
└── calculateElbowPath()      ← 최종 경로 계산
```

**문제**: 하나의 함수에서 모든 케이스 처리 → 조건문 중첩, 상호 영향

---

## 리팩토링 후 구조

### 1단계: 핸들러 액션 함수 분리

```typescript
// src/utils/elbowHandlers.ts (새 파일)

/**
 * 핸들러 타입별 독립 액션 함수
 * 각 함수는 자신의 영역만 수정하고 새 ElbowBend 반환
 */

// 1. 직선 → 엘보우 생성 (center 핸들 Y축 드래그)
export function createElbowFromStraight(
  startX: number, startY: number,
  endX: number, endY: number,
  dragDeltaY: number
): ElbowBend | null

// 2. 엘보우 Y축 조절 (center 핸들 Y축 드래그)
export function adjustElbowY(
  existingBend: ElbowBend,
  dragDeltaY: number
): ElbowBend

// 3. 좌측 코너 X축 조절 (left 핸들 X축 드래그)
export function adjustLeftCornerX(
  existingBend: ElbowBend,
  dragDeltaX: number,
  constraints: { minX: number, maxX: number }
): ElbowBend

// 4. 우측 코너 X축 조절 (right 핸들 X축 드래그)
export function adjustRightCornerX(
  existingBend: ElbowBend,
  dragDeltaX: number,
  constraints: { minX: number, maxX: number }
): ElbowBend

// 5. 계단 생성 (startY/endY 세그먼트 핸들 Y축 드래그)
export function createStair(
  existingBend: ElbowBend,
  region: 'left' | 'right',
  dragDeltaY: number
): ElbowBend

// 6. 계단 midX 조절 (계단 중간 수직선 X축 드래그)
export function adjustStairMidX(
  existingBend: ElbowBend,
  target: 'midLeft' | 'midRight',
  dragDeltaX: number
): ElbowBend
```

### 2단계: Connector.tsx 핸들러 단순화

```typescript
// 핸들러 동작 분기 (단순화)
const handleMidpointDragEnd = useCallback(() => {
  const { handleType, verticalTarget, region } = midpointDragState
  const dragDelta = midpointDragState.currentOffset

  let newBend: ElbowBend | null = null

  // 1. 직선 → 엘보우 생성
  if (!existingBend && handleType === 'center') {
    newBend = createElbowFromStraight(startX, startY, endX, endY, dragDelta)
  }
  // 2. 엘보우 Y축 조절
  else if (existingBend && handleType === 'center' && region === 'primary') {
    newBend = adjustElbowY(existingBend, dragDelta)
  }
  // 3. 좌측 코너 X축 조절
  else if (existingBend && handleType === 'left' && verticalTarget === 'leftCorner') {
    newBend = adjustLeftCornerX(existingBend, dragDelta, { minX: startX, maxX: existingBend.rightCornerX - 20 })
  }
  // 4. 우측 코너 X축 조절
  else if (existingBend && handleType === 'right' && verticalTarget === 'rightCorner') {
    newBend = adjustRightCornerX(existingBend, dragDelta, { minX: existingBend.leftCornerX + 20, maxX: endX })
  }
  // 5. 계단 생성/조절
  else if (existingBend && region && ['left', 'right', 'newLeft', 'newRight'].includes(region)) {
    newBend = createStair(existingBend, region, dragDelta)
  }
  // 6. 계단 midX 조절
  else if (existingBend && verticalTarget && ['midLeft', 'midRight'].includes(verticalTarget)) {
    newBend = adjustStairMidX(existingBend, verticalTarget, dragDelta)
  }

  if (newBend) {
    onUpdate({ elbowBends: [newBend] })
  }
}, [...])
```

### 3단계: applyBends 범위 체크 제거

```typescript
// elbowPath.ts - applyBends 수정

function applyBends(basePoints: Point[], bends: ElbowBend[]): Point[] {
  // 범위 체크/재조정 로직 제거
  // 저장된 좌표를 그대로 사용

  const leftX = primaryBend.leftCornerX  // 재조정 없이 그대로 사용
  const rightX = primaryBend.rightCornerX

  // ... 경로 계산
}
```

---

## 핸들러별 수정 범위

| 핸들러 | 수정 대상 | 영향 없음 |
|--------|----------|----------|
| center (직선) | 새 엘보우 생성 | - |
| center (엘보우) | `elbowY` | leftCornerX, rightCornerX, stairs |
| left | `leftCornerX` | rightCornerX, elbowY, stairs |
| right | `rightCornerX` | leftCornerX, elbowY, stairs |
| midLeft | `midLeftX` | 다른 모든 값 |
| midRight | `midRightX` | 다른 모든 값 |
| left/right stair | `leftY`/`rightY`, steps | 다른 모든 값 |

---

## ElbowBend 데이터 구조 (명확화)

```typescript
interface ElbowBend {
  // 기본 ㄷ자 구조 (필수)
  elbowY: number           // 중앙 수평선 Y 좌표
  leftCornerX: number      // 좌측 코너 X 좌표
  rightCornerX: number     // 우측 코너 X 좌표

  // 계단 구조 (선택)
  leftY?: number           // 좌측 계단 Y 좌표
  rightY?: number          // 우측 계단 Y 좌표
  midLeftX?: number        // 좌측 계단 중간 수직선 X
  midRightX?: number       // 우측 계단 중간 수직선 X

  // 연속 계단 (선택)
  leftYSteps?: StairStep[]
  rightYSteps?: StairStep[]

  // 메타데이터
  region: 'primary'
  segmentIndex: number
  offset: number           // 호환성용 (elbowY - startY)
}
```

---

## 구현 순서

### Phase 1: 핸들러 액션 함수 분리 (elbowHandlers.ts)
- [ ] `createElbowFromStraight()` 구현
- [ ] `adjustElbowY()` 구현
- [ ] `adjustLeftCornerX()` 구현
- [ ] `adjustRightCornerX()` 구현
- [ ] `createStair()` 구현
- [ ] `adjustStairMidX()` 구현

### Phase 2: Connector.tsx 리팩토링
- [ ] `handleMidpointDragEnd` 새 함수 호출로 교체
- [ ] `handleMidpointDragMove` 새 함수 호출로 교체
- [ ] 기존 복잡한 조건문 제거

### Phase 3: applyBends 정리
- [ ] 범위 체크/재조정 로직 제거
- [ ] 저장된 좌표 그대로 사용

### Phase 4: 테스트 및 검증
- [ ] 직선 → 엘보우 생성 테스트
- [ ] 각 핸들러 독립 동작 테스트
- [ ] Shape 이동 시 축 반전 테스트
- [ ] 계단 구조 테스트

---

## 예상 효과

1. **버그 감소**: 각 핸들러가 자신의 영역만 수정
2. **유지보수 용이**: 기능별 함수 분리로 코드 이해 쉬움
3. **테스트 용이**: 개별 함수 단위 테스트 가능
4. **확장 용이**: 새 핸들러 타입 추가 시 새 함수만 추가
