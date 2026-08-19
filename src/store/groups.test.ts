import { describe, it, expect, beforeEach } from "vitest";
import { useCanvasStore } from "./index";
import { createShape } from "@/utils/factory";
import type { CanvasObject, ShapeSettings } from "@/types";

const SETTINGS = {
  fill: "#fff",
  stroke: "#000",
  strokeWidth: 2,
} as unknown as ShapeSettings;

const store = () => useCanvasStore.getState();
const shape = (x = 0, y = 0) => createShape(x, y, "rectangle", SETTINGS);
const byId = (id: string) => store().objects.find((o) => o.id === id)!;

/** 그룹 메타와 실제 멤버가 어긋나지 않았는지 */
function expectGroupsConsistent() {
  const s = store();
  const used = new Set(s.objects.map((o) => o.groupId).filter(Boolean));

  // 멤버 없는 그룹 메타가 남으면 유령 섹션이 그려진다
  for (const g of s.groups) {
    if (g.customBounds) continue; // 영역 기반 섹션은 멤버가 없을 수 있다
    expect(used.has(g.id)).toBe(true);
  }
  // 존재하지 않는 그룹을 가리키는 객체가 없어야 한다
  const known = new Set(s.groups.map((g) => g.id));
  for (const o of s.objects) {
    if (o.groupId) expect(known.has(o.groupId)).toBe(true);
  }
}

beforeEach(() => {
  store().clearAllObjects();
});

describe("그룹 만들기", () => {
  it("2개 이상 선택해야 그룹이 된다", () => {
    const a = shape();
    store().addObject(a);
    store().setSelectedIds([a.id]);
    store().groupSelected();

    expect(store().groups).toHaveLength(0);
    expect(byId(a.id).groupId).toBeUndefined();
  });

  it("선택한 객체들이 같은 groupId 를 갖는다", () => {
    const a = shape(0, 0);
    const b = shape(200, 0);
    [a, b].forEach(store().addObject);
    store().setSelectedIds([a.id, b.id]);
    store().groupSelected();

    expect(store().groups).toHaveLength(1);
    expect(byId(a.id).groupId).toBe(store().groups[0]!.id);
    expect(byId(b.id).groupId).toBe(store().groups[0]!.id);
    expectGroupsConsistent();
  });

  it("이미 같은 그룹이면 다시 묶지 않는다", () => {
    const a = shape(0, 0);
    const b = shape(200, 0);
    [a, b].forEach(store().addObject);
    store().setSelectedIds([a.id, b.id]);
    store().groupSelected();

    const before = store().groups[0]!.id;
    store().setSelectedIds([a.id, b.id]);
    store().groupSelected();

    expect(store().groups).toHaveLength(1);
    expect(store().groups[0]!.id).toBe(before);
  });

  it("선택 안 된 객체는 영향받지 않는다", () => {
    const a = shape(0, 0);
    const b = shape(200, 0);
    const c = shape(400, 0);
    [a, b, c].forEach(store().addObject);
    store().setSelectedIds([a.id, b.id]);
    store().groupSelected();

    expect(byId(c.id).groupId).toBeUndefined();
  });
});

describe("그룹 재구성 시 정리", () => {
  it("멤버가 1개만 남은 옛 그룹은 해체된다", () => {
    const a = shape(0, 0);
    const b = shape(200, 0);
    const c = shape(400, 0);
    [a, b, c].forEach(store().addObject);

    // (a,b) 그룹
    store().setSelectedIds([a.id, b.id]);
    store().groupSelected();

    // a 를 c 와 다시 묶으면 옛 그룹에는 b 만 남는다 → 해체돼야 한다
    store().setSelectedIds([a.id, c.id]);
    store().groupSelected();

    expect(byId(b.id).groupId).toBeUndefined();
    expect(store().groups).toHaveLength(1);
    expectGroupsConsistent();
  });

  it("멤버 없는 그룹 메타가 남지 않는다", () => {
    const a = shape(0, 0);
    const b = shape(200, 0);
    [a, b].forEach(store().addObject);
    store().setSelectedIds([a.id, b.id]);
    store().groupSelected();

    store().deleteObjects([a.id, b.id]);

    expect(store().groups).toHaveLength(0);
  });
});

describe("그룹 해제", () => {
  function grouped() {
    const a = shape(0, 0);
    const b = shape(200, 0);
    [a, b].forEach(store().addObject);
    store().setSelectedIds([a.id, b.id]);
    store().groupSelected();
    return { a, b, gid: store().groups[0]!.id };
  }

  it("선택한 객체의 groupId 가 사라진다", () => {
    const { a, b } = grouped();
    store().setSelectedIds([a.id, b.id]);
    store().ungroupSelected();

    expect(byId(a.id).groupId).toBeUndefined();
    expect(byId(b.id).groupId).toBeUndefined();
    expectGroupsConsistent();
  });

  it("가상 그룹 선택(__group:)으로도 해제된다", () => {
    const { a, b, gid } = grouped();
    store().setSelectedIds([`__group:${gid}`]);
    store().ungroupSelected();

    expect(byId(a.id).groupId).toBeUndefined();
    expect(byId(b.id).groupId).toBeUndefined();
  });

  it("그룹이 아닌 것만 선택하면 아무 일도 없다", () => {
    const c = shape(400, 0);
    store().addObject(c);
    store().setSelectedIds([c.id]);
    expect(() => store().ungroupSelected()).not.toThrow();
  });
});

describe("그룹 단위 이동", () => {
  it("멤버 전체가 같은 만큼 움직인다", () => {
    const a = shape(0, 0);
    const b = shape(200, 100);
    [a, b].forEach(store().addObject);
    store().setSelectedIds([a.id, b.id]);
    store().groupSelected();
    const gid = store().groups[0]!.id;

    store().moveGroupObjects(gid, 50, -30);

    expect(byId(a.id)).toMatchObject({ x: 50, y: -30 });
    expect(byId(b.id)).toMatchObject({ x: 250, y: 70 });
  });

  it("다른 그룹의 객체는 안 움직인다", () => {
    const a = shape(0, 0);
    const b = shape(200, 0);
    const c = shape(400, 0);
    [a, b, c].forEach(store().addObject);
    store().setSelectedIds([a.id, b.id]);
    store().groupSelected();
    const gid = store().groups[0]!.id;

    store().moveGroupObjects(gid, 100, 100);

    expect(byId(c.id)).toMatchObject({ x: 400, y: 0 });
  });
});

describe("그룹 메타 수정/삭제", () => {
  function grouped() {
    const a = shape(0, 0);
    const b = shape(200, 0);
    [a, b].forEach(store().addObject);
    store().setSelectedIds([a.id, b.id]);
    store().groupSelected();
    return store().groups[0]!.id;
  }

  it("이름과 색을 바꿀 수 있다", () => {
    const gid = grouped();
    store().updateGroup(gid, { name: "새 이름", tagColor: "#ff0000" });

    const g = store().groups.find((x) => x.id === gid)!;
    expect(g.name).toBe("새 이름");
    expect(g.tagColor).toBe("#ff0000");
  });

  it("그룹을 지우면 멤버의 groupId 도 정리된다", () => {
    const gid = grouped();
    store().deleteGroup(gid);

    expect(store().groups.find((x) => x.id === gid)).toBeUndefined();
    expect(store().objects.every((o) => o.groupId !== gid)).toBe(true);
    expectGroupsConsistent();
  });

  // 멤버를 전부 선택하지 않고 가상 마커 하나만 넣는 것이 의도된 설계다.
  // (자식마다 선택 표시가 뜨면 화면이 지저분해진다 — groups.ts 주석 참조)
  it("selectGroup 은 가상 마커 하나만 선택한다", () => {
    const gid = grouped();
    store().clearSelection();
    store().selectGroup(gid);

    expect(store().selectedIds).toEqual([`__group:${gid}`]);
  });

  it("가상 마커는 ungroupSelected 가 알아듣는다", () => {
    const gid = grouped();
    store().selectGroup(gid);
    store().ungroupSelected();

    expect(store().objects.every((o) => o.groupId !== gid)).toBe(true);
  });
});

describe("그룹 이동 시 엘보우 형태가 보존된다", () => {
  const BEND = {
    segmentIndex: 0,
    offset: 0,
    region: "primary" as const,
    elbowY: 300,
    leftCornerX: 450,
    rightCornerX: 700,
    leftY: 250,
    midLeftX: 380,
  };

  function scene() {
    const s1 = shape(0, 0);
    const s2 = shape(600, 400);
    const conn = {
      id: "conn",
      type: "connector" as const,
      x: 100,
      y: 50,
      endX: 600,
      endY: 450,
      sourceId: s1.id,
      targetId: s2.id,
      sourceAnchor: "right" as const,
      targetAnchor: "left" as const,
      pathStyle: "elbowed" as const,
      elbowBends: [{ ...BEND }],
      rotation: 0,
      opacity: 1,
    } as unknown as CanvasObject;

    [s1, s2, conn].forEach(store().addObject);
    store().setSelectedIds([s1.id, s2.id, conn.id]);
    store().groupSelected();
    return { s1, s2, gid: store().groups[0]!.id };
  }

  it("양 끝이 함께 움직이면 꺾임도 같은 만큼 옮겨진다", () => {
    const { gid } = scene();
    store().moveGroupObjects(gid, 200, -100);

    const b = byId("conn").elbowBends![0]!;
    expect(b.elbowY).toBe(200); // 300 - 100
    expect(b.leftCornerX).toBe(650); // 450 + 200
    expect(b.rightCornerX).toBe(900);
    expect(b.leftY).toBe(150);
    expect(b.midLeftX).toBe(580);
  });

  it("도형과 꺾임의 상대 위치가 유지된다", () => {
    const { s1, gid } = scene();
    const before = byId("conn").elbowBends![0]!.leftCornerX! - byId(s1.id).x;

    store().moveGroupObjects(gid, 333, 77);

    const after = byId("conn").elbowBends![0]!.leftCornerX! - byId(s1.id).x;
    expect(after).toBe(before);
  });

  it("한쪽 도형만 그룹에 있으면 꺾임을 옮기지 않는다", () => {
    // s1 만 그룹에 넣고 s2 는 밖에 둔다
    const s1 = shape(0, 0);
    const s2 = shape(600, 400);
    const other = shape(900, 0);
    const conn = {
      id: "conn2",
      type: "connector" as const,
      x: 100,
      y: 50,
      endX: 600,
      endY: 450,
      sourceId: s1.id,
      targetId: s2.id,
      pathStyle: "elbowed" as const,
      elbowBends: [{ ...BEND }],
      rotation: 0,
      opacity: 1,
    } as unknown as CanvasObject;

    [s1, s2, other, conn].forEach(store().addObject);
    store().setSelectedIds([s1.id, other.id, conn.id]);
    store().groupSelected();
    const gid = store().groups[0]!.id;

    store().moveGroupObjects(gid, 200, 0);

    // 타깃(s2)이 안 움직이므로 형태가 실제로 달라져야 한다 → 꺾임 유지
    expect(byId("conn2").elbowBends![0]!.leftCornerX).toBe(450);
  });

  it("이동량이 0 이면 아무것도 바뀌지 않는다", () => {
    const { gid } = scene();
    const before = JSON.stringify(byId("conn").elbowBends);
    store().moveGroupObjects(gid, 0, 0);
    expect(JSON.stringify(byId("conn").elbowBends)).toBe(before);
  });

  it("연속 계단 층도 함께 옮겨진다", () => {
    const s1 = shape(0, 0);
    const s2 = shape(600, 400);
    const conn = {
      id: "conn3",
      type: "connector" as const,
      x: 100,
      y: 50,
      endX: 600,
      endY: 450,
      sourceId: s1.id,
      targetId: s2.id,
      pathStyle: "elbowed" as const,
      elbowBends: [{ ...BEND, leftYSteps: [{ y: 230, midX: 200 }] }],
      rotation: 0,
      opacity: 1,
    } as unknown as CanvasObject;

    [s1, s2, conn].forEach(store().addObject);
    store().setSelectedIds([s1.id, s2.id, conn.id]);
    store().groupSelected();

    store().moveGroupObjects(store().groups[0]!.id, 50, 25);

    const step = byId("conn3").elbowBends![0]!.leftYSteps![0]!;
    expect(step.y).toBe(255);
    expect(step.midX).toBe(250);
  });
});
