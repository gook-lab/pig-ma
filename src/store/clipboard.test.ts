import { describe, it, expect, beforeEach } from "vitest";
import { useCanvasStore } from "./index";
import {
  createShape,
  createConnector,
  createTextBox,
  createTable,
} from "@/utils/factory";
import type { CanvasObject, ShapeSettings } from "@/types";

const SETTINGS = {
  fill: "#fff",
  stroke: "#000",
  strokeWidth: 2,
} as unknown as ShapeSettings;

const store = () => useCanvasStore.getState();
const shape = (x = 0, y = 0) => createShape(x, y, "rectangle", SETTINGS);
const byId = (id: string) => store().objects.find((o) => o.id === id)!;

beforeEach(() => {
  store().clearAllObjects();
  useCanvasStore.setState({ clipboard: [], clipboardGroups: [] });
});

describe("복사/붙여넣기 기본", () => {
  it("붙여넣은 객체는 새 id 를 받는다", () => {
    const a = shape(0, 0);
    store().addObject(a);
    store().setSelectedIds([a.id]);
    store().copyObjects();
    store().pasteObjects(500, 500);

    expect(store().objects).toHaveLength(2);
    const ids = store().objects.map((o) => o.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("붙여넣기 위치를 중심으로 배치된다", () => {
    const a = shape(0, 0); // 100x100 기본 → center (50,50)
    store().addObject(a);
    store().setSelectedIds([a.id]);
    store().copyObjects();
    store().pasteObjects(1000, 1000);

    const pasted = store().objects.find((o) => o.id !== a.id)!;
    const cx = pasted.x + (pasted.width ?? 0) / 2;
    const cy = pasted.y + (pasted.height ?? 0) / 2;
    expect(cx).toBeCloseTo(1000);
    expect(cy).toBeCloseTo(1000);
  });

  it("붙여넣은 것이 선택 상태가 된다", () => {
    const a = shape();
    store().addObject(a);
    store().setSelectedIds([a.id]);
    store().copyObjects();
    store().pasteObjects(300, 300);

    const pastedId = store().objects.find((o) => o.id !== a.id)!.id;
    expect(store().selectedIds).toEqual([pastedId]);
  });

  it("빈 클립보드로 붙여넣으면 아무 일도 없다", () => {
    store().addObject(shape());
    store().pasteObjects(0, 0);
    expect(store().objects).toHaveLength(1);
  });

  it("잠긴 객체를 복사하면 붙여넣을 때 풀린다", () => {
    const a = { ...shape(), locked: true } as CanvasObject;
    store().addObject(a);
    store().setSelectedIds([a.id]);
    store().copyObjects();
    store().pasteObjects(400, 400);

    const pasted = store().objects.find((o) => o.id !== a.id)!;
    expect(pasted.locked).toBe(false);
  });
});

describe("커넥터 참조 재배선", () => {
  function scene() {
    const s1 = shape(0, 0);
    const s2 = shape(300, 0);
    const conn = {
      ...createConnector(s1.id, s2.id, "right", "left"),
      elbowBends: [
        { segmentIndex: 0, offset: 0, region: "primary", elbowY: 123 },
      ],
    } as CanvasObject;
    [s1, s2, conn].forEach(store().addObject);
    return { s1, s2, conn };
  }

  it("양쪽 도형까지 같이 복사하면 붙여넣은 커넥터는 사본을 가리킨다", () => {
    const { s1, s2, conn } = scene();
    store().setSelectedIds([s1.id, s2.id, conn.id]);
    store().copyObjects();
    store().pasteObjects(0, 800);

    const pastedIds = new Set(store().selectedIds);
    const pastedConn = store().objects.find(
      (o) => pastedIds.has(o.id) && o.type === "connector",
    )!;

    // 원본이 아니라 사본을 가리켜야 한다
    expect(pastedConn.sourceId).not.toBe(s1.id);
    expect(pastedConn.targetId).not.toBe(s2.id);
    expect(pastedIds.has(pastedConn.sourceId!)).toBe(true);
    expect(pastedIds.has(pastedConn.targetId!)).toBe(true);
    void conn;
  });

  it("양쪽이 리맵되어도 저작한 엘보우는 강체 이동으로 보존된다", () => {
    // 예전에는 []로 초기화했지만, 붙여넣기는 강체 이동이므로 bend 를
    // 같은 델타로 옮기면 저작한 형태가 그대로 유지된다 (모양 보존 원칙).
    const { s1, s2, conn } = scene();
    store().setSelectedIds([s1.id, s2.id, conn.id]);
    store().copyObjects();
    store().pasteObjects(0, 800);

    const pasted = store().objects.filter((o) =>
      store().selectedIds.includes(o.id),
    );
    const pastedConn = pasted.find((o) => o.type === "connector")!;
    const pastedS1 = pasted.find((o) => o.type !== "connector")!;
    const deltaY = pastedS1.y - s1.y;
    expect(pastedConn.elbowBends![0]!.elbowY).toBe(123 + deltaY);
    void conn;
  });

  it("커넥터만 복사하면 원본 도형을 가리키지 않는다 (연결 해제)", () => {
    const { s1, s2, conn } = scene();
    store().setSelectedIds([conn.id]);
    store().copyObjects();
    store().pasteObjects(0, 800);

    const pastedConn = store().objects.find(
      (o) => o.id !== conn.id && o.type === "connector",
    )!;
    expect(pastedConn.sourceId).toBeUndefined();
    expect(pastedConn.targetId).toBeUndefined();
    void s1;
    void s2;
  });
});

describe("커넥터 라벨 재배선", () => {
  it("라벨까지 같이 복사하면 사본 커넥터는 사본 라벨을 가리킨다", () => {
    const label = createTextBox(100, 100);
    const conn = {
      ...createConnector("a", "b", "right", "left"),
      labelTextBoxId: label.id,
    } as CanvasObject;
    [label, conn].forEach(store().addObject);

    store().setSelectedIds([label.id, conn.id]);
    store().copyObjects();
    store().pasteObjects(0, 900);

    const pastedIds = new Set(store().selectedIds);
    const pastedConn = store().objects.find(
      (o) => pastedIds.has(o.id) && o.type === "connector",
    ) as CanvasObject & { labelTextBoxId?: string };

    // 원본 라벨을 가리키면 사본을 편집할 때 원본이 바뀐다
    expect(pastedConn.labelTextBoxId).not.toBe(label.id);
    expect(pastedIds.has(pastedConn.labelTextBoxId!)).toBe(true);
  });

  it("라벨 없이 커넥터만 복사하면 라벨 참조가 남지 않는다", () => {
    const label = createTextBox(100, 100);
    const conn = {
      ...createConnector("a", "b", "right", "left"),
      labelTextBoxId: label.id,
    } as CanvasObject;
    [label, conn].forEach(store().addObject);

    store().setSelectedIds([conn.id]);
    store().copyObjects();
    store().pasteObjects(0, 900);

    const pastedConn = store().objects.find(
      (o) => o.id !== conn.id && o.type === "connector",
    ) as CanvasObject & { labelTextBoxId?: string };

    expect(pastedConn.labelTextBoxId).toBeUndefined();
  });
});

describe("테이블 깊은 복사", () => {
  it("붙여넣은 테이블을 고쳐도 원본이 바뀌지 않는다", () => {
    const t = createTable(0, 0);
    store().addObject(t);
    store().setSelectedIds([t.id]);
    store().copyObjects();
    store().pasteObjects(600, 600);

    const pasted = store().objects.find(
      (o) => o.id !== t.id && o.type === "table",
    )!;

    store().addTableRow(pasted.id);

    expect(byId(pasted.id).tableData!.rowCount).toBe(3);
    expect(byId(t.id).tableData!.rowCount).toBe(2);
  });

  it("셀 객체가 참조 공유되지 않는다", () => {
    const t = createTable(0, 0);
    store().addObject(t);
    store().setSelectedIds([t.id]);
    store().copyObjects();
    store().pasteObjects(600, 600);

    const pasted = store().objects.find(
      (o) => o.id !== t.id && o.type === "table",
    )!;

    expect(pasted.tableData!.cells["0-0"]).not.toBe(
      byId(t.id).tableData!.cells["0-0"],
    );
  });
});

describe("z-order", () => {
  it("bringToFront 는 선택을 맨 뒤(맨 위)로 보낸다", () => {
    const a = shape(0, 0);
    const b = shape(50, 0);
    const c = shape(100, 0);
    [a, b, c].forEach(store().addObject);

    store().setSelectedIds([a.id]);
    store().bringToFront();

    expect(store().objects.map((o) => o.id)).toEqual([b.id, c.id, a.id]);
  });

  it("sendToBack 은 선택을 맨 앞(맨 아래)으로 보낸다", () => {
    const a = shape(0, 0);
    const b = shape(50, 0);
    const c = shape(100, 0);
    [a, b, c].forEach(store().addObject);

    store().setSelectedIds([c.id]);
    store().sendToBack();

    expect(store().objects.map((o) => o.id)).toEqual([c.id, a.id, b.id]);
  });

  it("여러 개를 올려도 서로의 상대 순서는 유지된다", () => {
    const a = shape(0, 0);
    const b = shape(50, 0);
    const c = shape(100, 0);
    [a, b, c].forEach(store().addObject);

    store().setSelectedIds([a.id, b.id]);
    store().bringToFront();

    expect(store().objects.map((o) => o.id)).toEqual([c.id, a.id, b.id]);
  });
});

describe("잠금", () => {
  it("잠그고 풀 수 있다", () => {
    const a = shape();
    store().addObject(a);
    store().setSelectedIds([a.id]);

    store().lockObjects();
    expect(byId(a.id).locked).toBe(true);

    store().setSelectedIds([a.id]);
    store().unlockObjects();
    expect(byId(a.id).locked).toBe(false);
  });

  it("unlockAllObjects 는 전부 푼다", () => {
    const a = shape(0, 0);
    const b = shape(50, 0);
    [a, b].forEach(store().addObject);
    store().setSelectedIds([a.id, b.id]);
    store().lockObjects();

    store().unlockAllObjects();

    expect(store().objects.every((o) => !o.locked)).toBe(true);
  });
});

describe("pasteAndReplace 도 같은 규칙을 따른다", () => {
  it("라벨 참조를 사본으로 옮긴다", () => {
    const label = createTextBox(100, 100);
    const conn = {
      ...createConnector("a", "b", "right", "left"),
      labelTextBoxId: label.id,
    } as CanvasObject;
    [label, conn].forEach(store().addObject);

    store().setSelectedIds([label.id, conn.id]);
    store().copyObjects();
    store().pasteAndReplace(0, 900);

    const pastedConn = store().objects.find(
      (o) => o.type === "connector",
    ) as CanvasObject & { labelTextBoxId?: string };

    expect(pastedConn.labelTextBoxId).not.toBe(label.id);
  });
});

describe("연결된 도형 복사 시 커넥터 동반", () => {
  function connectedPair() {
    const a = shape(0, 0);
    const b = shape(400, 0);
    const conn = createConnector(a.id, b.id, "right", "left");
    store().addObject(a);
    store().addObject(b);
    store().addObject(conn);
    return { a, b, conn };
  }

  it("양쪽 도형이 선택되면 커넥터도 (선택 안 해도) 복사된다", () => {
    const { a, b, conn } = connectedPair();
    store().setSelectedIds([a.id, b.id]); // 커넥터는 선택하지 않음
    store().copyObjects();
    store().pasteObjects(2000, 2000);

    const pasted = store().objects.filter(
      (o) => ![a.id, b.id, conn.id].includes(o.id),
    );
    const pastedConn = pasted.find((o) => o.type === "connector");
    expect(pastedConn).toBeDefined();

    // 사본 커넥터는 사본 도형들에 연결되어야 한다
    const pastedShapeIds = pasted
      .filter((o) => o.type !== "connector")
      .map((o) => o.id);
    expect(pastedShapeIds).toContain(pastedConn!.sourceId);
    expect(pastedShapeIds).toContain(pastedConn!.targetId);
  });

  it("한쪽 도형만 선택하면 커넥터는 따라오지 않는다", () => {
    const { a } = connectedPair();
    store().setSelectedIds([a.id]);
    store().copyObjects();
    store().pasteObjects(2000, 2000);

    const pastedConnectors = store().objects.filter(
      (o) => o.type === "connector",
    );
    expect(pastedConnectors).toHaveLength(1); // 원본뿐
  });

  it("저작한 엘보우 형태는 강체 이동으로 보존된다", () => {
    const { a, b, conn } = connectedPair();
    store().updateObject(conn.id, {
      elbowBends: [
        {
          segmentIndex: 0,
          offset: 0,
          region: "primary",
          elbowY: 250,
          leftCornerX: 150,
          rightCornerX: 320,
        },
      ] as CanvasObject["elbowBends"],
      pathStyle: "elbowed",
    });
    store().setSelectedIds([a.id, b.id]);
    store().copyObjects();
    store().pasteObjects(1250, 1050);

    const pastedConn = store().objects.find(
      (o) => o.type === "connector" && o.id !== conn.id,
    )!;
    const pastedA = store().objects.find(
      (o) => store().selectedIds.includes(o.id) && o.type !== "connector",
    )!;
    const dx = pastedA.x - a.x;
    const dy = pastedA.y - a.y;
    const bend = pastedConn.elbowBends![0]!;
    expect(bend.elbowY).toBe(250 + dy);
    expect(bend.leftCornerX).toBe(150 + dx);
    expect(bend.rightCornerX).toBe(320 + dx);
  });
});
