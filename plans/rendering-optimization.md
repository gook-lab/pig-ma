# Canvas 렌더링 최적화 계획

## Overview

현재 Canvas App의 렌더링 성능 문제를 React Flow, Excalidraw, Figma 스타일의 최적화 패턴을 적용하여 해결합니다.

## Problem Statement

### 현재 주요 성능 병목

| 우선순위 | 문제 | 위치 | 영향 |
|----------|------|------|------|
| **P0** | 드래그 중 매 프레임 store 업데이트 | `Canvas.tsx:513-515` | 60fps 마다 전체 리렌더 |
| **P0** | Connector에 objects 배열 전달 | `Canvas.tsx:576` | memo() 무력화 |
| **P1** | Zustand selector 미사용 | `Canvas.tsx:63-78` | 모든 store 변경에 리렌더 |
| **P1** | findSnapTarget O(n) 매 프레임 | `Connector.tsx:144-148` | 객체 많을수록 느려짐 |

### 현재 문제되는 코드

```typescript
// Canvas.tsx:513-515 - 드래그마다 store 업데이트
onDragMove: (e) => {
  updateObject(obj.id, { x: e.target.x(), y: e.target.y() })  // BAD!
}
```

이 패턴의 문제:
- 마우스 이동 이벤트가 초당 60회 이상 발생
- 매 이벤트마다 전체 React reconciliation 실행
- 모든 Connector가 리렌더 (objects 배열이 새 참조)

---

## Proposed Solution

### 핵심 최적화 전략

1. **Drag Coordinator Pattern** - 드래그 중 React state 우회
2. **Zustand Selectors** - 세분화된 구독으로 불필요한 리렌더 방지
3. **Objects Map 캐싱** - O(1) 객체 조회
4. **requestAnimationFrame 스로틀링** - 60fps 제한

---

## Technical Approach

### Phase 1: Drag Coordinator 구현

드래그 중에는 React state를 건드리지 않고, Konva 레벨에서만 업데이트합니다.

#### 1.1 새 파일: `src/hooks/useDragCoordinator.ts`

```typescript
// 드래그 중인 객체의 실시간 위치를 React 외부에서 관리
interface DragPosition {
  x: number
  y: number
}

class DragCoordinator {
  private positions = new Map<string, DragPosition>()
  private listeners = new Map<string, Set<(pos: DragPosition) => void>>()

  // 드래그 위치 업데이트 (React state 없이)
  setPosition(id: string, x: number, y: number) {
    this.positions.set(id, { x, y })
    // 구독자들에게 직접 알림 (Connector 등)
    this.listeners.get(id)?.forEach(cb => cb({ x, y }))
  }

  getPosition(id: string): DragPosition | undefined {
    return this.positions.get(id)
  }

  // Connector가 특정 shape의 드래그를 구독
  subscribe(id: string, callback: (pos: DragPosition) => void) {
    if (!this.listeners.has(id)) {
      this.listeners.set(id, new Set())
    }
    this.listeners.get(id)!.add(callback)
    return () => this.listeners.get(id)?.delete(callback)
  }

  clear(id: string) {
    this.positions.delete(id)
  }
}

export const dragCoordinator = new DragCoordinator()
```

#### 1.2 Canvas.tsx 수정 - Shape 드래그 최적화

```typescript
// Before (BAD)
onDragMove: (e) => {
  updateObject(obj.id, { x: e.target.x(), y: e.target.y() })
}

// After (GOOD)
onDragMove: (e) => {
  // React state 업데이트 없이 Coordinator만 업데이트
  dragCoordinator.setPosition(obj.id, e.target.x(), e.target.y())
}

onDragEnd: (e) => {
  // 드래그 끝날 때만 store 업데이트
  updateObject(obj.id, { x: e.target.x(), y: e.target.y() })
  dragCoordinator.clear(obj.id)
}
```

#### 1.3 Connector.tsx 수정 - Coordinator 구독

```typescript
// Connector가 연결된 shape의 드래그 위치를 직접 구독
useEffect(() => {
  if (!connector.sourceId) return

  return dragCoordinator.subscribe(connector.sourceId, (pos) => {
    // Konva node 직접 업데이트 (React 리렌더 없이)
    if (lineRef.current) {
      // 시작점 업데이트
      const points = [...lineRef.current.points()]
      points[0] = pos.x
      points[1] = pos.y
      lineRef.current.points(points)
      lineRef.current.getLayer()?.batchDraw()
    }
  })
}, [connector.sourceId])
```

---

### Phase 2: Zustand Selector 최적화

#### 2.1 store.ts - Selector 함수 추가

```typescript
// 세분화된 selector export
export const useObjects = () => useCanvasStore((s) => s.objects)
export const useSelectedIds = () => useCanvasStore((s) => s.selectedIds)
export const useTool = () => useCanvasStore((s) => s.tool)
export const useViewport = () => useCanvasStore((s) => s.viewport)

// 특정 객체만 구독 (ID로)
export const useObject = (id: string) =>
  useCanvasStore((s) => s.objects.find(o => o.id === id))

// Shallow comparison 사용
import { useShallow } from 'zustand/react/shallow'
export const useSelectedObjects = () =>
  useCanvasStore(useShallow((s) =>
    s.objects.filter(o => s.selectedIds.includes(o.id))
  ))
```

#### 2.2 Canvas.tsx - Selector 적용

```typescript
// Before
const { objects, selectedIds, tool, viewport, ... } = useCanvasStore()

// After - 필요한 것만 개별 구독
const objects = useObjects()
const selectedIds = useSelectedIds()
const tool = useTool()
const viewport = useViewport()
```

---

### Phase 3: Objects Map 캐싱

#### 3.1 Canvas.tsx - objectsById Map 추가

```typescript
// O(1) 객체 조회를 위한 Map
const objectsById = useMemo(() => {
  const map = new Map<string, CanvasObject>()
  objects.forEach(obj => map.set(obj.id, obj))
  return map
}, [objects])

// Connector에 Map 전달 (배열 대신)
<Connector
  connector={connector}
  objectsById={objectsById}  // 안정적인 참조
  sourceObject={objectsById.get(connector.sourceId)}
  targetObject={objectsById.get(connector.targetId)}
/>
```

#### 3.2 Connector.tsx - objects 대신 objectsById 사용

```typescript
interface ConnectorProps {
  connector: CanvasObject
  objectsById: Map<string, CanvasObject>  // 변경
  sourceObject?: CanvasObject
  targetObject?: CanvasObject
  // ...
}
```

---

### Phase 4: findSnapTarget 최적화

#### 4.1 geometry.ts - 공간 인덱싱 추가

```typescript
// 간단한 그리드 기반 공간 인덱스
export class SpatialIndex {
  private cellSize = 100
  private cells = new Map<string, CanvasObject[]>()

  private getCellKey(x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize)
    const cy = Math.floor(y / this.cellSize)
    return `${cx},${cy}`
  }

  rebuild(objects: CanvasObject[]) {
    this.cells.clear()
    objects.forEach(obj => {
      const key = this.getCellKey(obj.x, obj.y)
      if (!this.cells.has(key)) this.cells.set(key, [])
      this.cells.get(key)!.push(obj)
    })
  }

  // 근처 객체만 검색 (O(1) ~ O(k) where k << n)
  getNearby(x: number, y: number): CanvasObject[] {
    const results: CanvasObject[] = []
    // 9개 인접 셀만 검색
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = this.getCellKey(x + dx * this.cellSize, y + dy * this.cellSize)
        const cell = this.cells.get(key)
        if (cell) results.push(...cell)
      }
    }
    return results
  }
}
```

#### 4.2 Canvas.tsx - Spatial Index 사용

```typescript
const spatialIndex = useMemo(() => {
  const index = new SpatialIndex()
  index.rebuild(objects.filter(o => o.type !== 'connector'))
  return index
}, [objects])
```

---

## Acceptance Criteria

### Functional Requirements

- [ ] 드래그 중 Connector가 실시간으로 shape 따라감
- [ ] 드래그 성능이 Figma/React Flow 수준으로 부드러움
- [ ] 기존 기능(선택, 변형, undo/redo) 정상 동작

### Non-Functional Requirements

- [ ] 100개 객체에서 60fps 유지
- [ ] 드래그 시작/종료 시 렌더링 지연 없음
- [ ] 메모리 사용량 증가 최소화

### Quality Gates

- [ ] `npm run build` 성공
- [ ] Chrome DevTools Performance 프로파일링으로 개선 확인
- [ ] React DevTools로 불필요한 리렌더 제거 확인

---

## Implementation Phases

### Phase 1: Drag Coordinator (핵심)
- `useDragCoordinator.ts` 생성
- `Canvas.tsx` shape 드래그 로직 수정
- `Connector.tsx` coordinator 구독 추가

### Phase 2: Zustand Selectors
- `store.ts` selector 함수 추가
- `Canvas.tsx` selector 적용

### Phase 3: Objects Map
- `Canvas.tsx` objectsById Map 추가
- `Connector.tsx` props 변경

### Phase 4: Spatial Index (선택적)
- `geometry.ts` SpatialIndex 클래스 추가
- findSnapTarget 최적화

---

## 파일 변경 요약

### 새 파일
- `src/hooks/useDragCoordinator.ts`

### 수정 파일
- `src/store.ts` - selector 함수 추가
- `src/components/Canvas.tsx` - 드래그 로직, objectsById, selector 적용
- `src/components/shapes/Connector.tsx` - coordinator 구독, props 변경
- `src/utils/geometry.ts` - SpatialIndex (선택적)

---

## References

### External Documentation
- [Konva Performance Tips](https://konvajs.org/docs/performance/All_Performance_Tips.html)
- [React Flow Performance](https://reactflow.dev/learn/advanced-use/performance)
- [Zustand useShallow](https://github.com/pmndrs/zustand)

### Internal References
- `Canvas.tsx:513-515` - 현재 드래그 병목
- `Connector.tsx:79` - 기존 로컬 드래그 패턴 (참고용)
- `store.ts:56-61` - updateObject 구현
