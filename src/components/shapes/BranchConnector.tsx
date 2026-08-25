import { memo, useMemo } from "react";
import { Group, Line, Shape, Circle, Text, Rect } from "react-konva";
import type Konva from "konva";
import type { CanvasObject } from "@/types";
import { computeBranchPaths, type BranchAnchor } from "@/utils/branchPath";
import { getAnchorPointWithAngle } from "@/utils/geometry";
import { measureTextWidth } from "@/utils/richText";

/**
 * 분기 커넥터 — 줄기 1개에서 갈래 N개가 뻗는 마인드맵식 화살표.
 *
 * 1:1 커넥터(`Connector.tsx`)와 분리해 둔다. 저쪽은 드래그·핸들·마커·라벨
 * 편집이 얽힌 2,000줄짜리라 분기 분기를 안에 넣으면 회귀 위험이 크고,
 * 분기 커넥터는 편집 표면이 훨씬 좁기 때문이다.
 */

interface BranchConnectorProps {
  connector: CanvasObject;
  sourceObject?: CanvasObject;
  /** targetIds 순서에 맞춘 타깃 도형들 (없는 건 undefined) */
  targetObjects: Array<CanvasObject | undefined>;
  isSelected: boolean;
  isMultiSelected?: boolean;
  zoom: number;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
}

const DASH: Record<string, number[] | undefined> = {
  dashed: [8, 4],
  dotted: [2, 4],
};

const LABEL_FONT_SIZE = 12;
const LABEL_PAD_X = 6;
const LABEL_PAD_Y = 3;

export const BranchConnector = memo(function BranchConnector({
  connector,
  sourceObject,
  targetObjects,
  isSelected,
  isMultiSelected,
  zoom,
  onSelect,
}: BranchConnectorProps) {
  const stroke = connector.stroke ?? "#374151";
  const strokeWidth = connector.strokeWidth ?? 2;
  const dash = DASH[connector.lineStyle ?? "solid"];
  const showArrow = (connector.endMarker ?? "arrow") !== "none";
  const cornerRadius =
    connector.elbowCornerStyle === "sharp"
      ? 0
      : (connector.elbowCornerRadius ?? 8);

  const start = useMemo(() => {
    if (connector.sourceId && sourceObject) {
      return getAnchorPointWithAngle(
        sourceObject,
        connector.sourceAnchor ?? "center",
        connector.sourceAngle,
        connector.sourceOffsetX,
        connector.sourceOffsetY,
        connector.sourceOffsetRatioX,
        connector.sourceOffsetRatioY,
      );
    }
    return { x: connector.x, y: connector.y };
  }, [
    connector.sourceId,
    connector.sourceAnchor,
    connector.sourceAngle,
    connector.sourceOffsetX,
    connector.sourceOffsetY,
    connector.sourceOffsetRatioX,
    connector.sourceOffsetRatioY,
    connector.x,
    connector.y,
    sourceObject,
  ]);

  const targets = useMemo(() => {
    const ids = connector.targetIds ?? [];
    return ids.flatMap((id, i) => {
      const obj = targetObjects[i];
      if (!obj) return [];
      const point = getAnchorPointWithAngle(
        obj,
        connector.targetAnchor ?? "center",
        connector.targetAngle,
      );
      return [
        {
          id,
          point,
          anchor: (connector.targetAnchor ?? "center") as BranchAnchor,
        },
      ];
    });
  }, [
    connector.targetIds,
    connector.targetAnchor,
    connector.targetAngle,
    targetObjects,
  ]);

  const paths = useMemo(
    () =>
      computeBranchPaths({
        start,
        sourceAnchor: (connector.sourceAnchor ?? "center") as BranchAnchor,
        targets,
        junctionT: connector.junctionT,
        pathStyle: connector.pathStyle === "straight" ? "straight" : "elbowed",
      }),
    [
      start,
      targets,
      connector.sourceAnchor,
      connector.junctionT,
      connector.pathStyle,
    ],
  );

  // 갈래 라벨은 갈래의 중간 지점에 놓는다 — 줄기는 공유 구간이라 겹친다.
  const labels = useMemo(() => {
    const map = connector.branchLabels ?? {};
    return paths.branches.flatMap((b) => {
      const text = map[b.id];
      if (!text) return [];
      const mid = Math.floor(b.points.length / 4) * 2;
      const x = b.points[mid] ?? b.points[0]!;
      const y = b.points[mid + 1] ?? b.points[1]!;
      // 글자 수 × 상수로 폭을 잡으면 한글에서 좁게 나와 라벨이 접힌다 —
      // 캔버스로 실측한다 (DOM 없으면 measureTextWidth 가 추정 폴백).
      const width =
        measureTextWidth(text, LABEL_FONT_SIZE, "sans-serif") + LABEL_PAD_X * 2;
      return [{ id: b.id, text, x, y, width }];
    });
  }, [paths.branches, connector.branchLabels]);

  if (targets.length === 0) return null;

  return (
    <Group id={connector.id}>
      {/* 줄기 — 여기만 한 번 그린다 */}
      <Line
        points={paths.trunk}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={dash}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={20}
        onClick={onSelect}
        onTap={onSelect}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
      />

      {/* 갈래 — 분기점에서 각 타깃으로.
          둥근 모서리와 화살촉을 한 sceneFunc 에서 그린다. Konva Arrow 는
          꺾임점을 둥글게 못 그리고, Line 은 화살촉이 없기 때문이다. */}
      {paths.branches.map((b) => (
        <Shape
          key={b.id}
          sceneFunc={(ctx, shape) => {
            const p = b.points;
            if (p.length < 4) return;
            ctx.beginPath();
            ctx.moveTo(p[0]!, p[1]!);
            for (let i = 2; i < p.length - 2; i += 2) {
              const px = p[i - 2]!,
                py = p[i - 1]!;
              const cx = p[i]!,
                cy = p[i + 1]!;
              const nx = p[i + 2]!,
                ny = p[i + 3]!;
              const inLen = Math.hypot(cx - px, cy - py);
              const outLen = Math.hypot(nx - cx, ny - cy);
              const r = Math.min(cornerRadius, inLen / 2, outLen / 2);
              if (r <= 0) {
                ctx.lineTo(cx, cy);
                continue;
              }
              ctx.lineTo(
                cx - ((cx - px) / inLen) * r,
                cy - ((cy - py) / inLen) * r,
              );
              ctx.quadraticCurveTo(
                cx,
                cy,
                cx + ((nx - cx) / outLen) * r,
                cy + ((ny - cy) / outLen) * r,
              );
            }
            const endX = p[p.length - 2]!;
            const endY = p[p.length - 1]!;
            ctx.lineTo(endX, endY);
            ctx.strokeShape(shape);

            if (!showArrow) return;
            // 화살촉 — 마지막 구간 방향으로
            const fromX = p[p.length - 4]!;
            const fromY = p[p.length - 3]!;
            const angle = Math.atan2(endY - fromY, endX - fromX);
            const head = 7;
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(
              endX - head * Math.cos(angle - Math.PI / 7),
              endY - head * Math.sin(angle - Math.PI / 7),
            );
            ctx.lineTo(
              endX - head * Math.cos(angle + Math.PI / 7),
              endY - head * Math.sin(angle + Math.PI / 7),
            );
            ctx.closePath();
            ctx.fillStrokeShape(shape);
          }}
          stroke={stroke}
          strokeWidth={strokeWidth}
          fill={stroke}
          dash={dash}
          lineCap="round"
          lineJoin="round"
          hitStrokeWidth={20}
          onClick={onSelect}
          onTap={onSelect}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
        />
      ))}

      {/* 갈래 라벨 */}
      {labels.map((l) => (
        <Group
          key={l.id}
          x={l.x - l.width / 2}
          y={l.y - (LABEL_FONT_SIZE + LABEL_PAD_Y * 2) / 2}
        >
          <Rect
            width={l.width}
            height={LABEL_FONT_SIZE + LABEL_PAD_Y * 2}
            fill="#ffffff"
            cornerRadius={4}
            opacity={0.92}
            listening={false}
            perfectDrawEnabled={false}
          />
          <Text
            text={l.text}
            fontSize={LABEL_FONT_SIZE}
            fill="#1f2937"
            width={l.width}
            align="center"
            wrap="none"
            y={LABEL_PAD_Y}
            listening={false}
            perfectDrawEnabled={false}
          />
        </Group>
      ))}

      {/* 선택 표시 — 분기점을 보여 준다 (드래그 편집은 후속 작업) */}
      {(isSelected || isMultiSelected) && (
        <Circle
          x={paths.junction.x}
          y={paths.junction.y}
          radius={4 / zoom}
          fill="#0D99FF"
          stroke="#ffffff"
          strokeWidth={1.5 / zoom}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  );
});
