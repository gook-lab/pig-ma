import { describe, it, expect } from "vitest";
import { parseMermaid } from "../parser";
import { layoutGraph } from "../layout";
import { convertMermaid } from "../import";
import { MermaidImportError } from "../types";

describe("parseMermaid — 노드", () => {
  it("도형 문법 9종을 파싱한다", () => {
    const graph = parseMermaid(`flowchart TD
      A[Process]
      B(Rounded)
      C([Stadium])
      D((Circle))
      E{Decision}
      F{{Hexagon}}
      G[(Database)]
      H[[Subroutine]]
      I[/Data/]`);

    const shapeOf = (id: string) => graph.nodes.find((n) => n.id === id)?.shape;
    expect(shapeOf("A")).toBe("process");
    expect(shapeOf("B")).toBe("rounded");
    expect(shapeOf("C")).toBe("stadium");
    expect(shapeOf("D")).toBe("circle");
    expect(shapeOf("E")).toBe("decision");
    expect(shapeOf("F")).toBe("hexagon");
    expect(shapeOf("G")).toBe("database");
    expect(shapeOf("H")).toBe("subroutine");
    expect(shapeOf("I")).toBe("data");
  });

  it("라벨 없는 bare 노드는 id 를 라벨로 쓴다", () => {
    const graph = parseMermaid("graph LR\n A --> B");
    expect(graph.nodes.find((n) => n.id === "A")!.label).toBe("A");
  });

  it("따옴표 라벨과 나중 정의 우선 병합", () => {
    const graph = parseMermaid(`flowchart TD
      A --> B
      A["Quoted (label)"]`);
    expect(graph.nodes.find((n) => n.id === "A")!.label).toBe("Quoted (label)");
  });

  it("방향 파싱: TB는 TD 로, LR/BT/RL 유지", () => {
    expect(parseMermaid("flowchart TB\nA").direction).toBe("TD");
    expect(parseMermaid("graph LR\nA").direction).toBe("LR");
    expect(parseMermaid("flowchart BT\nA").direction).toBe("BT");
    expect(parseMermaid("flowchart RL\nA").direction).toBe("RL");
  });
});

describe("parseMermaid — 엣지", () => {
  it("기본 화살표와 파이프 라벨", () => {
    const graph = parseMermaid(`flowchart TD
      A -->|yes| B
      A --> C`);
    expect(graph.edges).toHaveLength(2);
    expect(graph.edges[0]).toMatchObject({
      from: "A",
      to: "B",
      label: "yes",
      style: "solid",
      arrow: true,
    });
    expect(graph.edges[1]!.label).toBeUndefined();
  });

  it("인라인 라벨 -- text --> 를 정규화한다", () => {
    const graph = parseMermaid("flowchart TD\n A -- no --> B");
    expect(graph.edges[0]!.label).toBe("no");
  });

  it("점선/굵은선/화살촉 없음", () => {
    const graph = parseMermaid(`flowchart TD
      A -.-> B
      A === C
      A --- D`);
    expect(graph.edges[0]).toMatchObject({ style: "dotted", arrow: true });
    expect(graph.edges[1]).toMatchObject({ style: "thick", arrow: false });
    expect(graph.edges[2]).toMatchObject({ style: "solid", arrow: false });
  });

  it("체인 A --> B --> C 은 엣지 2개", () => {
    const graph = parseMermaid("flowchart TD\n A --> B --> C");
    expect(graph.edges.map((e) => [e.from, e.to])).toEqual([
      ["A", "B"],
      ["B", "C"],
    ]);
  });

  it("& 팬아웃: A & B --> C 은 엣지 2개", () => {
    const graph = parseMermaid("flowchart TD\n A & B --> C");
    expect(graph.edges.map((e) => [e.from, e.to])).toEqual([
      ["A", "C"],
      ["B", "C"],
    ]);
  });

  it("노드 정의가 엣지 안에 인라인으로 있어도 파싱된다", () => {
    const graph = parseMermaid(
      "flowchart TD\n A[Start] --> B{Working?}\n B -->|No| A",
    );
    expect(graph.nodes.find((n) => n.id === "B")!.shape).toBe("decision");
    expect(graph.edges).toHaveLength(2);
  });
});

describe("parseMermaid — 무시/에러", () => {
  it("주석과 미지원 키워드 라인은 무시한다", () => {
    const graph = parseMermaid(`flowchart TD
      %% comment line
      A --> B %% trailing comment
      style A fill:#f9f
      classDef default fill:#fff
      subgraph one
      C --> D
      end`);
    expect(graph.nodes.map((n) => n.id).sort()).toEqual(["A", "B", "C", "D"]);
    expect(graph.edges).toHaveLength(2);
  });

  it("헤더 없으면 에러", () => {
    expect(() => parseMermaid("A --> B")).toThrow(MermaidImportError);
  });

  it("빈 입력이면 에러", () => {
    expect(() => parseMermaid("  \n  ")).toThrow(/Empty/);
  });
});

describe("layoutGraph", () => {
  it("TD: 랭크가 깊어질수록 y 가 커진다", () => {
    const graph = parseMermaid("flowchart TD\n A --> B --> C");
    const layout = layoutGraph(graph);
    expect(layout.get("A")!.y).toBeLessThan(layout.get("B")!.y);
    expect(layout.get("B")!.y).toBeLessThan(layout.get("C")!.y);
  });

  it("LR: 랭크가 깊어질수록 x 가 커진다", () => {
    const graph = parseMermaid("graph LR\n A --> B --> C");
    const layout = layoutGraph(graph);
    expect(layout.get("A")!.x).toBeLessThan(layout.get("B")!.x);
  });

  it("BT: 랭크 축이 반전된다", () => {
    const graph = parseMermaid("flowchart BT\n A --> B");
    const layout = layoutGraph(graph);
    expect(layout.get("A")!.y).toBeGreaterThan(layout.get("B")!.y);
  });

  it("같은 랭크 노드는 겹치지 않는다", () => {
    const graph = parseMermaid("flowchart TD\n A --> B\n A --> C");
    const layout = layoutGraph(graph);
    const b = layout.get("B")!;
    const c = layout.get("C")!;
    const overlap = b.x < c.x + c.width && c.x < b.x + b.width;
    expect(overlap).toBe(false);
  });

  it("사이클이 있어도 완료된다 (무한루프 없음)", () => {
    const graph = parseMermaid("flowchart TD\n A --> B\n B --> A");
    const layout = layoutGraph(graph);
    expect(layout.size).toBe(2);
  });
});

describe("convertMermaid", () => {
  it("노드 → flow variant shape, 엣지 → attached connector", () => {
    const graph = parseMermaid(
      "flowchart TD\n A[Start] --> B{OK?}\n B -->|yes| C([End])",
    );
    const { objects } = convertMermaid(graph);
    const shapes = objects.filter((o) => o.type === "shape");
    const connectors = objects.filter((o) => o.type === "connector");

    expect(shapes).toHaveLength(3);
    expect(connectors).toHaveLength(2);
    expect(shapes.map((s) => s.shapeVariant).sort()).toEqual([
      "flowDecision",
      "flowProcess",
      "flowTerminal",
    ]);

    const labeled = connectors.find((c) => c.label === "yes")!;
    const decision = shapes.find((s) => s.shapeVariant === "flowDecision")!;
    expect(labeled.sourceId).toBe(decision.id);
    expect(labeled.endMarker).toBe("arrow");
  });

  it("점선 엣지는 dashed lineStyle 로", () => {
    const graph = parseMermaid("flowchart TD\n A -.-> B");
    const conn = convertMermaid(graph).objects.find(
      (o) => o.type === "connector",
    )!;
    expect(conn.lineStyle).toBe("dashed");
  });

  it("생성된 object id 는 mermaid id 와 무관한 UUID (재import 충돌 방지)", () => {
    const graph = parseMermaid("flowchart TD\n A --> B");
    const first = convertMermaid(graph).objects.map((o) => o.id);
    const second = convertMermaid(graph).objects.map((o) => o.id);
    expect(first.some((id) => second.includes(id))).toBe(false);
  });
});
