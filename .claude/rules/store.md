# Store Rules

> Applies to: `src/store/**/*.ts`

## Architecture

**Zustand** with sliced architecture:

```
store/
├── index.ts        # Main store, combined slices
├── types.ts        # Store type definitions
└── slices/
    ├── core.ts     # Objects, selection, viewport
    ├── editing.ts  # Text editing state
    ├── drawing.ts  # Drawing mode state
    ├── groups.ts   # Group management
    ├── pages.ts    # Multi-page state
    └── ...
```

## Slice Pattern

```typescript
import type { StateCreator } from "zustand";
import type { CanvasStore } from "../types";

export interface MySlice {
  myState: string;
  setMyState: (value: string) => void;
}

export const createMySlice: StateCreator<
  CanvasStore,
  [],
  [],
  MySlice
> = (set) => ({
  myState: "",
  setMyState: (value) => set({ myState: value }),
});
```

## Editing Slice

`editing.ts` 슬라이스의 주요 상태:

| 상태 | 용도 |
|------|------|
| `editingTextId` | 텍스트 편집 중인 객체 ID |
| `editingChartTitleId` | 차트 제목 편집 중인 객체 ID |
| `pendingTextInput` | 입력 대기 중인 텍스트 |
| `editingCursor` | 편집 커서 상태 |
| `activeEditor` | 활성 Tiptap 에디터 |

## Middleware

- **temporal**: Undo/redo (`zundo`)
- **persist**: localStorage (`zustand/middleware`)

## Temporal Equality Function

`zundo` 미들웨어는 equality 함수로 상태 변경을 감지합니다. **새 속성을 undo/redo 대상에 포함하려면 equality 함수에 명시적으로 추가해야 합니다.**

```typescript
// store/index.ts
temporal(
  storeCreator,
  {
    equality: (pastState, currentState) => {
      // objects 배열의 각 객체 비교
      for (let i = 0; i < currentState.objects.length; i++) {
        const pastObj = pastState.objects[i];
        const obj = currentState.objects[i];

        // 기본 속성
        if (pastObj.x !== obj.x) return false;
        if (pastObj.y !== obj.y) return false;
        if (pastObj.width !== obj.width) return false;

        // 스타일 속성 - 명시적 추가 필요!
        if (pastObj.fill !== obj.fill) return false;
        if (pastObj.stroke !== obj.stroke) return false;
        if (pastObj.opacity !== obj.opacity) return false;
        if (pastObj.rotation !== obj.rotation) return false;

        // 객체별 속성
        if (pastObj.chartData !== obj.chartData) return false;
        if (pastObj.code !== obj.code) return false;
        // ...
      }
      return true;
    },
  }
)
```

### 새 속성 추가 시 체크리스트

1. `types.ts`의 `CanvasObject`에 속성 추가
2. `store/index.ts`의 equality 함수에 비교 로직 추가
3. 테스트: 속성 변경 후 Cmd+Z로 되돌아가는지 확인

### 누락 시 증상

- 속성 변경 후 undo가 동작하지 않음
- undo 시 다른 변경사항만 되돌아감

### 타입별 등록된 속성

| 타입 | 속성 |
|------|------|
| **공통** | x, y, width, height, rotation, opacity, text, tiptapContent, fill, fillMode, stroke, strokeWidth, backgroundColor, lineStyle, fontSize, fontWeight, textDecoration, fontFamily, textAlign, textColor, groupId, locked, zIndex, points, reactions |
| **shape** | shapeVariant, isTextExpanded |
| **image** | src |
| **connector** | endX, endY, sourceId, targetId, sourceAnchor, targetAnchor, elbowBends, startMarker, endMarker, pathStyle, elbowCornerStyle, elbowCornerRadius, label, labelOffsetY, labelTextBoxId |
| **connectorLabel** | labelT, connectedConnectorId |
| **table** | tableData |
| **chart** | chartData, chartShowHeader, chartTitle |
| **codeBlock** | code, codeLanguage, codeTitle, codeTheme |
| **line** | penType |
| **textBox** | fontSizePreset, listType, indentLevel, link |
| **stickyNote** | (공통 속성만 사용) |

## Groups Slice 주의사항

### `__group:` 가상 선택 마커

섹션(GroupBoundary)을 선택할 때 `selectedIds`에 `__group:groupId`를 넣음.
실제 CanvasObject ID가 아닌 가상 마커로, 개별 object selection indicator를 표시하지 않음.

```typescript
// selectGroup — 모든 그룹에 가상 마커 사용
selectGroup: (groupId) => set(() => ({
  selectedIds: [`__group:${groupId}`],
}));
```

**영향받는 곳:**
- `ungroupSelected`: `__group:` 파싱하여 그룹 해체
- `deleteObjects`: `customBounds` 그룹은 bounds 안에 objects 있을 때만 유지
- `ContextMenu`: `virtualGroupIds` 추출하여 그룹 해제 메뉴 표시
- `Canvas GroupBoundary`: `isGroupSelected` 판별에 `__group:` 체크

### 중첩 그룹 (부모/자식 섹션)

부모 그룹(Date)은 `customBounds`만 있고 직접 멤버 없음.
`moveGroupObjects`에서 customBounds 안의 objects를 찾아 이동.
자식 GroupBoundary도 `stage.findOne('#group-boundary-...')`로 실시간 이동.

## Selectors

Create fine-grained selectors to minimize re-renders:

```typescript
// Good - selects only what's needed
export const useSelectedIds = () => useCanvasStore((s) => s.selectedIds);

// Bad - selects entire state
export const useStore = () => useCanvasStore((s) => s);
```

## Immer Usage

Use Immer's `produce` for nested state updates:

```typescript
set(produce((draft) => {
  draft.objects[id].x = newX;
}));
```
