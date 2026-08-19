import { describe, expect, it } from "vitest";
import {
  extractLeafNodes,
  figmaColorToHex,
  figmaToPigma,
  hexToFigmaColor,
  mapFigmaFontFamily,
  pigmaToFigma,
  svgPathToPoints,
  tiptapToFigmaOverrides,
} from "../mapper";
import type { FigmaNode, PigmaShape } from "../types";

// ============================================================================
// Color Conversion Tests
// ============================================================================

describe("hexToFigmaColor", () => {
  it("converts black", () => {
    expect(hexToFigmaColor("#000000")).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it("converts white", () => {
    expect(hexToFigmaColor("#FFFFFF")).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it("converts red", () => {
    expect(hexToFigmaColor("#FF0000")).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it("converts arbitrary color", () => {
    const color = hexToFigmaColor("#FEF08A");
    expect(color.r).toBeCloseTo(0.996, 2);
    expect(color.g).toBeCloseTo(0.941, 2);
    expect(color.b).toBeCloseTo(0.541, 2);
  });

  it("handles hex without #", () => {
    expect(hexToFigmaColor("FF0000")).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });
});

describe("figmaColorToHex", () => {
  it("converts black", () => {
    expect(figmaColorToHex({ r: 0, g: 0, b: 0, a: 1 })).toBe("#000000");
  });

  it("converts white", () => {
    expect(figmaColorToHex({ r: 1, g: 1, b: 1, a: 1 })).toBe("#FFFFFF");
  });

  it("round-trips through conversion", () => {
    const hex = "#3B82F6";
    const color = hexToFigmaColor(hex);
    expect(figmaColorToHex(color)).toBe(hex);
  });
});

// ============================================================================
// figmaToPigma Tests
// ============================================================================

describe("figmaToPigma", () => {
  it("converts RECTANGLE node", () => {
    const node: FigmaNode = {
      id: "1:1",
      name: "rect",
      type: "RECTANGLE",
      absoluteBoundingBox: { x: 100, y: 200, width: 300, height: 150 },
      fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 } }],
      strokes: [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 } }],
      strokeWeight: 2,
      opacity: 0.8,
    };

    const shape = figmaToPigma(node);
    expect(shape).not.toBeNull();
    expect(shape!.type).toBe("shape");
    expect(shape!.shapeVariant).toBe("rectangle");
    expect(shape!.x).toBe(100);
    expect(shape!.y).toBe(200);
    expect(shape!.width).toBe(300);
    expect(shape!.height).toBe(150);
    expect(shape!.fill).toBe("#FF0000");
    expect(shape!.stroke).toBe("#000000");
    expect(shape!.strokeWidth).toBe(2);
    expect(shape!.opacity).toBe(0.8);
  });

  it("converts ELLIPSE node", () => {
    const node: FigmaNode = {
      id: "1:2",
      name: "circle",
      type: "ELLIPSE",
      absoluteBoundingBox: { x: 50, y: 50, width: 100, height: 100 },
      fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 1, a: 1 } }],
    };

    const shape = figmaToPigma(node);
    expect(shape!.type).toBe("shape");
    expect(shape!.shapeVariant).toBe("ellipse");
    expect(shape!.fill).toBe("#0000FF");
  });

  it("converts TEXT node", () => {
    const node: FigmaNode = {
      id: "1:3",
      name: "Hello",
      type: "TEXT",
      absoluteBoundingBox: { x: 10, y: 20, width: 200, height: 30 },
      characters: "Hello World",
      fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 } }],
      style: {
        fontSize: 24,
        fontFamily: "Inter",
        fontWeight: 400,
        textAlignHorizontal: "CENTER",
      },
    };

    const shape = figmaToPigma(node);
    expect(shape!.type).toBe("textBox");
    expect(shape!.text).toBe("Hello World");
    expect(shape!.fontSize).toBe(24);
    expect(shape!.textAlign).toBe("center");
    // TEXT fills = text color, not background fill
    expect(shape!.textColor).toBe("#000000");
    expect(shape!.fill).toBeUndefined();
  });

  it("converts STICKY node", () => {
    const node: FigmaNode = {
      id: "1:4",
      name: "Note",
      type: "STICKY",
      absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 200 },
      characters: "Remember this",
      fills: [{ type: "SOLID", color: { r: 0.996, g: 0.941, b: 0.541, a: 1 } }],
    };

    const shape = figmaToPigma(node);
    expect(shape!.type).toBe("stickyNote");
    expect(shape!.text).toBe("Remember this");
    expect(shape!.backgroundColor).toBeDefined();
  });

  it("converts FRAME (no children) as rectangle", () => {
    const node: FigmaNode = {
      id: "1:5",
      name: "frame",
      type: "FRAME",
      absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 300 },
      fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1, a: 1 } }],
    };

    const shape = figmaToPigma(node);
    expect(shape!.type).toBe("shape");
    expect(shape!.shapeVariant).toBe("rectangle");
  });

  it("converts FRAME with children (clipsContent) as node-render image", () => {
    // 자식을 버리고 빈 사각형으로 만들면 크롭된 콘텐츠가 사라진다 —
    // render API 래스터화(imageRef: node:...)로 넘겨야 한다
    const node: FigmaNode = {
      id: "1:50",
      name: "clipping frame",
      type: "FRAME",
      absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 300 },
      children: [
        {
          id: "1:51",
          name: "overflowing image",
          type: "RECTANGLE",
          absoluteBoundingBox: { x: -100, y: -100, width: 800, height: 600 },
        },
      ],
    };

    const shape = figmaToPigma(node);
    expect(shape!.type).toBe("image");
    expect(shape!.imageRef).toBe("node:1:50");
  });

  it("returns null for unsupported types", () => {
    const node: FigmaNode = {
      id: "1:6",
      name: "component",
      type: "COMPONENT",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
    };
    expect(figmaToPigma(node)).toBeNull();
  });

  it("returns null for nodes without bounding box", () => {
    const node: FigmaNode = {
      id: "1:7",
      name: "no-bbox",
      type: "RECTANGLE",
    };
    expect(figmaToPigma(node)).toBeNull();
  });

  it("handles opacity 0", () => {
    const node: FigmaNode = {
      id: "1:8",
      name: "invisible",
      type: "RECTANGLE",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
      opacity: 0,
    };
    const shape = figmaToPigma(node);
    expect(shape!.opacity).toBe(0);
  });

  it("handles empty text", () => {
    const node: FigmaNode = {
      id: "1:9",
      name: "empty",
      type: "TEXT",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 20 },
      characters: "",
    };
    const shape = figmaToPigma(node);
    expect(shape!.text).toBe("");
  });

  it("handles no fills", () => {
    const node: FigmaNode = {
      id: "1:10",
      name: "no-fill",
      type: "RECTANGLE",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
      fills: [],
    };
    const shape = figmaToPigma(node);
    expect(shape!.fill).toBeUndefined();
    expect(shape!.fillMode).toBe("nofill");
  });

  it("handles no stroke", () => {
    const node: FigmaNode = {
      id: "1:11",
      name: "no-stroke",
      type: "RECTANGLE",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
    };
    const shape = figmaToPigma(node);
    expect(shape!.stroke).toBeUndefined();
  });

  it("handles large coordinates", () => {
    const node: FigmaNode = {
      id: "1:12",
      name: "far-away",
      type: "RECTANGLE",
      absoluteBoundingBox: { x: 99999, y: -50000, width: 1000, height: 1000 },
    };
    const shape = figmaToPigma(node);
    expect(shape!.x).toBe(99999);
    expect(shape!.y).toBe(-50000);
  });
});

// ============================================================================
// pigmaToFigma Tests
// ============================================================================

describe("pigmaToFigma", () => {
  it("converts rectangle shape", () => {
    const shape: PigmaShape = {
      id: "abc",
      type: "shape",
      shapeVariant: "rectangle",
      x: 100,
      y: 200,
      width: 300,
      height: 150,
      fill: "#FF0000",
      fillMode: "fill",
      stroke: "#000000",
      strokeWidth: 2,
      opacity: 0.8,
    };

    const node = pigmaToFigma(shape);
    expect(node.type).toBe("RECTANGLE");
    expect(node.absoluteBoundingBox).toEqual({
      x: 100,
      y: 200,
      width: 300,
      height: 150,
    });
    expect(node.fills).toHaveLength(1);
    expect(node.fills![0]!.color!.r).toBe(1);
    expect(node.strokes).toHaveLength(1);
    expect(node.opacity).toBe(0.8);
  });

  it("converts ellipse shape", () => {
    const shape: PigmaShape = {
      id: "def",
      type: "shape",
      shapeVariant: "ellipse",
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      fill: "#0000FF",
      fillMode: "fill",
    };

    const node = pigmaToFigma(shape);
    expect(node.type).toBe("ELLIPSE");
  });

  it("converts circle shape as ELLIPSE", () => {
    const shape: PigmaShape = {
      id: "ghi",
      type: "shape",
      shapeVariant: "circle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fill: "#00FF00",
      fillMode: "fill",
    };

    const node = pigmaToFigma(shape);
    expect(node.type).toBe("ELLIPSE");
  });

  it("converts textBox", () => {
    const shape: PigmaShape = {
      id: "jkl",
      type: "textBox",
      x: 10,
      y: 20,
      width: 200,
      height: 30,
      text: "Hello World",
      fontSize: 24,
      textAlign: "center",
    };

    const node = pigmaToFigma(shape);
    expect(node.type).toBe("TEXT");
    expect(node.characters).toBe("Hello World");
    expect(node.style?.fontSize).toBe(24);
    expect(node.style?.textAlignHorizontal).toBe("CENTER");
  });

  it("converts stickyNote", () => {
    const shape: PigmaShape = {
      id: "mno",
      type: "stickyNote",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      text: "Remember this",
      backgroundColor: "#FEF08A",
    };

    const node = pigmaToFigma(shape);
    expect(node.type).toBe("STICKY");
    expect(node.characters).toBe("Remember this");
    expect(node.fills).toHaveLength(1);
  });

  it("handles nofill mode", () => {
    const shape: PigmaShape = {
      id: "pqr",
      type: "shape",
      shapeVariant: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fill: "#FF0000",
      fillMode: "nofill",
    };

    const node = pigmaToFigma(shape);
    expect(node.fills).toHaveLength(0);
  });
});

// ============================================================================
// Round-trip Tests
// ============================================================================

describe("round-trip: figmaToPigma → pigmaToFigma", () => {
  it("preserves rectangle position and size", () => {
    const original: FigmaNode = {
      id: "1:1",
      name: "rect",
      type: "RECTANGLE",
      absoluteBoundingBox: { x: 150, y: 250, width: 300, height: 200 },
      fills: [{ type: "SOLID", color: { r: 0.5, g: 0.3, b: 0.8, a: 1 } }],
      strokeWeight: 1,
      opacity: 0.9,
    };

    const pigma = figmaToPigma(original)!;
    const roundTripped = pigmaToFigma(pigma);

    expect(roundTripped.type).toBe(original.type);
    expect(roundTripped.absoluteBoundingBox!.x).toBeCloseTo(
      original.absoluteBoundingBox!.x,
      0,
    );
    expect(roundTripped.absoluteBoundingBox!.y).toBeCloseTo(
      original.absoluteBoundingBox!.y,
      0,
    );
    expect(roundTripped.absoluteBoundingBox!.width).toBeCloseTo(
      original.absoluteBoundingBox!.width,
      0,
    );
    expect(roundTripped.absoluteBoundingBox!.height).toBeCloseTo(
      original.absoluteBoundingBox!.height,
      0,
    );
    expect(roundTripped.opacity).toBeCloseTo(original.opacity!, 2);
  });

  it("preserves fill color through conversion", () => {
    const original: FigmaNode = {
      id: "1:2",
      name: "colored",
      type: "RECTANGLE",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
      fills: [{ type: "SOLID", color: { r: 0.235, g: 0.51, b: 0.965, a: 1 } }],
    };

    const pigma = figmaToPigma(original)!;
    const roundTripped = pigmaToFigma(pigma);

    const origColor = original.fills![0]!.color!;
    const rtColor = roundTripped.fills![0]!.color!;
    // Allow ±1/255 tolerance due to hex rounding
    expect(rtColor.r).toBeCloseTo(origColor.r, 2);
    expect(rtColor.g).toBeCloseTo(origColor.g, 2);
    expect(rtColor.b).toBeCloseTo(origColor.b, 2);
  });

  it("preserves text content", () => {
    const original: FigmaNode = {
      id: "1:3",
      name: "text",
      type: "TEXT",
      absoluteBoundingBox: { x: 10, y: 20, width: 200, height: 30 },
      characters: "Hello World",
      style: {
        fontSize: 18,
        fontFamily: "Inter",
        fontWeight: 400,
        textAlignHorizontal: "LEFT",
      },
    };

    const pigma = figmaToPigma(original)!;
    const roundTripped = pigmaToFigma(pigma);

    expect(roundTripped.characters).toBe(original.characters);
    expect(roundTripped.style?.fontSize).toBe(original.style!.fontSize);
    expect(roundTripped.style?.textAlignHorizontal).toBe(
      original.style!.textAlignHorizontal,
    );
  });

  it("preserves sticky note content and color", () => {
    const original: FigmaNode = {
      id: "1:4",
      name: "sticky",
      type: "STICKY",
      absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 200 },
      characters: "Note content",
      fills: [{ type: "SOLID", color: { r: 1, g: 0.92, b: 0.23, a: 1 } }],
    };

    const pigma = figmaToPigma(original)!;
    const roundTripped = pigmaToFigma(pigma);

    expect(roundTripped.type).toBe("STICKY");
    expect(roundTripped.characters).toBe("Note content");
  });

  it("preserves ellipse type", () => {
    const original: FigmaNode = {
      id: "1:5",
      name: "circle",
      type: "ELLIPSE",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
      fills: [{ type: "SOLID", color: { r: 0, g: 1, b: 0, a: 1 } }],
    };

    const pigma = figmaToPigma(original)!;
    const roundTripped = pigmaToFigma(pigma);

    expect(roundTripped.type).toBe("ELLIPSE");
  });
});

// ============================================================================
// extractLeafNodes Tests
// ============================================================================

describe("extractLeafNodes", () => {
  it("extracts leaf nodes from nested document", () => {
    const doc: FigmaNode = {
      id: "0:0",
      name: "Document",
      type: "DOCUMENT",
      children: [
        {
          id: "0:1",
          name: "Page 1",
          type: "CANVAS",
          children: [
            {
              id: "1:1",
              name: "rect",
              type: "RECTANGLE",
              absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
            },
            {
              id: "1:2",
              name: "text",
              type: "TEXT",
              absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 30 },
              characters: "Hello",
            },
          ],
        },
      ],
    };

    const leaves = extractLeafNodes(doc);
    expect(leaves).toHaveLength(2);
    expect(leaves[0]!.type).toBe("RECTANGLE");
    expect(leaves[1]!.type).toBe("TEXT");
  });

  it("recurses into frames with children", () => {
    const doc: FigmaNode = {
      id: "0:0",
      name: "Document",
      type: "DOCUMENT",
      children: [
        {
          id: "0:1",
          name: "Page",
          type: "CANVAS",
          children: [
            {
              id: "1:1",
              name: "Frame",
              type: "FRAME",
              absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 300 },
              children: [
                {
                  id: "2:1",
                  name: "inner-rect",
                  type: "RECTANGLE",
                  absoluteBoundingBox: { x: 10, y: 10, width: 50, height: 50 },
                },
              ],
            },
          ],
        },
      ],
    };

    const leaves = extractLeafNodes(doc);
    expect(leaves).toHaveLength(1);
    expect(leaves[0]!.id).toBe("2:1");
  });

  it("includes childless FRAME as renderable", () => {
    const doc: FigmaNode = {
      id: "0:0",
      name: "Document",
      type: "DOCUMENT",
      children: [
        {
          id: "0:1",
          name: "Page",
          type: "CANVAS",
          children: [
            {
              id: "1:1",
              name: "empty-frame",
              type: "FRAME",
              absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 100 },
            },
          ],
        },
      ],
    };

    const leaves = extractLeafNodes(doc);
    expect(leaves).toHaveLength(1);
    expect(leaves[0]!.type).toBe("FRAME");
  });

  it("skips unsupported types but includes VECTOR", () => {
    const doc: FigmaNode = {
      id: "0:0",
      name: "Document",
      type: "DOCUMENT",
      children: [
        {
          id: "0:1",
          name: "Page",
          type: "CANVAS",
          children: [
            {
              id: "1:1",
              name: "instance",
              type: "INSTANCE",
              absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
            },
            {
              id: "1:2",
              name: "vector",
              type: "VECTOR",
              absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
            },
            {
              id: "1:3",
              name: "rect",
              type: "RECTANGLE",
              absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
            },
          ],
        },
      ],
    };

    const leaves = extractLeafNodes(doc);
    expect(leaves).toHaveLength(2);
    expect(leaves[0]!.type).toBe("VECTOR");
    expect(leaves[1]!.type).toBe("RECTANGLE");
  });

  it("handles empty document", () => {
    const doc: FigmaNode = {
      id: "0:0",
      name: "Document",
      type: "DOCUMENT",
      children: [],
    };

    expect(extractLeafNodes(doc)).toHaveLength(0);
  });

  it("handles deeply nested groups", () => {
    const doc: FigmaNode = {
      id: "0:0",
      name: "Document",
      type: "DOCUMENT",
      children: [
        {
          id: "0:1",
          name: "Page",
          type: "CANVAS",
          children: [
            {
              id: "1:1",
              name: "Group1",
              type: "GROUP",
              children: [
                {
                  id: "2:1",
                  name: "Group2",
                  type: "GROUP",
                  children: [
                    {
                      id: "3:1",
                      name: "deep-ellipse",
                      type: "ELLIPSE",
                      absoluteBoundingBox: {
                        x: 0,
                        y: 0,
                        width: 50,
                        height: 50,
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const leaves = extractLeafNodes(doc);
    expect(leaves).toHaveLength(1);
    expect(leaves[0]!.id).toBe("3:1");
  });
});

// ============================================================================
// svgPathToPoints Tests
// ============================================================================

describe("svgPathToPoints", () => {
  it("parses M L path", () => {
    const points = svgPathToPoints("M 0 0 L 100 50 L 200 100");
    expect(points).toEqual([0, 0, 100, 50, 200, 100]);
  });

  it("parses relative m l path", () => {
    const points = svgPathToPoints("m 10 20 l 30 40 l 50 60");
    expect(points).toEqual([10, 20, 40, 60, 90, 120]);
  });

  it("parses cubic bezier (C) — samples curve points", () => {
    const points = svgPathToPoints("M 0 0 C 10 20 30 40 50 60");
    // Should have start point + 8 sampled points = 18 values (9 points * 2)
    expect(points.length).toBeGreaterThan(4);
    expect(points[0]).toBe(0);
    expect(points[1]).toBe(0);
    // Last point should be the endpoint
    expect(points[points.length - 2]).toBeCloseTo(50, 1);
    expect(points[points.length - 1]).toBeCloseTo(60, 1);
  });

  it("parses H and V commands", () => {
    const points = svgPathToPoints("M 0 0 H 100 V 50");
    expect(points).toEqual([0, 0, 100, 0, 100, 50]);
  });

  it("parses Z (closepath)", () => {
    const points = svgPathToPoints("M 0 0 L 100 0 L 100 100 Z");
    expect(points).toEqual([0, 0, 100, 0, 100, 100, 0, 0]);
  });

  it("handles empty path", () => {
    expect(svgPathToPoints("")).toEqual([]);
  });

  it("parses complex freehand path", () => {
    const points = svgPathToPoints("M 10 20 L 30 40 L 50 20 L 70 60");
    expect(points).toHaveLength(8);
    expect(points[0]).toBe(10);
    expect(points[1]).toBe(20);
  });

  it("parses quadratic bezier (Q) — samples curve points", () => {
    const points = svgPathToPoints("M 0 0 Q 50 100 100 0");
    expect(points.length).toBeGreaterThan(4);
    expect(points[0]).toBe(0);
    expect(points[1]).toBe(0);
    // Last point should be the endpoint
    expect(points[points.length - 2]).toBeCloseTo(100, 1);
    expect(points[points.length - 1]).toBeCloseTo(0, 1);
  });
});

// ============================================================================
// VECTOR/LINE figmaToPigma Tests
// ============================================================================

describe("figmaToPigma — VECTOR/LINE", () => {
  it("converts VECTOR with fillGeometry as line", () => {
    const node: FigmaNode = {
      id: "1:20",
      name: "drawing",
      type: "VECTOR",
      absoluteBoundingBox: { x: 100, y: 200, width: 150, height: 80 },
      fillGeometry: [
        { path: "M 0 0 L 50 30 L 150 80", windingRule: "NONZERO" },
      ],
      fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 } }],
      strokeWeight: 3,
    };

    const shape = figmaToPigma(node);
    expect(shape).not.toBeNull();
    expect(shape!.type).toBe("line");
    expect(shape!.points).toEqual([0, 0, 50, 30, 150, 80]);
  });

  it("converts stroke-only VECTOR as image", () => {
    const node: FigmaNode = {
      id: "1:20b",
      name: "freehand",
      type: "VECTOR",
      absoluteBoundingBox: { x: 100, y: 200, width: 150, height: 80 },
      strokeGeometry: [
        { path: "M 0 0 L 50 30 L 150 80", windingRule: "NONZERO" },
      ],
      strokes: [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 } }],
    };

    const shape = figmaToPigma(node);
    expect(shape).not.toBeNull();
    expect(shape!.type).toBe("image");
    expect(shape!.imageRef).toBe("node:1:20b");
  });

  it("converts LINE as connector", () => {
    const node: FigmaNode = {
      id: "1:21",
      name: "line",
      type: "LINE",
      absoluteBoundingBox: { x: 50, y: 50, width: 200, height: 0 },
      strokes: [{ type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 } }],
      strokeWeight: 2,
    };

    const shape = figmaToPigma(node);
    expect(shape!.type).toBe("connector");
    expect(shape!.x).toBe(50);
    expect(shape!.y).toBe(50);
    expect(shape!.endX).toBe(250);
    expect(shape!.endY).toBe(50);
    expect(shape!.stroke).toBe("#FF0000");
  });

  it("converts VECTOR with fillGeometry fallback", () => {
    const node: FigmaNode = {
      id: "1:22",
      name: "filled-vector",
      type: "VECTOR",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
      fillGeometry: [{ path: "M 0 0 L 50 50 L 100 0", windingRule: "NONZERO" }],
      fills: [{ type: "SOLID", color: { r: 0, g: 0.5, b: 1, a: 1 } }],
    };

    const shape = figmaToPigma(node);
    expect(shape!.type).toBe("line");
    expect(shape!.points).toEqual([0, 0, 50, 50, 100, 0]);
  });

  it("converts VECTOR with no fill and stroke-only as image", () => {
    const node: FigmaNode = {
      id: "1:23",
      name: "tiny",
      type: "VECTOR",
      absoluteBoundingBox: { x: 0, y: 0, width: 1, height: 1 },
      strokeGeometry: [{ path: "M 0 0", windingRule: "NONZERO" }],
    };

    const shape = figmaToPigma(node);
    expect(shape!.type).toBe("image");
  });
});

describe("폰트 매핑 (mapFigmaFontFamily)", () => {
  it("유니온에 없는 폰트는 undefined (기본 폰트 폴백)", () => {
    expect(mapFigmaFontFamily("Inter")).toBeUndefined();
    expect(mapFigmaFontFamily(undefined)).toBeUndefined();
  });

  it("손글씨 계열은 Nanum Gothic 으로 대체", () => {
    expect(mapFigmaFontFamily("Figma Hand")).toBe("Nanum Gothic");
    expect(mapFigmaFontFamily("Virgil")).toBe("Nanum Gothic");
  });

  it("유니온 폰트는 대소문자 무시하고 정규화", () => {
    expect(mapFigmaFontFamily("pretendard")).toBe("Pretendard");
    expect(mapFigmaFontFamily("Noto Sans KR")).toBe("Noto Sans KR");
  });

  it("TEXT 노드 변환 시 임의 폰트명이 저장되지 않는다", () => {
    const shape = figmaToPigma({
      id: "t:1",
      name: "text",
      type: "TEXT",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 20 },
      characters: "hi",
      style: { fontFamily: "Inter", fontSize: 14 },
    });
    expect(shape!.fontFamily).toBeUndefined();
  });
});

describe("TEXT 폭 계산", () => {
  it("고정 박스(textAutoResize NONE)는 bbox 폭을 그대로 존중한다", () => {
    const shape = figmaToPigma({
      id: "t:2",
      name: "text",
      type: "TEXT",
      absoluteBoundingBox: { x: 0, y: 0, width: 123, height: 20 },
      characters: "아주 길어질 수 있는 텍스트지만 박스는 고정",
      style: { fontSize: 14, textAutoResize: "NONE" },
    });
    expect(shape!.width).toBe(123);
  });

  it("자동 리사이즈 텍스트는 가장 긴 줄 실측 폭 이상을 보장한다", () => {
    const shape = figmaToPigma({
      id: "t:3",
      name: "text",
      type: "TEXT",
      absoluteBoundingBox: { x: 0, y: 0, width: 10, height: 20 },
      characters: "hello world hello world",
      style: { fontSize: 20, textAutoResize: "WIDTH_AND_HEIGHT" },
    });
    expect(shape!.width).toBeGreaterThan(10);
  });
});

describe("리치텍스트 매핑 (characterStyleOverrides ↔ Tiptap)", () => {
  const RED = { type: "SOLID" as const, color: { r: 1, g: 0, b: 0, a: 1 } };

  function richNode() {
    return {
      id: "t:10",
      name: "rich",
      type: "TEXT" as const,
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 20 },
      characters: "Hello World",
      style: { fontSize: 14 },
      characterStyleOverrides: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
      styleOverrideTable: {
        "1": { fontWeight: 700, fills: [RED] },
      },
    };
  }

  it("오버라이드 구간이 Tiptap bold + 색상 마크로 변환된다", () => {
    const shape = figmaToPigma(richNode());
    const para = shape!.tiptapContent!.content![0]!;
    const [plain, styled] = para.content!;
    expect(plain!.text).toBe("Hello ");
    expect(plain!.marks).toBeUndefined();
    expect(styled!.text).toBe("World");
    const markTypes = styled!.marks!.map((m) => m.type);
    expect(markTypes).toContain("bold");
    const textStyle = styled!.marks!.find((m) => m.type === "textStyle");
    expect(textStyle!.attrs!.color).toBe("#FF0000");
  });

  it("오버라이드가 전부 0이면 tiptapContent 를 만들지 않는다", () => {
    const node = { ...richNode(), characterStyleOverrides: [0, 0, 0] };
    expect(figmaToPigma(node)!.tiptapContent).toBeUndefined();
  });

  it("역변환: Tiptap → characters + overrides + table", () => {
    const shape = figmaToPigma(richNode());
    const out = tiptapToFigmaOverrides(shape!.tiptapContent!);
    expect(out.characters).toBe("Hello World");
    expect(out.characterStyleOverrides.slice(0, 6)).toEqual([0, 0, 0, 0, 0, 0]);
    const styledIds = new Set(out.characterStyleOverrides.slice(6));
    expect(styledIds.size).toBe(1);
    const id = [...styledIds][0]!;
    expect(id).not.toBe(0);
    const st = out.styleOverrideTable[String(id)]!;
    expect(st.fontWeight).toBe(700);
    expect(st.fills![0]!.color!.r).toBeCloseTo(1);
  });

  it("pigmaToFigma 가 textBox 리치텍스트를 오버라이드로 내보낸다", () => {
    const shape = figmaToPigma(richNode())!;
    const node = pigmaToFigma(shape);
    expect(node.characters).toBe("Hello World");
    expect(node.characterStyleOverrides).toHaveLength(11);
    expect(Object.keys(node.styleOverrideTable!)).toHaveLength(1);
  });
});

describe("리치텍스트 서로게이트 페어 (이모지)", () => {
  it("오버라이드 인덱스를 코드포인트 단위로 해석한다", () => {
    // "🔥ab" — Figma 기준 3글자. 코드유닛으로 세면 🔥가 2가 되어 경계가 어긋난다.
    const shape = figmaToPigma({
      id: "t:20",
      name: "emoji",
      type: "TEXT",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 20 },
      characters: "🔥ab",
      style: { fontSize: 14 },
      characterStyleOverrides: [0, 1, 1],
      styleOverrideTable: { "1": { fontWeight: 700 } },
    });
    const para = shape!.tiptapContent!.content![0]!;
    const [plain, bolded] = para.content!;
    expect(plain!.text).toBe("🔥");
    expect(bolded!.text).toBe("ab");
    expect(bolded!.marks!.some((m) => m.type === "bold")).toBe(true);
  });

  it("역변환도 코드포인트 단위로 오버라이드를 생성한다", () => {
    const shape = figmaToPigma({
      id: "t:21",
      name: "emoji",
      type: "TEXT",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 20 },
      characters: "🔥ab",
      style: { fontSize: 14 },
      characterStyleOverrides: [0, 1, 1],
      styleOverrideTable: { "1": { fontWeight: 700 } },
    });
    const out = tiptapToFigmaOverrides(shape!.tiptapContent!);
    expect(out.characters).toBe("🔥ab");
    expect(out.characterStyleOverrides).toHaveLength(3); // 코드포인트 3개
    expect(out.characterStyleOverrides[0]).toBe(0);
    expect(out.characterStyleOverrides[1]).not.toBe(0);
  });
});
