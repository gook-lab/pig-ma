import { describe, it, expect } from "vitest";
import { convertExcalidraw, parseExcalidrawFile } from "../mapper";
import { ExcalidrawImportError } from "../types";
import type { ExcalidrawData, ExcalidrawElement } from "../types";

function element(partial: Partial<ExcalidrawElement>): ExcalidrawElement {
  return {
    id: partial.id ?? "el1",
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    ...partial,
  };
}

function data(
  elements: ExcalidrawElement[],
  files?: ExcalidrawData["files"],
): ExcalidrawData {
  return { type: "excalidraw", version: 2, elements, files };
}

describe("도형 변환", () => {
  it("rectangle → shape(rectangle)", () => {
    const { objects } = convertExcalidraw(
      data([
        element({
          id: "r1",
          type: "rectangle",
          x: 10,
          y: 20,
          width: 100,
          height: 60,
          strokeColor: "#1e1e1e",
          backgroundColor: "#ffc9c9",
          strokeWidth: 2,
        }),
      ]),
    );

    expect(objects).toHaveLength(1);
    const obj = objects[0]!;
    expect(obj.type).toBe("shape");
    expect(obj.shapeVariant).toBe("rectangle");
    expect(obj.x).toBe(10);
    expect(obj.fill).toBe("#ffc9c9");
    expect(obj.fillMode).toBe("fill");
    expect(obj.stroke).toBe("#1e1e1e");
  });

  it("roundness 있는 rectangle → roundedRect", () => {
    const { objects } = convertExcalidraw(
      data([element({ type: "rectangle", roundness: { type: 3 } })]),
    );
    expect(objects[0]!.shapeVariant).toBe("roundedRect");
  });

  it("ellipse / diamond 변환", () => {
    const { objects } = convertExcalidraw(
      data([
        element({ id: "e", type: "ellipse" }),
        element({ id: "d", type: "diamond" }),
      ]),
    );
    expect(objects.map((o) => o.shapeVariant)).toEqual(["ellipse", "diamond"]);
  });

  it("backgroundColor transparent → fillMode transparent", () => {
    const { objects } = convertExcalidraw(
      data([element({ backgroundColor: "transparent" })]),
    );
    expect(objects[0]!.fillMode).toBe("transparent");
    expect(objects[0]!.fill).toBeUndefined();
  });

  it("angle(rad) → rotation(deg), opacity 0~100 → 0~1", () => {
    const { objects } = convertExcalidraw(
      data([element({ angle: Math.PI / 2, opacity: 50 })]),
    );
    expect(objects[0]!.rotation).toBeCloseTo(90);
    expect(objects[0]!.opacity).toBe(0.5);
  });

  it("isDeleted 요소는 스킵한다", () => {
    const { objects } = convertExcalidraw(
      data([element({ isDeleted: true }), element({ id: "alive" })]),
    );
    expect(objects.map((o) => o.id)).toEqual(["alive"]);
  });

  it("지원하지 않는 타입은 skippedCount 에 집계된다", () => {
    const { objects, skippedCount } = convertExcalidraw(
      data([element({ type: "embeddable" }), element({ id: "ok" })]),
    );
    expect(objects).toHaveLength(1);
    expect(skippedCount).toBe(1);
  });
});

describe("텍스트 변환", () => {
  it("독립 text → textBox", () => {
    const { objects } = convertExcalidraw(
      data([
        element({
          id: "t1",
          type: "text",
          text: "hello",
          fontSize: 20,
          strokeColor: "#e03131",
          textAlign: "center",
        }),
      ]),
    );
    const obj = objects[0]!;
    expect(obj.type).toBe("textBox");
    expect(obj.text).toBe("hello");
    expect(obj.fontSize).toBe(20);
    expect(obj.textColor).toBe("#e03131");
    expect(obj.textAlign).toBe("center");
  });

  it("containerId 바운드 텍스트는 도형에 병합된다", () => {
    const { objects } = convertExcalidraw(
      data([
        element({ id: "box", type: "rectangle" }),
        element({
          id: "label",
          type: "text",
          text: "inside",
          containerId: "box",
          strokeColor: "#2f9e44",
        }),
      ]),
    );
    expect(objects).toHaveLength(1);
    expect(objects[0]!.id).toBe("box");
    expect(objects[0]!.text).toBe("inside");
    expect(objects[0]!.textColor).toBe("#2f9e44");
  });

  it("containerId 가 죽은 요소를 가리키면 독립 textBox 로 남는다", () => {
    const { objects } = convertExcalidraw(
      data([
        element({
          id: "orphan",
          type: "text",
          text: "alone",
          containerId: "ghost",
        }),
      ]),
    );
    expect(objects).toHaveLength(1);
    expect(objects[0]!.type).toBe("textBox");
  });
});

describe("화살표/선 변환", () => {
  it("arrow → connector (절대 좌표 + 바인딩)", () => {
    const { objects } = convertExcalidraw(
      data([
        element({ id: "a", type: "rectangle" }),
        element({ id: "b", type: "rectangle", x: 300 }),
        element({
          id: "arrow1",
          type: "arrow",
          x: 100,
          y: 30,
          width: 200,
          height: 0,
          points: [
            [0, 0],
            [200, 0],
          ],
          startBinding: { elementId: "a" },
          endBinding: { elementId: "b" },
          startArrowhead: null,
          endArrowhead: "arrow",
        }),
      ]),
    );
    const conn = objects.find((o) => o.id === "arrow1")!;
    expect(conn.type).toBe("connector");
    expect(conn.x).toBe(100);
    expect(conn.endX).toBe(300);
    expect(conn.sourceId).toBe("a");
    expect(conn.targetId).toBe("b");
    expect(conn.startMarker).toBe("none");
    expect(conn.endMarker).toBe("arrow");
    expect(conn.pathStyle).toBe("straight");
  });

  it("바인딩 대상이 없으면 sourceId/targetId 를 설정하지 않는다", () => {
    const { objects } = convertExcalidraw(
      data([
        element({
          id: "arrow1",
          type: "arrow",
          points: [
            [0, 0],
            [50, 50],
          ],
          startBinding: { elementId: "ghost" },
        }),
      ]),
    );
    expect(objects[0]!.sourceId).toBeUndefined();
  });

  it("arrowhead 매핑: triangle→filledArrow, dot→circle", () => {
    const { objects } = convertExcalidraw(
      data([
        element({
          id: "arrow1",
          type: "arrow",
          points: [
            [0, 0],
            [50, 0],
          ],
          startArrowhead: "dot",
          endArrowhead: "triangle",
        }),
      ]),
    );
    expect(objects[0]!.startMarker).toBe("circle");
    expect(objects[0]!.endMarker).toBe("filledArrow");
  });

  it("elbowed 화살표 → pathStyle elbowed, 다점 화살표 → curved", () => {
    const { objects } = convertExcalidraw(
      data([
        element({
          id: "e1",
          type: "arrow",
          elbowed: true,
          points: [
            [0, 0],
            [50, 0],
            [50, 50],
          ],
        }),
        element({
          id: "e2",
          type: "arrow",
          points: [
            [0, 0],
            [30, 40],
            [80, 40],
          ],
        }),
      ]),
    );
    expect(objects.find((o) => o.id === "e1")!.pathStyle).toBe("elbowed");
    expect(objects.find((o) => o.id === "e2")!.pathStyle).toBe("curved");
  });

  it("arrow 의 바운드 텍스트는 커넥터 라벨이 된다", () => {
    const { objects } = convertExcalidraw(
      data([
        element({
          id: "arrow1",
          type: "arrow",
          points: [
            [0, 0],
            [100, 0],
          ],
        }),
        element({
          id: "t",
          type: "text",
          text: "yes",
          containerId: "arrow1",
        }),
      ]),
    );
    expect(objects).toHaveLength(1);
    expect(objects[0]!.label).toBe("yes");
  });

  it("2점 line → 마커 없는 standalone connector", () => {
    const { objects } = convertExcalidraw(
      data([
        element({
          id: "l1",
          type: "line",
          points: [
            [0, 0],
            [100, 50],
          ],
        }),
      ]),
    );
    expect(objects[0]!.type).toBe("connector");
    expect(objects[0]!.endMarker).toBe("none");
  });

  it("다점 line / freedraw → line (points 평탄화)", () => {
    const { objects } = convertExcalidraw(
      data([
        element({
          id: "poly",
          type: "line",
          points: [
            [0, 0],
            [10, 10],
            [20, 0],
          ],
        }),
        element({
          id: "draw",
          type: "freedraw",
          points: [
            [0, 0],
            [5, 5],
          ],
        }),
      ]),
    );
    const poly = objects.find((o) => o.id === "poly")!;
    expect(poly.type).toBe("line");
    expect(poly.points).toEqual([0, 0, 10, 10, 20, 0]);
    expect(objects.find((o) => o.id === "draw")!.penType).toBe("pen");
  });
});

describe("이미지/그룹 변환", () => {
  it("image → files 의 dataURL 을 src 로", () => {
    const { objects } = convertExcalidraw(
      data([element({ id: "img", type: "image", fileId: "f1" })], {
        f1: { mimeType: "image/png", dataURL: "data:image/png;base64,abc" },
      }),
    );
    expect(objects[0]!.type).toBe("image");
    expect(objects[0]!.src).toBe("data:image/png;base64,abc");
  });

  it("dataURL 없는 image 는 스킵된다", () => {
    const { objects, skippedCount } = convertExcalidraw(
      data([element({ id: "img", type: "image", fileId: "missing" })]),
    );
    expect(objects).toHaveLength(0);
    expect(skippedCount).toBe(1);
  });

  it("frame → customBounds 그룹, frameId 멤버십", () => {
    const { objects, groups } = convertExcalidraw(
      data([
        element({
          id: "fr",
          type: "frame",
          x: 0,
          y: 0,
          width: 500,
          height: 300,
          name: "My Frame",
        }),
        element({ id: "child", frameId: "fr" }),
      ]),
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.name).toBe("My Frame");
    expect(groups[0]!.customBounds).toEqual({
      x: 0,
      y: 0,
      width: 500,
      height: 300,
    });
    expect(objects.find((o) => o.id === "child")!.groupId).toBe("fr");
  });

  it("groupIds → 최상위 그룹으로 묶인다", () => {
    const { objects, groups } = convertExcalidraw(
      data([
        element({ id: "a", groupIds: ["inner", "outer"] }),
        element({ id: "b", groupIds: ["inner", "outer"] }),
      ]),
    );
    expect(objects.every((o) => o.groupId === "outer")).toBe(true);
    expect(groups.map((g) => g.id)).toEqual(["outer"]);
  });
});

describe("parseExcalidrawFile", () => {
  it("유효한 파일을 파싱한다", () => {
    const parsed = parseExcalidrawFile(
      JSON.stringify({ type: "excalidraw", version: 2, elements: [] }),
    );
    expect(parsed.type).toBe("excalidraw");
    expect(parsed.elements).toEqual([]);
  });

  it("JSON 이 아니면 거부한다", () => {
    expect(() => parseExcalidrawFile("nope{")).toThrow(ExcalidrawImportError);
  });

  it("type 마커가 없으면 거부한다", () => {
    expect(() => parseExcalidrawFile(JSON.stringify({ elements: [] }))).toThrow(
      /Not an Excalidraw file/,
    );
  });

  it("elements 배열이 없으면 거부한다", () => {
    expect(() =>
      parseExcalidrawFile(JSON.stringify({ type: "excalidraw" })),
    ).toThrow(/no elements/);
  });
});
