# 타입 레퍼런스

`pig-ma`가 공개하는 주요 TypeScript 타입을 정리합니다. 실제 선언의 기준은
`src/types.ts`와 패키지에서 생성되는 `dist/index.d.ts`입니다.

## 핵심 타입

### ObjectType

캔버스에 배치할 수 있는 객체 타입들입니다.

```typescript
type ObjectType =
  | 'rectangle'   // 사각형
  | 'circle'      // 원
  | 'image'       // 이미지
  | 'line'        // 펜슬 드로잉
  | 'stickyNote'  // 메모지
  | 'connector'   // 연결선/화살표
  | 'textBox'     // 텍스트 박스
  | 'shape'       // 통합 도형 (ShapeVariant로 구분)
```

### Tool

사용 가능한 도구 타입들입니다.

```typescript
type Tool =
  | 'select'      // V - 선택 도구
  | 'hand'        // H - 패닝 도구
  | 'rectangle'   // 사각형 생성 (레거시)
  | 'circle'      // 원 생성 (레거시)
  | 'image'       // 이미지 추가
  | 'pencil'      // P - 드로잉
  | 'eraser'      // E - 지우개
  | 'stickyNote'  // S - 메모지
  | 'connector'   // L - 연결선
  | 'textBox'     // T - 텍스트
  | 'shape'       // R - 도형 (패널에서 선택)
```

### ShapeVariant

Shape 타입의 세부 도형 종류들입니다.

```typescript
type ShapeVariant =
  // Basic shapes
  | 'rectangle'      // 사각형
  | 'roundedRect'    // 둥근 사각형
  | 'circle'         // 원
  | 'ellipse'        // 타원
  | 'triangle'       // 삼각형 (위)
  | 'triangleDown'   // 삼각형 (아래)
  | 'diamond'        // 다이아몬드
  | 'pentagon'       // 오각형
  | 'hexagon'        // 육각형
  | 'octagon'        // 팔각형
  | 'star'           // 별 (5각)
  | 'star4'          // 별 (4각)
  | 'cross'          // 십자가
  | 'arrowRight'     // 화살표 (오른쪽)
  | 'arrowLeft'      // 화살표 (왼쪽)
  | 'arrowUp'        // 화살표 (위)
  | 'arrowDown'      // 화살표 (아래)
  | 'chevronRight'   // 쉐브론 (오른쪽)
  | 'chevronLeft'    // 쉐브론 (왼쪽)
  | 'speechBubble'   // 말풍선
  // Flowchart shapes
  | 'flowProcess'       // 프로세스 (사각형)
  | 'flowDecision'      // 결정 (다이아몬드)
  | 'flowTerminal'      // 시작/종료 (둥근 사각형)
  | 'flowData'          // 데이터 (평행사변형)
  | 'flowDocument'      // 문서
  | 'flowDatabase'      // 데이터베이스 (실린더)
  | 'flowPredefined'    // 사전 정의 프로세스
  | 'flowManualInput'   // 수동 입력 (사다리꼴)
  | 'flowPreparation'   // 준비 (육각형)
  | 'flowDelay'         // 지연 (D 모양)
  | 'flowOr'            // OR (십자 원)
  | 'flowSumming'       // 합계 (X 원)
```

---

## 객체 인터페이스

### CanvasObject

모든 캔버스 객체를 위한 통합 인터페이스입니다.

```typescript
interface CanvasObject {
  // === 필수 필드 ===
  id: string              // 고유 ID (nanoid)
  type: ObjectType        // 객체 타입
  x: number               // 좌상단 X 좌표
  y: number               // 좌상단 Y 좌표
  rotation: number        // 회전 각도 (degrees)
  opacity: number         // 투명도 (0-1)

  // === 도형 공통 ===
  width?: number          // 너비
  height?: number         // 높이
  radius?: number         // 반지름 (circle)
  fill?: string           // 채우기 색상
  fillMode?: 'fill' | 'transparent' | 'nofill'
  stroke?: string         // 테두리 색상
  strokeWidth?: number    // 테두리 두께
  lineStyle?: LineStyle   // 테두리 스타일
  shapeVariant?: ShapeVariant  // 도형 종류 (type='shape')

  // === 텍스트 관련 ===
  text?: string                    // 평문 텍스트
  richText?: TextSegment[]         // 리치 텍스트 (우선)
  lineIndents?: number[]           // 줄별 들여쓰기
  fontSize?: number                // 폰트 크기 (px)
  fontWeight?: 'normal' | 'bold'
  fontFamily?: FontFamily
  fontSizePreset?: FontSize        // S/M/L/XL/XXL
  textAlign?: TextAlign
  textColor?: string
  textDecoration?: 'none' | 'line-through'
  listType?: ListType
  indentLevel?: number
  link?: string

  // === StickyNote 전용 ===
  backgroundColor?: string  // 메모지 배경색
  authorId?: string         // 작성자 ID
  authorName?: string       // 작성자 이름

  // === Line (펜슬) 전용 ===
  points?: number[]         // 상대 좌표 배열 [dx1, dy1, dx2, dy2, ...]
  penType?: PenType

  // === Image 전용 ===
  src?: string              // 이미지 소스 (base64 or URL)

  // === Connector 전용 ===
  endX?: number             // 끝점 X (x, y가 시작점)
  endY?: number             // 끝점 Y
  sourceId?: string         // 연결된 시작 도형 ID
  targetId?: string         // 연결된 끝 도형 ID
  sourceAnchor?: AnchorPosition
  targetAnchor?: AnchorPosition
  sourceAngle?: number      // 원 연결 시 각도 (radians)
  targetAngle?: number
  sourceOffsetX?: number    // 도형 기준 상대 offset
  sourceOffsetY?: number
  targetOffsetX?: number
  targetOffsetY?: number
  startMarker?: MarkerStyle // 시작점 마커
  endMarker?: MarkerStyle   // 끝점 마커
  pathStyle?: PathStyle     // 경로 스타일
  label?: string            // 레이블 텍스트

  // === 상태 ===
  locked?: boolean          // 잠금 상태
}
```

---

## 스타일 타입

### PenType

```typescript
type PenType = 'pen' | 'marker' | 'highlighter'
```

| 타입 | 두께 배율 | 투명도 |
|------|-----------|--------|
| pen | 1x | 100% |
| marker | 2x | 70% |
| highlighter | 4x | 40% |

### MarkerStyle

커넥터 엔드포인트 마커 스타일입니다.

```typescript
type MarkerStyle =
  | 'none'         // 마커 없음
  | 'arrow'        // 열린 화살표 (>)
  | 'filledArrow'  // 채운 화살표 (▶)
  | 'diamond'      // 다이아몬드 (◇)
  | 'circle'       // 원 (○)
```

### LineStyle

선 스타일을 정의합니다.

```typescript
type LineStyle = 'solid' | 'dashed' | 'dotted'
```

### PathStyle

커넥터 경로 스타일을 정의합니다.

```typescript
type PathStyle =
  | 'straight'  // 직선
  | 'curved'    // 곡선 (베지어)
  | 'elbowed'   // 꺾인선 (직각)
```

### FontFamily

```typescript
type FontFamily =
  | 'Pretendard'      // 기본
  | 'Noto Sans KR'
  | 'Nanum Gothic'
  | 'Nanum Myeongjo'
  | 'IBM Plex Sans KR'
```

### FontSize 프리셋

```typescript
type FontSize = 'S' | 'M' | 'L' | 'XL' | 'XXL'
```

| 프리셋 | 크기 |
|--------|------|
| S | 12px |
| M | 16px |
| L | 24px |
| XL | 32px |
| XXL | 48px |

### TextAlign

텍스트 정렬 방향을 정의합니다.

```typescript
type TextAlign = 'left' | 'center' | 'right'
```

### ListType

리스트 스타일을 정의합니다.

```typescript
type ListType = 'none' | 'number' | 'bullet'
```

---

## 리치 텍스트

### TextSegment

인라인 서식 단위입니다.

```typescript
interface TextSegment {
  text: string                              // 텍스트 내용
  fontWeight?: 'normal' | 'bold'            // 굵기 설정
  textDecoration?: 'none' | 'line-through'  // 텍스트 장식
  fontSize?: number                         // 폰트 크기
  textColor?: string                        // 텍스트 색상
  link?: string                             // 링크 URL
}
```

**예시:**
```typescript
const richText: TextSegment[] = [
  { text: 'Hello ' },
  { text: 'World', fontWeight: 'bold' },
  { text: '!', textColor: '#ef4444' }
]
// 결과: "Hello **World**!" 형태가 됩니다
```

---

## 설정

### PenSettings

```typescript
interface PenSettings {
  penType: PenType
  strokeColor: string
  strokeWidth: number
}
```

### ShapeSettings

```typescript
interface ShapeSettings {
  fillColor: string
  strokeColor: string
  strokeWidth: number
}
```

---

## 상태 타입

### CanvasState

캔버스의 전체 상태를 나타냅니다.

```typescript
interface CanvasState {
  objects: CanvasObject[]
  selectedIds: string[]
  tool: Tool
  viewport: {
    x: number
    y: number
    zoom: number
  }
  canvasBounds: CanvasBounds
}
```

### CanvasBounds

캔버스 경계를 정의합니다.

```typescript
interface CanvasBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}
```

---

## 댓글 시스템 타입

### CaptionThread

댓글 스레드를 나타냅니다.

```typescript
interface CaptionThread {
  id: string
  x: number               // 캔버스 좌표
  y: number
  messages: CommentMessage[]
  isResolved: boolean
  isRead: boolean
  createdAt: string       // ISO 8601
  updatedAt: string
}
```

### CommentMessage

댓글 메시지를 나타냅니다.

```typescript
interface CommentMessage {
  id: string
  authorId: string
  authorName: string
  content: string
  createdAt: string
  attachments?: CommentAttachment[]
}
```

### CommentAttachment

댓글 첨부파일을 나타냅니다.

```typescript
interface CommentAttachment {
  id: string
  type: 'image'
  url: string    // base64 data URL
  name: string
}
```

### User

사용자 정보를 나타냅니다.

```typescript
interface User {
  id: string
  name: string
  avatarColor?: string
}
```

### CaptionFilter

댓글 필터 옵션을 정의합니다.

```typescript
interface CaptionFilter {
  showResolved: boolean
  onlyMyThreads: boolean
  sortBy: 'date' | 'unread'
  authorSearch: string
}
```

---

## 키보드 단축키

### ShortcutAction

단축키 액션을 정의합니다.

```typescript
type ShortcutAction =
  | 'select'
  | 'hand'
  | 'shape'
  | 'pencil'
  | 'eraser'
  | 'stickyNote'
  | 'connector'
  | 'textBox'
  | 'delete'
  | 'undo'
  | 'redo'
```

### KeyBinding

키 바인딩을 정의합니다.

```typescript
interface KeyBinding {
  key: string
  modifiers?: ('ctrl' | 'shift' | 'alt' | 'meta')[]
}
```

### ShortcutConfig

단축키 설정을 정의합니다.

```typescript
interface ShortcutConfig {
  action: ShortcutAction
  label: string
  binding: KeyBinding
}
```
