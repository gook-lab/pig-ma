import { nanoid } from "nanoid";
import { DEFAULT_FONT_FAMILY } from "@/constants/fonts";
import type {
  CanvasObject,
  AIGenerateResponse,
  AIShapeDefinition,
  AILayoutHint,
} from "@/types";

/**
 * AI 응답의 shape 정의를 실제 CanvasObject 배열로 변환
 * connector는 source/target shape를 ID로 연결
 */
export function convertAIShapesToObjects(
  response: AIGenerateResponse,
  viewportCenter: { x: number; y: number },
): CanvasObject[] {
  const { shapes, layout } = response;

  // 커넥터와 일반 shape 분리
  const nodeShapes = shapes.filter((s) => s.type !== "connector");
  const connectorShapes = shapes.filter((s) => s.type === "connector");

  // 커넥터에서 edge 정보 추출 → 노드에 connections 병합 (레이아웃용)
  const edges = extractEdges(nodeShapes, connectorShapes);
  const nodesWithEdges = mergeEdgesToNodes(nodeShapes, edges);

  // 레이아웃 적용 (노드만)
  const positioned = applyLayout(nodesWithEdges, layout);

  // 바운딩 박스 계산 → 뷰포트 중앙 배치
  const bounds = calculateBounds(positioned);
  const offsetX = viewportCenter.x - bounds.centerX;
  const offsetY = viewportCenter.y - bounds.centerY;

  // CanvasObject로 변환
  const objects: CanvasObject[] = [];
  const idMap = new Map<number, string>(); // node index → CanvasObject ID

  for (let i = 0; i < positioned.length; i++) {
    const shape = positioned[i]!;
    const id = nanoid();
    idMap.set(i, id);

    const obj = createCanvasObjectFromAI(shape, id, offsetX, offsetY);
    objects.push(obj);
  }

  // 모든 edge에서 커넥터 생성 (위치 기반 앵커 결정)
  for (const edge of edges) {
    const sourceId = idMap.get(edge.source);
    const targetId = idMap.get(edge.target);
    if (sourceId && targetId) {
      const sourceShape = positioned[edge.source]!;
      const targetShape = positioned[edge.target]!;
      const anchors = computeAnchors(sourceShape, targetShape);
      objects.push(
        createConnectorObject(
          sourceId,
          targetId,
          edge.label,
          anchors.sourceAnchor,
          anchors.targetAnchor,
        ),
      );
    }
  }

  return objects;
}

// ============================================================================
// Edge Extraction — 커넥터와 노드의 connection 정보를 통합
// ============================================================================

interface Edge {
  source: number;
  target: number;
  label?: string;
}

/**
 * 노드의 connections + 별도 connector shapes에서 모든 edge 추출
 */
function extractEdges(
  nodeShapes: AIShapeDefinition[],
  connectorShapes: AIShapeDefinition[],
): Edge[] {
  const edges: Edge[] = [];
  const seen = new Set<string>();

  const addEdge = (source: number, target: number, label?: string) => {
    if (source < 0 || source >= nodeShapes.length) return;
    if (target < 0 || target >= nodeShapes.length) return;
    const key = `${source}->${target}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ source, target, label });
  };

  // 1) 노드 자체의 connections (source = node index, target = conn.targetIndex)
  nodeShapes.forEach((shape, i) => {
    if (shape.connections) {
      for (const conn of shape.connections) {
        addEdge(i, conn.targetIndex, conn.label);
      }
    }
  });

  // 2) 별도 connector shapes — sourceIndex/targetIndex 추출
  for (const conn of connectorShapes) {
    if (!conn.connections || conn.connections.length === 0) continue;
    for (const c of conn.connections) {
      const raw = c as Record<string, unknown>;
      const source =
        typeof raw.sourceIndex === "number" ? raw.sourceIndex : undefined;
      const target =
        typeof raw.targetIndex === "number"
          ? raw.targetIndex
          : typeof c.targetIndex === "number"
            ? c.targetIndex
            : undefined;

      if (source !== undefined && target !== undefined) {
        addEdge(source, target, c.label);
      } else if (target !== undefined && conn.connections.length === 1) {
        // sourceIndex 없으면 label 텍스트에서 힌트 찾기 — 불가능하면 skip
        // Gemini가 보통 { sourceIndex, targetIndex } 형태로 줌
      }
    }
  }

  return edges;
}

/**
 * edge 정보를 노드의 connections 필드로 병합 (레이아웃 알고리즘용)
 */
function mergeEdgesToNodes(
  nodes: AIShapeDefinition[],
  edges: Edge[],
): AIShapeDefinition[] {
  return nodes.map((node, i) => {
    const outEdges = edges.filter((e) => e.source === i);
    if (outEdges.length === 0 && !node.connections) return node;

    const existing = node.connections || [];
    const merged = [
      ...existing,
      ...outEdges
        .filter((e) => !existing.some((c) => c.targetIndex === e.target))
        .map((e) => ({ targetIndex: e.target, label: e.label })),
    ];

    return { ...node, connections: merged };
  });
}

// ============================================================================
// Shape → CanvasObject 변환
// ============================================================================

/**
 * AI shape → CanvasObject 변환
 */
function createCanvasObjectFromAI(
  shape: AIShapeDefinition,
  id: string,
  offsetX: number,
  offsetY: number,
): CanvasObject {
  const x = shape.x + offsetX;
  const y = shape.y + offsetY;

  if (shape.type === "stickyNote") {
    return {
      id,
      type: "stickyNote",
      x,
      y,
      width: shape.width || 150,
      height: shape.height || 150,
      backgroundColor: shape.fill || "#fef08a",
      text: shape.text || "",
      fontSize: 16,
      fontWeight: "normal",
      textDecoration: "none",
      fontFamily: DEFAULT_FONT_FAMILY,
      fontSizePreset: "S",
      textAlign: "left",
      rotation: 0,
      opacity: 1,
    };
  }

  if (shape.type === "textBox") {
    return {
      id,
      type: "textBox",
      x,
      y,
      width: shape.width || 150,
      height: shape.height || 40,
      text: shape.text || "",
      textColor: "#000000",
      fontFamily: DEFAULT_FONT_FAMILY,
      fontSizePreset: "M",
      fontSize: 16,
      fontWeight: "normal",
      textDecoration: "none",
      textAlign: "left",
      rotation: 0,
      opacity: 1,
    };
  }

  // default: shape
  return {
    id,
    type: "shape",
    x,
    y,
    width: shape.width || 150,
    height: shape.height || 80,
    shapeVariant: shape.shapeVariant || "rectangle",
    fill: shape.fill || "#bfdbfe",
    stroke: "#1e3a5f",
    strokeWidth: 2,
    text: shape.text || "",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "normal",
    textDecoration: "none",
    rotation: 0,
    opacity: 1,
  };
}

/**
 * source/target 위치 기반으로 최적 앵커 방향 계산
 */
function computeAnchors(
  source: AIShapeDefinition,
  target: AIShapeDefinition,
): {
  sourceAnchor: "top" | "bottom" | "left" | "right";
  targetAnchor: "top" | "bottom" | "left" | "right";
} {
  const sw = source.width || 150;
  const sh = source.height || 80;
  const tw = target.width || 150;
  const th = target.height || 80;

  const scx = source.x + sw / 2;
  const scy = source.y + sh / 2;
  const tcx = target.x + tw / 2;
  const tcy = target.y + th / 2;

  const dx = tcx - scx;
  const dy = tcy - scy;

  if (Math.abs(dy) >= Math.abs(dx)) {
    // 수직 흐름이 우세
    if (dy >= 0) {
      return { sourceAnchor: "bottom", targetAnchor: "top" };
    } else {
      return { sourceAnchor: "top", targetAnchor: "bottom" };
    }
  } else {
    // 수평 흐름이 우세
    if (dx >= 0) {
      return { sourceAnchor: "right", targetAnchor: "left" };
    } else {
      return { sourceAnchor: "left", targetAnchor: "right" };
    }
  }
}

/**
 * 커넥터 CanvasObject 생성
 */
function createConnectorObject(
  sourceId: string,
  targetId: string,
  label?: string,
  sourceAnchor: "top" | "bottom" | "left" | "right" = "bottom",
  targetAnchor: "top" | "bottom" | "left" | "right" = "top",
): CanvasObject {
  return {
    id: nanoid(),
    type: "connector",
    x: 0,
    y: 0,
    endX: 0,
    endY: 0,
    sourceId,
    targetId,
    sourceAnchor,
    targetAnchor,
    stroke: "#374151",
    strokeWidth: 2,
    pathStyle: "straight" as const,
    endMarker: "arrow" as const,
    label: label || undefined,
    rotation: 0,
    opacity: 1,
  };
}

/**
 * DAG / Grid / Radial 레이아웃 적용
 * shape 위치(x, y)를 재계산
 */
function applyLayout(
  shapes: AIShapeDefinition[],
  layout: AILayoutHint,
): AIShapeDefinition[] {
  if (shapes.length === 0) return shapes;

  if (layout === "grid") {
    return applyGridLayout(shapes);
  }

  if (layout === "radial") {
    return applyRadialLayout(shapes);
  }

  // default: dag (top-to-bottom)
  return applyDagLayout(shapes);
}

/**
 * DAG 레이아웃: connections 기반 top-to-bottom 트리
 * 간단한 구현 — 깊이(depth)별 행 배치, 같은 행 내 균등 분배
 */
function applyDagLayout(shapes: AIShapeDefinition[]): AIShapeDefinition[] {
  const H_GAP = 220;
  const V_GAP = 160;

  // connections 기반 depth 계산
  const depths = new Map<number, number>();
  const children = new Map<number, number[]>();

  // 초기화
  shapes.forEach((_, i) => {
    depths.set(i, 0);
    children.set(i, []);
  });

  // connection graph 구성
  const hasParent = new Set<number>();
  shapes.forEach((shape, i) => {
    if (shape.connections) {
      for (const conn of shape.connections) {
        if (conn.targetIndex >= 0 && conn.targetIndex < shapes.length) {
          children.get(i)!.push(conn.targetIndex);
          hasParent.add(conn.targetIndex);
        }
      }
    }
  });

  // BFS로 depth 계산
  const roots = shapes.map((_, i) => i).filter((i) => !hasParent.has(i));
  if (roots.length === 0) roots.push(0);

  const queue = [...roots];
  roots.forEach((r) => depths.set(r, 0));
  const visited = new Set<number>(roots);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepth = depths.get(current)!;
    for (const child of children.get(current) || []) {
      if (!visited.has(child)) {
        depths.set(child, currentDepth + 1);
        visited.add(child);
        queue.push(child);
      }
    }
  }

  // 방문 안 된 노드 처리
  shapes.forEach((_, i) => {
    if (!visited.has(i)) {
      depths.set(i, 0);
    }
  });

  // depth별 그룹핑
  const rows = new Map<number, number[]>();
  depths.forEach((d, i) => {
    if (!rows.has(d)) rows.set(d, []);
    rows.get(d)!.push(i);
  });

  // 위치 배정
  return shapes.map((shape, i) => {
    const depth = depths.get(i)!;
    const row = rows.get(depth)!;
    const colIndex = row.indexOf(i);
    const totalCols = row.length;

    const x = (colIndex - (totalCols - 1) / 2) * H_GAP;
    const y = depth * V_GAP;

    return { ...shape, x, y };
  });
}

/**
 * Grid 레이아웃: 균등 격자 배치
 */
function applyGridLayout(shapes: AIShapeDefinition[]): AIShapeDefinition[] {
  const cols = Math.ceil(Math.sqrt(shapes.length));
  const H_GAP = 220;
  const V_GAP = 180;

  return shapes.map((shape, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return { ...shape, x: col * H_GAP, y: row * V_GAP };
  });
}

/**
 * Radial 레이아웃: 중심 + 원형 배치
 */
function applyRadialLayout(shapes: AIShapeDefinition[]): AIShapeDefinition[] {
  if (shapes.length <= 1) {
    return shapes.map((s) => ({ ...s, x: 0, y: 0 }));
  }

  const result = shapes.map((s, i) => {
    if (i === 0) {
      return { ...s, x: 0, y: 0 }; // center
    }
    const angle = ((i - 1) / (shapes.length - 1)) * 2 * Math.PI - Math.PI / 2;
    const radius = 250;
    return {
      ...s,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });

  return result;
}

/**
 * shape 배열의 바운딩 박스 중심 계산
 */
function calculateBounds(shapes: AIShapeDefinition[]): {
  centerX: number;
  centerY: number;
} {
  if (shapes.length === 0) return { centerX: 0, centerY: 0 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const s of shapes) {
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x + (s.width || 150));
    maxY = Math.max(maxY, s.y + (s.height || 80));
  }

  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}
