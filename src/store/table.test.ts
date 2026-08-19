import { describe, it, expect, beforeEach } from "vitest";
import { useCanvasStore } from "./index";
import { createTable } from "@/utils/factory";
import { getCellKey, getTableHeight, getTableWidth } from "@/utils/table";
import { TABLE_CELL } from "@/constants/table";
import type { CanvasObject } from "@/types";

const store = () => useCanvasStore.getState();
const table = () =>
  store().objects.find((o) => o.type === "table") as CanvasObject;

let id = "";

beforeEach(() => {
  store().clearAllObjects();
  store().setEditingTableCell(null);
  const t = createTable(0, 0);
  id = t.id;
  store().addObject(t);
});

describe("행/열 추가·삭제", () => {
  it("행을 추가하면 객체 높이도 같이 커진다", () => {
    const before = table().height!;
    store().addTableRow(id);

    expect(table().tableData!.rowCount).toBe(3);
    expect(table().height).toBe(getTableHeight(table().tableData!));
    expect(table().height!).toBeGreaterThan(before);
  });

  it("열을 추가하면 객체 너비도 같이 커진다", () => {
    const before = table().width!;
    store().addTableColumn(id);

    expect(table().width).toBe(getTableWidth(table().tableData!));
    expect(table().width!).toBeGreaterThan(before);
  });

  it("마지막 남은 행은 지워지지 않는다", () => {
    store().deleteTableRow(id, 0); // 2 → 1
    expect(table().tableData!.rowCount).toBe(1);

    store().deleteTableRow(id, 0); // 그대로여야 한다
    expect(table().tableData!.rowCount).toBe(1);
  });

  it("다른 테이블 id 를 주면 아무것도 바뀌지 않는다", () => {
    const before = JSON.stringify(table().tableData);
    store().addTableRow("없는테이블");
    expect(JSON.stringify(table().tableData)).toBe(before);
  });
});

describe("행 삭제 시 편집 중이던 셀 처리", () => {
  it("편집 중인 행이 지워지면 편집 상태가 해제된다", () => {
    store().setEditingTableCell({
      tableId: id,
      row: 1,
      col: 0,
      cellKey: getCellKey(1, 0),
    });

    store().deleteTableRow(id, 1);

    expect(store().editingTableCell).toBeNull();
  });

  it("위쪽 행이 지워지면 편집 중인 셀의 인덱스가 당겨진다", () => {
    store().addTableRow(id); // 3행
    store().setEditingTableCell({
      tableId: id,
      row: 2,
      col: 1,
      cellKey: getCellKey(2, 1),
    });

    store().deleteTableRow(id, 0);

    expect(store().editingTableCell).toMatchObject({
      row: 1,
      col: 1,
      cellKey: getCellKey(1, 1),
    });
  });

  it("아래쪽 행이 지워지면 편집 중인 셀은 그대로다", () => {
    store().addTableRow(id);
    store().setEditingTableCell({
      tableId: id,
      row: 0,
      col: 0,
      cellKey: getCellKey(0, 0),
    });

    store().deleteTableRow(id, 2);

    expect(store().editingTableCell).toMatchObject({ row: 0, col: 0 });
  });
});

describe("테이블을 통째로 지울 때", () => {
  it("편집 중이던 셀 상태도 함께 정리된다", () => {
    store().setEditingTableCell({
      tableId: id,
      row: 0,
      col: 0,
      cellKey: getCellKey(0, 0),
    });

    store().deleteObjects([id]);

    expect(store().editingTableCell).toBeNull();
  });
});

describe("행/열 크기 조절", () => {
  it("행 높이를 바꾸면 객체 높이가 따라온다", () => {
    store().resizeTableRow(id, 0, 200);

    expect(table().tableData!.rowHeights[0]).toBe(200);
    expect(table().height).toBe(getTableHeight(table().tableData!));
  });

  it("최소 크기 아래로는 줄어들지 않는다", () => {
    store().resizeTableRow(id, 0, 1);
    store().resizeTableColumn(id, 0, 1);

    expect(table().tableData!.rowHeights[0]!).toBeGreaterThanOrEqual(
      TABLE_CELL.minRowHeight,
    );
    expect(table().tableData!.colWidths[0]!).toBeGreaterThanOrEqual(
      TABLE_CELL.minColWidth,
    );
  });
});

describe("자동 행 높이 (autoFitRowHeight)", () => {
  it("측정 높이가 기본 행 높이보다 작으면 행이 줄어들지 않는다", () => {
    const before = table().tableData!.rowHeights[0];
    store().autoFitRowHeight(id, 0, getCellKey(0, 0), 5);

    expect(table().tableData!.rowHeights[0]).toBe(before);
  });

  it("내용이 길면 행이 커진다 (상하 패딩 포함)", () => {
    const measured = 120;
    store().autoFitRowHeight(id, 0, getCellKey(0, 0), measured);

    const padding = TABLE_CELL.padding.top + TABLE_CELL.padding.bottom;
    expect(table().tableData!.rowHeights[0]).toBe(measured + padding);
  });

  it("같은 행에서 가장 큰 셀이 행 높이를 정한다", () => {
    store().autoFitRowHeight(id, 0, getCellKey(0, 0), 120);
    store().autoFitRowHeight(id, 0, getCellKey(0, 1), 60);

    const padding = TABLE_CELL.padding.top + TABLE_CELL.padding.bottom;
    // 작은 셀을 나중에 측정해도 큰 쪽이 유지돼야 한다
    expect(table().tableData!.rowHeights[0]).toBe(120 + padding);
  });

  it("큰 셀의 내용이 줄어들면 행도 다시 줄어든다", () => {
    store().autoFitRowHeight(id, 0, getCellKey(0, 0), 200);
    store().autoFitRowHeight(id, 0, getCellKey(0, 0), 30);

    const padding = TABLE_CELL.padding.top + TABLE_CELL.padding.bottom;
    expect(table().tableData!.rowHeights[0]).toBe(
      Math.max(30 + padding, table().tableData!.defaultRowHeight),
    );
  });

  it("행 높이가 바뀌면 객체 높이도 동기화된다", () => {
    store().autoFitRowHeight(id, 0, getCellKey(0, 0), 300);
    expect(table().height).toBe(getTableHeight(table().tableData!));
  });
});

describe("셀 순서 변경", () => {
  it("행을 옮겨도 셀 개수가 유지된다", () => {
    store().addTableRow(id);
    const before = Object.keys(table().tableData!.cells).length;

    store().reorderTableRow(id, 0, 2);

    expect(Object.keys(table().tableData!.cells)).toHaveLength(before);
  });

  it("열을 옮겨도 셀 개수가 유지된다", () => {
    store().addTableColumn(id);
    const before = Object.keys(table().tableData!.cells).length;

    store().reorderTableColumn(id, 2, 0);

    expect(Object.keys(table().tableData!.cells)).toHaveLength(before);
  });
});
