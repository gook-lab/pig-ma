---
title: 파워포인트 스타일 다중 선택 기능
type: feat
status: active
date: 2026-02-19
deepened: 2026-02-19
---

# 파워포인트 스타일 다중 선택 기능

## Enhancement Summary

**Deepened on:** 2026-02-19
**Research agents used:** Konva.js Best Practices, UX Patterns (FigJam/Figma/PowerPoint), React State Management, Accessibility/Keyboard Navigation

### Key Improvements
1. **성능 최적화**: Zustand selector 패턴으로 개별 컴포넌트 구독, 30개 이상 선택 시 가상화 고려
2. **UX 일관성**: 업계 표준 색상(#0D99FF) 및 상호작용 패턴 적용
3. **접근성 강화**: WCAG 준수, Roving Tabindex, ARIA live regions 추가

### New Considerations Discovered
- Konva Transformer는 30개 이상 노드에서 성능 저하 발생 → 개별 선택 표시 방식이 더 적합
- FigJam은 Shift+클릭 패턴 사용, PowerPoint는 Cmd+클릭 → 두 가지 모두 지원 권장
- 스크린 리더 사용자를 위한 실시간 선택 상태 안내 필요

---

## Overview

현재 마키 드래그로 여러 요소를 선택하면 하나의 통합된 Transformer 바운딩 박스가 표시됩니다. 파워포인트처럼 개별 요소마다 선택 표시가 되고, Cmd+클릭으로 선택을 추가/해제할 수 있는 직관적인 다중 선택 기능을 구현합니다.

## Problem Statement / Motivation

**현재 동작:**
- 마키 선택 시 모든 선택된 요소를 감싸는 단일 Transformer 표시
- 개별 요소의 선택 상태가 시각적으로 명확하지 않음
- Shift+클릭으로 토글 선택 (Cmd+클릭이 아님)

**원하는 동작 (파워포인트 스타일):**
- 다중 선택 시 각 요소마다 개별 선택 표시 (파란색 테두리)
- 통합 리사이즈 핸들 없음 (개별 요소는 리사이즈 불가, 이동만 가능)
- Cmd+클릭으로 선택 추가/해제
- 다중 선택 모드 진입 시 안내 메시지
- 우클릭 → 그룹핑 가능

## Proposed Solution

### 1. 개별 선택 표시 (Individual Selection Indicators)

다중 선택 시 Transformer 대신 개별 요소마다 선택 테두리를 표시합니다.

```typescript
// 각 Shape 컴포넌트에서 개별 선택 표시
// isSelected prop으로 파란색 테두리 렌더링
{isSelected && selectedIds.length > 1 && (
  <Rect
    x={-2}
    y={-2}
    width={shape.width + 4}
    height={shape.height + 4}
    stroke="#0D99FF"
    strokeWidth={2 / zoom}
    fill="transparent"
    dash={[4, 4]}
    listening={false}
  />
)}
```

### 2. Transformer 동작 변경

```typescript
// Canvas.tsx - useEffect에서 Transformer nodes 설정
useEffect(() => {
  const transformer = transformerRef.current;

  // 다중 선택 시 Transformer 비활성화 (개별 표시로 대체)
  if (selectedIds.length > 1) {
    transformer.nodes([]);
    return;
  }

  // 단일 선택은 기존대로 Transformer 표시
  // ...existing logic
}, [selectedIds, objects]);
```

### 3. Cmd+클릭 선택 로직

```typescript
// Canvas.tsx - handleSelect 수정
const handleSelect = useCallback((id: string, e) => {
  // Cmd/Ctrl 키로 선택 토글
  const cmdKey = e.evt.metaKey || e.evt.ctrlKey;

  if (cmdKey) {
    // 이미 선택된 경우 → 해제
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
      // 선택되지 않은 경우 → 추가
      setSelectedIds([...selectedIds, id]);

      // 첫 다중 선택 시 토스트 표시
      if (selectedIds.length === 1) {
        showMultiSelectToast();
      }
    }
  } else {
    // Cmd 없이 클릭 → 단일 선택
    setSelectedIds([id]);
  }
}, [selectedIds, setSelectedIds]);
```

### 4. 다중 선택 모드 안내

```typescript
// 상단 중앙에 다중 선택 모드 메시지 표시
{selectedIds.length > 1 && (
  <div className="fixed top-4 left-1/2 -translate-x-1/2
    bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg
    flex items-center gap-2 animate-in fade-in">
    <span>{selectedIds.length}개 선택됨</span>
    <span className="text-gray-400 text-sm">
      Cmd+클릭으로 추가/해제 • 우클릭으로 그룹핑
    </span>
  </div>
)}
```

### 5. 옵션바 숨김

```typescript
// TextBoxEditor.tsx, ShapeOptionsBar.tsx 등
// 다중 선택 시 옵션바 렌더링 안 함
if (selectedIds.length > 1) return null;
```

### 6. 우클릭 그룹핑 (이미 구현됨)

현재 `ContextMenu.tsx`에 그룹핑 옵션이 이미 있습니다. 확인 필요:
- `store.groupSelected()` 호출
- 2개 이상 선택 시 메뉴 표시

---

## Research Insights

### Konva.js Best Practices

**Performance Considerations:**
- Konva Transformer는 30개 이상 노드 연결 시 성능 급격히 저하
- 개별 선택 표시 방식이 대규모 선택에서 더 효율적
- `listening: false`로 비상호작용 요소의 이벤트 처리 비활성화

**구현 권장사항:**
```typescript
// 배치 업데이트로 성능 최적화
const updateMultipleObjects = useCallback((updates: Array<{id: string, changes: Partial<CanvasObject>}>) => {
  // 단일 상태 업데이트로 여러 객체 수정
  setObjects(prev => {
    const newObjects = [...prev];
    updates.forEach(({id, changes}) => {
      const index = newObjects.findIndex(o => o.id === id);
      if (index !== -1) {
        newObjects[index] = { ...newObjects[index], ...changes };
      }
    });
    return newObjects;
  });
}, []);
```

**가상화 패턴 (50+ 선택 시):**
```typescript
// 뷰포트 내 요소만 선택 테두리 렌더링
const visibleSelectedIds = useMemo(() => {
  return selectedIds.filter(id => {
    const obj = objectsById.get(id);
    return obj && isInViewport(obj, viewport);
  });
}, [selectedIds, objectsById, viewport]);
```

### UX Patterns (업계 표준)

**선택 색상 표준:**
- 파란색 `#0D99FF` - FigJam, Figma, Miro 공통 사용
- 2px 두께, 점선(dashed) 또는 실선 선택 가능
- 줌 레벨과 무관하게 일정한 시각적 두께 유지: `strokeWidth={2 / zoom}`

**키보드 수정자 패턴:**
| 도구 | 추가 선택 | 토글 선택 |
|------|----------|----------|
| PowerPoint | Shift+클릭 | Cmd+클릭 |
| FigJam | Shift+클릭 | Shift+클릭 (토글) |
| Figma | Shift+클릭 | Shift+클릭 (토글) |

**권장 구현:** Cmd+클릭과 Shift+클릭 모두 지원
```typescript
const isMultiSelectModifier = e.evt.metaKey || e.evt.ctrlKey || e.evt.shiftKey;
```

**다중 선택 모드 피드백:**
- 상단 안내 바: 선택 개수 + 가능한 액션 안내
- 그룹핑 힌트: 첫 다중 선택 시 토스트로 안내
- 드래그 시각 피드백: 모든 선택 요소 동시 하이라이트

### React State Management (Zustand 최적화)

**개별 구독 패턴으로 불필요한 리렌더링 방지:**
```typescript
// ❌ 안티패턴: 전체 selectedIds 구독 → 모든 Shape 리렌더링
const selectedIds = useCanvasStore(state => state.selectedIds);
const isSelected = selectedIds.includes(shape.id);

// ✅ 권장: 개별 선택 상태만 구독
const useIsSelected = (id: string) =>
  useCanvasStore(useCallback(state => state.selectedIds.includes(id), [id]));

// Shape 컴포넌트에서 사용
const isSelected = useIsSelected(shape.id);
```

**다중 선택 상태 훅:**
```typescript
// src/hooks/useMultiSelect.ts
export function useMultiSelect() {
  const selectedIds = useCanvasStore(state => state.selectedIds);
  const isMultiSelect = selectedIds.length > 1;
  const selectedCount = selectedIds.length;

  return { isMultiSelect, selectedCount, selectedIds };
}
```

**선택적 렌더링 최적화:**
```typescript
// SelectionBorder는 다중 선택 시에만 렌더링
const SelectionBorder = memo(({ shape, zoom }: Props) => {
  const isSelected = useIsSelected(shape.id);
  const isMultiSelect = useCanvasStore(state => state.selectedIds.length > 1);

  if (!isSelected || !isMultiSelect) return null;

  return <Rect ... />;
});
```

### Accessibility (접근성)

**WCAG 2.1 준수 요구사항:**
- 선택 상태 변경 시 스크린 리더에 안내 (ARIA live region)
- 키보드로 모든 선택 기능 접근 가능
- 포커스 표시가 선택 표시와 구분되어야 함

**Roving Tabindex 패턴 (키보드 탐색):**
```typescript
// Canvas 레벨에서 키보드 탐색 관리
const handleKeyDown = useCallback((e: KeyboardEvent) => {
  if (selectedIds.length === 0) return;

  switch (e.key) {
    case 'Tab':
      // 선택된 요소들 사이 순환
      e.preventDefault();
      const currentIndex = selectedIds.indexOf(focusedId);
      const nextIndex = e.shiftKey
        ? (currentIndex - 1 + selectedIds.length) % selectedIds.length
        : (currentIndex + 1) % selectedIds.length;
      setFocusedId(selectedIds[nextIndex]);
      break;
    case 'Escape':
      // 선택 해제
      clearSelection();
      break;
    case 'a':
      if (e.metaKey || e.ctrlKey) {
        // 전체 선택
        e.preventDefault();
        selectAll();
      }
      break;
  }
}, [selectedIds, focusedId]);
```

**ARIA Live Region 구현:**
```typescript
// src/components/MultiSelectIndicator.tsx
export function MultiSelectIndicator() {
  const { selectedCount, isMultiSelect } = useMultiSelect();

  return (
    <>
      {/* 시각적 표시 */}
      {isMultiSelect && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 ...">
          {selectedCount}개 선택됨
        </div>
      )}

      {/* 스크린 리더 전용 실시간 안내 */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {selectedCount > 0
          ? `${selectedCount}개 요소 선택됨. Cmd+클릭으로 추가/해제, Escape로 선택 해제`
          : '선택된 요소 없음'}
      </div>
    </>
  );
}
```

**포커스 vs 선택 구분:**
```typescript
// 선택: 파란색 점선 (#0D99FF, dashed)
// 포커스: 검정색 실선 (#000000, solid) - 키보드 탐색 시
{isFocused && (
  <Rect
    stroke="#000000"
    strokeWidth={2 / zoom}
    dash={undefined} // 실선
    ...
  />
)}
```

---

## Technical Considerations

### 영향받는 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/components/Canvas.tsx` | Transformer 조건부 비활성화, Cmd+클릭 로직 |
| `src/components/shapes/Rectangle.tsx` | 개별 선택 표시 추가 |
| `src/components/shapes/StickyNote.tsx` | 개별 선택 표시 추가 |
| `src/components/shapes/TextBox.tsx` | 개별 선택 표시 추가 |
| `src/components/shapes/Shape.tsx` | 개별 선택 표시 추가 |
| `src/components/shapes/Connector.tsx` | 개별 선택 표시 추가 |
| `src/components/shapes/Line.tsx` | 개별 선택 표시 추가 |
| `src/components/shapes/CanvasImage.tsx` | 개별 선택 표시 추가 |
| `src/components/TextBoxEditor.tsx` | 다중 선택 시 숨김 |
| `src/components/ShapeOptionsBar.tsx` | 다중 선택 시 숨김 |
| `src/components/LineOptionsBar.tsx` | 다중 선택 시 숨김 |
| `src/components/ConnectorOptionsBar.tsx` | 다중 선택 시 숨김 |
| `src/components/MultiSelectIndicator.tsx` | 새 파일 - 상단 안내 메시지 |
| `src/components/ContextMenu.tsx` | 그룹핑 옵션 확인 |

### 공통 컴포넌트 추출

개별 선택 표시를 모든 Shape에 추가하는 대신, 공통 래퍼 또는 훅으로 추출:

```typescript
// src/components/SelectionBorder.tsx
interface SelectionBorderProps {
  width: number;
  height: number;
  zoom: number;
  isMultiSelect: boolean;
}

export function SelectionBorder({ width, height, zoom, isMultiSelect }: SelectionBorderProps) {
  if (!isMultiSelect) return null;

  return (
    <Rect
      x={-2}
      y={-2}
      width={width + 4}
      height={height + 4}
      stroke="#0D99FF"
      strokeWidth={2 / zoom}
      fill="transparent"
      dash={[4, 4]}
      listening={false}
    />
  );
}
```

## Acceptance Criteria

### 기능 요구사항
- [ ] 마키 드래그로 다중 선택 시 각 요소에 개별 선택 테두리 표시
- [ ] 다중 선택 시 통합 Transformer 핸들 숨김
- [ ] Cmd+클릭으로 기존 선택에 요소 추가
- [ ] Cmd+클릭으로 이미 선택된 요소 해제
- [ ] Shift+클릭도 다중 선택에 추가 (업계 표준 호환)
- [ ] 다중 선택 모드 진입 시 상단 안내 메시지 표시
- [ ] 다중 선택 시 옵션바 숨김 (TextOptionsBar, ShapeOptionsBar 등)
- [ ] 우클릭 컨텍스트 메뉴에서 그룹핑 가능 확인
- [ ] 다중 선택된 요소들 함께 드래그 이동 가능

### 성능 요구사항 (연구 기반)
- [ ] 개별 Shape 컴포넌트가 자신의 선택 상태만 구독 (useIsSelected 훅)
- [ ] 선택 변경 시 선택되지 않은 요소는 리렌더링 안 함
- [ ] 30개 이상 선택 시에도 부드러운 드래그 (60fps 유지)

### 접근성 요구사항 (WCAG 2.1)
- [ ] 선택 상태 변경 시 스크린 리더 안내 (ARIA live region)
- [ ] Cmd+A로 전체 선택 지원
- [ ] Escape로 선택 해제 지원
- [ ] Tab으로 선택된 요소 간 포커스 이동 (Roving Tabindex)

### 기존 동작 유지
- [ ] 단일 선택 시 기존 Transformer 동작 유지
- [ ] Shift+클릭 마키 선택 동작 유지 (기존 패턴)
- [ ] 빈 공간 클릭 시 선택 해제

### Edge Cases
- [ ] 그룹 내 요소 Cmd+클릭 시: 그룹 전체 선택/해제 (개별 요소 아님)
- [ ] 잠금 모드(isLocked)에서 다중 선택 비활성화
- [ ] 줌 레벨 변경 시 선택 테두리 두께 일정 유지
- [ ] 드래그 중 선택 해제 시 드래그 중단 처리

## MVP Implementation

### Phase 1: 핵심 기능

1. **Cmd+클릭 선택 추가/해제**
   ```typescript
   // Canvas.tsx:handleSelect
   if (e.evt.metaKey || e.evt.ctrlKey) {
     addToSelection(id); // 토글 동작
   }
   ```

2. **다중 선택 시 Transformer 숨김**
   ```typescript
   // Canvas.tsx:useEffect
   if (selectedIds.length > 1) {
     transformer.nodes([]);
     return;
   }
   ```

3. **개별 선택 표시**
   - 각 Shape 컴포넌트에 `isMultiSelected` prop 추가
   - 다중 선택 시 점선 테두리 렌더링

4. **옵션바 숨김**
   - 각 *OptionsBar 컴포넌트 상단에 조건 추가

### Phase 2: UX 개선

1. **상단 안내 메시지** (MultiSelectIndicator)
   ```typescript
   // src/components/MultiSelectIndicator.tsx
   export function MultiSelectIndicator() {
     const { selectedCount, isMultiSelect } = useMultiSelect();
     if (!isMultiSelect) return null;
     return (
       <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg">
         {selectedCount}개 선택됨 • Cmd+클릭으로 추가/해제
       </div>
     );
   }
   ```

2. **그룹핑 안내** (첫 다중 선택 시 토스트)
   ```typescript
   // 첫 다중 선택 시 토스트 표시 (localStorage로 1회만)
   const MULTI_SELECT_HINT_KEY = 'multiSelectHintShown';
   if (!localStorage.getItem(MULTI_SELECT_HINT_KEY)) {
     toast('우클릭하여 그룹으로 묶을 수 있습니다', { icon: '💡' });
     localStorage.setItem(MULTI_SELECT_HINT_KEY, 'true');
   }
   ```

3. **키보드 단축키 가이드 업데이트**
   - CLAUDE.md의 Keyboard Shortcuts 섹션 업데이트
   - FloatingUtilityBar의 키보드 시각화에 Cmd+A 추가

### Phase 3: 접근성 강화

1. **ARIA Live Region 추가**
   ```typescript
   <div role="status" aria-live="polite" className="sr-only">
     {selectedCount}개 요소 선택됨
   </div>
   ```

2. **Roving Tabindex 구현**
   - 선택된 요소들 사이 Tab 탐색
   - focusedId 상태 추가 및 관리

3. **전체 선택 단축키** (Cmd+A)
   ```typescript
   if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
     e.preventDefault();
     selectAll();
   }
   ```

### Phase 4: 성능 최적화 (선택적)

1. **useIsSelected 훅 추출**
   ```typescript
   // src/hooks/useIsSelected.ts
   export const useIsSelected = (id: string) =>
     useCanvasStore(useCallback(state => state.selectedIds.includes(id), [id]));
   ```

2. **뷰포트 외 요소 선택 테두리 스킵**
   - 50개 이상 선택 시 적용
   - isInViewport 유틸리티 활용

## References

### 기존 코드 참조

- `src/store.ts:346-354` - `addToSelection` 토글 로직
- `src/components/Canvas.tsx:724-760` - `handleSelect` 함수
- `src/components/Canvas.tsx:811-847` - Transformer nodes 설정
- `src/components/ContextMenu.tsx` - 그룹핑 메뉴 아이템
- `src/store.ts:777-809` - `groupSelected` 액션

### 관련 CLAUDE.md 규칙

- `CLAUDE.md:419-484` - Shape Style Rules (선택 상태 표시)
- `CLAUDE.md:565-599` - Dragging State Management

### 외부 문서 (연구 기반)

**Konva.js:**
- [Konva Transformer API](https://konvajs.org/api/Konva.Transformer.html) - 멀티 노드 선택 성능 제한
- [Konva Performance Tips](https://konvajs.org/docs/performance/All_Performance_Tips.html) - `listening: false` 최적화

**UX 패턴:**
- [FigJam Selection Model](https://help.figma.com/hc/en-us/articles/360040449873) - Shift+클릭 패턴
- [Figma Multi-Selection](https://help.figma.com/hc/en-us/articles/360039957534) - 산업 표준 색상

**접근성:**
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/) - 선택 상태 안내 요구사항
- [WAI-ARIA Roving Tabindex](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) - 키보드 탐색 패턴
- [ARIA Live Regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions) - 실시간 안내

**상태 관리:**
- [Zustand Selector Optimization](https://github.com/pmndrs/zustand#selecting-multiple-state-slices) - 개별 구독 패턴
