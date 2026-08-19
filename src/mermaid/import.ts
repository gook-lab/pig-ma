import type { CanvasObject, ShapeVariant } from "@/types";
import { useCanvasStore } from "@/store";
import { generateUUID } from "@/utils/uuid";
import { parseMermaid } from "./parser";
import { layoutGraph } from "./layout";
import type { MermaidGraph, MermaidNodeShape } from "./types";
import { MermaidImportError } from "./types";

// ============================================================================
// Mermaid → pig-ma 변환/적용
// ============================================================================

const SHAPE_VARIANT_MAP: Record<MermaidNodeShape, ShapeVariant> = {
  process: "flowProcess",
  rounded: "flowTerminal",
  stadium: "flowTerminal",
  circle: "circle",
  decision: "flowDecision",
  hexagon: "flowPreparation",
  database: "flowDatabase",
  subroutine: "flowPredefined",
  data: "flowData",
};

/** flowchart 노드 기본 스타일 — 흰 배경 + 진회색 외곽선 (가독성) */
const NODE_STYLE = {
  fill: "#ffffff",
  fillMode: "fill" as const,
  stroke: "#374151",
  strokeWidth: 2,
  textColor: "#1f2937",
  fontSize: 14,
};

const CONNECTOR_STROKE = "#374151";

export interface MermaidConvertResult {
  objects: CanvasObject[];
}

/**
 * 파싱된 그래프를 pig-ma objects 로 변환한다 (레이아웃 포함, (0,0) 기준).
 */
export function convertMermaid(graph: MermaidGraph): MermaidConvertResult {
  const layout = layoutGraph(graph);
  const objects: CanvasObject[] = [];
  const objectIdByNode = new Map<string, string>();
  const nodeLayoutById = new Map(
    graph.nodes.map((n) => [n.id, layout.get(n.id)!]),
  );

  for (const node of graph.nodes) {
    const l = layout.get(node.id);
    if (!l) continue;
    const id = generateUUID();
    objectIdByNode.set(node.id, id);
    objects.push({
      id,
      type: "shape",
      x: l.x,
      y: l.y,
      width: l.width,
      height: l.height,
      rotation: 0,
      opacity: 1,
      shapeVariant: SHAPE_VARIANT_MAP[node.shape],
      text: node.label,
      textAlign: "center",
      ...NODE_STYLE,
    });
  }

  const vertical = graph.direction === "TD" || graph.direction === "BT";
  for (const edge of graph.edges) {
    const sourceId = objectIdByNode.get(edge.from);
    const targetId = objectIdByNode.get(edge.to);
    const from = nodeLayoutById.get(edge.from);
    const to = nodeLayoutById.get(edge.to);
    if (!sourceId || !targetId || !from || !to) continue;

    // 시작/끝점은 방향에 맞는 변 중앙 — attached 커넥터라 도형 이동 시 재계산됨
    const start = vertical
      ? { x: from.x + from.width / 2, y: from.y + from.height }
      : { x: from.x + from.width, y: from.y + from.height / 2 };
    const end = vertical
      ? { x: to.x + to.width / 2, y: to.y }
      : { x: to.x, y: to.y + to.height / 2 };

    objects.push({
      id: generateUUID(),
      type: "connector",
      x: start.x,
      y: start.y,
      endX: end.x,
      endY: end.y,
      rotation: 0,
      opacity: 1,
      sourceId,
      targetId,
      pathStyle: "straight",
      startMarker: "none",
      endMarker: edge.arrow ? "arrow" : "none",
      lineStyle: edge.style === "dotted" ? "dashed" : "solid",
      strokeWidth: edge.style === "thick" ? 4 : 2,
      stroke: CONNECTOR_STROKE,
      label: edge.label,
    });
  }

  return { objects };
}

export interface MermaidImportSummary {
  nodeCount: number;
  edgeCount: number;
}

/**
 * Mermaid 텍스트를 파싱해 현재 캔버스에 추가한다 (뷰포트 중앙 배치).
 * 실패 시 MermaidImportError.
 */
export function importMermaidToCanvas(source: string): MermaidImportSummary {
  const graph = parseMermaid(source);
  const { objects } = convertMermaid(graph);
  if (objects.length === 0) {
    throw new MermaidImportError("No importable elements found");
  }

  const { viewport } = useCanvasStore.getState();
  const centerX = -viewport.x + window.innerWidth / 2 / viewport.zoom;
  const centerY = -viewport.y + window.innerHeight / 2 / viewport.zoom;

  const shapes = objects.filter((o) => o.type === "shape");
  const minX = Math.min(...shapes.map((o) => o.x));
  const minY = Math.min(...shapes.map((o) => o.y));
  const maxX = Math.max(...shapes.map((o) => o.x + (o.width ?? 0)));
  const maxY = Math.max(...shapes.map((o) => o.y + (o.height ?? 0)));
  const offsetX = centerX - (minX + maxX) / 2;
  const offsetY = centerY - (minY + maxY) / 2;

  const store = useCanvasStore.getState();
  for (const obj of objects) {
    store.addObject({
      ...obj,
      x: obj.x + offsetX,
      y: obj.y + offsetY,
      endX: obj.endX != null ? obj.endX + offsetX : undefined,
      endY: obj.endY != null ? obj.endY + offsetY : undefined,
    });
  }

  return {
    nodeCount: shapes.length,
    edgeCount: objects.length - shapes.length,
  };
}
