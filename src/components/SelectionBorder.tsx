import { memo } from "react";
import { Rect } from "react-konva";

interface SelectionBorderProps {
  width: number;
  height: number;
  zoom: number;
  isMultiSelected: boolean;
  /** Optional offset from the shape edge (default: 2) */
  offset?: number;
}

/**
 * 다중 선택 시 개별 요소에 표시되는 파란색 점선 테두리
 * PowerPoint 스타일: 각 요소마다 개별 선택 표시
 */
export const SelectionBorder = memo(function SelectionBorder({
  width,
  height,
  zoom,
  isMultiSelected,
  offset = 2,
}: SelectionBorderProps) {
  if (!isMultiSelected) return null;

  return (
    <Rect
      x={-offset}
      y={-offset}
      width={width + offset * 2}
      height={height + offset * 2}
      stroke="#0D99FF"
      strokeWidth={2 / zoom}
      fill="transparent"
      dash={[4, 4]}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
});

/**
 * 원형/타원형 요소를 위한 선택 테두리
 */
interface CircleSelectionBorderProps {
  radius: number;
  zoom: number;
  isMultiSelected: boolean;
  offset?: number;
}

export const CircleSelectionBorder = memo(function CircleSelectionBorder({
  radius,
  zoom,
  isMultiSelected,
  offset = 2,
}: CircleSelectionBorderProps) {
  if (!isMultiSelected) return null;

  // 원을 감싸는 사각형 테두리
  const size = radius * 2;
  return (
    <Rect
      x={-radius - offset}
      y={-radius - offset}
      width={size + offset * 2}
      height={size + offset * 2}
      stroke="#0D99FF"
      strokeWidth={2 / zoom}
      fill="transparent"
      dash={[4, 4]}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
});
