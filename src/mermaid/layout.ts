import type { MermaidGraph, MermaidNode } from "./types";

// ============================================================================
// 레이어드 레이아웃 (간단 버전)
//
// 랭크(계층)를 위상 순서 기반으로 배정하고, 방향(TD/LR/BT/RL)에 따라
// 랭크 축/교차 축에 노드를 배치한다. dagre 급 교차 최소화는 하지 않는다.
// ============================================================================

export interface NodeLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const RANK_GAP = 140; // 랭크 사이 간격 — 엘보우 커넥터의 세로 구간과 엣지 라벨이 들어갈 자리
const NODE_GAP = 50; // 같은 랭크 내 노드 간격
const MIN_WIDTH = 120;
const NODE_HEIGHT = 60;
const DECISION_SIZE = 110; // 다이아몬드는 정사각형에 가깝게

/** 라벨 길이 기반 노드 크기 추정 */
function nodeSize(node: MermaidNode): { width: number; height: number } {
  if (node.shape === "decision") {
    const side = Math.max(DECISION_SIZE, node.label.length * 7 + 50);
    return { width: side, height: Math.max(80, side * 0.6) };
  }
  if (node.shape === "circle") {
    const d = Math.max(80, node.label.length * 8 + 30);
    return { width: d, height: d };
  }
  return {
    width: Math.max(MIN_WIDTH, node.label.length * 8 + 40),
    height: NODE_HEIGHT,
  };
}

/**
 * 랭크 배정 — Kahn 위상 정렬 기반. 사이클에 걸린 노드는
 * 남은 것 중 진입 차수가 가장 작은 노드를 강제로 꺼내 진행한다.
 */
function assignRanks(graph: MermaidGraph): Map<string, number> {
  const ids = graph.nodes.map((n) => n.id);
  const indegree = new Map<string, number>(ids.map((id) => [id, 0]));
  const outgoing = new Map<string, string[]>(ids.map((id) => [id, []]));

  for (const edge of graph.edges) {
    if (!indegree.has(edge.from) || !indegree.has(edge.to)) continue;
    if (edge.from === edge.to) continue; // self-loop 은 랭크에 영향 없음
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)!.push(edge.to);
  }

  const rank = new Map<string, number>();
  const remaining = new Set(ids);
  let queue = ids.filter((id) => (indegree.get(id) ?? 0) === 0);
  queue.forEach((id) => rank.set(id, 0));

  while (remaining.size > 0) {
    if (queue.length === 0) {
      // 사이클 — 남은 노드 중 진입 차수 최소인 것을 강제 방출
      let best: string | null = null;
      for (const id of remaining) {
        if (
          best === null ||
          (indegree.get(id) ?? 0) < (indegree.get(best) ?? 0)
        ) {
          best = id;
        }
      }
      if (best === null) break;
      if (!rank.has(best)) rank.set(best, 0);
      queue = [best];
    }
    const next: string[] = [];
    for (const id of queue) {
      if (!remaining.has(id)) continue;
      remaining.delete(id);
      const r = rank.get(id) ?? 0;
      for (const child of outgoing.get(id) ?? []) {
        rank.set(child, Math.max(rank.get(child) ?? 0, r + 1));
        indegree.set(child, (indegree.get(child) ?? 1) - 1);
        if ((indegree.get(child) ?? 0) <= 0 && remaining.has(child)) {
          next.push(child);
        }
      }
    }
    queue = next;
  }
  return rank;
}

/**
 * 그래프 전체 레이아웃. (0,0) 근처에서 시작하는 좌표를 반환한다
 * (뷰포트 중앙 배치는 호출부 담당).
 */
export function layoutGraph(graph: MermaidGraph): Map<string, NodeLayout> {
  const ranks = assignRanks(graph);
  const sizes = new Map(graph.nodes.map((n) => [n.id, nodeSize(n)]));

  // 랭크별 그룹 (노드 정의 순서 유지 — 교차 최소화 대신 안정성)
  const byRank = new Map<number, MermaidNode[]>();
  for (const node of graph.nodes) {
    const r = ranks.get(node.id) ?? 0;
    if (!byRank.has(r)) byRank.set(r, []);
    byRank.get(r)!.push(node);
  }

  const vertical = graph.direction === "TD" || graph.direction === "BT";
  const reversed = graph.direction === "BT" || graph.direction === "RL";
  const maxRank = Math.max(...byRank.keys());

  const layout = new Map<string, NodeLayout>();
  let mainAxisPos = 0; // 랭크 축 진행 위치

  for (let r = 0; r <= maxRank; r++) {
    const nodes = byRank.get(r) ?? [];
    if (nodes.length === 0) continue;

    // 이 랭크의 두께 (랭크 축 방향 크기 최대값)
    const thickness = Math.max(
      ...nodes.map((n) =>
        vertical ? sizes.get(n.id)!.height : sizes.get(n.id)!.width,
      ),
    );
    // 교차 축 전체 길이 → 중앙 정렬
    const crossTotal =
      nodes.reduce(
        (sum, n) =>
          sum + (vertical ? sizes.get(n.id)!.width : sizes.get(n.id)!.height),
        0,
      ) +
      NODE_GAP * (nodes.length - 1);

    let crossPos = -crossTotal / 2;
    for (const node of nodes) {
      const size = sizes.get(node.id)!;
      const cross = vertical ? size.width : size.height;
      // 랭크 축 내 중앙 정렬 (두께가 다른 노드 대비)
      const mainOffset =
        (thickness - (vertical ? size.height : size.width)) / 2;
      const main = mainAxisPos + mainOffset;

      layout.set(node.id, {
        x: vertical ? crossPos : main,
        y: vertical ? main : crossPos,
        width: size.width,
        height: size.height,
      });
      crossPos += cross + NODE_GAP;
    }
    mainAxisPos += thickness + RANK_GAP;
  }

  // BT/RL 은 랭크 축 반전
  if (reversed) {
    const total = mainAxisPos - RANK_GAP;
    for (const l of layout.values()) {
      if (vertical) l.y = total - l.y - l.height;
      else l.x = total - l.x - l.width;
    }
  }

  return layout;
}
