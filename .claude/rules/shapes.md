# Shape Component Rules

> Applies to: `src/components/shapes/**/*.tsx`

## Common Props

All shape components receive:

```typescript
interface ShapeProps {
  shape: CanvasObject;
  isSelected: boolean;
  isMultiSelected?: boolean;
  zoom?: number;
  draggable?: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDoubleClick?: () => void;
  onUpdate?: (updates: Partial<CanvasObject>) => void;
}
```

## Selection Border

Use `SelectionBorder` for rectangular shapes, `CircleSelectionBorder` for circles.

## Refs Pattern

For interactive shapes (e.g., Connector):

```typescript
const lineRef = useRef<Konva.Arrow>(null);
const startHandleRef = useRef<Konva.Circle>(null);
const endHandleRef = useRef<Konva.Circle>(null);
```

## 텍스트 렌더링 (TextBox / StickyNote / Shape)

뷰 모드에서 텍스트는 **Konva Text**로 렌더링 (DOM 없음).
편집 모드에서는 **Tiptap Editor** HTML overlay.

```typescript
// tiptapContent가 있으면 스타일 추출
const tiptapStyle = extractFirstTextStyle(shape.tiptapContent);
const isMixed = hasMixedStyles(shape.tiptapContent);

// 혼합 스타일이면 Konva Text 건너뛰고 TextViewerOverlay 사용
if (isMixed) return null;

// Konva Text — TEXT_CONFIG padding 사용
<Text x={pad.left} y={pad.top} width={w - pad.left - pad.right} ... />
```

- padding: `TEXT_CONFIG.textBox.padding` / `TEXT_CONFIG.stickyNote.padding`
- lineHeight: `LINE_HEIGHT` (1.5)
- Shape: tiptapContent 우선, 없으면 richText fallback

## Connector Modes

| Mode | Condition | Behavior |
|------|-----------|----------|
| Attached | `sourceId` or `targetId` exists | Tracks connected shape |
| Standalone | No source/target | Independent line |
| Group snap | `sourceId` starts with `__group:` | Tracks group customBounds |

커넥터가 그룹에 연결된 경우:
- `ConnectorShapeRenderer`에서 `__group:groupId` → 가상 CanvasObject 생성
- 그룹 이동 시 customBounds 업데이트 → 커넥터 자동 추적

## Line 캐싱

포인트가 많은 Line(20+)은 `CachedLine`으로 비트맵 캐싱:
- `node.cache({ pixelRatio: 2 })` — 스타일 변경 시 자동 재캐싱
- 성능: 복잡한 드로잉의 매 프레임 재그리기 방지

## Chart Component

Chart supports 3 types:
- `bar`: Bar chart with dynamic sizing, vertical/horizontal orientation
- `line`: Multi-series line chart
- `pie`: Pie/donut with 5 styles (default, donut, 3d, rounded, gradient)

**Important:** Use `Arc` for donut/gradient styles (Wedge doesn't support innerRadius).

### Bar Chart

| 속성 | 기본값 | 설명 |
|------|--------|------|
| `orientation` | `"vertical"` | 바 방향 (`"vertical"` / `"horizontal"`) |
| `showGridX` | `true` | X축 그리드 표시 |

수평 바 차트:
- X축에 값, Y축에 카테고리
- 좌측 여백 16px (라벨), 우측 10px
- Settings > Bar Style에서 전환

### Line Chart

| 속성 | 기본값 | 설명 |
|------|--------|------|
| `showGridX` | `false` | X축 그리드 (기본 off) |
| `xAxisMargin` | `16` | X축 마진 (0, 16, 32 step) |

**Value 라벨 렌더링:**
- 모든 라인/포인트 렌더링 후 별도 패스로 라벨 렌더링 (z-order 보장)
- 같은 X 위치에서 값이 겹치면 14px 간격으로 오프셋
- 라벨 색상은 해당 시리즈 색상과 동일

### Chart Title 편집

헤더 더블클릭 시 제목 편집 모드 진입:
- `editingChartTitleId` store 상태로 관리
- `isEditingTitle` prop으로 Chart에 전달
- 편집 중 Konva Text 숨김 (ChartEditor 오버레이 표시)

## CodeBlock Component

신택스 하이라이팅이 적용된 코드 블록:

- **렌더링**: Konva Group + Rect + Text (Konva 레이어)
- **편집**: CodeBlockEditor의 HTML textarea 오버레이
- **하이라이팅**: lowlight (highlight.js)
- **지원 언어**: 21개 (javascript, typescript, python, java, go, rust 등)

```typescript
interface CodeBlockProps extends ShapeProps {
  isEditing?: boolean;  // 편집 모드 여부
}
```

**주의사항:**
- `isEditing` 시 코드 텍스트 숨김 (오버레이에서 표시)
- Header(28px)와 본문 영역 분리
- `listening={false}` 속성으로 비대화형 요소 표시
