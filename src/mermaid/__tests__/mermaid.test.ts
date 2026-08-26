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

describe("분기 커넥터 묶기", () => {
  it("같은 소스에서 나가는 형제 엣지를 커넥터 하나로 묶는다", () => {
    const { objects } = convertMermaid(
      parseMermaid("flowchart TD\n  A --> B\n  A --> C"),
    );
    const connectors = objects.filter((o) => o.type === "connector");
    expect(connectors).toHaveLength(1);
    expect(connectors[0]!.targetIds).toHaveLength(2);
    expect(connectors[0]!.targetId).toBeUndefined();
  });

  it("갈래 라벨을 타깃 id 별로 옮긴다", () => {
    const { objects } = convertMermaid(
      parseMermaid("flowchart TD\n  A -->|보기| B\n  A -->|편집| C"),
    );
    const c = objects.find((o) => o.type === "connector")!;
    expect(Object.values(c.branchLabels ?? {}).sort()).toEqual([
      "보기",
      "편집",
    ]);
  });

  it("갈래가 하나뿐이면 기존 1:1 커넥터로 남는다", () => {
    const { objects } = convertMermaid(parseMermaid("flowchart TD\n  A --> B"));
    const c = objects.find((o) => o.type === "connector")!;
    expect(c.targetIds).toBeUndefined();
    expect(c.targetId).toBeDefined();
  });

  it("선 스타일이 다르면 묶지 않는다", () => {
    const { objects } = convertMermaid(
      parseMermaid("flowchart TD\n  A --> B\n  A -.-> C"),
    );
    const connectors = objects.filter((o) => o.type === "connector");
    expect(connectors).toHaveLength(2);
    expect(connectors.every((c) => c.targetIds === undefined)).toBe(true);
  });
});

describe("도착점 분산 (한 노드로 모이는 엣지)", () => {
  it("모이는 1:1 커넥터는 도착점을 앵커 변에 나눠 갖는다", () => {
    const { objects } = convertMermaid(
      parseMermaid("flowchart TD\n  A --> C\n  B --> C"),
    );
    const ratios = objects
      .filter((o) => o.type === "connector")
      .map((o) => o.targetOffsetRatioX);
    expect(ratios).toHaveLength(2);
    expect(new Set(ratios).size).toBe(2);
    for (const r of ratios) {
      expect(r).toBeGreaterThan(0);
      expect(r).toBeLessThan(1);
    }
  });

  it("모이지 않으면 도착점을 건드리지 않는다 (변의 중앙 유지)", () => {
    const { objects } = convertMermaid(parseMermaid("flowchart TD\n  A --> B"));
    const c = objects.find((o) => o.type === "connector")!;
    expect(c.targetOffsetRatioX).toBeUndefined();
    expect(c.targetOffsetRatioY).toBeUndefined();
  });

  it("갈래와 1:1 커넥터가 같은 타깃으로 가면 서로 다른 지점으로 들어간다", () => {
    // A 는 B·C 로 갈라지고(분기 커넥터), D 도 C 로 들어온다 → C 는 fan-in 2
    const { objects } = convertMermaid(
      parseMermaid("flowchart TD\n  A --> B\n  A --> C\n  D --> C"),
    );
    const branch = objects.find((o) => o.targetIds)!;
    const plain = objects.find((o) => o.type === "connector" && o.targetId)!;
    const cId = plain.targetId!;
    expect(branch.branchTargetT?.[cId]).toBeDefined();
    expect(branch.branchTargetT![cId]).not.toBe(plain.targetOffsetRatioX);
  });

  it("들어오는 변이 다르면 도착점을 밀지 않는다", () => {
    // A→C 는 위쪽 변으로, B→C 는 랭크를 건너뛰어 옆면으로 들어온다.
    // 변이 다르면 애초에 안 겹치는데 밀어내면 곧은 선이 Z 자로 꺾인다.
    const { objects } = convertMermaid(
      parseMermaid("flowchart TD\n  A --> B\n  B --> C\n  A --> C"),
    );
    const conns = objects.filter((o) => o.type === "connector");
    const straightIn = conns.filter((c) => c.targetAnchor === "top");
    // 위쪽 변으로 들어오는 게 하나뿐이면 도착점을 건드리지 않는다
    if (straightIn.length === 1) {
      expect(straightIn[0]!.targetOffsetRatioX).toBeUndefined();
    }
    // 우회 엣지는 옆면으로 들어가므로 위쪽 엣지와 슬롯을 나눠 갖지 않는다
    const sides = new Set(conns.map((c) => c.targetAnchor));
    expect(sides.size).toBeGreaterThan(1);
  });

  it("도착 비율은 변을 벗어나지 않는다", () => {
    const { objects } = convertMermaid(
      parseMermaid("flowchart TD\n  A --> E\n  B --> E\n  C --> E\n  D --> E"),
    );
    const ratios = objects
      .filter((o) => o.type === "connector")
      .map((o) => o.targetOffsetRatioX!);
    expect(Math.min(...ratios)).toBeGreaterThan(0.1);
    expect(Math.max(...ratios)).toBeLessThan(0.9);
  });
});
