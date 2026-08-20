import type { CanvasObject, ElbowBend, PathStyle } from "@/types";
import { getAnchorPointWithAngle } from "./geometry";
import {
  calculateElbowPath,
  type ElbowPathOptions,
  type ElbowSize,
  type Point,
} from "./elbowPath";

/**
 * 커넥터 경로 계산의 **단일 소스**.
 *
 * ## 왜 이 파일이 있는가
 *
 * 커넥터의 경로는 렌더러(shapes/Connector.tsx)만 그리는 게 아니다. 옵션바
 * (ConnectorEditor), 라벨(ConnectorLabel/…LabelEditor/TextEditorOverlay),
 * 그룹 경계(GroupBoundary), 캔버스 미리보기(Canvas)가 각자 라벨·핸들·바운딩
 * 박스를 놓기 위해 경로를 **다시** 계산한다.
 *
 * 예전에는 그 계산이 파일마다 인라인으로 복제되어 있었고, 렌더러에 인자가
 * 추가될 때(sourceAnchor/targetAnchor 의 리드인 스텁, 크기 비례 우회
 * elbowOptions, ratio 기반 연결점) 복제본들은 갱신되지 않았다. 결과:
 * **선은 이쪽에 그려지는데 라벨/옵션바/핸들은 다른 경로 위에 앉는다.**
 *
 * 경로가 필요한 코드는 반드시 여기의 함수를 쓴다. 렌더러도 예외가 아니다.
 */

/**
 * 도형에서 우회 여유 계산용 크기를 뽑는다.
 * 반전 배치에서 커넥터가 도형을 비껴가려면 도형의 절반 크기가 필요하다.
 */
export function toElbowSize(obj?: {
  width?: number;
  height?: number;
  radius?: number;
}): ElbowSize | undefined {
  if (!obj) return undefined;
  if (obj.radius != null) {
    return { width: obj.radius * 2, height: obj.radius * 2 };
  }
  if (obj.width != null && obj.height != null) {
    return { width: obj.width, height: obj.height };
  }
  return undefined;
}

/**
 * 커넥터의 실제 시작/끝점.
 *
 * 도형에 붙어 있으면 앵커(+비율 오프셋)에서, 아니면 커넥터 자신의 좌표에서.
 * ratio 인자까지 포함해야 리사이즈된 도형에서도 렌더러와 같은 점이 나온다.
 */
export function getConnectorEndpoints(
  connector: CanvasObject,
  sourceObject?: CanvasObject,
  targetObject?: CanvasObject,
): { start: Point; end: Point } {
  const start =
    connector.sourceId && sourceObject
      ? getAnchorPointWithAngle(
          sourceObject,
          connector.sourceAnchor ?? "center",
          connector.sourceAngle,
          connector.sourceOffsetX,
          connector.sourceOffsetY,
          connector.sourceOffsetRatioX,
          connector.sourceOffsetRatioY,
        )
      : { x: connector.x, y: connector.y };

  const end =
    connector.targetId && targetObject
      ? getAnchorPointWithAngle(
          targetObject,
          connector.targetAnchor ?? "center",
          connector.targetAngle,
          connector.targetOffsetX,
          connector.targetOffsetY,
          connector.targetOffsetRatioX,
          connector.targetOffsetRatioY,
        )
      : {
          x: connector.endX ?? connector.x + 100,
          y: connector.endY ?? connector.y,
        };

  return { start, end };
}

/**
 * 좌표 기반 경로 계산 (렌더러의 원본 구현을 이동한 것).
 *
 * 드래그 중처럼 끝점을 직접 치환해야 하는 호출자용. 일반 소비자는 아래의
 * getConnectorPathPoints 를 쓴다.
 */
export function computeConnectorPathPoints(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  pathStyle: PathStyle,
  elbowBends?: ElbowBend[],
  sourceAnchor?: string,
  targetAnchor?: string,
  elbowOptions?: ElbowPathOptions,
): number[] {
  switch (pathStyle) {
    case "curved": {
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;
      const dx = endX - startX;
      const dy = endY - startY;
      const controlX = midX - dy * 0.2;
      const controlY = midY + dx * 0.2;
      return [startX, startY, controlX, controlY, endX, endY];
    }
    case "elbowed": {
      return calculateElbowPath(
        { x: startX, y: startY },
        { x: endX, y: endY },
        elbowBends ?? [],
        sourceAnchor,
        targetAnchor,
        elbowOptions,
      );
    }
    default:
      return [startX, startY, endX, endY];
  }
}

/**
 * 커넥터가 화면에 그려지는 것과 **동일한** 경로.
 *
 * 라벨 위치, 옵션바 배치, 그룹 경계 등 경로 위에 무언가를 놓는 모든 코드가
 * 이 함수를 쓴다. overrides 로 라이브 드래그 위치(끝점) / 임시 bend 를
 * 치환할 수 있다 — 그 외 인자(앵커·코너·크기)는 항상 커넥터에서 온다.
 */
export function getConnectorPathPoints(
  connector: CanvasObject,
  sourceObject?: CanvasObject,
  targetObject?: CanvasObject,
  overrides?: { start?: Point; end?: Point; bends?: ElbowBend[] },
): number[] {
  const endpoints = getConnectorEndpoints(
    connector,
    sourceObject,
    targetObject,
  );
  const start = overrides?.start ?? endpoints.start;
  const end = overrides?.end ?? endpoints.end;

  return computeConnectorPathPoints(
    start.x,
    start.y,
    end.x,
    end.y,
    connector.pathStyle ?? "straight",
    overrides?.bends ?? connector.elbowBends,
    connector.sourceAnchor,
    connector.targetAnchor,
    {
      sourceSize: toElbowSize(sourceObject),
      targetSize: toElbowSize(targetObject),
    },
  );
}
