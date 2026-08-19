# Editor Components

> Applies to: `*Editor.tsx`

Editor 컴포넌트는 선택된 객체의 옵션 바 렌더링과 편집 오버레이를 담당합니다.
옵션 바 공통 패턴은 `options-bars.md` 참조.

## 파일 목록

| 파일 | 대상 ObjectType | 설명 |
|------|-----------------|------|
| `ShapeEditor.tsx` | shape, rectangle | 도형 옵션 바 |
| `StickyNoteEditor.tsx` | stickyNote | 메모지 옵션 바 |
| `TextBoxEditor.tsx` | textBox | 텍스트박스 옵션 바 |
| `ChartEditor.tsx` | chart | 차트 옵션 바 + 우측 패널 |
| `CodeBlockEditor.tsx` | codeBlock | 코드 블록 옵션 바 + 편집 오버레이 |
| `ConnectorEditor.tsx` | connector | 연결선 옵션 바 |
| `LineEditor.tsx` | line | 펜슬 드로잉 옵션 바 |
| `GroupEditor.tsx` | group | 그룹/섹션 옵션 바 |

## Editor vs OptionsBar 차이

| 컴포넌트 | 역할 |
|----------|------|
| `*Editor.tsx` | 선택 필터링, 상태 관리, 옵션바/오버레이 조합 |
| `*OptionsBar.tsx` | 순수 UI 컴포넌트, props로 모든 데이터 수신 |

## 기본 Editor 구조

```tsx
export function FooEditor() {
  const { objects, selectedIds, updateObject, viewport, isLocked } = useCanvasStore();

  // 1. 선택 객체 필터링
  const selectedObject = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    const obj = objects.find((o) => o.id === selectedIds[0]);
    if (!obj || obj.type !== "foo") return null;
    return obj;
  }, [objects, selectedIds]);

  // 2. 조기 반환
  if (!selectedObject) return null;
  if (isLocked) return null;

  // 3. 옵션 바 위치 계산
  const position = calculateOptionsBarPosition({...});

  // 4. 옵션 바 렌더링
  return (
    <FooOptionsBar
      object={selectedObject}
      position={position}
      onUpdate={(changes) => updateObject(selectedObject.id, changes)}
    />
  );
}
```

## 편집 오버레이 패턴

텍스트 편집이 필요한 컴포넌트 (StickyNote, TextBox, CodeBlock 등):

### CSS Transform Scale 패턴 (Zoom 처리)

HTML 오버레이에서 zoom을 처리할 때 **CSS transform으로 스케일링**합니다.
fontSize를 직접 곱하면 이중 스케일링이 발생합니다.

```tsx
// ❌ Bad: fontSize에 zoom 곱하기 (이중 스케일링)
const fontSize = (editingObject.fontSize ?? 10) * viewport.zoom;
style={{ fontSize }}

// ✅ Good: CSS transform으로 스케일링
const fontSize = editingObject.fontSize ?? 10;  // 원본 값 유지
const screenX = editingObject.x * viewport.zoom + viewport.x;
const screenY = editingObject.y * viewport.zoom + viewport.y;

<div
  style={{
    left: screenX,
    top: screenY,
    width: editingObject.width,
    height: editingObject.height,
    transform: `scale(${viewport.zoom})`,
    transformOrigin: "top left",
    fontSize,  // 원본 값
  }}
/>
```

### 왜 CSS Transform인가?

1. **일관성**: Konva 렌더링과 동일한 시각적 결과
2. **정확도**: 서브픽셀 렌더링이 정확함
3. **성능**: GPU 가속 활용
4. **단순성**: 모든 내부 요소가 자동으로 스케일링됨

### 편집 모드 상태

```tsx
const { editingTextId, setEditingTextId } = useCanvasStore();
const isEditing = editingTextId === selectedObject?.id;
```

### 편집 모드 진입

1. 더블클릭 → `setEditingTextId(obj.id)`
2. Editor에서 `isEditing` 체크
3. `isEditing` 시 편집 오버레이 표시

### 편집 모드 종료

1. Escape 키 → `setEditingTextId(null)`
2. 외부 클릭 → `setEditingTextId(null)`
3. 다른 객체 선택 시 자동 종료

## CodeBlock 전용 패턴

### 신택스 하이라이팅

lowlight (highlight.js 래퍼) 사용:

```tsx
import { createLowlight } from "lowlight";
import javascript from "highlight.js/lib/languages/javascript";

const lowlight = createLowlight();
lowlight.register("javascript", javascript);

const result = lowlight.highlight(language, code);
```

### 투명 textarea 오버레이

```tsx
{/* 하이라이트된 배경 */}
<div dangerouslySetInnerHTML={{ __html: highlightedHtml }} />

{/* 투명 입력 영역 */}
<textarea
  className="bg-transparent text-transparent caret-white"
  value={code}
  onChange={handleChange}
/>
```

### 테마별 스타일

```tsx
// Dark theme
const isDark = theme === "dark";
const backgroundColor = isDark ? "#383838" : "#ffffff";
const textColor = isDark ? "#d4d4d4" : "#1e1e1e";
const caretColor = isDark ? "white" : "black";
```

## Chart 전용 패턴

### 우측 패널 연동

ChartEditor는 옵션 바와 우측 패널(ChartRightPanel) 두 가지 UI를 관리:

```tsx
return (
  <>
    <ChartOptionsBar ... />
    {showRightPanel && <ChartRightPanel ... />}
  </>
);
```

### 차트 제목 편집

헤더 더블클릭 시 제목 편집 모드 진입:

```tsx
// Store 상태
const editingChartTitleId = useCanvasStore((s) => s.editingChartTitleId);
const setEditingChartTitleId = useCanvasStore((s) => s.setEditingChartTitleId);

const isEditingTitle = editingChartTitleId === selectedChart?.id;

// Chart 컴포넌트에 prop 전달
<Chart isEditingTitle={isEditingTitle} onHeaderDoubleClick={...} />
```

- 커스텀 이벤트 `chart-edit-title` 사용
- 편집 중 Konva Text 숨김, HTML input 오버레이 표시
- 선택 변경 시 자동 종료 (prevSelectedIdRef로 추적)

### 데이터 편집

차트 데이터는 `chartData` 객체로 관리:

```tsx
updateObject(id, {
  chartData: {
    ...obj.chartData,
    items: newItems,
  },
});
```

## z-index 참조

| 요소 | z-index |
|------|---------|
| 옵션 바 | `Z_OPTIONS_BAR` (200) |
| 편집 오버레이 | `Z_TEXT_INPUT` (9999) |
| 드롭다운 | `Z_OPTIONS_BAR + 1` (201) |

상세 z-index 정보는 `styling.md` 참조.
