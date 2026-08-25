/**
 * 분기 커넥터(마인드맵식 줄기+갈래) 경로 계산 — 순수 함수.
 *
 * 한 소스에서 여러 타깃으로 갈 때 커넥터를 N개 그리면 줄기 구간이 완전히
 * 겹쳐 그려지고, 갈라지는 자리에서 각자의 코너가 반대로 휘어 이음매가
 * 지저분해진다. 여기서는 **줄기를 한 번만** 계산하고 분기점(junction)에서
 * 갈래를 뻗는다.
 *
 * 좌표계는 화면 좌표(캔버스 절대좌표)이고, 이 파일은 store 를 모른다.
 */

export interface Point {
  x: number;
  y: number;
}

export type BranchAnchor = "top" | "right" | "bottom" | "left" | "center";

export interface BranchTarget {
  /** 타깃 식별자 — 갈래 라벨을 붙이거나 히트 판정을 되짚을 때 쓴다 */
  id: string;
  point: Point;
  anchor?: BranchAnchor;
}

export interface BranchPathInput {
  start: Point;
  sourceAnchor?: BranchAnchor;
  targets: BranchTarget[];
  /** 소스와 타깃 사이 분기점 위치 (0~1, 기본 0.5) */
  junctionT?: number;
  pathStyle?: "straight" | "elbowed";
}

export interface BranchPathResult {
  junction: Point;
  /** 소스 앵커 → 분기점 */
  trunk: number[];
  /** 분기점 → 각 타깃 (입력 순서 유지) */
  branches: Array<{ id: string; points: number[] }>;
}

/** 소스 앵커가 어느 축으로 흐르는지 — 분기점을 그 축 위에 놓는다. */
function axisOf(anchor: BranchAnchor | undefined): "vertical" | "horizontal" {
  return anchor === "left" || anchor === "right" ? "horizontal" : "vertical";
}

const DEFAULT_JUNCTION_T = 0.5;
/** 분기점이 소스/타깃에 너무 붙으면 줄기나 갈래가 사라진다 */
const MIN_STUB = 16;

/**
 * 분기점 좌표.
 *
 * 흐름 축에서 **소스와 가장 가까운 타깃 사이**를 junctionT 로 나눈 지점이다.
 * 가장 가까운 타깃을 기준으로 잡아야 분기점이 어떤 타깃보다도 뒤로 가지 않는다
 * (뒤로 가면 갈래가 거꾸로 꺾여 들어간다).
 */
export function computeJunction(input: BranchPathInput): Point {
  const { start, sourceAnchor, targets } = input;
  const t = input.junctionT ?? DEFAULT_JUNCTION_T;
  const clampedT = Math.min(0.9, Math.max(0.1, t));

  if (targets.length === 0) return { ...start };

  if (axisOf(sourceAnchor) === "vertical") {
    const goingUp = sourceAnchor === "top";
    const nearest = goingUp
      ? Math.max(...targets.map((b) => b.point.y))
      : Math.min(...targets.map((b) => b.point.y));
    const raw = start.y + (nearest - start.y) * clampedT;
    const y = goingUp
      ? Math.min(start.y - MIN_STUB, Math.max(nearest + MIN_STUB, raw))
      : Math.max(start.y + MIN_STUB, Math.min(nearest - MIN_STUB, raw));
    return { x: start.x, y };
  }

  const goingLeft = sourceAnchor === "left";
  const nearest = goingLeft
    ? Math.max(...targets.map((b) => b.point.x))
    : Math.min(...targets.map((b) => b.point.x));
  const raw = start.x + (nearest - start.x) * clampedT;
  const x = goingLeft
    ? Math.min(start.x - MIN_STUB, Math.max(nearest + MIN_STUB, raw))
    : Math.max(start.x + MIN_STUB, Math.min(nearest - MIN_STUB, raw));
  return { x, y: start.y };
}

/**
 * 줄기 1개 + 갈래 N개.
 *
 * 갈래는 분기점에서 **흐름 방향으로만** 뻗어 나간다 — 분기점 자체에서는
 * 코너를 그리지 않으므로 커넥터를 여러 개 얹었을 때 생기던 갈고리가 없다.
 */
export function computeBranchPaths(input: BranchPathInput): BranchPathResult {
  const { start, sourceAnchor, targets } = input;
  const junction = computeJunction(input);
  const trunk = [start.x, start.y, junction.x, junction.y];

  const vertical = axisOf(sourceAnchor) === "vertical";

  // 갈래 경로는 **버스 → 드롭** 두 구간이다.
  // 세로 흐름이면 분기점 높이를 따라 타깃 x 까지 간 다음 곧장 내려간다.
  //
  // 범용 엘보우 라우터(calculateElbowPath)를 쓰지 않는 이유: 그쪽은 타깃
  // 박스를 피해 도는 로직이 있어서, 분기점이 타깃에 가까우면 크게 우회한다
  // (실측: 80px 간격에서 260px 밖으로 돌아나갔다). 마인드맵 갈래는 도형을
  // 피할 일이 없으므로 직접 계산하는 편이 예측 가능하다.
  const branches = targets.map((target) => {
    const end = target.point;
    if (input.pathStyle === "straight") {
      return {
        id: target.id,
        points: [junction.x, junction.y, end.x, end.y],
      };
    }
    const corner = vertical
      ? { x: end.x, y: junction.y }
      : { x: junction.x, y: end.y };
    // 분기점 바로 아래(옆)면 꺾을 필요가 없다
    const straight = vertical
      ? Math.abs(end.x - junction.x) < 0.5
      : Math.abs(end.y - junction.y) < 0.5;
    return {
      id: target.id,
      points: straight
        ? [junction.x, junction.y, end.x, end.y]
        : [junction.x, junction.y, corner.x, corner.y, end.x, end.y],
    };
  });

  return { junction, trunk, branches };
}

/** 분기 커넥터인지 — 렌더러가 이걸로 갈라진다. */
export function isBranchConnector(obj: {
  type?: string;
  targetIds?: string[];
}): boolean {
  return obj.type === "connector" && (obj.targetIds?.length ?? 0) > 0;
}
