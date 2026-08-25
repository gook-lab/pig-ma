import type { CanvasObject, ShapeVariant } from "@/types";
import { useCanvasStore } from "@/store";
import { generateUUID } from "@/utils/uuid";
import { parseMermaid } from "./parser";
import { layoutGraph, RANK_GAP } from "./layout";
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

type AnchorSide = "top" | "right" | "bottom" | "left";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 사각형에서 지정한 변의 중앙점. */
function anchorPoint(rect: Rect, side: AnchorSide): { x: number; y: number } {
  switch (side) {
    case "top":
      return { x: rect.x + rect.width / 2, y: rect.y };
    case "bottom":
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
    case "left":
      return { x: rect.x, y: rect.y + rect.height / 2 };
    case "right":
      return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
  }
}

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
      // classDef/class/style 로 지정한 값이 기본 스타일을 덮는다
      ...(node.style?.fill ? { fill: node.style.fill } : {}),
      ...(node.style?.stroke ? { stroke: node.style.stroke } : {}),
      ...(node.style?.textColor ? { textColor: node.style.textColor } : {}),
      ...(node.style?.strokeWidth != null
        ? { strokeWidth: node.style.strokeWidth }
        : {}),
    });
  }

  const vertical = graph.direction === "TD" || graph.direction === "BT";
  const reversed = graph.direction === "BT" || graph.direction === "RL";

  // 흐름이 나가고 들어오는 변. attached 커넥터는 앵커가 없으면 "center" 로
  // 해석되어 선이 도형 중심에서 출발한다 (connectorPath.ts).
  const flowSource: AnchorSide = vertical
    ? reversed
      ? "top"
      : "bottom"
    : reversed
      ? "left"
      : "right";
  const flowTarget: AnchorSide = vertical
    ? reversed
      ? "bottom"
      : "top"
    : reversed
      ? "right"
      : "left";
  // 랭크를 건너뛰는 엣지는 흐름 방향 변에서 나가면 중간 랭크의 노드를 관통한다.
  // 옆면으로 빼서 우회시키되, 도형을 가로지르지 않게 **가까운 쪽**으로 돈다.
  // 도해 전체의 가운데를 기준으로 **바깥쪽**으로 돈다 — 안쪽으로 돌면
  // 반대편 열을 가로질러 다른 노드 위를 지나간다.
  const allRects = [...nodeLayoutById.values()];
  const graphMidX =
    (Math.min(...allRects.map((r) => r.x)) +
      Math.max(...allRects.map((r) => r.x + r.width))) /
    2;
  const graphMidY =
    (Math.min(...allRects.map((r) => r.y)) +
      Math.max(...allRects.map((r) => r.y + r.height))) /
    2;
  const detourSide = (from: Rect, to: Rect): AnchorSide => {
    if (vertical) {
      const anchorMid =
        ((from.x + from.width / 2) + (to.x + to.width / 2)) / 2;
      return anchorMid <= graphMidX ? "left" : "right";
    }
    const anchorMid =
      ((from.y + from.height / 2) + (to.y + to.height / 2)) / 2;
    return anchorMid <= graphMidY ? "top" : "bottom";
  };

  // 라벨은 경로 중앙(t=0.5)이 기본인데, 엘보우에서 그 지점은 랭크 사이의
  // 공용 가로 구간이라 한 노드로 모이는(또는 한 노드에서 갈라지는) 엣지끼리
  // 라벨이 겹친다. 겹치는 쪽을 피해 라벨을 세로 구간으로 밀어 둔다.
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  for (const edge of graph.edges) {
    fanIn.set(edge.to, (fanIn.get(edge.to) ?? 0) + 1);
    fanOut.set(edge.from, (fanOut.get(edge.from) ?? 0) + 1);
  }
  // 같은 끝점을 공유하는 엣지끼리는 순번만큼 라벨을 더 밀어 준다 —
  // 모이면서 동시에 갈라지는 노드에서는 한쪽으로만 밀면 다시 겹친다.
  const seenIn = new Map<string, number>();
  const seenOut = new Map<string, number>();

  // 같은 소스에서 같은 스타일로 나가는 엣지는 **분기 커넥터 하나**로 묶는다.
  // 개별 커넥터로 두면 줄기 구간이 겹쳐 그려지고 갈라지는 자리에 갈고리가
  // 생긴다 (docs/proposals/branch-connector.md).
  const branchable = new Map<string, typeof graph.edges>();
  for (const edge of graph.edges) {
    const from = nodeLayoutById.get(edge.from);
    const to = nodeLayoutById.get(edge.to);
    if (!from || !to) continue;
    const span = vertical
      ? Math.abs(reversed ? from.y - (to.y + to.height) : to.y - (from.y + from.height))
      : Math.abs(reversed ? from.x - (to.x + to.width) : to.x - (from.x + from.width));
    // 랭크를 건너뛰는 엣지는 우회 경로라 줄기를 공유할 수 없다
    if (span > RANK_GAP * 1.6) continue;
    const key = `${edge.from}|${edge.style}|${edge.arrow}`;
    const list = branchable.get(key) ?? [];
    list.push(edge);
    branchable.set(key, list);
  }
  const branchedEdges = new Set<(typeof graph.edges)[number]>();
  for (const list of branchable.values()) {
    if (list.length < 2) continue;
    const first = list[0]!;
    const sourceId = objectIdByNode.get(first.from);
    const from = nodeLayoutById.get(first.from);
    if (!sourceId || !from) continue;
    const targetIds: string[] = [];
    const branchLabels: Record<string, string> = {};
    for (const edge of list) {
      const targetId = objectIdByNode.get(edge.to);
      if (!targetId) continue;
      targetIds.push(targetId);
      if (edge.label) branchLabels[targetId] = edge.label;
      branchedEdges.add(edge);
    }
    if (targetIds.length < 2) {
      for (const edge of list) branchedEdges.delete(edge);
      continue;
    }
    const start = anchorPoint(from, flowSource);
    objects.push({
      id: generateUUID(),
      type: "connector",
      x: start.x,
      y: start.y,
      rotation: 0,
      opacity: 1,
      sourceId,
      targetIds,
      sourceAnchor: flowSource,
      targetAnchor: flowTarget,
      pathStyle: "elbowed",
      elbowCornerStyle: "rounded",
      startMarker: "none",
      endMarker: first.arrow ? "arrow" : "none",
      lineStyle: first.style === "dotted" ? "dashed" : "solid",
      strokeWidth: first.style === "thick" ? 4 : 2,
      stroke: CONNECTOR_STROKE,
      ...(Object.keys(branchLabels).length ? { branchLabels } : {}),
    });
  }

  for (const edge of graph.edges) {
    if (branchedEdges.has(edge)) continue;
    const sourceId = objectIdByNode.get(edge.from);
    const targetId = objectIdByNode.get(edge.to);
    const from = nodeLayoutById.get(edge.from);
    const to = nodeLayoutById.get(edge.to);
    if (!sourceId || !targetId || !from || !to) continue;

    // 랭크 간 거리로 건너뛰기를 판정한다 (한 랭크면 간격이 RANK_GAP 하나).
    const span = vertical
      ? Math.abs(reversed ? from.y - (to.y + to.height) : to.y - (from.y + from.height))
      : Math.abs(reversed ? from.x - (to.x + to.width) : to.x - (from.x + from.width));
    const skipsRank = span > RANK_GAP * 1.6;
    const side = detourSide(from, to);
    const sourceAnchor = skipsRank ? side : flowSource;
    const targetAnchor = skipsRank ? side : flowTarget;

    // 시작/끝점은 앵커 변의 중앙 — attached 커넥터라 도형 이동 시 재계산됨
    const start = anchorPoint(from, sourceAnchor);
    const end = anchorPoint(to, targetAnchor);

    // 모이는 엣지면 출발 쪽(각 엣지의 세로 구간이 서로 다른 x),
    // 갈라지는 엣지면 도착 쪽으로. 둘 다면 모이는 쪽을 우선한다.
    const converging = (fanIn.get(edge.to) ?? 0) > 1;
    const diverging = (fanOut.get(edge.from) ?? 0) > 1;
    const inSeq = seenIn.get(edge.to) ?? 0;
    const outSeq = seenOut.get(edge.from) ?? 0;
    seenIn.set(edge.to, inSeq + 1);
    seenOut.set(edge.from, outSeq + 1);
    const LABEL_STEP = 0.09;
    // 모이면서 동시에 갈라지면 양끝 모두 경로가 겹친다 — 가운데 구간만 남는다.
    const labelT =
      converging && diverging
        ? Math.min(0.72, 0.5 + outSeq * LABEL_STEP)
        : converging
          ? Math.min(0.45, 0.18 + inSeq * LABEL_STEP)
          : diverging
            ? Math.max(0.55, 0.82 - outSeq * LABEL_STEP)
            : 0.5;

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
      sourceAnchor,
      targetAnchor,
      // 레이어드 레이아웃이라 랭크를 가로지르는 사선보다 직교 경로가 읽기 쉽다
      pathStyle: "elbowed",
      elbowCornerStyle: "rounded",
      startMarker: "none",
      endMarker: edge.arrow ? "arrow" : "none",
      lineStyle: edge.style === "dotted" ? "dashed" : "solid",
      strokeWidth: edge.style === "thick" ? 4 : 2,
      stroke: CONNECTOR_STROKE,
      label: edge.label,
      labelT,
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
