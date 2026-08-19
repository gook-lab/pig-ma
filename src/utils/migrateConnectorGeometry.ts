import type { CanvasObject } from "@/types";
import { getAnchorPointWithAngle, getOffsetRatio } from "./geometry";

/**
 * 예전 커넥터 데이터를 '끝점에 끌려다니지 않는' 형태로 올린다.
 *
 * ## 왜 필요한가
 *
 * 이 프로젝트의 규칙은 **"사용자가 만든 모양은 끝점이 움직여도 그대로"** 다.
 * 그런데 예전 데이터에는 그 규칙을 어기는 두 가지가 남아 있다.
 *
 * 1. `offset` 만 있고 `elbowY` 가 없는 bend
 *    → 렌더가 `start.y + offset` 으로 계산해서 **소스 도형이 움직이면 엘보우도 따라간다**.
 *
 * 2. 절대 픽셀 오프셋(`sourceOffsetX/Y`)만 있고 비율이 없는 연결점
 *    → **도형을 리사이즈하면 연결점이 도형 안쪽으로 파고든다**.
 *
 * 둘 다 폴백 경로라 새 데이터에는 안 생기지만, 남겨두면 "어떤 커넥터는 되고
 * 어떤 건 안 되는" 상태가 되어 원인 파악이 가장 어렵다. 한 번 변환해 없앤다.
 *
 * ## 한계
 *
 * 비율 변환은 **현재 크기** 기준이다. 이미 리사이즈로 어긋난 연결점은 그
 * 자리에 고정될 뿐 원래 위치로 되돌아오지 않는다. 다만 그 이상 어긋나지는
 * 않으므로, 그대로 두는 것보다는 낫다.
 */
export function migrateConnectorGeometry(
  objects: CanvasObject[],
): CanvasObject[] {
  const byId = new Map(objects.map((o) => [o.id, o]));

  return objects.map((obj) => {
    if (obj.type !== "connector") return obj;

    let next = obj;

    // --- 1. 연결점: 절대 오프셋 → 크기 대비 비율 -----------------------------
    const source = obj.sourceId ? byId.get(obj.sourceId) : undefined;
    if (
      source &&
      obj.sourceOffsetX !== undefined &&
      obj.sourceOffsetY !== undefined &&
      obj.sourceOffsetRatioX === undefined
    ) {
      const point = {
        x: source.x + obj.sourceOffsetX,
        y: source.y + obj.sourceOffsetY,
      };
      const { ratioX, ratioY } = getOffsetRatio(source, point);
      next = {
        ...next,
        sourceOffsetRatioX: ratioX,
        sourceOffsetRatioY: ratioY,
      };
    }

    const target = obj.targetId ? byId.get(obj.targetId) : undefined;
    if (
      target &&
      obj.targetOffsetX !== undefined &&
      obj.targetOffsetY !== undefined &&
      obj.targetOffsetRatioX === undefined
    ) {
      const point = {
        x: target.x + obj.targetOffsetX,
        y: target.y + obj.targetOffsetY,
      };
      const { ratioX, ratioY } = getOffsetRatio(target, point);
      next = {
        ...next,
        targetOffsetRatioX: ratioX,
        targetOffsetRatioY: ratioY,
      };
    }

    // --- 2. 엘보우: 상대 offset → 절대 elbowY --------------------------------
    const bends = next.elbowBends;
    if (bends && bends.length > 0) {
      const needsElbowY = bends.some(
        (b) => b.elbowY === undefined && b.offset !== undefined,
      );

      if (needsElbowY) {
        // 소스에 붙어 있으면 앵커 Y, 아니면 커넥터 자체의 y 가 시작점이다
        const startY = source
          ? getAnchorPointWithAngle(
              source,
              next.sourceAnchor ?? "center",
              next.sourceAngle,
              next.sourceOffsetX,
              next.sourceOffsetY,
              next.sourceOffsetRatioX,
              next.sourceOffsetRatioY,
            ).y
          : next.y;

        next = {
          ...next,
          elbowBends: bends.map((b) =>
            b.elbowY === undefined && b.offset !== undefined
              ? { ...b, elbowY: startY + b.offset }
              : b,
          ),
        };
      }
    }

    return next;
  });
}
