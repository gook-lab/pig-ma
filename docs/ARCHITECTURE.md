# Architecture

## Overview

Pig-ma는 React-Konva 기반의 무한 캔버스 라이브러리입니다. Figma/FigJam의 UX를 참고하여 설계되었습니다.

## Core Concepts

### 1. Flat Object Model

모든 캔버스 객체는 단일 `CanvasObject` 인터페이스를 사용합니다. 타입별 상속 대신 optional 필드로 구분합니다.

```typescript
interface CanvasObject {
  id: string
  type: ObjectType  // 'rectangle' | 'circle' | 'connector' | ...
  x: number
  y: number
  rotation: number
  opacity: number

  // Type-specific optional fields
  width?: number
  height?: number
  radius?: number     // circle
  points?: number[]   // line
  sourceId?: string   // connector
  // ...
}
```

**장점:**
- 단순한 직렬화/역직렬화
- 쉬운 상태 관리
- 유연한 확장성

### 2. Layer System

Canvas는 4개의 Konva Layer로 구성됩니다:

```
┌─────────────────────────────────────┐
│  Layer 4: Drawing Layer             │  ← 펜슬, 미리보기, 선택 사각형
├─────────────────────────────────────┤
│  Layer 3: Connectors Layer          │  ← 연결 핸들, 호버 포인트
├─────────────────────────────────────┤
│  Layer 2: Objects Layer             │  ← 도형, 커넥터 (Z-order 존중)
├─────────────────────────────────────┤
│  Layer 1: Grid Layer                │  ← 배경 그리드 도트
└─────────────────────────────────────┘
```

**Z-order:**
- `objects` 배열의 순서가 렌더링 순서
- `bringToFront()`: 배열 끝으로 이동
- `sendToBack()`: 배열 앞으로 이동
- 커넥터도 일반 객체와 같은 레이어에서 렌더링 (Z-order 존중)

### 3. Viewport System

무한 캔버스는 viewport 변환으로 구현됩니다:

```typescript
interface Viewport {
  x: number      // 패닝 offset
  y: number
  zoom: number   // 줌 레벨 (0.1 ~ 10)
}
```

**좌표 변환:**
```typescript
// 화면 좌표 → 캔버스 좌표
const canvasX = (screenX - viewport.x) / viewport.zoom
const canvasY = (screenY - viewport.y) / viewport.zoom

// 캔버스 좌표 → 화면 좌표
const screenX = canvasX * viewport.zoom + viewport.x
const screenY = canvasY * viewport.zoom + viewport.y
```

**줌 동작 (Figma 스타일):**
- `Cmd + 스크롤`: 줌 인/아웃
- `스크롤만`: 패닝 (2배속)

### 4. State Management

Zustand + zundo + persist 조합 사용:

```typescript
const useCanvasStore = create(
  temporal(           // undo/redo
    persist(          // localStorage
      (set) => ({
        objects: [],
        selectedIds: [],
        viewport: { x: 0, y: 0, zoom: 3 },
        // ...
      })
    )
  )
)
```

**Undo/Redo:**
- `equality` 함수로 의미있는 변경만 히스토리에 저장
- 미세한 위치 변경 (< 1px), 높이 변경 (< 5px) 무시
- ID 추가/삭제, 텍스트 변경 등은 저장

### 5. Drag Coordinator

드래그 성능 최적화를 위한 React state 우회 패턴:

```typescript
// 드래그 중에는 store 업데이트 없이 Konva 직접 업데이트
onDragMove: (e) => {
  dragCoordinator.setPosition(obj.id, e.target.x(), e.target.y())
}

// 드래그 끝날 때만 store 업데이트
onDragEnd: (e) => {
  dragCoordinator.clear(obj.id)
  updateObject(obj.id, { x: e.target.x(), y: e.target.y() })
}

// Connector가 shape 드래그를 구독하여 실시간 따라감
useEffect(() => {
  if (!connector.sourceId) return
  return dragCoordinator.subscribe(connector.sourceId, (pos) => {
    setLiveSourcePos(pos)  // Konva 노드 직접 업데이트
  })
}, [connector.sourceId])
```

### 6. Grid Virtualization

줌 레벨에 따른 적응형 그리드:

```typescript
// 화면 공간 기준 일정 밀도 유지 (약 20px 간격)
const targetScreenGap = 20
const rawGap = targetScreenGap / viewport.zoom
const gap = Math.min(500, Math.max(10, Math.round(rawGap / 10) * 10))
```

**줌별 그리드:**
| 줌 레벨 | 캔버스 간격 | 화면 간격 |
|---------|-------------|-----------|
| 0.1x | 200px | 20px |
| 1x | 20px | 20px |
| 10x | 10px | 100px |

## Performance Optimizations

### 1. React.memo

모든 Shape 컴포넌트는 `memo()` 래핑:

```typescript
export const Rectangle = memo(function Rectangle({ ... }) {
  // ...
})
```

### 2. useMemo for Filtering

객체 타입별 필터링 결과 캐싱:

```typescript
const lineObjects = useMemo(
  () => objects.filter((obj) => obj.type === 'line'),
  [objects]
)
```

### 3. objectsById Map

O(1) 객체 조회:

```typescript
const objectsById = useMemo(() => {
  const map = new Map<string, CanvasObject>()
  objects.forEach((obj) => map.set(obj.id, obj))
  return map
}, [objects])
```

### 4. Konva Performance Props

```typescript
<Rect
  perfectDrawEnabled={false}      // 안티앨리어싱 비용 절감
  shadowForStrokeEnabled={false}  // 그림자 계산 비활성화
  listening={false}               // 이벤트 불필요 시
/>
```

## Component Communication

### Props Down, Events Up

```
App
 └─ Canvas
     ├─ Toolbar (도구 선택, 설정)
     ├─ Objects Layer
     │   ├─ Rectangle
     │   ├─ Circle
     │   ├─ Connector
     │   └─ ...
     ├─ ContextMenu
     └─ TextBoxEditor
```

### Store as Single Source of Truth

- 모든 상태는 Zustand store에서 관리
- 컴포넌트는 필요한 상태만 구독
- 로컬 UI 상태 (hover, editing 등)만 컴포넌트 state 사용

## Event Flow

### Mouse Events

```
Stage.onMouseDown
  → 도구별 핸들링 분기
  → select: 마키 선택 시작
  → pencil: 드로잉 시작
  → connector: 화살표 시작
  → shape tools: 객체 생성

Stage.onMouseMove
  → 마키 업데이트
  → 드로잉 포인트 추가
  → 화살표 엔드포인트 업데이트
  → 마우스 위치 저장 (붙여넣기용)

Stage.onMouseUp
  → 마키 선택 완료
  → 드로잉 완료 → 객체 생성
  → 화살표 완료 → 커넥터 생성
```

### Keyboard Events

```
useKeyboardShortcuts hook
  → 도구 단축키 (V, H, P, R, S, L, T, C)
  → 편집 단축키 (Cmd+Z, Cmd+Shift+Z, Cmd+C, Cmd+V)
  → 조작 단축키 (], [, Cmd+L)
  → 이동 단축키 (Arrow keys)
```

## File I/O & 포맷 변환 모듈 (2026-08)

캔버스 상태와 외부 포맷 사이의 변환은 전부 **순수 변환 함수 + 얇은 store 적용부**로
분리되어 있다. 새 포맷을 추가할 때 이 구조를 따른다.

| 모듈 | 방향 | 핵심 함수 | 비고 |
|------|------|----------|------|
| `utils/pigmaFile.ts` | 저장/열기 | `buildPigmaFile` / `parsePigmaFile` (순수) + `applyPigmaFile` (store) | 프로젝트 전체(pages[]) 직렬화. 열기 시 localStorage 자동 백업 → `restoreBackup()` 스왑 복원 |
| `src/excalidraw/` | 양방향 | `convertExcalidraw` / `convertToExcalidraw` (순수) + `importExcalidrawToCanvas` | 바인딩↔sourceId, frame↔customBounds 그룹. export 시 chart/codeBlock/table/embed 는 `Konva.stages[0]` 래스터화 |
| `src/mermaid/` | import | `parseMermaid` → `layoutGraph` → `convertMermaid` | flowchart 서브셋 자체 파서 + Kahn 위상정렬 레이아웃. 외부 의존성 없음 |
| `src/figma/` | 양방향 | `figmaToPigma` / `pigmaToFigma` | REST API(PAT). characterStyleOverrides ↔ Tiptap, 폰트 실측 매핑 |

공통 규칙:
- 변환 함수는 순수(store 접근 금지) — 유닛 테스트는 변환 함수 대상
- import 는 **기존 캔버스에 추가** + 뷰포트 중앙 배치, 열기(.pigma)만 **교체**(confirm + 자동 백업)
- UI 진입점은 `FileMenu.tsx` (숨김 input) + `useImageDrop.ts` (드래그&드롭 확장자 분기)
- 사용자 피드백은 `utils/toast` (성공 시 개수 포함, alert 금지)

## Extension Points

### 새 도형 타입 추가

1. `types.ts`: `ObjectType`에 타입 추가
2. `utils/factory.ts`: 생성 함수 작성
3. `components/shapes/`: 컴포넌트 생성
4. `Canvas.tsx`: switch case 추가

### 새 도구 추가

1. `types.ts`: `Tool`에 타입 추가
2. `Toolbar.tsx`: 버튼 추가
3. `Canvas.tsx`: 마우스 이벤트 핸들러 추가
4. `useKeyboardShortcuts.ts`: 단축키 추가 (선택)
