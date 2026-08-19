import { describe, it, expect } from "vitest";
import {
  createShape,
  createRectangle,
  createStickyNote,
  createTextBox,
  createLine,
  createImage,
  createConnector,
  createArrow,
  createTable,
  createCodeBlock,
  cloneShape,
  snapToGrid,
  snapToShapeGrid,
  getDefaultShapeSize,
  GRID_SIZE,
} from "./factory";
import { getObjectBounds } from "./geometry";
import type { CanvasObject, ShapeSettings, PenSettings } from "@/types";

const SHAPE_SETTINGS = {
  fill: "#ffffff",
  stroke: "#000000",
  strokeWidth: 2,
} as unknown as ShapeSettings;

const PEN_SETTINGS = {
  penType: "pen",
  color: "#000000",
  strokeWidth: 4,
} as unknown as PenSettings;

/** 모든 팩토리 결과가 지켜야 하는 최소 계약 */
function expectValidObject(o: CanvasObject) {
  expect(typeof o.id).toBe("string");
  expect(o.id.length).toBeGreaterThan(0);
  expect(typeof o.type).toBe("string");
  expect(Number.isFinite(o.x)).toBe(true);
  expect(Number.isFinite(o.y)).toBe(true);

  // bounds 를 못 구하면 선택·정렬·가상화가 전부 깨진다
  const b = getObjectBounds(o);
  expect(Number.isFinite(b.x)).toBe(true);
  expect(Number.isFinite(b.y)).toBe(true);
  expect(b.width).toBeGreaterThan(0);
  expect(b.height).toBeGreaterThan(0);
}

describe("모든 팩토리는 유효한 객체를 만든다", () => {
  const made: Array<[string, CanvasObject]> = [
    ["shape", createShape(10, 20, "circle", SHAPE_SETTINGS)],
    ["rectangle", createRectangle(10, 20, SHAPE_SETTINGS)],
    ["stickyNote", createStickyNote(10, 20)],
    ["textBox", createTextBox(10, 20)],
    ["line", createLine(10, 20, [0, 0, 30, 40], PEN_SETTINGS)],
    ["image", createImage(10, 20, "data:image/png;base64,xx", 100, 50)],
    ["connector", createConnector("a", "b", "right", "left")],
    ["arrow", createArrow(0, 0, 100, 100)],
    ["table", createTable(10, 20)],
    ["codeBlock", createCodeBlock(10, 20)],
  ];

  it.each(made)("%s", (_n, obj) => expectValidObject(obj));

  it("id 는 서로 겹치지 않는다", () => {
    const ids = Array.from(
      { length: 50 },
      () => createShape(0, 0, "rectangle", SHAPE_SETTINGS).id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("createShape", () => {
  it("요청한 위치와 변형(variant)을 지킨다", () => {
    const s = createShape(123, 456, "diamond", SHAPE_SETTINGS);
    expect(s).toMatchObject({ x: 123, y: 456, shapeVariant: "diamond" });
  });

  it("createRectangle 은 createShape 의 rectangle 위임이다", () => {
    const r = createRectangle(50, 60, SHAPE_SETTINGS);
    expect(r.shapeVariant).toBe("rectangle");
  });

  it("변형마다 기본 크기가 정의돼 있다", () => {
    for (const v of ["rectangle", "circle", "ellipse", "diamond"] as const) {
      const size = getDefaultShapeSize(v);
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
    }
  });
});

describe("createStickyNote", () => {
  it("배경색을 지정할 수 있다", () => {
    expect(createStickyNote(0, 0, "#FEF08A").backgroundColor).toBe("#FEF08A");
  });

  it("생략하면 기본 색이 들어간다", () => {
    expect(createStickyNote(0, 0).backgroundColor).toBeTruthy();
  });
});

describe("createConnector / createArrow", () => {
  it("커넥터는 양쪽 id 와 앵커를 기억한다", () => {
    const c = createConnector("src", "tgt", "bottom", "top");
    expect(c).toMatchObject({
      type: "connector",
      sourceId: "src",
      targetId: "tgt",
      sourceAnchor: "bottom",
      targetAnchor: "top",
    });
  });

  it("화살표는 시작·끝 좌표를 갖는다", () => {
    const a = createArrow(10, 20, 300, 400);
    expect(a).toMatchObject({ x: 10, y: 20, endX: 300, endY: 400 });
  });

  it("화살표에 도형 연결을 옵션으로 줄 수 있다", () => {
    const a = createArrow(0, 0, 10, 10, { sourceId: "s", targetId: "t" });
    expect(a).toMatchObject({ sourceId: "s", targetId: "t" });
  });
});

describe("createTable", () => {
  it("크기가 테이블 데이터와 일치한다", () => {
    const t = createTable(0, 0);
    const sumW = t.tableData!.colWidths.reduce((a, b) => a + b, 0);
    const sumH = t.tableData!.rowHeights.reduce((a, b) => a + b, 0);

    expect(t.width).toBe(sumW);
    expect(t.height).toBe(sumH);
  });

  it("셀이 행×열 만큼 만들어진다", () => {
    const d = createTable(0, 0).tableData!;
    expect(Object.keys(d.cells)).toHaveLength(d.rowCount * d.colCount);
  });
});

describe("cloneShape", () => {
  const OFFSET = { x: 200, y: 0 };

  it("새 id 를 받고 offset 만큼 밀린다", () => {
    const a = createShape(50, 60, "rectangle", SHAPE_SETTINGS);
    const b = cloneShape(a, OFFSET);

    expect(b.id).not.toBe(a.id);
    expect(b).toMatchObject({ x: 250, y: 60 });
  });

  it("원본을 건드리지 않는다", () => {
    const a = createShape(0, 0, "rectangle", SHAPE_SETTINGS);
    const snapshot = JSON.stringify(a);
    cloneShape(a, OFFSET);
    expect(JSON.stringify(a)).toBe(snapshot);
  });

  // 앵커를 끌어 도형을 복제하는 흐름(Canvas.tsx)에서 테이블도 복제된다.
  // 얕은 복사면 두 테이블이 같은 tableData 를 공유해서, 한쪽 셀을 고치면
  // 다른 쪽도 바뀐다.
  it("테이블을 복제하면 셀이 참조 공유되지 않는다", () => {
    const t = createTable(0, 0);
    const c = cloneShape(t, OFFSET);

    expect(c.tableData).not.toBe(t.tableData);
    expect(c.tableData!.cells["0-0"]).not.toBe(t.tableData!.cells["0-0"]);
  });

  it("커넥터 라벨 참조를 물려받지 않는다", () => {
    const withLabel = {
      ...createConnector("a", "b", "right", "left"),
      labelTextBoxId: "원본라벨",
    } as CanvasObject;
    const c = cloneShape(withLabel, OFFSET);

    expect(
      (c as CanvasObject & { labelTextBoxId?: string }).labelTextBoxId,
    ).toBeUndefined();
  });
});

describe("그리드 스냅", () => {
  it("가장 가까운 격자로 붙는다", () => {
    expect(snapToGrid(0)).toBe(0);
    expect(snapToGrid(GRID_SIZE * 3 + 1)).toBe(GRID_SIZE * 3);
    expect(snapToGrid(GRID_SIZE * 3 - 1)).toBe(GRID_SIZE * 3);
  });

  it("음수도 처리한다", () => {
    expect(Number.isFinite(snapToGrid(-37))).toBe(true);
    expect(snapToGrid(-GRID_SIZE * 2)).toBe(-GRID_SIZE * 2);
  });

  it("이미 격자 위면 그대로다 (멱등)", () => {
    for (const v of [0, GRID_SIZE, GRID_SIZE * 7, -GRID_SIZE * 4]) {
      expect(snapToGrid(v)).toBe(v);
      expect(snapToGrid(snapToGrid(v))).toBe(snapToGrid(v));
    }
  });

  it("도형 격자 스냅도 멱등이다", () => {
    for (const v of [13, 77, 250, -90]) {
      expect(snapToShapeGrid(snapToShapeGrid(v))).toBe(snapToShapeGrid(v));
    }
  });
});
