import { describe, it, expect } from "vitest";
import { convertToExcalidraw, extractPlainText } from "../export";
import { convertExcalidraw } from "../mapper";
import type { CanvasObject, GroupInfo } from "@/types";

function obj(partial: Partial<CanvasObject>): CanvasObject {
  return {
    id: partial.id ?? "o1",
    type: "shape",
    x: 0,
    y: 0,
    rotation: 0,
    opacity: 1,
    width: 100,
    height: 60,
    ...partial,
  };
}

describe("도형 export", () => {
  it("shape(rectangle) → rectangle 요소", () => {
    const { data, exportedCount } = convertToExcalidraw(
      [
        obj({
          shapeVariant: "rectangle",
          fill: "#ffc9c9",
          stroke: "#1e1e1e",
          strokeWidth: 2,
        }),
      ],
      [],
    );
    expect(exportedCount).toBe(1);
    const el = data.elements[0]!;
    expect(el.type).toBe("rectangle");
    expect(el.backgroundColor).toBe("#ffc9c9");
    expect(el.strokeColor).toBe("#1e1e1e");
    expect(el.roundness).toBeNull();
    expect(el.isDeleted).toBe(false);
    expect(typeof el.seed).toBe("number");
  });

  it("roundedRect → roundness, circle → ellipse, diamond → diamond", () => {
    const { data } = convertToExcalidraw(
      [
        obj({ id: "r", shapeVariant: "roundedRect" }),
        obj({ id: "c", shapeVariant: "circle" }),
        obj({ id: "d", shapeVariant: "diamond" }),
      ],
      [],
    );
    const byId = new Map(data.elements.map((e) => [e.id, e]));
    expect(byId.get("r")!.roundness).toEqual({ type: 3 });
    expect(byId.get("c")!.type).toBe("ellipse");
    expect(byId.get("d")!.type).toBe("diamond");
  });

  it("fillMode transparent → backgroundColor transparent", () => {
    const { data } = convertToExcalidraw(
      [obj({ fillMode: "transparent", fill: "#ff0000" })],
      [],
    );
    expect(data.elements[0]!.backgroundColor).toBe("transparent");
  });

  it("텍스트 있는 shape → 바운드 text 요소 + boundElements", () => {
    const { data } = convertToExcalidraw(
      [obj({ id: "s", text: "hello", textColor: "#e03131" })],
      [],
    );
    expect(data.elements).toHaveLength(2);
    const container = data.elements.find((e) => e.id === "s")!;
    const label = data.elements.find((e) => e.id === "s-text")!;
    expect(label.type).toBe("text");
    expect(label.text).toBe("hello");
    expect(label.containerId).toBe("s");
    expect(container.boundElements).toEqual([{ id: "s-text", type: "text" }]);
  });

  it("stickyNote → 배경색 rectangle + 바운드 text", () => {
    const { data } = convertToExcalidraw(
      [obj({ id: "n", type: "stickyNote", text: "memo" })],
      [],
    );
    const rect = data.elements.find((e) => e.id === "n")!;
    expect(rect.type).toBe("rectangle");
    expect(rect.backgroundColor).toBe("#fef08a");
    expect(data.elements.find((e) => e.containerId === "n")!.text).toBe("memo");
  });

  it("rotation(deg) → angle(rad), opacity 0~1 → 0~100", () => {
    const { data } = convertToExcalidraw(
      [obj({ rotation: 90, opacity: 0.5 })],
      [],
    );
    expect(data.elements[0]!.angle).toBeCloseTo(Math.PI / 2);
    expect(data.elements[0]!.opacity).toBe(50);
  });
});

describe("텍스트/선 export", () => {
  it("textBox → text 요소 (tiptapContent 우선)", () => {
    const { data } = convertToExcalidraw(
      [
        obj({
          id: "t",
          type: "textBox",
          text: "legacy",
          tiptapContent: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "line1" }],
              },
              {
                type: "paragraph",
                content: [{ type: "text", text: "line2" }],
              },
            ],
          },
          textColor: "#1971c2",
        }),
      ],
      [],
    );
    const el = data.elements[0]!;
    expect(el.type).toBe("text");
    expect(el.text).toBe("line1\nline2");
    expect(el.strokeColor).toBe("#1971c2");
  });

  it("line → freedraw (flat points → 쌍 배열)", () => {
    const { data } = convertToExcalidraw(
      [
        obj({
          id: "l",
          type: "line",
          points: [0, 0, 10, 10, 20, 0],
          stroke: "#000000",
        }),
      ],
      [],
    );
    const el = data.elements[0]!;
    expect(el.type).toBe("freedraw");
    expect(el.points).toEqual([
      [0, 0],
      [10, 10],
      [20, 0],
    ]);
  });

  it("connector → arrow (바인딩 + boundElements 양방향)", () => {
    const { data } = convertToExcalidraw(
      [
        obj({ id: "a", shapeVariant: "rectangle" }),
        obj({ id: "b", shapeVariant: "rectangle", x: 300 }),
        obj({
          id: "conn",
          type: "connector",
          x: 100,
          y: 30,
          endX: 300,
          endY: 30,
          sourceId: "a",
          targetId: "b",
          startMarker: "none",
          endMarker: "filledArrow",
        }),
      ],
      [],
    );
    const arrow = data.elements.find((e) => e.id === "conn")!;
    expect(arrow.type).toBe("arrow");
    expect(arrow.points).toEqual([
      [0, 0],
      [200, 0],
    ]);
    expect(arrow.startBinding?.elementId).toBe("a");
    expect(arrow.endBinding?.elementId).toBe("b");
    expect(arrow.startArrowhead).toBeNull();
    expect(arrow.endArrowhead).toBe("triangle");
    const a = data.elements.find((e) => e.id === "a")!;
    expect(a.boundElements).toEqual([{ id: "conn", type: "arrow" }]);
  });

  it("__group: 가상 바인딩은 제외한다", () => {
    const { data } = convertToExcalidraw(
      [
        obj({
          id: "conn",
          type: "connector",
          endX: 100,
          endY: 0,
          sourceId: "__group:g1",
        }),
      ],
      [],
    );
    expect(data.elements[0]!.startBinding).toBeUndefined();
  });

  it("커넥터 label → 바운드 text", () => {
    const { data } = convertToExcalidraw(
      [
        obj({
          id: "conn",
          type: "connector",
          endX: 100,
          endY: 0,
          label: "yes",
        }),
      ],
      [],
    );
    expect(data.elements.find((e) => e.containerId === "conn")!.text).toBe(
      "yes",
    );
  });
});

describe("이미지/그룹/스킵 export", () => {
  it("data: URL 이미지 → image 요소 + files 등록", () => {
    const src = "data:image/png;base64,abc";
    const { data } = convertToExcalidraw(
      [obj({ id: "img", type: "image", src })],
      [],
    );
    const el = data.elements[0]!;
    expect(el.type).toBe("image");
    expect(el.fileId).toBe("img");
    expect(data.files!["img"]!.dataURL).toBe(src);
    expect(data.files!["img"]!.mimeType).toBe("image/png");
  });

  it("외부 URL 이미지와 chart/codeBlock 은 스킵된다", () => {
    const { data, skippedCount } = convertToExcalidraw(
      [
        obj({ id: "img", type: "image", src: "https://example.com/a.png" }),
        obj({ id: "ch", type: "chart" }),
        obj({ id: "cb", type: "codeBlock" }),
        obj({ id: "ok" }),
      ],
      [],
    );
    expect(skippedCount).toBe(3);
    expect(data.elements.map((e) => e.id)).toEqual(["ok"]);
  });

  it("customBounds 그룹 → frame + frameId 멤버십", () => {
    const groups: GroupInfo[] = [
      {
        id: "g1",
        name: "Section",
        customBounds: { x: 0, y: 0, width: 500, height: 300 },
      },
    ];
    const { data } = convertToExcalidraw(
      [obj({ id: "m", groupId: "g1" })],
      groups,
    );
    const frame = data.elements.find((e) => e.id === "g1")!;
    expect(frame.type).toBe("frame");
    expect(frame.name).toBe("Section");
    expect(data.elements.find((e) => e.id === "m")!.frameId).toBe("g1");
  });

  it("customBounds 없는 그룹 → groupIds", () => {
    const groups: GroupInfo[] = [{ id: "g2", name: "Group" }];
    const { data } = convertToExcalidraw(
      [obj({ id: "m", groupId: "g2" })],
      groups,
    );
    expect(data.elements[0]!.groupIds).toEqual(["g2"]);
  });
});

describe("라운드트립 (export → import)", () => {
  it("shape/text/connector 가 보존된다", () => {
    const original: CanvasObject[] = [
      obj({
        id: "s1",
        shapeVariant: "diamond",
        fill: "#b2f2bb",
        stroke: "#2f9e44",
        text: "start",
      }),
      obj({ id: "t1", type: "textBox", text: "note", textColor: "#e03131" }),
      obj({
        id: "c1",
        type: "connector",
        x: 50,
        y: 50,
        endX: 200,
        endY: 100,
        sourceId: "s1",
        endMarker: "arrow",
      }),
    ];

    const { data } = convertToExcalidraw(original, []);
    const { objects } = convertExcalidraw(data);

    const byId = new Map(objects.map((o) => [o.id, o]));
    const shape = byId.get("s1")!;
    expect(shape.type).toBe("shape");
    expect(shape.shapeVariant).toBe("diamond");
    expect(shape.fill).toBe("#b2f2bb");
    expect(shape.text).toBe("start"); // 바운드 텍스트로 나갔다가 다시 병합

    const text = byId.get("t1")!;
    expect(text.type).toBe("textBox");
    expect(text.text).toBe("note");
    expect(text.textColor).toBe("#e03131");

    const conn = byId.get("c1")!;
    expect(conn.type).toBe("connector");
    expect(conn.x).toBe(50);
    expect(conn.endX).toBe(200);
    expect(conn.sourceId).toBe("s1");
    expect(conn.endMarker).toBe("arrow");
  });
});

describe("extractPlainText", () => {
  it("문단을 개행으로 잇고 mention 을 @라벨로 변환한다", () => {
    const text = extractPlainText({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "hi " },
            { type: "mention", attrs: { label: "kim" } },
          ],
        },
        { type: "paragraph" },
        { type: "paragraph", content: [{ type: "text", text: "bye" }] },
      ],
    });
    expect(text).toBe("hi @kim\n\nbye");
  });

  it("빈 콘텐츠는 빈 문자열", () => {
    expect(extractPlainText(undefined)).toBe("");
  });
});

describe("래스터화 export (rasterize 옵션)", () => {
  it("chart/codeBlock 을 PNG image 요소로 내보낸다", () => {
    const dataUrl = "data:image/png;base64,rasterized";
    const { data, exportedCount, skippedCount } = convertToExcalidraw(
      [
        obj({ id: "ch", type: "chart", x: 10, y: 20 }),
        obj({ id: "cb", type: "codeBlock" }),
      ],
      [],
      { rasterize: () => dataUrl },
    );
    expect(exportedCount).toBe(2);
    expect(skippedCount).toBe(0);
    const chart = data.elements.find((e) => e.id === "ch")!;
    expect(chart.type).toBe("image");
    expect(chart.fileId).toBe("ch");
    expect(chart.x).toBe(10);
    expect(data.files!["ch"]!.dataURL).toBe(dataUrl);
    expect(data.files!["cb"]!.dataURL).toBe(dataUrl);
  });

  it("래스터라이저가 null 을 반환하면 스킵으로 집계된다", () => {
    const { data, skippedCount } = convertToExcalidraw(
      [obj({ id: "ch", type: "chart" })],
      [],
      { rasterize: () => null },
    );
    expect(skippedCount).toBe(1);
    expect(data.elements).toHaveLength(0);
  });

  it("data: URL 이 아닌 반환값은 무시한다", () => {
    const { skippedCount } = convertToExcalidraw(
      [obj({ id: "ch", type: "chart" })],
      [],
      { rasterize: () => "https://not-a-data-url" },
    );
    expect(skippedCount).toBe(1);
  });
});
