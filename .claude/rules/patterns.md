# Code Patterns

## Performance

### Memoization

```typescript
// Component memoization
export const MyComponent = memo(function MyComponent(props) {
  // useMemo for expensive computations
  const computed = useMemo(() => expensiveCalc(props.data), [props.data]);

  // useCallback for handlers
  const handler = useCallback(() => {
    doSomething(props.id);
  }, [props.id]);

  return <Child onClick={handler} />;
});
```

### Viewport Virtualization

Only render objects visible in viewport:

```typescript
const visibleObjects = useVisibleObjects(objects, viewport);
```

### Event Delegation

Konva layers handle events, not individual shapes when possible.

### Canvas Component Optimization

#### ShapeRenderer 격리 패턴

Shape 컴포넌트를 `ShapeRenderer` memo 래퍼로 감싸 Canvas.tsx 리렌더 전파를 차단:

```typescript
// ❌ Bad: 고빈도 변경 값을 prop으로 전달 → 전체 Shape 리렌더
<ShapeRenderer obj={obj} zoom={viewport.zoom} tool={tool} />

// ✅ Good: ShapeRenderer 내부에서 직접 구독
export const ShapeRenderer = memo(function ShapeRenderer({ obj, isSelected }) {
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  const tool = useCanvasStore((s) => s.tool);
});
```

- `zoom`, `tool`, `isLocked`는 prop이 아닌 **내부 store 셀렉터**로 구독
- `objectsById`, `groupSiblingsMap` 같은 Map도 prop 전달 금지 (참조 변경 시 전체 memo 무효화)
- ShapeRenderer는 **순수 React 래퍼** — Konva `<Group>` 래핑 없음 (react-konva reconciler에 투명)

#### getState() 기반 이벤트 핸들러

고빈도 이벤트(wheel, mousemove, drag)에서 `getState()`로 의존성 배열 제거:

```typescript
// ❌ Bad: viewport 변경마다 핸들러 재생성
const handleWheel = useCallback((e) => { ... }, [viewport, objects]);

// ✅ Good: getState()로 항상 최신 값, 의존성 []
const handleWheel = useCallback((e) => {
  const { viewport } = useCanvasStore.getState();
  // ...
}, []);
```

**주의:** `getState()` 값은 JSX에 바인딩하면 안 됨 — 렌더링용은 반드시 reactive selector 사용.

#### 텍스트 렌더링: Konva Text vs TextViewerOverlay

읽기 전용 텍스트는 **Konva Text**로 렌더링 (DOM 없음, 성능 10x).
혼합 스타일(부분 bold, 다중 색상)만 **TextViewerOverlay**(Tiptap HTML)로 폴백.

```typescript
// TextBox/StickyNote/Shape 뷰 모드
const isMixed = hasMixedStyles(shape.tiptapContent);
if (!isMixed) {
  // Konva Text — tiptapContent에서 스타일 추출
  const style = extractFirstTextStyle(shape.tiptapContent);
  return <Text fontSize={style.fontSize} fill={style.color} ... />;
}
// 혼합 스타일 → Canvas에서 TextViewerOverlay 렌더링
```

- `extractFirstTextStyle()`: fontSize, color, fontFamily, fontStyle, textDecoration, textAlign
- `hasMixedStyles()`: 2개 이상 다른 mark를 가진 text 노드가 있으면 true
- padding은 반드시 `TEXT_CONFIG` 사용 (에디트/뷰 일관성)
- lineHeight는 `LINE_HEIGHT` 상수 사용

#### HTML 오버레이 스킵 조건

화면 픽셀 크기가 임계값 미만이면 DOM 생성 스킵:

```typescript
const screenW = obj.width * viewport.zoom;
if (screenW < 24) return; // 읽을 수 없는 크기 — 오버레이 생략
```

#### 그리드 렌더링

CSS background-image pattern으로 그리드 렌더링 (Konva sceneFunc 대신):

```typescript
// Stage container에 직접 적용 — GPU 가속, dot 수 제한 없음
const container = stageRef.current.container();
container.style.backgroundImage = `radial-gradient(circle, ${color} 1.2px, transparent 1.2px)`;
container.style.backgroundSize = `20px 20px`;
container.style.backgroundPosition = `${viewport.x % 20}px ${viewport.y % 20}px`;
```

#### Line 캐싱

포인트가 많은 Line은 비트맵 캐싱으로 매 프레임 재그리기 방지:

```typescript
// 20+ 포인트 (40+ values) → cache
if (points.length > 40) {
  lineRef.current.cache({ pixelRatio: 2 });
}
```

#### Set/Map 캐싱

`includes()` → `Set.has()`, `find()` → `Map.get()`으로 O(1) 조회:

```typescript
const selectedIdsSet = useMemo(() => new Set(selectedIds), [selectedIds]);
const groupsMap = useMemo(() => new Map(groups.map(g => [g.id, g])), [groups]);
```

## State Management

### Optimistic Updates

Update UI immediately, sync with backend:

```typescript
// Update local state first
updateObject(id, changes);
// Optionally sync to server
await api.save(changes);
```

### Temporal Actions

Wrap atomic operations for undo/redo:

```typescript
// Multiple updates as single undo step
updateObjects([
  { id: "1", changes: { x: 10 } },
  { id: "2", changes: { x: 20 } },
]);
```

## Component Patterns

### Controlled vs Uncontrolled

Prefer controlled components with `value` + `onChange`:

```typescript
<ColorPicker value={color} onChange={setColor} />
```

### Compound Components

Group related components:

```typescript
<Caption.Popup>
  <Caption.Header />
  <Caption.Messages />
  <Caption.Input />
</Caption.Popup>
```

### Render Props (sparingly)

```typescript
<SelectionBox render={(bounds) => <Border {...bounds} />} />
```
