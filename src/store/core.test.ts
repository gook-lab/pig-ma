import { describe, it, expect, beforeEach } from "vitest";
import { useCanvasStore } from "./index";
import { createShape, createConnector, createTextBox } from "@/utils/factory";
import type { CanvasObject, ShapeSettings } from "@/types";

const SETTINGS = {
  fill: "#ffffff",
  stroke: "#000000",
  strokeWidth: 2,
} as unknown as ShapeSettings;

function shape(x = 0, y = 0): CanvasObject {
  return createShape(x, y, "rectangle", SETTINGS);
}

const store = () => useCanvasStore.getState();

/** 각 테스트를 깨끗한 캔버스에서 시작한다 */
beforeEach(() => {
  store().clearAllObjects();
});

describe("객체 추가/수정/삭제", () => {
  it("추가하면 목록에 들어간다", () => {
    const s = shape(10, 20);
    store().addObject(s);

    expect(store().objects.map((o) => o.id)).toEqual([s.id]);
  });

  it("수정은 해당 객체에만 적용된다", () => {
    const a = shape(0, 0);
    const b = shape(100, 0);
    store().addObject(a);
    store().addObject(b);

    store().updateObject(a.id, { x: 999 });

    expect(store().objects.find((o) => o.id === a.id)!.x).toBe(999);
    expect(store().objects.find((o) => o.id === b.id)!.x).toBe(100);
  });

  it("없는 id 를 수정해도 터지지 않는다", () => {
    store().addObject(shape());
    expect(() => store().updateObject("없는id", { x: 1 })).not.toThrow();
    expect(store().objects).toHaveLength(1);
  });

  it("deleteObjects 는 여러 개를 한 번에 지운다", () => {
    const a = shape();
    const b = shape(50, 50);
    const c = shape(100, 100);
    [a, b, c].forEach(store().addObject);

    store().deleteObjects([a.id, c.id]);

    expect(store().objects.map((o) => o.id)).toEqual([b.id]);
  });

  it("지우면 선택 목록에서도 빠진다", () => {
    const a = shape();
    const b = shape(50, 50);
    [a, b].forEach(store().addObject);
    store().setSelectedIds([a.id, b.id]);

    store().deleteObjects([a.id]);

    expect(store().selectedIds).toEqual([b.id]);
  });

  it("deleteSelected 는 선택된 것만 지운다", () => {
    const a = shape();
    const b = shape(50, 50);
    [a, b].forEach(store().addObject);
    store().setSelectedIds([b.id]);

    store().deleteSelected();

    expect(store().objects.map((o) => o.id)).toEqual([a.id]);
  });

  it("선택이 비어 있으면 deleteSelected 는 아무것도 안 한다", () => {
    store().addObject(shape());
    store().setSelectedIds([]);
    store().deleteSelected();

    expect(store().objects).toHaveLength(1);
  });
});

describe("커넥터 라벨 정리", () => {
  it("커넥터를 지우면 라벨 텍스트박스도 같이 지워진다", () => {
    const label = createTextBox(0, 0);
    const conn = {
      ...createConnector("a", "b", "right", "left"),
      labelTextBoxId: label.id,
    } as CanvasObject;

    store().addObject(label);
    store().addObject(conn);

    store().deleteObjects([conn.id]);

    expect(store().objects).toHaveLength(0);
  });

  it("라벨만 지우면 커넥터의 참조가 정리된다 (깨진 참조 방지)", () => {
    const label = createTextBox(0, 0);
    const conn = {
      ...createConnector("a", "b", "right", "left"),
      labelTextBoxId: label.id,
    } as CanvasObject;

    store().addObject(label);
    store().addObject(conn);

    store().deleteObjects([label.id]);

    const remaining = store().objects.find((o) => o.id === conn.id)!;
    expect(remaining).toBeDefined();
    expect(
      (remaining as CanvasObject & { labelTextBoxId?: string }).labelTextBoxId,
    ).toBeUndefined();
  });
});

describe("캔버스 경계 확장", () => {
  it("바깥에 객체를 놓으면 경계가 넓어진다", () => {
    const before = { ...store().canvasBounds };
    store().addObject(shape(before.maxX + 500, before.maxY + 500));
    const after = store().canvasBounds;

    expect(after.maxX).toBeGreaterThan(before.maxX);
    expect(after.maxY).toBeGreaterThan(before.maxY);
  });

  it("객체를 멀리 옮겨도 경계가 따라 넓어진다", () => {
    const s = shape(0, 0);
    store().addObject(s);
    const before = { ...store().canvasBounds };

    store().updateObject(s.id, { x: before.maxX + 1000 });

    expect(store().canvasBounds.maxX).toBeGreaterThan(before.maxX);
  });

  it("전체 삭제하면 경계가 초기값으로 돌아간다", () => {
    store().addObject(shape(50000, 50000));
    const expanded = { ...store().canvasBounds };
    store().clearAllObjects();

    expect(store().canvasBounds.maxX).toBeLessThan(expanded.maxX);
  });
});

describe("선택과 도구", () => {
  it("clearSelection 은 선택을 비운다", () => {
    const a = shape();
    store().addObject(a);
    store().setSelectedIds([a.id]);
    store().clearSelection();

    expect(store().selectedIds).toEqual([]);
  });

  it("도구를 바꿀 수 있다", () => {
    store().setTool("pencil");
    expect(store().tool).toBe("pencil");
    store().setTool("select");
    expect(store().tool).toBe("select");
  });

  it("뷰포트를 바꿀 수 있다", () => {
    store().setViewport({ x: -100, y: -200, zoom: 2 });
    expect(store().viewport).toMatchObject({ x: -100, y: -200, zoom: 2 });
  });
});

describe("전체 삭제", () => {
  it("객체·선택·그룹·캡션을 모두 비운다", () => {
    store().addObject(shape());
    store().setSelectedIds(["x"]);
    store().clearAllObjects();

    const s = store();
    expect(s.objects).toHaveLength(0);
    expect(s.selectedIds).toHaveLength(0);
    expect(s.groups).toHaveLength(0);
    expect(s.captions).toHaveLength(0);
    expect(s.isLocked).toBe(false);
  });
});

describe("setObjectsLocked (잠금 일괄 관리)", () => {
  const byId = (id: string) => store().objects.find((o) => o.id === id)!;

  it("여러 객체를 한 번에 잠그고 해제한다", () => {
    const a = createShape(0, 0, "rectangle", SETTINGS);
    const b = createShape(200, 0, "rectangle", SETTINGS);
    store().addObject(a);
    store().addObject(b);

    store().setObjectsLocked([a.id, b.id], true);
    expect(byId(a.id).locked).toBe(true);
    expect(byId(b.id).locked).toBe(true);

    store().setObjectsLocked([a.id], false);
    expect(byId(a.id).locked).toBe(false);
    expect(byId(b.id).locked).toBe(true);
  });

  it("잠그면 해당 객체의 선택이 해제된다", () => {
    const a = createShape(0, 0, "rectangle", SETTINGS);
    const b = createShape(200, 0, "rectangle", SETTINGS);
    store().addObject(a);
    store().addObject(b);
    store().setSelectedIds([a.id, b.id]);

    store().setObjectsLocked([a.id], true);
    expect(store().selectedIds).toEqual([b.id]);
  });

  it("변경이 없으면 상태 참조를 유지한다", () => {
    const a = createShape(0, 0, "rectangle", SETTINGS);
    store().addObject(a);
    const before = store().objects;
    store().setObjectsLocked([a.id], false); // 이미 잠금 아님
    expect(store().objects).toBe(before);
  });
});
