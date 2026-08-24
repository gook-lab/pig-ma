# 아키텍처 (Architecture)

## 개요 (Overview)

Pig-ma는 React-Konva 기반의 무한 캔버스 라이브러리입니다. Figma/FigJam의 UX를 참고해서 설계했습니다.

핵심 구조를 한 장으로 그리면 이렇습니다 — 텍스트를 두 엔진(보기: Konva /
편집: Tiptap)으로 그리고, 두 경로가 `src/constants`의 같은 값을 import 하는
게 이 라이브러리의 뼈대입니다:

<img src="diagrams/text-render-flow.png" width="620" alt="pig-ma 구조 — store를 중심으로 Konva 보기 경로와 Tiptap 편집 경로가 같은 상수를 공유합니다">

> 이 다이어그램은 pig-ma 자신의 Mermaid import로 그렸습니다 (도그푸딩).
> 원본 정의는 [`diagrams/text-render-flow.mmd`](diagrams/text-render-flow.mmd).

## 핵심 개념 (Core Concepts)

### 1. Flat Object Model

모든 캔버스 객체는 단일 `CanvasObject` 인터페이스를 사용합니다. 타입별 상속 대신 optional 필드로 구분하고 있습니다.

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

**장점이 많습니다:**
- 단순한 직렬화/역직렬화
- 상태 관리가 쉽습니다
- 유연하게 확장 가능합니다

### 2. Layer System

Canvas는 4개의 Konva Layer로 이루어져 있습니다:

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

**Z-order 동작:**
- `objects` 배열의 순서가 그대로 렌더링 순서입니다
- `bringToFront()`: 배열 끝으로 이동시킵니다
- `sendToBack()`: 배열 앞으로 이동시킵니다
- 커넥터도 일반 객체와 같은 레이어에서 렌더링됩니다 (Z-order 존중)

### 3. Viewport System

무한 캔버스는 viewport 변환으로 구현되어 있습니다:

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

**줌 동작이 Figma 스타일입니다:**
- `Cmd + 스크롤`: 줌 인/아웃
- `스크롤만`: 패닝 (2배속)

### 4. State Management

Zustand + zundo + persist 조합을 사용하고 있습니다:

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

**Undo/Redo 동작:**
- `equality` 함수로 의미 있는 변경만 히스토리에 저장합니다
- 미세한 위치 변경 (< 1px), 높이 변경 (< 5px) 무시합니다
- ID 추가/삭제, 텍스트 변경 같은 건 저장됩니다

### 5. Drag Coordinator

드래그 성능 최적화를 위한 React state 우회 패턴이 있어요:

```typescript
// 드래그 중에는 store 업데이트 없이 Konva를 직접 업데이트합니다
onDragMove: (e) => {
  dragCoordinator.setPosition(obj.id, e.target.x(), e.target.y())
}

// 드래그 끝날 때만 store 업데이트합니다
onDragEnd: (e) => {
  dragCoordinator.clear(obj.id)
  updateObject(obj.id, { x: e.target.x(), y: e.target.y() })
}

// Connector가 shape 드래그를 구독하면서 실시간으로 따라갑니다
useEffect(() => {
  if (!connector.sourceId) return
  return dragCoordinator.subscribe(connector.sourceId, (pos) => {
    setLiveSourcePos(pos)  // Konva 노드 직접 업데이트합니다
  })
}, [connector.sourceId])
```

### 6. Grid Virtualization

줌 레벨에 따라 적응형 그리드를 구현했습니다:

```typescript
// 화면 공간 기준 일정 밀도 유지 (약 20px 간격)
const targetScreenGap = 20
const rawGap = targetScreenGap / viewport.zoom
const gap = Math.min(500, Math.max(10, Math.round(rawGap / 10) * 10))
```

**줌별 그리드 간격:**
| 줌 레벨 | 캔버스 간격 | 화면 간격 |
|---------|-------------|-----------|
| 0.1x | 200px | 20px |
| 1x | 20px | 20px |
| 10x | 10px | 100px |

## 성능 최적화 (Performance Optimizations)

### 1. React.memo

모든 Shape 컴포넌트를 `memo()`로 래핑했습니다:

```typescript
export const Rectangle = memo(function Rectangle({ ... }) {
  // ...
})
```

### 2. useMemo for Filtering

객체 타입별 필터링 결과를 캐싱합니다:

```typescript
const lineObjects = useMemo(
  () => objects.filter((obj) => obj.type === 'line'),
  [objects]
)
```

### 3. objectsById Map

O(1) 객체 조회를 위해 Map을 사용합니다:

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
  perfectDrawEnabled={false}      // 안티앨리어싱 비용을 줄입니다
  shadowForStrokeEnabled={false}  // 그림자 계산을 비활성화합니다
  listening={false}               // 이벤트가 불필요할 때 사용합니다
/>
```

## 컴포넌트 통신 (Component Communication)

### Props는 아래로, 이벤트는 위로 (Props Down, Events Up)

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

### Store를 단일 진실 공급원으로 (Store as Single Source of Truth)

- 모든 상태를 Zustand store에서 관리합니다
- 컴포넌트는 필요한 상태만 구독합니다
- 로컬 UI 상태 (hover, editing 등)만 컴포넌트 state를 사용합니다

## 이벤트 흐름 (Event Flow)

### 마우스 이벤트 (Mouse Events)

```
Stage.onMouseDown
  → 도구별로 핸들링을 분기합니다
  → select: 마키 선택을 시작합니다
  → pencil: 드로잉을 시작합니다
  → connector: 화살표를 시작합니다
  → shape tools: 객체를 생성합니다

Stage.onMouseMove
  → 마키를 업데이트합니다
  → 드로잉 포인트를 추가합니다
  → 화살표 엔드포인트를 업데이트합니다
  → 마우스 위치를 저장합니다 (붙여넣기용)

Stage.onMouseUp
  → 마키 선택을 완료합니다
  → 드로잉 완료 → 객체를 생성합니다
  → 화살표 완료 → 커넥터를 생성합니다
```

### 키보드 이벤트 (Keyboard Events)

```
useKeyboardShortcuts hook
  → 도구 단축키를 처리합니다 (V, H, P, R, S, L, T, C)
  → 편집 단축키를 처리합니다 (Cmd+Z, Cmd+Shift+Z, Cmd+C, Cmd+V)
  → 조작 단축키를 처리합니다 (], [, Cmd+L)
  → 이동 단축키를 처리합니다 (Arrow keys)
```

## File I/O & 포맷 변환 모듈 (2026-08)

캔버스 상태와 외부 포맷 사이의 변환은 전부 **순수 변환 함수 + 얇은 store 적용부**로 분리해 뒀습니다. 새 포맷을 추가할 때 이 구조를 따르는 것이 좋습니다.

| 모듈 | 방향 | 핵심 함수 | 비고 |
|------|------|----------|------|
| `utils/pigmaFile.ts` | 저장/열기 | `buildPigmaFile` / `parsePigmaFile` (순수) + `applyPigmaFile` (store) | 프로젝트 전체(pages[]) 직렬화. 열기 시 localStorage 자동 백업 → `restoreBackup()` 스왑 복원 |
| `src/excalidraw/` | 양방향 | `convertExcalidraw` / `convertToExcalidraw` (순수) + `importExcalidrawToCanvas` | 바인딩↔sourceId, frame↔customBounds 그룹. export 시 chart/codeBlock/table/embed 는 `Konva.stages[0]` 래스터화 |
| `src/mermaid/` | import | `parseMermaid` → `layoutGraph` → `convertMermaid` | flowchart 서브셋 자체 파서 + Kahn 위상정렬 레이아웃. 외부 의존성 없음 |
| `src/figma/` | 양방향 | `figmaToPigma` / `pigmaToFigma` | REST API(PAT). characterStyleOverrides ↔ Tiptap, 폰트 실측 매핑 |

공통 규칙을 정리했습니다:
- 변환 함수는 순수 함수입니다(store 접근 금지) — 유닛 테스트는 변환 함수를 대상으로 합니다
- import 는 **기존 캔버스에 추가**됩니다 + 뷰포트 중앙 배치. 열기(.pigma)만 **교체됩니다(confirm + 자동 백업)
- UI 진입점은 `FileMenu.tsx` (숨김 input) + `useImageDrop.ts` (드래그&드롭 확장자 분기)입니다
- 사용자 피드백은 `utils/toast`를 사용합니다 (성공 시 개수 포함, alert는 금지)

## 확장 포인트 (Extension Points)

### 새 도형 타입 추가할 때

1. `types.ts`에서 `ObjectType`에 타입을 추가합니다
2. `utils/factory.ts`에 생성 함수를 작성합니다
3. `components/shapes/`에 컴포넌트를 생성합니다
4. `Canvas.tsx`에 switch case를 추가합니다

### 새 도구 추가할 때

1. `types.ts`에 `Tool` 타입을 추가합니다
2. `Toolbar.tsx`에 버튼을 추가합니다
3. `Canvas.tsx`에 마우스 이벤트 핸들러를 추가합니다
4. `useKeyboardShortcuts.ts`에 단축키를 추가합니다 (선택사항)
