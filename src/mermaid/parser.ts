import type {
  MermaidNodeStyle,
  MermaidDirection,
  MermaidEdge,
  MermaidEdgeStyle,
  MermaidGraph,
  MermaidNode,
  MermaidNodeShape,
} from "./types";
import { MermaidImportError } from "./types";

// ============================================================================
// Mermaid flowchart 파서 (서브셋)
// ============================================================================

/** 여는 괄호 → 도형. 긴 패턴을 먼저 매칭해야 한다 (`((` 가 `(` 보다 먼저) */
const SHAPE_BRACKETS: {
  open: string;
  close: string;
  shape: MermaidNodeShape;
}[] = [
  { open: "((", close: "))", shape: "circle" },
  { open: "([", close: "])", shape: "stadium" },
  { open: "[(", close: ")]", shape: "database" },
  { open: "[[", close: "]]", shape: "subroutine" },
  { open: "[/", close: "/]", shape: "data" },
  { open: "{{", close: "}}", shape: "hexagon" },
  { open: "[", close: "]", shape: "process" },
  { open: "(", close: ")", shape: "rounded" },
  { open: "{", close: "}", shape: "decision" },
];

/** 문장 안에서 엣지 연산자를 분리하는 정규식 (캡처 그룹으로 split) */
const EDGE_SPLIT_RE =
  /\s*(-\.+->|-\.+-|={2,}>|={2,}|-{2,}>|-{2,})(\|[^|]*\|)?\s*/;

const SKIP_KEYWORDS = ["subgraph", "end", "click", "linkStyle", "direction"];

/** `fill:#fff,stroke:#333,color:#111,stroke-width:2px` → MermaidNodeStyle */
function parseStyleDecl(decl: string): MermaidNodeStyle {
  const out: MermaidNodeStyle = {};
  for (const pair of decl.split(",")) {
    const idx = pair.indexOf(":");
    if (idx < 0) continue;
    const key = pair.slice(0, idx).trim().toLowerCase();
    const value = pair.slice(idx + 1).trim();
    if (!value) continue;
    if (key === "fill") out.fill = value;
    else if (key === "stroke") out.stroke = value;
    else if (key === "color") out.textColor = value;
    else if (key === "stroke-width") {
      const n = parseFloat(value);
      if (Number.isFinite(n)) out.strokeWidth = n;
    }
  }
  return out;
}

function parseDirection(token: string | undefined): MermaidDirection {
  switch (token?.toUpperCase()) {
    case "LR":
      return "LR";
    case "RL":
      return "RL";
    case "BT":
      return "BT";
    case "TD":
    case "TB":
    default:
      return "TD";
  }
}

function edgeStyleOf(op: string): { style: MermaidEdgeStyle; arrow: boolean } {
  const arrow = op.endsWith(">");
  if (op.startsWith("-.")) return { style: "dotted", arrow };
  if (op.startsWith("=")) return { style: "thick", arrow };
  return { style: "solid", arrow };
}

/**
 * `-- label -->` / `-. label .->` / `== label ==>` 인라인 라벨을
 * `-->|label|` 형태로 정규화한다.
 */
function normalizeInlineLabels(line: string): string {
  return line
    .replace(/--\s+([^->|][^->]*?)\s+-->/g, "-->|$1|")
    .replace(/--\s+([^->|][^->]*?)\s+---/g, "---|$1|")
    .replace(/-\.\s+(.+?)\s+\.->/g, "-.->|$1|")
    .replace(/==\s+(.+?)\s+==>/g, "==>|$1|");
}

/** 노드 세그먼트 하나(`A[Label]`, `A`) 파싱. 실패 시 null */
function parseNodeSegment(
  segment: string,
): { id: string; label?: string; shape?: MermaidNodeShape } | null {
  const trimmed = segment.trim();
  if (!trimmed) return null;

  const idMatch = /^([A-Za-z0-9_.-]+)/.exec(trimmed);
  if (!idMatch) return null;
  const id = idMatch[1]!;
  const rest = trimmed.slice(id.length).trim();
  if (!rest) return { id };

  for (const { open, close, shape } of SHAPE_BRACKETS) {
    if (rest.startsWith(open) && rest.endsWith(close)) {
      let label = rest.slice(open.length, rest.length - close.length).trim();
      // 따옴표 라벨: A["Some (special) text"]
      if (label.startsWith('"') && label.endsWith('"')) {
        label = label.slice(1, -1);
      }
      return { id, label, shape };
    }
  }
  // 인식 못 하는 꼬리는 무시하고 id 만 사용
  return { id };
}

/**
 * Mermaid flowchart 텍스트를 파싱한다.
 * 실패 시 MermaidImportError (사용자에게 그대로 보여줄 수 있는 메시지).
 */
export function parseMermaid(source: string): MermaidGraph {
  const lines = source
    .split(/\r?\n/)
    .map((l) => l.replace(/%%.*$/, "").trim()) // 주석 제거
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new MermaidImportError("Empty diagram");
  }

  let direction: MermaidDirection = "TD";
  const nodesById = new Map<string, MermaidNode>();
  const edges: MermaidEdge[] = [];
  let sawHeader = false;
  const classDefs = new Map<string, MermaidNodeStyle>();
  /** class 문이 노드 정의보다 먼저 나올 수 있어 배정만 모아 두고 끝에 적용한다 */
  const pendingClass: Array<{ ids: string[]; names: string[] }> = [];
  const pendingStyle = new Map<string, MermaidNodeStyle>();

  /** 노드 등록 — 라벨/도형이 있는 정의가 bare 참조보다 우선 */
  function upsertNode(seg: {
    id: string;
    label?: string;
    shape?: MermaidNodeShape;
  }): void {
    const existing = nodesById.get(seg.id);
    if (existing) {
      if (seg.label !== undefined) existing.label = seg.label;
      if (seg.shape !== undefined) existing.shape = seg.shape;
      return;
    }
    nodesById.set(seg.id, {
      id: seg.id,
      label: seg.label ?? seg.id,
      shape: seg.shape ?? "process",
    });
  }

  for (const rawLine of lines) {
    // 헤더
    const header = /^(?:flowchart|graph)\s*([A-Za-z]{2})?/.exec(rawLine);
    if (
      header &&
      (rawLine.startsWith("flowchart") || rawLine.startsWith("graph"))
    ) {
      direction = parseDirection(header[1]);
      sawHeader = true;
      continue;
    }
    // 지원하지 않는 키워드 라인 스킵
    const firstWord = rawLine.split(/\s+/)[0]!;
    if (SKIP_KEYWORDS.includes(firstWord)) continue;

    // classDef <name> k:v,...
    const classDef = /^classDef\s+(\S+)\s+(.+)$/.exec(rawLine);
    if (classDef) {
      classDefs.set(classDef[1]!, parseStyleDecl(classDef[2]!));
      continue;
    }
    // class <id>[,<id>...] <name>[,<name>...]
    const classAssign = /^class\s+([^\s]+)\s+(\S+)$/.exec(rawLine);
    if (classAssign) {
      pendingClass.push({
        ids: classAssign[1]!
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        names: classAssign[2]!
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      });
      continue;
    }
    // style <id> k:v,...
    const styleLine = /^style\s+(\S+)\s+(.+)$/.exec(rawLine);
    if (styleLine) {
      pendingStyle.set(styleLine[1]!, parseStyleDecl(styleLine[2]!));
      continue;
    }

    // 세미콜론으로 구분된 복수 문장
    for (const stmt of rawLine.split(";")) {
      const line = normalizeInlineLabels(stmt.trim());
      if (!line) continue;

      // 엣지 연산자로 분할: [seg, op, label?, seg, op, label?, seg, ...]
      const parts = line.split(EDGE_SPLIT_RE);
      if (parts.length === 1) {
        // 단독 노드 정의
        const seg = parseNodeSegment(line);
        if (seg) upsertNode(seg);
        continue;
      }

      // parts: node, (op, label, node)*
      let prevIds: string[] = [];
      const firstSegs = parts[0]!.split("&").map(parseNodeSegment);
      for (const seg of firstSegs) {
        if (seg) {
          upsertNode(seg);
          prevIds.push(seg.id);
        }
      }

      for (let i = 1; i + 2 < parts.length + 1; i += 3) {
        const op = parts[i];
        const labelPart = parts[i + 1];
        const nodePart = parts[i + 2];
        if (!op || nodePart === undefined) break;

        const currentIds: string[] = [];
        for (const seg of nodePart.split("&").map(parseNodeSegment)) {
          if (seg) {
            upsertNode(seg);
            currentIds.push(seg.id);
          }
        }
        const { style, arrow } = edgeStyleOf(op);
        const label = labelPart
          ? labelPart.slice(1, -1).trim() || undefined
          : undefined;

        for (const from of prevIds) {
          for (const to of currentIds) {
            edges.push({ from, to, label, style, arrow });
          }
        }
        prevIds = currentIds;
      }
    }
  }

  if (!sawHeader) {
    throw new MermaidImportError(
      'Not a flowchart — expected "flowchart TD" or "graph LR" header',
    );
  }
  if (nodesById.size === 0) {
    throw new MermaidImportError("No nodes found in diagram");
  }

  // class → classDef → style 순으로 겹쳐 쓴다 (style 이 가장 구체적)
  for (const { ids, names } of pendingClass) {
    for (const id of ids) {
      const node = nodesById.get(id);
      if (!node) continue;
      for (const name of names) {
        const def = classDefs.get(name);
        if (def) node.style = { ...node.style, ...def };
      }
    }
  }
  for (const [id, style] of pendingStyle) {
    const node = nodesById.get(id);
    if (node) node.style = { ...node.style, ...style };
  }

  return { direction, nodes: [...nodesById.values()], edges };
}
