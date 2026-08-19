# API Reference

## Store (Zustand)

### useCanvasStore

메인 상태 관리 스토어입니다.

```typescript
import { useCanvasStore } from '@/store'

const {
  // State
  objects,
  selectedIds,
  tool,
  viewport,
  // Actions
  addObject,
  updateObject,
  deleteSelected,
  setSelectedIds,
  setTool,
  // ...
} = useCanvasStore()
```

### State

| 필드 | 타입 | 설명 |
|------|------|------|
| `objects` | `CanvasObject[]` | 모든 캔버스 객체 |
| `selectedIds` | `string[]` | 선택된 객체 ID |
| `tool` | `Tool` | 현재 도구 |
| `viewport` | `{ x, y, zoom }` | 뷰포트 상태 |
| `canvasBounds` | `CanvasBounds` | 캔버스 경계 |
| `penSettings` | `PenSettings` | 펜 설정 |
| `shapeSettings` | `ShapeSettings` | 도형 설정 |
| `editingTextId` | `string \| null` | 편집 중인 텍스트 ID |
| `isLocked` | `boolean` | 화면 잠금 상태 |
| `captions` | `CaptionThread[]` | 댓글 목록 |
| `clipboard` | `CanvasObject[]` | 클립보드 |
| `hideCaptions` | `boolean` | 댓글 숨김 |
| `hideUI` | `boolean` | UI 숨김 |
| `lastMousePosition` | `{ x, y }` | 마지막 마우스 위치 |

### Actions

#### Object Management

```typescript
// 객체 추가
addObject(object: CanvasObject): void

// 객체 업데이트
updateObject(id: string, updates: Partial<CanvasObject>): void

// 선택된 객체 삭제
deleteSelected(): void

// 특정 객체들 삭제
deleteObjects(ids: string[]): void

// 모든 객체 초기화
clearAllObjects(): void
```

#### Selection

```typescript
// 선택 설정
setSelectedIds(ids: string[]): void

// 선택에 추가
addToSelection(id: string): void

// 선택 해제
clearSelection(): void
```

#### Clipboard & Z-order

```typescript
// 복사
copyObjects(): void

// 붙여넣기 (지정 위치)
pasteObjects(x: number, y: number): void

// 붙여넣어 교체
pasteAndReplace(x: number, y: number): void

// 맨 앞으로
bringToFront(): void

// 맨 뒤로
sendToBack(): void
```

#### Lock

```typescript
// 선택 객체 잠금
lockObjects(): void

// 선택 객체 잠금 해제
unlockObjects(): void

// 모든 객체 잠금 해제
unlockAllObjects(): void
```

#### Viewport

```typescript
// 뷰포트 설정
setViewport(viewport: Partial<Viewport>): void

// 뷰포트 리셋
resetViewport(): void
```

### Undo/Redo

```typescript
import { undo, redo } from '@/store'

undo()  // Cmd+Z
redo()  // Cmd+Shift+Z
```

---

## Components

### Canvas

메인 캔버스 컴포넌트입니다.

```tsx
import { Canvas } from '@/components/Canvas'

<Canvas />
```

내부적으로 Konva Stage, Layer, 모든 Shape 컴포넌트를 렌더링합니다.

### Shape Components

모든 Shape 컴포넌트는 동일한 props 인터페이스를 따릅니다:

```typescript
interface ShapeProps {
  shape: CanvasObject
  isSelected: boolean
  draggable?: boolean          // 기본 true
  onSelect: (e: KonvaEvent) => void
  onDragStart?: (e: KonvaEvent) => void
  onDragMove?: (e: KonvaEvent) => void
  onDragEnd: (e: KonvaEvent) => void
  onDoubleClick?: () => void   // 텍스트 편집 진입
  isEditing?: boolean          // 텍스트 편집 중
}
```

#### Rectangle

```tsx
import { Rectangle } from '@/components/shapes/Rectangle'

<Rectangle
  shape={obj}
  isSelected={selectedIds.includes(obj.id)}
  onSelect={(e) => handleSelect(obj.id, e)}
  onDragEnd={(e) => handleDragEnd(obj.id, e)}
  onDoubleClick={() => setEditingTextId(obj.id)}
  isEditing={editingTextId === obj.id}
/>
```

#### Circle

```tsx
import { Circle } from '@/components/shapes/Circle'
// Rectangle과 동일한 props
```

#### Shape (통합 도형)

다양한 ShapeVariant를 렌더링합니다.

```tsx
import { Shape, getShapePath } from '@/components/shapes/Shape'

<Shape
  shape={obj}  // obj.shapeVariant로 도형 종류 결정
  // ... 기타 props
/>

// 미리보기용 경로 생성
const path = getShapePath('triangle', 100, 100)  // [50, 0, 100, 100, 0, 100]
```

#### StickyNote

```tsx
import { StickyNote } from '@/components/shapes/StickyNote'
// Rectangle과 동일한 props
// shape.backgroundColor로 배경색 설정
// shape.authorName으로 작성자 표시
```

#### TextBox

```tsx
import { TextBox } from '@/components/shapes/TextBox'

<TextBox
  shape={obj}
  // ... 기타 props
  onHeightChange={(newHeight) => updateObject(obj.id, { height: newHeight })}
/>
```

#### Connector

```tsx
import { Connector } from '@/components/shapes/Connector'

<Connector
  connector={obj}
  objectsById={objectsById}  // O(1) 조회용 Map
  sourceObject={sourceObj}   // 연결된 시작 도형
  targetObject={targetObj}   // 연결된 끝 도형
  isSelected={isSelected}
  zoom={viewport.zoom}
  onSelect={(e) => handleSelect(obj.id, e)}
  onUpdate={(updates) => updateObject(obj.id, updates)}
/>
```

#### Line

```tsx
import { Line } from '@/components/shapes/Line'

<Line
  shape={obj}
  isSelected={isSelected}
  draggable={!obj.locked}
  onSelect={(e) => handleSelect(obj.id, e)}
  onDragEnd={(e) => handleDragEnd(obj.id, e)}
/>
```

### ContextMenu

```tsx
import { ContextMenu } from '@/components/ContextMenu'

<ContextMenu
  x={screenX}           // 화면 좌표
  y={screenY}
  canvasPosition={{ x: canvasX, y: canvasY }}  // 캔버스 좌표
  hasSelection={selectedIds.length > 0}
  onClose={() => setContextMenu(null)}
/>
```

---

## Hooks

### useKeyboardShortcuts

전역 키보드 단축키를 처리합니다.

```typescript
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

// App.tsx에서 한 번만 호출
function App() {
  useKeyboardShortcuts()
  return <Canvas />
}
```

### useDragCoordinator

드래그 성능 최적화를 위한 coordinator입니다.

```typescript
import { dragCoordinator } from '@/hooks/useDragCoordinator'

// 위치 업데이트 (React state 없이)
dragCoordinator.setPosition(id, x, y)

// 구독 (Connector에서 source shape 드래그 감지)
const unsubscribe = dragCoordinator.subscribe(id, (pos) => {
  // pos: { x, y }
})

// 드래그 종료
dragCoordinator.clear(id)
```

### useAutoSave

히스토리 관리 및 자동 저장

```typescript
import { useHistoryStore } from '@/hooks/useAutoSave'

const { history, addSnapshot, restoreFromHistory, clearHistory } = useHistoryStore()

// 수동 저장
addSnapshot(objects, '수동 저장')

// 복원
restoreFromHistory(index)
```

---

## Utilities

### factory.ts

객체 생성 함수들입니다.

```typescript
import {
  createRectangle,
  createCircle,
  createStickyNote,
  createTextBox,
  createLine,
  createArrow,
  createShape,
  cloneShape,
  snapToGrid,
  snapToShapeGrid,
  GRID_SIZE,
  SHAPE_GRID_SIZE,
} from '@/utils/factory'

// 도형 생성
const rect = createRectangle(x, y, shapeSettings, author?)
const circle = createCircle(x, y, shapeSettings, author?)
const sticky = createStickyNote(x, y, backgroundColor?, author?)
const textbox = createTextBox(x, y, author?)
const shape = createShape(x, y, variant, shapeSettings, author?)

// 드로잉 생성
const line = createLine(x, y, points, penSettings)

// 커넥터 생성
const arrow = createArrow(startX, startY, endX, endY, options?)

// 복제
const cloned = cloneShape(obj, { x: offsetX, y: offsetY })

// 그리드 스냅
const snapped = snapToGrid(value)  // 10px 단위
const shapesnapped = snapToShapeGrid(value)  // 3px 단위
```

### geometry.ts

기하학 계산 함수들입니다.

```typescript
import {
  getObjectBounds,
  rectsIntersect,
  normalizeRect,
  getObjectCenter,
  getAnchorPoint,
  findClosestAnchor,
  findSnapTarget,
  SNAP_THRESHOLD,
} from '@/utils/geometry'

// 바운딩 박스
const bounds = getObjectBounds(obj)  // { x, y, width, height }

// 교차 검사
const intersects = rectsIntersect(boundsA, boundsB)

// 선택 영역 정규화
const normalized = normalizeRect(startX, startY, endX, endY)

// 중심점
const center = getObjectCenter(obj)  // { x, y }

// 앵커 포인트
const point = getAnchorPoint(obj, 'top')  // { x, y }

// 가장 가까운 앵커
const anchor = findClosestAnchor(obj, point)  // 'top' | 'right' | ...

// 스냅 대상 검색
const target = findSnapTarget(point, objects, excludeIds?)
// { object, anchor, point, distance, offsetX, offsetY }
```

### richText.ts

리치 텍스트 유틸리티입니다.

```typescript
import {
  textToRichText,
  richTextToPlainText,
  LINE_HEIGHT,
} from '@/utils/richText'

// 평문 → 리치텍스트
const richText = textToRichText('Hello World')
// [{ text: 'Hello World' }]

// 리치텍스트 → 평문
const plain = richTextToPlainText(richText)
// 'Hello World'

// 줄 높이 상수
const lineHeight = fontSize * LINE_HEIGHT  // 1.5
```

---

## File I/O Modules (2026-08)

### utils/pigmaFile

```typescript
// 순수 변환
buildPigmaFile(input): PigmaFile          // 프로젝트 → .pigma (현재 페이지 라이브 상태 동기화)
parsePigmaFile(json: string): PigmaFile   // 검증 포함, 실패 시 PigmaFileError

// store 연동
exportCurrentProject(): PigmaFile
applyPigmaFile(file): { backedUp: boolean }  // 프로젝트 교체 + 자동 백업 + undo 초기화
getBackupInfo(): PigmaBackupInfo | null
restoreBackup(): PigmaFile                // 현재 ↔ 백업 스왑 (재복원 가능)
downloadPigmaFile(file, filename?)
readPigmaFile(blob: File): Promise<PigmaFile>
```

### src/excalidraw

```typescript
parseExcalidrawFile(json: string): ExcalidrawData     // 실패 시 ExcalidrawImportError
convertExcalidraw(data): { objects, groups, skippedCount }      // → pig-ma (순수)
convertToExcalidraw(objects, groups, options?): ExcalidrawExportResult  // ← pig-ma (순수)
//   options.rasterize?: (obj) => string | null — chart/codeBlock/table/embed PNG 캡처 주입
importExcalidrawToCanvas(json): ExcalidrawImportSummary  // 뷰포트 중앙 배치 + store 추가
exportCanvasToExcalidraw(): ExcalidrawExportResult        // Konva.stages[0] 래스터라이저 사용
downloadExcalidrawFile(data, filename?)
extractPlainText(tiptapContent): string
```

### src/mermaid

```typescript
parseMermaid(source: string): MermaidGraph   // flowchart 서브셋, 실패 시 MermaidImportError
layoutGraph(graph): Map<string, NodeLayout>  // Kahn 위상정렬 레이어드 배치
convertMermaid(graph): { objects }           // flow variant shape + attached connector
importMermaidToCanvas(source): { nodeCount, edgeCount }
```

### utils/align

```typescript
alignObjects(objects, direction): ObjectUpdate[]       // "left"|"centerX"|"right"|"top"|"centerY"|"bottom"
distributeObjects(objects, direction): ObjectUpdate[]  // "horizontal"|"vertical", 3개 미만이면 []
isAlignable(obj): boolean  // 잠긴 객체·attached 커넥터 제외
// 커넥터는 endX/endY + elbowBends(절대좌표)까지 강체 이동
```

## Types

### CanvasObject

```typescript
interface CanvasObject {
  id: string
  type: ObjectType
  x: number
  y: number
  rotation: number
  opacity: number

  // Shape
  width?: number
  height?: number
  radius?: number
  fill?: string
  fillMode?: 'fill' | 'transparent' | 'nofill'
  stroke?: string
  strokeWidth?: number
  shapeVariant?: ShapeVariant
  lineStyle?: LineStyle

  // Text
  text?: string
  richText?: TextSegment[]
  lineIndents?: number[]
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  fontFamily?: FontFamily
  textAlign?: TextAlign
  textColor?: string
  textDecoration?: 'none' | 'line-through'
  listType?: ListType
  indentLevel?: number
  link?: string

  // StickyNote
  backgroundColor?: string
  authorId?: string
  authorName?: string

  // Line
  points?: number[]
  penType?: PenType

  // Connector
  endX?: number
  endY?: number
  sourceId?: string
  targetId?: string
  sourceAnchor?: AnchorPosition
  targetAnchor?: AnchorPosition
  sourceOffsetX?: number
  sourceOffsetY?: number
  targetOffsetX?: number
  targetOffsetY?: number
  startMarker?: MarkerStyle
  endMarker?: MarkerStyle
  pathStyle?: PathStyle
  label?: string

  // Image
  src?: string

  // Lock
  locked?: boolean
}
```

### Type Aliases

```typescript
type ObjectType = 'rectangle' | 'circle' | 'image' | 'line' | 'stickyNote' | 'connector' | 'textBox' | 'shape'

type Tool = 'select' | 'hand' | 'rectangle' | 'circle' | 'image' | 'pencil' | 'eraser' | 'stickyNote' | 'connector' | 'textBox' | 'shape'

type ShapeVariant = 'rectangle' | 'roundedRect' | 'circle' | 'ellipse' | 'triangle' | 'diamond' | ... | 'flowDatabase' | ...

type PenType = 'pen' | 'marker' | 'highlighter'

type MarkerStyle = 'none' | 'arrow' | 'filledArrow' | 'diamond' | 'circle'

type LineStyle = 'solid' | 'dashed' | 'dotted'

type PathStyle = 'straight' | 'curved' | 'elbowed'

type FontFamily = 'Pretendard' | 'Noto Sans KR' | 'Nanum Gothic' | 'Nanum Myeongjo' | 'IBM Plex Sans KR'

type TextAlign = 'left' | 'center' | 'right'

type ListType = 'none' | 'number' | 'bullet'
```
