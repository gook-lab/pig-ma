---
title: "feat: Add Table Insert Tool to Canvas"
type: feat
status: completed
date: 2026-03-02
deepened: 2026-03-02
completed: 2026-03-02
---

# feat: Add Table Insert Tool to Canvas

## Enhancement Summary

**Deepened on:** 2026-03-02
**Research agents used:** best-practices-researcher, kieran-typescript-reviewer, performance-oracle, julik-frontend-races-reviewer, architecture-strategist, code-simplicity-reviewer, pattern-recognition-specialist, Context7 (react-konva docs)

### Key Improvements
1. **데이터 모델 최적화**: Flat array → Record 기반 O(1) 셀 조회
2. **성능 최적화**: Tiptap 지연 초기화, Konva Shape 통합, 드래그 레이어 분리
3. **Phase 간소화**: 6 Phase → 3 Phase (YAGNI 원칙 적용)
4. **레이스 컨디션 방지**: 상태 머신 기반 셀 편집, 드래그 중 업데이트 지연

### New Considerations Discovered
- 셀 전환 시 blur/focus 타이밍 이슈 (justOpenedRef 패턴 적용)
- 드래그 중 Store 업데이트 충돌 (RowDragCoordinator 필요)
- 대형 테이블 성능 (10x10+에서 가상화 고려)

---

## Overview

캔버스에 테이블 삽입 기능을 추가합니다. FigJam 스타일의 인터랙티브 테이블로, 2x2 기본 생성, 행/열 동적 추가, 리치 텍스트 편집, 드래그앤드롭 행 순서 변경, 리사이징을 지원합니다.

## Problem Statement / Motivation

현재 캔버스에서 데이터를 표 형태로 정리할 수 없습니다. 테이블 기능이 없어 사용자는 여러 StickyNote나 Shape를 수동 배열해야 합니다. 테이블 도구를 추가하면 정보를 구조화하고 협업 시 데이터 정리가 용이해집니다.

## Reference Images

첨부된 이미지 분석:
1. **기본 생성**: 2x2 테이블, 회색 배경, 둥근 모서리, 드래그로 크기 설정
2. **행/열 추가**: 우측/하단 파란색 + 버튼 영역 (hover 시 노출)
3. **중간 삽입**: 행/열 사이 hover 시 + 버튼 노출, 클릭 시 해당 위치에 삽입
4. **셀 편집**: 각 셀에 리치 텍스트 입력, TextOptionsBar 연동
5. **행 순서 변경**: 왼쪽 햄버거 버튼으로 드래그앤드롭

---

## Proposed Solution

### High-level Architecture

```
Table Component Structure:
┌──────────────────────────────────────────┐
│ Table (Group)                            │
│ ┌────────┬────────┬─────────┐           │
│ │ Cell   │ Cell   │ + Button│ ← Column add
│ ├────────┼────────┤         │           │
│ │ Cell   │ Cell   │         │           │
│ ├────────┴────────┴─────────┤           │
│ │      + Button Row         │ ← Row add │
│ └───────────────────────────┘           │
│ [≡] ← Row drag handle (hover)           │
└──────────────────────────────────────────┘
```

### Data Model (Research-Enhanced)

```typescript
// types.ts 확장

export type ObjectType = ... | 'table';
export type Tool = ... | 'table';

// 테이블 셀 데이터 (간소화)
export interface TableCell {
  id: string;
  content?: JSONContent;  // Tiptap 리치 텍스트 (tiptap prefix 제거)
  backgroundColor?: string;
  textAlign?: TextAlign;
  verticalAlign?: 'top' | 'middle' | 'bottom';
  // v2: rowSpan, colSpan (셀 병합)
}

// 테이블 데이터 (그룹화)
export interface TableData {
  cells: Record<string, TableCell>;  // key: "row-col" (O(1) 조회)
  rowCount: number;
  colCount: number;
  colWidths: number[];
  rowHeights: number[];
  defaultColWidth: number;    // 새 열 추가 시 기본값
  defaultRowHeight: number;   // 새 행 추가 시 기본값
  borderColor: string;
  backgroundColor?: string;
}

// CanvasObject에 테이블 필드 추가 (그룹화)
export interface CanvasObject {
  // ... 기존 필드
  table?: TableData;  // type === 'table'일 때만 존재
}
```

### Research Insights: Data Model

**Best Practices:**
- Record 기반 셀 저장으로 O(1) 조회 (배열 O(n) 대비 10x10 테이블에서 100배 성능 향상)
- `rowIndex/colIndex`를 셀 필드에서 제거하고 키로 표현: `"0-1"` = row 0, col 1
- 테이블 데이터를 `table?: TableData`로 그룹화하여 타입 안전성 향상

**Utility Functions:**

```typescript
// utils/table.ts
export const TableUtils = {
  getCellKey: (row: number, col: number): string => `${row}-${col}`,

  getCell: (data: TableData, row: number, col: number): TableCell | undefined =>
    data.cells[TableUtils.getCellKey(row, col)],

  setCell: (data: TableData, row: number, col: number, cell: TableCell): TableData => ({
    ...data,
    cells: {
      ...data.cells,
      [TableUtils.getCellKey(row, col)]: cell,
    },
  }),

  getCellPosition: (data: TableData, row: number, col: number): { x: number; y: number } => ({
    x: data.colWidths.slice(0, col).reduce((sum, w) => sum + w, 0),
    y: data.rowHeights.slice(0, row).reduce((sum, h) => sum + h, 0),
  }),

  createEmptyTable: (rows: number = 2, cols: number = 2): TableData => {
    const defaultColWidth = 150;
    const defaultRowHeight = 50;
    const cells: Record<string, TableCell> = {};

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells[`${r}-${c}`] = { id: nanoid() };
      }
    }

    return {
      cells,
      rowCount: rows,
      colCount: cols,
      colWidths: Array(cols).fill(defaultColWidth),
      rowHeights: Array(rows).fill(defaultRowHeight),
      defaultColWidth,
      defaultRowHeight,
      borderColor: '#e5e7eb',
    };
  },
} as const;
```

---

## Technical Considerations

### Architecture Impacts

1. **새 Shape 컴포넌트**: `src/components/shapes/table/Table.tsx`
2. **Factory 함수**: `createTable()` in `factory.ts`
3. **Store 확장**: 테이블 관련 액션 슬라이스 (`src/store/slices/table.ts`)
4. **Toolbar 확장**: 테이블 도구 버튼 추가
5. **셀 편집 오버레이**: `TableCellEditorOverlay.tsx` (TextEditorOverlay 패턴 활용)

### Component Structure (Research-Enhanced)

```
src/components/shapes/table/
├── index.ts               # 외부 노출 인터페이스
├── Table.tsx              # 메인 테이블 컴포넌트 (Konva Group)
├── TableCellEditor.tsx    # 셀 텍스트 편집 오버레이 (DOM)
└── hooks/
    ├── useTableCellEditing.ts   # 셀 편집 상태 관리
    └── useTableOperations.ts    # 행/열 추가/삭제/리사이즈
```

**간소화 결정 (Simplicity Review):**
- `TableCell.tsx` 별도 파일 불필요 → Table.tsx 내부 함수로 처리
- `TableAddButton.tsx` 불필요 → 10줄 인라인 컴포넌트
- `TableRowHandle.tsx` → v2로 연기 (드래그 순서 변경 자체가 v2)

### Performance Implications (Research-Enhanced)

**Critical Optimizations:**

1. **Tiptap 지연 초기화** (메모리 95% 감소)
   - 셀당 Tiptap 인스턴스 X → 편집 중인 셀만 에디터 활성화
   - 비활성 셀은 정적 텍스트 렌더링

```tsx
// 비활성 셀: 정적 렌더링
const TableCellStatic = memo(({ content }) => (
  <Text text={tiptapToPlainText(content)} ... />
));

// 활성 셀: Tiptap 에디터 (DOM overlay)
const TableCellEditorOverlay = ({ cellId }) => {
  const editor = useMemo(() => new Editor({ ... }), []);
  return <EditorContent editor={editor} />;
};
```

2. **Konva Shape 통합** (노드 97% 감소)
   - 개별 Rect 대신 단일 Shape의 sceneFunc으로 모든 셀 배경 렌더링
   - 테두리도 단일 Shape으로 통합

```tsx
// 모든 셀 배경을 단일 Shape으로
<Shape
  sceneFunc={(ctx, shape) => {
    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < colCount; c++) {
        const cell = cells[`${r}-${c}`];
        ctx.fillStyle = cell?.backgroundColor || '#fff';
        ctx.fillRect(x, y, width, height);
      }
    }
    ctx.fillStrokeShape(shape);
  }}
  perfectDrawEnabled={false}
/>
```

3. **드래그 레이어 분리** (Context7 권장 패턴)

```tsx
// 드래그 시 별도 레이어로 이동
const handleDragStart = (e) => {
  const node = e.target;
  const dragLayer = node.getStage()?.findOne('#dragLayer');
  if (dragLayer) node.moveTo(dragLayer);
};

const handleDragEnd = (e) => {
  const node = e.target;
  const mainLayer = node.getStage()?.findOne('#mainLayer');
  if (mainLayer) node.moveTo(mainLayer);
};
```

### Konva Rendering Strategy (Research-Enhanced)

```
Table Group (perfectDrawEnabled: false)
├── Background Shape (모든 셀 배경 통합 - sceneFunc)
├── Grid Shape (모든 테두리 통합 - sceneFunc)
├── Add Buttons Group (조건부 - isSelected && !isDragging)
└── Selection Border (isMultiSelected)

// Overlay (React DOM, canvas 위에 absolute position)
└── TableCellEditorOverlay (editingCellId 있을 때만)
```

---

## Race Condition Handling (Research-Enhanced)

### 1. 셀 전환 상태 머신

```typescript
// 빠른 더블클릭으로 다른 셀 전환 시 발생하는 레이스 방지
type CellEditState =
  | { type: 'idle' }
  | { type: 'activating'; cellId: string }
  | { type: 'editing'; cellId: string }
  | { type: 'deactivating'; cellId: string; pendingCellId?: string };

// Store에서 상태 머신으로 관리
const useCellEditStateMachine = () => {
  const [state, setState] = useState<CellEditState>({ type: 'idle' });

  const startEdit = (cellId: string) => {
    if (state.type === 'deactivating') {
      // 이전 셀 정리 중이면 대기열에 추가
      setState({ ...state, pendingCellId: cellId });
      return;
    }
    setState({ type: 'activating', cellId });
  };

  // ...
};
```

### 2. 드래그 중 Store 업데이트 지연

```typescript
class RowDragCoordinator {
  private isDragging = false;
  private pendingUpdates: (() => void)[] = [];

  startDrag() { this.isDragging = true; }

  endDrag() {
    this.isDragging = false;
    this.pendingUpdates.forEach(fn => fn());
    this.pendingUpdates = [];
  }

  deferIfDragging(updateFn: () => void): boolean {
    if (this.isDragging) {
      this.pendingUpdates.push(updateFn);
      return true;
    }
    return false;
  }
}
```

### 3. Hover 억제

```typescript
// 드래그 중 hover 감지 비활성화
const handleMouseEnterRow = (rowIndex: number) => {
  if (isAnyDragActiveRef.current) return;
  if (editingCellId) return;  // 편집 중에도 억제
  setHoveredRowIndex(rowIndex);
};
```

### 4. Focus/Blur 타이밍

```typescript
// TextEditorOverlay 패턴 적용
const protectedRefsForBlur = useRef<Set<HTMLElement>>(new Set());

const handleBlur = useCallback((e?: React.FocusEvent) => {
  // 툴바 등 보호된 요소로 포커스 이동 시 무시
  if (e?.relatedTarget) {
    for (const el of protectedRefsForBlur.current) {
      if (el.contains(e.relatedTarget as Node)) return;
    }
  }
  // blur 처리
}, []);
```

---

## Implementation Phases (Simplified: 6 → 3)

### Phase 1: Core Table + Cell Editing (MVP)

**목표**: 2x2 테이블 생성 및 셀 편집

- [x] `types.ts`: ObjectType, Tool에 'table' 추가
- [x] `types.ts`: TableCell, TableData 인터페이스 정의
- [x] `utils/table.ts`: TableUtils 헬퍼 함수
- [x] `factory.ts`: `createTable()` 함수 구현
- [x] `src/components/shapes/Table.tsx`: 메인 테이블 컴포넌트
  - Konva Group + Shape (배경/테두리 통합)
  - 기존 Props 패턴 준수 (isMultiSelected, draggable, onDragStart 등)
  - SelectionBorder 적용
- [x] `src/components/tiptap/TableCellEditor.tsx`: DOM 오버레이 에디터
  - TiptapEditor 패턴 재사용
  - justOpenedRef 블러 방지
- [x] `Canvas.tsx`: 테이블 렌더링 케이스 추가
- [x] `Toolbar.tsx`: 테이블 도구 버튼 추가
- [x] `store/slices/table.ts`: 테이블 액션 슬라이스
  - `setEditingTableCell(tableId, cellKey, row, col)`
  - `updateTableCell(tableId, cellKey, updates)`

**산출물**: 클릭으로 2x2 테이블 생성, 셀 더블클릭으로 텍스트 편집

### Phase 2: Row/Column Addition + Resizing

**목표**: 행/열 동적 추가 및 테이블 리사이징

- [x] 테이블 우측 → 열 추가 버튼 (TableAddButtons 컴포넌트)
- [x] 테이블 하단 → 행 추가 버튼
- [x] Store 액션: `addTableRow()`, `addTableColumn()`
- [x] 행/열 삭제 (ContextMenu에 추가)
- [x] 테이블 전체 리사이징 (Transformer + 비례 스케일링)
- [x] Canvas.tsx handleTransformEnd에서 colWidths/rowHeights 스케일링

**산출물**: + 버튼으로 끝에 행/열 추가, 전체 리사이징

### Phase 3: Polish & Keyboard Navigation

**목표**: 완성도 향상

- [x] Tab → 다음 셀, Shift+Tab → 이전 셀
- [x] Enter → 다음 행
- [x] Undo/Redo 지원 (store equality에 tableData 비교 추가)
- [x] 테이블 복사/붙여넣기 (cloneTableData로 deep copy)
- [x] 테이블 삭제 (선택 후 Delete, editingTableCell 정리 포함)
- [x] 그리드 스냅 적용 (기존 그리드 스냅 시스템 활용)

---

## v2 Backlog (명시적 연기)

다음 기능은 MVP 이후 사용자 피드백에 따라 구현합니다:

- [ ] 행 드래그 순서 변경 (햄버거 핸들)
- [ ] 개별 열/행 리사이징 (경계선 드래그)
- [ ] 행/열 중간 삽입 버튼
- [ ] 셀 병합 (rowSpan, colSpan)
- [ ] 테이블 배경색/테두리색 커스터마이징
- [ ] 10x10+ 대형 테이블 가상화
- [ ] 헤더 행 스타일링

---

## Acceptance Criteria

### Functional Requirements

- [x] 툴바에서 테이블 도구 선택 후 캔버스 클릭으로 2x2 테이블 생성
- [x] 셀 더블클릭으로 텍스트 편집 (리치 텍스트 지원)
- [x] 테이블 선택 시 + 버튼으로 행/열 추가 (끝에)
- [x] 테이블 전체 리사이징 (Transformer)
- [x] Tab/Enter 키보드 네비게이션

### Non-Functional Requirements

- [x] 5x5 테이블까지 부드러운 렌더링 (Shape sceneFunc 통합)
- [x] 기존 Undo/Redo 시스템과 호환 (tableData equality 비교 추가)
- [x] localStorage 저장/복원 정상 동작

### Quality Gates

- [ ] Playwright 테스트: 테이블 생성, 셀 편집, 행/열 추가
- [x] 기존 테스트 통과 확인
- [x] 코드 포맷팅 (./scripts/convert-format-code.sh)

---

## Props Interface (Pattern Compliance)

```typescript
// 기존 Shape 컴포넌트와 일관된 Props
interface TableProps {
  shape: CanvasObject;
  isSelected: boolean;
  isMultiSelected?: boolean;      // 필수: 다중 선택 시 SelectionBorder
  zoom?: number;                  // 기본값 1
  draggable?: boolean;            // 기본값 true
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDoubleClick?: () => void;     // 테이블 더블클릭 (셀 외부)
  isEditing?: boolean;            // 셀 편집 중 여부
}
```

---

## File Structure

### New Files

```
src/components/shapes/table/
├── index.ts                    # export { Table }
├── Table.tsx                   # 메인 테이블 컴포넌트
├── TableCellEditor.tsx         # 셀 편집 오버레이 (DOM)
└── hooks/
    └── useTableCellEditing.ts  # 셀 편집 상태 관리

src/utils/table.ts              # TableUtils 헬퍼
src/store/slices/table.ts       # 테이블 Store 액션
```

### Modified Files

```
src/types.ts                    # ObjectType, Tool, TableData, TableCell
src/utils/factory.ts            # createTable() 추가
src/components/Toolbar.tsx      # 테이블 도구 버튼 추가
src/components/Canvas.tsx       # 테이블 렌더링 케이스 추가
src/store.ts                    # table 슬라이스 통합
```

---

## MVP Code Examples

### factory.ts - createTable()

```typescript
export function createTable(
  x: number,
  y: number,
  rows: number = 2,
  cols: number = 2,
  author?: AuthorInfo,
): CanvasObject {
  const table = TableUtils.createEmptyTable(rows, cols);

  return {
    id: nanoid(),
    type: 'table',
    x,
    y,
    width: table.colWidths.reduce((sum, w) => sum + w, 0),
    height: table.rowHeights.reduce((sum, h) => sum + h, 0),
    table,
    rotation: 0,
    opacity: 1,
    authorId: author?.authorId,
    authorName: author?.authorName,
  };
}
```

### Table.tsx - Component Structure

```tsx
export const Table = memo(function Table({
  shape,
  isSelected: _isSelected,
  isMultiSelected = false,
  zoom = 1,
  draggable = true,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDoubleClick,
}: TableProps) {
  void _isSelected;  // Transformer handles single selection

  const table = shape.table;
  if (!table) return null;

  const width = shape.width ?? 300;
  const height = shape.height ?? 100;
  const isLocked = shape.locked === true;

  return (
    <Group
      id={shape.id}
      x={shape.x}
      y={shape.y}
      rotation={shape.rotation}
      opacity={shape.opacity}
      draggable={draggable}
      onClick={onSelect}
      onTap={onSelect}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDblClick={onDoubleClick}
      onDblTap={onDoubleClick}
    >
      <SelectionBorder
        width={width}
        height={height}
        zoom={zoom}
        isMultiSelected={isMultiSelected}
      />

      {/* 통합 배경/셀 렌더링 (성능 최적화) */}
      <Shape
        sceneFunc={(ctx, shape) => {
          // 배경
          ctx.fillStyle = table.backgroundColor ?? '#ffffff';
          ctx.fillRect(0, 0, width, height);

          // 테두리
          ctx.strokeStyle = isLocked ? '#ef4444' : table.borderColor;
          ctx.lineWidth = isLocked ? 2 : 1;
          if (isLocked) ctx.setLineDash([8, 4]);

          // 그리드 라인
          let y = 0;
          for (let r = 0; r <= table.rowCount; r++) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
            y += table.rowHeights[r] ?? 0;
          }

          let x = 0;
          for (let c = 0; c <= table.colCount; c++) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
            x += table.colWidths[c] ?? 0;
          }

          ctx.fillStrokeShape(shape);
        }}
        perfectDrawEnabled={false}
        listening={false}
      />

      {/* 셀 텍스트 (정적 렌더링) */}
      {renderCellTexts(table)}

      {/* 추가 버튼 (Phase 2) */}
      {isSelected && !isDragging && (
        <>
          {renderAddColumnButton(table, width, height)}
          {renderAddRowButton(table, width, height)}
        </>
      )}
    </Group>
  );
});
```

### Store Slice - table.ts

```typescript
export interface TableSlice {
  editingCellTarget: { tableId: string; cellId: string } | null;

  setEditingCell: (tableId: string, cellId: string) => void;
  clearEditingCell: () => void;
  updateTableCell: (tableId: string, cellId: string, updates: Partial<TableCell>) => void;
  addTableRow: (tableId: string) => void;
  addTableColumn: (tableId: string) => void;
  deleteTableRow: (tableId: string, rowIndex: number) => void;
  deleteTableColumn: (tableId: string, colIndex: number) => void;
}

export const createTableSlice: StateCreator<TableSlice> = (set, get) => ({
  editingCellTarget: null,

  setEditingCell: (tableId, cellId) =>
    set({ editingCellTarget: { tableId, cellId } }),

  clearEditingCell: () =>
    set({ editingCellTarget: null }),

  updateTableCell: (tableId, cellId, updates) =>
    set(state => ({
      objects: state.objects.map(obj => {
        if (obj.id !== tableId || !obj.table) return obj;
        return {
          ...obj,
          table: {
            ...obj.table,
            cells: {
              ...obj.table.cells,
              [cellId]: { ...obj.table.cells[cellId], ...updates },
            },
          },
        };
      }),
    })),

  addTableRow: (tableId) =>
    set(state => ({
      objects: state.objects.map(obj => {
        if (obj.id !== tableId || !obj.table) return obj;
        const { table } = obj;
        const newRowIndex = table.rowCount;
        const newCells = { ...table.cells };

        for (let c = 0; c < table.colCount; c++) {
          newCells[`${newRowIndex}-${c}`] = { id: nanoid() };
        }

        return {
          ...obj,
          height: (obj.height ?? 0) + table.defaultRowHeight,
          table: {
            ...table,
            rowCount: table.rowCount + 1,
            rowHeights: [...table.rowHeights, table.defaultRowHeight],
            cells: newCells,
          },
        };
      }),
    })),

  // ... 나머지 액션
});
```

---

## Dependencies & Risks

### Dependencies

- Tiptap 에디터 (이미 구현됨)
- Konva/React-Konva (이미 사용 중)
- Zustand 상태 관리

### Risks (Research-Enhanced)

| 리스크 | 영향도 | 완화 방안 |
|--------|--------|----------|
| Tiptap 인스턴스 메모리 | 높음 | 편집 중인 셀만 에디터 활성화 (지연 초기화) |
| 레이스 컨디션 (셀 전환) | 높음 | 상태 머신 + justOpenedRef 패턴 |
| 드래그 중 상태 충돌 | 중간 | RowDragCoordinator로 업데이트 지연 |
| 대형 테이블 성능 | 중간 | Shape 통합 렌더링, v2에서 가상화 |
| blur/focus 타이밍 | 중간 | protectedRefsForBlur 패턴 |

---

## Performance Benchmarks (Target)

| 시나리오 | 목표 | 측정 방법 |
|----------|------|----------|
| 2x2 테이블 초기 렌더링 | <8ms | `performance.now()` |
| 5x5 테이블 초기 렌더링 | <16ms | `performance.now()` |
| 셀 편집 시작 (Tiptap 마운트) | <50ms | `performance.now()` |
| 행 추가 | <16ms | `performance.now()` |

---

## References & Research

### Internal References

- StickyNote 패턴: `src/components/shapes/StickyNote.tsx`
- Factory 패턴: `src/utils/factory.ts`
- Tiptap 에디터: `src/components/tiptap/TextEditorOverlay.tsx`
- 타입 정의: `src/types.ts:143-227`
- dragCoordinator 패턴: `src/hooks/useDragCoordinator.ts`

### External References (Context7)

- [React-Konva Transformer](https://konvajs.org/docs/react/Transformer.html) - 리사이징 패턴
- [Konva Performance Tips](https://konvajs.org/docs/performance/All_Performance_Tips.html) - perfectDrawEnabled, 드래그 레이어 분리
- [Konva Drag Group](https://konvajs.org/docs/drag_and_drop/Drag_a_Group.html) - Group 드래그 패턴

### Research Sources

- react-konva-grid npm 패키지 - 캔버스 테이블 그리드 참고
- Tiptap Table Extension - 테이블 리치 텍스트 편집
- TLDraw RichTextArea - 캔버스 리치 텍스트 통합 사례
