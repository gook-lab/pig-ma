import { describe, it, expect, beforeEach } from "vitest";
import { useCanvasStore } from "./index";
import { createShape, createTable, createTextBox } from "@/utils/factory";
import { getCellKey } from "@/utils/table";
import type { ShapeSettings } from "@/types";

/**
 * 고스트 상태 = 이미 사라진 객체의 id 를 상태가 계속 들고 있는 것.
 *
 * 눈에 잘 안 띄지만 결과가 고약하다:
 *  - draggingIds 에 남으면 그 id 는 영원히 "드래그 중"이라 렌더 최적화가 어긋난다
 *  - editingTextId 가 남으면 다음에 같은 자리를 클릭할 때 편집기가 헛돈다
 *  - table 관련 상태가 남으면 없는 테이블을 향해 액션이 날아간다
 */

const SETTINGS = {
  fill: "#fff",
  stroke: "#000",
  strokeWidth: 2,
} as unknown as ShapeSettings;

const store = () => useCanvasStore.getState();
const shape = (x = 0, y = 0) => createShape(x, y, "rectangle", SETTINGS);

beforeEach(() => {
  store().clearAllObjects();
  store().clearDraggingIds();
  store().setEditingTextId(null);
  store().setEditingTableCell(null);
  store().setSelectedTableCells(null);
  store().setTableDragState(null);
});

describe("객체를 지우면 그 id 가 어디에도 남지 않는다", () => {
  it("draggingIds", () => {
    const a = shape();
    store().addObject(a);
    store().addDraggingIds([a.id]);

    store().deleteObjects([a.id]);

    expect(store().draggingIds).not.toContain(a.id);
  });

  it("draggingIds — 남은 객체는 유지된다", () => {
    const a = shape(0, 0);
    const b = shape(200, 0);
    [a, b].forEach(store().addObject);
    store().addDraggingIds([a.id, b.id]);

    store().deleteObjects([a.id]);

    expect(store().draggingIds).toEqual([b.id]);
  });

  it("editingTextId", () => {
    const t = createTextBox(0, 0);
    store().addObject(t);
    store().setEditingTextId(t.id);

    store().deleteObjects([t.id]);

    expect(store().editingTextId).toBeNull();
  });

  it("editingTextId — 다른 객체를 지울 때는 유지된다", () => {
    const t = createTextBox(0, 0);
    const other = shape(300, 0);
    [t, other].forEach(store().addObject);
    store().setEditingTextId(t.id);

    store().deleteObjects([other.id]);

    expect(store().editingTextId).toBe(t.id);
  });

  it("selectedTableCells", () => {
    const t = createTable(0, 0);
    store().addObject(t);
    store().setSelectedTableCells({
      tableId: t.id,
      startRow: 0,
      startCol: 0,
      endRow: 1,
      endCol: 1,
    });

    store().deleteObjects([t.id]);

    expect(store().selectedTableCells).toBeNull();
  });

  it("tableDragState", () => {
    const t = createTable(0, 0);
    store().addObject(t);
    store().setTableDragState({
      tableId: t.id,
      type: "row",
      dragIndex: 0,
      dragOverIndex: 1,
    });

    store().deleteObjects([t.id]);

    expect(store().tableDragState).toBeNull();
  });

  it("editingTableCell (이미 처리되던 것 — 회귀 방지)", () => {
    const t = createTable(0, 0);
    store().addObject(t);
    store().setEditingTableCell({
      tableId: t.id,
      row: 0,
      col: 0,
      cellKey: getCellKey(0, 0),
    });

    store().deleteObjects([t.id]);

    expect(store().editingTableCell).toBeNull();
  });

  it("여러 종류를 한 번에 지워도 전부 정리된다", () => {
    const s = shape(0, 0);
    const t = createTable(300, 0);
    const tx = createTextBox(600, 0);
    [s, t, tx].forEach(store().addObject);

    store().addDraggingIds([s.id]);
    store().setEditingTextId(tx.id);
    store().setSelectedTableCells({
      tableId: t.id,
      startRow: 0,
      startCol: 0,
      endRow: 0,
      endCol: 0,
    });
    store().setTableDragState({
      tableId: t.id,
      type: "column",
      dragIndex: 0,
      dragOverIndex: 1,
    });

    store().deleteObjects([s.id, t.id, tx.id]);

    expect(store().draggingIds).toEqual([]);
    expect(store().editingTextId).toBeNull();
    expect(store().selectedTableCells).toBeNull();
    expect(store().tableDragState).toBeNull();
  });
});

describe("clearAllObjects 도 같은 상태를 비운다", () => {
  it("전체 삭제 후 잔재가 없다", () => {
    const s = shape();
    const t = createTable(300, 0);
    [s, t].forEach(store().addObject);
    store().addDraggingIds([s.id]);
    store().setEditingTextId(s.id);
    store().setSelectedTableCells({
      tableId: t.id,
      startRow: 0,
      startCol: 0,
      endRow: 0,
      endCol: 0,
    });

    store().clearAllObjects();

    expect(store().draggingIds).toEqual([]);
    expect(store().editingTextId).toBeNull();
    expect(store().selectedTableCells).toBeNull();
    expect(store().tableDragState).toBeNull();
    expect(store().editingTableCell).toBeNull();
  });
});
