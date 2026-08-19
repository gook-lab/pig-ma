import { describe, it, expect } from "vitest";
import {
  createDefaultTableData,
  addRow,
  addColumn,
  deleteRow,
  deleteColumn,
  reorderRow,
  reorderColumn,
  getCellKey,
  getCell,
  setCell,
  getTableWidth,
  getTableHeight,
  getNextCellKey,
  getPrevCellKey,
  getCellBelowKey,
  cloneTableData,
  getCellBounds,
} from "./table";
import type { TableData } from "@/types";

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

/** 각 셀에 "r,c" 를 심어 이동/보존을 추적할 수 있게 만든 테이블 */
function labeled(rows: number, cols: number): TableData {
  let data = createDefaultTableData();
  while (data.rowCount < rows) data = addRow(data);
  while (data.rowCount > rows) data = deleteRow(data, data.rowCount - 1)!;
  while (data.colCount < cols) data = addColumn(data);
  while (data.colCount > cols) data = deleteColumn(data, data.colCount - 1)!;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // setCell 은 셀을 통째로 교체한다 — id 등 기존 필드를 유지해야 한다
      const existing = getCell(data, r, c)!;
      data = setCell(data, r, c, {
        ...existing,
        backgroundColor: `#${r}${c}`,
      });
    }
  }
  return data;
}

/** 셀에 심어둔 라벨을 격자로 뽑는다 */
function grid(data: TableData): string[][] {
  return Array.from({ length: data.rowCount }, (_, r) =>
    Array.from(
      { length: data.colCount },
      (_, c) => getCell(data, r, c)?.backgroundColor ?? "-",
    ),
  );
}

/** 구조가 스스로 모순되지 않는지 — 모든 연산 뒤에 항상 성립해야 한다 */
function expectConsistent(data: TableData) {
  expect(data.rowHeights).toHaveLength(data.rowCount);
  expect(data.colWidths).toHaveLength(data.colCount);

  const keys = Object.keys(data.cells);
  expect(keys).toHaveLength(data.rowCount * data.colCount);

  for (const key of keys) {
    const [r, c] = key.split("-").map(Number);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(data.rowCount);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThan(data.colCount);
  }

  // 셀 id 는 중복되면 안 된다 (진행도·측정 높이가 엉뚱한 셀에 붙는다)
  const ids = keys.map((k) => data.cells[k]!.id);
  expect(new Set(ids).size).toBe(ids.length);
}

// ---------------------------------------------------------------------------

describe("기본 테이블", () => {
  it("행·열 수와 배열 길이가 맞는다", () => {
    expectConsistent(createDefaultTableData());
  });

  it("너비/높이는 열너비·행높이의 합이다", () => {
    const d = labeled(3, 4);
    expect(getTableWidth(d)).toBe(d.colWidths.reduce((a, b) => a + b, 0));
    expect(getTableHeight(d)).toBe(d.rowHeights.reduce((a, b) => a + b, 0));
  });
});

describe("행 추가", () => {
  it("맨 뒤에 추가하면 기존 내용이 그대로다", () => {
    const before = labeled(3, 3);
    const after = addRow(before);

    expectConsistent(after);
    expect(after.rowCount).toBe(4);
    expect(grid(after).slice(0, 3)).toEqual(grid(before));
  });

  it("가운데 삽입하면 아래 행들이 한 칸씩 밀린다", () => {
    const before = labeled(3, 2);
    const after = addRow(before, 0); // 0행 '다음'에 삽입

    expectConsistent(after);
    expect(grid(after)[0]).toEqual(["#00", "#01"]); // 원래 0행
    expect(grid(after)[1]).toEqual(["-", "-"]); // 새 행
    expect(grid(after)[2]).toEqual(["#10", "#11"]); // 밀린 1행
    expect(grid(after)[3]).toEqual(["#20", "#21"]);
  });

  it("원본을 변경하지 않는다", () => {
    const before = labeled(2, 2);
    const snapshot = JSON.stringify(before);
    addRow(before);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe("열 추가", () => {
  it("가운데 삽입하면 오른쪽 열들이 밀린다", () => {
    const before = labeled(2, 3);
    const after = addColumn(before, 0);

    expectConsistent(after);
    expect(grid(after)[0]).toEqual(["#00", "-", "#01", "#02"]);
    expect(grid(after)[1]).toEqual(["#10", "-", "#11", "#12"]);
  });
});

describe("행 삭제", () => {
  it("가운데 행을 지우면 아래가 당겨진다", () => {
    const before = labeled(3, 2);
    const after = deleteRow(before, 1)!;

    expect(after).not.toBeNull();
    expectConsistent(after);
    expect(grid(after)).toEqual([
      ["#00", "#01"],
      ["#20", "#21"],
    ]);
  });

  it("마지막 한 행은 지울 수 없다", () => {
    let d = labeled(1, 2);
    expect(deleteRow(d, 0)).toBeNull();
    d = labeled(2, 2);
    expect(deleteRow(d, 0)).not.toBeNull();
  });

  it("추가 → 삭제하면 원래 격자로 돌아온다", () => {
    const before = labeled(3, 3);
    const after = deleteRow(addRow(before, 1), 2)!;
    expect(grid(after)).toEqual(grid(before));
  });
});

describe("열 삭제", () => {
  it("가운데 열을 지우면 오른쪽이 당겨진다", () => {
    const after = deleteColumn(labeled(2, 3), 1)!;
    expectConsistent(after);
    expect(grid(after)).toEqual([
      ["#00", "#02"],
      ["#10", "#12"],
    ]);
  });

  it("마지막 한 열은 지울 수 없다", () => {
    expect(deleteColumn(labeled(2, 1), 0)).toBeNull();
  });
});

describe("행 순서 변경", () => {
  it("위로 옮기면 사이 행들이 아래로 밀린다", () => {
    const after = reorderRow(labeled(3, 2), 2, 0);
    expectConsistent(after);
    expect(grid(after)).toEqual([
      ["#20", "#21"],
      ["#00", "#01"],
      ["#10", "#11"],
    ]);
  });

  it("아래로 옮겨도 데이터가 유실되지 않는다 (순열이다)", () => {
    const before = labeled(4, 2);
    const after = reorderRow(before, 0, 3);
    expectConsistent(after);
    expect(grid(after).flat().sort()).toEqual(grid(before).flat().sort());
  });

  it("행 높이도 함께 따라간다", () => {
    let d = labeled(3, 2);
    d = { ...d, rowHeights: [10, 20, 30] };
    expect(reorderRow(d, 2, 0).rowHeights).toEqual([30, 10, 20]);
  });

  it("범위 밖이거나 제자리면 그대로 반환한다", () => {
    const d = labeled(3, 2);
    expect(reorderRow(d, 1, 1)).toBe(d);
    expect(reorderRow(d, -1, 0)).toBe(d);
    expect(reorderRow(d, 0, 99)).toBe(d);
  });
});

describe("열 순서 변경", () => {
  it("열을 옮기면 내용과 너비가 같이 간다", () => {
    let d = labeled(2, 3);
    d = { ...d, colWidths: [100, 200, 300] };
    const after = reorderColumn(d, 2, 0);

    expectConsistent(after);
    expect(grid(after)).toEqual([
      ["#02", "#00", "#01"],
      ["#12", "#10", "#11"],
    ]);
    expect(after.colWidths).toEqual([300, 100, 200]);
  });
});

describe("셀 좌표", () => {
  it("getCellBounds 는 앞선 열/행의 누적 크기를 쓴다", () => {
    let d = labeled(2, 3);
    d = { ...d, colWidths: [100, 200, 300], rowHeights: [10, 20] };

    expect(getCellBounds(d, 0, 0)).toMatchObject({
      x: 0,
      y: 0,
      width: 100,
      height: 10,
    });
    expect(getCellBounds(d, 1, 2)).toMatchObject({
      x: 300,
      y: 10,
      width: 300,
      height: 20,
    });
  });
});

describe("Tab 네비게이션", () => {
  const d = labeled(2, 3);

  it("행 끝에서 다음 행 첫 칸으로 넘어간다", () => {
    expect(getNextCellKey(d, 0, 2)).toBe(getCellKey(1, 0));
  });

  it("마지막 셀에서는 null 이다", () => {
    expect(getNextCellKey(d, 1, 2)).toBeNull();
  });

  it("행 처음에서 이전 행 끝으로 간다", () => {
    expect(getPrevCellKey(d, 1, 0)).toBe(getCellKey(0, 2));
  });

  it("첫 셀에서는 null 이다", () => {
    expect(getPrevCellKey(d, 0, 0)).toBeNull();
  });

  it("아래 셀은 마지막 행에서 null 이다", () => {
    expect(getCellBelowKey(d, 0, 1)).toBe(getCellKey(1, 1));
    expect(getCellBelowKey(d, 1, 1)).toBeNull();
  });
});

describe("복제", () => {
  it("깊은 복사라 원본이 오염되지 않는다", () => {
    const before = labeled(2, 2);
    const copy = cloneTableData(before);
    const cell = getCell(copy, 0, 0);
    const mutated = setCell(copy, 0, 0, {
      ...cell,
      backgroundColor: "#zz",
      id: cell?.id ?? "0-0",
    });

    expect(getCell(before, 0, 0)?.backgroundColor).toBe("#00");
    expect(getCell(mutated, 0, 0)?.backgroundColor).toBe("#zz");
  });
});

describe("연속 편집 후에도 구조가 무너지지 않는다", () => {
  it("추가·삭제·재정렬을 섞어도 불변식이 유지된다", () => {
    let d = labeled(3, 3);
    const ops: Array<(t: TableData) => TableData> = [
      (t) => addRow(t, 1),
      (t) => addColumn(t, 0),
      (t) => deleteRow(t, 0) ?? t,
      (t) => reorderColumn(t, 3, 1),
      (t) => deleteColumn(t, 2) ?? t,
      (t) => reorderRow(t, 0, 2),
      (t) => addRow(t),
      (t) => deleteColumn(t, 0) ?? t,
    ];
    for (const op of ops) {
      d = op(d);
      expectConsistent(d);
    }
  });
});
