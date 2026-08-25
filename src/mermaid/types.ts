// ============================================================================
// Mermaid flowchart 서브셋 타입
//
// mermaid 라이브러리 의존성 없이 자체 파서로 flowchart 문법의 핵심만 지원한다.
// 지원: flowchart/graph 방향, 노드 도형 9종, 엣지(실선/점선/굵은선, 라벨, 체인, &)
// 미지원(스킵): subgraph 그룹핑, style/classDef/click/linkStyle
// ============================================================================

/** mermaid 노드 도형 → pig-ma ShapeVariant 매핑의 중간 표현 */
export type MermaidNodeShape =
  | "process" // A[Text]
  | "rounded" // A(Text)
  | "stadium" // A([Text])
  | "circle" // A((Text))
  | "decision" // A{Text}
  | "hexagon" // A{{Text}}
  | "database" // A[(Text)]
  | "subroutine" // A[[Text]]
  | "data"; // A[/Text/]

/** classDef/class/style 로 지정한 노드 스타일 (지원 키만) */
export interface MermaidNodeStyle {
  fill?: string;
  stroke?: string;
  textColor?: string;
  strokeWidth?: number;
}

export interface MermaidNode {
  id: string;
  label: string;
  shape: MermaidNodeShape;
  style?: MermaidNodeStyle;
}

export type MermaidEdgeStyle = "solid" | "dotted" | "thick";

export interface MermaidEdge {
  from: string;
  to: string;
  label?: string;
  style: MermaidEdgeStyle;
  /** false 면 화살촉 없는 연결선 (---) */
  arrow: boolean;
}

export type MermaidDirection = "TD" | "LR" | "BT" | "RL";

export interface MermaidGraph {
  direction: MermaidDirection;
  nodes: MermaidNode[];
  edges: MermaidEdge[];
}

export class MermaidImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MermaidImportError";
  }
}
